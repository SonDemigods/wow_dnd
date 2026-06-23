/**
 * @fileoverview 商店模块统一导出入口
 * @description 导出商店模块的类型定义和状态管理
 * @module shop
 */
export type { ShopConfig, ShopItem, ShopDisplayItem, SoldItemEntry, ShopItemsStorage } from './types';
export { useShopStore } from './store';
