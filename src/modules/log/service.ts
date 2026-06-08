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

  async init(characterId: string): Promise<void> {
    this.currentCharacterId = characterId;
    const stored = await adventureLogDbService.getAdventureLog(characterId);
    this.logs = stored?.logs || [];
  }

  addLog(entry: LogEntry): void {
    const logEntry: LogEntry = {
      ...entry,
      icon: entry.icon || LOG_TYPE_ICONS[entry.type]
    };
    this.logs.unshift(logEntry);
    this.saveLogs();
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getLogsByType(type: LogType): LogEntry[] {
    return this.logs.filter(log => log.type === type);
  }

  clearLogs(): void {
    this.logs = [];
    this.saveLogs();
  }

  getLogCount(): number {
    return this.logs.length;
  }

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