/**
 * @fileoverview 战斗模块类型定义
 * @description 包含战斗状态、战斗动作、战斗日志、战斗服务等相关类型定义
 */

import type { Enemy } from './enemies'

/**
 * 战斗状态枚举
 */
export type CombatState = 'idle' | 'preparing' | 'fighting' | 'ended'

/**
 * 战斗结果枚举
 */
export type CombatResult = 'victory' | 'defeat' | 'fled'

/**
 * 战斗动作类型枚举
 */
export type CombatActionType = 'attack' | 'item' | 'flee' | 'skill'

/**
 * 战斗动作接口
 * @property {CombatActionType} type - 动作类型
 * @property {string} [itemId] - 物品ID
 * @property {string} [skillId] - 技能ID
 * @property {'player' | 'enemy'} [target] - 目标
 */
export interface CombatAction {
  /** 动作类型 */
  type: CombatActionType
  /** 物品ID */
  itemId?: string
  /** 技能ID */
  skillId?: string
  /** 目标 */
  target?: 'player' | 'enemy'
}

/**
 * 战斗动作结果接口
 * @property {boolean} success - 是否成功
 * @property {CombatActionType} type - 动作类型
 * @property {number} [damage] - 伤害值
 * @property {number} [heal] - 治疗值
 * @property {boolean} [isCrit] - 是否暴击
 * @property {boolean} [isDodge] - 是否闪避
 * @property {string} message - 结果消息
 */
export interface CombatActionResult {
  /** 是否成功 */
  success: boolean
  /** 动作类型 */
  type: CombatActionType
  /** 伤害值 */
  damage?: number
  /** 治疗值 */
  heal?: number
  /** 是否暴击 */
  isCrit?: boolean
  /** 是否闪避 */
  isDodge?: boolean
  /** 结果消息 */
  message: string
}

/**
 * 战斗日志条目接口
 * @property {number} turn - 回合数
 * @property {'player' | 'enemy'} actor - 行动者
 * @property {CombatActionType} action - 动作类型
 * @property {CombatActionResult} result - 动作结果
 * @property {number} timestamp - 时间戳
 */
export interface CombatLogEntry {
  /** 回合数 */
  turn: number
  /** 行动者 */
  actor: 'player' | 'enemy'
  /** 动作类型 */
  action: CombatActionType
  /** 动作结果 */
  result: CombatActionResult
  /** 时间戳 */
  timestamp: number
}

/**
 * 战斗伤害事件接口
 * @property {'player' | 'enemy'} target - 目标
 * @property {number} amount - 伤害量
 * @property {boolean} isCrit - 是否暴击
 * @property {boolean} isDodge - 是否闪避
 */
export interface CombatDamageEvent {
  /** 目标 */
  target: 'player' | 'enemy'
  /** 伤害量 */
  amount: number
  /** 是否暴击 */
  isCrit: boolean
  /** 是否闪避 */
  isDodge: boolean
}

/**
 * 战斗开始事件接口
 * @property {Enemy} enemy - 敌人
 */
export interface CombatStartEvent {
  /** 敌人 */
  enemy: Enemy
}

/**
 * 战斗结束事件接口
 * @property {CombatResult} result - 战斗结果
 * @property {Enemy} enemy - 敌人
 * @property {number} expGained - 获得经验
 * @property {any[]} [loot] - 掉落物品
 */
export interface CombatEndEvent {
  /** 战斗结果 */
  result: CombatResult
  /** 敌人 */
  enemy: Enemy
  /** 获得经验 */
  expGained: number
  /** 掉落物品 */
  loot?: any[]
}

/**
 * 战斗事件类型枚举
 */
export type CombatEventType = 
  | 'attack' | 'skill_cast' | 'heal' | 'damage'
  | 'dodge' | 'crit' | 'block' | 'flee' | 'victory' | 'defeat'
  | 'combat_start' | 'combat_end'

/**
 * 战斗日志接口
 * @property {string} combatId - 战斗ID
 * @property {string} battleLogId - 日志ID
 * @property {number} timestamp - 时间戳
 * @property {number} turn - 回合数
 * @property {'player' | 'enemy' | 'system'} actorType - 行动者类型
 * @property {string} actorId - 行动者ID
 * @property {string} actorName - 行动者名称
 * @property {CombatEventType} eventType - 事件类型
 * @property {'player' | 'enemy'} [targetType] - 目标类型
 * @property {string} [targetId] - 目标ID
 * @property {string} [targetName] - 目标名称
 * @property {string} [skillId] - 技能ID
 * @property {string} [skillName] - 技能名称
 * @property {number} [damage] - 伤害值
 * @property {number} [heal] - 治疗值
 * @property {boolean} isCrit - 是否暴击
 * @property {boolean} isDodge - 是否闪避
 * @property {string} message - 消息
 */
