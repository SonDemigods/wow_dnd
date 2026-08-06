/**
 * @fileoverview evoker 职业技能数据完整性测试
 *
 * 验证 evoker 16 技能 + 6 被动的数据完整性：
 * - 技能总数 = 16
 * - 双资源循环：MP 生成器（含 mpCost + generatesResource）→ essence 终结技（含 resourceType/resourceCost）
 * - ID 全局唯一、以 evoker_ 前缀开头、unlockLevel ∈ [1, 10]
 * - 所有 magic_damage/health_restore 技能 effect.statKey 为 'int'
 * - 构成：≥3 buff/debuff + ≥2 AOE + 1 Lv10 大招
 * - 生成器数量 ≥ 3，终结技数量 ≥ 2
 * - 被动总数 = 6，触发时机覆盖 ≥ 3 种
 */
import { describe, it, expect } from 'vitest';
import { CLASS_ABILITIES } from '@/data/config_skills';
import { CLASS_PASSIVES } from '@/data/config_class_passives';
import type { Skill } from '@/modules/skill/types';
import type { PassiveSkill } from '@/modules/character/types';

const evokerEntry = CLASS_ABILITIES.find(c => c.class_id === 'evoker');
const evokerSkills: Skill[] = evokerEntry?.skills ?? [];
const evokerPassives: PassiveSkill[] = CLASS_PASSIVES.filter(p => p.classId === 'evoker');

