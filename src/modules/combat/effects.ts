/**
 * @fileoverview Buff/Debuff 状态效果系统（兼容层）
 * @description 向后兼容导出，实际逻辑已迁移到 combat/effects/ 目录
 */

// 从新系统重导出类型
export type {
  EffectType,
  Effect,
  EffectContainer,
  StackStrategy,
  EffectContext,
  TickResult,
  DamagePipelineResult,
  DamageType,
} from './effects/types';

export { EffectHandlerRegistry } from './effects/handler';
export type { EffectHandler, ActionType } from './effects/handler';

export {
  generateEffectId,
  addEffectToContainer,
  removeEffectFromContainer,
  hasEffect,
  createEmptyContainer,
  clearContainer,
} from './effects/container';

export {
  processDamagePipeline,
  applyEffect,
} from './effects/pipeline';

export { createDefaultRegistry } from './effects/handlers/index';

// ===== 向后兼容别名 =====

import {
  addEffectToContainer as _addEffect,
} from './effects/container';
import type { EffectContainer, Effect } from './effects/types';
import { EffectHandlerRegistry } from './effects/handler';
import { createDefaultRegistry } from './effects/handlers/index';
import type { EffectContext } from './effects/types';

/** 属性修改器（向后兼容） */
export interface StatModifiers {
  physicalAttack: number;
  physicalDefense: number;
  magicAttack: number;
  magicDefense: number;
  speed: number;
  critChance: number;
  dodgeChance: number;
  damageMultiplier: number;
  healingMultiplier: number;
}

/** 创建空属性修改器（向后兼容） */
export function createEmptyModifiers(): StatModifiers {
  return {
    physicalAttack: 0,
    physicalDefense: 0,
    magicAttack: 0,
    magicDefense: 0,
    speed: 0,
    critChance: 0,
    dodgeChance: 0,
    damageMultiplier: 1,
    healingMultiplier: 1,
  };
}

// 全局单例注册表（向后兼容）
let _globalRegistry: EffectHandlerRegistry | null = null;

function getGlobalRegistry(): EffectHandlerRegistry {
  if (!_globalRegistry) {
    _globalRegistry = new EffectHandlerRegistry();
    createDefaultRegistry(_globalRegistry);
  }
  return _globalRegistry;
}

export function getRegistry(): EffectHandlerRegistry {
  return getGlobalRegistry();
}

/** @deprecated 使用 addEffectToContainer */
export function addEffect(container: EffectContainer, effect: Effect): void {
  _addEffect(container, effect);
}

/** @deprecated 使用 registry.tickAll() */
export function tickEffects(container: EffectContainer): { expiredIds: string[]; dotDamage: number; regenAmount: number } {
  const registry = getGlobalRegistry();
  // 创建基本上下文（调用方应提供完整上下文，此处为向后兼容的最小实现）
  const dummyCtx: EffectContext = {
    ownerId: '',
    ownerType: 'player',
    baseStats: { physicalAttack: 0, physicalDefense: 0, magicAttack: 0, magicDefense: 0, speed: 0 },
    currentHp: 0,
    maxHp: 0,
  };
  return registry.tickAll(container, dummyCtx);
}

/** @deprecated 使用 registry.reduceSum(defenderEffects, 'getDamageAbsorb', ctx, incomingDamage) */
export function applyShield(container: EffectContainer, incomingDamage: number): { actualDamage: number; absorbed: number } {
  const registry = getGlobalRegistry();
  const dummyCtx: EffectContext = {
    ownerId: '',
    ownerType: 'player',
    baseStats: { physicalAttack: 0, physicalDefense: 0, magicAttack: 0, magicDefense: 0, speed: 0 },
    currentHp: 0,
    maxHp: 0,
  };
  const absorbed = registry.reduceSum(container, 'getDamageAbsorb', dummyCtx, incomingDamage);
  return { actualDamage: Math.max(0, incomingDamage - absorbed), absorbed };
}

/** @deprecated 使用 registry.reduceMultiplier 分别获取 attacker/defender 修正 */
export function getStatModifiers(container: EffectContainer): StatModifiers {
  const mods = createEmptyModifiers();
  for (const effect of container.effects) {
    switch (effect.type) {
      case 'attack_up':
      case 'attack_down':
      case 'defense_up':
      case 'defense_down':
      case 'speed_up':
      case 'speed_down':
      case 'vulnerable':
        // 这些效果通过新的管线处理，getStatModifiers 不再直接计算
        break;
    }
  }
  return mods;
}

/** @deprecated 使用 registry.getDisabledActions() */
export function isDisabled(container: EffectContainer): { skipTurn: boolean; types: ('attack' | 'skill' | 'flee')[] } {
  const registry = getGlobalRegistry();
  return registry.getDisabledActions(container);
}

/** @deprecated 使用 registry.reduceSum(defenderEffects, 'getThornDamage', ctx, incomingDamage) */
export function getThornDamage(container: EffectContainer, incomingDamage: number): number {
  const registry = getGlobalRegistry();
  const dummyCtx: EffectContext = {
    ownerId: '',
    ownerType: 'player',
    baseStats: { physicalAttack: 0, physicalDefense: 0, magicAttack: 0, magicDefense: 0, speed: 0 },
    currentHp: 0,
    maxHp: 0,
  };
  return registry.reduceSum(container, 'getThornDamage', dummyCtx, incomingDamage);
}
