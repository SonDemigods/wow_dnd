/**
 * @fileoverview 技能模块 service 纯函数单元测试
 *
 * 覆盖范围：
 * 1. calculateSkillDamage —— 各类型技能伤害计算
 * 2. getSkillCoefficient —— 等级分层系数
 * 3. calculateBuffValue —— Buff/Debuff 效果值计算
 * 4. canLearnSkill —— 学习条件校验
 * 5. validateSkillBarSlot —— 技能栏槽位校验
 * 6. isSkillEquipped —— 装备状态检查
 * 7. canCastSkill —— 施放四维校验（BIZ-11）
 */
import { describe, it, expect } from 'vitest';
import {
  calculateSkillDamage,
  getSkillCoefficient,
  calculateBuffValue,
  canLearnSkill,
  validateSkillBarSlot,
  isSkillEquipped,
  canCastSkill,
  type CanCastSkillOptions,
} from '@/modules/skill/service';
import type { Skill, SkillBar, SkillBuffEffect } from '@/modules/skill/types';
import type { Stats } from '@/modules/character/types';

/** 构造测试用 Skill 实例 */
function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'test_skill',
    name: '测试技能',
    icon: 'game-icons:shield',
    description: '测试用技能',
    mpCost: 20,
    type: 'magic_damage',
    effect: { type: 'magic_damage', value: 50 },
    unlockLevel: 1,
    ...overrides,
  };
}

/** 构造测试用属性 */
function makeStats(overrides: Partial<Stats> = {}): Stats {
  return {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    ...overrides,
  };
}

/** 构造测试用 Buff 效果 */
function makeBuffEffect(overrides: Partial<SkillBuffEffect> = {}): SkillBuffEffect {
  return {
    type: 'attack_up',
    value: 10,
    turns: 3,
    ...overrides,
  };
}

