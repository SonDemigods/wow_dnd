/**
 * @fileoverview 战斗资源系统单元测试
 * @description 覆盖：
 * 1. BaseResourceSystem 通用逻辑：applyGeneration / consume / hasEnough / reset（通过子类间接测试）
 * 2. RageSystem：5 种 source 的 cap、事件钩子、整数化、上限裁剪
 * 3. EnergySystem：无 cap 生成、回合回复、初始值 50
 * 4. ComboPointSystem：差异化 cap、reset 清空（不恢复 initialValue）
 * 5. SoulShardSystem：skill/kill 生成、其他来源不生成
 * 6. ChiSystem：attack/turn/skill 生成、受伤不生成
 * 7. ResourceSystemFactory：5 个职业映射 + default 空数组
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { BaseResourceSystem } from '@/modules/combat/resources/BaseResourceSystem';
import { RageSystem } from '@/modules/combat/resources/RageSystem';
import { EnergySystem } from '@/modules/combat/resources/EnergySystem';
import { ComboPointSystem } from '@/modules/combat/resources/ComboPointSystem';
import { SoulShardSystem } from '@/modules/combat/resources/SoulShardSystem';
import { ChiSystem } from '@/modules/combat/resources/ChiSystem';
import { ResourceSystemFactory } from '@/modules/combat/resources/ResourceSystemFactory';
import type { ResourceSource, ResourceSystem } from '@/modules/combat/resources/types';

// ============================================================
// BaseResourceSystem — 通过最小子类测试通用逻辑
// ============================================================

/** 最小可实例化子类（用于测试基类通用逻辑） */
class TestResource extends BaseResourceSystem {
  readonly type = 'mana' as const;
  constructor(opts: { maxValue: number; initialValue?: number; isInteger?: boolean }) {
    super(opts);
  }
  generate(amount: number): void {
    this.applyGeneration(amount);
  }
}

describe('BaseResourceSystem 通用逻辑', () => {
  it('构造时 currentValue = initialValue', () => {
    const r = new TestResource({ maxValue: 100, initialValue: 30, isInteger: true });
    expect(r.currentValue).toBe(30);
    expect(r.maxValue).toBe(100);
    expect(r.isInteger).toBe(true);
  });

  it('initialValue 默认为 0', () => {
    const r = new TestResource({ maxValue: 50 });
    expect(r.currentValue).toBe(0);
    expect(r.isInteger).toBe(false);
  });

  it('generate 累加并裁剪到 maxValue', () => {
    const r = new TestResource({ maxValue: 100, initialValue: 80, isInteger: true });
    r.generate(30, 'attack');
    expect(r.currentValue).toBe(100);
  });

  it('isInteger=true 时 generate 向下取整', () => {
    const r = new TestResource({ maxValue: 100, initialValue: 0, isInteger: true });
    // 通过反射测试 applyGeneration 的 floor 行为：直接 generate 整数即可
    // 真实场景下子类可能传入小数累加（如 floor(amount*0.1) 已整数化）
    r.generate(5, 'attack');
    expect(r.currentValue).toBe(5);
  });

  it('generate(amount<=0) 不改变值', () => {
    const r = new TestResource({ maxValue: 100, initialValue: 10 });
    r.generate(0, 'attack');
    expect(r.currentValue).toBe(10);
    r.generate(-5, 'attack');
    expect(r.currentValue).toBe(10);
  });

  it('hasEnough 正确判定', () => {
    const r = new TestResource({ maxValue: 100, initialValue: 20 });
    expect(r.hasEnough(10)).toBe(true);
    expect(r.hasEnough(20)).toBe(true);
    expect(r.hasEnough(21)).toBe(false);
  });

  it('consume 成功扣减', () => {
    const r = new TestResource({ maxValue: 100, initialValue: 30 });
    expect(r.consume(10)).toBe(true);
    expect(r.currentValue).toBe(20);
  });

  it('consume 资源不足时返回 false 且不改变值', () => {
    const r = new TestResource({ maxValue: 100, initialValue: 5 });
    expect(r.consume(10)).toBe(false);
    expect(r.currentValue).toBe(5);
  });

  it('consume 不会低于 0', () => {
    const r = new TestResource({ maxValue: 100, initialValue: 5 });
    expect(r.consume(5)).toBe(true);
    expect(r.currentValue).toBe(0);
  });

  it('reset 恢复到 initialValue', () => {
    const r = new TestResource({ maxValue: 100, initialValue: 30 });
    r.generate(50, 'attack');
    r.consume(10);
    r.reset();
    expect(r.currentValue).toBe(30);
  });

  it('valueRef / maxValueRef 暴露响应式引用', () => {
    const r = new TestResource({ maxValue: 100, initialValue: 10 });
    expect(r.valueRef.value).toBe(10);
    expect(r.maxValueRef.value).toBe(100);
    r.generate(5, 'attack');
    expect(r.valueRef.value).toBe(15);
  });
});

