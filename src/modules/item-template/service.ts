/**
 * @fileoverview 统一物品模板层纯函数服务
 * @description
 *   提供装备模板 → Item 格式的转换，以及普通物品与装备模板的合并逻辑。
 *   所有函数均为纯函数，无副作用，便于独立测试。
 *
 *   转换逻辑从 inventory/store.ts 第 152-171 行迁移而来（A1/G1 修复），
 *   使 inventory 模块不再感知装备模板的字段映射细节。
 *
 * @module item-template
 */
import type { Item } from './types';
import type { EquipmentItem } from '../equipment/types';

/**
 * 将装备模板转换为统一的 Item 格式
 *
 * 装备模板字段映射到 Item 接口：
 * - 保留：id/name/type/rarity/level/icon/description/bonus/value/stackable/levelRequirement
 * - 丢弃：slots/classRestriction/setId（装备专有字段，在统一 Item 视图中不适用）
 * - 不映射：effect/consumable/template（装备上下文中不适用）
 *
 * 注意：装备的 type 字段为 EquipmentType（'weapon' | 'armor'），
 * 是 ItemType 的子集，可直接赋值给 Item.type。
 *
 * @param equip - 装备模板（EquipmentItem 格式）
 * @returns 统一物品格式（Item）
 */
export function convertEquipmentToItem(equip: EquipmentItem): Item {
  return {
    id: equip.id,
    name: equip.name,
    type: equip.type,
    rarity: equip.rarity,
    level: equip.level,
    icon: equip.icon,
    description: equip.description,
    bonus: equip.bonus,
    value: equip.value,
    stackable: equip.stackable || false,
    levelRequirement: equip.levelRequirement
  };
}

/**
 * 合并普通物品模板与装备模板为统一的 Map
 *
 * 合并策略：
 * - 普通物品模板优先（先插入），与原 inventory/store.ts loadItemTemplates 行为一致
 * - 装备模板仅在 ID 不冲突时插入（避免覆盖普通物品定义）
 * - 装备模板通过 convertEquipmentToItem 转换为 Item 格式后插入
 *
 * 此函数不修改入参数组，返回新的 Map 实例。
 *
 * @param items - 普通物品模板列表（来自 config_items 表）
 * @param equipment - 装备模板列表（来自 config_equipmentItems 表）
 * @returns 合并后的 Map<itemId, Item>，key 为物品 ID，value 为统一 Item 格式
 */
export function mergeItemTemplates(items: Item[], equipment: EquipmentItem[]): Map<string, Item> {
  const map = new Map<string, Item>();
  // 第一步：普通物品模板优先插入
  items.forEach(item => map.set(item.id, item));
  // 第二步：装备模板仅在不冲突时插入（保留普通物品优先级）
  equipment.forEach(equip => {
    if (!map.has(equip.id)) {
      map.set(equip.id, convertEquipmentToItem(equip));
    }
  });
  return map;
}
