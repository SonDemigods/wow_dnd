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

/** 默认地图视图 */
const DEFAULT_MAP_VIEW = {
  zoomLevel: 1,
  panX: 0,
  panY: 0
};

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
  /** 保存地图状态（按角色隔离） */
  async function saveState(): Promise<void> {
    if (currentCharacterId.value) {
      await mapDbService.saveMapState(currentCharacterId.value, state.value);
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
      }
    });
    locations.value = map;
  }

  // ==================== 动作 ====================

  /**
   * 初始化地图模块 —— 加载地图状态和地点数据
   * @param characterId - 角色 ID
   */
  async function initialize(characterId: string): Promise<void> {
    currentCharacterId.value = characterId;

    // 加载地图状态
    const savedState = await mapDbService.getMapState(characterId);
    if (savedState?.view) {
      state.value = { view: savedState.view };
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

  /** 获取地图状态 */
  function getState(): MapState {
    return { ...state.value };
  }

  /**
   * 获取地点数据
   */
  function getLocationData(locationId: string): LocationData | null {
    return getLocationById(locations.value, locationId) || null;
  }

  /**
   * 获取大陆下的地点
   */
  function getLocationsByContinentAction(continentId: string): LocationData[] {
    return getLocationsByContinent(locations.value, continentId);
  }

  /**
   * 获取所有区域（转换为 MapZone 格式，用于大地图 UI 展示）
   * @param playerLevel - 玩家等级，用于计算区域解锁状态
   * @returns 区域列表
   */
  function getZones(playerLevel: number): MapZone[] {
    const result: MapZone[] = [];
    const stateData = state.value as MapState & { unlockedZones?: string[]; completedZones?: string[] };

    locations.value.forEach(location => {
      const status = getZoneStatus(stateData, location.id, location, playerLevel);
      result.push({
        id: location.id,
        name: location.name,
        icon: location.icon,
        description: location.description,
        coordinates: { x: location.mapX, y: location.mapY },
        requiredLevel: location.levelRange[0],
        requiredGold: 0,
        status,
        rewards: { gold: 0, exp: 0 }
      });
    });

    return result;
  }

  /**
   * 检查地点是否解锁
   */
  function isLocationUnlocked(locationId: string, playerLevel: number): boolean {
    const location = getLocationById(locations.value, locationId);
    if (!location) return false;
    return isLocationAccessible(location, playerLevel);
  }

  /**
   * 进入区域
   * @param zoneId - 区域/地点 ID
   * @returns 是否成功进入
   */
  function enterZone(zoneId: string): boolean {
    const location = getLocationById(locations.value, zoneId);
    if (!location) return false;

    currentLocation.value = location;

    // 持久化当前区域 ID
    if (currentCharacterId.value) {
      mapDbService.saveCurrentLocationId(currentCharacterId.value, zoneId);
    }

    // emit 事件通知其他模块
    eventBus.emit(GameEvents.ZONE_ENTERED, { locationId: zoneId, location });

    return true;
  }

  /** 缩放到指定级别 */
  function zoomTo(level: number): void {
    state.value.view.zoomLevel = Math.max(1, Math.min(5, level));
    saveState();
  }

  /** 平移到指定位置 */
  function panTo(x: number, y: number): void {
    state.value.view.panX = Math.max(-50, Math.min(50, x));
    state.value.view.panY = Math.max(-50, Math.min(50, y));
    saveState();
  }

  /** 重置视图 */
  function resetView(): void {
    state.value.view = { ...DEFAULT_MAP_VIEW };
    saveState();
  }

  /** 设置当前大陆 */
  function setCurrentContinent(continentId: string): void {
    state.value.view.currentContinentId = continentId;
    saveState();
  }

  /**
   * 保存当前标签页（按角色隔离持久化）
   * @param tab - 标签名（'map' | 'explore'）
   */
  async function saveCurrentTab(tab: string): Promise<void> {
    if (currentCharacterId.value) {
      await mapDbService.saveCurrentTab(currentCharacterId.value, tab);
    }
  }

  /**
   * 获取当前标签页（按角色隔离读取）
   * @returns 标签名，无记录时返回 null
   */
  async function getCurrentTab(): Promise<string | null> {
    if (currentCharacterId.value) {
      return mapDbService.getCurrentTab(currentCharacterId.value);
    }
    return null;
  }

  /** 清除 UI 状态（不删除数据库数据） */
  function clearUIState(): void {
    state.value = { view: { ...DEFAULT_MAP_VIEW } };
    currentLocation.value = null;
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
    getLocationsByContinent: getLocationsByContinentAction,
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