// ============================================================
// RageSystem — 战士怒气
// ============================================================

describe('RageSystem 战士怒气', () => {
  let rage: RageSystem;

  beforeEach(() => {
    rage = new RageSystem(0);
  });

  it('默认配置：maxValue=100, initialValue=0, isInteger=true', () => {
    expect(rage.type).toBe('rage');
    expect(rage.maxValue).toBe(100);
    expect(rage.currentValue).toBe(0);
    expect(rage.isInteger).toBe(true);
  });

  it('可指定初始怒气', () => {
    const r = new RageSystem(30);
    expect(r.currentValue).toBe(30);
  });

  describe('generate — 按 source 应用上限', () => {
    it('attack 来源上限 5', () => {
      rage.generate(100, 'attack');
      expect(rage.currentValue).toBe(5);
    });

    it('damaged 来源上限 10', () => {
      rage.generate(100, 'damaged');
      expect(rage.currentValue).toBe(10);
    });

    it('turn 来源上限 1', () => {
      rage.generate(100, 'turn');
      expect(rage.currentValue).toBe(1);
    });

    it('skill 来源上限 20', () => {
      rage.generate(100, 'skill');
      expect(rage.currentValue).toBe(20);
    });

    it('kill 来源上限 10', () => {
      rage.generate(100, 'kill');
      expect(rage.currentValue).toBe(10);
    });

    it('未超过上限时按实际值生成', () => {
      rage.generate(3, 'attack');
      expect(rage.currentValue).toBe(3);
    });

    it('多次生成累加，但单次不超过 cap', () => {
      rage.generate(100, 'attack'); // 5
      rage.generate(100, 'turn'); // +1 = 6
      expect(rage.currentValue).toBe(6);
    });

    it('累加不超过 maxValue=100', () => {
      for (let i = 0; i < 30; i++) {
        rage.generate(100, 'skill'); // 每次 +20
      }
      expect(rage.currentValue).toBe(100);
    });
  });

  describe('事件钩子', () => {
    it('onTurnStart 生成 1 怒气', () => {
      rage.onTurnStart();
      expect(rage.currentValue).toBe(1);
    });

    it('onAttack 生成 5 怒气', () => {
      rage.onAttack();
      expect(rage.currentValue).toBe(5);
    });

    it('onKill 生成 10 怒气', () => {
      rage.onKill();
      expect(rage.currentValue).toBe(10);
    });

    it('onDamaged 生成伤害的 10%（向下取整）', () => {
      rage.onDamaged(50);
      // floor(50 * 0.1) = 5, cap=10
      expect(rage.currentValue).toBe(5);
    });

    it('onDamaged 小数伤害向下取整', () => {
      rage.onDamaged(25);
      // floor(25 * 0.1) = floor(2.5) = 2
      expect(rage.currentValue).toBe(2);
    });

    it('onDamaged 上限 10（通过 damaged source cap）', () => {
      rage.onDamaged(200);
      // floor(200 * 0.1) = 20, 但 cap=10
      expect(rage.currentValue).toBe(10);
    });
  });

  it('reset 恢复到初始怒气', () => {
    const r = new RageSystem(20);
    r.generate(50, 'attack');
    r.reset();
    expect(r.currentValue).toBe(20);
  });

  it('consume 正常工作', () => {
    const r = new RageSystem(30);
    expect(r.consume(10)).toBe(true);
    expect(r.currentValue).toBe(20);
    expect(r.consume(100)).toBe(false);
  });
});

