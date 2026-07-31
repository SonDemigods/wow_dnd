/**
 * @fileoverview GameBootstrap 游戏初始化编排服务单元测试
 *
 * 覆盖：
 * 1. initialize：按依赖顺序调用 7 个 Store 的 initialize/init
 * 2. initialize：注入背包回调到装备模块（A1/G1 修复）
 * 3. initialize：注入 Boss 创建回调到敌人模块（阶段四：切断 enemy → boss 反向依赖）
 * 4. dispose：调用实现了 Disposable 接口的 Store 的 dispose
 * 5. dispose：清除装备模块的背包回调引用（A1/G1 修复）
 * 6. dispose：清除敌人模块的 Boss 创建回调引用（阶段四：避免回调泄漏）
 *
 * Mock 策略：
 * - 7 个模块 Store 全量 mock，断言 initialize/init/dispose 调用顺序
 * - setInventoryCallbacks / clearInventoryCallbacks mock 验证回调注入与清除
 * - setBossCreateFn mock 验证 Boss 创建回调注入与清除（阶段四）
 * - boss/db、boss/service mock 避免 GameBootstrap 顶层导入触发真实模块加载
 * - 使用 createTestPinia 激活 Pinia（mock 的 store 需要在 Pinia 上下文中）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestPinia } from '../utils/setup';

/** mock 7 个模块 Store + 装备/敌人模块回调注入函数 */
/**
 * vi.hoisted 保证 mock 函数在 vi.mock 工厂提升到文件顶部时已初始化。
 * setInventoryCallbacks / clearInventoryCallbacks / setBossCreateFn 在工厂返回对象中
 * 直接引用（非函数包装），必须使用 vi.hoisted 避免 TDZ（Temporal Dead Zone）错误。
 */
const hoisted = vi.hoisted(() => ({
  setInventoryCallbacksMock: vi.fn(),
  clearInventoryCallbacksMock: vi.fn(),
  setBossCreateFnMock: vi.fn(),
  setInventoryExternalCallbacksMock: vi.fn(),
  clearInventoryExternalCallbacksMock: vi.fn(),
  setQuestExternalCallbacksMock: vi.fn(),
  clearQuestExternalCallbacksMock: vi.fn(),
}));

const logInitMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/modules/log/store', () => ({
  useLogStore: () => ({ initialize: logInitMock }),
}));

const inventoryInitMock = vi.fn().mockResolvedValue(undefined);
const inventoryAddItemMock = vi.fn();
const inventoryRemoveItemMock = vi.fn();
const inventoryFlushPersistMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/modules/inventory/store', () => ({
  useInventoryStore: () => ({
    initialize: inventoryInitMock,
    addItem: inventoryAddItemMock,
    removeItem: inventoryRemoveItemMock,
    flushPersist: inventoryFlushPersistMock,
    inventory: [],
  }),
  setInventoryExternalCallbacks: hoisted.setInventoryExternalCallbacksMock,
  clearInventoryExternalCallbacks: hoisted.clearInventoryExternalCallbacksMock,
}));

const equipmentInitMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/modules/equipment/store', () => ({
  useEquipmentStore: () => ({ initialize: equipmentInitMock }),
  setInventoryCallbacks: hoisted.setInventoryCallbacksMock,
  clearInventoryCallbacks: hoisted.clearInventoryCallbacksMock,
}));

const skillInitMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/modules/skill/store', () => ({
  useSkillStore: () => ({ initialize: skillInitMock }),
}));

const mapInitMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/modules/map/store', () => ({
  useMapStore: () => ({ initialize: mapInitMock }),
}));

const explorationInitMock = vi.fn().mockResolvedValue(undefined);
const explorationDisposeMock = vi.fn();
vi.mock('@/modules/exploration/store', () => ({
  useExplorationStore: () => ({
    init: explorationInitMock,
    dispose: explorationDisposeMock,
  }),
}));

const questInitMock = vi.fn().mockResolvedValue(undefined);
const questOnItemCollectedMock = vi.fn();
vi.mock('@/modules/quest/store', () => ({
  useQuestStore: () => ({
    initialize: questInitMock,
    onItemCollected: questOnItemCollectedMock,
  }),
  setQuestExternalCallbacks: hoisted.setQuestExternalCallbacksMock,
  clearQuestExternalCallbacks: hoisted.clearQuestExternalCallbacksMock,
}));

const combatDisposeMock = vi.fn();
vi.mock('@/modules/combat/store', () => ({
  useCombatStore: () => ({ dispose: combatDisposeMock }),
}));

