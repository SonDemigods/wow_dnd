/**
 * @fileoverview Boss 模块类型定义
 * @description Boss 专属的数据结构，包括阶段（BossPhase）、机制（BossMechanic）、
 *              出场演出（BossIntro）等类型定义，以及存储格式、模板、实例等。
 *
 * 类型归属说明：
 *   本文件是 Boss 专属类型的权威定义位置。BossIntroEffect / BossIntro /
 *   BossMechanicType / BossMechanic / BossPhase 5 个类型定义于此，
 *   enemy 模块不再感知这些类型，依赖方向仅 boss → enemy 单向。
 *
 *   AiStrategyType 保留在 enemy/types.ts（普通敌人也使用），本文件通过
 *   import type 单向依赖 enemy，并 re-export 以维持公共 API 兼容。
 *
 * @module boss
 */

import type { EnemyData, EnemyInstance, DangerLevel, AiStrategyType } from '@/modules/enemy/types';

// ============================================================================
// AiStrategyType 重导出（保留在 enemy/types.ts，boss 模块转出以维持公共 API 兼容）
// ============================================================================
export type { AiStrategyType };

// ============================================================================
// Boss 专属类型定义（从 enemy/types.ts 迁入）
// ============================================================================

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
 * @see BossTemplate.intro 每个 Boss 级别的敌人可配置独立出场演出
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
 * @see BossTemplate.phases Boss 敌人通过 phases 数组配置多阶段战斗
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
// 存储/持久化接口
// ============================================================================

/**
 * Boss 存储格式接口
 *
 * Boss 配置数据的持久化格式，存入 IndexedDB 的 `config_bosses` 表。
 * 与普通敌人的 `config_mobs` 表分离，额外记录 phases（阶段配置）和 intro（出场演出）字段。
 *
 * 与 `BossTemplate` 接口的区别：
 * - `BossStorage`：数据库存储层，isBoss 为 `1`，可选数值字段使用 `number | null` 以兼容 IndexedDB 索引
 * - `BossTemplate`：运行时对象，isBoss 为 `true`，可选数值字段使用 `number | undefined`，便于逻辑判断
 *
 * 数据转换规则（由 `db.ts` 的 `fromStorage` / `saveBossTemplate` 处理）：
 * - 写入时：`undefined` → `null`（确保 IndexedDB 索引字段存在）
 * - 读取时：`null` → `undefined`（还原为运行时约定）
 * - `aiStrategy` 字段：存储为 `string`，读取后由 db.ts 断言为 `AiStrategyType`
 * - `isBoss` 字段：恒为 `1`（Boss 表专用标识，区别于普通敌人表）
 *
 * @property {string} id - 模板唯一标识
 * @property {string} name - Boss 名称
 * @property {string} icon - Boss 图标（Iconify 格式）
 * @property {number} maxHp - 最大生命值
 * @property {[number, number]} damage - 伤害范围 [最小值, 最大值]
 * @property {number} xp - 经验值奖励（基础值，实际奖励会根据等级缩放）
 * @property {number} gold - 金币奖励（基础值，实际奖励会根据等级缩放）
 * @property {DangerLevel} dangerLevel - 危险等级（影响奖励缩放和 AI 行为）
 * @property {1} isBoss - Boss 标记（恒为 1，区分于普通敌人的 config_mobs 表，对应 BossTemplate.isBoss: true）
 * @property {number|null} [physicalAttack] - 物理攻击力（null 表示未配置，由等级缩放推导）
 * @property {number|null} [physicalDefense] - 物理防御力（null 表示未配置，由等级缩放推导）
 * @property {number|null} [magicAttack] - 魔法攻击力（null 表示未配置，由等级缩放推导）
 * @property {number|null} [magicDefense] - 魔法防御力（null 表示未配置，由等级缩放推导）
 * @property {number|null} [critChance] - 暴击率 0-1（null 表示未配置，由等级缩放推导）
 * @property {number|null} [dodgeChance] - 闪避率 0-1（null 表示未配置，由等级缩放推导）
 * @property {string[]} [skillPool] - 可用技能模板 ID 列表（AI 从此列表中选取技能施放）
 * @property {string} [aiStrategy] - AI 策略类型（存储为 string，读取后由 db.ts 断言为 AiStrategyType）
 * @property {string} [attackType] - 普攻伤害类型（'physical'|'magical'，P3-95，读取时由 fromStorageBase 透传）
 * @property {BossPhase[]} [phases] - Boss 多阶段配置（仅 Boss 有效，阶段切换由 BossPhaseManager 管理）
 * @property {BossIntro} [intro] - Boss 出场演出配置（仅 Boss 有效，由 combat 流程通过 COMBAT_BOSS_INTRO 事件消费）
 *
 * @see fromStorageBase 读取时的共有字段转换逻辑
 * @see BossTemplate 运行时模板类型
 */
