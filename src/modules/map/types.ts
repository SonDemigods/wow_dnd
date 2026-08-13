/**
 * @fileoverview 地图模块类型定义
 * @description 包含大陆数据、地点数据、地图瓦片、地图视图等相关类型定义
 */

/**
 * 大陆数据接口
 */
export interface ContinentData {
  id: string;
  name: string;
  icon: string;
  description: string;
  position: string;
  color: string;
  type: 'continent';
}

/**
 * 地图视图接口
 */
export interface MapView {
  zoomLevel: number;
  panX: number;
  panY: number;
  currentContinentId?: string;
}

/**
 * 地图状态接口
 */
export interface MapState {
  view: MapView;
  unlockedZones?: string[];
  completedZones?: string[];
}

/**
 * 地点数据接口
 */
export interface LocationData {
  id: string;
  name: string;
  icon: string;
  description: string;
  continent: string;
  enemies?: string[];
  bosses?: string[];
  quests?: string[];
  levelRange: [number, number];
  color: string;
  mapX: number;
  mapY: number;
  type: 'location';
}

/**
 * 区域状态类型
 */
export type ZoneStatus = 'locked' | 'unlocked' | 'completed';

/**
 * 区域奖励接口（预留，待后续从配置数据填充真实值）
 */
export interface ZoneRewards {
  gold: number;
  exp: number;
}

/**
 * 地图区域接口（用于大地图显示）
 */
export interface MapZone {
  id: string;
  name: string;
  icon: string;
  description: string;
  coordinates: { x: number; y: number };
  requiredLevel: number;
  requiredGold?: number;
  status: ZoneStatus;
  rewards?: ZoneRewards;
}

/**
 * 地图状态存储格式
 */
export interface MapStateStorage {
  id: string;
  view?: MapView;
  currentLocationId?: string;
  currentTab?: string;
  unlockedZones?: string[];
  completedZones?: string[];
}

/**
 * 地点/大陆存储格式（通过 type 字段区分）
 * 统一的地点与大陆持久化存储类型，同时供 map/db.ts 和 data/service.ts 使用
 */
export interface LocationStorage {
  id: string;
  name: string;
  icon: string;
  description: string;
  type: 'location' | 'continent';
  continent?: string;
  enemies?: string[];
  bosses?: string[];
  quests?: string[];
  levelRange?: [number, number];
  mapX?: number;
  mapY?: number;
  color?: string;
  position?: string;
}
