/**
 * @fileoverview 战斗相关配置常量
 * @description 集中管理伤害计算、逃跑判定、Boss 出场等战斗公式中的可调参数。
 *              将原本散落在 pipeline.ts / service.ts / store.ts 中的魔法数字提取至此，
 *              便于统一调整与维护，避免数值散落各处导致口径不一致。
 */

// ==================== 伤害计算参数 ====================

/**
 * 基础伤害系数
 *
 * 基础伤害 = floor(攻击属性 * 该系数) + floor(random * 伤害随机范围)。
 * 表示攻击属性转化为基础伤害的比例（0~1 之间的小数）。
 *
 * @see src/modules/combat/effects/pipeline.ts calcBaseDamage
 */
export const DAMAGE_BASE_COEFFICIENT = 0.4;

/**
 * 伤害随机范围
 *
 * 基础伤害的随机浮动上限（整数，floor 后加到基础伤害上），模拟伤害的轻微随机性。
 *
 * @see src/modules/combat/effects/pipeline.ts calcBaseDamage
 */
export const DAMAGE_RANDOM_RANGE = 10;

/**
 * 防御减伤系数
 *
 * 防御方减伤量 = min(floor(基础伤害 * 该系数), 防御属性)。
 * 表示基础伤害中被防御属性抵扣的比例上限（0~1 之间的小数）。
 *
 * @see src/modules/combat/effects/pipeline.ts calcBaseDamage
 */
export const DEFENSE_REDUCTION_COEFFICIENT = 0.3;

// ==================== 暴击参数 ====================

/**
 * 暴击伤害倍率
 *
 * 暴击时最终伤害 = floor(管线最终伤害 × 该倍率)。
 * 该倍率同时作用于荆棘反伤（与玩家伤害保持口径一致，见 QA-12 / P2-2）。
 *
 * @see src/modules/combat/composables/helpers/critCalc.ts rollPlayerCrit / computeThornsDamage
 */
export const CRIT_DAMAGE_MULTIPLIER = 1.5;

// ==================== 逃跑判定参数 ====================

/**
 * 逃跑基础成功率
 *
 * 逃跑成功率 = 该基础值 + 敏捷 * 敏捷系数。
 * 表示敏捷为 0 时的初始逃跑成功率（0~1 之间的小数）。
 *
 * @see src/modules/combat/service.ts calculateFleeChance
 */
export const FLEE_BASE_CHANCE = 0.5;

/**
 * 敏捷对逃跑成功率的影响系数
 *
 * 每点敏捷为逃跑成功率增加的数值（0~1 之间的小数，0.01 表示每点敏捷 +1%）。
 *
 * @see src/modules/combat/service.ts calculateFleeChance
 */
export const FLEE_DEX_COEFFICIENT = 0.01;

// ==================== Boss 出场参数 ====================

/**
 * Boss 出场事件触发延迟（毫秒）
 *
 * 战斗开始后，Boss 出场动画/事件在战斗 UI 就绪后的延迟触发时间。
 * 设置延迟是为了避免与战斗开始事件的 UI 渲染冲突。
 *
 * 注意：startCombat 中设置该定时器后，会在 endCombat 中 clearTimeout，
 * 以防止战斗在延迟期间结束仍触发 Boss 出场事件（CODE-62 修复）。
 *
 * @see src/modules/combat/store.ts startCombat / endCombat
 */
export const BOSS_INTRO_DELAY = 300;

// ==================== AI 策略参数 ====================

/**
 * 激进型策略使用技能的概率
 *
 * @see src/modules/combat/ai/strategies.ts AggressiveStrategy
 */
export const AGGRESSIVE_SKILL_CHANCE = 0.5;

/**
 * 防御型策略 HP 低于该阈值时优先生命恢复（0~1 之间的小数）
 *
 * @see src/modules/combat/ai/strategies.ts DefensiveStrategy
 */
export const DEFENSIVE_HEAL_HP_THRESHOLD = 0.4;

/**
 * 防御型策略使用技能的概率
 *
 * @see src/modules/combat/ai/strategies.ts DefensiveStrategy
 */
export const DEFENSIVE_SKILL_CHANCE = 0.2;

/**
 * 均衡型策略 HP 低于该阈值时考虑生命恢复（0~1 之间的小数）
 *
 * @see src/modules/combat/ai/strategies.ts BalancedStrategy
 */
export const BALANCED_HEAL_HP_THRESHOLD = 0.5;

/**
 * 均衡型策略生命恢复触发概率
 *
 * @see src/modules/combat/ai/strategies.ts BalancedStrategy
 */
export const BALANCED_HEAL_CHANCE = 0.6;

/**
 * 均衡型策略使用技能的概率
 *
 * @see src/modules/combat/ai/strategies.ts BalancedStrategy
 */
export const BALANCED_SKILL_CHANCE = 0.3;

/**
 * Boss 狂暴阶段 HP 阈值（低于此值必定使用技能）
 *
 * @see src/modules/combat/ai/strategies.ts BossPhaseStrategy
 */
export const BOSS_ENRAGE_HP_THRESHOLD = 0.2;

/**
 * Boss 半血阶段 HP 阈值（低于此值进入半血激进模式）
 *
 * @see src/modules/combat/ai/strategies.ts BossPhaseStrategy
 */
export const BOSS_HALF_HP_THRESHOLD = 0.5;

/**
 * Boss 半血阶段生命恢复概率
 *
 * @see src/modules/combat/ai/strategies.ts BossPhaseStrategy
 */
export const BOSS_HALF_HEAL_CHANCE = 0.2;

/**
 * Boss 半血阶段使用技能的概率
 *
 * @see src/modules/combat/ai/strategies.ts BossPhaseStrategy
 */
export const BOSS_HALF_SKILL_CHANCE = 0.6;

/**
 * Boss 正常血量阶段使用技能的概率
 *
 * @see src/modules/combat/ai/strategies.ts BossPhaseStrategy
 */
export const BOSS_NORMAL_SKILL_CHANCE = 0.3;
