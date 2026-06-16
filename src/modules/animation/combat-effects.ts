/**
 * @fileoverview 战斗动画效果模块
 * @description 基于 anime.js v4 的战斗演出动画函数，替代 CombatPopup 中 CSS class + setTimeout 的动画模式。
 * 所有动画函数直接操作 DOM 元素，支持 speed 参数控制播放速度（1=正常，2=双倍速）。
 */

import { animate, createTimeline } from 'animejs';

/** 缩放 duration 的辅助函数 */
function s(duration: number, speed: number): number {
  return Math.round(duration / speed);
}

// ==================== 震动效果 ====================

/** 普通攻击震动 */
export function animateShake(target: HTMLElement, speed: number = 1): void {
  animate(target, {
    translateX: [
      { to: -8, duration: s(120, speed) },
      { to: 8, duration: s(120, speed) },
      { to: -4, duration: s(120, speed) },
      { to: 4, duration: s(120, speed) },
      { to: 0, duration: s(120, speed) },
    ],
    ease: 'easeInOutSine',
    duration: s(600, speed),
  });
}

/** 暴击震动（更强、更持久） */
export function animateCritShake(target: HTMLElement, speed: number = 1): void {
  animate(target, {
    translateX: [
      { to: -14, duration: s(90, speed) },
      { to: 14, duration: s(180, speed) },
      { to: -10, duration: s(180, speed) },
      { to: 10, duration: s(180, speed) },
      { to: -4, duration: s(135, speed) },
      { to: 0, duration: s(135, speed) },
    ],
    scale: [
      { to: 1.05, duration: s(90, speed) },
      { to: 0.95, duration: s(180, speed) },
      { to: 1.03, duration: s(180, speed) },
      { to: 0.97, duration: s(180, speed) },
      { to: 1.01, duration: s(135, speed) },
      { to: 1, duration: s(135, speed) },
    ],
    ease: 'easeInOutSine',
    duration: s(900, speed),
  });
}

// ==================== 闪避闪烁 ====================

/** 闪避闪烁效果 */
export function animateDodgeBlink(target: HTMLElement, speed: number = 1): void {
  animate(target, {
    opacity: [
      { to: 0.2, duration: s(200, speed) },
      { to: 1, duration: s(200, speed) },
      { to: 0.3, duration: s(200, speed) },
      { to: 1, duration: s(200, speed) },
    ],
    ease: 'easeInOutSine',
    duration: s(800, speed),
  });
}

// ==================== 浮动伤害数字 ====================