describe('evoker 技能数据完整性', () => {
  it('技能总数为 16', () => {
    expect(evokerSkills).toHaveLength(16);
  });

  it('所有技能 ID 全局唯一', () => {
    const ids = evokerSkills.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('所有技能 ID 以 evoker_ 前缀开头', () => {
    evokerSkills.forEach(s => {
      expect(s.id.startsWith('evoker_'), `技能 ${s.id} 应以 evoker_ 开头`).toBe(true);
    });
  });

  it('保留原有 10 个技能 ID', () => {
    const originalIds = [
      'evoker_dragon_breath',
      'evoker_emerald_blossom',
      'evoker_disintegrate',
      'evoker_essence_burst',
      'evoker_shifting_embers',
      'evoker_sleep_walk',
      'evoker_azure_strike',
      'evoker_emerald_winds',
      'evoker_spiritbloom',
      'evoker_emerald_destruction',
    ];
    originalIds.forEach(id => {
      expect(evokerSkills.find(s => s.id === id), `原技能 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 6 个技能存在', () => {
    const newIds = [
      'evoker_obsidian_scale',
      'evoker_azure_spear',
      'evoker_deep_breath',
      'evoker_time_spiral',
      'evoker_emerald_embrace',
      'evoker_emerald_cataclysm',
    ];
    newIds.forEach(id => {
      expect(evokerSkills.find(s => s.id === id), `新技能 ${id} 应存在`).toBeDefined();
    });
  });

  describe('双资源循环正确性', () => {
    // MP 生成器：消耗 MP 并产出 essence
    const mpGenerators = evokerSkills.filter(s => s.generatesResource !== undefined);
    // essence 终结技：消耗 essence 副资源
    const essenceFinishers = evokerSkills.filter(s => s.resourceType === 'essence');

    it('MP 生成器（含 generatesResource）数量为 9', () => {
      expect(mpGenerators).toHaveLength(9);
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

    it('MP 生成器全部产出 essence 且 amount=1', () => {
      mpGenerators.forEach(s => {
        expect(s.generatesResource!.type, `生成器 ${s.id} 产出的应为 essence`).toBe('essence');
        expect(s.generatesResource!.amount, `生成器 ${s.id} 产出量应为 1`).toBe(1);
      });
    });

    it('essence 终结技数量为 7', () => {
      expect(essenceFinishers).toHaveLength(7);
    });

    it('essence 终结技全部含 resourceType=essence 且 resourceCost 在 1-3 区间', () => {
      essenceFinishers.forEach(s => {
        expect(s.resourceType, `终结技 ${s.id} resourceType 应为 essence`).toBe('essence');
        expect(s.resourceCost, `终结技 ${s.id} 应含 resourceCost`).toBeDefined();
        expect(s.resourceCost!).toBeGreaterThanOrEqual(1);
        expect(s.resourceCost!).toBeLessThanOrEqual(3);
      });
    });

    it('essence 终结技全部不含 mpCost 与 generatesResource', () => {
      essenceFinishers.forEach(s => {
        expect(s.mpCost, `终结技 ${s.id} 不应含 mpCost`).toBeUndefined();
        expect(s.generatesResource, `终结技 ${s.id} 不应含 generatesResource`).toBeUndefined();
      });
    });

    it('无 resourceType 的技能必须含 mpCost', () => {
      evokerSkills.forEach(s => {
        if (s.resourceType === undefined) {
          expect(s.mpCost, `技能 ${s.id} 无 resourceType 则必须含 mpCost`).toBeDefined();
        }
      });
    });

    it('生成器数量 ≥ 3 且终结技数量 ≥ 2', () => {
      expect(mpGenerators.length).toBeGreaterThanOrEqual(3);
      expect(essenceFinishers.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('statKey 主属性', () => {
    it('所有 magic_damage 技能 effect.statKey 为 int', () => {
      const magicSkills = evokerSkills.filter(s => s.type === 'magic_damage');
      magicSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 int`).toBe('int');
      });
    });

    it('所有 health_restore 技能 effect.statKey 为 int', () => {
      const healSkills = evokerSkills.filter(s => s.type === 'health_restore');
      healSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 int`).toBe('int');
      });
    });
  });

  describe('等级分布', () => {
    it('所有技能 unlockLevel ∈ [1, 10]', () => {
      evokerSkills.forEach(s => {
        expect(s.unlockLevel).toBeGreaterThanOrEqual(1);
        expect(s.unlockLevel).toBeLessThanOrEqual(10);
      });
    });

    it('存在 Lv10 巅峰大招', () => {
      const lv10Skills = evokerSkills.filter(s => s.unlockLevel === 10);
      expect(lv10Skills.length).toBeGreaterThanOrEqual(1);
    });

    it('Lv10 大招为 evoker_emerald_cataclysm（essence 3 AOE 终结技）', () => {
      const lv10 = evokerSkills.find(s => s.unlockLevel === 10);
      expect(lv10).toBeDefined();
      expect(lv10!.id).toBe('evoker_emerald_cataclysm');
      expect(lv10!.resourceType).toBe('essence');
      expect(lv10!.resourceCost).toBe(3);
      expect(lv10!.targetType).toBe('all_enemies');
    });

    it('Lv1-4 段至少 4 个技能（基础生成器与早期终结技）', () => {
      const lowTier = evokerSkills.filter(s => s.unlockLevel <= 4);
      expect(lowTier.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('技能构成', () => {
    it('至少 3 个 buff/debuff 技能', () => {
      const buffDebuff = evokerSkills.filter(s => s.type === 'buff' || s.type === 'debuff');
      expect(buffDebuff.length).toBeGreaterThanOrEqual(3);
    });

    it('至少 2 个 AOE 技能（targetType=all_enemies）', () => {
      const aoe = evokerSkills.filter(s => s.targetType === 'all_enemies');
      expect(aoe.length).toBeGreaterThanOrEqual(2);
    });

    it('buff/debuff 持续回合数在 1-5 区间', () => {
      evokerSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.forEach(b => {
            expect(b.turns).toBeGreaterThanOrEqual(1);
            expect(b.turns).toBeLessThanOrEqual(5);
          });
        }
      });
    });

    it('控制效果（stun）持续 1 回合', () => {
      evokerSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.filter(b => b.type === 'stun').forEach(b => {
            expect(b.turns, `技能 ${s.id} 的 stun 应持续 1 回合`).toBe(1);
          });
        }
      });
    });

    it('evoker_sleep_walk 含 stun 控制效果', () => {
      const sleepWalk = evokerSkills.find(s => s.id === 'evoker_sleep_walk');
      expect(sleepWalk).toBeDefined();
      expect(sleepWalk!.type).toBe('debuff');
      const stun = sleepWalk!.buffs?.find(b => b.type === 'stun');
      expect(stun, '梦游应含 stun 效果').toBeDefined();
    });
  });

  describe('数值平衡', () => {
    const magicSingle = evokerSkills.filter(s => s.type === 'magic_damage' && s.targetType === 'single');
    const magicAoe = evokerSkills.filter(s => s.type === 'magic_damage' && s.targetType === 'all_enemies');

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
      const healSkills = evokerSkills.filter(s => s.type === 'health_restore');
      healSkills.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 15-60`).toBeGreaterThanOrEqual(15);
        expect(s.effect.value, `技能 ${s.id} value 应在 15-60`).toBeLessThanOrEqual(60);
      });
    });

    it('Lv10 大招基础值高于 Lv9 中阶技能', () => {
      const lv10 = evokerSkills.filter(s => s.unlockLevel === 10);
      const lv9 = evokerSkills.filter(s => s.unlockLevel === 9);
      if (lv10.length > 0 && lv9.length > 0) {
        const lv10Max = Math.max(...lv10.map(s => s.effect.value));
        const lv9Max = Math.max(...lv9.map(s => s.effect.value));
        expect(lv10Max).toBeGreaterThanOrEqual(lv9Max);
      }
    });
  });
});

