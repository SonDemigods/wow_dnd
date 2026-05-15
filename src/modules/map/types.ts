/**
 * @fileoverview 地图模块类型定义
 * @description 地图系统、导航和位置管理的类型
 * @module modules/map/types
 */

import { LocationData, ContinentData } from '../../types'

/**
 * 地图模式
 */
export type MapMode = 'world' | 'continent' | 'zone' | 'minimap'

/**
 * 地图标记类型
 */
export type MapMarkerType = 
  | 'player'       // 玩家位置
  | 'npc'          // NPC
  | 'enemy'        // 敌人/怪点
  | 'quest'        // 任务点
  | 'vendor'       // 商人
  | 'inn'          // 旅店
  | 'portal'       // 传送门
  | 'flight'       // 飞行点
  | 'dungeon'      // 副本
  | 'raid'         // 团队副本
  | 'exploration'  // 探索点
  | 'custom'       // 自定义标记

/**
 * 地图标记数据
 */
export interface MapMarker {
  id: string
  type: MapMarkerType
  x: number
  y: number
  icon: string
  title: string
  description?: string
  interactive: boolean
  priority: number
  faction?: 'alliance' | 'horde' | 'neutral'
  requiredLevel?: number
  questId?: string
  npcId?: string
  data?: any
}

/**
 * 地图视图状态
 */
export interface MapView {
  mode: MapMode
  zoomLevel: number
  panX: number
  panY: number
  currentLocationId?: string
  currentContinentId?: string
  showMarkers: boolean
  showExploredOnly: boolean
  activeMarkerId?: string
}

/**
 * 地点导航记录
 */
export interface LocationHistory {
  id: string
  name: string
  continent: string
  visitedAt: number
}

/**
 * 地图模块状态
 */
export interface MapState {
  view: MapView
  history: LocationHistory[]
  favoriteLocations: string[]
  recentLocations: string[]
  customMarkers: MapMarker[]
}

/**
 * 地图服务接口
 */
export interface IMapService {
  getState(): MapState
  getContinentData(continentId: string): ContinentData | null
  getLocationData(locationId: string): LocationData | null
  getAllContinents(): ContinentData[]
  getLocationsByContinent(continentId: string): LocationData[]
  getMarkersForLocation(locationId: string): MapMarker[]
  navigateTo(locationId: string): boolean
  addFavorite(locationId: string): void
  removeFavorite(locationId: string): void
  addCustomMarker(marker: MapMarker): void
  removeCustomMarker(markerId: string): void
  setMapMode(mode: MapMode): void
  zoomTo(level: number): void
  panTo(x: number, y: number): void
  resetView(): void
  clearHistory(): void
}
