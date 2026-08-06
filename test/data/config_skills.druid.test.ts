/**
 * @fileoverview druid 职业技能数据完整性测试
 *
 * 验证 druid 16 技能 + 6 被动的数据完整性：
 * - 技能总数 = 16，ID 全局唯一且以 druid_ 开头
 * - 保留原有 10 个技能 ID，新增 6 个技能
 * - 资源消耗为纯 MP（mpCost ∈ [8, 30]，无 resourceType）
 * - 所有 magic_damage / health_restore 技能 statKey 为 'wis'
 * - unlockLevel ∈ [1, 10]，存在 Lv10 巅峰大招
 * - 构成：≥3 buff/debuff（含控制）+ ≥2 AOE
 * - 被动总数 = 6，触发时机 ≥ 3 种，保留原有 3 个、新增 3 个
 */
import { describe, it, expect } from 'vitest';
import { CLASS_ABILITIES } from '@/data/config_skills';
import { CLASS_PASSIVES } from '@/data/config_class_passives';
import type { Skill } from '@/modules/skill/types';
import type { PassiveSkill } from '@/modules/character/types';

const druidEntry = CLASS_ABILITIES.find(c => c.class_id === 'druid');
const druidSkills: Skill[] = druidEntry?.skills ?? [];
const druidPassives: PassiveSkill[] = CLASS_PASSIVES.filter(p => p.classId === 'druid');

describe('druid 技能数据完整性', () => {
  it('技能总数为 16', () => {
    expect(druidSkills).toHaveLength(16);
  });

  it('所有技能 ID 全局唯一', () => {
    const ids = druidSkills.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('所有技能 ID 以 druid_ 前缀开头', () => {
    druidSkills.forEach(s => {
      expect(s.id.startsWith('druid_'), `技能 ${s.id} 应以 druid_ 开头`).toBe(true);
    });
  });

  it('保留原有 10 个技能 ID', () => {
    const originalIds = [
      'druid_starfire',
      'druid_wrath',
      'druid_moonfire',
      'druid_rejuvenation',
      'druid_regrowth',
      'druid_thorns',
      'druid_feral_charge',
      'druid_berserking_regeneration',
      'druid_shred',
      'druid_stars_fall',
    ];
    originalIds.forEach(id => {
      expect(druidSkills.find(s => s.id === id), `原技能 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 6 个技能存在', () => {
    const newIds = [
      'druid_sunfire',
      'druid_lifebloom',
      'druid_entangling_roots',
      'druid_barkskin',
      'druid_hurricane',
      'druid_typhoon',
    ];
    newIds.forEach(id => {
      expect(druidSkills.find(s => s.id === id), `新技能 ${id} 应存在`).toBeDefined();
    });
  });

  describe('资源消耗正确性（纯 MP 职业）', () => {
    it('所有技能有 mpCost', () => {
      druidSkills.forEach(s => {
        expect(s.mpCost, `技能 ${s.id} 应有 mpCost`).toBeDefined();
      });
    });

    it('所有技能无 resourceType', () => {
      druidSkills.forEach(s => {
        expect(s.resourceType, `技能 ${s.id} 不应有 resourceType`).toBeUndefined();
      });
    });

    it('所有技能无 resourceCost', () => {
      druidSkills.forEach(s => {
        expect(s.resourceCost, `技能 ${s.id} 不应有 resourceCost`).toBeUndefined();
      });
    });

    it('所有技能无 generatesResource', () => {
      druidSkills.forEach(s => {
        expect(s.generatesResource, `技能 ${s.id} 不应有 generatesResource`).toBeUndefined();
      });
    });

    it('所有技能 mpCost 在 8-30 区间', () => {
      druidSkills.forEach(s => {
        expect(s.mpCost!, `技能 ${s.id} mpCost 应 >= 8`).toBeGreaterThanOrEqual(8);
        expect(s.mpCost!, `技能 ${s.id} mpCost 应 <= 30`).toBeLessThanOrEqual(30);
      });
    });
  });

  describe('等级分布', () => {
    it('所有技能 unlockLevel ∈ [1, 10]', () => {
      druidSkills.forEach(s => {
        expect(s.unlockLevel).toBeGreaterThanOrEqual(1);
        expect(s.unlockLevel).toBeLessThanOrEqual(10);
      });
    });

    it('存在 Lv10 巅峰大招', () => {
      const lv10Skills = druidSkills.filter(s => s.unlockLevel === 10);
      expect(lv10Skills.length).toBeGreaterThanOrEqual(1);
    });

    it('Lv1 段至少 2 个基础技能', () => {
      const lv1Skills = druidSkills.filter(s => s.unlockLevel === 1);
      expect(lv1Skills.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('statKey 主属性', () => {
    it('所有 magic_damage 技能 effect.statKey 为 wis', () => {
      const magicSkills = druidSkills.filter(s => s.type === 'magic_damage');
      magicSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 wis`).toBe('wis');
      });
    });

    it('所有 health_restore 技能 effect.statKey 为 wis', () => {
      const healSkills = druidSkills.filter(s => s.type === 'health_restore');
      healSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 wis`).toBe('wis');
      });
    });
  });

  describe('技能构成', () => {
    it('至少 3 个 buff/debuff 技能', () => {
      const buffDebuff = druidSkills.filter(s => s.type === 'buff' || s.type === 'debuff');
      expect(buffDebuff.length).toBeGreaterThanOrEqual(3);
    });

    it('至少 2 个 AOE 技能（targetType=all_enemies）', () => {
      const aoe = druidSkills.filter(s => s.targetType === 'all_enemies');
      expect(aoe.length).toBeGreaterThanOrEqual(2);
    });

    it('buff/debuff 持续回合数在 1-5 区间', () => {
      druidSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.forEach(b => {
            expect(b.turns).toBeGreaterThanOrEqual(1);
            expect(b.turns).toBeLessThanOrEqual(5);
          });
        }
      });
    });

    it('控制效果（stun）持续 1 回合', () => {
      druidSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.filter(b => b.type === 'stun').forEach(b => {
            expect(b.turns, `技能 ${s.id} 的 stun 应持续 1 回合`).toBe(1);
          });
        }
      });
    });
  });

  describe('数值平衡', () => {
    const magicSingle = druidSkills.filter(s => s.type === 'magic_damage' && s.targetType === 'single');
    const magicAoe = druidSkills.filter(s => s.type === 'magic_damage' && s.targetType === 'all_enemies');
    const healSkills = druidSkills.filter(s => s.type === 'health_restore');

    it('单体魔法伤害基础值在 12-30 区间', () => {
      magicSingle.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 12-30`).toBeGreaterThanOrEqual(12);
        expect(s.effect.value, `技能 ${s.id} value 应在 12-30`).toBeLessThanOrEqual(30);
      });
    });

    it('AOE 魔法伤害基础值在 25-60 区间', () => {
      magicAoe.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 25-60`).toBeGreaterThanOrEqual(25);
        expect(s.effect.value, `技能 ${s.id} value 应在 25-60`).toBeLessThanOrEqual(60);
      });
    });

    it('生命恢复基础值在 15-35 区间', () => {
      healSkills.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 15-35`).toBeGreaterThanOrEqual(15);
        expect(s.effect.value, `技能 ${s.id} value 应在 15-35`).toBeLessThanOrEqual(35);
      });
    });

    it('Lv10 大招基础值高于 Lv9 AOE 技能', () => {
      const lv10 = druidSkills.filter(s => s.unlockLevel === 10);
      const lv9Aoe = druidSkills.filter(s => s.unlockLevel === 9 && s.targetType === 'all_enemies');
      if (lv10.length > 0 && lv9Aoe.length > 0) {
        const lv10Max = Math.max(...lv10.map(s => s.effect.value));
        const lv9Max = Math.max(...lv9Aoe.map(s => s.effect.value));
        expect(lv10Max).toBeGreaterThan(lv9Max);
      }
    });

    it('Lv10 巅峰大招 mpCost 为 30', () => {
      const lv10Ultimate = druidSkills.find(s => s.unlockLevel === 10);
      expect(lv10Ultimate).toBeDefined();
      expect(lv10Ultimate!.mpCost).toBe(30);
      expect(lv10Ultimate!.targetType).toBe('all_enemies');
    });
  });
});

