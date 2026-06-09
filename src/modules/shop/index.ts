/**
 * @fileoverview 商店模块统一导出入口
 * @description 仅暴露类型定义和 Pinia Store。db/service 为内部实现，不对外暴露。
 * @module shop
 */
export type {
  ItemCategory,
  ItemQuality,
  PriceVariation,
  ShopConfig,
  ShopItem,
  ShopDisplayItem,
  IShopService
} from './types';
export { useShopStore } from './store';
