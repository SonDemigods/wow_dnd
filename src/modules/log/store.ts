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
import { eventBus, GameEvents } from '../bus/core';

export const useLogStore = defineStore('log', () => {
  // ==================== 状态 ====================
  const logs = ref<LogEntry[]>([]);
  const currentCharacterId = ref<string | null>(null);

  // ==================== 计算属性 ====================
  const logCount = computed(() => logs.value.length);

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
      console.error('[LogStore] 持久化日志失败:', e);
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

  /** 清空日志并持久化 */
  async function clearLogs(): Promise<void> {
    logs.value = [];
    try {
      await saveToDb();
    } catch (e) {
      console.error('[LogStore] 清空日志持久化失败:', e);
    }
  }

  return {
    // 状态
    logs,
    logCount,

    // 动作
    initialize,
    addLogEntry,
    getLogs,
    getLogsByType,
    clearLogs
  };
});
