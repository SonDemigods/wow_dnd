/**
 * @fileoverview 探索模块类型定义
 * @description 包含网格状态、探索事件、区域配置等相关类型定义
 */

/**
 * 网格状态枚举
 * - unexplored: 未探索
 * - revealed: 已揭示
 * - used: 已使用
 * - camp: 营地
 * - shop: 商店
 * - board: 任务板
 * - boss: BOSS
 */
export type GridStatus = 'unexplored' | 'revealed' | 'used' | 'camp' | 'shop' | 'board' | 'boss'

/**
 * 网格事件类型枚举
 * - monster: 怪物
 * - item: 物品
 * - trap: 陷阱
 * - event: 事件
 * - empty: 空
 * - camp: 营地
 * - shop: 商店
 * - board: 任务板
 * - boss: BOSS
 */
export type GridEventType = 'monster' | 'item' | 'trap' | 'event' | 'empty' | 'camp' | 'shop' | 'board' | 'boss'

/**
 * 网格单元格接口
 * @property {number} x - X坐标
 * @property {number} y - Y坐标
 * @property {GridStatus} status - 单元格状态
 * @property {GridEventType} [eventType] - 事件类型
 * @property {Object} [eventData] - 事件数据
 */
export interface GridCell {
  x: number
  y: number
  status: GridStatus
  eventType?: GridEventType
  eventData?: {
    shopId?: string
    boardId?: string
    monsterId?: string
    itemId?: string
    trapId?: string
  }
}

/**
 * 探索单元格接口
 * @property {number} x - X坐标
 * @property {number} y - Y坐标
 * @property {string} type - 单元格类型
 * @property {boolean} explored - 是否已探索
 * @property {boolean} accessible - 是否可访问
 * @property {boolean} visited - 是否已访问
 * @property {string} [monsterId] - 怪物ID
 */
export interface ExplorationCell {
  x: number
  y: number
  type: string
  explored: boolean
  accessible: boolean
  visited: boolean
  /** 事件是否已完成（战斗胜利、宝箱已开等），已完成则褪色显示 */
  completed?: boolean
  monsterId?: string
}

/**
 * 探索事件选项接口
 * @property {string} id - 选项ID
 * @property {string} text - 选项文本
 */
export interface ExplorationEventChoice {
  id: string
  text: string
}

/**
 * 探索事件接口
 * @property {string} title - 事件标题
 * @property {string} description - 事件描述
 * @property {ExplorationEventChoice[]} [choices] - 事件选项列表
 */
export interface ExplorationEvent {
  title: string
  description: string
  choices?: ExplorationEventChoice[]
}

/**
 * 探索状态接口
 * @property {string | null} currentAreaId - 当前区域ID
 * @property {ExplorationCell[][]} grid - 网格数据
 * @property {boolean} campUsed - 营地是否已使用
 * @property {Object} playerPosition - 玩家位置
 * @property {number} visitedCells - 已访问单元格数量
 * @property {number} remainingMoves - 剩余移动次数
 * @property {boolean} bossDefeated - BOSS是否被击败
 * @property {boolean} explorationComplete - 探索是否完成
 */
export interface ExplorationState {
  currentAreaId: string | null
  grid: ExplorationCell[][]
  campUsed: boolean
  playerPosition: { x: number; y: number }
  visitedCells: number
  remainingMoves: number
  bossDefeated: boolean
  explorationComplete: boolean
}

/**
 * 网格事件概率接口
 * @property {number} monster - 怪物事件概率
 * @property {number} item - 物品事件概率
 * @property {number} trap - 陷阱事件概率
 * @property {number} event - 事件概率
 * @property {number} empty - 空事件概率
 */
export interface GridEventProbability {
  monster: number
  item: number
  trap: number
  event: number
  empty: number
}

/**
 * 区域配置接口
 * @property {string} areaId - 区域ID
 * @property {string} name - 区域名称
 * @property {number} level - 区域等级
 * @property {GridEventProbability} eventProbability - 事件概率配置
 * @property {string[]} monsterPool - 怪物池
 * @property {string[]} bossPool - BOSS池
 * @property {string[]} itemPool - 物品池
 */
export interface AreaConfig {
  areaId: string
  name: string
  level: number
  eventProbability: GridEventProbability
  monsterPool: string[]
  bossPool: string[]
  itemPool: string[]
}

/**
 * 移动结果接口
 * @property {boolean} success - 是否成功
 * @property {string} [message] - 结果消息
 * @property {Object} [rewards] - 奖励
 */
export interface MoveResult {
  success: boolean
  message?: string
  rewards?: {
    gold: number
    exp: number
  }
}

/**
 * 事件选项结果接口
 * @property {boolean} success - 是否成功
 * @property {string} message - 结果消息
 */
