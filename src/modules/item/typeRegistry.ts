/**
 * @fileoverview 物品类型元数据注册表
 * @description
 *   物品系统升级（plan.md §3.5）的物品类型元数据单一来源。收口旧版散落三处的
 *   `ITEM_TYPE_NAMES` / `rarityNames` / `typeNames` / `isEquipment` / 分类分组为一张注册表，
 *   新增物品类型/子类型只需在此追加一行（开闭原则）。
 *
 *   阶段定位：P3.3 已完成迁移。旧版 `ITEM_TYPES` 配置表与 `ITEM_TYPE_NAMES` 映射已删除，
 *   UI 已切换到 `lookupTypeMeta` / `getItemDisplayName` 等查询入口。
 *
 * @module item
 */
import type { Item, ItemKind } from './types';
import { isEquipment, isConsumable } from './types';

// ============================================================================
// UI 分类分组
// ============================================================================

/**
 * 物品 UI 分类分组（替代旧版平铺 9 个 ItemType 的认知负担）
 * - `consumable`：消耗品（药水/食物/卷轴）
 * - `equipment`：装备（武器/护甲）
 * - `material`：材料
 * - `other`：其他（货币/任务物品/杂项）
 */
export type ItemCategory = 'consumable' | 'equipment' | 'material' | 'other';

/**
 * UI 分类展示顺序
 */
export const CATEGORY_ORDER: ItemCategory[] = ['consumable', 'equipment', 'material', 'other'];

/**
 * UI 分类中文名
 */
export const CATEGORY_NAMES: Record<ItemCategory, string> = {
  consumable: '消耗品',
  equipment: '装备',
  material: '材料',
  other: '其他'
};

// ============================================================================
// 类型元数据
// ============================================================================

/**
 * 物品类型元数据
 *
 * @property kind - 物品大类
 * @property subtype - 子类型（可选，消耗品/装备/货币有，材料/任务/杂项无）
 * @property displayName - 中文名
 * @property category - UI 分组
 * @property stackable - 是否可堆叠
 * @property maxStack - 最大堆叠数
 * @property icon - 默认图标（可选）
 */
export interface ItemTypeMeta {
  kind: ItemKind;
  subtype?: string;
  displayName: string;
  category: ItemCategory;
  stackable: boolean;
  maxStack: number;
  icon?: string;
}

/**
 * 类型注册表：元数据单一来源
 *
 * 新增类型/子类型只需在此追加一行。
 * `lookupTypeMeta` 先按 (kind, subtype) 精确匹配，未命中再按 kind 兜底。
 */
