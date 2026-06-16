/**
 * @fileoverview 效果处理器聚合 — 注册所有内置处理器
 */

import type { EffectHandlerRegistry } from '../handler';

/** 所有内置效果处理器 */
export { attackUpHandler, attackDownHandler } from './attackMod';
export { defenseUpHandler, defenseDownHandler, vulnerableHandler } from './defenseMod';
export { speedUpHandler, speedDownHandler } from './speedMod';
export { regenHandler } from './regen';
export { thornHandler } from './thorn';
export { poisonHandler, burnHandler } from './dot';
export { stunHandler, freezeHandler, silenceHandler } from './control';
export { shieldHandler } from './shield';

import { attackUpHandler, attackDownHandler } from './attackMod';
import { defenseUpHandler, defenseDownHandler, vulnerableHandler } from './defenseMod';
import { speedUpHandler, speedDownHandler } from './speedMod';
import { regenHandler } from './regen';
import { thornHandler } from './thorn';
import { poisonHandler, burnHandler } from './dot';
import { stunHandler, freezeHandler, silenceHandler } from './control';
import { shieldHandler } from './shield';

/**
 * 创建默认注册表（预注册全部 15 种内置效果处理器）
 */
export function createDefaultRegistry(registry: EffectHandlerRegistry): void {
  registry.registerAll([
    // 持续伤害
    poisonHandler,
    burnHandler,
    // 控制
    stunHandler,
    freezeHandler,
    silenceHandler,
    // 护盾
    shieldHandler,
    // 攻击修正
    attackUpHandler,
    attackDownHandler,
    // 防御修正
    defenseUpHandler,
    defenseDownHandler,
    // 易伤
    vulnerableHandler,
    // 速度
    speedUpHandler,
    speedDownHandler,
    // 恢复
    regenHandler,
    // 荆棘
    thornHandler,
  ]);
}