export interface EventChoiceResult {
  success: boolean
  message: string
}

/**
 * 随机事件效果类型
 * - heal: 治疗
 * - mana: 回蓝
 * - exp: 经验
 * - damage: 伤害
 * - mpLoss: 法力损失
 * - gold: 金币
 */
export type RandomEventEffectType = 'heal' | 'mana' | 'exp' | 'damage' | 'mpLoss' | 'gold';

/**
 * 随机事件结果接口
 * @property {string} message - 事件消息
 * @property {string} icon - 事件图标
 * @property {{ type: RandomEventEffectType; amount: number }} effect - 事件产生的效果
 */
export interface RandomEventResult {
  message: string;
  icon: string;
  effect: { type: RandomEventEffectType; amount: number };
}

/**
 * 网格生成配置参数接口
 * @property {number} [size] - 网格尺寸（默认 10）
 * @property {GridEventProbability} eventProbability - 事件概率分布
 * @property {string[]} monsterPool - 普通怪物池
 * @property {string[]} bossPool - Boss 怪物池
 * @property {string[]} questNormalMonsters - 任务所需的普通怪物列表
 */
export interface GridGenerationConfig {
  /** 网格尺寸（默认 10） */
  size?: number;
  /** 事件概率分布 */
  eventProbability: GridEventProbability;
  /** 普通怪物池（怪物 ID 列表） */
  monsterPool: string[];
  /** Boss 怪物池（Boss ID 列表） */
  bossPool: string[];
  /** 任务所需的普通怪物列表（优先放置） */
  questNormalMonsters: string[];
}

/**
 * 探索 UI 回调接口 —— 供 GameMain 等 UI 组件注册
 */
export interface ExplorationUICallbacks {
  onCellExplored?: (data: { cellType?: string; interactionId?: string }) => void;
  onBattleTriggered?: (data: { eventData: { monsterId: string } }) => void;
  onItemFound?: (data: { itemId: string; count: number; itemName: string }) => void;
  onTrapTriggered?: (data: { damage: number; trapType: string }) => void;
  onRandomEvent?: (data: { message: string; icon: string }) => void;
}

/**
 * 探索服务接口
 * 提供探索管理的核心功能
 */
export interface IExplorationService {
  /**
   * 获取探索状态
   * @returns {ExplorationState} 探索状态
   */
  getState(): ExplorationState

  /**
   * 进入区域
   * @param {string} areaId - 区域ID
   */
  enterArea(areaId: string): Promise<void>

  /**
   * 生成网格
   */
  generateGrid(): void

  /**
   * 移动玩家
   * @param {'up' | 'down' | 'left' | 'right'} direction - 移动方向
   * @returns {MoveResult} 移动结果
   */
  movePlayer(direction: 'up' | 'down' | 'left' | 'right'): MoveResult

  /**
   * 检查是否可以移动
   * @param {'up' | 'down' | 'left' | 'right'} direction - 移动方向
   * @returns {boolean} 是否可以移动
   */
  canMove(direction: 'up' | 'down' | 'left' | 'right'): boolean

  /**
   * 处理事件选项
   * @param {string} choiceId - 选项ID
   * @returns {EventChoiceResult} 选项结果
   */
  handleEventChoice(choiceId: string): EventChoiceResult

  /**
   * 获取网格单元格
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @returns {GridCell | null} 网格单元格
   */
  getGrid(x: number, y: number): GridCell | null

  /**
   * 揭示网格
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @returns {boolean} 是否成功揭示
   */
  revealGrid(x: number, y: number): Promise<boolean>

  /**
   * 使用营地
   * @returns {boolean} 是否成功使用
   */
  useCamp(): boolean

  /**
   * 触发战斗
   * @param {string} monsterId - 怪物ID
   */
  triggerBattle(monsterId: string): void

  /**
   * 处理战斗结果
   * @param {boolean} victory - 是否胜利
   */
  onBattleResult(victory: boolean): void

  /**
   * 获取当前区域ID
   * @returns {string | null} 当前区域ID
   */
  getCurrentAreaId(): string | null

  /**
   * 重置探索数据
   */
  reset(): void;
}

/**
 * 探索进度存储格式
 */
export interface ExplorationStorage {
  characterId: string;
  currentAreaId: string | null;
  /** 当前探索网格中分配的商店ID */
  assignedShopId?: string;
  /** 旧版本兼容字段 */
  currentShopId?: string;
  grid: Array<Array<{ x: number; y: number; type: string; explored: boolean; accessible: boolean; visited: boolean; [key: string]: unknown }>>;
  playerPosition: { x: number; y: number };
  visitedCells: number;
  remainingMoves: number;
  bossDefeated: boolean;
  explorationComplete: boolean;
  campUsed: boolean;
  updatedAt?: number;
}
