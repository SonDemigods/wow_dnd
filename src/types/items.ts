/**
 * @fileoverview 物品模块类型定义
 * @description 包含物品基础类型、背包物品、物品效果、排序筛选等相关类型定义
 */

import type { Stats } from './character'

/**
 * 物品基础类型接口
 * @property {string} id - 物品ID
 * @property {string} name - 物品名称
 * @property {string} type - 物品类型
 * @property {string} rarity - 物品稀有度
 * @property {string} icon - 物品图标
 * @property {string} description - 物品描述
 * @property {Partial<Stats>} [stats] - 属性加成
 * @property {number} value - 物品价值
 * @property {boolean} stackable - 是否可堆叠
 * @property {number} [hpRestore] - 生命值恢复量
 * @property {number} [mpRestore] - 法力值恢复量
 * @property {boolean} [consumable] - 是否为消耗品
 * @property {string} [template] - 物品模板ID
 */
export interface Item {
  /** 物品ID */
  id: string
  /** 物品名称 */
  name: string
  /** 物品类型 */
  type: string
  /** 物品稀有度 */
  rarity: string
  /** 物品图标 */
  icon: string
  /** 物品描述 */
  description: string
  /** 属性加成 */
  bonus?: Partial<Stats>
  /** 物品价值 */
  value: number
  /** 是否可堆叠 */
  stackable: boolean
  /** 生命值恢复量 */
  hpRestore?: number
  /** 法力值恢复量 */
  mpRestore?: number
  /** 是否为消耗品 */
  consumable?: boolean
  /** 物品模板ID */
  template?: string
}

/**
 * 背包物品接口
 * 继承自Item，添加数量字段
 * @property {number} count - 物品数量
 */
export interface InventoryItem extends Item {
  /** 物品数量 */
  count: number
}

/**
 * 物品类型数据接口
 * @property {string} name - 类型名称
 * @property {boolean} stackable - 是否可堆叠
 * @property {number} maxStack - 最大堆叠数量
 * @property {boolean} [usable] - 是否可使用
 */
export interface ItemTypeData {
  /** 类型名称 */
  name: string
  /** 是否可堆叠 */
  stackable: boolean
  /** 最大堆叠数量 */
  maxStack: number
  /** 是否可使用 */
  usable?: boolean
}

/**
 * 掉落物品数据接口
 * @property {string} name - 物品名称
 * @property {string} icon - 物品图标
 * @property {string} type - 物品类型
 * @property {number} [healing] - 治疗量
 * @property {number} [manaRestore] - 法力恢复量
 * @property {Partial<Stats>} [statBonus] - 属性加成
 * @property {'damage' | 'heal'} [effect] - 效果类型
 * @property {[number, number]} [damage] - 伤害范围
 * @property {string} rarity - 稀有度
 * @property {string} description - 描述
 * @property {string} template - 模板ID
 */
export interface LootItemData {
  /** 物品名称 */
  name: string
  /** 物品图标 */
  icon: string
  /** 物品类型 */
  type: string
  /** 治疗量 */
  healing?: number
  /** 法力恢复量 */
  manaRestore?: number
  /** 属性加成 */
  statBonus?: Partial<Stats>
  /** 效果类型 */
  effect?: 'damage' | 'heal'
  /** 伤害范围 */
  damage?: [number, number]
  /** 稀有度 */
  rarity: string
  /** 描述 */
  description: string
  /** 模板ID */
  template: string
}

/**
 * 物品类型枚举
 */
export type ItemType = 'weapon' | 'armor' | 'consumable' | 'quest' | 'misc'

/**
 * 物品稀有度枚举
 */
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

/**
 * 物品效果接口
 * @property {'heal'} type - 效果类型
 * @property {number} value - 效果值
 */
export interface ItemEffect {
  /** 效果类型 */
  type: 'heal'
  /** 效果值 */
  value: number
}

/**
 * 排序字段类型
 */
export type SortField = 'type' | 'rarity' | 'level' | 'acquiredAt' | 'name'

/**
 * 排序顺序类型
 */
export type SortOrder = 'asc' | 'desc'

/**
 * 物品筛选条件接口
 * @property {ItemType[]} [types] - 物品类型列表
 * @property {ItemRarity[]} [rarities] - 稀有度列表
 * @property {boolean} [stackable] - 是否可堆叠
 */
export interface ItemFilters {
  /** 物品类型列表 */
  types?: ItemType[]
  /** 稀有度列表 */
  rarities?: ItemRarity[]
  /** 是否可堆叠 */
  stackable?: boolean
}

/**
 * 背包服务接口
 * 提供背包管理的核心功能
 */
export interface IInventoryService {
  /**
   * 获取背包内容
   * @returns {InventoryItem[]} 背包物品列表
   */
  getInventory(): InventoryItem[]

  /**
   * 获取指定位置的物品
   * @param {number} index - 物品位置索引
   * @returns {InventoryItem | null} 物品数据
   */
  getItem(index: number): InventoryItem | null

  /**
   * 添加物品到背包
   * @param {Item} item - 物品数据
   * @returns {boolean} 是否成功添加
   */
  addItem(item: Item): boolean

  /**
   * 移除指定位置的物品
   * @param {number} index - 物品位置索引
   * @returns {boolean} 是否成功移除
   */
  removeItem(index: number): boolean

  /**
   * 使用指定位置的物品
   * @param {number} index - 物品位置索引
   * @returns {boolean} 是否成功使用
   */
  useItem(index: number): boolean

  /**
   * 获取空槽位数量
   * @returns {number} 空槽位数量
   */
  getEmptySlots(): number

  /**
   * 检查背包是否已满
   * @returns {boolean} 是否已满
   */
  isFull(): boolean

  /** 重置背包数据 */
  reset(): void

  /**
   * 检查物品是否可以堆叠
   * @param {InventoryItem} item - 物品数据
   * @returns {boolean} 是否可以堆叠
   */
  canStack(item: InventoryItem): boolean

  /**
   * 获取物品可堆叠数量
   * @param {InventoryItem} item - 物品数据
   * @returns {number} 可堆叠数量
   */
  getStackableCount(item: InventoryItem): number

  /**
   * 丢弃指定位置的物品
   * @param {number} index - 物品位置索引
   * @param {number} [count] - 丢弃数量
   * @returns {boolean} 是否成功丢弃
   */
  dropItem(index: number, count?: number): boolean

  /**
   * 批量丢弃物品
   * @param {number[]} indices - 物品位置索引列表
   * @returns {boolean} 是否成功丢弃
   */
  dropItems(indices: number[]): boolean

  /**
   * 排序物品
   * @param {SortField} sortBy - 排序字段
   * @param {SortOrder} order - 排序顺序
   */
  sortItems(sortBy: SortField, order: SortOrder): void

  /** 整理背包 */
  organizeInventory(): void

  /**
   * 搜索物品
   * @param {string} keyword - 搜索关键词
   * @returns {InventoryItem[]} 匹配的物品列表
   */
  searchItems(keyword: string): InventoryItem[]

  /**
   * 筛选物品
   * @param {ItemFilters} filters - 筛选条件
   * @returns {InventoryItem[]} 匹配的物品列表
   */
  filterItems(filters: ItemFilters): InventoryItem[]
}