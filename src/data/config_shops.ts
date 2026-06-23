/**
 * @fileoverview 商店数据模块
 * @description 包含所有商店的配置定义
 * @module data/shop
 */

import type { ShopConfig } from '../modules/shop/types';

/**
 * 所有商店配置的完整数据集
 * @type {ShopConfig[]}
 */
export const SHOPS: ShopConfig[] = [
  {
    id: 'general_goods',
    name: '杂货铺',
    type: 'general',
    icon: 'game-icons:shop',
    refreshInterval: 300000,
  },
  {
    id: 'potion_shop',
    name: '炼金术士小屋',
    type: 'potion',
    icon: 'game-icons:potion-ball',
    refreshInterval: 600000,
  },
  {
    id: 'scroll_shop',
    name: '奥术商店',
    type: 'scroll',
    icon: 'game-icons:spell-book',
    refreshInterval: 900000,
  },
  {
    id: 'supply_shop',
    name: '旅行者补给站',
    type: 'general',
    icon: 'game-icons:backpack',
    refreshInterval: 300000,
  },
  {
    id: 'alchemy_shop',
    name: '药剂商行',
    type: 'potion',
    icon: 'game-icons:potion-ball',
    refreshInterval: 600000,
  },
  {
    id: 'mysterious_trader',
    name: '旅行商人',
    type: 'general',
    icon: 'game-icons:hooded-figure',
    refreshInterval: 1800000,
  }
];
