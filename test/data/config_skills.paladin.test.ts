/**
 * @fileoverview paladin 职业技能数据完整性测试
 *
 * 验证 paladin 16 技能 + 6 被动的数据完整性：
 * - 技能总数 = 16
 * - 双资源循环：MP 生成器（含 mpCost + generatesResource）→ holy_power 终结技（含 resourceType/resourceCost）
 * - ID 全局唯一、以 paladin_ 前缀开头、unlockLevel ∈ [1, 10]
 * - 所有 magic_damage/health_restore 技能 effect.statKey 为 'cha'
 * - 构成：≥3 buff/debuff + ≥2 AOE + 1 Lv10 大招
 * - 生成器数量 ≥ 3，终结技数量 ≥ 2
 * - 被动总数 = 6，触发时机覆盖 ≥ 3 种
 */
import { describe, it, expect } from 'vitest';
import { CLASS_ABILITIES } from '@/data/config_skills';
import { CLASS_PASSIVES } from '@/data/config_class_passives';
import type { Skill } from '@/modules/skill/types';
import type { PassiveSkill } from '@/modules/character/types';

const paladinEntry = CLASS_ABILITIES.find(c => c.class_id === 'paladin');
const paladinSkills: Skill[] = paladinEntry?.skills ?? [];
const paladinPassives: PassiveSkill[] = CLASS_PASSIVES.filter(p => p.classId === 'paladin');

