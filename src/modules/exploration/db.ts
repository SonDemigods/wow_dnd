/**
 * @fileoverview 探索模块数据层
 * @description 封装探索数据的 IndexedDB 操作，提供数据持久化能力
 * @module exploration
 */
import { db as gameDb, dbService } from '../data/core';
import type { ExplorationStorage } from './types';
import type { ExplorationState } from './types';
import { toRawData } from '../../utils';

export class ExplorationDbService {
  /**
   * 保存角色的探索数据到数据库
   * @param characterId - 角色ID
   * @param state - 探索状态对象
   */
  async saveExplorationData(characterId: string, state: ExplorationState, assignedShopId: string = ''): Promise<void> {
    await dbService.withRetry(async () => {
      // JSON 序列化去除 Vue/Proxy 包装，避免 IndexedDB DataCloneError
      const cleanData = toRawData({
        characterId,
        currentAreaId: state.currentAreaId,
        assignedShopId,
        grid: state.grid,
        campUsed: state.campUsed,
        playerPosition: state.playerPosition,
        visitedCells: state.visitedCells,
        remainingMoves: state.remainingMoves,
        bossDefeated: state.bossDefeated,
        explorationComplete: state.explorationComplete,
        updatedAt: Date.now()
      });
      await gameDb.char_exploration.put(cleanData);
    });
  }

  /**
   * 从数据库获取指定角色的探索数据
   * 兼容旧版本数据，缺失字段使用默认值
   * @param characterId - 角色ID
   * @returns 探索存储数据，不存在时返回null
   */
  async getExplorationData(characterId: string): Promise<ExplorationStorage | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.char_exploration.get(characterId);
      if (!result) return null;
      // 兼容旧数据：缺失字段使用默认值，旧版 currentShopId 兼容到 assignedShopId
      return {
        ...result,
        assignedShopId: (result.assignedShopId || (result as unknown as Record<string, unknown>).currentShopId as string) || '',
        grid: result.grid || [],
        playerPosition: result.playerPosition || { x: 0, y: 0 },
        visitedCells: result.visitedCells || 0,
        remainingMoves: result.remainingMoves ?? 20,
        bossDefeated: result.bossDefeated || false,
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
