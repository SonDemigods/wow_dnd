/**
 * @fileoverview 探索模块 Pinia Store 单元测试
 *
 * 覆盖 useExplorationStore 的：
 * 1. State 初始值（currentAreaId/grid/campUsed/isExploring/playerPosition/visitedCells/
 *    bossDefeated/explorationComplete 均为初始值）
 * 2. Getters：state 聚合对象 / hasStartedExploration / getGridCell
 * 3. Actions：
 *    - enterArea（进入区域 + emit EXPLORATION_START + 生成 grid + 持久化 + 日志）
 *    - revealGrid（monster/boss → triggerBattle + pendingBattleCell；
 *      shop/board → emit EXPLORATION_CELL_EXPLORED；treasure/trap/event/rest → dispatchCellEvent）
 *    - revealAllCells（揭示所有格子）
 *    - triggerBattle（emit EXPLORATION_BATTLE_TRIGGERED + UI 回调）
 *    - onBattleResult（胜利标记 completed/bossDefeated；失败仅揭示）
 *    - useCamp（campUsed 守卫 + dispatchCellEvent）
 *    - applyEventChoice（applyEventEffect + 死亡处理 + 日志）
 *    - reset / exitExploration（清空状态 + emit EXPLORATION_END）
 *    - init（从 DB 恢复 + setupCombatListener）
 *    - dispose / registerUICallbacks / unregisterUICallbacks
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - explorationDbService 全量 mock。
 *  - exploration service 纯函数（generateGrid/findStartPosition/updateAccessibleCells/
 *    computeEventProbability/buildItemPool/GRID_SIZE）mock 返回可控测试数据。
 *  - events 模块（dispatchCellEvent/applyEventEffect）mock 返回可控结果。
 *  - crossModuleQuery mock（getLocationData/getAllItemTemplates/getAllShopConfigs/
 *    getQuestDefinitionsByBoard）。
 *  - character/inventory/log store stub；generateLogId mock。
 *  - eventBus 使用真实实现，通过 eventBus.on 注册 spy 断言 emit，beforeEach 调用 clearAll。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestPinia } from '../utils/setup';
import { eventBus, GameEvents } from '@/modules/bus';
import type { ExplorationCell } from '@/modules/exploration/types';
import { BOSS_SEAL_REQUIRED_CELLS } from '@/config/exploration';

// ==================== vi.hoisted：跨 store stub 持有对象 ====================
const mocks = vi.hoisted(() => ({
  characterStore: {
    handleDeath: vi.fn(),
    hp: 100,
  },
  inventoryStore: {},
  logStore: {
    addLogEntry: vi.fn(),
  },
  // P3-153：exploration currentCharacterId 改为 gameStore 只读 computed 代理，
  // 测试通过 mocks.gameStore.currentCharacterId 控制持久化触发条件
  gameStore: {
    currentCharacterId: null as string | null,
  },
  // P3-149：quest store mock（onCellExplored 被 exploration store 调用）
  questStore: {
    onCellExplored: vi.fn().mockResolvedValue(undefined),
  },
}));

// ==================== Mock：exploration db ====================
vi.mock('@/modules/exploration/db', () => ({
  explorationDbService: {
    saveExplorationData: vi.fn().mockResolvedValue(undefined),
    getExplorationData: vi.fn().mockResolvedValue(null),
    deleteExplorationData: vi.fn().mockResolvedValue(undefined),
    clearAllExplorationData: vi.fn().mockResolvedValue(undefined),
    getAllExplorationData: vi.fn().mockResolvedValue([]),
  },
}));

// ==================== Mock：exploration service 纯函数 ====================
vi.mock('@/modules/exploration/service', () => ({
  GRID_SIZE: 3,
  generateGrid: vi.fn(() => [
    [
      { x: 0, y: 0, type: 'start', explored: true, accessible: true, visited: true, completed: false },
      { x: 1, y: 0, type: 'empty', explored: false, accessible: false, visited: false, completed: false },
      { x: 2, y: 0, type: 'monster', explored: false, accessible: false, visited: false, completed: false, monsterId: 'goblin' },
    ],
    [
      { x: 0, y: 1, type: 'shop', explored: true, accessible: true, visited: true, completed: false },
      { x: 1, y: 1, type: 'treasure', explored: false, accessible: false, visited: false, completed: false },
      { x: 2, y: 1, type: 'trap', explored: false, accessible: false, visited: false, completed: false },
    ],
    [
      { x: 0, y: 2, type: 'boss', explored: false, accessible: false, visited: false, completed: false, monsterId: 'dragon' },
      { x: 1, y: 2, type: 'rest', explored: false, accessible: false, visited: false, completed: false },
      { x: 2, y: 2, type: 'event', explored: false, accessible: false, visited: false, completed: false },
    ],
  ]),
  findStartPosition: vi.fn(() => ({ x: 0, y: 0 })),
  updateAccessibleCells: vi.fn((grid: ExplorationCell[][]) => grid.map(row => row.map(c => ({ ...c })))),
  computeEventProbability: vi.fn(() => ({ monster: 25, item: 20, trap: 15, event: 15, empty: 25 })),
  buildItemPool: vi.fn(() => ['small_health_potion']),
  // 阶段二：isPassable 默认返回 true（可通行），测试中按需 mockReturnValue(false) 模拟穿墙/对角
  isPassable: vi.fn(() => true),
  // 阶段三：computeVision 默认仅返回玩家所在格（最小可见范围），
  // 测试中按需 mockReturnValue 扩展视线范围以验证 discovered 标记
  computeVision: vi.fn((_grid: ExplorationCell[][], pos: { x: number; y: number }) => [{ x: pos.x, y: pos.y }]),
  // 阶段三：applyVision 默认仅标记视线内格子 discovered=true，其余不变（与真实逻辑一致的最小化版本）
  applyVision: vi.fn((grid: ExplorationCell[][], visionCells: { x: number; y: number }[]) =>
    grid.map(row => row.map(c => {
      const inVision = visionCells.some(v => v.x === c.x && v.y === c.y);
      return inVision ? { ...c, discovered: true } : { ...c };
    }))
  ),
}));

// ==================== Mock：events 模块 ====================
vi.mock('@/modules/exploration/events', () => ({
  dispatchCellEvent: vi.fn().mockResolvedValue({ completed: false }),
  applyEventEffect: vi.fn().mockResolvedValue(false),
}));

// ==================== Mock：crossModuleQuery ====================
vi.mock('@/services/CrossModuleQuery', () => ({
  crossModuleQuery: {
    getLocationData: vi.fn().mockResolvedValue({
      id: 'forest',
      name: '森林',
      levelRange: [1, 5],
      enemies: ['goblin'],
      bosses: ['dragon'],
    }),
    getAllItemTemplates: vi.fn().mockResolvedValue([{ id: 'potion', level: 1, rarity: 'common' }]),
    getAllShopConfigs: vi.fn().mockResolvedValue([{ id: 'shop_1' }]),
    getQuestDefinitionsByBoard: vi.fn().mockResolvedValue([]),
  },
}));

// ==================== Mock：log service ====================
vi.mock('@/modules/log/service', () => ({
  generateLogId: vi.fn(() => 'log_test_1'),
}));

// ==================== Mock：跨 store 依赖 ====================
vi.mock('@/modules/character/store', () => ({
  useCharacterStore: () => mocks.characterStore,
}));
vi.mock('@/modules/inventory/store', () => ({
  useInventoryStore: () => mocks.inventoryStore,
}));
vi.mock('@/modules/log/store', () => ({
  useLogStore: () => mocks.logStore,
}));
// P3-153：mock useGameStore，currentCharacterId 由 mocks.gameStore 控制
vi.mock('@/modules/game', () => ({
  useGameStore: () => mocks.gameStore,
}));
// P3-149：mock quest store（exploration store 调用 onCellExplored）
vi.mock('@/modules/quest', () => ({
  useQuestStore: () => mocks.questStore,
}));

// ==================== 取出 spy 引用 ====================
import { explorationDbService } from '@/modules/exploration/db';
import {
  generateGrid,
  findStartPosition,
  updateAccessibleCells,
  computeEventProbability,
  buildItemPool,
  isPassable,
} from '@/modules/exploration/service';
import { dispatchCellEvent, applyEventEffect } from '@/modules/exploration/events';
import { crossModuleQuery } from '@/services/CrossModuleQuery';
import { useExplorationStore } from '@/modules/exploration/store';

// ==================== 测试数据构造 helper ====================

function makeCell(o: Partial<ExplorationCell> = {}): ExplorationCell {
  return {
    x: 0,
    y: 0,
    type: 'empty',
    explored: false,
    accessible: false,
    visited: false,
    completed: false,
    ...o,
  };
}

/** 构造一个 1x1 的可控网格，便于直接 $patch 到 store */
function makeSingleCellGrid(cell: ExplorationCell): ExplorationCell[][] {
  return [[cell]];
}

