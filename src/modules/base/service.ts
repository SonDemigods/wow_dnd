/**
 * 基础数据管理模块纯逻辑辅助函数
 *
 * 提供数据格式转换、ID 生成、过滤筛选等纯函数，不含状态和 DB 调用
 */

import type { FactionData, RaceData, ClassData } from '../character/types';

/**
 * 生成唯一 ID
 */
export function generateBaseId(): string {
  return `base_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 将阵营数组转为 Record（兼容旧接口）
 */
export function factionsArrayToRecord(factions: FactionData[]): Record<string, FactionData> {
  const result: Record<string, FactionData> = {};
  factions.forEach(faction => {
    result[faction.id] = faction;
  });
  return result;
}

/**
 * 将种族数组转为 Record（兼容旧接口）
 */
export function racesArrayToRecord(races: RaceData[]): Record<string, RaceData> {
  const result: Record<string, RaceData> = {};
  races.forEach(race => {
    result[race.id] = race;
  });
  return result;
}

/**
 * 将职业数组转为 Record（兼容旧接口）
 */
export function classesArrayToRecord(classes: ClassData[]): Record<string, ClassData> {
  const result: Record<string, ClassData> = {};
  classes.forEach(cls => {
    result[cls.id] = cls;
  });
  return result;
}

/**
 * 根据阵营筛选种族（纯函数）
 */
export function filterRacesByFaction(races: RaceData[], factionId: string): RaceData[] {
  return races.filter(race => race.factionId === factionId);
}

/**
 * 根据种族筛选职业（纯函数）
 */
export function filterClassesByRace(classes: ClassData[], raceId: string): ClassData[] {
  return classes.filter(cls => cls.raceIds.includes(raceId as any));
}

/**
 * 根据阵营筛选职业（纯函数）
 */
export function filterClassesByFaction(classes: ClassData[], factionId: string): ClassData[] {
  return classes.filter(cls => cls.factionsIds.includes(factionId as any));
}
