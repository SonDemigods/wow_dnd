/**
 * 地图模块状态管理层
 * 
 * 使用 Pinia 管理地图状态，提供响应式数据和事件监听
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { MapState, LocationData, LocationMarker } from './types';
import { mapService } from './service';
import { eventBus, GameEvents } from '../bus/core';

/**
 * 地图状态存储
 */
export const useMapStore = defineStore('map', () => {
  /** 当前地图状态 */
  const state = ref<MapState>({
    view: {
      zoomLevel: 1,
      panX: 0,
      panY: 0,
      showMarkers: true
    }
  });
  
  /** 当前选中的地点 */
  const currentLocation = ref<LocationData | null>(null);
  
  /** 当前大陆的地点标记 */
  const markers = ref<LocationMarker[]>([]);
  
  /**
   * 获取当前视图状态
   */
  const getView = computed(() => state.value.view);
  
  /**
   * 获取当前选中的地点
   */
  const getCurrentLocation = computed(() => currentLocation.value);
  
  /**
   * 获取当前大陆的标记
   */
  const getMarkers = computed(() => markers.value);
  
  /**
   * 更新地图状态
   */
  function updateState(): void {
    state.value = mapService.getState();
  }
  
  /**
   * 获取地点数据
   * @param locationId - 地点ID
   * @returns 地点数据
   */
  function getLocationData(locationId: string): LocationData | null {
    return mapService.getLocationData(locationId);
  }
  
  /**
   * 获取大陆下的地点
   * @param continentId - 大陆ID
   * @returns 地点列表
   */
  function getLocationsByContinent(continentId: string): LocationData[] {
    return mapService.getLocationsByContinent(continentId);
  }
  
  /**
   * 获取地点标记
   * @param continentId - 大陆ID
   * @returns 标记列表
   */
  function getLocationMarkers(continentId: string): LocationMarker[] {
    return mapService.getLocationMarkers(continentId);
  }
  
  /**
   * 检查地点是否解锁
   * @param locationId - 地点ID
   * @param playerLevel - 玩家等级
   * @returns 是否解锁
   */
  function isLocationUnlocked(locationId: string, playerLevel: number): boolean {
    return mapService.isLocationUnlocked(locationId, playerLevel);
  }
  
  /**
   * 进入地点
   * @param locationId - 地点ID
   * @returns 是否成功进入
   */
  function enterLocation(locationId: string): boolean {
    const success = mapService.enterLocation(locationId);
    if (success) {
      currentLocation.value = mapService.getLocationData(locationId);
    }
    return success;
  }
  
  /**
   * 缩放到指定级别
   * @param level - 缩放级别
   */
  function zoomTo(level: number): void {
    mapService.zoomTo(level);
    updateState();
  }
  
  /**
   * 平移到指定位置
   * @param x - X坐标
   * @param y - Y坐标
   */
  function panTo(x: number, y: number): void {
    mapService.panTo(x, y);
    updateState();
  }
  
  /**
   * 重置视图
   */
  function resetView(): void {
    mapService.resetView();
    updateState();
  }
  
  /**
   * 设置当前大陆
   * @param continentId - 大陆ID
   */
  function setCurrentContinent(continentId: string): void {
    mapService.setCurrentContinent(continentId);
    markers.value = mapService.getLocationMarkers(continentId);
    updateState();
  }
  
  /**
   * 设置激活的标记
   * @param markerId - 标记ID
   */
  function setActiveMarker(markerId: string | undefined): void {
    mapService.setActiveMarker(markerId);
    updateState();
  }
  
  /**
   * 切换标记显示
   */
  function toggleMarkers(): void {
    mapService.toggleMarkers();
    updateState();
  }
  
  /**
   * 初始化事件监听
   */
  function initEventListeners(): void {
    // 地点进入事件
    eventBus.onGroup('mapStore', GameEvents.ZONE_ENTERED, (data: { locationId: string; location: LocationData }) => {
      currentLocation.value = data.location;
    });
  }

  /**
   * 清理事件监听
   */
  function dispose(): void {
    eventBus.clearGroup('mapStore');
  }
  
  /**
   * 初始化
   */
  async function init(): Promise<void> {
    await mapService.init();
    updateState();
    initEventListeners();
    
    // 默认加载东部王国的标记
    markers.value = mapService.getLocationMarkers('azeroth');
  }
  
  /**
   * 重置
   */
  function reset(): void {
    mapService.reset();
    currentLocation.value = null;
    markers.value = [];
    updateState();
  }
  
  return {
    // 状态
    state,
    currentLocation,
    markers,
    
    // 计算属性
    getView,
    getCurrentLocation,
    getMarkers,
    
    // 方法
    updateState,
    getLocationData,
    getLocationsByContinent,
    getLocationMarkers,
    isLocationUnlocked,
    enterLocation,
    zoomTo,
    panTo,
    resetView,
    setCurrentContinent,
    setActiveMarker,
    toggleMarkers,
    init,
    reset,
    dispose
  };
});