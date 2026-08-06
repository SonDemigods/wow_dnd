/**
 * @fileoverview hunter 职业技能数据完整性测试
 *
 * 验证 hunter 16 技能 + 6 被动的数据完整性：
 * - 技能总数 = 16
 * - 资源类型全部为 focus，无 mpCost
 * - ID 全局唯一、unlockLevel ∈ [1, 10]
 * - physical_damage 技能均含 statKey: 'dex'
 * - 构成：≥3 buff/debuff（含控制）+ ≥2 AOE + 1 Lv10 巅峰大招
 * - resourceCost ∈ [8, 25]
 * - 被动总数 = 6，触发时机覆盖 ≥ 3 种
 */
import { describe, it, expect } from 'vitest';
import { CLASS_ABILITIES } from '@/data/config_skills';
import { CLASS_PASSIVES } from '@/data/config_class_passives';
import type { Skill } from '@/modules/skill/types';
import type { PassiveSkill } from '@/modules/character/types';

const hunterEntry = CLASS_ABILITIES.find(c => c.class_id === 'hunter');
const hunterSkills: Skill[] = hunterEntry?.skills ?? [];
const hunterPassives: PassiveSkill[] = CLASS_PASSIVES.filter(p => p.classId === 'hunter');

// 原有 12 个技能 ID（必须保留）
const ORIGINAL_SKILL_IDS = [
  'hunter_steady_shot',
  'hunter_arcane_shot',
  'hunter_multi_shot',
  'hunter_serpent_sting',
  'hunter_volley',
  'hunter_trap',
  'hunter_concussive_shot',
  'hunter_aimed_shot',
  'hunter_chimera_shot',
  'hunter_kill_command',
  'hunter_summon_pet',
  'hunter_dismiss_pet',
];

// 新增 4 个技能 ID
const NEW_SKILL_IDS = [
  'hunter_cobra_shot',
  'hunter_explosive_trap',
  'hunter_kill_shot',
  'hunter_death_rain',
];

// 原有 3 个被动 ID（必须保留）
const ORIGINAL_PASSIVE_IDS = [
  'hunter_precision',
  'hunter_eagle_eye',
  'hunter_survival_instinct',
];

// 新增 3 个被动 ID
const NEW_PASSIVE_IDS = [
  'hunter_focus_mastery',
  'hunter_pet_synergy',
  'hunter_kill_instinct',
];

