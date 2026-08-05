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
import type { EquipmentItem, EquipmentSlot, EquippedItem } from './types';
import type { Stats } from '../character/types';
import { validateSubtypeSlot } from './slotRegistry';

// ==================== 槽位基础设施（P3.1：从 slotRegistry re-export） ====================

/**
 * 槽位基础设施 re-export
 *
 * P3.1 升级：槽位设施统一收口到 slotRegistry.ts，本文件 re-export 保持外部导入路径不变。
 * - ALL_EQUIPMENT_SLOTS：7 槽列表（weapon1/weapon2/helm/chest/gloves/legs/boots）
 * - SLOT_CONFIG：槽位展示配置（名称/图标/组别）
 * - createEmptySlotMap：空槽位映射工厂
 * - SLOT_GROUP / getSlotGroup：槽位组别查询（替代旧版 getSlotType）
 *
 * 外部模块仍可从 service.ts 导入这些符号，无需改导入路径。
 */
export {
  ALL_EQUIPMENT_SLOTS,
  SLOT_CONFIG,
  createEmptySlotMap,
  SLOT_GROUP,
  getSlotGroup
} from './slotRegistry';

// ==================== 装备槽位校验 ====================

/**
 * 校验装备是否适配指定槽位（P3.1：基于 subtype 校验）
 *
 * 替代旧版基于 `getSlotType` 前缀判断 + `slots.includes` 的双重校验。
 * 新版直接查 SUBTYPE_SLOTS 表，规则由数据派生：
 * - 单手武器可装主手或副手
 * - 副手武器只能副手
 * - 双手武器只能主手（占用副手见 SUBTYPE_OCCUPIES，P3.2 实现联动）
 * - 护甲一部位一槽（修复旧版"手套装头部"bug）
 *
 * @param itemTemplate - 装备模板（需含 subtype 字段）
 * @param slot - 目标槽位
 * @returns 槽位是否有效
 */
export function validateSlot(itemTemplate: EquipmentItem, slot: EquipmentSlot): boolean {
  return validateSubtypeSlot(itemTemplate.subtype, slot);
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
 * 2. 双手武器联动过滤：若 weapon1 已装备双手武器，weapon2 被锁定，从候选中排除
 * 3. 双手武器额外校验：双手武器需要 weapon2 也空闲（占用主+副两槽）
 * 4. 若无兼容槽位 → 不可装备
 * 5. 若所有兼容槽位都已被占用 → 不可装备
 * 6. 否则可装备（至少有一个空闲的兼容槽位）
 *
 * @param itemTemplate - 装备模板
 * @param equipment - 当前装备状态
 * @returns 校验结果对象，含 canEquip 标志和不可装备原因
 */
export function canEquipItem(
  itemTemplate: EquipmentItem,
  equipment: Record<EquipmentSlot, EquippedItem | null>
): { canEquip: boolean; reason: string } {
  // 双手武器额外校验：装入 weapon1 时需要 weapon2 也空闲
  if (itemTemplate.grip === 'two_handed' && equipment.weapon2) {
    return { canEquip: false, reason: '双手武器需要主副手槽位都空闲' };
  }

  const compatibleSlots = itemTemplate.slots.filter(slot => {
    if (!validateSlot(itemTemplate, slot)) return false;
    // 双手武器联动：weapon1 装备双手武器时，weapon2 被锁定，不可作为候选槽位
    if (slot === 'weapon2' && equipment.weapon1?.item.grip === 'two_handed') {
      return false;
    }
    return true;
  });
  if (compatibleSlots.length === 0) {
    return { canEquip: false, reason: '该装备没有可用的槽位' };
  }

  const allOccupied = compatibleSlots.every(slot => isSlotOccupied(equipment, slot));
  if (allOccupied) {
    return { canEquip: false, reason: '所有可用槽位已被占用' };
  }

  return { canEquip: true, reason: '' };
}

// ==================== 双手武器槽位锁定查询 ====================

/**
 * 检查指定槽位是否被双手武器锁定（P3.2 新增）
 *
 * 双手武器联动规则：当 weapon1 装备双手武器（grip === 'two_handed'）时，
 * weapon2 槽位被锁定为"被双手武器占用"状态，不可独立装备/卸下。
 * UI 据此渲染锁定遮罩，store 据此拦截装备/卸下操作。
 *
 * @param equipment - 当前装备状态
 * @param slot - 目标槽位
 * @returns 是否被双手武器锁定
 */
export function isSlotLockedByTwoHanded(
  equipment: Record<EquipmentSlot, EquippedItem | null>,
  slot: EquipmentSlot
): boolean {
  if (slot === 'weapon2') {
    return equipment.weapon1?.item.grip === 'two_handed';
  }
  return false;
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
//
// P3.3b 升级：套装进度查询已迁移至 setService.ts（基于新版 ItemSet 类型）。
// 旧版 countSetPieces / getActiveSetBonuses / getSetPieceCount 已删除，
// 调用方改用 setService.getAllSetProgresses / getSetProgressById / getActiveBonusEffects。
// 套装触发效果执行器在 setBonusRegistry.ts。
