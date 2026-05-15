/**
 * @fileoverview 装备模块类型定义
 * @description 装备相关的类型和接口
 * @module modules/equipment/types
 */

import type { Stats } from '@/types';

/**
 * 装备槽位
 */
export enum EquipmentSlot {
  HEAD = 'head',
  CHEST = 'chest',
  LEGS = 'legs',
  FEET = 'feet',
  HANDS = 'hands',
  WEAPON = 'weapon',
  OFFHAND = 'offhand',
  TRINKET = 'trinket',
}

/**
 * 装备类型
 */
export enum EquipmentType {
  ARMOR = 'armor',
  WEAPON = 'weapon',
  TRINKET = 'trinket',
}

/**
 * 装备数据
 */
export interface EquipmentItem {
  id: string;
  name: string;
  icon: string;
  type: EquipmentType;
  slot: EquipmentSlot;
  level: number;
  itemLevel: number;
  stats: Partial<Stats>;
  effect?: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

/**
 * 已装备物品
 */
export interface EquippedItem extends EquipmentItem {
  equippedAt: number;
}

/**
 * 装备槽位状态
 */
export type EquipmentState = {
  [slot in EquipmentSlot]?: EquippedItem | null;
};

/**
 * 装备事件
 */
export interface EquipmentEquippedEvent {
  slot: EquipmentSlot;
  item: EquippedItem;
}

/**
 * 装备移除事件
 */
export interface EquipmentUnequippedEvent {
  slot: EquipmentSlot;
  item: EquippedItem;
}

/**
 * 装备更换事件
 */
export interface EquipmentChangedEvent {
  slot: EquipmentSlot;
  oldItem?: EquippedItem;
  newItem?: EquippedItem;
  statsChange: Partial<Stats>;
}

/**
 * 装备服务接口
 */
export interface IEquipmentService {
  equipItem(slot: EquipmentSlot, item: EquipmentItem): boolean;
  unequipItem(slot: EquipmentSlot): EquippedItem | null;
  getEquippedItem(slot: EquipmentSlot): EquippedItem | null;
  getEquippedItems(): EquipmentState;
  getTotalStats(): Partial<Stats>;
  canEquip(slot: EquipmentSlot, item: EquipmentItem): boolean;
  reset(): void;
}