describe('calculateSkillDamage 技能伤害计算', () => {
  describe('physical_damage 物理伤害', () => {
    it('基础值 + 力量 × 系数', () => {
      const skill = makeSkill({
        type: 'physical_damage',
        effect: { type: 'physical_damage', value: 50, coefficient: 0.5 },
        unlockLevel: 1,
      });
      const stats = makeStats({ str: 20 });
      // 50 + 20 * 0.5 = 60
      expect(calculateSkillDamage(skill, stats)).toBe(60);
    });

    it('未指定 coefficient 时按等级自动计算', () => {
      const skill = makeSkill({
        type: 'physical_damage',
        effect: { type: 'physical_damage', value: 50 },
        unlockLevel: 1,
      });
      const stats = makeStats({ str: 20 });
      // 系数 = 0.50（Lv1-2 tier 0），50 + 20 * 0.5 = 60
      expect(calculateSkillDamage(skill, stats)).toBe(60);
    });
  });

  describe('magic_damage 魔法伤害', () => {
    it('基础值 + 智力 × 系数', () => {
      const skill = makeSkill({
        type: 'magic_damage',
        effect: { type: 'magic_damage', value: 30, coefficient: 0.8 },
        unlockLevel: 1,
      });
      const stats = makeStats({ int: 25 });
      // 30 + 25 * 0.8 = 50
      expect(calculateSkillDamage(skill, stats)).toBe(50);
    });

    it('未指定 coefficient 时按等级自动计算（覆盖 ?? getSkillCoefficient 分支）', () => {
      const skill = makeSkill({
        type: 'magic_damage',
        effect: { type: 'magic_damage', value: 30 },
        unlockLevel: 1,
      });
      const stats = makeStats({ int: 25 });
      // 系数 = 0.50（Lv1-2 tier 0 damage），30 + 25 * 0.5 = 42.5 → floor = 42
      expect(calculateSkillDamage(skill, stats)).toBe(42);
    });
  });

  describe('health_restore 生命恢复', () => {
    it('基础值 + 智慧 × 系数', () => {
      const skill = makeSkill({
        type: 'health_restore',
        effect: { type: 'health_restore', value: 40, coefficient: 0.3 },
        unlockLevel: 1,
      });
      const stats = makeStats({ wis: 30 });
      // 40 + 30 * 0.3 = 49
      expect(calculateSkillDamage(skill, stats)).toBe(49);
    });

    it('未指定 coefficient 时按等级自动计算（覆盖 ?? getSkillCoefficient 分支）', () => {
      const skill = makeSkill({
        type: 'health_restore',
        effect: { type: 'health_restore', value: 40 },
        unlockLevel: 1,
      });
      const stats = makeStats({ wis: 30 });
      // 系数 = 0.30（Lv1-2 tier 0 heal），40 + 30 * 0.30 = 49
      expect(calculateSkillDamage(skill, stats)).toBe(49);
    });
  });

  describe('mana_restore 法力恢复', () => {
    it('基础值 + 智力 × 系数', () => {
      const skill = makeSkill({
        type: 'mana_restore',
        effect: { type: 'mana_restore', value: 20, coefficient: 0.3 },
        unlockLevel: 1,
      });
      const stats = makeStats({ int: 30 });
      // 20 + 30 * 0.3 = 29
      expect(calculateSkillDamage(skill, stats)).toBe(29);
    });

    it('未指定 coefficient 时按等级自动计算（覆盖 ?? getSkillCoefficient 分支）', () => {
      const skill = makeSkill({
        type: 'mana_restore',
        effect: { type: 'mana_restore', value: 20 },
        unlockLevel: 1,
      });
      const stats = makeStats({ int: 30 });
      // 系数 = 0.30（Lv1-2 tier 0 heal），20 + 30 * 0.30 = 29
      expect(calculateSkillDamage(skill, stats)).toBe(29);
    });
  });

  describe('buff/debuff 类型', () => {
    it('buff 类型返回 0', () => {
      const skill = makeSkill({
        type: 'buff',
        effect: { type: 'buff', value: 50 },
      });
      expect(calculateSkillDamage(skill, makeStats())).toBe(0);
    });

    it('debuff 类型返回 0', () => {
      const skill = makeSkill({
        type: 'debuff',
        effect: { type: 'debuff', value: 50 },
      });
      expect(calculateSkillDamage(skill, makeStats())).toBe(0);
    });
  });

  it('结果向下取整', () => {
    const skill = makeSkill({
      type: 'physical_damage',
      effect: { type: 'physical_damage', value: 50, coefficient: 0.3 },
      unlockLevel: 1,
    });
    const stats = makeStats({ str: 7 });
    // 50 + 7 * 0.3 = 52.1 → floor = 52
    expect(calculateSkillDamage(skill, stats)).toBe(52);
  });

  describe('statKey 自定义主属性', () => {
    it('physical_damage 默认走 str', () => {
      const skill = makeSkill({
        type: 'physical_damage',
        effect: { type: 'physical_damage', value: 20, coefficient: 0.5 },
        unlockLevel: 1,
      });
      const stats = makeStats({ str: 10, dex: 20 });
      // 默认 str：20 + 10 * 0.5 = 25
      expect(calculateSkillDamage(skill, stats)).toBe(25);
    });

    it('statKey=dex 时 physical_damage 走 dex 而非 str', () => {
      const skill = makeSkill({
        type: 'physical_damage',
        effect: { type: 'physical_damage', value: 20, coefficient: 0.5, statKey: 'dex' },
        unlockLevel: 1,
      });
      const stats = makeStats({ str: 10, dex: 20 });
      // statKey=dex：20 + 20 * 0.5 = 30
      expect(calculateSkillDamage(skill, stats)).toBe(30);
    });

    it('statKey=cha 时 magic_damage 走 cha 而非 int', () => {
      const skill = makeSkill({
        type: 'magic_damage',
        effect: { type: 'magic_damage', value: 15, coefficient: 0.5, statKey: 'cha' },
        unlockLevel: 1,
      });
      const stats = makeStats({ int: 10, cha: 20 });
      // statKey=cha：15 + 20 * 0.5 = 25
      expect(calculateSkillDamage(skill, stats)).toBe(25);
    });

    it('statKey=wis 时 magic_damage 走 wis（healer 伤害技能）', () => {
      const skill = makeSkill({
        type: 'magic_damage',
        effect: { type: 'magic_damage', value: 15, coefficient: 0.5, statKey: 'wis' },
        unlockLevel: 1,
      });
      const stats = makeStats({ int: 10, wis: 20 });
      // statKey=wis：15 + 20 * 0.5 = 25
      expect(calculateSkillDamage(skill, stats)).toBe(25);
    });
  });

  describe('终结技缩放（scalingResource）', () => {
    it('consumedAmount 缩放伤害（×3）', () => {
      const skill = makeSkill({
        type: 'physical_damage',
        effect: { type: 'physical_damage', value: 20, coefficient: 0.5, statKey: 'dex' },
        unlockLevel: 1,
        scalingResource: 'combo_point',
      });
      const stats = makeStats({ dex: 10 });
      // base = 20 + 10 * 0.5 = 25，consumedAmount=3：25 * 3 * 1.0 = 75
      expect(calculateSkillDamage(skill, stats, 3)).toBe(75);
    });

    it('consumedAmount=6 时达到最大缩放', () => {
      const skill = makeSkill({
        type: 'physical_damage',
        effect: { type: 'physical_damage', value: 20, coefficient: 0.5, statKey: 'dex' },
        unlockLevel: 1,
        scalingResource: 'combo_point',
      });
      const stats = makeStats({ dex: 10 });
      // base = 25，consumedAmount=6：25 * 6 * 1.0 = 150
      expect(calculateSkillDamage(skill, stats, 6)).toBe(150);
    });

    it('scalingMultiplier 自定义倍率', () => {
      const skill = makeSkill({
        type: 'physical_damage',
        effect: { type: 'physical_damage', value: 20, coefficient: 0.5, statKey: 'dex' },
        unlockLevel: 1,
        scalingResource: 'chi',
        scalingMultiplier: 1.5,
      });
      const stats = makeStats({ dex: 10 });
      // base = 25，consumedAmount=2：25 * 2 * 1.5 = 75
      expect(calculateSkillDamage(skill, stats, 2)).toBe(75);
    });

    it('未传 consumedAmount 时不缩放（返回基础值）', () => {
      const skill = makeSkill({
        type: 'physical_damage',
        effect: { type: 'physical_damage', value: 20, coefficient: 0.5, statKey: 'dex' },
        unlockLevel: 1,
        scalingResource: 'combo_point',
      });
      const stats = makeStats({ dex: 10 });
      // base = 25，无 consumedAmount：返回 25
      expect(calculateSkillDamage(skill, stats)).toBe(25);
    });

    it('consumedAmount=0 时不缩放', () => {
      const skill = makeSkill({
        type: 'physical_damage',
        effect: { type: 'physical_damage', value: 20, coefficient: 0.5, statKey: 'dex' },
        unlockLevel: 1,
        scalingResource: 'combo_point',
      });
      const stats = makeStats({ dex: 10 });
      // base = 25，consumedAmount=0：不缩放，返回 25
      expect(calculateSkillDamage(skill, stats, 0)).toBe(25);
    });
  });
});

