/**
 * @fileoverview shaman 职业技能数据完整性测试
 *
 * 验证 shaman 16 技能 + 6 被动的数据完整性：
 * - 技能总数 = 16
 * - 资源类型纯 MP：所有技能有 mpCost，无 resourceType/resourceCost/generatesResource
 * - ID 全局唯一、以 shaman_ 开头、unlockLevel ∈ [1, 10]
 * - 所有 magic_damage/health_restore 技能 effect.statKey 为 wis
 * - 构成：≥3 buff/debuff（含控制）+ ≥2 AOE + 1 Lv10 大招
 * - 被动总数 = 6，触发时机覆盖 ≥3 种，保留原 3 个 + 新增 3 个
 */
import { describe, it, expect } from 'vitest';
import { CLASS_ABILITIES } from '@/data/config_skills';
import { CLASS_PASSIVES } from '@/data/config_class_passives';
import type { Skill } from '@/modules/skill/types';
import type { PassiveSkill } from '@/modules/character/types';

const shamanEntry = CLASS_ABILITIES.find(c => c.class_id === 'shaman');
const shamanSkills: Skill[] = shamanEntry?.skills ?? [];
const shamanPassives: PassiveSkill[] = CLASS_PASSIVES.filter(p => p.classId === 'shaman');

describe('shaman 技能数据完整性', () => {
  it('技能总数为 16', () => {
    expect(shamanSkills).toHaveLength(16);
  });

  it('所有技能 ID 全局唯一', () => {
    const ids = shamanSkills.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('所有技能 ID 以 shaman_ 前缀开头', () => {
    shamanSkills.forEach(s => {
      expect(s.id.startsWith('shaman_'), `技能 ${s.id} 应以 shaman_ 开头`).toBe(true);
    });
  });

  it('保留原有 10 个技能 ID', () => {
    const originalIds = [
      'shaman_lightning_bolt',
      'shaman_lava_burst',
      'shaman_healing_wave',
      'shaman_chain_heal',
      'shaman_flame_shock',
      'shaman_frost_shock',
      'shaman_chain_lightning',
      'shaman_windfury',
      'shaman_elemental_strike',
      'shaman_earthquake',
    ];
    originalIds.forEach(id => {
      expect(shamanSkills.find(s => s.id === id), `原技能 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 6 个技能存在', () => {
    const newIds = [
      'shaman_lightning_shield',
      'shaman_healing_stream_totem',
      'shaman_lava_shock',
      'shaman_earthbind_totem',
      'shaman_stormstrike',
      'shaman_elemental_fury',
    ];
    newIds.forEach(id => {
      expect(shamanSkills.find(s => s.id === id), `新技能 ${id} 应存在`).toBeDefined();
    });
  });

  describe('资源消耗正确性（纯 MP 职业）', () => {
    it('所有技能有 mpCost 且在 8-30 区间', () => {
      shamanSkills.forEach(s => {
        expect(s.mpCost, `技能 ${s.id} 应有 mpCost`).toBeDefined();
        expect(s.mpCost!, `技能 ${s.id} mpCost 应 >= 8`).toBeGreaterThanOrEqual(8);
        expect(s.mpCost!, `技能 ${s.id} mpCost 应 <= 30`).toBeLessThanOrEqual(30);
      });
    });

    it('所有技能无 resourceType', () => {
      shamanSkills.forEach(s => {
        expect(s.resourceType, `技能 ${s.id} 不应有 resourceType`).toBeUndefined();
      });
    });

    it('所有技能无 resourceCost', () => {
      shamanSkills.forEach(s => {
        expect(s.resourceCost, `技能 ${s.id} 不应有 resourceCost`).toBeUndefined();
      });
    });

    it('所有技能无 generatesResource', () => {
      shamanSkills.forEach(s => {
        expect(s.generatesResource, `技能 ${s.id} 不应有 generatesResource`).toBeUndefined();
      });
    });
  });

  describe('等级分布', () => {
    it('所有技能 unlockLevel ∈ [1, 10]', () => {
      shamanSkills.forEach(s => {
        expect(s.unlockLevel).toBeGreaterThanOrEqual(1);
        expect(s.unlockLevel).toBeLessThanOrEqual(10);
      });
    });

    it('存在 Lv10 巅峰大招', () => {
      const lv10Skills = shamanSkills.filter(s => s.unlockLevel === 10);
      expect(lv10Skills.length).toBeGreaterThanOrEqual(1);
    });

    it('Lv1-4 段至少 4 个技能（基础技能）', () => {
      const lowTier = shamanSkills.filter(s => s.unlockLevel <= 4);
      expect(lowTier.length).toBeGreaterThanOrEqual(4);
    });

    it('Lv10 大招为 AOE 且 mpCost=30', () => {
      const lv10Skills = shamanSkills.filter(s => s.unlockLevel === 10);
      expect(lv10Skills.length).toBe(1);
      expect(lv10Skills[0].targetType).toBe('all_enemies');
      expect(lv10Skills[0].mpCost).toBe(30);
    });
  });

  describe('statKey 主属性', () => {
    it('所有 magic_damage 技能 effect.statKey 为 wis', () => {
      const magicSkills = shamanSkills.filter(s => s.type === 'magic_damage');
      magicSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 wis`).toBe('wis');
      });
    });

    it('所有 health_restore 技能 effect.statKey 为 wis', () => {
      const healSkills = shamanSkills.filter(s => s.type === 'health_restore');
      healSkills.forEach(s => {
        expect(s.effect.statKey, `技能 ${s.id} statKey 应为 wis`).toBe('wis');
      });
    });

    it('magic_damage + health_restore 技能数量 > 0（确保上述断言有效）', () => {
      const statSkills = shamanSkills.filter(
        s => s.type === 'magic_damage' || s.type === 'health_restore'
      );
      expect(statSkills.length).toBeGreaterThan(0);
    });
  });

  describe('技能构成', () => {
    it('至少 3 个 buff/debuff 技能', () => {
      const buffDebuff = shamanSkills.filter(s => s.type === 'buff' || s.type === 'debuff');
      expect(buffDebuff.length).toBeGreaterThanOrEqual(3);
    });

    it('至少 2 个 AOE 技能（targetType=all_enemies）', () => {
      const aoe = shamanSkills.filter(s => s.targetType === 'all_enemies');
      expect(aoe.length).toBeGreaterThanOrEqual(2);
    });

    it('buff/debuff 持续回合数在 1-5 区间', () => {
      shamanSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.forEach(b => {
            expect(b.turns).toBeGreaterThanOrEqual(1);
            expect(b.turns).toBeLessThanOrEqual(5);
          });
        }
      });
    });

    it('包含控制效果（speed_down 或 stun）', () => {
      const controlTypes = ['speed_down', 'stun', 'freeze', 'silence'];
      const hasControl = shamanSkills.some(
        s => s.buffs?.some(b => controlTypes.includes(b.type))
      );
      expect(hasControl, 'shaman 应至少有一个含控制的技能').toBe(true);
    });

    it('控制效果（stun）持续 1 回合', () => {
      shamanSkills.forEach(s => {
        if (s.buffs) {
          s.buffs.filter(b => b.type === 'stun').forEach(b => {
            expect(b.turns, `技能 ${s.id} 的 stun 应持续 1 回合`).toBe(1);
          });
        }
      });
    });
  });

  describe('数值平衡', () => {
    const magicSingle = shamanSkills.filter(
      s => s.type === 'magic_damage' && s.targetType === 'single'
    );
    const magicAoe = shamanSkills.filter(
      s => s.type === 'magic_damage' && s.targetType === 'all_enemies'
    );

    it('单体魔法伤害基础值在 12-60 区间', () => {
      magicSingle.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 12-60`).toBeGreaterThanOrEqual(12);
        expect(s.effect.value, `技能 ${s.id} value 应在 12-60`).toBeLessThanOrEqual(60);
      });
    });

    it('AOE 魔法伤害基础值在 15-65 区间', () => {
      magicAoe.forEach(s => {
        expect(s.effect.value, `技能 ${s.id} value 应在 15-65`).toBeGreaterThanOrEqual(15);
        expect(s.effect.value, `技能 ${s.id} value 应在 15-65`).toBeLessThanOrEqual(65);
      });
    });

    it('Lv10 大招基础值高于 Lv9 中阶技能', () => {
      const lv10 = shamanSkills.filter(s => s.unlockLevel === 10 && s.type === 'magic_damage');
      const lv9 = shamanSkills.filter(s => s.unlockLevel === 9 && s.type === 'magic_damage');
      if (lv10.length > 0 && lv9.length > 0) {
        const lv10Max = Math.max(...lv10.map(s => s.effect.value));
        const lv9Max = Math.max(...lv9.map(s => s.effect.value));
        expect(lv10Max).toBeGreaterThan(lv9Max);
      }
    });
  });
});

describe('shaman 被动数据完整性', () => {
  it('被动总数为 6', () => {
    expect(shamanPassives).toHaveLength(6);
  });

  it('所有被动 ID 以 shaman_ 前缀开头', () => {
    shamanPassives.forEach(p => {
      expect(p.id.startsWith('shaman_'), `被动 ${p.id} 应以 shaman_ 开头`).toBe(true);
    });
  });

  it('所有被动 ID 唯一', () => {
    const ids = shamanPassives.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('触发时机覆盖至少 3 种不同 trigger', () => {
    const triggers = new Set(shamanPassives.map(p => p.trigger));
    expect(triggers.size).toBeGreaterThanOrEqual(3);
  });

  it('保留原有 3 个被动 ID', () => {
    const originalIds = [
      'shaman_elemental_mastery',
      'shaman_ancestral_knowledge',
      'shaman_healing_wave',
    ];
    originalIds.forEach(id => {
      expect(shamanPassives.find(p => p.id === id), `原被动 ${id} 应保留`).toBeDefined();
    });
  });

  it('新增 3 个被动存在', () => {
    const newIds = ['shaman_totemic_focus', 'shaman_conductivity', 'shaman_stone_bulwark'];
    newIds.forEach(id => {
      expect(shamanPassives.find(p => p.id === id), `新被动 ${id} 应存在`).toBeDefined();
    });
  });

  it('shaman_totemic_focus 配置战斗开始触发（trigger=on_combat_start, value=15）', () => {
    const totemicFocus = shamanPassives.find(p => p.id === 'shaman_totemic_focus');
    expect(totemicFocus).toBeDefined();
    expect(totemicFocus!.trigger).toBe('on_combat_start');
    expect(totemicFocus!.effect.type).toBe('resource_gen');
    expect(totemicFocus!.effect.stat).toBe('mana');
    expect(totemicFocus!.effect.value).toBe(15);
  });

  it('shaman_stone_bulwark 配置低血减伤条件（condition=hp < 0.5）', () => {
    const stoneBulwark = shamanPassives.find(p => p.id === 'shaman_stone_bulwark');
    expect(stoneBulwark).toBeDefined();
    expect(stoneBulwark!.effect.condition).toBe('hp < 0.5');
    expect(stoneBulwark!.effect.value).toBe(0.15);
    expect(stoneBulwark!.effect.type).toBe('damage_reduction');
  });
});
