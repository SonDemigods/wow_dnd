/**
 * @fileoverview monk 职业技能数据完整性测试
 *
 * 验证 monk 16 技能 + 6 被动的数据完整性：
 * - 技能总数 = 16
 * - 双资源体系：energy（主资源）→ chi（副资源）
 *   - energy 生成器：resourceType='energy'，resourceCost ∈ [8,18]，含 generatesResource
 *   - chi 终结技：scalingResource='chi'，不设 resourceType/resourceCost
 * - ID 全局唯一、以 monk_ 开头
 * - 所有 physical_damage 技能 statKey 为 'dex'
 * - unlockLevel ∈ [1, 10]，存在 Lv10 大招
 * - 构成：≥3 buff/debuff + ≥2 AOE
 * - 生成器数量 ≥ 3，终结技数量 ≥ 2
 * - 被动总数 = 6，触发时机覆盖 ≥ 3 种
 */
import { describe, it, expect } from 'vitest';
import { CLASS_ABILITIES } from '@/data/config_skills';
import { CLASS_PASSIVES } from '@/data/config_class_passives';
import type { Skill } from '@/modules/skill/types';
import type { PassiveSkill } from '@/modules/character/types';

const monkEntry = CLASS_ABILITIES.find(c => c.class_id === 'monk');
const monkSkills: Skill[] = monkEntry?.skills ?? [];
const monkPassives: PassiveSkill[] = CLASS_PASSIVES.filter(p => p.classId === 'monk');

// 原有 10 个技能 ID（必须保留）
const ORIGINAL_SKILL_IDS = [
  'monk_sun_strike',
  'monk_tiger_palm',
  'monk_rise_of_the_sun',
  'monk_crane_kick',
  'monk_tranquility_orb',
  'monk_fists_of_fury',
  'monk_sweep',
  'monk_transference',
  'monk_iron_mountain',
  'monk_thunder_fist',
];

// 新增 6 个技能 ID
const NEW_SKILL_IDS = [
  'monk_blackout_kick',
  'monk_chi_burst',
  'monk_sweeping_winds',
  'monk_chi_explosion',
  'monk_touch_of_karma',
  'monk_storm_earth_and_fire',
];

// 原有 3 个被动 ID（必须保留）
const ORIGINAL_PASSIVE_IDS = [
  'monk_drunken_mastery',
  'monk_chi_flow',
  'monk_relaxation',
];

// 新增 3 个被动 ID
const NEW_PASSIVE_IDS = [
  'monk_power_strikes',
  'monk_dampen_harm',
  'monk_combat_conditioning',
];

