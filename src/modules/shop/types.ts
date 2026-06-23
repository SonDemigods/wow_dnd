/**
 * @fileoverview 商店模块类型定义
 * @description 定义商店系统的核心数据结构，包括商店配置、商品、展示商品、
 *              存储格式和回购条目。所有类型均复用 inventory 模块的基础类型
 *              （ItemType / ItemRarity / ItemEffect）以保持体系一致性。
 * @module shop
 */

import type { ItemRarity, ItemType, ItemEffect } from '../inventory/types';

/**
 * 商店类型（联合类型字面量）
 *
 * 决定商店可售物品的类别范围，与 {@link SHOP_TYPE_ITEM_TYPE_MAP} 一一对应。
 * 外部新增商店配置时，必须使用此联合类型中的值，编译期即可校验。
 *
 * - `general`   — 杂货类（武器、护甲、材料、杂物）
 * - `potion`    — 药水类（药水、消耗品）
 * - `scroll`    — 卷轴类（卷轴、消耗品）
 * - `food`      — 食品类（食物、消耗品）
 * - `material`  — 材料类（材料、消耗品）
 */
export type ShopType = 'general' | 'potion' | 'scroll' | 'food' | 'material';

/**
 * 商店配置
 *
 * 定义单个商店的静态属性。数据来源为硬编码种子数据（{@link SHOPS}），
 * 首次运行时写入 IndexedDB，后续从 DB 读取并支持运行时修改（如管理后台）。
 * 持久化时通过 {@link cloneShopConfig} 浅拷贝防止共享引用。
 *
 * @property {string} id - 商店唯一标识（如 'general_goods'）
 * @property {string} name - 商店名称，显示给玩家
 * @property {ShopType} type - 商店类型，决定可售商品类别范围
 * @property {string} icon - 商店图标标识（Iconify 格式）
 * @property {number} refreshInterval - 商品自动刷新间隔（毫秒），0 表示不自动刷新
 *
 * @see cloneShopConfig 写入 DB 前通过此函数创建浅拷贝
 * @see SHOPS 硬编码种子数据
 */
export interface ShopConfig {
  id: string;
  name: string;
  type: ShopType;
  icon: string;
  refreshInterval: number;
}

/**
 * 商店商品（运行时库存条目）
 *
 * 表示商店中当前可购买的单个商品行。可能来源于：
 * 1. 系统自动生成（通过 {@link generateShopItems} 根据商店类型随机产出）
 * 2. 玩家出售回购（写入 {@link soldItems} Map，与生成商品合并展示）
 *
 * 购买操作（{@link buyItem}）会扣减 quantity，归零后从列表移除。
 *
 * @property {string} itemId - 物品ID，对应 inventory 模块中的 Item.id
 * @property {number} price - 当前售价（已根据稀有度倍率计算）
 * @property {number} quantity - 库存数量，回购物品为可回购累计数量
 *
 * @see generateShopItems 自动生成商品列表
 * @see buyItem 购买时扣减 quantity
 */
export interface ShopItem {
  itemId: string;
  price: number;
  quantity: number;
}

/**
 * 商店展示商品（UI 渲染用）
 *
 * 将 {@link ShopItem} 的库存信息与 {@link Item} 模板的详情字段合并，
 * 供 ShopPopup 等组件直接渲染，无需额外查询物品详情。
 * 由 {@link mergeItems} 函数生成，不在 DB 中单独存储。
 *
 * @property {string} id - 展示唯一标识（用于 v-for key，通常等于 itemId）
 * @property {string} itemId - 物品ID
 * @property {string} name - 物品名称
 * @property {ItemType} type - 物品分类，复用 inventory 的 ItemType
 * @property {ItemRarity} quality - 稀有度，复用 inventory 的 ItemRarity
 * @property {string} icon - 物品图标
 * @property {string} description - 物品描述文本
 * @property {number} price - 当前售价
 * @property {number} quantity - 库存数量
 * @property {ItemEffect} [effect] - 物品效果（可选），复用 inventory 的 ItemEffect
 *
 * @see mergeItems 生成此类型的函数
 */
export interface ShopDisplayItem {
  id: string;
  itemId: string;
  name: string;
  type: ItemType;
  quality: ItemRarity;
  icon: string;
  description: string;
  price: number;
  quantity: number;
  effect?: ItemEffect;
}

// ============================================================================
// 存储/持久化接口
// ============================================================================

/**
 * 商店商品持久化格式
 *
 * 存储在 IndexedDB `runtime_shopItems` 表中，以 shopId 为主键。
 * `lastRefresh` 记录上次生成时间戳，用于判断是否超过 {@link ShopConfig.refreshInterval}
 * 并触发自动刷新。
 *
 * @property {string} shopId - 商店ID，作为主键
 * @property {ShopItem[]} items - 商品列表
 * @property {number} lastRefresh - 上次生成时间戳（Date.now()）
 *
 * @see shopDbService.saveShopItems 写入此格式到 DB
 * @see shopDbService.getShopItems 从 DB 读取此格式
 */
export interface ShopItemsStorage {
  shopId: string;
  items: ShopItem[];
  lastRefresh: number;
}

/**
 * 回购条目
 *
 * 玩家向商店出售物品时记录，按 `shopId → itemId` 二级 Map 组织。
 * quantity 跟踪可回购的累计数量（同物品多次出售会合并）。
 * 玩家可在当前会话中按出售原价回购，商店关闭后回购列表保留在内存中。
 *
 * @property {string} itemId - 物品ID
 * @property {number} price - 出售时的单价（回购时以此价格买回）
 * @property {number} quantity - 可回购的累计数量
 *
 * @see sellItem 出售物品时写入此条目
 * @see buyItem 回购路径从 soldItems Map 中读取此条目
 */
export interface SoldItemEntry {
  itemId: string;
  price: number;
  quantity: number;
}
