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
 * P3.3 升级：EquipmentItem 已是 Item 判别联合的成员（kind='equipment'），
 * 不再需要"丢字段"转换。本函数现作为 identity 保留，供 mergeItemTemplates 调用，
 * 保持调用方接口不变。
 *
 * 旧版问题（plan.md T3）：显式丢弃 slots/classRestriction/setId，导致统一 Map 视图中
 * 装备退化为普通 Item，形成"双源数据"。判别联合彻底消除此问题——UI 通过
 * `item.kind === 'equipment'` 窄化即可安全访问全部装备专有字段。
 *
 * @param equip - 装备模板（EquipmentItem，已是 Item 联合成员）
 * @returns 统一物品格式（Item）
 */
export function convertEquipmentToItem(equip: EquipmentItem): Item {
  return equip;
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