export interface CombatLog {
  /** 战斗ID */
  combatId: string
  /** 日志ID */
  battleLogId: string
  /** 时间戳 */
  timestamp: number
  /** 回合数 */
  turn: number
  /** 行动者类型 */
  actorType: 'player' | 'enemy' | 'system'
  /** 行动者ID */
  actorId: string
  /** 行动者名称 */
  actorName: string
  /** 事件类型 */
  eventType: CombatEventType
  /** 目标类型 */
  targetType?: 'player' | 'enemy'
  /** 目标ID */
  targetId?: string
  /** 目标名称 */
  targetName?: string
  /** 技能ID */
  skillId?: string
  /** 技能名称 */
  skillName?: string
  /** 伤害值 */
  damage?: number
  /** 治疗值 */
  heal?: number
  /** 是否暴击 */
  isCrit: boolean
  /** 是否闪避 */
  isDodge: boolean
  /** 消息 */
  message: string
}

/**
 * 技能效果类型枚举
 */
export type SkillEffectType = 'damage' | 'heal'

/**
 * 技能战斗效果接口
 * @property {string} skillId - 技能ID
 * @property {string} skillName - 技能名称
 * @property {SkillEffectType} effectType - 效果类型
 * @property {'self' | 'enemy'} targetType - 目标类型
 * @property {{base: number, minMultiplier: number, maxMultiplier: number, type: 'physical' | 'magic' | 'true'}} [damage] - 伤害配置
 * @property {{base: number, multiplier: number}} [heal] - 治疗配置
 * @property {number} manaCost - 法力消耗
 */
export interface SkillCombatEffect {
  /** 技能ID */
  skillId: string
  /** 技能名称 */
  skillName: string
  /** 效果类型 */
  effectType: SkillEffectType
  /** 目标类型 */
  targetType: 'self' | 'enemy'
  /** 伤害配置 */
  damage?: {
    base: number
    minMultiplier: number
    maxMultiplier: number
    type: 'physical' | 'magic' | 'true'
  }
  /** 治疗配置 */
  heal?: {
    base: number
    multiplier: number
  }
  /** 法力消耗 */
  manaCost: number
}

/**
 * 技能施放结果接口
 * @property {boolean} success - 是否成功
 * @property {string} skillId - 技能ID
 * @property {string} skillName - 技能名称
 * @property {number} [damage] - 伤害值
 * @property {number} [heal] - 治疗值
 * @property {string} message - 结果消息
 */
export interface SkillCastResult {
  /** 是否成功 */
  success: boolean
  /** 技能ID */
  skillId: string
  /** 技能名称 */
  skillName: string
  /** 伤害值 */
  damage?: number
  /** 治疗值 */
  heal?: number
  /** 结果消息 */
  message: string
}

/**
 * 战斗日志存储接口
 * @property {string} id - 存储ID
 * @property {CombatLog[]} combatHistory - 战斗历史
 * @property {number} maxHistoryCount - 最大历史记录数
 * @property {number} createdAt - 创建时间戳
 * @property {number} updatedAt - 更新时间戳
 */
export interface CombatLogStorage {
  /** 存储ID */
  id: string
  /** 战斗历史 */
  combatHistory: CombatLog[]
  /** 最大历史记录数 */
  maxHistoryCount: number
  /** 创建时间戳 */
  createdAt: number
  /** 更新时间戳 */
  updatedAt: number
}

/**
 * 战斗服务接口
 * 提供战斗管理的核心功能
 */
export interface ICombatService {
  /**
   * 获取战斗状态
   * @returns {CombatState} 战斗状态
   */
  getState(): CombatState

  /**
   * 获取敌人
   * @returns {Enemy | null} 敌人
   */
  getEnemy(): Enemy | null

  /**
   * 获取当前回合
   * @returns {'player' | 'enemy'} 当前回合
   */
  getTurn(): 'player' | 'enemy'

  /**
   * 开始战斗
   * @param {Enemy} enemy - 敌人
   */
  startCombat(enemy: Enemy): void

  /**
   * 玩家行动
   * @param {CombatAction} action - 行动
   * @returns {CombatActionResult} 行动结果
   */
  playerAction(action: CombatAction): CombatActionResult

  /** 敌人回合 */
  enemyTurn(): void

  /**
   * 结束战斗
   * @param {CombatResult} result - 战斗结果
   */
  endCombat(result: CombatResult): void

  /**
   * 检查是否在战斗中
   * @returns {boolean} 是否在战斗中
   */
  isInCombat(): boolean

  /**
   * 获取战斗日志
   * @returns {CombatLogEntry[]} 战斗日志
   */
  getCombatLog(): CombatLogEntry[]

  /**
   * 施放技能
   * @param {string} skillId - 技能ID
   * @param {'self' | 'enemy'} targetType - 目标类型
   * @returns {SkillCastResult} 技能施放结果
   */
  castSkill(skillId: string, targetType: 'self' | 'enemy'): SkillCastResult
}