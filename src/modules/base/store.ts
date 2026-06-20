/**
 * 基础数据管理模块状态管理（Store 核心架构）
 *
 * Store 是基础数据的唯一持有者，Action 负责编排：
 *   直接调 DB → 更新 Store 状态 → emit 事件通知其他模块
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { FactionData, RaceData, ClassData, RaceType, FactionType } from '../character/types';
import { baseDbService } from './db';
import { eventBus, GameEvents } from '../bus/core';

/**
 * 基础数据状态存储
 */
export const useBaseStore = defineStore('base', () => {
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

  const getRaceIcon = computed(() => (id: string) => {
    return races.value.find(r => r.id === id)?.icon || '👤';
  });
  const getRaceName = computed(() => (id: string) => {
    return races.value.find(r => r.id === id)?.name || '';
  });
  const getFactionIcon = computed(() => (id: string) => {
    return factions.value.find(f => f.id === id)?.icon || 'game-icons:checked-shield';
  });
  const getFactionName = computed(() => (id: string) => {
    return factions.value.find(f => f.id === id)?.name || '';
  });
  const getFactionColor = computed(() => (id: string) => {
    return factions.value.find(f => f.id === id)?.color || '#9d9d9d';
  });
  const getClassIcon = computed(() => (id: string) => {
    return classes.value.find(c => c.id === id)?.icon || 'game-icons:broadsword';
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
        baseDbService.getAllFactions(),
        baseDbService.getAllRaces(),
        baseDbService.getAllClasses()
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
    factions.value = await baseDbService.getAllFactions();
  }

  /**
   * 加载种族数据
   */
  async function loadRaces(): Promise<void> {
    races.value = await baseDbService.getAllRaces();
  }

  /**
   * 加载职业数据
   */
  async function loadClasses(): Promise<void> {
    classes.value = await baseDbService.getAllClasses();
  }

  /**
   * 创建阵营
   */
  async function createFaction(data: Omit<FactionData, 'id'>): Promise<boolean> {
    try {
      const id = await baseDbService.createFaction(data);
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, {
        type: 'faction',
        action: 'create',
        id
      });
      await loadFactions();
      return true;
    } catch (error) {
      console.error('[BaseStore] 创建阵营失败:', error);
      return false;
    }
  }

  /**
   * 更新阵营
   */
  async function updateFaction(id: string, data: Omit<FactionData, 'id'>): Promise<boolean> {
    try {
      await baseDbService.updateFaction(id, data);
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, {
        type: 'faction',
        action: 'update',
        id
      });
      await loadFactions();
      return true;
    } catch (error) {
      console.error('[BaseStore] 更新阵营失败:', error);
      return false;
    }
  }

  /**
   * 删除阵营
   */
  async function deleteFaction(id: string): Promise<boolean> {
    try {
      await baseDbService.deleteFaction(id);
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, {
        type: 'faction',
        action: 'delete',
        id
      });
      await loadFactions();
      if (selectedFactionId.value === id) {
        selectedFactionId.value = null;
      }
      return true;
    } catch (error) {
      console.error('[BaseStore] 删除阵营失败:', error);
      return false;
    }
  }

  /**
   * 创建种族
   */
  async function createRace(data: Omit<RaceData, 'id'>): Promise<boolean> {
    try {
      const id = await baseDbService.createRace(data);
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, {
        type: 'race',
        action: 'create',
        id
      });
      await loadRaces();
      return true;
    } catch (error) {
      console.error('[BaseStore] 创建种族失败:', error);
      return false;
    }
  }

  /**
   * 更新种族
   */
  async function updateRace(id: string, data: Omit<RaceData, 'id'>): Promise<boolean> {
    try {
      await baseDbService.updateRace(id, data);
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, {
        type: 'race',
        action: 'update',
        id
      });
      await loadRaces();
      return true;
    } catch (error) {
      console.error('[BaseStore] 更新种族失败:', error);
      return false;
    }
  }

  /**
   * 删除种族
   */
  async function deleteRace(id: string): Promise<boolean> {
    try {
      await baseDbService.deleteRace(id);
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, {
        type: 'race',
        action: 'delete',
        id
      });
      await loadRaces();
      if (selectedRaceId.value === id) {
        selectedRaceId.value = null;
      }
      return true;
    } catch (error) {
      console.error('[BaseStore] 删除种族失败:', error);
      return false;
    }
  }

  /**
   * 创建职业
   */
  async function createClass(data: Omit<ClassData, 'id'>): Promise<boolean> {
    try {
      const id = await baseDbService.createClass(data);
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, {
        type: 'class',
        action: 'create',
        id
      });
      await loadClasses();
      return true;
    } catch (error) {
      console.error('[BaseStore] 创建职业失败:', error);
      return false;
    }
  }

  /**
   * 更新职业
   */
  async function updateClass(id: string, data: Omit<ClassData, 'id'>): Promise<boolean> {
    try {
      await baseDbService.updateClass(id, data);
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, {
        type: 'class',
        action: 'update',
        id
      });
      await loadClasses();
      return true;
    } catch (error) {
      console.error('[BaseStore] 更新职业失败:', error);
      return false;
    }
  }

  /**
   * 删除职业
   */
  async function deleteClass(id: string): Promise<boolean> {
    try {
      await baseDbService.deleteClass(id);
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, {
        type: 'class',
        action: 'delete',
        id
      });
      await loadClasses();
      if (selectedClassId.value === id) {
        selectedClassId.value = null;
      }
      return true;
    } catch (error) {
      console.error('[BaseStore] 删除职业失败:', error);
      return false;
    }
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
   * 直接调用 loadAllData 加载基础数据，并通过 EventBus 通知其他模块已完成初始化。
   * 注意：不再自监听 GAME_DATA_UPDATED，CRUD 操作后直接调用对应 load 方法刷新
   */
  async function initialize(): Promise<void> {
    await loadAllData();
    // 通知其他模块基础数据已就绪
    eventBus.emit(GameEvents.GAME_DATA_UPDATED, { type: 'init', action: 'bulk', id: '*' });
  }

  /**
   * 清理事件监听
   */
  function dispose(): void {
    eventBus.clearGroup('baseStore');
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
