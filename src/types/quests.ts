/**
 * @fileoverview 任务模块类型定义
 * @description 包含任务状态、任务目标、任务进度、任务服务等相关类型定义
 */

/**
 * 任务状态枚举
 */
export enum QuestStatus {
  NOT_AVAILABLE = 'not_available',
  AVAILABLE = 'available',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  TURNED_IN = 'turned_in',
  ABANDONED = 'abandoned',
}

/**
 * 任务类型枚举
 */
export enum QuestType {
  KILL = 'kill',
  COLLECT = 'collect',
  INTERACT = 'interact',
  ESCORT = 'escort',
}

/**
 * 任务目标接口
 * @property {string} key - 目标键
 * @property {QuestType} type - 目标类型
 * @property {string} description - 目标描述
 * @property {number} target - 目标数量
 * @property {string} [itemId] - 物品ID（收集任务）
 * @property {string} [enemyId] - 敌人ID（击杀任务）
 * @property {string} [locationId] - 地点ID（交互任务）
 */
export interface QuestObjective {
  /** 目标键 */
  key: string
  /** 目标类型 */
  type: QuestType
  /** 目标描述 */
  description: string
  /** 目标数量 */
  target: number
  /** 物品ID（收集任务） */
  itemId?: string
  /** 敌人ID（击杀任务） */
  enemyId?: string
  /** 地点ID（交互任务） */
  locationId?: string
}

/**
 * 任务目标进度接口
 * @property {number} current - 当前进度
 * @property {number} target - 目标数量
 */
export interface QuestObjectiveProgress {
  /** 当前进度 */
  current: number
  /** 目标数量 */
  target: number
}

/**
 * 任务进度接口
 */
export interface QuestProgress {
  [objectiveKey: string]: QuestObjectiveProgress
}

/**
 * 任务状态接口
 * @property {string} questKey - 任务键
 * @property {QuestStatus} status - 任务状态
 * @property {QuestProgress} progress - 任务进度
 * @property {number} acceptedAt - 接受时间戳
 * @property {number} [completedAt] - 完成时间戳
 */
export interface QuestState {
  /** 任务键 */
  questKey: string
  /** 任务状态 */
  status: QuestStatus
  /** 任务进度 */
  progress: QuestProgress
  /** 接受时间戳 */
  acceptedAt: number
  /** 完成时间戳 */
  completedAt?: number
}

/**
 * 任务详情接口
 * @property {string} questKey - 任务键
 * @property {string} title - 任务标题
 * @property {string} description - 任务描述
 * @property {QuestType} type - 任务类型
 * @property {QuestObjective[]} objectives - 任务目标列表
 * @property {number} levelRequirement - 等级要求
 * @property {number} xpReward - 经验奖励
 * @property {number} goldReward - 金币奖励
 * @property {ItemReward[]} [itemRewards] - 物品奖励列表
 * @property {string} boardId - 任务板ID
 */
export interface QuestDetails {
  /** 任务键 */
  questKey: string
  /** 任务标题 */
  title: string
  /** 任务描述 */
  description: string
  /** 任务类型 */
  type: QuestType
  /** 任务目标列表 */
  objectives: QuestObjective[]
  /** 等级要求 */
  levelRequirement: number
  /** 经验奖励 */
  xpReward: number
  /** 金币奖励 */
  goldReward: number
  /** 物品奖励列表 */
  itemRewards?: ItemReward[]
  /** 任务板ID */
  boardId: string
}

/**
 * 物品奖励接口
 * @property {string} itemId - 物品ID
 * @property {string} itemName - 物品名称
 * @property {number} quantity - 数量
 * @property {number} [chance] - 掉落几率
 */
export interface ItemReward {
  /** 物品ID */
  itemId: string
  /** 物品名称 */
  itemName: string
  /** 数量 */
  quantity: number
  /** 掉落几率 */
  chance?: number
}

/**
 * 任务服务接口
 * 提供任务管理的核心功能
 */
export interface IQuestService {
  /**
   * 接受任务
   * @param {string} questKey - 任务键
   * @returns {boolean} 是否成功接受
   */
  acceptQuest(questKey: string): boolean

  /**
   * 更新任务进度
   * @param {string} questKey - 任务键
   * @param {string} objectiveKey - 目标键
   * @param {number} [amount] - 增加数量
   */
  updateQuestProgress(questKey: string, objectiveKey: string, amount?: number): void

  /**
   * 提交任务
   * @param {string} questKey - 任务键
   * @returns {boolean} 是否成功提交
   */
  turnInQuest(questKey: string): boolean

  /**
   * 放弃任务
   * @param {string} questKey - 任务键
   * @returns {boolean} 是否成功放弃
   */
  abandonQuest(questKey: string): boolean

  /**
   * 检查任务是否可用
   * @param {string} questKey - 任务键
   * @returns {boolean} 是否可用
   */
  isQuestAvailable(questKey: string): boolean

  /**
   * 检查任务是否进行中
   * @param {string} questKey - 任务键
   * @returns {boolean} 是否进行中
   */
  isQuestInProgress(questKey: string): boolean

  /**
   * 检查任务是否完成
   * @param {string} questKey - 任务键
   * @returns {boolean} 是否完成
   */
  isQuestCompleted(questKey: string): boolean

  /**
   * 获取任务状态
   * @param {string} questKey - 任务键
   * @returns {QuestState | null} 任务状态
   */
  getQuestState(questKey: string): QuestState | null

  /**
   * 获取任务详情
   * @param {string} questKey - 任务键
   * @returns {QuestDetails | null} 任务详情
   */
  getQuestDetails(questKey: string): QuestDetails | null

  /**
   * 获取可用任务列表
   * @returns {string[]} 任务键列表
   */
  getAvailableQuests(): string[]

  /**
   * 获取进行中的任务列表
   * @returns {string[]} 任务键列表
   */
  getInProgressQuests(): string[]

  /**
   * 获取已完成的任务列表
   * @returns {string[]} 任务键列表
   */
  getCompletedQuests(): string[]

  /**
   * 获取任务板上的任务
   * @param {string} boardId - 任务板ID
   * @returns {QuestDetails[]} 任务详情列表
   */
  getQuestsFromBoard(boardId: string): QuestDetails[]

  /**
   * 获取可提交的任务
   * @param {string} boardId - 任务板ID
   * @returns {QuestDetails[]} 任务详情列表
   */
  getQuestsToTurnIn(boardId: string): QuestDetails[]

  /**
   * 从任务板接受任务
   * @param {string} boardId - 任务板ID
   * @param {string} questKey - 任务键
   * @returns {boolean} 是否成功接受
   */
  acceptQuestFromBoard(boardId: string, questKey: string): boolean

  /**
   * 在任务板提交任务
   * @param {string} boardId - 任务板ID
   * @param {string} questKey - 任务键
   * @returns {boolean} 是否成功提交
   */
  turnInQuestToBoard(boardId: string, questKey: string): boolean

  /** 重置任务数据 */
  reset(): void
}

/**
 * 游戏日志条目接口
 * @property {string} id - 日志ID
 * @property {number} timestamp - 时间戳
 * @property {'info' | 'combat' | 'quest' | 'item' | 'level'} type - 日志类型
 * @property {string} message - 日志消息
 * @property {string} [icon] - 日志图标
 */
export interface LogEntry {
  /** 日志ID */
  id: string
  /** 时间戳 */
  timestamp: number
  /** 日志类型 */
  type: 'info' | 'combat' | 'quest' | 'item' | 'level'
  /** 日志消息 */
  message: string
  /** 日志图标 */
  icon?: string
}