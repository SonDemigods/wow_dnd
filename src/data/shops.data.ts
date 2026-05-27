/**
 * @fileoverview 商店数据模块
 * @description 包含所有商店的配置和商品池定义
 * @module data/shops
 */

import type { ItemRarity } from '../modules/inventory/types';
import type { ShopConfig } from '../modules/shop/types';

export const RARITY_PRICE_MULTIPLIER: Record<ItemRarity, number> = {
  common: 1,
  uncommon: 2.5,
  rare: 5,
  epic: 15,
  legendary: 50
};

export const RARITY_SELL_DISCOUNT: Record<ItemRarity, number> = {
  common: 0.5,
  uncommon: 0.4,
  rare: 0.35,
  epic: 0.3,
  legendary: 0.25
};

export const ITEM_BASE_PRICES: Record<string, number> = {
  smallHealthPotion: 10,
  mediumHealthPotion: 25,
  largeHealthPotion: 50,
  smallManaPotion: 10,
  mediumManaPotion: 25,
  largeManaPotion: 50,
  strengthPotion: 50,
  agilityPotion: 50,
  constitutionPotion: 50,
  intelligencePotion: 50,
  wisdomPotion: 50,
  charismaPotion: 50,
  bread: 5,
  roastedMeat: 15,
  magicBread: 30,
  scrollFireball: 40,
  scrollHeal: 35,
  scrollShield: 30,
  ancientKey: 100,
  dragonScale: 80,
  magicDust: 15,
  healingCrystal: 45,
  runeStone: 25
};

export const ITEM_POOLS: Record<string, string[]> = {
  potions: [
    'smallHealthPotion',
    'mediumHealthPotion',
    'largeHealthPotion',
    'smallManaPotion',
    'mediumManaPotion',
    'largeManaPotion',
    'strengthPotion',
    'agilityPotion',
    'constitutionPotion',
    'intelligencePotion',
    'wisdomPotion',
    'charismaPotion',
    'healingCrystal'
  ],
  scrolls: ['scrollFireball', 'scrollHeal', 'scrollShield'],
  food: ['bread', 'roastedMeat', 'magicBread'],
  materials: ['magicDust', 'runeStone'],
  general: [
    'smallHealthPotion',
    'mediumHealthPotion',
    'smallManaPotion',
    'mediumManaPotion',
    'bread',
    'magicDust',
    'runeStone'
  ],
  special: ['ancientKey', 'dragonScale', 'largeHealthPotion', 'largeManaPotion']
};

export const SHOPS: Record<string, ShopConfig> = {
  stormwindGeneralGoods: {
    id: 'stormwindGeneralGoods',
    name: '暴风城杂货铺',
    type: 'general',
    icon: '🏪',
    locationId: 'stormwind',
    refreshInterval: 300000,
    minItems: 6,
    maxItems: 10,
    priceVariation: {
      min: 0.8,
      max: 1.2
    },
    stockVariation: {
      min: 3,
      max: 10
    }
  },
  stormwindPotionShop: {
    id: 'stormwindPotionShop',
    name: '炼金师工坊',
    type: 'potions',
    icon: '⚗️',
    locationId: 'stormwind',
    refreshInterval: 600000,
    minItems: 5,
    maxItems: 8,
    priceVariation: {
      min: 0.85,
      max: 1.15
    },
    stockVariation: {
      min: 5,
      max: 15
    }
  },
  stormwindScrollShop: {
    id: 'stormwindScrollShop',
    name: '魔法卷轴铺',
    type: 'scrolls',
    icon: '📜',
    locationId: 'stormwind',
    refreshInterval: 900000,
    minItems: 3,
    maxItems: 6,
    priceVariation: {
      min: 0.9,
      max: 1.1
    },
    stockVariation: {
      min: 2,
      max: 5
    }
  },
  orgrimmarSupplyShop: {
    id: 'orgrimmarSupplyShop',
    name: '奥格瑞玛补给站',
    type: 'general',
    icon: '🏪',
    locationId: 'orgrimmar',
    refreshInterval: 300000,
    minItems: 6,
    maxItems: 10,
    priceVariation: {
      min: 0.8,
      max: 1.25
    },
    stockVariation: {
      min: 4,
      max: 12
    }
  },
  orgrimmarAlchemyShop: {
    id: 'orgrimmarAlchemyShop',
    name: '暗影炼金术',
    type: 'potions',
    icon: '🍶',
    locationId: 'orgrimmar',
    refreshInterval: 600000,
    minItems: 5,
    maxItems: 8,
    priceVariation: {
      min: 0.8,
      max: 1.2
    },
    stockVariation: {
      min: 5,
      max: 15
    }
  },
  mysteriousTrader: {
    id: 'mysteriousTrader',
    name: '神秘商人',
    type: 'faction',
    icon: '🎭',
    locationId: 'stormwind',
    refreshInterval: 1800000,
    minItems: 3,
    maxItems: 5,
    priceVariation: {
      min: 0.7,
      max: 1.3
    },
    stockVariation: {
      min: 1,
      max: 3
    }
  }
};

export const SHOP_TYPE_ITEM_POOL: Record<string, string> = {
  general: 'general',
  potions: 'potions',
  scrolls: 'scrolls',
  armor: 'general',
  weapons: 'general',
  materials: 'materials',
  faction: 'special'
};
