/**
 * @fileoverview 冒险日志模块状态管理层（Store 核心架构）
 * @description Store 是日志数据的唯一持有者，Action 负责编排：
 *   调用纯函数 → 更新 Store 状态 → 调 DB 持久化 → emit 事件通知 UI
 * @module log
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { LogEntry, LogType } from './types';
import { formatLogMessage } from './service';
import { adventureLogDbService } from './db';
import { eventBus, GameEvents } from '../bus';
import { errorHandler } from '@/services/ErrorHandler';
import { PAGE_SIZE } from '@/config/log';

export const useLogStore = defineStore('log', () => {
  // ==================== 状态 ====================
  const logs = ref<LogEntry[]>([]);
  const currentCharacterId = ref<string | null>(null);

  // ==================== 计算属性 ====================
  const logCount = computed(() => logs.value.length);

  /** 总页数（向上取整，空列表为 0 页） */
  const totalPages = computed(() => Math.max(0, Math.ceil(logs.value.length / PAGE_SIZE)));

  // ==================== 持久化 ====================
  async function saveToDb(): Promise<void> {
    if (currentCharacterId.value) {
      await adventureLogDbService.saveAdventureLog(currentCharacterId.value, logs.value);
    }
  }

  // ==================== 动作 ====================

  /**
   * 初始化 —— 从数据库加载指定角色的日志
   */
  async function initialize(characterId: string): Promise<void> {
    currentCharacterId.value = characterId;
    const stored = await adventureLogDbService.getAdventureLog(characterId);
    logs.value = stored?.entries || [];
  }

  /**
   * 添加日志条目
   * 步骤：格式化 → 插入头部 → 持久化 → emit 事件通知 UI
   */
  async function addLogEntry(entry: LogEntry): Promise<void> {
    const formatted = formatLogMessage(entry);
    logs.value = [formatted, ...logs.value];
    try {
      await saveToDb();
    } catch (e) {
      // 持久化失败不阻断事件通知，仅记录错误（后台操作，不打扰用户）
      errorHandler.report(e);
    }
    eventBus.emit(GameEvents.LOG_ENTRY_ADDED, {
      type: formatted.type,
      message: formatted.message,
      icon: formatted.icon
    });
  }

  /** 获取所有日志 */
  function getLogs(): LogEntry[] {
    return logs.value;
  }

  /** 按类型筛选日志 */
  function getLogsByType(type: LogType): LogEntry[] {
    return logs.value.filter(log => log.type === type);
  }

  /**
   * 分页获取日志（PERF-3：避免大量日志一次性渲染导致性能下降）
   *
   * @param page - 页码，从 0 开始
   * @param pageSize - 每页条数，默认 50
   * @returns 指定页的日志条目数组
   */
  function getPaginatedLogs(page: number, pageSize: number = PAGE_SIZE): LogEntry[] {
    const start = page * pageSize;
    return logs.value.slice(start, start + pageSize);
  }

  /** 清空日志并持久化 */
  async function clearLogs(): Promise<void> {
    logs.value = [];
    try {
      await saveToDb();
    } catch (e) {
      // 清空持久化失败仅记录错误（日志已在内存清空，不打扰用户）
      errorHandler.report(e);
    }
  }

  return {
    // 状态
    logs,
    logCount,
    totalPages,

    // 动作
    initialize,
    addLogEntry,
    getLogs,
    getLogsByType,
    getPaginatedLogs,
    clearLogs
  };
});
