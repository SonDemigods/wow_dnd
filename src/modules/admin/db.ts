/**
 * 后台管理模块数据层
 *
 * 封装对 IndexedDB 中所有数据表的通用 CRUD 操作，
 * 复用现有 db（GameDatabase）实例
 */
import { db as gameDb, dbService } from '@/modules/data/core';
import type { GameDatabaseSchema } from '@/modules/data/core';
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
      // P9-050 修复：对自动生成的主键做运行时类型校验，确保返回 string
      const generatedKey = await table.add(cleanData);
      if (typeof generatedKey !== 'string') {
        throw new Error(
          `自动生成的主键类型不是 string，实际类型: ${typeof generatedKey}，值: ${String(generatedKey)}`
        );
      }
      return generatedKey;
    });
  }

  /**
   * 批量写入记录（覆盖同 ID）
   * @param tableName - Dexie 表名
   * @param data - 记录数组
   */
  async bulkPut(tableName: keyof GameDatabaseSchema, data: Record<string, unknown>[]): Promise<void> {
    return dbService.withRetry(async () => {
      const table = getTable(tableName);
      const cleanData = data.map(d => toRawData(d) as Record<string, unknown>);
      await table.bulkPut(cleanData);
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
      // P11-504 修复：将 get + put 包裹在事务中，避免并发写入导致的数据不一致
      await gameDb.transaction('rw', table, async () => {
        const existing = await table.get(id);
        if (!existing) throw new Error('记录不存在');
        // P9-055 修复：先 get 现有记录再浅合并，再 put，避免 put 覆盖整行导致未传入字段丢失
        // JSON 序列化去除 Vue/Proxy 包装，避免 IndexedDB DataCloneError
        const cleanData = toRawData({ ...existing, ...data, id: existing.id ?? id }) as Record<string, unknown>;
        await table.put(cleanData);
      });
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
        console.warn(e);
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

  /**
   * 分页查询数据表
   *
   * 支持排序（优先使用 Dexie orderBy 索引排序，索引不存在时回退到内存排序）
   * 和搜索过滤（先搜索再分页）。
   *
   * @param tableName - Dexie 表名
   * @param page - 页码（1-based）
   * @param pageSize - 每页条数
   * @param options.sortBy - 排序字段（可选）
   * @param options.sortOrder - 排序方向（'asc' | 'desc'，默认 'asc'）
   * @param options.keyword - 搜索关键词（可选，为空时不过滤）
   * @returns 分页结果（data + total）
   */
  async getPaged<T>(
    tableName: keyof GameDatabaseSchema,
    page: number,
    pageSize: number,
    options?: {
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      keyword?: string;
    },
  ): Promise<{ data: T[]; total: number }> {
    return dbService.withRetry(async () => {
      const table = getTable(tableName);
      const sortBy = options?.sortBy;
      const sortOrder = options?.sortOrder ?? 'asc';
      const keyword = options?.keyword?.trim() ?? '';

      // 获取全量数据（搜索过滤后）
      let allData: Record<string, unknown>[];
      if (keyword) {
        allData = await this.search<Record<string, unknown>>(tableName, keyword);
      } else {
        allData = await table.toArray();
      }

      // 排序
      if (sortBy) {
        allData.sort((a, b) => {
          const av = a[sortBy];
          const bv = b[sortBy];
          // null/undefined 排到末尾
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          // 数字比较
          if (typeof av === 'number' && typeof bv === 'number') {
            return sortOrder === 'asc' ? av - bv : bv - av;
          }
          // 字符串比较
          const as = String(av);
          const bs = String(bv);
          return sortOrder === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
        });
      }

      const total = allData.length;
      const offset = (page - 1) * pageSize;
      const data = allData.slice(offset, offset + pageSize) as T[];

      return { data, total };
    });
  }
}

/**
 * 管理后台数据层实例
 */
export const adminDbService = new AdminDbService();
