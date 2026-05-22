import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { eventBus, GameEvents } from '@/services/eventBus';
import { characterService } from '@/modules/character.module';
import { inventoryService } from '@/modules/inventory.module';
import { LOOT_ITEMS, EQUIPMENT_ITEMS, ITEM_BASE_PRICES, RARITY_PRICE_MULTIPLIER, RARITY_SELL_DISCOUNT } from '@/data';
import type { Item, EquipmentItem } from '@/types';

export type ItemCategory = 'weapon' | 'armor' | 'consumable' | 'accessory' | 'material' | 'misc';

export interface ShopItem {
  id: string;
  itemId: string;
  name: string;
  icon: string;
  category: ItemCategory;
  price: number;
  quantity: number;
  quality: ItemQuality;
  description: string;
  effect?: ItemEffect;
}

export type ItemQuality = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface ItemEffect {
  type: 'heal' | 'damage' | 'buff' | 'debuff' | 'stat';
  value: number;
  duration?: number;
  statType?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
  totalPrice: number;
  timestamp: number;
}

export type TransactionType = 'buy' | 'sell';

export interface ShopState {
  items: ShopItem[];
  transactions: Transaction[];
  lastRefresh: number;
  refreshInterval: number;
  shopOpen: boolean;
}

export interface ShopPurchaseResult {
  success: boolean;
  message: string;
  item?: ShopItem;
  change?: number;
}

export interface ShopSellResult {
  success: boolean;
  message: string;
  goldEarned?: number;
}

export interface IShopService {
  getItems(): ShopItem[];
  refreshItems(): void;
  buyItem(itemId: string, quantity: number): ShopPurchaseResult;
  sellItem(itemId: string, quantity: number): ShopSellResult;
  getTransactions(): Transaction[];
  isShopOpen(): boolean;
  openShop(): void;
  closeShop(): void;
  getState(): ShopState;
  canAfford(itemId: string, quantity: number): boolean;
}

