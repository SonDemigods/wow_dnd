/**
 * @fileoverview speedMod 处理器独立单元测试 — speed_up / speed_down
 * @description 覆盖：
 * 1. getSpeedMod 直接方法测试（含边界值 0/正数/负数符号）
 * 2. 生命周期钩子存在性断言（仅 getSpeedMod 定义）
 * 3. 叠加规则（max/independent/replace）
 * 4. registry 集成端到端测试（reduceSum）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EffectHandlerRegistry } from '@/modules/combat/effects/handler';
import { speedUpHandler, speedDownHandler } from '@/modules/combat/effects/handlers/speedMod';
import { freezeHandler } from '@/modules/combat/effects/handlers/control';
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
// speedUpHandler — 速度上升
// ============================================================

describe('speedUpHandler', () => {
  const ctx = makeCtx();

  describe('直接方法测试 — getSpeedMod', () => {
    it('value=10 → 返回 10（正值加速）', () => {
      const eff = makeEffect('speed_up', 10, 3);
      expect(speedUpHandler.getSpeedMod!(eff)).toBe(10);
    });

    it('value=0 → 返回 0', () => {
      const eff = makeEffect('speed_up', 0, 3);
      expect(speedUpHandler.getSpeedMod!(eff)).toBe(0);
    });

    it('value=1 → 返回 1', () => {
      const eff = makeEffect('speed_up', 1, 3);
      expect(speedUpHandler.getSpeedMod!(eff)).toBe(1);
    });

    it('大值 value=100 → 返回 100', () => {
      const eff = makeEffect('speed_up', 100, 3);
      expect(speedUpHandler.getSpeedMod!(eff)).toBe(100);
    });

    it('value=15 → 返回 15（与 baseStats.speed 相同）', () => {
      const eff = makeEffect('speed_up', 15, 3);
      expect(speedUpHandler.getSpeedMod!(eff)).toBe(15);
    });

    it('type 字段为 speed_up', () => {
      expect(speedUpHandler.type).toBe('speed_up');
    });
  });

  describe('生命周期钩子验证', () => {
    it('onApply 未定义', () => {
      expect(speedUpHandler.onApply).toBeUndefined();
    });

    it('onTick 未定义', () => {
      expect(speedUpHandler.onTick).toBeUndefined();
    });

    it('onRemove 未定义', () => {
      expect(speedUpHandler.onRemove).toBeUndefined();
    });

    it('getSpeedMod 已定义（速度修正核心方法）', () => {
      expect(speedUpHandler.getSpeedMod).toBeDefined();
    });

    it('getAttackerDamageMod 未定义', () => {
      expect(speedUpHandler.getAttackerDamageMod).toBeUndefined();
    });
  });

  describe('叠加规则', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(speedUpHandler);
    });

    it('max 策略（默认）：取最大 value', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('speed_up', 5, 2));
      addEffectToContainer(container, makeEffect('speed_up', 15, 4));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(15);
      expect(container.effects[0].remainingTurns).toBe(4);
      expect(registry.reduceSum(container, 'getSpeedMod', ctx)).toBe(15);
    });

    it('independent 策略：多个 speed_up 累加', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('speed_up', 10, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('speed_up', 5, 3, { stackStrategy: 'independent' }));
      expect(container.effects).toHaveLength(2);
      // 10 + 5 = 15
      expect(registry.reduceSum(container, 'getSpeedMod', ctx)).toBe(15);
    });

    it('replace 策略：替换旧 speed_up', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('speed_up', 20, 5));
      addEffectToContainer(container, makeEffect('speed_up', 8, 2, { stackStrategy: 'replace' }));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(8);
      expect(container.effects[0].remainingTurns).toBe(2);
    });
  });

  describe('registry 集成', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(speedUpHandler);
    });

    it('注册后可通过 get 获取', () => {
      expect(registry.get('speed_up')).toBe(speedUpHandler);
    });

    it('空容器 reduceSum 返回 0', () => {
      const container = createEmptyContainer();
      expect(registry.reduceSum(container, 'getSpeedMod', ctx)).toBe(0);
    });

    it('单个 speed_up 端到端', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('speed_up', 15, 3));
      expect(registry.reduceSum(container, 'getSpeedMod', ctx)).toBe(15);
    });

    it('tickAll 推进 speed_up 不产生 dotDamage', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('speed_up', 15, 3));
      const result = registry.tickAll(container, ctx);
      expect(result.dotDamage).toBe(0);
      expect(result.regenAmount).toBe(0);
      expect(container.effects[0].remainingTurns).toBe(2);
    });

    it('speed_up 过期后从容器移除', () => {
      const container = createEmptyContainer();
      const eff = makeEffect('speed_up', 15, 1);
      addEffectToContainer(container, eff);
      const result = registry.tickAll(container, ctx);
      expect(result.expiredIds).toEqual([eff.id]);
      expect(container.effects).toHaveLength(0);
    });
  });
});

// ============================================================
// speedDownHandler — 速度下降
// ============================================================

describe('speedDownHandler', () => {
  const ctx = makeCtx();

  describe('直接方法测试 — getSpeedMod', () => {
    it('value=8 → 返回 -8（负值减速）', () => {
      const eff = makeEffect('speed_down', 8, 3);
      expect(speedDownHandler.getSpeedMod!(eff)).toBe(-8);
    });

    it('value=0 → 返回 -0（JS 一元负号对 0 的行为）', () => {
      // -effect.value 当 value=0 时返回 -0（JS 规范）
      // -0 === 0 为 true，但 Object.is(-0, 0) 为 false
      const eff = makeEffect('speed_down', 0, 3);
      const result = speedDownHandler.getSpeedMod!(eff);
      expect(result === 0).toBe(true); // 宽松相等
      expect(Object.is(result, -0)).toBe(true); // 精确类型
    });

    it('value=1 → 返回 -1', () => {
      const eff = makeEffect('speed_down', 1, 3);
      expect(speedDownHandler.getSpeedMod!(eff)).toBe(-1);
    });

    it('value=15 → 返回 -15', () => {
      const eff = makeEffect('speed_down', 15, 3);
      expect(speedDownHandler.getSpeedMod!(eff)).toBe(-15);
    });

    it('大值 value=100 → 返回 -100', () => {
      const eff = makeEffect('speed_down', 100, 3);
      expect(speedDownHandler.getSpeedMod!(eff)).toBe(-100);
    });

    it('type 字段为 speed_down', () => {
      expect(speedDownHandler.type).toBe('speed_down');
    });
  });

  describe('生命周期钩子验证', () => {
    it('onApply 未定义', () => {
      expect(speedDownHandler.onApply).toBeUndefined();
    });

    it('onTick 未定义', () => {
      expect(speedDownHandler.onTick).toBeUndefined();
    });

    it('onRemove 未定义', () => {
      expect(speedDownHandler.onRemove).toBeUndefined();
    });

    it('getSpeedMod 已定义', () => {
      expect(speedDownHandler.getSpeedMod).toBeDefined();
    });
  });

  describe('叠加规则', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(speedDownHandler);
    });

    it('max 策略：取较大 value（减速更轻者胜出）', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('speed_down', 10, 2));
      addEffectToContainer(container, makeEffect('speed_down', 5, 4));
      // max 取 value=10
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(10);
      expect(container.effects[0].remainingTurns).toBe(4);
      // getSpeedMod = -10
      expect(registry.reduceSum(container, 'getSpeedMod', ctx)).toBe(-10);
    });

    it('independent 策略：多个 speed_down 累加', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('speed_down', 5, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('speed_down', 10, 3, { stackStrategy: 'independent' }));
      // -5 + -10 = -15
      expect(registry.reduceSum(container, 'getSpeedMod', ctx)).toBe(-15);
    });

    it('replace 策略：替换旧 speed_down', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('speed_down', 20, 5));
      addEffectToContainer(container, makeEffect('speed_down', 5, 2, { stackStrategy: 'replace' }));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(5);
    });
  });

  describe('registry 集成', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(speedUpHandler);
      registry.register(speedDownHandler);
    });

    it('speed_up + speed_down 混合累加', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('speed_up', 10, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('speed_down', 5, 3, { stackStrategy: 'independent' }));
      // 10 + (-5) = 5
      expect(registry.reduceSum(container, 'getSpeedMod', ctx)).toBe(5);
    });

    it('speed_down + freeze 混合累加（freeze 固定 -10）', () => {
      const mixedRegistry = new EffectHandlerRegistry();
      mixedRegistry.register(speedDownHandler);
      mixedRegistry.register(freezeHandler);
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('speed_down', 5, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('freeze', 0, 3, { stackStrategy: 'independent' }));
      // -5 + -10 = -15
      expect(mixedRegistry.reduceSum(container, 'getSpeedMod', ctx)).toBe(-15);
    });

    it('tickAll 推进 speed_down 后修正值不变', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('speed_down', 8, 3));
      registry.tickAll(container, ctx);
      expect(container.effects[0].remainingTurns).toBe(2);
      expect(registry.reduceSum(container, 'getSpeedMod', ctx)).toBe(-8);
    });

    it('speed_down 过期后从容器移除', () => {
      const container = createEmptyContainer();
      const eff = makeEffect('speed_down', 8, 1);
      addEffectToContainer(container, eff);
      const result = registry.tickAll(container, ctx);
      expect(result.expiredIds).toEqual([eff.id]);
      expect(container.effects).toHaveLength(0);
    });
  });
});
