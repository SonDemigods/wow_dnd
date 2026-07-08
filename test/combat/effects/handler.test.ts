/**
 * @fileoverview EffectHandlerRegistry 注册表与 15 种内置效果处理器单元测试
 * @description 覆盖：
 * 1. 注册表基础 API：register / registerAll / get / registeredCount（含覆盖警告）
 * 2. reduceMultiplier：累乘攻击方/防御方修正
 * 3. reduceSum：累加护盾吸收 / 荆棘反伤 / 速度修正
 * 4. tickAll：推进回合、累计 dot/regen、过期清理、onRemove 钩子
 * 5. getDisabledActions：合并禁用类型 + skipTurn 自动判定
 * 6. 15 种内置处理器：poison / burn / stun / freeze / silence / shield /
 *    attack_up / attack_down / defense_up / defense_down / vulnerable /
 *    speed_up / speed_down / regen / thorn
 * 7. createDefaultRegistry：默认注册全部 15 种处理器
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EffectHandlerRegistry } from '@/modules/combat/effects/handler';
import type { EffectHandler, ActionType } from '@/modules/combat/effects/handler';
import { createDefaultRegistry } from '@/modules/combat/effects/handlers';
import {
  poisonHandler,
  burnHandler,
} from '@/modules/combat/effects/handlers/dot';
import { stunHandler, freezeHandler, silenceHandler } from '@/modules/combat/effects/handlers/control';
import { shieldHandler } from '@/modules/combat/effects/handlers/shield';
import { attackUpHandler, attackDownHandler } from '@/modules/combat/effects/handlers/attackMod';
import {
  defenseUpHandler,
  defenseDownHandler,
  vulnerableHandler,
} from '@/modules/combat/effects/handlers/defenseMod';
import { speedUpHandler, speedDownHandler } from '@/modules/combat/effects/handlers/speedMod';
import { regenHandler } from '@/modules/combat/effects/handlers/regen';
import { thornHandler } from '@/modules/combat/effects/handlers/thorn';
import { createEmptyContainer, addEffectToContainer } from '@/modules/combat/effects/container';
import type { Effect, EffectContainer, EffectContext, EffectType } from '@/modules/combat/effects/types';

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

/** 构造一个自定义处理器（用于注册表 API 测试） */
function makeHandler(type: EffectType, extra: Partial<EffectHandler> = {}): EffectHandler {
  return { type, ...extra } as EffectHandler;
}

// ============================================================
// 注册表 API
// ============================================================

describe('EffectHandlerRegistry 注册表 API', () => {
  let registry: EffectHandlerRegistry;

  beforeEach(() => {
    registry = new EffectHandlerRegistry();
  });

  it('register 注册后可通过 get 获取', () => {
    const handler = makeHandler('poison', { onTick: () => ({ dotDamage: 5, regenAmount: 0 }) });
    registry.register(handler);
    expect(registry.get('poison')).toBe(handler);
  });

  it('get 未注册的类型返回 undefined', () => {
    expect(registry.get('poison')).toBeUndefined();
  });

  it('registerAll 批量注册', () => {
    registry.registerAll([
      makeHandler('poison'),
      makeHandler('burn'),
      makeHandler('stun'),
    ]);
    expect(registry.registeredCount).toBe(3);
    expect(registry.get('poison')).toBeDefined();
    expect(registry.get('burn')).toBeDefined();
    expect(registry.get('stun')).toBeDefined();
  });

  it('register 覆盖已注册的类型会触发 console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registry.register(makeHandler('poison'));
    registry.register(makeHandler('poison'));
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('poison');
    warnSpy.mockRestore();
  });

  it('registeredCount 反映当前注册数量', () => {
    expect(registry.registeredCount).toBe(0);
    registry.register(makeHandler('poison'));
    expect(registry.registeredCount).toBe(1);
    registry.register(makeHandler('burn'));
    expect(registry.registeredCount).toBe(2);
  });

  it('createDefaultRegistry 注册全部 15 种内置处理器', () => {
    createDefaultRegistry(registry);
    expect(registry.registeredCount).toBe(15);
    const allTypes: EffectType[] = [
      'poison', 'burn', 'stun', 'freeze', 'silence',
      'shield', 'attack_up', 'attack_down', 'defense_up', 'defense_down',
      'vulnerable', 'speed_up', 'speed_down', 'regen', 'thorn',
    ];
    for (const t of allTypes) {
      expect(registry.get(t)).toBeDefined();
    }
  });
});

