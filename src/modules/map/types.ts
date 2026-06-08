/**
 * @fileoverview 地图模块类型定义
 * @description 包含大陆数据、地点数据、地图瓦片、地图视图等相关类型定义
 */

/**
 * 大陆数据接口
 * @property {string} name - 大陆名称
 * @property {string} icon - 大陆图标
 * @property {string} description - 大陆描述
 * @property {string} position - 大陆位置
 * @property {string} color - 主色调
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
 * @property {number} zoomLevel - 缩放级别
 * @property {number} panX - X平移量
 * @property {number} panY - Y平移量
 * @property {string} [currentContinentId] - 当前大陆ID
 */
export interface MapView {
  zoomLevel: number;
  panX: number;
  panY: number;
  currentContinentId?: string;
}

/**
 * 地图状态接口
 * @property {MapView} view - 地图视图
 */
export interface MapState {
  view: MapView;
}

/**
 * 地点数据接口
 * @property {string} name - 地点名称
 * @property {string} displayName - 显示名称
 * @property {string} icon - 地点图标
 * @property {string} description - 地点描述
 * @property {string} continent - 所属大陆
 * @property {string} region - 所属区域
 * @property {string[]} enemies - 敌人列表
 * @property {string[]} quests - 任务列表
 * @property {[number, number]} levelRange - 等级范围
 * @property {string} color - 主色调
 * @property {number} mapX - 地图X坐标
 * @property {number} mapY - 地图Y坐标
 */
export interface LocationData {
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
  type: 'location';
}

/**
 * 区域状态类型
 */
export type ZoneStatus = 'locked' | 'unlocked' | 'completed';

/**
 * 区域奖励接口
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
  requiredGold: number;
  status: ZoneStatus;
  rewards: ZoneRewards;
}

/**
 * 地图服务接口
 * 提供地图管理的核心功能
 */
export interface IMapService {
  /**
   * 获取地图状态
   * @returns {MapState} 地图状态
   */
  getState(): MapState;

  /**
   * 获取地点数据
   * @param {string} locationId - 地点ID
   * @returns {LocationData | null} 地点数据
   */
  getLocationData(locationId: string): LocationData | null;

  /**
   * 获取大陆下的地点
   * @param {string} continentId - 大陆ID
   * @returns {LocationData[]} 地点列表
   */
  getLocationsByContinent(continentId: string): LocationData[];

  /**
   * 获取已解锁的地点
   * @param {number} playerLevel - 玩家等级
   * @returns {string[]} 地点ID列表
   */
  getUnlockedLocations(playerLevel: number): string[];

  /**
   * 检查地点是否解锁
   * @param {string} locationId - 地点ID
   * @param {number} playerLevel - 玩家等级
   * @returns {boolean} 是否解锁
   */
  isLocationUnlocked(locationId: string, playerLevel: number): boolean;

  /**
   * 进入地点
   * @param {string} locationId - 地点ID
   * @returns {boolean} 是否成功进入
   */
  enterLocation(locationId: string): boolean;

  /**
   * 缩放到指定级别
   * @param {number} level - 缩放级别
   */
  zoomTo(level: number): void;

  /**
   * 平移到指定位置
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   */
  panTo(x: number, y: number): void;

  /** 重置视图 */
  resetView(): void;

  /** 重置地图数据 */
  reset(): void;
}
