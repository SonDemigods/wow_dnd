/**
 * @fileoverview 任务模块类型定义
 * @description 包含任务状态、任务目标、任务实例等相关类型定义
 */

/**
 * 任务状态枚举
 * 定义任务在玩家生命周期中的不同状态
 */
export enum QuestStatus {
  /** 任务不可用（未达到等级要求或前置条件未满足） */
  NOT_AVAILABLE = 'not_available',
  /** 任务可用（可以接取） */
  AVAILABLE = 'available',
  /** 任务进行中（已接取但未完成） */
  IN_PROGRESS = 'in_progress',
  /** 任务已完成（目标达成，等待提交） */
  COMPLETED = 'completed',
  /** 任务已提交（已领取奖励） */
  TURNED_IN = 'turned_in',
  /** 任务已放弃（玩家主动放弃） */
  ABANDONED = 'abandoned',
}

/**
 * 任务类型枚举
 * 定义任务的主要目标类型
 */
export enum QuestType {
  /** 击杀任务（需要杀死指定数量的敌人） */
  KILL = 'kill',
  /** 收集任务（需要收集指定数量的物品） */
  COLLECT = 'collect',
  /** 交互任务（需要与指定NPC或物体交互） */
  INTERACT = 'interact',
  /** 护送任务（需要保护目标到达指定位置） */
  ESCORT = 'escort',
}

/**
 * 任务目标接口
 * 定义单个任务目标的详细信息
 */
export interface QuestObjective {
  /** 目标键，用于唯一标识此目标 */
  key: string
  /** 目标类型，决定任务的完成方式 */
  type: QuestType
  /** 目标描述，显示给玩家的文本 */
  description: string
  /** 目标数量，需要完成的次数 */
  target: number
  /** 物品ID（收集任务专用），需要收集的物品 */
  itemId?: string
  /** 敌人ID（击杀任务专用），需要击杀的敌人 */
  enemyId?: string
  /** 地点ID（交互任务专用），需要交互的地点 */
  locationId?: string
}

/**
 * 物品奖励接口
 * 定义任务完成后可能获得的物品奖励
 */
export interface ItemReward {
  /** 物品ID，对应物品数据中的唯一标识 */
  itemId: string
  /** 物品名称，用于显示 */
  itemName: string
  /** 奖励数量 */
  quantity: number
  /** 掉落几率（0-1之间），默认为1（必掉） */
  chance?: number
}

/**
 * 任务定义接口
 * 定义任务的静态数据，所有玩家共享
 */
export interface QuestDefinition {
  /** 任务ID，唯一标识 */
  id: string
  /** 任务标题，显示给玩家的任务名称 */
  title: string
  /** 任务描述，详细说明任务背景和要求 */
  description: string
  /** 任务类型，决定任务的主要玩法 */
  type: QuestType
  /** 任务目标列表，可能有多个目标需要完成 */
  objectives: QuestObjective[]
  /** 等级要求，玩家必须达到此等级才能接取 */
  levelRequirement: number
  /** 经验奖励，完成任务后获得的经验值 */
  xpReward: number
  /** 金币奖励，完成任务后获得的金币数量 */
  goldReward: number
  /** 物品奖励列表，完成任务后可能获得的物品 */
  itemRewards?: ItemReward[]
  /** 任务板ID，任务发布的地点 */
  boardId: string
}

/**
 * 任务目标进度接口
 * 记录玩家在单个任务目标上的进度
 */
export interface QuestObjectiveProgress {
  /** 目标键，关联到任务定义中的目标 */
  objectiveKey: string
  /** 当前进度，已完成的数量 */
  current: number
  /** 目标数量，需要完成的总数量 */
  target: number
}

/**
 * 任务实例接口
 * 记录玩家已接取的任务状态和进度（每个玩家独立）
 */
export interface QuestInstance {
  /** 任务ID，关联到任务定义 */
  questId: string
  /** 任务状态，当前所处的阶段 */
  status: QuestStatus
  /** 任务目标进度列表，记录每个目标的完成情况 */
  progress: QuestObjectiveProgress[]
  /** 接受时间戳，玩家接取任务的时间 */
  acceptedAt: number
  /** 完成时间戳，玩家完成任务的时间（可选） */
  completedAt?: number
}

/**
 * 任务服务接口
 * 定义任务系统的核心功能方法
 */
export interface IQuestService {
  /**
   * 接受任务
   * @param {string} questId - 任务ID
   * @returns {boolean} 是否成功接受
   */
  acceptQuest(questId: string): boolean

  /**
   * 更新任务进度
   * @param {string} questId - 任务ID
   * @param {string} objectiveKey - 目标键
   * @param {number} [amount] - 增加数量，默认为1
   */
  updateQuestProgress(questId: string, objectiveKey: string, amount?: number): void

  /**
   * 提交任务（领取奖励）
   * @param {string} questId - 任务ID
   * @returns {boolean} 是否成功提交
   */
  turnInQuest(questId: string): boolean

  /**
   * 放弃任务
   * @param {string} questId - 任务ID
   * @returns {boolean} 是否成功放弃
   */
  abandonQuest(questId: string): boolean

  /**
   * 检查任务是否可用（可接取）
   * @param {string} questId - 任务ID
   * @returns {boolean} 是否可用
   */
  isQuestAvailable(questId: string): boolean

  /**
   * 检查任务是否进行中
   * @param {string} questId - 任务ID
   * @returns {boolean} 是否进行中
   */
  isQuestInProgress(questId: string): boolean

  /**
   * 检查任务是否完成（可提交）
   * @param {string} questId - 任务ID
   * @returns {boolean} 是否完成
   */
  isQuestCompleted(questId: string): boolean

  /**
   * 获取任务实例（玩家接取的任务状态）
   * @param {string} questId - 任务ID
   * @returns {QuestInstance | null} 任务实例，如果不存在返回null
   */
  getQuestInstance(questId: string): QuestInstance | null

  /**
   * 获取任务定义（任务的静态数据）
   * @param {string} questId - 任务ID
   * @returns {QuestDefinition | null} 任务定义，如果不存在返回null
   */
  getQuestDefinition(questId: string): QuestDefinition | null

  /**
   * 获取所有可用任务列表
   * @returns {string[]} 任务ID列表
   */
  getAvailableQuests(): string[]

  /**
   * 获取所有进行中的任务列表
   * @returns {string[]} 任务ID列表
   */
  getInProgressQuests(): string[]

  /**
   * 获取所有已完成的任务列表
   * @returns {string[]} 任务ID列表
   */
  getCompletedQuests(): string[]

  /**
   * 获取指定任务板上的任务
   * @param {string} boardId - 任务板ID
   * @returns {QuestDefinition[]} 任务定义列表
   */
  getQuestsFromBoard(boardId: string): QuestDefinition[]

  /**
   * 获取指定任务板上可提交的任务
   * @param {string} boardId - 任务板ID
   * @returns {QuestDefinition[]} 任务定义列表
   */
  getQuestsToTurnIn(boardId: string): QuestDefinition[]

  /**
   * 从任务板接受任务
   * @param {string} boardId - 任务板ID
   * @param {string} questId - 任务ID
   * @returns {boolean} 是否成功接受
   */
  acceptQuestFromBoard(boardId: string, questId: string): boolean

  /**
   * 在任务板提交任务
   * @param {string} boardId - 任务板ID
   * @param {string} questId - 任务ID
   * @returns {boolean} 是否成功提交
   */
  turnInQuestToBoard(boardId: string, questId: string): boolean

  /** 重置所有任务数据（用于测试或新游戏） */
  reset(): void
}