describe('hunter 技能数据完整性', () => {
  it('技能总数为 16', () => {
    expect(hunterSkills).toHaveLength(16);
  });

  it('所有技能 ID 全局唯一', () => {
    const ids = hunterSkills.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('所有技能 ID 以 hunter_ 前缀开头', () => {
    hunterSkills.forEach(s => {
      expect(s.id.startsWith('hunter_'), `技能 ${s.id} 应以 hunter_ 开头`).toBe(true);
    });
  });

  it('保留原有 12 个技能 ID', () => {
    ORIGINAL_SKILL_IDS.forEach(id => {
      expect(hunterSkills.find(s => s.id === id), `原技能 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 4 个技能存在', () => {
    NEW_SKILL_IDS.forEach(id => {
      expect(hunterSkills.find(s => s.id === id), `新技能 ${id} 应存在`).toBeDefined();
    });
  });

  describe('资源消耗正确性', () => {
    it('所有技能 resourceType 为 focus', () => {
      hunterSkills.forEach(s => {
        expect(s.resourceType, `技能 ${s.id} resourceType 应为 focus`).toBe('focus');
      });
    });

    it('所有技能无 mpCost', () => {
      hunterSkills.forEach(s => {
        expect(s.mpCost, `技能 ${s.id} 不应有 mpCost`).toBeUndefined();
      });
    });

    it('所有技能 resourceCost ∈ [8, 25]', () => {
      hunterSkills.forEach(s => {
        expect(s.resourceCost, `技能 ${s.id} 应有 resourceCost`).toBeDefined();
        expect(s.resourceCost!).toBeGreaterThanOrEqual(8);
        expect(s.resourceCost!).toBeLessThanOrEqual(25);
      });
    });
  });

  describe('等级分布', () => {
    it('所有技能 unlockLevel ∈ [1, 10]', () => {
      hunterSkills.forEach(s => {
        expect(s.unlockLevel).toBeGreaterThanOrEqual(1);
        expect(s.unlockLevel).toBeLessThanOrEqual(10);
      });
    });

    it('存在 Lv10 巅峰大招', () => {
      const lv10Skills = hunterSkills.filter(s => s.unlockLevel === 10);
      expect(lv10Skills.length).toBeGreaterThanOrEqual(1);
    });

    it('Lv1-4 段至少 4 个技能（基础生成器）', () => {
      const lowTier = hunterSkills.filter(s => s.unlockLevel <= 4);
      expect(lowTier.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('statKey 主属性', () => {
    it('所有 physical_damage 技能 effect.statKey 为 dex', () => {
      const physicalSkills = hunterSkills.filter(s => s.type === 'physical_damage');
      physicalSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 dex`).toBe('dex');
      });
    });
  });

  describe('技能构成', () => {
    it('至少 3 个 buff/debuff 技能', () => {
      const buffDebuff = hunterSkills.filter(s => s.type === 'buff' || s.type === 'debuff');
      expect(buffDebuff.length).toBeGreaterThanOrEqual(3);
    });

    it('至少 2 个 AOE 技能（targetType=all_enemies）', () => {
      const aoe = hunterSkills.filter(s => s.targetType === 'all_enemies');
      expect(aoe.length).toBeGreaterThanOrEqual(2);
    });

    it('含控制效果（stun）', () => {
      const hasControl = hunterSkills.some(s => s.buffs?.some(b => b.type === 'stun'));
      expect(hasControl, '应至少存在一个含 stun 的技能').toBe(true);
    });

    it('buff/debuff 持续回合数在 1-5 区间', () => {
      hunterSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.forEach(b => {
            expect(b.turns).toBeGreaterThanOrEqual(1);
            expect(b.turns).toBeLessThanOrEqual(5);
          });
        }
      });
    });

    it('控制效果（stun）持续 1 回合', () => {
      hunterSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.filter(b => b.type === 'stun').forEach(b => {
            expect(b.turns, `技能 ${s.id} 的 stun 应持续 1 回合`).toBe(1);
          });
        }
      });
    });
  });

  describe('Lv10 巅峰大招配置', () => {
    it('Lv10 大招为 AOE 且 focus 消耗 25', () => {
      const lv10Skills = hunterSkills.filter(s => s.unlockLevel === 10);
      expect(lv10Skills.length).toBeGreaterThanOrEqual(1);
      lv10Skills.forEach(s => {
        expect(s.resourceCost, `大招 ${s.id} focus 消耗应为 25`).toBe(25);
        expect(s.targetType, `大招 ${s.id} 应为 AOE`).toBe('all_enemies');
      });
    });
  });

  describe('宠物协同技能', () => {
    it('hunter_summon_pet 配置 specialAction=summon_pet', () => {
      const summon = hunterSkills.find(s => s.id === 'hunter_summon_pet');
      expect(summon).toBeDefined();
      expect(summon!.specialAction).toBe('summon_pet');
      expect(summon!.type).toBe('buff');
    });

    it('hunter_dismiss_pet 配置 specialAction=dismiss_pet', () => {
      const dismiss = hunterSkills.find(s => s.id === 'hunter_dismiss_pet');
      expect(dismiss).toBeDefined();
      expect(dismiss!.specialAction).toBe('dismiss_pet');
      expect(dismiss!.type).toBe('buff');
    });

    it('hunter_kill_command 需要 requiresActivePet', () => {
      const killCommand = hunterSkills.find(s => s.id === 'hunter_kill_command');
      expect(killCommand).toBeDefined();
      expect(killCommand!.requiresActivePet).toBe(true);
    });
  });

  describe('数值平衡', () => {
    const physicalSingle = hunterSkills.filter(s => s.type === 'physical_damage' && s.targetType === 'single');
    const physicalAoe = hunterSkills.filter(s => s.type === 'physical_damage' && s.targetType === 'all_enemies');

    it('单体物理伤害基础值在 12-60 区间', () => {
      physicalSingle.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 12-60`).toBeGreaterThanOrEqual(12);
        expect(s.effect.value, `技能 ${s.id} value 应在 12-60`).toBeLessThanOrEqual(60);
      });
    });

    it('AOE 物理伤害基础值在 15-55 区间', () => {
      physicalAoe.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 15-55`).toBeGreaterThanOrEqual(15);
        expect(s.effect.value, `技能 ${s.id} value 应在 15-55`).toBeLessThanOrEqual(55);
      });
    });

    it('Lv10 大招基础值高于 Lv9 中阶技能', () => {
      const lv10 = hunterSkills.filter(s => s.unlockLevel === 10 && s.type === 'physical_damage');
      const lv9 = hunterSkills.filter(s => s.unlockLevel === 9 && s.type === 'physical_damage');
      if (lv10.length > 0 && lv9.length > 0) {
        const lv10Max = Math.max(...lv10.map(s => s.effect.value));
        const lv9Max = Math.max(...lv9.map(s => s.effect.value));
        expect(lv10Max).toBeGreaterThan(lv9Max);
      }
    });
  });
});

