/**
 * @fileoverview 敌人模块类型定义
 * @description 包含敌人基础数据、敌人实例、敌人掉落、Boss 阶段/机制/出场演出等相关类型定义。
 *              本文件是 enemy 模块的类型基石，所有接口和类型别名均在此集中定义。
 * @module enemy
 */

import type { Stats } from '@/modules/character/types';

// ============================================================================
// 枚举类型
// ============================================================================

/**
 * 危险等级
 *
 * 决定敌人的基础强度与推荐挑战等级。
 * 影响经验值/金币的缩放系数以及 AI 行为倾向。
 *
 * - `普通`：基础强度，适合低等级玩家
 * - `困难`：略有挑战，需要基本装备
 * - `危险`：高威胁，建议组队或充分准备
 * - `极危险`：极高威胁，需要高级装备与策略
 * - `致命`：顶级挑战，通常为高等级 Boss
 *
 * @see EnemyData.dangerLevel 每个敌人模板均需指定一个危险等级
 */
export type DangerLevel = '普通' | '困难' | '危险' | '极危险' | '致命';

/**
 * AI 策略类型
 *
 * 决定敌人在战斗中的行为模式，控制技能选择、目标选取等逻辑。
 * Boss 可通过 `BossPhase.aiStrategy` 按阶段动态切换策略。
 *
 * - `aggressive`：激进策略，优先攻击
 * - `defensive`：防御策略，低血量时优先治疗
 * - `balanced`：平衡策略，攻防交替
 * - `boss_phase`：Boss 阶段策略，按阶段切换行为
 *
 * @see BossPhase.aiStrategy Boss 阶段可通过此类型切换 AI 行为
 * @see EnemyData.aiStrategy 普通敌人也可配置独立的 AI 策略
 */
export type AiStrategyType = 'aggressive' | 'defensive' | 'balanced' | 'boss_phase';

/**
 * Boss 出场特效类型
 *
 * 控制 Boss 战斗开始前的视觉演出效果，营造氛围并提示玩家即将进入高难度战斗。
 *
 * - `darken`：屏幕变暗
 * - `shake`：屏幕震动
 * - `flame`：火焰特效
 * - `freeze`：冰冻特效
 * - `lightning`：闪电特效
 *
 * @see BossIntro.effect 出场演出使用此类型指定特效
 * @see BossPhase.transitionEffect 阶段切换也可复用此特效类型
 */
export type BossIntroEffect = 'darken' | 'shake' | 'flame' | 'freeze' | 'lightning';

/**
 * Boss 机制类型
 *
 * 定义 Boss 战中可触发的特殊战斗机制，每个 Boss 阶段可配备多种机制。
 * 机制按 `intervalTurns` 间隔自动触发，丰富 Boss 战的策略深度。
 *
 * - `summon_minions`：召唤小怪
 * - `summon_elite`：召唤精英怪
 * - `damage_shield`：伤害护盾
 * - `invulnerable`：无敌
 * - `reflect_damage`：反弹伤害
 * - `enrage`：狂暴（提升攻击力）
 * - `aoe_attack`：范围攻击
 * - `charge_attack`：冲锋攻击
 * - `stun_player`：眩晕玩家
 * - `silence_player`：沉默玩家
 * - `debuff_aura`：减益光环
 * - `arena_hazard`：场地危险（环境伤害）
 * - `healing_zone`：治疗区域
 * - `split`：分裂
 * - `revive`：复活
 * - `steal_buff`：偷取增益
 * - `counter_stance`：反击姿态
 *
 * @see BossMechanic.type 每个机制实例需指定一个机制类型
 * @see BossPhase.mechanics Boss 阶段通过机制列表配置战斗行为
 */
export type BossMechanicType =
  | 'summon_minions' | 'summon_elite'
  | 'damage_shield' | 'invulnerable' | 'reflect_damage'
  | 'enrage' | 'aoe_attack' | 'charge_attack'
  | 'stun_player' | 'silence_player' | 'debuff_aura'
  | 'arena_hazard' | 'healing_zone'
  | 'split' | 'revive' | 'steal_buff' | 'counter_stance';

