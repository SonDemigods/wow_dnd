/**
 * @fileoverview 战斗结果弹窗自动关闭 Composable（useCombatAutoClose）单元测试
 *
 * 覆盖：
 * 1. autoCloseCountdown：初始值为 0
 * 2. scheduleAutoClose：根据战斗结果设置延迟（victory 3 秒 / 其他 2 秒）
 *    - 倒计时递减
 *    - 倒计时结束后调用 onClose 回调
 * 3. clearAutoClose：清理定时器并重置倒计时
 * 4. handleClose：发送 UI_CLICK 事件并清理定时器
 *
 * Mock 策略：
 *  - mock useCombatStore 返回 combatResult
 *  - mock eventBus 验证 emit 调用
 *  - 使用 vi.useFakeTimers 控制时间
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ==================== Mock（使用 vi.hoisted 确保提升时已初始化） ====================

const { storeMock, eventBusMock } = vi.hoisted(() => ({
  storeMock: {
    combatResult: null as string | null,
  },
  eventBusMock: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

vi.mock('@/modules/combat/store', () => ({
  useCombatStore: () => storeMock,
}));

vi.mock('@/modules/bus', () => ({
  eventBus: eventBusMock,
  GameEvents: {
    UI_CLICK: 'ui:click',
  },
}));

// ==================== 导入被测模块 ====================

import { useCombatAutoClose } from '@/modules/combat/composables/useCombatAutoClose';

// ==================== 测试用例 ====================

describe('useCombatAutoClose 战斗结果自动关闭', () => {
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    storeMock.combatResult = null;
    onClose = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('autoCloseCountdown', () => {
    it('初始值为 0', () => {
      const { autoCloseCountdown } = useCombatAutoClose(onClose);
      expect(autoCloseCountdown.value).toBe(0);
    });
  });

  describe('scheduleAutoClose', () => {
    it('victory 结果延迟 3 秒', () => {
      storeMock.combatResult = 'victory';
      const { autoCloseCountdown, scheduleAutoClose } = useCombatAutoClose(onClose);
      scheduleAutoClose();
      expect(autoCloseCountdown.value).toBe(3);
    });

    it('defeat 结果延迟 2 秒', () => {
      storeMock.combatResult = 'defeat';
      const { autoCloseCountdown, scheduleAutoClose } = useCombatAutoClose(onClose);
      scheduleAutoClose();
      expect(autoCloseCountdown.value).toBe(2);
    });

    it('fled 结果延迟 2 秒', () => {
      storeMock.combatResult = 'fled';
      const { autoCloseCountdown, scheduleAutoClose } = useCombatAutoClose(onClose);
      scheduleAutoClose();
      expect(autoCloseCountdown.value).toBe(2);
    });

    it('倒计时每秒递减', () => {
      storeMock.combatResult = 'victory';
      const { autoCloseCountdown, scheduleAutoClose } = useCombatAutoClose(onClose);
      scheduleAutoClose();
      expect(autoCloseCountdown.value).toBe(3);

      vi.advanceTimersByTime(1000);
      expect(autoCloseCountdown.value).toBe(2);

      vi.advanceTimersByTime(1000);
      expect(autoCloseCountdown.value).toBe(1);
    });

    it('倒计时结束后调用 onClose 回调', () => {
      storeMock.combatResult = 'defeat';
      const { scheduleAutoClose } = useCombatAutoClose(onClose);
      scheduleAutoClose();

      vi.advanceTimersByTime(2000);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('victory 倒计时 3 秒后调用 onClose', () => {
      storeMock.combatResult = 'victory';
      const { scheduleAutoClose } = useCombatAutoClose(onClose);
      scheduleAutoClose();

      vi.advanceTimersByTime(2000);
      expect(onClose).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('重复调用 scheduleAutoClose 先清理旧定时器', () => {
      storeMock.combatResult = 'victory';
      const { autoCloseCountdown, scheduleAutoClose } = useCombatAutoClose(onClose);
      scheduleAutoClose();
      expect(autoCloseCountdown.value).toBe(3);

      // 再次调用应重置
      storeMock.combatResult = 'defeat';
      scheduleAutoClose();
      expect(autoCloseCountdown.value).toBe(2);
    });
  });

  describe('clearAutoClose', () => {
    it('清理定时器并重置倒计时', () => {
      storeMock.combatResult = 'victory';
      const { autoCloseCountdown, scheduleAutoClose, clearAutoClose } = useCombatAutoClose(onClose);
      scheduleAutoClose();
      expect(autoCloseCountdown.value).toBe(3);

      clearAutoClose();
      expect(autoCloseCountdown.value).toBe(0);
    });

    it('清理后 onClose 不再被调用', () => {
      storeMock.combatResult = 'victory';
      const { scheduleAutoClose, clearAutoClose } = useCombatAutoClose(onClose);
      scheduleAutoClose();
      clearAutoClose();

      vi.advanceTimersByTime(5000);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('handleClose', () => {
    it('发送 UI_CLICK 事件', () => {
      const { handleClose } = useCombatAutoClose(onClose);
      handleClose();
      expect(eventBusMock.emit).toHaveBeenCalledWith('ui:click', {
        source: 'combat_result_close',
      });
    });

    it('清理自动关闭定时器', () => {
      storeMock.combatResult = 'victory';
      const { autoCloseCountdown, scheduleAutoClose, handleClose } = useCombatAutoClose(onClose);
      scheduleAutoClose();
      expect(autoCloseCountdown.value).toBe(3);

      handleClose();
      expect(autoCloseCountdown.value).toBe(0);
    });

    it('handleClose 不直接调用 onClose（由组件负责 emit）', () => {
      const { handleClose } = useCombatAutoClose(onClose);
      handleClose();
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
