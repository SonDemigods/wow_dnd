/**
 * Boss 机制 Composable
 * 
 * 从 combat store 提取的 Boss 专属机制函数。
 * 负责初始化 Boss 阶段管理器、缩放效果值，以及将阶段机制效果应用到玩家或敌人。
 * 
 * S3 解耦：通过 IBossContext 接口注入外部依赖，不再直接 import
 * useCharacterStore / useEnemyStore，使 Boss 机制可独立测试与复用。
 */
import type { EnemyInstance } from '@/modules/enemy';
import type { BossIntro, BossPhase, BossMechanicType, BossInstance } from '@/modules/boss';
import { wrapAsBossInstance, isBossEnemyInstance } from '@/modules/boss';
import { BossPhaseManager } from '@/modules/boss';
import {
  generateEffectId,
  addEffectToContainer,
  type Effect,
  type EffectType,
} from '../effects';
import type { useCombatState } from './useCombatState';
import type { useCombatLog } from './useCombatLog';
import { BOSS_COUNTER_DAMAGE_RATIO, BOSS_REVIVE_HP_RATIO, BOSS_EFFECT_SCALE_STEP } from '@/config/combat';

/**
 * Boss 机制上下文接口
 *
 * combat Store 实现此接口并注入 useBossMechanics，消除 Boss 机制逻辑对
 * combat Store / 外部 Store 的直接依赖。
 *
 * 设计原则：
 * - 接口最小化：仅暴露 useBossMechanics 实际需要、且无法通过 state/log
 *   参数获得的外部能力（玩家名称、创建小怪、重建先攻）
 * - 延迟绑定：rebuildInitiativeOrder 通过闭包延迟引用 initiative，
 *   避免构造期循环依赖（useInitiative 依赖 useBossMechanics，反之亦然）
 */
export interface IBossContext {
  /** 获取玩家名称（用于日志显示） */
  getPlayerName(): string;
  /** 创建小怪（Boss 召唤机制） */
  createMinion(dataId: string, level: number): Promise<EnemyInstance | null>;
  /** 重建先攻顺序（召唤小怪后调用，通过闭包延迟绑定 initiative） */
  rebuildInitiativeOrder(): void;
  /** 对玩家造成伤害（Boss 反弹/反击机制） */
  applyDamageToPlayer(amount: number): void;
}