/** 浮动伤害/生命恢复/数字 */
export function animateFloating(
  target: HTMLElement,
  type: 'damage' | 'crit' | 'heal' | 'dodge',
  speed: number = 1
): void {
  const isCrit = type === 'crit';
  animate(target, {
    translateY: [
      { to: isCrit ? -15 : -20, duration: s(isCrit ? 360 : 480, speed) },
      { to: isCrit ? -30 : -20, duration: s(isCrit ? 360 : 480, speed) },
      { to: isCrit ? -60 : -50, duration: s(isCrit ? 1080 : 640, speed) },
    ],
    scale: [
      { to: isCrit ? 1.4 : 1.2, duration: s(isCrit ? 360 : 480, speed) },
      { to: isCrit ? 1.1 : 1.2, duration: s(isCrit ? 360 : 480, speed) },
      { to: isCrit ? 0.7 : 0.8, duration: s(isCrit ? 1080 : 640, speed) },
    ],
    opacity: [
      { to: 1, duration: s(isCrit ? 720 : 960, speed) },
      { to: 0, duration: s(isCrit ? 1080 : 640, speed) },
    ],
    ease: 'easeOutQuad',
    duration: s(isCrit ? 1800 : 1600, speed),
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
  type: 'crit' | 'dodge',
  speed: number = 1
): void {
  const isCrit = type === 'crit';
  animate(target, {
    backgroundColor: isCrit
      ? [
          { to: 'rgba(255, 215, 0, 0.4)', duration: s(180, speed) },
          { to: 'rgba(255, 215, 0, 0.15)', duration: s(240, speed) },
          { to: 'rgba(255, 255, 255, 0.05)', duration: s(180, speed) },
        ]
      : [
          { to: 'rgba(255, 255, 255, 0.2)', duration: s(300, speed) },
          { to: 'rgba(255, 255, 255, 0.05)', duration: s(300, speed) },
        ],
    ease: 'easeOutQuad',
    duration: s(600, speed),
    onComplete: () => {
      target.style.backgroundColor = 'transparent';
    },
  });
}

// ==================== VS 分隔闪动 ====================

/** VS 分隔符闪动 */
export function animateVsFlash(target: HTMLElement, speed: number = 1): void {
  animate(target, {
    scale: [
      { to: 1.4, duration: s(225, speed) },
      { to: 1, duration: s(225, speed) },
    ],
    color: [
      { to: '#fff', duration: s(225, speed) },
      { to: '#ffd700', duration: s(225, speed) },
    ],
    ease: 'easeInOutSine',
    duration: s(450, speed),
  });
}

// ==================== Boss 出场演出 ====================

/** Boss 出场演出（多步骤时间线） */
export function animateBossIntro(
  overlay: HTMLElement,
  icon: HTMLElement,
  name: HTMLElement,
  lines: HTMLElement[],
  duration: number,
  speed: number = 1
): void {
  const tl = createTimeline({ defaults: { ease: 'easeOutCubic' } });

  // 遮罩淡入
  tl.add(overlay, {
    opacity: [0, 1],
    duration: s(500, speed),
  });

  // 图标弹入
  tl.add(icon, {
    scale: [0, 1.3, 1],
    opacity: [0, 1],
    duration: s(800, speed),
  }, `-=${s(300, speed)}`);

  // 名称滑入
  tl.add(name, {
    translateY: [20, 0],
    opacity: [0, 1],
    duration: s(600, speed),
  }, `-=${s(400, speed)}`);

  // 台词逐行滑入
  for (let i = 0; i < lines.length; i++) {
    tl.add(lines[i], {
      translateY: [10, 0],
      opacity: [0, 1],
      duration: s(500, speed),
    }, `-=${s(i === 0 ? 200 : 100, speed)}`);
  }

  // 自动关闭
  const minDuration = s(1000 + lines.length * 900, speed);
  const actualDuration = Math.max(s(duration, speed), minDuration);
  setTimeout(() => {
    animate(overlay, {
      opacity: 0,
      duration: s(300, speed),
      ease: 'easeInQuad',
    });
  }, actualDuration);
}

// ==================== Boss 阶段转换 ====================

/** Boss 阶段转换特效 */
export function animatePhaseTransition(
  backdrop: HTMLElement,
  content: HTMLElement,
  speed: number = 1
): void {
  const tl = createTimeline({ defaults: { ease: 'easeOutCubic' } });

  // 遮罩闪现
  tl.add(backdrop, {
    opacity: [0, 1],
    duration: s(250, speed),
  });

  // 内容缩放进入
  tl.add(content, {
    scale: [0.7, 1.08, 1],
    opacity: [0, 1],
    duration: s(500, speed),
  }, `-=${s(100, speed)}`);

  // 保持显示
  tl.add([backdrop, content], {
    opacity: 1,
    duration: s(1250, speed),
  });

  // 淡出
  tl.add([backdrop, content], {
    opacity: 0,
    duration: s(500, speed),
  });
}

// ==================== 结果弹窗 ====================

/** 战斗结果弹窗入场动画 */
export function animateResultPopup(
  popup: HTMLElement,
  icon: HTMLElement,
  rewards: HTMLElement[],
  speed: number = 1
): void {
  const tl = createTimeline({ defaults: { ease: 'easeOutElastic(1, .5)' } });

  // 弹窗弹入
  tl.add(popup, {
    scale: [0.5, 1],
    opacity: [0, 1],
    duration: s(500, speed),
  });

  // 图标弹跳
  tl.add(icon, {
    scale: [0, 1.3, 1],
    duration: s(600, speed),
  }, `-=${s(400, speed)}`);

  // 奖励项逐个滑入
  for (let i = 0; i < rewards.length; i++) {
    tl.add(rewards[i], {
      translateY: [10, 0],
      opacity: [0, 1],
      duration: s(400, speed),
    }, `-=${s(i === 0 ? 200 : 200, speed)}`);
  }
}

// ==================== 战斗日志滑入 ====================

/** 战斗日志条目滑入 */
export function animateLogSlideIn(target: HTMLElement, speed: number = 1): void {
  animate(target, {
    translateY: [-10, 0],
    opacity: [0, 1],
    duration: s(300, speed),
    ease: 'easeOutQuad',
  });
}