describe('monk 技能数据完整性', () => {
  it('技能总数为 16', () => {
    expect(monkSkills).toHaveLength(16);
  });

  it('所有技能 ID 全局唯一', () => {
    const ids = monkSkills.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('所有技能 ID 以 monk_ 前缀开头', () => {
    monkSkills.forEach(s => {
      expect(s.id.startsWith('monk_'), `技能 ${s.id} 应以 monk_ 开头`).toBe(true);
    });
  });

  it('保留原有 10 个技能 ID', () => {
    ORIGINAL_SKILL_IDS.forEach(id => {
      expect(monkSkills.find(s => s.id === id), `原技能 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 6 个技能存在', () => {
    NEW_SKILL_IDS.forEach(id => {
      expect(monkSkills.find(s => s.id === id), `新技能 ${id} 应存在`).toBeDefined();
    });
  });

  describe('双资源体系正确性（energy → chi）', () => {
    // energy 生成器：消耗 energy 并生成 chi
    const energyGenerators = monkSkills.filter(s => s.resourceType === 'energy');
    // chi 终结技：通过 scalingResource 全部消耗缩放
    const finishers = monkSkills.filter(s => s.scalingResource === 'chi');

    it('energy 生成器 resourceCost ∈ [8, 18] 且生成 chi', () => {
      expect(energyGenerators.length).toBeGreaterThanOrEqual(3);
      energyGenerators.forEach(s => {
        expect(s.resourceCost, `生成器 ${s.id} resourceCost 应在 8-18`).toBeGreaterThanOrEqual(8);
        expect(s.resourceCost, `生成器 ${s.id} resourceCost 应在 8-18`).toBeLessThanOrEqual(18);
        expect(s.generatesResource, `生成器 ${s.id} 应含 generatesResource`).toBeDefined();
        expect(s.generatesResource!.type, `生成器 ${s.id} 应生成 chi`).toBe('chi');
        expect(s.generatesResource!.amount, `生成器 ${s.id} 生成量应 > 0`).toBeGreaterThan(0);
      });
    });

    it('终结技配置 scalingResource=chi 且不设 resourceType/resourceCost', () => {
      expect(finishers.length).toBeGreaterThanOrEqual(2);
      finishers.forEach(s => {
        expect(s.scalingResource, `终结技 ${s.id} 应有 scalingResource`).toBe('chi');
        expect(s.resourceType, `终结技 ${s.id} 不应设 resourceType`).toBeUndefined();
        expect(s.resourceCost, `终结技 ${s.id} 不应设 resourceCost`).toBeUndefined();
        expect(s.generatesResource, `终结技 ${s.id} 不应含 generatesResource`).toBeUndefined();
      });
    });

    it('所有技能无 mpCost', () => {
      monkSkills.forEach(s => {
        expect(s.mpCost, `技能 ${s.id} 不应有 mpCost`).toBeUndefined();
      });
    });
  });

  describe('statKey 主属性', () => {
    it('所有 physical_damage 技能 effect.statKey 为 dex', () => {
      const physicalSkills = monkSkills.filter(s => s.type === 'physical_damage');
      physicalSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 dex`).toBe('dex');
      });
    });

    it('health_restore 技能含 statKey: dex', () => {
      const healSkills = monkSkills.filter(s => s.type === 'health_restore');
      healSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 dex`).toBe('dex');
      });
    });
  });

  describe('等级分布', () => {
    it('所有技能 unlockLevel ∈ [1, 10]', () => {
      monkSkills.forEach(s => {
        expect(s.unlockLevel).toBeGreaterThanOrEqual(1);
        expect(s.unlockLevel).toBeLessThanOrEqual(10);
      });
    });

    it('存在 Lv10 巅峰大招', () => {
      const lv10Skills = monkSkills.filter(s => s.unlockLevel === 10);
      expect(lv10Skills.length).toBeGreaterThanOrEqual(1);
    });

    it('Lv1-4 段至少 4 个技能（基础生成器/终结技）', () => {
      const lowTier = monkSkills.filter(s => s.unlockLevel <= 4);
      expect(lowTier.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('技能构成', () => {
    it('至少 3 个 buff/debuff 技能', () => {
      const buffDebuff = monkSkills.filter(s => s.type === 'buff' || s.type === 'debuff');
      expect(buffDebuff.length).toBeGreaterThanOrEqual(3);
    });

    it('至少 2 个 AOE 技能（targetType=all_enemies）', () => {
      const aoe = monkSkills.filter(s => s.targetType === 'all_enemies');
      expect(aoe.length).toBeGreaterThanOrEqual(2);
    });

    it('至少 1 个治疗技能', () => {
      const heal = monkSkills.filter(s => s.type === 'health_restore');
      expect(heal.length).toBeGreaterThanOrEqual(1);
    });

    it('buff/debuff 持续回合数在 1-5 区间', () => {
      monkSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.forEach(b => {
            expect(b.turns).toBeGreaterThanOrEqual(1);
            expect(b.turns).toBeLessThanOrEqual(5);
          });
        }
      });
    });
  });

  describe('Lv10 巅峰大招配置', () => {
    it('Lv10 大招为 chi 终结技（scalingResource）', () => {
      const lv10Skills = monkSkills.filter(s => s.unlockLevel === 10);
      expect(lv10Skills.length).toBeGreaterThanOrEqual(1);
      lv10Skills.forEach(s => {
        expect(s.scalingResource, `大招 ${s.id} 应为 scalingResource 终结技`).toBe('chi');
      });
    });
  });

  describe('数值平衡', () => {
    const physicalSingle = monkSkills.filter(s => s.type === 'physical_damage' && s.targetType === 'single');
    const physicalAoe = monkSkills.filter(s => s.type === 'physical_damage' && s.targetType === 'all_enemies');

    it('生成器单体伤害基础值在 18-30 区间', () => {
      const generators = physicalSingle.filter(s => s.resourceType === 'energy');
      generators.forEach(s => {
        expect(s.effect.value, `生成器 ${s.id} value 应在 18-30`).toBeGreaterThanOrEqual(18);
        expect(s.effect.value, `生成器 ${s.id} value 应在 18-30`).toBeLessThanOrEqual(30);
      });
    });

    it('终结技基础值在 15-25 区间（按 chi 缩放）', () => {
      const finishers = physicalSingle.filter(s => s.scalingResource === 'chi');
      finishers.forEach(s => {
        expect(s.effect.value, `终结技 ${s.id} value 应在 15-25`).toBeGreaterThanOrEqual(15);
        expect(s.effect.value, `终结技 ${s.id} value 应在 15-25`).toBeLessThanOrEqual(25);
      });
    });

    it('AOE 伤害基础值在 15-20 区间', () => {
      physicalAoe.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 15-20`).toBeGreaterThanOrEqual(15);
        expect(s.effect.value, `技能 ${s.id} value 应在 15-20`).toBeLessThanOrEqual(20);
      });
    });
  });
});

