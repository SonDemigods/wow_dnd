/**
 * @fileoverview 冒险日志模块 Pinia Store 单元测试
 *
 * 覆盖 useLogStore 的：
 * 1. State 初始值（logs 空数组、logCount/totalPages 派生为 0）
 * 2. Getters：logCount / totalPages（分页计算与边界）
 * 3. Actions：
 *    - initialize（设置角色 ID 并从 DB 加载 entries / DB 返回 null 时置空）
 *    - addLogEntry（格式化 → 头部插入 → 持久化 → emit LOG_ENTRY_ADDED；
 *      持久化失败上报 errorHandler 但仍 emit；未初始化角色时不持久化）
 *    - getLogs / getLogsByType / getPaginatedLogs（分页边界）
 *    - clearLogs（清空并持久化）
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - adventureLogDbService 全量 mock，避免触碰真实 IndexedDB。
 *  - errorHandler mock，仅断言 report 被调用。
 *  - eventBus 使用真实实现，通过 eventBus.on(LOG_ENTRY_ADDED, spy) 断言 emit，
 *    beforeEach 调用 eventBus.clearAll() 清理监听器。
 *  - formatLogMessage 为纯函数（仅补全图标），按任务要求使用真实实现；PAGE_SIZE 同样使用真实常量。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestPinia } from '../utils/setup';
import { eventBus, GameEvents } from '@/modules/bus';
import type { LogEntry, LogType } from '@/modules/log/types';

/** P3-153 扩展：gameStore mock，currentCharacterId 由测试控制 */
const mocks = vi.hoisted(() => ({
  gameStore: {
    currentCharacterId: null as string | null,
  },
}));

vi.mock('@/modules/game', () => ({
  useGameStore: () => mocks.gameStore,
}));

/** mock 日志 DB 层 */
vi.mock('@/modules/log/db', () => ({
  adventureLogDbService: {
    saveAdventureLog: vi.fn().mockResolvedValue(undefined),
    getAdventureLog: vi.fn().mockResolvedValue(null),
  },
}));

/** mock 错误处理器 */
vi.mock('@/services/ErrorHandler', () => ({
  errorHandler: { report: vi.fn() },
}));

/** 从 mock 中取出 spy 引用，便于断言 */
import { adventureLogDbService } from '@/modules/log/db';
import { errorHandler } from '@/services/ErrorHandler';
import { useLogStore } from '@/modules/log/store';
import { PAGE_SIZE, MAX_LOG_ENTRIES } from '@/config/log';

// ==================== 测试数据构造 helper ====================

function makeLogEntry(o: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 'log-1',
    timestamp: 1000,
    type: 'info',
    message: '一条日志',
    icon: 'game-icons:info',
    ...o,
  } as LogEntry;
}

/** 批量构造 n 条日志 */
function makeLogs(n: number, type: LogType = 'info'): LogEntry[] {
  return Array.from({ length: n }, (_, i) => makeLogEntry({
    id: `log-${i}`,
    timestamp: 1000 + i,
    message: `日志${i}`,
    type,
  }));
}

// ==================== 测试用例 ====================

