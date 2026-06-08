/**
 * 地图模块数据层
 * 
 * 封装地图数据的 IndexedDB 操作，提供数据持久化能力
 */
import { db as gameDb, dbService } from '../data/core';
import type { LocationData, MapState } from './types';

/**
 * 地图状态存储接口
 */
export interface MapStateStorage {
  id: string;
  view: {
    zoomLevel: number;
    panX: number;
    panY: number;
    currentContinentId?: string;
  };
}

/**
 * 地点数据存储接口
 */
export interface LocationDataStorage {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  description: string;
  continent: string;
  region: string;
  enemies?: string[];
  quests?: string[];
  levelRange: [number, number];
  color: string;
  mapX: number;
  mapY: number;
  type: 'location' | 'continent';
}

/**
 * 地图数据层服务
 */
export class MapDbService {
  /**
   * 保存地图状态
   * @param state - 地图状态
   */
  async saveMapState(state: MapState): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.runtime_mapState.put({
        id: 'current',
        view: state.view
      });
    });
  }

  /**
   * 获取地图状态
   * @returns 地图状态
   */
  async getMapState(): Promise<MapState | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.runtime_mapState.get('current');
      if (!result) return null;
      return {
        view: result.view
      };
    });
  }

  /**
   * 保存地点数据
   * @param location - 地点数据
   */
  async saveLocationData(location: LocationData): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_locations.put({
        id: location.id,
        name: location.name,
        displayName: location.displayName,
        icon: location.icon,
        description: location.description,
        continent: location.continent,
        region: location.region,
        enemies: location.enemies,
        quests: location.quests,
        levelRange: location.levelRange,
        color: location.color,
        mapX: location.mapX,
        mapY: location.mapY,
        type: 'location'
      });
    });
  }

  /**
   * 获取地点数据
   * @param locationId - 地点ID
   * @returns 地点数据
   */
  async getLocationData(locationId: string): Promise<LocationData | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.config_locations.get(locationId);
      if (!result) return null;
      return {
        id: result.id,
        name: result.name,
        displayName: result.displayName,
        icon: result.icon,
        description: result.description,
        continent: result.continent,
        region: result.region,
        enemies: result.enemies,
        quests: result.quests,
        levelRange: result.levelRange,
        color: result.color,
        mapX: result.mapX,
        mapY: result.mapY,
        type: 'location' as const
      };
    });
  }

  /**
   * 获取所有地点数据（仅 type='location' 类型）
   * @returns 地点数据列表
   */
  async getAllLocationData(): Promise<LocationData[]> {
    return dbService.withRetry(async () => {
      const results = await gameDb.config_locations.where('type').equals('location').toArray();
      return results.map(result => ({
        id: result.id,
        name: result.name,
        displayName: result.displayName,
        icon: result.icon,
        description: result.description,
        continent: result.continent,
        region: result.region,
        enemies: result.enemies,
        quests: result.quests,
        levelRange: result.levelRange,
        color: result.color,
        mapX: result.mapX,
        mapY: result.mapY,
        type: 'location' as const
      }));
    });
  }

  /**
   * 获取指定大陆的地点数据（仅 type='location' 类型）
   * @param continentId - 大陆ID
   * @returns 地点数据列表
   */
  async getLocationDataByContinent(continentId: string): Promise<LocationData[]> {
    return dbService.withRetry(async () => {
      const results = await gameDb.config_locations.where('type').equals('location').toArray();
      return results
        .filter(result => result.continent === continentId)
        .map(result => ({
        id: result.id,
        name: result.name,
        displayName: result.displayName,
        icon: result.icon,
        description: result.description,
        continent: result.continent,
        region: result.region,
        enemies: result.enemies,
        quests: result.quests,
        levelRange: result.levelRange,
        color: result.color,
        mapX: result.mapX,
        mapY: result.mapY,
        type: 'location' as const
      }));
    });
  }

  /**
   * 删除地点数据
   * @param locationId - 地点ID
   */
  async deleteLocationData(locationId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_locations.delete(locationId);
    });
  }

  /**
   * 清空所有地点数据
   */
  async clearAllLocationData(): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_locations.clear();
    });
  }

  /**
   * 清空地图状态
   */
  async clearMapState(): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.runtime_mapState.clear();
    });
  }

  /**
   * 保存当前选中的区域ID
   * @param locationId - 区域ID
   */
  async saveCurrentLocationId(locationId: string): Promise<void> {
    await dbService.withRetry(async () => {
      let state = await gameDb.runtime_gameState.get('gameState');
      if (!state) {
        state = { id: 'gameState' };
      }
      state.currentLocationId = locationId;
      await gameDb.runtime_gameState.put(state);
    });
  }

  /**
   * 获取当前选中的区域ID
   * @returns 区域ID
   */
  async getCurrentLocationId(): Promise<string | null> {
    return dbService.withRetry(async () => {
      const state = await gameDb.runtime_gameState.get('gameState');
      if (!state) return null;
      return (state.currentLocationId as string) || null;
    });
  }

  /**
   * 保存当前标签页
   * @param tab - 标签名
   */
  async saveCurrentTab(tab: string): Promise<void> {
    await dbService.withRetry(async () => {
      let state = await gameDb.runtime_gameState.get('gameState');
      if (!state) {
        state = { id: 'gameState' };
      }
      state.currentTab = tab;
      await gameDb.runtime_gameState.put(state);
    });
  }

  /**
   * 获取当前标签页
   * @returns 标签名
   */
  async getCurrentTab(): Promise<string | null> {
    return dbService.withRetry(async () => {
      const state = await gameDb.runtime_gameState.get('gameState');
      if (!state) return null;
      return (state.currentTab as string) || null;
    });
  }
}

/**
 * 地图数据层实例
 */
export const mapDbService = new MapDbService();
