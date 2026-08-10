/**
 * @fileoverview 商店交易逻辑 Composable
 * @description 从 ShopPopup 抽离的买卖交易流程、数量选择、金币校验逻辑。
 *
 * 职责：
 * - 持有购买/出售选中状态与数量选择状态
 * - 计算购买/出售总价、最大可购数量、金币是否充足
 * - 执行购买/出售交易（调用 store），成功后重置选中并触发金币闪烁回调
 * - 数量加减与边界钳制
 *
 * 不持有：
 * - 商店配置/商品列表富化（UI 派生数据，留在组件内）
 * - 分类筛选（UI 交互，留在组件内）
 * - 数据加载与生命周期（留在组件内）
 *
 * P3-163 修复：从 ShopPopup.vue 抽离为独立 Composable，便于独立测试与复用。
 * 参照 combat 模块 composable 拆分模式，store 引用通过参数传入（延迟绑定）。
 */
import { ref, computed } from 'vue';
import type { useShopStore } from '@/modules/shop';
import type { useCharacterStore } from '@/modules/character';
import type { useInventoryStore } from '@/modules/inventory';
import type { ShopDisplayItem } from '@/modules/shop';
import type { InventoryItem, Item } from '@/modules/inventory';
import { eventBus, GameEvents } from '@/modules/bus';

/** 出售标签的物品条目（关联背包数据和物品模板） */
export interface SellItemEntry {
  item: InventoryItem;
  info: Item | null;
}

/** useShopTransactions 入参 */
export interface UseShopTransactionsOptions {
  shopStore: ReturnType<typeof useShopStore>;
  characterStore: ReturnType<typeof useCharacterStore>;
  inventoryStore: ReturnType<typeof useInventoryStore>;
  /** 交易成功时触发的回调（用于金币闪烁动画） */
  onTransactionSuccess?: () => void;
}

/**
 * 商店交易逻辑（购买/出售流程、数量选择、金币校验）
 *
 * @param options - store 引用与成功回调
 * @returns 交易状态、计算属性与操作方法
 */
