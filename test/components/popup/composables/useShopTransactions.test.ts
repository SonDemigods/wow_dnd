/**
 * @fileoverview 商店交易 Composable 单元测试
 * @description 测试 useShopTransactions（买卖流程、数量选择、金币校验）与
 *              useGoldFlash（金币闪烁动画、定时器清理）。
 *
 * P3-163：从 ShopPopup 抽离的 Composable 独立可测试，不依赖组件实例。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import { useShopTransactions, type SellItemEntry } from '@/components/popup/composables/useShopTransactions';
import { useGoldFlash } from '@/components/popup/composables/useGoldFlash';
import { useShopStore } from '@/modules/shop';
import { useCharacterStore } from '@/modules/character';
import { useInventoryStore } from '@/modules/inventory';
import { eventBus, GameEvents } from '@/modules/bus';
import { createStubPinia } from '../../../utils/setup';
import type { Item, ItemRarity, ItemType } from '@/modules/inventory/types';
import type { ShopDisplayItem } from '@/modules/shop';

/** 创建测试用物品模板 */
function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item_001',
    name: '测试物品',
    type: 'potion',
    rarity: 'common',
    icon: 'game-icons:potion',
    description: '测试用物品',
    value: 100,
    stackable: true,
    capabilities: ['describable', 'usable', 'stackable', 'sellable'],
    ...overrides,
  };
}

/** 创建测试用购买展示条目 */
function makeBuyEntry(overrides: Partial<ShopDisplayItem> = {}): ShopDisplayItem {
  return {
    id: 'item_001',
    itemId: 'item_001',
    name: '测试物品',
    type: 'potion',
    quality: 'common',
    icon: 'game-icons:potion',
    description: '测试用物品',
    price: 100,
    quantity: 5,
    ...overrides,
  };
}

/** 创建测试用出售条目 */
function makeSellEntry(overrides: Partial<SellItemEntry> = {}): SellItemEntry {
  return {
    item: { itemId: 'item_001', count: 3 },
    info: makeItem(),
    ...overrides,
  };
}

/**
 * 创建交易 Composable 测试夹具
 *
 * 使用 createStubPinia 隔离 Store 副作用，action 自动 stub，
 * 再通过 vi.mocked 精确控制 getItemInfo / calculateSellPrice / buyItem / sellItem 返回值。
 */
function createTransactionFixture(gold: number = 1000) {
  const pinia = createStubPinia();
  const shopStore = useShopStore();
  const characterStore = useCharacterStore();
  const inventoryStore = useInventoryStore();

  // 预设角色金币（gold computed 读取 character.gold）
  characterStore.$patch((state) => {
    state.character = { gold } as any;
  });

  const onSuccess = vi.fn();
  const tx = useShopTransactions({
    shopStore,
    characterStore,
    inventoryStore,
    onTransactionSuccess: onSuccess,
  });

  return { pinia, shopStore, characterStore, inventoryStore, tx, onSuccess };
}

