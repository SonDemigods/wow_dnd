/**
 * @fileoverview 冒险日志模块状态管理层（Store 核心架构）
 * @description Store 是日志数据的唯一持有者，Action 负责编排：
 *   调用纯函数 → 更新 Store 状态 → 调 DB 持久化 → emit 事件通知 UI
 * @module log
 */
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { LogEntry, LogType } from './types';
import { generateLogId, formatLogMessage } from './service';
import { adventureLogDbService } from './db';
import { eventBus, GameEvents } from '../bus/core';

/** 日志变更回调类型 */
export type LogChangeCallback = () => void;

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

  // ==================== 订阅者（向后兼容旧 subscribe 模式） ====================
  const subscribers = new Set<LogChangeCallback>();

  /** 基于 watch 实现的 subscribe —— 向后兼容旧 API */
  function subscribe(callback: LogChangeCallback): () => void {
    subscribers.add(callback);
    return () => { subscribers.delete(callback); };
  }

  // 日志变更时通知所有订阅者
  watch(logs, () => {
    subscribers.forEach(cb => cb());
  }, { deep: true });

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
  function addLogEntry(entry: LogEntry): void {
    const formatted = formatLogMessage(entry);
    logs.value = [formatted, ...logs.value];
    saveToDb();
    eventBus.emit(GameEvents.LOG_ENTRY_ADDED, {
      type: formatted.type,
      message: formatted.message,
      icon: formatted.icon
    });
  }

  /**
   * 便捷方法：按类型和消息创建日志条目
   */
  function addLogByType(message: string, type: LogType): void {
    addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type,
      message
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

  /** 获取日志数量 */
  function getLogCount(): number {
    return logs.value.length;
  }

  /** 清空日志并持久化 */
  async function clearLogs(): Promise<void> {
    logs.value = [];
    await saveToDb();
  }

  return {
    // 状态
    logs,
    logCount,

    // 动作
    initialize,
    addLogEntry,
    addLogByType,
    getLogs,
    getLogsByType,
    getLogCount,
    clearLogs,

    // 向后兼容
    subscribe
  };
});
