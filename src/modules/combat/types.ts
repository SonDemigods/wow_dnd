/**
 * @fileoverview 战斗模块类型定义
 * @description 包含战斗状态、战斗动作、战斗日志等相关类型定义
 */

/**
 * 战斗状态枚举
 * - idle: 空闲状态
 * - fighting: 战斗中
 * - ended: 战斗结束
 */
export type CombatState = 'idle' | 'fighting' | 'ended';

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
 * @property {number} [heal] - 生命恢复值
 * @property {boolean} [isCrit] - 是否暴击
 * @property {boolean} [isDodge] - 是否闪避
 * @property {boolean} [isControlled] - 是否因控制效果被跳过
 * @property {string} message - 结果消息
 * @property {AoeHitInfo[]} [aoeHits] - 多目标技能命中信息
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
  /** 多目标技能命中列表（仅技能为 all_enemies 时返回） */
  aoeHits?: AoeHitInfo[];
}

/** 多目标技能命中信息 */
export interface AoeHitInfo {
  enemyId: string;
  enemyName: string;
  damage: number;
  isCrit?: boolean;
  isDodge?: boolean;
}

/**
 * 战斗事件类型枚举
 * - combat_start: 战斗开始
 * - combat_end: 战斗结束
 * - combat_turn_start: 回合开始
 * - combat_turn_end: 回合结束
 * - combat_damage: 伤害
 * - combat_heal: 生命恢复
 * - combat_skill_cast: 技能施法
 * - combat_item: 物品使用
 * - combat_flee: 逃跑
 * - combat_miss: 未命中
 * - combat_critical: 暴击
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
  | 'combat_event';

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
 * @property {number} [heal] - 生命恢复值
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
  isCrit?: boolean;
  isDodge?: boolean;
  message: string;
}

/**
 * 战斗日志存储格式（枚举字段放宽为 string 以兼容 IndexedDB）
 */
export type CombatLogStorage = Omit<CombatLog, 'actorType' | 'eventType' | 'targetType'> & {
  actorType: string;
  eventType: string;
  targetType?: string;
};
