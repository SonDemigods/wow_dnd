/**
 * 装备模块纯逻辑函数
 *
 * ## 设计原则
 *
 * 本文件仅包含纯函数：不持有内部状态、不操作数据库、不发射事件、不调用 Store。
 * 所有业务逻辑通过参数传入、通过返回值输出，可独立进行单元测试。
 *
 * Store 层（store.ts）负责：
 * 1. 调用这些纯函数进行业务判断
 * 2. 管理响应式状态
 * 3. 持久化到 IndexedDB
 * 4. 协调跨 Store 通信
 *
 * ## 函数分类
 *
 * | 分类 | 导出函数 | 内部函数 | 说明 |
 * |------|---------|---------|------|
 * | 槽位定义 | `ALL_EQUIPMENT_SLOTS`, `createEmptySlotMap` | - | 所有模块公用的槽位基础设施 |
 * | 槽位校验 | `validateSlot` | `getSlotType` | 检查装备类型是否匹配槽位 |
 * | 槽位占用 | - | `isSlotOccupied` | 检查槽位是否已有装备 |
 * | 属性加成 | `computeEquipBonus` | - | 计算装备的属性提升 |
 * | 可装备性 | `canEquipItem` | - | 综合判断物品是否可装备 |
 * | 槽位查询 | `getEquipmentBySlot` | - | 按槽位查询已装备物品 |
 */
import type { EquipmentItem, EquipmentSlot, EquippedItem, SetBonus, ItemSet } from './types';
import type { Stats } from '../character/types';
import { ITEM_SETS } from '@/data/config_item_sets';

// ==================== 槽位基础设施 ====================

/**
 * 所有装备槽位列表（定义顺序即 UI 展示顺序）
 *
 * 共 6 个槽位：2 个武器（主手、副手） + 4 个护甲（头、胸、腿、鞋）。
 * 此列表是 `createEmptySlotMap<T>()` 的遍历源，也是所有槽位相关操作的唯一权威定义。
 */
export const ALL_EQUIPMENT_SLOTS: EquipmentSlot[] = [
  'weapon1', 'weapon2', 'armor1', 'armor2', 'armor3', 'armor4'
];

/**
 * 槽位配置（UI 展示用）
 *
 * 定义每个装备槽位的展示名称和图标。
 * 与 ALL_EQUIPMENT_SLOTS 共同构成槽位定义的完整视角。
 *
 * P3-101 修复：原定义位于 store.ts，与 ALL_EQUIPMENT_SLOTS（service.ts）分离，
 * 两者维护不同步风险高。现统一收口到 service.ts 维护，store.ts 通过 import 引用。
 */
export const SLOT_CONFIG: Record<EquipmentSlot, { name: string; icon: string }> = {
  weapon1: { name: '主手', icon: 'game-icons:broadsword' },
  weapon2: { name: '副手', icon: 'game-icons:checked-shield' },
  armor1: { name: '头部', icon: 'game-icons:visored-helm' },
  armor2: { name: '胸部', icon: 'game-icons:chest-armor' },
  armor3: { name: '腿部', icon: 'game-icons:leg-armor' },
  armor4: { name: '鞋子', icon: 'game-icons:leather-boot' }
};

/**
 * 创建空槽位映射（泛型工厂函数）
 *
 * 生成一个包含全部 6 个槽位键、每个键值为 defaultValue 的记录对象。
 * 泛型参数 T 允许适配不同的值类型：
 * - `createEmptySlotMap<string | null>(null)` → 用于 DB 层的 ID 映射
 * - `createEmptySlotMap<EquippedItem | null>(null)` → 用于 Store 层的装备状态
 *
 * @param defaultValue - 每个槽位的默认值
 * @returns 包含全部槽位键的映射对象
 */
