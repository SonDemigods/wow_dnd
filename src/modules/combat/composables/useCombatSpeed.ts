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
import { computed } from 'vue';
import { useCombatStore } from '../store';
import { eventBus, GameEvents } from '@/modules/bus';

/**
 * 战斗倍速切换
 *
 * @returns { combatSpeed, toggleSpeed }
 * - combatSpeed：当前倍速（1 或 2），只读 computed
 * - toggleSpeed：切换倍速，内部调用 store.toggleCombatSpeed 并发送 UI_CLICK 事件
 */
export function useCombatSpeed() {
  const combatStore = useCombatStore();

  /** 当前战斗倍速（1 或 2） */
  const combatSpeed = computed(() => combatStore.combatSpeed);

  /** 切换倍速（1x ↔ 2x） */
  function toggleSpeed(): void {
    combatStore.toggleCombatSpeed();
    eventBus.emit(GameEvents.UI_CLICK, { source: 'combat_speed_toggle' });
  }

  return { combatSpeed, toggleSpeed };
}
