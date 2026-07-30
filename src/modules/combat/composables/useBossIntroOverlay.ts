/**
 * @fileoverview Boss 出场演出覆盖层 Composable
 * @description
 *   从 CombatPopup.vue 抽离的 Boss 出场演出逻辑（QA-5 阶段四）。
 *   - 演出状态：showBossIntro / bossIntroIcon / bossIntroName / bossIntroLines
 *   - 模板 refs：bossIntroOverlayRef / bossIntroIconRef / bossIntroNameRef / bossIntroLineRefs
 *   - onBossIntro：COMBAT_BOSS_INTRO 事件处理，调用 animateBossIntro 播放时间线
 *   - dispose：取消进行中的演出动画控制器
 *
 *   设计原则：
 *   - composable 不持有 onMounted/onUnmounted，由组件统一注册
 *   - 依赖通过 options 注入：getCombatSpeed / setAnimTimer / isUnmounted
 *   - bossIntroController 为内部状态，外部通过 dispose 清理
 *
 * @module combat/composables/useBossIntroOverlay
 */
import { ref, nextTick, type Ref } from 'vue';
import { animateBossIntro } from '@/modules/animation';

/**
 * Boss 出场演出覆盖层选项
 */
export interface UseBossIntroOverlayOptions {
  /** 获取当前战斗速度（1 或 2），用于缩放动画时长 */
  getCombatSpeed: () => number;
  /** 注册动画定时器（由组件统一管理清理，避免卸载后访问响应式状态） */
  setAnimTimer: (fn: () => void, delay: number) => ReturnType<typeof setTimeout>;
  /** 组件是否已卸载（防止异步回调在卸载后修改状态） */
  isUnmounted: Ref<boolean>;
}

/**
 * Boss 出场演出覆盖层
 *
 * @param options - 注入依赖
 * @returns 演出状态、模板 refs、onBossIntro 事件处理、dispose 清理方法
 */
export function useBossIntroOverlay(options: UseBossIntroOverlayOptions) {
  // ==================== 演出状态 ====================
  const showBossIntro = ref(false);
  const bossIntroIcon = ref('');
  const bossIntroName = ref('');
  const bossIntroLines = ref<string[]>([]);

  // ==================== 模板 refs（供 anime.js 直接操作 DOM） ====================
  const bossIntroOverlayRef = ref<HTMLElement | null>(null);
  const bossIntroIconRef = ref<HTMLElement | null>(null);
  const bossIntroNameRef = ref<HTMLElement | null>(null);
  const bossIntroLineRefs = ref<Record<number, HTMLElement>>({});

  // ==================== 动画控制器（P2-60 修复：卸载时调用 cancel 清理） ====================
  let bossIntroController: { cancel: () => void } | null = null;

  /**
   * COMBAT_BOSS_INTRO 事件处理
   *
   * 显示 Boss 出场遮罩，播放 anime.js 时间线动画，并在演出结束后自动关闭。
   * 若已有进行中的演出，先取消旧控制器再启动新演出。
   *
   * @param data - Boss 出场数据（名称/图标/台词/时长）
   */
  function onBossIntro(data: {
    enemyId: string;
    enemyName: string;
    icon: string;
    effect: string;
    lines: string[];
    duration: number;
  }): void {
    if (options.isUnmounted.value) return;
    bossIntroIcon.value = data.icon;
    bossIntroName.value = data.enemyName;
    bossIntroLines.value = data.lines;
    showBossIntro.value = true;

    // 取消进行中的旧演出
    if (bossIntroController) {
      bossIntroController.cancel();
      bossIntroController = null;
    }

    // 使用 anime.js 时间线播放演出
    nextTick(() => {
      if (bossIntroOverlayRef.value && bossIntroIconRef.value && bossIntroNameRef.value) {
        const lineEls = Object.values(bossIntroLineRefs.value);
        bossIntroController = animateBossIntro(
          bossIntroOverlayRef.value,
          bossIntroIconRef.value,
          bossIntroNameRef.value,
          lineEls,
          data.duration,
          options.getCombatSpeed(),
        );
      }
    });

    // 演出结束后自动关闭（+300ms 给淡出动画留时间）
    const minDuration = 1000 + data.lines.length * 900;
    const actualDuration = Math.max(data.duration, minDuration);
    options.setAnimTimer(() => {
      showBossIntro.value = false;
      bossIntroController = null;
    }, actualDuration + 300);
  }

  /**
   * 清理 Boss 出场演出资源
   *
   * 在组件 onUnmounted 中调用，取消进行中的动画控制器。
   */
  function dispose(): void {
    if (bossIntroController) {
      bossIntroController.cancel();
      bossIntroController = null;
    }
  }

  return {
    // 演出状态
    showBossIntro,
    bossIntroIcon,
    bossIntroName,
    bossIntroLines,
    // 模板 refs
    bossIntroOverlayRef,
    bossIntroIconRef,
    bossIntroNameRef,
    bossIntroLineRefs,
    // 事件处理
    onBossIntro,
    // 资源清理
    dispose,
  };
}
