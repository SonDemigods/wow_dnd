/**
 * @fileoverview EffectContainer 操作函数
 * @description 效果的增删查改、ID 生成等纯函数操作
 */

import type { Effect, EffectContainer, EffectType, StackStrategy } from './types';
import type { EffectHandlerRegistry } from './handler';
import { generateId } from '@/utils/db-helpers';

/** 生成唯一效果 ID（格式：effect_时间戳_随机串） */
export function generateEffectId(): string {
  return generateId('effect');
}

/**
 * 为容器添加效果
 * 根据叠加策略处理与已有同类型效果的合并
 *
 * P4-004 修复：
 * - replace 策略：先调用旧 effect 的 onRemove 回调，再用 splice 原地移除（保持数组引用）
 * - additive/independent 达到 maxStacks 时：同样调用旧 effect 的 onRemove 后再替换
 *
 * @param container - 效果容器
 * @param effect - 要添加的效果
 * @param registry - 效果处理器注册表（可选，用于调用 onRemove 回调）
 */
export function addEffectToContainer(
  container: EffectContainer,
  effect: Effect,
  registry?: EffectHandlerRegistry,
): void {
  const strategy: StackStrategy = effect.stackStrategy || 'max';
  const existing = container.effects.find(e => e.type === effect.type);

  switch (strategy) {
    case 'replace':
      // P4-004：先调用旧 effect 的 onRemove 回调，再用 splice 原地移除（保持数组引用不变）
      if (existing) {
        if (registry) {
          const handler = registry.get(existing.type);
          handler?.onRemove?.(existing, { ownerId: '', ownerType: 'player', baseStats: { physicalAttack: 0, physicalDefense: 0, magicAttack: 0, magicDefense: 0, speed: 0 }, currentHp: 0, maxHp: 0 });
        }
        const idx = container.effects.indexOf(existing);
        if (idx !== -1) container.effects.splice(idx, 1);
      }
      break;
    case 'max':
      // P3-91 修复：max 策略语义说明
      /**
       * max 策略：新效果值和已有效果值取较大者。
       * 注意：此策略仅比较 value 字段，不处理 duration（取较大 duration）。
       * 即 value 和 remainingTurns 各自独立取 max，互不影响。
       */
      if (existing) {
        existing.remainingTurns = Math.max(existing.remainingTurns, effect.remainingTurns);
        existing.value = Math.max(existing.value, effect.value);
        return;
      }
      break;
    case 'additive':
    case 'independent':
      // P3-180：限制叠加层数，防止 DOT/Buff 无限叠加导致内存泄漏与数值失控
      // 当同类型效果数量达到 maxStacks（默认 5）时，不再继续叠加。
      // 采用"刷新"语义：超出上限时更新最早效果为最新效果，
      // 避免无限 push 的同时保持持续刷新。
      {
        const maxStacks = effect.maxStacks ?? 5;
        if (maxStacks > 0) {
          const sameType = container.effects.filter(e => e.type === effect.type);
          if (sameType.length >= maxStacks) {
            // P4-004：刷新最早效果前，先调用其 onRemove 回调
            const oldest = sameType[0];
            if (registry) {
              const handler = registry.get(oldest.type);
              handler?.onRemove?.(oldest, { ownerId: '', ownerType: 'player', baseStats: { physicalAttack: 0, physicalDefense: 0, magicAttack: 0, magicDefense: 0, speed: 0 }, currentHp: 0, maxHp: 0 });
            }
            oldest.remainingTurns = effect.remainingTurns;
            oldest.value = effect.value;
            oldest.source = effect.source;
            oldest.sourceName = effect.sourceName;
            return;
          }
        }
      }
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
  // P4-004：使用 splice 原地移除，避免 filter 重建数组破坏外部引用
  for (let i = container.effects.length - 1; i >= 0; i--) {
    if (container.effects[i].type === type) {
      container.effects.splice(i, 1);
    }
  }
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
