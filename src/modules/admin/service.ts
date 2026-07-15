/**
 * 后台管理模块服务层
 *
 * 提供配置数据表的 CRUD 业务逻辑
 *
 * 设计说明（DISC-1）：
 * 本项目为单机游戏，admin 模块为内嵌的配置管理后台，访问控制由 UI 路由层
 * （开发者菜单/管理入口）负责。service 层不做权限校验是单机场景下的设计意图，
 * 避免在无多用户/联机需求的场景下引入不必要的复杂度。
 * 若未来扩展为联机或多用户场景，应在 service 层之上补充权限中间件。
 */
import { adminDbService } from './db';
import type { AdminOperationResult } from './types';
import type { GameDatabaseSchema } from '@/modules/data/core';
import { CONFIG_TABLES } from './types';
import { errorHandler } from '@/services/ErrorHandler';

/**
 * 管理后台服务类
 */
export class AdminService {
  // ==================== 通用 CRUD 封装 ====================

  async getAll<T>(tableName: string): Promise<T[]> {
    return await adminDbService.getAll<T>(tableName as keyof GameDatabaseSchema);
  }

  async getById<T>(tableName: string, id: string): Promise<T | null> {
    return await adminDbService.getById<T>(tableName as keyof GameDatabaseSchema, id);
  }

  async add<T>(tableName: string, data: T, key?: string): Promise<AdminOperationResult<string>> {
    try {
      const id = await adminDbService.add(tableName as keyof GameDatabaseSchema, data, key);
      return { success: true, data: id };
    } catch (error) {
      errorHandler.report(error, `admin add(${tableName}) 失败`);
      return { success: false, error: error instanceof Error ? error.message : '添加失败' };
    }
  }

  async update<T>(tableName: string, id: string, data: Partial<T>): Promise<AdminOperationResult> {
    try {
      await adminDbService.update(tableName as keyof GameDatabaseSchema, id, data);
      return { success: true };
    } catch (error) {
      errorHandler.report(error, `admin update(${tableName}) 失败`);
      return { success: false, error: error instanceof Error ? error.message : '更新失败' };
    }
  }

  async delete(tableName: string, id: string): Promise<AdminOperationResult> {
    try {
      await adminDbService.delete(tableName as keyof GameDatabaseSchema, id);
      return { success: true };
    } catch (error) {
      errorHandler.report(error, `admin delete(${tableName}) 失败`);
      return { success: false, error: error instanceof Error ? error.message : '删除失败' };
    }
  }

  async clear(tableName: string): Promise<AdminOperationResult> {
    try {
      await adminDbService.clear(tableName as keyof GameDatabaseSchema);
      return { success: true };
    } catch (error) {
      errorHandler.report(error, `admin clear(${tableName}) 失败`);
      return { success: false, error: error instanceof Error ? error.message : '清空失败' };
    }
  }

  async count(tableName: string): Promise<number> {
    return await adminDbService.count(tableName as keyof GameDatabaseSchema);
  }

  // ==================== 搜索 ====================

  /**
   * 搜索数据表（使用 Dexie 索引查询 name/id 字段）
   */
  async searchTable(tableName: string, keyword: string): Promise<Record<string, unknown>[]> {
    return await adminDbService.search(tableName as keyof GameDatabaseSchema, keyword);
  }

  // ==================== 仪表盘 ====================

  async getDashboardStats(): Promise<{
    tableCounts: Record<string, number>;
  }> {
    const tableNames = CONFIG_TABLES.map(t => t.dbTable);

    const counts: Record<string, number> = {};
    await Promise.all(
      tableNames.map(async (name) => {
        counts[name] = await adminDbService.count(name as keyof GameDatabaseSchema);
      })
    );

    return { tableCounts: counts };
  }
}

export const adminService = new AdminService();
