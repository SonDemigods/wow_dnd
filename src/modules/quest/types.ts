/**
 * @fileoverview 任务模块类型定义
 * @description 包含任务状态、任务目标、任务定义、任务实例等相关类型定义。
 *              本文件是 quest 模块的类型基石，所有接口和类型别名均在此集中定义。
 *
 *              类型体系分为两层：
 *              - 领域模型（QuestDefinition / QuestInstance / QuestObjective）：运行时使用，面向业务逻辑
 *              - 存储模型（QuestDefinitionStorage / QuestInstanceStorage / CharQuestStorage）：与 IndexedDB 表一一对应
 *              两层通过 db.ts 的 _mapToDefinition() / _mapStorageObjectives() 相互转换。
 *
 *              两层的字段类型已统一（status 使用 QuestStatus 而非 string），以消除 db.ts 中的冗余类型断言。
 *
 * ## 任务生命周期
 *
 *   not_available → available → in_progress → completed → turned_in
 *                                  │
 *                                  └─────────→ abandoned → available（可重接）
 *
 * - not_available : 不满足等级/前置条件，前端不展示
 * - available     : 条件满足，可接取
 * - in_progress   : 已接取，正在执行
 * - completed     : 目标全部达成，奖励已自动发放
 * - turned_in     : 已提交（终态）
 * - abandoned     : 已放弃（可重新接取，回退到 available 判定）
 *
 * @module quest
 */

import type { InventoryItem } from '../inventory/types';

// ============================================================================
// 枚举类型
// ============================================================================

/**
 * 任务状态
 *
 * 描述任务实例从接取到终态的全部阶段。
 * 注意：奖励在 completed 时自动发放（_handleQuestCompletion），
 * turned_in 仅做状态标记，不再重复发奖。
 */
export type QuestStatus =
  | 'not_available'
  | 'available'
  | 'in_progress'
  | 'completed'
  | 'turned_in'
  | 'abandoned';

/**
 * 任务类型
 *
 * 决定目标的匹配方式和服务端进度计算逻辑：
 * - `kill`    : 击杀指定敌人（relevantData.enemyId 匹配 QuestObjective.enemyId）
 * - `collect` : 收集指定物品（relevantData.itemId 匹配 QuestObjective.itemId）
 */
export type QuestType = 'kill' | 'collect';

// ============================================================================
// 核心数据接口
// ============================================================================

/**
 * 任务目标
 *
 * 一个任务定义可包含多个目标（QuestDefinition.objectives[]），
 * 所有目标同时追踪但独立计算进度。
 *
 * UI 层通过 getObjectiveText() 自动将 enemyId / itemId 解析为可读文本，
 * 因此目标定义中无需手写 description 字段。
 *
 * @property {string} key - 目标唯一标识，如 "kill_spider"、"collect_herb"
 * @property {QuestType} type - 目标类型，决定进度事件的匹配方式
 * @property {number} target - 需要完成的总次数
 * @property {string} [itemId] - 物品ID（收集任务专用，用于进度匹配）
 * @property {string} [enemyId] - 敌人ID（击杀任务专用，用于进度匹配和 UI 文本生成）
 * @property {string} [locationId] - 地点ID（预留，用于交互任务，当前未使用）
 *
 * @see getObjectiveText 根据 enemyId / itemId 自动生成目标描述文本
 */
export interface QuestObjective {
  key: string;
  type: QuestType;
  target: number;
  itemId?: string;
  enemyId?: string;
  locationId?: string;
}

/**
 * 任务目标进度
 *
 * 追踪玩家在单个目标上的完成情况，是 QuestInstance.progress 的子项。
 * current 由 checkQuestProgress() 累加，上限为 target。
 *
 * @property {string} objectiveKey - 关联 QuestObjective.key
 * @property {number} current - 当前已完成次数（0 ≤ current ≤ target）
 * @property {number} target - 需要完成的总次数（从 QuestObjective.target 复制）
 *
 * @see checkQuestProgress 累加 current 并确保不超过 target
 */
export interface QuestObjectiveProgress {
  objectiveKey: string;
  current: number;
  target: number;
}

/**
 * 任务定义
 *
 * 任务的静态配置数据，存储在 config_quests 表中，所有玩家共享。
 * 由 data/service.ts 在数据库初始化时从 QUESTS 常量批量写入。
 * 若 DB 为空，store.ts 的 _initDefaultQuestDefinitions() 会回退到 getDefaultQuests()。
 *
 * @property {string} id - 任务唯一ID（kebab-case），如 "teldrassil_defense"
 * @property {string} title - 任务标题，展示在任务面板和冒险日志
 * @property {string} description - 任务背景描述
 * @property {QuestType} type - 任务类型（kill 或 collect），决定进度计算方式
 * @property {QuestObjective[]} objectives - 目标列表，支持多目标（如同时击杀 A 和收集 B）
 * @property {number} levelRequirement - 角色最低等级要求
 * @property {number} xpReward - 经验奖励（通过 characterStore.gainExp 发放）
 * @property {number} goldReward - 金币奖励（通过 characterStore.gainGold 发放）
 * @property {InventoryItem[]} [itemRewards] - 物品奖励列表（可选，通过 inventoryStore.addItem 发放）
 * @property {string} boardId - 所属任务板，决定在哪个区域的任务面板中展示
 *
 * @see getDefaultQuests DB 为空时的回退模板
 * @see canAcceptQuest 接取条件判定
 */
