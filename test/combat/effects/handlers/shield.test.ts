/**
 * @fileoverview shield 处理器独立单元测试 — shield
 * @description 覆盖：
 * 1. getDamageAbsorb 直接方法测试（含边界值 0/正数/大值/护盾耗尽）
 * 2. 生命周期钩子存在性断言（仅 getDamageAbsorb 定义）
 * 3. 叠加规则（max/independent/replace）
 * 4. registry 集成端到端测试（reduceSum）
 *
 * 注意：shield 的 getDamageAbsorb 会修改 effect.value（扣减护盾余量）。
 * 在 registry.reduceSum 中，incomingDamage 参数对所有 effect 是同一个固定值，
 * 因此多个 shield 的累计吸收可能超过 incomingDamage（这是源码的实际行为）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EffectHandlerRegistry } from '@/modules/combat/effects/handler';
import { shieldHandler } from '@/modules/combat/effects/handlers/shield';
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
// shieldHandler — 护盾
// ============================================================

describe('shieldHandler', () => {
  const ctx = makeCtx();

  describe('直接方法测试 — getDamageAbsorb', () => {
    it('吸收量不超过 incomingDamage（shield > incoming）', () => {
      const eff = makeEffect('shield', 100, 3);
      expect(shieldHandler.getDamageAbsorb!(eff, 30)).toBe(30);
    });

    it('吸收量不超过 effect.value（shield < incoming）', () => {
      const eff = makeEffect('shield', 20, 3);
      expect(shieldHandler.getDamageAbsorb!(eff, 50)).toBe(20);
    });

    it('吸收后扣减 effect.value', () => {
      const eff = makeEffect('shield', 50, 3);
      shieldHandler.getDamageAbsorb!(eff, 30);
      expect(eff.value).toBe(20);
    });

    it('护盾耗尽后 value=0', () => {
      const eff = makeEffect('shield', 10, 3);
      shieldHandler.getDamageAbsorb!(eff, 30);
      expect(eff.value).toBe(0);
    });

    it('incomingDamage=0 时吸收 0，护盾值不变', () => {
      const eff = makeEffect('shield', 100, 3);
      expect(shieldHandler.getDamageAbsorb!(eff, 0)).toBe(0);
      expect(eff.value).toBe(100);
    });

    it('value=0 时吸收 0', () => {
      const eff = makeEffect('shield', 0, 3);
      expect(shieldHandler.getDamageAbsorb!(eff, 50)).toBe(0);
      expect(eff.value).toBe(0);
    });

    it('value=incomingDamage 时全部吸收', () => {
      const eff = makeEffect('shield', 50, 3);
      expect(shieldHandler.getDamageAbsorb!(eff, 50)).toBe(50);
      expect(eff.value).toBe(0);
    });

    it('大值护盾 value=10000, incoming=100 → 吸收 100', () => {
      const eff = makeEffect('shield', 10000, 3);
      expect(shieldHandler.getDamageAbsorb!(eff, 100)).toBe(100);
      expect(eff.value).toBe(9900);
    });

    it('type 字段为 shield', () => {
      expect(shieldHandler.type).toBe('shield');
    });
  });

  describe('生命周期钩子验证', () => {
    it('onApply 未定义', () => {
      expect(shieldHandler.onApply).toBeUndefined();
    });

    it('onTick 未定义（护盾不是持续效果）', () => {
      expect(shieldHandler.onTick).toBeUndefined();
    });

    it('onRemove 未定义', () => {
      expect(shieldHandler.onRemove).toBeUndefined();
    });

    it('getAttackerDamageMod 未定义', () => {
      expect(shieldHandler.getAttackerDamageMod).toBeUndefined();
    });

    it('getDefenderDamageMod 未定义', () => {
      expect(shieldHandler.getDefenderDamageMod).toBeUndefined();
    });

    it('getDamageAbsorb 已定义（护盾核心方法）', () => {
      expect(shieldHandler.getDamageAbsorb).toBeDefined();
    });
  });

  describe('叠加规则', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(shieldHandler);
    });

    it('max 策略（默认）：取最大 value 与最大 remainingTurns', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('shield', 30, 2));
      addEffectToContainer(container, makeEffect('shield', 50, 4));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(50);
      expect(container.effects[0].remainingTurns).toBe(4);
      // 单个护盾吸收不超过 incomingDamage
      expect(registry.reduceSum(container, 'getDamageAbsorb', ctx, 40)).toBe(40);
    });

    it('max 策略：新护盾值更小时保留旧值', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('shield', 80, 4));
      addEffectToContainer(container, makeEffect('shield', 20, 2));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(80);
      expect(container.effects[0].remainingTurns).toBe(4);
    });

    it('independent 策略：多个 shield 独立存在，reduceSum 累加吸收', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('shield', 20, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('shield', 30, 3, { stackStrategy: 'independent' }));
      expect(container.effects).toHaveLength(2);
      // incoming=60, 20 + 30 = 50（每个 shield 都用同一 incoming=60 调用）
      expect(registry.reduceSum(container, 'getDamageAbsorb', ctx, 60)).toBe(50);
    });

    it('replace 策略：替换旧 shield', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('shield', 80, 5));
      addEffectToContainer(container, makeEffect('shield', 30, 2, { stackStrategy: 'replace' }));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(30);
      expect(container.effects[0].remainingTurns).toBe(2);
    });
  });

  describe('registry 集成', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(shieldHandler);
    });

    it('注册后可通过 get 获取', () => {
      expect(registry.get('shield')).toBe(shieldHandler);
    });

    it('空容器 reduceSum 返回 0', () => {
      const container = createEmptyContainer();
      expect(registry.reduceSum(container, 'getDamageAbsorb', ctx, 50)).toBe(0);
    });

    it('单个 shield 端到端：吸收并扣减 value', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('shield', 100, 3));
      const absorbed = registry.reduceSum(container, 'getDamageAbsorb', ctx, 30);
      expect(absorbed).toBe(30);
      expect(container.effects[0].value).toBe(70);
    });

    it('shield 耗尽后 value=0', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('shield', 30, 3));
      const absorbed = registry.reduceSum(container, 'getDamageAbsorb', ctx, 50);
      expect(absorbed).toBe(30);
      expect(container.effects[0].value).toBe(0);
    });

    it('多个 independent shield 累加吸收（incoming 充足时）', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('shield', 20, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('shield', 30, 3, { stackStrategy: 'independent' }));
      // incoming=60 ≥ 20+30=50，两个 shield 各自吸收其 value 上限
      const absorbed = registry.reduceSum(container, 'getDamageAbsorb', ctx, 60);
      expect(absorbed).toBe(50);
      // 两个 shield 都耗尽
      expect(container.effects[0].value).toBe(0);
      expect(container.effects[1].value).toBe(0);
    });

    it('tickAll 推进 shield 不产生 dotDamage（无 onTick）', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('shield', 50, 3));
      const result = registry.tickAll(container, ctx);
      expect(result.dotDamage).toBe(0);
      expect(result.regenAmount).toBe(0);
      expect(container.effects[0].remainingTurns).toBe(2);
      // value 不受 tickAll 影响
      expect(container.effects[0].value).toBe(50);
    });

    it('shield 过期后从容器移除', () => {
      const container = createEmptyContainer();
      const eff = makeEffect('shield', 50, 1);
      addEffectToContainer(container, eff);
      const result = registry.tickAll(container, ctx);
      expect(result.expiredIds).toEqual([eff.id]);
      expect(container.effects).toHaveLength(0);
    });
  });
});
