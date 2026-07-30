/**
 * @fileoverview 战斗倍速切换 Composable（useCombatSpeed）单元测试
 *
 * 覆盖：
 * 1. combatSpeed：从 combatStore 派生只读倍速值
 * 2. toggleSpeed：切换倍速并发送 UI_CLICK 事件
 *
 * Mock 策略：
 *  - mock useCombatStore 返回 combatSpeed + toggleCombatSpeed
 *  - mock eventBus 验证 emit 调用
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== Mock（使用 vi.hoisted 确保提升时已初始化） ====================

const { storeMock, eventBusMock } = vi.hoisted(() => ({
  storeMock: {
    combatSpeed: 1 as number,
    toggleCombatSpeed: vi.fn(),
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

import { useCombatSpeed } from '@/modules/combat/composables/useCombatSpeed';

// ==================== 测试用例 ====================

describe('useCombatSpeed 战斗倍速切换', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.combatSpeed = 1;
  });

  describe('combatSpeed', () => {
    it('从 store 读取当前倍速（1x）', () => {
      storeMock.combatSpeed = 1;
      const { combatSpeed } = useCombatSpeed();
      expect(combatSpeed.value).toBe(1);
    });

    it('从 store 读取当前倍速（2x）', () => {
      storeMock.combatSpeed = 2;
      const { combatSpeed } = useCombatSpeed();
      expect(combatSpeed.value).toBe(2);
    });

    it('combatSpeed 不同实例独立读取当前 store 值', () => {
      storeMock.combatSpeed = 2;
      const { combatSpeed } = useCombatSpeed();
      expect(combatSpeed.value).toBe(2);
      // 新实例读取最新值
      storeMock.combatSpeed = 1;
      const { combatSpeed: speed2 } = useCombatSpeed();
      expect(speed2.value).toBe(1);
    });
  });

  describe('toggleSpeed', () => {
    it('调用 store.toggleCombatSpeed 切换倍速', () => {
      const { toggleSpeed } = useCombatSpeed();
      toggleSpeed();
      expect(storeMock.toggleCombatSpeed).toHaveBeenCalledTimes(1);
    });

    it('切换倍速时发送 UI_CLICK 事件', () => {
      const { toggleSpeed } = useCombatSpeed();
      toggleSpeed();
      expect(eventBusMock.emit).toHaveBeenCalledWith('ui:click', {
        source: 'combat_speed_toggle',
      });
    });

    it('多次切换倍速每次都调用 store 和 emit', () => {
      const { toggleSpeed } = useCombatSpeed();
      toggleSpeed();
      toggleSpeed();
      toggleSpeed();
      expect(storeMock.toggleCombatSpeed).toHaveBeenCalledTimes(3);
      expect(eventBusMock.emit).toHaveBeenCalledTimes(3);
    });
  });
});
