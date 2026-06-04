import { db as gameDb, dbService } from '../data/core';
import type { ExplorationState, ExplorationCell } from './types';

export interface ExplorationStorage {
  characterId: string;
  currentAreaId: string | null;
  grid: ExplorationCell[][];
  campUsed: boolean;
  playerPosition: { x: number; y: number };
  visitedCells: number;
  remainingMoves: number;
  bossDefeated: boolean;
  explorationComplete: boolean;
  updatedAt: number;
}

export class ExplorationDbService {
  async saveExplorationData(characterId: string, state: ExplorationState): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_exploration.put({
        characterId,
        currentAreaId: state.currentAreaId,
        grid: state.grid,
        campUsed: state.campUsed,
        playerPosition: state.playerPosition,
        visitedCells: state.visitedCells,
        remainingMoves: state.remainingMoves,
        bossDefeated: state.bossDefeated,
        explorationComplete: state.explorationComplete,
        updatedAt: Date.now()
      });
    });
  }

  async getExplorationData(characterId: string): Promise<ExplorationStorage | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.char_exploration.get(characterId);
      if (!result) return null;
      // 兼容旧数据：缺少新字段时使用默认值
      return {
        characterId: result.characterId as string,
        currentAreaId: (result.currentAreaId as string) || null,
        grid: (result.grid as unknown as ExplorationCell[][]) || [],
        campUsed: (result.campUsed as boolean) || false,
        playerPosition: (result.playerPosition as { x: number; y: number }) || { x: 0, y: 0 },
        visitedCells: (result.visitedCells as number) || 0,
        remainingMoves: (result.remainingMoves as number) ?? 20,
        bossDefeated: (result.bossDefeated as boolean) || false,
        explorationComplete: (result.explorationComplete as boolean) || false,
        updatedAt: (result.updatedAt as number) || Date.now()
      };
    });
  }

  async deleteExplorationData(characterId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_exploration.delete(characterId);
    });
  }

  async clearAllExplorationData(): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_exploration.clear();
    });
  }

  async getAllExplorationData(): Promise<ExplorationStorage[]> {
    return dbService.withRetry(async () => {
      const results = await gameDb.char_exploration.toArray();
      return results as unknown as ExplorationStorage[];
    });
  }
}

export const explorationDbService = new ExplorationDbService();
