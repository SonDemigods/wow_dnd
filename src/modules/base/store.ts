/**
 * 基础数据管理模块状态管理（Store 核心架构）
 *
 * Store 是基础数据的唯一持有者，Action 负责编排：
 *   直接调 DB → 更新 Store 状态 → emit 事件通知其他模块
 */
import { defineStore } from 'pinia';
import { ref, computed, type Ref } from 'vue';
import type { FactionData, RaceData, ClassData, RaceType, FactionType } from '../character/types';
import type { FactionCreateUpdateData, RaceCreateUpdateData, ClassCreateUpdateData } from './types';
import { baseDbService } from './db';
import { eventBus, GameEvents } from '../bus';
import { errorHandler } from '@/services/ErrorHandler';

// ==================== 通用工厂函数 ====================

/** 实体类型标识 */
type EntityType = 'faction' | 'race' | 'class';

/** 实体类型中文名称映射（用于错误提示文案） */
const ENTITY_LABEL: Record<EntityType, string> = {
  faction: '阵营',
  race: '种族',
  class: '职业'
};

/**
 * 创建通用快捷取值计算属性
 * 根据列表和字段名生成 `(id) => fieldValue` 形式的 getter
 */
function createQuickGetter<T extends Record<string, any>>(
  list: Ref<T[]>,
  field: keyof T,
  fallback: string
) {
  return computed(() => (id: string) => {
    const item = list.value.find(i => i.id === id);
    return (item?.[field] as string) ?? fallback;
  });
}

/**
 * 创建通用 CRUD 操作函数（create / update / delete）
 * 消除阵营、种族、职业的重复 CRUD 模式
 */
function createCrudActions<T extends { id: string }, TCreateData = Omit<T, 'id'>>(
  entityType: EntityType,
  createFn: (data: TCreateData) => Promise<string>,
  updateFn: (id: string, data: TCreateData) => Promise<void>,
  deleteFn: (id: string) => Promise<void>,
  loadFn: () => Promise<void>,
  selectedIdRef: Ref<string | null>
) {
  async function create(data: TCreateData): Promise<boolean> {
    try {
      const id = await createFn(data);
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, { type: entityType, action: 'create', id });
      await loadFn();
      return true;
    } catch (error) {
      errorHandler.report(error, `创建${ENTITY_LABEL[entityType]}失败`);
      return false;
    }
  }

  async function update(id: string, data: TCreateData): Promise<boolean> {
    try {
      await updateFn(id, data);
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, { type: entityType, action: 'update', id });
      await loadFn();
      return true;
    } catch (error) {
      errorHandler.report(error, `更新${ENTITY_LABEL[entityType]}失败`);
      return false;
    }
  }

  async function delete_(id: string): Promise<boolean> {
    try {
      await deleteFn(id);
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, { type: entityType, action: 'delete', id });
      await loadFn();
      if (selectedIdRef.value === id) {
        selectedIdRef.value = null;
      }
      return true;
    } catch (error) {
      errorHandler.report(error, `删除${ENTITY_LABEL[entityType]}失败`);
      return false;
    }
  }

  return { create, update, delete: delete_ };
}

// ==================== Store 定义 ====================

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
  const getRacesByFaction = computed(() => (factionId: FactionType) => {
    return races.value.filter(r => r.factionId === factionId);
  });

  /** 根据种族获取职业 */
  const getClassesByRace = computed(() => (raceId: RaceType) => {
    return classes.value.filter(c => c.raceIds.includes(raceId));
  });

  /** 根据阵营获取职业 */
  const getClassesByFaction = computed(() => (factionId: FactionType) => {
    return classes.value.filter(c => c.factionsIds.includes(factionId));
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

  // ==================== 快捷取值方法（工厂生成） ====================

  const getRaceIcon = createQuickGetter(races, 'icon', '👤');
  const getRaceName = createQuickGetter(races, 'name', '');
  const getFactionIcon = createQuickGetter(factions, 'icon', 'game-icons:checked-shield');
  const getFactionName = createQuickGetter(factions, 'name', '');
  const getFactionColor = createQuickGetter(factions, 'color', '#9d9d9d');
  const getClassIcon = createQuickGetter(classes, 'icon', 'game-icons:broadsword');
  const getClassName = createQuickGetter(classes, 'name', '');
  const getClassColor = createQuickGetter(classes, 'color', '#9d9d9d');

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
    try {
      factions.value = await baseDbService.getAllFactions();
    } catch (error) {
      errorHandler.report(error, '加载阵营数据失败');
      factions.value = [];
    }
  }

  /**
   * 加载种族数据
   */
  async function loadRaces(): Promise<void> {
    try {
      races.value = await baseDbService.getAllRaces();
    } catch (error) {
      errorHandler.report(error, '加载种族数据失败');
      races.value = [];
    }
  }

  /**
   * 加载职业数据
   */
  async function loadClasses(): Promise<void> {
    try {
      classes.value = await baseDbService.getAllClasses();
    } catch (error) {
      errorHandler.report(error, '加载职业数据失败');
      classes.value = [];
    }
  }

  // ==================== CRUD 操作（工厂生成） ====================

  const {
    create: createFaction,
    update: updateFaction,
    delete: deleteFaction
  } = createCrudActions<FactionData, FactionCreateUpdateData>(
    'faction',
    (data) => baseDbService.createFaction(data),
    (id, data) => baseDbService.updateFaction(id, data),
    (id) => baseDbService.deleteFaction(id),
    loadFactions,
    selectedFactionId
  );

  const {
    create: createRace,
    update: updateRace,
    delete: deleteRace
  } = createCrudActions<RaceData, RaceCreateUpdateData>(
    'race',
    (data) => baseDbService.createRace(data),
    (id, data) => baseDbService.updateRace(id, data),
    (id) => baseDbService.deleteRace(id),
    loadRaces,
    selectedRaceId
  );

  const {
    create: createClass,
    update: updateClass,
    delete: deleteClass
  } = createCrudActions<ClassData, ClassCreateUpdateData>(
    'class',
    (data) => baseDbService.createClass(data),
    (id, data) => baseDbService.updateClass(id, data),
    (id) => baseDbService.deleteClass(id),
    loadClasses,
    selectedClassId
  );

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
    eventBus.emit(GameEvents.GAME_DATA_UPDATED, { type: 'base', action: 'bulk', id: '*' });
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
    initialize
  };
});
