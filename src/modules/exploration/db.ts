import { db as gameDb, dbService } from '../data/core';
import type { GridCell, ExplorationState } from './types';

export interface ExplorationStorage {
  characterId: string;
  currentAreaId: string | null;
  grid: GridCell[][];
  campUsed: boolean;
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
        updatedAt: Date.now()
      });
    });
  }

  async getExplorationData(characterId: string): Promise<ExplorationStorage | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.char_exploration.get(characterId);
      if (!result) return null;
      return result as unknown as ExplorationStorage;
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
