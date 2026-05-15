/**
 * @fileoverview 游戏常量和计算函数模块
 * @description 包含游戏核心常量、属性计算和升级经验需求
 * @module data/constants
 */

/**
 * 玩家可达到的最大等级
 * @type {number}
 */
export const MAX_LEVEL = 20

/**
 * 主属性名称映射表
 * @type {Record<string, string>}
 */
export const STAT_NAMES = {
  str: '力量',
  dex: '敏捷',
  con: '体质',
  int: '智力',
  wis: '感知',
  cha: '魅力'
} as const

/**
 * 衍生属性计算配置
 * 定义了各衍生属性如何基于主属性计算
 * @type {Record<string, { stat: string; mult: number; base: number }>}
 */
export const ATTRIBUTE_BONUSES = {
  physicalAttack: { stat: 'str', mult: 2, base: 5 },
  physicalDefense: { stat: 'con', mult: 1.5, base: 3 },
  magicAttack: { stat: 'int', mult: 2, base: 5 },
  magicDefense: { stat: 'wis', mult: 1.5, base: 3 },
  critChance: { stat: 'dex', mult: 0.5, base: 5 },
  dodgeChance: { stat: 'dex', mult: 0.4, base: 3 },
  maxHp: { stat: 'con', mult: 10, base: 20 },
  maxMana: { stat: 'int', mult: 8, base: 15 },
  healBonus: { stat: 'wis', mult: 1, base: 0 },
  initiative: { stat: 'dex', mult: 1, base: 0 }
} as const

import type { Stats } from '../types'

/**
 * 计算单个衍生属性值
 * @param {Stats} stats - 角色主属性对象
 * @param {keyof typeof ATTRIBUTE_BONUSES} attrKey - 要计算的衍生属性键名
 * @returns {number} 计算后的属性值
 */
export function calculateAttribute(stats: Stats, attrKey: keyof typeof ATTRIBUTE_BONUSES): number {
  const bonus = ATTRIBUTE_BONUSES[attrKey]
  if (!bonus) return 0
  const statValue = stats[bonus.stat as keyof Stats] || 10
  return Math.floor(bonus.base + (statValue - 10) / 2 * bonus.mult)
}

/**
 * 计算所有衍生属性
 * @param {Stats} stats - 角色主属性对象
 * @returns {Object} 包含所有衍生属性的对象
 * @returns {number} .physicalAttack - 物理攻击力
 * @returns {number} .physicalDefense - 物理防御力
 * @returns {number} .magicAttack - 魔法攻击力
 * @returns {number} .magicDefense - 魔法防御力
 * @returns {number} .critChance - 暴击概率
 * @returns {number} .dodgeChance - 闪避概率
 * @returns {number} .maxHp - 最大生命值
 * @returns {number} .maxMana - 最大法力值
 * @returns {number} .healBonus - 治疗加成
 * @returns {number} .initiative - 先攻值
 */
export function calculateAllAttributes(stats: Stats) {
  return {
    physicalAttack: calculateAttribute(stats, 'physicalAttack'),
    physicalDefense: calculateAttribute(stats, 'physicalDefense'),
    magicAttack: calculateAttribute(stats, 'magicAttack'),
    magicDefense: calculateAttribute(stats, 'magicDefense'),
    critChance: Math.min(50, calculateAttribute(stats, 'critChance')),
    dodgeChance: Math.min(30, calculateAttribute(stats, 'dodgeChance')),
    maxHp: calculateAttribute(stats, 'maxHp'),
    maxMana: calculateAttribute(stats, 'maxMana'),
    healBonus: calculateAttribute(stats, 'healBonus'),
    initiative: calculateAttribute(stats, 'initiative')
  }
}

/**
 * 每级所需经验值表
 * @type {Record<number, number>}
 */
export const LEVEL_EXP_REQUIREMENTS: Record<number, number> = {
  1: 0,
  2: 100,
  3: 250,
  4: 450,
  5: 700,
  6: 1000,
  7: 1350,
  8: 1750,
  9: 2200,
  10: 2700,
  11: 3250,
  12: 3850,
  13: 4500,
  14: 5200,
  15: 5950,
  16: 6750,
  17: 7600,
  18: 8500,
  19: 9450,
  20: 10450
}

/**
 * 获取指定等级所需的经验值
 * @param {number} level - 目标等级
 * @returns {number} 升级到该等级所需的经验值
 */
export function getExpForLevel(level: number): number {
  if (level <= 1) return 0
  if (level > MAX_LEVEL) return LEVEL_EXP_REQUIREMENTS[MAX_LEVEL]
  return LEVEL_EXP_REQUIREMENTS[level] || 0
}
