/**
 * @fileoverview 装备模块类型定义
 * @description 包含装备稀有度、装备槽位、装备服务等相关类型定义
 */

import type { Item, ItemRarity, RarityConfig } from '../inventory/types';
export type { RarityConfig };
import type { Stats } from '../character/types';

/**
 * 装备槽位枚举
 * - weapon1: 主手武器槽
 * - weapon2: 副手武器槽
 * - armor1: 护甲槽1
 * - armor2: 护甲槽2
 * - armor3: 护甲槽3
 * - armor4: 护甲槽4
 */
export type EquipmentSlot =
  | 'weapon1'
  | 'weapon2'
  | 'armor1'
  | 'armor2'
  | 'armor3'
  | 'armor4';

/**
 * 装备类型枚举
 * - weapon: 武器
 * - armor: 护甲
 */
export type EquipmentType = 'weapon' | 'armor';

/**
 * 装备物品接口
 * @property {EquipmentType} type - 装备类型
 * @property {EquipmentSlot[]} slots - 装备槽位（武器可适配weapon1和weapon2，防具可适配armor1、armor2、armor3、armor4）
 * @property {Partial<Stats>} [bonus] - 属性加成
 * @property {ItemRarity} rarity - 稀有度
 * @property {number} [levelRequirement] - 等级要求
 */
export interface EquipmentItem extends Item {
  type: EquipmentType;
  slots: EquipmentSlot[];
  bonus?: Partial<Stats>;
  rarity: ItemRarity;
  levelRequirement?: number;
}

/**
 * 已装备物品接口
 * @property {EquipmentItem} item - 装备物品
 * @property {number} equippedAt - 装备时间戳
 */
export interface EquippedItem {
  item: EquipmentItem;
  equippedAt: number;
}

/**
 * 装备状态接口
 * @property {Record<EquipmentSlot, EquippedItem | null>} equipment - 装备记录
 */
export interface EquipmentState {
  equipment: Record<EquipmentSlot, EquippedItem | null>;
}

/**
 * 装备服务接口
 * 提供装备管理的核心功能
 */
export interface IEquipmentService {
  /**
   * 装备物品
   * @param {EquipmentSlot} slot - 槽位
   * @param {EquipmentItem} item - 装备物品
   * @returns {Promise<boolean>} 是否成功装备
   */
  equipItem(slot: EquipmentSlot, item: EquipmentItem): Promise<boolean>;

  /**
   * 卸下装备
   * @param {EquipmentSlot} slot - 槽位
   * @returns {Promise<EquippedItem | null>} 卸下的装备
   */
  unequipItem(slot: EquipmentSlot): Promise<EquippedItem | null>;

  /**
   * 获取所有装备
   * @returns {Record<EquipmentSlot, EquippedItem | null>} 装备记录
   */
  getEquipment(): Record<EquipmentSlot, EquippedItem | null>;

  /**
   * 获取指定槽位的装备
   * @param {EquipmentSlot} slots - 槽位
   * @returns {EquippedItem | null} 装备
   */
  getEquippedItem(slot: EquipmentSlot): EquippedItem | null;

  /**
   * 获取总属性
   * @returns {Stats} 属性
   */
  getTotalStats(): Stats;

  /**
   * 检查是否可以装备
   * @param {EquipmentItem} item - 装备物品
   * @param {EquipmentSlot} [slot] - 槽位
   * @returns {boolean} 是否可以装备
   */
  canEquip(item: EquipmentItem, slot?: EquipmentSlot): boolean;

  /**
   * 获取槽位类型
   * @param {EquipmentSlot} slot - 槽位
   * @returns {'weapon' | 'armor'} 槽位类型
   */
  getSlotType(slot: EquipmentSlot): 'weapon' | 'armor';

  /** 同步属性到角色 */
  syncStatsToCharacter(): void;

  /** 重置装备数据 */
  reset(): void;

  /**
   * 获取稀有度配置
   * @param {ItemRarity} rarity - 稀有度
   * @returns {RarityConfig} 稀有度配置
   */
  getRarityConfig(rarity: ItemRarity): RarityConfig;

  /**
   * 获取稀有度颜色
   * @param {ItemRarity} rarity - 稀有度
   * @returns {string} 颜色
   */
  getRarityColor(rarity: ItemRarity): string;

}

/**
 * 装备数据存储接口（存储到 char_equipment 表的结构）
 */
export interface EquipmentDataStorage {
  characterId: string;
  /** 装备槽位数据（原生对象，非 JSON 字符串） */
  equipment: Record<EquipmentSlot, EquippedItem | null>;
  updatedAt: number;
}

/**
 * 装备模板存储接口
 */
export interface EquipmentTemplateStorage {
  id: string;
  name: string;
  type: string;
  rarity: string;
  icon: string;
  description: string;
  bonus: Record<string, number>;
  value: number;
  slots: EquipmentSlot[];
  levelRequirement: number | null;
  stackable: boolean;
  template: string;
}

/**
 * 装备模板存储格式
 */
export interface EquipmentItemStorage {
  id: string;
  name: string;
  type: string;
  rarity: string;
  icon: string;
  description: string;
  bonus?: Partial<Record<string, number>>;
  effect?: { type: string; value: number | Partial<Record<string, number>> } | null;
  value: number;
  stackable: boolean;
  consumable?: boolean;
  levelRequirement?: number | null;
  slots: string[];
  [key: string]: unknown;
}

/**
 * 装备存储格式
 */
export interface EquipmentStorage {
  characterId: string;
  equipment: Record<string, { item: Record<string, unknown>; equippedAt: number } | null>;
  updatedAt?: number;
}
