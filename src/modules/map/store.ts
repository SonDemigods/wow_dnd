/**
 * 地图模块状态管理层
 * 
 * 使用 Pinia 管理地图状态，提供响应式数据和事件监听。
 * 角色切换时自动加载对应角色的地图数据，不删除其他角色的数据。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { MapState, LocationData } from './types';
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
      panY: 0
    }
  });
  
  /** 当前选中的地点 */
  const currentLocation = ref<LocationData | null>(null);
  
  /** 当前角色ID */
  let currentCharacterId: string | null = null;

  /**
   * 获取当前视图状态
   */
  const getView = computed(() => state.value.view);
  
  /**
   * 获取当前选中的地点
   */
  const getCurrentLocation = computed(() => currentLocation.value);
  
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
    updateState();
  }
  
  /**
   * 跨模块事件监听（每次调用前会先清理旧监听器，防止重复注册）
   */
  function setupCrossModuleListeners(): void {
    // 先清理旧监听器，防止重复注册
    eventBus.clearGroup('mapStore');

    // 地点进入事件（由其他模块触发）
    eventBus.onGroup('mapStore', GameEvents.ZONE_ENTERED, (data: { locationId: string; location: LocationData }) => {
      currentLocation.value = data.location;
    });

    // 角色选中时重新加载对应角色的地图数据
    eventBus.onGroup('mapStore', GameEvents.CHARACTER_SELECTED, (data: { characterId: string }) => {
      if (data?.characterId) {
        loadCharacterMap(data.characterId);
      }
    });

    // 角色登出时只清除UI状态，不删除数据库数据
    eventBus.onGroup('mapStore', GameEvents.CHARACTER_LOGOUT, () => {
      clearUIState();
    });
  }

  /**
   * 清除UI状态（不删除数据库数据）
   */
  function clearUIState(): void {
    state.value = {
      view: {
        zoomLevel: 1,
        panX: 0,
        panY: 0
      }
    };
    currentLocation.value = null;
  }

  /**
   * 加载指定角色的地图数据
   * @param characterId - 角色ID
   */
  async function loadCharacterMap(characterId: string): Promise<void> {
    currentCharacterId = characterId;
    await mapService.init(characterId);
    updateState();
    
    // 从数据库恢复上次选中的区域
    const savedLocationId = await mapService.getCurrentLocationId();
    if (savedLocationId) {
      const location = mapService.getLocationData(savedLocationId);
      if (location) {
        currentLocation.value = location;
      }
    }
  }

  /**
   * 清理事件监听
   */
  function dispose(): void {
    eventBus.clearGroup('mapStore');
  }
  
  /**
   * 初始化地图模块（首次挂载时调用，传入角色ID加载对应数据并注册事件监听）
   * @param characterId - 角色ID
   */
  async function init(characterId: string): Promise<void> {
    setupCrossModuleListeners();
    await loadCharacterMap(characterId);
  }
  
  return {
    // 状态
    state,
    currentLocation,
    
    // 计算属性
    getView,
    getCurrentLocation,
    
    // 方法
    updateState,
    getLocationData,
    getLocationsByContinent,
    isLocationUnlocked,
    enterLocation,
    zoomTo,
    panTo,
    resetView,
    setCurrentContinent,
    init,
    clearUIState,
    dispose
  };
});
