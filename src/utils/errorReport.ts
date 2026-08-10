/**
 * @fileoverview 统一错误上报入口
 * @description 提供全局错误捕获、本地缓冲与可选外部上报适配器。
 *              接入点：ErrorHandlerService.report、main.ts 全局错误捕获。
 *              设计目标：零外部依赖，预留 Sentry 等适配器接口。
 * @module utils/errorReport
 */

import { generateId } from './db-helpers';

/** 错误来源标识 */
export type ErrorSource = 'vue' | 'unhandledrejection' | 'window.onerror' | 'manual';

/** 错误记录 */
export interface ErrorRecord {
  /** 唯一 ID（时间戳+随机串） */
  id: string;
  /** 发生时间戳 */
  timestamp: number;
  /** 错误消息 */
  message: string;
  /** 错误堆栈 */
  stack?: string;
  /** 错误来源 */
  source: ErrorSource;
  /** 附加上下文（如 Vue 组件信息、URL 等） */
  context?: Record<string, unknown>;
}

/**
 * 错误上报适配器接口
 *
 * 未来可接入 Sentry/Bugsnag 等外部服务，只需实现此接口并调用 setAdapter 注册。
 */
export interface ErrorReportAdapter {
  /** 上报单条错误记录 */
  report(record: ErrorRecord): void;
}

/** ErrorReporter 配置 */
export interface ErrorReporterConfig {
  /** 是否启用上报（关闭后仅 console.error） */
  enabled: boolean;
  /** 内存缓冲区大小（环形缓冲） */
  maxBufferSize: number;
  /** 是否持久化到 localStorage */
  persistToLocalStorage: boolean;
  /** localStorage 键名 */
  localStorageKey: string;
  /** localStorage 持久化条数上限 */
  maxLocalStorageEntries: number;
}

/** localStorage 错误日志存储键名 */
const ERROR_LOG_STORAGE_KEY = 'wow_dnd_error_log';

const DEFAULT_CONFIG: ErrorReporterConfig = {
  enabled: true,
  maxBufferSize: 50,
  persistToLocalStorage: true,
  localStorageKey: ERROR_LOG_STORAGE_KEY,
  maxLocalStorageEntries: 20,
};

/**
 * 错误上报器
 *
 * 提供三层错误处理：
 * 1. console.error 始终输出（开发环境可见）
 * 2. 内存环形缓冲区（默认 50 条，供运行时查询）
 * 3. localStorage 持久化（默认 20 条，供用户导出或开发者诊断）
 *
 * 可选接入外部适配器（如 Sentry），通过 setAdapter 注册后自动转发。
 */
class ErrorReporter {
  private buffer: ErrorRecord[] = [];
  private adapter: ErrorReportAdapter | null = null;
  private config: ErrorReporterConfig = { ...DEFAULT_CONFIG };
  /**
   * 待写入 localStorage 的错误记录缓冲区
   *
   * P2-77 修复：原实现每次上报都读取全部历史记录、追加、再写回 localStorage，
   * O(n) 复杂度在错误爆发时会阻塞主线程。改为先追加到内存缓冲区，
   * 通过 setTimeout 异步批量写入，避免主线程阻塞。
   */
  private pendingPersist: ErrorRecord[] = [];
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  /** 批量写入延迟（ms），平衡实时性与性能 */
  private static readonly PERSIST_DEBOUNCE_MS = 500;