export const TYPE_REGISTRY: ItemTypeMeta[] = [
  // 消耗品
  { kind: 'consumable', subtype: 'potion', displayName: '药水', category: 'consumable', stackable: true, maxStack: 10 },
  { kind: 'consumable', subtype: 'food', displayName: '食物', category: 'consumable', stackable: true, maxStack: 10 },
  { kind: 'consumable', subtype: 'scroll', displayName: '卷轴', category: 'consumable', stackable: true, maxStack: 10 },
  // 材料
  { kind: 'material', displayName: '材料', category: 'material', stackable: true, maxStack: 99 },
  // 装备 - 单手武器
  { kind: 'equipment', subtype: 'sword', displayName: '剑', category: 'equipment', stackable: false, maxStack: 1 },
  { kind: 'equipment', subtype: 'axe', displayName: '斧', category: 'equipment', stackable: false, maxStack: 1 },
  { kind: 'equipment', subtype: 'hammer', displayName: '锤', category: 'equipment', stackable: false, maxStack: 1 },
  { kind: 'equipment', subtype: 'dagger', displayName: '匕首', category: 'equipment', stackable: false, maxStack: 1 },
  { kind: 'equipment', subtype: 'staff', displayName: '法杖', category: 'equipment', stackable: false, maxStack: 1 },
  // 装备 - 副手武器
  { kind: 'equipment', subtype: 'shield', displayName: '盾牌', category: 'equipment', stackable: false, maxStack: 1 },
  { kind: 'equipment', subtype: 'off_dagger', displayName: '副手匕首', category: 'equipment', stackable: false, maxStack: 1 },
  // 装备 - 双手武器
  { kind: 'equipment', subtype: 'greatsword', displayName: '双手剑', category: 'equipment', stackable: false, maxStack: 1 },
  { kind: 'equipment', subtype: 'greataxe', displayName: '双手斧', category: 'equipment', stackable: false, maxStack: 1 },
  { kind: 'equipment', subtype: 'greatbow', displayName: '长弓', category: 'equipment', stackable: false, maxStack: 1 },
  { kind: 'equipment', subtype: 'greatstaff', displayName: '双手法杖', category: 'equipment', stackable: false, maxStack: 1 },
  // 装备 - 护甲5部位
  { kind: 'equipment', subtype: 'helm', displayName: '头盔', category: 'equipment', stackable: false, maxStack: 1 },
  { kind: 'equipment', subtype: 'chest', displayName: '胸甲', category: 'equipment', stackable: false, maxStack: 1 },
  { kind: 'equipment', subtype: 'gloves', displayName: '手套', category: 'equipment', stackable: false, maxStack: 1 },
  { kind: 'equipment', subtype: 'legs', displayName: '护腿', category: 'equipment', stackable: false, maxStack: 1 },
  { kind: 'equipment', subtype: 'boots', displayName: '靴子', category: 'equipment', stackable: false, maxStack: 1 },
  // 货币
  { kind: 'currency', subtype: 'gold', displayName: '金币', category: 'other', stackable: false, maxStack: 1 },
  // 任务物品
  { kind: 'quest', displayName: '任务物品', category: 'other', stackable: false, maxStack: 1 },
  // 杂项
  { kind: 'misc', displayName: '杂项', category: 'other', stackable: false, maxStack: 1 }
];

// ============================================================================
// 查询函数
// ============================================================================

/**
 * 查询类型元数据
 *
 * 先按 (kind, subtype) 精确匹配，未命中再按 kind（subtype 为 undefined）兜底。
 * 若仍无匹配（未注册的 kind），抛出错误而非返回 undefined，强制注册完整性。
 *
 * @param kind - 物品大类
 * @param subtype - 子类型（可选）
 * @returns 类型元数据
 */
export function lookupTypeMeta(kind: ItemKind, subtype?: string): ItemTypeMeta {
  const exact = TYPE_REGISTRY.find(m => m.kind === kind && m.subtype === subtype);
  if (exact) return exact;

  const fallback = TYPE_REGISTRY.find(m => m.kind === kind && m.subtype === undefined);
  if (fallback) return fallback;

  throw new Error(`未注册的物品类型：kind=${kind}${subtype ? ` subtype=${subtype}` : ''}`);
}

/**
 * 从物品实例提取子类型字符串（类型安全，无 any）
 *
 * 仅 consumable/equipment/currency 有 subtype 字段，其余返回 undefined。
 */
function getItemSubtype(item: Item): string | undefined {
  if (item.kind === 'consumable') return item.subtype;
  if (item.kind === 'equipment') return item.subtype;
  if (item.kind === 'currency') return item.subtype;
  return undefined;
}

/**
 * 获取物品的 UI 分类
 */
export function getItemCategory(item: Item): ItemCategory {
  return lookupTypeMeta(item.kind, getItemSubtype(item)).category;
}

/**
 * 获取物品类型的中文名
 */
export function getItemDisplayName(item: Item): string {
  return lookupTypeMeta(item.kind, getItemSubtype(item)).displayName;
}

/**
 * 获取分类中文名
 */
export function getCategoryName(category: ItemCategory): string {
  return CATEGORY_NAMES[category];
}

// ============================================================================
// 重新导出类型守卫（供 UI 便捷导入）
// ============================================================================

export { isEquipment, isConsumable };
