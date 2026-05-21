/**
 * @fileoverview 探索模块类型定义
 * @description 包含网格单元、探索状态、区域配置、探索服务等相关类型定义
 */

/**
 * 网格状态枚举
 */
export type GridStatus = 'unexplored' | 'revealed' | 'used' | 'camp' | 'shop' | 'board' | 'boss'

/**
 * 网格事件类型枚举
 */
export type GridEventType = 'monster' | 'item' | 'trap' | 'empty' | 'camp' | 'shop' | 'board' | 'boss'

/**
 * 网格单元接口
 * @property {number} x - X坐标
 * @property {number} y - Y坐标
 * @property {GridStatus} status - 网格状态
 * @property {GridEventType} [eventType] - 事件类型
 * @property {{shopId?: string, boardId?: string, monsterId?: string, itemId?: string, trapId?: string}} [eventData] - 事件数据
 */
export interface GridCell {
  /** X坐标 */
  x: number
  /** Y坐标 */
  y: number
  /** 网格状态 */
  status: GridStatus
  /** 事件类型 */
  eventType?: GridEventType
  /** 事件数据 */
  eventData?: {
    /** 商店ID */
    shopId?: string
    /** 任务板ID */
    boardId?: string
    /** 怪物ID */
    monsterId?: string
    /** 物品ID */
    itemId?: string
    /** 陷阱ID */
    trapId?: string
  }
}

/**
 * 探索状态接口
 * @property {string | null} currentAreaId - 当前区域ID
 * @property {GridCell[][]} grid - 网格数据
 * @property {boolean} campUsed - 是否使用过营地
 */
export interface ExplorationState {
  /** 当前区域ID */
  currentAreaId: string | null
  /** 网格数据 */
  grid: GridCell[][]
  /** 是否使用过营地 */
  campUsed: boolean
}

/**
 * 网格事件概率接口
 * @property {number} monster - 怪物概率
 * @property {number} item - 物品概率
 * @property {number} trap - 陷阱概率
 * @property {number} empty - 空概率
 */
export interface GridEventProbability {
  /** 怪物概率 */
  monster: number
  /** 物品概率 */
  item: number
  /** 陷阱概率 */
  trap: number
  /** 空概率 */
  empty: number
}

/**
 * 区域配置接口
 * @property {string} areaId - 区域ID
 * @property {string} name - 区域名称
 * @property {number} level - 区域等级
 * @property {GridEventProbability} eventProbability - 事件概率
 * @property {string[]} monsterPool - 怪物池
 * @property {string[]} bossPool - BOSS池
 * @property {string[]} itemPool - 物品池
 */
export interface AreaConfig {
  /** 区域ID */
  areaId: string
  /** 区域名称 */
  name: string
  /** 区域等级 */
  level: number
  /** 事件概率 */
  eventProbability: GridEventProbability
  /** 怪物池 */
  monsterPool: string[]
  /** BOSS池 */
  bossPool: string[]
  /** 物品池 */
  itemPool: string[]
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
  enterArea(areaId: string): void

  /**
   * 获取指定位置的网格
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @returns {GridCell | null} 网格单元
   */
  getGrid(x: number, y: number): GridCell | null

  /**
   * 揭示网格
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @returns {boolean} 是否成功揭示
   */
  revealGrid(x: number, y: number): boolean

  /**
   * 使用营地
   * @returns {boolean} 是否成功使用
   */
  useCamp(): boolean

  /**
   * 触发商店交互
   * @param {string} shopId - 商店ID
   */
  triggerShopInteraction(shopId: string): void

  /**
   * 触发任务板交互
   * @param {string} boardId - 任务板ID
   */
  triggerBoardInteraction(boardId: string): void

  /**
   * 触发战斗
   * @param {string} monsterId - 怪物ID
   */
  triggerBattle(monsterId: string): void

  /**
   * 获取当前区域ID
   * @returns {string | null} 当前区域ID
   */
  getCurrentAreaId(): string | null

  /** 重置探索数据 */
  reset(): void
}