/**
 * @fileoverview 防御修正处理器 — defense_up / defense_down / vulnerable
 */

import type { EffectHandler } from '../handler';

/**
 * defense_up — 减免自身承受伤害
 * value 是百分比点数（如 14 表示 -14% 伤害）
 */
export const defenseUpHandler: EffectHandler = {
  type: 'defense_up',

  getDefenderDamageMod(effect) {
    return Math.max(0.05, 1 - effect.value / 100);
  },
};

/**
 * defense_down — 承受更多伤害
 * value 是百分比点数（如 12 表示 +12% 承伤）
 */
export const defenseDownHandler: EffectHandler = {
  type: 'defense_down',

  getDefenderDamageMod(effect) {
    return 1 + effect.value / 100;
  },
};

/**
 * vulnerable — 易伤：受到的伤害倍率增加
 * value 是百分比点数（如 22 表示 +22% 承伤）
 */
export const vulnerableHandler: EffectHandler = {
  type: 'vulnerable',

  getDefenderDamageMod(effect) {
    return 1 + effect.value / 100;
  },
};