// ============================================================
// reduceMultiplier — 累乘伤害修正
// ============================================================

describe('reduceMultiplier — 累乘伤害修正', () => {
  let registry: EffectHandlerRegistry;
  let ctx: EffectContext;

  beforeEach(() => {
    registry = new EffectHandlerRegistry();
    ctx = makeCtx();
  });

  it('空容器返回 1.0', () => {
    const container = createEmptyContainer();
    expect(registry.reduceMultiplier(container, 'getAttackerDamageMod', ctx)).toBe(1.0);
    expect(registry.reduceMultiplier(container, 'getDefenderDamageMod', ctx)).toBe(1.0);
  });

  it('无处理器的效果不参与累乘（返回 1.0）', () => {
    const container = createEmptyContainer();
    addEffectToContainer(container, makeEffect('poison', 10, 3));
    // poison 未注册 getAttackerDamageMod，但注册表中也无 poison handler
    expect(registry.reduceMultiplier(container, 'getAttackerDamageMod', ctx)).toBe(1.0);
  });

  it('单个 attack_up（+18%）累乘 = 1.18', () => {
    registry.register(attackUpHandler);
    const container = createEmptyContainer();
    addEffectToContainer(container, makeEffect('attack_up', 18, 3));
    expect(registry.reduceMultiplier(container, 'getAttackerDamageMod', ctx)).toBeCloseTo(1.18);
  });

  it('多个攻击修正累乘（+18% × +20% = 1.416）', () => {
    registry.register(attackUpHandler);
    const container = createEmptyContainer();
    // attack_up 默认 stackStrategy='max'，会合并 → 需用 independent 策略保持独立
    addEffectToContainer(container, makeEffect('attack_up', 18, 3, { stackStrategy: 'independent' }));
    addEffectToContainer(container, makeEffect('attack_up', 20, 3, { stackStrategy: 'independent' }));
    // 1.18 * 1.20 = 1.416
    expect(registry.reduceMultiplier(container, 'getAttackerDamageMod', ctx)).toBeCloseTo(1.416);
  });

  it('attack_up + attack_down 混合累乘', () => {
    registry.register(attackUpHandler);
    registry.register(attackDownHandler);
    const container = createEmptyContainer();
    addEffectToContainer(container, makeEffect('attack_up', 20, 3, { stackStrategy: 'independent' }));
    addEffectToContainer(container, makeEffect('attack_down', 50, 3, { stackStrategy: 'independent' }));
    // 1.20 * 0.50 = 0.60
    expect(registry.reduceMultiplier(container, 'getAttackerDamageMod', ctx)).toBeCloseTo(0.6);
  });

  it('防御方修正：defense_up + vulnerable 同时存在', () => {
    registry.register(defenseUpHandler);
    registry.register(vulnerableHandler);
    const container = createEmptyContainer();
    addEffectToContainer(container, makeEffect('defense_up', 20, 3, { stackStrategy: 'independent' }));
    addEffectToContainer(container, makeEffect('vulnerable', 20, 3, { stackStrategy: 'independent' }));
    // defense_up(20): max(0.05, 1 - 0.2) = 0.8
    // vulnerable(20): 1 + 20*1.5/100 = 1.3
    // 0.8 * 1.3 = 1.04
    expect(registry.reduceMultiplier(container, 'getDefenderDamageMod', ctx)).toBeCloseTo(1.04);
  });
});

// ============================================================
// reduceSum — 累加护盾/反伤/速度
// ============================================================

