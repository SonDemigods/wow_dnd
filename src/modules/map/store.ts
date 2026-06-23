/**
 * 地图模块状态管理层（Store 核心架构）
 *
 * Store 是地图数据的唯一持有者，Action 负责编排：
 *   调纯函数 → 更新 Store 状态 → 调 DB 持久化 → emit 事件通知 UI
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { MapState, LocationData, MapZone } from './types';
import { getLocationById, isLocationAccessible, getLocationsByContinent, getZoneStatus } from './service';
import { mapDbService } from './db';
import { eventBus, GameEvents } from '../bus/core';

/** 缩放边界常量 */
const ZOOM_MIN = 1;
const ZOOM_MAX = 5;

/** 平移边界常量 */
const PAN_MIN = -50;
const PAN_MAX = 50;

/** 默认地图视图 */
const DEFAULT_MAP_VIEW = {
  zoomLevel: 1,
  panX: 0,
  panY: 0
};

/** 数值钳制到 [min, max] 区间 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 地图状态存储
 */
export const useMapStore = defineStore('map', () => {
  // ==================== 状态 ====================
  /** 当前地图状态 */
  const state = ref<MapState>({
    view: { ...DEFAULT_MAP_VIEW }
  });

  /** 地点数据缓存（全局共享，所有角色共用） */
  const locations = ref<Map<string, LocationData>>(new Map());

  /** 当前角色 ID */
  const currentCharacterId = ref<string | null>(null);

  /** 当前选中的地点 */
  const currentLocation = ref<LocationData | null>(null);

  /** 模块是否已完成初始化 */
  const initialized = ref(false);

  // ==================== 计算属性 ====================
  const getView = computed(() => state.value.view);
  const getCurrentLocation = computed(() => currentLocation.value);

  // ==================== 持久化 ====================
  /** 安全保存地图状态，捕获并记录错误，避免影响到调用方 */
  async function safeSaveState(): Promise<void> {
    if (!currentCharacterId.value) return;
    try {
      await mapDbService.saveMapState(currentCharacterId.value, state.value);
    } catch (err) {
      console.error('[map] 保存地图状态失败:', err);
    }
  }

  // ==================== 地点数据加载 ====================
  /** 从数据库加载地点数据（全局共享） */
  async function loadLocations(): Promise<void> {
    const locationList = await mapDbService.getAllLocationData();
    const map = new Map<string, LocationData>();
    locationList.forEach(location => {
      if (location.mapX != null && location.mapY != null) {
        map.set(location.id, location);
      } else {
        console.warn(`[map] 地点 "${location.name}" (${location.id}) 缺少坐标数据，已跳过`);
      }
    });
    locations.value = map;
  }

  // ==================== 动作 ====================

  /**
   * 初始化地图模块 —— 加载地图状态和地点数据
   */
  async function initialize(characterId: string): Promise<void> {
    currentCharacterId.value = characterId;

    // 加载地图状态
    const savedState = await mapDbService.getMapState(characterId);
    if (savedState?.view) {
      state.value = {
        view: savedState.view,
        unlockedZones: savedState.unlockedZones ?? [],
        completedZones: savedState.completedZones ?? []
      };
    } else {
      state.value = { view: { ...DEFAULT_MAP_VIEW } };
    }

    // 加载地点数据
    await loadLocations();

    // 从数据库恢复上次选中的区域
    const savedLocationId = await mapDbService.getCurrentLocationId(characterId);
    if (savedLocationId) {
      const location = getLocationById(locations.value, savedLocationId);
      if (location) {
        currentLocation.value = location;
      }
    }

    initialized.value = true;
  }

  /** 获取地图状态（深拷贝，防止外部修改污染 Store） */
  function getState(): MapState {
    return {
      view: { ...state.value.view },
      unlockedZones: state.value.unlockedZones ? [...state.value.unlockedZones] : undefined,
      completedZones: state.value.completedZones ? [...state.value.completedZones] : undefined
    };
  }

  /** 获取地点数据 */
  function getLocationData(locationId: string): LocationData | undefined {
    return getLocationById(locations.value, locationId);
  }

  /**
   * 获取所有区域（转换为 MapZone 格式，用于大地图 UI 展示）
   */
  function getZones(playerLevel: number): MapZone[] {
    const result: MapZone[] = [];

    locations.value.forEach(location => {
      const status = getZoneStatus(state.value, location.id, location, playerLevel);
      result.push({
        id: location.id,
        name: location.name,
        icon: location.icon,
        description: location.description,
        coordinates: { x: location.mapX, y: location.mapY },
        requiredLevel: location.levelRange[0],
        status
      });
    });

    return result;
  }

  /** 检查地点是否解锁 */
  function isLocationUnlocked(locationId: string, playerLevel: number): boolean {
    const location = getLocationById(locations.value, locationId);
    if (!location) return false;
    return isLocationAccessible(location, playerLevel);
  }

  /**
   * 进入区域
   */
  function enterZone(zoneId: string): boolean {
    const location = getLocationById(locations.value, zoneId);
    if (!location) return false;

    currentLocation.value = location;

    // 持久化当前区域 ID（fire and forget，捕获错误避免影响调用方）
    if (currentCharacterId.value) {
      mapDbService.saveCurrentLocationId(currentCharacterId.value, zoneId)
        .catch(err => console.error('[map] 保存当前区域失败:', err));
    }

    eventBus.emit(GameEvents.ZONE_ENTERED, { locationId: zoneId, location });
    return true;
  }

  /** 缩放到指定级别 */
  function zoomTo(level: number): void {
    state.value.view.zoomLevel = clamp(level, ZOOM_MIN, ZOOM_MAX);
    safeSaveState();
  }

  /** 平移到指定位置 */
  function panTo(x: number, y: number): void {
    state.value.view.panX = clamp(x, PAN_MIN, PAN_MAX);
    state.value.view.panY = clamp(y, PAN_MIN, PAN_MAX);
    safeSaveState();
  }

  /** 重置视图 */
  function resetView(): void {
    state.value.view = { ...DEFAULT_MAP_VIEW };
    safeSaveState();
  }

  /** 设置当前大陆 */
  function setCurrentContinent(continentId: string): void {
    state.value.view.currentContinentId = continentId;
    safeSaveState();
  }

  /** 保存当前标签页（按角色隔离持久化） */
  async function saveCurrentTab(tab: string): Promise<void> {
    if (currentCharacterId.value) {
      await mapDbService.saveCurrentTab(currentCharacterId.value, tab);
    }
  }

  /** 获取当前标签页（按角色隔离读取） */
  async function getCurrentTab(): Promise<string | null> {
    if (currentCharacterId.value) {
      return mapDbService.getCurrentTab(currentCharacterId.value);
    }
    return null;
  }

  /** 获取指定大陆下的所有地点 */
  function getContinentLocations(continentId: string): LocationData[] {
    return getLocationsByContinent(locations.value, continentId);
  }

  /** 清除 UI 状态（不删除数据库数据） */
  function clearUIState(): void {
    state.value = { view: { ...DEFAULT_MAP_VIEW } };
    currentLocation.value = null;
    locations.value = new Map();
    initialized.value = false;
  }

  return {
    // 状态
    state,
    currentLocation,
    initialized,

    // 计算属性
    getView,
    getCurrentLocation,

    // 动作
    initialize,
    getState,
    getLocationData,
    getLocationsByContinent: getContinentLocations,
    getZones,
    isLocationUnlocked,
    enterZone,
    zoomTo,
    panTo,
    resetView,
    setCurrentContinent,
    saveCurrentTab,
    getCurrentTab,
    clearUIState
  };
});
