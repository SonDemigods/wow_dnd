/**
 * @fileoverview 商店数据模块
 * @description 包含所有商店的配置定义
 * @module data/shop
 */

import type { ShopConfig } from '../modules/shop/types';

export const SHOPS: Record<string, ShopConfig> = {
  generalGoods: {
    id: 'generalGoods',
    name: '杂货铺',
    type: 'general',
    icon: '🏪',
    refreshInterval: 300000,
    priceVariation: {
      min: 0.8,
      max: 1.2
    }
  },
  potionShop: {
    id: 'potionShop',
    name: '炼金术士小屋',
    type: 'potion',
    icon: '⚗️',
    refreshInterval: 600000,
    priceVariation: {
      min: 0.85,
      max: 1.15
    }
  },
  scrollShop: {
    id: 'scrollShop',
    name: '奥术商店',
    type: 'scroll',
    icon: '📜',
    refreshInterval: 900000,
    priceVariation: {
      min: 0.9,
      max: 1.1
    }
  },
  supplyShop: {
    id: 'supplyShop',
    name: '旅行者补给站',
    type: 'general',
    icon: '�',
    refreshInterval: 300000,
    priceVariation: {
      min: 0.8,
      max: 1.25
    }
  },
  alchemyShop: {
    id: 'alchemyShop',
    name: '药剂商行',
    type: 'potion',
    icon: '🍶',
    refreshInterval: 600000,
    priceVariation: {
      min: 0.8,
      max: 1.2
    }
  },
  mysteriousTrader: {
    id: 'mysteriousTrader',
    name: '旅行商人',
    type: 'general',
    icon: '🎭',
    refreshInterval: 1800000,
    priceVariation: {
      min: 0.7,
      max: 1.3
    }
  }
};
