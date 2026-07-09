/**
 * @fileoverview control 处理器独立单元测试 — stun / freeze / silence
 * @description 覆盖：
 * 1. getDisabledActions / getSpeedMod 直接方法测试
 * 2. 生命周期钩子存在性断言
 * 3. 叠加规则（max/independent/replace）
 * 4. registry 集成端到端测试（getDisabledActions / reduceSum）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EffectHandlerRegistry } from '@/modules/combat/effects/handler';
import { stunHandler, freezeHandler, silenceHandler } from '@/modules/combat/effects/handlers/control';
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
// stunHandler — 眩晕
// ============================================================

describe('stunHandler', () => {
  describe('直接方法测试 — getDisabledActions', () => {
    it('禁用全部 3 种行动（attack/skill/flee）', () => {
      const eff = makeEffect('stun', 0, 2);
      expect(stunHandler.getDisabledActions!(eff)).toEqual(['attack', 'skill', 'flee']);
    });

    it('禁用列表长度为 3', () => {
      const eff = makeEffect('stun', 0, 2);
      expect(stunHandler.getDisabledActions!(eff)).toHaveLength(3);
    });

    it('value 不影响禁用列表（控制效果忽略数值）', () => {
      const effLow = makeEffect('stun', 0, 2);
      const effHigh = makeEffect('stun', 999, 2);
      expect(stunHandler.getDisabledActions!(effLow)).toEqual(stunHandler.getDisabledActions!(effHigh));
    });

    it('type 字段为 stun', () => {
      expect(stunHandler.type).toBe('stun');
    });
  });

  describe('生命周期钩子验证', () => {
    it('onApply 未定义', () => {
      expect(stunHandler.onApply).toBeUndefined();
    });

    it('onTick 未定义', () => {
      expect(stunHandler.onTick).toBeUndefined();
    });

    it('onRemove 未定义', () => {
      expect(stunHandler.onRemove).toBeUndefined();
    });

    it('getSpeedMod 未定义（stun 不影响速度）', () => {
      expect(stunHandler.getSpeedMod).toBeUndefined();
    });

    it('getAttackerDamageMod 未定义', () => {
      expect(stunHandler.getAttackerDamageMod).toBeUndefined();
    });
  });

  describe('叠加规则', () => {
    it('max 策略（默认）：同类型 stun 合并为单个', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('stun', 0, 2));
      addEffectToContainer(container, makeEffect('stun', 0, 4));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].remainingTurns).toBe(4);
    });

    it('independent 策略：多个 stun 独立存在', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('stun', 0, 2, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('stun', 0, 3, { stackStrategy: 'independent' }));
      expect(container.effects).toHaveLength(2);
    });

    it('replace 策略：替换旧 stun', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('stun', 0, 5));
      addEffectToContainer(container, makeEffect('stun', 0, 2, { stackStrategy: 'replace' }));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].remainingTurns).toBe(2);
    });
  });

  describe('registry 集成', () => {
    let registry: EffectHandlerRegistry;
    const ctx = makeCtx();

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(stunHandler);
    });

    it('单个 stun 触发 skipTurn=true', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('stun', 0, 2));
      const result = registry.getDisabledActions(container);
      expect(result.skipTurn).toBe(true);
      expect(result.types).toEqual(['attack', 'skill', 'flee']);
    });

    it('tickAll 推进 stun 不产生 dotDamage', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('stun', 0, 2));
      const result = registry.tickAll(container, ctx);
      expect(result.dotDamage).toBe(0);
      expect(result.regenAmount).toBe(0);
      expect(container.effects[0].remainingTurns).toBe(1);
    });

    it('stun 过期后 skipTurn 恢复 false', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('stun', 0, 1));
      registry.tickAll(container, ctx);
      // stun 已过期被清理
      expect(container.effects).toHaveLength(0);
      const result = registry.getDisabledActions(container);
      expect(result.skipTurn).toBe(false);
    });
  });
});

// ============================================================
// freezeHandler — 冰冻
// ============================================================

describe('freezeHandler', () => {
  describe('直接方法测试', () => {
    it('getDisabledActions 禁用全部 3 种行动', () => {
      const eff = makeEffect('freeze', 0, 2);
      expect(freezeHandler.getDisabledActions!(eff)).toEqual(['attack', 'skill', 'flee']);
    });

    it('getSpeedMod 固定返回 -10（不依赖 effect.value）', () => {
      const effLow = makeEffect('freeze', 0, 2);
      const effHigh = makeEffect('freeze', 999, 2);
      expect(freezeHandler.getSpeedMod!(effLow)).toBe(-10);
      expect(freezeHandler.getSpeedMod!(effHigh)).toBe(-10);
    });

    it('type 字段为 freeze', () => {
      expect(freezeHandler.type).toBe('freeze');
    });
  });

  describe('生命周期钩子验证', () => {
    it('onApply 未定义', () => {
      expect(freezeHandler.onApply).toBeUndefined();
    });

    it('onTick 未定义', () => {
      expect(freezeHandler.onTick).toBeUndefined();
    });

    it('onRemove 未定义', () => {
      expect(freezeHandler.onRemove).toBeUndefined();
    });

    it('getSpeedMod 已定义（freeze 特有：减速）', () => {
      expect(freezeHandler.getSpeedMod).toBeDefined();
    });

    it('getAttackerDamageMod 未定义', () => {
      expect(freezeHandler.getAttackerDamageMod).toBeUndefined();
    });
  });

  describe('叠加规则', () => {
    it('max 策略：取较大 remainingTurns（value 都为 0 不变）', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('freeze', 0, 2));
      addEffectToContainer(container, makeEffect('freeze', 0, 5));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].remainingTurns).toBe(5);
    });

    it('independent 策略：多个 freeze 独立存在', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('freeze', 0, 2, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('freeze', 0, 3, { stackStrategy: 'independent' }));
      expect(container.effects).toHaveLength(2);
    });

    it('replace 策略：替换旧 freeze', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('freeze', 0, 5));
      addEffectToContainer(container, makeEffect('freeze', 0, 2, { stackStrategy: 'replace' }));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].remainingTurns).toBe(2);
    });
  });

  describe('registry 集成', () => {
    let registry: EffectHandlerRegistry;
    const ctx = makeCtx();

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(freezeHandler);
    });

    it('单个 freeze 触发 skipTurn=true', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('freeze', 0, 2));
      const result = registry.getDisabledActions(container);
      expect(result.skipTurn).toBe(true);
    });

    it('freeze 的 getSpeedMod 通过 reduceSum 累加返回 -10', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('freeze', 0, 2));
      expect(registry.reduceSum(container, 'getSpeedMod', ctx)).toBe(-10);
    });

    it('多个 independent freeze 速度累加（-10 × 2 = -20）', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('freeze', 0, 2, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('freeze', 0, 2, { stackStrategy: 'independent' }));
      expect(registry.reduceSum(container, 'getSpeedMod', ctx)).toBe(-20);
    });

    it('freeze 过期后从容器移除', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('freeze', 0, 1));
      const result = registry.tickAll(container, ctx);
      expect(result.expiredIds).toHaveLength(1);
      expect(container.effects).toHaveLength(0);
    });
  });
});

// ============================================================
// silenceHandler — 沉默
// ============================================================

describe('silenceHandler', () => {
  describe('直接方法测试 — getDisabledActions', () => {
    it('仅禁用 skill', () => {
      const eff = makeEffect('silence', 0, 2);
      expect(silenceHandler.getDisabledActions!(eff)).toEqual(['skill']);
    });

    it('不禁用 attack 和 flee', () => {
      const eff = makeEffect('silence', 0, 2);
      const types = silenceHandler.getDisabledActions!(eff);
      expect(types).not.toContain('attack');
      expect(types).not.toContain('flee');
    });

    it('禁用列表长度为 1', () => {
      const eff = makeEffect('silence', 0, 2);
      expect(silenceHandler.getDisabledActions!(eff)).toHaveLength(1);
    });

    it('type 字段为 silence', () => {
      expect(silenceHandler.type).toBe('silence');
    });
  });

  describe('生命周期钩子验证', () => {
    it('onApply 未定义', () => {
      expect(silenceHandler.onApply).toBeUndefined();
    });

    it('onTick 未定义', () => {
      expect(silenceHandler.onTick).toBeUndefined();
    });

    it('onRemove 未定义', () => {
      expect(silenceHandler.onRemove).toBeUndefined();
    });

    it('getSpeedMod 未定义（silence 不影响速度）', () => {
      expect(silenceHandler.getSpeedMod).toBeUndefined();
    });
  });

  describe('叠加规则', () => {
    it('max 策略：多个 silence 合并为单个', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('silence', 0, 2));
      addEffectToContainer(container, makeEffect('silence', 0, 4));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].remainingTurns).toBe(4);
    });

    it('independent 策略：多个 silence 独立存在', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('silence', 0, 2, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('silence', 0, 3, { stackStrategy: 'independent' }));
      expect(container.effects).toHaveLength(2);
    });

    it('replace 策略：替换旧 silence', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('silence', 0, 5));
      addEffectToContainer(container, makeEffect('silence', 0, 1, { stackStrategy: 'replace' }));
      expect(container.effects).toHaveLength(1);
      expect(container.effects[0].remainingTurns).toBe(1);
    });
  });

  describe('registry 集成', () => {
    let registry: EffectHandlerRegistry;
    const ctx = makeCtx();

    beforeEach(() => {
      registry = new EffectHandlerRegistry();
      registry.register(silenceHandler);
      registry.register(stunHandler);
    });

    it('单个 silence 不触发 skipTurn（attack/flee 未禁用）', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('silence', 0, 2));
      const result = registry.getDisabledActions(container);
      expect(result.skipTurn).toBe(false);
      expect(result.types).toEqual(['skill']);
    });

    it('silence + stun 合并后 skipTurn=true', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('silence', 0, 2, { stackStrategy: 'independent' }));
      addEffectToContainer(container, makeEffect('stun', 0, 2, { stackStrategy: 'independent' }));
      const result = registry.getDisabledActions(container);
      expect(result.skipTurn).toBe(true);
      expect(result.types).toEqual(expect.arrayContaining(['attack', 'skill', 'flee']));
    });

    it('silence tickAll 不产生伤害', () => {
      const container = createEmptyContainer();
      addEffectToContainer(container, makeEffect('silence', 0, 2));
      const result = registry.tickAll(container, ctx);
      expect(result.dotDamage).toBe(0);
      expect(result.regenAmount).toBe(0);
    });
  });
});
