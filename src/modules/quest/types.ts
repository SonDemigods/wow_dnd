/**
 * @fileoverview 任务模块类型定义
 * @description 包含任务状态、任务目标、任务实例等相关类型定义
 */

import type { InventoryItem } from '../inventory/types';

/**
 * 任务状态枚举
 * - NOT_AVAILABLE: 任务不可用（未达到等级要求或前置条件未满足）
 * - AVAILABLE: 任务可用（可以接取）
 * - IN_PROGRESS: 任务进行中（已接取但未完成）
 * - COMPLETED: 任务已完成（目标达成，等待提交）
 * - TURNED_IN: 任务已提交（已领取奖励）
 * - ABANDONED: 任务已放弃（玩家主动放弃）
 */
export type QuestStatus =
  | 'not_available'
  | 'available'
  | 'in_progress'
  | 'completed'
  | 'turned_in'
  | 'abandoned';

/**
 * 任务类型枚举
 * - KILL: 击杀任务（需要杀死指定数量的敌人）
 * - COLLECT: 收集任务（需要收集指定数量的物品）
 */
export type QuestType = 'kill' | 'collect';

/**
 * 任务目标接口
 * @property {string} key - 目标键，用于唯一标识此目标
 * @property {QuestType} type - 目标类型，决定任务的完成方式
 * @property {number} target - 目标数量，需要完成的次数
 * @property {string} [itemId] - 物品ID（收集任务专用）
 * @property {string} [enemyId] - 敌人ID（击杀任务专用，UI 层自动从 enemyId 解析怪物名称生成描述文本）
 * @property {string} [locationId] - 地点ID（交互任务专用）
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
 * 任务定义接口
 * 定义任务的静态数据，所有玩家共享
 * @property {string} id - 任务ID，唯一标识
 * @property {string} title - 任务标题，显示给玩家的任务名称
 * @property {string} description - 任务描述，详细说明任务背景和要求
 * @property {QuestType} type - 任务类型，决定任务的主要玩法
 * @property {QuestObjective[]} objectives - 任务目标列表，可能有多个目标需要完成
 * @property {number} levelRequirement - 等级要求，玩家必须达到此等级才能接取
 * @property {number} xpReward - 经验奖励，完成任务后获得的经验值
 * @property {number} goldReward - 金币奖励，完成任务后获得的金币数量
 * @property {InventoryItem[]} [itemRewards] - 物品奖励列表，完成任务后可能获得的物品
 * @property {string} boardId - 任务板ID，任务发布的地点
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
 * 任务目标进度接口
 * 记录玩家在单个任务目标上的进度
 * @property {string} objectiveKey - 目标键，关联到任务定义中的目标
 * @property {number} current - 当前进度，已完成的数量
 * @property {number} target - 目标数量，需要完成的总数量
 */
export interface QuestObjectiveProgress {
  objectiveKey: string;
  current: number;
  target: number;
}

/**
 * 任务实例接口
 * 记录玩家已接取的任务状态和进度（每个玩家独立）
 * @property {string} questId - 任务ID，关联到任务定义
 * @property {QuestStatus} status - 任务状态，当前所处的阶段
 * @property {QuestObjectiveProgress[]} progress - 任务目标进度列表，记录每个目标的完成情况
 * @property {number} acceptedAt - 接受时间戳，玩家接取任务的时间
 * @property {number} [completedAt] - 完成时间戳，玩家完成任务的时间（可选）
 */
export interface QuestInstance {
  questId: string;
  status: QuestStatus;
  progress: QuestObjectiveProgress[];
  acceptedAt: number;
  completedAt?: number;
}

/**
 * 任务服务接口
 * 提供任务管理的核心功能
 */
export interface IQuestService {
  /**
   * 接受任务
   * @param {string} questId - 任务ID
   * @returns {boolean} 是否成功接受
   */
  acceptQuest(questId: string): boolean;

  /**
   * 更新任务进度
   * @param {string} questId - 任务ID
   * @param {string} objectiveKey - 目标键
   * @param {number} [amount] - 增加数量，默认为1
   */
  updateQuestProgress(
    questId: string,
    objectiveKey: string,
    amount?: number
  ): void;

