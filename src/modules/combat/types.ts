/**
 * @fileoverview 战斗模块类型定义
 * @description 包含战斗状态、战斗动作、战斗结果、战斗日志等核心类型定义。
 *              本文件是 combat 模块的类型基石，所有接口和类型别名均在此集中定义。
 * @module combat
 */

// ============================================================================
// 枚举类型
// ============================================================================

/**
 * 战斗状态枚举
 *
 * 描述一次战斗的生命周期阶段。
 * - `idle`：空闲状态，未进入战斗
 * - `fighting`：战斗中，回合循环正常运行
 * - `ended`：战斗已结束，等待结算动画完成后调用 `cleanup()` 回归 `idle`
 *
 * @see useCombatState 管理此状态的响应式读写
 */
export type CombatState = 'idle' | 'fighting' | 'ended';

/**
 * 战斗结果枚举
 *
 * 决定战斗结束后的结算逻辑分支（经验、金币、掉落、任务进度）。
 * - `victory`：胜利——奖励经验、金币、掉落
 * - `defeat`：失败——扣除经验、不给予掉落
 * - `fled`：逃跑——无奖励/惩罚
 *
 * @see store.ts endCombat 根据此值执行不同的结算分支
 */
export type CombatResult = 'victory' | 'defeat' | 'fled';

/**
 * 战斗动作类型枚举
 *
 * 玩家在回合中可执行的操作类型。
 * - `attack`：普通攻击（基于面板攻击力，可暴击/闪避）
 * - `item`：使用物品（卷轴、药水等）
 * - `flee`：逃跑（基于敏捷属性计算成功率）
 * - `skill`：使用技能（消耗法力，可附带 buff/debuff 效果）
 *
 * @see store.ts playerAction 根据此值分发到不同的处理函数
 * @see CombatActionResult.type 此值在结果中回传，供 UI 层决策展示样式
 */
export type CombatActionType = 'attack' | 'item' | 'flee' | 'skill' | 'defend';

/**
 * 战斗事件类型枚举
 *
 * 所有战斗日志条目的事件分类标签。用于 UI 层按类型过滤/统计战斗日志。
 * - `combat_start`：战斗开始
 * - `combat_end`：战斗结束
 * - `combat_turn_start`：回合开始
 * - `combat_turn_end`：回合结束
 * - `combat_damage`：造成伤害
 * - `combat_heal`：生命恢复
 * - `combat_skill_cast`：技能施放
 * - `combat_item`：物品使用
 * - `combat_flee`：逃跑
 * - `combat_miss`：未命中
 * - `combat_critical`：暴击
 * - `combat_event`：通用事件（Boss 阶段转换、召唤等特殊事件）
 *
 * @see CombatLog.eventType 日志条目使用此枚举值
 */
export type CombatEventType =
  | 'combat_start'
  | 'combat_end'
  | 'combat_turn_start'
  | 'combat_turn_end'
  | 'combat_damage'
  | 'combat_heal'
  | 'combat_skill_cast'
  | 'combat_item'
  | 'combat_flee'
  | 'combat_miss'
  | 'combat_critical'
  | 'combat_defend'
  | 'combat_event'
  | 'passive_trigger'
  | 'passive_effect';

// ============================================================================
// 核心数据接口
// ============================================================================

/**
 * 战斗动作接口
 *
 * UI 层提交给 Store 的动作描述对象。所有玩家操作（攻击、技能、物品、逃跑）
 * 均通过此接口封装后传入 `playerAction()`。
 *
 * @property {CombatActionType} type - 动作类型
 * @property {string} [itemId] - 物品 ID（仅 type='item' 时有效）
 * @property {number} [index] - 物品在背包中的索引（仅 type='item' 时有效，指定使用哪一组物品）
 * @property {string} [skillId] - 技能 ID（仅 type='skill' 时有效）
 * @property {'player' | 'enemy'} [target] - 目标类型（当前版本仅支持 'enemy'）
 *
 * @see store.ts playerAction 接收此接口作为参数
 */
export interface CombatAction {
  type: CombatActionType;
  itemId?: string;
  index?: number;
  skillId?: string;
  target?: 'player' | 'enemy';
}

/**
 * 多目标技能命中信息
 *
 * AOE 技能（targetType='all_enemies'）对单个敌人的命中结果快照。
 * 在一次 AOE 施放中，每个被命中的敌人各生成一条记录。
 *
 * @property {string} enemyId - 被命中的敌人 ID
 * @property {string} enemyName - 被命中的敌人名称
 * @property {number} damage - 对该敌人造成的实际伤害值
 * @property {boolean} [isCrit] - 是否暴击（当前版本 AOE 不触发暴击）
 * @property {boolean} [isDodge] - 是否被闪避
 *
 * @see CombatActionResult.aoeHits AOE 结果中汇集所有命中信息
 */
export interface AoeHitInfo {
  enemyId: string;
  enemyName: string;
  damage: number;
  isCrit?: boolean;
  isDodge?: boolean;
}

