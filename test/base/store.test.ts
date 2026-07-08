/**
 * @fileoverview 基础数据模块 Pinia Store 单元测试
 *
 * 覆盖 useBaseStore 的：
 * 1. State 初始值（factions/races/classes 为空数组、isLoading=false、三个 selectedId=null）
 * 2. Getters：
 *    - getById 系列（getFactionById/getRaceById/getClassById）
 *    - 过滤系列（getRacesByFaction/getClassesByRace/getClassesByFaction）
 *    - selected 系列（selectedFaction/selectedRace/selectedClass 含 null/命中/未命中）
 *    - 快捷取值（getRaceIcon/getRaceName/getFaction 系列/getClass 系列 及 fallback）
 * 3. Actions：
 *    - load 系列（loadAllData 含 isLoading 过程、loadFactions/Races/Classes 成功/失败清空）
 *    - CRUD（Faction/Race/Class 的 create/update/delete 成功 emit 事件 + 失败上报；
 *      delete 选中项时 selectedXxxId 置 null 边界）
 *    - select 系列（级联清空 / null 不清空 / resetSelection）
 *    - initialize（loadAllData + emit base/bulk/*）
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - baseDbService 全量 mock，断言调用与参数，不触碰真实 IndexedDB。
 *  - errorHandler mock，仅断言 report 被调用。
 *  - eventBus 使用真实实现（纯内存发布订阅），通过 eventBus.on 注册 spy 断言 emit，
 *    beforeEach 调用 eventBus.clearAll() 避免监听器残留。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBaseStore } from '@/modules/base/store';
import { createTestPinia } from '../utils/setup';
import { eventBus, GameEvents } from '@/modules/bus';
import type { FactionData, RaceData, ClassData } from '@/modules/character/types';

/** mock 基础数据 DB 层，避免触碰真实 IndexedDB */
vi.mock('@/modules/base/db', () => ({
  baseDbService: {
    getAllFactions: vi.fn().mockResolvedValue([]),
    getAllRaces: vi.fn().mockResolvedValue([]),
    getAllClasses: vi.fn().mockResolvedValue([]),
    createFaction: vi.fn().mockResolvedValue('new-id'),
    updateFaction: vi.fn().mockResolvedValue(undefined),
    deleteFaction: vi.fn().mockResolvedValue(undefined),
    createRace: vi.fn().mockResolvedValue('new-id'),
    updateRace: vi.fn().mockResolvedValue(undefined),
    deleteRace: vi.fn().mockResolvedValue(undefined),
    createClass: vi.fn().mockResolvedValue('new-id'),
    updateClass: vi.fn().mockResolvedValue(undefined),
    deleteClass: vi.fn().mockResolvedValue(undefined),
  },
}));

/** mock 错误处理器，避免触发真实 toast / 控制台副作用 */
vi.mock('@/services/ErrorHandler', () => ({
  errorHandler: { report: vi.fn() },
}));

/** 从 mock 中取出 spy 引用，便于断言 */
import { baseDbService } from '@/modules/base/db';
import { errorHandler } from '@/services/ErrorHandler';

// ==================== 测试数据构造 helper ====================

function makeFaction(o: Partial<FactionData> = {}): FactionData {
  return {
    id: 'alliance',
    name: '联盟',
    icon: 'game-icons:checked-shield',
    color: '#00ff88',
    description: '光辉盟约',
    ...o,
  } as FactionData;
}

function makeRace(o: Partial<RaceData> = {}): RaceData {
  return {
    id: 'human',
    name: '人类',
    icon: 'game-icons:human',
    factionId: 'alliance',
    description: '人类种族',
    ...o,
  } as RaceData;
}

function makeClass(o: Partial<ClassData> = {}): ClassData {
  return {
    id: 'warrior',
    name: '战士',
    icon: 'game-icons:broadsword',
    primaryStat: 'str',
    factionsIds: ['alliance'],
    raceIds: ['human'],
    description: '战士职业',
    color: '#C79C6E',
    ...o,
  } as ClassData;
}

