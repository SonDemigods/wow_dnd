/**
 * @fileoverview 伤害计算管线单元测试
 * @description 覆盖 processDamagePipeline 的 4 阶段计算和 applyEffect 辅助函数：
 * 1. 阶段 0：calcAttackDamage（按 damageType 选择物攻/魔攻 + 随机数）+ applyDefenseReduction（减伤公式）
 * 2. 阶段 1：攻击方修正 → expectedDamage
 * 3. 阶段 2：防御方修正 → actualDamage
 * 4. 阶段 3：护盾吸收 → finalDamage
 * 5. baseDamageOverride 跳过阶段 0 攻击计算（减伤仍生效）
 * 6. applyEffect：addEffectToContainer + onApply 钩子
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EffectHandlerRegistry } from '@/modules/combat/effects/handler';
import { processDamagePipeline, applyEffect } from '@/modules/combat/effects/pipeline';
import { createDefaultRegistry } from '@/modules/combat/effects/handlers';
import { createEmptyContainer, addEffectToContainer } from '@/modules/combat/effects/container';
import type {
  Effect,
  EffectContainer,
  EffectContext,
  DamageType,
  EffectType,
} from '@/modules/combat/effects/types';

// P3-187：替代 Math.random().toString(36) 的脆弱 ID 生成，改用自增计数器
let effIdCounter = 0;

// ============================================================
// 工厂函数
// ============================================================

function makeCtx(overrides: Partial<EffectContext> = {}): EffectContext {
  return {
    ownerId: 'player_1',
    ownerType: 'player',
    baseStats: {
      physicalAttack: 50,
      physicalDefense: 20,
      magicAttack: 40,
      magicDefense: 15,
      speed: 15,
    },
    currentHp: 100,
    maxHp: 100,
    ...overrides,
  };
}

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

/** 构造空的攻击方/防御方容器对 */
function makeEmptyContainers(): { attacker: EffectContainer; defender: EffectContainer } {
  return { attacker: createEmptyContainer(), defender: createEmptyContainer() };
}

// ============================================================
// calcAttackDamage + applyDefenseReduction（通过 processDamagePipeline 间接测试，需 mock Math.random）
// ============================================================
// 公式：rawDamage = floor(attack * 0.4) + floor(random * 10)
//      defenseReduction = max(floor(rawDamage * 0.3), defense)
//      result = max(1, rawDamage - defenseReduction)

