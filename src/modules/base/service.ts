/**
 * 基础数据管理模块纯逻辑辅助函数
 *
 * 提供数据格式转换、过滤筛选等纯函数，不含状态和 DB 调用
 */

import type { RaceData, ClassData, RaceType, FactionType } from '@/modules/character/types';

/**
 * 将数组转为以 id 为键的 Record
 */
export function arrayToRecord<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map(item => [item.id, item]));
}

/**
 * 根据阵营筛选种族（纯函数）
 */
export function filterRacesByFaction(races: RaceData[], factionId: FactionType): RaceData[] {
  return races.filter(race => race.factionId === factionId);
}

/**
 * 根据种族筛选职业（纯函数）
 */
export function filterClassesByRace(classes: ClassData[], raceId: RaceType): ClassData[] {
  return classes.filter(cls => cls.raceIds.includes(raceId));
}

/**
 * 根据阵营筛选职业（纯函数）
 */
export function filterClassesByFaction(classes: ClassData[], factionId: FactionType): ClassData[] {
  return classes.filter(cls => cls.factionsIds.includes(factionId));
}

// generateId 在 utils/db-helpers 中实现，base/service 重新导出供外部测试使用
export { generateId } from '../../utils/db-helpers';