describe('hunter 被动数据完整性', () => {
  it('被动总数为 6', () => {
    expect(hunterPassives).toHaveLength(6);
  });

  it('所有被动 ID 以 hunter_ 前缀开头', () => {
    hunterPassives.forEach(p => {
      expect(p.id.startsWith('hunter_'), `被动 ${p.id} 应以 hunter_ 开头`).toBe(true);
    });
  });

  it('所有被动 ID 唯一', () => {
    const ids = hunterPassives.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('触发时机覆盖至少 3 种不同 trigger', () => {
    const triggers = new Set(hunterPassives.map(p => p.trigger));
    expect(triggers.size).toBeGreaterThanOrEqual(3);
  });

  it('保留原有 3 个被动 ID', () => {
    ORIGINAL_PASSIVE_IDS.forEach(id => {
      expect(hunterPassives.find(p => p.id === id), `原被动 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 3 个被动存在', () => {
    NEW_PASSIVE_IDS.forEach(id => {
      expect(hunterPassives.find(p => p.id === id), `新被动 ${id} 应存在`).toBeDefined();
    });
  });

  it('hunter_focus_mastery 配置战斗开始时生成 30 点集中值', () => {
    const focusMastery = hunterPassives.find(p => p.id === 'hunter_focus_mastery');
    expect(focusMastery).toBeDefined();
    expect(focusMastery!.trigger).toBe('on_combat_start');
    expect(focusMastery!.effect.type).toBe('resource_gen');
    expect(focusMastery!.effect.stat).toBe('focus');
    expect(focusMastery!.effect.value).toBe(30);
  });

  it('hunter_pet_synergy 配置概率触发（probability=0.3, value=3）', () => {
    const petSynergy = hunterPassives.find(p => p.id === 'hunter_pet_synergy');
    expect(petSynergy).toBeDefined();
    expect(petSynergy!.trigger).toBe('on_attack');
    expect(petSynergy!.effect.type).toBe('resource_gen');
    expect(petSynergy!.effect.probability).toBe(0.3);
    expect(petSynergy!.effect.value).toBe(3);
    expect(petSynergy!.effect.stat).toBe('focus');
  });

  it('hunter_kill_instinct 配置目标低血条件（condition=target_hp < 0.2）', () => {
    const killInstinct = hunterPassives.find(p => p.id === 'hunter_kill_instinct');
    expect(killInstinct).toBeDefined();
    expect(killInstinct!.effect.condition).toBe('target_hp < 0.2');
    expect(killInstinct!.effect.value).toBe(0.15);
    expect(killInstinct!.effect.stat).toBe('physical_attack');
    expect(killInstinct!.effect.type).toBe('stat_modifier');
  });
});