describe('getSkillCoefficient 等级分层系数', () => {
  it('buff 类型固定返回 0', () => {
    expect(getSkillCoefficient(1, 'buff')).toBe(0);
    expect(getSkillCoefficient(10, 'buff')).toBe(0);
  });

  describe('damage 类型系数', () => {
    it('Lv 1-2 tier 0：0.50', () => {
      expect(getSkillCoefficient(1, 'damage')).toBe(0.50);
      expect(getSkillCoefficient(2, 'damage')).toBe(0.50);
    });

    it('Lv 3-5 tier 1：0.55', () => {
      expect(getSkillCoefficient(3, 'damage')).toBe(0.55);
      expect(getSkillCoefficient(5, 'damage')).toBe(0.55);
    });

    it('Lv 6-8 tier 2：0.62', () => {
      expect(getSkillCoefficient(6, 'damage')).toBe(0.62);
      expect(getSkillCoefficient(8, 'damage')).toBe(0.62);
    });

    it('Lv 9-12 tier 3：0.72', () => {
      expect(getSkillCoefficient(9, 'damage')).toBe(0.72);
      expect(getSkillCoefficient(12, 'damage')).toBe(0.72);
    });

    it('Lv 13-16 tier 4：0.84', () => {
      expect(getSkillCoefficient(13, 'damage')).toBe(0.84);
      expect(getSkillCoefficient(16, 'damage')).toBe(0.84);
    });

    it('Lv 17-20 tier 5：0.98', () => {
      expect(getSkillCoefficient(17, 'damage')).toBe(0.98);
      expect(getSkillCoefficient(20, 'damage')).toBe(0.98);
    });
  });

  describe('heal 类型系数', () => {
    it('Lv 1-2 tier 0：0.30', () => {
      expect(getSkillCoefficient(1, 'heal')).toBe(0.30);
      expect(getSkillCoefficient(2, 'heal')).toBe(0.30);
    });

    it('Lv 3-5 tier 1：0.34', () => {
      expect(getSkillCoefficient(3, 'heal')).toBe(0.34);
      expect(getSkillCoefficient(5, 'heal')).toBe(0.34);
    });

    it('Lv 6-8 tier 2：0.38', () => {
      expect(getSkillCoefficient(6, 'heal')).toBe(0.38);
      expect(getSkillCoefficient(8, 'heal')).toBe(0.38);
    });

    it('Lv 9-12 tier 3：0.43', () => {
      expect(getSkillCoefficient(9, 'heal')).toBe(0.43);
      expect(getSkillCoefficient(12, 'heal')).toBe(0.43);
    });

    it('Lv 13-16 tier 4：0.49', () => {
      expect(getSkillCoefficient(13, 'heal')).toBe(0.49);
      expect(getSkillCoefficient(16, 'heal')).toBe(0.49);
    });

    it('Lv 17-20 tier 5：0.56', () => {
      expect(getSkillCoefficient(17, 'heal')).toBe(0.56);
      expect(getSkillCoefficient(20, 'heal')).toBe(0.56);
    });
  });
});

