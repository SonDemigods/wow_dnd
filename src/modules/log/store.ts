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
import { eventBus, GameEvents } from '@/modules/bus';
import { errorHandler } from '@/services/ErrorHandler';
import { errorReporter } from '@/utils/errorReport';
import { PAGE_SIZE, MAX_LOG_ENTRIES } from '@/config/log';
import { useGameStore } from '@/modules/game';

export const useLogStore = defineStore('log', () => {
  // ==================== 状态 ====================
  const logs = ref<LogEntry[]>([]);
  /** 未读日志计数（新增日志时递增，用户查看日志后归零） */
  const unreadCount = ref(0);
  // P3-153 扩展：currentCharacterId 收敛到 GameStore 只读 computed 代理
  const gameStore = useGameStore();
  const currentCharacterId = computed<string | null>(() => gameStore.currentCharacterId);

  // ==================== 计算属性 ====================
  const logCount = computed(() => logs.value.length);

  /** 总页数（向上取整，空列表为 0 页） */
  const totalPages = computed(() => Math.max(0, Math.ceil(logs.value.length / PAGE_SIZE)));

  // ==================== 持久化 ====================
  // P6-201 修复：saveToDb 显式接收 characterId 参数，避免依赖 GameStore 全局状态
  async function saveToDb(characterId?: string): Promise<void> {
    const id = characterId ?? currentCharacterId.value;
    if (id) {
      await adventureLogDbService.saveAdventureLog(id, logs.value);
    }
  }

  // ==================== 动作 ====================

  /**
   * 初始化 —— 从数据库加载指定角色的日志
   *
   * BIZ-12：加载后若超过 MAX_LOG_ENTRIES，裁剪尾部以符合容量上限。
   * （历史数据可能在上限保护引入前已超量持久化）
   *
   * P3-112 修复：截断后需持久化，否则下次加载仍会读到超量数据，截断形同虚设。
   * 使用 fire-and-forget 异步持久化，失败时仅记录错误日志，不阻断初始化流程。
   */
  async function initialize(characterId: string): Promise<void> {
    const stored = await adventureLogDbService.getAdventureLog(characterId);
    const entries = stored?.entries || [];
    let truncated = false;
    if (entries.length > MAX_LOG_ENTRIES) {
      entries.length = MAX_LOG_ENTRIES;
      truncated = true;
    }
    logs.value = entries;
    // 仅在确实发生截断时持久化，避免无意义写入
    if (truncated) {
      // P3-151：原 console.error 改为 errorReporter 统一上报，便于全局监测
      // P6-201 修复：传递 initialize 的 characterId 参数而非依赖 GameStore 全局状态
      saveToDb(characterId).catch(err => {
        errorReporter.report(err, 'manual', {
          context: '日志截断后持久化失败',
          characterId,
        });
      });
    }
  }

  /**
   * 添加日志条目
   * 步骤：格式化 → 插入头部 → 裁剪超限尾部 → 持久化 → emit 事件通知 UI
   *
   * BIZ-12：当日志总数超过 MAX_LOG_ENTRIES 时，裁剪尾部最旧条目，
   * 避免长期游戏后内存与 IndexedDB 记录无限膨胀。
   */
  async function addLogEntry(entry: LogEntry): Promise<void> {
    const formatted = formatLogMessage(entry);
    const nextLogs = [formatted, ...logs.value];
    // 超过容量上限时裁剪尾部（最旧的日志）
    if (nextLogs.length > MAX_LOG_ENTRIES) {
      nextLogs.length = MAX_LOG_ENTRIES;
    }
    logs.value = nextLogs;
    // 新增日志计入未读
    unreadCount.value++;
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
    unreadCount.value = 0;
    try {
      await saveToDb();
    } catch (e) {
      // 清空持久化失败仅记录错误（日志已在内存清空，不打扰用户）
      errorHandler.report(e);
    }
  }

  /** 标记全部日志已读（打开日志面板时调用），归零未读计数 */
  function markAllRead(): void {
    unreadCount.value = 0;
  }

  return {
    // 状态
    logs,
    logCount,
    totalPages,
    unreadCount,

    // 动作
    initialize,
    addLogEntry,
    getLogs,
    getLogsByType,
    getPaginatedLogs,
    clearLogs,
    markAllRead
  };
});