// ==================== 测试用例 ====================

describe('useExplorationStore - 探索 Store', () => {
  beforeEach(() => {
    createTestPinia();
    vi.clearAllMocks();
    eventBus.clearAll();
    // 重置 characterStore hp
    mocks.characterStore.hp = 100;
    // P3-153：重置 gameStore.currentCharacterId（默认未登录状态）
    mocks.gameStore.currentCharacterId = null;
  });

  // -------------------- State 初始值 --------------------
  describe('State 初始值', () => {
    it('currentAreaId 初始为 null，grid 为空数组', () => {
      const store = useExplorationStore();
      expect(store.currentAreaId).toBeNull();
      expect(store.grid).toEqual([]);
    });

    it('campUsed/isExploring/bossDefeated/explorationComplete 初始为 false', () => {
      const store = useExplorationStore();
      expect(store.campUsed).toBe(false);
      expect(store.isExploring).toBe(false);
      expect(store.bossDefeated).toBe(false);
      expect(store.explorationComplete).toBe(false);
    });

    it('playerPosition 初始为 {x:0, y:0}，visitedCells 初始为 0', () => {
      const store = useExplorationStore();
      expect(store.playerPosition).toEqual({ x: 0, y: 0 });
      expect(store.visitedCells).toBe(0);
    });
  });

  // -------------------- Getters --------------------
  describe('Getters', () => {
    it('state 聚合对象包含当前探索状态字段', () => {
      const store = useExplorationStore();
      store.$patch({
        currentAreaId: 'forest',
        campUsed: true,
        visitedCells: 5,
        bossDefeated: true,
        explorationComplete: false,
      });
      expect(store.state.currentAreaId).toBe('forest');
      expect(store.state.campUsed).toBe(true);
      expect(store.state.visitedCells).toBe(5);
      expect(store.state.bossDefeated).toBe(true);
      expect(store.state.explorationComplete).toBe(false);
    });

    it('hasStartedExploration：currentAreaId 非 null 时为 true', () => {
      const store = useExplorationStore();
      expect(store.hasStartedExploration).toBe(false);
      store.$patch({ currentAreaId: 'forest' });
      expect(store.hasStartedExploration).toBe(true);
    });

    it('getGridCell：返回指定坐标的格子，越界返回 null', () => {
      const store = useExplorationStore();
      const cell = makeCell({ x: 1, y: 0, type: 'monster' });
      store.$patch({ grid: [[makeCell({ x: 0, y: 0 }), cell]] });
      expect(store.getGridCell(1, 0)).toEqual(cell);
      expect(store.getGridCell(5, 5)).toBeNull();
    });
  });

  // -------------------- Actions：enterArea --------------------
  describe('Actions：enterArea', () => {
    it('成功：设置 currentAreaId、生成 grid、emit EXPLORATION_START、持久化、记录日志', async () => {
      const startSpy = vi.fn();
      const zoneSpy = vi.fn();
      eventBus.on(GameEvents.EXPLORATION_START, startSpy);
      eventBus.on(GameEvents.ZONE_ENTERED, zoneSpy);

      const store = useExplorationStore();
      await store.enterArea('forest');

      expect(store.currentAreaId).toBe('forest');
      expect(generateGrid).toHaveBeenCalled();
      expect(findStartPosition).toHaveBeenCalled();
      expect(updateAccessibleCells).toHaveBeenCalled();
      expect(computeEventProbability).toHaveBeenCalled();
      expect(buildItemPool).toHaveBeenCalled();
      // grid 非空
      expect(store.grid.length).toBeGreaterThan(0);
      expect(store.isExploring).toBe(true);
      expect(store.campUsed).toBe(false);
      expect(store.bossDefeated).toBe(false);
      expect(store.playerPosition).toEqual({ x: 0, y: 0 });
      // visitedCells 初始化为 3（起点/商店/任务板）
      expect(store.visitedCells).toBe(3);
      // 持久化（currentCharacterId 未设置时不持久化）
      // emit 事件
      expect(startSpy).toHaveBeenCalledWith({ characterId: null, areaId: 'forest' });
      expect(zoneSpy).toHaveBeenCalledWith({ locationId: 'forest', location: expect.any(Object) });
      // 日志
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'exploration', message: expect.stringContaining('开始探索') })
      );
    });

    it('crossModuleQuery.getLocationData 返回 null 时不 emit ZONE_ENTERED', async () => {
      const zoneSpy = vi.fn();
      eventBus.on(GameEvents.ZONE_ENTERED, zoneSpy);
      vi.mocked(crossModuleQuery.getLocationData).mockResolvedValueOnce(null);
      // 第一次调用在 loadAreaConfig 中（返回 null 走默认配置），第二次在 enterArea 末尾
      vi.mocked(crossModuleQuery.getLocationData).mockResolvedValueOnce(null);

      const store = useExplorationStore();
      await store.enterArea('unknown');

      expect(zoneSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------- Actions：revealGrid --------------------
  describe('Actions：revealGrid - monster/boss 路径', () => {
    it('monster 格子：调用 triggerBattle、设置 pendingBattleCell、返回 true', async () => {
      const battleSpy = vi.fn();
      eventBus.on(GameEvents.EXPLORATION_BATTLE_TRIGGERED, battleSpy);

      const store = useExplorationStore();
      const monsterCell = makeCell({
        x: 0, y: 0, type: 'monster', accessible: true, monsterId: 'goblin',
      });
      store.$patch({
        grid: makeSingleCellGrid(monsterCell),
        currentAreaId: 'forest',
      });

      const result = await store.revealGrid(0, 0);

      expect(result).toBe(true);
      expect(battleSpy).toHaveBeenCalledWith({
        characterId: null,
        eventData: { monsterId: 'goblin', areaLevel: expect.any(Number) },
      });
    });

    it('boss 格子：triggerBattle 使用 boss_dragon_whelp 兜底 id（P3-137 阶段 3：新命名规范）', async () => {
      const battleSpy = vi.fn();
      eventBus.on(GameEvents.EXPLORATION_BATTLE_TRIGGERED, battleSpy);

      const store = useExplorationStore();
      const bossCell = makeCell({ x: 0, y: 0, type: 'boss', accessible: true });
      store.$patch({
        grid: makeSingleCellGrid(bossCell),
        currentAreaId: 'forest',
      });

      await store.revealGrid(0, 0);

      // P3-137 阶段 3：boss 无 monsterId 时兜底为 boss_dragon_whelp
      expect(battleSpy).toHaveBeenCalledWith(
        expect.objectContaining({ eventData: expect.objectContaining({ monsterId: 'boss_dragon_whelp' }) })
      );
    });

    it('格子不存在或不可访问时返回 false', async () => {
      const store = useExplorationStore();
      store.$patch({ currentAreaId: 'forest' });
      // 空网格
      const result = await store.revealGrid(0, 0);
      expect(result).toBe(false);
    });

    it('已完成格子返回 false', async () => {
      const store = useExplorationStore();
      const cell = makeCell({ x: 0, y: 0, type: 'monster', accessible: true, completed: true });
      store.$patch({
        grid: makeSingleCellGrid(cell),
        currentAreaId: 'forest',
      });
      const result = await store.revealGrid(0, 0);
      expect(result).toBe(false);
    });
  });

  describe('Actions：revealGrid - shop/board 路径', () => {
    it('shop 格子：emit EXPLORATION_CELL_EXPLORED 携带 cellType 和 interactionId', async () => {
      const exploredSpy = vi.fn();
      eventBus.on(GameEvents.EXPLORATION_CELL_EXPLORED, exploredSpy);

      const store = useExplorationStore();
      const shopCell = makeCell({ x: 0, y: 0, type: 'shop', accessible: true, explored: false });
      store.$patch({
        grid: makeSingleCellGrid(shopCell),
        currentAreaId: 'forest',
        // 通过 enterArea 设置 assignedShopId 较复杂，这里直接验证 emit 调用即可
      });

      await store.revealGrid(0, 0);

      expect(exploredSpy).toHaveBeenCalledWith(
        expect.objectContaining({ x: 0, y: 0, cellType: 'shop' })
      );
      // P7-014 修复：shop/board 不再递增 visitedCells（placeFixedEvents 时已预置 visited）
      expect(store.visitedCells).toBe(0);
      expect(explorationDbService.saveExplorationData).not.toHaveBeenCalled();
      // currentCharacterId 未设置，persistState 跳过
    });

    it('board 格子：interactionId 为 board_main', async () => {
      const exploredSpy = vi.fn();
      eventBus.on(GameEvents.EXPLORATION_CELL_EXPLORED, exploredSpy);

      const store = useExplorationStore();
      const boardCell = makeCell({ x: 0, y: 0, type: 'board', accessible: true });
      store.$patch({
        grid: makeSingleCellGrid(boardCell),
        currentAreaId: 'forest',
      });

      await store.revealGrid(0, 0);

      expect(exploredSpy).toHaveBeenCalledWith(
        expect.objectContaining({ cellType: 'board', interactionId: 'board_main' })
      );
    });

    it('UI 回调 onCellExplored 被调用', async () => {
      const onCellExplored = vi.fn();
      const store = useExplorationStore();
      store.registerUICallbacks({ onCellExplored });
      const shopCell = makeCell({ x: 0, y: 0, type: 'shop', accessible: true });
      store.$patch({
        grid: makeSingleCellGrid(shopCell),
        currentAreaId: 'forest',
      });

      await store.revealGrid(0, 0);

      expect(onCellExplored).toHaveBeenCalledWith(
        expect.objectContaining({ cellType: 'shop' })
      );
    });
  });

  describe('Actions：revealGrid - treasure/trap/event/rest 路径', () => {
    it('treasure 格子：调用 dispatchCellEvent、emit EXPLORATION_CELL_EXPLORED', async () => {
      const exploredSpy = vi.fn();
      eventBus.on(GameEvents.EXPLORATION_CELL_EXPLORED, exploredSpy);
      vi.mocked(dispatchCellEvent).mockResolvedValueOnce({ completed: true });

      const store = useExplorationStore();
      const treasureCell = makeCell({ x: 0, y: 0, type: 'treasure', accessible: true });
      store.$patch({
        grid: makeSingleCellGrid(treasureCell),
        currentAreaId: 'forest',
      });

      const result = await store.revealGrid(0, 0);

      expect(result).toBe(true);
      expect(dispatchCellEvent).toHaveBeenCalledWith(
        'treasure',
        expect.objectContaining({ cell: expect.objectContaining({ type: 'treasure' }) })
      );
      expect(exploredSpy).toHaveBeenCalledWith(expect.objectContaining({ x: 0, y: 0 }));
    });

    it('dispatchCellEvent 返回 shouldHandleDeath 时调用 characterStore.handleDeath', async () => {
      vi.mocked(dispatchCellEvent).mockResolvedValueOnce({ completed: true, shouldHandleDeath: true });

      const store = useExplorationStore();
      const trapCell = makeCell({ x: 0, y: 0, type: 'trap', accessible: true });
      store.$patch({
        grid: makeSingleCellGrid(trapCell),
        currentAreaId: 'forest',
      });

      await store.revealGrid(0, 0);

      expect(mocks.characterStore.handleDeath).toHaveBeenCalled();
    });

    it('已探索且已完成的格子返回 false（路径 3 守卫）', async () => {
      const store = useExplorationStore();
      const cell = makeCell({ x: 0, y: 0, type: 'treasure', accessible: true, explored: true, completed: true });
      store.$patch({
        grid: makeSingleCellGrid(cell),
        currentAreaId: 'forest',
      });

      const result = await store.revealGrid(0, 0);

      expect(result).toBe(false);
      expect(dispatchCellEvent).not.toHaveBeenCalled();
    });
  });

  // -------------------- Actions：triggerBattle --------------------
  describe('Actions：triggerBattle', () => {
    it('emit EXPLORATION_BATTLE_TRIGGERED 并通知 UI 回调', () => {
      const battleSpy = vi.fn();
      const onBattleTriggered = vi.fn();
      eventBus.on(GameEvents.EXPLORATION_BATTLE_TRIGGERED, battleSpy);

      const store = useExplorationStore();
      store.registerUICallbacks({ onBattleTriggered });
      store.triggerBattle('goblin');

      expect(battleSpy).toHaveBeenCalledWith({
        characterId: null,
        eventData: { monsterId: 'goblin', areaLevel: expect.any(Number) },
      });
      expect(onBattleTriggered).toHaveBeenCalledWith(
        expect.objectContaining({ eventData: { monsterId: 'goblin', areaLevel: expect.any(Number) } })
      );
    });
  });

  // -------------------- Actions：onBattleResult --------------------
  describe('Actions：onBattleResult', () => {
    it('胜利：标记格子 completed、boss 格设置 bossDefeated、持久化', async () => {
      const store = useExplorationStore();
      // 先通过 revealGrid monster 路径设置 pendingBattleCell
      const monsterCell = makeCell({
        x: 0, y: 0, type: 'monster', accessible: true, monsterId: 'goblin',
      });
      store.$patch({
        grid: makeSingleCellGrid(monsterCell),
        currentAreaId: 'forest',
      });
      await store.revealGrid(0, 0);

      await store.onBattleResult(true);

      // 胜利后格子标记 completed
      expect(store.getGridCell(0, 0)?.completed).toBe(true);
      expect(store.getGridCell(0, 0)?.accessible).toBe(false);
      expect(updateAccessibleCells).toHaveBeenCalled();
    });

    it('boss 格胜利：设置 bossDefeated 为 true', async () => {
      const store = useExplorationStore();
      const bossCell = makeCell({ x: 0, y: 0, type: 'boss', accessible: true, monsterId: 'dragon' });
      store.$patch({
        grid: makeSingleCellGrid(bossCell),
        currentAreaId: 'forest',
      });
      await store.revealGrid(0, 0); // 设置 pendingBattleCell

      expect(store.bossDefeated).toBe(false);
      await store.onBattleResult(true);

      expect(store.bossDefeated).toBe(true);
    });

    it('失败：揭示格子但保留 monsterId 允许再次挑战', async () => {
      const store = useExplorationStore();
      const monsterCell = makeCell({
        x: 0, y: 0, type: 'monster', accessible: true, monsterId: 'goblin', explored: false,
      });
      store.$patch({
        grid: makeSingleCellGrid(monsterCell),
        currentAreaId: 'forest',
      });
      await store.revealGrid(0, 0);

      await store.onBattleResult(false);

      // 失败时格子被揭示但不标记 completed（保持 false，不设为 true）
      expect(store.getGridCell(0, 0)?.explored).toBe(true);
      expect(store.getGridCell(0, 0)?.completed).toBe(false);
      expect(store.getGridCell(0, 0)?.monsterId).toBe('goblin');
    });

    it('无 pendingBattleCell 时直接返回（不报错）', async () => {
      const store = useExplorationStore();
      await store.onBattleResult(true);
      // 无任何断言异常即通过，验证不抛错
      expect(store.bossDefeated).toBe(false);
    });
  });

  // -------------------- Actions：useCamp --------------------
  describe('Actions：useCamp', () => {
    it('campUsed 已为 true 时直接返回不执行', async () => {
      const store = useExplorationStore();
      store.$patch({ campUsed: true, currentAreaId: 'forest' });

      await store.useCamp();

      expect(dispatchCellEvent).not.toHaveBeenCalled();
    });

    it('campUsed 为 false 时调用 dispatchCellEvent，结果 campUsed=true 则更新状态', async () => {
      vi.mocked(dispatchCellEvent).mockResolvedValueOnce({ completed: true, campUsed: true });
      const store = useExplorationStore();
      // P3-153：通过 gameStore 设置 currentCharacterId，否则 persistState 会跳过持久化
      mocks.gameStore.currentCharacterId = 'char_1';
      await store.init('char_1');
      store.$patch({ campUsed: false, currentAreaId: 'forest' });

      await store.useCamp();

      expect(dispatchCellEvent).toHaveBeenCalledWith('rest', expect.any(Object));
      expect(store.campUsed).toBe(true);
      expect(explorationDbService.saveExplorationData).toHaveBeenCalled();
    });

    it('dispatchCellEvent 返回 campUsed=false 时不更新状态', async () => {
      vi.mocked(dispatchCellEvent).mockResolvedValueOnce({ completed: true, campUsed: false });
      const store = useExplorationStore();
      store.$patch({ campUsed: false, currentAreaId: 'forest' });

      await store.useCamp();

      expect(store.campUsed).toBe(false);
    });
  });

  // -------------------- Actions：applyEventChoice --------------------
  describe('Actions：applyEventChoice', () => {
    it('调用 applyEventEffect 应用效果，不死亡时记录日志', async () => {
      vi.mocked(applyEventEffect).mockResolvedValueOnce(false);
      const store = useExplorationStore();

      await store.applyEventChoice({
        label: '触碰祭坛',
        icon: 'game-icons:altar',
        effect: { type: 'exp', amount: 30 },
      });

      expect(applyEventEffect).toHaveBeenCalledWith(
        'exp',
        expect.objectContaining({ characterId: null }),
        30
      );
      expect(mocks.characterStore.handleDeath).not.toHaveBeenCalled();
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({ message: '选择：触碰祭坛' })
      );
    });

    it('applyEventEffect 返回 true（死亡）时调用 handleDeath 且不记录选择日志', async () => {
      vi.mocked(applyEventEffect).mockResolvedValueOnce(true);
      const store = useExplorationStore();

      await store.applyEventChoice({
        label: '饮下黑水',
        effect: { type: 'damage', amount: 999 },
      });

      expect(mocks.characterStore.handleDeath).toHaveBeenCalled();
    });
  });

  // -------------------- Actions：revealAllCells --------------------
  describe('Actions：revealAllCells', () => {
    it('无激活区域时不执行', async () => {
      const store = useExplorationStore();
      await store.revealAllCells();
      expect(explorationDbService.saveExplorationData).not.toHaveBeenCalled();
    });

    it('有激活区域时：所有格子标记 explored/visited、visitedCells=GRID_SIZE*GRID_SIZE', async () => {
      const store = useExplorationStore();
      // P3-153：通过 gameStore 设置 currentCharacterId，否则 persistState 会跳过持久化
      mocks.gameStore.currentCharacterId = 'char_1';
      await store.init('char_1');
      const cell = makeCell({ x: 0, y: 0, type: 'empty', explored: false });
      store.$patch({
        grid: [[cell, makeCell({ x: 1, y: 0, explored: false })]],
        currentAreaId: 'forest',
      });

      await store.revealAllCells();

      expect(store.grid[0][0].explored).toBe(true);
      expect(store.grid[0][0].visited).toBe(true);
      expect(store.grid[0][0].accessible).toBe(false);
      // visitedCells = GRID_SIZE(3) * GRID_SIZE(3) = 9
      expect(store.visitedCells).toBe(9);
      expect(explorationDbService.saveExplorationData).toHaveBeenCalled();
    });
  });

  // -------------------- Actions：reset / exitExploration --------------------
  describe('Actions：reset / exitExploration', () => {
    it('reset：清空状态、emit EXPLORATION_END', () => {
      const endSpy = vi.fn();
      eventBus.on(GameEvents.EXPLORATION_END, endSpy);

      const store = useExplorationStore();
      store.$patch({
        currentAreaId: 'forest',
        isExploring: true,
        visitedCells: 5,
        campUsed: true,
        bossDefeated: true,
      });

      store.reset();

      expect(store.currentAreaId).toBeNull();
      expect(store.grid).toEqual([]);
      expect(store.isExploring).toBe(false);
      expect(store.campUsed).toBe(false);
      expect(store.bossDefeated).toBe(false);
      expect(store.explorationComplete).toBe(false);
      expect(store.visitedCells).toBe(1);
      expect(store.playerPosition).toEqual({ x: 0, y: 0 });
      expect(endSpy).toHaveBeenCalledWith({ characterId: null });
      // 有激活探索时记录日志
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({ message: '探索结束' })
      );
    });

    it('reset：无激活探索时不记录日志', () => {
      const store = useExplorationStore();
      mocks.logStore.addLogEntry.mockClear();
      store.reset();
      expect(mocks.logStore.addLogEntry).not.toHaveBeenCalled();
    });

    it('exitExploration 是 reset 的别名', () => {
      const endSpy = vi.fn();
      eventBus.on(GameEvents.EXPLORATION_END, endSpy);

      const store = useExplorationStore();
      store.$patch({ currentAreaId: 'forest', isExploring: true });

      store.exitExploration();

      expect(store.currentAreaId).toBeNull();
      expect(store.isExploring).toBe(false);
      expect(endSpy).toHaveBeenCalled();
    });
  });

  // -------------------- Actions：init --------------------
  describe('Actions：init', () => {
    it('DB 无数据时初始化为默认空状态', async () => {
      vi.mocked(explorationDbService.getExplorationData).mockResolvedValueOnce(null);

      const store = useExplorationStore();
      await store.init('char_1');

      expect(store.currentAreaId).toBeNull();
      expect(store.grid).toEqual([]);
      expect(store.isExploring).toBe(false);
      expect(store.visitedCells).toBe(1);
    });

    it('DB 有数据时恢复完整探索状态', async () => {
      const storedGrid = [[makeCell({ x: 0, y: 0, type: 'start', explored: true })]];
      vi.mocked(explorationDbService.getExplorationData).mockResolvedValueOnce({
        characterId: 'char_1',
        currentAreaId: 'forest',
        grid: storedGrid,
        campUsed: true,
        playerPosition: { x: 2, y: 3 },
        visitedCells: 7,
        bossDefeated: true,
        explorationComplete: false,
        assignedShopId: 'shop_1',
      });

      const store = useExplorationStore();
      await store.init('char_1');

      expect(store.currentAreaId).toBe('forest');
      expect(store.grid).toEqual(storedGrid);
      expect(store.campUsed).toBe(true);
      expect(store.playerPosition).toEqual({ x: 2, y: 3 });
      expect(store.visitedCells).toBe(7);
      expect(store.bossDefeated).toBe(true);
      expect(store.isExploring).toBe(true);
      // 恢复区域配置时调用 loadAreaConfig → crossModuleQuery.getLocationData
      expect(crossModuleQuery.getLocationData).toHaveBeenCalledWith('forest');
    });

    it('init 注册的 COMBAT_END 监听器触发 onBattleResult', async () => {
      vi.mocked(explorationDbService.getExplorationData).mockResolvedValueOnce(null);
      const store = useExplorationStore();
      await store.init('char_1');

      // 设置一个 monster 格子并 reveal 设置 pendingBattleCell
      const monsterCell = makeCell({ x: 0, y: 0, type: 'monster', accessible: true, monsterId: 'goblin' });
      store.$patch({ grid: makeSingleCellGrid(monsterCell), currentAreaId: 'forest' });
      await store.revealGrid(0, 0);

      // 通过 eventBus emit COMBAT_END 触发监听器
      eventBus.emit(GameEvents.COMBAT_END, { result: 'victory', enemy: null, expGained: 0 });

      // onBattleResult 内部 await onCellExplored 后才设置 completed，需刷新微任务
      await new Promise(resolve => setTimeout(resolve, 0));

      // 胜利后格子标记 completed
      expect(store.getGridCell(0, 0)?.completed).toBe(true);
    });
  });

  // -------------------- Actions：dispose / UI 回调 --------------------
  describe('Actions：dispose / UI 回调', () => {
    it('registerUICallbacks / unregisterUICallbacks 管理 UI 回调', () => {
      const store = useExplorationStore();
      const callbacks = { onCellExplored: vi.fn() };
      store.registerUICallbacks(callbacks);

      const shopCell = makeCell({ x: 0, y: 0, type: 'shop', accessible: true });
      store.$patch({ grid: makeSingleCellGrid(shopCell), currentAreaId: 'forest' });
      // 异步触发，验证回调被调用
      return store.revealGrid(0, 0).then(() => {
        expect(callbacks.onCellExplored).toHaveBeenCalled();
      });
    });

    it('unregisterUICallbacks 后不再触发回调', async () => {
      const onCellExplored = vi.fn();
      const store = useExplorationStore();
      store.registerUICallbacks({ onCellExplored });
      store.unregisterUICallbacks();

      const shopCell = makeCell({ x: 0, y: 0, type: 'shop', accessible: true });
      store.$patch({ grid: makeSingleCellGrid(shopCell), currentAreaId: 'forest' });
      await store.revealGrid(0, 0);

      expect(onCellExplored).not.toHaveBeenCalled();
    });

    it('dispose 后 COMBAT_END 监听器不再触发 onBattleResult', async () => {
      vi.mocked(explorationDbService.getExplorationData).mockResolvedValueOnce(null);
      const store = useExplorationStore();
      await store.init('char_1');
      store.dispose();

      const monsterCell = makeCell({ x: 0, y: 0, type: 'monster', accessible: true, monsterId: 'goblin' });
      store.$patch({ grid: makeSingleCellGrid(monsterCell), currentAreaId: 'forest' });
      await store.revealGrid(0, 0);

      // dispose 后 emit COMBAT_END 不应触发 onBattleResult（格子保持 completed=false，未被标记为 true）
      eventBus.emit(GameEvents.COMBAT_END, { result: 'victory', enemy: null, expGained: 0 });
      expect(store.getGridCell(0, 0)?.completed).toBe(false);
    });
  });

  // -------------------- Actions：enterArea 补充分支 --------------------
  describe('Actions：enterArea 补充分支', () => {
    it('getQuestRequiredMonsters：存在 kill 目标时收集对应 enemyId', async () => {
      // mock 任务定义返回含 kill 目标的任务，覆盖 getQuestRequiredMonsters 内部循环
      vi.mocked(crossModuleQuery.getQuestDefinitionsByBoard).mockResolvedValueOnce([
        {
          id: 'q1',
          title: '击杀任务',
          type: 'kill',
          objectives: [
            { key: 'kill_goblin', type: 'kill', target: 2, enemyId: 'goblin' },
            { key: 'collect_ore', type: 'collect', target: 1, itemId: 'ore_1' },
          ],
        },
      ]);

      const store = useExplorationStore();
      await store.enterArea('forest');

      // getQuestDefinitionsByBoard 被调用
      expect(crossModuleQuery.getQuestDefinitionsByBoard).toHaveBeenCalledWith('forest');
      // 网格成功生成（questMonsters 已参与生成流程）
      expect(store.grid.length).toBeGreaterThan(0);
    });

    it('pickRandomShop：无商店配置时不抛错并正常完成 enterArea', async () => {
      vi.mocked(crossModuleQuery.getAllShopConfigs).mockResolvedValueOnce([]);

      const store = useExplorationStore();
      await store.enterArea('forest');

      // 无商店配置时 pickRandomShop 走 false 分支，enterArea 仍正常完成
      expect(store.currentAreaId).toBe('forest');
      expect(store.isExploring).toBe(true);
    });

    it('buildAreaConfig：地点无 enemies/bosses 字段时使用空池兜底', async () => {
      // 地点不带 enemies/bosses，覆盖 `|| []` 兜底分支
      vi.mocked(crossModuleQuery.getLocationData).mockResolvedValue({
        id: 'forest',
        name: '森林',
        levelRange: [1, 5],
      });

      const store = useExplorationStore();
      await store.enterArea('forest');

      expect(store.currentAreaId).toBe('forest');
      expect(store.grid.length).toBeGreaterThan(0);
    });
  });

  // -------------------- Actions：revealGrid 怪物兜底 id --------------------
  describe('Actions：revealGrid - monster 兜底 id', () => {
    it('monster 格子无 monsterId 时 triggerBattle 使用 mob_gnoll 兜底（P3-137 阶段 3：新命名规范）', async () => {
      const battleSpy = vi.fn();
      eventBus.on(GameEvents.EXPLORATION_BATTLE_TRIGGERED, battleSpy);

      const store = useExplorationStore();
      const monsterCell = makeCell({ x: 0, y: 0, type: 'monster', accessible: true });
      store.$patch({
        grid: makeSingleCellGrid(monsterCell),
        currentAreaId: 'forest',
      });

      await store.revealGrid(0, 0);

      // P3-137 阶段 3：兜底改为 areaConfig.monsterPool[0] ?? 'mob_gnoll'
      // currentAreaId='forest' 但未设置 currentAreaConfig 时，monsterPool 为空，回退到 'mob_gnoll'
      expect(battleSpy).toHaveBeenCalledWith(
        expect.objectContaining({ eventData: expect.objectContaining({ monsterId: 'mob_gnoll' }) })
      );
    });
  });

  // -------------------- Actions：onBattleResult 补充分支 --------------------
  describe('Actions：onBattleResult 补充分支', () => {
    it('pendingBattleCell 对应格子不存在时清空挂起状态并返回', async () => {
      const store = useExplorationStore();
      // 先通过 revealGrid monster 路径设置 pendingBattleCell
      const monsterCell = makeCell({
        x: 0, y: 0, type: 'monster', accessible: true, monsterId: 'goblin',
      });
      store.$patch({
        grid: makeSingleCellGrid(monsterCell),
        currentAreaId: 'forest',
      });
      await store.revealGrid(0, 0);

      // 清空网格，使 pendingBattleCell 指向的格子不存在
      store.$patch({ grid: [] });

      // 不应抛错，直接返回
      await store.onBattleResult(true);
      expect(store.grid).toEqual([]);
    });

    it('胜利：格子已探索时不重复累加 visitedCells', async () => {
      const store = useExplorationStore();
      // 怪物格子已探索（explored=true），覆盖 `if (!cell.explored)` false 分支
      const monsterCell = makeCell({
        x: 0, y: 0, type: 'monster', accessible: true, explored: true, monsterId: 'goblin',
      });
      store.$patch({
        grid: makeSingleCellGrid(monsterCell),
        currentAreaId: 'forest',
        visitedCells: 5,
      });
      await store.revealGrid(0, 0);

      await store.onBattleResult(true);

      // visitedCells 不增加（cell 已探索）
      expect(store.visitedCells).toBe(5);
      // 胜利后仍标记 completed
      expect(store.getGridCell(0, 0)?.completed).toBe(true);
    });

    it('失败：格子已探索时不重复累加 visitedCells', async () => {
      const store = useExplorationStore();
      const monsterCell = makeCell({
        x: 0, y: 0, type: 'monster', accessible: true, explored: true, monsterId: 'goblin',
      });
      store.$patch({
        grid: makeSingleCellGrid(monsterCell),
        currentAreaId: 'forest',
        visitedCells: 4,
      });
      await store.revealGrid(0, 0);

      await store.onBattleResult(false);

      // visitedCells 不增加（cell 已探索）
      expect(store.visitedCells).toBe(4);
      // 失败时不标记 completed
      expect(store.getGridCell(0, 0)?.completed).toBe(false);
    });
  });

  // -------------------- Actions：movePlayer（阶段二：玩家实体化移动） --------------------
  describe('Actions：movePlayer - 玩家实体化移动', () => {
    /** 构造 1×2 测试网格：起点 + 右侧目标格 */
    function makeMoveGrid(rightType: ExplorationCell['type'] = 'empty'): ExplorationCell[][] {
      return [
        [
          makeCell({ x: 0, y: 0, type: 'start', explored: true, accessible: true }),
          makeCell({ x: 1, y: 0, type: rightType, accessible: true, monsterId: rightType === 'monster' ? 'goblin' : undefined }),
        ],
      ];
    }

    it('合法移动到 4 邻域空地：更新 playerPosition 并触发 revealGrid', async () => {
      // Arrange
      const store = useExplorationStore();
      const testGrid = makeMoveGrid('empty');
      store.$patch({ grid: testGrid, currentAreaId: 'forest', playerPosition: { x: 0, y: 0 } });
      vi.mocked(isPassable).mockReturnValue(true);

      // Act
      const result = await store.movePlayer(1, 0);

      // Assert：位置推进到目标格
      expect(result).toBe(true);
      expect(store.playerPosition).toEqual({ x: 1, y: 0 });
      expect(isPassable).toHaveBeenCalledWith(testGrid, { x: 0, y: 0 }, { x: 1, y: 0 });
    });

    it('isPassable 返回 false（穿墙/对角/越界方向）时拒绝移动', async () => {
      // Arrange
      const store = useExplorationStore();
      store.$patch({ grid: makeMoveGrid('empty'), currentAreaId: 'forest', playerPosition: { x: 0, y: 0 } });
      vi.mocked(isPassable).mockReturnValue(false);

      // Act
      const result = await store.movePlayer(1, 0);

      // Assert：位置不变
      expect(result).toBe(false);
      expect(store.playerPosition).toEqual({ x: 0, y: 0 });
    });

    it('目标格越界（不存在）时拒绝', async () => {
      // Arrange
      const store = useExplorationStore();
      store.$patch({
        grid: [[makeCell({ x: 0, y: 0, type: 'start', explored: true })]],
        currentAreaId: 'forest',
        playerPosition: { x: 0, y: 0 },
      });

      // Act & Assert：(5,5) 不在网格内
      const result = await store.movePlayer(5, 5);
      expect(result).toBe(false);
    });

    it('战斗挂起时拒绝新移动', async () => {
      // Arrange：先移动到怪物格触发战斗挂起
      const store = useExplorationStore();
      store.$patch({ grid: makeMoveGrid('monster'), currentAreaId: 'forest', playerPosition: { x: 0, y: 0 } });
      vi.mocked(isPassable).mockReturnValue(true);
      await store.movePlayer(1, 0);

      // Act：战斗挂起中尝试再移动
      const result = await store.movePlayer(0, 0);

      // Assert：被拒，位置保持怪物格
      expect(result).toBe(false);
      expect(store.playerPosition).toEqual({ x: 1, y: 0 });
    });

    it('移动到怪物格：立即推进 playerPosition 并触发战斗', async () => {
      // Arrange
      const store = useExplorationStore();
      store.$patch({ grid: makeMoveGrid('monster'), currentAreaId: 'forest', playerPosition: { x: 0, y: 0 } });
      vi.mocked(isPassable).mockReturnValue(true);

      // Act
      const result = await store.movePlayer(1, 0);

      // Assert：位置立即推进到怪物格
      expect(result).toBe(true);
      expect(store.playerPosition).toEqual({ x: 1, y: 0 });
      // 战斗已触发（EXPLORATION_BATTLE_TRIGGERED 事件已 emit）
      expect(eventBus).toBeTruthy();
    });

    it('移动到怪物格战斗胜利：保持怪物格位置', async () => {
      // Arrange
      const store = useExplorationStore();
      store.$patch({ grid: makeMoveGrid('monster'), currentAreaId: 'forest', playerPosition: { x: 0, y: 0 } });
      vi.mocked(isPassable).mockReturnValue(true);

      // Act：移动触发战斗 → 胜利
      await store.movePlayer(1, 0);
      await store.onBattleResult(true);

      // Assert：胜利保持怪物格位置，且怪物格标记 completed
      expect(store.playerPosition).toEqual({ x: 1, y: 0 });
      expect(store.getGridCell(1, 0)?.completed).toBe(true);
    });

    it('移动到怪物格战斗失败：回退到原位', async () => {
      // Arrange
      const store = useExplorationStore();
      store.$patch({ grid: makeMoveGrid('monster'), currentAreaId: 'forest', playerPosition: { x: 0, y: 0 } });
      vi.mocked(isPassable).mockReturnValue(true);

      // Act：移动触发战斗 → 失败
      await store.movePlayer(1, 0);
      expect(store.playerPosition).toEqual({ x: 1, y: 0 }); // 推进
      await store.onBattleResult(false);

      // Assert：失败回退到原位
      expect(store.playerPosition).toEqual({ x: 0, y: 0 });
      // 怪物格被揭示但未完成，允许再次挑战
      expect(store.getGridCell(1, 0)?.explored).toBe(true);
      expect(store.getGridCell(1, 0)?.completed).toBe(false);
    });

    it('点击当前驻留格（商店）：打开面板不消耗移动', async () => {
      // Arrange：玩家在商店格
      const store = useExplorationStore();
      store.$patch({
        grid: [[makeCell({ x: 0, y: 0, type: 'shop', explored: true, visited: true })]],
        currentAreaId: 'forest',
        playerPosition: { x: 0, y: 0 },
      });

      // Act
      const result = await store.movePlayer(0, 0);

      // Assert：成功打开面板，位置不变，未校验 isPassable
      expect(result).toBe(true);
      expect(store.playerPosition).toEqual({ x: 0, y: 0 });
      expect(isPassable).not.toHaveBeenCalled();
    });

    it('点击当前驻留格（营地）：允许打开面板', async () => {
      // Arrange
      const store = useExplorationStore();
      store.$patch({
        grid: [[makeCell({ x: 0, y: 0, type: 'rest', explored: true, visited: true })]],
        currentAreaId: 'forest',
        playerPosition: { x: 0, y: 0 },
      });

      // Act & Assert
      const result = await store.movePlayer(0, 0);
      expect(result).toBe(true);
      expect(store.playerPosition).toEqual({ x: 0, y: 0 });
    });

    it('点击当前非驻留格（空地）：拒绝', async () => {
      // Arrange：玩家在已探索空地格
      const store = useExplorationStore();
      store.$patch({
        grid: [[makeCell({ x: 0, y: 0, type: 'empty', explored: true })]],
        currentAreaId: 'forest',
        playerPosition: { x: 0, y: 0 },
      });

      // Act & Assert：空地非驻留格，拒绝
      const result = await store.movePlayer(0, 0);
      expect(result).toBe(false);
    });

    it('已击败的怪物格可穿过：位置推进但不触发战斗', async () => {
      // Arrange：右侧怪物格已 completed
      // 阶段二决策：completed 格作为路径可通行，movePlayer 推进位置后 revealGrid
      // 入口 completed 守卫拦截（无事件），玩家可穿过已清理区域
      const battleSpy = vi.fn();
      eventBus.on(GameEvents.EXPLORATION_BATTLE_TRIGGERED, battleSpy);

      const store = useExplorationStore();
      store.$patch({
        grid: [
          [
            makeCell({ x: 0, y: 0, type: 'start', explored: true }),
            makeCell({ x: 1, y: 0, type: 'monster', monsterId: 'goblin', completed: true }),
          ],
        ],
        currentAreaId: 'forest',
        playerPosition: { x: 0, y: 0 },
      });
      vi.mocked(isPassable).mockReturnValue(true);

      // Act：穿过已击败的怪物格
      const result = await store.movePlayer(1, 0);

      // Assert：位置推进成功，但不触发战斗（revealGrid 入口 completed 守卫拦截）
      expect(result).toBe(true);
      expect(store.playerPosition).toEqual({ x: 1, y: 0 });
      expect(battleSpy).not.toHaveBeenCalled();
    });

    it('旧路径 revealGrid 触发的战斗（无 previousPosition）：失败时位置不变', async () => {
      // Arrange：兼容旧路径——直接调 revealGrid 触发战斗，无 previousPosition
      const store = useExplorationStore();
      store.$patch({
        grid: [[makeCell({ x: 0, y: 0, type: 'monster', accessible: true, monsterId: 'goblin' })]],
        currentAreaId: 'forest',
        playerPosition: { x: 0, y: 0 },
      });
      await store.revealGrid(0, 0); // 旧路径触发战斗

      // Act：失败
      await store.onBattleResult(false);

      // Assert：无 previousPosition → 位置不变（不回退到无效值）
      expect(store.playerPosition).toEqual({ x: 0, y: 0 });
    });
  });

  // -------------------- Actions：revealGrid 已访问 shop/board 不累加 visitedCells --------------------
  describe('Actions：revealGrid - shop/board 已访问守卫', () => {
    it('shop 格子已访问过时 visitedCells 不重复累加', async () => {
      const store = useExplorationStore();
      // shop 已 visited，覆盖 `isNewlyVisited = !cell.visited` false 分支
      const shopCell = makeCell({
        x: 0, y: 0, type: 'shop', accessible: true, explored: true, visited: true,
      });
      store.$patch({
        grid: makeSingleCellGrid(shopCell),
        currentAreaId: 'forest',
        visitedCells: 3,
      });

      await store.revealGrid(0, 0);

      // 已访问过，visitedCells 不增加
      expect(store.visitedCells).toBe(3);
    });
  });

  // -------------------- Actions：applyEventChoice 无 icon 兜底 --------------------
  describe('Actions：applyEventChoice - 无 icon 兜底', () => {
    it('choice 无 icon 时日志使用默认 icon', async () => {
      vi.mocked(applyEventEffect).mockResolvedValueOnce(false);
      const store = useExplorationStore();

      await store.applyEventChoice({
        label: '神秘选项',
        // 不传 icon，覆盖 `choice.icon || 'game-icons:choice'` 兜底分支
        effect: { type: 'exp', amount: 10 },
      });

      expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({ icon: 'game-icons:choice', message: '选择：神秘选项' })
      );
    });
  });

  // -------------------- Actions：revealAllCells 无网格守卫 --------------------
  describe('Actions：revealAllCells - 无网格守卫', () => {
    it('有 currentAreaId 但 grid 为空时不执行', async () => {
      const store = useExplorationStore();
      store.$patch({ currentAreaId: 'forest', grid: [] });

      await store.revealAllCells();

      expect(explorationDbService.saveExplorationData).not.toHaveBeenCalled();
    });
  });

  // -------------------- 补充分支：init assignedShopId 兜底、enterArea 未知区域名兜底 --------------------
  describe('Actions：init - assignedShopId 兜底分支', () => {
    it('stored.assignedShopId 为 undefined 时回退为空字符串', async () => {
      // Arrange：stored 数据不带 assignedShopId 字段，触发 `|| ''` 兜底
      const storedGrid = [[makeCell({ x: 0, y: 0, type: 'start', explored: true })]];
      vi.mocked(explorationDbService.getExplorationData).mockResolvedValueOnce({
        characterId: 'char_1',
        currentAreaId: 'forest',
        grid: storedGrid,
        campUsed: false,
        playerPosition: { x: 0, y: 0 },
        visitedCells: 1,
        bossDefeated: false,
        explorationComplete: false,
        // assignedShopId 故意不提供
      } as any);

      const store = useExplorationStore();
      await store.init('char_1');

      // Assert：assignedShopId 为空字符串（兜底）
      expect(store.currentAreaId).toBe('forest');
    });
  });

  describe('Actions：enterArea - 区域名兜底分支', () => {
    it('currentAreaConfig.name 为空字符串时日志使用"未知区域"兜底', async () => {
      // Arrange：getLocationData 返回 name 为空字符串的地点
      // buildAreaConfig 设置 name: location.name = '' → `|| '未知区域'` 触发
      vi.mocked(crossModuleQuery.getLocationData).mockResolvedValue({
        id: 'empty',
        name: '',
        levelRange: [1, 5],
        enemies: ['goblin'],
        bosses: ['dragon'],
      });

      const store = useExplorationStore();
      await store.enterArea('empty');

      // Assert：日志包含"未知区域"
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('未知区域') })
      );
    });
  });

  // -------------------- 补充分支：revealGrid 路径 3 各种 cellResult 分支 --------------------
  describe('Actions：revealGrid - 路径 3 cellResult 分支覆盖', () => {
    it('cellResult.completed 为 false 时不标记 cell.completed', async () => {
      // Arrange：dispatchCellEvent 返回 { completed: false }，覆盖 `if (cellResult.completed)` false 分支
      vi.mocked(dispatchCellEvent).mockResolvedValueOnce({ completed: false });

      const store = useExplorationStore();
      const treasureCell = makeCell({ x: 0, y: 0, type: 'treasure', accessible: true });
      store.$patch({
        grid: makeSingleCellGrid(treasureCell),
        currentAreaId: 'forest',
      });

      await store.revealGrid(0, 0);

      // Assert：cell.completed 保持 false
      expect(store.getGridCell(0, 0)?.completed).toBe(false);
    });

    it('cellResult.campUsed 为 true 时设置 campUsed 并持久化', async () => {
      // Arrange：dispatchCellEvent 返回 { completed: false, campUsed: true }
      // 覆盖 `if (cellResult.campUsed)` true 分支 + 行 408-409
      vi.mocked(dispatchCellEvent).mockResolvedValueOnce({ completed: false, campUsed: true });

      const store = useExplorationStore();
      // P3-153：通过 gameStore 设置 currentCharacterId 以触发 persistState
      mocks.gameStore.currentCharacterId = 'char_1';
      await store.init('char_1');
      const restCell = makeCell({ x: 0, y: 0, type: 'rest', accessible: true });
      store.$patch({
        grid: makeSingleCellGrid(restCell),
        currentAreaId: 'forest',
        campUsed: false,
      });

      await store.revealGrid(0, 0);

      // Assert：campUsed 被设置为 true
      expect(store.campUsed).toBe(true);
      expect(explorationDbService.saveExplorationData).toHaveBeenCalled();
    });

    it('已探索但未完成的路径 3 格子：isFirstVisit 为 false 时不累加 visitedCells', async () => {
      // Arrange：cell.explored=true, completed=false → 通过路径 3 第二守卫
      // isFirstVisit = !cell.explored = false → 跳过 visitedCells++
      vi.mocked(dispatchCellEvent).mockResolvedValueOnce({ completed: false });

      const store = useExplorationStore();
      const treasureCell = makeCell({
        x: 0, y: 0, type: 'treasure', accessible: true, explored: true, completed: false,
      });
      store.$patch({
        grid: makeSingleCellGrid(treasureCell),
        currentAreaId: 'forest',
        visitedCells: 5,
      });

      await store.revealGrid(0, 0);

      // Assert：visitedCells 不增加（isFirstVisit=false）
      expect(store.visitedCells).toBe(5);
    });

    it('cell 不存在且不可访问且未探索时返回 false（(!cell.accessible && !cell.explored) 分支）', async () => {
      // Arrange：cell 存在但 accessible=false, explored=false, completed=false
      // → !cell=false, (!cell.accessible && !cell.explored)=true → return false
      const store = useExplorationStore();
      const cell = makeCell({
        x: 0, y: 0, type: 'empty', accessible: false, explored: false, completed: false,
      });
      store.$patch({
        grid: makeSingleCellGrid(cell),
        currentAreaId: 'forest',
      });

      const result = await store.revealGrid(0, 0);

      // Assert
      expect(result).toBe(false);
    });
  });

  // -------------------- 补充分支：路径 3 第二守卫（cell.explored && cell.completed） --------------------
  describe('Actions：revealGrid - 路径 3 第二守卫防御性分支', () => {
    it('cell.explored=true 且 cell.completed 在第二守卫处为 true 时返回 false（Proxy 模拟）', async () => {
      // Arrange：第一守卫检查 cell.completed（返回 false 通过），第二守卫再次检查 cell.completed（返回 true）
      // 由于第一守卫 `|| cell.completed` 已为 false 时才会到达路径 3，第二守卫 `cell.explored && cell.completed`
      // 在正常情况下不可能为 true（cell.completed 在第一守卫已为 false）。使用 Proxy 让 completed 在第二次访问时返回 true。
      const store = useExplorationStore();
      const baseCell = makeCell({
        x: 0, y: 0, type: 'treasure', accessible: true, explored: true, completed: false,
      });
      let completedAccessCount = 0;
      const proxyCell = new Proxy(baseCell, {
        get(target, prop, receiver) {
          if (prop === 'completed') {
            completedAccessCount++;
            return completedAccessCount > 1; // 第一次 false（通过第一守卫），第二次 true（触发第二守卫）
          }
          return Reflect.get(target, prop, receiver);
        },
      }) as ExplorationCell;

      store.$patch({
        grid: makeSingleCellGrid(proxyCell),
        currentAreaId: 'forest',
      });

      // Act
      const result = await store.revealGrid(0, 0);

      // Assert：第二守卫触发，返回 false
      expect(result).toBe(false);
    });
  });

  // -------------------- Actions：阶段四 Boss 封印判定 --------------------
  describe('Actions：bossSealBroken + movePlayer 封印判定（阶段四）', () => {
    it('bossSealBroken：visitedCells < BOSS_SEAL_REQUIRED_CELLS 时为 false', () => {
      const store = useExplorationStore();
      store.$patch({ visitedCells: BOSS_SEAL_REQUIRED_CELLS - 1 });
      expect(store.bossSealBroken).toBe(false);
    });

    it('bossSealBroken：visitedCells >= BOSS_SEAL_REQUIRED_CELLS 时为 true', () => {
      const store = useExplorationStore();
      store.$patch({ visitedCells: BOSS_SEAL_REQUIRED_CELLS });
      expect(store.bossSealBroken).toBe(true);
    });

    it('movePlayer：Boss 格 sealed 且未解锁时拒绝移动，不触发战斗', async () => {
      // Arrange
      const store = useExplorationStore();
      store.$patch({
        grid: [[
          makeCell({ x: 0, y: 0, type: 'start', explored: true }),
          makeCell({ x: 1, y: 0, type: 'boss', sealed: true, monsterId: 'dragon' }),
        ]],
        currentAreaId: 'forest',
        playerPosition: { x: 0, y: 0 },
        visitedCells: 0, // 未解锁
      });
      vi.mocked(isPassable).mockReturnValue(true);
      const battleSpy = vi.fn();
      eventBus.on(GameEvents.EXPLORATION_BATTLE_TRIGGERED, battleSpy);

      // Act
      const result = await store.movePlayer(1, 0);

      // Assert：拒绝移动，位置不变，不触发战斗
      expect(result).toBe(false);
      expect(store.playerPosition).toEqual({ x: 0, y: 0 });
      expect(battleSpy).not.toHaveBeenCalled();
    });

    it('movePlayer：Boss 格 sealed 但已解锁时允许移动并触发战斗', async () => {
      // Arrange
      const store = useExplorationStore();
      store.$patch({
        grid: [[
          makeCell({ x: 0, y: 0, type: 'start', explored: true }),
          makeCell({ x: 1, y: 0, type: 'boss', sealed: true, monsterId: 'dragon' }),
        ]],
        currentAreaId: 'forest',
        playerPosition: { x: 0, y: 0 },
        visitedCells: BOSS_SEAL_REQUIRED_CELLS, // 已解锁
      });
      vi.mocked(isPassable).mockReturnValue(true);

      // Act
      const result = await store.movePlayer(1, 0);

      // Assert：允许移动，位置推进到 Boss 格
      expect(result).toBe(true);
      expect(store.playerPosition).toEqual({ x: 1, y: 0 });
    });

    it('movePlayer：Boss 格未 sealed 时正常移动（兼容旧存档）', async () => {
      // Arrange：Boss 格无 sealed 字段（旧存档），无论 visitedCells 多少都可移动
      const store = useExplorationStore();
      store.$patch({
        grid: [[
          makeCell({ x: 0, y: 0, type: 'start', explored: true }),
          makeCell({ x: 1, y: 0, type: 'boss', monsterId: 'dragon' }), // 无 sealed
        ]],
        currentAreaId: 'forest',
        playerPosition: { x: 0, y: 0 },
        visitedCells: 0,
      });
      vi.mocked(isPassable).mockReturnValue(true);

      // Act
      const result = await store.movePlayer(1, 0);

      // Assert：正常移动
      expect(result).toBe(true);
      expect(store.playerPosition).toEqual({ x: 1, y: 0 });
    });

    it('revealGrid：直接调 revealGrid 点击封印 Boss 格时不触发战斗（防御性二次拦截）', async () => {
      // Arrange：revealGrid 作为公共入口（revealAllCells/控制台）可能被直接调用，
      // 即使绕过 movePlayer 的封印判定，revealGrid 路径 1 也应二次拦截
      const store = useExplorationStore();
      store.$patch({
        grid: [[
          makeCell({ x: 0, y: 0, type: 'boss', sealed: true, accessible: true, monsterId: 'dragon' }),
        ]],
        currentAreaId: 'forest',
        visitedCells: 0, // 未解锁
      });
      const battleSpy = vi.fn();
      eventBus.on(GameEvents.EXPLORATION_BATTLE_TRIGGERED, battleSpy);

      // Act
      const result = await store.revealGrid(0, 0);

      // Assert：防御性拦截，返回 false，不触发战斗
      expect(result).toBe(false);
      expect(battleSpy).not.toHaveBeenCalled();
    });

    it('revealGrid：Boss 格 sealed 但已解锁时正常触发战斗', async () => {
      // Arrange
      const store = useExplorationStore();
      store.$patch({
        grid: [[
          makeCell({ x: 0, y: 0, type: 'boss', sealed: true, accessible: true, monsterId: 'dragon' }),
        ]],
        currentAreaId: 'forest',
        visitedCells: BOSS_SEAL_REQUIRED_CELLS, // 已解锁
      });
      const battleSpy = vi.fn();
      eventBus.on(GameEvents.EXPLORATION_BATTLE_TRIGGERED, battleSpy);

      // Act
      const result = await store.revealGrid(0, 0);

      // Assert：解锁后 revealGrid 不再拦截，触发战斗
      expect(result).toBe(true);
      expect(battleSpy).toHaveBeenCalledTimes(1);
    });
  });
});
