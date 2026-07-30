/**
 * @fileoverview Boss 出场演出覆盖层 Composable（useBossIntroOverlay）单元测试
 *
 * 覆盖：
 * 1. 初始状态：showBossIntro 为 false，bossIntroIcon/Name/Lines 为空
 * 2. onBossIntro：设置演出数据、显示遮罩、调用 animateBossIntro
 * 3. 重复 onBossIntro：取消旧控制器再启动新演出
 * 4. 演出结束后自动关闭（setAnimTimer 回调）
 * 5. isUnmounted 守卫：卸载后不处理事件
 * 6. dispose：取消进行中的动画控制器
 *
 * Mock 策略：
 *  - mock animateBossIntro 返回 { cancel: vi.fn() }
 *  - 使用 vi.useFakeTimers 控制定时器
 *  - setAnimTimer 由测试注入 mock（记录回调供后续触发）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref, nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';

// ==================== Mock（使用 vi.hoisted 确保提升时已初始化） ====================

const { animateBossIntroMock } = vi.hoisted(() => ({
  animateBossIntroMock: vi.fn(() => ({ cancel: vi.fn() })),
}));

vi.mock('@/modules/animation', () => ({
  animateBossIntro: animateBossIntroMock,
}));

// ==================== 导入被测模块 ====================

import { useBossIntroOverlay } from '@/modules/combat/composables/useBossIntroOverlay';

// ==================== 测试用例 ====================

describe('useBossIntroOverlay Boss 出场演出覆盖层', () => {
  let isUnmounted: ReturnType<typeof ref<boolean>>;
  let animTimerCallbacks: Array<() => void>;
  let setAnimTimerMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    isUnmounted = ref(false);
    animTimerCallbacks = [];
    setAnimTimerMock = vi.fn((fn: () => void, _delay: number) => {
      animTimerCallbacks.push(fn);
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });
  });

  /** 构造 composable */
  function makeOverlay() {
    return useBossIntroOverlay({
      getCombatSpeed: () => 1,
      setAnimTimer: setAnimTimerMock,
      isUnmounted,
    });
  }

  /** Boss intro 数据 */
  const introData = {
    enemyId: 'boss-1',
    enemyName: '黑暗领主',
    icon: 'dragon-head',
    effect: 'darken',
    lines: ['你竟敢踏入我的领地！', '受死吧！'],
    duration: 3000,
  };

  describe('初始状态', () => {
    it('showBossIntro 初始为 false', () => {
      const { showBossIntro } = makeOverlay();
      expect(showBossIntro.value).toBe(false);
    });

    it('bossIntroIcon 初始为空字符串', () => {
      const { bossIntroIcon } = makeOverlay();
      expect(bossIntroIcon.value).toBe('');
    });

    it('bossIntroName 初始为空字符串', () => {
      const { bossIntroName } = makeOverlay();
      expect(bossIntroName.value).toBe('');
    });

    it('bossIntroLines 初始为空数组', () => {
      const { bossIntroLines } = makeOverlay();
      expect(bossIntroLines.value).toEqual([]);
    });

    it('模板 refs 初始为 null', () => {
      const { bossIntroOverlayRef, bossIntroIconRef, bossIntroNameRef } = makeOverlay();
      expect(bossIntroOverlayRef.value).toBeNull();
      expect(bossIntroIconRef.value).toBeNull();
      expect(bossIntroNameRef.value).toBeNull();
    });
  });

  describe('onBossIntro', () => {
    it('设置演出数据（名称/图标/台词）', async () => {
      const { onBossIntro, bossIntroIcon, bossIntroName, bossIntroLines } = makeOverlay();
      onBossIntro(introData);
      expect(bossIntroIcon.value).toBe('dragon-head');
      expect(bossIntroName.value).toBe('黑暗领主');
      expect(bossIntroLines.value).toEqual(['你竟敢踏入我的领地！', '受死吧！']);
    });

    it('显示演出遮罩（showBossIntro = true）', () => {
      const { onBossIntro, showBossIntro } = makeOverlay();
      onBossIntro(introData);
      expect(showBossIntro.value).toBe(true);
    });

    it('注册动画定时器用于自动关闭', () => {
      const { onBossIntro } = makeOverlay();
      onBossIntro(introData);
      // setAnimTimer 应被调用 1 次（自动关闭定时器）
      expect(setAnimTimerMock).toHaveBeenCalledTimes(1);
    });

    it('自动关闭延迟 = max(duration, 1000 + lines*900) + 300', () => {
      const { onBossIntro } = makeOverlay();
      // duration=3000, lines=2 → minDuration = 1000 + 2*900 = 2800
      // actualDuration = max(3000, 2800) = 3000
      // delay = 3000 + 300 = 3300
      onBossIntro(introData);
      expect(setAnimTimerMock).toHaveBeenCalledWith(expect.any(Function), 3300);
    });

    it('duration 小于 minDuration 时使用 minDuration', () => {
      const { onBossIntro } = makeOverlay();
      // duration=1000, lines=3 → minDuration = 1000 + 3*900 = 3700
      // actualDuration = max(1000, 3700) = 3700
      // delay = 3700 + 300 = 4000
      onBossIntro({ ...introData, duration: 1000, lines: ['a', 'b', 'c'] });
      expect(setAnimTimerMock).toHaveBeenCalledWith(expect.any(Function), 4000);
    });

    it('定时器回调触发后关闭遮罩', async () => {
      const { onBossIntro, showBossIntro } = makeOverlay();
      onBossIntro(introData);
      expect(showBossIntro.value).toBe(true);

      // 触发自动关闭定时器回调
      for (const cb of animTimerCallbacks) cb();
      expect(showBossIntro.value).toBe(false);
    });

    it('调用 animateBossIntro 播放动画（refs 就绪后）', async () => {
      const overlay = makeOverlay();
      // 模拟 refs 被模板填充
      overlay.bossIntroOverlayRef.value = {} as HTMLElement;
      overlay.bossIntroIconRef.value = {} as HTMLElement;
      overlay.bossIntroNameRef.value = {} as HTMLElement;

      overlay.onBossIntro(introData);
      await flushPromises();

      expect(animateBossIntroMock).toHaveBeenCalledTimes(1);
      // 验证传入的参数包含正确的 duration 和 combatSpeed
      const args = animateBossIntroMock.mock.calls[0];
      expect(args[4]).toBe(3000); // duration
      expect(args[5]).toBe(1); // combatSpeed
    });

    it('refs 未就绪时不调用 animateBossIntro', async () => {
      const { onBossIntro } = makeOverlay();
      // 不设置 refs，保持 null
      onBossIntro(introData);
      await flushPromises();
      expect(animateBossIntroMock).not.toHaveBeenCalled();
    });
  });

  describe('重复 onBossIntro', () => {
    it('新演出启动前取消旧控制器', async () => {
      const cancelMock = vi.fn();
      animateBossIntroMock.mockReturnValueOnce({ cancel: cancelMock });

      const overlay = makeOverlay();
      overlay.bossIntroOverlayRef.value = {} as HTMLElement;
      overlay.bossIntroIconRef.value = {} as HTMLElement;
      overlay.bossIntroNameRef.value = {} as HTMLElement;

      overlay.onBossIntro(introData);
      await flushPromises();

      // 第二次调用应取消旧控制器
      overlay.onBossIntro(introData);
      expect(cancelMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('isUnmounted 守卫', () => {
    it('组件卸载后不处理 onBossIntro', () => {
      isUnmounted.value = true;
      const { onBossIntro, showBossIntro } = makeOverlay();
      onBossIntro(introData);
      expect(showBossIntro.value).toBe(false);
      expect(setAnimTimerMock).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('取消进行中的动画控制器', async () => {
      const cancelMock = vi.fn();
      animateBossIntroMock.mockReturnValueOnce({ cancel: cancelMock });

      const overlay = makeOverlay();
      overlay.bossIntroOverlayRef.value = {} as HTMLElement;
      overlay.bossIntroIconRef.value = {} as HTMLElement;
      overlay.bossIntroNameRef.value = {} as HTMLElement;

      overlay.onBossIntro(introData);
      await flushPromises();

      overlay.dispose();
      expect(cancelMock).toHaveBeenCalledTimes(1);
    });

    it('无进行中的动画时 dispose 不报错', () => {
      const { dispose } = makeOverlay();
      expect(() => dispose()).not.toThrow();
    });

    it('dispose 后再次 dispose 不报错', async () => {
      const cancelMock = vi.fn();
      animateBossIntroMock.mockReturnValueOnce({ cancel: cancelMock });

      const overlay = makeOverlay();
      overlay.bossIntroOverlayRef.value = {} as HTMLElement;
      overlay.bossIntroIconRef.value = {} as HTMLElement;
      overlay.bossIntroNameRef.value = {} as HTMLElement;

      overlay.onBossIntro(introData);
      await flushPromises();

      overlay.dispose();
      overlay.dispose();
      // cancel 只应被调用 1 次（第二次 dispose 时 controller 已为 null）
      expect(cancelMock).toHaveBeenCalledTimes(1);
    });
  });
});
