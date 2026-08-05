/**
 * @fileoverview 旧 ItemType → 新 typeRegistry 桥接模块（P2 过渡用）
 * @description
 *   物品系统升级（plan.md §四 P2）的过渡桥接层。P2 阶段 UI 弹窗仍使用旧 `Item` 类型
 *   （inventory/types.ts，`type: ItemType`），但需要调用新 typeRegistry / descriptors。
 *   本模块负责将旧 `ItemType` 映射到新 `ItemKind` + `subtype`，使 UI 能通过 `lookupTypeMeta`
 *   获取元数据，消除三处重复的 `rarityNames` / `typeNames` / `getStatName`（plan.md U3）。
 *
 *   生命周期：P2 引入，P3 用判别联合 `Item` 直接覆盖旧 `Item` 后删除本模块。
 *
 * @module item
 */
import type { ItemType } from '../inventory/types';
import type { ItemKind } from './types';
import { lookupTypeMeta, type ItemCategory } from './typeRegistry';
import { getStatName } from './descriptors';
import type { Stats } from '../character/types';

// ============================================================================
// 旧 ItemType → 新 ItemKind + subtype 映射
// ============================================================================

/**
 * 旧 ItemType → 新 ItemKind + subtype 映射
 *
 * - gold/potion/scroll/food/material/quest/misc：有明确的新类型对应
 * - weapon/armor：旧类型太粗（无 subtype），映射到 kind='equipment' 但不带 subtype。
 *   展示名走 `OLD_EQUIPMENT_TYPE_NAMES` 直接映射（'武器'/'护甲'），
 *   P3 引入 subtype 后由 `lookupTypeMeta` 精确匹配。
 */
export function oldTypeToKindSubtype(type: ItemType): { kind: ItemKind; subtype?: string } {
  switch (type) {
    case 'gold':     return { kind: 'currency',   subtype: 'gold' };
    case 'potion':   return { kind: 'consumable', subtype: 'potion' };
    case 'scroll':   return { kind: 'consumable', subtype: 'scroll' };
    case 'food':     return { kind: 'consumable', subtype: 'food' };
    case 'material': return { kind: 'material' };
    case 'quest':    return { kind: 'quest' };
    case 'weapon':   return { kind: 'equipment' };
    case 'armor':    return { kind: 'equipment' };
    case 'misc':     return { kind: 'misc' };
  }
}

// ============================================================================
// 旧装备类型展示名
// ============================================================================

/**
 * 旧装备类型（weapon/armor）的展示名
 *
 * 旧类型无 subtype，无法走 `lookupTypeMeta`（注册表中 equipment 需指定 subtype 才有精确条目）。
 * P2 过渡期直接映射，P3 引入 subtype 后由注册表统一管理。
 */
const OLD_EQUIPMENT_TYPE_NAMES: Record<string, string> = {
  weapon: '武器',
  armor: '护甲'
};

// ============================================================================
// 桥接查询函数
// ============================================================================

/**
 * 获取旧 ItemType 的展示名（替代弹窗中重复的 `typeNames` 映射）
 *
 * 非装备类型走 `lookupTypeMeta`（单一来源），装备类型因旧类型无 subtype 用直接映射。
 */
export function getOldItemTypeDisplayName(type: ItemType): string {
  if (type in OLD_EQUIPMENT_TYPE_NAMES) {
    return OLD_EQUIPMENT_TYPE_NAMES[type];
  }
  const { kind, subtype } = oldTypeToKindSubtype(type);
  return lookupTypeMeta(kind, subtype).displayName;
}

/**
 * 获取旧 ItemType 的 UI 分类（替代弹窗中硬编码的分类逻辑）
 *
 * weapon/armor 旧类型无 subtype，`lookupTypeMeta` 无 fallback 条目会抛错，
 * 故直接归类为 'equipment'（P3 引入 subtype 后由注册表统一管理）。
 */
export function getOldItemTypeCategory(type: ItemType): ItemCategory {
  if (type === 'weapon' || type === 'armor') return 'equipment';
  const { kind, subtype } = oldTypeToKindSubtype(type);
  return lookupTypeMeta(kind, subtype).category;
}

/**
 * 判断旧 ItemType 是否为装备（替代弹窗中 `isEquipment` 硬编码 `type === 'weapon' || type === 'armor'`）
 */
export function isOldEquipmentType(type?: ItemType): boolean {
  return type === 'weapon' || type === 'armor';
}

/**
 * 获取属性中文名（桥接旧 `getStatName(stat: string)` → 新 `getStatName(stat: keyof Stats)`）
 *
 * 旧版接受 `string` 并有 `|| stat` 兜底（未知键返回原值）；新版接受 `keyof Stats` 无兜底。
 * 本函数保持旧行为：未知键返回原字符串，不返回 undefined。
 */
export function getOldStatName(stat: string): string {
  return getStatName(stat as keyof Stats) || stat;
}
