/**
 * @fileoverview priest 职业技能数据完整性测试
 *
 * 验证 priest 16 技能 + 6 被动的数据完整性：
 * - 技能总数 = 16
 * - 资源类型全部为 mp（纯 MP 职业），无 resourceType/resourceCost
 * - ID 全局唯一、unlockLevel ∈ [1, 10]
 * - magic_damage / health_restore 技能均含 statKey: 'wis'
 * - 构成：≥3 buff/debuff + ≥2 AOE + 1 Lv10 巅峰大招（mpCost 30）
 * - 数值区间合理性（单体/AOE/buff 持续回合）
 * - 被动总数 = 6，触发时机覆盖 ≥ 3 种
 */
import { describe, it, expect } from 'vitest';
import { CLASS_ABILITIES } from '@/data/config_skills';
import { CLASS_PASSIVES } from '@/data/config_class_passives';
import type { Skill } from '@/modules/skill/types';
import type { PassiveSkill } from '@/modules/character/types';

const priestEntry = CLASS_ABILITIES.find(c => c.class_id === 'priest');
const priestSkills: Skill[] = priestEntry?.skills ?? [];
const priestPassives: PassiveSkill[] = CLASS_PASSIVES.filter(p => p.classId === 'priest');

describe('priest 技能数据完整性', () => {
  it('技能总数为 16', () => {
    expect(priestSkills).toHaveLength(16);
  });

  it('所有技能 ID 全局唯一', () => {
    const ids = priestSkills.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('所有技能 ID 以 priest_ 前缀开头', () => {
    priestSkills.forEach(s => {
      expect(s.id.startsWith('priest_'), `技能 ${s.id} 应以 priest_ 开头`).toBe(true);
    });
  });

  it('保留原有 10 个技能 ID', () => {
    const originalIds = [
      'priest_heal',
      'priest_fast_heal',
      'priest_smite',
      'priest_holy_fire',
      'priest_lightwell',
      'priest_renew',
      'priest_mind_flay',
      'priest_prayer_of_healing',
      'priest_holy_nova',
      'priest_divine_hymn',
    ];
    originalIds.forEach(id => {
      expect(priestSkills.find(s => s.id === id), `原技能 ${id} 应保留`).toBeDefined();
    });
  });

  describe('资源消耗正确性（纯 MP 职业）', () => {
    it('所有技能有 mpCost', () => {
      priestSkills.forEach(s => {
        expect(s.mpCost, `技能 ${s.id} 应有 mpCost`).toBeDefined();
      });
    });

    it('所有技能无 resourceType', () => {
      priestSkills.forEach(s => {
        expect(s.resourceType, `技能 ${s.id} 不应有 resourceType`).toBeUndefined();
      });
    });

    it('所有技能无 resourceCost', () => {
      priestSkills.forEach(s => {
        expect(s.resourceCost, `技能 ${s.id} 不应有 resourceCost`).toBeUndefined();
      });
    });

    it('所有技能无 generatesResource', () => {
      priestSkills.forEach(s => {
        expect(s.generatesResource, `技能 ${s.id} 不应有 generatesResource`).toBeUndefined();
      });
    });

    it('mpCost 全部在 8-30 区间', () => {
      priestSkills.forEach(s => {
        expect(s.mpCost!, `技能 ${s.id} mpCost 应在 8-30`).toBeGreaterThanOrEqual(8);
        expect(s.mpCost!, `技能 ${s.id} mpCost 应在 8-30`).toBeLessThanOrEqual(30);
      });
    });
  });

  describe('等级分布', () => {
    it('所有技能 unlockLevel ∈ [1, 10]', () => {
      priestSkills.forEach(s => {
        expect(s.unlockLevel).toBeGreaterThanOrEqual(1);
        expect(s.unlockLevel).toBeLessThanOrEqual(10);
      });
    });

    it('存在 Lv10 巅峰大招', () => {
      const lv10Skills = priestSkills.filter(s => s.unlockLevel === 10);
      expect(lv10Skills.length).toBeGreaterThanOrEqual(1);
    });

    it('Lv1-4 段至少 4 个技能（基础技能）', () => {
      const lowTier = priestSkills.filter(s => s.unlockLevel <= 4);
      expect(lowTier.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('statKey 主属性（智慧 wis）', () => {
    it('所有 magic_damage 技能 effect.statKey 为 wis', () => {
      const magicSkills = priestSkills.filter(s => s.type === 'magic_damage');
      magicSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 wis`).toBe('wis');
      });
    });

    it('所有 health_restore 技能 effect.statKey 为 wis', () => {
      const healSkills = priestSkills.filter(s => s.type === 'health_restore');
      healSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 wis`).toBe('wis');
      });
    });
  });

  describe('技能构成', () => {
    it('至少 3 个 buff/debuff 技能', () => {
      const buffDebuff = priestSkills.filter(s => s.type === 'buff' || s.type === 'debuff');
      expect(buffDebuff.length).toBeGreaterThanOrEqual(3);
    });

    it('至少 2 个 AOE 技能（targetType=all_enemies）', () => {
      const aoe = priestSkills.filter(s => s.targetType === 'all_enemies');
      expect(aoe.length).toBeGreaterThanOrEqual(2);
    });

    it('buff/debuff 持续回合数在 1-5 区间', () => {
      priestSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.forEach(b => {
            expect(b.turns).toBeGreaterThanOrEqual(1);
            expect(b.turns).toBeLessThanOrEqual(5);
          });
        }
      });
    });
  });

  describe('数值平衡', () => {
    const magicSingle = priestSkills.filter(s => s.type === 'magic_damage' && s.targetType === 'single');
    const magicAoe = priestSkills.filter(s => s.type === 'magic_damage' && s.targetType === 'all_enemies');
    const healSingle = priestSkills.filter(s => s.type === 'health_restore' && s.targetType === 'single');

    it('单体魔法伤害基础值在 15-35 区间', () => {
      magicSingle.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 15-35`).toBeGreaterThanOrEqual(15);
        expect(s.effect.value, `技能 ${s.id} value 应在 15-35`).toBeLessThanOrEqual(35);
      });
    });

    it('AOE 魔法伤害基础值在 20-50 区间', () => {
      magicAoe.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 20-50`).toBeGreaterThanOrEqual(20);
        expect(s.effect.value, `技能 ${s.id} value 应在 20-50`).toBeLessThanOrEqual(50);
      });
    });

    it('单体治疗基础值在 15-70 区间', () => {
      healSingle.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 15-70`).toBeGreaterThanOrEqual(15);
        expect(s.effect.value, `技能 ${s.id} value 应在 15-70`).toBeLessThanOrEqual(70);
      });
    });

    it('Lv10 巅峰大招（苦修）为 AOE 且 mpCost 为 30', () => {
      const lv10 = priestSkills.find(s => s.unlockLevel === 10);
      expect(lv10, '应存在 Lv10 大招').toBeDefined();
      expect(lv10!.mpCost).toBe(30);
      expect(lv10!.targetType).toBe('all_enemies');
    });

    it('Lv10 大招魔法伤害高于 Lv8 AOE 伤害', () => {
      const lv10 = priestSkills.filter(s => s.unlockLevel === 10 && s.type === 'magic_damage');
      const lv8 = priestSkills.filter(s => s.unlockLevel === 8 && s.type === 'magic_damage');
      if (lv10.length > 0 && lv8.length > 0) {
        const lv10Max = Math.max(...lv10.map(s => s.effect.value));
        const lv8Max = Math.max(...lv8.map(s => s.effect.value));
        expect(lv10Max).toBeGreaterThan(lv8Max);
      }
    });
  });
});

describe('priest 被动数据完整性', () => {
  it('被动总数为 6', () => {
    expect(priestPassives).toHaveLength(6);
  });

  it('所有被动 ID 以 priest_ 前缀开头', () => {
    priestPassives.forEach(p => {
      expect(p.id.startsWith('priest_'), `被动 ${p.id} 应以 priest_ 开头`).toBe(true);
    });
  });

  it('所有被动 ID 唯一', () => {
    const ids = priestPassives.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('触发时机覆盖至少 3 种不同 trigger', () => {
    const triggers = new Set(priestPassives.map(p => p.trigger));
    expect(triggers.size).toBeGreaterThanOrEqual(3);
  });

  it('保留原有 3 个被动 ID', () => {
    const originalIds = ['priest_faith', 'priest_holy_meditation', 'priest_shadow_protection'];
    originalIds.forEach(id => {
      expect(priestPassives.find(p => p.id === id), `原被动 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 3 个被动存在', () => {
    const newIds = ['priest_divine_favor', 'priest_shadow_affinity', 'priest_faith_guardian'];
    newIds.forEach(id => {
      expect(priestPassives.find(p => p.id === id), `新被动 ${id} 应存在`).toBeDefined();
    });
  });

  it('priest_divine_favor 配置魔法攻击加成（stat=magic_attack_multiplier, value=0.1）', () => {
    const divineFavor = priestPassives.find(p => p.id === 'priest_divine_favor');
    expect(divineFavor).toBeDefined();
    expect(divineFavor!.effect.type).toBe('stat_modifier');
    expect(divineFavor!.effect.stat).toBe('magic_attack_multiplier');
    expect(divineFavor!.effect.value).toBe(0.1);
  });

  it('priest_shadow_affinity 配置攻击吸血（on_attack, heal, value=0.08）', () => {
    const shadowAffinity = priestPassives.find(p => p.id === 'priest_shadow_affinity');
    expect(shadowAffinity).toBeDefined();
    expect(shadowAffinity!.trigger).toBe('on_attack');
    expect(shadowAffinity!.effect.type).toBe('heal');
    expect(shadowAffinity!.effect.value).toBe(0.08);
  });

  it('priest_faith_guardian 配置低血减伤（on_low_hp, damage_reduction, value=0.15）', () => {
    const faithGuardian = priestPassives.find(p => p.id === 'priest_faith_guardian');
    expect(faithGuardian).toBeDefined();
    expect(faithGuardian!.trigger).toBe('on_low_hp');
    expect(faithGuardian!.effect.type).toBe('damage_reduction');
    expect(faithGuardian!.effect.value).toBe(0.15);
    expect(faithGuardian!.effect.condition).toBe('hp < 0.3');
  });
});
