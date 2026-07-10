/**
 * @fileoverview ErrorHandler 统一错误处理服务单元测试
 *
 * 覆盖三个层次的错误处理：
 * 1. tryAsync：纯函数式，返回 Result，无副作用
 * 2. wrapAsync：自动 catch + toast 通知 + 错误上报
 * 3. report：手动上报错误
 *
 * Mock 策略：
 * - useToast mock，断言 show 调用参数
 * - errorReporter mock，断言 report 调用参数（ErrorHandler 委托上报）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * vi.hoisted 保证 mock 函数在 vi.mock 工厂提升到文件顶部时已初始化。
 * errorReporterReportMock 在工厂返回对象中直接引用（非函数包装），
 * 必须使用 vi.hoisted 避免 TDZ（Temporal Dead Zone）错误。
 */
const hoisted = vi.hoisted(() => ({
  showMock: vi.fn(),
  errorReporterReportMock: vi.fn(),
}));

/** mock useToast，避免真实 DOM 副作用 */
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ show: hoisted.showMock }),
}));

/** mock errorReporter，断言 ErrorHandler 委托上报的参数 */
vi.mock('@/utils/errorReport', () => ({
  errorReporter: { report: hoisted.errorReporterReportMock },
}));

import { errorHandler } from '@/services/ErrorHandler';

/** 从 hoisted 中取出 spy 引用 */
const showMock = hoisted.showMock;
const errorReporterReportMock = hoisted.errorReporterReportMock;

describe('ErrorHandler 统一错误处理服务', () => {
  beforeEach(() => {
    showMock.mockClear();
    errorReporterReportMock.mockClear();
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

    it('失败时委托 errorReporter 上报', async () => {
      // Arrange
      const error = new Error('log test');
      const promise = Promise.reject(error);

      // Act
      await errorHandler.tryAsync(promise);

      // Assert
      expect(errorReporterReportMock).toHaveBeenCalledTimes(1);
      const [reportedError, source] = errorReporterReportMock.mock.calls[0];
      expect(reportedError).toBeInstanceOf(Error);
      expect(reportedError.message).toBe('log test');
      expect(source).toBe('manual');
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

    it('失败时委托 errorReporter 上报（含 userMessage 上下文）', async () => {
      // Arrange
      const promise = Promise.reject(new Error('fail'));

      // Act
      await errorHandler.wrapAsync(promise, '操作失败');

      // Assert
      expect(errorReporterReportMock).toHaveBeenCalledTimes(1);
      const [reportedError, source, context] = errorReporterReportMock.mock.calls[0];
      expect(reportedError.message).toBe('fail');
      expect(source).toBe('manual');
      expect(context).toEqual({ userMessage: '操作失败' });
    });

    it('失败但无 userMessage 时上下文为 undefined', async () => {
      // Arrange
      const promise = Promise.reject(new Error('fail'));

      // Act
      await errorHandler.wrapAsync(promise);

      // Assert
      expect(errorReporterReportMock).toHaveBeenCalledTimes(1);
      const [, , context] = errorReporterReportMock.mock.calls[0];
      expect(context).toBeUndefined();
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

    it('非 Error 异常被包装为 Error 后上报', () => {
      // Act
      errorHandler.report('string err');

      // Assert
      expect(errorReporterReportMock).toHaveBeenCalledTimes(1);
      const [reportedError] = errorReporterReportMock.mock.calls[0];
      expect(reportedError).toBeInstanceOf(Error);
      expect(reportedError.message).toBe('string err');
    });

    it('始终委托 errorReporter 上报', () => {
      // Act
      errorHandler.report(new Error('logged'));

      // Assert
      expect(errorReporterReportMock).toHaveBeenCalledTimes(1);
      const [reportedError, source] = errorReporterReportMock.mock.calls[0];
      expect(reportedError.message).toBe('logged');
      expect(source).toBe('manual');
    });

    it('有 userMessage 时上下文包含 userMessage', () => {
      // Act
      errorHandler.report(new Error('err'), '用户提示');

      // Assert
      const [, , context] = errorReporterReportMock.mock.calls[0];
      expect(context).toEqual({ userMessage: '用户提示' });
    });
  });
});