/**
 * 战斗动作结果接口
 *
 * 一次玩家动作执行后的完整返回结果。由 `playerAttack` / `playerSkill` /
 * `playerUseItem` / `playerFlee` 返回，供 UI 层展示战斗动画和日志。
 *
 * @property {boolean} success - 是否执行成功（false 时仅 message 有效）
 * @property {CombatActionType} type - 执行的动作类型
 * @property {number} [damage] - 造成的伤害值
 * @property {number} [heal] - 生命恢复值
 * @property {boolean} [isCrit] - 是否暴击
 * @property {boolean} [isDodge] - 是否被闪避
 * @property {boolean} [isControlled] - 是否因眩晕/冰冻/沉默等控制效果导致回合被跳过
 * @property {string} message - 结果描述消息
 * @property {AoeHitInfo[]} [aoeHits] - AOE 技能的逐目标命中详情
 *
 * @see usePlayerAction.ts 玩家行动 composable 生成此结果
 * @see store.ts playerAction 通过此结果通知 UI 层
 */
export interface CombatActionResult {
  success: boolean;
  type: CombatActionType;
  damage?: number;
  heal?: number;
  isCrit?: boolean;
  isDodge?: boolean;
  /** 是否因眩晕/冰冻/沉默等控制效果导致回合被跳过 */
  isControlled?: boolean;
  message: string;
  /** 多目标技能命中列表（仅技能 targetType='all_enemies' 时返回） */
  aoeHits?: AoeHitInfo[];
}

// ============================================================================
// 战斗日志接口
// ============================================================================

/**
 * 战斗日志接口
 *
 * 单条战斗日志条目的运行时对象。由 `useCombatLog.addCombatLog` 创建并推入
 * `combatLog` 响应式数组，同时异步持久化到 IndexedDB。
 * 不同事件类型的必填字段不同（详见各事件类型的日志构造代码）。
 *
 * 数据流向：
 * 1. 战斗逻辑层（usePlayerAction / useEnemyAction / useInitiative）调用 `addCombatLog`
 * 2. 日志被推入 `combatLog` 响应式数组（UI 实时渲染）
 * 3. 由 `endPlayerTurn` / `endCombat` 统一调用 `saveLogs()` 批量持久化到 IndexedDB
 *
 * @property {string} combatId - 所属战斗 ID（一次完整战斗共享同一 ID）
 * @property {string} battleLogId - 日志条目唯一标识
 * @property {number} timestamp - 时间戳（毫秒）
 * @property {number} turn - 所在回合数（从 1 开始）
 * @property {'player' | 'enemy' | 'system' | 'pet'} actorType - 行动者类型（系统消息如 DOT/tick 也属此类，'pet' 为召唤物）
 * @property {string} actorId - 行动者 ID
 * @property {string} actorName - 行动者显示名称
 * @property {CombatEventType} eventType - 事件类型
 * @property {'player' | 'enemy'} [targetType] - 目标类型
 * @property {string} [targetId] - 目标 ID
 * @property {string} [targetName] - 目标显示名称
 * @property {string} [skillId] - 使用的技能 ID
 * @property {string} [skillName] - 使用的技能名称
 * @property {number} [damage] - 伤害值
 * @property {number} [heal] - 生命恢复值
 * @property {boolean} isCrit - 是否暴击（默认 false）
 * @property {boolean} isDodge - 是否闪避（默认 false）
 * @property {string} message - 日志消息文本（UI 直接展示）
 *
 * @see CombatLogStorage IndexedDB 存储兼容格式
 * @see useCombatLog.addCombatLog 创建日志条目
 * @see db.ts 日志持久化实现
 */
export interface CombatLog {
  combatId: string;
  battleLogId: string;
  timestamp: number;
  turn: number;
  actorType: 'player' | 'enemy' | 'system' | 'pet';
  actorId: string;
  actorName: string;
  eventType: CombatEventType;
  targetType?: 'player' | 'enemy';
  targetId?: string;
  targetName?: string;
  skillId?: string;
  skillName?: string;
  damage?: number;
  heal?: number;
  isCrit?: boolean;
  isDodge?: boolean;
  message: string;
}

// ============================================================================
// 存储/持久化接口
// ============================================================================

/**
 * 战斗日志存储格式
 *
 * `CombatLog` 的 IndexedDB 兼容版本。由于 Dexie/IndexedDB 不支持字面量联合类型，
 * 将 `actorType`、`eventType`、`targetType` 字段从字面量联合类型放宽为 `string`。
 *
 * 设计原则：
 * - 运行时写入：`db.ts` 内部自动将 `CombatLog` 转换为 `CombatLogStorage` 存储
 * - 运行时读取：`db.ts` 查询结果通过 `as unknown as CombatLogStorage[]` 桥接
 * - 类型安全：仅存储层使用此类型，业务层始终使用 `CombatLog`
 *
 * @see CombatLog 运行时日志接口（更严格的类型约束）
 * @see db.ts 持久化层使用此类型
 * @see data/service.ts 外部模块引用此类型
 */
export type CombatLogStorage = Omit<CombatLog, 'actorType' | 'eventType' | 'targetType'> & {
  actorType: string;
  eventType: string;
  targetType?: string;
};
