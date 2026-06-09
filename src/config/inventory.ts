/**
 * 背包/物品相关配置
 *
 * 包含物品类型、稀有度的所有配置常量。
 * 类型定义已移至 modules/inventory/types.ts，此处只保留配置数据。
 */

import type { ItemType, ItemRarity, ItemTypeData, RarityConfig } from '../modules/inventory/types';

// ==================== 配置常量 ====================

/**
 * 物品类型配置表
 */
export const ITEM_TYPES: Record<ItemType, ItemTypeData> = {
  gold: { id: 'gold', name: '货币', stackable: true, maxStack: 999999 },
  potion: { id: 'potion', name: '药水', stackable: true, maxStack: 20, usable: true },
  scroll: { id: 'scroll', name: '卷轴', stackable: true, maxStack: 10, usable: true },
  food: { id: 'food', name: '食物', stackable: true, maxStack: 20, usable: true },
  material: { id: 'material', name: '材料', stackable: true, maxStack: 99 },
  quest: { id: 'quest', name: '任务物品', stackable: true, maxStack: 1 },
  weapon: { id: 'weapon', name: '武器', stackable: false, maxStack: 1 },
  armor: { id: 'armor', name: '护甲', stackable: false, maxStack: 1 },
  misc: { id: 'misc', name: '杂项', stackable: true, maxStack: 1 }
};

/**
 * 稀有度配置表
 */
export const RARITY_CONFIG: Record<ItemRarity, RarityConfig> = {
  common: { name: '普通', color: '#ffffff'},
  uncommon: { name: '优秀', color: '#1eff00'},
  rare: { name: '稀有', color: '#0070dd'},
  epic: { name: '史诗', color: '#a335ee'},
  legendary: { name: '传说', color: '#ff8000'}
};

/**
 * 稀有度出售折扣率
 */
export const RARITY_SELL_DISCOUNT: Record<ItemRarity, number> = {
  common: 0.5,
  uncommon: 0.4,
  rare: 0.35,
  epic: 0.3,
  legendary: 0.25
};

/**
 * 稀有度价格倍率
 */
export const RARITY_PRICE_MULTIPLIER: Record<ItemRarity, number> = {
  common: 1,
  uncommon: 2.5,
  rare: 5,
  epic: 15,
  legendary: 50
};
