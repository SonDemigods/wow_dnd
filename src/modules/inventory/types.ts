/**
 * @fileoverview 物品模块类型定义
 * @description 包含物品基础类型、背包物品、物品效果、排序筛选等相关类型定义
 *
 * 本文件是物品相关类型定义的唯一来源，配置层（@/config/inventory）从这里导入类型。
 */

import type { Stats } from '../character/types';
import type { SkillType } from '../skill/types';

// ==================== 基础类型定义 ====================

/**
 * 物品类型枚举
 * - gold: 货币
 * - potion: 药水
 * - scroll: 卷轴
 * - food: 食物
 * - material: 材料
 * - quest: 任务物品
 * - weapon: 武器
 * - armor: 护甲
 * - misc: 杂项
 */
export type ItemType =
  | 'gold'
  | 'potion'
  | 'scroll'
  | 'food'
  | 'material'
  | 'quest'
  | 'weapon'
  | 'armor'
  | 'misc';

/**
 * 物品稀有度枚举
 * - common: 普通
 * - uncommon: 优秀
 * - rare: 稀有
 * - epic: 史诗
 * - legendary: 传说
 */
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * 物品类型数据接口
 */
export interface ItemTypeData {
  id: ItemType;
  name: string;
  stackable: boolean;
  maxStack: number;
  usable?: boolean;
}

/**
 * 稀有度配置接口
 */
export interface RarityConfig {
  name: string;
  color: string;
}

/**
 * 技能效果类型枚举
 * - physical_damage: 物理伤害
 * - magic_damage: 法术伤害
 * - health_restore: 治疗
 * - stat: 属性加成
 */
export type ItemEffectType = SkillType | 'stat';

/**
 * 物品效果接口
 * @property {'health_restore'} type - 效果类型
 * @property {number} value - 效果值
 */
export interface ItemEffect {
  type: ItemEffectType;
  value: number | Partial<Stats>;
}

/**
 * 物品基础类型接口
 * @property {string} id - 物品ID
 * @property {string} name - 物品名称
 * @property {ItemType} type - 物品类型
 * @property {ItemRarity} rarity - 物品稀有度
 * @property {string} icon - 物品图标
 * @property {string} description - 物品描述
 * @property {Partial<Stats>} [bonus] - 属性加成
 * @property {ItemEffect} [effect] - 物品效果（伤害/治疗/法力回复/属性加成）
 * @property {number} value - 物品价值
 * @property {boolean} stackable - 是否可堆叠
 * @property {boolean} [consumable] - 是否为消耗品
 * @property {string} [template] - 物品模板ID
 */
export interface Item {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  icon: string;
  description: string;
  bonus?: Partial<Stats>;
  effect?: ItemEffect;
  value: number;
  stackable: boolean;
  consumable?: boolean;
  template?: string;
  levelRequirement?: number;
  level?: number;
}

/**
 * 背包物品接口
 * @property {string} itemId - 物品ID
 * @property {number} count - 物品数量
 */
export interface InventoryItem {
  itemId: string;
  count: number;
}

/**
 * 排序字段类型
 * - type: 类型
 * - rarity: 稀有度
 * - level: 等级
 * - acquiredAt: 获取时间
 * - name: 名称
 */
export type SortField = 'type' | 'rarity' | 'level' | 'acquiredAt' | 'name';

/**
 * 排序顺序类型
 * - asc: 升序
 * - desc: 降序
 */
export type SortOrder = 'asc' | 'desc';

/**
 * 物品筛选条件接口
 * @property {ItemType[]} [types] - 物品类型列表
 * @property {ItemRarity[]} [rarities] - 稀有度列表
 * @property {boolean} [stackable] - 是否可堆叠
 */
export interface ItemFilters {
  types?: ItemType[];
  rarities?: ItemRarity[];
  stackable?: boolean;
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
  getInventory(): InventoryItem[];

