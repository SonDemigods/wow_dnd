/**
 * @fileoverview 商店数据模块
 * @description 包含所有商店的配置定义
 * @module data/shop
 */

import type { ShopConfig } from '../modules/shop/types';

export const SHOPS: ShopConfig[] = [
  {
    id: 'general_goods',
    name: '杂货铺',
    type: 'general',
    icon: '🏪',
    refreshInterval: 300000,
    priceVariation: {
      min: 0.8,
      max: 1.2
    }
  },
  {
    id: 'potion_shop',
    name: '炼金术士小屋',
    type: 'potion',
    icon: '⚗️',
    refreshInterval: 600000,
    priceVariation: {
      min: 0.85,
      max: 1.15
    }
  },
  {
    id: 'scroll_shop',
    name: '奥术商店',
    type: 'scroll',
    icon: '📜',
    refreshInterval: 900000,
    priceVariation: {
      min: 0.9,
      max: 1.1
    }
  },
  {
    id: 'supply_shop',
    name: '旅行者补给站',
    type: 'general',
    icon: '�',
    refreshInterval: 300000,
    priceVariation: {
      min: 0.8,
      max: 1.25
    }
  },
  {
    id: 'alchemy_shop',
    name: '药剂商行',
    type: 'potion',
    icon: '🍶',
    refreshInterval: 600000,
    priceVariation: {
      min: 0.8,
      max: 1.2
    }
  },
  {
    id: 'mysterious_trader',
    name: '旅行商人',
    type: 'general',
    icon: '🎭',
    refreshInterval: 1800000,
    priceVariation: {
      min: 0.7,
      max: 1.3
    }
  }
];
