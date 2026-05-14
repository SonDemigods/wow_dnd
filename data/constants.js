/**
 * 游戏常量定义
 */

const MAX_LEVEL = 20;

const STAT_NAMES = {
  str: '力量',
  dex: '敏捷',
  con: '体质',
  int: '智力',
  wis: '感知',
  cha: '魅力'
};

const ATTRIBUTE_BONUSES = {
  physicalAttack: { stat: 'str', mult: 2, base: 5 },
  physicalDefense: { stat: 'con', mult: 1.5, base: 3 },
  magicAttack: { stat: 'int', mult: 2, base: 5 },
  magicDefense: { stat: 'wis', mult: 1.5, base: 3 },
  critChance: { stat: 'dex', mult: 0.5, base: 5 },
  dodgeChance: { stat: 'dex', mult: 0.4, base: 3 },
  maxHp: { stat: 'con', mult: 10, base: 20 },
  maxMana: { stat: 'int', mult: 8, base: 15 }
};

const LEVEL_EXP_REQUIREMENTS = {
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
};

function calculateAttribute(stats, attrKey) {
  const bonus = ATTRIBUTE_BONUSES[attrKey];
  if (!bonus) return 0;
  const statValue = stats[bonus.stat] || 10;
  return Math.floor(bonus.base + (statValue - 10) / 2 * bonus.mult);
}

function calculateAllAttributes(stats) {
  return {
    physicalAttack: calculateAttribute(stats, 'physicalAttack'),
    physicalDefense: calculateAttribute(stats, 'physicalDefense'),
    magicAttack: calculateAttribute(stats, 'magicAttack'),
    magicDefense: calculateAttribute(stats, 'magicDefense'),
    critChance: Math.min(50, calculateAttribute(stats, 'critChance')),
    dodgeChance: Math.min(30, calculateAttribute(stats, 'dodgeChance')),
    maxHp: calculateAttribute(stats, 'maxHp'),
    maxMana: calculateAttribute(stats, 'maxMana')
  };
}
