/**
 * @fileoverview 计算函数模块
 * @description 包含属性计算和升级经验查询函数
 * @module utils/calculations
 */

import type { Stats } from '@/modules/character/types';
import {
  MAX_LEVEL,
  LEVEL_EXP_REQUIREMENTS,
  type Level,
  HP_BASE,
  HP_CON_COEFFICIENT,
  MP_BASE,
  MP_INT_COEFFICIENT,
  MP_WIS_COEFFICIENT,
  MP_CHA_COEFFICIENT,
  PATTACK_STR_COEFFICIENT,
  PATTACK_DEX_COEFFICIENT,
  PDEF_CON_COEFFICIENT,
  PDEF_DEX_COEFFICIENT,
  MATTACK_INT_COEFFICIENT,
  MATTACK_WIS_COEFFICIENT,
  MATTACK_CHA_COEFFICIENT,
  MDEF_WIS_COEFFICIENT,
  MDEF_INT_COEFFICIENT,
  MDEF_CHA_COEFFICIENT,
  CRIT_CHANCE_CAP,
  CRIT_DEX_COEFFICIENT,
  DODGE_CHANCE_CAP,
  DODGE_DEX_COEFFICIENT,
  HEAL_WIS_COEFFICIENT,
  HEAL_CHA_COEFFICIENT
} from '@/config/character';

/**
 * 计算最大生命值
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 最大生命值
 */
export function calculateMaxHp(stats: Stats): number {
  return HP_BASE + stats.con * HP_CON_COEFFICIENT;
}

/**
 * 计算最大魔法值
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 最大魔法值
 */
export function calculateMaxMana(stats: Stats): number {
  return MP_BASE
    + stats.int * MP_INT_COEFFICIENT
    + stats.wis * MP_WIS_COEFFICIENT
    + stats.cha * MP_CHA_COEFFICIENT;
}

/**
 * 计算物理攻击力
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 物理攻击力
 */
export function calculatePhysicalAttack(stats: Stats): number {
  return Math.floor(stats.str * PATTACK_STR_COEFFICIENT + stats.dex * PATTACK_DEX_COEFFICIENT);
}

/**
 * 计算物理防御力
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 物理防御力
 */
export function calculatePhysicalDefense(stats: Stats): number {
  return Math.floor(stats.con * PDEF_CON_COEFFICIENT + stats.dex * PDEF_DEX_COEFFICIENT);
}

/**
 * 计算魔法攻击力
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 魔法攻击力
 */
export function calculateMagicAttack(stats: Stats): number {
  return Math.floor(
    stats.int * MATTACK_INT_COEFFICIENT
    + stats.wis * MATTACK_WIS_COEFFICIENT
    + stats.cha * MATTACK_CHA_COEFFICIENT
  );
}

/**
 * 计算魔法防御力
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 魔法防御力
 */
export function calculateMagicDefense(stats: Stats): number {
  return Math.floor(
    stats.wis * MDEF_WIS_COEFFICIENT
    + stats.int * MDEF_INT_COEFFICIENT
    + stats.cha * MDEF_CHA_COEFFICIENT
  );
}

/**
 * 计算暴击率 (%)
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 暴击率百分比
 */
export function calculateCritChance(stats: Stats): number {
  return Math.min(CRIT_CHANCE_CAP, Math.floor(stats.dex * CRIT_DEX_COEFFICIENT));
}

/**
 * 计算闪避率 (%)
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 闪避率百分比
 */
export function calculateDodgeChance(stats: Stats): number {
  return Math.min(DODGE_CHANCE_CAP, Math.floor(stats.dex * DODGE_DEX_COEFFICIENT));
}

/**
 * 计算每级MP加成
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 每级MP加成
 */
export function calculateMpBonus(stats: Stats): number {
  return stats.int + stats.wis + stats.cha;
}

/**
 * 计算生命恢复加成
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 生命恢复加成
 */
export function calculateHealBonus(stats: Stats): number {
  return Math.floor(stats.wis * HEAL_WIS_COEFFICIENT + stats.cha * HEAL_CHA_COEFFICIENT);
}

/**
 * 所有衍生属性集合
 *
 * P3-131 修复：显式声明返回类型，便于消费方引用精确类型。
 */
export interface Attributes {
  physicalAttack: number;
  physicalDefense: number;
  magicAttack: number;
  magicDefense: number;
  critChance: number;
  dodgeChance: number;
  maxHp: number;
  maxMana: number;
  healBonus: number;
  mpBonus: number;
}

/**
 * 计算所有衍生属性
 * @param {Stats} stats - 角色主属性对象
 * @returns {Attributes} 包含所有衍生属性的对象
 */
export function calculateAllAttributes(stats: Stats): Attributes {
  return {
    physicalAttack: calculatePhysicalAttack(stats),
    physicalDefense: calculatePhysicalDefense(stats),
    magicAttack: calculateMagicAttack(stats),
    magicDefense: calculateMagicDefense(stats),
    critChance: calculateCritChance(stats),
    dodgeChance: calculateDodgeChance(stats),
    maxHp: calculateMaxHp(stats),
    maxMana: calculateMaxMana(stats),
    healBonus: calculateHealBonus(stats),
    mpBonus: calculateMpBonus(stats)
  };
}

/**
 * 获取指定等级所需的经验值
 *
 * P3-130 修复：LEVEL_EXP_REQUIREMENTS 键类型收窄为 `Level`（1~20），
 * 此处通过边界检查后用类型断言访问，保证不会越界。
 * @param {number} level - 目标等级
 * @returns {number} 升级到该等级所需的经验值
 */
export function getExpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level > MAX_LEVEL) return LEVEL_EXP_REQUIREMENTS[MAX_LEVEL];
  return LEVEL_EXP_REQUIREMENTS[level as Level] ?? 0;
}
