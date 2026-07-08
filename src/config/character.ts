/**
 * 角色相关配置
 *
 * 包含最大等级、属性名称映射、升级经验表等角色核心配置常量。
 */

/**
 * 玩家可达到的最大等级
 */
export const MAX_LEVEL = 20;

/**
 * 单属性数值上限（核心属性最高不超过此值）
 */
export const MAX_STAT = 999;

/**
 * 主属性名称映射表
 */
export const STAT_NAMES = {
  str: '力量',
  dex: '敏捷',
  con: '体质',
  int: '智力',
  wis: '感知',
  cha: '魅力'
} as const;

/**
 * 每级所需经验值表
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
};

// ============================================================================
// 衍生属性公式系数
// ============================================================================
// 所有衍生属性计算公式的基数与系数集中于此，便于数值平衡调整与单测定位。
// 对应实现见 src/utils/calculations.ts。

/**
 * 最大生命值公式系数
 * 公式：HP_BASE + con * HP_CON_COEFFICIENT
 */
export const HP_BASE = 100;
export const HP_CON_COEFFICIENT = 10;

/**
 * 最大法力值公式系数
 * 公式：MP_BASE + int * MP_INT_COEFFICIENT + wis * MP_WIS_COEFFICIENT + cha * MP_CHA_COEFFICIENT
 */
export const MP_BASE = 50;
export const MP_INT_COEFFICIENT = 5;
export const MP_WIS_COEFFICIENT = 3;
export const MP_CHA_COEFFICIENT = 2;

/**
 * 物理攻击力公式系数
 * 公式：floor(str * PATTACK_STR_COEFFICIENT + dex * PATTACK_DEX_COEFFICIENT)
 */
export const PATTACK_STR_COEFFICIENT = 2;
export const PATTACK_DEX_COEFFICIENT = 0.5;

/**
 * 物理防御力公式系数
 * 公式：floor(con * PDEF_CON_COEFFICIENT + dex * PDEF_DEX_COEFFICIENT)
 */
export const PDEF_CON_COEFFICIENT = 1.5;
export const PDEF_DEX_COEFFICIENT = 0.3;

/**
 * 魔法攻击力公式系数
 * 公式：floor(int * MATTACK_INT_COEFFICIENT + wis * MATTACK_WIS_COEFFICIENT + cha * MATTACK_CHA_COEFFICIENT)
 */
export const MATTACK_INT_COEFFICIENT = 2;
export const MATTACK_WIS_COEFFICIENT = 0.5;
export const MATTACK_CHA_COEFFICIENT = 0.3;

/**
 * 魔法防御力公式系数
 * 公式：floor(wis * MDEF_WIS_COEFFICIENT + int * MDEF_INT_COEFFICIENT + cha * MDEF_CHA_COEFFICIENT)
 */
export const MDEF_WIS_COEFFICIENT = 1.5;
export const MDEF_INT_COEFFICIENT = 0.5;
export const MDEF_CHA_COEFFICIENT = 0.3;

/**
 * 暴击率公式系数
 * 公式：min(CRIT_CHANCE_CAP, floor(dex * CRIT_DEX_COEFFICIENT))
 */
export const CRIT_CHANCE_CAP = 50;
export const CRIT_DEX_COEFFICIENT = 0.5;

/**
 * 闪避率公式系数
 * 公式：min(DODGE_CHANCE_CAP, floor(dex * DODGE_DEX_COEFFICIENT))
 */
export const DODGE_CHANCE_CAP = 30;
export const DODGE_DEX_COEFFICIENT = 0.3;

/**
 * 每级生命值加成系数
 * 公式：con * HP_BONUS_CON_COEFFICIENT
 */
export const HP_BONUS_CON_COEFFICIENT = 2;

/**
 * 生命恢复加成系数
 * 公式：floor(wis * HEAL_WIS_COEFFICIENT + cha * HEAL_CHA_COEFFICIENT)
 */
export const HEAL_WIS_COEFFICIENT = 0.1;
export const HEAL_CHA_COEFFICIENT = 0.05;