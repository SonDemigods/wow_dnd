/**
 * 基础数据管理模块数据库层
 * 
 * 封装阵营、种族、职业数据的数据库操作
 */

import { db as gameDb, dbService } from '../data/core';
import type { FactionData, RaceData, ClassData, RaceType, FactionType } from '../character/types';
import type { FactionCreateUpdateData, RaceCreateUpdateData, ClassCreateUpdateData } from './types';
import { generateId } from '../../utils/db-helpers';
import { filterClassesByRace, filterClassesByFaction } from './service';

/** 类型安全转换辅助函数，消除 `as unknown as T` 双重断言 */
function cast<T>(data: unknown): T {
  return data as T;
}

/**
 * 基础数据数据库服务类
 */
export class BaseDbService {
  // ==================== 阵营操作 ====================

  /**
   * 获取所有阵营
   */
  async getAllFactions(): Promise<FactionData[]> {
    return dbService.withRetry(async () => {
      const result = await gameDb.config_factions.toArray();
      return cast<FactionData[]>(result);
    });
  }

  /**
   * 根据ID获取阵营
   */
  async getFactionById(id: string): Promise<FactionData | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.config_factions.get(id);
      return cast<FactionData | null>(result);
    });
  }

  /**
   * 创建阵营
   */
  async createFaction(data: FactionCreateUpdateData): Promise<string> {
    const id = generateId('base');
    await dbService.withRetry(async () => {
      await gameDb.config_factions.add({
        id,
        ...data
      });
    });
    return id;
  }

  /**
   * 更新阵营
   */
  async updateFaction(id: string, data: FactionCreateUpdateData): Promise<void> {
    await dbService.withRetry(async () => {
      const existing = await gameDb.config_factions.get(id);
      if (!existing) {
        throw new Error('Faction not found');
      }
      await gameDb.config_factions.put({
        ...existing,
        ...data,
        id
      });
    });
  }

  /**
   * 删除阵营
   */
  async deleteFaction(id: string): Promise<void> {
    await dbService.withRetry(async () => {
      const existing = await gameDb.config_factions.get(id);
      if (!existing) {
        throw new Error('Faction not found');
      }
      await gameDb.config_factions.delete(id);
    });
  }

  // ==================== 种族操作 ====================

  /**
   * 获取所有种族
   */
  async getAllRaces(): Promise<RaceData[]> {
    return dbService.withRetry(async () => {
      const result = await gameDb.config_races.toArray();
      return cast<RaceData[]>(result);
    });
  }

  /**
   * 根据ID获取种族
   */
  async getRaceById(id: string): Promise<RaceData | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.config_races.get(id);
      return cast<RaceData | null>(result);
    });
  }

  /**
   * 根据阵营获取种族（Dexie 索引查询）
   */
  async getRacesByFaction(factionId: FactionType): Promise<RaceData[]> {
    return dbService.withRetry(async () => {
      const result = await gameDb.config_races.where('factionId').equals(factionId).toArray();
      return cast<RaceData[]>(result);
    });
  }

  /**
   * 创建种族
   */
  async createRace(data: RaceCreateUpdateData): Promise<string> {
    const id = generateId('base');
    await dbService.withRetry(async () => {
      await gameDb.config_races.add({
        id,
        ...data
      });
    });
    return id;
  }

  /**
   * 更新种族
   */
  async updateRace(id: string, data: RaceCreateUpdateData): Promise<void> {
    await dbService.withRetry(async () => {
      const existing = await gameDb.config_races.get(id);
      if (!existing) {
        throw new Error('Race not found');
      }
      await gameDb.config_races.put({
        ...existing,
        ...data,
        id
      });
    });
  }

  /**
   * 删除种族
   */
  async deleteRace(id: string): Promise<void> {
    await dbService.withRetry(async () => {
      const existing = await gameDb.config_races.get(id);
      if (!existing) {
        throw new Error('Race not found');
      }
      await gameDb.config_races.delete(id);
    });
  }

  // ==================== 职业操作 ====================

  /**
   * 获取所有职业
   */
  async getAllClasses(): Promise<ClassData[]> {
    return dbService.withRetry(async () => {
      const result = await gameDb.config_classes.toArray();
      return cast<ClassData[]>(result);
    });
  }

  /**
   * 根据ID获取职业
   */
  async getClassById(id: string): Promise<ClassData | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.config_classes.get(id);
      return cast<ClassData | null>(result);
    });
  }

  /**
   * 根据种族获取职业（委托给 service 纯函数做内存过滤）
   */
  async getClassesByRace(raceId: RaceType): Promise<ClassData[]> {
    return dbService.withRetry(async () => {
      const result = await gameDb.config_classes.toArray();
      return filterClassesByRace(cast<ClassData[]>(result), raceId);
    });
  }

  /**
   * 根据阵营获取职业（委托给 service 纯函数做内存过滤）
   */
  async getClassesByFaction(factionId: FactionType): Promise<ClassData[]> {
    return dbService.withRetry(async () => {
      const result = await gameDb.config_classes.toArray();
      return filterClassesByFaction(cast<ClassData[]>(result), factionId);
    });
  }

  /**
   * 创建职业
   */
  async createClass(data: ClassCreateUpdateData): Promise<string> {
    const id = generateId('base');
    await dbService.withRetry(async () => {
      await gameDb.config_classes.add({
        id,
        ...data
      });
    });
    return id;
  }

  /**
   * 更新职业
   */
  async updateClass(id: string, data: ClassCreateUpdateData): Promise<void> {
    await dbService.withRetry(async () => {
      const existing = await gameDb.config_classes.get(id);
      if (!existing) {
        throw new Error('Class not found');
      }
      await gameDb.config_classes.put({
        ...existing,
        ...data,
        id
      });
    });
  }

  /**
   * 删除职业
   */
  async deleteClass(id: string): Promise<void> {
    await dbService.withRetry(async () => {
      const existing = await gameDb.config_classes.get(id);
      if (!existing) {
        throw new Error('Class not found');
      }
      await gameDb.config_classes.delete(id);
    });
  }
}

/**
 * 基础数据数据库服务实例
 */
export const baseDbService = new BaseDbService();
