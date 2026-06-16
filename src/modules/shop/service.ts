/**
 * 商店模块纯函数层
 * 
 * 所有函数均为无副作用、无内部状态的纯计算函数。
 * DB 调用、事件通知、状态管理全部由 Store 层负责。
 */
import type { ShopConfig, ShopItem } from './types';
import type { Item, ItemType } from '../inventory/types';
import type { Character } from '../character/types';
import { RARITY_SELL_DISCOUNT, RARITY_PRICE_MULTIPLIER } from '@/config/inventory';
import { SHOPS } from '@/data/config_shops';

// ==================== 常量 ====================

/** 商店类型 → 可售物品类型映射 */
export const SHOP_TYPE_ITEM_TYPE_MAP: Record<string, ItemType[]> = {
  general: ['potion', 'scroll', 'food', 'material'],
  potion: ['potion'],
  scroll: ['scroll'],
  food: ['food'],
  material: ['material']
};

/** 默认生成商品种类数 */
const DEFAULT_ITEM_COUNT = 10;
/** 单品种最大库存 */
const MAX_STOCK = 10;

// ==================== 纯函数：价格计算 ====================

/**
 * 计算物品在商店中的买入/卖出价格
 * @param itemTemplate - 物品模板（需包含 id、rarity、value）
 * @param shopConfig - 商店配置（用于价格浮动，当前保留用于未来扩展）
 * @param isBuy - true=买入价（玩家买），false=卖出价（玩家卖）
 * @returns 计算后的价格（取整）
 */
export function calculatePrice(
  itemTemplate: Pick<Item, 'id' | 'rarity' | 'value'>,
  _shopConfig: ShopConfig,
  isBuy: boolean
): number {
  const baseValue = itemTemplate.value || 10;
  const rarityMultiplier = RARITY_PRICE_MULTIPLIER[itemTemplate.rarity] || 1;
  const buyPrice = Math.floor(baseValue * rarityMultiplier);

  if (isBuy) {
    return buyPrice;
  }

  // 卖出价 = 买入价 × 稀有度折扣率
  const discount = RARITY_SELL_DISCOUNT[itemTemplate.rarity] || 0.5;
  return Math.floor(buyPrice * discount);
}

/**
 * 判断角色能否负担指定价格
 * @param character - 角色数据（需包含 gold 属性）
 * @param price - 需要支付的金币数
 * @returns 是否买得起
 */
export function canAffordItem(character: Pick<Character, 'gold'>, price: number): boolean {
  return character.gold >= price;
}

// ==================== 纯函数：商品生成 ====================

/**
 * 根据商店配置从物品模板池中随机生成商品列表
 * @param shopConfig - 商店配置
 * @param allItemTemplates - 全部物品模板（未过滤）
 * @returns 生成的商品列表
 */
export function generateShopItems(
  shopConfig: ShopConfig,
  allItemTemplates: Item[]
): ShopItem[] {
  const items: ShopItem[] = [];

  // 1. 按商店类型过滤物品池
  const allowedTypes = SHOP_TYPE_ITEM_TYPE_MAP[shopConfig.type] || SHOP_TYPE_ITEM_TYPE_MAP.general;
  const pool = allItemTemplates.filter(item => allowedTypes.includes(item.type as ItemType));

  if (pool.length === 0) {
    console.warn(`[ShopService] 商店类型 "${shopConfig.type}" 无匹配物品`);
    return items;
  }

  // 2. 随机选取指定数量的物品种类
  const itemCount = Math.min(DEFAULT_ITEM_COUNT, pool.length);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selectedItems = shuffled.slice(0, itemCount);

  // 3. 为每种物品生成价格和随机库存
  selectedItems.forEach(item => {
    const price = calculatePrice(item, shopConfig, true);
    const stock = Math.floor(Math.random() * MAX_STOCK) + 1;

    items.push({
      itemId: item.id,
      price,
      quantity: stock
    });
  });

  return items;
}

// ==================== 纯函数：商店筛选 ====================

/**
 * 根据当前所在位置获取可访问的商店列表
 * @param locations - 当前可用的位置标识列表（空数组表示返回全部）
 * @returns 可访问的商店配置列表
 */
export function getAvailableShops(locations: string[]): ShopConfig[] {
  // 当前版本商店不与位置绑定，返回全部商店配置
  if (locations.length === 0) {
    return [...SHOPS];
  }

  // 未来可扩展按位置过滤：根据 locations 筛选匹配的商店
  return [...SHOPS];
}
