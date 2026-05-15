/**
 * @fileoverview 背包模块类型定义
 * @description 背包和物品系统的类型和接口定义
 * @module modules/inventory/types
 */

import type { Item } from '@/types';

/** 物品添加事件 */
export interface InventoryItemAddedEvent {
  item: Item;
  slot: number;
}

/** 物品移除事件 */
export interface InventoryItemRemovedEvent {
  item: Item;
  slot: number;
}

/** 物品使用事件 */
export interface InventoryItemUsedEvent {
  item: Item;
  slot: number;
}

/** 背包更新事件 */
export interface InventoryUpdatedEvent {
  items: (Item | null)[];
}

/** 背包服务接口 */
export interface IInventoryService {
  getItems(): (Item | null)[];
  getItem(slot: number): Item | null;
  addItem(item: Item): boolean;
  removeItem(slot: number): Item | null;
  useItem(slot: number): boolean;
  clearSlot(slot: number): void;
  hasItem(itemId: string): boolean;
  getItemCount(itemId: string): number;
  getEmptySlotCount(): number;
  isFull(): boolean;
  reset(): void;
}
