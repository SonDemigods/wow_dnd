/**
 * @fileoverview 探索模块数据层
 * @description 封装探索数据的 IndexedDB 操作，提供数据持久化能力
 * @module exploration
 */
import { db as gameDb, dbService } from '@/modules/data/core';
import type { ExplorationStorage, ExplorationState } from './types';
import { toRawData } from '../../utils';

export class ExplorationDbService {
  /**
   * 保存角色的探索数据到数据库
   * @param characterId - 角色ID
   * @param state - 探索状态对象
   */
  async saveExplorationData(characterId: string, state: ExplorationState, assignedShopId: string = ''): Promise<void> {
    await dbService.withRetry(async () => {
      // toRawData 剥离 Vue/Proxy 响应式包装，避免 IndexedDB 序列化时抛出 DataCloneError
      const cleanData = toRawData({
        characterId,
        currentAreaId: state.currentAreaId,
        assignedShopId,
        grid: state.grid,
        campUsed: state.campUsed,
        playerPosition: state.playerPosition,
        visitedCells: state.visitedCells,
        bossDefeated: state.bossDefeated,
        explorationComplete: state.explorationComplete,
        updatedAt: Date.now()
      });
      await gameDb.char_exploration.put(cleanData);
    });
  }

  /**
   * 从数据库获取指定角色的探索数据。
   *
   * 兼容旧版本存档：缺失字段使用安全的默认值，
   * 旧版 currentShopId 字段自动迁移到 assignedShopId。
   * playerPosition 越界防御：旧存档可能记录了网格外的坐标（如阶段二缩小网格后），
   * 此处 clamp 到 [0, size-1] 范围，避免恢复后玩家位置悬空。
   *
   * @param characterId - 角色ID
   * @returns 探索存储数据，不存在时返回null
   */
  async getExplorationData(characterId: string): Promise<ExplorationStorage | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.char_exploration.get(characterId);
      if (!result) return null;
      // 兼容旧数据：缺失字段使用默认值，旧版 currentShopId 兼容到 assignedShopId
      // 阶段三：discovered 字段兼容——旧存档缺失时按 explored 推导（explored 恒蕴含 discovered）
      // 阶段四：sealed/hint 字段兼容——旧存档缺失时默认 false（无封印、无线索）
      const rawGrid = result.grid || [];
      const grid = rawGrid.map(row => row.map(cell => ({
        ...cell,
        discovered: cell.discovered ?? cell.explored ?? false,
        sealed: cell.sealed ?? false,
        hint: cell.hint ?? false,
      })));
      const rowCount = grid.length;
      const colCount = grid[0]?.length ?? 0;
      const rawPos = result.playerPosition || { x: 0, y: 0 };
      // 越界防御：clamp 到网格范围，网格为空时回退到 {0, 0}
      const playerPosition = {
        x: colCount > 0 ? Math.max(0, Math.min(rawPos.x, colCount - 1)) : 0,
        y: rowCount > 0 ? Math.max(0, Math.min(rawPos.y, rowCount - 1)) : 0,
      };
      return {
        ...result,
        assignedShopId: result.assignedShopId || result.currentShopId || '',
        grid,
        playerPosition,
        visitedCells: result.visitedCells ?? 0,
        bossDefeated: result.bossDefeated ?? false,
        explorationComplete: result.explorationComplete || false,
        campUsed: result.campUsed || false,
        updatedAt: result.updatedAt || Date.now()
      };
    });
  }

  /**
   * 从数据库删除指定角色的探索数据
   * @param characterId - 角色ID
   */
  async deleteExplorationData(characterId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_exploration.delete(characterId);
    });
  }

  /**
   * 清除数据库中所有角色的探索数据
   */
  async clearAllExplorationData(): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_exploration.clear();
    });
  }

  /**
   * 从数据库获取所有角色的探索数据
   * @returns 探索存储数据列表
   */
  async getAllExplorationData(): Promise<ExplorationStorage[]> {
    return dbService.withRetry(async () => {
      return await gameDb.char_exploration.toArray();
    });
  }
}

export const explorationDbService = new ExplorationDbService();
