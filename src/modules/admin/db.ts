/**
 * 后台管理模块数据层
 *
 * 封装对 IndexedDB 中所有数据表的通用 CRUD 操作，
 * 复用现有 db（GameDatabase）实例
 */
import { db as gameDb, dbService } from '../data/core';
import type { GameDatabaseSchema } from '../data/core';
import { toRawData } from '../../utils';
import type { Table } from 'dexie';

/**
 * 内部辅助：安全获取 Dexie 表实例
 *
 * 使用 Dexie 官方 `table()` API 动态访问表，并通过 `Table<Record<string, unknown>, string>`
 * 类型断言收窄，避免 `as any` 绕过类型校验。tableName 参数受 `keyof GameDatabaseSchema`
 * 约束，编译期即可拦截不存在的表名。
 */
function getTable(tableName: keyof GameDatabaseSchema): Table<Record<string, unknown>, string> {
  return gameDb.table(tableName) as Table<Record<string, unknown>, string>;
}

/**
 * 管理后台数据库服务类
 *
 * 提供对任意 Dexie 表的泛型 CRUD 操作。
 * 所有方法的 tableName 参数受 `keyof GameDatabaseSchema` 约束，
 * 编译期即可拦截不存在的表名。
 */
export class AdminDbService {
  /**
   * 获取指定表的所有记录
   * @param tableName - Dexie 表名（受 keyof GameDatabaseSchema 约束）
   * @returns 所有记录数组
   */
  async getAll<T>(tableName: keyof GameDatabaseSchema): Promise<T[]> {
    return dbService.withRetry(async () => {
      return await getTable(tableName).toArray() as T[];
    });
  }

  /**
   * 根据主键获取单条记录
   * @param tableName - Dexie 表名（受 keyof GameDatabaseSchema 约束）
   * @param id - 主键值
   * @returns 记录或 null
   */
  async getById<T>(tableName: keyof GameDatabaseSchema, id: string): Promise<T | null> {
    return dbService.withRetry(async () => {
      return await getTable(tableName).get(id) as T | null;
    });
  }

  /**
   * 添加一条记录
   * @param tableName - Dexie 表名（受 keyof GameDatabaseSchema 约束）
   * @param data - 记录数据
   * @param key - 可选主键值（不提供则自动生成）
   * @returns 主键值
   */
  async add<T>(tableName: keyof GameDatabaseSchema, data: T, key?: string): Promise<string> {
    return dbService.withRetry(async () => {
      const table = getTable(tableName);
      // JSON 序列化去除 Vue/Proxy 包装，避免 IndexedDB DataCloneError
      const cleanData = toRawData(data) as Record<string, unknown>;
      if (key) {
        await table.add({ ...cleanData, id: key }, key);
        return key;
      }
      return await table.add(cleanData);
    });
  }

  /**
   * 更新一条记录
   * @param tableName - Dexie 表名（受 keyof GameDatabaseSchema 约束）
   * @param id - 主键值
   * @param data - 更新的字段
   */
  async update<T>(tableName: keyof GameDatabaseSchema, id: string, data: Partial<T>): Promise<void> {
    return dbService.withRetry(async () => {
      const table = getTable(tableName);
      const existing = await table.get(id);
      if (!existing) throw new Error('记录不存在');
      // JSON 序列化去除 Vue/Proxy 包装，避免 IndexedDB DataCloneError
      const cleanData = toRawData({ ...existing, ...data, id: existing.id ?? id }) as Record<string, unknown>;
      await table.put(cleanData);
    });
  }

  /**
   * 删除一条记录
   * @param tableName - Dexie 表名（受 keyof GameDatabaseSchema 约束）
   * @param id - 主键值
   */
  async delete(tableName: keyof GameDatabaseSchema, id: string): Promise<void> {
    return dbService.withRetry(async () => {
      await getTable(tableName).delete(id);
    });
  }

  /**
   * 获取表中记录总数
   * @param tableName - Dexie 表名（受 keyof GameDatabaseSchema 约束）
   */
  async count(tableName: keyof GameDatabaseSchema): Promise<number> {
    return dbService.withRetry(async () => {
      return await getTable(tableName).count();
    });
  }

  /**
   * 清空表
   * @param tableName - Dexie 表名（受 keyof GameDatabaseSchema 约束）
   */
  async clear(tableName: keyof GameDatabaseSchema): Promise<void> {
    return dbService.withRetry(async () => {
      await getTable(tableName).clear();
    });
  }

  /**
   * 搜索数据表（索引搜索 + 全字段回退搜索双层策略）
   * @param tableName - Dexie 表名（受 keyof GameDatabaseSchema 约束）
   * @param keyword - 搜索关键词
   * @returns 匹配的记录数组
   */
  async search<T>(tableName: keyof GameDatabaseSchema, keyword: string): Promise<T[]> {
    return dbService.withRetry(async () => {
      const table = getTable(tableName);
      if (!keyword.trim()) return [];

      try {
        // 优先尝试 name/id 索引搜索（Dexie 链式 or：or('index') 返回 WhereClause 再继续查询）
        let collection = table.where('name').startsWithIgnoreCase(keyword);
        collection = collection.or('id').startsWithIgnoreCase(keyword);
        return await collection.distinct().toArray() as T[];
      } catch (e) {
        // 索引不存在时回退到全字段过滤搜索
        console.error(e);
        const lowerKeyword = keyword.toLowerCase();
        return await table.filter((item: Record<string, unknown>) => {
          const searchableFields = ['name', 'title', 'id', 'type', 'rarity', 'factionId', 'raceId', 'classId'];
          return searchableFields.some(field => {
            const val = item[field];
            if (val === null || val === undefined) return false;
            return String(val).toLowerCase().includes(lowerKeyword);
          });
        }).toArray() as T[];
      }
    });
  }
}

/**
 * 管理后台数据层实例
 */
export const adminDbService = new AdminDbService();
