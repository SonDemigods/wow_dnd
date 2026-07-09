/**
 * @fileoverview 动画模块统一导出入口
 * @description 导出动画模块的所有类型定义和动画函数
 * @module animation
 */
export type { FloatingType, ParticleConfig } from './types';

export {
  animateShake,
  animateCritShake,
  animateMagicPulse,
  animateGlow,
  animateHealGlow,
  animateManaGlow,
  animateCritBorderFlash,
  animateDodgeBlink,
  animateFloating,
  animateScreenFlash,
  animateVsFlash,
  createParticleBurst,
  animateBossIntro,
  animatePhaseTransition,
  animateResultPopup
} from './combat-effects';
