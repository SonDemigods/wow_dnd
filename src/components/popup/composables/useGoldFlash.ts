/**
 * @fileoverview 金币闪烁动画 Composable
 * @description 从 ShopPopup 抽离的金币闪烁逻辑，封装 setTimeout 定时器管理与组件卸载清理。
 *
 * 购买/出售成功时调用 {@link trigger} 触发 500ms 闪烁动画，组件卸载时自动清理未触发的定时器，
 * 避免卸载后访问已卸载组件的响应式状态触发 Vue 警告。
 *
 * P3-163 修复：从 ShopPopup.vue 抽离为独立 Composable，便于独立测试与复用。
 */
import { ref, onUnmounted } from 'vue';

/** 闪烁动画持续时长（毫秒） */
const FLASH_DURATION = 500;

/**
 * 金币闪烁动画（购买/出售成功时触发）
 *
 * @returns `goldFlash` 响应式状态（绑定到模板的 class）；`trigger` 触发函数
 */
export function useGoldFlash() {
  /** 金币闪烁动画状态，true 时模板添加 flash class 播放动画 */
  const goldFlash = ref(false);

  /**
   * 闪烁复位定时器 ID
   *
   * setup 作用域，trigger/cleanup 闭包共享同一引用。
   * 连续购买/出售时通过 clearTimeout 清理上一次未触发的定时器，避免定时器堆叠。
   */
  let timerId: ReturnType<typeof setTimeout> | null = null;

  /** 触发金币闪烁动画 */
  function trigger() {
    goldFlash.value = true;
    // 清理上一次未触发的定时器，避免连续购买/出售时定时器堆叠
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      timerId = null;
      goldFlash.value = false;
    }, FLASH_DURATION);
  }

  /** 清理未触发的复位定时器 */
  function cleanup() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  // 组件卸载时清理定时器，防止卸载后访问响应式状态
  onUnmounted(cleanup);

  return { goldFlash, trigger };
}
