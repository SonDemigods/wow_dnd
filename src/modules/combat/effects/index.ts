/**
 * @fileoverview Buff/Debuff 效果系统 — 统一导出入口
 */

// 类型（EffectType 通过 types.ts 从 effect-type.ts 间接导出，P3-164）
export type {
  EffectType,
  Effect,
  EffectContainer,
  EffectContext,
  TickResult,
  DamagePipelineResult,
  DamageType,
  StackStrategy,
} from './types';

// P4-022：类型守卫
export { isEffectType } from './effect-type';

// 注册表
export { EffectHandlerRegistry } from './handler';
export type { EffectHandler, ActionType } from './handler';

// 容器操作
export {
  generateEffectId,
  addEffectToContainer,
  removeEffectFromContainer,
  hasEffect,
  createEmptyContainer,
  clearContainer,
} from './container';

// 伤害管线
export {
  processDamagePipeline,
  applyEffect,
} from './pipeline';
// P3-146：stat_modifier 接入管线所需的类型
export type { StatModifierEntry } from './pipeline';

// 处理器注册
export { createDefaultRegistry } from './handlers/index';
