/**
 * 基础数据管理模块状态管理
 * 
 * 使用 Pinia 管理阵营、种族、职业等基础数据的状态
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { FactionData, RaceData, ClassData, RaceType, FactionType } from '../character/types';
import { gameDataService } from './service';
import { eventBus, GameEvents } from '../bus/core';

/**
 * 基础数据状态存储
 */
export const useGameDataStore = defineStore('gameData', () => {
  // ==================== 状态 ====================
  
  /** 阵营列表 */
  const factions = ref<FactionData[]>([]);
  
  /** 种族列表 */
  const races = ref<RaceData[]>([]);
  
  /** 职业列表 */
  const classes = ref<ClassData[]>([]);
  
  /** 是否正在加载 */
  const isLoading = ref(false);
  
  /** 当前选中的阵营ID */
  const selectedFactionId = ref<string | null>(null);
  
  /** 当前选中的种族ID */
  const selectedRaceId = ref<string | null>(null);
  
  /** 当前选中的职业ID */
  const selectedClassId = ref<string | null>(null);
  
  // ==================== 计算属性 ====================
  
  /** 根据ID获取阵营 */
  const getFactionById = computed(() => (id: string) => {
    return factions.value.find(f => f.id === id) || null;
  });
  
  /** 根据ID获取种族 */
  const getRaceById = computed(() => (id: string) => {
    return races.value.find(r => r.id === id) || null;
  });
  
  /** 根据ID获取职业 */
  const getClassById = computed(() => (id: string) => {
    return classes.value.find(c => c.id === id) || null;
  });
  
  /** 根据阵营获取种族 */
  const getRacesByFaction = computed(() => (factionId: string) => {
    return races.value.filter(r => r.factionId === factionId);
  });
  
  /** 根据种族获取职业 */
  const getClassesByRace = computed(() => (raceId: string) => {
    return classes.value.filter(c => c.raceIds.includes(raceId as RaceType));
  });
  
  /** 根据阵营获取职业 */
  const getClassesByFaction = computed(() => (factionId: string) => {
    return classes.value.filter(c => c.factionsIds.includes(factionId as FactionType));
  });
  
  /** 当前选中的阵营 */
  const selectedFaction = computed(() => {
    if (!selectedFactionId.value) return null;
    return factions.value.find(f => f.id === selectedFactionId.value) || null;
  });
  
  /** 当前选中的种族 */
  const selectedRace = computed(() => {
    if (!selectedRaceId.value) return null;
    return races.value.find(r => r.id === selectedRaceId.value) || null;
  });
  
  /** 当前选中的职业 */
  const selectedClass = computed(() => {
    if (!selectedClassId.value) return null;
    return classes.value.find(c => c.id === selectedClassId.value) || null;
  });

  // ==================== 快捷取值方法 ====================
  // 直接返回 name / icon / color，避免各组件重复编写 find + 回退值逻辑

  const getRaceIcon = computed(() => (id: string) => {
    return races.value.find(r => r.id === id)?.icon || '👤';
  });
  const getRaceName = computed(() => (id: string) => {
    return races.value.find(r => r.id === id)?.name || '';
  });
  const getFactionIcon = computed(() => (id: string) => {
    return factions.value.find(f => f.id === id)?.icon || '🏳️';
  });
  const getFactionName = computed(() => (id: string) => {
    return factions.value.find(f => f.id === id)?.name || '';
  });
  const getFactionColor = computed(() => (id: string) => {
    return factions.value.find(f => f.id === id)?.color || '#9d9d9d';
  });
  const getClassIcon = computed(() => (id: string) => {
    return classes.value.find(c => c.id === id)?.icon || '⚔️';
  });
  const getClassName = computed(() => (id: string) => {
    return classes.value.find(c => c.id === id)?.name || '';
  });
  const getClassColor = computed(() => (id: string) => {
    return classes.value.find(c => c.id === id)?.color || '#9d9d9d';
  });
  
  // ==================== 方法 ====================
  
  /**
   * 加载所有基础数据
   */
  async function loadAllData(): Promise<void> {
    isLoading.value = true;
    try {
      const [factionsData, racesData, classesData] = await Promise.all([
        gameDataService.getAllFactions(),
        gameDataService.getAllRaces(),
        gameDataService.getAllClasses()
      ]);
      
      factions.value = factionsData;
      races.value = racesData;
      classes.value = classesData;
    } finally {
      isLoading.value = false;
    }
  }
  
  /**
   * 加载阵营数据
   */
  async function loadFactions(): Promise<void> {
    factions.value = await gameDataService.getAllFactions();
  }
  
  /**
   * 加载种族数据
   */
  async function loadRaces(): Promise<void> {
    races.value = await gameDataService.getAllRaces();
  }
  
  /**
   * 加载职业数据
   */
  async function loadClasses(): Promise<void> {
    classes.value = await gameDataService.getAllClasses();
  }
  
  /**
   * 创建阵营
   * @returns 是否创建成功
   */
  async function createFaction(data: Omit<FactionData, 'id'>): Promise<boolean> {
    const result = await gameDataService.createFaction(data);
    if (result.success) {
      await loadFactions();
      return true;
    }
    return false;
  }
  
  /**
   * 更新阵营
   * @returns 是否更新成功
   */
  async function updateFaction(id: string, data: Omit<FactionData, 'id'>): Promise<boolean> {
    const result = await gameDataService.updateFaction(id, data);
    if (result.success) {
      await loadFactions();
      return true;
    }
    return false;
  }
  
  /**
   * 删除阵营
   * @returns 是否删除成功
   */
  async function deleteFaction(id: string): Promise<boolean> {
    const result = await gameDataService.deleteFaction(id);
    if (result.success) {
      await loadFactions();
      if (selectedFactionId.value === id) {
        selectedFactionId.value = null;
      }
      return true;
    }
    return false;
  }
  
  /**
   * 创建种族
   * @returns 是否创建成功
   */
  async function createRace(data: Omit<RaceData, 'id'>): Promise<boolean> {
    const result = await gameDataService.createRace(data);
    if (result.success) {
      await loadRaces();
      return true;
    }
    return false;
  }
  
  /**
   * 更新种族
   * @returns 是否更新成功
   */
  async function updateRace(id: string, data: Omit<RaceData, 'id'>): Promise<boolean> {
    const result = await gameDataService.updateRace(id, data);
    if (result.success) {
      await loadRaces();
      return true;
    }
    return false;
  }
  
  /**
   * 删除种族
   * @returns 是否删除成功
   */
  async function deleteRace(id: string): Promise<boolean> {
    const result = await gameDataService.deleteRace(id);
    if (result.success) {
      await loadRaces();
      if (selectedRaceId.value === id) {
        selectedRaceId.value = null;
      }
      return true;
    }
    return false;
  }
  
  /**
   * 创建职业
   * @returns 是否创建成功
   */
  async function createClass(data: Omit<ClassData, 'id'>): Promise<boolean> {
    const result = await gameDataService.createClass(data);
    if (result.success) {
      await loadClasses();
      return true;
    }
    return false;
  }
  
  /**
   * 更新职业
   */
  async function updateClass(id: string, data: Omit<ClassData, 'id'>): Promise<boolean> {
    const result = await gameDataService.updateClass(id, data);
    if (result.success) {
      await loadClasses();
      return true;
    }
    return false;
  }
  
  /**
   * 删除职业
   * @returns 是否删除成功
   */
  async function deleteClass(id: string): Promise<boolean> {
    const result = await gameDataService.deleteClass(id);
    if (result.success) {
      await loadClasses();
      if (selectedClassId.value === id) {
        selectedClassId.value = null;
      }
      return true;
    }
    return false;
  }
  
  /**
   * 选择阵营
   */
  function selectFaction(id: string | null): void {
    selectedFactionId.value = id;
    if (id) {
      selectedRaceId.value = null;
      selectedClassId.value = null;
    }
  }
  
  /**
   * 选择种族
   */
  function selectRace(id: string | null): void {
    selectedRaceId.value = id;
    if (id) {
      selectedClassId.value = null;
    }
  }
  
  /**
   * 选择职业
   */
  function selectClass(id: string | null): void {
    selectedClassId.value = id;
  }
  
  /**
   * 重置选中状态
   */
  function resetSelection(): void {
    selectedFactionId.value = null;
    selectedRaceId.value = null;
    selectedClassId.value = null;
  }
  
  /**
   * 初始化
   */
  async function initialize(): Promise<void> {
    await loadAllData();
    
    eventBus.onGroup('gameDataStore', GameEvents.GAME_DATA_UPDATED, async () => {
      await loadAllData();
    });
  }

  /**
   * 清理事件监听
   */
  function dispose(): void {
    eventBus.clearGroup('gameDataStore');
  }
  
  return {
    // 状态
    factions,
    races,
    classes,
    isLoading,
    selectedFactionId,
    selectedRaceId,
    selectedClassId,
    
    // 计算属性
    getFactionById,
    getRaceById,
    getClassById,
    getRacesByFaction,
    getClassesByRace,
    getClassesByFaction,
    selectedFaction,
    selectedRace,
    selectedClass,
    
    // 快捷取值方法
    getRaceIcon,
    getRaceName,
    getFactionIcon,
    getFactionName,
    getFactionColor,
    getClassIcon,
    getClassName,
    getClassColor,
    
    // 方法
    loadAllData,
    loadFactions,
    loadRaces,
    loadClasses,
    createFaction,
    updateFaction,
    deleteFaction,
    createRace,
    updateRace,
    deleteRace,
    createClass,
    updateClass,
    deleteClass,
    selectFaction,
    selectRace,
    selectClass,
    resetSelection,
    initialize,
    dispose
  };
});