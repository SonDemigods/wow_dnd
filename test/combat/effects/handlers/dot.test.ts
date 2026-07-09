/**
 * @fileoverview dot 处理器独立单元测试 — poison / burn
 * @description 覆盖：
 * 1. onTick 直接方法测试（含边界值 0/正数/取整规则）
 * 2. 生命周期钩子存在性断言（仅 onTick 定义，onApply/onRemove 未定义）
 * 3. 叠加规则（max/independent/replace）
 * 4. registry 集成端到端测试（tickAll）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EffectHandlerRegistry } from '@/modules/combat/effects/handler';
import { poisonHandler, burnHandler } from '@/modules/combat/effects/handlers/dot';
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
// poisonHandler — 中毒
// ============================================================

describe('poisonHandler', () => {
  const ctx = makeCtx();

  describe('直接方法测试 — onTick', () => {
    it('value=12 → dotDamage=12, regenAmount=0', () => {
      const eff = makeEffect('poison', 12, 3);
      expect(poisonHandler.onTick!(eff, ctx)).toEqual({ dotDamage: 12, regenAmount: 0 });
    });

    it('value=0 → 不造成伤害', () => {
      const eff = makeEffect('poison', 0, 3);
      expect(poisonHandler.onTick!(eff, ctx).dotDamage).toBe(0);
    });

    it('value=1 → dotDamage=1（无倍率）', () => {
      const eff = makeEffect('poison', 1, 3);
      expect(poisonHandler.onTick!(eff, ctx).dotDamage).toBe(1);
    });

    it('大值 value=999 → dotDamage=999', () => {
      const eff = makeEffect('poison', 999, 3);
      expect(poisonHandler.onTick!(eff, ctx).dotDamage).toBe(999);
    });

    it('regenAmount 始终为 0（中毒不回血）', () => {
      const eff = makeEffect('poison', 50, 3);
      expect(poisonHandler.onTick!(eff, ctx).regenAmount).toBe(0);
    });

    it('type 字段为 poison', () => {
      expect(poisonHandler.type).toBe('poison');
    });
  });

  describe('生命周期钩子验证', () => {
    it('onTick 已定义（持续伤害核心钩子）', () => {
      expect(poisonHandler.onTick).toBeDefined();
    });

    it('onApply 未定义', () => {
      expect(poisonHandler.onApply).toBeUndefined();
    });

    it('onRemove 未定义', () => {
      expect(poisonHandler.onRemove).toBeUndefined();
    });

    it('getAttackerDamageMod 未定义（poison 不影响攻击倍率）', () => {
      expect(poisonHandler.getAttackerDamageMod).toBeUndefined();
    });
  });

  describe('叠加规则', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(poisonHandler);
    });

    it('max 策略（默认）：取最大 value 与最大 remainingTurns', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('poison', 10, 2));
      addEffectToContainer(container, makeEffect('poison', 20, 4));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(20);
      expect(container.effects[0].remainingTurns).toBe(4);
      // tickAll 后 dotDamage=20
      const result = registry.tickAll(container, ctx);
      expect(result.dotDamage).toBe(20);
    });

    it('independent 策略：多个 poison 独立存在，tickAll 累加伤害', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('poison', 10, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('poison', 15, 3, { stackStrategy: 'independent' }));
      expect(container.effects).toHaveLength(2);
      const result = registry.tickAll(container, ctx);
      // 10 + 15 = 25
      expect(result.dotDamage).toBe(25);
    });

    it('replace 策略：替换旧 poison', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('poison', 30, 5));
      addEffectToContainer(container, makeEffect('poison', 10, 2, { stackStrategy: 'replace' }));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(10);
      expect(container.effects[0].remainingTurns).toBe(2);
    });
  });

  describe('registry 集成', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(poisonHandler);
    });

    it('tickAll 累加 poison dotDamage', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('poison', 10, 3));
      const result = registry.tickAll(container, ctx);
      expect(result.dotDamage).toBe(10);
      expect(result.regenAmount).toBe(0);
      expect(container.effects[0].remainingTurns).toBe(2);
    });

    it('poison 过期时加入 expiredIds 并触发 onRemove', () => {
      const onRemove = vi.fn();
      const customRegistry = new EffectHandlerRegistry();
      customRegistry.register({
        type: 'poison',
        onTick: poisonHandler.onTick,
        onRemove,
      });
      const container = createEmptyContainer();
      const eff = makeEffect('poison', 10, 1);
      addEffectToContainer(container, eff);
      const result = customRegistry.tickAll(container, ctx);
      expect(result.expiredIds).toEqual([eff.id]);
      expect(onRemove).toHaveBeenCalledTimes(1);
      expect(container.effects).toHaveLength(0);
    });

    it('多回合推进：value 不变，remainingTurns 递减', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('poison', 10, 3));
      registry.tickAll(container, ctx);
      expect(container.effects[0].value).toBe(10);
      expect(container.effects[0].remainingTurns).toBe(2);
      registry.tickAll(container, ctx);
      expect(container.effects[0].value).toBe(10);
      expect(container.effects[0].remainingTurns).toBe(1);
    });
  });
});

// ============================================================
// burnHandler — 灼烧
// ============================================================

describe('burnHandler', () => {
  const ctx = makeCtx();

  describe('直接方法测试 — onTick', () => {
    it('value=10 → dotDamage=15（value × 1.5）', () => {
      const eff = makeEffect('burn', 10, 3);
      expect(burnHandler.onTick!(eff, ctx)).toEqual({ dotDamage: 15, regenAmount: 0 });
    });

    it('奇数 × 1.5 使用 Math.round 取整（9*1.5=13.5 → 14）', () => {
      const eff = makeEffect('burn', 9, 3);
      expect(burnHandler.onTick!(eff, ctx).dotDamage).toBe(14);
    });

    it('value=1 → 伤害 2（1*1.5=1.5 → round=2）', () => {
      const eff = makeEffect('burn', 1, 3);
      expect(burnHandler.onTick!(eff, ctx).dotDamage).toBe(2);
    });

    it('value=0 → dotDamage=0', () => {
      const eff = makeEffect('burn', 0, 3);
      expect(burnHandler.onTick!(eff, ctx).dotDamage).toBe(0);
    });

    it('value=2 → dotDamage=3（2*1.5=3 整数）', () => {
      const eff = makeEffect('burn', 2, 3);
      expect(burnHandler.onTick!(eff, ctx).dotDamage).toBe(3);
    });

    it('value=3 → dotDamage=5（3*1.5=4.5 → round=5）', () => {
      // Math.round(4.5) = 5（向 +Inf 取整）
      const eff = makeEffect('burn', 3, 3);
      expect(burnHandler.onTick!(eff, ctx).dotDamage).toBe(5);
    });

    it('value=5 → dotDamage=8（5*1.5=7.5 → round=8）', () => {
      const eff = makeEffect('burn', 5, 3);
      expect(burnHandler.onTick!(eff, ctx).dotDamage).toBe(8);
    });

    it('regenAmount 始终为 0', () => {
      const eff = makeEffect('burn', 50, 3);
      expect(burnHandler.onTick!(eff, ctx).regenAmount).toBe(0);
    });

    it('type 字段为 burn', () => {
      expect(burnHandler.type).toBe('burn');
    });
  });

  describe('生命周期钩子验证', () => {
    it('onTick 已定义', () => {
      expect(burnHandler.onTick).toBeDefined();
    });

    it('onApply 未定义', () => {
      expect(burnHandler.onApply).toBeUndefined();
    });

    it('onRemove 未定义', () => {
      expect(burnHandler.onRemove).toBeUndefined();
    });
  });

  describe('叠加规则', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(burnHandler);
    });

    it('max 策略：取最大 value', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('burn', 10, 2));
      addEffectToContainer(container, makeEffect('burn', 20, 4));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(20);
      // tickAll: round(20*1.5) = 30
      const result = registry.tickAll(container, ctx);
      expect(result.dotDamage).toBe(30);
    });

    it('independent 策略：多个 burn 独立存在，tickAll 累加', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('burn', 10, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('burn', 10, 3, { stackStrategy: 'independent' }));
      // round(10*1.5) + round(10*1.5) = 15 + 15 = 30
      const result = registry.tickAll(container, ctx);
      expect(result.dotDamage).toBe(30);
    });

    it('replace 策略：替换旧 burn', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('burn', 30, 5));
      addEffectToContainer(container, makeEffect('burn', 10, 2, { stackStrategy: 'replace' }));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(10);
    });
  });

  describe('registry 集成', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(poisonHandler);
      registry.register(burnHandler);
    });

    it('poison + burn 混合 tickAll 累加', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('poison', 10, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('burn', 10, 3, { stackStrategy: 'independent' }));
      // poison: 10, burn: round(10*1.5)=15 → 合计 25
      const result = registry.tickAll(container, ctx);
      expect(result.dotDamage).toBe(25);
    });

    it('burn 比 poison 同 value 伤害更高（1.5 倍系数）', () => {
      const poisonContainer = createEmptyContainer();
      addEffectToContainer(poisonContainer, makeEffect('poison', 10, 3));
      const burnContainer = createEmptyContainer();
      addEffectToContainer(burnContainer, makeEffect('burn', 10, 3));
      const poisonDmg = registry.tickAll(poisonContainer, ctx).dotDamage;
      const burnDmg = registry.tickAll(burnContainer, ctx).dotDamage;
      expect(burnDmg).toBeGreaterThan(poisonDmg);
    });

    it('burn 过期时从容器移除', () => {
      const container = createEmptyContainer();
      const eff = makeEffect('burn', 10, 1);
      addEffectToContainer(container, eff);
      const result = registry.tickAll(container, ctx);
      expect(result.expiredIds).toEqual([eff.id]);
      expect(container.effects).toHaveLength(0);
    });
  });
});
