/**
 * @fileoverview 商店模块实现
 * @description 提供完整的商店系统，包括商品刷新、购买、出售功能
 * @module modules/shop/index
 */

import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { eventBus, GameEvents } from '@/services/eventBus';
import { characterService } from '../character';
import { inventoryService } from '../inventory';
import { LOOT_ITEMS } from '@/data/items';
import { SHOPS, ITEM_POOLS, SHOP_TYPE_ITEM_POOL, ITEM_BASE_PRICES, RARITY_PRICE_MULTIPLIER, RARITY_SELL_DISCOUNT } from '@/data/shops';
import type {
  ShopItem,
  ShopState,
  ShopConfig,
  ShopItemRarity,
  ShopTransaction,
  ShopItemPurchasedEvent,
  ShopItemSoldEvent,
  ShopRefreshedEvent,
  IShopService
} from './types';
import type { LootItemData, Item } from '@/types';

/**
 * 本地存储键名
 */
const SHOP_STORAGE_KEY = 'wow_shop';

/**
 * 获取商品稀有度
 */
function getRarityByTemplate(template: string): ShopItemRarity {
  const item = LOOT_ITEMS.find(i => i.template === template);
  if (!item) return 'common';
  
  const rarityMap: Record<string, ShopItemRarity> = {
    common: 'common',
    uncommon: 'uncommon',
    rare: 'rare',
    epic: 'epic',
    legendary: 'legendary'
  };
  
  return rarityMap[item.rarity] || 'common';
}

/**
 * 根据模板获取商品数据
 */
function getItemByTemplate(template: string): LootItemData | null {
  return LOOT_ITEMS.find(i => i.template === template) || null;
}

/**
 * 随机选择商品
 */
function selectRandomItems(
  itemPool: string[],
  count: number
): string[] {
  const pool = [...itemPool];
  const selected: string[] = [];
  
  for (let i = 0; i < count && pool.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    selected.push(pool[randomIndex]);
    pool.splice(randomIndex, 1);
  }
  
  return selected;
}

/**
 * 计算随机价格
 */
function calculateRandomPrice(
  basePrice: number,
  rarity: ShopItemRarity,
  priceVariation: { min: number; max: number }
): number {
  const rarityMultiplier = RARITY_PRICE_MULTIPLIER[rarity];
  const variation = priceVariation.min + Math.random() * (priceVariation.max - priceVariation.min);
  return Math.ceil(basePrice * rarityMultiplier * variation);
}

/**
 * 计算随机库存
 */
function calculateRandomStock(
  stockVariation: { min: number; max: number }
): number {
  return stockVariation.min + Math.floor(Math.random() * (stockVariation.max - stockVariation.min + 1));
}

/**
 * 创建商品实例
 */
function createShopItem(template: string, config: ShopConfig): ShopItem {
  const itemData = getItemByTemplate(template);
  const rarity = getRarityByTemplate(template);
  const basePrice = ITEM_BASE_PRICES[template] || 10;
  const currentPrice = calculateRandomPrice(basePrice, rarity, config.priceVariation);
  const stock = calculateRandomStock(config.stockVariation);
  
  const rarityMultiplier = RARITY_SELL_DISCOUNT[rarity];
  const sellPrice = Math.ceil(basePrice * rarityMultiplier);
  
  return {
    id: `shop_${template}_${Date.now()}`,
    itemTemplate: template,
    name: itemData?.name || template,
    icon: itemData?.icon || '📦',
    type: itemData?.type || 'material',
    rarity,
    description: itemData?.description || '',
    basePrice,
    currentPrice,
    stock,
    maxStock: stock,
    status: stock > 0 ? 'available' : 'out_of_stock',
    canSell: true,
    sellPrice
  };
}

/**
 * 商店状态管理Store
 */