const audioDisposeMock = vi.fn();
vi.mock('@/modules/audio/store', () => ({
  useAudioStore: () => ({ dispose: audioDisposeMock }),
}));

/** mock enemy/store 的 setBossCreateFn（阶段四：Boss 创建回调注入） */
vi.mock('@/modules/enemy/store', () => ({
  useEnemyStore: () => ({}),
  setBossCreateFn: hoisted.setBossCreateFnMock,
}));

/** mock boss/db 与 boss/service（GameBootstrap 顶层导入，回调内部消费） */
vi.mock('@/modules/boss/db', () => ({
  bossDbService: { getBossTemplate: vi.fn() },
}));
vi.mock('@/modules/boss/service', () => ({
  createBossInstance: vi.fn(),
}));

import { gameBootstrap } from '@/services/GameBootstrap';

describe('GameBootstrap 游戏初始化编排服务', () => {
  beforeEach(() => {
    createTestPinia();
    [
      logInitMock,
      inventoryInitMock,
      equipmentInitMock,
      skillInitMock,
      mapInitMock,
      explorationInitMock,
      questInitMock,
      explorationDisposeMock,
      combatDisposeMock,
      audioDisposeMock,
      hoisted.setInventoryCallbacksMock,
      hoisted.clearInventoryCallbacksMock,
      hoisted.setBossCreateFnMock,
      hoisted.setInventoryExternalCallbacksMock,
      hoisted.clearInventoryExternalCallbacksMock,
      hoisted.setQuestExternalCallbacksMock,
      hoisted.clearQuestExternalCallbacksMock,
    ].forEach(m => m.mockClear());
  });

  describe('initialize：按依赖顺序初始化各模块', () => {
    it('P3-128 并行化：按 Layer 分层调用，层内并行，层间有序', async () => {
      // Arrange：用 timestamp 记录调用顺序，并行层内的相对顺序可任意
      const callTimestamps: Record<string, number> = {};
      const recordCall = (name: string) => { callTimestamps[name] = Date.now(); };
      logInitMock.mockImplementation(() => { recordCall('log'); return Promise.resolve(); });
      inventoryInitMock.mockImplementation(() => { recordCall('inventory'); return Promise.resolve(); });
      equipmentInitMock.mockImplementation(() => { recordCall('equipment'); return Promise.resolve(); });
      skillInitMock.mockImplementation(() => { recordCall('skill'); return Promise.resolve(); });
      mapInitMock.mockImplementation(() => { recordCall('map'); return Promise.resolve(); });
      explorationInitMock.mockImplementation(() => { recordCall('exploration'); return Promise.resolve(); });
      questInitMock.mockImplementation(() => { recordCall('quest'); return Promise.resolve(); });

      // Act
      await gameBootstrap.initialize('char_1');

      // Assert：层间严格有序（前者完成时间 ≤ 后者开始时间）
      // Layer 1（log/inventory）→ Layer 2（equipment/skill/map）→ Layer 3（exploration）→ Layer 4（quest）
      const layer1Max = Math.max(callTimestamps['log'], callTimestamps['inventory']);
      const layer2Min = Math.min(callTimestamps['equipment'], callTimestamps['skill'], callTimestamps['map']);
      const layer2Max = Math.max(callTimestamps['equipment'], callTimestamps['skill'], callTimestamps['map']);
      expect(layer1Max).toBeLessThanOrEqual(layer2Min);
      expect(layer2Max).toBeLessThanOrEqual(callTimestamps['exploration']);
      expect(callTimestamps['exploration']).toBeLessThanOrEqual(callTimestamps['quest']);
    });

    it('将 characterId 透传给各 Store 的 initialize', async () => {
      // Act
      await gameBootstrap.initialize('hero_123');

      // Assert
      expect(logInitMock).toHaveBeenCalledWith('hero_123');
      expect(inventoryInitMock).toHaveBeenCalledWith('hero_123');
      expect(equipmentInitMock).toHaveBeenCalledWith('hero_123');
      expect(skillInitMock).toHaveBeenCalledWith('hero_123');
      expect(mapInitMock).toHaveBeenCalledWith('hero_123');
      expect(explorationInitMock).toHaveBeenCalledWith('hero_123');
      expect(questInitMock).toHaveBeenCalledWith('hero_123');
    });

    it('exploration 调用的是 init 而非 initialize', async () => {
      // Act
      await gameBootstrap.initialize('char_1');

      // Assert
      expect(explorationInitMock).toHaveBeenCalledTimes(1);
    });

    it('在 inventory 初始化后、equipment 初始化前注入背包回调（A1/G1 修复，P3-128 仍保持层间有序）', async () => {
      // Arrange：记录 setInventoryCallbacks 与 equipmentInit 的调用顺序
      const callOrder: string[] = [];
      inventoryInitMock.mockImplementation(() => { callOrder.push('inventory'); return Promise.resolve(); });
      hoisted.setInventoryCallbacksMock.mockImplementation(() => { callOrder.push('injectCallbacks'); });
      equipmentInitMock.mockImplementation(() => { callOrder.push('equipment'); return Promise.resolve(); });

      // Act
      await gameBootstrap.initialize('char_1');

      // Assert：回调注入发生在 inventory 之后、equipment 之前
      const injectIdx = callOrder.indexOf('injectCallbacks');
      const inventoryIdx = callOrder.indexOf('inventory');
      const equipmentIdx = callOrder.indexOf('equipment');
      expect(injectIdx).toBeGreaterThan(inventoryIdx);
      expect(injectIdx).toBeLessThan(equipmentIdx);
      // 注入的是 inventory store 的 addItem / removeItem / flushPersist（DB-1/DB-2 修复）
      expect(hoisted.setInventoryCallbacksMock).toHaveBeenCalledWith(inventoryAddItemMock, inventoryRemoveItemMock, inventoryFlushPersistMock);
    });

    it('在 inventory 初始化后、equipment 初始化前注入 Boss 创建回调（阶段四，P3-128 仍保持层间有序）', async () => {
      // Arrange：记录 setBossCreateFn 与 equipmentInit 的调用顺序
      const callOrder: string[] = [];
      inventoryInitMock.mockImplementation(() => { callOrder.push('inventory'); return Promise.resolve(); });
      hoisted.setBossCreateFnMock.mockImplementation(() => { callOrder.push('injectBossFn'); });
      equipmentInitMock.mockImplementation(() => { callOrder.push('equipment'); return Promise.resolve(); });

      // Act
      await gameBootstrap.initialize('char_1');

      // Assert：Boss 回调注入发生在 inventory 之后、equipment 之前
      const injectIdx = callOrder.indexOf('injectBossFn');
      const inventoryIdx = callOrder.indexOf('inventory');
      const equipmentIdx = callOrder.indexOf('equipment');
      expect(injectIdx).toBeGreaterThan(inventoryIdx);
      expect(injectIdx).toBeLessThan(equipmentIdx);
      // 注入的是一个函数（Boss 创建回调）
      expect(hoisted.setBossCreateFnMock).toHaveBeenCalledTimes(1);
      expect(typeof hoisted.setBossCreateFnMock.mock.calls[0][0]).toBe('function');
    });

    it('在 inventory 初始化后注入 inventory ↔ quest 双向回调（ARCH-2 修复，P3-128 仍保持层间有序）', async () => {
      // Arrange
      const callOrder: string[] = [];
      inventoryInitMock.mockImplementation(() => { callOrder.push('inventory'); return Promise.resolve(); });
      hoisted.setInventoryExternalCallbacksMock.mockImplementation(() => { callOrder.push('injectInvCb'); });
      hoisted.setQuestExternalCallbacksMock.mockImplementation(() => { callOrder.push('injectQuestCb'); });
      equipmentInitMock.mockImplementation(() => { callOrder.push('equipment'); return Promise.resolve(); });

      // Act
      await gameBootstrap.initialize('char_1');

      // Assert：双向回调注入发生在 inventory 之后、equipment 之前
      const invCbIdx = callOrder.indexOf('injectInvCb');
      const questCbIdx = callOrder.indexOf('injectQuestCb');
      const inventoryIdx = callOrder.indexOf('inventory');
      const equipmentIdx = callOrder.indexOf('equipment');
      expect(invCbIdx).toBeGreaterThan(inventoryIdx);
      expect(invCbIdx).toBeLessThan(equipmentIdx);
      expect(questCbIdx).toBeGreaterThan(inventoryIdx);
      expect(questCbIdx).toBeLessThan(equipmentIdx);

      // 注入到 inventory 的是 quest.onItemCollected
      expect(hoisted.setInventoryExternalCallbacksMock).toHaveBeenCalledWith({
        onItemCollected: questOnItemCollectedMock,
      });

      // 注入到 quest 的是包含 getInventoryItemCount / addItemToInventory 的对象
      expect(hoisted.setQuestExternalCallbacksMock).toHaveBeenCalledTimes(1);
      const questCbArg = hoisted.setQuestExternalCallbacksMock.mock.calls[0][0];
      expect(typeof questCbArg.getInventoryItemCount).toBe('function');
      expect(typeof questCbArg.addItemToInventory).toBe('function');
    });

    it('P3-128：Layer 1 中 log 与 inventory 并行（两者调用时间应接近）', async () => {
      // Arrange：模拟两个 Store 都有 50ms 的 IO 耗时
      const startTimes: Record<string, number> = {};
      logInitMock.mockImplementation(async () => {
        startTimes['log'] = Date.now();
        await new Promise(resolve => setTimeout(resolve, 50));
      });
      inventoryInitMock.mockImplementation(async () => {
        startTimes['inventory'] = Date.now();
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Act
      const startTime = Date.now();
      await gameBootstrap.initialize('char_1');
      const endTime = Date.now();

      // Assert：两者几乎同时开始（启动时间差 < 10ms，因为 Promise.all 并发）
      const startDiff = Math.abs(startTimes['log'] - startTimes['inventory']);
      expect(startDiff).toBeLessThan(10);

      // 总耗时 < 串行总耗时（100ms）+ 一些缓冲（Promise.all 调度开销）
      // 实际应在 50-80ms 范围内，加 100ms 缓冲防止 CI 环境抖动
      expect(endTime - startTime).toBeLessThan(180);
    });

    it('P3-128：Layer 2 中 equipment/skill/map 并行（三者调用时间应接近）', async () => {
      // Arrange：模拟三个 Store 都有 50ms 的 IO 耗时
      const startTimes: Record<string, number> = {};
      equipmentInitMock.mockImplementation(async () => {
        startTimes['equipment'] = Date.now();
        await new Promise(resolve => setTimeout(resolve, 50));
      });
      skillInitMock.mockImplementation(async () => {
        startTimes['skill'] = Date.now();
        await new Promise(resolve => setTimeout(resolve, 50));
      });
      mapInitMock.mockImplementation(async () => {
        startTimes['map'] = Date.now();
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Act
      await gameBootstrap.initialize('char_1');

      // Assert：三者几乎同时开始（启动时间差 < 10ms）
      const maxDiff = Math.max(
        Math.abs(startTimes['equipment'] - startTimes['skill']),
        Math.abs(startTimes['equipment'] - startTimes['map']),
        Math.abs(startTimes['skill'] - startTimes['map']),
      );
      expect(maxDiff).toBeLessThan(10);
    });
  });

  describe('dispose：清理资源', () => {
    it('调用 exploration store 的 dispose', () => {
      // Act
      gameBootstrap.dispose();

      // Assert
      expect(explorationDisposeMock).toHaveBeenCalledTimes(1);
    });

    it('调用 combat store 的 dispose（清理战斗定时器）', () => {
      // Act
      gameBootstrap.dispose();

      // Assert
      expect(combatDisposeMock).toHaveBeenCalledTimes(1);
    });

    it('调用 audio store 的 dispose（清理 saveTimer）', () => {
      // Act
      gameBootstrap.dispose();

      // Assert
      expect(audioDisposeMock).toHaveBeenCalledTimes(1);
    });

    it('清除装备模块的背包回调引用（A1/G1 修复）', () => {
      // Act
      gameBootstrap.dispose();

      // Assert
      expect(hoisted.clearInventoryCallbacksMock).toHaveBeenCalledTimes(1);
    });

    it('清除敌人模块的 Boss 创建回调引用（阶段四：避免回调泄漏）', () => {
      // Act
      gameBootstrap.dispose();

      // Assert：传入 null 清除回调，避免角色切换后回调指向旧闭包
      expect(hoisted.setBossCreateFnMock).toHaveBeenCalledWith(null);
    });

    it('清除 inventory ↔ quest 双向回调引用（ARCH-2 修复：避免回调泄漏）', () => {
      // Act
      gameBootstrap.dispose();

      // Assert：双向回调均被清除
      expect(hoisted.clearInventoryExternalCallbacksMock).toHaveBeenCalledTimes(1);
      expect(hoisted.clearQuestExternalCallbacksMock).toHaveBeenCalledTimes(1);
    });

    it('dispose 清理 ≥ 3 个 Store（exploration + combat + audio）', () => {
      // Act
      gameBootstrap.dispose();

      // Assert：三个 Disposable Store 均被调用
      expect(explorationDisposeMock).toHaveBeenCalledTimes(1);
      expect(combatDisposeMock).toHaveBeenCalledTimes(1);
      expect(audioDisposeMock).toHaveBeenCalledTimes(1);
    });
  });
});
