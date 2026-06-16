/**
 * @fileoverview 攻击修正处理器 — attack_up / attack_down
 */

import type { EffectHandler } from '../handler';

/**
 * attack_up — 提升自身输出
 * value 是百分比点数（如 18 表示 +18%）
 */
export const attackUpHandler: EffectHandler = {
  type: 'attack_up',

  getAttackerDamageMod(effect) {
    return 1 + effect.value / 100;
  },
};

/**
 * attack_down — 削弱自身输出
 * value 是百分比点数（如 18 表示 -18%），保底 10%
 */
export const attackDownHandler: EffectHandler = {
  type: 'attack_down',

  getAttackerDamageMod(effect) {
    return Math.max(0.1, 1 - effect.value / 100);
  },
};
