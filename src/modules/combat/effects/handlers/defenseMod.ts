/**
 * @fileoverview 防御修正处理器 — defense_up / defense_down / vulnerable
 */

import type { EffectHandler } from '../handler';
import { DAMAGE_TAKEN_MOD_MAX, VULNERABLE_DAMAGE_COEFFICIENT } from '@/config/combat';

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
    // P4-014 修复：限制承伤倍率上限，防止极端减益叠加导致数值爆炸
    return Math.min(DAMAGE_TAKEN_MOD_MAX, 1 + effect.value / 100);
  },
};

/**
 * vulnerable — 易伤：受到的伤害倍率大幅增加（比降防更严重）
 * value 是百分比点数（如 22 表示 +33% 承伤，含易伤系数）
 */
export const vulnerableHandler: EffectHandler = {
  type: 'vulnerable',

  getDefenderDamageMod(effect) {
    // P4-014 修复：系数提取为配置常量 VULNERABLE_DAMAGE_COEFFICIENT，加上限保护
    return Math.min(DAMAGE_TAKEN_MOD_MAX, 1 + effect.value * VULNERABLE_DAMAGE_COEFFICIENT / 100);
  },
};