export function createEmptySlotMap<T>(defaultValue: T): Record<EquipmentSlot, T> {
  const map = {} as Record<EquipmentSlot, T>;
  for (const slot of ALL_EQUIPMENT_SLOTS) {
    map[slot] = defaultValue;
  }
  return map;
}

// ==================== 装备槽位校验 ====================

/**
 * 根据槽位命名规则推导槽位类型
 *
 * 约定：所有以 "weapon" 开头的槽位为武器槽，其余为护甲槽。
 * 新增武器槽位（如 weapon3）时会自动归类为武器，无需修改代码。
 *
 * @param slot - 任意装备槽位
 * @returns 'weapon'（武器槽）或 'armor'（护甲槽）
 */
function getSlotType(slot: EquipmentSlot): 'weapon' | 'armor' {
  return slot.startsWith('weapon') ? 'weapon' : 'armor';
}

/**
 * 校验装备是否适配指定槽位
 *
 * 双重校验：
 * 1. 类型匹配 —— 武器只能放武器槽，护甲只能放护甲槽
 * 2. 槽位兼容 —— 装备的 slots 列表必须包含目标槽位
 *    例如：只声明了 ['weapon1'] 的武器不能装到 weapon2 上
 *
 * @param itemTemplate - 装备模板
 * @param slot - 目标槽位
 * @returns 槽位是否有效
 */
export function validateSlot(itemTemplate: EquipmentItem, slot: EquipmentSlot): boolean {
  if (getSlotType(slot) !== itemTemplate.type) {
    return false;
  }
  if (!itemTemplate.slots.includes(slot)) {
    return false;
  }
  return true;
}

// ==================== 槽位占用检查 ====================

/**
 * 检查指定槽位是否已被占用
 *
 * 仅判断槽位值是否为 null，不做其他校验。
 * 此函数为模块内部使用，不对外导出。
 *
 * @param equipment - 当前装备状态
 * @param slot - 目标槽位
 * @returns 是否已被占用（非 null 即为占用）
 */
function isSlotOccupied(
  equipment: Record<EquipmentSlot, EquippedItem | null>,
  slot: EquipmentSlot
): boolean {
  return equipment[slot] !== null;
}

// ==================== 属性加成计算 ====================

/**
 * 计算装备提供的属性加成
 *
 * 对 bonus 字段做浅拷贝后返回，避免外部修改影响装备模板原始数据。
 * 若装备无 bonus 字段，返回空对象 `{}`。
 *
 * @param itemTemplate - 装备模板
 * @returns 属性加成（空对象表示无加成）
 */
export function computeEquipBonus(itemTemplate: EquipmentItem): Partial<Stats> {
  if (!itemTemplate.bonus) return {};
  return { ...itemTemplate.bonus };
}

// ==================== 可装备性检查 ====================

/**
 * 检查物品是否可以装备到当前装备状态中
 *
 * 综合判断逻辑：
 * 1. 筛选装备的兼容槽位（通过 validateSlot 校验）
 * 2. 若无兼容槽位 → 不可装备
 * 3. 若所有兼容槽位都已被占用 → 不可装备
 * 4. 否则可装备（至少有一个空闲的兼容槽位）
 *
 * @param itemTemplate - 装备模板
 * @param equipment - 当前装备状态
 * @returns 校验结果对象，含 canEquip 标志和不可装备原因
 */
export function canEquipItem(
  itemTemplate: EquipmentItem,
  equipment: Record<EquipmentSlot, EquippedItem | null>
): { canEquip: boolean; reason: string } {
  const compatibleSlots = itemTemplate.slots.filter(slot => validateSlot(itemTemplate, slot));
  if (compatibleSlots.length === 0) {
    return { canEquip: false, reason: '该装备没有可用的槽位' };
  }

  const allOccupied = compatibleSlots.every(slot => isSlotOccupied(equipment, slot));
  if (allOccupied) {
    return { canEquip: false, reason: '所有可用槽位已被占用' };
  }

  return { canEquip: true, reason: '' };
}

