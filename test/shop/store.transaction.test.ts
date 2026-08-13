/**
 * @fileoverview 商店模块阶段二（DB-3）跨表事务保护单元测试
 *
 * 覆盖 useShopStore.buyItem 在库存更新失败时的回滚逻辑：
 * 1. 库存更新失败：回滚背包（removeItem）+ 回滚金币（gainGold）+ toast 提示 + 返回 false
 * 2. 库存更新失败且回滚背包也失败：errorReporter.report 上报回滚失败，仍尝试回滚金币
 * 3. 库存更新失败且回滚金币也失败：errorReporter.report 上报回滚失败
 * 4. 库存更新失败且回滚背包和金币都失败：errorReporter.report 上报三次（主错误 + 背包 + 金币）
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - 顶部 `import 'fake-indexeddb/auto'` 提供 IndexedDB polyfill。
 *  - shopDbService 全量 mock，saveSoldItems / saveShopItems 按用例注入 reject 模拟写入失败。
 *  - shop service 纯函数（generateShopItems/canAffordItem/computeSellPrice）mock 返回可控结果。
 *  - useToast mock 为 vi.hoisted 持有的 stub，便于断言 show 调用。
 *  - SHOPS 种子数据 mock 为可控测试数据。
 *  - character/inventory/log store stub；generateLogId mock。
 *  - errorReporter mock 为 vi.hoisted 持有的 stub，便于断言 report 调用。
 *  - eventBus 使用真实实现，beforeEach 调用 clearAll。
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestPinia } from '../utils/setup';
import { eventBus, GameEvents } from '@/modules/bus';
import { useShopStore } from '@/modules/shop/store';
import { useGameStore } from '@/modules/game';
import type { ShopConfig, ShopItem, SoldItemEntry } from '@/modules/shop/types';
import type { Item } from '@/modules/inventory/types';
import type { Character } from '@/modules/character/types';

// ==================== Mock：GameStore（P3-116：currentShopId 收敛到 GameStore） ====================
// 提供可控的 mock useGameStore，内部用真实 Pinia ref 保证响应式，
// setCurrentShopId/getCurrentShopId 等方法用 vi.hoisted 提升为全局 spy，
// 避免 Pinia action 包装破坏 spy 性质，测试中直接通过 gameStoreSpies 断言。
const gameStoreSpies = vi.hoisted(() => ({
  setCurrentCharacterId: vi.fn(),
  setCurrentShopId: vi.fn(),
  getCurrentCharacterId: vi.fn(),
  getCurrentShopId: vi.fn(),
  updateGameSettings: vi.fn(),
  flushPersist: vi.fn(),
  initialize: vi.fn(),
}));

vi.mock('@/modules/game', async () => {
  const { defineStore } = await import('pinia');
  const { ref } = await import('vue');
  const useGameStore = defineStore('mockGame', () => {
    const currentCharacterId = ref<string | null>(null);
    const currentShopId = ref<string | null>(null);
    // 每次 store 创建时重新绑定 mock 实现到当前 ref（createTestPinia 后 store 重建）
    gameStoreSpies.setCurrentCharacterId.mockImplementation(async (id: string | null) => {
      currentCharacterId.value = id;
    });
    gameStoreSpies.setCurrentShopId.mockImplementation(async (id: string | null) => {
      currentShopId.value = id;
    });
    gameStoreSpies.getCurrentCharacterId.mockImplementation(() => currentCharacterId.value);
    gameStoreSpies.getCurrentShopId.mockImplementation(() => currentShopId.value);
    return {
      currentCharacterId,
      currentShopId,
      setCurrentCharacterId: gameStoreSpies.setCurrentCharacterId,
      setCurrentShopId: gameStoreSpies.setCurrentShopId,
      getCurrentCharacterId: gameStoreSpies.getCurrentCharacterId,
      getCurrentShopId: gameStoreSpies.getCurrentShopId,
      updateGameSettings: gameStoreSpies.updateGameSettings,
      flushPersist: gameStoreSpies.flushPersist,
      initialize: gameStoreSpies.initialize,
    };
  });
  return { useGameStore };
});

// ==================== vi.hoisted：跨 store stub 持有对象 ====================
const mocks = vi.hoisted(() => ({
  characterStore: {
    getCharacterData: vi.fn(() => ({ gold: 1000 }) as Partial<Character>),
    getCharacterId: vi.fn(() => 'char_1'),
    spendGold: vi.fn().mockResolvedValue(true),
    gainGold: vi.fn().mockResolvedValue(undefined),
  },
  inventoryStore: {
    addItem: vi.fn(() => 1),
    removeItem: vi.fn(() => 1),
    flushPersist: vi.fn().mockResolvedValue(undefined),
    getItemInfo: vi.fn(() => null as Item | null),
    getAllItems: vi.fn(() => [] as Item[]),
  },
  logStore: {
    addLogEntry: vi.fn(),
  },
  toast: {
    show: vi.fn(),
    close: vi.fn(),
    visible: { value: false },
    message: { value: '' },
    type: { value: 'info' },
    icon: { value: '' },
  },
  errorReporter: {
    report: vi.fn(),
  },
}));

// ==================== Mock：shop db ====================
vi.mock('@/modules/shop/db', () => ({
  shopDbService: {
    saveShopConfig: vi.fn().mockResolvedValue(undefined),
    getShopConfig: vi.fn().mockResolvedValue(null),
    getAllShopConfigs: vi.fn().mockResolvedValue([]),
    deleteShopConfig: vi.fn().mockResolvedValue(undefined),
    clearAllShopConfigs: vi.fn().mockResolvedValue(undefined),
    saveShopItems: vi.fn().mockResolvedValue(undefined),
    getShopItems: vi.fn().mockResolvedValue(null),
    getShopItemsStorage: vi.fn().mockResolvedValue(null),
    getAllShopItemsStorage: vi.fn().mockResolvedValue([]),
    deleteShopItems: vi.fn().mockResolvedValue(undefined),
    clearAllShopItems: vi.fn().mockResolvedValue(undefined),
    saveSoldItems: vi.fn().mockResolvedValue(undefined),
    getSoldItems: vi.fn().mockResolvedValue([]),
    getAllSoldItems: vi.fn().mockResolvedValue([]),
    clearAllSoldItems: vi.fn().mockResolvedValue(undefined),
    saveCurrentShopId: vi.fn().mockResolvedValue(undefined),
    getCurrentShopId: vi.fn().mockResolvedValue(null),
  },
}));

// ==================== Mock：shop service 纯函数 ====================
vi.mock('@/modules/shop/service', () => ({
  generateShopItems: vi.fn(() => [
    { itemId: 'potion_1', price: 50, quantity: 3 },
    { itemId: 'sword_1', price: 200, quantity: 1 },
  ]),
  canAffordItem: vi.fn(() => true),
  computeSellPrice: vi.fn(() => 25),
}));

// ==================== Mock：useToast（持有 spy 便于断言） ====================
vi.mock('@/composables/useToast', () => ({
  useToast: () => mocks.toast,
}));

// ==================== Mock：errorReporter（持有 spy 便于断言） ====================
vi.mock('@/utils/errorReport', () => ({
  errorReporter: mocks.errorReporter,
}));

// ==================== Mock：SHOPS 种子数据 ====================
vi.mock('@/data/config_shops', () => ({
  SHOPS: [
    { id: 'general_goods', name: '杂货铺', type: 'general', icon: 'game-icons:shop', refreshInterval: 300000 },
  ] as ShopConfig[],
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

// ==================== 取出 spy 引用 ====================
import { shopDbService } from '@/modules/shop/db';
import { canAffordItem } from '@/modules/shop/service';

// ==================== 测试数据构造 helper ====================

function makeShopConfig(o: Partial<ShopConfig> = {}): ShopConfig {
  return {
    id: 'general_goods',
    name: '杂货铺',
    type: 'general',
    icon: 'game-icons:shop',
    refreshInterval: 300000,
    ...o,
  };
}

function makeShopItem(o: Partial<ShopItem> = {}): ShopItem {
  return {
    itemId: 'potion_1',
    price: 50,
    quantity: 3,
    ...o,
  };
}

function makeItem(o: Partial<Item> = {}): Item {
  return {
    id: 'potion_1',
    name: '治疗药水',
    type: 'potion',
    rarity: 'common',
    icon: 'game-icons:potion',
    description: '恢复 50 点生命值',
    value: 100,
    stackable: true,
    capabilities: ['describable', 'usable', 'stackable', 'sellable'],
    ...o,
  };
}

// ==================== 测试用例 ====================

describe('useShopStore - 阶段二 DB-3 跨表事务保护', () => {
  beforeEach(() => {
    createTestPinia();
    vi.clearAllMocks();
    eventBus.clearAll();
    // 重置 stub 默认行为
    mocks.characterStore.spendGold.mockResolvedValue(true);
    mocks.characterStore.gainGold.mockResolvedValue(undefined);
    mocks.characterStore.getCharacterData.mockReturnValue({ gold: 1000 } as Partial<Character>);
    mocks.characterStore.getCharacterId.mockReturnValue('char_1');
    mocks.inventoryStore.addItem.mockReturnValue(1);
    mocks.inventoryStore.removeItem.mockReturnValue(1);
    mocks.inventoryStore.getItemInfo.mockReturnValue(null);
    mocks.inventoryStore.getAllItems.mockReturnValue([]);
    // 重置 db service 默认返回值
    vi.mocked(shopDbService.getShopItemsStorage).mockResolvedValue(null);
    vi.mocked(shopDbService.getShopItems).mockResolvedValue([]);
    vi.mocked(canAffordItem).mockReturnValue(true);
  });

  // -------------------- 回购路径：库存更新失败回滚 --------------------
  describe('回购路径：saveSoldItems 失败', () => {
    it('库存更新失败：回滚背包、回滚金币、toast 提示、返回 false', async () => {
      // Arrange：回购路径，saveSoldItems 抛出
      const dbError = new Error('saveSoldItems 写入失败');
      vi.mocked(shopDbService.saveSoldItems).mockRejectedValueOnce(dbError);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const store = useShopStore();
      const soldEntry: SoldItemEntry = { itemId: 'ore_1', price: 25, quantity: 2 };
      // P3-116：currentShopId 收敛到 GameStore
      useGameStore().setCurrentShopId('general_goods');
      store.$patch({
        currentItems: [{ itemId: 'ore_1', price: 25, quantity: 2 }],
        soldItems: new Map([['general_goods', new Map([['ore_1', soldEntry]])]]),
      });
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'ore_1', name: '铁矿石' }));

      // Act
      const result = await store.buyItem('ore_1', 1);

      // Assert：返回 false
      expect(result).toBe(false);
      // 金币回滚：gainGold 被调用（totalPrice = 25 * 1 = 25）
      expect(mocks.characterStore.gainGold).toHaveBeenCalledWith(25);
      // 背包回滚：removeItem 被调用
      expect(mocks.inventoryStore.removeItem).toHaveBeenCalledWith('ore_1', 1);
      // errorReporter.report 被调用（主错误）
      expect(mocks.errorReporter.report).toHaveBeenCalledWith(
        dbError,
        'manual',
        expect.objectContaining({
          context: '商店购买库存更新失败，已回滚金币和背包',
          shopId: 'general_goods',
          itemId: 'ore_1',
          quantity: 1,
        })
      );
      // toast 提示被调用
      expect(mocks.toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '商店库存更新失败，已退还金币和物品',
          type: 'danger',
          duration: 3000,
        })
      );
      // 交易事件未触发
      const txSpy = vi.fn();
      eventBus.on(GameEvents.SHOP_TRANSACTION, txSpy);
      expect(txSpy).not.toHaveBeenCalled();
      // 日志未记录
      expect(mocks.logStore.addLogEntry).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('回滚背包失败：errorReporter.report 上报回滚失败，仍尝试回滚金币', async () => {
      // Arrange
      const dbError = new Error('saveSoldItems 写入失败');
      vi.mocked(shopDbService.saveSoldItems).mockRejectedValueOnce(dbError);
      const rollbackError = new Error('removeItem 回滚失败');
      mocks.inventoryStore.removeItem.mockImplementationOnce(() => {
        throw rollbackError;
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const store = useShopStore();
      const soldEntry: SoldItemEntry = { itemId: 'ore_1', price: 25, quantity: 2 };
      // P3-116：currentShopId 收敛到 GameStore
      useGameStore().setCurrentShopId('general_goods');
      store.$patch({
        currentItems: [{ itemId: 'ore_1', price: 25, quantity: 2 }],
        soldItems: new Map([['general_goods', new Map([['ore_1', soldEntry]])]]),
      });
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'ore_1', name: '铁矿石' }));

      // Act
      const result = await store.buyItem('ore_1', 1);

      // Assert：返回 false
      expect(result).toBe(false);
      // 仍尝试回滚金币
      expect(mocks.characterStore.gainGold).toHaveBeenCalledWith(25);
      // errorReporter.report 被调用两次：主错误 + 回滚背包失败
      expect(mocks.errorReporter.report).toHaveBeenCalledTimes(2);
      expect(mocks.errorReporter.report).toHaveBeenNthCalledWith(
        1,
        dbError,
        'manual',
        expect.objectContaining({ context: '商店购买库存更新失败，已回滚金币和背包' })
      );
      expect(mocks.errorReporter.report).toHaveBeenNthCalledWith(
        2,
        rollbackError,
        'manual',
        expect.objectContaining({
          context: '商店购买回滚背包失败，物品可能残留',
          shopId: 'general_goods',
          itemId: 'ore_1',
          quantity: 1,
        })
      );
      // 回滚背包失败日志被记录
      expect(errorSpy).toHaveBeenCalledWith(
        '[ShopStore] buyItem 回滚背包失败:',
        rollbackError
      );
      // toast 仍被调用
      expect(mocks.toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'danger' })
      );
      errorSpy.mockRestore();
    });

    it('回滚金币失败：errorReporter.report 上报回滚失败', async () => {
      // Arrange
      const dbError = new Error('saveSoldItems 写入失败');
      vi.mocked(shopDbService.saveSoldItems).mockRejectedValueOnce(dbError);
      const rollbackError = new Error('gainGold 回滚失败');
      mocks.characterStore.gainGold.mockRejectedValueOnce(rollbackError);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const store = useShopStore();
      const soldEntry: SoldItemEntry = { itemId: 'ore_1', price: 25, quantity: 2 };
      // P3-116：currentShopId 收敛到 GameStore
      useGameStore().setCurrentShopId('general_goods');
      store.$patch({
        currentItems: [{ itemId: 'ore_1', price: 25, quantity: 2 }],
        soldItems: new Map([['general_goods', new Map([['ore_1', soldEntry]])]]),
      });
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'ore_1', name: '铁矿石' }));

      // Act
      const result = await store.buyItem('ore_1', 1);

      // Assert：返回 false
      expect(result).toBe(false);
      // 背包回滚仍被调用
      expect(mocks.inventoryStore.removeItem).toHaveBeenCalledWith('ore_1', 1);
      // errorReporter.report 被调用两次：主错误 + 回滚金币失败
      expect(mocks.errorReporter.report).toHaveBeenCalledTimes(2);
      expect(mocks.errorReporter.report).toHaveBeenNthCalledWith(
        1,
        dbError,
        'manual',
        expect.objectContaining({ context: '商店购买库存更新失败，已回滚金币和背包' })
      );
      expect(mocks.errorReporter.report).toHaveBeenNthCalledWith(
        2,
        rollbackError,
        'manual',
        expect.objectContaining({
          context: '商店购买回滚金币失败，金币可能未退还',
          shopId: 'general_goods',
          totalPrice: 25,
        })
      );
      // 回滚金币失败日志被记录
      expect(errorSpy).toHaveBeenCalledWith(
        '[ShopStore] buyItem 回滚金币失败:',
        rollbackError
      );
      errorSpy.mockRestore();
    });

    it('回滚背包和金币都失败：errorReporter.report 上报三次', async () => {
      // Arrange
      const dbError = new Error('saveSoldItems 写入失败');
      vi.mocked(shopDbService.saveSoldItems).mockRejectedValueOnce(dbError);
      const rollbackInventoryError = new Error('removeItem 回滚失败');
      const rollbackGoldError = new Error('gainGold 回滚失败');
      mocks.inventoryStore.removeItem.mockImplementationOnce(() => {
        throw rollbackInventoryError;
      });
      mocks.characterStore.gainGold.mockRejectedValueOnce(rollbackGoldError);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const store = useShopStore();
      const soldEntry: SoldItemEntry = { itemId: 'ore_1', price: 25, quantity: 2 };
      // P3-116：currentShopId 收敛到 GameStore
      useGameStore().setCurrentShopId('general_goods');
      store.$patch({
        currentItems: [{ itemId: 'ore_1', price: 25, quantity: 2 }],
        soldItems: new Map([['general_goods', new Map([['ore_1', soldEntry]])]]),
      });
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'ore_1', name: '铁矿石' }));

      // Act
      const result = await store.buyItem('ore_1', 1);

      // Assert：返回 false
      expect(result).toBe(false);
      // errorReporter.report 被调用三次：主错误 + 背包回滚失败 + 金币回滚失败
      expect(mocks.errorReporter.report).toHaveBeenCalledTimes(3);
      expect(mocks.errorReporter.report).toHaveBeenNthCalledWith(
        1,
        dbError,
        'manual',
        expect.objectContaining({ context: '商店购买库存更新失败，已回滚金币和背包' })
      );
      expect(mocks.errorReporter.report).toHaveBeenNthCalledWith(
        2,
        rollbackInventoryError,
        'manual',
        expect.objectContaining({ context: '商店购买回滚背包失败，物品可能残留' })
      );
      expect(mocks.errorReporter.report).toHaveBeenNthCalledWith(
        3,
        rollbackGoldError,
        'manual',
        expect.objectContaining({ context: '商店购买回滚金币失败，金币可能未退还' })
      );
      // toast 仍被调用
      expect(mocks.toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'danger' })
      );
      errorSpy.mockRestore();
    });
  });

  // -------------------- 生成商品路径：库存更新失败回滚 --------------------
  describe('生成商品路径：saveShopItems 失败', () => {
    it('库存更新失败：回滚背包、回滚金币、返回 false', async () => {
      // Arrange：生成商品路径，getShopItemsStorage 返回数据后 saveShopItems 抛出
      const dbError = new Error('saveShopItems 写入失败');
      vi.mocked(shopDbService.saveShopItems).mockRejectedValueOnce(dbError);
      vi.mocked(shopDbService.getShopItemsStorage).mockResolvedValueOnce({
        shopId: 'general_goods',
        items: [makeShopItem({ itemId: 'potion_1', price: 50, quantity: 3 })],
        lastRefresh: Date.now(),
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const store = useShopStore();
      const item = makeShopItem({ itemId: 'potion_1', price: 50, quantity: 3 });
      // P3-116：currentShopId 收敛到 GameStore
      useGameStore().setCurrentShopId('general_goods');
      store.$patch({ currentItems: [item] });
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'potion_1', name: '治疗药水' }));

      // Act
      const result = await store.buyItem('potion_1', 1);

      // Assert：返回 false
      expect(result).toBe(false);
      // 金币回滚：totalPrice = 50 * 1 = 50
      expect(mocks.characterStore.gainGold).toHaveBeenCalledWith(50);
      // 背包回滚
      expect(mocks.inventoryStore.removeItem).toHaveBeenCalledWith('potion_1', 1);
      // errorReporter.report 被调用
      expect(mocks.errorReporter.report).toHaveBeenCalledWith(
        dbError,
        'manual',
        expect.objectContaining({
          context: '商店购买库存更新失败，已回滚金币和背包',
          shopId: 'general_goods',
          itemId: 'potion_1',
          quantity: 1,
        })
      );
      // toast 提示被调用
      expect(mocks.toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '商店库存更新失败，已退还金币和物品',
          type: 'danger',
        })
      );
      // 日志未记录
      expect(mocks.logStore.addLogEntry).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('getShopItemsStorage 抛出：进入 catch 回滚', async () => {
      // Arrange：getShopItemsStorage 抛出（生成商品路径第一步失败）
      const dbError = new Error('getShopItemsStorage 读取失败');
      vi.mocked(shopDbService.getShopItemsStorage).mockRejectedValueOnce(dbError);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const store = useShopStore();
      const item = makeShopItem({ itemId: 'potion_1', price: 50, quantity: 3 });
      // P3-116：currentShopId 收敛到 GameStore
      useGameStore().setCurrentShopId('general_goods');
      store.$patch({ currentItems: [item] });
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'potion_1', name: '治疗药水' }));

      // Act
      const result = await store.buyItem('potion_1', 1);

      // Assert：返回 false
      expect(result).toBe(false);
      // 金币回滚
      expect(mocks.characterStore.gainGold).toHaveBeenCalledWith(50);
      // 背包回滚
      expect(mocks.inventoryStore.removeItem).toHaveBeenCalledWith('potion_1', 1);
      // errorReporter.report 被调用
      expect(mocks.errorReporter.report).toHaveBeenCalledWith(
        dbError,
        'manual',
        expect.objectContaining({ context: '商店购买库存更新失败，已回滚金币和背包' })
      );
      errorSpy.mockRestore();
    });
  });

  // -------------------- 正常成功路径：验证未触发回滚 --------------------
  describe('正常成功路径：未触发回滚', () => {
    it('回购成功：未调用 errorReporter.report，未调用 removeItem 回滚', async () => {
      // Arrange
      const store = useShopStore();
      const soldEntry: SoldItemEntry = { itemId: 'ore_1', price: 25, quantity: 2 };
      // P3-116：currentShopId 收敛到 GameStore
      useGameStore().setCurrentShopId('general_goods');
      store.$patch({
        currentItems: [{ itemId: 'ore_1', price: 25, quantity: 2 }],
        soldItems: new Map([['general_goods', new Map([['ore_1', soldEntry]])]]),
      });
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'ore_1', name: '铁矿石' }));

      // Act
      const result = await store.buyItem('ore_1', 1);

      // Assert：成功
      expect(result).toBe(true);
      // 未上报错误
      expect(mocks.errorReporter.report).not.toHaveBeenCalled();
      // 未回滚背包（removeItem 仅在回滚时调用，购买流程不调用 removeItem）
      expect(mocks.inventoryStore.removeItem).not.toHaveBeenCalled();
      // 未回滚金币（gainGold 仅在回滚时调用）
      expect(mocks.characterStore.gainGold).not.toHaveBeenCalled();
      // 未触发 danger toast
      expect(mocks.toast.show).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'danger' })
      );
    });

    it('生成商品购买成功：未调用 errorReporter.report', async () => {
      // Arrange
      vi.mocked(shopDbService.getShopItemsStorage).mockResolvedValueOnce({
        shopId: 'general_goods',
        items: [makeShopItem({ itemId: 'potion_1', price: 50, quantity: 3 })],
        lastRefresh: Date.now(),
      });
      const store = useShopStore();
      const item = makeShopItem({ itemId: 'potion_1', price: 50, quantity: 3 });
      // P3-116：currentShopId 收敛到 GameStore
      useGameStore().setCurrentShopId('general_goods');
      store.$patch({ currentItems: [item] });
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'potion_1', name: '治疗药水' }));

      // Act
      const result = await store.buyItem('potion_1', 1);

      // Assert：成功
      expect(result).toBe(true);
      expect(mocks.errorReporter.report).not.toHaveBeenCalled();
      expect(mocks.inventoryStore.removeItem).not.toHaveBeenCalled();
      expect(mocks.characterStore.gainGold).not.toHaveBeenCalled();
    });
  });
});
