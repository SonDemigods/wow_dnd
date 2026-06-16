/**
 * @fileoverview 荆棘处理器 — thorn
 */

import type { EffectHandler } from '../handler';

/**
 * thorn — 荆棘：受到攻击时反弹伤害
 * value 是反弹比例（如 0.30 表示 30%）
 */
export const thornHandler: EffectHandler = {
  type: 'thorn',

  getThornDamage(effect, incomingDamage) {
    return Math.round(incomingDamage * effect.value);
  },
};
