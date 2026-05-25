import { db as gameDb, dbService } from '../data/core';
import type { LogEntry } from './types';

export interface AdventureLogData {
  characterId: string;
  logs: LogEntry[];
  updatedAt: number;
}

export class AdventureLogDbService {
  async saveAdventureLog(characterId: string, logs: LogEntry[]): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.adventureLog.put({
        characterId,
        logs,
        updatedAt: Date.now()
      });
    });
  }

  async getAdventureLog(characterId: string): Promise<AdventureLogData | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.adventureLog.get(characterId);
      if (!result) return null;
      return result as unknown as AdventureLogData;
    });
  }

  async deleteAdventureLog(characterId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.adventureLog.delete(characterId);
    });
  }

  async clearAllAdventureLogs(): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.adventureLog.clear();
    });
  }
}

export const adventureLogDbService = new AdventureLogDbService();