describe('reduceSum — 累加护盾/反伤/速度', () => {
  let registry: EffectHandlerRegistry;
  let ctx: EffectContext;

  beforeEach(() => {
    registry = new EffectHandlerRegistry();
    ctx = makeCtx();
  });

  it('空容器护盾吸收 = 0', () => {
    const container = createEmptyContainer();
    expect(registry.reduceSum(container, 'getDamageAbsorb', ctx, 50)).toBe(0);
  });

  it('单个护盾吸收不超过 incomingDamage', () => {
    registry.register(shieldHandler);
    const container = createEmptyContainer();
    addEffectToContainer(container, makeEffect('shield', 100, 3));
    // incoming=50, shield=100 → 吸收 50
    expect(registry.reduceSum(container, 'getDamageAbsorb', ctx, 50)).toBe(50);
  });

  it('护盾吸收会扣减 effect.value', () => {
    registry.register(shieldHandler);
    const container = createEmptyContainer();
    addEffectToContainer(container, makeEffect('shield', 30, 3));
    const absorbed = registry.reduceSum(container, 'getDamageAbsorb', ctx, 50);
    expect(absorbed).toBe(30);
    // 剩余护盾值 = 30 - 30 = 0
    expect(container.effects[0].value).toBe(0);
  });

  it('多个独立护盾累加吸收', () => {
    registry.register(shieldHandler);
    const container = createEmptyContainer();
    addEffectToContainer(container, makeEffect('shield', 20, 3, { stackStrategy: 'independent' }));
    addEffectToContainer(container, makeEffect('shield', 30, 3, { stackStrategy: 'independent' }));
    // 20 + 30 = 50, incoming=60 → 吸收 50
    expect(registry.reduceSum(container, 'getDamageAbsorb', ctx, 60)).toBe(50);
  });

  it('荆棘反伤累加', () => {
    registry.register(thornHandler);
    const container = createEmptyContainer();
    addEffectToContainer(container, makeEffect('thorn', 0.3, 3, { stackStrategy: 'independent' }));
    addEffectToContainer(container, makeEffect('thorn', 0.2, 3, { stackStrategy: 'independent' }));
    // round(100*0.3) + round(100*0.2) = 30 + 20 = 50
    expect(registry.reduceSum(container, 'getThornDamage', ctx, 100)).toBe(50);
  });

  it('速度修正累加（speed_up + speed_down）', () => {
    registry.register(speedUpHandler);
    registry.register(speedDownHandler);
    const container = createEmptyContainer();
    addEffectToContainer(container, makeEffect('speed_up', 10, 3, { stackStrategy: 'independent' }));
    addEffectToContainer(container, makeEffect('speed_down', 5, 3, { stackStrategy: 'independent' }));
    // 10 + (-5) = 5
    expect(registry.reduceSum(container, 'getSpeedMod', ctx)).toBe(5);
  });

  it('reduceSum getSpeedMod 不传 extra 参数也能正常工作', () => {
    registry.register(speedUpHandler);
    const container = createEmptyContainer();
    addEffectToContainer(container, makeEffect('speed_up', 15, 3));
    expect(registry.reduceSum(container, 'getSpeedMod', ctx)).toBe(15);
  });
});

// ============================================================
// tickAll — 回合推进
// ============================================================

