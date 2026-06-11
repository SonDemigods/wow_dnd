/**
 * 后台管理模块数据层
 *
 * 封装对 IndexedDB 中所有数据表的通用 CRUD 操作，
 * 复用现有 db（GameDatabase）实例
 */
import { db as gameDb, dbService } from '../data/core';
import { toRawData } from '../../utils';

/**
 * 管理后台数据库服务类
 *
 * 提供对任意 Dexie 表的泛型 CRUD 操作，
 * 以及角色相关数据的高级查询
 */
export class AdminDbService {
  /**
   * 获取指定表的所有记录
   * @param tableName - Dexie 表名
   * @returns 所有记录数组
   */
  async getAll<T>(tableName: string): Promise<T[]> {
    return dbService.withRetry(async () => {
      const table = (gameDb as any)[tableName];
      if (!table) throw new Error(`表 ${tableName} 不存在`);
      return await table.toArray() as T[];
    });
  }

  /**
   * 根据主键获取单条记录
   * @param tableName - Dexie 表名
   * @param id - 主键值
   * @returns 记录或 null
   */
  async getById<T>(tableName: string, id: string): Promise<T | null> {
    return dbService.withRetry(async () => {
      const table = (gameDb as any)[tableName];
      if (!table) throw new Error(`表 ${tableName} 不存在`);
      return await table.get(id) as T | null;
    });
  }

  /**
   * 根据复合主键获取单条记录（用于 char_quests 等复合键表）
   * @param tableName - Dexie 表名
   * @param key - 复合键值
   * @returns 记录或 null
   */
  async getByCompoundKey<T>(tableName: string, key: any): Promise<T | null> {
    return dbService.withRetry(async () => {
      const table = (gameDb as any)[tableName];
      if (!table) throw new Error(`表 ${tableName} 不存在`);
      return await table.get(key) as T | null;
    });
  }

  /**
   * 添加一条记录
   * @param tableName - Dexie 表名
   * @param data - 记录数据
   * @param key - 可选主键值（不提供则自动生成）
   * @returns 主键值
   */
  async add<T>(tableName: string, data: T, key?: string): Promise<string> {
    return dbService.withRetry(async () => {
      const table = (gameDb as any)[tableName];
      if (!table) throw new Error(`表 ${tableName} 不存在`);
      // JSON 序列化去除 Vue/Proxy 包装，避免 IndexedDB DataCloneError
      const cleanData = toRawData(data);
      if (key) {
        await table.add({ ...cleanData, id: key }, key);
        return key;
      }
      return await table.add(cleanData);
    });
  }

  /**
   * 更新一条记录
   * @param tableName - Dexie 表名
   * @param id - 主键值
   * @param data - 更新的字段
   */
  async update<T>(tableName: string, id: string, data: Partial<T>): Promise<void> {
    return dbService.withRetry(async () => {
      const table = (gameDb as any)[tableName];
      if (!table) throw new Error(`表 ${tableName} 不存在`);
      const existing = await table.get(id);
      if (!existing) throw new Error('记录不存在');
      // JSON 序列化去除 Vue/Proxy 包装，避免 IndexedDB DataCloneError
      const cleanData = toRawData({ ...existing, ...data, id: existing.id ?? id });
      await table.put(cleanData);
    });
  }

  /**
   * 删除一条记录
   * @param tableName - Dexie 表名
   * @param id - 主键值
   */
  async delete(tableName: string, id: string): Promise<void> {
    return dbService.withRetry(async () => {
      const table = (gameDb as any)[tableName];
      if (!table) throw new Error(`表 ${tableName} 不存在`);
      await table.delete(id);
    });
  }

  /**
   * 获取表中记录总数
   * @param tableName - Dexie 表名
   */
  async count(tableName: string): Promise<number> {
    return dbService.withRetry(async () => {
      const table = (gameDb as any)[tableName];
      if (!table) throw new Error(`表 ${tableName} 不存在`);
      return await table.count();
    });
  }

  /**
   * 清空表
   * @param tableName - Dexie 表名
   */
  async clear(tableName: string): Promise<void> {
    return dbService.withRetry(async () => {
      const table = (gameDb as any)[tableName];
      if (!table) throw new Error(`表 ${tableName} 不存在`);
      await table.clear();
    });
  }

  /**
   * 获取所有角色关联数据的记录数（用于清理孤立数据）
   * 包括 char_inventory, char_equipment, char_skills, char_quests, char_exploration
   */
  async getCharacterRelatedTables(): Promise<string[]> {
    return [
      'char_inventory',
      'char_equipment',
      'char_skills',
      'char_quests',
      'char_exploration',
    ];
  }
}

/**
 * 管理后台数据层实例
 */
export const adminDbService = new AdminDbService();
