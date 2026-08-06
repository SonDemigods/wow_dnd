/**
 * @fileoverview death_knight 职业技能数据完整性测试
 *
 * 验证 death_knight 16 技能 + 6 被动的数据完整性：
 * - 技能总数 = 16
 * - 双资源体系：rune（主资源）→ runic_power（副资源）
 *   - rune 生成器：resourceType='rune'，resourceCost ∈ [1,2]，含 generatesResource
 *   - runic_power 终结技：resourceType='runic_power'，resourceCost ∈ [3,6]，无 generatesResource
 * - ID 全局唯一、以 death_knight_ 开头
 * - 所有 magic_damage/physical_damage 技能 statKey 为 'str'
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

const deathKnightEntry = CLASS_ABILITIES.find(c => c.class_id === 'death_knight');
const dkSkills: Skill[] = deathKnightEntry?.skills ?? [];
const dkPassives: PassiveSkill[] = CLASS_PASSIVES.filter(p => p.classId === 'death_knight');

describe('death_knight 技能数据完整性', () => {
  it('技能总数为 16', () => {
    expect(dkSkills).toHaveLength(16);
  });

  it('所有技能 ID 全局唯一', () => {
    const ids = dkSkills.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('所有技能 ID 以 death_knight_ 前缀开头', () => {
    dkSkills.forEach(s => {
      expect(s.id.startsWith('death_knight_'), `技能 ${s.id} 应以 death_knight_ 开头`).toBe(true);
    });
  });

  it('保留原有 10 个技能 ID', () => {
    const originalIds = [
      'death_knight_frost_touch',
      'death_knight_shadow_strike',
      'death_knight_death_grip',
      'death_knight_heart_strike',
      'death_knight_death_strike',
      'death_knight_frost_strike',
      'death_knight_death_and_decay',
      'death_knight_rune_blade_waltz',
      'death_knight_scourge_strike',
      'death_knight_sindragosas_breath',
    ];
    originalIds.forEach(id => {
      expect(dkSkills.find(s => s.id === id), `原技能 ${id} 应保留`).toBeDefined();
    });
  });

  describe('双资源体系正确性', () => {
    // rune 生成器：消耗 rune 并生成 runic_power
    const runeGenerators = dkSkills.filter(s => s.resourceType === 'rune');
    // runic_power 终结技/大招：消耗 runic_power，不再生成资源
    const runicSpenders = dkSkills.filter(s => s.resourceType === 'runic_power');

    it('rune 生成器 resourceCost ∈ [1, 2] 且生成 runic_power', () => {
      expect(runeGenerators.length).toBeGreaterThanOrEqual(3);
      runeGenerators.forEach(s => {
        expect(s.resourceCost, `生成器 ${s.id} resourceCost 应在 1-2`).toBeGreaterThanOrEqual(1);
        expect(s.resourceCost, `生成器 ${s.id} resourceCost 应在 1-2`).toBeLessThanOrEqual(2);
        expect(s.generatesResource, `生成器 ${s.id} 应含 generatesResource`).toBeDefined();
        expect(s.generatesResource!.type, `生成器 ${s.id} 应生成 runic_power`).toBe('runic_power');
        expect(s.generatesResource!.amount, `生成器 ${s.id} 生成量应 > 0`).toBeGreaterThan(0);
      });
    });

    it('runic_power 终结技 resourceCost ∈ [3, 6] 且不生成资源', () => {
      expect(runicSpenders.length).toBeGreaterThanOrEqual(2);
      runicSpenders.forEach(s => {
        expect(s.resourceCost, `终结技 ${s.id} resourceCost 应在 3-6`).toBeGreaterThanOrEqual(3);
        expect(s.resourceCost, `终结技 ${s.id} resourceCost 应在 3-6`).toBeLessThanOrEqual(6);
        expect(s.generatesResource, `终结技 ${s.id} 不应含 generatesResource`).toBeUndefined();
      });
    });

    it('rune 与 runic_power 生成量满足循环（生成量 ≥ 消耗量比例）', () => {
      // 生成器每次生成 3-5 点 runic_power，终结技消耗 3-6 点，保证循环可行
      const minGen = Math.min(...runeGenerators.map(s => s.generatesResource!.amount));
      expect(minGen).toBeGreaterThanOrEqual(3);
    });
  });

  describe('statKey 主属性', () => {
    it('所有 magic_damage 技能 effect.statKey 为 str', () => {
      const magicSkills = dkSkills.filter(s => s.type === 'magic_damage');
      magicSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 str`).toBe('str');
      });
    });

    it('所有 physical_damage 技能 effect.statKey 为 str', () => {
      const physicalSkills = dkSkills.filter(s => s.type === 'physical_damage');
      physicalSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 str`).toBe('str');
      });
    });
  });

  describe('等级分布', () => {
    it('所有技能 unlockLevel ∈ [1, 10]', () => {
      dkSkills.forEach(s => {
        expect(s.unlockLevel).toBeGreaterThanOrEqual(1);
        expect(s.unlockLevel).toBeLessThanOrEqual(10);
      });
    });

    it('存在 Lv10 巅峰大招', () => {
      const lv10Skills = dkSkills.filter(s => s.unlockLevel === 10);
      expect(lv10Skills.length).toBeGreaterThanOrEqual(1);
    });

    it('Lv1-2 段至少 4 个技能（基础生成器/技能）', () => {
      const lowTier = dkSkills.filter(s => s.unlockLevel <= 2);
      expect(lowTier.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('技能构成', () => {
    it('至少 3 个 buff/debuff 技能（含带 buffs 字段的伤害技）', () => {
      const buffDebuff = dkSkills.filter(s => s.type === 'buff' || s.type === 'debuff');
      expect(buffDebuff.length).toBeGreaterThanOrEqual(3);
    });

    it('至少 2 个 AOE 技能（targetType=all_enemies）', () => {
      const aoe = dkSkills.filter(s => s.targetType === 'all_enemies');
      expect(aoe.length).toBeGreaterThanOrEqual(2);
    });

    it('buff/debuff 持续回合数在 1-5 区间', () => {
      dkSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.forEach(b => {
            expect(b.turns).toBeGreaterThanOrEqual(1);
            expect(b.turns).toBeLessThanOrEqual(5);
          });
        }
      });
    });

    it('Lv10 大招为 runic_power 消耗型 AOE', () => {
      const lv10 = dkSkills.find(s => s.unlockLevel === 10);
      expect(lv10).toBeDefined();
      expect(lv10!.resourceType).toBe('runic_power');
      expect(lv10!.targetType).toBe('all_enemies');
    });
  });

  describe('数值平衡', () => {
    const magicSingle = dkSkills.filter(s => s.type === 'magic_damage' && s.targetType === 'single');
    const magicAoe = dkSkills.filter(s => s.type === 'magic_damage' && s.targetType === 'all_enemies');

    it('单体伤害基础值在 12-60 区间', () => {
      magicSingle.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 12-60`).toBeGreaterThanOrEqual(12);
        expect(s.effect.value, `技能 ${s.id} value 应在 12-60`).toBeLessThanOrEqual(60);
      });
    });

    it('AOE 伤害基础值在 15-60 区间', () => {
      magicAoe.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 15-60`).toBeGreaterThanOrEqual(15);
        expect(s.effect.value, `技能 ${s.id} value 应在 15-60`).toBeLessThanOrEqual(60);
      });
    });

    it('Lv10 大招基础值高于 Lv9 中阶技能', () => {
      const lv10 = dkSkills.filter(s => s.unlockLevel === 10);
      const lv9 = dkSkills.filter(s => s.unlockLevel === 9 && s.type === 'magic_damage');
      if (lv10.length > 0 && lv9.length > 0) {
        const lv10Max = Math.max(...lv10.map(s => s.effect.value));
        const lv9Max = Math.max(...lv9.map(s => s.effect.value));
        expect(lv10Max).toBeGreaterThan(lv9Max);
      }
    });
  });
});

describe('death_knight 被动数据完整性', () => {
  it('被动总数为 6', () => {
    expect(dkPassives).toHaveLength(6);
  });

  it('所有被动 ID 以 death_knight_ 前缀开头', () => {
    dkPassives.forEach(p => {
      expect(p.id.startsWith('death_knight_'), `被动 ${p.id} 应以 death_knight_ 开头`).toBe(true);
    });
  });

  it('所有被动 ID 唯一', () => {
    const ids = dkPassives.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('触发时机覆盖至少 3 种不同 trigger', () => {
    const triggers = new Set(dkPassives.map(p => p.trigger));
    expect(triggers.size).toBeGreaterThanOrEqual(3);
  });

  it('保留原有 3 个被动 ID', () => {
    const originalIds = [
      'death_knight_undead_fortitude',
      'death_knight_blood_strike',
      'death_knight_frost_armor',
    ];
    originalIds.forEach(id => {
      expect(dkPassives.find(p => p.id === id), `原被动 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 3 个被动存在', () => {
    const newIds = [
      'death_knight_runic_mastery',
      'death_knight_vampiric_blood',
      'death_knight_frost_strike_mastery',
    ];
    newIds.forEach(id => {
      expect(dkPassives.find(p => p.id === id), `新被动 ${id} 应存在`).toBeDefined();
    });
  });

  it('death_knight_frost_strike_mastery 配置概率触发（probability=0.2, value=3）', () => {
    const frostStrikeMastery = dkPassives.find(p => p.id === 'death_knight_frost_strike_mastery');
    expect(frostStrikeMastery).toBeDefined();
    expect(frostStrikeMastery!.effect.probability).toBe(0.2);
    expect(frostStrikeMastery!.effect.value).toBe(3);
    expect(frostStrikeMastery!.effect.stat).toBe('runic_power');
    expect(frostStrikeMastery!.effect.type).toBe('resource_gen');
  });

  it('death_knight_vampiric_blood 配置低血条件（condition=hp < 0.3）', () => {
    const vampiricBlood = dkPassives.find(p => p.id === 'death_knight_vampiric_blood');
    expect(vampiricBlood).toBeDefined();
    expect(vampiricBlood!.effect.condition).toBe('hp < 0.3');
    expect(vampiricBlood!.effect.value).toBe(0.08);
    expect(vampiricBlood!.effect.type).toBe('heal');
  });

  it('death_knight_runic_mastery 为魔法攻击力百分比修正', () => {
    const runicMastery = dkPassives.find(p => p.id === 'death_knight_runic_mastery');
    expect(runicMastery).toBeDefined();
    expect(runicMastery!.effect.type).toBe('stat_modifier');
    expect(runicMastery!.effect.stat).toBe('magic_attack_multiplier');
    expect(runicMastery!.effect.value).toBe(0.1);
  });
});