describe('monk 被动数据完整性', () => {
  it('被动总数为 6', () => {
    expect(monkPassives).toHaveLength(6);
  });

  it('所有被动 ID 以 monk_ 前缀开头', () => {
    monkPassives.forEach(p => {
      expect(p.id.startsWith('monk_'), `被动 ${p.id} 应以 monk_ 开头`).toBe(true);
    });
  });

  it('所有被动 ID 唯一', () => {
    const ids = monkPassives.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('触发时机覆盖至少 3 种不同 trigger', () => {
    const triggers = new Set(monkPassives.map(p => p.trigger));
    expect(triggers.size).toBeGreaterThanOrEqual(3);
  });

  it('保留原有 3 个被动 ID', () => {
    ORIGINAL_PASSIVE_IDS.forEach(id => {
      expect(monkPassives.find(p => p.id === id), `原被动 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 3 个被动存在', () => {
    NEW_PASSIVE_IDS.forEach(id => {
      expect(monkPassives.find(p => p.id === id), `新被动 ${id} 应存在`).toBeDefined();
    });
  });

  it('monk_power_strikes 配置概率触发（probability=0.3, value=1）', () => {
    const powerStrikes = monkPassives.find(p => p.id === 'monk_power_strikes');
    expect(powerStrikes).toBeDefined();
    expect(powerStrikes!.effect.probability).toBe(0.3);
    expect(powerStrikes!.effect.value).toBe(1);
    expect(powerStrikes!.effect.stat).toBe('chi');
    expect(powerStrikes!.effect.type).toBe('resource_gen');
  });

  it('monk_dampen_harm 配置低血减伤（condition=hp < 0.3）', () => {
    const dampenHarm = monkPassives.find(p => p.id === 'monk_dampen_harm');
    expect(dampenHarm).toBeDefined();
    expect(dampenHarm!.effect.condition).toBe('hp < 0.3');
    expect(dampenHarm!.effect.value).toBe(0.25);
    expect(dampenHarm!.effect.type).toBe('damage_reduction');
  });

  it('monk_combat_conditioning 为物理攻击力百分比修正', () => {
    const conditioning = monkPassives.find(p => p.id === 'monk_combat_conditioning');
    expect(conditioning).toBeDefined();
    expect(conditioning!.effect.type).toBe('stat_modifier');
    expect(conditioning!.effect.stat).toBe('physical_attack_multiplier');
    expect(conditioning!.effect.value).toBe(0.1);
  });
});
