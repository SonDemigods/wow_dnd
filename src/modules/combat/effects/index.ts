/**
 * @fileoverview Buff/Debuff 效果系统 — 统一导出入口
 */

// 类型
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

// 处理器注册
export { createDefaultRegistry } from './handlers/index';
