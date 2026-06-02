/**
 * 战斗模块数据层
 * 
 * 封装战斗数据的 IndexedDB 操作，提供数据持久化能力
 */
import { db as gameDb, dbService } from '../data/core';
import type { CombatLog } from './types';

/**
 * 战斗日志存储接口
 */
export interface CombatLogStorage {
  combatId: string;
  battleLogId: string;
  timestamp: number;
  turn: number;
  actorType: string;
  actorId: string;
  actorName: string;
  eventType: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  skillId?: string;
  skillName?: string;
  damage?: number;
  heal?: number;
  isCrit: boolean;
  isDodge: boolean;
  message: string;
}

/**
 * 战斗数据层服务
 */
export class CombatDbService {
  /**
   * 保存战斗日志
   * @param log - 战斗日志
   */
  async saveCombatLog(log: CombatLog): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.runtime_combatLogs.put({
        combatId: log.combatId,
        battleLogId: log.battleLogId,
        timestamp: log.timestamp,
        turn: log.turn,
        actorType: log.actorType,
        actorId: log.actorId,
        actorName: log.actorName,
        eventType: log.eventType,
        targetType: log.targetType,
        targetId: log.targetId,
        targetName: log.targetName,
        skillId: log.skillId,
        skillName: log.skillName,
        damage: log.damage,
        heal: log.heal,
        isCrit: log.isCrit,
        isDodge: log.isDodge,
        message: log.message
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
      const logs = await gameDb.runtime_combatLogs.where('combatId').equals(combatId).sortBy('timestamp');
      return logs.map(log => ({
        combatId: log.combatId,
        battleLogId: log.battleLogId,
        timestamp: log.timestamp,
        turn: log.turn,
        actorType: log.actorType as CombatLog['actorType'],
        actorId: log.actorId,
        actorName: log.actorName,
        eventType: log.eventType as CombatLog['eventType'],
        targetType: log.targetType as CombatLog['targetType'],
        targetId: log.targetId,
        targetName: log.targetName,
        skillId: log.skillId,
        skillName: log.skillName,
        damage: log.damage,
        heal: log.heal,
        isCrit: log.isCrit,
        isDodge: log.isDodge,
        message: log.message
      }));
    });
  }

  /**
   * 获取所有战斗日志
   * @returns 所有战斗日志列表
   */
  async getAllCombatLogs(): Promise<CombatLog[]> {
    return dbService.withRetry(async () => {
      const logs = await gameDb.runtime_combatLogs.toArray();
      return logs.map(log => ({
        combatId: log.combatId,
        battleLogId: log.battleLogId,
        timestamp: log.timestamp,
        turn: log.turn,
        actorType: log.actorType as CombatLog['actorType'],
        actorId: log.actorId,
        actorName: log.actorName,
        eventType: log.eventType as CombatLog['eventType'],
        targetType: log.targetType as CombatLog['targetType'],
        targetId: log.targetId,
        targetName: log.targetName,
        skillId: log.skillId,
        skillName: log.skillName,
        damage: log.damage,
        heal: log.heal,
        isCrit: log.isCrit,
        isDodge: log.isDodge,
        message: log.message
      }));
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
      const logs = await gameDb.runtime_combatLogs.where('combatId').equals(combatId).toArray();
      for (const log of logs) {
        await gameDb.runtime_combatLogs.delete(log.battleLogId);
      }
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