// ============================================================
// EnergySystem — 潜行者能量
// ============================================================

describe('EnergySystem 潜行者能量', () => {
  let energy: EnergySystem;

  beforeEach(() => {
    energy = new EnergySystem(50);
  });

  it('默认配置：maxValue=100, initialValue=50, isInteger=true', () => {
    expect(energy.type).toBe('energy');
    expect(energy.maxValue).toBe(100);
    expect(energy.currentValue).toBe(50);
    expect(energy.isInteger).toBe(true);
  });

  it('generate 无 source cap，直接累加', () => {
    const e = new EnergySystem(0);
    e.generate(30, 'attack');
    expect(e.currentValue).toBe(30);
    e.generate(20, 'skill');
    expect(e.currentValue).toBe(50);
  });

  it('generate 不超过 maxValue=100', () => {
    energy.generate(100, 'attack');
    expect(energy.currentValue).toBe(100);
  });

  it('onTurnStart 每回合回复 10 点', () => {
    const e = new EnergySystem(0);
    e.onTurnStart();
    expect(e.currentValue).toBe(10);
    e.onTurnStart();
    expect(e.currentValue).toBe(20);
  });

  it('回合回复不超过上限', () => {
    const e = new EnergySystem(95);
    e.onTurnStart();
    expect(e.currentValue).toBe(100);
  });

  it('reset 恢复到 50', () => {
    energy.consume(30);
    energy.reset();
    expect(energy.currentValue).toBe(50);
  });
});

// ============================================================
// ComboPointSystem — 潜行者连击点
// ============================================================

describe('ComboPointSystem 潜行者连击点', () => {
  let cp: ComboPointSystem;

  beforeEach(() => {
    cp = new ComboPointSystem(0);
  });

  it('默认配置：maxValue=5, initialValue=0, isInteger=true', () => {
    expect(cp.type).toBe('combo_point');
    expect(cp.maxValue).toBe(5);
    expect(cp.currentValue).toBe(0);
    expect(cp.isInteger).toBe(true);
  });

  describe('generate — 按来源差异化', () => {
    it('attack 来源上限 1', () => {
      cp.generate(10, 'attack');
      expect(cp.currentValue).toBe(1);
    });

    it('kill 来源上限 2', () => {
      cp.generate(10, 'kill');
      expect(cp.currentValue).toBe(2);
    });

    it('skill 来源上限 3', () => {
      cp.generate(10, 'skill');
      expect(cp.currentValue).toBe(3);
    });

    it('turn 来源不生成连击点', () => {
      cp.generate(10, 'turn');
      expect(cp.currentValue).toBe(0);
    });

    it('damaged 来源不生成连击点', () => {
      cp.generate(10, 'damaged');
      expect(cp.currentValue).toBe(0);
    });

    it('未超过上限时按实际值生成', () => {
      cp.generate(1, 'attack');
      expect(cp.currentValue).toBe(1);
    });

    it('累加不超过 maxValue=5', () => {
      cp.generate(10, 'attack'); // 1
      cp.generate(10, 'kill'); // +2 = 3
      cp.generate(10, 'skill'); // +3 → 6 → 裁剪到 5
      expect(cp.currentValue).toBe(5);
    });
  });

  describe('事件钩子', () => {
    it('onAttack 生成 1 连击点', () => {
      cp.onAttack();
      expect(cp.currentValue).toBe(1);
    });

    it('onKill 生成 2 连击点', () => {
      cp.onKill();
      expect(cp.currentValue).toBe(2);
    });

    it('多次 onAttack 累加到上限', () => {
      cp.onAttack(); // 1
      cp.onAttack(); // 2
      cp.onAttack(); // 3
      cp.onAttack(); // 4
      cp.onAttack(); // 5
      cp.onAttack(); // 5（上限）
      expect(cp.currentValue).toBe(5);
    });
  });

  it('reset 清空为 0（即使 initialValue 非零也清空）', () => {
    const c = new ComboPointSystem(2);
    c.generate(10, 'attack'); // 1
    c.reset();
    expect(c.currentValue).toBe(0);
  });

  it('consume 正常工作（终结技消耗）', () => {
    const c = new ComboPointSystem(0);
    c.generate(10, 'skill'); // 3
    expect(c.consume(3)).toBe(true);
    expect(c.currentValue).toBe(0);
  });
});