describe('processDamagePipeline — 阶段 0 基础伤害', () => {
  let registry: EffectHandlerRegistry;

  beforeEach(() => {
    registry = new EffectHandlerRegistry();
    createDefaultRegistry(registry);
  });

  it('物理伤害使用 physicalAttack vs physicalDefense', () => {
    // mock random=0：rawDamage = floor(50*0.4) + floor(0*10) = 20
    // defenseReduction = max(floor(20*0.3), 5) = max(6, 5) = 6
    // defendedDamage = max(1, 20-6) = 14
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const attacker = makeCtx({ baseStats: { physicalAttack: 50, physicalDefense: 20, magicAttack: 40, magicDefense: 15, speed: 15 } });
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 5, magicAttack: 25, magicDefense: 3, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    expect(result.expectedDamage).toBe(14);
    expect(result.actualDamage).toBe(14);
  });

  it('魔法伤害使用 magicAttack vs magicDefense', () => {
    // mock random=0：rawDamage = floor(40*0.4) + 0 = 16
    // defenseReduction = max(floor(16*0.3), 3) = max(4, 3) = 4
    // defendedDamage = max(1, 16-4) = 12
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const attacker = makeCtx({ baseStats: { physicalAttack: 50, physicalDefense: 20, magicAttack: 40, magicDefense: 15, speed: 15 } });
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 5, magicAttack: 25, magicDefense: 3, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'magical');
    expect(result.expectedDamage).toBe(12);
  });

  it('random=0.5 时增加随机伤害（floor(0.5*10)=5）', () => {
    // rawDamage = floor(50*0.4) + floor(0.5*10) = 20 + 5 = 25
    // defenseReduction = max(floor(25*0.3), 5) = max(7, 5) = 7
    // defendedDamage = max(1, 25-7) = 18
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const attacker = makeCtx();
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 5, magicAttack: 25, magicDefense: 3, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    expect(result.expectedDamage).toBe(18);
  });

  it('random=1 时随机伤害最大（floor(1*10)=10，注意 mock 返回 1 不会超过 1）', () => {
    // rawDamage = floor(50*0.4) + floor(1*10) = 20 + 10 = 30
    // defenseReduction = max(floor(30*0.3), 5) = max(9, 5) = 9
    // defendedDamage = max(1, 30-9) = 21
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const attacker = makeCtx();
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 5, magicAttack: 25, magicDefense: 3, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    expect(result.expectedDamage).toBe(21);
  });

  it('防御过高时基础伤害保底为 1', () => {
    // rawDamage = floor(50*0.4) + 0 = 20
    // defenseReduction = max(6, 1000) = 1000 → max(1, ...) 保底为 1
    // 但若 attack 很低：attack=2 → baseDamage = floor(0.8) + 0 = 0
    // defenseReduction = min(0, 1000) = 0 → max(1, 0-0) = 1
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const attacker = makeCtx({ baseStats: { physicalAttack: 2, physicalDefense: 20, magicAttack: 0, magicDefense: 15, speed: 15 } });
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 1000, magicAttack: 25, magicDefense: 15, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    expect(result.finalDamage).toBeGreaterThanOrEqual(1);
  });

  it('防御高于保底时全额生效', () => {
    // rawDamage = 20（random=0），defense=1000
    // defenseReduction = max(floor(20*0.3), 1000) = max(6, 1000) = 1000
    // 基础 = max(1, 20-1000) = 1（高防御全额抵扣，保底为 1）
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const attacker = makeCtx();
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 1000, magicAttack: 25, magicDefense: 15, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    expect(result.expectedDamage).toBe(1);
  });
});

// ============================================================
// 阶段 1：攻击方修正
// ============================================================

