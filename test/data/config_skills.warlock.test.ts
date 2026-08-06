/**
 * @fileoverview warlock 职业技能数据完整性测试
 *
 * 验证 warlock 16 技能 + 6 被动的数据完整性：
 * - 技能总数 = 16
 * - 双资源循环：MP 生成器（含 mpCost + generatesResource）→ soul_shard 终结技（含 resourceType/resourceCost）
 * - ID 全局唯一、以 warlock_ 前缀开头、unlockLevel ∈ [1, 10]
 * - 所有 magic_damage 技能 effect.statKey 为 'int'
 * - 构成：≥3 buff/debuff（含控制）+ ≥2 AOE + 1 Lv10 大招
 * - 生成器数量 ≥ 3，终结技数量 ≥ 2
 * - 被动总数 = 6，触发时机覆盖 ≥ 3 种
 */
import { describe, it, expect } from 'vitest';
import { CLASS_ABILITIES } from '@/data/config_skills';
import { CLASS_PASSIVES } from '@/data/config_class_passives';
import type { Skill } from '@/modules/skill/types';
import type { PassiveSkill } from '@/modules/character/types';

const warlockEntry = CLASS_ABILITIES.find(c => c.class_id === 'warlock');
const warlockSkills: Skill[] = warlockEntry?.skills ?? [];
const warlockPassives: PassiveSkill[] = CLASS_PASSIVES.filter(p => p.classId === 'warlock');