describe('useShopTransactions', () => {
  beforeEach(() => {
    eventBus.clearAll();
  });

  // ==================== getSellPrice ====================

  describe('getSellPrice', () => {
    it('物品模板存在时返回 calculateSellPrice 结果', () => {
      const { inventoryStore, shopStore, tx } = createTransactionFixture();
      vi.mocked(inventoryStore.getItemInfo).mockReturnValue(makeItem());
      vi.mocked(shopStore.calculateSellPrice).mockReturnValue(50);
      expect(tx.getSellPrice('item_001')).toBe(50);
      expect(shopStore.calculateSellPrice).toHaveBeenCalledWith('item_001');
    });

    it('物品模板不存在时返回 0', () => {
      const { inventoryStore, tx } = createTransactionFixture();
      vi.mocked(inventoryStore.getItemInfo).mockReturnValue(null);
      expect(tx.getSellPrice('unknown')).toBe(0);
    });
  });

  // ==================== buyMaxQuantity ====================

  describe('buyMaxQuantity', () => {
    it('受金币和库存双重限制（取较小值）', () => {
      const { tx } = createTransactionFixture(300);
      // 单价 100，金币 300 → byGold=3；库存 5 → byStock=5，取 min=3
      tx.selectBuyItem(makeBuyEntry({ price: 100, quantity: 5 }), 0);
      expect(tx.buyMaxQuantity.value).toBe(3);
    });

    it('库存不足时受库存限制', () => {
      const { tx } = createTransactionFixture(10000);
      tx.selectBuyItem(makeBuyEntry({ price: 100, quantity: 2 }), 0);
      expect(tx.buyMaxQuantity.value).toBe(2);
    });

    it('未选中商品时返回 1', () => {
      const { tx } = createTransactionFixture();
      expect(tx.buyMaxQuantity.value).toBe(1);
    });

    it('价格为 0 时返回 1（避免除零）', () => {
      const { tx } = createTransactionFixture(100);
      tx.selectBuyItem(makeBuyEntry({ price: 0, quantity: 5 }), 0);
      expect(tx.buyMaxQuantity.value).toBe(1);
    });
  });

  // ==================== canAffordBuy ====================

  describe('canAffordBuy', () => {
    it('金币充足时返回 true', () => {
      const { tx } = createTransactionFixture(500);
      tx.selectBuyItem(makeBuyEntry({ price: 100, quantity: 5 }), 0);
      tx.buyQuantity.value = 3;
      expect(tx.canAffordBuy()).toBe(true);
    });

    it('金币不足时返回 false', () => {
      const { tx } = createTransactionFixture(200);
      tx.selectBuyItem(makeBuyEntry({ price: 100, quantity: 5 }), 0);
      tx.buyQuantity.value = 3; // 总价 300 > 200
      expect(tx.canAffordBuy()).toBe(false);
    });

    it('未选中商品时返回 false', () => {
      const { tx } = createTransactionFixture();
      expect(tx.canAffordBuy()).toBe(false);
    });
  });

  // ==================== 总价计算 ====================

  describe('totalBuyPrice / totalSellPrice', () => {
    it('totalBuyPrice = 单价 × 购买数量', () => {
      const { tx } = createTransactionFixture();
      tx.selectBuyItem(makeBuyEntry({ price: 100 }), 0);
      tx.buyQuantity.value = 3;
      expect(tx.totalBuyPrice.value).toBe(300);
    });

    it('totalSellPrice = 出售单价 × 出售数量', () => {
      const { inventoryStore, shopStore, tx } = createTransactionFixture();
      vi.mocked(inventoryStore.getItemInfo).mockReturnValue(makeItem());
      vi.mocked(shopStore.calculateSellPrice).mockReturnValue(40);
      tx.selectSellItem(makeSellEntry(), 0);
      tx.sellQuantity.value = 2;
      expect(tx.totalSellPrice.value).toBe(80);
    });
  });

  // ==================== 选择物品 ====================

  describe('selectBuyItem / selectSellItem', () => {
    it('selectBuyItem 设置购买选中并清除出售选中', () => {
      const { tx } = createTransactionFixture();
      tx.selectSellItem(makeSellEntry(), 0);
      tx.selectBuyItem(makeBuyEntry(), 0);
      expect(tx.selectedBuyEntry.value).not.toBeNull();
      expect(tx.buySelectedIndex.value).toBe(0);
      expect(tx.buyQuantity.value).toBe(1);
      expect(tx.selectedSellEntry.value).toBeNull();
      expect(tx.sellSelectedIndex.value).toBe(-1);
    });

    it('selectSellItem 设置出售选中并清除购买选中', () => {
      const { tx } = createTransactionFixture();
      tx.selectBuyItem(makeBuyEntry(), 0);
      tx.selectSellItem(makeSellEntry(), 0);
      expect(tx.selectedSellEntry.value).not.toBeNull();
      expect(tx.sellSelectedIndex.value).toBe(0);
      expect(tx.sellQuantity.value).toBe(1);
      expect(tx.selectedBuyEntry.value).toBeNull();
      expect(tx.buySelectedIndex.value).toBe(-1);
    });
  });

  // ==================== 数量加减与钳制 ====================

  describe('数量加减与钳制', () => {
    it('incBuyQty / decBuyQty 增减购买数量', () => {
      const { tx } = createTransactionFixture(1000);
      tx.selectBuyItem(makeBuyEntry({ price: 100, quantity: 5 }), 0); // max=5
      tx.incBuyQty();
      expect(tx.buyQuantity.value).toBe(2);
      tx.decBuyQty();
      expect(tx.buyQuantity.value).toBe(1);
    });

    it('incSellQty / decSellQty 增减出售数量', () => {
      const { tx } = createTransactionFixture();
      tx.selectSellItem(makeSellEntry({ item: { itemId: 'i1', count: 5 } }), 0);
      tx.incSellQty();
      expect(tx.sellQuantity.value).toBe(2);
      tx.decSellQty();
      expect(tx.sellQuantity.value).toBe(1);
    });

    it('clampBuyQuantity 钳制到 [1, buyMaxQuantity]', () => {
      const { tx } = createTransactionFixture(300);
      tx.selectBuyItem(makeBuyEntry({ price: 100, quantity: 5 }), 0); // max=3
      tx.buyQuantity.value = 99;
      tx.clampBuyQuantity();
      expect(tx.buyQuantity.value).toBe(3);
      tx.buyQuantity.value = 0;
      tx.clampBuyQuantity();
      expect(tx.buyQuantity.value).toBe(1);
    });

    it('clampSellQuantity 钳制到 [1, 持有数量]', () => {
      const { tx } = createTransactionFixture();
      tx.selectSellItem(makeSellEntry({ item: { itemId: 'i1', count: 3 } }), 0);
      tx.sellQuantity.value = 99;
      tx.clampSellQuantity();
      expect(tx.sellQuantity.value).toBe(3);
      tx.sellQuantity.value = 0;
      tx.clampSellQuantity();
      expect(tx.sellQuantity.value).toBe(1);
    });

    it('数量加减触发 UI_CLICK 事件', () => {
      const { tx } = createTransactionFixture(1000);
      tx.selectBuyItem(makeBuyEntry({ price: 100, quantity: 5 }), 0);
      const spy = vi.fn();
      eventBus.on(GameEvents.UI_CLICK, spy);
      tx.incBuyQty();
      expect(spy).toHaveBeenCalledWith({ source: 'shop_qty_inc' });
      tx.decBuyQty();
      expect(spy).toHaveBeenCalledWith({ source: 'shop_qty_dec' });
    });
  });

  // ==================== 购买流程 ====================

  describe('handleBuy', () => {
    it('购买成功后重置选中并触发 onSuccess 回调', async () => {
      const { shopStore, tx, onSuccess } = createTransactionFixture(1000);
      vi.mocked(shopStore.buyItem).mockResolvedValue(true);
      tx.selectBuyItem(makeBuyEntry({ itemId: 'w1', price: 100 }), 0);
      tx.buyQuantity.value = 2;

      await tx.handleBuy('w1');

      expect(shopStore.buyItem).toHaveBeenCalledWith('w1', 2);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(tx.selectedBuyEntry.value).toBeNull();
      expect(tx.buySelectedIndex.value).toBe(-1);
      expect(tx.buyQuantity.value).toBe(1);
    });

    it('购买失败时不重置选中、不触发 onSuccess', async () => {
      const { shopStore, tx, onSuccess } = createTransactionFixture(1000);
      vi.mocked(shopStore.buyItem).mockResolvedValue(false);
      tx.selectBuyItem(makeBuyEntry({ itemId: 'w1', price: 100 }), 0);
      tx.buyQuantity.value = 2;

      await tx.handleBuy('w1');

      expect(onSuccess).not.toHaveBeenCalled();
      expect(tx.selectedBuyEntry.value).not.toBeNull();
      expect(tx.buyQuantity.value).toBe(2);
    });

    it('购买触发 UI_CLICK 事件', async () => {
      const { shopStore, tx } = createTransactionFixture(1000);
      vi.mocked(shopStore.buyItem).mockResolvedValue(true);
      const spy = vi.fn();
      eventBus.on(GameEvents.UI_CLICK, spy);
      await tx.handleBuy('w1');
      expect(spy).toHaveBeenCalledWith({ source: 'shop_buy' });
    });
  });

  // ==================== 出售流程 ====================

  describe('handleSell', () => {
    it('出售成功后重置选中并触发 onSuccess 回调', async () => {
      const { shopStore, tx, onSuccess } = createTransactionFixture();
      vi.mocked(shopStore.sellItem).mockResolvedValue(true);
      tx.selectSellItem(makeSellEntry({ item: { itemId: 'p1', count: 3 } }), 0);
      tx.sellQuantity.value = 2;

      await tx.handleSell('p1');

      expect(shopStore.sellItem).toHaveBeenCalledWith('p1', 2);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(tx.selectedSellEntry.value).toBeNull();
      expect(tx.sellSelectedIndex.value).toBe(-1);
      expect(tx.sellQuantity.value).toBe(1);
    });

    it('出售失败时不重置选中、不触发 onSuccess', async () => {
      const { shopStore, tx, onSuccess } = createTransactionFixture();
      vi.mocked(shopStore.sellItem).mockResolvedValue(false);
      tx.selectSellItem(makeSellEntry(), 0);
      tx.sellQuantity.value = 2;

      await tx.handleSell('p1');

      expect(onSuccess).not.toHaveBeenCalled();
      expect(tx.selectedSellEntry.value).not.toBeNull();
      expect(tx.sellQuantity.value).toBe(2);
    });
  });

  // ==================== resetSelection ====================

  describe('resetSelection', () => {
    it('重置所有选中状态与数量', () => {
      const { tx } = createTransactionFixture(1000);
      tx.selectBuyItem(makeBuyEntry(), 0);
      tx.buyQuantity.value = 3;
      tx.selectSellItem(makeSellEntry(), 0);
      tx.sellQuantity.value = 2;

      tx.resetSelection();

      expect(tx.selectedBuyEntry.value).toBeNull();
      expect(tx.buySelectedIndex.value).toBe(-1);
      expect(tx.buyQuantity.value).toBe(1);
      expect(tx.selectedSellEntry.value).toBeNull();
      expect(tx.sellSelectedIndex.value).toBe(-1);
      expect(tx.sellQuantity.value).toBe(1);
    });
  });
});