// ============================================================================
// Boss 相关接口
// ============================================================================

/**
 * Boss 出场配置接口
 *
 * 定义 Boss 登场时的演出序列，包含特效、台词和动画时长。
 * 出场演出在战斗正式开始前播放，用于增强沉浸感和叙事表达。
 *
 * @property {BossIntroEffect} effect - 出场视觉特效类型
 * @property {string[]} lines - 出场台词列表（按顺序逐条展示）
 * @property {number} duration - 动画持续时长（毫秒）
 *
 * @see EnemyData.intro 每个 Boss 级别的敌人可配置独立出场演出
 */
export interface BossIntro {
  effect: BossIntroEffect;
  lines: string[];
  duration: number;
}

/**
 * Boss 机制配置接口
 *
 * 定义单个 Boss 机制的触发规则和参数。每个阶段可包含多个机制，
 * 机制按回合间隔自动触发，通过 `params` 传递机制特定的配置参数。
 *
 * @property {BossMechanicType} type - 机制类型（决定触发后的具体行为）
 * @property {number} intervalTurns - 触发间隔（回合数，每隔 N 回合触发一次）
 * @property {number} [lastTriggerTurn] - 上次触发回合（运行时追踪用，初始为 undefined）
 * @property {Record<string, string | number>} [params] - 机制参数（支持数值和字符串配置，如召唤数量、护盾值等）
 *
 * @see BossPhase.mechanics Boss 阶段通过此接口配置阶段专属机制
 */
export interface BossMechanic {
  type: BossMechanicType;
  intervalTurns: number;
  lastTriggerTurn?: number;
  params?: Record<string, string | number>;
}

/**
 * Boss 阶段配置接口
 *
 * 定义 Boss 在不同血量阶段的战斗行为变化。当 Boss 的血量百分比达到
 * `hpThreshold` 阈值时，自动切换到对应阶段，触发台词、特效和 AI 策略变更。
 *
 * 阶段切换流程：
 * 1. 检测当前 HP 百分比是否 ≤ `hpThreshold`
 * 2. 播放 `transitionEffect` 特效和 `dialogue` 台词
 * 3. 切换 `aiStrategy` 并启用该阶段的 `mechanics` 列表
 * 4. 应用 `statMultipliers` 属性调整
 *
 * @property {number} hpThreshold - 触发该阶段的 HP 百分比阈值（0-1，如 0.5 表示半血触发）
 * @property {string} name - 阶段名称（如"第一阶段""狂暴阶段"等）
 * @property {string[]} dialogue - 阶段切换台词（按顺序逐条展示）
 * @property {BossIntroEffect} [transitionEffect] - 阶段切换特效（可选，默认无特效）
 * @property {AiStrategyType} aiStrategy - 该阶段的 AI 策略（决定技能选择和行为模式）
 * @property {BossMechanic[]} mechanics - 该阶段的机制列表（阶段切换后生效）
 * @property {object} [statMultipliers] - 属性调整乘数（如 1.5 表示属性提升 50%）
 * @property {number} [statMultipliers.physicalAttack] - 物理攻击力乘数
 * @property {number} [statMultipliers.magicAttack] - 魔法攻击力乘数
 * @property {number} [statMultipliers.physicalDefense] - 物理防御力乘数
 * @property {number} [statMultipliers.magicDefense] - 魔法防御力乘数
 *
 * @see EnemyData.phases Boss 敌人通过 phases 数组配置多阶段战斗
 * @see AiStrategyType 阶段 AI 策略的可选值
 */
export interface BossPhase {
  hpThreshold: number;
  name: string;
  dialogue: string[];
  transitionEffect?: BossIntroEffect;
  aiStrategy: AiStrategyType;
  mechanics: BossMechanic[];
  statMultipliers?: {
    physicalAttack?: number;
    magicAttack?: number;
    physicalDefense?: number;
    magicDefense?: number;
  };
}

// ============================================================================
// 核心数据接口
// ============================================================================

