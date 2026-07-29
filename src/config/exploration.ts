/**
 * 探索模块配置常量
 *
 * 集中定义探索模块使用的所有数值常量，避免在 service.ts / store.ts 中硬编码魔法数字。
 * 修改游戏平衡性参数时只需调整本文件，无需改动业务逻辑。
 *
 * 涵盖：网格尺寸、事件概率分布、营地恢复、陷阱伤害、随机事件效果、
 * 物品池构建、多选项事件触发、隐藏房间数量、兜底奖励等。
 */

// ==================== 网格生成 ====================

/** 网格默认尺寸（10×10 的二维网格） */
export const GRID_SIZE = 10;

// ==================== 事件概率分布（computeEventProbability） ====================
// 各事件类型在网格生成时的出现概率（百分比），由区域等级动态计算。
// 归一化后五项之和恒为 100。

/** 怪物事件概率基础值（最终概率 = min(MAX, BASE + LEVEL_COEFF × avgLevel)） */
export const MONSTER_PROBABILITY_BASE = 20;
/** 怪物事件概率随等级提升系数（每级增加的百分比） */
export const MONSTER_PROBABILITY_LEVEL_COEFFICIENT = 1;
/** 怪物事件概率上限（百分比） */
export const MONSTER_PROBABILITY_MAX = 30;

/** 物品事件概率基础值（最终概率 = max(MIN, BASE - LEVEL_COEFF × avgLevel)） */
export const ITEM_PROBABILITY_BASE = 25;
/** 物品事件概率随等级下降系数（每级减少的百分比） */
export const ITEM_PROBABILITY_LEVEL_COEFFICIENT = 1;
/** 物品事件概率下限（百分比） */
export const ITEM_PROBABILITY_MIN = 15;

/** 陷阱事件概率基础值 */
export const TRAP_PROBABILITY_BASE = 12;
/** 陷阱事件概率随等级提升系数 */
export const TRAP_PROBABILITY_LEVEL_COEFFICIENT = 1;
/** 陷阱事件概率上限（百分比） */
export const TRAP_PROBABILITY_MAX = 22;

/** 随机事件固定概率（百分比，不随等级变化） */
export const EVENT_PROBABILITY = 15;

/** 空事件概率基础值（P3-133 修复：原值 30 导致五项基础值之和为 102，调整为 28 使总和等于归一化基数 100） */
export const EMPTY_PROBABILITY_BASE = 28;
/** 空事件概率随等级下降系数 */
export const EMPTY_PROBABILITY_LEVEL_COEFFICIENT = 1;
/** 空事件概率下限（百分比） */
export const EMPTY_PROBABILITY_MIN = 15;

/** 概率归一化基数（各项百分比之和的目标值） */
export const PROBABILITY_NORMALIZATION_BASE = 100;

// P3-133 修复：开发期聚合校验概率常量合法性
if (import.meta.env.DEV) {
  const _probBaseSum =
    MONSTER_PROBABILITY_BASE +
    ITEM_PROBABILITY_BASE +
    TRAP_PROBABILITY_BASE +
    EVENT_PROBABILITY +
    EMPTY_PROBABILITY_BASE;
  if (_probBaseSum !== PROBABILITY_NORMALIZATION_BASE) {
    console.warn(
      `[exploration config] 概率基础值之和 (${_probBaseSum}) 不等于归一化基数 (${PROBABILITY_NORMALIZATION_BASE})，` +
      `可能导致归一化后概率分布异常`
    );
  }
}

// ==================== 营地恢复（generateCampHeal） ====================

// P3-132 修复：原值 9999 为魔法数字，改用 Number.MAX_SAFE_INTEGER 表示"完全恢复"，
// 由角色上限（maxHp / maxMana）自然裁剪，避免硬编码上限被未来数值突破。
/** 营地恢复 HP（标记为完全恢复的大数值，由角色上限裁剪） */
export const CAMP_HEAL_HP = Number.MAX_SAFE_INTEGER;
/** 营地恢复 MP（标记为完全恢复的大数值，由角色上限裁剪） */
export const CAMP_HEAL_MANA = Number.MAX_SAFE_INTEGER;

// ==================== 陷阱伤害（generateTrapDamage） ====================

/** 陷阱基础伤害系数（baseDamage = areaLevel × 此值） */
export const TRAP_DAMAGE_BASE = 5;
/** 陷阱伤害波动范围（伤害在 ±variance/2 之间随机） */
export const TRAP_DAMAGE_VARIANCE = 10;
/** 陷阱伤害最小值（最终伤害不低于此值） */
export const TRAP_DAMAGE_MIN = 1;

