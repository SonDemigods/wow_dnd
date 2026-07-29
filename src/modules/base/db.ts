/**
 * 基础数据管理模块数据库层
 * 
 * 封装阵营、种族、职业数据的数据库操作
 */

import { db as gameDb, dbService } from '@/modules/data/core';
import type { FactionData, RaceData, ClassData, RaceType, FactionType } from '@/modules/character/types';
import type { FactionCreateUpdateData, RaceCreateUpdateData, ClassCreateUpdateData } from './types';
import { generateId } from '../../utils/db-helpers';
import { filterClassesByRace, filterClassesByFaction } from './service';

/**
 * 类型转换辅助函数
 *
 * P3-111 修复说明：此函数仅做 `as T` 单层断言，不提供运行时类型安全保证。
 * Dexie 的 toArray() 返回 unknown[]，需要断言为具体类型。
 * 如果未来需要运行时校验，可引入 zod schema 替代此函数。
 * 当前保留此函数是因为 Dexie schema 已通过 TypeScript 类型推断保证结构正确性。
 */
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
   *
   * P2-63 修复：将 get-then-write 包裹在 Dexie 事务中，避免 TOCTOU 竞态。
   * 事务保证 get 和 put 之间的原子性，其他读写操作无法在事务内部插入。
   */
  async updateFaction(id: string, data: FactionCreateUpdateData): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.transaction('rw', gameDb.config_factions, async () => {
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
    });
  }

  /**
   * 删除阵营
   *
   * P2-63 修复：同 updateFaction，事务包裹 get-then-delete。
   */
  async deleteFaction(id: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.transaction('rw', gameDb.config_factions, async () => {
        const existing = await gameDb.config_factions.get(id);
        if (!existing) {
          throw new Error('Faction not found');
        }
        await gameDb.config_factions.delete(id);
      });
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
   *
   * P2-63 修复：事务包裹 get-then-write，避免 TOCTOU 竞态。
   */
  async updateRace(id: string, data: RaceCreateUpdateData): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.transaction('rw', gameDb.config_races, async () => {
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
    });
  }

  /**
   * 删除种族
   *
   * P2-63 修复：事务包裹 get-then-write，避免 TOCTOU 竞态。
   */
  async deleteRace(id: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.transaction('rw', gameDb.config_races, async () => {
        const existing = await gameDb.config_races.get(id);
        if (!existing) {
          throw new Error('Race not found');
        }
        await gameDb.config_races.delete(id);
      });
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
   *
   * P3-119 说明：采用全量加载后内存过滤，而非 Dexie 多值索引查询。
   * 原因：config_classes 表数据量小（< 20 条），全量加载 + JS 过滤性能足够，
   * 且多值索引需要额外维护 schema，收益不大。如未来数据量增长可改为索引查询。
   */
  async getClassesByRace(raceId: RaceType): Promise<ClassData[]> {
    return dbService.withRetry(async () => {
      const result = await gameDb.config_classes.toArray();
      return filterClassesByRace(cast<ClassData[]>(result), raceId);
    });
  }

  /**
   * 根据阵营获取职业（委托给 service 纯函数做内存过滤）
   *
   * P3-119 说明：同 getClassesByRace，采用全量加载后内存过滤。
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
   *
   * P2-63 修复：事务包裹 get-then-write，避免 TOCTOU 竞态。
   */
  async updateClass(id: string, data: ClassCreateUpdateData): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.transaction('rw', gameDb.config_classes, async () => {
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
    });
  }

  /**
   * 删除职业
   *
   * P2-63 修复：事务包裹 get-then-write，避免 TOCTOU 竞态。
   */
  async deleteClass(id: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.transaction('rw', gameDb.config_classes, async () => {
        const existing = await gameDb.config_classes.get(id);
        if (!existing) {
          throw new Error('Class not found');
        }
        await gameDb.config_classes.delete(id);
      });
    });
  }
}

/**
 * 基础数据数据库服务实例
 */
export const baseDbService = new BaseDbService();
