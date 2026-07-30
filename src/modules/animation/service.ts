/**
 * @fileoverview 战斗动画效果模块
 * @description 基于 anime.js v4 的战斗演出动画函数，替代 CombatPopup 中 CSS class + setTimeout 的动画模式。
 * 所有动画函数直接操作 DOM 元素，支持 speed 参数控制播放速度（1=正常，2=双倍速）。
 */

import { animate, createTimeline } from 'animejs';
import type { JSAnimation, Timeline } from 'animejs';
import { CombatColors } from '@/config/combat-colors';
import { defaultRng } from '@/utils/rng';
import type { FloatingType, ParticleConfig } from './types';

/** 速度倍率的有效下限，防止 speed 为 0 或负值时产生 Infinity/负数 duration */
const MIN_SPEED = 0.1;

/** 根据速度倍率缩放动画 duration */
function scaleDuration(duration: number, speed: number): number {
  // 兜底：speed 正常值为 1 或 2，但若异常传入 0/负值会得到 Infinity/负数，
  // 用 Math.max 确保除数至少为 MIN_SPEED（动画变为极慢，可见但不崩溃）
  return Math.round(duration / Math.max(MIN_SPEED, speed));
}

// ==================== 震动效果 ====================

/** 普通攻击震动 */
export function animateShake(target: HTMLElement, speed: number = 1): JSAnimation {
  return animate(target, {
    translateX: [
      { to: -8, duration: scaleDuration(120, speed) },
      { to: 8, duration: scaleDuration(120, speed) },
      { to: -4, duration: scaleDuration(120, speed) },
      { to: 4, duration: scaleDuration(120, speed) },
      { to: 0, duration: scaleDuration(120, speed) },
    ],
    ease: 'easeInOutSine',
    duration: scaleDuration(600, speed),
  });
}

/** 暴击震动（更强、更持久） */
export function animateCritShake(target: HTMLElement, speed: number = 1): JSAnimation {
  return animate(target, {
    translateX: [
      { to: -14, duration: scaleDuration(90, speed) },
      { to: 14, duration: scaleDuration(180, speed) },
      { to: -10, duration: scaleDuration(180, speed) },
      { to: 10, duration: scaleDuration(180, speed) },
      { to: -4, duration: scaleDuration(135, speed) },
      { to: 0, duration: scaleDuration(135, speed) },
    ],
    scale: [
      { to: 1.05, duration: scaleDuration(90, speed) },
      { to: 0.95, duration: scaleDuration(180, speed) },
      { to: 1.03, duration: scaleDuration(180, speed) },
      { to: 0.97, duration: scaleDuration(180, speed) },
      { to: 1.01, duration: scaleDuration(135, speed) },
      { to: 1, duration: scaleDuration(135, speed) },
    ],
    ease: 'easeInOutSine',
    duration: scaleDuration(900, speed),
  });
}

// ==================== 受击方身体特效（T1 新增） ====================

/** 法术伤害：柔和缩放脉冲 */
export function animateMagicPulse(target: HTMLElement, speed: number = 1): JSAnimation {
  return animate(target, {
    scale: [
      { to: 0.92, duration: scaleDuration(250, speed) },
      { to: 1.02, duration: scaleDuration(250, speed) },
      { to: 1, duration: scaleDuration(300, speed) },
    ],
    boxShadow: [
      { to: `0 0 16px ${CombatColors.damageMagicBg}`, duration: scaleDuration(250, speed) },
      { to: '0 0 0px transparent', duration: scaleDuration(550, speed) },
    ],
    ease: 'easeInOutSine',
    duration: scaleDuration(800, speed),
  });
}

/** 光晕扩散（HP/MP 共用） */
export function animateGlow(target: HTMLElement, baseColor: string, speed: number = 1): JSAnimation {
  return animate(target, {
    boxShadow: [
      { to: `0 0 8px ${baseColor}, 0 0 24px ${baseColor}88`, duration: scaleDuration(400, speed) },
      { to: '0 0 0px transparent', duration: scaleDuration(600, speed) },
    ],
    ease: 'easeOutQuad',
    duration: scaleDuration(1000, speed),
  });
}

/** 生命恢复：绿色光晕从内向外扩散 */
export const animateHealGlow = (target: HTMLElement, speed?: number): JSAnimation =>
  animateGlow(target, CombatColors.healHp, speed);

/** 法力恢复：蓝色光晕从内向外扩散 */
export const animateManaGlow = (target: HTMLElement, speed?: number): JSAnimation =>
  animateGlow(target, CombatColors.healMp, speed);

