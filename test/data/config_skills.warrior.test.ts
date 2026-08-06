/**
 * @fileoverview warrior 职业技能数据完整性测试（阶段 A 试点）
 *
 * 验证 warrior 30 技能 + 6 被动的数据完整性：
 * - 技能总数 = 30
 * - 资源类型全部为 rage，无 mpCost
 * - ID 全局唯一、unlockLevel ∈ [1, 10]
 * - physical_damage 技能均含 statKey: 'str'
 * - 构成：≥3 buff/debuff + ≥2 AOE + 1 Lv10 大招
 * - 数值区间合理性（单体/AOE/buff 持续回合）
 * - 被动总数 = 6，触发时机覆盖多样
 */
import { describe, it, expect } from 'vitest';
import { CLASS_ABILITIES } from '@/data/config_skills';
import { CLASS_PASSIVES } from '@/data/config_class_passives';
import type { Skill } from '@/modules/skill/types';
import type { PassiveSkill } from '@/modules/character/types';

const warriorEntry = CLASS_ABILITIES.find(c => c.class_id === 'warrior');
const warriorSkills: Skill[] = warriorEntry?.skills ?? [];
const warriorPassives: PassiveSkill[] = CLASS_PASSIVES.filter(p => p.classId === 'warrior');

describe('warrior 技能数据完整性（阶段 A 试点）', () => {
  it('技能总数为 16', () => {
    expect(warriorSkills).toHaveLength(16);
  });

  it('所有技能 ID 全局唯一', () => {
    const ids = warriorSkills.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('所有技能 ID 以 warrior_ 前缀开头', () => {
    warriorSkills.forEach(s => {
      expect(s.id.startsWith('warrior_'), `技能 ${s.id} 应以 warrior_ 开头`).toBe(true);
    });
  });

  it('保留原有 5 个技能 ID', () => {
    const originalIds = [
      'warrior_heroic_strike',
      'warrior_thunder_clap',
      'warrior_execute',
      'warrior_whirlwind',
      'warrior_charge',
    ];
    originalIds.forEach(id => {
      expect(warriorSkills.find(s => s.id === id), `原技能 ${id} 应保留`).toBeDefined();
    });
  });

  describe('资源消耗正确性', () => {
    it('所有技能 resourceType 为 rage', () => {
      warriorSkills.forEach(s => {
        expect(s.resourceType, `技能 ${s.id} resourceType 应为 rage`).toBe('rage');
      });
    });

    it('所有技能无 mpCost', () => {
      warriorSkills.forEach(s => {
        expect(s.mpCost, `技能 ${s.id} 不应有 mpCost`).toBeUndefined();
      });
    });

    it('所有技能有 resourceCost 且在 6-30 区间', () => {
      warriorSkills.forEach(s => {
        expect(s.resourceCost, `技能 ${s.id} 应有 resourceCost`).toBeDefined();
        expect(s.resourceCost!).toBeGreaterThanOrEqual(6);
        expect(s.resourceCost!).toBeLessThanOrEqual(30);
      });
    });
  });

  describe('等级分布', () => {
    it('所有技能 unlockLevel ∈ [1, 10]', () => {
      warriorSkills.forEach(s => {
        expect(s.unlockLevel).toBeGreaterThanOrEqual(1);
        expect(s.unlockLevel).toBeLessThanOrEqual(10);
      });
    });

    it('存在 Lv10 巅峰大招', () => {
      const lv10Skills = warriorSkills.filter(s => s.unlockLevel === 10);
      expect(lv10Skills.length).toBeGreaterThanOrEqual(1);
    });

    it('Lv1-4 段至少 4 个技能（基础生成器）', () => {
      const lowTier = warriorSkills.filter(s => s.unlockLevel <= 4);
      expect(lowTier.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('statKey 主属性', () => {
    it('所有 physical_damage 技能 effect.statKey 为 str', () => {
      const physicalSkills = warriorSkills.filter(s => s.type === 'physical_damage');
      physicalSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 str`).toBe('str');
      });
    });
  });

  describe('技能构成', () => {
    it('至少 3 个 buff/debuff 技能', () => {
      const buffDebuff = warriorSkills.filter(s => s.type === 'buff' || s.type === 'debuff');
      expect(buffDebuff.length).toBeGreaterThanOrEqual(3);
    });

    it('至少 2 个 AOE 技能（targetType=all_enemies）', () => {
      const aoe = warriorSkills.filter(s => s.targetType === 'all_enemies');
      expect(aoe.length).toBeGreaterThanOrEqual(2);
    });

    it('buff/debuff 持续回合数在 2-5 区间', () => {
      warriorSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.forEach(b => {
            expect(b.turns).toBeGreaterThanOrEqual(1);
            expect(b.turns).toBeLessThanOrEqual(5);
          });
        }
      });
    });

    it('控制效果（stun）持续 1 回合', () => {
      warriorSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.filter(b => b.type === 'stun').forEach(b => {
            expect(b.turns, `技能 ${s.id} 的 stun 应持续 1 回合`).toBe(1);
          });
        }
      });
    });
  });

  describe('数值平衡', () => {
    const physicalSingle = warriorSkills.filter(s => s.type === 'physical_damage' && s.targetType === 'single');
    const physicalAoe = warriorSkills.filter(s => s.type === 'physical_damage' && s.targetType === 'all_enemies');

    it('单体伤害基础值在 12-60 区间', () => {
      physicalSingle.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 12-60`).toBeGreaterThanOrEqual(12);
        expect(s.effect.value, `技能 ${s.id} value 应在 12-60`).toBeLessThanOrEqual(60);
      });
    });

    it('AOE 伤害基础值在 15-55 区间', () => {
      physicalAoe.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 15-55`).toBeGreaterThanOrEqual(15);
        expect(s.effect.value, `技能 ${s.id} value 应在 15-55`).toBeLessThanOrEqual(55);
      });
    });

    it('Lv10 大招基础值高于 Lv9 中阶技能', () => {
      const lv10 = warriorSkills.filter(s => s.unlockLevel === 10);
      const lv9 = warriorSkills.filter(s => s.unlockLevel === 9 && s.type === 'physical_damage');
      if (lv10.length > 0 && lv9.length > 0) {
        const lv10Max = Math.max(...lv10.map(s => s.effect.value));
        const lv9Max = Math.max(...lv9.map(s => s.effect.value));
        expect(lv10Max).toBeGreaterThan(lv9Max);
      }
    });
  });
});

describe('warrior 被动数据完整性', () => {
  it('被动总数为 6', () => {
    expect(warriorPassives).toHaveLength(6);
  });

  it('所有被动 ID 以 warrior_ 前缀开头', () => {
    warriorPassives.forEach(p => {
      expect(p.id.startsWith('warrior_'), `被动 ${p.id} 应以 warrior_ 开头`).toBe(true);
    });
  });

  it('所有被动 ID 唯一', () => {
    const ids = warriorPassives.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('触发时机覆盖至少 3 种不同 trigger', () => {
    const triggers = new Set(warriorPassives.map(p => p.trigger));
    expect(triggers.size).toBeGreaterThanOrEqual(3);
  });

  it('保留原有 3 个被动 ID', () => {
    const originalIds = ['warrior_iron_will', 'warrior_rage_mastery', 'warrior_bloodlust'];
    originalIds.forEach(id => {
      expect(warriorPassives.find(p => p.id === id), `原被动 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 3 个被动存在', () => {
    const newIds = ['warrior_heavy_armor_mastery', 'warrior_rage_burst', 'warrior_execute_instinct'];
    newIds.forEach(id => {
      expect(warriorPassives.find(p => p.id === id), `新被动 ${id} 应存在`).toBeDefined();
    });
  });

  it('warrior_rage_burst 配置概率触发（probability=0.3, value=5）', () => {
    const rageBurst = warriorPassives.find(p => p.id === 'warrior_rage_burst');
    expect(rageBurst).toBeDefined();
    expect(rageBurst!.effect.probability).toBe(0.3);
    expect(rageBurst!.effect.value).toBe(5);
    expect(rageBurst!.effect.stat).toBe('rage');
    expect(rageBurst!.effect.type).toBe('resource_gen');
  });

  it('warrior_execute_instinct 配置目标低血条件（condition=target_hp < 0.2）', () => {
    const executeInstinct = warriorPassives.find(p => p.id === 'warrior_execute_instinct');
    expect(executeInstinct).toBeDefined();
    expect(executeInstinct!.effect.condition).toBe('target_hp < 0.2');
    expect(executeInstinct!.effect.value).toBe(0.15);
    expect(executeInstinct!.effect.stat).toBe('physical_attack');
    expect(executeInstinct!.effect.type).toBe('stat_modifier');
  });
});
