/**
 * @fileoverview 冒险日志模块服务层
 * @description 提供冒险日志的管理功能，包括日志添加、查询、筛选等
 * @module log
 */
import type { LogEntry, LogType, ILogService } from './types';
import { adventureLogDbService } from './db';

const LOG_TYPE_ICONS: Record<LogType, string> = {
  info: '📜',
  combat: '⚔️',
  quest: '📋',
  item: '📦',
  level: '⬆️'
};

export class LogService implements ILogService {
  private logs: LogEntry[] = [];
  private currentCharacterId: string | null = null;

  /**
   * 初始化日志服务
   * 从数据库加载指定角色的冒险日志记录
   * @param characterId - 角色ID
   */
  async init(characterId: string): Promise<void> {
    this.currentCharacterId = characterId;
    const stored = await adventureLogDbService.getAdventureLog(characterId);
    this.logs = stored?.logs || [];
  }

  /**
   * 添加一条日志记录
   * 如果日志条目不包含图标，则根据日志类型自动分配默认图标
   * @param entry - 日志条目
   */
  addLog(entry: LogEntry): void {
    const logEntry: LogEntry = {
      ...entry,
      icon: entry.icon || LOG_TYPE_ICONS[entry.type]
    };
    this.logs.unshift(logEntry);
    this.saveLogs();
  }

  /**
   * 获取所有日志记录
   * @returns 日志列表的副本
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * 按类型筛选日志记录
   * @param type - 日志类型：'info' | 'combat' | 'quest' | 'item' | 'level'
   * @returns 匹配类型的日志列表
   */
  getLogsByType(type: LogType): LogEntry[] {
    return this.logs.filter(log => log.type === type);
  }

  /**
   * 清空所有日志记录并持久化保存
   */
  clearLogs(): void {
    this.logs = [];
    this.saveLogs();
  }

  /**
   * 获取当前日志总条数
   * @returns 日志数量
   */
  getLogCount(): number {
    return this.logs.length;
  }

  /**
   * 生成唯一的日志ID
   * @returns 基于时间戳和随机字符串的唯一ID
   */
  generateLogId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveLogs(): Promise<void> {
    if (this.currentCharacterId) {
      await adventureLogDbService.saveAdventureLog(this.currentCharacterId, this.logs);
    }
  }
}

export const logService = new LogService();