describe('useLogStore - 冒险日志 Store', () => {
  beforeEach(() => {
    createTestPinia();
    vi.clearAllMocks();
    eventBus.clearAll();
    mocks.gameStore.currentCharacterId = null;
  });

  // -------------------- State 初始值 --------------------
  describe('State 初始值', () => {
    it('logs 初始为空数组', () => {
      const store = useLogStore();
      expect(store.logs).toEqual([]);
    });

    it('logCount 初始为 0', () => {
      const store = useLogStore();
      expect(store.logCount).toBe(0);
    });

    it('totalPages 初始为 0', () => {
      const store = useLogStore();
      expect(store.totalPages).toBe(0);
    });
  });

  // -------------------- Getters --------------------
  describe('Getters', () => {
    it('logCount 等于 logs 长度', () => {
      const store = useLogStore();
      store.$patch({ logs: makeLogs(3) });
      expect(store.logCount).toBe(3);
    });

    it('totalPages：空列表为 0', () => {
      const store = useLogStore();
      expect(store.totalPages).toBe(0);
    });

    it(`totalPages：PAGE_SIZE=${PAGE_SIZE} 条恰好 1 页`, () => {
      const store = useLogStore();
      store.$patch({ logs: makeLogs(PAGE_SIZE) });
      expect(store.totalPages).toBe(1);
    });

    it('totalPages：PAGE_SIZE+1 条为 2 页（向上取整）', () => {
      const store = useLogStore();
      store.$patch({ logs: makeLogs(PAGE_SIZE + 1) });
      expect(store.totalPages).toBe(2);
    });

    it('totalPages：2*PAGE_SIZE 条为 2 页', () => {
      const store = useLogStore();
      store.$patch({ logs: makeLogs(PAGE_SIZE * 2) });
      expect(store.totalPages).toBe(2);
    });
  });

  // -------------------- Action: initialize --------------------
  describe('Action: initialize', () => {
    it('DB 有数据时加载 entries 到 logs', async () => {
      const entries = makeLogs(2);
      vi.mocked(adventureLogDbService.getAdventureLog).mockResolvedValueOnce({
        characterId: 'c1', entries, updatedAt: 1,
      });
      const store = useLogStore();
      mocks.gameStore.currentCharacterId = 'c1';
      await store.initialize('c1');

      expect(adventureLogDbService.getAdventureLog).toHaveBeenCalledWith('c1');
      expect(store.logs).toEqual(entries);
    });

    it('DB 返回 null 时 logs 为空', async () => {
      vi.mocked(adventureLogDbService.getAdventureLog).mockResolvedValueOnce(null);
      const store = useLogStore();
      mocks.gameStore.currentCharacterId = 'c1';
      await store.initialize('c1');
      expect(store.logs).toEqual([]);
    });

    it('DB 返回数据但 entries 缺失时 logs 为空', async () => {
      vi.mocked(adventureLogDbService.getAdventureLog).mockResolvedValueOnce({
        characterId: 'c1', entries: undefined as unknown as LogEntry[], updatedAt: 1,
      });
      const store = useLogStore();
      mocks.gameStore.currentCharacterId = 'c1';
      await store.initialize('c1');
      expect(store.logs).toEqual([]);
    });

    it('BIZ-12：历史数据超过 MAX_LOG_ENTRIES 时加载后裁剪尾部', async () => {
      // 模拟历史持久化数据超过容量上限（上限保护引入前的旧数据）
      const overflow = MAX_LOG_ENTRIES + 50;
      vi.mocked(adventureLogDbService.getAdventureLog).mockResolvedValueOnce({
        characterId: 'c1', entries: makeLogs(overflow), updatedAt: 1,
      });
      const store = useLogStore();
      mocks.gameStore.currentCharacterId = 'c1';
      await store.initialize('c1');

      expect(store.logCount).toBe(MAX_LOG_ENTRIES);
      // 前部条目（log-0）保留，尾部条目（log-(overflow-1)）被裁剪
      expect(store.logs.find(l => l.id === 'log-0')).toBeDefined();
      expect(store.logs.find(l => l.id === `log-${overflow - 1}`)).toBeUndefined();
    });
  });

  // -------------------- Action: addLogEntry --------------------
  describe('Action: addLogEntry', () => {
    it('格式化后插入头部、持久化、emit LOG_ENTRY_ADDED', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.LOG_ENTRY_ADDED, spy);

      const store = useLogStore();
      // P3-153 扩展：通过 gameStore 设置 currentCharacterId 以触发持久化
      mocks.gameStore.currentCharacterId = 'c1';
      vi.mocked(adventureLogDbService.getAdventureLog).mockResolvedValueOnce(null);
      await store.initialize('c1');
      // initialize 后再 patch logs，避免被 initialize 清空
      store.$patch({ logs: [makeLogEntry({ id: 'old', message: '旧日志' })] });

      const entry = makeLogEntry({ id: 'new', message: '新日志', type: 'combat' });
      await store.addLogEntry(entry);

      // 头部插入
      expect(store.logs[0].id).toBe('new');
      expect(store.logs[1].id).toBe('old');
      expect(store.logCount).toBe(2);
      // 持久化（currentCharacterId 已设置）
      expect(adventureLogDbService.saveAdventureLog).toHaveBeenCalledWith('c1', store.logs);
      // emit 事件携带格式化后的字段
      expect(spy).toHaveBeenCalledWith({
        type: 'combat',
        message: '新日志',
        icon: 'game-icons:info',
      });
    });

    it('未初始化角色（currentCharacterId 为 null）时不调用持久化但仍 emit', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.LOG_ENTRY_ADDED, spy);

      const store = useLogStore();
      await store.addLogEntry(makeLogEntry({ id: 'new', message: 'm' }));

      expect(adventureLogDbService.saveAdventureLog).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(store.logCount).toBe(1);
    });

    it('持久化失败时调用 errorHandler.report 但仍 emit 事件', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.LOG_ENTRY_ADDED, spy);
      vi.mocked(adventureLogDbService.saveAdventureLog).mockRejectedValueOnce(new Error('db fail'));

      const store = useLogStore();
      mocks.gameStore.currentCharacterId = 'c1';
      vi.mocked(adventureLogDbService.getAdventureLog).mockResolvedValueOnce(null);
      await store.initialize('c1');

      await store.addLogEntry(makeLogEntry({ id: 'new', message: 'm' }));

      expect(errorHandler.report).toHaveBeenCalledTimes(1);
      // 日志仍写入内存
      expect(store.logCount).toBe(1);
      // 事件仍触发
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('缺少 icon 的条目经 formatLogMessage 补全默认图标后 emit', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.LOG_ENTRY_ADDED, spy);
      const store = useLogStore();
      const entry: LogEntry = {
        id: 'new', timestamp: 1, type: 'combat', message: '战斗', // 无 icon
      };
      await store.addLogEntry(entry);
      // combat 类型默认图标
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'combat',
        icon: 'game-icons:crossed-swords',
      }));
      expect(store.logs[0].icon).toBe('game-icons:crossed-swords');
    });

    it('BIZ-12：超过 MAX_LOG_ENTRIES 时裁剪尾部最旧日志', async () => {
      const store = useLogStore();
      // 预置 MAX_LOG_ENTRIES 条日志（makeLogs 生成 log-0 ~ log-(MAX-1)）
      store.$patch({ logs: makeLogs(MAX_LOG_ENTRIES) });
      expect(store.logCount).toBe(MAX_LOG_ENTRIES);

      // 新增一条 → 总数 MAX+1，裁剪尾部 1 条
      await store.addLogEntry(makeLogEntry({ id: 'new', message: '新日志' }));

      expect(store.logCount).toBe(MAX_LOG_ENTRIES);
      // 新日志在头部
      expect(store.logs[0].id).toBe('new');
      // 尾部最后一条（log-(MAX-1)）应被裁剪
      expect(store.logs.find(l => l.id === `log-${MAX_LOG_ENTRIES - 1}`)).toBeUndefined();
      // 前部条目（log-0）应保留
      expect(store.logs.find(l => l.id === 'log-0')).toBeDefined();
    });
  });

  // -------------------- Action: getLogs / getLogsByType --------------------
  describe('Action: getLogs / getLogsByType', () => {
    it('getLogs 返回全部日志', () => {
      const store = useLogStore();
      const logs = [
        makeLogEntry({ id: '1', type: 'info' }),
        makeLogEntry({ id: '2', type: 'combat' }),
      ];
      store.$patch({ logs });
      expect(store.getLogs()).toEqual(logs);
    });

    it('getLogsByType 按类型过滤', () => {
      const store = useLogStore();
      store.$patch({
        logs: [
          makeLogEntry({ id: '1', type: 'info' }),
          makeLogEntry({ id: '2', type: 'combat' }),
          makeLogEntry({ id: '3', type: 'combat' }),
          makeLogEntry({ id: '4', type: 'quest' }),
        ],
      });
      const combat = store.getLogsByType('combat');
      expect(combat).toHaveLength(2);
      expect(combat.map(l => l.id)).toEqual(['2', '3']);
      expect(store.getLogsByType('death')).toEqual([]);
    });
  });

  // -------------------- Action: getPaginatedLogs --------------------
  describe('Action: getPaginatedLogs', () => {
    it('返回指定页的日志切片', () => {
      const store = useLogStore();
      store.$patch({ logs: makeLogs(120) });
      const page0 = store.getPaginatedLogs(0);
      expect(page0).toHaveLength(PAGE_SIZE);
      expect(page0[0].id).toBe('log-0');
    });

    it('第二页返回后续切片', () => {
      const store = useLogStore();
      store.$patch({ logs: makeLogs(120) });
      const page1 = store.getPaginatedLogs(1);
      expect(page1).toHaveLength(PAGE_SIZE);
      expect(page1[0].id).toBe(`log-${PAGE_SIZE}`);
    });

    it('超过总页数的页码返回空数组', () => {
      const store = useLogStore();
      store.$patch({ logs: makeLogs(60) }); // 2 页
      expect(store.getPaginatedLogs(2)).toEqual([]);
      expect(store.getPaginatedLogs(99)).toEqual([]);
    });

    it('自定义 pageSize 生效', () => {
      const store = useLogStore();
      store.$patch({ logs: makeLogs(25) });
      const page0 = store.getPaginatedLogs(0, 10);
      expect(page0).toHaveLength(10);
      const page2 = store.getPaginatedLogs(2, 10);
      expect(page2).toHaveLength(5);
    });
  });

  // -------------------- Action: clearLogs --------------------
  describe('Action: clearLogs', () => {
    it('清空 logs 并持久化', async () => {
      const store = useLogStore();
      mocks.gameStore.currentCharacterId = 'c1';
      vi.mocked(adventureLogDbService.getAdventureLog).mockResolvedValueOnce(null);
      await store.initialize('c1');
      store.$patch({ logs: makeLogs(3) });

      await store.clearLogs();

      expect(store.logs).toEqual([]);
      expect(store.logCount).toBe(0);
      expect(store.totalPages).toBe(0);
      expect(adventureLogDbService.saveAdventureLog).toHaveBeenCalledWith('c1', []);
    });

    it('未初始化角色时不持久化但内存已清空', async () => {
      const store = useLogStore();
      store.$patch({ logs: makeLogs(2) });
      await store.clearLogs();
      expect(store.logs).toEqual([]);
      expect(adventureLogDbService.saveAdventureLog).not.toHaveBeenCalled();
    });

    it('持久化失败时调用 errorHandler.report 且内存仍清空', async () => {
      vi.mocked(adventureLogDbService.saveAdventureLog).mockRejectedValueOnce(new Error('fail'));
      const store = useLogStore();
      mocks.gameStore.currentCharacterId = 'c1';
      vi.mocked(adventureLogDbService.getAdventureLog).mockResolvedValueOnce(null);
      await store.initialize('c1');
      store.$patch({ logs: makeLogs(2) });

      await store.clearLogs();

      expect(store.logs).toEqual([]);
      expect(errorHandler.report).toHaveBeenCalledTimes(1);
    });
  });
});
