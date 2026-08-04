/**
 * @fileoverview 商店模块统一导出入口
 * @description 导出商店模块的类型定义和状态管理
 * @module shop
 */
export type { ShopConfig, ShopItem, ShopDisplayItem, SoldItemEntry, ShopItemsStorage, ShopSoldItemsStorage } from './types';
export { shopDbService } from './db';
export { useShopStore } from './store';
// P3-161：导出商店类型映射供 UI 层按商店类型动态生成分类，避免穿透到 service 内部
export { SHOP_TYPE_ITEM_TYPE_MAP } from './service';
