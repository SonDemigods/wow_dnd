/**
 * @fileoverview 护盾处理器 — shield
 */

import type { EffectHandler } from '../handler';

/**
 * shield — 护盾：吸收伤害直到护盾值耗尽
 * value 是护盾总吸收量
 *
 * P9-109 修复：护盾值耗尽后标记 remainingTurns=0，pipeline 的 tickAllEffects 会清理。
 */
export const shieldHandler: EffectHandler = {
  type: 'shield',

  getDamageAbsorb(effect, incomingDamage) {
    const absorb = Math.min(incomingDamage, effect.value);
    effect.value -= absorb;
    // P9-109 修复：护盾值耗尽后标记到期，pipeline 清理时移除
    if (effect.value <= 0) {
      effect.remainingTurns = 0;
    }
    return absorb;
  },
};