/**
 * 敌人数据接口
 *
 * 存储敌人的基础属性和战斗相关配置，是 enemy 模块的核心接口。
 * 兼作敌人模板（IndexedDB 读取）和运行时实例的基础类型。
 *
 * 数据来源流程：
 * 1. 敌人模板存储在 IndexedDB 的 `config_enemies` 表中
 * 2. 启动战斗时，根据模板创建 `EnemyInstance`（继承本接口并附加运行时状态）
 * 3. 普通敌人直接使用基础属性，Boss 敌人额外启用 `phases`、`intro` 等字段
 *
 * @property {string} id - 敌人模板唯一标识
 * @property {string} name - 敌人名称
 * @property {string} icon - 敌人图标（Iconify 格式）
 * @property {number} maxHp - 最大生命值
 * @property {[number, number]} damage - 伤害范围（[最小值, 最大值]，用于普攻随机伤害计算）
 * @property {number} xp - 经验值奖励（基础值，实际奖励会根据等级进行缩放）
 * @property {number} gold - 金币奖励（基础值，实际奖励会根据等级进行缩放）
 * @property {DangerLevel} dangerLevel - 危险等级（影响奖励缩放和 AI 行为）
 * @property {boolean} [isBoss] - 是否为 Boss 敌人（Boss 敌人会启用阶段机制和出场演出）
 * @property {number} [physicalAttack] - 物理攻击力（未配置时使用默认推导值）
 * @property {number} [physicalDefense] - 物理防御力（未配置时使用默认推导值）
 * @property {number} [magicAttack] - 魔法攻击力（未配置时使用默认推导值）
 * @property {number} [magicDefense] - 魔法防御力（未配置时使用默认推导值）
 * @property {number} [critChance] - 暴击率（0-1，未配置时使用默认推导值）
 * @property {number} [dodgeChance] - 闪避率（0-1，未配置时使用默认推导值）
 * @property {string[]} [skillPool] - 可用技能模板 ID 列表（AI 从此列表中选取技能施放）
 * @property {AiStrategyType} [aiStrategy] - AI 策略类型（决定技能选择和行为模式）
 * @property {BossPhase[]} [phases] - Boss 阶段配置（仅 Boss 敌人有效）
 * @property {BossIntro} [intro] - Boss 出场演出配置（仅 Boss 敌人有效）
 *
 * @see EnemyInstance 运行时实例，继承本接口并附加战斗状态
 * @see EnemyStorage IndexedDB 存储格式，与本接口字段对应
 */
export interface EnemyData {
  id: string;
  name: string;
  icon: string;
  maxHp: number;
  damage: [number, number];
  xp: number;
  gold: number;
  dangerLevel: DangerLevel;
  isBoss?: boolean;
  physicalAttack?: number;
  physicalDefense?: number;
  magicAttack?: number;
  magicDefense?: number;
  critChance?: number;
  dodgeChance?: number;
  skillPool?: string[];
  aiStrategy?: AiStrategyType;
  phases?: BossPhase[];
  intro?: BossIntro;
}

/**
 * 敌人掉落配置接口
 *
 * 定义单个物品的掉落规则，包含物品 ID、数量范围和掉落概率。
 * 每个敌人（通常为 Boss）可配置多个掉落项，战斗结束后统一结算。
 *
 * @property {string} itemId - 物品 ID（对应物品模板表中的条目）
 * @property {number} minAmount - 最小掉落数量（含）
 * @property {number} maxAmount - 最大掉落数量（含）
 * @property {number} dropRate - 掉落概率（0-1，1 表示必定掉落）
 *
 * @see EnemyInstance.drops Boss 实例通过 drops 数组配置掉落
 */
export interface EnemyDrop {
  itemId: string;
  minAmount: number;
  maxAmount: number;
  dropRate: number;
}

// ============================================================================
// 运行时实例接口
// ============================================================================

