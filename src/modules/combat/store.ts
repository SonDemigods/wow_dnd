/**
 * 战斗模块状态管理层（Store 核心架构 — 组合入口）
 * 
 * Store 是战斗数据的唯一持有者，所有响应式状态集中管理。
 * 重构后，Store ~170 行，具体逻辑按职责拆分到 composables/ 子目录。
 * 
 * 跨模块通信：
 * - characterStore: 直接调用 Action（takeDamage, gainExp, gainGold, handleDeath）
 * - skillsStore: 直接调用 Action（castSkill, getSkill）
 * - enemiesStore: 直接调用 Store Action（敌人创建、伤害计算）
 * - inventoryStore: 直接调用 Store（物品模板查询与物品添加）
 * - logStore: 直接调用 Store Action（日志记录）
 * - combatDbService: 直接调用持久化日志
 * 
 * EventBus 仅保留 UI/音效事件：
 * COMBAT_START, COMBAT_END, COMBAT_PLAYER_TURN, COMBAT_ENEMY_TURN,
 * COMBAT_DEAL_DAMAGE, COMBAT_CAST_HEAL, COMBAT_CRITICAL_HIT, COMBAT_DODGE,
 * COMBAT_SKIP_TURN
 */
import { defineStore } from 'pinia';
import type { CombatAction, CombatActionResult, CombatResult } from './types';
import type { EnemyInstance } from '../enemy/types';
import { useCharacterStore } from '../character/store';
// skillsStore / enemiesStore 调用已委托给各 composable
import { useQuestStore } from '../quest/store';
import { eventBus, GameEvents } from '../bus/core';
import { useLogStore } from '../log/store';
import { generateLogId } from '../log/service';
import { isBossCombat, generateCombatId } from './service';
import { createEmptyContainer } from './effects';

import { useCombatState } from './composables/useCombatState';
import { useCombatLog } from './composables/useCombatLog';
import { useBossMechanics } from './composables/useBossMechanics';
import { useEnemyAction } from './composables/useEnemyAction';
import { useInitiative } from './composables/useInitiative';
import { usePlayerAction } from './composables/usePlayerAction';

/**
 * 战斗状态存储
 */