  /**
   * 提交任务（领取奖励）
   * @param {string} questId - 任务ID
   * @returns {boolean} 是否成功提交
   */
  turnInQuest(questId: string): boolean;

  /**
   * 放弃任务
   * @param {string} questId - 任务ID
   * @returns {boolean} 是否成功放弃
   */
  abandonQuest(questId: string): boolean;

  /**
   * 检查任务是否可用（可接取）
   * @param {string} questId - 任务ID
   * @returns {boolean} 是否可用
   */
  isQuestAvailable(questId: string): boolean;

  /**
   * 检查任务是否进行中
   * @param {string} questId - 任务ID
   * @returns {boolean} 是否进行中
   */
  isQuestInProgress(questId: string): boolean;

  /**
   * 检查任务是否完成（可提交）
   * @param {string} questId - 任务ID
   * @returns {boolean} 是否完成
   */
  isQuestCompleted(questId: string): boolean;

  /**
   * 获取任务实例（玩家接取的任务状态）
   * @param {string} questId - 任务ID
   * @returns {QuestInstance | null} 任务实例，如果不存在返回null
   */
  getQuestInstance(questId: string): QuestInstance | null;

  /**
   * 获取任务定义（任务的静态数据）
   * @param {string} questId - 任务ID
   * @returns {QuestDefinition | null} 任务定义，如果不存在返回null
   */
  getQuestDefinition(questId: string): QuestDefinition | null;

  /**
   * 获取所有可用任务列表
   * @returns {string[]} 任务ID列表
   */
  getAvailableQuests(): string[];

  /**
   * 获取所有进行中的任务列表
   * @returns {string[]} 任务ID列表
   */
  getInProgressQuests(): string[];

  /**
   * 获取所有已完成的任务列表
   * @returns {string[]} 任务ID列表
   */
  getCompletedQuests(): string[];

  /**
   * 获取指定任务板上的任务
   * @param {string} boardId - 任务板ID
   * @returns {QuestDefinition[]} 任务定义列表
   */
  getQuestsFromBoard(boardId: string): QuestDefinition[];

  /**
   * 获取指定任务板上可提交的任务
   * @param {string} boardId - 任务板ID
   * @returns {QuestDefinition[]} 任务定义列表
   */
  getQuestsToTurnIn(boardId: string): QuestDefinition[];

  /**
   * 从任务板接受任务
   * @param {string} boardId - 任务板ID
   * @param {string} questId - 任务ID
   * @returns {boolean} 是否成功接受
   */
  acceptQuestFromBoard(boardId: string, questId: string): boolean;

  /**
   * 在任务板提交任务
   * @param {string} boardId - 任务板ID
   * @param {string} questId - 任务ID
   * @returns {boolean} 是否成功提交
   */
  turnInQuestToBoard(boardId: string, questId: string): boolean;

  /** 重置所有任务数据（用于测试或新游戏） */
  reset(): void;
}

/**
 * 任务实例存储接口
 */
export interface QuestInstanceStorage {
  questId: string;
  status: string;
  progress: { objectiveKey: string; current: number; target: number }[];
  acceptedAt: number;
  completedAt?: number;
}

/**
 * 任务定义存储接口
 */
export interface QuestDefinitionStorage {
  id: string;
  title: string;
  description: string;
  type: string;
  objectives: {
    key: string;
    type: string;
    description?: string; // 已废弃，仅用于兼容旧数据
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
 * 任务定义存储格式
 */
export interface QuestConfigStorage {
  id: string;
  title: string;
  description: string;
  type: string;
  objectives: Array<{ key: string; type: string; target: number; [key: string]: unknown }>;
  levelRequirement: number;
  xpReward: number;
  goldReward: number;
  itemRewards?: Array<{ itemId: string; count: number }>;
  boardId: string;
}

/**
 * 角色任务存储格式
 */
export interface CharQuestStorage {
  characterId: string;
  questId: string;
  status: string;
  progress: Array<{ objectiveKey: string; current: number; target: number }>;
  acceptedAt: number;
  completedAt?: number;
}
