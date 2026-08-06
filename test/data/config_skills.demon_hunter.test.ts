/**
 * @fileoverview demon_hunter 职业技能数据完整性测试
 *
 * 验证 demon_hunter 16 技能 + 6 被动的数据完整性：
 * - 技能总数 = 16
 * - 双资源体系：fury（主资源）→ soul（副资源）
 *   - fury 生成器：resourceType='fury'，resourceCost ∈ [8,30]，含 generatesResource: soul
 *   - soul 消耗技：resourceType='soul'，resourceCost ∈ [1,3]，无 generatesResource
 * - ID 全局唯一、以 demon_hunter_ 开头
 * - 所有 magic_damage/physical_damage 技能 statKey 为 'dex'
 * - unlockLevel ∈ [1, 10]，存在 Lv10 大招
 * - 构成：≥3 buff/debuff + ≥2 AOE
 * - 生成器数量 ≥ 3，soul 消耗技数量 ≥ 2
 * - 被动总数 = 6，触发时机覆盖 ≥ 3 种
 */
import { describe, it, expect } from 'vitest';
import { CLASS_ABILITIES } from '@/data/config_skills';
import { CLASS_PASSIVES } from '@/data/config_class_passives';
import type { Skill } from '@/modules/skill/types';
import type { PassiveSkill } from '@/modules/character/types';

const dhEntry = CLASS_ABILITIES.find(c => c.class_id === 'demon_hunter');
const dhSkills: Skill[] = dhEntry?.skills ?? [];
const dhPassives: PassiveSkill[] = CLASS_PASSIVES.filter(p => p.classId === 'demon_hunter');

// 原有 10 个技能 ID（必须保留）
const ORIGINAL_SKILL_IDS = [
  'demon_hunter_chaos_strike',
  'demon_hunter_blade_dance',
  'demon_hunter_fel_rush',
  'demon_hunter_fel_strike',
  'demon_hunter_throw_glaive',
  'demon_hunter_eye_beam',
  'demon_hunter_metamorphosis',
  'demon_hunter_immolation_aura',
  'demon_hunter_chaos_nova',
  'demon_hunter_cataclysm',
];

// 新增 6 个技能 ID
const NEW_SKILL_IDS = [
  'demon_hunter_demon_bite',
  'demon_hunter_annihilation',
  'demon_hunter_blade_turn',
  'demon_hunter_fel_barrage',
  'demon_hunter_nemesis',
  'demon_hunter_demonic_transformation',
];

// 原有 3 个被动 ID（必须保留）
const ORIGINAL_PASSIVE_IDS = [
  'demon_hunter_demonic_sight',
  'demon_hunter_vengeance',
  'demon_hunter_illidari_resolve',
];

// 新增 3 个被动 ID
const NEW_PASSIVE_IDS = [
  'demon_hunter_soul_harvest',
  'demon_hunter_demon_skin',
  'demon_hunter_blade_master',
];

