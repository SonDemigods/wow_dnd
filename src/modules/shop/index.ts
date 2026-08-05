/**
 * @fileoverview 商店模块统一导出入口
 * @description 导出商店模块的类型定义和状态管理
 * @module shop
 */
export type { ShopConfig, ShopItem, ShopDisplayItem, SoldItemEntry, ShopItemsStorage, ShopSoldItemsStorage } from './types';
export { shopDbService } from './db';
export { useShopStore } from './store';
// P3.3：导出商店分类映射供 UI 层按商店类型动态生成分类标签与筛选
export { SHOP_CATEGORIES, type ShopCategory } from './service';
