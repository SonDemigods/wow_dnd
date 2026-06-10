/**
 * 后台管理模块服务层
 *
 * 提供配置数据表的 CRUD 业务逻辑
 */
import { adminDbService } from './db';
import type { AdminOperationResult } from './types';
import { db as gameDb } from '../data/core';

/**
 * 管理后台服务类
 */
export class AdminService {
  // ==================== 通用 CRUD 封装 ====================

  async getAll<T>(tableName: string): Promise<T[]> {
    return await adminDbService.getAll<T>(tableName);
  }

  async getById<T>(tableName: string, id: string): Promise<T | null> {
    return await adminDbService.getById<T>(tableName, id);
  }

  async add<T>(tableName: string, data: T): Promise<AdminOperationResult<string>> {
    try {
      const id = await adminDbService.add(tableName, data);
      return { success: true, data: id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '添加失败' };
    }
  }

  async update<T>(tableName: string, id: string, data: Partial<T>): Promise<AdminOperationResult> {
    try {
      await adminDbService.update(tableName, id, data);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '更新失败' };
    }
  }

  async delete(tableName: string, id: string): Promise<AdminOperationResult> {
    try {
      await adminDbService.delete(tableName, id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '删除失败' };
    }
  }

  async clear(tableName: string): Promise<AdminOperationResult> {
    try {
      await adminDbService.clear(tableName);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '清空失败' };
    }
  }

  async count(tableName: string): Promise<number> {
    return await adminDbService.count(tableName);
  }

  // ==================== 搜索 ====================

  /**
   * 搜索数据表（使用 Dexie 索引查询 name/id 字段）
   */
  async searchTable(tableName: string, keyword: string): Promise<any[]> {
    const table = (gameDb as any)[tableName];
    if (!table || !keyword.trim()) return [];
    try {
      let collection = table.where('name').startsWithIgnoreCase(keyword);
      collection = collection.or(table.where('id').startsWithIgnoreCase(keyword));
      return await collection.distinct().toArray();
    } catch {
      try {
        const lowerKeyword = keyword.toLowerCase();
        return await table.filter((item: any) => {
          const searchableFields = ['name', 'title', 'id', 'type', 'rarity', 'factionId', 'raceId', 'classId'];
          return searchableFields.some(field => {
            const val = item[field];
            if (val === null || val === undefined) return false;
            return String(val).toLowerCase().includes(lowerKeyword);
          });
        }).toArray();
      } catch {
        return [];
      }
    }
  }

  // ==================== 仪表盘 ====================

  async getDashboardStats(): Promise<{
    tableCounts: Record<string, number>;
  }> {
    const tableNames = [
      'config_factions', 'config_races', 'config_classes',
      'config_items', 'config_equipmentItems', 'config_enemies',
      'config_quests', 'config_skills', 'config_locations', 'config_shops',
    ];

    const counts: Record<string, number> = {};
    await Promise.all(
      tableNames.map(async (name) => {
        counts[name] = await adminDbService.count(name);
      })
    );

    return { tableCounts: counts };
  }
}

export const adminService = new AdminService();
