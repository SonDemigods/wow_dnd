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
 * @see src/modules/combat/effects/pipeline.ts calcAttackDamage
 */
export const DAMAGE_BASE_COEFFICIENT = 0.4;

/**
 * 伤害随机范围
 *
 * 基础伤害的随机浮动上限（整数，floor 后加到基础伤害上），模拟伤害的轻微随机性。
 *
 * @see src/modules/combat/effects/pipeline.ts calcAttackDamage
 */
export const DAMAGE_RANDOM_RANGE = 10;

/**
 * 物理减伤保底系数
 *
 * 物理减伤量 = max(floor(伤害 × 该系数), physicalDefense)。
 * 防御可全额生效，该系数为最低保底减免比例（0~1 之间的小数）。
 *
 * @see src/modules/combat/effects/pipeline.ts applyDefenseReduction
 */
export const PHYSICAL_DEFENSE_REDUCTION_COEFFICIENT = 0.3;

/**
 * 魔法减伤保底系数
 *
 * 魔法减伤量 = max(floor(伤害 × 该系数), magicDefense)。
 * 防御可全额生效，该系数为最低保底减免比例（0~1 之间的小数）。
 *
 * @see src/modules/combat/effects/pipeline.ts applyDefenseReduction
 */
export const MAGICAL_DEFENSE_REDUCTION_COEFFICIENT = 0.3;

/**
 * 治疗加成换算除数
 *
 * 最终治疗量 = floor(原始治疗 × (1 + healBonus / 该值))。
 * healBonus 为感知/魅力驱动的衍生值，除以该常数转换为百分比增量。
 *
 * @see src/modules/combat/composables/usePlayerSkill.ts 治疗分支
 */
export const HEAL_BONUS_DIVISOR = 100;

// ==================== 暴击参数 ====================

/**
 * 暴击伤害倍率
 *
 * 暴击时最终伤害 = floor(管线最终伤害 × 该倍率)。
 *
 * @see src/modules/combat/composables/helpers/critCalc.ts rollPlayerCrit
 */
export const CRIT_DAMAGE_MULTIPLIER = 1.5;

// ==================== AOE 伤害参数 ====================

/**
 * 玩家 AOE 技能每目标伤害占面板伤害的比例
 *
 * AOE 技能对每个目标造成的伤害 = floor(单体伤害 × 该比例)。
 * 小于 1 表示 AOE 每目标伤害低于单体技能，符合"多目标换低单价"的常规设计。
 *
 * P3-147：与敌方 AOE 倍率保持口径一致（玩家 0.7 / 敌方 0.8），避免"敌方 AOE 比普攻还猛"的设计 bug。
 *
 * @see src/modules/combat/composables/usePlayerSkill.ts applySkillDamage
 */
export const PLAYER_AOE_DAMAGE_PENALTY = 0.7;

/**
 * 敌方 AOE 攻击每目标伤害占面板伤害的比例
 *
 * P3-147 修复：原值为 1.3（敌方 AOE 比普攻猛 30%，导致 Boss 一发 AOE 团灭的挫败感）。
 * 现改为 0.8，略高于玩家 0.7 保留 Boss 威胁感，但低于 1.0 避免反向加强。
 *
 * @see src/modules/combat/composables/useEnemyAction.ts enemyAction
 */
export const ENEMY_AOE_DAMAGE_MULTIPLIER = 0.8;

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
