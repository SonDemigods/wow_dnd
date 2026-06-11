/**
 * @fileoverview 敌人模块类型定义
 * @description 包含敌人基础数据、敌人实例等相关类型定义
 */

import type { InventoryItem } from '../inventory/types';
import type { Stats } from '../character/types';

/** 危险等级 */
export type DangerLevel = '普通' | '精英' | '稀有' | 'BOSS';

/**
 * 敌人数据接口
 * 存储敌人的基础属性和战斗相关配置
 * @property {string} name - 敌人名称
 * @property {string} icon - 敌人图标
 * @property {number} maxHp - 最大生命值
 * @property {[number, number]} damage - 伤害范围
 * @property {number} xp - 经验值奖励
 * @property {number} gold - 金币奖励
 * @property {DangerLevel} dangerLevel - 危险等级
 * @property {boolean} [isBoss] - 是否为BOSS
 * @property {number} [physicalAttack] - 物理攻击力
 * @property {number} [physicalDefense] - 物理防御力
 * @property {number} [magicAttack] - 魔法攻击力
 * @property {number} [magicDefense] - 魔法防御力
 * @property {number} [critChance] - 暴击率
 * @property {number} [dodgeChance] - 闪避率
 */
export interface EnemyData {
  id: string;
  name: string;
  icon: string;
  maxHp: number;
  damage: [number, number];
  xp: number;
  gold: number;
  dangerLevel: DangerLevel;
  isBoss?: boolean;
  physicalAttack?: number;
  physicalDefense?: number;
  magicAttack?: number;
  magicDefense?: number;
  critChance?: number;
  dodgeChance?: number;
}

/**
 * 敌人掉落配置
 * @property {string} itemId - 物品ID
 * @property {number} minAmount - 最小掉落数量
 * @property {number} maxAmount - 最大掉落数量
 * @property {number} dropRate - 掉落概率（0-1）
 */
export interface EnemyDrop {
  itemId: string;
  minAmount: number;
  maxAmount: number;
  dropRate: number;
}

/**
 * 敌人实例接口（运行时使用）
 * 存储战斗中的敌人状态
 * @property {string} id - 敌人实例ID
 * @property {number} level - 敌人等级
 * @property {number} hp - 当前生命值
 * @property {InventoryItem[]} loot - 掉落物品
 * @property {Stats} stats - 敌人属性
 * @property {number} expReward - 经验值奖励
 * @property {number} goldReward - 金币奖励
 * @property {EnemyDrop[]} drops - 掉落配置
 */
export interface EnemyInstance extends EnemyData {
  id: string;
  dataId: string;
  level: number;
  hp: number;
  loot: InventoryItem[];
  stats: Stats;
  expReward: number;
  goldReward: number;
  drops: EnemyDrop[];
}

/**
 * 敌人类型别名（战斗服务使用）
 */
export type Enemy = EnemyInstance;

/**
 * 敌人模板存储格式
 */
export interface EnemyStorage {
  id: string;
  name: string;
  icon: string;
  maxHp: number;
  damage: [number, number];
  xp: number;
  gold: number;
  dangerLevel: string;
  isBoss?: number;
  physicalAttack?: number | null;
  physicalDefense?: number | null;
  magicAttack?: number | null;
  magicDefense?: number | null;
  critChance?: number | null;
  dodgeChance?: number | null;
}
