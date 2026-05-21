/**
 * @fileoverview 地图模块类型定义
 * @description 包含大陆数据、地点数据、地图瓦片、地图视图等相关类型定义
 */

/**
 * 地点数据接口
 * @property {string} name - 地点名称
 * @property {string} displayName - 显示名称
 * @property {string} icon - 地点图标
 * @property {string} description - 地点描述
 * @property {string} continent - 所属大陆
 * @property {string} region - 所属区域
 * @property {string[]} enemies - 敌人列表
 * @property {[number, number]} levelRange - 等级范围
 * @property {string} color - 主色调
 * @property {number} mapX - 地图X坐标
 * @property {number} mapY - 地图Y坐标
 */
export interface LocationData {
  /** 地点名称 */
  name: string
  /** 显示名称 */
  displayName: string
  /** 地点图标 */
  icon: string
  /** 地点描述 */
  description: string
  /** 所属大陆 */
  continent: string
  /** 所属区域 */
  region: string
  /** 敌人列表 */
  enemies: string[]
  /** 等级范围 */
  levelRange: [number, number]
  /** 主色调 */
  color: string
  /** 地图X坐标 */
  mapX: number
  /** 地图Y坐标 */
  mapY: number
}

/**
 * 地点接口（运行时使用）
 * @property {string} id - 地点ID
 * @property {string} name - 地点名称
 * @property {string} description - 地点描述
 * @property {string} icon - 地点图标
 * @property {string[]} enemies - 敌人列表
 * @property {string[]} quests - 任务列表
 * @property {number} mapSize - 地图尺寸
 */
export interface Location {
  /** 地点ID */
  id: string
  /** 地点名称 */
  name: string
  /** 地点描述 */
  description: string
  /** 地点图标 */
  icon: string
  /** 敌人列表 */
  enemies: string[]
  /** 任务列表 */
  quests: string[]
  /** 地图尺寸 */
  mapSize: number
}

/**
 * 地点标记接口
 * @property {string} id - 标记ID
 * @property {number} x - X坐标
 * @property {number} y - Y坐标
 * @property {string} icon - 图标
 * @property {string} name - 名称
 * @property {string} locationId - 关联地点ID
 * @property {number} requiredLevel - 等级要求
 * @property {'normal' | 'heroic' | 'mythic'} [difficulty] - 难度
 * @property {string} [parentMarkerId] - 父标记ID
 */
export interface LocationMarker {
  /** 标记ID */
  id: string
  /** X坐标 */
  x: number
  /** Y坐标 */
  y: number
  /** 图标 */
  icon: string
  /** 名称 */
  name: string
  /** 关联地点ID */
  locationId: string
  /** 等级要求 */
  requiredLevel: number
  /** 难度 */
  difficulty?: 'normal' | 'heroic' | 'mythic'
  /** 父标记ID */
  parentMarkerId?: string
}

/**
 * 地图视图接口
 * @property {number} zoomLevel - 缩放级别
 * @property {number} panX - X平移量
 * @property {number} panY - Y平移量
 * @property {string} [currentContinentId] - 当前大陆ID
 * @property {boolean} showMarkers - 是否显示标记
 * @property {string} [activeMarkerId] - 当前激活的标记ID
 */
export interface MapView {
  /** 缩放级别 */
  zoomLevel: number
  /** X平移量 */
  panX: number
  /** Y平移量 */
  panY: number
  /** 当前大陆ID */
  currentContinentId?: string
  /** 是否显示标记 */
  showMarkers: boolean
  /** 当前激活的标记ID */
  activeMarkerId?: string
}

/**
 * 地图状态接口
 * @property {MapView} view - 地图视图
 */
export interface MapState {
  /** 地图视图 */
  view: MapView
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
  getState(): MapState

  /**
   * 获取地点数据
   * @param {string} locationId - 地点ID
   * @returns {LocationData | null} 地点数据
   */
  getLocationData(locationId: string): LocationData | null

  /**
   * 获取大陆下的地点
   * @param {string} continentId - 大陆ID
   * @returns {LocationData[]} 地点列表
   */
  getLocationsByContinent(continentId: string): LocationData[]

  /**
   * 获取地点标记
   * @param {string} continentId - 大陆ID
   * @returns {LocationMarker[]} 标记列表
   */
  getLocationMarkers(continentId: string): LocationMarker[]

  /**
   * 获取已解锁的地点
   * @param {number} playerLevel - 玩家等级
   * @returns {string[]} 地点ID列表
   */
  getUnlockedLocations(playerLevel: number): string[]

  /**
   * 检查地点是否解锁
   * @param {string} locationId - 地点ID
   * @param {number} playerLevel - 玩家等级
   * @returns {boolean} 是否解锁
   */
  isLocationUnlocked(locationId: string, playerLevel: number): boolean

  /**
   * 进入地点
   * @param {string} locationId - 地点ID
   * @returns {boolean} 是否成功进入
   */
  enterLocation(locationId: string): boolean

  /**
   * 缩放到指定级别
   * @param {number} level - 缩放级别
   */
  zoomTo(level: number): void

  /**
   * 平移到指定位置
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   */
  panTo(x: number, y: number): void

  /** 重置视图 */
  resetView(): void

  /** 重置地图数据 */
  reset(): void
}