/**
 * @fileoverview 错误上报工具单元测试
 *
 * 覆盖 errorReporter 的：
 * 1. report：Error 对象 / 字符串 / 非 Error 值的处理
 * 2. 缓冲区：环形缓冲（超限丢弃最旧）、getRecentErrors
 * 3. localStorage 持久化：写入 / 加载 / 清除 / 解析失败兜底
 * 4. 配置：enabled / persistToLocalStorage 开关
 * 5. 适配器：setAdapter 后自动转发
 * 6. 容错：上报本身失败时不抛出异常
 *
 * Mock 策略：
 * - console.error spy 验证输出
 * - localStorage 使用 jsdom 提供的真实实现（vitest jsdom 环境）
 * - beforeEach 清空 localStorage 与 errorReporter 状态
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  errorReporter,
  type ErrorRecord,
  type ErrorReportAdapter,
} from '@/utils/errorReport';

describe('errorReporter - 错误上报工具', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // 清空 localStorage
    localStorage.clear();
    // 重置 errorReporter 到默认配置
    errorReporter.configure({
      enabled: true,
      maxBufferSize: 50,
      persistToLocalStorage: true,
      localStorageKey: 'wow_dnd_error_log',
      maxLocalStorageEntries: 20,
    });
    // 重置适配器为 no-op（避免上一个测试的 throwing adapter 泄漏）
    errorReporter.setAdapter({ report: () => {} });
    // 清空缓冲区与持久化记录
    errorReporter.clearErrors();
    // spy console.error（errorReporter 始终输出 console.error）
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('report：错误上报', () => {
    it('Error 对象：创建记录、console.error、加入缓冲区、持久化', () => {
      const error = new Error('测试错误');
      errorReporter.report(error);

      // console.error 被调用
      expect(consoleErrorSpy).toHaveBeenCalled();

      // 缓冲区有 1 条记录
      const recent = errorReporter.getRecentErrors(10);
      expect(recent).toHaveLength(1);
      expect(recent[0].message).toBe('测试错误');
      expect(recent[0].source).toBe('manual');
      expect(recent[0].stack).toBe(error.stack);
    });

    it('字符串：转为 Error 对象', () => {
      errorReporter.report('字符串错误消息');

      const recent = errorReporter.getRecentErrors(1);
      expect(recent).toHaveLength(1);
      expect(recent[0].message).toBe('字符串错误消息');
    });

    it('非 Error 非 string 值：转为 Error 对象', () => {
      errorReporter.report({ custom: 'object' });

      const recent = errorReporter.getRecentErrors(1);
      expect(recent).toHaveLength(1);
      expect(recent[0].message).toBe('[object Object]');
    });

    it('指定 source 参数', () => {
      errorReporter.report(new Error('vue 错误'), 'vue');

      const recent = errorReporter.getRecentErrors(1);
      expect(recent[0].source).toBe('vue');
    });

    it('指定 context 参数', () => {
      errorReporter.report(new Error('带上下文'), 'manual', { component: 'GameMain', info: 'render' });

      const recent = errorReporter.getRecentErrors(1);
      expect(recent[0].context).toEqual({ component: 'GameMain', info: 'render' });
    });

    it('每条记录有唯一 ID 和时间戳', () => {
      errorReporter.report(new Error('错误1'));
      errorReporter.report(new Error('错误2'));

      const recent = errorReporter.getRecentErrors(2);
      expect(recent[0].id).not.toBe(recent[1].id);
      expect(recent[0].timestamp).toBeLessThanOrEqual(recent[1].timestamp);
    });
  });

  describe('缓冲区管理', () => {
    it('getRecentErrors：默认返回最近 10 条', () => {
      for (let i = 0; i < 15; i++) {
        errorReporter.report(new Error(`错误${i}`));
      }

      const recent = errorReporter.getRecentErrors();
      expect(recent).toHaveLength(10);
      // 返回的是最近的 10 条（错误5~错误14）
      expect(recent[0].message).toBe('错误5');
      expect(recent[9].message).toBe('错误14');
    });

    it('getRecentErrors：空缓冲区返回空数组', () => {
      const recent = errorReporter.getRecentErrors();
      expect(recent).toEqual([]);
    });

    it('环形缓冲：超过 maxBufferSize 时丢弃最旧的', () => {
      errorReporter.configure({ maxBufferSize: 3 });
      errorReporter.report(new Error('错误1'));
      errorReporter.report(new Error('错误2'));
      errorReporter.report(new Error('错误3'));
      errorReporter.report(new Error('错误4'));

      const recent = errorReporter.getRecentErrors(10);
      expect(recent).toHaveLength(3);
      expect(recent[0].message).toBe('错误2');
      expect(recent[2].message).toBe('错误4');
    });
  });

  describe('配置开关', () => {
    it('enabled=false：仅 console.error，不加入缓冲区', () => {
      errorReporter.configure({ enabled: false });
      errorReporter.report(new Error('禁用上报'));

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(errorReporter.getRecentErrors()).toHaveLength(0);
    });

    it('persistToLocalStorage=false：不持久化到 localStorage', () => {
      errorReporter.configure({ persistToLocalStorage: false });
      errorReporter.report(new Error('不持久化'));

      const persisted = errorReporter.loadPersistedErrors();
      expect(persisted).toHaveLength(0);
    });
  });

  describe('localStorage 持久化', () => {
    it('report 后错误持久化到 localStorage', () => {
      errorReporter.report(new Error('持久化测试'));
      // P2-77：persistToLocalStorage 改为防抖批量写入，需 flush 后才能读到
      errorReporter.flushPersist();

      const persisted = errorReporter.loadPersistedErrors();
      expect(persisted).toHaveLength(1);
      expect(persisted[0].message).toBe('持久化测试');
    });

    it('loadPersistedErrors：无数据时返回空数组', () => {
      localStorage.clear();
      const persisted = errorReporter.loadPersistedErrors();
      expect(persisted).toEqual([]);
    });

    it('loadPersistedErrors：JSON 解析失败时返回空数组', () => {
      localStorage.setItem('wow_dnd_error_log', 'invalid json {{{');
      const persisted = errorReporter.loadPersistedErrors();
      expect(persisted).toEqual([]);
    });

    it('loadPersistedErrors：非数组数据返回空数组', () => {
      localStorage.setItem('wow_dnd_error_log', JSON.stringify({ not: 'array' }));
      const persisted = errorReporter.loadPersistedErrors();
      expect(persisted).toEqual([]);
    });

    it('环形缓冲：localStorage 超过 maxLocalStorageEntries 时丢弃最旧的', () => {
      errorReporter.configure({ maxLocalStorageEntries: 3 });
      errorReporter.report(new Error('错误1'));
      errorReporter.report(new Error('错误2'));
      errorReporter.report(new Error('错误3'));
      errorReporter.report(new Error('错误4'));
      // P2-77：批量写入需 flush 后才能读到
      errorReporter.flushPersist();

      const persisted = errorReporter.loadPersistedErrors();
      expect(persisted).toHaveLength(3);
      expect(persisted[0].message).toBe('错误2');
      expect(persisted[2].message).toBe('错误4');
    });

    it('clearErrors：清除缓冲区与 localStorage', () => {
      errorReporter.report(new Error('待清除'));
      // P2-77：先 flush 让记录写入 localStorage
      errorReporter.flushPersist();
      expect(errorReporter.getRecentErrors()).toHaveLength(1);
      expect(errorReporter.loadPersistedErrors()).toHaveLength(1);

      errorReporter.clearErrors();

      expect(errorReporter.getRecentErrors()).toHaveLength(0);
      expect(errorReporter.loadPersistedErrors()).toHaveLength(0);
    });

    it('自定义 localStorageKey', () => {
      errorReporter.configure({ localStorageKey: 'custom_error_key' });
      errorReporter.report(new Error('自定义键'));
      // P2-77：批量写入需 flush 后才能读到
      errorReporter.flushPersist();

      const raw = localStorage.getItem('custom_error_key');
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].message).toBe('自定义键');
    });
  });

  describe('适配器', () => {
    it('setAdapter：注册后自动转发错误记录', () => {
      const adapterReports: ErrorRecord[] = [];
      const adapter: ErrorReportAdapter = {
        report: (record) => { adapterReports.push(record); },
      };
      errorReporter.setAdapter(adapter);

      errorReporter.report(new Error('适配器测试'), 'vue', { info: 'render' });

      expect(adapterReports).toHaveLength(1);
      expect(adapterReports[0].message).toBe('适配器测试');
      expect(adapterReports[0].source).toBe('vue');
      expect(adapterReports[0].context).toEqual({ info: 'render' });
    });

    it('未注册适配器时不影响正常流程', () => {
      expect(() => errorReporter.report(new Error('无适配器'))).not.toThrow();
      expect(errorReporter.getRecentErrors()).toHaveLength(1);
    });
  });

  describe('容错', () => {
    it('report 内部失败时不抛出异常', () => {
      // 模拟 createRecord 抛出异常的场景不太容易构造，
      // 但可以验证 report 方法本身有 try-catch 保护
      expect(() => errorReporter.report(null)).not.toThrow();
      expect(() => errorReporter.report(undefined)).not.toThrow();
      expect(() => errorReporter.report(() => { throw new Error('inner'); })).not.toThrow();
    });

    it('adapter.report 抛出异常时被 catch 捕获，不向外抛出', () => {
      const throwingAdapter: ErrorReportAdapter = {
        report: () => { throw new Error('adapter crash'); },
      };
      errorReporter.setAdapter(throwingAdapter);

      expect(() => errorReporter.report(new Error('触发适配器异常'))).not.toThrow();
      // 验证 catch 块的 console.error 被调用
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ErrorReporter] 上报失败:',
        expect.any(Error),
      );
    });

    it('localStorage 不可用时不影响缓冲区', () => {
      // 模拟 JSON.stringify 抛出异常，触发 flushPersistInternal 的 catch 块
      const stringifySpy = vi.spyOn(JSON, 'stringify').mockImplementation(() => {
        throw new Error('stringify failed');
      });

      errorReporter.report(new Error('localStorage 不可用'));
      // P2-77：批量写入改为防抖，需手动 flush 触发实际写入（含 JSON.stringify）
      errorReporter.flushPersist();

      // 缓冲区仍然有记录
      expect(errorReporter.getRecentErrors()).toHaveLength(1);
      // console.error 被调用（包含持久化失败的错误）
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ErrorReporter] localStorage 持久化失败:',
        expect.any(Error),
      );

      stringifySpy.mockRestore();
    });

    it('clearErrors 时 localStorage.removeItem 抛出异常被 catch 捕获', () => {
      // 使用 Storage.prototype.removeItem 确保覆盖 localStorage 实现
      const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('removeItem failed');
      });

      expect(() => errorReporter.clearErrors()).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ErrorReporter] 清除 localStorage 失败:',
        expect.any(Error),
      );

      removeItemSpy.mockRestore();
    });
  });
});
