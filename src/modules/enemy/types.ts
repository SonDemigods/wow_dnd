/**
 * @fileoverview 敌人模块类型定义
 * @description 包含敌人基础数据、敌人实例、敌人掉落等类型定义。
 *
 *              阶段四升级：EnemyData 不再携带 Boss 专属的 phases/intro 字段，
 *              这两个字段已下沉到 BossTemplate 独立声明。enemy 模块不再感知
 *              Boss 专属类型，依赖方向仅 boss → enemy 单向。
 *              isBoss?: boolean 保留为简单标识（不引入 boss 类型依赖）。
 *              AiStrategyType 保留在本文件（普通敌人也使用）。
 *
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
 * 1. 敌人模板存储在 IndexedDB 的 `config_mobs` 表中
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
 * @property {boolean} [isBoss] - 是否为 Boss 敌人（简单标识，Boss 专属的 phases/intro 由 BossTemplate 独立持有）
 * @property {number} [physicalAttack] - 物理攻击力（未配置时使用默认推导值）
 * @property {number} [physicalDefense] - 物理防御力（未配置时使用默认推导值）
 * @property {number} [magicAttack] - 魔法攻击力（未配置时使用默认推导值）
 * @property {number} [magicDefense] - 魔法防御力（未配置时使用默认推导值）
 * @property {number} [critChance] - 暴击率（0-1，未配置时使用默认推导值）
 * @property {number} [dodgeChance] - 闪避率（0-100 整数百分比，未配置时使用默认值 5。P7-018 修正：原注释 0-1 有误）
 * @property {string[]} [skillPool] - 可用技能模板 ID 列表（AI 从此列表中选取技能施放）
 * @property {AiStrategyType} [aiStrategy] - AI 策略类型（决定技能选择和行为模式）
 * @property {'physical'|'magical'} [attackType] - 普攻伤害类型（P3-95 修复）
 *   未配置时默认 'physical'，敌人普攻走物理攻击力 vs 玩家物理防御；
 *   配置为 'magical' 时，敌人普攻走魔法攻击力 vs 玩家魔法防御，
 *   使法系敌人（如 element/imp/naga/dragon）的普攻也能利用其较高的 magicAttack 属性。
 *   技能伤害类型由 SkillTemplate.type 决定，不受本字段影响。
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
  attackType?: 'physical' | 'magical';
  drops?: EnemyDrop[];
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
 * 1. 从 `config_mobs` 表读取敌人模板
 * 2. 根据战斗需求确定 `level` 等级
 * 3. 计算等级缩放后的 `expReward`、`goldReward` 和 `stats` 属性
 * 4. 填充 Boss 专属的 `drops` 掉落配置
 *
 * @property {string} dataId - 关联的敌人模板 ID（指向 `config_mobs` 表中的原始数据）
 * @property {number} level - 敌人等级（影响属性缩放和奖励计算）
 * @property {number} hp - 当前生命值（战斗中实时变化，初始值 = maxHp）
 * @property {Stats} stats - 敌人六维属性（由战斗属性推导，受等级加成影响）
 * @property {number} expReward - 经验值奖励（含等级缩放后的实际值）
 * @property {number} goldReward - 金币奖励（含等级缩放后的实际值）
 * @property {EnemyDrop[]} [drops] - 掉落配置（模板配置的 drops 由 createEnemyInstance/createBossInstance 透传）
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
  // 阶段三 3.5：Boss 运行时字段（shield/invulnerable/reflectDamage/counterStance/
  // canRevive/charging/aoeNextAttack/pendingSummons/pendingEliteSummons/
  // debuffAura/healingZone/enraged）已移除，收口到 BossInstance.runtime。
  // combat 模块通过 state.bossInstances.get(id).runtime 访问运行时状态。
}

// ============================================================================
// 存储/持久化接口
// ============================================================================

/**
 * 敌人模板存储接口
 *
 * 敌人配置数据的持久化格式，存入 IndexedDB 的 `config_mobs` 表。
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
 * @property {string} [attackType] - 普攻伤害类型（存储为 string，'physical'|'magical'，读取时由 db.ts 透传）
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
  attackType?: string;
  drops?: EnemyDrop[];
}
