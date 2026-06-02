/**
 * 地图模块数据层
 * 
 * 封装地图数据的 IndexedDB 操作，提供数据持久化能力
 */
import { db as gameDb, dbService } from '../data/core';
import type { LocationData, LocationMarker, MapState } from './types';

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
    showMarkers: boolean;
    activeMarkerId?: string;
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
        id: location.name,
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
        mapY: location.mapY
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
        mapY: result.mapY
      };
    });
  }

  /**
   * 获取所有地点数据
   * @returns 地点数据列表
   */
  async getAllLocationData(): Promise<LocationData[]> {
    return dbService.withRetry(async () => {
      const results = await gameDb.config_locations.toArray();
      return results.map(result => ({
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
        mapY: result.mapY
      }));
    });
  }

  /**
   * 获取指定大陆的地点数据
   * @param continentId - 大陆ID
   * @returns 地点数据列表
   */
  async getLocationDataByContinent(continentId: string): Promise<LocationData[]> {
    return dbService.withRetry(async () => {
      const results = await gameDb.config_locations.where('continent').equals(continentId).toArray();
      return results.map(result => ({
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
        mapY: result.mapY
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
   * 保存地点标记
   * @param marker - 地点标记
   */
  async saveLocationMarker(marker: LocationMarker): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_locations.put({
        id: marker.id,
        x: marker.x,
        y: marker.y,
        icon: marker.icon,
        name: marker.name,
        locationId: marker.locationId,
        requiredLevel: marker.requiredLevel,
        difficulty: marker.difficulty,
        parentMarkerId: marker.parentMarkerId
      });
    });
  }

  /**
   * 获取地点标记
   * @param continentId - 大陆ID
   * @returns 地点标记列表
   */
  async getLocationMarkers(continentId: string): Promise<LocationMarker[]> {
    return dbService.withRetry(async () => {
      const results = await gameDb.config_locations.where('continentId').equals(continentId).toArray();
      return results.map(result => ({
        id: result.id,
        x: result.x,
        y: result.y,
        icon: result.icon,
        name: result.name,
        locationId: result.locationId,
        requiredLevel: result.requiredLevel,
        difficulty: result.difficulty,
        parentMarkerId: result.parentMarkerId
      }));
    });
  }

  /**
   * 获取所有地点标记
   * @returns 地点标记列表
   */
  async getAllLocationMarkers(): Promise<LocationMarker[]> {
    return dbService.withRetry(async () => {
      const results = await gameDb.config_locations.toArray();
      return results.map(result => ({
        id: result.id,
        x: result.x,
        y: result.y,
        icon: result.icon,
        name: result.name,
        locationId: result.locationId,
        requiredLevel: result.requiredLevel,
        difficulty: result.difficulty,
        parentMarkerId: result.parentMarkerId
      }));
    });
  }

  /**
   * 删除地点标记
   * @param markerId - 标记ID
   */
  async deleteLocationMarker(markerId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_locations.delete(markerId);
    });
  }

  /**
   * 清空所有地点标记
   */
  async clearAllLocationMarkers(): Promise<void> {
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
}

/**
 * 地图数据层实例
 */
export const mapDbService = new MapDbService();
