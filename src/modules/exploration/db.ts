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
   * 版本基线重构后存档字段完整，无需读时补默认值，直接返回原始数据。
   * 旧版 currentShopId / discovered / sealed / hint 等字段兼容逻辑已移除，
   * playerPosition 越界 clamp 也一并移除（新基线下网格尺寸固定，无越界存档）。
   *
   * @param characterId - 角色ID
   * @returns 探索存储数据，不存在时返回null
   */
  async getExplorationData(characterId: string): Promise<ExplorationStorage | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.char_exploration.get(characterId);
      return result ?? null;
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