/** 暴击：金色边框爆闪 */
export function animateCritBorderFlash(target: HTMLElement, speed: number = 1): JSAnimation {
  return animate(target, {
    borderColor: [
      { to: CombatColors.damageCrit, duration: scaleDuration(150, speed) },
      { to: CombatColors.damageCrit, duration: scaleDuration(200, speed) },
      { to: '', duration: scaleDuration(350, speed) },
    ],
    boxShadow: [
      { to: `0 0 20px ${CombatColors.flashCrit}`, duration: scaleDuration(150, speed) },
      { to: '0 0 0px transparent', duration: scaleDuration(550, speed) },
    ],
    ease: 'easeOutExpo',
    duration: scaleDuration(700, speed),
    onComplete: () => {
      target.style.borderColor = '';
    },
  });
}

// ==================== 闪避闪烁 ====================

/** 闪避闪烁效果 */
export function animateDodgeBlink(target: HTMLElement, speed: number = 1): JSAnimation {
  return animate(target, {
    opacity: [
      { to: 0.2, duration: scaleDuration(200, speed) },
      { to: 1, duration: scaleDuration(200, speed) },
      { to: 0.3, duration: scaleDuration(200, speed) },
      { to: 1, duration: scaleDuration(200, speed) },
    ],
    ease: 'easeInOutSine',
    duration: scaleDuration(800, speed),
  });
}

// ==================== 浮动伤害数字（T1 升级） ====================

/** 各浮动类型的动画参数 */
const FLOATING_PARAMS: Record<FloatingType, {
  riseDistance: number;
  scalePeak: number;
  ease: string;
  duration: number;
  swayX: number;
  rotate: number;
}> = {
  physical: { riseDistance: 50, scalePeak: 1.3, ease: 'easeOutExpo',  duration: 1600, swayX: 0,   rotate: 0 },
  magic:    { riseDistance: 55, scalePeak: 1.2, ease: 'easeOutSine',  duration: 1800, swayX: 3,   rotate: 0 },
  'heal-hp':{ riseDistance: 45, scalePeak: 1.25,ease: 'easeOutBounce',duration: 1500, swayX: 0,   rotate: 0 },
  'heal-mp':{ riseDistance: 50, scalePeak: 1.2, ease: 'easeOutElastic(1, .4)', duration: 1600, swayX: 0, rotate: 5 },
  crit:     { riseDistance: 70, scalePeak: 1.5, ease: 'easeOutExpo',  duration: 2000, swayX: 0,   rotate: 0 },
  dodge:    { riseDistance: 30, scalePeak: 1.1, ease: 'easeOutQuad',  duration: 1200, swayX: 12,  rotate: 0 },
};

/** 浮动伤害/生命恢复/数字（扩展版） */
export function animateFloating(
  target: HTMLElement,
  type: FloatingType,
  speed: number = 1
): JSAnimation {
  const p = FLOATING_PARAMS[type];
  const isCrit = type === 'crit';

  // 条件构建水平摆动关键帧
  let translateX: { to: number; duration: number }[] | undefined;
  if (p.swayX > 5) {
    // 闪避：快速侧移
    translateX = [
      { to: p.swayX, duration: scaleDuration(250, speed) },
      { to: -4, duration: scaleDuration(500, speed) },
      { to: 0, duration: scaleDuration(450, speed) },
    ];
  } else if (p.swayX !== 0) {
    // 法术伤害：正弦波水平摆动
    translateX = [
      { to: -p.swayX, duration: scaleDuration(300, speed) },
      { to: p.swayX, duration: scaleDuration(600, speed) },
      { to: 0, duration: scaleDuration(p.duration - 900, speed) },
    ];
  }

  // 条件构建旋转关键帧
  let rotate: { to: string; duration: number }[] | undefined;
  if (p.rotate !== 0) {
    // 法力恢复：轻微旋转
    rotate = [
      { to: `${p.rotate}deg`, duration: scaleDuration(p.duration * 0.5, speed) },
      { to: `-${p.rotate * 0.5}deg`, duration: scaleDuration(p.duration * 0.5, speed) },
    ];
  }

  const keyframes = {
    translateY: [
      { to: isCrit ? -15 : -p.riseDistance * 0.4, duration: scaleDuration(isCrit ? 360 : 480, speed) },
      { to: p.riseDistance * 0.6, duration: scaleDuration(isCrit ? 360 : 480, speed) },
      { to: p.riseDistance, duration: scaleDuration(isCrit ? 1080 : 640, speed) },
    ],
    scale: [
      { to: p.scalePeak, duration: scaleDuration(isCrit ? 360 : 480, speed) },
      { to: p.scalePeak * (isCrit ? 0.73 : 0.67), duration: scaleDuration(isCrit ? 1080 : 640, speed) },
    ],
    opacity: [
      { to: 1, duration: scaleDuration(isCrit ? 720 : 960, speed) },
      { to: 0, duration: scaleDuration(isCrit ? 1080 : 640, speed) },
    ],
    ...(translateX ? { translateX } : {}),
    ...(rotate ? { rotate } : {}),
    ease: p.ease,
    duration: scaleDuration(p.duration, speed),
    onComplete: () => {
      target.style.opacity = '0';
      target.style.transform = '';
    },
  };

  return animate(target, keyframes);
}

