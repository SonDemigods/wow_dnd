/**
 * @fileoverview 战斗倍速切换 Composable
 * @description
 *   从 CombatPopup.vue 抽离的 1x/2x 倍速切换逻辑（QA-5 阶段四）。
 *   - combatSpeed：从 combatStore 派生的只读倍速值
 *   - toggleSpeed：切换倍速并发送 UI_CLICK 事件
 *
 *   设计原则：
 *   - composable 不持有 onMounted/onUnmounted，由组件统一注册
 *   - 不直接操作 DOM，仅修改 store 状态并触发事件
 *
 * @module combat/composables/useCombatSpeed
 */
import { computed, type ComputedRef } from 'vue';
import { useCombatStore } from '../store';
import { eventBus, GameEvents } from '@/modules/bus';

/**
 * 战斗倍速切换选项
 *
 * P9-067 修复：通过参数注入 combat 状态/引用，替代直接 import useCombatStore。
 * 测试时可传入 mock combatSpeed/toggleCombatSpeed 避免依赖 Pinia 初始化。
 */
export interface UseCombatSpeedOptions {
  /** 当前战斗倍速（注入替代直接访问 combatStore.combatSpeed） */
  combatSpeed?: ComputedRef<number>;
  /** 切换倍速函数（注入替代直接调用 combatStore.toggleCombatSpeed） */
  toggleCombatSpeed?: () => void;
}

/**
 * 战斗倍速切换
 *
 * @param options - 可选注入参数（combatSpeed/toggleCombatSpeed），测试时传入 mock 避免直接依赖 Pinia
 * @returns { combatSpeed, toggleSpeed }
 * - combatSpeed：当前倍速（1 或 2），只读 computed
 * - toggleSpeed：切换倍速，内部调用 store.toggleCombatSpeed 并发送 UI_CLICK 事件
 */
export function useCombatSpeed(options?: UseCombatSpeedOptions) {
  // P9-067 修复：优先使用注入的 combatSpeed/toggleCombatSpeed，未注入时惰性回退到 useCombatStore
  const combatSpeed = options?.combatSpeed ?? computed(() => useCombatStore().combatSpeed);

  /** 切换倍速（1x ↔ 2x） */
  function toggleSpeed(): void {
    if (options?.toggleCombatSpeed) {
      options.toggleCombatSpeed();
    } else {
      useCombatStore().toggleCombatSpeed();
    }
    eventBus.emit(GameEvents.UI_CLICK, { source: 'combat_speed_toggle' });
  }

  return { combatSpeed, toggleSpeed };
}
