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
  name: string
  icon: string
  description: string
  position: string
  color: string
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
 * @property {[number, number]} levelRange - 等级范围
 * @property {string} color - 主色调
 * @property {number} mapX - 地图X坐标
 * @property {number} mapY - 地图Y坐标
 */
export interface LocationData {
  name: string
  displayName: string
  icon: string
  description: string
  continent: string
  region: string
  enemies: string[]
  levelRange: [number, number]
  color: string
  mapX: number
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
  id: string
  name: string
  description: string
  icon: string
  enemies: string[]
  quests: string[]
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
  id: string
  x: number
  y: number
  icon: string
  name: string
  locationId: string
  requiredLevel: number
  difficulty?: 'normal' | 'heroic' | 'mythic'
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
  zoomLevel: number
  panX: number
  panY: number
  currentContinentId?: string
  showMarkers: boolean
  activeMarkerId?: string
}

/**
 * 地图状态接口
 * @property {MapView} view - 地图视图
 */
export interface MapState {
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
