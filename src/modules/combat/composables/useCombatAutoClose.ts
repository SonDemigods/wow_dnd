/**
 * @fileoverview 战斗结果弹窗自动关闭 Composable
 * @description
 *   从 CombatPopup.vue 抽离的倒计时与自动关闭逻辑（QA-5 阶段四）。
 *   - autoCloseCountdown：剩余秒数（响应式，供模板显示）
 *   - scheduleAutoClose：根据战斗结果启动倒计时（victory 3 秒 / 其他 2 秒）
 *   - clearAutoClose：清理定时器（onUnmounted 调用）
 *   - handleClose：发送 UI_CLICK 事件并清理定时器（emit close 由组件负责）
 *
 *   设计原则：
 *   - composable 不持有 onMounted/onUnmounted，由组件统一注册
 *   - 不直接 emit 组件事件，close 逻辑由组件通过回调或直接调用 emit 实现
 *   - 内部使用 setInterval + setTimeout 双定时器，clearAutoClose 统一清理
 *
 * @module combat/composables/useCombatAutoClose
 */
import { ref } from 'vue';
import { useCombatStore } from '../store';
import { eventBus, GameEvents } from '@/modules/bus';

/**
 * 战斗结果弹窗自动关闭
 *
 * @param onClose - 倒计时结束时的关闭回调（由组件传入，内部 emit('close', ...)）
 * @returns { autoCloseCountdown, scheduleAutoClose, clearAutoClose, handleClose }
 */
export function useCombatAutoClose(onClose: () => void) {
  const combatStore = useCombatStore();

  /** 剩余自动关闭秒数（供模板显示） */
  const autoCloseCountdown = ref(0);

  let autoCloseTimer: ReturnType<typeof setInterval> | null = null;
  let autoCloseTimeout: ReturnType<typeof setTimeout> | null = null;

  /** 清理所有未触发的自动关闭定时器 */
  function clearAutoClose(): void {
    if (autoCloseTimer) {
      clearInterval(autoCloseTimer);
      autoCloseTimer = null;
    }
    if (autoCloseTimeout) {
      clearTimeout(autoCloseTimeout);
      autoCloseTimeout = null;
    }
    autoCloseCountdown.value = 0;
  }

  /**
   * 启动自动关闭倒计时
   *
   * 战斗结果为 victory 时延迟 3 秒，其他结果（defeat/fled）延迟 2 秒。
   * 倒计时结束后调用 onClose 回调。
   */
  function scheduleAutoClose(): void {
    clearAutoClose();
    const delay = combatStore.combatResult === 'victory' ? 3 : 2;
    autoCloseCountdown.value = delay;

    autoCloseTimer = setInterval(() => {
      autoCloseCountdown.value--;
      if (autoCloseCountdown.value <= 0) {
        if (autoCloseTimer) {
          clearInterval(autoCloseTimer);
          autoCloseTimer = null;
        }
      }
    }, 1000);

    autoCloseTimeout = setTimeout(() => {
      clearAutoClose();
      onClose();
    }, delay * 1000);
  }

  /**
   * 用户手动关闭（点击"确定"按钮）
   *
   * 发送 UI_CLICK 事件，清理定时器；
   * 实际的 emit('close') 由组件在调用此函数后自行处理。
   */
  function handleClose(): void {
    eventBus.emit(GameEvents.UI_CLICK, { source: 'combat_result_close' });
    clearAutoClose();
  }

  return {
    autoCloseCountdown,
    scheduleAutoClose,
    clearAutoClose,
    handleClose,
  };
}
