/**
 * @fileoverview mage 职业技能数据完整性测试
 *
 * 验证 mage 16 技能 + 6 被动的数据完整性：
 * - 技能总数 = 16
 * - 资源类型纯 MP（mpCost，无 resourceType/resourceCost/generatesResource）
 * - ID 全局唯一、unlockLevel ∈ [1, 10]
 * - magic_damage 技能均含 statKey: 'int'
 * - 构成：≥3 buff/debuff（含控制）+ ≥2 AOE + 1 Lv10 大招
 * - MP 消耗区间合理性（8-30）
 * - 被动总数 = 6，触发时机覆盖 ≥ 3 种
 * - 保留原有 3 个被动 ID，新增 3 个存在
 */
import { describe, it, expect } from 'vitest';
import { CLASS_ABILITIES } from '@/data/config_skills';
import { CLASS_PASSIVES } from '@/data/config_class_passives';
import type { Skill } from '@/modules/skill/types';
import type { PassiveSkill } from '@/modules/character/types';

const mageEntry = CLASS_ABILITIES.find(c => c.class_id === 'mage');
const mageSkills: Skill[] = mageEntry?.skills ?? [];
const magePassives: PassiveSkill[] = CLASS_PASSIVES.filter(p => p.classId === 'mage');

describe('mage 技能数据完整性', () => {
  it('技能总数为 16', () => {
    expect(mageSkills).toHaveLength(16);
  });

  it('所有技能 ID 全局唯一', () => {
    const ids = mageSkills.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('所有技能 ID 以 mage_ 前缀开头', () => {
    mageSkills.forEach(s => {
      expect(s.id.startsWith('mage_'), `技能 ${s.id} 应以 mage_ 开头`).toBe(true);
    });
  });

  it('保留原有 10 个技能 ID', () => {
    const originalIds = [
      'mage_fireball',
      'mage_frost_nova',
      'mage_arcane_missiles',
      'mage_frost_bolt',
      'mage_fire_storm',
      'mage_cone_of_cold',
      'mage_arcane_blast',
      'mage_mirror_image',
      'mage_blizzard',
      'mage_pyroblast',
    ];
    originalIds.forEach(id => {
      expect(mageSkills.find(s => s.id === id), `原技能 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 6 个技能存在', () => {
    const newIds = [
      'mage_ice_lance',
      'mage_ice_barrier',
      'mage_living_bomb',
      'mage_arcane_power',
      'mage_fire_blast',
      'mage_arcane_singularity',
    ];
    newIds.forEach(id => {
      expect(mageSkills.find(s => s.id === id), `新技能 ${id} 应存在`).toBeDefined();
    });
  });

  describe('资源消耗正确性（纯 MP 职业）', () => {
    it('所有技能无 resourceType', () => {
      mageSkills.forEach(s => {
        expect(s.resourceType, `技能 ${s.id} 不应有 resourceType`).toBeUndefined();
      });
    });

    it('所有技能无 resourceCost', () => {
      mageSkills.forEach(s => {
        expect(s.resourceCost, `技能 ${s.id} 不应有 resourceCost`).toBeUndefined();
      });
    });

    it('所有技能无 generatesResource', () => {
      mageSkills.forEach(s => {
        expect(s.generatesResource, `技能 ${s.id} 不应有 generatesResource`).toBeUndefined();
      });
    });

    it('所有技能有 mpCost 且在 8-30 区间', () => {
      mageSkills.forEach(s => {
        expect(s.mpCost, `技能 ${s.id} 应有 mpCost`).toBeDefined();
        expect(s.mpCost!).toBeGreaterThanOrEqual(8);
        expect(s.mpCost!).toBeLessThanOrEqual(30);
      });
    });
  });

  describe('等级分布', () => {
    it('所有技能 unlockLevel ∈ [1, 10]', () => {
      mageSkills.forEach(s => {
        expect(s.unlockLevel).toBeGreaterThanOrEqual(1);
        expect(s.unlockLevel).toBeLessThanOrEqual(10);
      });
    });

    it('存在 Lv10 巅峰大招', () => {
      const lv10Skills = mageSkills.filter(s => s.unlockLevel === 10);
      expect(lv10Skills.length).toBeGreaterThanOrEqual(1);
    });

    it('Lv10 大招为 AOE 且 mpCost 30', () => {
      const lv10Skills = mageSkills.filter(s => s.unlockLevel === 10);
      expect(lv10Skills.length).toBeGreaterThanOrEqual(1);
      lv10Skills.forEach(s => {
        expect(s.targetType, `大招 ${s.id} 应为 all_enemies`).toBe('all_enemies');
        expect(s.mpCost, `大招 ${s.id} mpCost 应为 30`).toBe(30);
      });
    });

    it('Lv1-4 段至少 4 个技能（基础法术）', () => {
      const lowTier = mageSkills.filter(s => s.unlockLevel <= 4);
      expect(lowTier.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('statKey 主属性', () => {
    it('所有 magic_damage 技能 effect.statKey 为 int', () => {
      const magicSkills = mageSkills.filter(s => s.type === 'magic_damage');
      magicSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 int`).toBe('int');
      });
    });
  });

  describe('技能构成', () => {
    it('至少 3 个 buff/debuff 技能', () => {
      const buffDebuff = mageSkills.filter(s => s.type === 'buff' || s.type === 'debuff');
      expect(buffDebuff.length).toBeGreaterThanOrEqual(3);
    });

    it('至少 2 个 AOE 技能（targetType=all_enemies）', () => {
      const aoe = mageSkills.filter(s => s.targetType === 'all_enemies');
      expect(aoe.length).toBeGreaterThanOrEqual(2);
    });

    it('包含控制效果（stun/freeze/silence）', () => {
      const controlTypes = ['stun', 'freeze', 'silence'];
      const hasControl = mageSkills.some(s =>
        s.buffs?.some(b => controlTypes.includes(b.type))
      );
      expect(hasControl, 'mage 技能集应包含控制效果').toBe(true);
    });

    it('buff/debuff 持续回合数在 1-5 区间', () => {
      mageSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.forEach(b => {
            expect(b.turns).toBeGreaterThanOrEqual(1);
            expect(b.turns).toBeLessThanOrEqual(5);
          });
        }
      });
    });

    it('控制效果（freeze）持续 1 回合', () => {
      mageSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.filter(b => b.type === 'freeze').forEach(b => {
            expect(b.turns, `技能 ${s.id} 的 freeze 应持续 1 回合`).toBe(1);
          });
        }
      });
    });
  });

  describe('数值平衡', () => {
    const magicSingle = mageSkills.filter(s => s.type === 'magic_damage' && s.targetType === 'single');
    const magicAoe = mageSkills.filter(s => s.type === 'magic_damage' && s.targetType === 'all_enemies');

    it('单体法术基础值在 12-60 区间', () => {
      magicSingle.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 12-60`).toBeGreaterThanOrEqual(12);
        expect(s.effect.value, `技能 ${s.id} value 应在 12-60`).toBeLessThanOrEqual(60);
      });
    });

    it('AOE 法术基础值在 15-55 区间', () => {
      magicAoe.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 15-55`).toBeGreaterThanOrEqual(15);
        expect(s.effect.value, `技能 ${s.id} value 应在 15-55`).toBeLessThanOrEqual(55);
      });
    });

    it('Lv10 大招基础值不低于 Lv8 中阶 AOE 技能', () => {
      const lv10 = mageSkills.filter(s => s.unlockLevel === 10 && s.type === 'magic_damage');
      const lv8 = mageSkills.filter(s => s.unlockLevel === 8 && s.type === 'magic_damage');
      if (lv10.length > 0 && lv8.length > 0) {
        const lv10Max = Math.max(...lv10.map(s => s.effect.value));
        const lv8Max = Math.max(...lv8.map(s => s.effect.value));
        expect(lv10Max).toBeGreaterThanOrEqual(lv8Max);
      }
    });
  });
});

