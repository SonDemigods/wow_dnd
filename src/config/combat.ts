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

/**
 * 治疗暴击倍率
 *
 * 治疗暴击时最终治疗量 = floor(基础治疗 × 该倍率)。
 * P4-017 修复：从 CRIT_DAMAGE_MULTIPLIER 独立出来，便于单独调整治疗暴击强度。
 *
 * @see src/modules/combat/composables/usePlayerSkill.ts 治疗分支
 */
export const HEAL_CRIT_MULTIPLIER = 1.5;

/**
 * 防御修正参数
 *
 * P4-014 修复：承伤倍率上限与易伤系数提取为配置常量
 */

/**
 * 承伤倍率上限（defense_down/vulnerable 的 getDefenderDamageMod 结果不超过此值）
 *
 * 防止极端减益叠加导致承伤倍率无限放大。
 *
 * @see src/modules/combat/effects/handlers/defenseMod.ts
 */
export const DAMAGE_TAKEN_MOD_MAX = 3.0;

/**
 * 易伤（vulnerable）额外承伤系数
 *
 * vulnerable 的承伤倍率 = 1 + value * 该系数 / 100
 * 该系数 > 1 表示易伤比降防更严重（原硬编码 1.5）。
 *
 * @see src/modules/combat/effects/handlers/defenseMod.ts vulnerableHandler
 */
export const VULNERABLE_DAMAGE_COEFFICIENT = 1.5;

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

// ==================== P3-162 新增 AI 参数 ====================

/**
 * 激进型策略使用 buff 技能的概率
 *
 * @see src/modules/combat/ai/strategies.ts AggressiveStrategy
 */
export const AGGRESSIVE_BUFF_CHANCE = 0.10;

/**
 * 防御型策略使用 buff 技能的概率
 *
 * @see src/modules/combat/ai/strategies.ts DefensiveStrategy
 */
export const DEFENSIVE_BUFF_CHANCE = 0.25;

/**
 * 防御型策略进入防御姿态的 HP 阈值（高于此值时考虑防御）
 *
 * @see src/modules/combat/ai/strategies.ts DefensiveStrategy
 */
export const DEFENSIVE_DEFEND_HP_THRESHOLD = 0.60;

/**
 * 防御型策略高血量时防御概率
 *
 * @see src/modules/combat/ai/strategies.ts DefensiveStrategy
 */
export const DEFENSIVE_DEFEND_CHANCE = 0.20;

/**
 * 防御型策略中血量时防御概率
 *
 * @see src/modules/combat/ai/strategies.ts DefensiveStrategy
 */
export const DEFENSIVE_DEFEND_CHANCE_LOW_HP = 0.25;

/**
 * 均衡型策略使用 buff 技能的概率
 *
 * @see src/modules/combat/ai/strategies.ts BalancedStrategy
 */
export const BALANCED_BUFF_CHANCE = 0.15;

/**
 * 均衡型策略防御概率
 *
 * @see src/modules/combat/ai/strategies.ts BalancedStrategy
 */
export const BALANCED_DEFEND_CHANCE = 0.10;

/**
 * Boss 正常阶段使用 buff 技能的概率
 *
 * @see src/modules/combat/ai/strategies.ts BossPhaseStrategy
 */
export const BOSS_BUFF_CHANCE = 0.15;

/**
 * Boss 半血阶段使用 buff 技能的概率
 *
 * @see src/modules/combat/ai/strategies.ts BossPhaseStrategy
 */
export const BOSS_HALF_BUFF_CHANCE = 0.20;

/**
 * 防御姿态提供的防御加成
 *
 * @see src/modules/combat/composables/useEnemyAction.ts defend case
 */
export const DEFEND_DEFENSE_BONUS = 10;

/**
 * 防御姿态持续回合数
 *
 * @see src/modules/combat/composables/useEnemyAction.ts defend case
 */
export const DEFEND_DURATION_TURNS = 2;

// ==================== Boss 机制参数 ====================

/**
 * Boss 反击伤害倍率（相对于玩家造成的伤害）
 *
 * @see src/modules/combat/composables/useBossMechanics.ts applyBossCounterMechanics
 */
export const BOSS_COUNTER_DAMAGE_RATIO = 0.5;

/**
 * Boss 复活时恢复的生命值比例
 *
 * @see src/modules/combat/composables/useBossMechanics.ts checkBossRevive
 */
export const BOSS_REVIVE_HP_RATIO = 0.5;

/**
 * Boss 效果缩放步进系数（按等级线性增长）
 *
 * 效果值 = floor(baseValue × (1 + (level-1) × 该系数))
 *
 * @see src/modules/combat/composables/useBossMechanics.ts scaleBossEffectValue
 */
export const BOSS_EFFECT_SCALE_STEP = 0.08;

// ==================== 被动技能参数 ====================

/**
 * 低血量被动触发阈值（生命百分比低于此值时触发 on_low_hp 被动）
 *
 * P9-070 修复：从 usePassiveSkills.checkLowHpPassives 硬编码 0.3 提取为配置常量。
 *
 * @see src/modules/combat/composables/usePassiveSkills.ts checkLowHpPassives
 */
export const LOW_HP_PASSIVE_THRESHOLD = 0.3;

// ==================== 敌人治疗参数 ====================

/**
 * 敌人治疗技能恢复量占最大生命值的比例
 *
 * P9-088 修复：敌人 useSkill 治疗量原基于物理攻击力，改为基于最大生命值比例，
 * 使治疗量与敌人生命池匹配，避免低攻击力敌人治疗效果微乎其微。
 *
 * @see src/modules/enemy/store.ts useSkill 治疗分支
 */
export const ENEMY_HEAL_HP_RATIO = 0.15;

// ==================== 先攻排序参数 ====================

/**
 * 先攻排序中敌人速度缺失时的默认值
 *
 * P7-007 修复：统一玩家与敌人的默认速度基准，避免不一致。
 *
 * @see src/modules/combat/composables/useInitiative.ts buildInitiativeOrder
 */
export const INITIATIVE_DEFAULT_SPEED = 5;

// ==================== 控制台命令参数 ====================

/**
 * kill 命令造成的伤害值
 *
 * 控制台 kill 命令对当前敌人造成的伤害量，设置为足够大的值以确保一击必杀。
 *
 * P8-301 修复：从 combat.ts 硬编码 99999 提取为配置常量。
 *
 * @see src/modules/console/commands/combat.ts kill 命令
 */
export const CONSOLE_KILL_DAMAGE = 99999;
