/**
 * @fileoverview 战斗动画效果模块
 * @description 基于 anime.js v4 的战斗演出动画函数，替代 CombatPopup 中 CSS class + setTimeout 的动画模式。
 * 所有动画函数直接操作 DOM 元素。
 */

import { animate, createTimeline } from 'animejs';

// ==================== 震动效果 ====================

/** 普通攻击震动 */
export function animateShake(target: HTMLElement): void {
  animate(target, {
    translateX: [
      { to: -8, duration: 120 },
      { to: 8, duration: 120 },
      { to: -4, duration: 120 },
      { to: 4, duration: 120 },
      { to: 0, duration: 120 },
    ],
    ease: 'easeInOutSine',
    duration: 600,
  });
}

/** 暴击震动（更强、更持久） */
export function animateCritShake(target: HTMLElement): void {
  animate(target, {
    translateX: [
      { to: -14, duration: 90 },
      { to: 14, duration: 180 },
      { to: -10, duration: 180 },
      { to: 10, duration: 180 },
      { to: -4, duration: 135 },
      { to: 0, duration: 135 },
    ],
    scale: [
      { to: 1.05, duration: 90 },
      { to: 0.95, duration: 180 },
      { to: 1.03, duration: 180 },
      { to: 0.97, duration: 180 },
      { to: 1.01, duration: 135 },
      { to: 1, duration: 135 },
    ],
    ease: 'easeInOutSine',
    duration: 900,
  });
}

// ==================== 闪避闪烁 ====================

/** 闪避闪烁效果 */
export function animateDodgeBlink(target: HTMLElement): void {
  animate(target, {
    opacity: [
      { to: 0.2, duration: 200 },
      { to: 1, duration: 200 },
      { to: 0.3, duration: 200 },
      { to: 1, duration: 200 },
    ],
    ease: 'easeInOutSine',
    duration: 800,
  });
}

// ==================== 浮动伤害数字 ====================

/** 浮动伤害/生命恢复/数字 */
export function animateFloating(
  target: HTMLElement,
  type: 'damage' | 'crit' | 'heal' | 'dodge'
): void {
  const isCrit = type === 'crit';
  animate(target, {
    translateY: [
      { to: isCrit ? -15 : -20, duration: isCrit ? 360 : 480 },
      { to: isCrit ? -30 : -20, duration: isCrit ? 360 : 480 },
      { to: isCrit ? -60 : -50, duration: isCrit ? 1080 : 640 },
    ],
    scale: [
      { to: isCrit ? 1.4 : 1.2, duration: isCrit ? 360 : 480 },
      { to: isCrit ? 1.1 : 1.2, duration: isCrit ? 360 : 480 },
      { to: isCrit ? 0.7 : 0.8, duration: isCrit ? 1080 : 640 },
    ],
    opacity: [
      { to: 1, duration: isCrit ? 720 : 960 },
      { to: 0, duration: isCrit ? 1080 : 640 },
    ],
    ease: 'easeOutQuad',
    duration: isCrit ? 1800 : 1600,
    onComplete: () => {
      // 不再直接移除 DOM 节点，交由 Vue 控制元素生命周期
      // 否则 Vue 后续 re-render 时找不到该节点，触发 insertBefore 错误
      target.style.opacity = '0';
      target.style.transform = '';
    },
  });
}

// ==================== 屏幕闪白 ====================

/** 屏幕闪白特效 */
export function animateScreenFlash(
  target: HTMLElement,
  type: 'crit' | 'dodge'
): void {
  const isCrit = type === 'crit';
  animate(target, {
    backgroundColor: isCrit
      ? [
          { to: 'rgba(255, 215, 0, 0.4)', duration: 180 },
          { to: 'rgba(255, 215, 0, 0.15)', duration: 240 },
          { to: 'rgba(255, 255, 255, 0.05)', duration: 180 },
        ]
      : [
          { to: 'rgba(255, 255, 255, 0.2)', duration: 300 },
          { to: 'rgba(255, 255, 255, 0.05)', duration: 300 },
        ],
    ease: 'easeOutQuad',
    duration: 600,
    onComplete: () => {
      target.style.backgroundColor = 'transparent';
    },
  });
}