// ============================================================================
// useGoldFlash 测试
// ============================================================================

/** 测试用包装组件：在组件实例内调用 useGoldFlash 以激活 onUnmounted 生命周期 */
const GoldFlashWrapper = defineComponent({
  name: 'GoldFlashWrapper',
  setup() {
    const { goldFlash, trigger } = useGoldFlash();
    return { goldFlash, trigger };
  },
  render() {
    return h('div');
  },
});

describe('useGoldFlash', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('trigger 后 goldFlash 变为 true', () => {
    const wrapper = mount(GoldFlashWrapper);
    wrapper.vm.trigger();
    expect(wrapper.vm.goldFlash).toBe(true);
    wrapper.unmount();
  });

  it('500ms 后 goldFlash 自动复位为 false', () => {
    const wrapper = mount(GoldFlashWrapper);
    wrapper.vm.trigger();
    expect(wrapper.vm.goldFlash).toBe(true);
    vi.advanceTimersByTime(500);
    expect(wrapper.vm.goldFlash).toBe(false);
    wrapper.unmount();
  });

  it('连续 trigger 清理上一次未触发的定时器（不堆叠）', () => {
    const wrapper = mount(GoldFlashWrapper);
    wrapper.vm.trigger();
    expect(vi.getTimerCount()).toBe(1);
    wrapper.vm.trigger();
    // 第二次 trigger 清理上一次定时器后重新设置，仍只有 1 个定时器
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(500);
    expect(wrapper.vm.goldFlash).toBe(false);
    wrapper.unmount();
  });

  it('组件卸载时清理定时器，避免卸载后访问响应式状态', () => {
    const wrapper = mount(GoldFlashWrapper);
    wrapper.vm.trigger();
    expect(vi.getTimerCount()).toBe(1);
    wrapper.unmount();
    // onUnmounted 回调清理定时器，定时器数量归零
    expect(vi.getTimerCount()).toBe(0);
    // 推进时间不会触发回调（已清理），无异常抛出
    expect(() => vi.advanceTimersByTime(500)).not.toThrow();
  });
});