describe('paladin 技能数据完整性', () => {
  it('技能总数为 16', () => {
    expect(paladinSkills).toHaveLength(16);
  });

  it('所有技能 ID 全局唯一', () => {
    const ids = paladinSkills.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('所有技能 ID 以 paladin_ 前缀开头', () => {
    paladinSkills.forEach(s => {
      expect(s.id.startsWith('paladin_'), `技能 ${s.id} 应以 paladin_ 开头`).toBe(true);
    });
  });

  it('保留原有 10 个技能 ID', () => {
    const originalIds = [
      'paladin_holy_light',
      'paladin_divine_judgment',
      'paladin_avengers_shield',
      'paladin_flash_of_light',
      'paladin_consecration',
      'paladin_divine_strike',
      'paladin_divine_shock',
      'paladin_greater_heal',
      'paladin_judgment',
      'paladin_divine_storm',
    ];
    originalIds.forEach(id => {
      expect(paladinSkills.find(s => s.id === id), `原技能 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 6 个技能存在', () => {
    const newIds = [
      'paladin_hammer_of_justice',
      'paladin_shield_of_the_righteous',
      'paladin_holy_wrath',
      'paladin_lay_on_hands',
      'paladin_divine_protection',
      'paladin_light_of_dawn',
    ];
    newIds.forEach(id => {
      expect(paladinSkills.find(s => s.id === id), `新技能 ${id} 应存在`).toBeDefined();
    });
  });

  describe('双资源循环正确性', () => {
    // MP 生成器：消耗 MP 并产出 holy_power
    const mpGenerators = paladinSkills.filter(s => s.generatesResource !== undefined);
    // holy_power 终结技：消耗 holy_power 副资源
    const holyPowerFinishers = paladinSkills.filter(s => s.resourceType === 'holy_power');

    it('MP 生成器（含 generatesResource）数量为 10', () => {
      expect(mpGenerators).toHaveLength(10);
    });

    it('MP 生成器全部含 mpCost', () => {
      mpGenerators.forEach(s => {
        expect(s.mpCost, `生成器 ${s.id} 应含 mpCost`).toBeDefined();
        expect(s.mpCost!).toBeGreaterThan(0);
      });
    });

    it('MP 生成器全部不含 resourceType/resourceCost', () => {
      mpGenerators.forEach(s => {
        expect(s.resourceType, `生成器 ${s.id} 不应含 resourceType`).toBeUndefined();
        expect(s.resourceCost, `生成器 ${s.id} 不应含 resourceCost`).toBeUndefined();
      });
    });

    it('MP 生成器全部产出 holy_power 且 amount=1', () => {
      mpGenerators.forEach(s => {
        expect(s.generatesResource!.type, `生成器 ${s.id} 产出的应为 holy_power`).toBe('holy_power');
        expect(s.generatesResource!.amount, `生成器 ${s.id} 产出量应为 1`).toBe(1);
      });
    });

    it('holy_power 终结技数量为 6', () => {
      expect(holyPowerFinishers).toHaveLength(6);
    });

    it('holy_power 终结技全部含 resourceType=holy_power 且有 resourceCost', () => {
      holyPowerFinishers.forEach(s => {
        expect(s.resourceType, `终结技 ${s.id} resourceType 应为 holy_power`).toBe('holy_power');
        expect(s.resourceCost, `终结技 ${s.id} 应含 resourceCost`).toBeDefined();
        expect(s.resourceCost!).toBeGreaterThanOrEqual(1);
        expect(s.resourceCost!).toBeLessThanOrEqual(4);
      });
    });

    it('holy_power 终结技全部不含 mpCost 与 generatesResource', () => {
      holyPowerFinishers.forEach(s => {
        expect(s.mpCost, `终结技 ${s.id} 不应含 mpCost`).toBeUndefined();
        expect(s.generatesResource, `终结技 ${s.id} 不应含 generatesResource`).toBeUndefined();
      });
    });

    it('无 resourceType 的技能必须含 mpCost', () => {
      paladinSkills.forEach(s => {
        if (s.resourceType === undefined) {
          expect(s.mpCost, `技能 ${s.id} 无 resourceType 则必须含 mpCost`).toBeDefined();
        }
      });
    });

    it('生成器数量 ≥ 3 且终结技数量 ≥ 2', () => {
      expect(mpGenerators.length).toBeGreaterThanOrEqual(3);
      expect(holyPowerFinishers.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('statKey 主属性', () => {
    it('所有 magic_damage 技能 effect.statKey 为 cha', () => {
      const magicSkills = paladinSkills.filter(s => s.type === 'magic_damage');
      magicSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 cha`).toBe('cha');
      });
    });

    it('所有 health_restore 技能 effect.statKey 为 cha', () => {
      const healSkills = paladinSkills.filter(s => s.type === 'health_restore');
      healSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 cha`).toBe('cha');
      });
    });

    it('paladin_divine_strike 虽为 physical_damage 但 statKey 为 cha（主属性）', () => {
      const divineStrike = paladinSkills.find(s => s.id === 'paladin_divine_strike');
      expect(divineStrike).toBeDefined();
      expect(divineStrike!.type).toBe('physical_damage');
      expect(divineStrike!.effect.statKey).toBe('cha');
    });
  });

  describe('等级分布', () => {
    it('所有技能 unlockLevel ∈ [1, 10]', () => {
      paladinSkills.forEach(s => {
        expect(s.unlockLevel).toBeGreaterThanOrEqual(1);
        expect(s.unlockLevel).toBeLessThanOrEqual(10);
      });
    });

    it('存在 Lv10 巅峰大招', () => {
      const lv10Skills = paladinSkills.filter(s => s.unlockLevel === 10);
      expect(lv10Skills.length).toBeGreaterThanOrEqual(1);
    });

    it('Lv10 大招为 paladin_light_of_dawn（holy_power 4 终结技）', () => {
      const lv10 = paladinSkills.find(s => s.unlockLevel === 10);
      expect(lv10).toBeDefined();
      expect(lv10!.id).toBe('paladin_light_of_dawn');
      expect(lv10!.resourceType).toBe('holy_power');
      expect(lv10!.resourceCost).toBe(4);
    });

    it('Lv1-4 段至少 4 个技能（基础生成器与早期终结技）', () => {
      const lowTier = paladinSkills.filter(s => s.unlockLevel <= 4);
      expect(lowTier.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('技能构成', () => {
    it('至少 3 个 buff/debuff 技能', () => {
      const buffDebuff = paladinSkills.filter(s => s.type === 'buff' || s.type === 'debuff');
      expect(buffDebuff.length).toBeGreaterThanOrEqual(3);
    });

    it('至少 2 个 AOE 技能（targetType=all_enemies）', () => {
      const aoe = paladinSkills.filter(s => s.targetType === 'all_enemies');
      expect(aoe.length).toBeGreaterThanOrEqual(2);
    });

    it('AOE 技能数量为 5（avengers_shield, consecration, divine_storm, holy_wrath, light_of_dawn）', () => {
      const aoe = paladinSkills.filter(s => s.targetType === 'all_enemies');
      expect(aoe).toHaveLength(5);
    });

    it('buff/debuff 持续回合数在 1-5 区间', () => {
      paladinSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.forEach(b => {
            expect(b.turns).toBeGreaterThanOrEqual(1);
            expect(b.turns).toBeLessThanOrEqual(5);
          });
        }
      });
    });

    it('控制效果（stun）持续 1 回合', () => {
      paladinSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.filter(b => b.type === 'stun').forEach(b => {
            expect(b.turns, `技能 ${s.id} 的 stun 应持续 1 回合`).toBe(1);
          });
        }
      });
    });

    it('paladin_hammer_of_justice 含 stun 控制效果', () => {
      const hammer = paladinSkills.find(s => s.id === 'paladin_hammer_of_justice');
      expect(hammer).toBeDefined();
      expect(hammer!.type).toBe('debuff');
      const stun = hammer!.buffs?.find(b => b.type === 'stun');
      expect(stun, '公正之锤应含 stun 效果').toBeDefined();
    });
  });

  describe('数值平衡', () => {
    const magicSingle = paladinSkills.filter(s => s.type === 'magic_damage' && s.targetType === 'single');
    const magicAoe = paladinSkills.filter(s => s.type === 'magic_damage' && s.targetType === 'all_enemies');

    it('单体魔法伤害基础值在 15-60 区间', () => {
      magicSingle.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 15-60`).toBeGreaterThanOrEqual(15);
        expect(s.effect.value, `技能 ${s.id} value 应在 15-60`).toBeLessThanOrEqual(60);
      });
    });

    it('AOE 魔法伤害基础值在 15-60 区间', () => {
      magicAoe.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 15-60`).toBeGreaterThanOrEqual(15);
        expect(s.effect.value, `技能 ${s.id} value 应在 15-60`).toBeLessThanOrEqual(60);
      });
    });

    it('治疗技能基础值在 15-60 区间', () => {
      const healSkills = paladinSkills.filter(s => s.type === 'health_restore');
      healSkills.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 15-60`).toBeGreaterThanOrEqual(15);
        expect(s.effect.value, `技能 ${s.id} value 应在 15-60`).toBeLessThanOrEqual(60);
      });
    });

    it('Lv10 大招基础值高于 Lv9 中阶技能', () => {
      const lv10 = paladinSkills.filter(s => s.unlockLevel === 10);
      const lv9 = paladinSkills.filter(s => s.unlockLevel === 9);
      if (lv10.length > 0 && lv9.length > 0) {
        const lv10Max = Math.max(...lv10.map(s => s.effect.value));
        const lv9Max = Math.max(...lv9.map(s => s.effect.value));
        expect(lv10Max).toBeGreaterThanOrEqual(lv9Max);
      }
    });
  });
});