describe('demon_hunter 技能数据完整性', () => {
  it('技能总数为 16', () => {
    expect(dhSkills).toHaveLength(16);
  });

  it('所有技能 ID 全局唯一', () => {
    const ids = dhSkills.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('所有技能 ID 以 demon_hunter_ 前缀开头', () => {
    dhSkills.forEach(s => {
      expect(s.id.startsWith('demon_hunter_'), `技能 ${s.id} 应以 demon_hunter_ 开头`).toBe(true);
    });
  });

  it('保留原有 10 个技能 ID', () => {
    ORIGINAL_SKILL_IDS.forEach(id => {
      expect(dhSkills.find(s => s.id === id), `原技能 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 6 个技能存在', () => {
    NEW_SKILL_IDS.forEach(id => {
      expect(dhSkills.find(s => s.id === id), `新技能 ${id} 应存在`).toBeDefined();
    });
  });

  describe('双资源体系正确性（fury → soul）', () => {
    // fury 生成器：消耗 fury 并生成 soul
    const furyGenerators = dhSkills.filter(s => s.resourceType === 'fury');
    // soul 消耗技：消耗固定 soul，不生成资源
    const soulSpenders = dhSkills.filter(s => s.resourceType === 'soul');

    it('fury 生成器 resourceCost ∈ [8, 30] 且生成 soul', () => {
      expect(furyGenerators.length).toBeGreaterThanOrEqual(3);
      furyGenerators.forEach(s => {
        expect(s.resourceCost, `生成器 ${s.id} resourceCost 应在 8-30`).toBeGreaterThanOrEqual(8);
        expect(s.resourceCost, `生成器 ${s.id} resourceCost 应在 8-30`).toBeLessThanOrEqual(30);
        expect(s.generatesResource, `生成器 ${s.id} 应含 generatesResource`).toBeDefined();
        expect(s.generatesResource!.type, `生成器 ${s.id} 应生成 soul`).toBe('soul');
        expect(s.generatesResource!.amount, `生成器 ${s.id} 生成量应 > 0`).toBeGreaterThan(0);
      });
    });

    it('soul 消耗技 resourceCost ∈ [1, 3] 且不生成资源', () => {
      expect(soulSpenders.length).toBeGreaterThanOrEqual(2);
      soulSpenders.forEach(s => {
        expect(s.resourceCost, `soul 技能 ${s.id} resourceCost 应在 1-3`).toBeGreaterThanOrEqual(1);
        expect(s.resourceCost, `soul 技能 ${s.id} resourceCost 应在 1-3`).toBeLessThanOrEqual(3);
        expect(s.generatesResource, `soul 技能 ${s.id} 不应含 generatesResource`).toBeUndefined();
      });
    });

    it('所有技能无 mpCost', () => {
      dhSkills.forEach(s => {
        expect(s.mpCost, `技能 ${s.id} 不应有 mpCost`).toBeUndefined();
      });
    });
  });

  describe('statKey 主属性', () => {
    it('所有 magic_damage 技能 effect.statKey 为 dex', () => {
      const magicSkills = dhSkills.filter(s => s.type === 'magic_damage');
      magicSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 dex`).toBe('dex');
      });
    });

    it('所有 physical_damage 技能 effect.statKey 为 dex', () => {
      const physicalSkills = dhSkills.filter(s => s.type === 'physical_damage');
      physicalSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 dex`).toBe('dex');
      });
    });
  });

  describe('等级分布', () => {
    it('所有技能 unlockLevel ∈ [1, 10]', () => {
      dhSkills.forEach(s => {
        expect(s.unlockLevel).toBeGreaterThanOrEqual(1);
        expect(s.unlockLevel).toBeLessThanOrEqual(10);
      });
    });

    it('存在 Lv10 巅峰大招', () => {
      const lv10Skills = dhSkills.filter(s => s.unlockLevel === 10);
      expect(lv10Skills.length).toBeGreaterThanOrEqual(1);
    });

    it('Lv1-4 段至少 4 个技能（基础生成器/技能）', () => {
      const lowTier = dhSkills.filter(s => s.unlockLevel <= 4);
      expect(lowTier.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('技能构成', () => {
    it('至少 3 个 buff/debuff 技能', () => {
      const buffDebuff = dhSkills.filter(s => s.type === 'buff' || s.type === 'debuff');
      expect(buffDebuff.length).toBeGreaterThanOrEqual(3);
    });

    it('至少 2 个 AOE 技能（targetType=all_enemies）', () => {
      const aoe = dhSkills.filter(s => s.targetType === 'all_enemies');
      expect(aoe.length).toBeGreaterThanOrEqual(2);
    });

    it('buff/debuff 持续回合数在 1-5 区间', () => {
      dhSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.forEach(b => {
            expect(b.turns).toBeGreaterThanOrEqual(1);
            expect(b.turns).toBeLessThanOrEqual(5);
          });
        }
      });
    });

    it('Lv10 大招为 soul 消耗型 buff', () => {
      const lv10 = dhSkills.find(s => s.unlockLevel === 10);
      expect(lv10).toBeDefined();
      expect(lv10!.resourceType).toBe('soul');
      expect(lv10!.type).toBe('buff');
    });
  });

  describe('数值平衡', () => {
    const magicSingle = dhSkills.filter(s => s.type === 'magic_damage' && s.targetType === 'single');
    const magicAoe = dhSkills.filter(s => s.type === 'magic_damage' && s.targetType === 'all_enemies');

    it('fury 生成器单体伤害基础值在 18-30 区间', () => {
      const generators = magicSingle.filter(s => s.resourceType === 'fury');
      generators.forEach(s => {
        expect(s.effect.value, `生成器 ${s.id} value 应在 18-30`).toBeGreaterThanOrEqual(18);
        expect(s.effect.value, `生成器 ${s.id} value 应在 18-30`).toBeLessThanOrEqual(30);
      });
    });

    it('soul 消耗技单体伤害基础值在 25-40 区间', () => {
      const spenders = magicSingle.filter(s => s.resourceType === 'soul');
      spenders.forEach(s => {
        expect(s.effect.value, `soul 技能 ${s.id} value 应在 25-40`).toBeGreaterThanOrEqual(25);
        expect(s.effect.value, `soul 技能 ${s.id} value 应在 25-40`).toBeLessThanOrEqual(40);
      });
    });

    it('AOE 伤害基础值在 15-50 区间', () => {
      magicAoe.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 15-50`).toBeGreaterThanOrEqual(15);
        expect(s.effect.value, `技能 ${s.id} value 应在 15-50`).toBeLessThanOrEqual(50);
      });
    });

    it('Lv10 大招不直接造成伤害（buff 型大招）', () => {
      const lv10 = dhSkills.find(s => s.unlockLevel === 10);
      expect(lv10).toBeDefined();
      expect(lv10!.type).toBe('buff');
    });
  });
});

