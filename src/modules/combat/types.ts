/**
 * @fileoverview 战斗模块类型定义
 * @description 包含战斗状态、战斗动作、战斗日志、战斗服务等相关类型定义
 */

import type { EnemyInstance } from '../enemies/types';
import type { InventoryItem } from '../inventory/types';
import type { SkillType } from '../skills/types';

/**
 * 战斗状态枚举
 * - idle: 空闲状态
 * - preparing: 准备战斗
 * - fighting: 战斗中
 * - ended: 战斗结束
 */
export type CombatState = 'idle' | 'preparing' | 'fighting' | 'ended';

/**
 * 战斗结果枚举
 * - victory: 胜利
 * - defeat: 失败
 * - fled: 逃跑
 */
export type CombatResult = 'victory' | 'defeat' | 'fled';

/**
 * 战斗动作类型枚举
 * - attack: 普通攻击
 * - item: 使用物品
 * - flee: 逃跑
 * - skill: 使用技能
 */
export type CombatActionType = 'attack' | 'item' | 'flee' | 'skill';

/**
 * 战斗动作接口
 * @property {CombatActionType} type - 动作类型
 * @property {string} [itemId] - 物品ID
 * @property {string} [skillId] - 技能ID
 * @property {'player' | 'enemy'} [target] - 目标
 */
export interface CombatAction {
  type: CombatActionType;
  itemId?: string;
  skillId?: string;
  target?: 'player' | 'enemy';
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
  success: boolean;
  type: CombatActionType;
  damage?: number;
  heal?: number;
  isCrit?: boolean;
  isDodge?: boolean;
  message: string;
}

/**
 * 战斗伤害事件接口
 * @property {CombatActionType} action - 动作类型
 * @property {'player' | 'enemy'} target - 目标
 * @property {number} amount - 伤害量
 * @property {boolean} isCrit - 是否暴击
 * @property {boolean} isDodge - 是否闪避
 */
export interface CombatDamageEvent {
  action: CombatActionType;
  target: 'player' | 'enemy';
  amount: number;
  isCrit: boolean;
  isDodge: boolean;
}

/**
 * 战斗开始事件接口
 * @property {EnemyInstance} enemy - 敌人
 */
export interface CombatStartEvent {
  enemy: EnemyInstance;
}

/**
 * 战斗结束事件接口
 * @property {CombatResult} result - 战斗结果
 * @property {EnemyInstance} enemy - 敌人
 * @property {number} expGained - 获得经验
 * @property {InventoryItem[]} [loot] - 掉落物品
 */
export interface CombatEndEvent {
  result: CombatResult;
  enemy: EnemyInstance;
  expGained: number;
  loot?: InventoryItem[];
}

/**
 * 战斗事件类型枚举
 * - combat_start: 战斗开始
 * - combat_end: 战斗结束
 * - combat_turn_start: 回合开始
 * - combat_turn_end: 回合结束
 * - combat_player_action: 玩家动作
 * - combat_enemy_action: 敌人动作
 * - combat_damage: 伤害
 * - combat_heal: 治疗
 * - combat_skill_cast: 技能施法
 * - combat_item: 物品使用
 * - combat_flee: 逃跑
 * - combat_miss: 未命中
 * - combat_critical: 暴击
 * - combat_death: 死亡
 */
export type CombatEventType =
  | 'combat_start'
  | 'combat_end'
  | 'combat_turn_start'
  | 'combat_turn_end'
  | 'combat_player_action'
  | 'combat_enemy_action'
  | 'combat_damage'
  | 'combat_heal'
  | 'combat_skill_cast'
  | 'combat_item'
  | 'combat_flee'
  | 'combat_miss'
  | 'combat_critical'
  | 'combat_death';

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
  combatId: string;
  battleLogId: string;
  timestamp: number;
  turn: number;
  actorType: 'player' | 'enemy' | 'system';
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
  isCrit: boolean;
  isDodge: boolean;
  message: string;
}

/**
 * 技能战斗效果接口
 * @property {string} skillId - 技能ID
 * @property {string} skillName - 技能名称
 * @property {SkillType} effectType - 效果类型
 * @property {'self' | 'enemy'} targetType - 目标类型
 * @property {{base: number, minMultiplier: number, maxMultiplier: number, type: 'physical' | 'magic' | 'true'}} [damage] - 伤害配置
 * @property {{base: number, multiplier: number}} [heal] - 治疗配置
 * @property {number} manaCost - 法力消耗
 */
export interface SkillCombatEffect {
  skillId: string;
  skillName: string;
  effectType: SkillType;
  targetType: 'self' | 'enemy';
  damage?: {
    base: number;
    minMultiplier: number;
    maxMultiplier: number;
    type: 'physical' | 'magic' | 'true';
  };
  heal?: {
    base: number;
    multiplier: number;
  };
  manaCost: number;
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
  success: boolean;
  skillId: string;
  skillName: string;
  damage?: number;
  heal?: number;
  message: string;
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
  getState(): CombatState;

  /**
   * 获取敌人
   * @returns {Enemy | null} 敌人
   */
  getEnemy(): EnemyInstance | null;

  /**
   * 获取当前回合
   * @returns {'player' | 'enemy'} 当前回合
   */
  getTurn(): 'player' | 'enemy';

  /**
   * 开始战斗
   * @param {Enemy} enemy - 敌人
   */
  startCombat(enemy: EnemyInstance): void;

  /**
   * 玩家行动
   * @param {CombatAction} action - 行动
   * @returns {CombatActionResult} 行动结果
   */
  playerAction(action: CombatAction): CombatActionResult;

  /** 敌人回合 */
  enemyTurn(): void;

  /**
   * 结束战斗
   * @param {CombatResult} result - 战斗结果
   */
  endCombat(result: CombatResult): void;

  /**
   * 检查是否在战斗中
   * @returns {boolean} 是否在战斗中
   */
  isInCombat(): boolean;

  /**
   * 获取战斗日志
   * @returns {CombatLog[]} 战斗日志
   */
  getCombatLog(): CombatLog[];

  /**
   * 施放技能
   * @param {string} skillId - 技能ID
   * @param {'self' | 'enemy'} targetType - 目标类型
   * @returns {SkillCastResult} 技能施放结果
   */
  castSkill(skillId: string, targetType: 'self' | 'enemy'): SkillCastResult;
}
