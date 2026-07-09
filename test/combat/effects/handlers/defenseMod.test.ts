/**
 * @fileoverview defenseMod 处理器独立单元测试 — defense_up / defense_down / vulnerable
 * @description 覆盖：
 * 1. getDefenderDamageMod 直接方法测试（含边界值 0/正数/大值/保底）
 * 2. 生命周期钩子存在性断言
 * 3. 叠加规则（max/independent/replace）
 * 4. registry 集成端到端测试（reduceMultiplier）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EffectHandlerRegistry } from '@/modules/combat/effects/handler';
import {
  defenseUpHandler,
  defenseDownHandler,
  vulnerableHandler,
} from '@/modules/combat/effects/handlers/defenseMod';
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
// defenseUpHandler — 防御上升
// ============================================================

describe('defenseUpHandler', () => {
  const ctx = makeCtx();

  describe('直接方法测试 — getDefenderDamageMod', () => {
    it('value=14 → 倍率 0.86', () => {
      const eff = makeEffect('defense_up', 14, 3);
      expect(defenseUpHandler.getDefenderDamageMod!(eff, ctx)).toBeCloseTo(0.86);
    });

    it('value=100 → 保底 0.05', () => {
      const eff = makeEffect('defense_up', 100, 3);
      expect(defenseUpHandler.getDefenderDamageMod!(eff, ctx)).toBe(0.05);
    });

    it('value=200 → 保底 0.05（不会变负或零）', () => {
      const eff = makeEffect('defense_up', 200, 3);
      expect(defenseUpHandler.getDefenderDamageMod!(eff, ctx)).toBe(0.05);
    });

    it('value=0 → 倍率 1.0（无减免）', () => {
      const eff = makeEffect('defense_up', 0, 3);
      expect(defenseUpHandler.getDefenderDamageMod!(eff, ctx)).toBe(1);
    });

    it('value=50 → 倍率 0.5', () => {
      const eff = makeEffect('defense_up', 50, 3);
      expect(defenseUpHandler.getDefenderDamageMod!(eff, ctx)).toBeCloseTo(0.5);
    });

    it('value=95 → 倍率 0.05（恰好等于保底）', () => {
      // 1 - 95/100 = 0.05，与保底相同（浮点精度下用 toBeCloseTo）
      const eff = makeEffect('defense_up', 95, 3);
      expect(defenseUpHandler.getDefenderDamageMod!(eff, ctx)).toBeCloseTo(0.05);
    });

    it('type 字段为 defense_up', () => {
      expect(defenseUpHandler.type).toBe('defense_up');
    });
  });

  describe('生命周期钩子验证', () => {
    it('onApply 未定义', () => {
      expect(defenseUpHandler.onApply).toBeUndefined();
    });

    it('onTick 未定义', () => {
      expect(defenseUpHandler.onTick).toBeUndefined();
    });

    it('onRemove 未定义', () => {
      expect(defenseUpHandler.onRemove).toBeUndefined();
    });

    it('getAttackerDamageMod 未定义（不是攻击方修正）', () => {
      expect(defenseUpHandler.getAttackerDamageMod).toBeUndefined();
    });
  });

  describe('叠加规则', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(defenseUpHandler);
    });

    it('max 策略：取最大 value 与最大 remainingTurns', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('defense_up', 20, 2));
      addEffectToContainer(container, makeEffect('defense_up', 40, 5));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(40);
      expect(container.effects[0].remainingTurns).toBe(5);
      // 倍率 = max(0.05, 1 - 40/100) = 0.6
      expect(registry.reduceMultiplier(container, 'getDefenderDamageMod', ctx)).toBeCloseTo(0.6);
    });

    it('independent 策略：多个 defense_up 累乘', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('defense_up', 20, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('defense_up', 50, 3, { stackStrategy: 'independent' }));
      // 0.8 * 0.5 = 0.4
      expect(registry.reduceMultiplier(container, 'getDefenderDamageMod', ctx)).toBeCloseTo(0.4);
    });

    it('replace 策略：替换旧效果', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('defense_up', 30, 5));
      addEffectToContainer(container, makeEffect('defense_up', 10, 2, { stackStrategy: 'replace' }));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(10);
    });
  });

  describe('registry 集成', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(defenseUpHandler);
    });

    it('注册后可通过 get 获取', () => {
      expect(registry.get('defense_up')).toBe(defenseUpHandler);
    });

    it('空容器 reduceMultiplier 返回 1.0', () => {
      const container = createEmptyContainer();
      expect(registry.reduceMultiplier(container, 'getDefenderDamageMod', ctx)).toBe(1.0);
    });

    it('tickAll 不影响 defense_up 倍率', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('defense_up', 20, 3));
      registry.tickAll(container, ctx);
      expect(container.effects[0].remainingTurns).toBe(2);
      expect(registry.reduceMultiplier(container, 'getDefenderDamageMod', ctx)).toBeCloseTo(0.8);
    });
  });
});

// ============================================================
// defenseDownHandler — 防御下降
// ============================================================

describe('defenseDownHandler', () => {
  const ctx = makeCtx();

  describe('直接方法测试 — getDefenderDamageMod', () => {
    it('value=12 → 倍率 1.12', () => {
      const eff = makeEffect('defense_down', 12, 3);
      expect(defenseDownHandler.getDefenderDamageMod!(eff, ctx)).toBeCloseTo(1.12);
    });

    it('value=0 → 倍率 1.0', () => {
      const eff = makeEffect('defense_down', 0, 3);
      expect(defenseDownHandler.getDefenderDamageMod!(eff, ctx)).toBe(1);
    });

    it('value=100 → 倍率 2.0', () => {
      const eff = makeEffect('defense_down', 100, 3);
      expect(defenseDownHandler.getDefenderDamageMod!(eff, ctx)).toBe(2);
    });

    it('value=50 → 倍率 1.5', () => {
      const eff = makeEffect('defense_down', 50, 3);
      expect(defenseDownHandler.getDefenderDamageMod!(eff, ctx)).toBeCloseTo(1.5);
    });

    it('大值 value=500 → 倍率 6.0（无上限封顶）', () => {
      const eff = makeEffect('defense_down', 500, 3);
      expect(defenseDownHandler.getDefenderDamageMod!(eff, ctx)).toBe(6);
    });

    it('type 字段为 defense_down', () => {
      expect(defenseDownHandler.type).toBe('defense_down');
    });
  });

  describe('生命周期钩子验证', () => {
    it('onApply 未定义', () => {
      expect(defenseDownHandler.onApply).toBeUndefined();
    });

    it('onTick 未定义', () => {
      expect(defenseDownHandler.onTick).toBeUndefined();
    });

    it('onRemove 未定义', () => {
      expect(defenseDownHandler.onRemove).toBeUndefined();
    });
  });

  describe('叠加规则', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(defenseDownHandler);
    });

    it('max 策略：取较大 value', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('defense_down', 20, 2));
      addEffectToContainer(container, makeEffect('defense_down', 50, 4));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(50);
      // 1 + 50/100 = 1.5
      expect(registry.reduceMultiplier(container, 'getDefenderDamageMod', ctx)).toBeCloseTo(1.5);
    });

    it('independent 策略：多个 defense_down 累乘', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('defense_down', 20, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('defense_down', 50, 3, { stackStrategy: 'independent' }));
      // 1.2 * 1.5 = 1.8
      expect(registry.reduceMultiplier(container, 'getDefenderDamageMod', ctx)).toBeCloseTo(1.8);
    });

    it('replace 策略：替换旧效果', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('defense_down', 80, 5));
      addEffectToContainer(container, makeEffect('defense_down', 20, 2, { stackStrategy: 'replace' }));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(20);
    });
  });

  describe('registry 集成', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(defenseDownHandler);
    });

    it('单个 defense_down 端到端', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('defense_down', 30, 3));
      expect(registry.reduceMultiplier(container, 'getDefenderDamageMod', ctx)).toBeCloseTo(1.3);
    });

    it('tickAll 推进后倍率不变', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('defense_down', 30, 3));
      registry.tickAll(container, ctx);
      expect(registry.reduceMultiplier(container, 'getDefenderDamageMod', ctx)).toBeCloseTo(1.3);
    });
  });
});

// ============================================================
// vulnerableHandler — 易伤
// ============================================================

describe('vulnerableHandler', () => {
  const ctx = makeCtx();

  describe('直接方法测试 — getDefenderDamageMod', () => {
    it('value=22 → 倍率 1 + 22*1.5/100 = 1.33', () => {
      const eff = makeEffect('vulnerable', 22, 3);
      expect(vulnerableHandler.getDefenderDamageMod!(eff, ctx)).toBeCloseTo(1.33);
    });

    it('value=0 → 倍率 1.0', () => {
      const eff = makeEffect('vulnerable', 0, 3);
      expect(vulnerableHandler.getDefenderDamageMod!(eff, ctx)).toBe(1);
    });

    it('value=100 → 倍率 2.5（1 + 100*1.5/100）', () => {
      const eff = makeEffect('vulnerable', 100, 3);
      expect(vulnerableHandler.getDefenderDamageMod!(eff, ctx)).toBeCloseTo(2.5);
    });

    it('value=10 → 倍率 1.15（1 + 10*1.5/100）', () => {
      const eff = makeEffect('vulnerable', 10, 3);
      expect(vulnerableHandler.getDefenderDamageMod!(eff, ctx)).toBeCloseTo(1.15);
    });

    it('比同等 value 的 defense_down 更强（1.5 倍系数）', () => {
      const vEff = makeEffect('vulnerable', 20, 3);
      const dEff = makeEffect('defense_down', 20, 3);
      const vMod = vulnerableHandler.getDefenderDamageMod!(vEff, ctx);
      const dMod = defenseDownHandler.getDefenderDamageMod!(dEff, ctx);
      // vulnerable: 1.3, defense_down: 1.2
      expect(vMod).toBeGreaterThan(dMod);
    });

    it('type 字段为 vulnerable', () => {
      expect(vulnerableHandler.type).toBe('vulnerable');
    });
  });

  describe('生命周期钩子验证', () => {
    it('onApply 未定义', () => {
      expect(vulnerableHandler.onApply).toBeUndefined();
    });

    it('onTick 未定义', () => {
      expect(vulnerableHandler.onTick).toBeUndefined();
    });

    it('onRemove 未定义', () => {
      expect(vulnerableHandler.onRemove).toBeUndefined();
    });

    it('getAttackerDamageMod 未定义', () => {
      expect(vulnerableHandler.getAttackerDamageMod).toBeUndefined();
    });
  });

  describe('叠加规则', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(vulnerableHandler);
    });

    it('max 策略：取较大 value', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('vulnerable', 10, 2));
      addEffectToContainer(container, makeEffect('vulnerable', 30, 5));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(30);
      // 1 + 30*1.5/100 = 1.45
      expect(registry.reduceMultiplier(container, 'getDefenderDamageMod', ctx)).toBeCloseTo(1.45);
    });

    it('independent 策略：多个 vulnerable 累乘', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('vulnerable', 20, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('vulnerable', 20, 3, { stackStrategy: 'independent' }));
      // 1.3 * 1.3 = 1.69
      expect(registry.reduceMultiplier(container, 'getDefenderDamageMod', ctx)).toBeCloseTo(1.69);
    });

    it('replace 策略：替换旧效果', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('vulnerable', 50, 5));
      addEffectToContainer(container, makeEffect('vulnerable', 10, 2, { stackStrategy: 'replace' }));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(10);
    });
  });

  describe('registry 集成', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(defenseUpHandler);
      registry.register(vulnerableHandler);
    });

    it('defense_up + vulnerable 同时存在累乘', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('defense_up', 20, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('vulnerable', 20, 3, { stackStrategy: 'independent' }));
      // defense_up(20): max(0.05, 1 - 0.2) = 0.8
      // vulnerable(20): 1 + 20*1.5/100 = 1.3
      // 0.8 * 1.3 = 1.04
      expect(registry.reduceMultiplier(container, 'getDefenderDamageMod', ctx)).toBeCloseTo(1.04);
    });

    it('单个 vulnerable 端到端', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('vulnerable', 40, 3));
      // 1 + 40*1.5/100 = 1.6
      expect(registry.reduceMultiplier(container, 'getDefenderDamageMod', ctx)).toBeCloseTo(1.6);
    });

    it('tickAll 推进后 vulnerable 倍率不变', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('vulnerable', 40, 3));
      registry.tickAll(container, ctx);
      expect(container.effects[0].remainingTurns).toBe(2);
      expect(registry.reduceMultiplier(container, 'getDefenderDamageMod', ctx)).toBeCloseTo(1.6);
    });
  });
});
