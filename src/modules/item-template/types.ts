/**
 * @fileoverview 统一物品模板层类型定义
 * @description
 *   本模块是 inventory 与 equipment 之间的物品模板聚合层（A1/G1 修复）。
 *   类型复用 inventory 模块的 Item 类型，避免类型重复定义。
 *   装备模板（EquipmentItem）继承自 Item，可通过 convertEquipmentToItem 转换为 Item 格式。
 *
 *   设计原则：
 *   - 类型层不重复定义，统一从 inventory/types 导入并 re-export
 *   - 聚合层职责：合并普通物品模板与装备模板为统一的 Map<string, Item>
 *
 * @module item-template
 */
export type {
  Item,
  ItemRarity,
  ItemEffect,
  ItemEffectType,
  ItemFilters,
  SortField,
  SortOrder
} from '../inventory/types';
