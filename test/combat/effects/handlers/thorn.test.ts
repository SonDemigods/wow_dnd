/**
 * @fileoverview thorn 处理器独立单元测试 — thorn
 * @description 覆盖：
 * 1. getThornDamage 直接方法测试（含边界值 0/正数/取整规则）
 * 2. 生命周期钩子存在性断言（仅 getThornDamage 定义）
 * 3. 叠加规则（max/independent/replace）
 * 4. registry 集成端到端测试（reduceSum）
 *
 * 注意：thorn 使用 Math.round 取整，JS 的 Math.round 向 +Inf 方向取整
 * （如 Math.round(12.5) = 13，Math.round(-12.5) = -12）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EffectHandlerRegistry } from '@/modules/combat/effects/handler';
import { thornHandler } from '@/modules/combat/effects/handlers/thorn';
import { createEmptyContainer, addEffectToContainer } from '@/modules/combat/effects/container';
import type { Effect, EffectContext, EffectType } from '@/modules/combat/effects/types';

// ============================================================
// 工厂函数
// ============================================================

function makeEffect(
  type: EffectType,
  value: number,
  remainingTurns: number,
  overrides: Partial<Effect> = {}
): Effect {
  return {
    id: `eff_${type}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    remainingTurns,
    value,
    source: 'skill',
    sourceName: 'test-skill',
    ...overrides,
  };
}

function makeCtx(overrides: Partial<EffectContext> = {}): EffectContext {
  return {
    ownerId: 'player_1',
    ownerType: 'player',
    baseStats: {
      physicalAttack: 30,
      physicalDefense: 10,
      magicAttack: 25,
      magicDefense: 8,
      speed: 15,
    },
    currentHp: 80,
    maxHp: 100,
    ...overrides,
  };
}

// ============================================================
// thornHandler — 荆棘
// ============================================================

describe('thornHandler', () => {
  const ctx = makeCtx();

  describe('直接方法测试 — getThornDamage', () => {
    it('value=0.3, incoming=100 → 返回 30', () => {
      const eff = makeEffect('thorn', 0.3, 3);
      expect(thornHandler.getThornDamage!(eff, 100)).toBe(30);
    });

    it('value=0.25, incoming=50 → 返回 13（12.5 round 向 +Inf）', () => {
      // Math.round(12.5) = 13（向 +Inf 取整）
      const eff = makeEffect('thorn', 0.25, 3);
      expect(thornHandler.getThornDamage!(eff, 50)).toBe(13);
    });

    it('value=0 → 反伤 0', () => {
      const eff = makeEffect('thorn', 0, 3);
      expect(thornHandler.getThornDamage!(eff, 100)).toBe(0);
    });

    it('incoming=0 → 反伤 0', () => {
      const eff = makeEffect('thorn', 0.5, 3);
      expect(thornHandler.getThornDamage!(eff, 0)).toBe(0);
    });

    it('value=1.0 → 100% 反伤', () => {
      const eff = makeEffect('thorn', 1.0, 3);
      expect(thornHandler.getThornDamage!(eff, 100)).toBe(100);
    });

    it('value=0.5, incoming=100 → 返回 50', () => {
      const eff = makeEffect('thorn', 0.5, 3);
      expect(thornHandler.getThornDamage!(eff, 100)).toBe(50);
    });

    it('value=0.333, incoming=100 → 返回 33（33.3 round=33）', () => {
      const eff = makeEffect('thorn', 0.333, 3);
      expect(thornHandler.getThornDamage!(eff, 100)).toBe(33);
    });

    it('value=0.1, incoming=15 → 返回 2（1.5 round=2）', () => {
      // Math.round(1.5) = 2
      const eff = makeEffect('thorn', 0.1, 3);
      expect(thornHandler.getThornDamage!(eff, 15)).toBe(2);
    });

    it('type 字段为 thorn', () => {
      expect(thornHandler.type).toBe('thorn');
    });
  });

  describe('生命周期钩子验证', () => {
    it('onApply 未定义', () => {
      expect(thornHandler.onApply).toBeUndefined();
    });

    it('onTick 未定义（荆棘不是持续效果）', () => {
      expect(thornHandler.onTick).toBeUndefined();
    });

    it('onRemove 未定义', () => {
      expect(thornHandler.onRemove).toBeUndefined();
    });

    it('getThornDamage 已定义（荆棘核心方法）', () => {
      expect(thornHandler.getThornDamage).toBeDefined();
    });

    it('getAttackerDamageMod 未定义', () => {
      expect(thornHandler.getAttackerDamageMod).toBeUndefined();
    });

    it('getDefenderDamageMod 未定义', () => {
      expect(thornHandler.getDefenderDamageMod).toBeUndefined();
    });

    it('getSpeedMod 未定义', () => {
      expect(thornHandler.getSpeedMod).toBeUndefined();
    });
  });

  describe('叠加规则', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(thornHandler);
    });

    it('max 策略（默认）：取最大 value 与最大 remainingTurns', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('thorn', 0.1, 2));
      addEffectToContainer(container, makeEffect('thorn', 0.3, 4));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBeCloseTo(0.3);
      expect(container.effects[0].remainingTurns).toBe(4);
      // round(100 * 0.3) = 30
      expect(registry.reduceSum(container, 'getThornDamage', ctx, 100)).toBe(30);
    });

    it('max 策略：新 thorn 值更小时保留旧值', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('thorn', 0.5, 4));
      addEffectToContainer(container, makeEffect('thorn', 0.1, 2));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBeCloseTo(0.5);
      expect(container.effects[0].remainingTurns).toBe(4);
    });

    it('independent 策略：多个 thorn 独立存在，reduceSum 累加反伤', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('thorn', 0.3, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('thorn', 0.2, 3, { stackStrategy: 'independent' }));
      expect(container.effects).toHaveLength(2);
      // round(100*0.3) + round(100*0.2) = 30 + 20 = 50
      expect(registry.reduceSum(container, 'getThornDamage', ctx, 100)).toBe(50);
    });

    it('replace 策略：替换旧 thorn', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('thorn', 0.5, 5));
      addEffectToContainer(container, makeEffect('thorn', 0.1, 2, { stackStrategy: 'replace' }));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBeCloseTo(0.1);
      expect(container.effects[0].remainingTurns).toBe(2);
    });
  });

  describe('registry 集成', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(thornHandler);
    });

    it('注册后可通过 get 获取', () => {
      expect(registry.get('thorn')).toBe(thornHandler);
    });

    it('空容器 reduceSum 返回 0', () => {
      const container = createEmptyContainer();
      expect(registry.reduceSum(container, 'getThornDamage', ctx, 100)).toBe(0);
    });

    it('单个 thorn 端到端反伤', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('thorn', 0.3, 3));
      expect(registry.reduceSum(container, 'getThornDamage', ctx, 100)).toBe(30);
    });

    it('thorn 反伤不修改 effect.value（与 shield 不同）', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('thorn', 0.3, 3));
      registry.reduceSum(container, 'getThornDamage', ctx, 100);
      expect(container.effects[0].value).toBeCloseTo(0.3);
    });

    it('tickAll 推进 thorn 不产生 dotDamage', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('thorn', 0.3, 3));
      const result = registry.tickAll(container, ctx);
      expect(result.dotDamage).toBe(0);
      expect(result.regenAmount).toBe(0);
      expect(container.effects[0].remainingTurns).toBe(2);
    });

    it('thorn 过期后从容器移除', () => {
      const container = createEmptyContainer();
      const eff = makeEffect('thorn', 0.3, 1);
      addEffectToContainer(container, eff);
      const result = registry.tickAll(container, ctx);
      expect(result.expiredIds).toEqual([eff.id]);
      expect(container.effects).toHaveLength(0);
    });

    it('多个 independent thorn 端到端累加', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('thorn', 0.1, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('thorn', 0.2, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('thorn', 0.3, 3, { stackStrategy: 'independent' }));
      // round(100*0.1) + round(100*0.2) + round(100*0.3) = 10 + 20 + 30 = 60
      expect(registry.reduceSum(container, 'getThornDamage', ctx, 100)).toBe(60);
    });
  });
});
