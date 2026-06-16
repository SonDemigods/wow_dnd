/**
 * @fileoverview 计算函数模块
 * @description 包含属性计算和升级经验查询函数
 * @module utils/calculations
 */

import type { Stats } from '@/modules/character/types';
import { MAX_LEVEL, LEVEL_EXP_REQUIREMENTS } from '@/config/character';

/**
 * 计算最大生命值
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 最大生命值
 */
export function calculateMaxHp(stats: Stats): number {
  const con = stats.con || 10;
  return 100 + con * 10;
}

/**
 * 计算最大魔法值
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 最大魔法值
 */
export function calculateMaxMana(stats: Stats): number {
  const int = stats.int || 10;
  const wis = stats.wis || 10;
  const cha = stats.cha || 10;
  return 50 + int * 5 + wis * 3 + cha * 2;
}

/**
 * 计算物理攻击力
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 物理攻击力
 */
export function calculatePhysicalAttack(stats: Stats): number {
  const str = stats.str || 10;
  const dex = stats.dex || 10;
  return Math.floor(str * 2 + dex * 0.5);
}

/**
 * 计算物理防御力
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 物理防御力
 */
export function calculatePhysicalDefense(stats: Stats): number {
  const con = stats.con || 10;
  const dex = stats.dex || 10;
  return Math.floor(con * 1.5 + dex * 0.3);
}

/**
 * 计算魔法攻击力
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 魔法攻击力
 */
export function calculateMagicAttack(stats: Stats): number {
  const int = stats.int || 10;
  const wis = stats.wis || 10;
  const cha = stats.cha || 10;
  return Math.floor(int * 2 + wis * 0.5 + cha * 0.3);
}

/**
 * 计算魔法防御力
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 魔法防御力
 */
export function calculateMagicDefense(stats: Stats): number {
  const wis = stats.wis || 10;
  const int = stats.int || 10;
  const cha = stats.cha || 10;
  return Math.floor(wis * 1.5 + int * 0.5 + cha * 0.3);
}

/**
 * 计算暴击率 (%)
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 暴击率百分比
 */
export function calculateCritChance(stats: Stats): number {
  const dex = stats.dex || 10;
  return Math.min(50, Math.floor(dex * 0.5));
}

/**
 * 计算闪避率 (%)
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 闪避率百分比
 */
export function calculateDodgeChance(stats: Stats): number {
  const dex = stats.dex || 10;
  return Math.min(30, Math.floor(dex * 0.3));
}

/**
 * 计算每级HP加成
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 每级HP加成
 */
export function calculateHpBonus(stats: Stats): number {
  const con = stats.con || 10;
  return con * 2;
}

/**
 * 计算每级MP加成
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 每级MP加成
 */
export function calculateMpBonus(stats: Stats): number {
  const int = stats.int || 10;
  const wis = stats.wis || 10;
  const cha = stats.cha || 10;
  return int + wis + cha;
}

/**
 * 计算生命恢复加成
 * @param {Stats} stats - 角色主属性对象
 * @returns {number} 生命恢复加成
 */
export function calculateHealBonus(stats: Stats): number {
  const wis = stats.wis || 10;
  const cha = stats.cha || 10;
  return Math.floor(wis * 0.1 + cha * 0.05);
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
 * @returns {number} .healBonus - 生命恢复加成
 * @returns {number} .hpBonus - 每级HP加成
 * @returns {number} .mpBonus - 每级MP加成
 */
export function calculateAllAttributes(stats: Stats) {
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
    hpBonus: calculateHpBonus(stats),
    mpBonus: calculateMpBonus(stats)
  };
}

/**
 * 获取指定等级所需的经验值
 * @param {number} level - 目标等级
 * @returns {number} 升级到该等级所需的经验值
 */
export function getExpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level > MAX_LEVEL) return LEVEL_EXP_REQUIREMENTS[MAX_LEVEL];
  return LEVEL_EXP_REQUIREMENTS[level] || 0;
}
