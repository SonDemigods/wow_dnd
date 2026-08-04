/**
 * 角色相关配置
 *
 * 包含最大等级、属性名称映射、升级经验表等角色核心配置常量。
 */

/**
 * 玩家可达到的最大等级
 *
 * 使用 `as const` 使类型为字面量 `20`（而非 `number`），
 * 确保作为 `Level` 联合类型的成员使用时类型安全。
 */
export const MAX_LEVEL = 20 as const;

/**
 * 合法等级范围（1 ~ MAX_LEVEL）
 *
 * P3-130 修复：将 LEVEL_EXP_REQUIREMENTS 的键约束为该联合类型，
 * 编译期即可发现越界访问（如 `LEVEL_EXP_REQUIREMENTS[0]` 或 `[21]`）。
 * 消费方（getExpForLevel）在边界检查后通过类型断言访问。
 */
export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;

/**
 * 单属性数值上限（核心属性最高不超过此值）
 */
export const MAX_STAT = 999;

/**
 * 核心属性基础值（每个属性的起始固定值）
 *
 * 四层属性模型中基础层的固定起始值，与种族加成、职业加成叠加后构成 baseStats。
 * 抽取为常量供 service.computeInitialStats 与 store.statsBreakdown 共享，
 * 避免在多处硬编码字面量 10 导致规则不一致。
 *
 * @see computeInitialStats 基础值 + 种族 + 职业 → baseStats
 * @see useCharacterStore.statsBreakdown 属性来源明细中的基础层
 */
export const BASE_STAT_VALUE = 10;

// ==================== 升级点数 ====================

/**
 * 每级获得的可分配属性点数
 *
 * 四层属性模型中，角色升级不再自动全属性 +1，
 * 而是获得本常量定义的可分配点数，由玩家自由分配到 6 个核心属性。
 * 1 级角色无升级点数；升到 N 级累计获得 (N-1) * POINTS_PER_LEVEL 点。
 *
 * @see applyLevelUp 升级时累加 unallocatedPoints
 * @see allocateStat 分配 1 点到指定属性
 * @see resetAllocatedStats 重置升级层已分配点数（完全免费）
 */
export const POINTS_PER_LEVEL = 3;

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
 *
 * P3-130 修复：键类型由 `number` 收窄为 `Level`（1~20 联合类型），
 * 防止越界访问。消费方 `getExpForLevel` 通过边界检查 + 类型断言访问。
 */
export const LEVEL_EXP_REQUIREMENTS: Record<Level, number> = {
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