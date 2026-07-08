/**
 * @fileoverview useToast Composable 单元测试
 *
 * 覆盖 useToast 的：
 * 1. show(string) / show(options) 两种调用形式
 * 2. 默认 duration（2500ms）与自定义 duration
 * 3. duration 结束后自动关闭（visible=false）
 * 4. close() 主动关闭并清除定时器
 * 5. 单例约束：新 show 覆盖旧 Toast 时清除旧定时器
 *
 * 设计说明：
 *  - useToast 为模块级单例状态（CODE-19 设计意图），测试间共享。
 *    beforeEach 中调用 close() 重置状态，避免用例间耦合（遵循 code_rule 红线）。
 *  - 使用 vi.useFakeTimers 控制 setTimeout，验证自动关闭与定时器清理。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useToast } from '@/composables/useToast';

describe('useToast - Toast 提示组合函数', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 重置单例状态，确保每个用例从干净状态开始
    const { close } = useToast();
    close();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('show(string) 字符串调用形式', () => {
    it('设置 message 并显示', () => {
      const { show, message, visible } = useToast();
      show('操作成功');
      expect(message.value).toBe('操作成功');
      expect(visible.value).toBe(true);
    });

    it('字符串形式默认 type 为 info', () => {
      const { show, type } = useToast();
      show('提示');
      expect(type.value).toBe('info');
    });

    it('字符串形式 icon 为空', () => {
      const { show, icon } = useToast();
      show('提示');
      expect(icon.value).toBe('');
    });
  });

  describe('show(options) 对象调用形式', () => {
    it('完整设置 message/type/icon', () => {
      const { show, message, type, icon } = useToast();
      show({ message: '删除成功', type: 'success', icon: 'check' });
      expect(message.value).toBe('删除成功');
      expect(type.value).toBe('success');
      expect(icon.value).toBe('check');
    });

    it('未指定 type 时默认 info', () => {
      const { show, type } = useToast();
      show({ message: '提示' });
      expect(type.value).toBe('info');
    });

    it('未指定 icon 时默认空字符串', () => {
      const { show, icon } = useToast();
      show({ message: '提示', type: 'warning' });
      expect(icon.value).toBe('');
    });

    it('支持 danger 类型', () => {
      const { show, type } = useToast();
      show({ message: '危险操作', type: 'danger' });
      expect(type.value).toBe('danger');
    });
  });

  describe('自动关闭定时器', () => {
    it('默认 2500ms 后自动关闭', () => {
      const { show, visible } = useToast();
      show('提示');
      expect(visible.value).toBe(true);

      vi.advanceTimersByTime(2499);
      expect(visible.value).toBe(true);

      vi.advanceTimersByTime(1);
      expect(visible.value).toBe(false);
    });

    it('自定义 duration 生效', () => {
      const { show, visible } = useToast();
      show({ message: '提示', duration: 1000 });

      vi.advanceTimersByTime(999);
      expect(visible.value).toBe(true);

      vi.advanceTimersByTime(1);
      expect(visible.value).toBe(false);
    });

    it('duration=0 立即关闭（下一 tick）', () => {
      const { show, visible } = useToast();
      show({ message: '瞬态', duration: 0 });
      // setTimeout(fn, 0) 仍需 tick 推进
      expect(visible.value).toBe(true);
      vi.advanceTimersByTime(0);
      expect(visible.value).toBe(false);
    });
  });

  describe('close() 主动关闭', () => {
    it('设置 visible 为 false', () => {
      const { show, close, visible } = useToast();
      show('提示');
      expect(visible.value).toBe(true);

      close();
      expect(visible.value).toBe(false);
    });

    it('未显示时调用 close 不抛错', () => {
      const { close, visible } = useToast();
      expect(() => close()).not.toThrow();
      expect(visible.value).toBe(false);
    });

    it('close 后不再因旧定时器自动显示', () => {
      const { show, close, visible } = useToast();
      show({ message: '提示', duration: 1000 });
      close();

      vi.advanceTimersByTime(2000);
      expect(visible.value).toBe(false);
    });
  });

  describe('单例约束（CODE-19 设计意图）', () => {
    it('多次 show 覆盖前一个 Toast', () => {
      const { show, message, type } = useToast();
      show({ message: '第一条', type: 'success' });
      show({ message: '第二条', type: 'danger' });

      // 单例：仅展示最新一条
      expect(message.value).toBe('第二条');
      expect(type.value).toBe('danger');
    });

    it('新 show 清除旧定时器（旧 Toast 不会在原时间关闭新 Toast）', () => {
      const { show, visible } = useToast();
      // 第一个 Toast 1000ms 后关闭
      show({ message: '第一条', duration: 1000 });
      // 500ms 后再次 show，duration 2000ms
      vi.advanceTimersByTime(500);
      show({ message: '第二条', duration: 2000 });

      // 此时距离第一个 show 已过 1000ms（第一个定时器应已被清除）
      vi.advanceTimersByTime(500); // 距第二个 show 500ms
      expect(visible.value).toBe(true);

      // 再过 1500ms（距第二个 show 共 2000ms）应关闭
      vi.advanceTimersByTime(1500);
      expect(visible.value).toBe(false);
    });

    it('close 后可再次 show', () => {
      const { show, close, visible, message } = useToast();
      show('第一条');
      close();
      show('第二条');

      expect(visible.value).toBe(true);
      expect(message.value).toBe('第二条');
    });

    it('多次调用 useToast() 返回同一组状态', () => {
      const first = useToast();
      first.show('共享状态');

      const second = useToast();
      // 第二次调用应共享同一单例状态
      expect(second.visible.value).toBe(true);
      expect(second.message.value).toBe('共享状态');

      // 通过 second 关闭，first 也应同步
      second.close();
      expect(first.visible.value).toBe(false);
    });
  });
});
