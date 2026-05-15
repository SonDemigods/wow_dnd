/**
 * @fileoverview 冒险日志模块
 * @description 提供冒险日志的管理功能，包括添加日志、查看日志、清除日志等
 * @module modules/adventureLog/index
 */

import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { LogEntry, LogType, IAdventureLogService } from './types'

/**
 * 本地存储键名
 */
const ADVENTURE_LOG_STORAGE_KEY = 'wow_adventure_log'

/**
 * 冒险日志状态管理Store
 */
export const useAdventureLogStore = defineStore('adventureLog', () => {
  /** 冒险日志条目 */
  const logs = ref<LogEntry[]>([])

  /**
   * 从本地存储加载日志数据
   */
  function loadFromStorage() {
    try {
      const data = localStorage.getItem(ADVENTURE_LOG_STORAGE_KEY)
      if (data) {
        logs.value = JSON.parse(data)
      }
    } catch (e) {
      console.error('Failed to load adventure log:', e)
    }
  }

  /**
   * 保存日志数据到本地存储
   */
  function saveToStorage() {
    try {
      localStorage.setItem(ADVENTURE_LOG_STORAGE_KEY, JSON.stringify(logs.value))
    } catch (e) {
      console.error('Failed to save adventure log:', e)
    }
  }

  /**
   * 清除日志本地存储
   */
  function clearStorage() {
    localStorage.removeItem(ADVENTURE_LOG_STORAGE_KEY)
  }

  /**
   * 获取日志图标
   * @param type - 日志类型
   * @returns 图标emoji
   */
  function getLogIcon(type: LogType): string {
    const icons: { [key: string]: string } = {
      info: '📜',
      combat: '⚔️',
      quest: '📋',
      item: '📦',
      level: '⬆️'
    }
    return icons[type] || '📜'
  }

  /**
   * 添加日志条目
   * @param message - 日志消息
   * @param type - 日志类型（默认为'info'）
   */
  const addLog = (message: string, type: LogType = 'info') => {
    logs.value.push({
      id: Date.now().toString(),
      timestamp: Date.now(),
      type,
      message,
      icon: getLogIcon(type)
    })
    saveToStorage()
  }

  /**
   * 获取所有日志
   */
  const getLogs = (): LogEntry[] => {
    return [...logs.value]
  }

  /**
   * 清除所有日志
   */
  const clearLogs = () => {
    logs.value = []
    saveToStorage()
  }

  /**
   * 重置日志（清空并清除存储）
   */
  const reset = () => {
    logs.value = []
    clearStorage()
  }

  // 初始化时加载数据
  loadFromStorage()

  return {
    // 状态
    logs,
    // 方法
    getLogs,
    addLog,
    clearLogs,
    reset
  }
})

/**
 * 冒险日志服务实现
 */
export const adventureLogService: IAdventureLogService = {
  getLogs: () => useAdventureLogStore().getLogs(),
  addLog: (message: string, type?: LogType) => useAdventureLogStore().addLog(message, type),
  clearLogs: () => useAdventureLogStore().clearLogs(),
  reset: () => useAdventureLogStore().reset()
}