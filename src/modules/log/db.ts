/**
 * @fileoverview 冒险日志模块数据层
 * @description 封装冒险日志数据的 IndexedDB 操作，提供数据持久化能力
 * @module log
 */
import { db as gameDb, dbService } from '@/modules/data';
import type { LogEntry, AdventureLogData } from './types';
import { toRawData } from '../../utils';

/** P4-012 修复：日志条目上限，防止 entries 数组无限增长导致读改写性能下降 */
const MAX_LOG_ENTRIES = 500;

export class AdventureLogDbService {
  /**
   * 保存角色的冒险日志到数据库
   * @param characterId - 角色ID
   * @param logs - 日志记录列表
   */
  async saveAdventureLog(characterId: string, logs: LogEntry[]): Promise<void> {
    // P4-012 修复：截断超出上限的旧日志，仅保留最近的 MAX_LOG_ENTRIES 条
    const trimmedLogs = logs.length > MAX_LOG_ENTRIES
      ? logs.slice(logs.length - MAX_LOG_ENTRIES)
      : logs;

    await dbService.withRetry(async () => {
      // JSON 序列化去除 Vue/Proxy 包装，避免 IndexedDB DataCloneError
      const cleanData = toRawData({
        characterId,
        entries: trimmedLogs,
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
