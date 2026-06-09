/**
 * @fileoverview 探索模块状态管理层
 * @description 使用 Pinia 管理探索状态，提供响应式数据，Store 是探索数据的唯一持有者
 * @module exploration
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ExplorationCell, ExplorationState } from './types';
import { explorationService } from './service';
import { eventBus, GameEvents } from '../bus/core';

export const useExplorationStore = defineStore('exploration', () => {
  const currentAreaId = ref<string | null>(null);
  const grid = ref<ExplorationCell[][]>([]);
  const campUsed = ref(false);
  const isExploring = ref(false);
  const playerPosition = ref({ x: 0, y: 0 });
  const visitedCells = ref(0);
  const remainingMoves = ref(20);
  const bossDefeated = ref(false);
  const explorationComplete = ref(false);

  /** 从 Service 同步最新状态到 Store */
  function syncFromService(): void {
    const savedState = explorationService.getState();
    currentAreaId.value = savedState.currentAreaId;
    grid.value = savedState.grid;
    campUsed.value = savedState.campUsed;
    playerPosition.value = savedState.playerPosition;
    visitedCells.value = savedState.visitedCells;
    remainingMoves.value = savedState.remainingMoves;
    bossDefeated.value = savedState.bossDefeated;
    explorationComplete.value = savedState.explorationComplete;
  }

  const state = computed<ExplorationState>(() => ({
    currentAreaId: currentAreaId.value,
    grid: grid.value,
    campUsed: campUsed.value,
    playerPosition: playerPosition.value,
    visitedCells: visitedCells.value,
    remainingMoves: remainingMoves.value,
    bossDefeated: bossDefeated.value,
    explorationComplete: explorationComplete.value
  }));

  const getGridCell = (x: number, y: number): ExplorationCell | null => {
    return grid.value[y]?.[x] || null;
  };

  const hasStartedExploration = computed(() => currentAreaId.value !== null);

  async function init(characterId: string): Promise<void> {
    await explorationService.init(characterId);
    syncFromService();
    isExploring.value = currentAreaId.value !== null;
    setupCrossModuleListeners();
  }

  async function enterArea(areaId: string): Promise<void> {
    await explorationService.enterArea(areaId);
    syncFromService();
    isExploring.value = true;
  }

  function generateGrid(): void {
    explorationService.generateGrid();
    syncFromService();
  }

  function movePlayer(direction: 'up' | 'down' | 'left' | 'right') {
    const result = explorationService.movePlayer(direction);
    syncFromService();
    return result;
  }

  function canMove(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    return explorationService.canMove(direction);
  }

  function handleEventChoice(choiceId: string) {
    const result = explorationService.handleEventChoice(choiceId);
    grid.value = explorationService.getState().grid;
    return result;
  }

  async function revealGrid(x: number, y: number): Promise<boolean> {
    const success = await explorationService.revealGrid(x, y);
    if (success) {
      grid.value = explorationService.getState().grid;
    }
    return success;
  }

  function useCamp(): boolean {
    const success = explorationService.useCamp();
    if (success) {
      syncFromService();
    }
    return success;
  }

  function triggerBattle(monsterId: string): void {
    explorationService.triggerBattle(monsterId);
  }

  function reset(): void {
    explorationService.reset();
    currentAreaId.value = null;
    grid.value = [];
    campUsed.value = false;
    isExploring.value = false;
    playerPosition.value = { x: 0, y: 0 };
    visitedCells.value = 0;
    remainingMoves.value = 20;
    bossDefeated.value = false;
    explorationComplete.value = false;
  }

  function exitExploration(): void {
    reset();
  }

  /**
   * 跨模块事件监听（每次调用前会先清理旧监听器，防止重复注册）
   */
  function setupCrossModuleListeners(): void {
    // 先清理旧监听器，防止重复注册
    eventBus.clearGroup('explorationStore');

    // 角色登出时只清除UI状态，不删除数据库中的探索数据
    eventBus.onGroup('explorationStore', GameEvents.CHARACTER_LOGOUT, () => {
      reset();
    });

    // 角色选中时清除旧角色的探索UI状态，新角色数据在打开探索标签时延迟加载
    eventBus.onGroup('explorationStore', GameEvents.CHARACTER_SELECTED, () => {
      reset();
    });
  }

  /**
   * 清理事件监听
   */
  function dispose(): void {
    eventBus.clearGroup('explorationStore');
  }

  return {
    // 状态
    currentAreaId,
    grid,
    campUsed,
    isExploring,
    playerPosition,
    visitedCells,
    remainingMoves,
    bossDefeated,
    explorationComplete,
    state,
    getGridCell,
    hasStartedExploration,
    init,
    enterArea,
    generateGrid,
    movePlayer,
    canMove,
    handleEventChoice,
    revealGrid,
    useCamp,
    triggerBattle,
    reset,
    exitExploration,
    setupCrossModuleListeners,
    dispose
  };
});