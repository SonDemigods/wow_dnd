/**
 * @fileoverview 装备回调类型定义（P3-155 拆分辅助文件）
 * @module equipment/composables
 */

export type AddItemToInventoryCallback = (itemId: string, quantity: number) => number;
export type RemoveItemFromInventoryCallback = (itemId: string, quantity: number) => number;