// ==================== 屏幕闪白 ====================

/** 屏幕闪白特效 */
export function animateScreenFlash(
  target: HTMLElement,
  type: 'crit' | 'dodge',
  speed: number = 1
): JSAnimation {
  const isCrit = type === 'crit';
  return animate(target, {
    backgroundColor: isCrit
      ? [
          { to: CombatColors.flashCrit, duration: scaleDuration(180, speed) },
          { to: CombatColors.flashCritFade, duration: scaleDuration(240, speed) },
          { to: CombatColors.flashDodgeFade, duration: scaleDuration(180, speed) },
        ]
      : [
          { to: CombatColors.flashDodge, duration: scaleDuration(300, speed) },
          { to: CombatColors.flashDodgeFade, duration: scaleDuration(300, speed) },
        ],
    ease: 'easeOutQuad',
    duration: scaleDuration(600, speed),
    onComplete: () => {
      target.style.backgroundColor = 'transparent';
    },
  });
}

// ==================== VS 分隔闪动 ====================

/** VS 分隔符闪动 */
export function animateVsFlash(target: HTMLElement, speed: number = 1): JSAnimation {
  return animate(target, {
    scale: [
      { to: 1.4, duration: scaleDuration(225, speed) },
      { to: 1, duration: scaleDuration(225, speed) },
    ],
    color: [
      { to: '#fff', duration: scaleDuration(225, speed) },
      { to: CombatColors.damageCrit, duration: scaleDuration(225, speed) },
    ],
    ease: 'easeInOutSine',
    duration: scaleDuration(450, speed),
  });
}

// ==================== T2 粒子系统 ====================

/**
 * 创建粒子爆发效果
 * @param container 目标元素的父容器（用于定位）
 * @param originRect 爆发起始位置（相对 container 的坐标）
 * @param config 粒子配置
 * @param speed 速度倍率
 * @returns 所有粒子动画实例数组，供调用方在组件卸载时统一 pause
 */
export function createParticleBurst(
  container: HTMLElement,
  originRect: { left: number; top: number; width: number; height: number },
  config: ParticleConfig,
  speed: number = 1
): JSAnimation[] {
  const centerX = originRect.left + originRect.width / 2;
  const centerY = originRect.top + originRect.height / 2;
  const animations: JSAnimation[] = [];

  for (let i = 0; i < config.count; i++) {
    const particle = document.createElement('span');
    const size = config.sizeRange[0] + defaultRng.next() * (config.sizeRange[1] - config.sizeRange[0]);
    const color = defaultRng.pick(config.colors);

    // 粒子基础样式
    particle.style.cssText = `
      position: absolute;
      left: ${centerX}px;
      top: ${centerY}px;
      width: ${size}px;
      height: ${size}px;
      pointer-events: none;
      z-index: 100;
      opacity: 1;
    `;

    switch (config.shape) {
      case 'circle':
        Object.assign(particle.style, {
          borderRadius: '50%',
          background: color,
        });
        break;
      case 'slash':
        Object.assign(particle.style, {
          width: `${size * 3}px`,
          height: `${size * 0.4}px`,
          background: color,
          transform: `rotate(${defaultRng.next() * 360}deg) scale(0)`,
        });
        break;
      case 'star':
        particle.textContent = '✦';
        Object.assign(particle.style, {
          color,
          fontSize: `${size * 2}px`,
          lineHeight: '1',
          textAlign: 'center',
        });
        break;
      case 'spark':
        particle.textContent = '+';
        Object.assign(particle.style, {
          color,
          fontSize: `${size * 2}px`,
          lineHeight: '1',
          textAlign: 'center',
          fontWeight: 'bold',
        });
        break;
    }

    container.appendChild(particle);

    // 随机飞散方向
    const angle = (Math.PI * 2 * i) / config.count + (defaultRng.next() - 0.5) * 0.6;
    const dist = config.radius * (0.6 + defaultRng.next() * 0.4);
    const targetX = centerX + Math.cos(angle) * dist;
    const targetY = centerY + Math.sin(angle) * dist;

    // 恢复类粒子偏上
    const biasY = (config.shape === 'star' || config.shape === 'spark') ? dist * 0.5 : 0;

    const anim = animate(particle, {
      translateX: [0, targetX - centerX],
      translateY: [0, targetY - centerY - biasY],
      scale: config.shape === 'slash' ? [0, 1, 0.3] : [1, 0],
      opacity: [1, 0],
      ...(config.shape === 'slash' ? { rotate: `${(defaultRng.next() - 0.5) * 360}deg` } : {}),
      duration: scaleDuration(config.duration, speed),
      ease: 'easeOutExpo',
      onComplete: () => {
        particle.remove();
      },
    });
    animations.push(anim);
  }
  return animations;
}

