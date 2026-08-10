/**
 * @fileoverview 持续伤害处理器 — poison / burn
 */

import type { EffectHandler } from '../handler';

/**
 * poison — 中毒：每回合扣除固定生命值
 * value 是每回合扣除的 HP
 */
export const poisonHandler: EffectHandler = {
  type: 'poison',

  onTick(effect) {
    // P4-005 修复：Math.max(0, ...) 防止负值
    return { dotDamage: Math.max(0, effect.value), regenAmount: 0 };
  },
};

/**
 * burn — 灼烧：每回合扣除生命值（比毒强 1.5 倍）
 * value 是基础伤害值，实际扣除 value × 1.5
 */
export const burnHandler: EffectHandler = {
  type: 'burn',

  onTick(effect) {
    // P4-005 修复：Math.max(0, ...) 防止负值导致 DOT 变回血
    return { dotDamage: Math.max(0, Math.round(effect.value * 1.5)), regenAmount: 0 };
  },
};
