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
});
