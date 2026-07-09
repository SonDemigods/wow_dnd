/**
 * @fileoverview ErrorHandler 统一错误处理服务单元测试
 *
 * 覆盖三个层次的错误处理：
 * 1. tryAsync：纯函数式，返回 Result，无副作用
 * 2. wrapAsync：自动 catch + toast 通知 + 控制台日志
 * 3. report：手动上报错误
 *
 * Mock 策略：
 * - useToast mock，断言 show 调用参数
 * - console.error spy，验证日志输出
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { errorHandler } from '@/services/ErrorHandler';

/** mock useToast，避免真实 DOM 副作用 */
const showMock = vi.fn();
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ show: showMock }),
}));

describe('ErrorHandler 统一错误处理服务', () => {
  beforeEach(() => {
    showMock.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  // ==================== tryAsync ====================

  describe('tryAsync：纯函数式错误处理', () => {
    it('成功时返回 { success: true, data }', async () => {
      // Arrange
      const promise = Promise.resolve(42);

      // Act
      const result = await errorHandler.tryAsync(promise);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });

    it('失败时返回 { success: false, error } 且不弹 toast', async () => {
      // Arrange
      const promise = Promise.reject(new Error('boom'));

      // Act
      const result = await errorHandler.tryAsync(promise);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('boom');
      }
      expect(showMock).not.toHaveBeenCalled();
    });

    it('非 Error 异常被包装为 Error', async () => {
      // Arrange
      const promise = Promise.reject('string error');

      // Act
      const result = await errorHandler.tryAsync(promise);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('string error');
      }
    });

    it('失败时输出 console.error 日志', async () => {
      // Arrange
      const promise = Promise.reject(new Error('log test'));

      // Act
      await errorHandler.tryAsync(promise);

      // Assert
      expect(console.error).toHaveBeenCalled();
    });
  });

  // ==================== wrapAsync ====================

  describe('wrapAsync：自动 catch + toast 通知', () => {
    it('成功时返回数据', async () => {
      // Arrange
      const promise = Promise.resolve('ok');

      // Act
      const result = await errorHandler.wrapAsync(promise);

      // Assert
      expect(result).toBe('ok');
    });

    it('失败时返回 undefined', async () => {
      // Arrange
      const promise = Promise.reject(new Error('fail'));

      // Act
      const result = await errorHandler.wrapAsync(promise);

      // Assert
      expect(result).toBeUndefined();
    });

    it('失败且有 userMessage 时弹 toast', async () => {
      // Arrange
      const promise = Promise.reject(new Error('fail'));

      // Act
      await errorHandler.wrapAsync(promise, '操作失败，请重试');

      // Assert
      expect(showMock).toHaveBeenCalledWith({
        message: '操作失败，请重试',
        type: 'danger',
        duration: 3000,
      });
    });

    it('失败但无 userMessage 时不弹 toast', async () => {
      // Arrange
      const promise = Promise.reject(new Error('fail'));

      // Act
      await errorHandler.wrapAsync(promise);

      // Assert
      expect(showMock).not.toHaveBeenCalled();
    });

    it('非 Error 异常被包装并输出日志', async () => {
      // Arrange
      const promise = Promise.reject(123);

      // Act
      const result = await errorHandler.wrapAsync(promise, 'err');

      // Assert
      expect(result).toBeUndefined();
      expect(console.error).toHaveBeenCalled();
    });
  });

  // ==================== report ====================

  describe('report：手动上报错误', () => {
    it('有 userMessage 时弹 toast', () => {
      // Arrange
      const error = new Error('report err');

      // Act
      errorHandler.report(error, '发生错误');

      // Assert
      expect(showMock).toHaveBeenCalledWith({
        message: '发生错误',
        type: 'danger',
        duration: 3000,
      });
    });

    it('无 userMessage 时不弹 toast', () => {
      // Arrange
      const error = new Error('report err');

      // Act
      errorHandler.report(error);

      // Assert
      expect(showMock).not.toHaveBeenCalled();
    });

    it('非 Error 异常被包装为 Error', () => {
      // Arrange
      vi.mocked(console.error).mockClear();

      // Act
      errorHandler.report('string err');

      // Assert
      expect(console.error).toHaveBeenCalled();
      const lastCall = vi.mocked(console.error).mock.calls.at(-1)!;
      expect(lastCall[1]).toBe('string err');
      expect(lastCall[2]).toBeInstanceOf(Error);
    });

    it('始终输出 console.error 日志', () => {
      // Arrange
      vi.mocked(console.error).mockClear();

      // Act
      errorHandler.report(new Error('logged'));

      // Assert
      expect(console.error).toHaveBeenCalled();
    });
  });
});
