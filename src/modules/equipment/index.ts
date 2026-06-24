/**
 * @fileoverview 装备模块统一导出入口
 *
 * ## 导出策略
 *
 * - `types.ts` → 全部导出（类型不会增加运行时体积，外部可自由引用）
 * - `db.ts` → 全部导出（EquipmentDbService 类供测试/扩展，equipmentDbService 实例供日常使用）
 * - `store.ts` → 仅导出 useEquipmentStore（Pinia Store 定义，其他内容为模块内部实现）
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
export * from './types';
export * from './db';
export { useEquipmentStore } from './store';
