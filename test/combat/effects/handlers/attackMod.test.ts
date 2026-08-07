/**
 * @fileoverview attackMod 处理器独立单元测试 — attack_up / attack_down
 * @description 覆盖：
 * 1. getAttackerDamageMod 直接方法测试（含边界值 0/正数/大值/保底）
 * 2. 生命周期钩子存在性断言（onApply/onTick/onRemove 均未定义）
 * 3. 叠加规则（max/independent/replace）
 * 4. registry 集成端到端测试（reduceMultiplier）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EffectHandlerRegistry } from '@/modules/combat/effects/handler';
import { attackUpHandler, attackDownHandler } from '@/modules/combat/effects/handlers/attackMod';
import { createEmptyContainer, addEffectToContainer } from '@/modules/combat/effects/container';
import type { Effect, EffectContext, EffectType } from '@/modules/combat/effects/types';

// P3-187：替代 Math.random().toString(36) 的脆弱 ID 生成，改用自增计数器
let effIdCounter = 0;

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
    id: `eff_${type}_${++effIdCounter}`,
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
// attackUpHandler — 攻击上升
// ============================================================

describe('attackUpHandler', () => {
  const ctx = makeCtx();

  describe('直接方法测试 — getAttackerDamageMod', () => {
    it('value=18 → 倍率 1.18', () => {
      const eff = makeEffect('attack_up', 18, 3);
      expect(attackUpHandler.getAttackerDamageMod!(eff, ctx)).toBeCloseTo(1.18);
    });

    it('value=100 → 倍率 2.0', () => {
      const eff = makeEffect('attack_up', 100, 3);
      expect(attackUpHandler.getAttackerDamageMod!(eff, ctx)).toBe(2);
    });

    it('value=0 → 倍率 1.0（无加成）', () => {
      const eff = makeEffect('attack_up', 0, 3);
      expect(attackUpHandler.getAttackerDamageMod!(eff, ctx)).toBe(1);
    });

    it('value=50 → 倍率 1.5', () => {
      const eff = makeEffect('attack_up', 50, 3);
      expect(attackUpHandler.getAttackerDamageMod!(eff, ctx)).toBeCloseTo(1.5);
    });

    it('大值 value=500 → 倍率 6.0（无上限封顶）', () => {
      const eff = makeEffect('attack_up', 500, 3);
      expect(attackUpHandler.getAttackerDamageMod!(eff, ctx)).toBe(6);
    });

    it('type 字段为 attack_up', () => {
      expect(attackUpHandler.type).toBe('attack_up');
    });
  });

  describe('生命周期钩子验证', () => {
    it('onApply 未定义', () => {
      expect(attackUpHandler.onApply).toBeUndefined();
    });

    it('onTick 未定义（非持续伤害效果）', () => {
      expect(attackUpHandler.onTick).toBeUndefined();
    });

    it('onRemove 未定义', () => {
      expect(attackUpHandler.onRemove).toBeUndefined();
    });

    it('getDefenderDamageMod 未定义（不是防御方修正）', () => {
      expect(attackUpHandler.getDefenderDamageMod).toBeUndefined();
    });
  });

  describe('叠加规则', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(attackUpHandler);
    });

    it('max 策略（默认）：同类型效果取最大 value 并刷新 remainingTurns', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('attack_up', 10, 2));
      addEffectToContainer(container, makeEffect('attack_up', 20, 5));
      // max 合并后应只剩 1 个效果，value=20，turns=5
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(20);
      expect(container.effects[0].remainingTurns).toBe(5);
      // 倍率 = 1 + 20/100 = 1.2
      expect(registry.reduceMultiplier(container, 'getAttackerDamageMod', ctx)).toBeCloseTo(1.2);
    });

    it('max 策略：新效果值更小时保留旧值', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('attack_up', 30, 4));
      addEffectToContainer(container, makeEffect('attack_up', 10, 2));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(30);
      expect(container.effects[0].remainingTurns).toBe(4);
    });

    it('independent 策略：多个同类型效果独立存在，registry 累乘', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('attack_up', 10, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('attack_up', 20, 3, { stackStrategy: 'independent' }));
      expect(container.effects).toHaveLength(2);
      // 1.10 * 1.20 = 1.32
      expect(registry.reduceMultiplier(container, 'getAttackerDamageMod', ctx)).toBeCloseTo(1.32);
    });

    it('replace 策略：替换旧效果', () => {
      const container = createEmptyContainer();
      const oldEff = makeEffect('attack_up', 10, 5);
      addEffectToContainer(container, oldEff);
      addEffectToContainer(container, makeEffect('attack_up', 25, 2, { stackStrategy: 'replace' }));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(25);
      expect(container.effects[0].remainingTurns).toBe(2);
      expect(container.effects[0].id).not.toBe(oldEff.id);
    });
  });

  describe('registry 集成', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(attackUpHandler);
    });

    it('注册后可通过 get 获取', () => {
      expect(registry.get('attack_up')).toBe(attackUpHandler);
    });

    it('空容器 reduceMultiplier 返回 1.0', () => {
      const container = createEmptyContainer();
      expect(registry.reduceMultiplier(container, 'getAttackerDamageMod', ctx)).toBe(1.0);
    });

    it('单个 attack_up 端到端累乘', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('attack_up', 18, 3));
      expect(registry.reduceMultiplier(container, 'getAttackerDamageMod', ctx)).toBeCloseTo(1.18);
    });

    it('多回合推进不影响 attack_up 的倍率（无 onTick）', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('attack_up', 20, 3));
      const r1 = registry.tickAll(container, ctx);
      // attack_up 无 onTick，不产生 dotDamage / regenAmount
      expect(r1.dotDamage).toBe(0);
      expect(r1.regenAmount).toBe(0);
      // 但 remainingTurns 仍推进
      expect(container.effects[0].remainingTurns).toBe(2);
      // 倍率不变
      expect(registry.reduceMultiplier(container, 'getAttackerDamageMod', ctx)).toBeCloseTo(1.2);
    });
  });
});

// ============================================================
// attackDownHandler — 攻击下降
// ============================================================

describe('attackDownHandler', () => {
  const ctx = makeCtx();

  describe('直接方法测试 — getAttackerDamageMod', () => {
    it('value=18 → 倍率 0.82', () => {
      const eff = makeEffect('attack_down', 18, 3);
      expect(attackDownHandler.getAttackerDamageMod!(eff, ctx)).toBeCloseTo(0.82);
    });

    it('value=100 → 倍率 0.0，但保底 0.1', () => {
      const eff = makeEffect('attack_down', 100, 3);
      expect(attackDownHandler.getAttackerDamageMod!(eff, ctx)).toBe(0.1);
    });

    it('value=200 → 保底 0.1（不会变负）', () => {
      const eff = makeEffect('attack_down', 200, 3);
      expect(attackDownHandler.getAttackerDamageMod!(eff, ctx)).toBe(0.1);
    });

    it('value=0 → 倍率 1.0（无削弱）', () => {
      const eff = makeEffect('attack_down', 0, 3);
      expect(attackDownHandler.getAttackerDamageMod!(eff, ctx)).toBe(1);
    });

    it('value=50 → 倍率 0.5', () => {
      const eff = makeEffect('attack_down', 50, 3);
      expect(attackDownHandler.getAttackerDamageMod!(eff, ctx)).toBeCloseTo(0.5);
    });

    it('value=90 → 倍率 0.1（恰好等于保底）', () => {
      // 1 - 90/100 = 0.1，与保底相同（浮点精度下用 toBeCloseTo）
      const eff = makeEffect('attack_down', 90, 3);
      expect(attackDownHandler.getAttackerDamageMod!(eff, ctx)).toBeCloseTo(0.1);
    });

    it('type 字段为 attack_down', () => {
      expect(attackDownHandler.type).toBe('attack_down');
    });
  });

  describe('生命周期钩子验证', () => {
    it('onApply 未定义', () => {
      expect(attackDownHandler.onApply).toBeUndefined();
    });

    it('onTick 未定义', () => {
      expect(attackDownHandler.onTick).toBeUndefined();
    });

    it('onRemove 未定义', () => {
      expect(attackDownHandler.onRemove).toBeUndefined();
    });
  });

  describe('叠加规则', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(attackDownHandler);
    });

    it('max 策略：取较大 value（削弱更轻者胜出）', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('attack_down', 50, 2));
      addEffectToContainer(container, makeEffect('attack_down', 30, 4));
      // max 取 value=50（虽然语义上"更强削弱"，但实现是 Math.max）
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(50);
      expect(container.effects[0].remainingTurns).toBe(4);
      // 倍率 = max(0.1, 1 - 50/100) = 0.5
      expect(registry.reduceMultiplier(container, 'getAttackerDamageMod', ctx)).toBeCloseTo(0.5);
    });

    it('independent 策略：多个 attack_down 累乘', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('attack_down', 50, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('attack_down', 50, 3, { stackStrategy: 'independent' }));
      // 0.5 * 0.5 = 0.25
      expect(registry.reduceMultiplier(container, 'getAttackerDamageMod', ctx)).toBeCloseTo(0.25);
    });

    it('replace 策略：替换旧效果', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('attack_down', 80, 5));
      addEffectToContainer(container, makeEffect('attack_down', 20, 2, { stackStrategy: 'replace' }));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(20);
    });
  });

  describe('registry 集成', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(attackUpHandler);
      registry.register(attackDownHandler);
    });

    it('attack_up + attack_down 混合累乘', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('attack_up', 20, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('attack_down', 50, 3, { stackStrategy: 'independent' }));
      // 1.20 * 0.50 = 0.60
      expect(registry.reduceMultiplier(container, 'getAttackerDamageMod', ctx)).toBeCloseTo(0.6);
    });

    it('仅注册 attack_up 时，attack_down 不参与计算', () => {
      const singleRegistry = new EffectHandlerRegistry();
      singleRegistry.register(attackUpHandler);
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('attack_down', 50, 3, { stackStrategy: 'independent' }));
      // attack_down 未注册 → 倍率 1.0
      expect(singleRegistry.reduceMultiplier(container, 'getAttackerDamageMod', ctx)).toBe(1.0);
    });

    it('tickAll 不触发 onRemove 之外的副作用（attack_down 无 onRemove）', () => {
      const onRemoveSpy = vi.fn();
      const customRegistry = new EffectHandlerRegistry();
      // 注册一个带 onRemove 的自定义 attack_down 处理器以验证容器清理逻辑
      customRegistry.register({
        type: 'attack_down',
        onRemove: onRemoveSpy,
        getAttackerDamageMod: attackDownHandler.getAttackerDamageMod,
      });
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('attack_down', 50, 1));
      const result = customRegistry.tickAll(container, ctx);
      expect(result.expiredIds).toHaveLength(1);
      expect(onRemoveSpy).toHaveBeenCalledTimes(1);
    });
  });
});