describe('demon_hunter 被动数据完整性', () => {
  it('被动总数为 6', () => {
    expect(dhPassives).toHaveLength(6);
  });

  it('所有被动 ID 以 demon_hunter_ 前缀开头', () => {
    dhPassives.forEach(p => {
      expect(p.id.startsWith('demon_hunter_'), `被动 ${p.id} 应以 demon_hunter_ 开头`).toBe(true);
    });
  });

  it('所有被动 ID 唯一', () => {
    const ids = dhPassives.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('触发时机覆盖至少 3 种不同 trigger', () => {
    const triggers = new Set(dhPassives.map(p => p.trigger));
    expect(triggers.size).toBeGreaterThanOrEqual(3);
  });

  it('保留原有 3 个被动 ID', () => {
    ORIGINAL_PASSIVE_IDS.forEach(id => {
      expect(dhPassives.find(p => p.id === id), `原被动 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 3 个被动存在', () => {
    NEW_PASSIVE_IDS.forEach(id => {
      expect(dhPassives.find(p => p.id === id), `新被动 ${id} 应存在`).toBeDefined();
    });
  });

  it('demon_hunter_soul_harvest 配置战斗开始时生成 1 点灵魂', () => {
    const soulHarvest = dhPassives.find(p => p.id === 'demon_hunter_soul_harvest');
    expect(soulHarvest).toBeDefined();
    expect(soulHarvest!.trigger).toBe('on_combat_start');
    expect(soulHarvest!.effect.type).toBe('resource_gen');
    expect(soulHarvest!.effect.stat).toBe('soul');
    expect(soulHarvest!.effect.value).toBe(1);
  });

  it('demon_hunter_blade_master 配置概率触发（probability=0.3, value=1）', () => {
    const bladeMaster = dhPassives.find(p => p.id === 'demon_hunter_blade_master');
    expect(bladeMaster).toBeDefined();
    expect(bladeMaster!.effect.probability).toBe(0.3);
    expect(bladeMaster!.effect.value).toBe(1);
    expect(bladeMaster!.effect.stat).toBe('soul');
    expect(bladeMaster!.effect.type).toBe('resource_gen');
  });

  it('demon_hunter_demon_skin 为物理防御百分比修正', () => {
    const demonSkin = dhPassives.find(p => p.id === 'demon_hunter_demon_skin');
    expect(demonSkin).toBeDefined();
    expect(demonSkin!.effect.type).toBe('stat_modifier');
    expect(demonSkin!.effect.stat).toBe('physical_defense_multiplier');
    expect(demonSkin!.effect.value).toBe(0.1);
  });
});
