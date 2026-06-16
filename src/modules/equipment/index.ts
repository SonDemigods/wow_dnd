/**
 * @fileoverview 装备模块统一导出入口
 * @description 导出装备模块的所有类型定义、数据层、纯逻辑函数和状态管理（Store 核心架构）
 * @module equipment
 */
export * from './types';
export * from './db';
export { validateSlot, isSlotOccupied, computeEquipBonus, canEquipItem, getEquipmentBySlot } from './service';
export { useEquipmentStore } from './store';
