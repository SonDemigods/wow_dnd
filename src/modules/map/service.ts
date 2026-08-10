/**
 * 地图模块纯逻辑函数
 *
 * 提供地点查询、解锁检查、区域状态判定、数据转换、工具函数等纯函数，不含状态和副作用
 */
import type { LocationData, MapState, ZoneStatus, LocationStorage } from './types';

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
 *
 * P4-020 说明：unlockedZones/completedZones 当前为预留字段（无 Action 写入），
 * 实际区域解锁完全由 isLocationAccessible（等级检查）决定。
 * 保留字段供未来实现"手动解锁/区域完成追踪"功能。
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

/**
 * 根据角色ID生成地图状态存储键
 */
export function getMapStateKey(characterId: string): string {
  return `map_${characterId}`;
}

/**
 * 将存储格式转换为 LocationData 业务类型
 */
export function mapToLocationData(storage: LocationStorage): LocationData {
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

/** 数值钳制到 [min, max] 区间 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
