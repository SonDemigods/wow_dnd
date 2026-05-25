/**
 * 战斗模块状态管理层
 * 
 * 使用 Pinia 管理战斗状态，提供响应式数据和事件监听
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
   * 获取战斗状态
   */
  const getState = computed(() => state.value);
  
  /**
   * 获取敌人
   */
  const getEnemy = computed(() => enemy.value);
  
  /**
   * 获取当前回合
   */
  const getTurn = computed(() => turn.value);
  
  /**
   * 获取回合数
   */
  const getTurnCount = computed(() => turnCount.value);
  
  /**
   * 获取战斗日志
   */
  const getCombatLog = computed(() => combatLogs.value);
  
  /**
   * 检查是否在战斗中
   */
  const isInCombat = computed(() => state.value === 'fighting');
  
  /**
   * 开始战斗
   * @param enemyData - 敌人数据
   */
  function startCombat(enemyData: Enemy): void {
    combatService.startCombat(enemyData);
    updateState();
  }
  
  /**
   * 玩家行动
   * @param action - 行动
   * @returns 行动结果
   */
  function playerAction(action: CombatAction): CombatActionResult {
    const result = combatService.playerAction(action);
    updateState();
    return result;
  }
  
  /**
   * 结束战斗
   * @param result - 战斗结果
   */
  function endCombat(result: 'victory' | 'defeat' | 'fled'): void {
    combatService.endCombat(result);
    updateState();
  }
  
  /**
   * 更新状态
   */
  function updateState(): void {
    state.value = combatService.getState();
    enemy.value = combatService.getEnemy();
    turn.value = combatService.getTurn();
    turnCount.value = combatService.getTurnCount();
    combatLogs.value = combatService.getCombatLog();
  }
  
  /**
   * 重置战斗状态
   */
  function reset(): void {
    combatService.reset();
    updateState();
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
   * 初始化事件监听
   */
  function initEventListeners(): void {
    // 战斗开始事件
    eventBus.on(GameEvents.COMBAT_START, (data: { enemy: Enemy }) => {
      state.value = 'fighting';
      enemy.value = data.enemy;
      turn.value = 'player';
      turnCount.value = 1;
    });
    
    // 战斗结束事件
    eventBus.on(GameEvents.COMBAT_END, () => {
      state.value = 'ended';
    });
    
    // 玩家回合开始事件
    eventBus.on(GameEvents.COMBAT_PLAYER_TURN, () => {
      turn.value = 'player';
      updateState();
    });
    
    // 敌人回合开始事件
    eventBus.on(GameEvents.COMBAT_ENEMY_TURN, () => {
      turn.value = 'enemy';
      updateState();
    });
  }
  
  /**
   * 初始化
   */
  function init(): void {
    updateState();
    initEventListeners();
  }
  
  return {
    // 状态
    state,
    enemy,
    turn,
    turnCount,
    combatLogs,
    
    // 计算属性
    getState,
    getEnemy,
    getTurn,
    getTurnCount,
    getCombatLog,
    isInCombat,
    
    // 方法
    startCombat,
    playerAction,
    endCombat,
    reset,
    addLog,
    clearLogs,
    init,
    updateState
  };
});