export const useShopStore = defineStore('shop', () => {
  const items = ref<ShopItem[]>([]);
  const transactions = ref<Transaction[]>([]);
  const lastRefresh = ref(0);
  const refreshInterval = ref(300000);
  const shopOpen = ref(false);

  const state = computed<ShopState>(() => ({
    items: items.value,
    transactions: transactions.value,
    lastRefresh: lastRefresh.value,
    refreshInterval: refreshInterval.value,
    shopOpen: shopOpen.value
  }));

  function generateId(): string {
    return 'shop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function getCategory(type: string): ItemCategory {
    switch (type) {
      case 'potion':
      case 'scroll':
      case 'food':
        return 'consumable';
      case 'weapon':
        return 'weapon';
      case 'armor':
        return 'armor';
      case 'material':
        return 'material';
      default:
        return 'misc';
    }
  }

  function getAllShopItems(): (Item | EquipmentItem)[] {
    return [...LOOT_ITEMS, ...EQUIPMENT_ITEMS];
  }

  function generateItems() {
    const newItems: ShopItem[] = [];
    const allItems = getAllShopItems();
    const shuffled = [...allItems].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 12);

    for (const template of selected) {
      const qualityRoll = Math.random();
      let quality: ItemQuality = template.rarity;
      
      if (qualityRoll > 0.95) quality = 'legendary';
      else if (qualityRoll > 0.85) quality = 'epic';
      else if (qualityRoll > 0.70) quality = 'rare';
      else if (qualityRoll > 0.50) quality = 'uncommon';

      const priceMultiplier = RARITY_PRICE_MULTIPLIER[quality];
      const basePrice = ITEM_BASE_PRICES[template.id] || template.value || 10;
      const baseQuantity = Math.floor(Math.random() * 5) + 1;

      newItems.push({
        id: generateId(),
        itemId: template.id,
        name: template.name,
        icon: template.icon,
        category: getCategory(template.type),
        price: Math.floor(basePrice * priceMultiplier),
        quantity: baseQuantity,
        quality,
        description: template.description,
        effect: template.bonus ? { type: 'stat', value: Object.values(template.bonus)[0] as number, statType: Object.keys(template.bonus)[0] } : undefined
      });
    }

    items.value = newItems;
    lastRefresh.value = Date.now();
  }

  function getItems(): ShopItem[] {
    if (items.value.length === 0 || Date.now() - lastRefresh.value > refreshInterval.value) {
      generateItems();
    }
    return items.value;
  }

  function refreshItems(): void {
    generateItems();
    eventBus.emit(GameEvents.SHOP_REFRESHED, { items: items.value });
  }

  function buyItem(itemId: string, quantity: number = 1): ShopPurchaseResult {
    const itemIndex = items.value.findIndex(item => item.itemId === itemId);
    if (itemIndex === -1) {
      return { success: false, message: '商品不存在！' };
    }

    const item = items.value[itemIndex];
    if (item.quantity < quantity) {
      return { success: false, message: '商品数量不足！' };
    }

    const totalPrice = item.price * quantity;
    const playerGold = characterService.getGold();

    if (playerGold < totalPrice) {
      return { success: false, message: '金币不足！' };
    }

    characterService.addGold(-totalPrice);
    items.value[itemIndex].quantity -= quantity;
    
    for (let i = 0; i < quantity; i++) {
      inventoryService.addItem({ id: item.itemId, count: 1 } as any);
    }

    const transaction: Transaction = {
      id: generateId(),
      type: 'buy',
      itemId: item.itemId,
      itemName: item.name,
      quantity,
      price: item.price,
      totalPrice,
      timestamp: Date.now()
    };
    transactions.value.unshift(transaction);
    if (transactions.value.length > 50) {
      transactions.value.pop();
    }

    eventBus.emit(GameEvents.SHOP_TRANSACTION, { transaction });

    return {
      success: true,
      message: `成功购买了 ${quantity} 个 ${item.name}！`,
      item,
      change: playerGold - totalPrice
    };
  }

  function sellItem(itemId: string, quantity: number = 1): ShopSellResult {
    const inventory = inventoryService.getInventory();
    const inventoryItem = inventory.find(item => item.itemId === itemId);
    
    if (!inventoryItem || inventoryItem.count < quantity) {
      return { success: false, message: '背包中没有足够的物品！' };
    }

    const allItems = getAllShopItems();
    const sellableItem = allItems.find(t => t.id === itemId);
    if (!sellableItem) {
      return { success: false, message: '该物品无法出售！' };
    }

    const basePrice = ITEM_BASE_PRICES[itemId] || sellableItem.value || 10;
    const rarity = sellableItem.rarity;
    const discount = RARITY_SELL_DISCOUNT[rarity];
    const sellPrice = Math.floor(basePrice * discount);
    const totalEarned = sellPrice * quantity;

    inventoryService.removeItemByItemId(itemId, quantity);
    characterService.addGold(totalEarned);

    const transaction: Transaction = {
      id: generateId(),
      type: 'sell',
      itemId,
      itemName: sellableItem.name,
      quantity,
      price: sellPrice,
      totalPrice: totalEarned,
      timestamp: Date.now()
    };
    transactions.value.unshift(transaction);
    if (transactions.value.length > 50) {
      transactions.value.pop();
    }

    eventBus.emit(GameEvents.SHOP_TRANSACTION, { transaction });

    return {
      success: true,
      message: `成功出售了 ${quantity} 个 ${sellableItem.name}，获得 ${totalEarned} 金币！`,
      goldEarned: totalEarned
    };
  }

  function getTransactions(): Transaction[] {
    return transactions.value;
  }

  function isShopOpen(): boolean {
    return shopOpen.value;
  }

  function openShop(): void {
    shopOpen.value = true;
    if (items.value.length === 0) {
      generateItems();
    }
    eventBus.emit(GameEvents.SHOP_OPENED, {});
  }

  function closeShop(): void {
    shopOpen.value = false;
    eventBus.emit(GameEvents.SHOP_CLOSED, {});
  }

  function getState(): ShopState {
    return state.value;
  }

  function canAfford(itemId: string, quantity: number): boolean {
    const item = items.value.find(i => i.itemId === itemId);
    if (!item) return false;
    
    const totalPrice = item.price * quantity;
    return characterService.getGold() >= totalPrice;
  }

  function filterItemsByCategory(category: ItemCategory | 'all'): ShopItem[] {
    if (category === 'all') return items.value;
    return items.value.filter(item => item.category === category);
  }

  function searchItems(query: string): ShopItem[] {
    const lowerQuery = query.toLowerCase();
    return items.value.filter(item => 
      item.name.toLowerCase().includes(lowerQuery) ||
      item.description.toLowerCase().includes(lowerQuery)
    );
  }

  return {
    items,
    transactions,
    lastRefresh,
    refreshInterval,
    shopOpen,
    state,
    getItems,
    refreshItems,
    buyItem,
    sellItem,
    getTransactions,
    isShopOpen,
    openShop,
    closeShop,
    getState,
    canAfford,
    filterItemsByCategory,
    searchItems
  };
});

export const shopService: IShopService = {
  getItems: () => useShopStore().getItems(),
  refreshItems: () => useShopStore().refreshItems(),
  buyItem: (itemId: string, quantity: number) => useShopStore().buyItem(itemId, quantity),
  sellItem: (itemId: string, quantity: number) => useShopStore().sellItem(itemId, quantity),
  getTransactions: () => useShopStore().getTransactions(),
  isShopOpen: () => useShopStore().isShopOpen(),
  openShop: () => useShopStore().openShop(),
  closeShop: () => useShopStore().closeShop(),
  getState: () => useShopStore().getState(),
  canAfford: (itemId: string, quantity: number) => useShopStore().canAfford(itemId, quantity)
};
