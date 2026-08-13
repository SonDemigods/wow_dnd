/**
 * 基础数据管理模块类型定义
 * 
 * 包含阵营、种族、职业等基础数据的类型定义和操作接口
 */

import type { Stats, FactionType, RaceType } from '@/modules/character/types';

/**
 * 阵营创建/更新数据接口
 */
export interface FactionCreateUpdateData {
  name: string;
  icon: string;
  color: string;
  description: string;
}

/**
 * 种族创建/更新数据接口
 */
export interface RaceCreateUpdateData {
  name: string;
  icon: string;
  factionId: FactionType;
  bonus?: Partial<Stats>;
  description: string;
}

/**
 * 职业创建/更新数据接口
 */
export interface ClassCreateUpdateData {
  name: string;
  icon: string;
  primaryStat: keyof Stats;
  factionsIds: FactionType[];
  raceIds: RaceType[];
  description: string;
  color: string;
  bonus?: Partial<Stats>;
}