describe('tickAll — 回合推进', () => {
  let registry: EffectHandlerRegistry;
  let ctx: EffectContext;

  beforeEach(() => {
    registry = new EffectHandlerRegistry();
    ctx = makeCtx();
  });

  it('空容器 tickAll 返回零值且无过期', () => {
    const container = createEmptyContainer();
    const result = registry.tickAll(container, ctx);
    expect(result.expiredIds).toHaveLength(0);
    expect(result.dotDamage).toBe(0);
    expect(result.regenAmount).toBe(0);
  });

  it('推进 poison 效果：累加 dotDamage', () => {
    registry.register(poisonHandler);
    const container = createEmptyContainer();
    addEffectToContainer(container, makeEffect('poison', 10, 3));
    const result = registry.tickAll(container, ctx);
    expect(result.dotDamage).toBe(10);
    expect(result.regenAmount).toBe(0);
    expect(result.expiredIds).toHaveLength(0);
    expect(container.effects[0].remainingTurns).toBe(2);
  });

  it('推进 regen 效果：累加 regenAmount', () => {
    registry.register(regenHandler);
    const container = createEmptyContainer();
    addEffectToContainer(container, makeEffect('regen', 8, 2));
    const result = registry.tickAll(container, ctx);
    expect(result.dotDamage).toBe(0);
    expect(result.regenAmount).toBe(8);
  });

  it('多个 dot 效果同时推进（poison + burn）', () => {
    registry.register(poisonHandler);
    registry.register(burnHandler);
    const container = createEmptyContainer();
    addEffectToContainer(container, makeEffect('poison', 10, 3, { stackStrategy: 'independent' }));
    addEffectToContainer(container, makeEffect('burn', 10, 3, { stackStrategy: 'independent' }));
    // poison: 10, burn: round(10*1.5)=15 → 合计 25
    const result = registry.tickAll(container, ctx);
    expect(result.dotDamage).toBe(25);
  });

  it('效果过期时加入 expiredIds 并从容器移除', () => {
    registry.register(poisonHandler);
    const container = createEmptyContainer();
    const eff = makeEffect('poison', 10, 1);
    addEffectToContainer(container, eff);
    const result = registry.tickAll(container, ctx);
    expect(result.expiredIds).toEqual([eff.id]);
    expect(container.effects).toHaveLength(0);
  });

  it('效果过期时触发 onRemove 钩子', () => {
    const onRemove = vi.fn();
    registry.register(makeHandler('poison', { onRemove }));
    const container = createEmptyContainer();
    const eff = makeEffect('poison', 10, 1);
    addEffectToContainer(container, eff);
    registry.tickAll(container, ctx);
    expect(onRemove).toHaveBeenCalledTimes(1);
    // onRemove 接收容器内的 effect 副本（已被推进 remainingTurns）
    expect(onRemove.mock.calls[0][0]).toEqual(
      expect.objectContaining({ id: eff.id, remainingTurns: 0 })
    );
  });

  it('未过期的效果不触发 onRemove', () => {
    const onRemove = vi.fn();
    registry.register(makeHandler('poison', { onRemove }));
    const container = createEmptyContainer();
    addEffectToContainer(container, makeEffect('poison', 10, 3));
    registry.tickAll(container, ctx);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('效果无处理器时仍会推进 remainingTurns', () => {
    // 不注册任何处理器
    const container = createEmptyContainer();
    addEffectToContainer(container, makeEffect('poison', 10, 2));
    const result = registry.tickAll(container, ctx);
    expect(result.dotDamage).toBe(0);
    expect(container.effects[0].remainingTurns).toBe(1);
  });

  it('多效果混合推进：部分过期、部分保留', () => {
    registry.register(poisonHandler);
    registry.register(regenHandler);
    const container = createEmptyContainer();
    const eff1 = makeEffect('poison', 10, 1, { stackStrategy: 'independent' }); // 过期
    const eff2 = makeEffect('regen', 5, 3, { stackStrategy: 'independent' }); // 保留
    addEffectToContainer(container, eff1);
    addEffectToContainer(container, eff2);
    const result = registry.tickAll(container, ctx);
    expect(result.expiredIds).toEqual([eff1.id]);
    expect(result.dotDamage).toBe(10);
    expect(result.regenAmount).toBe(5);
    expect(container.effects).toHaveLength(1);
    expect(container.effects[0].id).toBe(eff2.id);
  });
});

// ============================================================
// getDisabledActions — 行动禁用
// ============================================================

describe('getDisabledActions — 行动禁用', () => {
  let registry: EffectHandlerRegistry;

  beforeEach(() => {
    registry = new EffectHandlerRegistry();
  });

  it('空容器不禁用任何行动', () => {
    const container = createEmptyContainer();
    const result = registry.getDisabledActions(container);
    expect(result.types).toHaveLength(0);
    expect(result.skipTurn).toBe(false);
  });

  it('silence 仅禁用 skill', () => {
    registry.register(silenceHandler);
    const container = createEmptyContainer();
    addEffectToContainer(container, makeEffect('silence', 0, 2));
    const result = registry.getDisabledActions(container);
    expect(result.types).toEqual(['skill']);
    expect(result.skipTurn).toBe(false);
  });

  it('stun 禁用全部 3 种行动 → skipTurn=true', () => {
    registry.register(stunHandler);
    const container = createEmptyContainer();
    addEffectToContainer(container, makeEffect('stun', 0, 2));
    const result = registry.getDisabledActions(container);
    expect(result.types).toEqual(['attack', 'skill', 'flee']);
    expect(result.skipTurn).toBe(true);
  });

  it('freeze 禁用全部 3 种行动 → skipTurn=true', () => {
    registry.register(freezeHandler);
    const container = createEmptyContainer();
    addEffectToContainer(container, makeEffect('freeze', 0, 2));
    const result = registry.getDisabledActions(container);
    expect(result.skipTurn).toBe(true);
  });

  it('silence + 部分 attack_down 不触发 skipTurn（attack 未禁用）', () => {
    registry.register(silenceHandler);
    const container = createEmptyContainer();
    addEffectToContainer(container, makeEffect('silence', 0, 2));
    const result = registry.getDisabledActions(container);
    expect(result.skipTurn).toBe(false);
  });

  it('多个控制效果合并去重', () => {
    registry.register(silenceHandler);
    registry.register(stunHandler);
    const container = createEmptyContainer();
    addEffectToContainer(container, makeEffect('silence', 0, 2, { stackStrategy: 'independent' }));
    addEffectToContainer(container, makeEffect('stun', 0, 2, { stackStrategy: 'independent' }));
    const result = registry.getDisabledActions(container);
    // silence 先 push 'skill'，stun 再 push 'attack'(新)/'skill'(跳过)/'flee'(新)
    // 最终去重后包含全部 3 种 → skipTurn=true
    expect(result.types).toHaveLength(3);
    expect(result.types).toEqual(expect.arrayContaining(['attack', 'skill', 'flee']));
    expect(result.skipTurn).toBe(true);
  });
});

// ============================================================
// 15 种内置处理器 — 单元测试
// ============================================================

describe('内置效果处理器 — 15 种', () => {
  const ctx = makeCtx();

  // ---------- 持续伤害 ----------
  describe('poison 中毒', () => {
    it('onTick 返回固定 dotDamage=value', () => {
      const eff = makeEffect('poison', 12, 3);
      expect(poisonHandler.onTick!(eff, ctx)).toEqual({ dotDamage: 12, regenAmount: 0 });
    });

    it('value=0 时不造成伤害', () => {
      const eff = makeEffect('poison', 0, 3);
      expect(poisonHandler.onTick!(eff, ctx).dotDamage).toBe(0);
    });
  });

  describe('burn 灼烧', () => {
    it('onTick 返回 value × 1.5（四舍五入）', () => {
      const eff = makeEffect('burn', 10, 3);
      expect(burnHandler.onTick!(eff, ctx).dotDamage).toBe(15);
    });

    it('奇数 × 1.5 使用 Math.round 取整', () => {
      // 9 * 1.5 = 13.5 → round = 14
      const eff = makeEffect('burn', 9, 3);
      expect(burnHandler.onTick!(eff, ctx).dotDamage).toBe(14);
    });

    it('value=1 时伤害为 2（1*1.5=1.5 → round=2）', () => {
      const eff = makeEffect('burn', 1, 3);
      expect(burnHandler.onTick!(eff, ctx).dotDamage).toBe(2);
    });
  });

  // ---------- 控制效果 ----------
  describe('stun 眩晕', () => {
    it('禁用全部 3 种行动', () => {
      expect(stunHandler.getDisabledActions!(makeEffect('stun', 0, 2))).toEqual([
        'attack',
        'skill',
        'flee',
      ]);
    });

    it('无 onTick / 速度修正', () => {
      expect(stunHandler.onTick).toBeUndefined();
      expect(stunHandler.getSpeedMod).toBeUndefined();
    });
  });

  describe('freeze 冰冻', () => {
    it('禁用全部 3 种行动', () => {
      expect(freezeHandler.getDisabledActions!(makeEffect('freeze', 0, 2))).toEqual([
        'attack',
        'skill',
        'flee',
      ]);
    });

    it('getSpeedMod 固定返回 -10', () => {
      const eff = makeEffect('freeze', 0, 2);
      expect(freezeHandler.getSpeedMod!(eff)).toBe(-10);
    });
  });

  describe('silence 沉默', () => {
    it('仅禁用 skill', () => {
      expect(silenceHandler.getDisabledActions!(makeEffect('silence', 0, 2))).toEqual(['skill']);
    });

    it('不禁用 attack 和 flee', () => {
      const types = silenceHandler.getDisabledActions!(makeEffect('silence', 0, 2)) as ActionType[];
      expect(types).not.toContain('attack');
      expect(types).not.toContain('flee');
    });
  });

  // ---------- 护盾 ----------
  describe('shield 护盾', () => {
    it('吸收量不超过 incomingDamage', () => {
      const eff = makeEffect('shield', 100, 3);
      expect(shieldHandler.getDamageAbsorb!(eff, 30)).toBe(30);
    });

    it('吸收量不超过 effect.value', () => {
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

    it('incomingDamage=0 时吸收 0', () => {
      const eff = makeEffect('shield', 100, 3);
      expect(shieldHandler.getDamageAbsorb!(eff, 0)).toBe(0);
      expect(eff.value).toBe(100);
    });
  });

  // ---------- 攻击修正 ----------
  describe('attack_up 攻击上升', () => {
    it('value=18 → 倍率 1.18', () => {
      const eff = makeEffect('attack_up', 18, 3);
      expect(attackUpHandler.getAttackerDamageMod!(eff, ctx)).toBeCloseTo(1.18);
    });

    it('value=100 → 倍率 2.0', () => {
      const eff = makeEffect('attack_up', 100, 3);
      expect(attackUpHandler.getAttackerDamageMod!(eff, ctx)).toBe(2);
    });

    it('value=0 → 倍率 1.0', () => {
      const eff = makeEffect('attack_up', 0, 3);
      expect(attackUpHandler.getAttackerDamageMod!(eff, ctx)).toBe(1);
    });
  });

  describe('attack_down 攻击下降', () => {
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

    it('value=0 → 倍率 1.0', () => {
      const eff = makeEffect('attack_down', 0, 3);
      expect(attackDownHandler.getAttackerDamageMod!(eff, ctx)).toBe(1);
    });
  });

  // ---------- 防御修正 ----------
  describe('defense_up 防御上升', () => {
    it('value=14 → 倍率 0.86', () => {
      const eff = makeEffect('defense_up', 14, 3);
      expect(defenseUpHandler.getDefenderDamageMod!(eff, ctx)).toBeCloseTo(0.86);
    });

    it('value=100 → 保底 0.05', () => {
      const eff = makeEffect('defense_up', 100, 3);
      expect(defenseUpHandler.getDefenderDamageMod!(eff, ctx)).toBe(0.05);
    });

    it('value=200 → 保底 0.05', () => {
      const eff = makeEffect('defense_up', 200, 3);
      expect(defenseUpHandler.getDefenderDamageMod!(eff, ctx)).toBe(0.05);
    });
  });

  describe('defense_down 防御下降', () => {
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
  });

  describe('vulnerable 易伤', () => {
    it('value=22 → 倍率 1 + 22*1.5/100 = 1.33', () => {
      const eff = makeEffect('vulnerable', 22, 3);
      expect(vulnerableHandler.getDefenderDamageMod!(eff, ctx)).toBeCloseTo(1.33);
    });

    it('value=0 → 倍率 1.0', () => {
      const eff = makeEffect('vulnerable', 0, 3);
      expect(vulnerableHandler.getDefenderDamageMod!(eff, ctx)).toBe(1);
    });

    it('比同等 value 的 defense_down 更强（1.5 倍系数）', () => {
      const vEff = makeEffect('vulnerable', 20, 3);
      const dEff = makeEffect('defense_down', 20, 3);
      const vMod = vulnerableHandler.getDefenderDamageMod!(vEff, ctx);
      const dMod = defenseDownHandler.getDefenderDamageMod!(dEff, ctx);
      expect(vMod).toBeGreaterThan(dMod);
    });
  });

  // ---------- 速度修正 ----------
  describe('speed_up 速度上升', () => {
    it('getSpeedMod 返回 value（正值加速）', () => {
      const eff = makeEffect('speed_up', 10, 3);
      expect(speedUpHandler.getSpeedMod!(eff)).toBe(10);
    });

    it('value=0 → 0', () => {
      const eff = makeEffect('speed_up', 0, 3);
      expect(speedUpHandler.getSpeedMod!(eff)).toBe(0);
    });
  });

  describe('speed_down 速度下降', () => {
    it('getSpeedMod 返回 -value（负值减速）', () => {
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
  });

  // ---------- 恢复 ----------
  describe('regen 恢复', () => {
    it('onTick 返回 regenAmount=value', () => {
      const eff = makeEffect('regen', 12, 3);
      expect(regenHandler.onTick!(eff, ctx)).toEqual({ dotDamage: 0, regenAmount: 12 });
    });

    it('不造成伤害', () => {
      const eff = makeEffect('regen', 5, 3);
      expect(regenHandler.onTick!(eff, ctx).dotDamage).toBe(0);
    });
  });

  // ---------- 荆棘 ----------
  describe('thorn 荆棘', () => {
    it('返回 round(incoming × value)', () => {
      const eff = makeEffect('thorn', 0.3, 3);
      expect(thornHandler.getThornDamage!(eff, 100)).toBe(30);
    });

    it('incoming=50, value=0.25 → 12.5 round = 13（Math.round 行为）', () => {
      // 注意 JS Math.round(12.5) = 13（向 +Inf 取整）
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
  });
});