describe('calculateBuffValue Buff 效果值计算', () => {
  describe('百分比类（WIS 加成）', () => {
    it('attack_up：value + WIS × 0.30', () => {
      const effect = makeBuffEffect({ type: 'attack_up', value: 10 });
      const stats = makeStats({ wis: 20 });
      // 10 + 20 * 0.3 = 16
      expect(calculateBuffValue(effect, stats)).toBe(16);
    });

    it('attack_down：value + WIS × 0.30', () => {
      const effect = makeBuffEffect({ type: 'attack_down', value: 10 });
      const stats = makeStats({ wis: 20 });
      expect(calculateBuffValue(effect, stats)).toBe(16);
    });

    it('defense_up：value + WIS × 0.25', () => {
      const effect = makeBuffEffect({ type: 'defense_up', value: 10 });
      const stats = makeStats({ wis: 20 });
      // 10 + 20 * 0.25 = 15
      expect(calculateBuffValue(effect, stats)).toBe(15);
    });

    it('defense_down：value + WIS × 0.25', () => {
      const effect = makeBuffEffect({ type: 'defense_down', value: 10 });
      const stats = makeStats({ wis: 20 });
      expect(calculateBuffValue(effect, stats)).toBe(15);
    });

    it('vulnerable：value + WIS × 0.20', () => {
      const effect = makeBuffEffect({ type: 'vulnerable', value: 10 });
      const stats = makeStats({ wis: 20 });
      // 10 + 20 * 0.2 = 14
      expect(calculateBuffValue(effect, stats)).toBe(14);
    });
  });

  describe('固定值类（WIS 加成）', () => {
    it('poison：value + WIS × 0.50', () => {
      const effect = makeBuffEffect({ type: 'poison', value: 20 });
      const stats = makeStats({ wis: 10 });
      // 20 + 10 * 0.5 = 25
      expect(calculateBuffValue(effect, stats)).toBe(25);
    });

    it('burn：value + WIS × 0.60', () => {
      const effect = makeBuffEffect({ type: 'burn', value: 20 });
      const stats = makeStats({ wis: 10 });
      // 20 + 10 * 0.6 = 26
      expect(calculateBuffValue(effect, stats)).toBe(26);
    });

    it('regen：value + WIS × 0.50', () => {
      const effect = makeBuffEffect({ type: 'regen', value: 15 });
      const stats = makeStats({ wis: 10 });
      // 15 + 10 * 0.5 = 20
      expect(calculateBuffValue(effect, stats)).toBe(20);
    });

    it('shield：value + WIS × 0.80', () => {
      const effect = makeBuffEffect({ type: 'shield', value: 30 });
      const stats = makeStats({ wis: 10 });
      // 30 + 10 * 0.8 = 38
      expect(calculateBuffValue(effect, stats)).toBe(38);
    });
  });

  describe('倍率类', () => {
    it('thorn：min(0.60, value + WIS × 0.005)', () => {
      const effect = makeBuffEffect({ type: 'thorn', value: 0.3 });
      const stats = makeStats({ wis: 20 });
      // 0.3 + 20 * 0.005 = 0.4
      expect(calculateBuffValue(effect, stats)).toBe(0.4);
    });

    it('thorn 上限为 0.60', () => {
      const effect = makeBuffEffect({ type: 'thorn', value: 0.5 });
      const stats = makeStats({ wis: 50 });
      // 0.5 + 50 * 0.005 = 0.75 → min(0.60, 0.75) = 0.60
      expect(calculateBuffValue(effect, stats)).toBe(0.60);
    });
  });

  describe('控制类（不缩放）', () => {
    it('stun 直接返回 value', () => {
      const effect = makeBuffEffect({ type: 'stun', value: 1 });
      expect(calculateBuffValue(effect, makeStats({ wis: 100 }))).toBe(1);
    });

    it('freeze 直接返回 value', () => {
      const effect = makeBuffEffect({ type: 'freeze', value: 1 });
      expect(calculateBuffValue(effect, makeStats({ wis: 100 }))).toBe(1);
    });

    it('silence 直接返回 value', () => {
      const effect = makeBuffEffect({ type: 'silence', value: 1 });
      expect(calculateBuffValue(effect, makeStats({ wis: 100 }))).toBe(1);
    });
  });

  describe('速度类（DEX 加成）', () => {
    it('speed_up：value + DEX × 0.30', () => {
      const effect = makeBuffEffect({ type: 'speed_up', value: 5 });
      const stats = makeStats({ dex: 20 });
      // 5 + 20 * 0.3 = 11
      expect(calculateBuffValue(effect, stats)).toBe(11);
    });

    it('speed_down：value + DEX × 0.30', () => {
      const effect = makeBuffEffect({ type: 'speed_down', value: 5 });
      const stats = makeStats({ dex: 20 });
      expect(calculateBuffValue(effect, stats)).toBe(11);
    });
  });

  it('结果向下取整', () => {
    const effect = makeBuffEffect({ type: 'attack_up', value: 10 });
    const stats = makeStats({ wis: 7 });
    // 10 + 7 * 0.3 = 12.1 → floor = 12
    expect(calculateBuffValue(effect, stats)).toBe(12);
  });
});

