/**
 * @fileoverview 护盾处理器 — shield
 */

import type { EffectHandler } from '../handler';

/**
 * shield — 护盾：吸收伤害直到护盾值耗尽
 * value 是护盾总吸收量
 */
export const shieldHandler: EffectHandler = {
  type: 'shield',

  getDamageAbsorb(effect, incomingDamage) {
    const absorb = Math.min(incomingDamage, effect.value);
    effect.value -= absorb;
    return absorb;
  },
};