describe('paladin 被动数据完整性', () => {
  it('被动总数为 6', () => {
    expect(paladinPassives).toHaveLength(6);
  });

  it('所有被动 ID 以 paladin_ 前缀开头', () => {
    paladinPassives.forEach(p => {
      expect(p.id.startsWith('paladin_'), `被动 ${p.id} 应以 paladin_ 开头`).toBe(true);
    });
  });

  it('所有被动 ID 唯一', () => {
    const ids = paladinPassives.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('触发时机覆盖至少 3 种不同 trigger', () => {
    const triggers = new Set(paladinPassives.map(p => p.trigger));
    expect(triggers.size).toBeGreaterThanOrEqual(3);
  });

  it('保留原有 3 个被动 ID', () => {
    const originalIds = ['paladin_divine_shield', 'paladin_righteousness', 'paladin_divine_judgment'];
    originalIds.forEach(id => {
      expect(paladinPassives.find(p => p.id === id), `原被动 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 3 个被动存在', () => {
    const newIds = ['paladin_holy_power_mastery', 'paladin_guardian_light', 'paladin_divine_purpose'];
    newIds.forEach(id => {
      expect(paladinPassives.find(p => p.id === id), `新被动 ${id} 应存在`).toBeDefined();
    });
  });

  it('paladin_divine_purpose 配置概率触发（probability=0.15, value=1, stat=holy_power）', () => {
    const divinePurpose = paladinPassives.find(p => p.id === 'paladin_divine_purpose');
    expect(divinePurpose).toBeDefined();
    expect(divinePurpose!.effect.probability).toBe(0.15);
    expect(divinePurpose!.effect.value).toBe(1);
    expect(divinePurpose!.effect.stat).toBe('holy_power');
    expect(divinePurpose!.effect.type).toBe('resource_gen');
  });

  it('paladin_holy_power_mastery 为神圣攻击力 +10%（stat=magic_attack_multiplier）', () => {
    const mastery = paladinPassives.find(p => p.id === 'paladin_holy_power_mastery');
    expect(mastery).toBeDefined();
    expect(mastery!.effect.type).toBe('stat_modifier');
    expect(mastery!.effect.stat).toBe('magic_attack_multiplier');
    expect(mastery!.effect.value).toBe(0.1);
  });

  it('paladin_guardian_light 回合开始恢复 2% 最大生命（trigger=on_turn_start）', () => {
    const guardian = paladinPassives.find(p => p.id === 'paladin_guardian_light');
    expect(guardian).toBeDefined();
    expect(guardian!.trigger).toBe('on_turn_start');
    expect(guardian!.effect.type).toBe('heal');
    expect(guardian!.effect.value).toBe(0.02);
  });
});