export function useShopTransactions(options: UseShopTransactionsOptions) {
  const { shopStore, characterStore, inventoryStore, onTransactionSuccess } = options;

  // ==================== 状态 ====================

  /** 购买标签选中条目 */
  const selectedBuyEntry = ref<ShopDisplayItem | null>(null);
  /** 购买标签选中索引（UI 高亮） */
  const buySelectedIndex = ref<number>(-1);

  /** 出售标签选中条目 */
  const selectedSellEntry = ref<SellItemEntry | null>(null);
  /** 出售标签选中索引（UI 高亮） */
  const sellSelectedIndex = ref<number>(-1);

  /** 购买数量 */
  const buyQuantity = ref(1);
  /** 出售数量 */
  const sellQuantity = ref(1);

  // ==================== 计算属性 ====================

  /** 角色当前金币（供模板与校验共用） */
  const gold = computed(() => characterStore.gold);

  /** 购买最大数量（受金币和库存限制） */
  const buyMaxQuantity = computed(() => {
    if (!selectedBuyEntry.value || selectedBuyEntry.value.price <= 0) return 1;
    const byGold = Math.floor(gold.value / selectedBuyEntry.value.price);
    const byStock = selectedBuyEntry.value.quantity;
    return Math.max(1, Math.min(byGold, byStock));
  });

  /** 购买总价 */
  const totalBuyPrice = computed(() => {
    if (!selectedBuyEntry.value) return 0;
    return selectedBuyEntry.value.price * buyQuantity.value;
  });

  /** 出售总价 */
  const totalSellPrice = computed(() => {
    if (!selectedSellEntry.value) return 0;
    return getSellPrice(selectedSellEntry.value.item.itemId) * sellQuantity.value;
  });

  // ==================== 工具函数 ====================

  /** 查询物品在当前商店的出售单价（供模板与总价计算共用） */
  function getSellPrice(itemId: string): number {
    const itemInfo = inventoryStore.getItemInfo(itemId);
    if (!itemInfo) return 0;
    return shopStore.calculateSellPrice(itemId);
  }

  /** 金币是否足够购买当前选中商品 × 当前数量 */
  function canAffordBuy(): boolean {
    if (!selectedBuyEntry.value) return false;
    return gold.value >= selectedBuyEntry.value.price * buyQuantity.value;
  }

  /** 钳制购买数量到 [1, buyMaxQuantity] */
  function clampBuyQuantity(): void {
    buyQuantity.value = Math.max(1, Math.min(buyQuantity.value || 1, buyMaxQuantity.value));
  }

  /** 钳制出售数量到 [1, 选中物品持有数] */
  function clampSellQuantity(): void {
    if (!selectedSellEntry.value) return;
    sellQuantity.value = Math.max(
      1,
      Math.min(sellQuantity.value || 1, selectedSellEntry.value.item.count)
    );
  }

  // ==================== 选择物品 ====================

  /** 选中购买商品，切换时清除出售选中 */
  function selectBuyItem(entry: ShopDisplayItem, index: number): void {
    selectedBuyEntry.value = entry;
    buySelectedIndex.value = index;
    buyQuantity.value = 1;
    selectedSellEntry.value = null;
    sellSelectedIndex.value = -1;
  }

  /** 选中出售物品，切换时清除购买选中 */
  function selectSellItem(entry: SellItemEntry, index: number): void {
    selectedSellEntry.value = entry;
    sellSelectedIndex.value = index;
    sellQuantity.value = 1;
    selectedBuyEntry.value = null;
    buySelectedIndex.value = -1;
  }

  // ==================== 数量加减 ====================

  function decBuyQty(): void {
    eventBus.emit(GameEvents.UI_CLICK, { source: 'shop_qty_dec' });
    buyQuantity.value--;
  }

  function incBuyQty(): void {
    eventBus.emit(GameEvents.UI_CLICK, { source: 'shop_qty_inc' });
    buyQuantity.value++;
  }

  function decSellQty(): void {
    eventBus.emit(GameEvents.UI_CLICK, { source: 'shop_qty_dec' });
    sellQuantity.value--;
  }

  function incSellQty(): void {
    eventBus.emit(GameEvents.UI_CLICK, { source: 'shop_qty_inc' });
    sellQuantity.value++;
  }

  // ==================== 买卖操作 ====================

  /** 购买当前选中商品，成功后重置选中并触发金币闪烁 */
  async function handleBuy(itemId: string): Promise<void> {
    eventBus.emit(GameEvents.UI_CLICK, { source: 'shop_buy' });
    // P7-005 修复：try/catch 防止 Dexie 操作异常导致 unhandled rejection
    try {
      const result = await shopStore.buyItem(itemId, buyQuantity.value);
      if (result) {
        onTransactionSuccess?.();
        selectedBuyEntry.value = null;
        buySelectedIndex.value = -1;
        buyQuantity.value = 1;
      }
    } catch (e) {
      console.error('[useShopTransactions] 购买失败:', e);
    }
  }

  /** 出售当前选中物品，成功后重置选中并触发金币闪烁 */
  async function handleSell(itemId: string): Promise<void> {
    eventBus.emit(GameEvents.UI_CLICK, { source: 'shop_sell' });
    // P7-005 修复：try/catch 防止 Dexie 操作异常导致 unhandled rejection
    try {
      const result = await shopStore.sellItem(itemId, sellQuantity.value);
      if (result) {
        onTransactionSuccess?.();
        selectedSellEntry.value = null;
        sellSelectedIndex.value = -1;
        sellQuantity.value = 1;
      }
    } catch (e) {
      console.error('[useShopTransactions] 出售失败:', e);
    }
  }

  // ==================== 重置 ====================

  /** 重置所有选中与数量（切换商店/标签时调用） */
  function resetSelection(): void {
    selectedBuyEntry.value = null;
    buySelectedIndex.value = -1;
    buyQuantity.value = 1;
    selectedSellEntry.value = null;
    sellSelectedIndex.value = -1;
    sellQuantity.value = 1;
  }

  return {
    // 状态
    selectedBuyEntry,
    buySelectedIndex,
    selectedSellEntry,
    sellSelectedIndex,
    buyQuantity,
    sellQuantity,
    gold,
    // 计算属性
    buyMaxQuantity,
    totalBuyPrice,
    totalSellPrice,
    // 工具函数
    getSellPrice,
    canAffordBuy,
    clampBuyQuantity,
    clampSellQuantity,
    // 选择
    selectBuyItem,
    selectSellItem,
    // 数量加减
    decBuyQty,
    incBuyQty,
    decSellQty,
    incSellQty,
    // 买卖操作
    handleBuy,
    handleSell,
    // 重置
    resetSelection,
  };
}