  /**
   * 获取指定位置的物品
   * @param {number} index - 物品位置索引
   * @returns {InventoryItem | null} 物品数据
   */
  getItem(index: number): InventoryItem | null;

  /**
   * 获取物品模板信息
   * @param {string} itemId - 物品ID
   * @returns {Item | null} 物品模板数据
   */
  getItemInfo(itemId: string): Item | null;

  /**
   * 获取所有物品模板（用于商店商品池等需要遍历全部物品的场景）
   * @returns {Item[]} 全部物品模板列表
   */
  getAllItems(): Item[];

  /**
   * 添加物品到背包
   * @param {Item} item - 物品数据
   * @returns {boolean} 是否成功添加
   */
  addItem(item: Item): boolean;

  /**
   * 移除指定位置的物品
   * @param {number} index - 物品位置索引
   * @returns {boolean} 是否成功移除
   */
  removeItem(index: number): boolean;

  /**
   * 使用指定位置的物品
   * @param {number} index - 物品位置索引
   * @returns {boolean} 是否成功使用
   */
  useItem(index: number): Promise<boolean>;

  /**
   * 获取空槽位数量
   * @returns {number} 空槽位数量
   */
  getEmptySlots(): number;

  /**
   * 检查背包是否已满
   * @returns {boolean} 是否已满
   */
  isFull(): boolean;

  /** 重置背包数据 */
  reset(): void;

  /**
   * 检查物品是否可以堆叠
   * @param {InventoryItem} item - 物品数据
   * @returns {boolean} 是否可以堆叠
   */
  canStack(item: InventoryItem): boolean;

  /**
   * 获取物品可堆叠数量
   * @param {InventoryItem} item - 物品数据
   * @returns {number} 可堆叠数量
   */
  getStackableCount(item: InventoryItem): number;

  /**
   * 丢弃指定位置的物品
   * @param {number} index - 物品位置索引
   * @param {number} [count] - 丢弃数量
   * @returns {boolean} 是否成功丢弃
   */
  dropItem(index: number, count?: number): boolean;

  /**
   * 批量丢弃物品
   * @param {number[]} indices - 物品位置索引列表
   * @returns {boolean} 是否成功丢弃
   */
  dropItems(indices: number[]): boolean;

  /**
   * 排序物品
   * @param {SortField} sortBy - 排序字段
   * @param {SortOrder} order - 排序顺序
   */
  sortItems(sortBy: SortField, order: SortOrder): void;

  /** 整理背包 */
  organizeInventory(): void;

  /**
   * 搜索物品
   * @param {string} keyword - 搜索关键词
   * @returns {InventoryItem[]} 匹配的物品列表
   */
  searchItems(keyword: string): InventoryItem[];

  /**
   * 筛选物品
   * @param {ItemFilters} filters - 筛选条件
   * @returns {InventoryItem[]} 匹配的物品列表
   */
  filterItems(filters: ItemFilters): InventoryItem[];
}

/**
 * 背包数据存储接口（存储到 char_inventory 表的结构）
 */
export interface InventoryDataStorage {
  characterId: string;
  /** 背包物品列表（原生数组，非 JSON 字符串） */
  items: InventoryItem[];
  updatedAt: number;
}

/**
 * 物品数据存储接口
 */
export interface ItemDataStorage {
  id: string;
  name: string;
  type: string;
  rarity: string;
  level?: number;
  icon: string;
  description: string;
  bonus: Record<string, number>;
  effect: Record<string, unknown> | null;
  value: number;
  stackable: boolean;
  consumable: boolean;
  template: string | null;
}

/**
 * 物品模板存储格式
 */
export interface ItemStorage {
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
  template?: string | null;
  levelRequirement?: number | null;
  level?: number;
}

/**
 * 背包存储格式
 */
export interface InventoryStorage {
  characterId: string;
  items: Array<{ itemId: string; count: number }>;
  updatedAt?: number;
}
