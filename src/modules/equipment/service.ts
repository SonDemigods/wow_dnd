/**
 * 装备模块纯逻辑函数
 * 
 * 不持有任何内部状态，不操作数据库，不发射事件。
 * 所有业务逻辑均为纯函数，数据通过参数传入、通过返回值输出。
 * Store 层负责调用这些纯函数并管理响应式状态与持久化。
 */
import type { EquipmentItem, EquipmentSlot, EquippedItem } from './types';
import type { Stats } from '../character/types';

/**
 * 槽位类型映射
 */
const SLOT_TYPES: Record<EquipmentSlot, 'weapon' | 'armor'> = {
  weapon1: 'weapon',
  weapon2: 'weapon',
  armor1: 'armor',
  armor2: 'armor',
  armor3: 'armor',
  armor4: 'armor'
};

// ==================== 装备槽位校验 ====================

/**
 * 校验装备是否适配指定槽位
 * @param itemTemplate - 装备模板
 * @param slot - 目标槽位
 * @returns 槽位是否有效（类型匹配且槽位在装备允许的槽位列表中）
 */
export function validateSlot(itemTemplate: EquipmentItem, slot: EquipmentSlot): boolean {
  // 检查槽位类型（武器/护甲）是否匹配
  if (SLOT_TYPES[slot] !== itemTemplate.type) {
    return false;
  }
  // 检查该槽位是否在装备允许的槽位列表中
  if (!itemTemplate.slots.includes(slot)) {
    return false;
  }
  return true;
}

// ==================== 槽位占用检查 ====================

/**
 * 检查指定槽位是否已被占用
 * @param equipment - 当前装备状态
 * @param slot - 目标槽位
 * @returns 是否已被占用
 */
export function isSlotOccupied(
  equipment: Record<EquipmentSlot, EquippedItem | null>,
  slot: EquipmentSlot
): boolean {
  return equipment[slot] !== null;
}

// ==================== 属性加成计算 ====================

/**
 * 计算装备提供的属性加成
 * @param itemTemplate - 装备模板
 * @returns 属性加成（若无加成则返回空对象）
 */
export function computeEquipBonus(itemTemplate: EquipmentItem): Partial<Stats> {
  if (!itemTemplate.bonus) return {};
  return { ...itemTemplate.bonus };
}

// ==================== 可装备性检查 ====================

/**
 * 检查物品是否可以装备到当前装备状态中
 * @param itemTemplate - 装备模板
 * @param equipment - 当前装备状态
 * @returns 校验结果（canEquip 表示可否装备，reason 为不可装备的原因）
 */
export function canEquipItem(
  itemTemplate: EquipmentItem,
  equipment: Record<EquipmentSlot, EquippedItem | null>
): { canEquip: boolean; reason: string } {
  // 检查是否有可用的兼容槽位
  const compatibleSlots = itemTemplate.slots.filter(slot => validateSlot(itemTemplate, slot));
  if (compatibleSlots.length === 0) {
    return { canEquip: false, reason: '该装备没有可用的槽位' };
  }

  // 检查是否所有兼容槽位都已被占用
  const allOccupied = compatibleSlots.every(slot => isSlotOccupied(equipment, slot));
  if (allOccupied) {
    return { canEquip: false, reason: '所有可用槽位已被占用' };
  }

  return { canEquip: true, reason: '' };
}

// ==================== 槽位查询 ====================

/**
 * 获取指定槽位的装备
 * @param equipment - 当前装备状态
 * @param slot - 目标槽位
 * @returns 已装备物品或 null
 */
export function getEquipmentBySlot(
  equipment: Record<EquipmentSlot, EquippedItem | null>,
  slot: EquipmentSlot
): EquippedItem | null {
  return equipment[slot] || null;
}
