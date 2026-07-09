/**
 * 先攻排序和回合推进 Composable
 * 
 * 从 combat store 提取的先攻排序、回合切换和敌人回合调度逻辑。
 * 依赖 useCombatState（状态持有）、useCombatLog（日志记录）、
 * useEnemyAction（敌人行动）和 useBossMechanics（Boss 机制效果）。
 */
import type { CombatResult } from '../types';
import type { EnemyInstance } from '../../enemy/types';
import type { BossMechanicType } from '../../boss/types';
import { useCharacterStore } from '../../character/store';
import { useSkillStore } from '../../skill/store';
import { useEnemyStore } from '../../enemy/store';
import { eventBus, GameEvents } from '../../bus';
import { processBossPhaseMechanics, applyPhaseStats } from '../../boss/engine';
import type { useCombatState } from './useCombatState';
import type { useCombatLog } from './useCombatLog';
import type { useEnemyAction } from './useEnemyAction';
import type { useBossMechanics } from './useBossMechanics';
import type { usePassiveSkills } from './usePassiveSkills';

export function useInitiative(
  state: ReturnType<typeof useCombatState>,
  log: ReturnType<typeof useCombatLog>,
  enemyAction: ReturnType<typeof useEnemyAction>,
  boss: ReturnType<typeof useBossMechanics>,
  endCombat: (result: CombatResult) => void,
  passive?: ReturnType<typeof usePassiveSkills>,
) {
  // ==================== 内部辅助：先攻排序 ====================

  /**
   * 分配敌人位置到 3×2 网格（前排 3 格 + 后排 3 格）
   * Boss 优先放在后排中间，普通敌人优先填满前排
   * @param enemiesData - 敌人数据数组
   */
  function assignEnemyPositions(enemiesData: EnemyInstance[]): void {
    const positions: Record<string, { row: 'front' | 'back'; col: number }> = {};
    const frontSlots: number[] = [0, 1, 2]; // 前排 3 个位置
    const backSlots: number[] = [0, 1, 2];  // 后排 3 个位置

    // 分离 Boss 和普通敌人
    const bosses = enemiesData.filter(e => e.isBoss);
    const normals = enemiesData.filter(e => !e.isBoss);

    // Boss 优先占后排中间位置
    for (const bossEnemy of bosses) {
      const col = backSlots.shift() ?? 0;
      positions[bossEnemy.id] = { row: 'back', col };
    }

    // 普通敌人优先填满前排，再填后排
    for (const enemy of normals) {
      if (frontSlots.length > 0) {
        const col = frontSlots.shift()!;
        positions[enemy.id] = { row: 'front', col };
      } else if (backSlots.length > 0) {
        const col = backSlots.shift()!;
        positions[enemy.id] = { row: 'back', col };
      }
    }

    state.enemyPositions.value = positions;
  }

  /**
   * 构建先攻顺序（玩家 + 所有敌人按速度降序排列）
   * @param characterStore - 角色 Store 实例
   */
  function buildInitiativeOrder(characterStore: ReturnType<typeof useCharacterStore>): void {
    const units: { id: string; speed: number }[] = [];

    // 玩家速度（含效果修正）
    const playerCtx = log.createPlayerEffectContext(characterStore);
    const speedMod = state.effectRegistry.reduceSum(state.playerEffects.value, 'getSpeedMod', playerCtx);
    const playerSpeed = (characterStore.effectiveStats.dex || 0) + speedMod;
    units.push({ id: 'player', speed: playerSpeed });

    // 所有敌人速度
    for (const e of state.enemies.value) {
      const enemySpeed = e.stats?.dex ?? 5;
      units.push({ id: e.id, speed: enemySpeed });
    }

    // 按速度降序排列
    units.sort((a, b) => b.speed - a.speed);
    state.initiativeOrder.value = units.map(u => u.id);
    // 找到玩家在排序后的实际位置，确保 advanceTurn 能正确推进到下一个单位
    const playerIndex = state.initiativeOrder.value.indexOf('player');
    state.currentInitiativeIndex.value = playerIndex >= 0 ? playerIndex : 0;
  }

  /**
   * 推进到下一个行动者
   * @returns 下一个行动者的 ID 和是否为玩家
   */
  function advanceTurn(): { unitId: string; isPlayer: boolean } {
    state.currentInitiativeIndex.value = (state.currentInitiativeIndex.value + 1) % state.initiativeOrder.value.length;
    if (state.currentInitiativeIndex.value === 0) {
      state.turnCount.value++;
    }
    const unitId = state.initiativeOrder.value[state.currentInitiativeIndex.value];
    return { unitId, isPlayer: unitId === 'player' };
  }

  /**
   * 切换战斗速度（1x / 2x）
   */
  function toggleCombatSpeed(): void {
    state.combatSpeed.value = state.combatSpeed.value === 1 ? 2 : 1;
  }

  /**
   * 推进到先攻序列中的下一个行动者
   * 如果是玩家则设置玩家回合，否则延迟调用敌人回合。
   * 当先攻索引回绕到 0（新一轮开始）时，对所有效果执行一次 tick。
   */
  function advanceToNextUnit(): void {
    if (state.state.value !== 'fighting') return;
    const next = advanceTurn();

    // 新一轮开始时，对所有效果执行一次 tick（不再每个敌人回合 tick）
    if (state.currentInitiativeIndex.value === 0) {
      tickAllEffects();
    }

    if (next.isPlayer) {
      state.turn.value = 'player';
      useSkillStore().tickCooldowns();
      // 玩家回合开始时触发资源系统 onTurnStart 钩子（如怒气/能量回复）
      state.resourceSystems.value.forEach(sys => sys.onTurnStart?.());
      // 触发被动技能 onTurnStart 钩子（如法师法力涌动、德鲁伊自然治愈、牧师神圣冥想）
      passive?.onTurnStart();
      eventBus.emit(GameEvents.COMBAT_PLAYER_TURN, null);
    } else {
      state.turn.value = 'enemy';
      state.turnTimerId.value = window.setTimeout(() => {
        state.turnTimerId.value = null;
        singleEnemyTurn(next.unitId);
      }, Math.round(500 / Math.max(0.1, state.combatSpeed.value)));
    }
  }

  /**
   * 对所有效果执行一次 tick（每回合一次，在新一轮开始时调用）
   * 处理玩家和所有敌人的持续伤害、生命恢复效果。
   */
  function tickAllEffects(): void {
    const characterStore = useCharacterStore();
    const enemiesStore = useEnemyStore();

    // ===== 阶段 1：收集所有效果的 tick 结果 =====
    const playerTickResult = state.effectRegistry.tickAll(
      state.playerEffects.value,
      log.createPlayerEffectContext(characterStore)
    );

    const enemyTickResults: Map<string, { dotDamage: number; regenAmount: number }> = new Map();
    const deadEnemyIds: string[] = [];
    for (const [eId, container] of Object.entries(state.enemyEffects.value)) {
      const enemy = enemiesStore.getEnemyById(eId);
      if (!enemy || enemy.hp <= 0) {
        deadEnemyIds.push(eId);
        continue;
      }
      enemyTickResults.set(eId, state.effectRegistry.tickAll(container, log.createEnemyEffectContext(enemy)));
    }

    // ===== 阶段 2：统一应用伤害/恢复 =====
    // 玩家
    if (playerTickResult.dotDamage > 0) {
      characterStore.takeDamage(playerTickResult.dotDamage);
      log.addCombatLog({
        actorType: 'system', actorId: 'system', actorName: '系统',
        eventType: 'combat_damage', targetType: 'player', targetId: 'player',
        targetName: characterStore.name, damage: playerTickResult.dotDamage,
        isCrit: false, isDodge: false,
        message: `持续伤害对 ${characterStore.name} 造成 ${playerTickResult.dotDamage} 点伤害！`
      });
    }
    if (playerTickResult.regenAmount > 0) {
      characterStore.receiveHeal(playerTickResult.regenAmount);
      log.addCombatLog({
        actorType: 'system', actorId: 'system', actorName: '系统',
        eventType: 'combat_heal', targetType: 'player', targetId: 'player',
        targetName: characterStore.name, heal: playerTickResult.regenAmount,
        isCrit: false, isDodge: false,
        message: `生命恢复为 ${characterStore.name} 恢复了 ${playerTickResult.regenAmount} 点生命值！`
      });
    }
    // 敌人
    for (const [eId, tickRes] of enemyTickResults) {
      if (tickRes.dotDamage > 0) {
        enemiesStore.takeDamage(eId, tickRes.dotDamage);
        const enemy = enemiesStore.getEnemyById(eId);
        if (enemy) {
          log.addCombatLog({
            actorType: 'system', actorId: 'system', actorName: '系统',
            eventType: 'combat_damage', targetType: 'enemy', targetId: eId,
            targetName: enemy.name, damage: tickRes.dotDamage,
            isCrit: false, isDodge: false,
            message: `持续伤害对 ${enemy.name} 造成 ${tickRes.dotDamage} 点伤害！`
          });
        }
      }
      if (tickRes.regenAmount > 0) {
        const enemy = enemiesStore.getEnemyById(eId);
        if (enemy) {
          enemy.hp = Math.min(enemy.maxHp, enemy.hp + tickRes.regenAmount);
          log.addCombatLog({
            actorType: 'system', actorId: 'system', actorName: '系统',
            eventType: 'combat_heal', targetType: 'enemy', targetId: eId,
            targetName: enemy.name, heal: tickRes.regenAmount,
            isCrit: false, isDodge: false,
            message: `生命恢复为 ${enemy.name} 恢复了 ${tickRes.regenAmount} 点生命值！`
          });
        }
      }
    }

    // 清理已死亡敌人的效果容器
    for (const deadId of deadEnemyIds) {
      delete state.enemyEffects.value[deadId];
    }

    // ===== 阶段 3：统一检查死亡 =====
    if (characterStore.hp <= 0) {
      endCombat('defeat');
      log.saveLogs();
      return;
    }
    // 检查敌人是否全部死亡（DOT 杀敌触发胜利判定，BIZ-4 修复）
    const allEnemiesDead = state.enemies.value.every(e => e.hp <= 0);
    if (allEnemiesDead && state.enemies.value.length > 0) {
      endCombat('victory');
      log.saveLogs();
      return;
    }
  }

  /**
   * 单个敌人回合（速度制先攻调度用）
   * 执行该敌人的行动，然后推进到下一个行动者。
   * 如果下一个仍是敌人则继续链式调用，直到回合回到玩家。
   * 效果 tick 已提升到 advanceToNextUnit 中新轮开始时统一执行。
   * @param enemyId - 敌人 ID
   */
  function singleEnemyTurn(enemyId: string): void {
    if (state.state.value !== 'fighting') return;

    const enemiesStore = useEnemyStore();
    const characterStore = useCharacterStore();

    const e = state.enemies.value.find(en => en.id === enemyId);
    if (!e || e.hp <= 0) {
      // 敌人已死亡，从先攻序列中移除并清理效果容器
      if (e) {
        state.initiativeOrder.value = state.initiativeOrder.value.filter(id => id !== enemyId);
        delete state.enemyEffects.value[enemyId];
        // 修正当前索引，防止因移除元素导致索引越界
        if (state.currentInitiativeIndex.value >= state.initiativeOrder.value.length) {
          state.currentInitiativeIndex.value = 0;
        }
      }
      advanceToNextUnit();
      return;
    }

    // 记录敌人行动开始
    log.addCombatLog({
      actorType: 'system',
      actorId: 'system',
      actorName: '系统',
      eventType: 'combat_turn_start',
      isCrit: false,
      isDodge: false,
      message: `${e.name} 的回合`
    });

    // 处理 Boss 阶段转换和机制
    if (e.isBoss && e.phases && e.phases.length > 0) {
      const phaseManager = state.bossPhaseManagers.get(e.id);
      if (phaseManager) {
        const result = phaseManager.getCurrentPhase(e.phases, e.hp, e.maxHp);
        const currentPhase = result.phase;
        if (result.changed && currentPhase) {
          applyPhaseStats(e, currentPhase);
          // 同步更新 AI 策略为当前阶段的策略
          if (currentPhase.aiStrategy) {
            e.aiStrategy = currentPhase.aiStrategy;
          }
          log.addCombatLog({
            actorType: 'system', actorId: 'system', actorName: '系统',
            eventType: 'combat_event', targetType: 'enemy', targetId: e.id,
            targetName: e.name, isCrit: false, isDodge: false,
            message: `【阶段转换】${e.name} 进入 "${currentPhase.name}" 阶段！`
          });
          // 发射阶段转换事件（UI 特效）
          eventBus.emit(GameEvents.COMBAT_BOSS_PHASE, {
            enemyId: e.id,
            enemyName: e.name,
            phaseName: currentPhase.name,
            effect: currentPhase.transitionEffect || 'darken'
          });
          if (currentPhase.dialogue && currentPhase.dialogue.length > 0) {
            for (const line of currentPhase.dialogue) {
              log.addCombatLog({
                actorType: 'system', actorId: 'system', actorName: e.name,
                eventType: 'combat_event', targetType: 'enemy', targetId: e.id,
                targetName: e.name, isCrit: false, isDodge: false,
                message: `"${line}"`
              });
            }
          }
        }
        if (currentPhase) {
          const triggered = processBossPhaseMechanics(e, currentPhase, state.turnCount.value);
          for (const mechType of triggered) {
            const mechNames: Record<string, string> = {
              enrage: '狂暴', damage_shield: '伤害护盾', aoe_attack: '范围攻击',
              summon_minions: '召唤小怪', stun_player: '眩晕玩家', debuff_aura: '减益光环'
            };
            log.addCombatLog({
              actorType: 'system', actorId: 'system', actorName: '系统',
              eventType: 'combat_event', targetType: 'enemy', targetId: e.id,
              targetName: e.name, isCrit: false, isDodge: false,
              message: `${e.name} 触发了【${mechNames[mechType] || mechType}】机制！`
            });

            // 实际应用机制效果
            boss.applyMechanicEffect(e, mechType as BossMechanicType, currentPhase);
          }
        }
      }
    }

    // 推进该敌人的技能冷却
    enemiesStore.tickCooldowns(e.id);

    // 执行敌人行动
    enemyAction.enemyAction(e);

    // 检查玩家是否死亡
    if (characterStore.hp <= 0) {
      endCombat('defeat');
      log.saveLogs();
      return;
    }

    // 推进到下一个行动者
    advanceToNextUnit();

    log.saveLogs();
  }

  /**
   * 结束玩家回合
   * 持久化日志后，推进到先攻序列中的下一个行动者。
   */
  function endPlayerTurn(): void {
    log.saveLogs();
    advanceToNextUnit();
  }

  return {
    assignEnemyPositions,
    buildInitiativeOrder,
    advanceTurn,
    toggleCombatSpeed,
    advanceToNextUnit,
    singleEnemyTurn,
    endPlayerTurn,
  };
}
