/**
 * @fileoverview EffectContainer 操作函数
 * @description 效果的增删查改、ID 生成等纯函数操作
 */

import type { Effect, EffectContainer, EffectType, StackStrategy } from './types';

/** 效果 ID 生成计数器 */
let effectIdCounter = 0;

/** 生成唯一效果 ID */
export function generateEffectId(): string {
  return `effect_${Date.now()}_${++effectIdCounter}`;
}

/**
 * 为容器添加效果
 * 根据叠加策略处理与已有同类型效果的合并
 */
export function addEffectToContainer(
  container: EffectContainer,
  effect: Effect
): void {
  const strategy: StackStrategy = effect.stackStrategy || 'max';
  const existing = container.effects.find(e => e.type === effect.type);

  switch (strategy) {
    case 'replace':
      // 直接替换旧效果
      if (existing) {
        container.effects = container.effects.filter(e => e.type !== effect.type);
      }
      break;
    case 'max':
      // 取最大值并刷新持续时间
      if (existing) {
        existing.remainingTurns = Math.max(existing.remainingTurns, effect.remainingTurns);
        existing.value = Math.max(existing.value, effect.value);
        return;
      }
      break;
    case 'additive':
      // 累加但独立衰减
      // 不做合并，直接 push 独立实例
      break;
    case 'independent':
      // 独立存在，不参与同类型合并
      break;
  }

  container.effects.push({ ...effect });
}

/**
 * 从容器中移除指定类型的效果
 * @returns 移除的效果数量
 */
export function removeEffectFromContainer(
  container: EffectContainer,
  type: EffectType
): number {
  const count = container.effects.filter(e => e.type === type).length;
  container.effects = container.effects.filter(e => e.type !== type);
  return count;
}

/**
 * 检查容器中是否存在指定类型的效果
 */
export function hasEffect(container: EffectContainer, type: EffectType): boolean {
  return container.effects.some(e => e.type === type);
}

/**
 * 创建空效果容器
 */
export function createEmptyContainer(): EffectContainer {
  return { effects: [] };
}

/**
 * 清空效果容器
 */
export function clearContainer(container: EffectContainer): void {
  container.effects = [];
}
