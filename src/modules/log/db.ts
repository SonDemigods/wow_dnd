/**
 * @fileoverview 冒险日志模块数据层
 * @description 封装冒险日志数据的 IndexedDB 操作，提供数据持久化能力
 * @module log
 */
import { db as gameDb, dbService } from '../data/core';
import type { LogEntry, AdventureLogData } from './types';
import { toRawData } from '../../utils';

export class AdventureLogDbService {
  /**
   * 保存角色的冒险日志到数据库
   * @param characterId - 角色ID
   * @param logs - 日志记录列表
   */
  async saveAdventureLog(characterId: string, logs: LogEntry[]): Promise<void> {
    await dbService.withRetry(async () => {
      // JSON 序列化去除 Vue/Proxy 包装，避免 IndexedDB DataCloneError
      const cleanData = toRawData({
        characterId,
        entries: logs,
        updatedAt: Date.now()
      });
      await gameDb.runtime_adventureLogs.put(cleanData);
    });
  }

  /**
   * 从数据库获取指定角色的冒险日志
   * @param characterId - 角色ID
   * @returns 日志数据，不存在时返回null
   */
  async getAdventureLog(characterId: string): Promise<AdventureLogData | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.runtime_adventureLogs.get(characterId) as unknown as AdventureLogData | undefined;
      if (!result) return null;
      return result;
    });
  }

  /**
   * 从数据库删除指定角色的冒险日志
   * @param characterId - 角色ID
   */
  async deleteAdventureLog(characterId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.runtime_adventureLogs.delete(characterId);
    });
  }

  /**
   * 清除数据库中所有角色的冒险日志
   */
  async clearAllAdventureLogs(): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.runtime_adventureLogs.clear();
    });
  }
}

export const adventureLogDbService = new AdventureLogDbService();
