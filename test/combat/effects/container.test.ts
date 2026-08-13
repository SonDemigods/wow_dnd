/**
 * @fileoverview EffectContainer 效果叠加策略单元测试
 * @description 验证 4 种叠加策略（replace/max/additive/independent）的行为正确性（CMB-5 修复）。
 *
 * 覆盖范围：
 * 1. replace 策略：新效果替换同类型旧效果
 * 2. max 策略：取数值与持续时间的最大值
 * 3. additive 策略：独立实例累加，独立衰减
 * 4. independent 策略：完全独立存在
 * 5. 默认策略（未指定 stackStrategy 时回退到 max）
 * 6. 不同类型效果互不影响
 * 7. removeEffectFromContainer / hasEffect / createEmptyContainer / clearContainer 辅助函数
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  addEffectToContainer,
  removeEffectFromContainer,
  hasEffect,
  createEmptyContainer,
  clearContainer,
  generateEffectId
} from '@/modules/combat/effects/container';
import type { Effect, EffectContainer, EffectType } from '@/modules/combat/effects/types';

/** 构造测试用 Effect 实例 */
function makeEffect(
  type: EffectType,
  value: number,
  remainingTurns: number,
  stackStrategy?: Effect['stackStrategy'],
  maxStacks?: number
): Effect {
  return {
    id: generateEffectId(),
    type,
    remainingTurns,
    value,
    source: 'skill',
    sourceName: 'test-skill',
    stackStrategy,
    maxStacks,
  };
}