export const useShopStore = defineStore('shop', () => {
  /** 当前打开的商店ID */
  const currentShopId = ref<string | null>(null);
  /** 商店是否打开 */
  const isShopOpen = ref<boolean>(false);
  /** 所有商店的商品数据 */
  const shopItems = ref<Record<string, ShopItem[]>>({});
  /** 所有商店的刷新时间 */
  const lastRefresh = ref<Record<string, number>>({});
  /** 购买历史记录 */
  const purchaseHistory = ref<ShopTransaction[]>([]);
  /** 计时器ID */
  let refreshTimers: Record<string, ReturnType<typeof setInterval>> = {};

  /**
   * 从本地存储加载数据
   */
  function loadFromStorage(): void {
    try {
      const data = localStorage.getItem(SHOP_STORAGE_KEY);
      if (data) {
        const saved = JSON.parse(data);
        shopItems.value = saved.shopItems || {};
        lastRefresh.value = saved.lastRefresh || {};
        purchaseHistory.value = saved.purchaseHistory || [];
      }
    } catch (e) {
      console.error('Failed to load shop data:', e);
    }
  }

  /**
   * 保存数据到本地存储
   */
  function saveToStorage(): void {
    try {
      const data = {
        shopItems: shopItems.value,
        lastRefresh: lastRefresh.value,
        purchaseHistory: purchaseHistory.value.slice(-50)
      };
      localStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save shop data:', e);
    }
  }

  /**
   * 清除本地存储
   */
  function clearStorage(): void {
    localStorage.removeItem(SHOP_STORAGE_KEY);
  }

  /**
   * 获取商店配置
   */
  function getShopConfig(shopId: string): ShopConfig | null {
    return SHOPS[shopId] || null;
  }

  /**
   * 刷新商店商品
   */
  function refreshShop(shopId: string): boolean {
    const config = getShopConfig(shopId);
    if (!config) {
      console.error(`Shop config not found: ${shopId}`);
      return false;
    }

    const poolKey = SHOP_TYPE_ITEM_POOL[config.type] || 'general';
    const itemPool = ITEM_POOLS[poolKey] || ITEM_POOLS['general'];
    const itemCount = config.minItems + Math.floor(Math.random() * (config.maxItems - config.minItems + 1));
    const selectedTemplates = selectRandomItems(itemPool, itemCount);
    
    const items: ShopItem[] = selectedTemplates.map(template => createShopItem(template, config));
    shopItems.value[shopId] = items;
    lastRefresh.value[shopId] = Date.now();
    
    saveToStorage();
    
    const event: ShopRefreshedEvent = {
      shopId,
      items: [...items],
      refreshTime: lastRefresh.value[shopId]
    };
    eventBus.emit('shop:refreshed', event);
    
    return true;
  }

  /**
   * 检查商店是否需要刷新
   */
  function checkAndRefresh(shopId: string): void {
    const config = getShopConfig(shopId);
    if (!config) return;

    const lastRefreshTime = lastRefresh.value[shopId] || 0;
    const now = Date.now();
    
    if (now - lastRefreshTime >= config.refreshInterval) {
      refreshShop(shopId);
    }
  }

  /**
   * 打开商店
   */
  function openShop(shopId: string, npcId: string): boolean {
    const config = getShopConfig(shopId);
    if (!config || config.npcId !== npcId) {
      return false;
    }

    checkAndRefresh(shopId);
    
    if (!shopItems.value[shopId] || shopItems.value[shopId].length === 0) {
      refreshShop(shopId);
    }
    
    currentShopId.value = shopId;
    isShopOpen.value = true;
    
    startRefreshTimer(shopId);
    
    return true;
  }

  /**
   * 关闭商店
   */
  function closeShop(): void {
    isShopOpen.value = false;
    currentShopId.value = null;
  }

  /**
   * 开始自动刷新计时器
   */
  function startRefreshTimer(shopId: string): void {
    const config = getShopConfig(shopId);
    if (!config) return;
    
    if (refreshTimers[shopId]) {
      clearInterval(refreshTimers[shopId]);
    }
    
    refreshTimers[shopId] = setInterval(() => {
      checkAndRefresh(shopId);
    }, 60000); // 每分钟检查一次
  }

  /**
   * 检查是否能负担
   */
  function canAfford(price: number, quantity: number): boolean {
    const total = price * quantity;
    return characterService.getGold() >= total;
  }

  /**
   * 检查是否可以出售
   */
  function canSell(itemId: string): boolean {
    const item = inventoryService.getItem(parseInt(itemId));
    return item !== null && item.template !== 'gold';
  }

  /**
   * 购买商品
   */
  function purchaseItem(itemId: string, quantity: number): boolean {
    if (!currentShopId.value || !isShopOpen.value) {
      eventBus.emit(GameEvents.NOTIFICATION, {
        type: 'warning',
        message: '商店未打开'
      });
      return false;
    }

    const shopItemsList = shopItems.value[currentShopId.value];
    const shopItem = shopItemsList?.find(i => i.id === itemId);
    
    if (!shopItem) {
      eventBus.emit(GameEvents.NOTIFICATION, {
        type: 'warning',
        message: '商品不存在'
      });
      return false;
    }

    if (shopItem.stock < quantity) {
      eventBus.emit(GameEvents.NOTIFICATION, {
        type: 'warning',
        message: '库存不足'
      });
      return false;
    }

    const totalPrice = shopItem.currentPrice * quantity;
    if (!canAfford(shopItem.currentPrice, quantity)) {
      eventBus.emit(GameEvents.NOTIFICATION, {
        type: 'warning',
        message: '金币不足'
      });
      return false;
    }

    const itemData = getItemByTemplate(shopItem.itemTemplate);
    if (!itemData) {
      return false;
    }

    let success = true;
    for (let i = 0; i < quantity; i++) {
      const item: Item = {
        id: `item_${shopItem.itemTemplate}_${Date.now()}_${i}`,
        name: itemData.name,
        icon: itemData.icon,
        type: itemData.type,
        rarity: itemData.rarity as any,
        description: itemData.description,
        value: shopItem.currentPrice,
        stackable: true,
        count: 1,
        template: shopItem.itemTemplate,
        stats: itemData.statBonus,
        healing: itemData.healing,
        manaRestore: itemData.manaRestore,
        effect: itemData.effect,
        damage: itemData.damage
      };
      
      const added = inventoryService.addItem(item);
      if (!added) {
        success = false;
        eventBus.emit(GameEvents.NOTIFICATION, {
          type: 'warning',
          message: '背包已满'
        });
        break;
      }
    }

    if (!success) {
      return false;
    }

    characterService.spendGold(totalPrice);
    shopItem.stock -= quantity;
    
    if (shopItem.stock <= 0) {
      shopItem.status = 'out_of_stock';
    }

    const transaction: ShopTransaction = {
      id: `txn_${Date.now()}`,
      type: 'buy',
      itemId,
      itemName: shopItem.name,
      quantity,
      price: shopItem.currentPrice,
      total: totalPrice,
      timestamp: Date.now(),
      shopId: currentShopId.value
    };
    purchaseHistory.value.push(transaction);
    
    saveToStorage();
    
    const purchaseEvent: ShopItemPurchasedEvent = {
      item: shopItem,
      quantity,
      totalPrice,
      shopId: currentShopId.value
    };
    eventBus.emit('shop:purchased', purchaseEvent);
    
    eventBus.emit(GameEvents.NOTIFICATION, {
      type: 'success',
      message: `成功购买 ${quantity} 个 ${shopItem.name}，花费 ${totalPrice} 金币`
    });

    return true;
  }

  /**
   * 出售商品
   */
  function sellItem(itemId: string, slot: number, quantity: number): boolean {
    if (!currentShopId.value || !isShopOpen.value) {
      eventBus.emit(GameEvents.NOTIFICATION, {
        type: 'warning',
        message: '商店未打开'
      });
      return false;
    }

    const item = inventoryService.getItem(slot);
    if (!item) {
      eventBus.emit(GameEvents.NOTIFICATION, {
        type: 'warning',
        message: '物品不存在'
      });
      return false;
    }

    if (!canSell(item.id)) {
      eventBus.emit(GameEvents.NOTIFICATION, {
        type: 'warning',
        message: '该物品无法出售'
      });
      return false;
    }

    const rarity = getRarityByTemplate(item.template);
    const basePrice = ITEM_BASE_PRICES[item.template] || item.value || 10;
    const rarityMultiplier = RARITY_SELL_DISCOUNT[rarity];
    const sellPrice = Math.ceil(basePrice * rarityMultiplier);
    const totalPrice = sellPrice * quantity;

    for (let i = 0; i < quantity; i++) {
      const removed = inventoryService.removeItem(slot);
      if (!removed) {
        break;
      }
    }

    characterService.addGold(totalPrice);

    const transaction: ShopTransaction = {
      id: `txn_${Date.now()}`,
      type: 'sell',
      itemId: item.id,
      itemName: item.name,
      quantity,
      price: sellPrice,
      total: totalPrice,
      timestamp: Date.now(),
      shopId: currentShopId.value
    };
    purchaseHistory.value.push(transaction);
    
    saveToStorage();
    
    const sellEvent: ShopItemSoldEvent = {
      item,
      quantity,
      totalPrice,
      shopId: currentShopId.value
    };
    eventBus.emit('shop:sold', sellEvent);
    
    eventBus.emit(GameEvents.NOTIFICATION, {
      type: 'success',
      message: `成功出售 ${quantity} 个 ${item.name}，获得 ${totalPrice} 金币`
    });

    return true;
  }

  /**
   * 获取商店商品
   */
  function getShopItems(shopId: string): ShopItem[] {
    checkAndRefresh(shopId);
    return shopItems.value[shopId] || [];
  }

  /**
   * 获取当前位置可用的商店
   */
  function getAvailableShops(locationId: string): ShopConfig[] {
    return Object.values(SHOPS).filter(shop => shop.locationId === locationId);
  }

  /**
   * 获取购买历史
   */
  function getPurchaseHistory(shopId: string): ShopTransaction[] {
    return purchaseHistory.value.filter(txn => txn.shopId === shopId);
  }

  /**
   * 重置商店
   */
  function reset(): void {
    Object.values(refreshTimers).forEach(timer => clearInterval(timer));
    refreshTimers = {};
    shopItems.value = {};
    lastRefresh.value = {};
    purchaseHistory.value = [];
    currentShopId.value = null;
    isShopOpen.value = false;
    clearStorage();
  }

  // 初始化时加载数据
  loadFromStorage();

  return {
    currentShopId,
    isShopOpen,
    shopItems,
    lastRefresh,
    purchaseHistory,
    openShop,
    closeShop,
    refreshShop,
    purchaseItem,
    sellItem,
    getShopItems,
    getAvailableShops,
    getPurchaseHistory,
    canAfford,
    canSell,
    getShopConfig,
    reset
  };
});

/**
 * 商店服务实现
 */
export const shopService: IShopService = {
  openShop: (shopId: string, npcId: string) => useShopStore().openShop(shopId, npcId),
  closeShop: () => useShopStore().closeShop(),
  refreshShop: (shopId: string) => useShopStore().refreshShop(shopId),
  purchaseItem: (request) => useShopStore().purchaseItem(request.itemId, request.quantity),
  sellItem: (request) => useShopStore().sellItem(request.itemId, request.slot, request.quantity),
  getShopItems: (shopId: string) => useShopStore().getShopItems(shopId),
  getAvailableShops: (locationId: string) => useShopStore().getAvailableShops(locationId),
  getPurchaseHistory: (shopId: string) => useShopStore().getPurchaseHistory(shopId),
  isShopOpen: () => useShopStore().isShopOpen,
  getCurrentShopId: () => useShopStore().currentShopId,
  getShopConfig: (shopId: string) => useShopStore().getShopConfig(shopId),
  canAfford: (price: number, quantity: number) => useShopStore().canAfford(price, quantity),
  canSell: (itemId: string) => useShopStore().canSell(itemId),
  reset: () => useShopStore().reset()
};
