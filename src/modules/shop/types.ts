/**
 * @fileoverview 商店模块类型定义
 * @description 商店系统相关的类型和接口定义
 * @module modules/shop/types
 */

import type { Item } from '@/types';

/** 商品稀有度 */
export type ShopItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** 商店类型 */
export type ShopType = 'general' | 'weapons' | 'armor' | 'potions' | 'scrolls' | 'materials' | 'faction';

/** 商品状态 */
export type ShopItemStatus = 'available' | 'limited' | 'out_of_stock';

/**
 * 商店商品接口
 */
export interface ShopItem {
  id: string;
  itemTemplate: string;
  name: string;
  icon: string;
  type: string;
  rarity: ShopItemRarity;
  description: string;
  basePrice: number;
  currentPrice: number;
  stock: number;
  maxStock: number;
  status: ShopItemStatus;
  canSell: boolean;
  sellPrice: number;
  levelRequirement?: number;
  factionRequirement?: string;
}

/**
 * 商店配置接口
 */
export interface ShopConfig {
  id: string;
  name: string;
  type: ShopType;
  icon: string;
  locationId: string;
  npcId: string;
  refreshInterval: number;
  minItems: number;
  maxItems: number;
  priceVariation: {
    min: number;
    max: number;
  };
  stockVariation: {
    min: number;
    max: number;
  };
}

/**
 * 商店状态接口
 */
export interface ShopState {
  shopId: string;
  isOpen: boolean;
  lastRefresh: number;
  items: ShopItem[];
  refreshTimer: number;
  purchaseHistory: ShopTransaction[];
}

/**
 * 交易记录接口
 */
export interface ShopTransaction {
  id: string;
  type: 'buy' | 'sell';
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
  total: number;
  timestamp: number;
  shopId: string;
}

/**
 * 购买请求接口
 */
export interface PurchaseRequest {
  itemId: string;
  quantity: number;
}

/**
 * 出售请求接口
 */
export interface SellRequest {
  itemId: string;
  slot: number;
  quantity: number;
}

/**
 * 商品购买事件
 */
export interface ShopItemPurchasedEvent {
  item: ShopItem;
  quantity: number;
  totalPrice: number;
  shopId: string;
}

/**
 * 商品出售事件
 */
export interface ShopItemSoldEvent {
  item: Item;
  quantity: number;
  totalPrice: number;
  shopId: string;
}

/**
 * 商店刷新事件
 */
export interface ShopRefreshedEvent {
  shopId: string;
  items: ShopItem[];
  refreshTime: number;
}

/**
 * 商店服务接口
 */
export interface IShopService {
  openShop(shopId: string, npcId: string): boolean;
  closeShop(): void;
  refreshShop(shopId: string): boolean;
  purchaseItem(request: PurchaseRequest): boolean;
  sellItem(request: SellRequest): boolean;
  getShopItems(shopId: string): ShopItem[];
  getAvailableShops(locationId: string): ShopConfig[];
  getPurchaseHistory(shopId: string): ShopTransaction[];
  isShopOpen(): boolean;
  getCurrentShopId(): string | null;
  getShopConfig(shopId: string): ShopConfig | null;
  canAfford(price: number, quantity: number): boolean;
  canSell(itemId: string): boolean;
  reset(): void;
}

/**
 * 商品价格计算函数类型
 */
export type PriceCalculator = (
  basePrice: number,
  rarity: ShopItemRarity,
  playerLevel: number,
  priceVariation: { min: number; max: number }
) => number;

/**
 * 商品选择器函数类型
 */
export type ItemSelector = (
  itemPool: string[],
  shopType: ShopType,
  count: number
) => string[];
