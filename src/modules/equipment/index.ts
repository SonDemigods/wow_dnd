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
  SetBonus,
  SetBonusEffect,
  ItemSet,
  EquippedItem,
  EquipmentState,
  EquipmentDataStorage,
  EquipmentTemplateStorage,
  EquipmentStorage
} from './types';

export { EquipmentDbService, equipmentDbService } from './db';

export { useEquipmentStore, setInventoryCallbacks, clearInventoryCallbacks } from './store';
