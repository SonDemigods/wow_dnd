/**
 * 基础数据管理模块状态管理（Store 核心架构）
 *
 * Store 是基础数据的唯一持有者，Action 负责编排：
 *   直接调 DB → 更新 Store 状态 → emit 事件通知其他模块
 */
import { defineStore } from 'pinia';
import { ref, computed, type Ref } from 'vue';
import type { FactionData, RaceData, ClassData, RaceType, FactionType } from '@/modules/character/types';
import type { FactionCreateUpdateData, RaceCreateUpdateData, ClassCreateUpdateData } from './types';
import { baseDbService } from './db';
import { eventBus, GameEvents } from '@/modules/bus';
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
function createQuickGetter<T extends Record<string, unknown>>(
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
      // P2-65 修复：先 loadFn 刷新本 store 状态，再 emit 事件通知其他模块，
      // 确保其他模块的监听器回调中查询 base store 时能看到最新数据
      await loadFn();
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, { type: entityType, action: 'create', id });
      return true;
    } catch (error) {
      errorHandler.report(error, `创建${ENTITY_LABEL[entityType]}失败`);
      return false;
    }
  }

  async function update(id: string, data: TCreateData): Promise<boolean> {
    try {
      await updateFn(id, data);
      // P2-65 修复：先 loadFn 再 emit，避免其他模块读到过期状态
      await loadFn();
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, { type: entityType, action: 'update', id });
      return true;
    } catch (error) {
      errorHandler.report(error, `更新${ENTITY_LABEL[entityType]}失败`);
      return false;
    }
  }

  async function remove(id: string): Promise<boolean> {
    try {
      await deleteFn(id);
      // P2-65 修复：先 loadFn 再 emit，避免其他模块读到过期状态
      await loadFn();
      if (selectedIdRef.value === id) {
        selectedIdRef.value = null;
      }
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, { type: entityType, action: 'delete', id });
      return true;
    } catch (error) {
      errorHandler.report(error, `删除${ENTITY_LABEL[entityType]}失败`);
      return false;
    }
  }

  return { create, update, remove };
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
    remove: deleteFaction
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
    remove: deleteRace
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
    remove: deleteClass
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
   * GAME_DATA_UPDATED 事件监听器引用（dispose 时注销）
   *
   * P2-64 修复：base store 需监听外部模块（data/admin）触发的 GAME_DATA_UPDATED
   * 事件，在配置数据变更后自动刷新本地缓存，避免读到过期数据。
   */
  let dataUpdatedHandler: ((payload: { type: string; action: string; id: string }) => void) | null = null;

  /**
   * 初始化
   *
   * 执行流程：
   * 1. 重置选中状态（P2-62 修复：防止角色切换时选中状态泄漏）
   * 2. 加载基础数据
   * 3. 注册 GAME_DATA_UPDATED 监听器（P2-64 修复：响应外部模块的数据变更）
   * 4. 通知其他模块基础数据已就绪
   */
  async function initialize(): Promise<void> {
    // P2-62 修复：初始化时重置选中状态，防止角色切换时 faction/race/class 选中泄漏
    resetSelection();
    await loadAllData();
    // P2-64 修复：监听外部模块（data/admin）的 GAME_DATA_UPDATED 事件，
    // 过滤出 base 相关类型后重新加载本地缓存
    if (dataUpdatedHandler === null) {
      dataUpdatedHandler = (payload) => {
        // 仅响应 base 类型或通配符的更新通知
        // 忽略 'bulk' action：这是 initialize 自身 emit 的，避免循环刷新
        if (
          (payload.type === 'base' || payload.type === '*' || payload.id === '*') &&
          payload.action !== 'bulk'
        ) {
          loadAllData().catch(err => console.error('[BaseStore] 响应 GAME_DATA_UPDATED 刷新失败:', err));
        }
      };
      eventBus.on(GameEvents.GAME_DATA_UPDATED, dataUpdatedHandler);
    }
    // 通知其他模块基础数据已就绪
    eventBus.emit(GameEvents.GAME_DATA_UPDATED, { type: 'base', action: 'bulk', id: '*' });
  }

  /**
   * 释放 Store 持有的资源
   *
   * P2-64 修复：注销 GAME_DATA_UPDATED 监听器，避免内存泄漏。
   * 角色切换或应用卸载时由 GameBootstrap.dispose 调用。
   */
  function dispose(): void {
    if (dataUpdatedHandler !== null) {
      eventBus.off(GameEvents.GAME_DATA_UPDATED, dataUpdatedHandler);
      dataUpdatedHandler = null;
    }
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
    // P2-64：暴露 dispose 方法供 GameBootstrap 调用
    dispose
  };
});
