/**
 * 基础数据管理模块服务层
 * 
 * 提供阵营、种族、职业的业务逻辑处理和事务管理
 */

import type { FactionData, RaceData, ClassData } from '../character/types';
import type { 
  GameDataOperationResult, 
  FactionCreateUpdateData, 
  RaceCreateUpdateData, 
  ClassCreateUpdateData,
  IGameDataService 
} from './types';
import { gameDataDbService } from './db';
import { eventBus, GameEvents } from '../bus/core';

/**
 * 基础数据服务实现类
 */
export class GameDataService implements IGameDataService {
  // ==================== 阵营操作 ====================

  /**
   * 获取所有阵营
   */
  async getAllFactions(): Promise<FactionData[]> {
    return await gameDataDbService.getAllFactions();
  }

  /**
   * 获取所有阵营（兼容旧接口）
   */
  async getFactions(): Promise<Record<string, FactionData>> {
    const factions = await this.getAllFactions();
    const result: Record<string, FactionData> = {};
    factions.forEach(faction => {
      result[faction.id] = faction;
    });
    return result;
  }

  /**
   * 根据ID获取阵营
   */
  async getFactionById(id: string): Promise<FactionData | null> {
    return await gameDataDbService.getFactionById(id);
  }

  /**
   * 创建阵营
   */
  async createFaction(data: FactionCreateUpdateData): Promise<GameDataOperationResult<string>> {
    try {
      const id = await gameDataDbService.createFaction(data);
      
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, {
        type: 'faction',
        action: 'create',
        id
      });
      
      return { success: true, data: id };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '创建阵营失败' 
      };
    }
  }

  /**
   * 更新阵营
   */
  async updateFaction(id: string, data: FactionCreateUpdateData): Promise<GameDataOperationResult> {
    try {
      await gameDataDbService.updateFaction(id, data);
      
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, {
        type: 'faction',
        action: 'update',
        id
      });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '更新阵营失败' 
      };
    }
  }

  /**
   * 删除阵营
   */
  async deleteFaction(id: string): Promise<GameDataOperationResult> {
    try {
      await gameDataDbService.deleteFaction(id);
      
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, {
        type: 'faction',
        action: 'delete',
        id
      });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '删除阵营失败' 
      };
    }
  }

  // ==================== 种族操作 ====================

  /**
   * 获取所有种族
   */
  async getAllRaces(): Promise<RaceData[]> {
    return await gameDataDbService.getAllRaces();
  }

  /**
   * 获取所有种族（兼容旧接口）
   */
  async getRaces(): Promise<Record<string, RaceData>> {
    const races = await this.getAllRaces();
    const result: Record<string, RaceData> = {};
    races.forEach(race => {
      result[race.id] = race;
    });
    return result;
  }

  /**
   * 根据ID获取种族
   */
  async getRaceById(id: string): Promise<RaceData | null> {
    return await gameDataDbService.getRaceById(id);
  }

  /**
   * 根据阵营获取种族
   */
  async getRacesByFaction(factionId: string): Promise<RaceData[]> {
    return await gameDataDbService.getRacesByFaction(factionId);
  }

  /**
   * 创建种族
   */
  async createRace(data: RaceCreateUpdateData): Promise<GameDataOperationResult<string>> {
    try {
      const id = await gameDataDbService.createRace(data);
      
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, {
        type: 'race',
        action: 'create',
        id
      });
      
      return { success: true, data: id };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '创建种族失败' 
      };
    }
  }

  /**
   * 更新种族
   */
  async updateRace(id: string, data: RaceCreateUpdateData): Promise<GameDataOperationResult> {
    try {
      await gameDataDbService.updateRace(id, data);
      
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, {
        type: 'race',
        action: 'update',
        id
      });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '更新种族失败' 
      };
    }
  }

  /**
   * 删除种族
   */
  async deleteRace(id: string): Promise<GameDataOperationResult> {
    try {
      await gameDataDbService.deleteRace(id);
      
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, {
        type: 'race',
        action: 'delete',
        id
      });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '删除种族失败' 
      };
    }
  }

  // ==================== 职业操作 ====================

  /**
   * 获取所有职业
   */
  async getAllClasses(): Promise<ClassData[]> {
    return await gameDataDbService.getAllClasses();
  }

  /**
   * 获取所有职业（兼容旧接口）
   */
  async getClasses(): Promise<Record<string, ClassData>> {
    const classes = await this.getAllClasses();
    const result: Record<string, ClassData> = {};
    classes.forEach(cls => {
      result[cls.id] = cls;
    });
    return result;
  }

  /**
   * 根据ID获取职业
   */
  async getClassById(id: string): Promise<ClassData | null> {
    return await gameDataDbService.getClassById(id);
  }

  /**
   * 根据种族获取职业
   */
  async getClassesByRace(raceId: string): Promise<ClassData[]> {
    return await gameDataDbService.getClassesByRace(raceId);
  }

  /**
   * 根据阵营获取职业
   */
  async getClassesByFaction(factionId: string): Promise<ClassData[]> {
    return await gameDataDbService.getClassesByFaction(factionId);
  }

  /**
   * 创建职业
   */
  async createClass(data: ClassCreateUpdateData): Promise<GameDataOperationResult<string>> {
    try {
      const id = await gameDataDbService.createClass(data);
      
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, {
        type: 'class',
        action: 'create',
        id
      });
      
      return { success: true, data: id };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '创建职业失败' 
      };
    }
  }

  /**
   * 更新职业
   */
  async updateClass(id: string, data: ClassCreateUpdateData): Promise<GameDataOperationResult> {
    try {
      await gameDataDbService.updateClass(id, data);
      
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, {
        type: 'class',
        action: 'update',
        id
      });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '更新职业失败' 
      };
    }
  }

  /**
   * 删除职业
   */
  async deleteClass(id: string): Promise<GameDataOperationResult> {
    try {
      await gameDataDbService.deleteClass(id);
      
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, {
        type: 'class',
        action: 'delete',
        id
      });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '删除职业失败' 
      };
    }
  }
}

/**
 * 基础数据服务实例
 */
export const gameDataService = new GameDataService();