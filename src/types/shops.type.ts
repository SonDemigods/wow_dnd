/**
 * @fileoverview 商店模块类型定义
 * @description 包含商店配置、商品池、价格系统等相关类型定义
 */

import type { ItemRarity } from './items.type';

/**
 * 价格变化范围接口
 * @property {number} min - 最小价格倍数（相对于基础价格）
 * @property {number} max - 最大价格倍数（相对于基础价格）
 */
export interface PriceVariation {
  min: number;
  max: number;
}

/**
 * 库存变化范围接口
 * @property {number} min - 最小库存数量
 * @property {number} max - 最大库存数量
 */
export interface StockVariation {
  min: number;
  max: number;
}

/**
 * 商店配置接口
 * @property {string} id - 商店唯一标识
 * @property {string} name - 商店名称，显示给玩家
 * @property {string} type - 商店类型，决定可用的商品池
 * @property {string} icon - 商店图标，用于UI显示
 * @property {string} locationId - 商店所在地点ID
 * @property {string} npcId - 经营商店的NPC ID
 * @property {number} refreshInterval - 商品自动刷新间隔（毫秒）
 * @property {number} minItems - 货架上最小商品数量
 * @property {number} maxItems - 货架上最大商品数量
 * @property {PriceVariation} priceVariation - 价格变化范围（相对于基础价格的倍数）
 * @property {StockVariation} stockVariation - 库存数量变化范围
 */
export interface ShopConfig {
  id: string;
  name: string;
  type: string;
  icon: string;
  locationId: string;
  npcId: string;
  refreshInterval: number;
  minItems: number;
  maxItems: number;
  priceVariation: PriceVariation;
  stockVariation: StockVariation;
}

/**
 * 商店商品接口
 * @property {string} itemId - 物品ID
 * @property {number} price - 当前售价
 * @property {number} stock - 当前库存
 * @property {number} maxStock - 最大库存
 */
export interface ShopItem {
  itemId: string;
  price: number;
  stock: number;
  maxStock: number;
}

/**
 * 商店库存接口
 * @property {string} shopId - 商店ID
 * @property {ShopItem[]} items - 当前货架上的商品
 * @property {number} lastRefresh - 上次刷新时间戳
 */
export interface ShopInventory {
  shopId: string;
  items: ShopItem[];
  lastRefresh: number;
}

/**
 * 商店服务接口
 * 提供商店管理的核心功能
 */
export interface IShopService {
  /**
   * 获取商店配置
   * @param {string} shopId - 商店ID
   * @returns {ShopConfig | null} 商店配置
   */
  getShopConfig(shopId: string): ShopConfig | null;

  /**
   * 获取商店库存
   * @param {string} shopId - 商店ID
   * @returns {ShopInventory | null} 商店库存
   */
  getShopInventory(shopId: string): ShopInventory | null;

  /**
   * 刷新商店库存
   * @param {string} shopId - 商店ID
   */
  refreshShopInventory(shopId: string): void;

  /**
   * 购买物品
   * @param {string} shopId - 商店ID
   * @param {string} itemId - 物品ID
   * @param {number} [quantity] - 购买数量，默认为1
   * @returns {boolean} 是否购买成功
   */
  buyItem(shopId: string, itemId: string, quantity?: number): boolean;

  /**
   * 出售物品
   * @param {string} itemId - 物品ID
   * @param {number} [quantity] - 出售数量，默认为1
   * @returns {boolean} 是否出售成功
   */
  sellItem(itemId: string, quantity?: number): boolean;

  /**
   * 计算物品售价
   * @param {string} itemId - 物品ID
   * @param {ItemRarity} rarity - 物品稀有度
   * @param {number} [priceMultiplier] - 价格倍数，默认为1
   * @returns {number} 售价
   */
  calculateBuyPrice(
    itemId: string,
    rarity: ItemRarity,
    priceMultiplier?: number
  ): number;

  /**
   * 计算物品回收价
   * @param {string} itemId - 物品ID
   * @param {ItemRarity} rarity - 物品稀有度
   * @returns {number} 回收价
   */
  calculateSellPrice(itemId: string, rarity: ItemRarity): number;

  /**
   * 获取所有商店列表
   * @returns {ShopConfig[]} 商店配置列表
   */
  getAllShops(): ShopConfig[];

  /**
   * 获取指定地点的商店列表
   * @param {string} locationId - 地点ID
   * @returns {ShopConfig[]} 商店配置列表
   */
  getShopsByLocation(locationId: string): ShopConfig[];

  /**
   * 检查商店是否需要刷新
   * @param {string} shopId - 商店ID
   * @returns {boolean} 是否需要刷新
   */
  needsRefresh(shopId: string): boolean;

  /** 重置所有商店数据 */
  reset(): void;
}