export interface BossStorage {
  id: string;
  name: string;
  icon: string;
  maxHp: number;
  damage: [number, number];
  xp: number;
  gold: number;
  dangerLevel: DangerLevel;
  isBoss: 1;
  physicalAttack?: number | null;
  physicalDefense?: number | null;
  magicAttack?: number | null;
  magicDefense?: number | null;
  critChance?: number | null;
  dodgeChance?: number | null;
  skillPool?: string[];
  aiStrategy?: string;
  attackType?: string;
  phases?: BossPhase[];
  intro?: BossIntro;
}

// ============================================================================
// 核心数据接口
// ============================================================================

/**
 * Boss 模板接口
 *
 * 用于 IndexedDB 读取后的数据表示，继承 EnemyData 的全部字段，
 * 通过 `isBoss: true` 字面量类型标记为 Boss 模板，在创建 BossInstance 时作为输入参数。
 *
 * 与 EnemyData 的关系（阶段四升级）：
 * - EnemyData 中 isBoss 为 `boolean | undefined`
 * - BossTemplate 收窄为 `true`，提供编译时类型区分
 * - Boss 专属的 phases/intro 字段在 EnemyData 中已移除（切断 enemy → boss 反向依赖），
 *   由 BossTemplate 独立声明，与 BossStorage 字段保持一致
 *
 * 数据来源流程：
 * 1. Boss 配置存储在 IndexedDB 的 `config_bosses` 表中
 * 2. `bossDbService.getBossTemplate()` 将 BossStorage 转换为 BossTemplate
 * 3. `createBossInstance()` 以 BossTemplate 为输入，创建运行时 BossInstance
 *
 * @property {true} isBoss - 固定为 true，编译时区分 Boss 与普通敌人
 * @property {BossPhase[]} [phases] - Boss 多阶段配置（阶段切换由 BossPhaseManager 管理）
 * @property {BossIntro} [intro] - Boss 出场演出配置（由 combat 流程通过 COMBAT_BOSS_INTRO 事件消费）
 *
 * @see EnemyData 父接口
 * @see BossInstance 运行时实例
 * @see createBossInstance Boss 实例创建入口
 */
export interface BossTemplate extends EnemyData {
  isBoss: true;
  phases?: BossPhase[];
  intro?: BossIntro;
}

// ============================================================================
// 运行时状态接口（阶段三：从 engine.ts 提升为公共类型）
// ============================================================================

/**
 * Boss 运行时动态属性
 *
 * 机制执行过程中注入的临时状态，仅在当次战斗中有效，战斗结束后由 combat store 清除，不持久化。
 * 每个机制类型对应一个或多个状态字段，具体映射关系见 engine.ts 的 mechanicExecutors。
 *
 * 阶段三升级：此接口原定义于 engine.ts 内部（interface BossRuntimeState），
 * 现提升为 boss 模块公共类型，作为组合式 BossInstance.runtime 字段的基础。
 * engine.ts 改为从此处导入。
 *
 * @see BossInstance.runtime 组合式 BossInstance 通过此字段收口所有运行时状态
 */
export interface BossRuntimeState {
  /** 护盾值（damage_shield 机制注入，吸收等量伤害） */
  shield?: number;
  /** 反弹伤害比例 0-1（reflect_damage 机制注入，如 0.2 表示反弹 20% 伤害） */
  reflectDamage?: number;
  /** 待召唤小怪数量（summon_minions 机制累加，由 combat store 消费后清零） */
  pendingSummons?: number;
  /** 下次攻击是否为 AOE（aoe_attack 机制标记，攻击后由 combat store 清除） */
  aoeNextAttack?: boolean;
  /** 待召唤精英怪标记（summon_elite 机制标记） */
  pendingEliteSummons?: boolean;
  /** 无敌标记（invulnerable 机制设置，期间免疫所有伤害） */
  invulnerable?: boolean;
  /** 蓄力标记（charge_attack 机制设置，下回合释放蓄力攻击） */
  charging?: boolean;
  /** 减益光环类型（debuff_aura 机制设置，如 'attack_down' 表示降低攻击力） */
  debuffAura?: string;
  /** 治疗区域每回合回复量（healing_zone 机制设置） */
  healingZone?: number;
  /** 可复活标记（revive 机制设置，死亡后自动复活一次） */
  canRevive?: boolean;
  /** 反击姿态标记（counter_stance 机制设置，被攻击时反击） */
  counterStance?: boolean;
  /** 狂暴已激活标记（enrage 机制设置，防止多次触发无限叠加攻击力） */
  enraged?: boolean;
}

