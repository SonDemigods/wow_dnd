/**
 * @fileoverview regen 处理器独立单元测试 — regen
 * @description 覆盖：
 * 1. onTick 直接方法测试（含边界值 0/正数/大值）
 * 2. 生命周期钩子存在性断言（仅 onTick 定义）
 * 3. 叠加规则（max/independent/replace）
 * 4. registry 集成端到端测试（tickAll）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EffectHandlerRegistry } from '@/modules/combat/effects/handler';
import { regenHandler } from '@/modules/combat/effects/handlers/regen';
import { poisonHandler } from '@/modules/combat/effects/handlers/dot';
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
// regenHandler — 恢复
// ============================================================

describe('regenHandler', () => {
  const ctx = makeCtx();

  describe('直接方法测试 — onTick', () => {
    it('value=12 → regenAmount=12, dotDamage=0', () => {
      const eff = makeEffect('regen', 12, 3);
      expect(regenHandler.onTick!(eff, ctx)).toEqual({ dotDamage: 0, regenAmount: 12 });
    });

    it('value=0 → regenAmount=0', () => {
      const eff = makeEffect('regen', 0, 3);
      expect(regenHandler.onTick!(eff, ctx).regenAmount).toBe(0);
    });

    it('value=1 → regenAmount=1（无倍率）', () => {
      const eff = makeEffect('regen', 1, 3);
      expect(regenHandler.onTick!(eff, ctx).regenAmount).toBe(1);
    });

    it('大值 value=999 → regenAmount=999', () => {
      const eff = makeEffect('regen', 999, 3);
      expect(regenHandler.onTick!(eff, ctx).regenAmount).toBe(999);
    });

    it('dotDamage 始终为 0（regen 不造成伤害）', () => {
      const eff = makeEffect('regen', 50, 3);
      expect(regenHandler.onTick!(eff, ctx).dotDamage).toBe(0);
    });

    it('value=5 → regenAmount=5', () => {
      const eff = makeEffect('regen', 5, 3);
      expect(regenHandler.onTick!(eff, ctx).regenAmount).toBe(5);
    });

    it('type 字段为 regen', () => {
      expect(regenHandler.type).toBe('regen');
    });
  });

  describe('生命周期钩子验证', () => {
    it('onTick 已定义（持续恢复核心钩子）', () => {
      expect(regenHandler.onTick).toBeDefined();
    });

    it('onApply 未定义', () => {
      expect(regenHandler.onApply).toBeUndefined();
    });

    it('onRemove 未定义', () => {
      expect(regenHandler.onRemove).toBeUndefined();
    });

    it('getAttackerDamageMod 未定义', () => {
      expect(regenHandler.getAttackerDamageMod).toBeUndefined();
    });

    it('getDefenderDamageMod 未定义', () => {
      expect(regenHandler.getDefenderDamageMod).toBeUndefined();
    });

    it('getSpeedMod 未定义', () => {
      expect(regenHandler.getSpeedMod).toBeUndefined();
    });
  });

  describe('叠加规则', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(regenHandler);
    });

    it('max 策略（默认）：取最大 value 与最大 remainingTurns', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('regen', 5, 2));
      addEffectToContainer(container, makeEffect('regen', 12, 4));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(12);
      expect(container.effects[0].remainingTurns).toBe(4);
      const result = registry.tickAll(container, ctx);
      expect(result.regenAmount).toBe(12);
    });

    it('max 策略：新效果值更小时保留旧值', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('regen', 20, 4));
      addEffectToContainer(container, makeEffect('regen', 5, 2));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(20);
      expect(container.effects[0].remainingTurns).toBe(4);
    });

    it('independent 策略：多个 regen 独立存在，tickAll 累加恢复', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('regen', 5, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('regen', 8, 3, { stackStrategy: 'independent' }));
      expect(container.effects).toHaveLength(2);
      const result = registry.tickAll(container, ctx);
      // 5 + 8 = 13
      expect(result.regenAmount).toBe(13);
    });

    it('replace 策略：替换旧 regen', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('regen', 20, 5));
      addEffectToContainer(container, makeEffect('regen', 5, 2, { stackStrategy: 'replace' }));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].value).toBe(5);
      expect(container.effects[0].remainingTurns).toBe(2);
    });
  });

  describe('registry 集成', () => {
    let registry: EffectHandlerRegistry;

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(regenHandler);
    });

    it('注册后可通过 get 获取', () => {
      expect(registry.get('regen')).toBe(regenHandler);
    });

    it('空容器 tickAll 返回零值', () => {
      const container = createEmptyContainer();
      const result = registry.tickAll(container, ctx);
      expect(result.regenAmount).toBe(0);
      expect(result.dotDamage).toBe(0);
    });

    it('单个 regen 端到端 tickAll', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('regen', 8, 2));
      const result = registry.tickAll(container, ctx);
      expect(result.regenAmount).toBe(8);
      expect(result.dotDamage).toBe(0);
      expect(container.effects[0].remainingTurns).toBe(1);
    });

    it('regen 过期时触发 onRemove 并清理', () => {
      const onRemove = vi.fn();
      const customRegistry = new EffectHandlerRegistry();
      customRegistry.register({
        type: 'regen',
        onTick: regenHandler.onTick,
        onRemove,
      });
      const container = createEmptyContainer();
      const eff = makeEffect('regen', 5, 1);
      addEffectToContainer(container, eff);
      const result = customRegistry.tickAll(container, ctx);
      expect(result.expiredIds).toEqual([eff.id]);
      expect(onRemove).toHaveBeenCalledTimes(1);
      expect(container.effects).toHaveLength(0);
    });

    it('多回合推进：value 不变，remainingTurns 递减', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('regen', 8, 3));
      registry.tickAll(container, ctx);
      expect(container.effects[0].value).toBe(8);
      expect(container.effects[0].remainingTurns).toBe(2);
      registry.tickAll(container, ctx);
      expect(container.effects[0].value).toBe(8);
      expect(container.effects[0].remainingTurns).toBe(1);
    });

    it('regen + poison 同时存在：dotDamage 与 regenAmount 各自累加', () => {
      const mixedRegistry = new EffectHandlerRegistry();
      mixedRegistry.register(regenHandler);
      mixedRegistry.register(poisonHandler);
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('regen', 8, 3, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('poison', 5, 3, { stackStrategy: 'independent' }));
      const result = mixedRegistry.tickAll(container, ctx);
      expect(result.regenAmount).toBe(8);
      expect(result.dotDamage).toBe(5);
    });
  });
});