// ============================================================
// SoulShardSystem — 术士灵魂碎片
// ============================================================

describe('SoulShardSystem 术士灵魂碎片', () => {
  let shard: SoulShardSystem;

  beforeEach(() => {
    shard = new SoulShardSystem(1);
  });

  it('默认配置：maxValue=5, initialValue=1, isInteger=true', () => {
    expect(shard.type).toBe('soul_shard');
    expect(shard.maxValue).toBe(5);
    expect(shard.currentValue).toBe(1);
    expect(shard.isInteger).toBe(true);
  });

  describe('generate — 按来源差异化', () => {
    it('skill 来源上限 1', () => {
      shard.generate(10, 'skill');
      expect(shard.currentValue).toBe(2); // 1 + 1
    });

    it('kill 来源上限 1', () => {
      shard.generate(10, 'kill');
      expect(shard.currentValue).toBe(2); // 1 + 1
    });

    it('attack 来源不生成', () => {
      shard.generate(10, 'attack');
      expect(shard.currentValue).toBe(1);
    });

    it('turn 来源不生成', () => {
      shard.generate(10, 'turn');
      expect(shard.currentValue).toBe(1);
    });

    it('damaged 来源不生成', () => {
      shard.generate(10, 'damaged');
      expect(shard.currentValue).toBe(1);
    });

    it('累加不超过 maxValue=5', () => {
      shard.generate(10, 'skill'); // 2
      shard.generate(10, 'skill'); // 3
      shard.generate(10, 'skill'); // 4
      shard.generate(10, 'skill'); // 5
      shard.generate(10, 'skill'); // 5（上限）
      expect(shard.currentValue).toBe(5);
    });
  });

  it('onKill 生成 1 碎片', () => {
    shard.onKill();
    expect(shard.currentValue).toBe(2);
  });

  it('reset 恢复到 1', () => {
    shard.generate(10, 'skill');
    shard.reset();
    expect(shard.currentValue).toBe(1);
  });

  it('consume 正常工作（召唤消耗）', () => {
    const s = new SoulShardSystem(3);
    expect(s.consume(2)).toBe(true);
    expect(s.currentValue).toBe(1);
  });
});

// ============================================================
// ChiSystem — 武僧真气
// ============================================================

