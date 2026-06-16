/**
 * 地图模块纯逻辑函数
 *
 * 提供地点查询、解锁检查、区域状态判定等纯函数，不含状态和副作用
 */
import type { LocationData, MapState, ZoneStatus } from './types';

/**
 * 根据 ID 从地点集合中查找地点
 * @param locations - 地点数据映射表
 * @param id - 地点 ID
 * @returns 地点数据，不存在返回 undefined
 */
export function getLocationById(
  locations: Map<string, LocationData>,
  id: string
): LocationData | undefined {
  return locations.get(id);
}

/**
 * 根据当前状态和地点集合获取当前选中地点
 * @param locations - 地点数据映射表
 * @param currentLocationId - 当前选中的地点 ID
 * @returns 地点数据，不存在返回 undefined
 */
export function getCurrentLocation(
  locations: Map<string, LocationData>,
  currentLocationId: string | null
): LocationData | undefined {
  if (!currentLocationId) return undefined;
  return locations.get(currentLocationId);
}

/**
 * 检查地点是否对指定等级角色可访问
 * @param location - 地点数据
 * @param characterLevel - 角色等级
 * @returns 是否可访问（等级 >= 最低要求等级）
 */
export function isLocationAccessible(location: LocationData, characterLevel: number): boolean {
  const [minLevel] = location.levelRange;
  return characterLevel >= minLevel;
}

/**
 * 检查指定区域是否已被探索
 * @param state - 地图状态
 * @param zoneId - 区域 ID
 * @returns 是否已探索（暂基于 unlockedZones 字段）
 */
export function isZoneExplored(state: MapState & { unlockedZones?: string[] }, zoneId: string): boolean {
  return state.unlockedZones?.includes(zoneId) ?? false;
}

/**
 * 获取区域状态
 * @param state - 地图状态（含探索完成记录）
 * @param zoneId - 区域 ID
 * @param location - 区域对应的地点数据
 * @param characterLevel - 角色等级
 * @returns 区域状态：locked | unlocked | completed
 */
export function getZoneStatus(
  state: MapState & { unlockedZones?: string[]; completedZones?: string[] },
  zoneId: string,
  location: LocationData | undefined,
  characterLevel: number
): ZoneStatus {
  if (state.completedZones?.includes(zoneId)) return 'completed';
  if (location && isLocationAccessible(location, characterLevel)) return 'unlocked';
  return 'locked';
}

/**
 * 获取指定大陆下的所有地点
 * @param locations - 地点数据映射表
 * @param continentId - 大陆 ID
 * @returns 该大陆下的地点列表
 */
export function getLocationsByContinent(
  locations: Map<string, LocationData>,
  continentId: string
): LocationData[] {
  const result: LocationData[] = [];
  locations.forEach(location => {
    if (location.continent === continentId) {
      result.push(location);
    }
  });
  return result;
}
