/**
 * @fileoverview 商店模块 Pinia Store 单元测试
 *
 * 覆盖 useShopStore 的：
 * 1. State 初始值（shops/currentShopId/currentItems/isLoading/soldItems/lastRefresh 均为初始值）
 * 2. Getters：currentShopConfig（未打开商店返回 null / 命中配置）
 * 3. Actions：
 *    - init（loadShopConfigs 从 DB 加载 / DB 空时种子播种 / 恢复 savedShopId + soldItems + lastRefresh）
 *    - openShop（空 id 守卫 / 不存在守卫 / 成功打开 emit SHOP_OPENED + 持久化 / DB 有商品直接加载）
 *    - buyItem（无商店守卫 / 物品不存在 / 金币不足 / 生成商品路径 / 回购路径）
 *    - sellItem（无商店守卫 / 模板不存在 / 成功出售加入回购列表）
 *    - closeShop（无商店守卫 / 成功关闭 emit SHOP_CLOSED）
 *    - refreshShop（无商店守卫 / 成功刷新）
 *    - 查询辅助（getShopConfig / calculateSellPrice / getSoldItemCount）
 *    - reset（清空 DB + 内存状态）
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - shopDbService 全量 mock。
 *  - shop service 纯函数（generateShopItems/canAffordItem/computeSellPrice）mock 返回可控结果。
 *  - useToast mock（BIZ-21 限购提示）。
 *  - SHOPS 种子数据 mock 为可控测试数据。
 *  - character/inventory/log store stub；generateLogId mock。
 *  - eventBus 使用真实实现，通过 eventBus.on 注册 spy 断言 emit，beforeEach 调用 clearAll。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestPinia } from '../utils/setup';
import { eventBus, GameEvents } from '@/modules/bus';
import type { ShopConfig, ShopItem, SoldItemEntry } from '@/modules/shop/types';
import type { Item } from '@/modules/inventory/types';
import type { Character } from '@/modules/character/types';

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
    getItemInfo: vi.fn(() => null as Item | null),
    getAllItems: vi.fn(() => [] as Item[]),
  },
  logStore: {
    addLogEntry: vi.fn(),
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

// ==================== Mock：useToast ====================
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    show: vi.fn(),
    close: vi.fn(),
    visible: { value: false },
    message: { value: '' },
    type: { value: 'info' },
    icon: { value: '' },
  }),
}));

// ==================== Mock：SHOPS 种子数据 ====================
vi.mock('@/data/config_shops', () => ({
  SHOPS: [
    { id: 'general_goods', name: '杂货铺', type: 'general', icon: 'game-icons:shop', refreshInterval: 300000 },
    { id: 'potion_shop', name: '炼金术士小屋', type: 'potion', icon: 'game-icons:potion-ball', refreshInterval: 600000 },
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
import { generateShopItems, canAffordItem, computeSellPrice } from '@/modules/shop/service';
import { SHOPS } from '@/data/config_shops';
import { useShopStore } from '@/modules/shop/store';

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
    ...o,
  };
}

// ==================== 测试用例 ====================

describe('useShopStore - 商店 Store', () => {
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
    // 重置 db service 默认返回值（确保 once-mock 不受前次测试残留影响）
    vi.mocked(shopDbService.getAllShopConfigs).mockResolvedValue([]);
    vi.mocked(shopDbService.getCurrentShopId).mockResolvedValue(null);
    vi.mocked(shopDbService.getAllSoldItems).mockResolvedValue([]);
    vi.mocked(shopDbService.getAllShopItemsStorage).mockResolvedValue([]);
    vi.mocked(shopDbService.getShopItemsStorage).mockResolvedValue(null);
    vi.mocked(shopDbService.getShopItems).mockResolvedValue(null);
    vi.mocked(canAffordItem).mockReturnValue(true);
    vi.mocked(computeSellPrice).mockReturnValue(25);
    vi.mocked(generateShopItems).mockReturnValue([
      makeShopItem({ itemId: 'potion_1', price: 50, quantity: 3 }),
      makeShopItem({ itemId: 'sword_1', price: 200, quantity: 1 }),
    ]);
  });

  // -------------------- State 初始值 --------------------
  describe('State 初始值', () => {
    it('shops 初始为空数组，currentShopId 初始为 null', () => {
      const store = useShopStore();
      expect(store.shops).toEqual([]);
      expect(store.currentShopId).toBeNull();
    });

    it('currentItems 初始为空数组，isLoading 初始为 false', () => {
      const store = useShopStore();
      expect(store.currentItems).toEqual([]);
      expect(store.isLoading).toBe(false);
    });

    it('soldItems/lastRefresh 初始为空 Map', () => {
      const store = useShopStore();
      expect(store.soldItems.size).toBe(0);
      expect(store.lastRefresh.size).toBe(0);
    });
  });

  // -------------------- Getters --------------------
  describe('Getters', () => {
    it('currentShopConfig：未打开商店时返回 null', () => {
      const store = useShopStore();
      expect(store.currentShopConfig).toBeNull();
    });

    it('currentShopConfig：currentShopId 命中时返回对应配置', () => {
      const store = useShopStore();
      const config = makeShopConfig({ id: 'general_goods' });
      store.$patch({ shops: [config], currentShopId: 'general_goods' });
      expect(store.currentShopConfig).toEqual(config);
    });

    it('currentShopConfig：currentShopId 未命中时返回 null', () => {
      const store = useShopStore();
      store.$patch({ shops: [makeShopConfig({ id: 'general_goods' })], currentShopId: 'unknown' });
      expect(store.currentShopConfig).toBeNull();
    });
  });

  // -------------------- Actions：init --------------------
  describe('Actions：init', () => {
    it('DB 有配置时直接加载到 shops', async () => {
      const configs = [makeShopConfig({ id: 'shop_a' }), makeShopConfig({ id: 'shop_b' })];
      vi.mocked(shopDbService.getAllShopConfigs).mockResolvedValueOnce(configs);
      vi.mocked(shopDbService.getCurrentShopId).mockResolvedValueOnce(null);
      vi.mocked(shopDbService.getAllSoldItems).mockResolvedValueOnce([]);
      vi.mocked(shopDbService.getAllShopItemsStorage).mockResolvedValueOnce([]);

      const store = useShopStore();
      await store.init();

      expect(store.shops).toEqual(configs);
      expect(store.isLoading).toBe(false);
      // 不应调用 saveShopConfig（无需播种）
      expect(shopDbService.saveShopConfig).not.toHaveBeenCalled();
    });

    it('DB 无配置时用 SHOPS 种子数据播种并写回 DB', async () => {
      vi.mocked(shopDbService.getAllShopConfigs).mockResolvedValueOnce([]);
      vi.mocked(shopDbService.getCurrentShopId).mockResolvedValueOnce(null);
      vi.mocked(shopDbService.getAllSoldItems).mockResolvedValueOnce([]);
      vi.mocked(shopDbService.getAllShopItemsStorage).mockResolvedValueOnce([]);

      const store = useShopStore();
      await store.init();

      expect(store.shops).toEqual(SHOPS);
      // 每个种子配置都写回 DB
      expect(shopDbService.saveShopConfig).toHaveBeenCalledTimes(SHOPS.length);
    });

    it('恢复 savedShopId + soldItems + lastRefresh', async () => {
      vi.mocked(shopDbService.getAllShopConfigs).mockResolvedValueOnce(SHOPS);
      vi.mocked(shopDbService.getCurrentShopId).mockResolvedValueOnce('general_goods');
      vi.mocked(shopDbService.getAllSoldItems).mockResolvedValueOnce([
        {
          shopId: 'general_goods',
          soldItems: [{ itemId: 'ore_1', price: 30, quantity: 2 } as SoldItemEntry],
        },
      ]);
      vi.mocked(shopDbService.getAllShopItemsStorage).mockResolvedValueOnce([
        { shopId: 'general_goods', items: [], lastRefresh: 12345 },
      ]);

      const store = useShopStore();
      await store.init();

      expect(store.currentShopId).toBe('general_goods');
      // soldItems 恢复到内存 Map
      expect(store.soldItems.size).toBe(1);
      const soldMap = store.soldItems.get('general_goods');
      expect(soldMap?.get('ore_1')?.quantity).toBe(2);
      // lastRefresh 恢复到内存 Map
      expect(store.lastRefresh.get('general_goods')).toBe(12345);
    });

    it('isLoading 守卫：重复调用 init 直接返回', async () => {
      vi.mocked(shopDbService.getAllShopConfigs).mockResolvedValue(SHOPS);
      vi.mocked(shopDbService.getCurrentShopId).mockResolvedValue(null);
      vi.mocked(shopDbService.getAllSoldItems).mockResolvedValue([]);
      vi.mocked(shopDbService.getAllShopItemsStorage).mockResolvedValue([]);

      const store = useShopStore();
      // 第一次调用设置 isLoading=true，模拟并发
      store.$patch({ isLoading: true });

      await store.init();

      // isLoading 为 true 时直接返回，未加载配置
      expect(shopDbService.getAllShopConfigs).not.toHaveBeenCalled();
    });
  });

  // -------------------- Actions：openShop --------------------
  describe('Actions：openShop', () => {
    it('空 shopId 直接返回不执行', async () => {
      const openedSpy = vi.fn();
      eventBus.on(GameEvents.SHOP_OPENED, openedSpy);

      const store = useShopStore();
      await store.openShop('');

      expect(openedSpy).not.toHaveBeenCalled();
      expect(store.currentShopId).toBeNull();
    });

    it('不存在的 shopId 直接返回', async () => {
      vi.mocked(shopDbService.getAllShopConfigs).mockResolvedValueOnce(SHOPS);
      const openedSpy = vi.fn();
      eventBus.on(GameEvents.SHOP_OPENED, openedSpy);

      const store = useShopStore();
      await store.openShop('unknown_shop');

      expect(openedSpy).not.toHaveBeenCalled();
      expect(store.currentShopId).toBeNull();
    });

    it('成功打开：加载/生成商品、emit SHOP_OPENED、持久化 currentShopId', async () => {
      vi.mocked(shopDbService.getAllShopConfigs).mockResolvedValueOnce(SHOPS);
      vi.mocked(shopDbService.getShopItemsStorage).mockResolvedValueOnce(null);
      const openedSpy = vi.fn();
      eventBus.on(GameEvents.SHOP_OPENED, openedSpy);

      const store = useShopStore();
      await store.openShop('general_goods');

      expect(store.currentShopId).toBe('general_goods');
      expect(store.currentItems.length).toBeGreaterThan(0);
      expect(shopDbService.saveCurrentShopId).toHaveBeenCalledWith('general_goods');
      expect(openedSpy).toHaveBeenCalledWith({ shopId: 'general_goods', characterId: 'char_1' });
    });

    it('DB 有商品时直接加载不重新生成', async () => {
      vi.mocked(shopDbService.getAllShopConfigs).mockResolvedValueOnce(SHOPS);
      const storedItems = [makeShopItem({ itemId: 'stored_1', price: 10, quantity: 5 })];
      // 使用 mockResolvedValue（持久）而非 Once，确保多次调用均返回存储数据
      vi.mocked(shopDbService.getShopItemsStorage).mockResolvedValue({
        shopId: 'general_goods',
        items: storedItems,
        lastRefresh: Date.now(),
      });

      const store = useShopStore();
      await store.openShop('general_goods');

      // 验证 getShopItemsStorage 被调用
      expect(shopDbService.getShopItemsStorage).toHaveBeenCalledWith('general_goods');
      // 不应调用 generateShopItems（DB 有商品时无需重新生成）
      expect(generateShopItems).not.toHaveBeenCalled();
      // currentItems 包含 DB 中的商品
      expect(store.currentItems.some(i => i.itemId === 'stored_1')).toBe(true);
    });

    it('切换商店时清空旧商品列表', async () => {
      vi.mocked(shopDbService.getAllShopConfigs).mockResolvedValue(SHOPS);
      vi.mocked(shopDbService.getShopItemsStorage).mockResolvedValue(null);

      const store = useShopStore();
      // 先打开第一个商店
      await store.openShop('general_goods');
      const firstItems = store.currentItems.length;
      expect(firstItems).toBeGreaterThan(0);

      // 切换到第二个商店
      await store.openShop('potion_shop');
      expect(store.currentShopId).toBe('potion_shop');
    });
  });

  // -------------------- Actions：buyItem --------------------
  describe('Actions：buyItem', () => {
    it('无 currentShopId 返回 false', async () => {
      const store = useShopStore();
      const result = await store.buyItem('potion_1', 1);
      expect(result).toBe(false);
    });

    it('物品不存在返回 false', async () => {
      const store = useShopStore();
      store.$patch({ currentShopId: 'general_goods', currentItems: [] });

      const result = await store.buyItem('not_exist', 1);
      expect(result).toBe(false);
    });

    it('金币不足返回 false', async () => {
      const store = useShopStore();
      const item = makeShopItem({ itemId: 'potion_1', price: 50, quantity: 3 });
      store.$patch({ currentShopId: 'general_goods', currentItems: [item] });
      vi.mocked(canAffordItem).mockReturnValue(false);

      const result = await store.buyItem('potion_1', 1);
      expect(result).toBe(false);
      expect(mocks.characterStore.spendGold).not.toHaveBeenCalled();
    });

    it('背包空间不足时返还金币', async () => {
      const store = useShopStore();
      const item = makeShopItem({ itemId: 'potion_1', price: 50, quantity: 3 });
      store.$patch({ currentShopId: 'general_goods', currentItems: [item] });
      mocks.inventoryStore.addItem.mockReturnValue(0); // 背包满
      vi.mocked(shopDbService.getShopItemsStorage).mockResolvedValueOnce({
        shopId: 'general_goods',
        items: [item],
        lastRefresh: Date.now(),
      });

      const result = await store.buyItem('potion_1', 1);
      expect(result).toBe(false);
      // 返还金币
      expect(mocks.characterStore.gainGold).toHaveBeenCalledWith(50);
    });

    it('成功购买生成商品：扣金币、加背包、减库存、emit SHOP_TRANSACTION、记录日志', async () => {
      const store = useShopStore();
      const item = makeShopItem({ itemId: 'potion_1', price: 50, quantity: 3 });
      store.$patch({ currentShopId: 'general_goods', currentItems: [item] });
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'potion_1', name: '治疗药水' }));
      vi.mocked(shopDbService.getShopItemsStorage).mockResolvedValue({
        shopId: 'general_goods',
        items: [makeShopItem({ itemId: 'potion_1', price: 50, quantity: 3 })],
        lastRefresh: Date.now(),
      });
      const txSpy = vi.fn();
      eventBus.on(GameEvents.SHOP_TRANSACTION, txSpy);

      const result = await store.buyItem('potion_1', 1);

      expect(result).toBe(true);
      expect(mocks.characterStore.spendGold).toHaveBeenCalledWith(50);
      expect(mocks.inventoryStore.addItem).toHaveBeenCalledWith('potion_1', 1);
      // 持久化扣减后的库存
      expect(shopDbService.saveShopItems).toHaveBeenCalled();
      expect(txSpy).toHaveBeenCalledWith(expect.objectContaining({ shopId: 'general_goods', itemId: 'potion_1', quantity: 1, totalPrice: 50 }));
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'shop', message: expect.stringContaining('治疗药水') })
      );
    });

    it('成功购买回购物品：从 soldItems Map 扣减并持久化', async () => {
      const store = useShopStore();
      const soldEntry: SoldItemEntry = { itemId: 'ore_1', price: 25, quantity: 2 };
      const innerMap = new Map([['ore_1', soldEntry]]);
      store.$patch({
        currentShopId: 'general_goods',
        currentItems: [{ itemId: 'ore_1', price: 25, quantity: 2 }],
        soldItems: new Map([['general_goods', innerMap]]),
      });
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'ore_1', name: '铁矿石' }));
      vi.mocked(shopDbService.getShopItems).mockResolvedValue([]);

      const result = await store.buyItem('ore_1', 1);

      expect(result).toBe(true);
      expect(shopDbService.saveSoldItems).toHaveBeenCalledWith('general_goods', expect.any(Array));
      // 回购物品不调用 saveShopItems
      expect(shopDbService.saveShopItems).not.toHaveBeenCalled();
    });
  });

  // -------------------- Actions：sellItem --------------------
  describe('Actions：sellItem', () => {
    it('无 currentShopId 返回 false', async () => {
      const store = useShopStore();
      const result = await store.sellItem('potion_1', 1);
      expect(result).toBe(false);
    });

    it('物品模板不存在返回 false', async () => {
      const store = useShopStore();
      store.$patch({ currentShopId: 'general_goods' });
      mocks.inventoryStore.getItemInfo.mockReturnValue(null);

      const result = await store.sellItem('not_exist', 1);
      expect(result).toBe(false);
    });

    it('成功出售：减背包、加金币、加入回购列表、emit SHOP_TRANSACTION、记录日志', async () => {
      const store = useShopStore();
      store.$patch({ currentShopId: 'general_goods' });
      const itemTemplate = makeItem({ id: 'potion_1', name: '治疗药水' });
      mocks.inventoryStore.getItemInfo.mockReturnValue(itemTemplate);
      mocks.inventoryStore.removeItem.mockReturnValue(2); // 实际移除 2 件
      vi.mocked(computeSellPrice).mockReturnValue(50);
      vi.mocked(shopDbService.getShopItems).mockResolvedValue([]);
      const txSpy = vi.fn();
      eventBus.on(GameEvents.SHOP_TRANSACTION, txSpy);

      const result = await store.sellItem('potion_1', 2);

      expect(result).toBe(true);
      expect(mocks.inventoryStore.removeItem).toHaveBeenCalledWith('potion_1', 2);
      expect(mocks.characterStore.gainGold).toHaveBeenCalledWith(100); // 50 * 2
      // 加入回购列表
      expect(store.soldItems.size).toBe(1);
      const soldMap = store.soldItems.get('general_goods');
      expect(soldMap?.get('potion_1')?.quantity).toBe(2);
      // 持久化回购列表
      expect(shopDbService.saveSoldItems).toHaveBeenCalledWith('general_goods', expect.any(Array));
      expect(txSpy).toHaveBeenCalledWith(expect.objectContaining({ shopId: 'general_goods', itemId: 'potion_1', sellPrice: 100 }));
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'shop', message: expect.stringContaining('治疗药水') })
      );
    });

    it('同物品多次出售合并数量', async () => {
      const store = useShopStore();
      const existingEntry: SoldItemEntry = { itemId: 'potion_1', price: 50, quantity: 1 };
      store.$patch({
        currentShopId: 'general_goods',
        soldItems: new Map([['general_goods', new Map([['potion_1', existingEntry]])]]),
      });
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'potion_1', name: '治疗药水' }));
      mocks.inventoryStore.removeItem.mockReturnValue(2); // 实际移除 2 件
      vi.mocked(computeSellPrice).mockReturnValue(50);
      vi.mocked(shopDbService.getShopItems).mockResolvedValue([]);

      await store.sellItem('potion_1', 2);

      const soldMap = store.soldItems.get('general_goods');
      expect(soldMap?.get('potion_1')?.quantity).toBe(3); // 1 + 2
    });
  });

  // -------------------- Actions：closeShop --------------------
  describe('Actions：closeShop', () => {
    it('无 currentShopId 直接返回', async () => {
      const closedSpy = vi.fn();
      eventBus.on(GameEvents.SHOP_CLOSED, closedSpy);

      const store = useShopStore();
      await store.closeShop();

      expect(closedSpy).not.toHaveBeenCalled();
      expect(shopDbService.saveCurrentShopId).not.toHaveBeenCalled();
    });

    it('成功关闭：清空状态、emit SHOP_CLOSED、持久化 null', async () => {
      const closedSpy = vi.fn();
      eventBus.on(GameEvents.SHOP_CLOSED, closedSpy);

      const store = useShopStore();
      store.$patch({ currentShopId: 'general_goods', currentItems: [makeShopItem()] });

      await store.closeShop();

      expect(store.currentShopId).toBeNull();
      expect(store.currentItems).toEqual([]);
      expect(shopDbService.saveCurrentShopId).toHaveBeenCalledWith(null);
      expect(closedSpy).toHaveBeenCalledWith({ shopId: 'general_goods' });
    });
  });

  // -------------------- Actions：refreshShop --------------------
  describe('Actions：refreshShop', () => {
    it('无 currentShopId 直接返回', async () => {
      const store = useShopStore();
      await store.refreshShop();
      expect(generateShopItems).not.toHaveBeenCalled();
    });

    it('成功刷新：重新生成商品并更新 currentItems', async () => {
      const newItems = [makeShopItem({ itemId: 'fresh_1', price: 30, quantity: 2 })];
      vi.mocked(generateShopItems).mockReturnValueOnce(newItems);

      const store = useShopStore();
      store.$patch({
        currentShopId: 'general_goods',
        shops: [makeShopConfig()],
      });

      await store.refreshShop();

      expect(generateShopItems).toHaveBeenCalled();
      expect(store.currentItems.some(i => i.itemId === 'fresh_1')).toBe(true);
      expect(shopDbService.saveShopItems).toHaveBeenCalled();
    });
  });

  // -------------------- 查询辅助方法 --------------------
  describe('查询辅助方法', () => {
    it('getShopConfig：返回指定 id 的配置，不存在返回 null', () => {
      const store = useShopStore();
      const config = makeShopConfig({ id: 'shop_a' });
      store.$patch({ shops: [config] });

      expect(store.getShopConfig('shop_a')).toEqual(config);
      expect(store.getShopConfig('unknown')).toBeNull();
    });

    it('calculateSellPrice：物品存在时返回计算后的售价', () => {
      const store = useShopStore();
      const item = makeItem({ id: 'potion_1' });
      mocks.inventoryStore.getItemInfo.mockReturnValue(item);
      vi.mocked(computeSellPrice).mockReturnValue(40);

      expect(store.calculateSellPrice('potion_1')).toBe(40);
      expect(computeSellPrice).toHaveBeenCalledWith(item);
    });

    it('calculateSellPrice：物品不存在时返回 0', () => {
      const store = useShopStore();
      mocks.inventoryStore.getItemInfo.mockReturnValue(null);

      expect(store.calculateSellPrice('not_exist')).toBe(0);
    });

    it('getSoldItemCount：返回指定物品的回购数量', () => {
      const store = useShopStore();
      const entry: SoldItemEntry = { itemId: 'ore_1', price: 30, quantity: 5 };
      store.$patch({
        currentShopId: 'general_goods',
        soldItems: new Map([['general_goods', new Map([['ore_1', entry]])]]),
      });

      expect(store.getSoldItemCount('ore_1')).toBe(5);
      expect(store.getSoldItemCount('not_sold')).toBe(0);
    });

    it('getSoldItemCount：无 currentShopId 时返回 0', () => {
      const store = useShopStore();
      expect(store.getSoldItemCount('any')).toBe(0);
    });
  });

  // -------------------- Actions：reset --------------------
  describe('Actions：reset', () => {
    it('清空 DB + 内存状态', async () => {
      const store = useShopStore();
      store.$patch({
        shops: [makeShopConfig()],
        currentShopId: 'general_goods',
        currentItems: [makeShopItem()],
      });

      await store.reset();

      expect(shopDbService.clearAllShopItems).toHaveBeenCalled();
      expect(shopDbService.clearAllSoldItems).toHaveBeenCalled();
      expect(shopDbService.saveCurrentShopId).toHaveBeenCalledWith(null);
      expect(store.shops).toEqual([]);
      expect(store.currentShopId).toBeNull();
      expect(store.currentItems).toEqual([]);
      expect(store.soldItems.size).toBe(0);
      expect(store.lastRefresh.size).toBe(0);
    });
  });

  // -------------------- Actions：init 异常分支 --------------------
  describe('Actions：init 异常分支', () => {
    it('getAllShopConfigs 抛错 → catch 记录错误，isLoading 复位为 false', async () => {
      // Arrange：loadShopConfigs 内部 getAllShopConfigs reject
      vi.mocked(shopDbService.getAllShopConfigs).mockRejectedValueOnce(new Error('db down'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const store = useShopStore();
      await store.init();

      // Assert：错误被 catch 捕获，isLoading 复位
      expect(errorSpy).toHaveBeenCalledWith('[ShopStore] 初始化失败:', expect.any(Error));
      expect(store.isLoading).toBe(false);
      errorSpy.mockRestore();
    });

    it('getAllShopItemsStorage 返回非 number lastRefresh → 跳过恢复该时间戳', async () => {
      // Arrange：storage.lastRefresh 为字符串（非 number），应跳过 set
      vi.mocked(shopDbService.getAllShopConfigs).mockResolvedValueOnce(SHOPS);
      vi.mocked(shopDbService.getCurrentShopId).mockResolvedValueOnce(null);
      vi.mocked(shopDbService.getAllSoldItems).mockResolvedValueOnce([]);
      vi.mocked(shopDbService.getAllShopItemsStorage).mockResolvedValueOnce([
        { shopId: 'general_goods', items: [], lastRefresh: 'not-a-number' as unknown as number },
      ]);

      const store = useShopStore();
      await store.init();

      // Assert：lastRefresh Map 不包含该商店（typeof 校验失败被跳过）
      expect(store.lastRefresh.has('general_goods')).toBe(false);
    });

    it('DB 无配置且 saveShopConfig reject → catch 记录错误但不阻断流程', async () => {
      // Arrange：DB 无配置触发种子播种，saveShopConfig reject
      vi.mocked(shopDbService.getAllShopConfigs).mockResolvedValueOnce([]);
      vi.mocked(shopDbService.getCurrentShopId).mockResolvedValueOnce(null);
      vi.mocked(shopDbService.getAllSoldItems).mockResolvedValueOnce([]);
      vi.mocked(shopDbService.getAllShopItemsStorage).mockResolvedValueOnce([]);
      vi.mocked(shopDbService.saveShopConfig).mockRejectedValueOnce(new Error('write fail'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const store = useShopStore();
      await store.init();
      // 刷新微任务队列，确保 fire-and-forget 的 .catch 回调执行
      await new Promise(resolve => setTimeout(resolve, 0));

      // Assert：shops 仍加载种子数据（catch 不阻断），错误被记录
      expect(store.shops).toEqual(SHOPS);
      expect(errorSpy).toHaveBeenCalledWith('[ShopStore] 种子商店配置写入失败:', expect.any(Error));
      errorSpy.mockRestore();
    });
  });

  // -------------------- Actions：openShop 刷新与异常分支 --------------------
  describe('Actions：openShop 刷新与异常分支', () => {
    it('getShopItemsStorage 返回无 lastRefresh → 不触发刷新检查', async () => {
      // Arrange：storage 有商品但 lastRefresh 非 number，loadOrGenerateItems 不设置 lastRefresh
      vi.mocked(shopDbService.getAllShopConfigs).mockResolvedValueOnce(SHOPS);
      const storedItems = [makeShopItem({ itemId: 'stored_1', price: 10, quantity: 5 })];
      vi.mocked(shopDbService.getShopItemsStorage).mockResolvedValueOnce({
        shopId: 'general_goods',
        items: storedItems,
        lastRefresh: undefined as unknown as number,
      });

      const store = useShopStore();
      await store.openShop('general_goods');

      // Assert：lastRefresh 未被设置（非 number），但不影响商品加载
      expect(store.lastRefresh.has('general_goods')).toBe(false);
      expect(store.currentItems.some(i => i.itemId === 'stored_1')).toBe(true);
    });

    it('lastRefresh 过期 → 触发 regenerateItems 刷新商品', async () => {
      // Arrange：storage.lastRefresh 远早于现在，超过 refreshInterval
      vi.mocked(shopDbService.getAllShopConfigs).mockResolvedValueOnce(SHOPS);
      vi.mocked(shopDbService.getShopItemsStorage).mockResolvedValueOnce({
        shopId: 'general_goods',
        items: [makeShopItem({ itemId: 'stale_1', price: 10, quantity: 5 })],
        lastRefresh: Date.now() - 400000, // 超过 300000ms 的刷新间隔
      });
      const freshItems = [makeShopItem({ itemId: 'fresh_1', price: 30, quantity: 2 })];
      vi.mocked(generateShopItems).mockReturnValueOnce(freshItems);

      const store = useShopStore();
      await store.openShop('general_goods');

      // Assert：触发了 regenerateItems，currentItems 为新生成的商品
      expect(generateShopItems).toHaveBeenCalled();
      expect(store.currentItems.some(i => i.itemId === 'fresh_1')).toBe(true);
      expect(store.currentItems.some(i => i.itemId === 'stale_1')).toBe(false);
    });

    it('重复打开同一商店 → 不清空 currentItems（跳过 clear 分支）', async () => {
      vi.mocked(shopDbService.getAllShopConfigs).mockResolvedValue(SHOPS);
      vi.mocked(shopDbService.getShopItemsStorage).mockResolvedValue(null);

      const store = useShopStore();
      await store.openShop('general_goods');
      // 再次打开同一商店：currentShopId === shopId，跳过清空分支
      await store.openShop('general_goods');

      expect(store.currentShopId).toBe('general_goods');
      expect(store.currentItems.length).toBeGreaterThan(0);
    });

    it('getCharacterId 返回空 → emit 时 characterId 为 undefined', async () => {
      vi.mocked(shopDbService.getAllShopConfigs).mockResolvedValueOnce(SHOPS);
      vi.mocked(shopDbService.getShopItemsStorage).mockResolvedValueOnce(null);
      mocks.characterStore.getCharacterId.mockReturnValue('');
      const openedSpy = vi.fn();
      eventBus.on(GameEvents.SHOP_OPENED, openedSpy);

      const store = useShopStore();
      await store.openShop('general_goods');

      // Assert：characterId 为空时 emit payload 中 characterId 为 undefined
      expect(openedSpy).toHaveBeenCalledWith({ shopId: 'general_goods', characterId: undefined });
    });

    it('loadOrGenerateItems 抛错 → catch 记录错误', async () => {
      vi.mocked(shopDbService.getAllShopConfigs).mockResolvedValueOnce(SHOPS);
      vi.mocked(shopDbService.getShopItemsStorage).mockRejectedValueOnce(new Error('load fail'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const store = useShopStore();
      await store.openShop('general_goods');

      expect(errorSpy).toHaveBeenCalledWith('[ShopStore] 打开商店失败:', expect.any(Error));
      errorSpy.mockRestore();
    });
  });

  // -------------------- Actions：buyItem 限购与部分成功 --------------------
  describe('Actions：buyItem 限购与部分成功', () => {
    it('maxPurchaseCount 限购：剩余 > 0 → 返回 false，不扣金币', async () => {
      // Arrange：商品限购 5 次，已购 4 次，购买 2 件超过剩余 1 次
      const store = useShopStore();
      const item = makeShopItem({
        itemId: 'rare_1', price: 100, quantity: 5, maxPurchaseCount: 5, purchasedCount: 4,
      });
      store.$patch({ currentShopId: 'general_goods', currentItems: [item] });

      const result = await store.buyItem('rare_1', 2);

      // Assert：被限购拦截，未扣金币
      expect(result).toBe(false);
      expect(mocks.characterStore.spendGold).not.toHaveBeenCalled();
    });

    it('maxPurchaseCount 限购：已达上限 → 返回 false', async () => {
      // Arrange：商品限购 3 次，已购 3 次，再买 1 件
      const store = useShopStore();
      const item: ShopItem = {
        itemId: 'rare_2', price: 100, quantity: 5, maxPurchaseCount: 3, purchasedCount: 3,
      };
      store.$patch({ currentShopId: 'general_goods', currentItems: [item] });

      const result = await store.buyItem('rare_2', 1);

      expect(result).toBe(false);
      expect(mocks.characterStore.spendGold).not.toHaveBeenCalled();
    });

    it('spendGold 失败 → 返回 false，不加背包', async () => {
      const store = useShopStore();
      const item = makeShopItem({ itemId: 'potion_1', price: 50, quantity: 3 });
      store.$patch({ currentShopId: 'general_goods', currentItems: [item] });
      mocks.characterStore.spendGold.mockResolvedValue(false);

      const result = await store.buyItem('potion_1', 1);

      expect(result).toBe(false);
      expect(mocks.inventoryStore.addItem).not.toHaveBeenCalled();
    });

    it('部分成功（added > 0 且 < quantity）→ 返还部分金币并继续流程', async () => {
      const store = useShopStore();
      const item = makeShopItem({ itemId: 'potion_1', price: 50, quantity: 5 });
      store.$patch({ currentShopId: 'general_goods', currentItems: [item] });
      mocks.inventoryStore.addItem.mockReturnValue(2); // 购买 3 件只成功 2 件
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'potion_1', name: '治疗药水' }));
      vi.mocked(shopDbService.getShopItemsStorage).mockResolvedValueOnce({
        shopId: 'general_goods',
        items: [makeShopItem({ itemId: 'potion_1', price: 50, quantity: 5 })],
        lastRefresh: Date.now(),
      });

      const result = await store.buyItem('potion_1', 3);

      // Assert：部分成功返回 true，返还 1 件金币（50），原始总价仍按 3 件扣
      expect(result).toBe(true);
      expect(mocks.characterStore.spendGold).toHaveBeenCalledWith(150); // 3*50
      expect(mocks.characterStore.gainGold).toHaveBeenCalledWith(50); // (3-2)*50
    });

    it('部分成功且单价为 0 → 不返还金币（refundAmount === 0）', async () => {
      const store = useShopStore();
      const item = makeShopItem({ itemId: 'free_1', price: 0, quantity: 5 });
      store.$patch({ currentShopId: 'general_goods', currentItems: [item] });
      mocks.inventoryStore.addItem.mockReturnValue(2); // 购买 3 件只成功 2 件
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'free_1', name: '免费物品' }));
      vi.mocked(shopDbService.getShopItemsStorage).mockResolvedValueOnce({
        shopId: 'general_goods',
        items: [makeShopItem({ itemId: 'free_1', price: 0, quantity: 5 })],
        lastRefresh: Date.now(),
      });

      const result = await store.buyItem('free_1', 3);

      // Assert：单价 0，refundAmount = 0，不调用 gainGold
      expect(result).toBe(true);
      expect(mocks.characterStore.gainGold).not.toHaveBeenCalled();
    });

    it('回购全部买完 → 从 soldItems 删除该物品及商店条目', async () => {
      const store = useShopStore();
      const soldEntry: SoldItemEntry = { itemId: 'ore_1', price: 25, quantity: 2 };
      store.$patch({
        currentShopId: 'general_goods',
        currentItems: [{ itemId: 'ore_1', price: 25, quantity: 2 }],
        soldItems: new Map([['general_goods', new Map([['ore_1', soldEntry]])]]),
      });
      mocks.inventoryStore.addItem.mockReturnValue(2); // 背包成功放入全部 2 件
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'ore_1', name: '铁矿石' }));
      vi.mocked(shopDbService.getShopItems).mockResolvedValue([]);

      const result = await store.buyItem('ore_1', 2);

      // Assert：购买成功，回购列表清空（物品及商店条目均被删除）
      expect(result).toBe(true);
      expect(store.soldItems.has('general_goods')).toBe(false);
      // saveSoldItems 以空数组持久化（updatedSoldMap 为 undefined）
      expect(shopDbService.saveSoldItems).toHaveBeenCalledWith('general_goods', []);
    });

    it('生成商品无 storage → generated 为 null，跳过库存更新', async () => {
      const store = useShopStore();
      const item = makeShopItem({ itemId: 'potion_1', price: 50, quantity: 3 });
      store.$patch({ currentShopId: 'general_goods', currentItems: [item] });
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'potion_1', name: '治疗药水' }));
      // getShopItemsStorage 默认返回 null（beforeEach 已设置）

      const result = await store.buyItem('potion_1', 1);

      // Assert：购买成功，但未调用 saveShopItems（generated 为 null）
      expect(result).toBe(true);
      expect(shopDbService.saveShopItems).not.toHaveBeenCalled();
    });

    it('生成商品不在 storage items 中 → idx === -1 跳过更新', async () => {
      const store = useShopStore();
      const item = makeShopItem({ itemId: 'potion_1', price: 50, quantity: 3 });
      store.$patch({ currentShopId: 'general_goods', currentItems: [item] });
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'potion_1', name: '治疗药水' }));
      // storage 中只有 other 物品，不含 potion_1
      vi.mocked(shopDbService.getShopItemsStorage).mockResolvedValueOnce({
        shopId: 'general_goods',
        items: [makeShopItem({ itemId: 'other', price: 10, quantity: 1 })],
        lastRefresh: Date.now(),
      });

      const result = await store.buyItem('potion_1', 1);

      // Assert：购买成功，但未调用 saveShopItems（idx === -1）
      expect(result).toBe(true);
      expect(shopDbService.saveShopItems).not.toHaveBeenCalled();
    });

    it('生成商品携带 maxPurchaseCount → 累计 purchasedCount', async () => {
      const store = useShopStore();
      const item: ShopItem = {
        itemId: 'rare_1', price: 100, quantity: 3, maxPurchaseCount: 5, purchasedCount: 1,
      };
      store.$patch({ currentShopId: 'general_goods', currentItems: [item] });
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'rare_1', name: '稀有装备' }));
      vi.mocked(shopDbService.getShopItemsStorage).mockResolvedValueOnce({
        shopId: 'general_goods',
        items: [{ itemId: 'rare_1', price: 100, quantity: 3, maxPurchaseCount: 5, purchasedCount: 1 }],
        lastRefresh: Date.now(),
      });

      const result = await store.buyItem('rare_1', 1);

      // Assert：购买成功，purchasedCount 累计为 2 并持久化
      expect(result).toBe(true);
      expect(shopDbService.saveShopItems).toHaveBeenCalledWith(
        'general_goods',
        expect.arrayContaining([expect.objectContaining({ itemId: 'rare_1', purchasedCount: 2 })]),
        expect.any(Number)
      );
    });

    it('购买使生成商品 quantity 归零 → splice 移除', async () => {
      const store = useShopStore();
      const item = makeShopItem({ itemId: 'potion_1', price: 50, quantity: 1 });
      store.$patch({ currentShopId: 'general_goods', currentItems: [item] });
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'potion_1', name: '治疗药水' }));
      vi.mocked(shopDbService.getShopItemsStorage).mockResolvedValueOnce({
        shopId: 'general_goods',
        items: [makeShopItem({ itemId: 'potion_1', price: 50, quantity: 1 })],
        lastRefresh: Date.now(),
      });

      const result = await store.buyItem('potion_1', 1);

      // Assert：购买成功，saveShopItems 以空列表持久化（物品被 splice）
      expect(result).toBe(true);
      expect(shopDbService.saveShopItems).toHaveBeenCalledWith('general_goods', [], expect.any(Number));
    });
  });

  // -------------------- Actions：sellItem 边界分支 --------------------
  describe('Actions：sellItem 边界分支', () => {
    it('computeSellPrice 返回 0 → 返回 false', async () => {
      const store = useShopStore();
      store.$patch({ currentShopId: 'general_goods' });
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'junk_1', name: '废弃物' }));
      vi.mocked(computeSellPrice).mockReturnValue(0);

      const result = await store.sellItem('junk_1', 1);

      expect(result).toBe(false);
      expect(mocks.inventoryStore.removeItem).not.toHaveBeenCalled();
    });

    it('removeItem 返回 0 → 返回 false', async () => {
      const store = useShopStore();
      store.$patch({ currentShopId: 'general_goods' });
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'potion_1', name: '治疗药水' }));
      vi.mocked(computeSellPrice).mockReturnValue(25);
      mocks.inventoryStore.removeItem.mockReturnValue(0);

      const result = await store.sellItem('potion_1', 1);

      expect(result).toBe(false);
      expect(mocks.characterStore.gainGold).not.toHaveBeenCalled();
    });

    it('getShopItems 返回 null → mergeItems 以空列表合并', async () => {
      const store = useShopStore();
      store.$patch({ currentShopId: 'general_goods' });
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'potion_1', name: '治疗药水' }));
      mocks.inventoryStore.removeItem.mockReturnValue(1);
      vi.mocked(computeSellPrice).mockReturnValue(25);
      vi.mocked(shopDbService.getShopItems).mockResolvedValue(null);

      const result = await store.sellItem('potion_1', 1);

      // Assert：出售成功，currentGenerated 为 null 时 mergeItems([]) 仍包含回购物品
      expect(result).toBe(true);
      expect(store.currentItems.some(i => i.itemId === 'potion_1')).toBe(true);
    });

    it('actualQuantity === 1 → 日志不带数量后缀', async () => {
      const store = useShopStore();
      store.$patch({ currentShopId: 'general_goods' });
      mocks.inventoryStore.getItemInfo.mockReturnValue(makeItem({ id: 'potion_1', name: '治疗药水' }));
      mocks.inventoryStore.removeItem.mockReturnValue(1);
      vi.mocked(computeSellPrice).mockReturnValue(25);
      vi.mocked(shopDbService.getShopItems).mockResolvedValue(null);

      await store.sellItem('potion_1', 1);

      // Assert：日志消息不含 " x" 后缀（actualQuantity === 1）
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.not.stringContaining(' x') })
      );
    });
  });

  // -------------------- Actions：refreshShop / 查询 边界 --------------------
  describe('Actions：refreshShop / 查询 边界', () => {
    it('refreshShop 时 currentShopId 不在 shops → regenerateItems 返回空数组', async () => {
      const store = useShopStore();
      // currentShopId 设置为 shops 中不存在的 id
      store.$patch({
        currentShopId: 'unknown_shop',
        shops: [makeShopConfig({ id: 'general_goods' })],
      });

      await store.refreshShop();

      // Assert：regenerateItems 因 config 未找到返回 []，未调用 generateShopItems
      expect(generateShopItems).not.toHaveBeenCalled();
      expect(store.currentItems).toEqual([]);
    });

    it('getSoldItemCount：currentShopId 设置但无 soldMap → 返回 0', () => {
      const store = useShopStore();
      store.$patch({ currentShopId: 'general_goods' });
      // soldItems 为空 Map（未出售任何物品）

      expect(store.getSoldItemCount('any')).toBe(0);
    });
  });
});