  /** 更新配置 */
  configure(partial: Partial<ErrorReporterConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /** 注册外部上报适配器（如 Sentry） */
  setAdapter(adapter: ErrorReportAdapter): void {
    this.adapter = adapter;
  }

  /**
   * 上报错误
   * @param error - 错误对象或消息
   * @param source - 错误来源
   * @param context - 附加上下文
   */
  report(error: unknown, source: ErrorSource = 'manual', context?: Record<string, unknown>): void {
    try {
      const record = this.createRecord(error, source, context);
      this.consoleLog(record);
      if (!this.config.enabled) return;
      this.addToBuffer(record);
      if (this.config.persistToLocalStorage) {
        this.persistToLocalStorage(record);
      }
      this.adapter?.report(record);
    } catch (internalError) {
      // 错误上报本身失败时，避免抛出异常导致循环
      console.error('[ErrorReporter] 上报失败:', internalError);
    }
  }

  /** 获取最近的错误记录（从内存缓冲区） */
  getRecentErrors(count: number = 10): ErrorRecord[] {
    return this.buffer.slice(-count);
  }

  /** 清除内存缓冲区与 localStorage 持久化记录 */
  clearErrors(): void {
    this.buffer = [];
    // P2-77：同步清理待写入缓冲区与定时器，避免清空后又被旧记录写回
    this.pendingPersist = [];
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    try {
      localStorage.removeItem(this.config.localStorageKey);
    } catch (e) {
      console.error('[ErrorReporter] 清除 localStorage 失败:', e);
    }
  }

  /**
   * 销毁实例，释放定时器并 flush 待写入缓冲区
   *
   * P2 BIZ-11 修复：HMR 模块热替换时，旧实例的 persistTimer 若未触发会被遗弃，
   * 回调可能访问旧实例的 pendingPersist 缓冲区写入过期数据。
   * 通过 dispose 显式清理定时器并 flush 残留记录，避免 HMR 状态泄漏。
   */
  dispose(): void {
    this.flushPersist();
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
  }

  /**
   * 同步刷新待写入 localStorage 的错误记录
   *
   * P2-77：persistToLocalStorage 改为防抖批量写入后，测试与诊断场景
   * 可调用此方法立即触发持久化，无需等待 PERSIST_DEBOUNCE_MS。
   */
  flushPersist(): void {
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.flushPersistInternal();
  }

  /** 从 localStorage 加载历史错误记录（用于诊断面板展示） */
  loadPersistedErrors(): ErrorRecord[] {
    try {
      const raw = localStorage.getItem(this.config.localStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('[ErrorReporter] 加载持久化错误失败:', e);
      return [];
    }
  }

  // ==================== 内部方法 ====================

  private createRecord(error: unknown, source: ErrorSource, context?: Record<string, unknown>): ErrorRecord {
    const err = error instanceof Error ? error : new Error(String(error));
    return {
      id: generateId('err'),
      timestamp: Date.now(),
      message: err.message,
      stack: err.stack,
      source,
      context,
    };
  }

  private consoleLog(record: ErrorRecord): void {
    console.error(
      `[ErrorReporter][${record.source}] ${record.message}`,
      record.context ?? '',
      record.stack ?? '',
    );
  }

  private addToBuffer(record: ErrorRecord): void {
    this.buffer.push(record);
    // 环形缓冲：超出上限时丢弃最旧的
    // P10-027: slice 重建 O(n) 但 maxBufferSize=50 影响极小，循环队列可优化但收益不抵复杂度
    if (this.buffer.length > this.config.maxBufferSize) {
      this.buffer = this.buffer.slice(-this.config.maxBufferSize);
    }
  }

  private persistToLocalStorage(record: ErrorRecord): void {
    // P2-77 修复：追加到待写入缓冲区，通过 setTimeout 异步批量写入，
    // 避免错误爆发时频繁读写 localStorage 阻塞主线程
    this.pendingPersist.push(record);
    if (this.persistTimer === null) {
      this.persistTimer = setTimeout(() => {
        this.persistTimer = null;
        this.flushPersistInternal();
      }, ErrorReporter.PERSIST_DEBOUNCE_MS);
    }
  }

  /**
   * 将待写入缓冲区的错误记录批量持久化到 localStorage
   *
   * 合并已持久化的记录与待写入记录，截断到 maxLocalStorageEntries 上限后一次性写入。
   * 失败时记录错误但不影响主流程。
   */
  private flushPersistInternal(): void {
    if (this.pendingPersist.length === 0) return;

    const toWrite = this.pendingPersist;
    this.pendingPersist = [];

    try {
      const existing = this.loadPersistedErrors();
      existing.push(...toWrite);
      // 环形缓冲：保留最近 N 条
      const trimmed = existing.slice(-this.config.maxLocalStorageEntries);
      localStorage.setItem(this.config.localStorageKey, JSON.stringify(trimmed));
    } catch (e) {
      // localStorage 满 or 不可用时记录但不影响主流程
      console.error('[ErrorReporter] localStorage 持久化失败:', e);
    }
  }
}

/** 错误上报单例 */
export const errorReporter = new ErrorReporter();

// P2 BIZ-11 修复：HMR 模块热替换时清理旧实例的定时器与缓冲区，避免状态泄漏
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    errorReporter.dispose();
  });
}
