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
    const savedState = explorationService.getState();
    currentAreaId.value = savedState.currentAreaId;
    grid.value = savedState.grid;
    campUsed.value = savedState.campUsed;
    playerPosition.value = savedState.playerPosition;
    visitedCells.value = savedState.visitedCells;
    remainingMoves.value = savedState.remainingMoves;
    bossDefeated.value = savedState.bossDefeated;
    explorationComplete.value = savedState.explorationComplete;
    isExploring.value = savedState.currentAreaId !== null;
    initEventListeners();
  }

  function enterArea(areaId: string): void {
    explorationService.enterArea(areaId);
    const newState = explorationService.getState();
    currentAreaId.value = newState.currentAreaId;
    grid.value = newState.grid;
    campUsed.value = newState.campUsed;
    playerPosition.value = newState.playerPosition;
    visitedCells.value = newState.visitedCells;
    remainingMoves.value = newState.remainingMoves;
    bossDefeated.value = newState.bossDefeated;
    explorationComplete.value = newState.explorationComplete;
    isExploring.value = true;
  }

  function generateGrid(): void {
    explorationService.generateGrid();
    const newState = explorationService.getState();
    grid.value = newState.grid;
    playerPosition.value = newState.playerPosition;
    visitedCells.value = newState.visitedCells;
    remainingMoves.value = newState.remainingMoves;
    bossDefeated.value = newState.bossDefeated;
    explorationComplete.value = newState.explorationComplete;
  }

  function movePlayer(direction: 'up' | 'down' | 'left' | 'right') {
    const result = explorationService.movePlayer(direction);
    const newState = explorationService.getState();
    grid.value = newState.grid;
    playerPosition.value = newState.playerPosition;
    visitedCells.value = newState.visitedCells;
    remainingMoves.value = newState.remainingMoves;
    bossDefeated.value = newState.bossDefeated;
    explorationComplete.value = newState.explorationComplete;
    return result;
  }

  function canMove(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    return explorationService.canMove(direction);
  }

  function handleEventChoice(choiceId: string) {
    const result = explorationService.handleEventChoice(choiceId);
    const newState = explorationService.getState();
    grid.value = newState.grid;
    return result;
  }

  function revealGrid(x: number, y: number): boolean {
    const success = explorationService.revealGrid(x, y);
    if (success) {
      const newState = explorationService.getState();
      grid.value = newState.grid;
    }
    return success;
  }

  function useCamp(): boolean {
    const success = explorationService.useCamp();
    if (success) {
      const newState = explorationService.getState();
      grid.value = newState.grid;
      campUsed.value = newState.campUsed;
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

  function initEventListeners(): void {
    eventBus.onGroup('explorationStore', GameEvents.EXPLORATION_START, (data: { characterId: string | null; areaId?: string }) => {
      if (data.areaId) {
        currentAreaId.value = data.areaId;
      }
      isExploring.value = true;
    });

    eventBus.onGroup('explorationStore', GameEvents.EXPLORATION_END, () => {
      isExploring.value = false;
    });

    eventBus.onGroup('explorationStore', GameEvents.EXPLORATION_CELL_EXPLORED, (data: { x: number; y: number }) => {
      const cell = grid.value[data.y]?.[data.x];
      if (cell) {
        cell.explored = true;
      }
    });
  }

  /**
   * 清理事件监听
   */
  function dispose(): void {
    eventBus.clearGroup('explorationStore');
  }

  return {
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
    dispose
  };
});