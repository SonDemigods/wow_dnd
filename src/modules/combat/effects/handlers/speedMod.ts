/**
 * @fileoverview 速度修正处理器 — speed_up / speed_down
 */

import type { EffectHandler } from '../handler';

/**
 * speed_up — 提升回合速度（增加先攻值）
 * value 是平坦速度增加量
 */
export const speedUpHandler: EffectHandler = {
  type: 'speed_up',

  getSpeedMod(effect) {
    return effect.value;
  },
};

/**
 * speed_down — 降低回合速度（减少先攻值）
 * value 是平坦速度减少量
 */
export const speedDownHandler: EffectHandler = {
  type: 'speed_down',

  getSpeedMod(effect) {
    return -effect.value;
  },
};
