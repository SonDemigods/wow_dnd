/**
 * @fileoverview 冒险日志模块服务层
 * @description 提供冒险日志的管理功能，包括日志添加、查询、筛选等
 * @module log
 */
import type { LogEntry, LogType, ILogService } from './types';
import { adventureLogDbService } from './db';

/** 日志变更回调类型 */
export type LogChangeCallback = () => void;

const LOG_TYPE_ICONS: Record<LogType, string> = {
  info: '📜',
  combat: '⚔️',
  quest: '📋',
  item: '📦',
  level: '⬆️',
  death: '💀',
  resurrect: '✨',
  shop: '🛒',
  skill: '✨',
  exploration: '🗺️',
  zone: '📍'
};

export class LogService implements ILogService {
  private logs: LogEntry[] = [];
  private currentCharacterId: string | null = null;
  /** 日志变更订阅者列表 */
  private subscribers: Set<LogChangeCallback> = new Set();

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
   * 订阅日志变更通知
   * 每当 addLog / clearLogs 被调用时，所有订阅者都会收到通知
   * @param callback - 变更回调
   * @returns 取消订阅的函数
   */
  subscribe(callback: LogChangeCallback): () => void {
    this.subscribers.add(callback);
    return () => { this.subscribers.delete(callback); };
  }

  /** 通知所有订阅者日志已变更 */
  private notifyChanged(): void {
    this.subscribers.forEach(cb => cb());
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
    this.notifyChanged();
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
    this.notifyChanged();
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