describe('canLearnSkill 学习条件校验', () => {
  it('等级足够且未学习时可以学习', () => {
    const skill = makeSkill({ unlockLevel: 5 });
    expect(canLearnSkill(skill, 10, [])).toBe(true);
  });

  it('等级不足时不可学习', () => {
    const skill = makeSkill({ unlockLevel: 10 });
    expect(canLearnSkill(skill, 5, [])).toBe(false);
  });

  it('等级刚好满足时可以学习', () => {
    const skill = makeSkill({ unlockLevel: 5 });
    expect(canLearnSkill(skill, 5, [])).toBe(true);
  });

  it('已学习时不可重复学习', () => {
    const skill = makeSkill({ id: 'skill_001', unlockLevel: 1 });
    const learned: Skill[] = [makeSkill({ id: 'skill_001' })];
    expect(canLearnSkill(skill, 10, learned)).toBe(false);
  });

  it('已学习其他技能时不影响', () => {
    const skill = makeSkill({ id: 'skill_002', unlockLevel: 1 });
    const learned: Skill[] = [makeSkill({ id: 'skill_001' })];
    expect(canLearnSkill(skill, 10, learned)).toBe(true);
  });
});

describe('validateSkillBarSlot 技能栏槽位校验', () => {
  it('槽位 0 有效', () => {
    expect(validateSkillBarSlot(0)).toBe(true);
  });

  it('槽位 3 有效', () => {
    expect(validateSkillBarSlot(3)).toBe(true);
  });

  it('槽位 -1 无效', () => {
    expect(validateSkillBarSlot(-1)).toBe(false);
  });

  it('槽位 4 无效', () => {
    expect(validateSkillBarSlot(4)).toBe(false);
  });

  it('槽位 99 无效', () => {
    expect(validateSkillBarSlot(99)).toBe(false);
  });
});

