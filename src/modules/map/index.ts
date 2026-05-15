/**
 * @fileoverview 地图模块实现
 * @description 地图显示、导航、定位和标记管理
 * @module modules/map/index
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { eventBus, GameEvents } from '../../services/eventBus'
import { configManager } from '../../services/configManager'
import { CONTINENTS, WORLD_LOCATIONS } from '../../data'
import type { LocationData, ContinentData } from '../../types'
import type {
  MapState,
  MapMode,
  MapMarker,
  MapMarkerType,
  LocationHistory,
  MapView,
  IMapService
} from './types'

/**
 * 默认地图视图配置
 */
const DEFAULT_MAP_VIEW: MapView = {
  mode: 'world',
  zoomLevel: 1,
  panX: 0,
  panY: 0,
  currentLocationId: undefined,
  currentContinentId: undefined,
  showMarkers: true,
  showExploredOnly: false,
  activeMarkerId: undefined
}

/**
 * 地图状态管理
 */
export const useMapStore = defineStore('map', () => {
  // 状态
  const state = ref<MapState>({
    view: { ...DEFAULT_MAP_VIEW },
    history: [],
    favoriteLocations: [],
    recentLocations: [],
    customMarkers: []
  })

  // 计算属性
  const currentMode = computed(() => state.value.view.mode)
  const currentZoom = computed(() => state.value.view.zoomLevel)
  const currentContinent = computed(() => {
    if (!state.value.view.currentContinentId) return null
    return CONTINENTS[state.value.view.currentContinentId] || null
  })
  const currentLocation = computed(() => {
    if (!state.value.view.currentLocationId) return null
    return WORLD_LOCATIONS[state.value.view.currentLocationId] || null
  })
  const isFavorite = computed(() => (id: string) => 
    state.value.favoriteLocations.includes(id)
  )

  // ==================== 公共方法 ====================

  /**
   * 获取当前状态
   */
  const getState = (): MapState => {
    return JSON.parse(JSON.stringify(state.value))
  }

  /**
   * 获取大陆数据
   */
  const getContinentData = (continentId: string): ContinentData | null => {
    return CONTINENTS[continentId] || null
  }

  /**
   * 获取地点数据
   */
  const getLocationData = (locationId: string): LocationData | null => {
    return WORLD_LOCATIONS[locationId] || null
  }

  /**
   * 获取所有大陆
   */
  const getAllContinents = (): ContinentData[] => {
    return Object.values(CONTINENTS)
  }

  /**
   * 获取某大陆的所有地点
   */
  const getLocationsByContinent = (continentId: string): LocationData[] => {
    return Object.values(WORLD_LOCATIONS).filter(
      location => location.continent === continentId
    )
  }

  /**
   * 获取地点的标记
   */
  const getMarkersForLocation = (locationId: string): MapMarker[] => {
    const location = WORLD_LOCATIONS[locationId]
    if (!location) return []

    const markers: MapMarker[] = []

    // 添加地点主标记
    markers.push({
      id: `location-${locationId}`,
      type: 'custom',
      x: location.mapX,
      y: location.mapY,
      icon: location.icon,
      title: location.displayName,
      description: location.description,
      interactive: true,
      priority: 10,
      faction: location.faction
    })

    // TODO: 添加该地点的任务标记
    // TODO: 添加该地点的敌人标记
    // TODO: 添加NPC标记

    // 添加自定义标记
    const customMarkers = state.value.customMarkers.filter(
      marker => marker.data?.locationId === locationId
    )
    markers.push(...customMarkers)

    return markers
  }

  /**
   * 导航到指定地点
   */
  const navigateTo = (locationId: string): boolean => {
    const location = WORLD_LOCATIONS[locationId]
    if (!location) return false

    // 更新当前视图
    state.value.view.currentLocationId = locationId
    state.value.view.currentContinentId = location.continent
    state.value.view.mode = 'zone'

    // 添加到历史记录
    addToHistory(location)

    // 发送事件
    eventBus.emit('map:locationChanged', {
      locationId,
      location
    })

    return true
  }

  /**
   * 添加收藏
   */
  const addFavorite = (locationId: string): void => {
    if (!state.value.favoriteLocations.includes(locationId)) {
      state.value.favoriteLocations.push(locationId)
      eventBus.emit('map:favoritesChanged', {
        favorites: [...state.value.favoriteLocations]
      })
    }
  }

  /**
   * 移除收藏
   */
  const removeFavorite = (locationId: string): void => {
    const index = state.value.favoriteLocations.indexOf(locationId)
    if (index > -1) {
      state.value.favoriteLocations.splice(index, 1)
      eventBus.emit('map:favoritesChanged', {
        favorites: [...state.value.favoriteLocations]
      })
    }
  }

  /**
   * 添加自定义标记
   */
  const addCustomMarker = (marker: MapMarker): void => {
    state.value.customMarkers.push(marker)
    eventBus.emit('map:markersUpdated', {
      markers: [...state.value.customMarkers]
    })
  }

  /**
   * 移除自定义标记
   */
  const removeCustomMarker = (markerId: string): void => {
    state.value.customMarkers = state.value.customMarkers.filter(
      marker => marker.id !== markerId
    )
    eventBus.emit('map:markersUpdated', {
      markers: [...state.value.customMarkers]
    })
  }

  /**
   * 设置地图模式
   */
  const setMapMode = (mode: MapMode): void => {
    state.value.view.mode = mode
    eventBus.emit('map:modeChanged', { mode })
  }

  /**
   * 缩放
   */
  const zoomTo = (level: number): void => {
    const clampedLevel = Math.max(0.5, Math.min(3, level))
    state.value.view.zoomLevel = clampedLevel
  }

  /**
   * 平移
   */
  const panTo = (x: number, y: number): void => {
    state.value.view.panX = x
    state.value.view.panY = y
  }

  /**
   * 重置视图
   */
  const resetView = (): void => {
    state.value.view = { ...DEFAULT_MAP_VIEW }
  }

  /**
   * 清除历史记录
   */
  const clearHistory = (): void => {
    state.value.history = []
  }

  // ==================== 私有方法 ====================

  /**
   * 添加到历史记录
   */
  const addToHistory = (location: LocationData): void => {
    const historyEntry: LocationHistory = {
      id: location.name,
      name: location.displayName,
      continent: location.continent,
      visitedAt: Date.now()
    }

    // 添加到历史
    state.value.history.unshift(historyEntry)

    // 限制历史记录数量
    if (state.value.history.length > 50) {
      state.value.history.pop()
    }

    // 添加到最近访问
    addToRecent(location.name)
  }

  /**
   * 添加到最近访问
   */
  const addToRecent = (locationId: string): void => {
    // 移除已存在的
    const index = state.value.recentLocations.indexOf(locationId)
    if (index > -1) {
      state.value.recentLocations.splice(index, 1)
    }

    // 添加到最前面
    state.value.recentLocations.unshift(locationId)

    // 限制数量
    if (state.value.recentLocations.length > 10) {
      state.value.recentLocations.pop()
    }
  }

  // ==================== 导出 ====================

  return {
    state,
    currentMode,
    currentZoom,
    currentContinent,
    currentLocation,
    isFavorite,
    getState,
    getContinentData,
    getLocationData,
    getAllContinents,
    getLocationsByContinent,
    getMarkersForLocation,
    navigateTo,
    addFavorite,
    removeFavorite,
    addCustomMarker,
    removeCustomMarker,
    setMapMode,
    zoomTo,
    panTo,
    resetView,
    clearHistory
  }
})

/**
 * 地图服务实现
 */
export const mapService: IMapService = {
  getState: () => useMapStore().getState(),
  getContinentData: (id) => useMapStore().getContinentData(id),
  getLocationData: (id) => useMapStore().getLocationData(id),
  getAllContinents: () => useMapStore().getAllContinents(),
  getLocationsByContinent: (id) => useMapStore().getLocationsByContinent(id),
  getMarkersForLocation: (id) => useMapStore().getMarkersForLocation(id),
  navigateTo: (id) => useMapStore().navigateTo(id),
  addFavorite: (id) => useMapStore().addFavorite(id),
  removeFavorite: (id) => useMapStore().removeFavorite(id),
  addCustomMarker: (marker) => useMapStore().addCustomMarker(marker),
  removeCustomMarker: (id) => useMapStore().removeCustomMarker(id),
  setMapMode: (mode) => useMapStore().setMapMode(mode),
  zoomTo: (level) => useMapStore().zoomTo(level),
  panTo: (x, y) => useMapStore().panTo(x, y),
  resetView: () => useMapStore().resetView(),
  clearHistory: () => useMapStore().clearHistory()
}
