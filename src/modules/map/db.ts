/**
 * 地图模块数据层
 * 
 * 封装地图数据的 IndexedDB 操作，提供数据持久化能力。
 * 地图状态按角色ID隔离存储，切换角色后各角色数据独立保留。
 */
import { db as gameDb, dbService } from '../data/core';
import type { LocationStorage, MapState, LocationData, MapStateStorage } from './types';

/**
 * 根据角色ID生成地图状态存储键
 */
function getMapStateKey(characterId: string): string {
  return `map_${characterId}`;
}

/**
 * 将存储格式转换为 LocationData 业务类型
 */
function mapToLocationData(storage: LocationStorage): LocationData {
  return {
    id: storage.id,
    name: storage.name,
    icon: storage.icon,
    description: storage.description,
    continent: storage.continent ?? '',
    enemies: storage.enemies,
    bosses: storage.bosses,
    quests: storage.quests,
    levelRange: storage.levelRange ?? [1, 1],
    color: storage.color ?? '#000000',
    mapX: storage.mapX ?? 0,
    mapY: storage.mapY ?? 0,
    type: 'location' as const
  };
}

/**
 * 地图数据层服务
 */
export class MapDbService {
  /**
   * 保存地图视图状态（按角色ID隔离，合并写入）
   * 
   * 使用事务确保读-改-写的原子性。
   * @param characterId - 角色ID
   * @param state - 地图状态
   */
  async saveMapState(characterId: string, state: MapState): Promise<void> {
    await dbService.withRetry(async () => {
      const key = getMapStateKey(characterId);
      await gameDb.transaction('rw', gameDb.runtime_mapState, async () => {
        const existing = await gameDb.runtime_mapState.get(key);
        await gameDb.runtime_mapState.put({
          ...(existing || {}),
          id: key,
          view: state.view,
          unlockedZones: state.unlockedZones,
          completedZones: state.completedZones
        });
      });
    });
  }

  /**
   * 获取指定角色的地图状态
   * @param characterId - 角色ID
   * @returns 地图状态，含视图、当前地点和标签页
   */
  async getMapState(characterId: string): Promise<MapStateStorage | null> {
    return dbService.withRetry(async () => {
      const key = getMapStateKey(characterId);
      const result = await gameDb.runtime_mapState.get(key) as unknown as MapStateStorage | undefined;
      if (!result) return null;
      return result;
    });
  }

  /**
   * 获取地点数据
   * @param locationId - 地点ID
   * @returns 地点数据
   */
  async getLocationData(locationId: string): Promise<LocationData | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.config_locations.get(locationId) as unknown as LocationStorage | undefined;
      if (!result) return null;
      return mapToLocationData(result);
    });
  }

  /**
   * 获取所有地点数据（仅 type='location' 类型）
   * @returns 地点数据列表
   */
  async getAllLocationData(): Promise<LocationData[]> {
    return dbService.withRetry(async () => {
      const results = await gameDb.config_locations.where('type').equals('location').toArray() as unknown as LocationStorage[];
      return results.map(mapToLocationData);
    });
  }

  /**
   * 清空指定角色的地图状态
   * @param characterId - 角色ID
   */
  async clearMapState(characterId: string): Promise<void> {
    await dbService.withRetry(async () => {
      const key = getMapStateKey(characterId);
      await gameDb.runtime_mapState.delete(key);
    });
  }

  /**
   * 保存当前选中的区域ID（按角色ID隔离）
   * @param characterId - 角色ID
   * @param locationId - 区域ID
   */
  async saveCurrentLocationId(characterId: string, locationId: string): Promise<void> {
    await dbService.withRetry(async () => {
      const key = getMapStateKey(characterId);
      await gameDb.transaction('rw', gameDb.runtime_mapState, async () => {
        const existing = await gameDb.runtime_mapState.get(key);
        await gameDb.runtime_mapState.put({
          ...(existing || {}),
          id: key,
          currentLocationId: locationId
        });
      });
    });
  }

  /**
   * 获取指定角色的当前选中区域ID
   * @param characterId - 角色ID
   * @returns 区域ID
   */
  async getCurrentLocationId(characterId: string): Promise<string | null> {
    return dbService.withRetry(async () => {
      const key = getMapStateKey(characterId);
      const state = await gameDb.runtime_mapState.get(key) as unknown as MapStateStorage | undefined;
      if (!state) return null;
      return state.currentLocationId || null;
    });
  }

  /**
   * 保存当前标签页（按角色ID隔离）
   * @param characterId - 角色ID
   * @param tab - 标签名
   */
  async saveCurrentTab(characterId: string, tab: string): Promise<void> {
    await dbService.withRetry(async () => {
      const key = getMapStateKey(characterId);
      await gameDb.transaction('rw', gameDb.runtime_mapState, async () => {
        const existing = await gameDb.runtime_mapState.get(key);
        await gameDb.runtime_mapState.put({
          ...(existing || {}),
          id: key,
          currentTab: tab
        });
      });
    });
  }

  /**
   * 获取指定角色的当前标签页
   * @param characterId - 角色ID
   * @returns 标签名
   */
  async getCurrentTab(characterId: string): Promise<string | null> {
    return dbService.withRetry(async () => {
      const key = getMapStateKey(characterId);
      const state = await gameDb.runtime_mapState.get(key) as unknown as MapStateStorage | undefined;
      if (!state) return null;
      return state.currentTab || null;
    });
  }
}

/**
 * 地图数据层实例
 */
export const mapDbService = new MapDbService();