// ==================== 随机事件概率阈值（generateRandomEvent） ====================
// 采用累进概率区间分布：每个分支检查 [0, 1) 中的特定区间，区间大小即为该事件的触发概率。
// 分支按概率从高到低排列，最后一个分支作为兜底。

/** 随机事件恢复生命概率上限（[0, 0.3) → 30% 概率） */
export const RANDOM_EVENT_HEAL_THRESHOLD = 0.3;
/** 随机事件恢复法力概率上限（[0.3, 0.5) → 20% 概率） */
export const RANDOM_EVENT_MANA_THRESHOLD = 0.5;
/** 随机事件获得经验概率上限（[0.5, 0.65) → 15% 概率） */
export const RANDOM_EVENT_EXP_THRESHOLD = 0.65;
/** 随机事件受伤概率上限（[0.65, 0.8) → 15% 概率） */
export const RANDOM_EVENT_DAMAGE_THRESHOLD = 0.8;
/** 随机事件损失法力概率上限（[0.8, 0.9) → 10% 概率） */
export const RANDOM_EVENT_MP_LOSS_THRESHOLD = 0.9;
// 金币事件为兜底分支 [0.9, 1.0) → 10% 概率

// ==================== 随机事件效果数值（generateRandomEvent） ====================

/** 随机事件恢复生命：等级系数（amount = areaLevel × 此值 + random(0, MAX)） */
export const HEAL_AMOUNT_LEVEL_COEFFICIENT = 3;
/** 随机事件恢复生命：随机加成上限 */
export const HEAL_AMOUNT_RANDOM_MAX = 10;

/** 随机事件恢复法力：等级系数 */
export const MANA_AMOUNT_LEVEL_COEFFICIENT = 2;
/** 随机事件恢复法力：随机加成上限 */
export const MANA_AMOUNT_RANDOM_MAX = 8;

/** 随机事件经验奖励：等级系数 */
export const EXP_AMOUNT_LEVEL_COEFFICIENT = 10;
/** 随机事件经验奖励：随机加成上限 */
export const EXP_AMOUNT_RANDOM_MAX = 20;

/** 随机事件伤害：等级系数 */
export const DAMAGE_AMOUNT_LEVEL_COEFFICIENT = 2;
/** 随机事件伤害：随机加成上限 */
export const DAMAGE_AMOUNT_RANDOM_MAX = 5;

/** 随机事件法力损失：等级系数 */
export const MP_LOSS_LEVEL_COEFFICIENT = 1.5;
/** 随机事件法力损失：随机加成上限 */
export const MP_LOSS_RANDOM_MAX = 5;

/** 随机事件金币奖励：等级系数 */
export const GOLD_AMOUNT_LEVEL_COEFFICIENT = 5;
/** 随机事件金币奖励：随机加成上限 */
export const GOLD_AMOUNT_RANDOM_MAX = 15;

// ==================== 多选项事件触发概率（handleRandomEventTriggered） ====================

/** 多选项事件触发概率（30% 概率生成多选项事件，否则生成普通随机事件） */
export const MULTI_OPTION_EVENT_PROBABILITY = 0.3;

// ==================== 物品池构建（buildItemPool） ====================

/** 物品池默认最大数量 */
export const ITEM_POOL_DEFAULT_MAX_SIZE = 5;
/** 物品池为空时的兜底物品 ID */
export const ITEM_POOL_FALLBACK_ID = 'small_health_potion';

/** 稀有度等级映射（用于推算物品等级） */
export const RARITY_LEVEL_MAP: Record<string, number> = {
  common: 1,
  uncommon: 3,
  rare: 5,
  epic: 7
};

// ==================== 隐藏房间（markHiddenRooms） ====================

/** 隐藏房间数量下限 */
export const HIDDEN_ROOM_MIN_COUNT = 2;
/** 隐藏房间数量上限 */
export const HIDDEN_ROOM_MAX_COUNT = 3;

// ==================== 兜底奖励（grantFallbackReward） ====================

/** 兜底金币最小值（结果 = random(0, MAX) + MIN） */
export const FALLBACK_GOLD_MIN = 5;
/** 兜底金币随机范围上限 */
export const FALLBACK_GOLD_RANDOM_RANGE = 30;
/** 兜底经验最小值 */
export const FALLBACK_EXP_MIN = 3;
/** 兜底经验随机范围上限 */
export const FALLBACK_EXP_RANDOM_RANGE = 15;
