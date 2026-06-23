/**
 * 地图模块纯逻辑函数
 *
 * 提供地点查询、解锁检查、区域状态判定等纯函数，不含状态和副作用
 */
import type { LocationData, MapState, ZoneStatus } from './types';

/**
 * 根据 ID 从地点集合中查找地点
 */
export function getLocationById(
  locations: Map<string, LocationData>,
  id: string
): LocationData | undefined {
  return locations.get(id);
}

/**
 * 检查地点是否对指定等级角色可访问
 */
export function isLocationAccessible(location: LocationData, characterLevel: number): boolean {
  return characterLevel >= location.levelRange[0];
}

/**
 * 获取区域状态
 * 优先级：已完成 > 已手动解锁 > 等级满足自动解锁 > 锁定
 */
export function getZoneStatus(
  state: MapState,
  zoneId: string,
  location: LocationData,
  characterLevel: number
): ZoneStatus {
  if (state.completedZones?.includes(zoneId)) return 'completed';
  if (state.unlockedZones?.includes(zoneId)) return 'unlocked';
  if (isLocationAccessible(location, characterLevel)) return 'unlocked';
  return 'locked';
}

/**
 * 获取指定大陆下的所有地点
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
