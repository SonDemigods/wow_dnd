/**
 * @fileoverview rogue 职业技能数据完整性测试
 *
 * 验证 rogue 16 技能 + 6 被动的数据完整性：
 * - 技能总数 = 16
 * - 双资源体系：energy（主资源）→ combo_point（副资源）
 *   - energy 生成器：resourceType='energy'，resourceCost ∈ [8,16]，含 generatesResource
 *   - combo_point 终结技：scalingResource='combo_point'，不设 resourceType/resourceCost
 * - ID 全局唯一、以 rogue_ 开头
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

const rogueEntry = CLASS_ABILITIES.find(c => c.class_id === 'rogue');
const rogueSkills: Skill[] = rogueEntry?.skills ?? [];
const roguePassives: PassiveSkill[] = CLASS_PASSIVES.filter(p => p.classId === 'rogue');

// 原有 10 个技能 ID（必须保留）
const ORIGINAL_SKILL_IDS = [
  'rogue_shadow_strike',
  'rogue_backstab',
  'rogue_gouge',
  'rogue_mutilate',
  'rogue_poisoned_strike',
  'rogue_slice',
  'rogue_eviscerate',
  'rogue_rupture',
  'rogue_vital_strike',
  'rogue_ambush',
];

// 新增 6 个技能 ID
const NEW_SKILL_IDS = [
  'rogue_fan_of_knives',
  'rogue_shadow_dance',
  'rogue_envenom',
  'rogue_crimson_tempest',
  'rogue_preparation',
  'rogue_death_shadow',
];

// 原有 3 个被动 ID（必须保留）
const ORIGINAL_PASSIVE_IDS = [
  'rogue_lethal_strike',
  'rogue_shadowstep',
  'rogue_evasion',
];

// 新增 3 个被动 ID
const NEW_PASSIVE_IDS = [
  'rogue_opportunist',
  'rogue_shadow_resilience',
  'rogue_master_assassin',
];

describe('rogue 技能数据完整性', () => {
  it('技能总数为 16', () => {
    expect(rogueSkills).toHaveLength(16);
  });

  it('所有技能 ID 全局唯一', () => {
    const ids = rogueSkills.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('所有技能 ID 以 rogue_ 前缀开头', () => {
    rogueSkills.forEach(s => {
      expect(s.id.startsWith('rogue_'), `技能 ${s.id} 应以 rogue_ 开头`).toBe(true);
    });
  });

  it('保留原有 10 个技能 ID', () => {
    ORIGINAL_SKILL_IDS.forEach(id => {
      expect(rogueSkills.find(s => s.id === id), `原技能 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 6 个技能存在', () => {
    NEW_SKILL_IDS.forEach(id => {
      expect(rogueSkills.find(s => s.id === id), `新技能 ${id} 应存在`).toBeDefined();
    });
  });

  describe('双资源体系正确性（energy → combo_point）', () => {
    // energy 生成器：消耗 energy 并生成 combo_point
    const energyGenerators = rogueSkills.filter(s => s.resourceType === 'energy');
    // combo_point 终结技：通过 scalingResource 全部消耗缩放
    const finishers = rogueSkills.filter(s => s.scalingResource === 'combo_point');

    it('energy 生成器 resourceCost ∈ [8, 16] 且生成 combo_point', () => {
      expect(energyGenerators.length).toBeGreaterThanOrEqual(3);
      energyGenerators.forEach(s => {
        expect(s.resourceCost, `生成器 ${s.id} resourceCost 应在 8-16`).toBeGreaterThanOrEqual(8);
        expect(s.resourceCost, `生成器 ${s.id} resourceCost 应在 8-16`).toBeLessThanOrEqual(16);
        expect(s.generatesResource, `生成器 ${s.id} 应含 generatesResource`).toBeDefined();
        expect(s.generatesResource!.type, `生成器 ${s.id} 应生成 combo_point`).toBe('combo_point');
        expect(s.generatesResource!.amount, `生成器 ${s.id} 生成量应 > 0`).toBeGreaterThan(0);
      });
    });

    it('终结技配置 scalingResource=combo_point 且不设 resourceType/resourceCost', () => {
      expect(finishers.length).toBeGreaterThanOrEqual(2);
      finishers.forEach(s => {
        expect(s.scalingResource, `终结技 ${s.id} 应有 scalingResource`).toBe('combo_point');
        expect(s.resourceType, `终结技 ${s.id} 不应设 resourceType`).toBeUndefined();
        expect(s.resourceCost, `终结技 ${s.id} 不应设 resourceCost`).toBeUndefined();
        expect(s.generatesResource, `终结技 ${s.id} 不应含 generatesResource`).toBeUndefined();
      });
    });

    it('所有技能无 mpCost', () => {
      rogueSkills.forEach(s => {
        expect(s.mpCost, `技能 ${s.id} 不应有 mpCost`).toBeUndefined();
      });
    });
  });

  describe('statKey 主属性', () => {
    it('所有 physical_damage 技能 effect.statKey 为 dex', () => {
      const physicalSkills = rogueSkills.filter(s => s.type === 'physical_damage');
      physicalSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 dex`).toBe('dex');
      });
    });
  });

  describe('等级分布', () => {
    it('所有技能 unlockLevel ∈ [1, 10]', () => {
      rogueSkills.forEach(s => {
        expect(s.unlockLevel).toBeGreaterThanOrEqual(1);
        expect(s.unlockLevel).toBeLessThanOrEqual(10);
      });
    });

    it('存在 Lv10 巅峰大招', () => {
      const lv10Skills = rogueSkills.filter(s => s.unlockLevel === 10);
      expect(lv10Skills.length).toBeGreaterThanOrEqual(1);
    });

    it('Lv1-4 段至少 4 个技能（基础生成器）', () => {
      const lowTier = rogueSkills.filter(s => s.unlockLevel <= 4);
      expect(lowTier.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('技能构成', () => {
    it('至少 3 个 buff/debuff 技能', () => {
      const buffDebuff = rogueSkills.filter(s => s.type === 'buff' || s.type === 'debuff');
      expect(buffDebuff.length).toBeGreaterThanOrEqual(3);
    });

    it('至少 2 个 AOE 技能（targetType=all_enemies）', () => {
      const aoe = rogueSkills.filter(s => s.targetType === 'all_enemies');
      expect(aoe.length).toBeGreaterThanOrEqual(2);
    });

    it('含控制效果（stun）', () => {
      const hasControl = rogueSkills.some(s => s.buffs?.some(b => b.type === 'stun'));
      expect(hasControl, '应至少存在一个含 stun 的技能').toBe(true);
    });

    it('buff/debuff 持续回合数在 1-5 区间', () => {
      rogueSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.forEach(b => {
            expect(b.turns).toBeGreaterThanOrEqual(1);
            expect(b.turns).toBeLessThanOrEqual(5);
          });
        }
      });
    });

    it('控制效果（stun）持续 1 回合', () => {
      rogueSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.filter(b => b.type === 'stun').forEach(b => {
            expect(b.turns, `技能 ${s.id} 的 stun 应持续 1 回合`).toBe(1);
          });
        }
      });
    });
  });

  describe('Lv10 巅峰大招配置', () => {
    it('Lv10 大招为 combo_point 终结技（scalingResource）', () => {
      const lv10Skills = rogueSkills.filter(s => s.unlockLevel === 10);
      expect(lv10Skills.length).toBeGreaterThanOrEqual(1);
      lv10Skills.forEach(s => {
        expect(s.scalingResource, `大招 ${s.id} 应为 scalingResource 终结技`).toBe('combo_point');
      });
    });
  });

  describe('数值平衡', () => {
    const physicalSingle = rogueSkills.filter(s => s.type === 'physical_damage' && s.targetType === 'single');
    const physicalAoe = rogueSkills.filter(s => s.type === 'physical_damage' && s.targetType === 'all_enemies');

    it('生成器单体伤害基础值在 18-30 区间', () => {
      const generators = physicalSingle.filter(s => s.resourceType === 'energy');
      generators.forEach(s => {
        expect(s.effect.value, `生成器 ${s.id} value 应在 18-30`).toBeGreaterThanOrEqual(18);
        expect(s.effect.value, `生成器 ${s.id} value 应在 18-30`).toBeLessThanOrEqual(30);
      });
    });

    it('终结技基础值在 12-18 区间（按 combo_point 缩放）', () => {
      const finishers = physicalSingle.filter(s => s.scalingResource === 'combo_point');
      finishers.forEach(s => {
        expect(s.effect.value, `终结技 ${s.id} value 应在 12-18`).toBeGreaterThanOrEqual(12);
        expect(s.effect.value, `终结技 ${s.id} value 应在 12-18`).toBeLessThanOrEqual(18);
      });
    });

    it('AOE 伤害基础值在 12-18 区间', () => {
      physicalAoe.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 12-18`).toBeGreaterThanOrEqual(12);
        expect(s.effect.value, `技能 ${s.id} value 应在 12-18`).toBeLessThanOrEqual(18);
      });
    });
  });
});

describe('rogue 被动数据完整性', () => {
  it('被动总数为 6', () => {
    expect(roguePassives).toHaveLength(6);
  });

  it('所有被动 ID 以 rogue_ 前缀开头', () => {
    roguePassives.forEach(p => {
      expect(p.id.startsWith('rogue_'), `被动 ${p.id} 应以 rogue_ 开头`).toBe(true);
    });
  });

  it('所有被动 ID 唯一', () => {
    const ids = roguePassives.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('触发时机覆盖至少 3 种不同 trigger', () => {
    const triggers = new Set(roguePassives.map(p => p.trigger));
    expect(triggers.size).toBeGreaterThanOrEqual(3);
  });

  it('保留原有 3 个被动 ID', () => {
    ORIGINAL_PASSIVE_IDS.forEach(id => {
      expect(roguePassives.find(p => p.id === id), `原被动 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 3 个被动存在', () => {
    NEW_PASSIVE_IDS.forEach(id => {
      expect(roguePassives.find(p => p.id === id), `新被动 ${id} 应存在`).toBeDefined();
    });
  });

  it('rogue_opportunist 配置概率触发（probability=0.3, value=1）', () => {
    const opportunist = roguePassives.find(p => p.id === 'rogue_opportunist');
    expect(opportunist).toBeDefined();
    expect(opportunist!.effect.probability).toBe(0.3);
    expect(opportunist!.effect.value).toBe(1);
    expect(opportunist!.effect.stat).toBe('combo_point');
    expect(opportunist!.effect.type).toBe('resource_gen');
  });

  it('rogue_master_assassin 配置目标低血条件（condition=target_hp < 0.2）', () => {
    const masterAssassin = roguePassives.find(p => p.id === 'rogue_master_assassin');
    expect(masterAssassin).toBeDefined();
    expect(masterAssassin!.effect.condition).toBe('target_hp < 0.2');
    expect(masterAssassin!.effect.value).toBe(0.15);
    expect(masterAssassin!.effect.stat).toBe('physical_attack');
    expect(masterAssassin!.effect.type).toBe('stat_modifier');
  });

  it('rogue_shadow_resilience 配置低血减伤（condition=hp < 0.3）', () => {
    const shadowResilience = roguePassives.find(p => p.id === 'rogue_shadow_resilience');
    expect(shadowResilience).toBeDefined();
    expect(shadowResilience!.effect.condition).toBe('hp < 0.3');
    expect(shadowResilience!.effect.value).toBe(0.2);
    expect(shadowResilience!.effect.type).toBe('damage_reduction');
  });
});
