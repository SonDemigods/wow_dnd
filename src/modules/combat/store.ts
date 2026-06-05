/**
 * 战斗模块状态管理层
 * 
 * 使用 Pinia 管理战斗状态，提供响应式数据。
 * Store 是战斗数据的唯一持有者，Service 作为纯业务逻辑层供 Store 调用。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { CombatState, CombatAction, CombatActionResult, CombatLog } from './types';
import type { Enemy } from '../enemy/types';
import { combatService } from './service';
import { eventBus, GameEvents } from '../bus/core';

/**
 * 战斗状态存储
 */
export const useCombatStore = defineStore('combat', () => {
  /** 当前战斗状态 */
  const state = ref<CombatState>('idle');
  
  /** 当前敌人 */
  const enemy = ref<Enemy | null>(null);
  
  /** 当前回合 */
  const turn = ref<'player' | 'enemy'>('player');
  
  /** 当前回合数 */
  const turnCount = ref(0);
  
  /** 战斗日志 */
  const combatLogs = ref<CombatLog[]>([]);

  /**
   * 检查是否在战斗中
   */
  const isInCombat = computed(() => state.value === 'fighting');

  /**
   * 从 Service 同步最新战斗状态到 Store
   */
  function syncFromService(): void {
    state.value = combatService.getState();
    enemy.value = combatService.getEnemy();
    turn.value = combatService.getTurn();
    turnCount.value = combatService.getTurnCount();
    combatLogs.value = combatService.getCombatLog();
  }
  
  /**
   * 开始战斗
   * @param enemyData - 敌人数据
   */
  function startCombat(enemyData: Enemy): void {
    combatService.startCombat(enemyData);
    syncFromService();
  }
  
  /**
   * 玩家行动
   * @param action - 行动
   * @returns 行动结果
   */
  async function playerAction(action: CombatAction): Promise<CombatActionResult> {
    const result = await combatService.playerAction(action);
    syncFromService();
    return result;
  }
  
  /**
   * 结束战斗
   * @param result - 战斗结果
   */
  function endCombat(result: 'victory' | 'defeat' | 'fled'): void {
    combatService.endCombat(result);
    syncFromService();
  }
  
  /**
   * 重置战斗状态
   */
  function reset(): void {
    combatService.reset();
    syncFromService();
  }
  
  /**
   * 添加战斗日志
   * @param log - 日志
   */
  function addLog(log: CombatLog): void {
    combatLogs.value.push(log);
  }
  
  /**
   * 清空战斗日志
   */
  function clearLogs(): void {
    combatLogs.value = [];
  }
  
  /**
   * 跨模块事件监听
   * 
   * 仅监听来自其他模块的事件。战斗模块自身发出的状态变更
   * 由 Store Action 直接处理，不再通过事件总线回环。
   */
  function setupCrossModuleListeners(): void {
    // 当探索触发战斗时，由 GameMain 组件监听 EXPLORATION_BATTLE_TRIGGERED 并调用 startCombat
    // 当外部模块通知玩家/敌人回合变化时更新 Store
    eventBus.onGroup('combatStore', GameEvents.COMBAT_PLAYER_TURN, () => {
      turn.value = 'player';
      syncFromService();
    });
    
    eventBus.onGroup('combatStore', GameEvents.COMBAT_ENEMY_TURN, () => {
      turn.value = 'enemy';
      syncFromService();
    });
  }
  
  /**
   * 清理事件监听
   */
  function dispose(): void {
    eventBus.clearGroup('combatStore');
  }
  
  /**
   * 初始化
   */
  function init(): void {
    syncFromService();
    setupCrossModuleListeners();
  }
  
  return {
    // 状态
    state,
    enemy,
    turn,
    turnCount,
    combatLogs,
    
    // 计算属性
    isInCombat,
    
    // 方法
    startCombat,
    playerAction,
    endCombat,
    reset,
    addLog,
    clearLogs,
    init,
    dispose
  };
});