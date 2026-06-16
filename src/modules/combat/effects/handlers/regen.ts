/**
 * @fileoverview 恢复处理器 — regen
 */

import type { EffectHandler } from '../handler';

/**
 * regen — 恢复：每回合回复生命值
 * value 是每回合回复的 HP 量
 */
export const regenHandler: EffectHandler = {
  type: 'regen',

  onTick(effect) {
    return { dotDamage: 0, regenAmount: effect.value };
  },
};