// ==================== VS 分隔闪动 ====================

/** VS 分隔符闪动 */
export function animateVsFlash(target: HTMLElement): void {
  animate(target, {
    scale: [
      { to: 1.4, duration: 225 },
      { to: 1, duration: 225 },
    ],
    color: [
      { to: '#fff', duration: 225 },
      { to: '#ffd700', duration: 225 },
    ],
    ease: 'easeInOutSine',
    duration: 450,
  });
}

// ==================== Boss 出场演出 ====================

/** Boss 出场演出（多步骤时间线） */
export function animateBossIntro(
  overlay: HTMLElement,
  icon: HTMLElement,
  name: HTMLElement,
  lines: HTMLElement[],
  duration: number
): void {
  const tl = createTimeline({ defaults: { ease: 'easeOutCubic' } });

  // 遮罩淡入
  tl.add(overlay, {
    opacity: [0, 1],
    duration: 500,
  });

  // 图标弹入
  tl.add(icon, {
    scale: [0, 1.3, 1],
    opacity: [0, 1],
    duration: 800,
  }, '-=300');

  // 名称滑入
  tl.add(name, {
    translateY: [20, 0],
    opacity: [0, 1],
    duration: 600,
  }, '-=400');

  // 台词逐行滑入
  for (let i = 0; i < lines.length; i++) {
    tl.add(lines[i], {
      translateY: [10, 0],
      opacity: [0, 1],
      duration: 500,
    }, `-=${i === 0 ? 200 : 100}`);
  }

  // 自动关闭
  const minDuration = 1000 + lines.length * 900;
  const actualDuration = Math.max(duration, minDuration);
  setTimeout(() => {
    animate(overlay, {
      opacity: 0,
      duration: 300,
      ease: 'easeInQuad',
    });
  }, actualDuration);
}

// ==================== Boss 阶段转换 ====================

/** Boss 阶段转换特效 */
export function animatePhaseTransition(
  backdrop: HTMLElement,
  content: HTMLElement
): void {
  const tl = createTimeline({ defaults: { ease: 'easeOutCubic' } });

  // 遮罩闪现
  tl.add(backdrop, {
    opacity: [0, 1],
    duration: 250,
  });

  // 内容缩放进入
  tl.add(content, {
    scale: [0.7, 1.08, 1],
    opacity: [0, 1],
    duration: 500,
  }, '-=100');

  // 保持显示
  tl.add([backdrop, content], {
    opacity: 1,
    duration: 1250,
  });

  // 淡出
  tl.add([backdrop, content], {
    opacity: 0,
    duration: 500,
  });
}

// ==================== 结果弹窗 ====================

/** 战斗结果弹窗入场动画 */
export function animateResultPopup(
  popup: HTMLElement,
  icon: HTMLElement,
  rewards: HTMLElement[]
): void {
  const tl = createTimeline({ defaults: { ease: 'easeOutElastic(1, .5)' } });

  // 弹窗弹入
  tl.add(popup, {
    scale: [0.5, 1],
    opacity: [0, 1],
    duration: 500,
  });

  // 图标弹跳
  tl.add(icon, {
    scale: [0, 1.3, 1],
    duration: 600,
  }, '-=400');

  // 奖励项逐个滑入
  for (let i = 0; i < rewards.length; i++) {
    tl.add(rewards[i], {
      translateY: [10, 0],
      opacity: [0, 1],
      duration: 400,
    }, `-=${i === 0 ? 200 : 200}`);
  }
}

// ==================== 战斗日志滑入 ====================

/** 战斗日志条目滑入 */
export function animateLogSlideIn(target: HTMLElement): void {
  animate(target, {
    translateY: [-10, 0],
    opacity: [0, 1],
    duration: 300,
    ease: 'easeOutQuad',
  });
}
