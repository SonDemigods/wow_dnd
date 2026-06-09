/**
 * @fileoverview 冒险日志模块类型定义
 * @description 包含游戏日志、冒险日志等相关类型定义
 */

/**
 * 日志类型枚举
 * - info: 普通信息
 * - combat: 战斗日志（战斗开始、胜利、失败、逃跑）
 * - quest: 任务日志（接取、完成、提交、放弃）
 * - item: 物品日志（获得、使用、丢弃、装备、卸下）
 * - level: 升级日志
 * - death: 死亡日志
 * - resurrect: 复活日志
 * - shop: 商店交易日志（购买、出售）
 * - skill: 技能日志（学习、施放）
 * - exploration: 探索日志（开始、结束、营地使用）
 * - zone: 区域进入日志
 */
export type LogType = 'info' | 'combat' | 'quest' | 'item' | 'level' | 'death' | 'resurrect' | 'shop' | 'skill' | 'exploration' | 'zone';

/**
 * 游戏日志条目接口
 * @property {string} id - 日志ID
 * @property {number} timestamp - 时间戳
 * @property {LogType} type - 日志类型
 * @property {string} message - 日志消息
 * @property {string} [icon] - 日志图标
 */
export interface LogEntry {
  id: string;
  timestamp: number;
  type: LogType;
  message: string;
  icon?: string;
}

/**
 * 冒险日志服务接口
 * 提供冒险日志管理的核心功能
 */
export interface ILogService {
  /**
   * 添加日志条目
   * @param {LogEntry} entry - 日志条目
   */
  addLog(entry: LogEntry): void;

  /**
   * 获取日志列表
   * @returns {LogEntry[]} 日志列表
   */
  getLogs(): LogEntry[];

  /**
   * 根据类型筛选日志
   * @param {LogType} type - 日志类型
   * @returns {LogEntry[]} 筛选后的日志列表
   */
  getLogsByType(type: LogType): LogEntry[];

  /** 清空日志 */
  clearLogs(): void;

  /**
   * 获取日志数量
   * @returns {number} 日志数量
   */
  getLogCount(): number;

  /**
   * 生成日志ID
   * @returns {string} 日志ID
   */
  generateLogId(): string;
}