/**
 * 敌人实例接口
 *
 * 运行时使用的敌人对象，继承 `EnemyData` 的所有静态配置属性，
 * 并附加战斗状态（HP、等级、属性、奖励缩放等）。
 *
 * 创建流程：
 * 1. 从 `config_enemies` 表读取敌人模板
 * 2. 根据战斗需求确定 `level` 等级
 * 3. 计算等级缩放后的 `expReward`、`goldReward` 和 `stats` 属性
 * 4. 填充 Boss 专属的 `drops` 掉落配置
 *
 * @property {string} dataId - 关联的敌人模板 ID（指向 `config_enemies` 表中的原始数据）
 * @property {number} level - 敌人等级（影响属性缩放和奖励计算）
 * @property {number} hp - 当前生命值（战斗中实时变化，初始值 = maxHp）
 * @property {Stats} stats - 敌人六维属性（由战斗属性推导，受等级加成影响）
 * @property {number} expReward - 经验值奖励（含等级缩放后的实际值）
 * @property {number} goldReward - 金币奖励（含等级缩放后的实际值）
 * @property {EnemyDrop[]} [drops] - 掉落配置（仅 Boss 实例填充，普通敌人为 undefined）
 *
 * @see EnemyData 父接口，包含所有静态配置属性
 */
export interface EnemyInstance extends EnemyData {
  dataId: string;
  level: number;
  hp: number;
  stats: Stats;
  expReward: number;
  goldReward: number;
  drops?: EnemyDrop[];
  /** Boss 范围攻击标记（运行时，由 Boss 引擎设置，下次行动时触发 AOE 并清除） */
  aoeNextAttack?: boolean;
  /** Boss 待召唤小怪数量（运行时，由 Boss 引擎设置，下次行动时触发召唤并清除） */
  pendingSummons?: number;
}

// ============================================================================
// 存储/持久化接口
// ============================================================================

/**
 * 敌人模板存储接口
 *
 * 敌人配置数据的持久化格式，存入 IndexedDB 的 `config_enemies` 表。
 * 与 `EnemyData` 接口的区别：
 * - `EnemyStorage`：数据库存储层，可选数值字段使用 `number | null` 以兼容 IndexedDB 索引
 * - `EnemyData`：运行时对象，可选数值字段使用 `number | undefined`，便于逻辑判断
 *
 * 数据转换规则（由 `db.ts` 的 `fromStorage` / `toStorage` 处理）：
 * - 写入时：`undefined` → `null`，确保 IndexedDB 索引字段存在
 * - 读取时：`null` → `undefined`，还原为运行时约定
 * - `aiStrategy` 字段：存储为 `string`，读取后由业务层断言为 `AiStrategyType`
 *
 * @property {string} id - 敌人模板唯一标识
 * @property {string} name - 敌人名称
 * @property {string} icon - 敌人图标
 * @property {number} maxHp - 最大生命值
 * @property {[number, number]} damage - 伤害范围
 * @property {number} xp - 经验值奖励
 * @property {number} gold - 金币奖励
 * @property {DangerLevel} dangerLevel - 危险等级
 * @property {number|null} [physicalAttack] - 物理攻击力（null 表示未配置）
 * @property {number|null} [physicalDefense] - 物理防御力（null 表示未配置）
 * @property {number|null} [magicAttack] - 魔法攻击力（null 表示未配置）
 * @property {number|null} [magicDefense] - 魔法防御力（null 表示未配置）
 * @property {number|null} [critChance] - 暴击率（null 表示未配置）
 * @property {number|null} [dodgeChance] - 闪避率（null 表示未配置）
 * @property {string[]} [skillPool] - 可用技能模板 ID 列表
 * @property {string} [aiStrategy] - AI 策略类型（存储为 string，读取时由 db.ts 断言为 AiStrategyType）
 *
 * @see EnemyData 运行时接口，字段语义相同但使用 `undefined`
 * @see fromStorage 存储 → 运行时的转换逻辑
 * @see toStorage 运行时 → 存储的转换逻辑
 */
export interface EnemyStorage {
  id: string;
  name: string;
  icon: string;
  maxHp: number;
  damage: [number, number];
  xp: number;
  gold: number;
  dangerLevel: DangerLevel;
  physicalAttack?: number | null;
  physicalDefense?: number | null;
  magicAttack?: number | null;
  magicDefense?: number | null;
  critChance?: number | null;
  dodgeChance?: number | null;
  skillPool?: string[];
  aiStrategy?: string;
}