export function useBossMechanics(
  state: ReturnType<typeof useCombatState>,
  log: ReturnType<typeof useCombatLog>,
  bossCtx: IBossContext,
) {
  /**
   * 初始化 Boss 专属功能（阶段管理器、出场演出、Boss 实例映射）
   *
   * 阶段三 3.5 升级：
   *   - 新增 bossInstances Map 初始化，收口 Boss 运行时状态
   *   - BossInstance.base 与 enemy 同引用，combat 层可通过 bossInstances.get(id) 获取 runtime
   *
   * 阶段四升级：
   *   - EnemyData 已移除 phases/intro 字段定义，EnemyInstance 类型层面不再携带这些字段
   *   - 先创建 BossInstance（wrapAsBossInstance 内部通过类型断言读取附加属性恢复 phases/intro）
   *   - 后续通过 bossInstance.phases/intro 访问，不再通过 e.phases/e.intro
   *
   * TS-2 修复：
   *   - 定义 BossEnemyInstance extends EnemyInstance，phases/intro 在类型层面声明
   *   - isBossEnemyInstance 类型守卫替代 if (e.isBoss) 简单判断，收窄为 BossEnemyInstance
   *   - wrapAsBossInstance 入参改为 BossEnemyInstance，消除 as 断言
   *
   * @param enemiesData - 敌人数据数组（Boss 元素携带 phases/intro 字段）
   */
  function initBossFeatures(enemiesData: EnemyInstance[]): void {
    state.bossPhaseManagers.clear();
    state.bossInstances.clear();
    const intros: Record<string, BossIntro> = {};
    for (const e of enemiesData) {
      // TS-2 修复：用 isBossEnemyInstance 类型守卫收窄为 BossEnemyInstance
      // 替代原先 if (e.isBoss) + wrapAsBossInstance 内部 as 断言
      if (isBossEnemyInstance(e)) {
        // 创建组合式 BossInstance，base 与 enemy 同引用
        const bossInstance = wrapAsBossInstance(e);
        state.bossInstances.set(e.id, bossInstance);
        if (bossInstance.phases.length > 0) {
          state.bossPhaseManagers.set(e.id, new BossPhaseManager());
        }
        if (bossInstance.intro) {
          intros[e.id] = bossInstance.intro;
        }
      }
    }
    state.bossIntros.value = intros;
  }

  /**
   * 按 Boss 等级缩放效果值（线性增长，公式：baseValue × (1 + (level-1) × 0.08)）
   * @param baseValue - 配置中的基础效果值
   * @param bossLevel - Boss 等级
   * @returns 缩放后的效果值
   */
  function scaleBossEffectValue(baseValue: number, bossLevel: number): number {
    // P6-004 修复：魔法数字 0.08 抽取到 config/combat.ts BOSS_EFFECT_SCALE_STEP
    return Math.floor(baseValue * (1 + (bossLevel - 1) * BOSS_EFFECT_SCALE_STEP));
  }

  /**
   * 应用 Boss 机制的实际效果到玩家或敌人
   *
   * 阶段三 3.5 升级：入参从 EnemyInstance 改为组合式 BossInstance
   *   - 战斗属性（name/level/hp/maxHp/id）通过 boss.base 访问
   *   - 运行时状态（pendingSummons 等）通过 boss.runtime 访问
   *
   * @param boss - 组合式 Boss 实例
   * @param mechType - 机制类型
   * @param phase - 当前阶段（用于获取参数）
   */
  function applyMechanicEffect(boss: BossInstance, mechType: BossMechanicType, phase: BossPhase): void {
    const mechanic = phase.mechanics.find(m => m.type === mechType);
    const params = mechanic?.params || {};
    const playerName = bossCtx.getPlayerName();
    const { base, runtime } = boss;

    switch (mechType) {
      case 'stun_player': {
        // P3-90 修复说明：turns=0 无实际意义（眩晕 0 回合等于无效），使用 || 提供默认值 1
        const turns = Number(params?.turns) || 1;
        const stunEffect: Effect = {
          id: generateEffectId(),
          type: 'stun',
          remainingTurns: turns,
          value: 1,
          source: 'enemy',
          sourceName: base.name
        };
        addEffectToContainer(state.playerEffects.value, stunEffect);
        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_event', targetType: 'player', targetId: 'player',
          targetName: playerName, isCrit: false, isDodge: false,
          message: `${playerName} 被 ${base.name} 眩晕了 ${stunEffect.remainingTurns} 回合！`
        });
        break;
      }
      case 'silence_player': {
        // P3-90 修复说明：turns=0 无实际意义（沉默 0 回合等于无效），使用 || 提供默认值 2
        const turns = Number(params?.turns) || 2;
        const silenceEffect: Effect = {
          id: generateEffectId(),
          type: 'silence',
          remainingTurns: turns,
          value: 1,
          source: 'enemy',
          sourceName: base.name
        };
        addEffectToContainer(state.playerEffects.value, silenceEffect);
        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_event', targetType: 'player', targetId: 'player',
          targetName: playerName, isCrit: false, isDodge: false,
          message: `${playerName} 被 ${base.name} 沉默了 ${silenceEffect.remainingTurns} 回合！`
        });
        break;
      }
      case 'debuff_aura': {
        const debuffType = String(params?.debuffType ?? 'attack_down');
        const baseValue = Number(params?.value) || 10;
        // P3-90 修复说明：turns=0 无实际意义（减益持续 0 回合等于无效），使用 || 提供默认值 3
        const turns = Number(params?.turns) || 3;
        const scaledValue = scaleBossEffectValue(baseValue, base.level);
        const debuffEffect: Effect = {
          id: generateEffectId(),
          type: debuffType as EffectType,
          remainingTurns: turns,
          value: scaledValue,
          source: 'enemy',
          sourceName: base.name
        };
        addEffectToContainer(state.playerEffects.value, debuffEffect);
        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_event', targetType: 'player', targetId: 'player',
          targetName: playerName, isCrit: false, isDodge: false,
          message: `${playerName} 受到 ${base.name} 的减益光环影响！`
        });
        break;
      }
      case 'aoe_attack': {
        // aoe_attack 标记已由 engine 设置在 runtime.aoeNextAttack，在 enemyAction 中通过 bossInstances 读取
        // 这里记录日志即可
        break;
      }
      case 'summon_minions': {
        // summon_minions 标记已由 engine 设置在 runtime.pendingSummons，需要实际创建小怪
        const count = runtime.pendingSummons || 0;
        if (count > 0) {
          // P1-6 修复：同步清零 pendingSummons，避免异步执行期间下一回合重复召唤
          runtime.pendingSummons = 0;
          // 异步批量创建小怪，一次性重建先攻顺序
          (async () => {
            const newMinions: { id: string; name: string }[] = [];
            try {
              for (let i = 0; i < count; i++) {
                const minion = await bossCtx.createMinion('slime', base.level);
                // P3-173：战斗在 createMinion 期间可能已结束（玩家逃跑/死亡），guard 防止写入已清理的状态
                if (state.state.value !== 'fighting') return;
                if (minion) {
                  // P2-41 修复：分配位置时优先前排，前排满时使用后排，避免位置重叠
                  const existingPos = Object.values(state.enemyPositions.value);
                  const frontUsedCols = existingPos.filter(p => p.row === 'front').map(p => p.col);
                  const backUsedCols = existingPos.filter(p => p.row === 'back').map(p => p.col);
                  const frontAvailableCol = [0, 1, 2].find(c => !frontUsedCols.includes(c));
                  const backAvailableCol = [0, 1, 2].find(c => !backUsedCols.includes(c));
                  const { row, col } = frontAvailableCol !== undefined
                    ? { row: 'front' as const, col: frontAvailableCol }
                    : { row: 'back' as const, col: backAvailableCol ?? 0 };
                  state.enemyPositions.value = {
                    ...state.enemyPositions.value,
                    [minion.id]: { row, col }
                  };
                  state.enemyIds.value.push(minion.id);
                  newMinions.push({ id: minion.id, name: minion.name });
                }
              }
              // 所有小怪创建完成后，一次性重建先攻顺序
              if (newMinions.length > 0) {
                bossCtx.rebuildInitiativeOrder();
                for (const m of newMinions) {
                  log.addCombatLog({
                    actorType: 'system', actorId: 'system', actorName: '系统',
                    eventType: 'combat_event', targetType: 'enemy', targetId: m.id,
                    targetName: m.name, isCrit: false, isDodge: false,
                    message: `${base.name} 召唤了 ${m.name}！`
                  });
                }
              }
            } catch (err) {
              // P2-32 修复：优雅降级 —— 清理已创建的小怪避免半成品状态污染战斗，
              // 并通过战斗日志和错误上报记录失败原因（替代原仅 console.warn 的吞异常行为）
              console.error(`[BossMechanics] ${base.name} 召唤小怪失败，清理已创建的 ${newMinions.length} 个小怪:`, err);
              for (const m of newMinions) {
                const pos = state.enemyPositions.value[m.id];
                if (pos) {
                  const newPos = { ...state.enemyPositions.value };
                  delete newPos[m.id];
                  state.enemyPositions.value = newPos;
                }
                const idx = state.enemyIds.value.indexOf(m.id);
                if (idx >= 0) {
                  const newIds = [...state.enemyIds.value];
                  newIds.splice(idx, 1);
                  state.enemyIds.value = newIds;
                }
              }
              log.addCombatLog({
                actorType: 'system', actorId: 'system', actorName: '系统',
                eventType: 'combat_event', targetType: 'enemy', targetId: base.id,
                targetName: base.name, isCrit: false, isDodge: false,
                message: `${base.name} 的召唤仪式被打断！`
              });
            }
          })();
        }
        break;
      }
      case 'healing_zone': {
        // P5-007 修复：使用 ?? 替代 || 避免 0 值被吞；Number() 对 undefined 返回 NaN 故先判空
        const rawHeal = params?.healPerTurn;
        const healAmount = rawHeal != null ? Number(rawHeal) : 5;
        base.hp = Math.min(base.maxHp, base.hp + healAmount);
        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_heal', targetType: 'enemy', targetId: base.id,
          targetName: base.name, isCrit: false, isDodge: false,
          message: `${base.name} 从生命恢复区域恢复了 ${healAmount} 点生命值！`
        });
        break;
      }
      default:
        // 其他机制（enrage, damage_shield, reflect_damage 等）已在 engine 中处理
        break;
    }
  }

  /**
   * 应用 Boss 防御机制（无敌/护盾吸收）
   *
   * 阶段九迁移：从 usePlayerAction.ts 迁入，收口 Boss 防御机制到单一 composable。
   * 在玩家造成伤害前调用，根据 Boss 运行时状态（invulnerable/shield）调整最终伤害。
   *
   * @param target - 受击的敌人实例（须为 Boss）
   * @param rawDamage - 原始伤害值
   * @returns 调整后的伤害与是否被完全格挡
   */
  function applyBossDefenseMechanics(target: EnemyInstance, rawDamage: number): { damage: number; blocked: boolean } {
    const boss = state.bossInstances.get(target.id);
    if (!boss) {
      return { damage: rawDamage, blocked: false };
    }
    const { runtime } = boss;
    if (runtime.invulnerable) {
      log.addCombatLog({
        actorType: 'system', actorId: 'system', actorName: '系统',
        eventType: 'combat_event', targetType: 'enemy', targetId: target.id,
        targetName: target.name, isCrit: false, isDodge: false,
        message: `${target.name} 处于无敌状态，免疫伤害！`
      });
      return { damage: 0, blocked: true };
    }
    if (runtime.shield && runtime.shield > 0) {
      if (rawDamage <= runtime.shield) {
        runtime.shield -= rawDamage;
        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_event', targetType: 'enemy', targetId: target.id,
          targetName: target.name, isCrit: false, isDodge: false,
          message: `${target.name} 的护盾吸收了 ${rawDamage} 点伤害！`
        });
        return { damage: 0, blocked: true };
      } else {
        const remaining = rawDamage - runtime.shield;
        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_event', targetType: 'enemy', targetId: target.id,
          targetName: target.name, isCrit: false, isDodge: false,
          message: `${target.name} 的护盾被击破！吸收了 ${runtime.shield} 点伤害。`
        });
        runtime.shield = 0;
        return { damage: remaining, blocked: false };
      }
    }
    return { damage: rawDamage, blocked: false };
  }

  /**
   * 应用 Boss 反击机制（反弹伤害/反击姿态）
   *
   * 阶段九迁移：从 usePlayerAction.ts 迁入。
   * 在玩家造成实际伤害后调用，根据 Boss 运行时状态（reflectDamage/counterStance）
   * 对玩家造成反击伤害。通过 bossCtx.applyDamageToPlayer 注入玩家伤害，
   * 保持 S3 解耦原则。
   *
   * @param target - 受击的敌人实例（须为 Boss）
   * @param actualDamage - 玩家实际造成的伤害
   */
  function applyBossCounterMechanics(target: EnemyInstance, actualDamage: number): void {
    if (actualDamage <= 0) return;
    const boss = state.bossInstances.get(target.id);
    if (!boss) return;
    const { runtime } = boss;
    const playerName = bossCtx.getPlayerName();

    if (runtime.reflectDamage && runtime.reflectDamage > 0) {
      const reflectAmount = Math.floor(actualDamage * runtime.reflectDamage);
      if (reflectAmount > 0) {
        bossCtx.applyDamageToPlayer(reflectAmount);
        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_damage', targetType: 'player', targetId: 'player',
          targetName: playerName, damage: reflectAmount,
          isCrit: false, isDodge: false,
          message: `${target.name} 反弹了 ${reflectAmount} 点伤害！`
        });
      }
    }

    if (runtime.counterStance) {
      const counterDamage = Math.floor(actualDamage * BOSS_COUNTER_DAMAGE_RATIO);
      if (counterDamage > 0) {
        bossCtx.applyDamageToPlayer(counterDamage);
        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_damage', targetType: 'player', targetId: 'player',
          targetName: playerName, damage: counterDamage,
          isCrit: false, isDodge: false,
          message: `${target.name} 反击对 ${playerName} 造成 ${counterDamage} 点伤害！`
        });
      }
      runtime.counterStance = false;
    }
  }

  /**
   * 检查 Boss 复活机制
   *
   * 阶段九迁移：从 usePlayerAction.ts 迁入。
   * 在玩家击杀 Boss 后调用，若 Boss 携带 canRevive 标记则恢复 50% 生命值。
   * boss.base 与 target 同引用，直接修改 target.hp 即同步到 boss.base.hp。
   *
   * @param target - 被击杀的敌人实例（须为 Boss）
   * @returns 是否触发了复活
   */
  function checkBossRevive(target: EnemyInstance): boolean {
    const boss = state.bossInstances.get(target.id);
    if (!boss) return false;
    if (boss.runtime.canRevive) {
      target.hp = Math.floor(target.maxHp * BOSS_REVIVE_HP_RATIO);
      boss.runtime.canRevive = false;
      log.addCombatLog({
        actorType: 'system', actorId: 'system', actorName: '系统',
        eventType: 'combat_event', targetType: 'enemy', targetId: target.id,
        targetName: target.name, isCrit: false, isDodge: false,
        message: `${target.name} 复活了！恢复 50% 生命值！`
      });
      return true;
    }
    return false;
  }

  return {
    initBossFeatures,
    applyMechanicEffect,
    scaleBossEffectValue,
    applyBossDefenseMechanics,
    applyBossCounterMechanics,
    checkBossRevive
  };
}
