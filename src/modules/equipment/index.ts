/**
 * @fileoverview 装备模块统一导出入口
 *
 * ## 导出策略
 *
 * - `types.ts` → 全部导出（类型不会增加运行时体积，外部可自由引用）
 * - `db.ts` → 全部导出（EquipmentDbService 类供测试/扩展，equipmentDbService 实例供日常使用）
 * - `store.ts` → 导出 useEquipmentStore + 回调注入函数（setInventoryCallbacks/clearInventoryCallbacks）
 *
 * ## 推荐使用方式
 *
 * ```typescript
 * // 获取 Store 实例
 * import { useEquipmentStore } from '@/modules/equipment';
 * const equipmentStore = useEquipmentStore();
 *
 * // 使用类型
 * import type { EquipmentItem, EquipmentSlot } from '@/modules/equipment/types';
 * ```
 *
 * @module equipment
 */
export type {
  EquipmentSlot,
  EquipmentType,
  EquipmentItem,
  EquipmentItemDraft,
  SetBonus,
  SetBonusEffect,
  ItemSet,
  EquippedItem,
  EquipmentState,
  EquipmentDataStorage,
  EquipmentTemplateStorage,
  EquipmentStorage
} from './types';

// P3.1：槽位基础设施从 slotRegistry 统一导出
// service.ts 仍 re-export 这些符号保持向后兼容，外部新代码建议从 barrel 导入
export {
  ALL_EQUIPMENT_SLOTS,
  SLOT_CONFIG,
  SLOT_GROUP,
  createEmptySlotMap,
  getSlotGroup,
  deriveSlots,
  deriveGrip,
  SUBTYPE_SLOTS,
  SUBTYPE_OCCUPIES,
  WEAPON_SUBTYPE_GRIP,
  validateSubtypeSlot,
  isWeaponSubtype,
  isArmorSubtype
} from './slotRegistry';

export { EquipmentDbService, equipmentDbService } from './db';

export { useEquipmentStore, setInventoryCallbacks, clearInventoryCallbacks } from './store';
