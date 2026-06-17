/**
 * @fileoverview 战斗动画效果模块
 * @description 基于 anime.js v4 的战斗演出动画函数，替代 CombatPopup 中 CSS class + setTimeout 的动画模式。
 * 所有动画函数直接操作 DOM 元素，支持 speed 参数控制播放速度（1=正常，2=双倍速）。
 */

import { animate, createTimeline } from 'animejs';
import { CombatColors } from '@/config/combat-colors';

/** 浮动数字类型 */
export type FloatingType = 'physical' | 'magic' | 'heal-hp' | 'heal-mp' | 'crit' | 'dodge';

/** 粒子形状 */
export type ParticleShape = 'circle' | 'slash' | 'star' | 'spark';

/** 粒子配置 */
export interface ParticleConfig {
  /** 粒子数量 */
  count: number;
  /** 粒子颜色列表 */
  colors: string[];
  /** 粒子形状 */
  shape: ParticleShape;
  /** 飞散半径（px） */
  radius: number;
  /** 粒子大小范围 [min, max]（px） */
  sizeRange: [number, number];
  /** 动画持续时间（ms） */
  duration: number;
}

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

// ==================== 受击方身体特效（T1 新增） ====================

/** 法术伤害：柔和缩放脉冲 */
export function animateMagicPulse(target: HTMLElement, speed: number = 1): void {
  animate(target, {
    scale: [
      { to: 0.92, duration: s(250, speed) },
      { to: 1.02, duration: s(250, speed) },
      { to: 1, duration: s(300, speed) },
    ],
    boxShadow: [
      { to: `0 0 16px ${CombatColors.damageMagicBg}`, duration: s(250, speed) },
      { to: '0 0 0px transparent', duration: s(550, speed) },
    ],
    ease: 'easeInOutSine',
    duration: s(800, speed),
  });
}

/** 生命恢复：绿色光晕从内向外扩散 */
export function animateHealGlow(target: HTMLElement, speed: number = 1): void {
  animate(target, {
    boxShadow: [
      { to: `0 0 8px ${CombatColors.healHp}, 0 0 24px ${CombatColors.healHp}88`, duration: s(400, speed) },
      { to: '0 0 0px transparent', duration: s(600, speed) },
    ],
    ease: 'easeOutQuad',
    duration: s(1000, speed),
  });
}

/** 法力恢复：蓝色光晕从内向外扩散 */
export function animateManaGlow(target: HTMLElement, speed: number = 1): void {
  animate(target, {
    boxShadow: [
      { to: `0 0 8px ${CombatColors.healMp}, 0 0 24px ${CombatColors.healMp}88`, duration: s(400, speed) },
      { to: '0 0 0px transparent', duration: s(600, speed) },
    ],
    ease: 'easeOutQuad',
    duration: s(1000, speed),
  });
}

/** 暴击：金色边框爆闪 */
export function animateCritBorderFlash(target: HTMLElement, speed: number = 1): void {
  animate(target, {
    borderColor: [
      { to: CombatColors.damageCrit, duration: s(150, speed) },
      { to: CombatColors.damageCrit, duration: s(200, speed) },
      { to: '', duration: s(350, speed) },
    ],
    boxShadow: [
      { to: `0 0 20px ${CombatColors.flashCrit}`, duration: s(150, speed) },
      { to: '0 0 0px transparent', duration: s(550, speed) },
    ],
    ease: 'easeOutExpo',
    duration: s(700, speed),
    onComplete: () => {
      target.style.borderColor = '';
    },
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
): void {
  const p = FLOATING_PARAMS[type];
  const isCrit = type === 'crit';

  const keyframes: Record<string, unknown> = {
    translateY: [
      { to: isCrit ? -15 : -p.riseDistance * 0.4, duration: s(isCrit ? 360 : 480, speed) },
      { to: p.riseDistance * 0.6, duration: s(isCrit ? 360 : 480, speed) },
      { to: p.riseDistance, duration: s(isCrit ? 1080 : 640, speed) },
    ],
    scale: [
      { to: p.scalePeak, duration: s(isCrit ? 360 : 480, speed) },
      { to: p.scalePeak * (isCrit ? 0.73 : 0.67), duration: s(isCrit ? 1080 : 640, speed) },
    ],
    opacity: [
      { to: 1, duration: s(isCrit ? 720 : 960, speed) },
      { to: 0, duration: s(isCrit ? 1080 : 640, speed) },
    ],
    ease: p.ease,
    duration: s(p.duration, speed),
    onComplete: () => {
      target.style.opacity = '0';
      target.style.transform = '';
    },
  };

  // 法术伤害：正弦波水平摆动
  if (p.swayX !== 0) {
    keyframes.translateX = [
      { to: -p.swayX, duration: s(300, speed) },
      { to: p.swayX, duration: s(600, speed) },
      { to: 0, duration: s(p.duration - 900, speed) },
    ];
  }

  // 法力恢复：轻微旋转
  if (p.rotate !== 0) {
    keyframes.rotate = [
      { to: `${p.rotate}deg`, duration: s(p.duration * 0.5, speed) },
      { to: `-${p.rotate * 0.5}deg`, duration: s(p.duration * 0.5, speed) },
    ];
  }

  // 闪避：快速侧移
  if (p.swayX > 5) {
    keyframes.translateX = [
      { to: p.swayX, duration: s(250, speed) },
      { to: -4, duration: s(500, speed) },
      { to: 0, duration: s(450, speed) },
    ];
  }

  animate(target, keyframes);
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
          { to: CombatColors.flashCrit, duration: s(180, speed) },
          { to: CombatColors.flashCritFade, duration: s(240, speed) },
          { to: CombatColors.flashDodgeFade, duration: s(180, speed) },
        ]
      : [
          { to: CombatColors.flashDodge, duration: s(300, speed) },
          { to: CombatColors.flashDodgeFade, duration: s(300, speed) },
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
      { to: CombatColors.damageCrit, duration: s(225, speed) },
    ],
    ease: 'easeInOutSine',
    duration: s(450, speed),
  });
}