describe('isSkillEquipped 装备状态检查', () => {
  function makeSkillBar(slots: (string | null)[]): SkillBar {
    return { slots: [slots[0], slots[1], slots[2], slots[3]] } as SkillBar;
  }

  it('技能已装备在槽位 0 时返回 true', () => {
    const bar = makeSkillBar(['skill_001', null, null, null]);
    expect(isSkillEquipped(bar, 'skill_001')).toBe(true);
  });

  it('技能已装备在槽位 3 时返回 true', () => {
    const bar = makeSkillBar([null, null, null, 'skill_003']);
    expect(isSkillEquipped(bar, 'skill_003')).toBe(true);
  });

  it('技能未装备时返回 false', () => {
    const bar = makeSkillBar(['skill_001', null, null, null]);
    expect(isSkillEquipped(bar, 'skill_999')).toBe(false);
  });

  it('空技能栏返回 false', () => {
    const bar = makeSkillBar([null, null, null, null]);
    expect(isSkillEquipped(bar, 'skill_001')).toBe(false);
  });
});

describe('canCastSkill 施放校验', () => {
  // ==================== 沉默检查 ====================
  describe('沉默状态校验', () => {
    it('被沉默时禁止施放任何技能', () => {
      const skill = makeSkill();
      const result = canCastSkill(skill, { currentMana: 100, isSilenced: true });
      expect(result.canCast).toBe(false);
      expect(result.reason).toContain('沉默');
    });

    it('未沉默时不受此条件影响', () => {
      const skill = makeSkill();
      const result = canCastSkill(skill, { currentMana: 100, isSilenced: false });
      expect(result.canCast).toBe(true);
    });
  });

  // ==================== 冷却检查 ====================
  describe('冷却时间校验', () => {
    it('冷却中（currentCooldown > 0）禁止施放', () => {
      const skill = makeSkill();
      const result = canCastSkill(skill, { currentMana: 100, currentCooldown: 2 });
      expect(result.canCast).toBe(false);
      expect(result.reason).toContain('冷却');
    });

    it('冷却已就绪（currentCooldown = 0）可以施放', () => {
      const skill = makeSkill();
      const result = canCastSkill(skill, { currentMana: 100, currentCooldown: 0 });
      expect(result.canCast).toBe(true);
    });

    it('未传入 currentCooldown 时不做冷却校验', () => {
      const skill = makeSkill();
      const result = canCastSkill(skill, { currentMana: 100 });
      expect(result.canCast).toBe(true);
    });
  });

  // ==================== 法力检查 ====================
  describe('法力值校验', () => {
    it('法力不足时禁止施放', () => {
      const skill = makeSkill({ mpCost: 50 });
      const result = canCastSkill(skill, { currentMana: 30 });
      expect(result.canCast).toBe(false);
      expect(result.reason).toContain('法力');
    });

    it('法力刚好等于消耗量时可以施放', () => {
      const skill = makeSkill({ mpCost: 50 });
      const result = canCastSkill(skill, { currentMana: 50 });
      expect(result.canCast).toBe(true);
    });

    it('零消耗技能始终满足法力条件', () => {
      const skill = makeSkill({ mpCost: 0 });
      const result = canCastSkill(skill, { currentMana: 0 });
      expect(result.canCast).toBe(true);
    });
  });

  // ==================== 资源系统检查 ====================
  describe('资源系统校验', () => {
    it('资源不足时禁止施放', () => {
      const skill = makeSkill({ mpCost: 0, resourceType: 'rage', resourceCost: 30 });
      const result = canCastSkill(skill, {
        currentMana: 100,
        hasEnoughResource: () => false,
      });
      expect(result.canCast).toBe(false);
      expect(result.reason).toContain('资源');
    });

    it('资源充足时可以施放', () => {
      const skill = makeSkill({ mpCost: 0, resourceType: 'energy', resourceCost: 40 });
      const result = canCastSkill(skill, {
        currentMana: 100,
        hasEnoughResource: () => true,
      });
      expect(result.canCast).toBe(true);
    });

    it('hasEnoughResource 接收正确的参数', () => {
      const skill = makeSkill({ resourceType: 'combo_point', resourceCost: 3 });
      let receivedType = '';
      let receivedCost = 0;
      canCastSkill(skill, {
        currentMana: 100,
        hasEnoughResource: (type, cost) => {
          receivedType = type;
          receivedCost = cost;
          return true;
        },
      });
      expect(receivedType).toBe('combo_point');
      expect(receivedCost).toBe(3);
    });

    it('技能未配置 resourceType 时跳过资源校验', () => {
      const skill = makeSkill({ mpCost: 10 });
      const result = canCastSkill(skill, {
        currentMana: 100,
        hasEnoughResource: () => false,
      });
      expect(result.canCast).toBe(true);
    });
  });

  // ==================== 校验顺序 ====================
  describe('校验顺序（短路求值）', () => {
    it('沉默优先于冷却', () => {
      const skill = makeSkill();
      const result = canCastSkill(skill, {
        currentMana: 100, isSilenced: true, currentCooldown: 5,
      });
      expect(result.reason).toContain('沉默');
    });

    it('冷却优先于法力', () => {
      const skill = makeSkill({ mpCost: 999 });
      const result = canCastSkill(skill, { currentMana: 1, currentCooldown: 3 });
      expect(result.reason).toContain('冷却');
    });

    it('法力优先于资源系统', () => {
      const skill = makeSkill({ mpCost: 999, resourceType: 'rage', resourceCost: 999 });
      const result = canCastSkill(skill, {
        currentMana: 1, hasEnoughResource: () => false,
      });
      expect(result.reason).toContain('法力');
    });
  });

  // ==================== 向后兼容 ====================
  describe('旧签名向后兼容', () => {
    it('第二个参数为 number 时视为 currentMana', () => {
      const skill = makeSkill({ mpCost: 20 });
      const result = canCastSkill(skill, 100);
      expect(result.canCast).toBe(true);
    });

    it('旧签名法力不足时返回 false', () => {
      const skill = makeSkill({ mpCost: 50 });
      const result = canCastSkill(skill, 10);
      expect(result.canCast).toBe(false);
      expect(result.reason).toContain('法力');
    });
  });

  // ==================== 全部通过 ====================
  describe('全部条件通过', () => {
    it('所有校验均通过时返回 canCast=true 且 reason 为空', () => {
      const skill = makeSkill({ mpCost: 20, resourceType: 'rage', resourceCost: 30 });
      const opts: CanCastSkillOptions = {
        currentMana: 100,
        currentCooldown: 0,
        isSilenced: false,
        hasEnoughResource: () => true,
      };
      const result = canCastSkill(skill, opts);
      expect(result.canCast).toBe(true);
      expect(result.reason).toBe('');
    });
  });
});