describe('evoker 被动数据完整性', () => {
  it('被动总数为 6', () => {
    expect(evokerPassives).toHaveLength(6);
  });

  it('所有被动 ID 以 evoker_ 前缀开头', () => {
    evokerPassives.forEach(p => {
      expect(p.id.startsWith('evoker_'), `被动 ${p.id} 应以 evoker_ 开头`).toBe(true);
    });
  });

  it('所有被动 ID 唯一', () => {
    const ids = evokerPassives.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('触发时机覆盖至少 3 种不同 trigger', () => {
    const triggers = new Set(evokerPassives.map(p => p.trigger));
    expect(triggers.size).toBeGreaterThanOrEqual(3);
  });

  it('保留原有 3 个被动 ID', () => {
    const originalIds = ['evoker_essence_burst', 'evoker_dragons_breath', 'evoker_verdant_embrace'];
    originalIds.forEach(id => {
      expect(evokerPassives.find(p => p.id === id), `原被动 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 3 个被动存在', () => {
    const newIds = ['evoker_obsidian_scales', 'evoker_essence_surge', 'evoker_dragons_fury'];
    newIds.forEach(id => {
      expect(evokerPassives.find(p => p.id === id), `新被动 ${id} 应存在`).toBeDefined();
    });
  });

  it('evoker_essence_surge 战斗开始生成 1 点精华（trigger=on_combat_start）', () => {
    const surge = evokerPassives.find(p => p.id === 'evoker_essence_surge');
    expect(surge).toBeDefined();
    expect(surge!.trigger).toBe('on_combat_start');
    expect(surge!.effect.type).toBe('resource_gen');
    expect(surge!.effect.stat).toBe('essence');
    expect(surge!.effect.value).toBe(1);
  });

  it('evoker_obsidian_scales 低血量减伤 20%（trigger=on_low_hp）', () => {
    const scales = evokerPassives.find(p => p.id === 'evoker_obsidian_scales');
    expect(scales).toBeDefined();
    expect(scales!.trigger).toBe('on_low_hp');
    expect(scales!.effect.type).toBe('damage_reduction');
    expect(scales!.effect.value).toBe(0.2);
    expect(scales!.effect.condition).toBe('hp < 0.3');
  });

  it('evoker_dragons_fury 击杀后恢复 5% 最大生命（trigger=on_kill）', () => {
    const fury = evokerPassives.find(p => p.id === 'evoker_dragons_fury');
    expect(fury).toBeDefined();
    expect(fury!.trigger).toBe('on_kill');
    expect(fury!.effect.type).toBe('heal');
    expect(fury!.effect.value).toBe(0.05);
  });
});