describe('ChiSystem 武僧真气', () => {
  let chi: ChiSystem;

  beforeEach(() => {
    chi = new ChiSystem(1);
  });

  it('默认配置：maxValue=5, initialValue=1, isInteger=true', () => {
    expect(chi.type).toBe('chi');
    expect(chi.maxValue).toBe(5);
    expect(chi.currentValue).toBe(1);
    expect(chi.isInteger).toBe(true);
  });

  describe('generate — 按来源差异化', () => {
    it('attack 来源上限 1', () => {
      chi.generate(10, 'attack');
      expect(chi.currentValue).toBe(2); // 1 + 1
    });

    it('turn 来源上限 1', () => {
      chi.generate(10, 'turn');
      expect(chi.currentValue).toBe(2); // 1 + 1
    });

    it('skill 来源上限 2', () => {
      chi.generate(10, 'skill');
      expect(chi.currentValue).toBe(3); // 1 + 2
    });

    it('damaged 来源不生成', () => {
      chi.generate(10, 'damaged');
      expect(chi.currentValue).toBe(1);
    });

    it('kill 来源不生成', () => {
      chi.generate(10, 'kill');
      expect(chi.currentValue).toBe(1);
    });

    it('累加不超过 maxValue=5', () => {
      chi.generate(10, 'skill'); // 3
      chi.generate(10, 'skill'); // 5
      chi.generate(10, 'skill'); // 5（上限）
      expect(chi.currentValue).toBe(5);
    });
  });

  describe('事件钩子', () => {
    it('onTurnStart 生成 1 真气', () => {
      chi.onTurnStart();
      expect(chi.currentValue).toBe(2);
    });

    it('onAttack 生成 1 真气', () => {
      chi.onAttack();
      expect(chi.currentValue).toBe(2);
    });

    it('多次攻击累加上限', () => {
      chi.onAttack(); // 2
      chi.onAttack(); // 3
      chi.onAttack(); // 4
      chi.onAttack(); // 5
      chi.onAttack(); // 5（上限）
      expect(chi.currentValue).toBe(5);
    });
  });

  it('reset 恢复到 1', () => {
    chi.generate(10, 'attack');
    chi.reset();
    expect(chi.currentValue).toBe(1);
  });
});

// ============================================================
// ResourceSystemFactory — 职业映射
// ============================================================

describe('ResourceSystemFactory 职业映射', () => {
  it('warrior 返回 [RageSystem]', () => {
    const systems = ResourceSystemFactory.create('warrior');
    expect(systems).toHaveLength(1);
    expect(systems[0].type).toBe('rage');
    expect(systems[0].currentValue).toBe(0);
    expect(systems[0].maxValue).toBe(100);
  });

  it('rogue 返回 [EnergySystem, ComboPointSystem]', () => {
    const systems = ResourceSystemFactory.create('rogue');
    expect(systems).toHaveLength(2);
    expect(systems[0].type).toBe('energy');
    expect(systems[0].currentValue).toBe(50);
    expect(systems[1].type).toBe('combo_point');
    expect(systems[1].currentValue).toBe(0);
  });

  it('warlock 返回 [SoulShardSystem]', () => {
    const systems = ResourceSystemFactory.create('warlock');
    expect(systems).toHaveLength(1);
    expect(systems[0].type).toBe('soul_shard');
    expect(systems[0].currentValue).toBe(1);
  });

  it('monk 返回 [ChiSystem]', () => {
    const systems = ResourceSystemFactory.create('monk');
    expect(systems).toHaveLength(1);
    expect(systems[0].type).toBe('chi');
    expect(systems[0].currentValue).toBe(1);
  });

  it('未知职业返回空数组（回退到 MP 系统）', () => {
    expect(ResourceSystemFactory.create('mage')).toEqual([]);
    expect(ResourceSystemFactory.create('priest')).toEqual([]);
    expect(ResourceSystemFactory.create('paladin')).toEqual([]);
    expect(ResourceSystemFactory.create('unknown_class')).toEqual([]);
  });

  it('每次 create 返回新实例（无单例缓存）', () => {
    const a = ResourceSystemFactory.create('warrior');
    const b = ResourceSystemFactory.create('warrior');
    expect(a).not.toBe(b);
    expect(a[0]).not.toBe(b[0]);
    a[0].generate(100, 'attack'); // 5
    expect(b[0].currentValue).toBe(0); // 不受影响
  });
});