// ============================================================================
// 运行时实例接口
// ============================================================================

/**
 * Boss 实例接口（组合式）
 *
 * 采用组合替代继承：Boss 持有 `base: EnemyInstance`，而非继承。
 * 运行时状态收口到 `runtime: BossRuntimeState`，普通 EnemyInstance 不再可见这些字段。
 *
 * 设计要点：
 * - 组合替代继承：`base` 持有 EnemyInstance，而非 extends
 * - 运行时状态收口：12 个 Boss 运行时字段归入 `runtime`，不再散落在 EnemyInstance 顶层
 * - 阶段管理器由 combat 层通过 `state.bossPhaseManagers` Map 持有，不在此接口中
 *
 * @property {EnemyInstance} base - 组合持有的敌人实例（HP、属性、等级等战斗状态）
 * @property {true} isBoss - 字面量类型标记，编译时区分 Boss 与普通敌人
 * @property {BossPhase[]} phases - Boss 阶段配置（从模板复制，运行时可被引擎读取）
 * @property {BossIntro} [intro] - Boss 出场演出配置（可选）
 * @property {BossRuntimeState} runtime - 机制执行器注入的运行时状态（护盾/无敌/反弹等）
 *
 * @see BossRuntimeState 运行时状态接口
 * @see wrapAsBossInstance 包装函数，将扁平 EnemyInstance 包装为组合式 BossInstance
 */
export interface BossInstance {
  /** 组合持有的敌人实例（替代继承） */
  base: EnemyInstance;
  /** 字面量类型标记，编译时区分 Boss 与普通敌人 */
  isBoss: true;
  /** Boss 阶段配置 */
  phases: BossPhase[];
  /** Boss 出场演出配置（可选） */
  intro?: BossIntro;
  /** 机制执行器注入的运行时状态（护盾/无敌/反弹等），收口 12 个 Boss 运行时字段 */
  runtime: BossRuntimeState;
}

// ============================================================================
// 扁平化 Boss 敌人实例接口（TS-2 修复：消除类型断言桥接）
// ============================================================================

/**
 * 扁平化 Boss 敌人实例接口
 *
 * TS-2 修复：Boss 数据流中 `phases`/`intro` 运行时附加属性的类型声明。
 *
 * ## 背景
 *
 * Boss 创建流程采用"扁平化传递"模式：
 * 1. `createBossInstance` 产生组合式 `BossInstance`（base + phases + intro + runtime）
 * 2. `GameBootstrap.bossCreateFn` 回调将其扁平化为 `BossEnemyInstance`：
 *    展开 `base` 字段，将 `phases`/`intro` 作为顶层字段附加
 * 3. 扁平化对象存入 `enemyStore.enemiesCache`（类型为 `EnemyInstance`， widened）
 * 4. `combat/store.ts` 的 `enemiesData: EnemyInstance[]` 数组携带 Boss 时，
 *    `useBossMechanics.initBossFeatures` 通过 `isBossEnemyInstance` 类型守卫收窄
 * 5. `wrapAsBossInstance` 接收 `BossEnemyInstance`，读取 `phases`/`intro` 重建组合式结构
 *
 * ## 为何单独定义而非用 `BossInstance`
 *
 * - `BossInstance` 是组合式结构（持有 `base: EnemyInstance` + `runtime`）
 * - `BossEnemyInstance` 是扁平结构（直接 extends `EnemyInstance`，无 `runtime`）
 * - 扁平结构用于在 `enemyStore` / `enemiesData` 数组中传递，与普通敌人统一类型签名
 * - `wrapAsBossInstance` 负责从扁平结构重建组合式结构（`base` 与原对象同引用）
 *
 * @property {true} isBoss - 字面量类型标记，编译时区分 Boss 与普通敌人
 * @property {BossPhase[]} phases - Boss 阶段配置（由 bossCreateFn 注入）
 * @property {BossIntro} [intro] - Boss 出场演出配置（可选，由 bossCreateFn 注入）
 *
 * @see isBossEnemyInstance 类型守卫，从 EnemyInstance 收窄到 BossEnemyInstance
 * @see wrapAsBossInstance 从扁平结构重建组合式 BossInstance
 * @see BossInstance 组合式运行时结构
 */
export interface BossEnemyInstance extends EnemyInstance {
  /** 字面量类型标记，编译时区分 Boss 与普通敌人 */
  isBoss: true;
  /** Boss 阶段配置（运行时附加，由 bossCreateFn 注入） */
  phases: BossPhase[];
  /** Boss 出场演出配置（运行时附加，由 bossCreateFn 注入） */
  intro?: BossIntro;
}
