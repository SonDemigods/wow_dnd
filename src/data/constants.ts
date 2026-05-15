export const MAX_LEVEL = 20

export const STAT_NAMES = {
  str: '力量',
  dex: '敏捷',
  con: '体质',
  int: '智力',
  wis: '感知',
  cha: '魅力'
} as const

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

import type { Stats } from '../types'

export function calculateAttribute(stats: Stats, attrKey: keyof typeof ATTRIBUTE_BONUSES): number {
  const bonus = ATTRIBUTE_BONUSES[attrKey]
  if (!bonus) return 0
  const statValue = stats[bonus.stat as keyof Stats] || 10
  return Math.floor(bonus.base + (statValue - 10) / 2 * bonus.mult)
}

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

export function getExpForLevel(level: number): number {
  if (level <= 1) return 0
  if (level > MAX_LEVEL) return LEVEL_EXP_REQUIREMENTS[MAX_LEVEL]
  return LEVEL_EXP_REQUIREMENTS[level] || 0
}
