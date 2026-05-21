/**
 * @fileoverview 敌人模块类型定义
 * @description 包含敌人基础数据、敌人实例等相关类型定义
 */

import type { InventoryItem } from './items';

/**
 * 敌人数据接口
 * 存储敌人的基础属性和战斗相关配置
 * @property {string} name - 敌人名称
 * @property {string} icon - 敌人图标
 * @property {number} hp - 生命值
 * @property {[number, number]} damage - 伤害范围
 * @property {number} xp - 经验值奖励
 * @property {number} gold - 金币奖励
 * @property {string} dangerLevel - 危险等级
 * @property {boolean} [isBoss] - 是否为BOSS
 * @property {number} [physicalAttack] - 物理攻击力
 * @property {number} [physicalDefense] - 物理防御力
 * @property {number} [magicAttack] - 魔法攻击力
 * @property {number} [magicDefense] - 魔法防御力
 * @property {number} [critChance] - 暴击率
 * @property {number} [dodgeChance] - 闪避率
 */
export interface EnemyData {
  name: string;
  icon: string;
  hp: number;
  damage: [number, number];
  xp: number;
  gold: number;
  dangerLevel: string;
  isBoss?: boolean;
  physicalAttack?: number;
  physicalDefense?: number;
  magicAttack?: number;
  magicDefense?: number;
  critChance?: number;
  dodgeChance?: number;
}

/**
 * 敌人实例接口（运行时使用）
 * 存储战斗中的敌人状态
 * @property {string} id - 敌人实例ID
 * @property {string} name - 敌人名称
 * @property {string} type - 敌人类型
 * @property {number} level - 敌人等级
 * @property {number} hp - 当前生命值
 * @property {number} maxHp - 最大生命值
 * @property {number} attack - 攻击力
 * @property {number} defense - 防御力
 * @property {number} expReward - 经验奖励
 * @property {number} goldReward - 金币奖励
 * @property {string} icon - 敌人图标
 * @property {InventoryItem[]} loot - 掉落物品
 * @property {number} [attackBonus] - 攻击加成
 * @property {number} [critChance] - 暴击率
 * @property {number} [dodgeChance] - 闪避率
 */
export interface Enemy {
  id: string;
  name: string;
  type: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  expReward: number;
  goldReward: number;
  icon: string;
  loot: InventoryItem[];
  attackBonus?: number;
  critChance?: number;
  dodgeChance?: number;
}