// ==================== 测试用例 ====================

describe('useBaseStore - 基础数据 Store', () => {
  beforeEach(() => {
    createTestPinia();
    vi.clearAllMocks();
    eventBus.clearAll();
  });

  // -------------------- State 初始值 --------------------
  describe('State 初始值', () => {
    it('factions/races/classes 初始为空数组', () => {
      const store = useBaseStore();
      expect(store.factions).toEqual([]);
      expect(store.races).toEqual([]);
      expect(store.classes).toEqual([]);
    });

    it('isLoading 初始为 false', () => {
      const store = useBaseStore();
      expect(store.isLoading).toBe(false);
    });

    it('selectedFactionId/selectedRaceId/selectedClassId 初始为 null', () => {
      const store = useBaseStore();
      expect(store.selectedFactionId).toBeNull();
      expect(store.selectedRaceId).toBeNull();
      expect(store.selectedClassId).toBeNull();
    });
  });

  // -------------------- Getters: getById --------------------
  describe('Getters: getById 系列', () => {
    it('getFactionById 找到返回对象，未找到返回 null', () => {
      const store = useBaseStore();
      const f = makeFaction();
      store.$patch({ factions: [f] });
      expect(store.getFactionById('alliance')).toEqual(f);
      expect(store.getFactionById('horde')).toBeNull();
    });

    it('getRaceById 找到返回对象，未找到返回 null', () => {
      const store = useBaseStore();
      const r = makeRace();
      store.$patch({ races: [r] });
      expect(store.getRaceById('human')).toEqual(r);
      expect(store.getRaceById('orc')).toBeNull();
    });

    it('getClassById 找到返回对象，未找到返回 null', () => {
      const store = useBaseStore();
      const c = makeClass();
      store.$patch({ classes: [c] });
      expect(store.getClassById('warrior')).toEqual(c);
      expect(store.getClassById('mage')).toBeNull();
    });
  });

  // -------------------- Getters: 过滤系列 --------------------
  describe('Getters: 过滤系列', () => {
    it('getRacesByFaction 按 factionId 过滤', () => {
      const store = useBaseStore();
      const r1 = makeRace({ id: 'human', factionId: 'alliance' });
      const r2 = makeRace({ id: 'orc', factionId: 'horde' });
      store.$patch({ races: [r1, r2] });
      expect(store.getRacesByFaction('alliance')).toEqual([r1]);
      expect(store.getRacesByFaction('horde')).toEqual([r2]);
      expect(store.getRacesByFaction('neutral')).toEqual([]);
    });

    it('getClassesByRace 按 raceIds 包含过滤', () => {
      const store = useBaseStore();
      const c1 = makeClass({ id: 'warrior', raceIds: ['human', 'orc'] });
      const c2 = makeClass({ id: 'mage', raceIds: ['human'] });
      store.$patch({ classes: [c1, c2] });
      expect(store.getClassesByRace('human')).toEqual([c1, c2]);
      expect(store.getClassesByRace('orc')).toEqual([c1]);
      expect(store.getClassesByRace('tauren')).toEqual([]);
    });

    it('getClassesByFaction 按 factionsIds 包含过滤', () => {
      const store = useBaseStore();
      const c1 = makeClass({ id: 'warrior', factionsIds: ['alliance', 'horde'] });
      const c2 = makeClass({ id: 'mage', factionsIds: ['alliance'] });
      store.$patch({ classes: [c1, c2] });
      expect(store.getClassesByFaction('alliance')).toEqual([c1, c2]);
      expect(store.getClassesByFaction('horde')).toEqual([c1]);
      expect(store.getClassesByFaction('neutral')).toEqual([]);
    });
  });

  // -------------------- Getters: selected 系列 --------------------
  describe('Getters: selected 系列', () => {
    it('selectedFaction: selectedFactionId 为 null 时返回 null', () => {
      const store = useBaseStore();
      store.$patch({ factions: [makeFaction()] });
      expect(store.selectedFaction).toBeNull();
    });

    it('selectedFaction: 有值时返回对应对象', () => {
      const store = useBaseStore();
      const f = makeFaction();
      store.$patch({ factions: [f], selectedFactionId: 'alliance' });
      expect(store.selectedFaction).toEqual(f);
    });

    it('selectedFaction: 有值但找不到时返回 null', () => {
      const store = useBaseStore();
      store.$patch({ factions: [makeFaction()], selectedFactionId: 'horde' });
      expect(store.selectedFaction).toBeNull();
    });

    it('selectedRace: null / 命中 / 未命中 三种情况', () => {
      const store = useBaseStore();
      const r = makeRace();
      store.$patch({ races: [r] });
      expect(store.selectedRace).toBeNull();
      store.$patch({ selectedRaceId: 'human' });
      expect(store.selectedRace).toEqual(r);
      store.$patch({ selectedRaceId: 'orc' });
      expect(store.selectedRace).toBeNull();
    });

    it('selectedClass: null / 命中 / 未命中 三种情况', () => {
      const store = useBaseStore();
      const c = makeClass();
      store.$patch({ classes: [c] });
      expect(store.selectedClass).toBeNull();
      store.$patch({ selectedClassId: 'warrior' });
      expect(store.selectedClass).toEqual(c);
      store.$patch({ selectedClassId: 'mage' });
      expect(store.selectedClass).toBeNull();
    });
  });

  // -------------------- Getters: 快捷取值 --------------------
  describe('Getters: 快捷取值（含 fallback）', () => {
    it('getRaceIcon/getRaceName 找到返回字段值，未找到返回 fallback', () => {
      const store = useBaseStore();
      store.$patch({ races: [makeRace()] });
      expect(store.getRaceIcon('human')).toBe('game-icons:human');
      expect(store.getRaceName('human')).toBe('人类');
      expect(store.getRaceIcon('orc')).toBe('👤');
      expect(store.getRaceName('orc')).toBe('');
    });

    it('getFactionIcon/getFactionName/getFactionColor 找到返回字段值，未找到返回 fallback', () => {
      const store = useBaseStore();
      store.$patch({ factions: [makeFaction()] });
      expect(store.getFactionIcon('alliance')).toBe('game-icons:checked-shield');
      expect(store.getFactionName('alliance')).toBe('联盟');
      expect(store.getFactionColor('alliance')).toBe('#00ff88');
      expect(store.getFactionIcon('horde')).toBe('game-icons:checked-shield');
      expect(store.getFactionName('horde')).toBe('');
      expect(store.getFactionColor('horde')).toBe('#9d9d9d');
    });

    it('getClassIcon/getClassName/getClassColor 找到返回字段值，未找到返回 fallback', () => {
      const store = useBaseStore();
      store.$patch({ classes: [makeClass()] });
      expect(store.getClassIcon('warrior')).toBe('game-icons:broadsword');
      expect(store.getClassName('warrior')).toBe('战士');
      expect(store.getClassColor('warrior')).toBe('#C79C6E');
      expect(store.getClassIcon('mage')).toBe('game-icons:broadsword');
      expect(store.getClassName('mage')).toBe('');
      expect(store.getClassColor('mage')).toBe('#9d9d9d');
    });
  });

  // -------------------- Actions: load 系列 --------------------
  describe('Actions: load 系列', () => {
    it('loadAllData 并发加载并填充 state，最终 isLoading 为 false', async () => {
      const f = [makeFaction()];
      const r = [makeRace()];
      const c = [makeClass()];
      vi.mocked(baseDbService.getAllFactions).mockResolvedValueOnce(f);
      vi.mocked(baseDbService.getAllRaces).mockResolvedValueOnce(r);
      vi.mocked(baseDbService.getAllClasses).mockResolvedValueOnce(c);

      const store = useBaseStore();
      await store.loadAllData();

      expect(store.factions).toEqual(f);
      expect(store.races).toEqual(r);
      expect(store.classes).toEqual(c);
      expect(store.isLoading).toBe(false);
      expect(baseDbService.getAllFactions).toHaveBeenCalledTimes(1);
      expect(baseDbService.getAllRaces).toHaveBeenCalledTimes(1);
      expect(baseDbService.getAllClasses).toHaveBeenCalledTimes(1);
    });

    it('loadAllData 加载过程中 isLoading 为 true，完成后为 false', async () => {
      let resolveFactions!: () => void;
      vi.mocked(baseDbService.getAllFactions).mockReturnValueOnce(
        new Promise<FactionData[]>(resolve => {
          resolveFactions = () => resolve([]);
        })
      );
      vi.mocked(baseDbService.getAllRaces).mockResolvedValueOnce([]);
      vi.mocked(baseDbService.getAllClasses).mockResolvedValueOnce([]);

      const store = useBaseStore();
      const p = store.loadAllData();
      // 进行中：isLoading 应为 true
      expect(store.isLoading).toBe(true);
      resolveFactions();
      await p;
      expect(store.isLoading).toBe(false);
    });

    it('loadFactions 成功填充', async () => {
      const f = [makeFaction()];
      vi.mocked(baseDbService.getAllFactions).mockResolvedValueOnce(f);
      const store = useBaseStore();
      await store.loadFactions();
      expect(store.factions).toEqual(f);
    });

    it('loadFactions 失败时调用 errorHandler.report 并置空 factions', async () => {
      vi.mocked(baseDbService.getAllFactions).mockRejectedValueOnce(new Error('db error'));
      const store = useBaseStore();
      store.$patch({ factions: [makeFaction()] });
      await store.loadFactions();
      expect(errorHandler.report).toHaveBeenCalledTimes(1);
      expect(store.factions).toEqual([]);
    });

    it('loadRaces 成功填充', async () => {
      const r = [makeRace()];
      vi.mocked(baseDbService.getAllRaces).mockResolvedValueOnce(r);
      const store = useBaseStore();
      await store.loadRaces();
      expect(store.races).toEqual(r);
    });

    it('loadRaces 失败时调用 errorHandler.report 并置空 races', async () => {
      vi.mocked(baseDbService.getAllRaces).mockRejectedValueOnce(new Error('db error'));
      const store = useBaseStore();
      store.$patch({ races: [makeRace()] });
      await store.loadRaces();
      expect(errorHandler.report).toHaveBeenCalledTimes(1);
      expect(store.races).toEqual([]);
    });

    it('loadClasses 成功填充', async () => {
      const c = [makeClass()];
      vi.mocked(baseDbService.getAllClasses).mockResolvedValueOnce(c);
      const store = useBaseStore();
      await store.loadClasses();
      expect(store.classes).toEqual(c);
    });

    it('loadClasses 失败时调用 errorHandler.report 并置空 classes', async () => {
      vi.mocked(baseDbService.getAllClasses).mockRejectedValueOnce(new Error('db error'));
      const store = useBaseStore();
      store.$patch({ classes: [makeClass()] });
      await store.loadClasses();
      expect(errorHandler.report).toHaveBeenCalledTimes(1);
      expect(store.classes).toEqual([]);
    });
  });

  // -------------------- Actions: CRUD - Faction --------------------
  describe('Actions: CRUD - Faction', () => {
    it('createFaction 成功：调用 db.create、emit 事件、调用 load 刷新、返回 true', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.GAME_DATA_UPDATED, spy);

      const store = useBaseStore();
      const result = await store.createFaction({
        name: '新阵营', icon: 'i', color: '#000', description: 'd',
      });

      expect(result).toBe(true);
      expect(baseDbService.createFaction).toHaveBeenCalledTimes(1);
      expect(baseDbService.getAllFactions).toHaveBeenCalledTimes(1); // load 刷新
      expect(spy).toHaveBeenCalledWith({ type: 'faction', action: 'create', id: 'new-id' });
    });

    it('createFaction 失败：errorHandler.report 被调用、返回 false', async () => {
      vi.mocked(baseDbService.createFaction).mockRejectedValueOnce(new Error('fail'));
      const store = useBaseStore();
      const result = await store.createFaction({
        name: 'x', icon: 'i', color: '#000', description: 'd',
      });
      expect(result).toBe(false);
      expect(errorHandler.report).toHaveBeenCalledTimes(1);
    });

    it('updateFaction 成功：emit 事件、调用 load、返回 true', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.GAME_DATA_UPDATED, spy);

      const store = useBaseStore();
      const result = await store.updateFaction('alliance', {
        name: '改', icon: 'i', color: '#000', description: 'd',
      });

      expect(result).toBe(true);
      expect(baseDbService.updateFaction).toHaveBeenCalledWith('alliance', expect.objectContaining({ name: '改' }));
      expect(spy).toHaveBeenCalledWith({ type: 'faction', action: 'update', id: 'alliance' });
    });

    it('updateFaction 失败：返回 false、errorHandler.report 被调用', async () => {
      vi.mocked(baseDbService.updateFaction).mockRejectedValueOnce(new Error('fail'));
      const store = useBaseStore();
      const result = await store.updateFaction('alliance', {
        name: 'x', icon: 'i', color: '#000', description: 'd',
      });
      expect(result).toBe(false);
      expect(errorHandler.report).toHaveBeenCalledTimes(1);
    });

    it('deleteFaction 成功返回 true 并 emit 事件', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.GAME_DATA_UPDATED, spy);

      const store = useBaseStore();
      const result = await store.deleteFaction('alliance');

      expect(result).toBe(true);
      expect(baseDbService.deleteFaction).toHaveBeenCalledWith('alliance');
      expect(spy).toHaveBeenCalledWith({ type: 'faction', action: 'delete', id: 'alliance' });
    });

    it('deleteFaction 删除当前选中项时 selectedFactionId 置 null', async () => {
      const store = useBaseStore();
      store.$patch({ selectedFactionId: 'alliance' });
      await store.deleteFaction('alliance');
      expect(store.selectedFactionId).toBeNull();
    });

    it('deleteFaction 删除非选中项时 selectedFactionId 保持不变', async () => {
      const store = useBaseStore();
      store.$patch({ selectedFactionId: 'alliance' });
      await store.deleteFaction('horde');
      expect(store.selectedFactionId).toBe('alliance');
    });

    it('deleteFaction 失败返回 false 且 errorHandler.report 被调用', async () => {
      vi.mocked(baseDbService.deleteFaction).mockRejectedValueOnce(new Error('fail'));
      const store = useBaseStore();
      const result = await store.deleteFaction('alliance');
      expect(result).toBe(false);
      expect(errorHandler.report).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------- Actions: CRUD - Race --------------------
  describe('Actions: CRUD - Race', () => {
    it('createRace 成功：调用 db.create、emit 事件、调用 load、返回 true', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.GAME_DATA_UPDATED, spy);

      const store = useBaseStore();
      const result = await store.createRace({
        name: '新种族', icon: 'i', factionId: 'alliance', description: 'd',
      });

      expect(result).toBe(true);
      expect(baseDbService.createRace).toHaveBeenCalledTimes(1);
      expect(baseDbService.getAllRaces).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ type: 'race', action: 'create', id: 'new-id' });
    });

    it('createRace 失败：返回 false、errorHandler.report 被调用', async () => {
      vi.mocked(baseDbService.createRace).mockRejectedValueOnce(new Error('fail'));
      const store = useBaseStore();
      const result = await store.createRace({
        name: 'x', icon: 'i', factionId: 'alliance', description: 'd',
      });
      expect(result).toBe(false);
      expect(errorHandler.report).toHaveBeenCalledTimes(1);
    });

    it('updateRace 成功：emit 事件、返回 true', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.GAME_DATA_UPDATED, spy);

      const store = useBaseStore();
      const result = await store.updateRace('human', {
        name: '改', icon: 'i', factionId: 'alliance', description: 'd',
      });

      expect(result).toBe(true);
      expect(spy).toHaveBeenCalledWith({ type: 'race', action: 'update', id: 'human' });
    });

    it('updateRace 失败：返回 false', async () => {
      vi.mocked(baseDbService.updateRace).mockRejectedValueOnce(new Error('fail'));
      const store = useBaseStore();
      const result = await store.updateRace('human', {
        name: 'x', icon: 'i', factionId: 'alliance', description: 'd',
      });
      expect(result).toBe(false);
      expect(errorHandler.report).toHaveBeenCalledTimes(1);
    });

    it('deleteRace 成功返回 true 并 emit 事件', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.GAME_DATA_UPDATED, spy);

      const store = useBaseStore();
      const result = await store.deleteRace('human');

      expect(result).toBe(true);
      expect(spy).toHaveBeenCalledWith({ type: 'race', action: 'delete', id: 'human' });
    });

    it('deleteRace 删除当前选中项时 selectedRaceId 置 null', async () => {
      const store = useBaseStore();
      store.$patch({ selectedRaceId: 'human' });
      await store.deleteRace('human');
      expect(store.selectedRaceId).toBeNull();
    });

    it('deleteRace 删除非选中项时 selectedRaceId 保持不变', async () => {
      const store = useBaseStore();
      store.$patch({ selectedRaceId: 'human' });
      await store.deleteRace('orc');
      expect(store.selectedRaceId).toBe('human');
    });

    it('deleteRace 失败返回 false', async () => {
      vi.mocked(baseDbService.deleteRace).mockRejectedValueOnce(new Error('fail'));
      const store = useBaseStore();
      const result = await store.deleteRace('human');
      expect(result).toBe(false);
      expect(errorHandler.report).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------- Actions: CRUD - Class --------------------
  describe('Actions: CRUD - Class', () => {
    const classInput = {
      name: '新职业', icon: 'i', primaryStat: 'str' as const,
      factionsIds: ['alliance'], raceIds: ['human'], description: 'd', color: '#000',
    };

    it('createClass 成功：调用 db.create、emit 事件、调用 load、返回 true', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.GAME_DATA_UPDATED, spy);

      const store = useBaseStore();
      const result = await store.createClass(classInput);

      expect(result).toBe(true);
      expect(baseDbService.createClass).toHaveBeenCalledTimes(1);
      expect(baseDbService.getAllClasses).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ type: 'class', action: 'create', id: 'new-id' });
    });

    it('createClass 失败：返回 false、errorHandler.report 被调用', async () => {
      vi.mocked(baseDbService.createClass).mockRejectedValueOnce(new Error('fail'));
      const store = useBaseStore();
      const result = await store.createClass(classInput);
      expect(result).toBe(false);
      expect(errorHandler.report).toHaveBeenCalledTimes(1);
    });

    it('updateClass 成功：emit 事件、返回 true', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.GAME_DATA_UPDATED, spy);

      const store = useBaseStore();
      const result = await store.updateClass('warrior', classInput);

      expect(result).toBe(true);
      expect(spy).toHaveBeenCalledWith({ type: 'class', action: 'update', id: 'warrior' });
    });

    it('updateClass 失败：返回 false', async () => {
      vi.mocked(baseDbService.updateClass).mockRejectedValueOnce(new Error('fail'));
      const store = useBaseStore();
      const result = await store.updateClass('warrior', classInput);
      expect(result).toBe(false);
      expect(errorHandler.report).toHaveBeenCalledTimes(1);
    });

    it('deleteClass 成功返回 true 并 emit 事件', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.GAME_DATA_UPDATED, spy);

      const store = useBaseStore();
      const result = await store.deleteClass('warrior');

      expect(result).toBe(true);
      expect(spy).toHaveBeenCalledWith({ type: 'class', action: 'delete', id: 'warrior' });
    });

    it('deleteClass 删除当前选中项时 selectedClassId 置 null', async () => {
      const store = useBaseStore();
      store.$patch({ selectedClassId: 'warrior' });
      await store.deleteClass('warrior');
      expect(store.selectedClassId).toBeNull();
    });

    it('deleteClass 删除非选中项时 selectedClassId 保持不变', async () => {
      const store = useBaseStore();
      store.$patch({ selectedClassId: 'warrior' });
      await store.deleteClass('mage');
      expect(store.selectedClassId).toBe('warrior');
    });

    it('deleteClass 失败返回 false', async () => {
      vi.mocked(baseDbService.deleteClass).mockRejectedValueOnce(new Error('fail'));
      const store = useBaseStore();
      const result = await store.deleteClass('warrior');
      expect(result).toBe(false);
      expect(errorHandler.report).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------- Actions: select 系列 --------------------
  describe('Actions: select 系列', () => {
    it('selectFaction(id) 设置 selectedFactionId 并级联清空 selectedRaceId/selectedClassId', () => {
      const store = useBaseStore();
      store.$patch({ selectedRaceId: 'human', selectedClassId: 'warrior' });

      store.selectFaction('alliance');

      expect(store.selectedFactionId).toBe('alliance');
      expect(store.selectedRaceId).toBeNull();
      expect(store.selectedClassId).toBeNull();
    });

    it('selectFaction(null) 仅设置 selectedFactionId 为 null，不清空其它', () => {
      const store = useBaseStore();
      store.$patch({ selectedFactionId: 'alliance', selectedRaceId: 'human', selectedClassId: 'warrior' });

      store.selectFaction(null);

      expect(store.selectedFactionId).toBeNull();
      expect(store.selectedRaceId).toBe('human');
      expect(store.selectedClassId).toBe('warrior');
    });

    it('selectRace(id) 设置 selectedRaceId 并清空 selectedClassId', () => {
      const store = useBaseStore();
      store.$patch({ selectedClassId: 'warrior' });

      store.selectRace('human');

      expect(store.selectedRaceId).toBe('human');
      expect(store.selectedClassId).toBeNull();
    });

    it('selectRace(null) 仅设置 selectedRaceId 为 null，不清空 selectedClassId', () => {
      const store = useBaseStore();
      store.$patch({ selectedRaceId: 'human', selectedClassId: 'warrior' });

      store.selectRace(null);

      expect(store.selectedRaceId).toBeNull();
      expect(store.selectedClassId).toBe('warrior');
    });

    it('selectClass(id) 仅设置 selectedClassId', () => {
      const store = useBaseStore();
      store.selectClass('warrior');
      expect(store.selectedClassId).toBe('warrior');
    });

    it('resetSelection 三个 selectedId 全部置 null', () => {
      const store = useBaseStore();
      store.$patch({ selectedFactionId: 'alliance', selectedRaceId: 'human', selectedClassId: 'warrior' });

      store.resetSelection();

      expect(store.selectedFactionId).toBeNull();
      expect(store.selectedRaceId).toBeNull();
      expect(store.selectedClassId).toBeNull();
    });
  });

  // -------------------- Actions: initialize --------------------
  describe('Actions: initialize', () => {
    it('调用 loadAllData 并 emit GAME_DATA_UPDATED (type:base, action:bulk, id:*)', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.GAME_DATA_UPDATED, spy);

      const store = useBaseStore();
      await store.initialize();

      // loadAllData 触发一次并发加载
      expect(baseDbService.getAllFactions).toHaveBeenCalledTimes(1);
      expect(baseDbService.getAllRaces).toHaveBeenCalledTimes(1);
      expect(baseDbService.getAllClasses).toHaveBeenCalledTimes(1);
      // initialize 末尾 emit bulk 事件
      expect(spy).toHaveBeenCalledWith({ type: 'base', action: 'bulk', id: '*' });
      expect(store.isLoading).toBe(false);
    });
  });
});