// ============================================================
// 补充覆盖：default 兜底分支（未知类型）
// ============================================================

describe('default 兜底分支覆盖', () => {
  it('calculateSkillDamage 未知技能类型时走 default 返回 effect.value', () => {
    // Arrange：SkillType 联合类型已穷尽 case，default 仅在运行时收到未知类型时触发
    // 通过类型断言传入不在联合类型中的值，模拟未来扩展或异常数据
    const skill = makeSkill({
      type: 'unknown_type' as Skill['type'],
      effect: { type: 'unknown_type' as Skill['effect']['type'], value: 42 },
    });
    // Act
    const result = calculateSkillDamage(skill, makeStats());
    // Assert：default 分支用 int 属性 + damage 系数计算（42 + 10×0.50 = 47）
    expect(result).toBe(47);
  });

  it('calculateBuffValue 未知效果类型时走 default 返回 value', () => {
    // Arrange：EffectType 联合类型已穷尽 case，default 仅在运行时收到未知类型时触发
    const effect = makeBuffEffect({ type: 'unknown_effect' as SkillBuffEffect['type'], value: 99 });
    // Act
    const result = calculateBuffValue(effect, makeStats({ wis: 100, dex: 100 }));
    // Assert：default 分支直接返回 value，不受属性加成影响
    expect(result).toBe(99);
  });
});