describe('mage 被动数据完整性', () => {
  it('被动总数为 6', () => {
    expect(magePassives).toHaveLength(6);
  });

  it('所有被动 ID 以 mage_ 前缀开头', () => {
    magePassives.forEach(p => {
      expect(p.id.startsWith('mage_'), `被动 ${p.id} 应以 mage_ 开头`).toBe(true);
    });
  });

  it('所有被动 ID 唯一', () => {
    const ids = magePassives.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('触发时机覆盖至少 3 种不同 trigger', () => {
    const triggers = new Set(magePassives.map(p => p.trigger));
    expect(triggers.size).toBeGreaterThanOrEqual(3);
  });

  it('保留原有 3 个被动 ID', () => {
    const originalIds = ['mage_arcane_mastery', 'mage_mana_surge', 'mage_spell_critical'];
    originalIds.forEach(id => {
      expect(magePassives.find(p => p.id === id), `原被动 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 3 个被动存在', () => {
    const newIds = ['mage_arcane_shield', 'mage_spell_vampirism', 'mage_arcane_concentration'];
    newIds.forEach(id => {
      expect(magePassives.find(p => p.id === id), `新被动 ${id} 应存在`).toBeDefined();
    });
  });

  it('mage_arcane_shield 配置低血条件（condition=hp < 0.3）', () => {
    const arcaneShield = magePassives.find(p => p.id === 'mage_arcane_shield');
    expect(arcaneShield).toBeDefined();
    expect(arcaneShield!.effect.condition).toBe('hp < 0.3');
    expect(arcaneShield!.effect.value).toBe(0.15);
    expect(arcaneShield!.effect.type).toBe('damage_reduction');
    expect(arcaneShield!.trigger).toBe('on_low_hp');
  });

  it('mage_spell_vampirism 配置攻击吸血（trigger=on_attack, value=0.04）', () => {
    const vampirism = magePassives.find(p => p.id === 'mage_spell_vampirism');
    expect(vampirism).toBeDefined();
    expect(vampirism!.trigger).toBe('on_attack');
    expect(vampirism!.effect.type).toBe('heal');
    expect(vampirism!.effect.value).toBe(0.04);
  });

  it('mage_arcane_concentration 配置击杀回蓝（trigger=on_kill, stat=mana, value=15）', () => {
    const concentration = magePassives.find(p => p.id === 'mage_arcane_concentration');
    expect(concentration).toBeDefined();
    expect(concentration!.trigger).toBe('on_kill');
    expect(concentration!.effect.type).toBe('resource_gen');
    expect(concentration!.effect.stat).toBe('mana');
    expect(concentration!.effect.value).toBe(15);
  });
});
