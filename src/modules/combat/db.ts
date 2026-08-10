/**
 * 战斗模块数据层
 * 
 * 封装战斗数据的 IndexedDB 操作，提供数据持久化能力
 */
import { db as gameDb, dbService } from '@/modules/data';
import type { CombatLog, CombatLogStorage } from './types';

/**
 * 战斗数据层服务
 */
export class CombatDbService {
  /**
   * 将 IndexedDB 存储格式转换为运行时 CombatLog 格式
   *
   * P2-44 修复：使用展开运算符复制所有字段，仅对需要类型收窄的枚举字段
   * （actorType/eventType/targetType 在 Storage 中为 string，运行时为字面量联合）
   * 显式断言，避免新增字段时遗漏同步更新。
   */
  private mapStorageToLogs(logs: CombatLogStorage[]): CombatLog[] {
    return logs.map(log => ({
      ...log,
      actorType: log.actorType as CombatLog['actorType'],
      eventType: log.eventType as CombatLog['eventType'],
      targetType: log.targetType as CombatLog['targetType'],
    }));
  }

  /**
   * 保存战斗日志
   * @param log - 战斗日志
   */
  async saveCombatLog(log: CombatLog): Promise<void> {
    await dbService.withRetry(async () => {
      // P8-003 修复：使用展开写法替代手动枚举，与 mapStorageToLogs 的 ...log 保持一致，
      // 避免新增字段时遗漏同步更新
      const { actorType, eventType, targetType, ...rest } = log;
      await gameDb.runtime_combatLogs.put({
        ...rest,
        actorType,
        eventType,
        targetType,
      });
    });
  }

  /**
   * 获取战斗日志
   * @param combatId - 战斗ID
   * @returns 战斗日志列表
   */
  async getCombatLogs(combatId: string): Promise<CombatLog[]> {
    return dbService.withRetry(async () => {
      // P2-33 修复：Dexie 表已通过 schema 类型推断为 CombatLogStorage[]，
      // 移除多余的 as 断言；若未来表类型变化，TypeScript 会在编译期报错
      const logs: CombatLogStorage[] = await gameDb.runtime_combatLogs
        .where('combatId')
        .equals(combatId)
        .sortBy('timestamp');
      return this.mapStorageToLogs(logs);
    });
  }

  /**
   * 获取所有战斗日志
   * @returns 所有战斗日志列表
   */
  async getAllCombatLogs(): Promise<CombatLog[]> {
    return dbService.withRetry(async () => {
      // P2-33 修复：toArray() 返回 Promise<CombatLogStorage[]>，无需断言
      const logs: CombatLogStorage[] = await gameDb.runtime_combatLogs.toArray();
      return this.mapStorageToLogs(logs);
    });
  }

  /**
   * 删除战斗日志
   * @param battleLogId - 日志ID
   */
  async deleteCombatLog(battleLogId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.runtime_combatLogs.delete(battleLogId);
    });
  }

  /**
   * 删除战斗的所有日志
   * @param combatId - 战斗ID
   */
  async deleteCombatLogs(combatId: string): Promise<void> {
    await dbService.withRetry(async () => {
      // P1-10 修复：使用 Dexie 批量删除 API 替代逐条 delete，避免中途失败导致部分删除
      await gameDb.runtime_combatLogs.where('combatId').equals(combatId).delete();
    });
  }

  /**
   * 清空所有战斗日志
   */
  async clearAllCombatLogs(): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.runtime_combatLogs.clear();
    });
  }
}

/**
 * 战斗数据层实例
 */
export const combatDbService = new CombatDbService();