describe('warlock 技能数据完整性', () => {
  it('技能总数为 16', () => {
    expect(warlockSkills).toHaveLength(16);
  });

  it('所有技能 ID 全局唯一', () => {
    const ids = warlockSkills.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('所有技能 ID 以 warlock_ 前缀开头', () => {
    warlockSkills.forEach(s => {
      expect(s.id.startsWith('warlock_'), `技能 ${s.id} 应以 warlock_ 开头`).toBe(true);
    });
  });

  it('保留原有 10 个技能 ID', () => {
    const originalIds = [
      'warlock_shadow_bolt',
      'warlock_corruption',
      'warlock_agony',
      'warlock_immolate',
      'warlock_shadow_burn',
      'warlock_seed_of_corruption',
      'warlock_life_drain',
      'warlock_soul_fire',
      'warlock_demon_bolt',
      'warlock_chaos_bolt',
    ];
    originalIds.forEach(id => {
      expect(warlockSkills.find(s => s.id === id), `原技能 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 6 个技能存在', () => {
    const newIds = [
      'warlock_shadow_curse',
      'warlock_unstable_affliction',
      'warlock_demon_command',
      'warlock_infernal_blast',
      'warlock_ghostly_spirit',
      'warlock_summon_infernal',
    ];
    newIds.forEach(id => {
      expect(warlockSkills.find(s => s.id === id), `新技能 ${id} 应存在`).toBeDefined();
    });
  });

  describe('双资源循环正确性', () => {
    // MP 生成器：消耗 MP 并产出 soul_shard
    const mpGenerators = warlockSkills.filter(s => s.generatesResource !== undefined);
    // soul_shard 终结技：消耗 soul_shard 副资源
    const soulShardFinishers = warlockSkills.filter(s => s.resourceType === 'soul_shard');

    it('MP 生成器（含 generatesResource）数量为 8', () => {
      expect(mpGenerators).toHaveLength(8);
    });

    it('MP 生成器全部含 mpCost 且在 8-20 区间', () => {
      mpGenerators.forEach(s => {
        expect(s.mpCost, `生成器 ${s.id} 应含 mpCost`).toBeDefined();
        expect(s.mpCost!).toBeGreaterThanOrEqual(8);
        expect(s.mpCost!).toBeLessThanOrEqual(20);
      });
    });

    it('MP 生成器全部不含 resourceType/resourceCost', () => {
      mpGenerators.forEach(s => {
        expect(s.resourceType, `生成器 ${s.id} 不应含 resourceType`).toBeUndefined();
        expect(s.resourceCost, `生成器 ${s.id} 不应含 resourceCost`).toBeUndefined();
      });
    });

    it('MP 生成器全部产出 soul_shard 且 amount=1', () => {
      mpGenerators.forEach(s => {
        expect(s.generatesResource!.type, `生成器 ${s.id} 产出的应为 soul_shard`).toBe('soul_shard');
        expect(s.generatesResource!.amount, `生成器 ${s.id} 产出量应为 1`).toBe(1);
      });
    });

    it('soul_shard 终结技数量为 8', () => {
      expect(soulShardFinishers).toHaveLength(8);
    });

    it('soul_shard 终结技全部含 resourceType=soul_shard 且 resourceCost 在 1-3 区间', () => {
      soulShardFinishers.forEach(s => {
        expect(s.resourceType, `终结技 ${s.id} resourceType 应为 soul_shard`).toBe('soul_shard');
        expect(s.resourceCost, `终结技 ${s.id} 应含 resourceCost`).toBeDefined();
        expect(s.resourceCost!).toBeGreaterThanOrEqual(1);
        expect(s.resourceCost!).toBeLessThanOrEqual(3);
      });
    });

    it('soul_shard 终结技全部不含 mpCost 与 generatesResource', () => {
      soulShardFinishers.forEach(s => {
        expect(s.mpCost, `终结技 ${s.id} 不应含 mpCost`).toBeUndefined();
        expect(s.generatesResource, `终结技 ${s.id} 不应含 generatesResource`).toBeUndefined();
      });
    });

    it('无 resourceType 的技能必须含 mpCost', () => {
      warlockSkills.forEach(s => {
        if (s.resourceType === undefined) {
          expect(s.mpCost, `技能 ${s.id} 无 resourceType 则必须含 mpCost`).toBeDefined();
        }
      });
    });

    it('生成器数量 ≥ 3 且终结技数量 ≥ 2', () => {
      expect(mpGenerators.length).toBeGreaterThanOrEqual(3);
      expect(soulShardFinishers.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('statKey 主属性', () => {
    it('所有 magic_damage 技能 effect.statKey 为 int', () => {
      const magicSkills = warlockSkills.filter(s => s.type === 'magic_damage');
      magicSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 int`).toBe('int');
      });
    });

    it('life_drain 虽为 health_restore 但 statKey 为 int（主属性）', () => {
      const lifeDrain = warlockSkills.find(s => s.id === 'warlock_life_drain');
      expect(lifeDrain).toBeDefined();
      expect(lifeDrain!.type).toBe('health_restore');
      expect(lifeDrain!.effect.statKey).toBe('int');
    });
  });

  describe('等级分布', () => {
    it('所有技能 unlockLevel ∈ [1, 10]', () => {
      warlockSkills.forEach(s => {
        expect(s.unlockLevel).toBeGreaterThanOrEqual(1);
        expect(s.unlockLevel).toBeLessThanOrEqual(10);
      });
    });

    it('存在 Lv10 巅峰大招', () => {
      const lv10Skills = warlockSkills.filter(s => s.unlockLevel === 10);
      expect(lv10Skills.length).toBeGreaterThanOrEqual(1);
    });

    it('Lv10 大招为 warlock_summon_infernal（soul_shard 3 终结技 AOE）', () => {
      const lv10 = warlockSkills.find(s => s.unlockLevel === 10);
      expect(lv10).toBeDefined();
      expect(lv10!.id).toBe('warlock_summon_infernal');
      expect(lv10!.resourceType).toBe('soul_shard');
      expect(lv10!.resourceCost).toBe(3);
      expect(lv10!.targetType).toBe('all_enemies');
    });

    it('Lv10 大招唯一（仅 1 个 Lv10 技能）', () => {
      const lv10Skills = warlockSkills.filter(s => s.unlockLevel === 10);
      expect(lv10Skills).toHaveLength(1);
    });

    it('Lv1-4 段至少 4 个技能（基础生成器与早期终结技）', () => {
      const lowTier = warlockSkills.filter(s => s.unlockLevel <= 4);
      expect(lowTier.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('技能构成', () => {
    it('至少 3 个 buff/debuff 技能', () => {
      const buffDebuff = warlockSkills.filter(s => s.type === 'buff' || s.type === 'debuff');
      expect(buffDebuff.length).toBeGreaterThanOrEqual(3);
    });

    it('至少 2 个 AOE 技能（targetType=all_enemies）', () => {
      const aoe = warlockSkills.filter(s => s.targetType === 'all_enemies');
      expect(aoe.length).toBeGreaterThanOrEqual(2);
    });

    it('AOE 技能数量为 3（seed_of_corruption, infernal_blast, summon_infernal）', () => {
      const aoe = warlockSkills.filter(s => s.targetType === 'all_enemies');
      expect(aoe).toHaveLength(3);
    });

    it('buff/debuff 持续回合数在 1-5 区间', () => {
      warlockSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.forEach(b => {
            expect(b.turns).toBeGreaterThanOrEqual(1);
            expect(b.turns).toBeLessThanOrEqual(5);
          });
        }
      });
    });

    it('控制效果（stun/silence）持续 1 回合', () => {
      warlockSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.filter(b => b.type === 'stun' || b.type === 'silence').forEach(b => {
            expect(b.turns, `技能 ${s.id} 的控制效果应持续 1 回合`).toBe(1);
          });
        }
      });
    });

    it('warlock_unstable_affliction 含 silence 控制效果', () => {
      const unstable = warlockSkills.find(s => s.id === 'warlock_unstable_affliction');
      expect(unstable).toBeDefined();
      expect(unstable!.type).toBe('debuff');
      const silence = unstable!.buffs?.find(b => b.type === 'silence');
      expect(silence, '痛苦无常应含 silence 效果').toBeDefined();
    });

    it('warlock_summon_infernal 含 stun 控制效果', () => {
      const infernal = warlockSkills.find(s => s.id === 'warlock_summon_infernal');
      expect(infernal).toBeDefined();
      const stun = infernal!.buffs?.find(b => b.type === 'stun');
      expect(stun, '召唤地狱火应含 stun 效果').toBeDefined();
    });
  });

  describe('数值平衡', () => {
    const magicSingle = warlockSkills.filter(s => s.type === 'magic_damage' && s.targetType === 'single');
    const magicAoe = warlockSkills.filter(s => s.type === 'magic_damage' && s.targetType === 'all_enemies');

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
      const healSkills = warlockSkills.filter(s => s.type === 'health_restore');
      healSkills.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 15-60`).toBeGreaterThanOrEqual(15);
        expect(s.effect.value, `技能 ${s.id} value 应在 15-60`).toBeLessThanOrEqual(60);
      });
    });

    it('Lv10 大招基础值高于 Lv9 中阶技能', () => {
      const lv10 = warlockSkills.filter(s => s.unlockLevel === 10);
      const lv9 = warlockSkills.filter(s => s.unlockLevel === 9);
      if (lv10.length > 0 && lv9.length > 0) {
        const lv10Max = Math.max(...lv10.map(s => s.effect.value));
        const lv9Max = Math.max(...lv9.map(s => s.effect.value));
        expect(lv10Max).toBeGreaterThan(lv9Max);
      }
    });
  });
});

describe('warlock 被动数据完整性', () => {
  it('被动总数为 6', () => {
    expect(warlockPassives).toHaveLength(6);
  });

  it('所有被动 ID 以 warlock_ 前缀开头', () => {
    warlockPassives.forEach(p => {
      expect(p.id.startsWith('warlock_'), `被动 ${p.id} 应以 warlock_ 开头`).toBe(true);
    });
  });

  it('所有被动 ID 唯一', () => {
    const ids = warlockPassives.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('触发时机覆盖至少 3 种不同 trigger', () => {
    const triggers = new Set(warlockPassives.map(p => p.trigger));
    expect(triggers.size).toBeGreaterThanOrEqual(3);
  });

  it('保留原有 3 个被动 ID', () => {
    const originalIds = ['warlock_soul_siphon', 'warlock_demonic_pact', 'warlock_corruption'];
    originalIds.forEach(id => {
      expect(warlockPassives.find(p => p.id === id), `原被动 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 3 个被动存在', () => {
    const newIds = ['warlock_soul_harvest', 'warlock_demonic_resilience', 'warlock_shadow_mastery'];
    newIds.forEach(id => {
      expect(warlockPassives.find(p => p.id === id), `新被动 ${id} 应存在`).toBeDefined();
    });
  });

  it('warlock_soul_harvest 战斗开始生成 2 灵魂碎片（trigger=on_combat_start）', () => {
    const harvest = warlockPassives.find(p => p.id === 'warlock_soul_harvest');
    expect(harvest).toBeDefined();
    expect(harvest!.trigger).toBe('on_combat_start');
    expect(harvest!.effect.type).toBe('resource_gen');
    expect(harvest!.effect.stat).toBe('soul_shard');
    expect(harvest!.effect.value).toBe(2);
  });

  it('warlock_demonic_resilience 低血减伤 20%（trigger=on_low_hp, condition=hp < 0.3）', () => {
    const resilience = warlockPassives.find(p => p.id === 'warlock_demonic_resilience');
    expect(resilience).toBeDefined();
    expect(resilience!.trigger).toBe('on_low_hp');
    expect(resilience!.effect.type).toBe('damage_reduction');
    expect(resilience!.effect.value).toBe(0.2);
    expect(resilience!.effect.condition).toBe('hp < 0.3');
  });

  it('warlock_shadow_mastery 持续魔法攻击力 +10%（trigger=passive）', () => {
    const mastery = warlockPassives.find(p => p.id === 'warlock_shadow_mastery');
    expect(mastery).toBeDefined();
    expect(mastery!.trigger).toBe('passive');
    expect(mastery!.effect.type).toBe('stat_modifier');
    expect(mastery!.effect.stat).toBe('magic_attack_multiplier');
    expect(mastery!.effect.value).toBe(0.1);
  });
});