// ==================== 槽位查询 ====================

/**
 * 获取指定槽位的装备
 *
 * 兜底处理：若槽位键不存在于 equipment 对象中（`slot` in `equipment` 返回 false），
 * `equipment[slot]` 会返回 `undefined`，此时通过 `|| null` 转为 null。
 *
 * @param equipment - 当前装备状态
 * @param slot - 目标槽位
 * @returns 已装备物品（含装备时间戳）或 null
 */
export function getEquipmentBySlot(
  equipment: Record<EquipmentSlot, EquippedItem | null>,
  slot: EquipmentSlot
): EquippedItem | null {
  return equipment[slot] || null;
}

// ==================== 职业限制校验（Phase 5.3 新增） ====================

/**
 * 检查装备的职业限制是否允许指定职业装备
 *
 * 判断逻辑：
 * 1. 装备无 classRestriction 字段或为空数组 → 无职业限制，任何职业可装备
 * 2. 装备有 classRestriction 字段 → 玩家职业 ID 必须在列表中
 *
 * @param item - 装备模板
 * @param classId - 角色 职业 ID
 * @returns 是否允许该职业装备
 */
export function checkClassRestriction(item: EquipmentItem, classId: string): boolean {
  if (!item.classRestriction || item.classRestriction.length === 0) {
    return true;
  }
  return item.classRestriction.includes(classId);
}

// ==================== 套装效果计算（Phase 5.3 新增） ====================

/**
 * 统计当前装备状态中各套装的穿戴件数
 *
 * 遍历所有槽位的装备，按 setId 字段聚合统计。
 * 无 setId 的装备不计入任何套装。
 *
 * @param equipment - 当前装备状态
 * @returns 套装 ID → 穿戴件数的映射
 */
export function countSetPieces(
  equipment: Record<EquipmentSlot, EquippedItem | null>
): Map<string, number> {
  const counts = new Map<string, number>();
  Object.values(equipment).forEach(equippedItem => {
    if (equippedItem?.item.setId) {
      const setId = equippedItem.item.setId;
      counts.set(setId, (counts.get(setId) || 0) + 1);
    }
  });
  return counts;
}

/**
 * 计算当前装备状态激活的所有套装奖励
 *
 * 计算逻辑：
 * 1. 统计各套装的穿戴件数
 * 2. 对每个有穿戴的套装，查找其套装定义
 * 3. 筛选 requiredPieces <= 当前穿戴件数的奖励
 * 4. 返回所有激活的奖励列表
 *
 * @param equipment - 当前装备状态
 * @returns 激活的套装奖励数组（含套装 ID 和奖励详情）
 */
export function getActiveSetBonuses(
  equipment: Record<EquipmentSlot, EquippedItem | null>
): Array<{ setId: string; setName: string; piecesEquipped: number; bonus: SetBonus }> {
  const pieceCounts = countSetPieces(equipment);
  const activeBonuses: Array<{ setId: string; setName: string; piecesEquipped: number; bonus: SetBonus }> = [];

  pieceCounts.forEach((count, setId) => {
    const itemSet: ItemSet | undefined = ITEM_SETS.find(set => set.id === setId);
    if (!itemSet) return;

    itemSet.setBonuses.forEach(setBonus => {
      if (count >= setBonus.requiredPieces) {
        activeBonuses.push({
          setId,
          setName: itemSet.name,
          piecesEquipped: count,
          bonus: setBonus
        });
      }
    });
  });

  return activeBonuses;
}

/**
 * 获取指定套装的当前穿戴件数
 *
 * @param equipment - 当前装备状态
 * @param setId - 套装 ID
 * @returns 该套装的穿戴件数
 */
export function getSetPieceCount(
  equipment: Record<EquipmentSlot, EquippedItem | null>,
  setId: string
): number {
  return countSetPieces(equipment).get(setId) || 0;
}