export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  objectives: QuestObjective[];
  levelRequirement: number;
  xpReward: number;
  goldReward: number;
  itemRewards?: InventoryItem[];
  boardId: string;
}

/**
 * 任务实例
 *
 * 记录单个玩家在单个任务上的运行时状态，存储在 char_quests 表中。
 * 每个玩家对同一任务定义各自拥有独立的实例，进度互不干扰。
 *
 * 数据来源流程：
 * 1. acceptQuest() → generateQuestInstance(definition) 创建实例 → 写入 char_quests
 * 2. onEnemyKilled() / onItemCollected() → checkQuestProgress() 更新进度
 * 3. _handleQuestCompletion() → 验证全部目标达成 → 发放奖励 → 标记 completed
 * 4. claimReward() → 标记 turned_in（终态）
 *
 * @property {string} questId - 关联 QuestDefinition.id
 * @property {QuestStatus} status - 当前任务状态（决定 UI 展示和可执行操作）
 * @property {QuestObjectiveProgress[]} progress - 各目标进度列表
 * @property {number} acceptedAt - 接取时间戳（毫秒）
 * @property {number} [completedAt] - 完成时间戳（毫秒），仅在 completed / turned_in 状态下有效
 *
 * @see generateQuestInstance 创建新实例
 * @see checkQuestProgress 更新进度
 */
export interface QuestInstance {
  questId: string;
  status: QuestStatus;
  progress: QuestObjectiveProgress[];
  acceptedAt: number;
  completedAt?: number;
}

// ============================================================================
// 存储/持久化接口
// ============================================================================

/**
 * 任务实例存储格式（精简版）
 *
 * 对应 char_quests 表从 Dexie 查询返回的行结构。
 * 与 CharQuestStorage 的区别：不含 characterId（由调用方自行关联），
 * 查询方法在返回前将存储行解构为 QuestInstance。
 *
 * progress 使用内联匿名对象数组而非引用 QuestObjectiveProgress，
 * 以避免 Dexie（Table<any, string>）返回 any 时的深层类型递归断言问题。
 *
 * @property {string} questId - 任务ID
 * @property {QuestStatus} status - 任务状态
 * @property {object[]} progress - 进度（{ objectiveKey, current, target }）
 * @property {number} acceptedAt - 接取时间戳
 * @property {number} [completedAt] - 完成时间戳
 *
 * @see db.ts 的 getQuestInstance / getAllQuestInstances 返回前解构为此类型
 */
export interface QuestInstanceStorage {
  questId: string;
  status: QuestStatus;
  progress: { objectiveKey: string; current: number; target: number }[];
  acceptedAt: number;
  completedAt?: number;
}

/**
 * 任务定义存储格式
 *
 * 对应 config_quests 表结构，是数据库 → 领域模型转换的中间层。
 * db.ts 的 _mapToDefinition() 负责将此类型转换为 QuestDefinition。
 *
 * 注意：objectives 和 itemRewards 在此处以内联形式独立定义，
 * 而非引用 QuestObjective / InventoryItem，以避免 Dexie（Table<any, string>）
 * 返回 any 时的深层类型递归断言问题。
 *
 * @property {string} id - 任务ID
 * @property {string} title - 标题
 * @property {string} description - 描述
 * @property {QuestType} type - 任务类型
 * @property {object[]} objectives - 目标列表（内联定义，与 QuestObjective 独立）
 * @property {number} levelRequirement - 等级要求
 * @property {number} xpReward - 经验奖励
 * @property {number} goldReward - 金币奖励
 * @property {object[]} [itemRewards] - 物品奖励（内联定义 { itemId, count }）
 * @property {string} boardId - 任务板ID
 *
 * @see _mapToDefinition 存储类型 → 领域模型的转换逻辑
 */
export interface QuestDefinitionStorage {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  objectives: {
    key: string;
    type: QuestType;
    target: number;
    itemId?: string;
    enemyId?: string;
    locationId?: string;
  }[];
  levelRequirement: number;
  xpReward: number;
  goldReward: number;
  itemRewards?: { itemId: string; count: number }[];
  boardId: string;
}

/**
 * 角色任务存储格式（完整行）
 *
 * 对应 char_quests 表的完整行结构，包含复合主键中的 characterId。
 * 用于写入（saveQuestInstance）和按角色删除（deleteCharacterQuests）场景。
 *
 * @property {string} characterId - 角色ID（复合主键的第一部分）
 * @property {string} questId - 任务ID（复合主键的第二部分）
 * @property {QuestStatus} status - 任务状态
 * @property {object[]} progress - 进度（{ objectiveKey, current, target }）
 * @property {number} acceptedAt - 接取时间戳
 * @property {number} [completedAt] - 完成时间戳
 *
 * @see saveQuestInstance 使用此类型写入 char_quests 表
 */
export interface CharQuestStorage {
  characterId: string;
  questId: string;
  status: QuestStatus;
  progress: Array<{ objectiveKey: string; current: number; target: number }>;
  acceptedAt: number;
  completedAt?: number;
}
