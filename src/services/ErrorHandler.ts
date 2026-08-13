/**
 * @fileoverview 统一错误处理服务
 * @description 为全模块提供一致的异步错误捕获、日志记录与用户通知能力。
 *              消除各 Store 中重复的 try-catch 样板代码，统一错误上报格式（ERR-1/2/3 修复）。
 * @module services
 */
import { useToast } from '@/composables/useToast';
import { errorReporter } from '@/utils/errorReport';

/** 操作结果（成功或失败） */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * 统一错误处理器
 *
 * 提供两个层次的错误处理：
 * - {@link tryAsync}：纯函数式，返回 Result 元组，无副作用
 * - {@link report}：手动上报错误，触发 toast 与控制台日志
 */
class ErrorHandlerService {
  /**
   * 安全执行异步操作，返回 Result 类型（无副作用）
   *
   * @example
   * const { success, data, error } = await errorHandler.tryAsync(fetchData());
   * if (success) { useData(data); } else { handleErr(error); }
   */
  async tryAsync<T>(promise: Promise<T>): Promise<Result<T>> {
    try {
      const data = await promise;
      return { success: true, data };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      errorReporter.report(error, 'manual');
      return { success: false, error };
    }
  }

  // P6-154 修复：移除已废弃的 wrapAsync 方法（全项目无调用方）。
  // 原方法失败时返回 undefined，调用方极易忽略失败场景。
  // 新代码请使用 tryAsync 的 Result 模式，通过 success 分支显式区分成功与失败。

  /**
   * 手动上报错误
   *
   * @param error - 错误对象或消息字符串
   * @param userMessage - 展示给用户的提示（省略则不弹 toast）
   */
  report(error: unknown, userMessage?: string): void {
    const err = error instanceof Error ? error : new Error(String(error));
    errorReporter.report(err, 'manual', userMessage ? { userMessage } : undefined);
    if (userMessage) {
      useToast().show({ message: userMessage, type: 'danger', duration: 3000 });
    }
  }
}

/** 统一错误处理器单例 */
export const errorHandler = new ErrorHandlerService();