describe('EffectContainer 叠加策略', () => {
  let container: EffectContainer;

  beforeEach(() => {
    container = createEmptyContainer();
  });

  // ==================== replace 策略 ====================
  describe('replace 策略', () => {
    it('同类型新效果替换旧效果（旧效果被移除，仅保留新效果）', () => {
      const oldEffect = makeEffect('attack_up', 10, 3, 'replace');
      const newEffect = makeEffect('attack_up', 20, 2, 'replace');

      addEffectToContainer(container, oldEffect);
      addEffectToContainer(container, newEffect);

      const ups = container.effects.filter(e => e.type === 'attack_up');
      expect(ups).toHaveLength(1);
      expect(ups[0].value).toBe(20);
      expect(ups[0].remainingTurns).toBe(2);
    });

    it('不同类型效果不触发替换，两者共存', () => {
      addEffectToContainer(container, makeEffect('attack_up', 10, 3, 'replace'));
      addEffectToContainer(container, makeEffect('defense_up', 5, 2, 'replace'));

      expect(container.effects).toHaveLength(2);
    });
  });

  // ==================== max 策略 ====================
  describe('max 策略', () => {
    it('新效果数值更大时刷新为更大值', () => {
      addEffectToContainer(container, makeEffect('poison', 10, 3, 'max'));
      addEffectToContainer(container, makeEffect('poison', 20, 2, 'max'));

      const poisons = container.effects.filter(e => e.type === 'poison');
      expect(poisons).toHaveLength(1);
      expect(poisons[0].value).toBe(20);
    });

    it('新效果数值更小时保留旧数值', () => {
      addEffectToContainer(container, makeEffect('poison', 30, 3, 'max'));
      addEffectToContainer(container, makeEffect('poison', 10, 2, 'max'));

      const poisons = container.effects.filter(e => e.type === 'poison');
      expect(poisons).toHaveLength(1);
      expect(poisons[0].value).toBe(30);
    });

    it('持续时间取最大值（保留更长的持续时间）', () => {
      addEffectToContainer(container, makeEffect('burn', 15, 2, 'max'));
      addEffectToContainer(container, makeEffect('burn', 15, 5, 'max'));

      const burns = container.effects.filter(e => e.type === 'burn');
      expect(burns).toHaveLength(1);
      expect(burns[0].remainingTurns).toBe(5);
    });

    it('数值与持续时间各自独立取最大', () => {
      addEffectToContainer(container, makeEffect('burn', 30, 2, 'max'));
      addEffectToContainer(container, makeEffect('burn', 10, 5, 'max'));

      const burns = container.effects.filter(e => e.type === 'burn');
      expect(burns[0].value).toBe(30);
      expect(burns[0].remainingTurns).toBe(5);
    });
  });

  // ==================== additive 策略 ====================
  describe('additive 策略', () => {
    it('同类型效果独立累加（每次添加生成新实例）', () => {
      addEffectToContainer(container, makeEffect('attack_up', 10, 3, 'additive'));
      addEffectToContainer(container, makeEffect('attack_up', 15, 2, 'additive'));
      addEffectToContainer(container, makeEffect('attack_up', 5, 1, 'additive'));

      const ups = container.effects.filter(e => e.type === 'attack_up');
      expect(ups).toHaveLength(3);
      expect(ups.map(e => e.value).sort((a, b) => a - b)).toEqual([5, 10, 15]);
    });

    it('各实例持续时间独立衰减', () => {
      addEffectToContainer(container, makeEffect('regen', 10, 5, 'additive'));
      addEffectToContainer(container, makeEffect('regen', 8, 2, 'additive'));

      const regens = container.effects.filter(e => e.type === 'regen');
      expect(regens).toHaveLength(2);
      expect(regens.map(e => e.remainingTurns).sort((a, b) => a - b)).toEqual([2, 5]);
    });
  });

  // ==================== independent 策略 ====================
  describe('independent 策略', () => {
    it('同类型效果完全独立存在', () => {
      addEffectToContainer(container, makeEffect('shield', 50, 3, 'independent'));
      addEffectToContainer(container, makeEffect('shield', 30, 2, 'independent'));
      addEffectToContainer(container, makeEffect('shield', 100, 1, 'independent'));

      const shields = container.effects.filter(e => e.type === 'shield');
      expect(shields).toHaveLength(3);
    });

    it('独立效果保留原始数值与持续时间', () => {
      addEffectToContainer(container, makeEffect('shield', 50, 3, 'independent'));
      addEffectToContainer(container, makeEffect('shield', 30, 5, 'independent'));

      const shields = container.effects.filter(e => e.type === 'shield');
      expect(shields).toHaveLength(2);
      const second = shields[1];
      expect(second.value).toBe(30);
      expect(second.remainingTurns).toBe(5);
    });
  });

  // ==================== 默认策略 ====================
  describe('默认策略（未指定 stackStrategy）', () => {
    it('未指定 stackStrategy 时回退到 max 策略', () => {
      const e1: Effect = {
        id: generateEffectId(),
        type: 'poison',
        remainingTurns: 3,
        value: 10,
        source: 'item',
        sourceName: 'test-item'
      };
      const e2: Effect = {
        id: generateEffectId(),
        type: 'poison',
        remainingTurns: 2,
        value: 25,
        source: 'item',
        sourceName: 'test-item'
      };

      addEffectToContainer(container, e1);
      addEffectToContainer(container, e2);

      const poisons = container.effects.filter(e => e.type === 'poison');
      expect(poisons).toHaveLength(1);
      expect(poisons[0].value).toBe(25);
    });
  });

  // ==================== 跨策略混合 ====================
  describe('跨策略混合', () => {
    it('同类型效果使用不同策略时，按新效果的策略处理', () => {
      addEffectToContainer(container, makeEffect('attack_up', 10, 3, 'max'));
      addEffectToContainer(container, makeEffect('attack_up', 5, 2, 'independent'));

      const ups = container.effects.filter(e => e.type === 'attack_up');
      expect(ups).toHaveLength(2);
    });

    it('不同类型效果无论策略如何均独立共存', () => {
      addEffectToContainer(container, makeEffect('poison', 10, 3, 'max'));
      addEffectToContainer(container, makeEffect('burn', 15, 2, 'replace'));
      addEffectToContainer(container, makeEffect('shield', 50, 1, 'independent'));
      addEffectToContainer(container, makeEffect('regen', 5, 4, 'additive'));

      expect(container.effects).toHaveLength(4);
    });
  });

  // ==================== 辅助函数 ====================
  describe('辅助函数', () => {
    it('removeEffectFromContainer 移除指定类型的所有效果并返回数量', () => {
      addEffectToContainer(container, makeEffect('poison', 10, 3, 'additive'));
      addEffectToContainer(container, makeEffect('poison', 15, 2, 'additive'));
      addEffectToContainer(container, makeEffect('burn', 20, 1, 'replace'));

      const removed = removeEffectFromContainer(container, 'poison');
      expect(removed).toBe(2);
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].type).toBe('burn');
    });

    it('removeEffectFromContainer 移除不存在类型时返回 0', () => {
      addEffectToContainer(container, makeEffect('poison', 10, 3, 'max'));
      const removed = removeEffectFromContainer(container, 'burn');
      expect(removed).toBe(0);
      expect(container.effects).toHaveLength(1);
    });

    it('hasEffect 正确检测效果存在性', () => {
      addEffectToContainer(container, makeEffect('shield', 50, 3, 'independent'));

      expect(hasEffect(container, 'shield')).toBe(true);
      expect(hasEffect(container, 'poison')).toBe(false);
    });

    it('createEmptyContainer 返回空 effects 数组', () => {
      const c = createEmptyContainer();
      expect(c.effects).toEqual([]);
    });

    it('clearContainer 清空所有效果', () => {
      addEffectToContainer(container, makeEffect('poison', 10, 3, 'max'));
      addEffectToContainer(container, makeEffect('burn', 15, 2, 'replace'));
      expect(container.effects).toHaveLength(2);

      clearContainer(container);
      expect(container.effects).toEqual([]);
    });

    it('generateEffectId 每次返回唯一 ID', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateEffectId());
      }
      expect(ids.size).toBe(100);
    });
  });

  // ==================== maxStacks 叠加上限（P3-180/P3-187） ====================
  describe('maxStacks 叠加上限', () => {
    it('additive 达到 maxStacks 后不再 push（默认 5）', () => {
      for (let i = 0; i < 7; i++) {
        addEffectToContainer(container, makeEffect('poison', 10, 3, 'additive'));
      }
      // 默认 maxStacks=5，7 次添加后仅保留 5 个
      const poisons = container.effects.filter(e => e.type === 'poison');
      expect(poisons).toHaveLength(5);
    });

    it('additive 自定义 maxStacks=3 时仅保留 3 个', () => {
      for (let i = 0; i < 5; i++) {
        addEffectToContainer(container, makeEffect('burn', 8, 2, 'additive', 3));
      }
      const burns = container.effects.filter(e => e.type === 'burn');
      expect(burns).toHaveLength(3);
    });

    it('additive 达到上限时刷新最早效果（更新 value 和 remainingTurns）', () => {
      // 添加 3 个效果（maxStacks=3）
      addEffectToContainer(container, makeEffect('poison', 10, 3, 'additive', 3));
      addEffectToContainer(container, makeEffect('poison', 15, 2, 'additive', 3));
      addEffectToContainer(container, makeEffect('poison', 20, 1, 'additive', 3));

      // 第 4 个应刷新第 1 个（value 10→99, remainingTurns 3→4）
      addEffectToContainer(container, makeEffect('poison', 99, 4, 'additive', 3));

      const poisons = container.effects.filter(e => e.type === 'poison');
      expect(poisons).toHaveLength(3);
      // 最早的效果被刷新为最新值
      expect(poisons.some(p => p.value === 99 && p.remainingTurns === 4)).toBe(true);
      // 原始 value=10 的效果已不存在
      expect(poisons.some(p => p.value === 10)).toBe(false);
    });

    it('independent 同样受 maxStacks 限制', () => {
      for (let i = 0; i < 6; i++) {
        addEffectToContainer(container, makeEffect('shield', 50, 3, 'independent', 3));
      }
      const shields = container.effects.filter(e => e.type === 'shield');
      expect(shields).toHaveLength(3);
    });

    it('maxStacks=0 时不限制（无上限）', () => {
      for (let i = 0; i < 10; i++) {
        addEffectToContainer(container, makeEffect('regen', 5, 2, 'additive', 0));
      }
      const regens = container.effects.filter(e => e.type === 'regen');
      expect(regens).toHaveLength(10);
    });

    it('未达 maxStacks 时正常 push', () => {
      addEffectToContainer(container, makeEffect('poison', 10, 3, 'additive', 5));
      addEffectToContainer(container, makeEffect('poison', 15, 2, 'additive', 5));
      expect(container.effects.filter(e => e.type === 'poison')).toHaveLength(2);
    });
  });
});
