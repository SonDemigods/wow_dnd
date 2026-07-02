/**
 * @fileoverview Boss 模块类型定义
 * @description Boss 专属的数据结构，包括存储格式、模板、实例等。
 *              阶段（BossPhase）、机制（BossMechanic）、出场演出（BossIntro）等
 *              跨模块类型已迁移至 ../enemy/types.ts，此处通过重导出保持向后兼容。
 * @module boss
 */

import type { EnemyData, EnemyInstance, DangerLevel } from '../enemy/types';
import type { BossPhaseManager } from './phase-manager';
import type {
  AiStrategyType,
  BossIntroEffect,
  BossIntro,
  BossMechanicType,
  BossMechanic,
  BossPhase
} from '../enemy/types';

// ============================================================================
// 重导出（向后兼容）
// ============================================================================

/**
 * 以下类型定义于 enemy/types.ts，此处重导出以保持向后兼容。
 * 外部模块可通过 `import { BossPhase } from '@/modules/boss/types'` 访问，
 * 无需深入到 enemy/types.ts。
 */
export type {
  AiStrategyType,
  BossIntroEffect,
  BossIntro,
  BossMechanicType,
  BossMechanic,
  BossPhase
};

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
 * @property {BossPhase[]} [phases] - Boss 多阶段配置（仅 Boss 有效，阶段切换由 BossPhaseManager 管理）
 * @property {BossIntro} [intro] - Boss 出场演出配置（仅 Boss 有效，由 createBossIntro 消费）
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
 * 与 EnemyData 的关系：
 * - EnemyData 中 isBoss 为 `boolean | undefined`
 * - BossTemplate 收窄为 `true`，提供编译时类型区分
 * - 除 isBoss 外不新增字段——Boss 专属的 phases/intro 已在 EnemyData 中预留
 *
 * 数据来源流程：
 * 1. Boss 配置存储在 IndexedDB 的 `config_bosses` 表中
 * 2. `bossDbService.getBossTemplate()` 将 BossStorage 转换为 BossTemplate
 * 3. `createBossInstance()` 以 BossTemplate 为输入，创建运行时 BossInstance
 *
 * @property {true} isBoss - 固定为 true，编译时区分 Boss 与普通敌人
 *
 * @see EnemyData 父接口
 * @see BossInstance 运行时实例
 * @see createBossInstance Boss 实例创建入口
 */
export interface BossTemplate extends EnemyData {
  isBoss: true;
}

// ============================================================================
// 运行时实例接口
// ============================================================================

/**
 * Boss 实例接口
 *
 * 运行时使用的 Boss 对象，继承 EnemyInstance 的全部战斗属性
 *（level / hp / stats / expReward / goldReward / drops），并附加阶段管理器。
 *
 * 创建流程：
 * 1. 从 `config_bosses` 表读取 BossTemplate
 * 2. 根据战斗需求确定 level 等级
 * 3. `createBossInstance()` 调用 generateEnemyStats 计算等级缩放后的战斗属性
 * 4. 注入 BOSS_DROP_TABLE 通用掉落
 * 5. 在对象构造后注入 BossPhaseManager（因自引用限制，无法在字面量中直接创建）
 *
 * @property {true} isBoss - 固定为 true，编译时区分 Boss 与普通敌人
 * @property {BossPhaseManager} [phaseManager] - Boss 阶段管理器，由 createBossInstance 在对象构造后注入，跟踪/检测阶段切换
 *
 * @see EnemyInstance 父接口
 * @see BossPhaseManager 阶段管理逻辑
 * @see createBossInstance 创建入口
 */
export interface BossInstance extends EnemyInstance {
  isBoss: true;
  phaseManager?: BossPhaseManager;
}