export const useCombatStore = defineStore('combat', () => {
  // ==================== 组合所有模块 ====================

  // 1. 状态层（ref/computed/生命周期）
  const state = useCombatState();

  // 2. 日志层（addCombatLog / saveLogs / EffectContext 工厂）
  const log = useCombatLog(state);

  // 3. Boss 机制层（initiative 尚未创建，通过 orderBuilder 对象延迟绑定 buildInitiativeOrder）
  const orderBuilder: { build: ((cs: ReturnType<typeof useCharacterStore>) => void) | null } = { build: null };
  const boss = useBossMechanics(state, log, (cs) => orderBuilder.build?.(cs));

  // 4. 敌人行动层
  const enemy = useEnemyAction(state, log);

  // ==================== endCombat ====================

  /**
   * 结束战斗
   * @param result - 战斗结果
   */
  function endCombat(result: CombatResult): void {
    // 防止重入：已在结算中或战斗已结束时直接忽略
    if (state.state.value === 'ended' || state.state.value === 'idle') return;

    if (state.enemies.value.length === 0) {
      // 无敌人时直接标记结束并清理效果
      state.state.value = 'ended';
      state.playerEffects.value = createEmptyContainer();
      state.enemyEffects.value = {};
      return;
    }

    // 清空效果容器
    state.playerEffects.value = createEmptyContainer();
    state.enemyEffects.value = {};

    try {
      const characterStore = useCharacterStore();
      state.state.value = 'ended';

      const enemyNames = state.enemies.value.map(e => e.name).join('、');
      let totalExp = 0;
      let totalGold = 0;

      if (result === 'victory') {
        totalExp = state.enemies.value.reduce((sum, e) => sum + (e.expReward || 0), 0);
        totalGold = state.enemies.value.reduce((sum, e) => sum + (e.goldReward || 0), 0);

        state.combatResult.value = result;
        state.expGained.value = totalExp;
        state.goldGained.value = totalGold;

        useLogStore().addLogEntry({
          id: generateLogId(), timestamp: Date.now(), type: 'combat',
          message: `击败 ${enemyNames}！`, icon: 'game-icons:laurel-crown'
        });

        if (totalExp > 0) {
          useLogStore().addLogEntry({
            id: generateLogId(), timestamp: Date.now(), type: 'combat',
            message: `获得 ${totalExp} 点经验值`, icon: 'game-icons:star-formation'
          });
        }
        if (totalGold > 0) {
          useLogStore().addLogEntry({
            id: generateLogId(), timestamp: Date.now(), type: 'combat',
            message: `获得 ${totalGold} 金币`, icon: 'game-icons:two-coins'
          });
        }

        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_end', isCrit: false, isDodge: false,
          message: `战斗胜利！获得 ${totalExp} 经验值和 ${totalGold} 金币！`
        });

        characterStore.gainExp(totalExp);
        characterStore.gainGold(totalGold);

        // 处理掉落（仅 Boss）
        for (const e of state.enemies.value) {
          if (isBossCombat(e)) {
            player.handleLoot(e);
          }
        }

        // 更新击杀进度
        for (const e of state.enemies.value) {
          if (e.dataId) {
            useQuestStore().onEnemyKilled(e.dataId);
          }
        }
      } else if (result === 'defeat') {
        state.combatResult.value = result;
        state.expGained.value = 0;
        state.goldGained.value = 0;

        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_end', isCrit: false, isDodge: false,
          message: '战斗失败！'
        });

        useLogStore().addLogEntry({
          id: generateLogId(), timestamp: Date.now(), type: 'combat',
          message: `被 ${enemyNames} 击败！`, icon: 'game-icons:death-zone'
        });

        characterStore.handleDeath();
      } else if (result === 'fled') {
        state.combatResult.value = result;
        state.expGained.value = 0;
        state.goldGained.value = 0;

        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_end', isCrit: false, isDodge: false,
          message: '战斗以逃跑结束'
        });

        useLogStore().addLogEntry({
          id: generateLogId(), timestamp: Date.now(), type: 'combat',
          message: `从 ${enemyNames} 面前逃跑`, icon: 'game-icons:run'
        });
      }

      log.saveLogs();

      eventBus.emit(GameEvents.COMBAT_END, {
        result,
        enemy: state.enemies.value[0] || null,
        expGained: result === 'victory' ? totalExp : 0,
        goldGained: result === 'victory' ? totalGold : 0
      });

      state.cleanup();
    } catch (e) {
      console.error('[CombatStore] 结束战斗异常:', e);
      state.cleanup();
    }
  }

  // 5. 先攻/调度层（依赖 endCombat）
  const initiative = useInitiative(state, log, enemy, boss, endCombat);

  // 绑定惰性回调（summon_minions 运行时调用，此时 initiative 已就位）
  orderBuilder.build = (cs) => initiative.buildInitiativeOrder(cs);

  // 6. 玩家行动层（注入 endCombat，消除 (state as any) 依赖）
  const player = usePlayerAction(state, log, initiative, endCombat);

  // ==================== Action：开始战斗 ====================

  function startCombat(enemiesData: EnemyInstance[]): void {
    state.combatId.value = generateCombatId();
    state.state.value = 'fighting';
    state.enemyIds.value = enemiesData.map(e => e.id);
    state.targetEnemyId.value = null;
    state.turn.value = 'player';
    state.turnCount.value = 1;
    state.combatLogs.value = [];
    state.combatResult.value = null;
    state.expGained.value = 0;
    state.goldGained.value = 0;
    state.playerEffects.value = createEmptyContainer();
    state.enemyEffects.value = {};

    boss.initBossFeatures(enemiesData);
    initiative.assignEnemyPositions(enemiesData);

    const characterStore = useCharacterStore();
    initiative.buildInitiativeOrder(characterStore);

    const enemyNames = enemiesData.map(e => e.name).join('、');

    log.addCombatLog({
      actorType: 'system', actorId: 'system', actorName: '系统',
      eventType: 'combat_start', message: `战斗开始！你遭遇了 ${enemyNames}！`
    });

    useLogStore().addLogEntry({
      id: generateLogId(), timestamp: Date.now(), type: 'combat',
      message: `遭遇 ${enemyNames}！`, icon: 'game-icons:crossed-swords'
    });

    eventBus.emit(GameEvents.COMBAT_START, { enemy: enemiesData[0] });

    const bossIntroEntries = Object.entries(state.bossIntros.value);
    if (bossIntroEntries.length > 0) {
      const [bossId, intro] = bossIntroEntries[0];
      const bossEnemy = enemiesData.find(e => e.id === bossId);
      if (bossEnemy) {
        setTimeout(() => {
          eventBus.emit(GameEvents.COMBAT_BOSS_INTRO, {
            enemyId: bossId, enemyName: bossEnemy.name, icon: bossEnemy.icon,
            effect: intro.effect, lines: intro.lines, duration: intro.duration
          });
        }, 300);
      }
    }

    eventBus.emit(GameEvents.COMBAT_PLAYER_TURN, null);
    log.saveLogs();
  }

  // ==================== Action：玩家行动 ====================

  async function playerAction(action: CombatAction): Promise<CombatActionResult> {
    if (state.state.value !== 'fighting' || state.turn.value !== 'player') {
      return { success: false, type: action.type, message: '不是你的回合！' };
    }

    // 控制效果检查
    const disableResult = state.effectRegistry.getDisabledActions(state.playerEffects.value);
    if (disableResult.skipTurn) {
      log.addCombatLog({
        actorType: 'player', actorId: 'player', actorName: useCharacterStore().name,
        eventType: 'combat_event', isCrit: false, isDodge: false,
        message: `${useCharacterStore().name} 无法行动！`
      });
      initiative.endPlayerTurn();
      return { success: false, type: action.type, isControlled: true, message: '你被控制了，无法行动！' };
    }
    if (action.type === 'skill' && disableResult.types.includes('skill')) {
      return { success: false, type: 'skill', isControlled: true, message: '你被沉默了，无法使用技能！' };
    }

    try {
      switch (action.type) {
        case 'attack':
          return player.playerAttack();
        case 'skill':
          if (!action.skillId) return { success: false, type: 'skill', message: '未指定技能！' };
          return await player.playerSkill(action.skillId);
        case 'item':
          if (!action.itemId) return { success: false, type: 'item', message: '未指定物品！' };
          return await player.playerUseItem(action.itemId);
        case 'flee':
          return player.playerFlee();
        default:
          return { success: false, type: action.type, message: '未知行动类型！' };
      }
    } catch (e) {
      console.error('[CombatStore] 玩家行动异常:', e);
      return { success: false, type: action.type, message: '行动执行失败' };
    }
  }

  // ==================== Action：跳过回合 ====================

  function skipTurn(): void {
    if (state.state.value !== 'fighting' || state.turn.value !== 'player') return;

    const characterStore = useCharacterStore();
    log.addCombatLog({
      actorType: 'player', actorId: 'player', actorName: characterStore.name,
      eventType: 'combat_turn_end', message: `${characterStore.name} 跳过了回合`,
      isCrit: false, isDodge: false
    });
    eventBus.emit(GameEvents.COMBAT_SKIP_TURN, null);
    initiative.endPlayerTurn();
  }

  // ==================== 导出 ====================

  return {
    // 状态
    state: state.state,
    enemies: state.enemies,
    targetEnemyId: state.targetEnemyId,
    turn: state.turn,
    turnCount: state.turnCount,
    combatLogs: state.combatLogs,
    combatResult: state.combatResult,
    expGained: state.expGained,
    goldGained: state.goldGained,
    initiativeOrder: state.initiativeOrder,
    currentInitiativeIndex: state.currentInitiativeIndex,
    combatSpeed: state.combatSpeed,
    playerEffects: state.playerEffects,
    enemyEffects: state.enemyEffects,
    enemyPositions: state.enemyPositions,

    // 计算属性
    isInCombat: state.isInCombat,
    aliveEnemies: state.aliveEnemies,
    hasBossEnemy: state.hasBossEnemy,
    bossIntros: state.bossIntros,
    currentTarget: state.currentTarget,

    // Action
    startCombat,
    playerAction,
    skipTurn,
    endCombat,
    reset: state.reset,
    advanceTurn: initiative.advanceTurn,
    toggleCombatSpeed: initiative.toggleCombatSpeed,
    addEffectToPlayer: state.addEffectToPlayer,
  };
});
