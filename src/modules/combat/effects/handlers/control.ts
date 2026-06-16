/**
 * @fileoverview 控制效果处理器 — stun / freeze / silence
 */

import type { EffectHandler, ActionType } from '../handler';

/**
 * stun — 眩晕：跳过回合，禁止所有行动
 */
export const stunHandler: EffectHandler = {
  type: 'stun',

  getDisabledActions(): ActionType[] {
    return ['attack', 'skill', 'flee'];
  },
};

/**
 * freeze — 冰冻：跳过回合，禁止所有行动
 */
export const freezeHandler: EffectHandler = {
  type: 'freeze',

  getDisabledActions(): ActionType[] {
    return ['attack', 'skill', 'flee'];
  },
};

/**
 * silence — 沉默：禁止使用技能，但可以普通攻击
 */
export const silenceHandler: EffectHandler = {
  type: 'silence',

  getDisabledActions(): ActionType[] {
    return ['skill'];
  },
};