describe('druid 被动数据完整性', () => {
  it('被动总数为 6', () => {
    expect(druidPassives).toHaveLength(6);
  });

  it('所有被动 ID 以 druid_ 前缀开头', () => {
    druidPassives.forEach(p => {
      expect(p.id.startsWith('druid_'), `被动 ${p.id} 应以 druid_ 开头`).toBe(true);
    });
  });

  it('所有被动 ID 唯一', () => {
    const ids = druidPassives.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('触发时机覆盖至少 3 种不同 trigger', () => {
    const triggers = new Set(druidPassives.map(p => p.trigger));
    expect(triggers.size).toBeGreaterThanOrEqual(3);
  });

  it('保留原有 3 个被动 ID', () => {
    const originalIds = ['druid_natural_healing', 'druid_thick_hide', 'druid_wild_instinct'];
    originalIds.forEach(id => {
      expect(druidPassives.find(p => p.id === id), `原被动 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 3 个被动存在', () => {
    const newIds = ['druid_moonkin_form', 'druid_survival_instinct', 'druid_natures_guardian'];
    newIds.forEach(id => {
      expect(druidPassives.find(p => p.id === id), `新被动 ${id} 应存在`).toBeDefined();
    });
  });

  it('druid_moonkin_form 配置战斗开始恢复法力（on_combat_start, mana, 15）', () => {
    const moonkinForm = druidPassives.find(p => p.id === 'druid_moonkin_form');
    expect(moonkinForm).toBeDefined();
    expect(moonkinForm!.trigger).toBe('on_combat_start');
    expect(moonkinForm!.effect.type).toBe('resource_gen');
    expect(moonkinForm!.effect.stat).toBe('mana');
    expect(moonkinForm!.effect.value).toBe(15);
  });

  it('druid_survival_instinct 配置低血减伤条件（on_low_hp, hp < 0.3, 20%）', () => {
    const survivalInstinct = druidPassives.find(p => p.id === 'druid_survival_instinct');
    expect(survivalInstinct).toBeDefined();
    expect(survivalInstinct!.trigger).toBe('on_low_hp');
    expect(survivalInstinct!.effect.type).toBe('damage_reduction');
    expect(survivalInstinct!.effect.condition).toBe('hp < 0.3');
    expect(survivalInstinct!.effect.value).toBe(0.2);
  });

  it('druid_natures_guardian 配置击杀回血（on_kill, 8%）', () => {
    const naturesGuardian = druidPassives.find(p => p.id === 'druid_natures_guardian');
    expect(naturesGuardian).toBeDefined();
    expect(naturesGuardian!.trigger).toBe('on_kill');
    expect(naturesGuardian!.effect.type).toBe('heal');
    expect(naturesGuardian!.effect.value).toBe(0.08);
  });
});
