/**
 * Boss 机制 Composable
 * 
 * 从 combat store 提取的 Boss 专属机制函数。
 * 负责初始化 Boss 阶段管理器、缩放效果值，以及将阶段机制效果应用到玩家或敌人。
 * 
 * S3 解耦：通过 IBossContext 接口注入外部依赖，不再直接 import
 * useCharacterStore / useEnemyStore，使 Boss 机制可独立测试与复用。
 */
import type { EnemyInstance } from '../../enemy/types';
import type { BossIntro, BossPhase, BossMechanicType } from '../../boss/types';
import { BossPhaseManager } from '../../boss/phaseManager';
import {
  generateEffectId,
  addEffectToContainer,
  type Effect,
  type EffectType,
} from '../effects';
import type { useCombatState } from './useCombatState';
import type { useCombatLog } from './useCombatLog';

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
}

export function useBossMechanics(
  state: ReturnType<typeof useCombatState>,
  log: ReturnType<typeof useCombatLog>,
  bossCtx: IBossContext,
) {
  /**
   * 初始化 Boss 专属功能（阶段管理器、出场演出）
   * @param enemiesData - 敌人数据数组
   */
  function initBossFeatures(enemiesData: EnemyInstance[]): void {
    state.bossPhaseManagers.clear();
    const intros: Record<string, BossIntro> = {};
    for (const e of enemiesData) {
      if (e.isBoss && e.phases && e.phases.length > 0) {
        state.bossPhaseManagers.set(e.id, new BossPhaseManager());
      }
      if (e.isBoss && e.intro) {
        intros[e.id] = e.intro;
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
    return Math.floor(baseValue * (1 + (bossLevel - 1) * 0.08));
  }

  /**
   * 应用 Boss 机制的实际效果到玩家或敌人
   * @param e - Boss 敌人
   * @param mechType - 机制类型
   * @param phase - 当前阶段（用于获取参数）
   */
  function applyMechanicEffect(e: EnemyInstance, mechType: BossMechanicType, phase: BossPhase): void {
    const mechanic = phase.mechanics.find(m => m.type === mechType);
    const params = mechanic?.params || {};
    const playerName = bossCtx.getPlayerName();

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
          sourceName: e.name
        };
        addEffectToContainer(state.playerEffects.value, stunEffect);
        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_event', targetType: 'player', targetId: 'player',
          targetName: playerName, isCrit: false, isDodge: false,
          message: `${playerName} 被 ${e.name} 眩晕了 ${stunEffect.remainingTurns} 回合！`
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
          sourceName: e.name
        };
        addEffectToContainer(state.playerEffects.value, silenceEffect);
        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_event', targetType: 'player', targetId: 'player',
          targetName: playerName, isCrit: false, isDodge: false,
          message: `${playerName} 被 ${e.name} 沉默了 ${silenceEffect.remainingTurns} 回合！`
        });
        break;
      }
      case 'debuff_aura': {
        const debuffType = String(params?.debuffType ?? 'attack_down');
        const baseValue = Number(params?.value) || 10;
        // P3-90 修复说明：turns=0 无实际意义（减益持续 0 回合等于无效），使用 || 提供默认值 3
        const turns = Number(params?.turns) || 3;
        const scaledValue = scaleBossEffectValue(baseValue, e.level);
        const debuffEffect: Effect = {
          id: generateEffectId(),
          type: debuffType as EffectType,
          remainingTurns: turns,
          value: scaledValue,
          source: 'enemy',
          sourceName: e.name
        };
        addEffectToContainer(state.playerEffects.value, debuffEffect);
        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_event', targetType: 'player', targetId: 'player',
          targetName: playerName, isCrit: false, isDodge: false,
          message: `${playerName} 受到 ${e.name} 的减益光环影响！`
        });
        break;
      }
      case 'aoe_attack': {
        // aoe_attack 标记已由 engine 设置，在 enemyAction 中通过 e.aoeNextAttack 读取
        // 这里记录日志即可
        break;
      }
      case 'summon_minions': {
        // summon_minions 标记已由 engine 设置，需要实际创建小怪
        const count = e.pendingSummons || 0;
        if (count > 0) {
          // P1-6 修复：同步清零 pendingSummons，避免异步执行期间下一回合重复召唤
          e.pendingSummons = 0;
          // 异步批量创建小怪，一次性重建先攻顺序
          (async () => {
            const newMinions: { id: string; name: string }[] = [];
            try {
              for (let i = 0; i < count; i++) {
                const minion = await bossCtx.createMinion('slime', e.level);
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
                    message: `${e.name} 召唤了 ${m.name}！`
                  });
                }
              }
            } catch (err) {
              // P2-32 修复：优雅降级 —— 清理已创建的小怪避免半成品状态污染战斗，
              // 并通过战斗日志和错误上报记录失败原因（替代原仅 console.warn 的吞异常行为）
              console.error(`[BossMechanics] ${e.name} 召唤小怪失败，清理已创建的 ${newMinions.length} 个小怪:`, err);
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
                eventType: 'combat_event', targetType: 'enemy', targetId: e.id,
                targetName: e.name, isCrit: false, isDodge: false,
                message: `${e.name} 的召唤仪式被打断！`
              });
            }
          })();
        }
        break;
      }
      case 'healing_zone': {
        const healAmount = Number(params?.healPerTurn) || 5;
        e.hp = Math.min(e.maxHp, e.hp + healAmount);
        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_heal', targetType: 'enemy', targetId: e.id,
          targetName: e.name, isCrit: false, isDodge: false,
          message: `${e.name} 从生命恢复区域恢复了 ${healAmount} 点生命值！`
        });
        break;
      }
      default:
        // 其他机制（enrage, damage_shield, reflect_damage 等）已在 engine 中处理
        break;
    }
  }

  return { initBossFeatures, applyMechanicEffect, scaleBossEffectValue };
}