// ==================== Boss 出场演出 ====================

/**
 * Boss 出场演出动画控制器（P2-60 修复）
 *
 * 提供取消方法，供调用方在组件卸载时清理未完成的自动关闭定时器，
 * 避免组件销毁后定时器回调仍执行导致访问已分离 DOM。
 */
export interface BossIntroAnimationController {
  /** 取消自动关闭定时器并暂停时间线 */
  cancel: () => void;
}

/** Boss 出场演出（多步骤时间线） */
export function animateBossIntro(
  overlay: HTMLElement,
  icon: HTMLElement,
  name: HTMLElement,
  lines: HTMLElement[],
  duration: number,
  speed: number = 1
): BossIntroAnimationController {
  const tl = createTimeline({ defaults: { ease: 'easeOutCubic' } });

  // 遮罩淡入
  tl.add(overlay, {
    opacity: [0, 1],
    duration: scaleDuration(500, speed),
  });

  // 图标弹入
  tl.add(icon, {
    scale: [0, 1.3, 1],
    opacity: [0, 1],
    duration: scaleDuration(800, speed),
  }, `-=${scaleDuration(300, speed)}`);

  // 名称滑入
  tl.add(name, {
    translateY: [20, 0],
    opacity: [0, 1],
    duration: scaleDuration(600, speed),
  }, `-=${scaleDuration(400, speed)}`);

  // 台词逐行滑入
  for (let i = 0; i < lines.length; i++) {
    tl.add(lines[i], {
      translateY: [10, 0],
      opacity: [0, 1],
      duration: scaleDuration(500, speed),
    }, `-=${scaleDuration(i === 0 ? 200 : 100, speed)}`);
  }

  // 自动关闭（P2-60 修复：返回控制器供调用方取消）
  const minDuration = scaleDuration(1000 + lines.length * 900, speed);
  const actualDuration = Math.max(scaleDuration(duration, speed), minDuration);
  let closeTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    closeTimer = null;
    animate(overlay, {
      opacity: 0,
      duration: scaleDuration(300, speed),
      ease: 'easeInQuad',
    });
  }, actualDuration);

  return {
    cancel: () => {
      if (closeTimer !== null) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      try {
        tl.pause();
      } catch {
        // 时间线已销毁或不可暂停时忽略
      }
    },
  };
}

// ==================== Boss 阶段转换 ====================

/** Boss 阶段转换特效 */
export function animatePhaseTransition(
  backdrop: HTMLElement,
  content: HTMLElement,
  speed: number = 1
): Timeline {
  const tl = createTimeline({ defaults: { ease: 'easeOutCubic' } });

  // 遮罩闪现
  tl.add(backdrop, {
    opacity: [0, 1],
    duration: scaleDuration(250, speed),
  });

  // 内容缩放进入
  tl.add(content, {
    scale: [0.7, 1.08, 1],
    opacity: [0, 1],
    duration: scaleDuration(500, speed),
  }, `-=${scaleDuration(100, speed)}`);

  // 保持显示
  tl.add([backdrop, content], {
    opacity: 1,
    duration: scaleDuration(1250, speed),
  });

  // 淡出
  tl.add([backdrop, content], {
    opacity: 0,
    duration: scaleDuration(500, speed),
  });

  return tl;
}

// ==================== 结果弹窗 ====================

/** 战斗结果弹窗入场动画 */
export function animateResultPopup(
  popup: HTMLElement,
  icon: HTMLElement,
  resultText: HTMLElement,
  rewards: HTMLElement[],
  speed: number = 1
): Timeline {
  const tl = createTimeline({ defaults: { ease: 'easeOutElastic(1, .5)' } });

  // 弹窗弹入
  tl.add(popup, {
    scale: [0.5, 1],
    opacity: [0, 1],
    duration: scaleDuration(500, speed),
  });

  // 图标弹跳
  tl.add(icon, {
    scale: [0, 1.3, 1],
    duration: scaleDuration(600, speed),
  }, `-=${scaleDuration(400, speed)}`);

  // 结果文字淡入 + 上滑
  tl.add(resultText, {
    translateY: [16, 0],
    opacity: [0, 1],
    duration: scaleDuration(400, speed),
  }, `-=${scaleDuration(200, speed)}`);

  // 奖励项逐个滑入
  for (let i = 0; i < rewards.length; i++) {
    tl.add(rewards[i], {
      translateY: [10, 0],
      opacity: [0, 1],
      duration: scaleDuration(400, speed),
    }, `-=${scaleDuration(i === 0 ? 200 : 100, speed)}`);
  }

  return tl;
}