describe('processDamagePipeline — 阶段 1 攻击方修正', () => {
  let registry: EffectHandlerRegistry;

  beforeEach(() => {
    registry = new EffectHandlerRegistry();
    createDefaultRegistry(registry);
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  it('攻击方有 attack_up（+20%）→ expectedDamage = floor(scaled - defense)', () => {
    // P10-039: attack_up 在减伤前应用（与 passive attack_multiplier 合并）
    // raw = floor(50 * 0.4) = 20, scaledDamage = floor(20 * 1.2) = 24
    // defense = max(floor(24 * 0.3), 5) = 7, expected = 24 - 7 = 17
    const attacker = makeCtx();
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 5, magicAttack: 25, magicDefense: 3, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    addEffectToContainer(ae, makeEffect('attack_up', 20, 3));
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    expect(result.expectedDamage).toBe(17);
  });

  it('攻击方有 attack_down（-50%）→ expectedDamage = floor(scaled - defense)', () => {
    // P10-039: attack_down 在减伤前应用
    // raw = 20, scaledDamage = floor(20 * 0.5) = 10, defense = max(floor(10 * 0.3), 5) = 5, expected = 10 - 5 = 5
    const attacker = makeCtx();
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 5, magicAttack: 25, magicDefense: 3, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    addEffectToContainer(ae, makeEffect('attack_down', 50, 3));
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    expect(result.expectedDamage).toBe(5);
  });

  it('攻击方无效果 → expectedDamage = baseDamage', () => {
    const attacker = makeCtx();
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 5, magicAttack: 25, magicDefense: 3, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    expect(result.expectedDamage).toBe(14);
  });
});

// ============================================================
// 阶段 2：防御方修正
// ============================================================

describe('processDamagePipeline — 阶段 2 防御方修正', () => {
  let registry: EffectHandlerRegistry;

  beforeEach(() => {
    registry = new EffectHandlerRegistry();
    createDefaultRegistry(registry);
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  it('防御方有 defense_up（-20% 承伤）→ actualDamage = floor(expected * 0.8)', () => {
    // base = 14, expected = 14, defenderMod = 0.8, actual = floor(11.2) = 11
    const attacker = makeCtx();
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 5, magicAttack: 25, magicDefense: 3, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    addEffectToContainer(de, makeEffect('defense_up', 20, 3));
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    expect(result.actualDamage).toBe(11);
  });

  it('防御方有 defense_down（+12% 承伤）→ actualDamage = floor(expected * 1.12)', () => {
    // base = 14, expected = 14, defenderMod = 1.12, actual = floor(15.68) = 15
    const attacker = makeCtx();
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 5, magicAttack: 25, magicDefense: 3, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    addEffectToContainer(de, makeEffect('defense_down', 12, 3));
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    expect(result.actualDamage).toBe(15);
  });

  it('防御方有 vulnerable（易伤 +20*1.5%=+30%）→ actualDamage = floor(expected * 1.3)', () => {
    // base = 14, expected = 14, defenderMod = 1 + 20*1.5/100 = 1.3, actual = floor(18.2) = 18
    const attacker = makeCtx();
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 5, magicAttack: 25, magicDefense: 3, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    addEffectToContainer(de, makeEffect('vulnerable', 20, 3));
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    expect(result.actualDamage).toBe(18);
  });

  it('防御方无效果 → actualDamage = expectedDamage', () => {
    const attacker = makeCtx();
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 5, magicAttack: 25, magicDefense: 3, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    expect(result.actualDamage).toBe(result.expectedDamage);
  });
});

// ============================================================
// 阶段 3：护盾吸收
// ============================================================

describe('processDamagePipeline — 阶段 3 护盾吸收', () => {
  let registry: EffectHandlerRegistry;

  beforeEach(() => {
    registry = new EffectHandlerRegistry();
    createDefaultRegistry(registry);
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  it('护盾完全吸收 → finalDamage = 0', () => {
    // actual = 14, shield = 100 → absorbed = 14, final = max(0, 14-14) = 0
    const attacker = makeCtx();
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 5, magicAttack: 25, magicDefense: 3, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    addEffectToContainer(de, makeEffect('shield', 100, 3));
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    expect(result.absorbed).toBe(14);
    expect(result.finalDamage).toBe(0);
  });

  it('护盾部分吸收 → finalDamage = actual - absorbed', () => {
    // actual = 14, shield = 5 → absorbed = 5, final = 9
    const attacker = makeCtx();
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 5, magicAttack: 25, magicDefense: 3, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    addEffectToContainer(de, makeEffect('shield', 5, 3));
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    expect(result.absorbed).toBe(5);
    expect(result.finalDamage).toBe(9);
  });

  it('无护盾 → absorbed = 0, finalDamage = actualDamage', () => {
    const attacker = makeCtx();
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 5, magicAttack: 25, magicDefense: 3, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    expect(result.absorbed).toBe(0);
    expect(result.finalDamage).toBe(result.actualDamage);
  });

  it('护盾吸收会扣减 effect.value', () => {
    const attacker = makeCtx();
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 5, magicAttack: 25, magicDefense: 3, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    const shieldEff = makeEffect('shield', 20, 3);
    addEffectToContainer(de, shieldEff);
    processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    // 注意：addEffectToContainer 会 push 副本，需从容器获取实际 effect
    expect(de.effects[0].value).toBe(6); // 20 - 14 = 6
  });
});

// ============================================================
// 完整管线集成测试
// ============================================================

describe('processDamagePipeline — 完整 4 阶段集成', () => {
  let registry: EffectHandlerRegistry;

  beforeEach(() => {
    registry = new EffectHandlerRegistry();
    createDefaultRegistry(registry);
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  it('攻击方+防御方都有效果时正确串联 4 阶段', () => {
    // P10-039: attack_up 在减伤前应用
    // raw = 20, scaledDamage = floor(20 * 1.2) = 24, defense = max(floor(24 * 0.3), 5) = 7
    // expected = 24 - 7 = 17, actual = floor(17 * 0.8) = 13
    // absorbed = min(13, 10) = 10, final = max(0, 13 - 10) = 3
    const attacker = makeCtx();
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 5, magicAttack: 25, magicDefense: 3, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    addEffectToContainer(ae, makeEffect('attack_up', 20, 3));
    addEffectToContainer(de, makeEffect('defense_up', 20, 3));
    addEffectToContainer(de, makeEffect('shield', 10, 3, { stackStrategy: 'independent' }));
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    expect(result.expectedDamage).toBe(17);
    expect(result.actualDamage).toBe(13);
    expect(result.absorbed).toBe(10);
    expect(result.finalDamage).toBe(3);
  });

  it('返回对象包含全部 4 个字段', () => {
    const attacker = makeCtx();
    const defender = makeCtx();
    const { attacker: ae, defender: de } = makeEmptyContainers();
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    expect(result).toHaveProperty('expectedDamage');
    expect(result).toHaveProperty('actualDamage');
    expect(result).toHaveProperty('absorbed');
    expect(result).toHaveProperty('finalDamage');
  });
});

// ============================================================
// NaN 防御 — 效果系统返回 NaN 时归零/归一，防止腐蚀 HP 状态
// ============================================================

describe('processDamagePipeline — NaN 防御', () => {
  let registry: EffectHandlerRegistry;

  beforeEach(() => {
    registry = new EffectHandlerRegistry();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  it('攻击方修正返回 NaN 时 safeAttackerMod 归 1（expectedDamage = baseDamage）', () => {
    // 注册一个返回 NaN 的攻击方修正处理器
    registry.register({
      type: 'attack_up',
      getAttackerDamageMod: () => NaN,
    });
    const attacker = makeCtx();
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 5, magicAttack: 25, magicDefense: 3, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    addEffectToContainer(ae, makeEffect('attack_up', 20, 3));
    // base = 14, attackerMod = NaN → safeAttackerMod = 1, expected = floor(14 * 1) = 14
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    expect(result.expectedDamage).toBe(14);
  });

  it('防御方修正返回 NaN 时 safeDefenderMod 归 1（actualDamage = expectedDamage）', () => {
    registry.register({
      type: 'defense_up',
      getDefenderDamageMod: () => NaN,
    });
    const attacker = makeCtx();
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 5, magicAttack: 25, magicDefense: 3, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    addEffectToContainer(de, makeEffect('defense_up', 20, 3));
    // base = 14, defenderMod = NaN → safeDefenderMod = 1, actual = floor(14 * 1) = 14
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    expect(result.actualDamage).toBe(14);
  });

  it('护盾吸收返回 NaN 时 rawFinal 为 NaN → finalDamage 归 0', () => {
    registry.register({
      type: 'shield',
      getDamageAbsorb: () => NaN,
    });
    const attacker = makeCtx();
    const defender = makeCtx({ baseStats: { physicalAttack: 30, physicalDefense: 5, magicAttack: 25, magicDefense: 3, speed: 10 } });
    const { attacker: ae, defender: de } = makeEmptyContainers();
    addEffectToContainer(de, makeEffect('shield', 100, 3));
    // base = 14, actual = 14, absorbed = NaN → rawFinal = 14 - NaN = NaN → finalDamage = 0
    const result = processDamagePipeline(registry, ae, de, attacker, defender, 'physical');
    expect(result.finalDamage).toBe(0);
  });
});

// ============================================================
// baseDamageOverride — 跳过阶段 0 攻击计算（减伤仍生效）
// ============================================================

describe('processDamagePipeline — baseDamageOverride', () => {
  let registry: EffectHandlerRegistry;

  beforeEach(() => {
    registry = new EffectHandlerRegistry();
    createDefaultRegistry(registry);
  });

  it('传入 baseDamageOverride 时跳过 calcAttackDamage，但减伤仍生效', () => {
    // override=100, defender physicalDefense=20
    // defenseReduction = max(floor(100*0.3), 20) = max(30, 20) = 30
    // defendedDamage = max(1, 100-30) = 70
    const attacker = makeCtx();
    const defender = makeCtx();
    const { attacker: ae, defender: de } = makeEmptyContainers();
    const result = processDamagePipeline(
      registry, ae, de, attacker, defender, 'physical', 100
    );
    expect(result.expectedDamage).toBe(70);
    expect(result.actualDamage).toBe(70);
    expect(result.finalDamage).toBe(70);
  });

  it('override=0 时 defendedDamage 保底为 1', () => {
    // override=0, defender physicalDefense=20
    // defenseReduction = max(0, 20) = 20, defendedDamage = max(1, 0-20) = 1
    const attacker = makeCtx();
    const defender = makeCtx();
    const { attacker: ae, defender: de } = makeEmptyContainers();
    const result = processDamagePipeline(
      registry, ae, de, attacker, defender, 'physical', 0
    );
    expect(result.finalDamage).toBe(1);
  });

  it('override 与攻击方修正正确串联', () => {
    // override=100, defendedDamage=70（见上）, attack_up +50%
    // expected = floor(70 * 1.5) = 105
    const attacker = makeCtx();
    const defender = makeCtx();
    const { attacker: ae, defender: de } = makeEmptyContainers();
    addEffectToContainer(ae, makeEffect('attack_up', 50, 3));
    const result = processDamagePipeline(
      registry, ae, de, attacker, defender, 'physical', 100
    );
    expect(result.expectedDamage).toBe(105);
  });
});

// ============================================================
// applyEffect — 施加效果辅助函数
// ============================================================

describe('applyEffect — 施加效果', () => {
  let registry: EffectHandlerRegistry;
  let ctx: EffectContext;

  beforeEach(() => {
    registry = new EffectHandlerRegistry();
    ctx = makeCtx();
  });

  it('将效果添加到容器', () => {
    const container = createEmptyContainer();
    const eff = makeEffect('poison', 10, 3);
    applyEffect(registry, container, eff, ctx);
    expect(container.effects).toHaveLength(1);
    expect(container.effects[0].type).toBe('poison');
  });

  it('效果无 onApply 钩子时不报错', () => {
    // poisonHandler 没有 onApply
    createDefaultRegistry(registry);
    const container = createEmptyContainer();
    const eff = makeEffect('poison', 10, 3);
    expect(() => applyEffect(registry, container, eff, ctx)).not.toThrow();
    expect(container.effects).toHaveLength(1);
  });

  it('效果有 onApply 钩子时调用', () => {
    const onApply = vi.fn();
    registry.register({ type: 'poison', onApply });
    const container = createEmptyContainer();
    const eff = makeEffect('poison', 10, 3);
    applyEffect(registry, container, eff, ctx);
    expect(onApply).toHaveBeenCalledTimes(1);
    // onApply 接收的是容器内的副本
    expect(onApply.mock.calls[0][1]).toBe(ctx);
  });

  it('效果未注册处理器时仍会添加到容器', () => {
    // 不注册任何处理器
    const container = createEmptyContainer();
    const eff = makeEffect('poison', 10, 3);
    applyEffect(registry, container, eff, ctx);
    expect(container.effects).toHaveLength(1);
  });

  it('遵循叠加策略（默认 max）', () => {
    createDefaultRegistry(registry);
    const container = createEmptyContainer();
    applyEffect(registry, container, makeEffect('poison', 10, 2), ctx);
    applyEffect(registry, container, makeEffect('poison', 15, 3), ctx);
    // max 策略：合并为 value=15, remainingTurns=3
    expect(container.effects).toHaveLength(1);
    expect(container.effects[0].value).toBe(15);
    expect(container.effects[0].remainingTurns).toBe(3);
  });
});
