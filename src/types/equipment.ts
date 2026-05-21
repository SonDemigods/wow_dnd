/**
 * @fileoverview 装备模块类型定义
 * @description 包含装备稀有度、装备槽位、装备服务等相关类型定义
 */

import type { Item, ItemRarity } from './items'
import type { Stats } from './character'

/**
 * 装备稀有度枚举
 * - common: 普通
 * - uncommon: 优秀
 * - rare: 稀有
 * - epic: 史诗
 * - legendary: 传说
 */
export type EquipmentRarity = ItemRarity

/**
 * 稀有度配置接口
 * @property {string} name - 稀有度名称
 * @property {string} color - 颜色
 * @property {number} multiplier - 属性倍率
 */
export interface RarityConfig {
  name: string
  color: string
  multiplier: number
}

/**
 * 装备槽位枚举
 * - weapon1: 主手武器槽
 * - weapon2: 副手武器槽
 * - armor1: 护甲槽1
 * - armor2: 护甲槽2
 * - armor3: 护甲槽3
 * - armor4: 护甲槽4
 */
export type EquipmentSlot = 'weapon1' | 'weapon2' | 'armor1' | 'armor2' | 'armor3' | 'armor4'

/**
 * 装备类型枚举
 * - weapon: 武器
 * - armor: 护甲
 */
export type EquipmentType = 'weapon' | 'armor'

/**
 * 装备物品接口
 * @property {EquipmentType} type - 装备类型
 * @property {EquipmentSlot[]} slots - 装备槽位（武器可适配weapon1和weapon2，防具可适配armor1、armor2、armor3、armor4）
 * @property {Partial<Stats>} [bonus] - 属性加成
 * @property {EquipmentRarity} rarity - 稀有度
 * @property {number} [levelRequirement] - 等级要求
 */
export interface EquipmentItem extends Item {
  type: EquipmentType
  slots: EquipmentSlot[]
  bonus?: Partial<Stats>
  rarity: EquipmentRarity
  levelRequirement?: number
}

/**
 * 已装备物品接口
 * @property {EquipmentItem} item - 装备物品
 * @property {number} equippedAt - 装备时间戳
 */
export interface EquippedItem {
  item: EquipmentItem
  equippedAt: number
}

/**
 * 装备状态接口
 * @property {Record<EquipmentSlot, EquippedItem | null>} equipment - 装备记录
 */
export interface EquipmentState {
  equipment: Record<EquipmentSlot, EquippedItem | null>
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
   * @returns {boolean} 是否成功装备
   */
  equipItem(slot: EquipmentSlot, item: EquipmentItem): boolean

  /**
   * 卸下装备
   * @param {EquipmentSlot} slot - 槽位
   * @returns {EquippedItem | null} 卸下的装备
   */
  unequipItem(slot: EquipmentSlot): EquippedItem | null

  /**
   * 获取所有装备
   * @returns {Record<EquipmentSlot, EquippedItem | null>} 装备记录
   */
  getEquipment(): Record<EquipmentSlot, EquippedItem | null>

  /**
   * 获取指定槽位的装备
   * @param {EquipmentSlot} slots - 槽位
   * @returns {EquippedItem | null} 装备
   */
  getEquippedItem(slot: EquipmentSlot): EquippedItem | null

  /**
   * 获取总属性
   * @returns {Stats} 属性
   */
  getTotalStats(): Stats

  /**
   * 检查是否可以装备
   * @param {EquipmentItem} item - 装备物品
   * @param {EquipmentSlot} [slot] - 槽位
   * @returns {boolean} 是否可以装备
   */
  canEquip(item: EquipmentItem, slot?: EquipmentSlot): boolean

  /**
   * 获取槽位类型
   * @param {EquipmentSlot} slot - 槽位
   * @returns {'weapon' | 'armor'} 槽位类型
   */
  getSlotType(slot: EquipmentSlot): 'weapon' | 'armor'

  /** 同步属性到角色 */
  syncStatsToCharacter(): void

  /** 重置装备数据 */
  reset(): void

  /**
   * 获取稀有度配置
   * @param {EquipmentRarity} rarity - 稀有度
   * @returns {RarityConfig} 稀有度配置
   */
  getRarityConfig(rarity: EquipmentRarity): RarityConfig

  /**
   * 获取稀有度颜色
   * @param {EquipmentRarity} rarity - 稀有度
   * @returns {string} 颜色
   */
  getRarityColor(rarity: EquipmentRarity): string

  /**
   * 获取稀有度倍率
   * @param {EquipmentRarity} rarity - 稀有度
   * @returns {number} 倍率
   */
  getRarityMultiplier(rarity: EquipmentRarity): number

  /**
   * 计算稀有度加成
   * @param {Partial<Stats>} baseBonus - 基础属性
   * @param {EquipmentRarity} rarity - 稀有度
   * @returns {Partial<Stats>} 加成后的属性
   */
  calculateRarityBonus(baseBonus: Partial<Stats>, rarity: EquipmentRarity): Partial<Stats>
}