// ==================== T2 粒子系统 ====================

/**
 * 创建粒子爆发效果
 * @param container 目标元素的父容器（用于定位）
 * @param originRect 爆发起始位置（相对 container 的坐标）
 * @param config 粒子配置
 * @param speed 速度倍率
 */
export function createParticleBurst(
  container: HTMLElement,
  originRect: { left: number; top: number; width: number; height: number },
  config: ParticleConfig,
  speed: number = 1
): void {
  const centerX = originRect.left + originRect.width / 2;
  const centerY = originRect.top + originRect.height / 2;
  const fragments: HTMLElement[] = [];

  for (let i = 0; i < config.count; i++) {
    const particle = document.createElement('span');
    const size = config.sizeRange[0] + Math.random() * (config.sizeRange[1] - config.sizeRange[0]);
    const color = config.colors[Math.floor(Math.random() * config.colors.length)];

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
        particle.style.cssText += `
          border-radius: 50%;
          background: ${color};
        `;
        break;
      case 'slash':
        particle.style.cssText += `
          width: ${size * 3}px;
          height: ${size * 0.4}px;
          background: ${color};
          transform: rotate(${Math.random() * 360}deg) scale(0);
        `;
        break;
      case 'star':
        particle.textContent = '✦';
        particle.style.cssText += `
          color: ${color};
          font-size: ${size * 2}px;
          line-height: 1;
          text-align: center;
        `;
        break;
      case 'spark':
        particle.textContent = '+';
        particle.style.cssText += `
          color: ${color};
          font-size: ${size * 2}px;
          line-height: 1;
          text-align: center;
          font-weight: bold;
        `;
        break;
    }

    container.appendChild(particle);
    fragments.push(particle);

    // 随机飞散方向
    const angle = (Math.PI * 2 * i) / config.count + (Math.random() - 0.5) * 0.6;
    const dist = config.radius * (0.6 + Math.random() * 0.4);
    const targetX = centerX + Math.cos(angle) * dist;
    const targetY = centerY + Math.sin(angle) * dist;

    // 恢复类粒子偏上
    const biasY = (config.shape === 'star' || config.shape === 'spark') ? dist * 0.5 : 0;

    animate(particle, {
      translateX: [0, targetX - centerX],
      translateY: [0, targetY - centerY - biasY],
      scale: config.shape === 'slash' ? [0, 1, 0.3] : [1, 0],
      opacity: [1, 0],
      rotate: config.shape === 'slash' ? `${(Math.random() - 0.5) * 360}deg` : undefined,
      duration: s(config.duration, speed),
      ease: 'easeOutExpo',
      onComplete: () => {
        particle.remove();
      },
    });
  }
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
  resultText: HTMLElement,
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

  // 结果文字淡入 + 上滑
  tl.add(resultText, {
    translateY: [16, 0],
    opacity: [0, 1],
    duration: s(400, speed),
  }, `-=${s(200, speed)}`);

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
