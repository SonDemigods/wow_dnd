/**
 * @fileoverview useSkillDisplay Composable 单元测试
 *
 * 覆盖 useSkillDisplay 的 6 个纯函数：
 * 1. getSkillTypeName / getSkillTypeIcon / getTargetTypeName / getEffectTypeName
 *    名称与图标映射（含已知 / 未知 / 空值边界）
 * 2. getSkillEffectText 详细描述文本（伤害 / 恢复 / buff / debuff / 未知）
 * 3. getSkillEffectBrief 紧凑描述（含 coefficient 拼接、buff/debuff 列表）
 *
 * 设计说明：
 *  - useSkillDisplay 为纯函数集合（无副作用、无状态、无外部依赖），无需 mock 任何模块。
 *  - 使用 makeSkill 工厂构造 Skill 对象，减少重复样板。
 *  - 对超出类型契约的边界用例（null effect、未知 effect.type），
 *    通过 `{ ...makeSkill(), ... } as Skill` 展开断言绕过字面量校验，避免使用 any。
 *  - 严格遵循 AAA 模式，每个 it 至少一个有意义的 expect。
 */
import { describe, it, expect } from 'vitest';
import { useSkillDisplay } from '@/composables/useSkillDisplay';
import type { Skill } from '@/modules/skill';

/** 构造测试用 Skill 对象，默认为物理伤害技能（value=50） */
function makeSkill(o: Partial<Skill> = {}): Skill {
  return {
    id: 'skill_1',
    name: '测试技能',
    icon: 'ic',
    description: 'd',
    mpCost: 10,
    type: 'physical_damage',
    effect: { type: 'physical_damage', value: 50 },
    unlockLevel: 1,
    ...o,
  } as Skill;
}

describe('useSkillDisplay - 技能展示工具函数', () => {
  describe('getSkillTypeName 技能类型中文名', () => {
    const { getSkillTypeName } = useSkillDisplay();

    it.each([
      ['physical_damage', '物理伤害'],
      ['magic_damage', '魔法伤害'],
      ['health_restore', '生命恢复'],
      ['mana_restore', '法力恢复'],
      ['buff', '增益'],
      ['debuff', '减益'],
    ])('已知类型 %s 返回 %s', (type, expected) => {
      expect(getSkillTypeName(type)).toBe(expected);
    });

    it('未知类型返回原值', () => {
      expect(getSkillTypeName('unknown')).toBe('unknown');
    });

    it('空字符串返回空字符串', () => {
      expect(getSkillTypeName('')).toBe('');
    });
  });

  describe('getSkillTypeIcon 技能类型图标', () => {
    const { getSkillTypeIcon } = useSkillDisplay();

    it.each([
      ['physical_damage', 'game-icons:sword-clash'],
      ['magic_damage', 'game-icons:magic-swirl'],
      ['health_restore', 'game-icons:health-increase'],
      ['mana_restore', 'game-icons:magic-palm'],
      ['buff', 'game-icons:upgrade'],
      ['debuff', 'game-icons:armor-downgrade'],
    ])('已知类型 %s 返回 %s', (type, expected) => {
      expect(getSkillTypeIcon(type)).toBe(expected);
    });

    it('未知类型返回默认图标 sparkles', () => {
      expect(getSkillTypeIcon('unknown')).toBe('game-icons:sparkles');
    });

    it('空字符串返回默认图标', () => {
      expect(getSkillTypeIcon('')).toBe('game-icons:sparkles');
    });
  });

  describe('getTargetTypeName 目标类型中文名', () => {
    const { getTargetTypeName } = useSkillDisplay();

    it.each([
      ['single', '单体'],
      ['all_enemies', '多目标'],
      ['self', '自身'],
      ['ally', '友方'],
    ])('已知类型 %s 返回 %s', (type, expected) => {
      expect(getTargetTypeName(type)).toBe(expected);
    });

    it('未知类型返回原值', () => {
      expect(getTargetTypeName('unknown')).toBe('unknown');
    });
  });

  describe('getEffectTypeName 效果类型中文名', () => {
    const { getEffectTypeName } = useSkillDisplay();

    it.each([
      ['poison', '中毒'],
      ['burn', '灼烧'],
      ['stun', '眩晕'],
      ['freeze', '冰冻'],
      ['silence', '沉默'],
      ['shield', '护盾'],
      ['attack_up', '加攻'],
      ['attack_down', '降攻'],
      ['defense_up', '加防'],
      ['defense_down', '降防'],
      ['speed_up', '加速'],
      ['speed_down', '减速'],
      ['regen', '回复'],
      ['vulnerable', '易伤'],
    ])('已知效果 %s 返回 %s', (type, expected) => {
      expect(getEffectTypeName(type)).toBe(expected);
    });

    it('未知效果类型返回原值', () => {
      expect(getEffectTypeName('unknown_effect')).toBe('unknown_effect');
    });
  });

  describe('getSkillEffectText 详细描述文本', () => {
    const { getSkillEffectText } = useSkillDisplay();

    it('effect 为 undefined 时返回空字符串', () => {
      const skill = makeSkill({ effect: undefined });
      expect(getSkillEffectText(skill)).toBe('');
    });

    it('effect 为 null 时返回空字符串', () => {
      const skill = { ...makeSkill(), effect: null } as Skill;
      expect(getSkillEffectText(skill)).toBe('');
    });

    it('physical_damage 返回 造成 {value} 点伤害', () => {
      const skill = makeSkill({ effect: { type: 'physical_damage', value: 50 } });
      expect(getSkillEffectText(skill)).toBe('造成 50 点伤害');
    });

    it('physical_damage 传入 stats 时显示含属性加成的预估值', () => {
      const skill = makeSkill({ effect: { type: 'physical_damage', value: 50 } });
      // unlockLevel=1 → coefficient=0.50, statKey=str
      // floor(50 + 20 * 0.50) = 60
      expect(getSkillEffectText(skill, { str: 20, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })).toBe('造成 60 点伤害');
    });

    it('magic_damage 返回 造成 {value} 点伤害', () => {
      const skill = makeSkill({ effect: { type: 'magic_damage', value: 80 } });
      expect(getSkillEffectText(skill)).toBe('造成 80 点伤害');
    });

    it('health_restore 返回 恢复 {value} 点生命值', () => {
      const skill = makeSkill({ effect: { type: 'health_restore', value: 30 } });
      expect(getSkillEffectText(skill)).toBe('恢复 30 点生命值');
    });

    it('health_restore 传入 stats 时显示含属性加成的预估值', () => {
      const skill = makeSkill({ type: 'health_restore', effect: { type: 'health_restore', value: 30 } });
      // unlockLevel=1 → coefficient=0.30, statKey=wis
      // floor(30 + 20 * 0.30) = 36
      expect(getSkillEffectText(skill, { str: 10, dex: 10, con: 10, int: 10, wis: 20, cha: 10 })).toBe('恢复 36 点生命值');
    });

    it('mana_restore 返回 恢复 {value} 点法力值', () => {
      const skill = makeSkill({ effect: { type: 'mana_restore', value: 20 } });
      expect(getSkillEffectText(skill)).toBe('恢复 20 点法力值');
    });

    it('buff 单个 shield 返回 护盾 +100 (3回合)', () => {
      const skill = makeSkill({
        type: 'buff',
        effect: { type: 'buff', value: 0 },
        buffs: [{ type: 'shield', value: 100, turns: 3 }],
      });
      expect(getSkillEffectText(skill)).toBe('护盾 +100 (3回合)');
    });

    it('buff 多个效果用全角逗号连接', () => {
      const skill = makeSkill({
        type: 'buff',
        effect: { type: 'buff', value: 0 },
        buffs: [
          { type: 'shield', value: 100, turns: 3 },
          { type: 'attack_up', value: 20, turns: 2 },
        ],
      });
      expect(getSkillEffectText(skill)).toBe('护盾 +100 (3回合)，攻击 +20 (2回合)');
    });

    it('debuff 单个 poison 返回 每回合中毒伤害 20 (5回合)', () => {
      const skill = makeSkill({
        type: 'debuff',
        effect: { type: 'debuff', value: 0 },
        buffs: [{ type: 'poison', value: 20, turns: 5 }],
      });
      expect(getSkillEffectText(skill)).toBe('每回合中毒伤害 20 (5回合)');
    });

    it('debuff stun（无 value 体现）返回 眩晕 (2回合)', () => {
      const skill = makeSkill({
        type: 'debuff',
        effect: { type: 'debuff', value: 0 },
        buffs: [{ type: 'stun', value: 0, turns: 2 }],
      });
      expect(getSkillEffectText(skill)).toBe('眩晕 (2回合)');
    });

    it('buff 未知 b.type 时走 || 回退返回原类型字符串', () => {
      // 触发 line 79 的 names[b.type] || b.type 后备分支
      const skill = makeSkill({
        type: 'buff',
        effect: { type: 'buff', value: 0 },
        buffs: [{ type: 'unknown_buff' as any, value: 10, turns: 3 }],
      });
      expect(getSkillEffectText(skill)).toBe('unknown_buff (3回合)');
    });

    it('debuff 未知 b.type 时走 || 回退返回原类型字符串', () => {
      // 触发 line 90 的 names[b.type] || b.type 后备分支
      const skill = makeSkill({
        type: 'debuff',
        effect: { type: 'debuff', value: 0 },
        buffs: [{ type: 'unknown_debuff' as any, value: 10, turns: 3 }],
      });
      expect(getSkillEffectText(skill)).toBe('unknown_debuff (3回合)');
    });

    it('未知 effect.type 返回 ${value}', () => {
      const skill = { ...makeSkill(), effect: { type: 'unknown', value: 99 } } as Skill;
      expect(getSkillEffectText(skill)).toBe('99');
    });
  });

  describe('getSkillEffectBrief 紧凑描述', () => {
    const { getSkillEffectBrief } = useSkillDisplay();

    it('effect 为 undefined 返回空字符串', () => {
      const skill = makeSkill({ effect: undefined });
      expect(getSkillEffectBrief(skill)).toBe('');
    });

    it('physical_damage 无 coefficient 返回 物理伤害50', () => {
      const skill = makeSkill({ effect: { type: 'physical_damage', value: 50 } });
      expect(getSkillEffectBrief(skill)).toBe('物理伤害50');
    });

    it('physical_damage 有 coefficient 返回 物理伤害50（不显示系数）', () => {
      const skill = makeSkill({ effect: { type: 'physical_damage', value: 50, coefficient: 1.5 } });
      expect(getSkillEffectBrief(skill)).toBe('物理伤害50');
    });

    it('physical_damage 传入 stats 时显示含属性加成的预估值', () => {
      const skill = makeSkill({ effect: { type: 'physical_damage', value: 50 } });
      // unlockLevel=1 → coefficient=0.50, statKey=str
      // floor(50 + 20 * 0.50) = 60
      expect(getSkillEffectBrief(skill, { str: 20, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })).toBe('物理伤害60');
    });

    it('magic_damage 无 coefficient 返回 魔法伤害80', () => {
      const skill = makeSkill({ effect: { type: 'magic_damage', value: 80 } });
      expect(getSkillEffectBrief(skill)).toBe('魔法伤害80');
    });

    it('health_restore 有 coefficient 返回 生命恢复30（不显示系数）', () => {
      const skill = makeSkill({ effect: { type: 'health_restore', value: 30, coefficient: 2 } });
      expect(getSkillEffectBrief(skill)).toBe('生命恢复30');
    });

    it('health_restore 传入 stats 时显示含属性加成的预估值', () => {
      const skill = makeSkill({ type: 'health_restore', effect: { type: 'health_restore', value: 30 } });
      // unlockLevel=1 → coefficient=0.30, statKey=wis
      // floor(30 + 20 * 0.30) = 36
      expect(getSkillEffectBrief(skill, { str: 10, dex: 10, con: 10, int: 10, wis: 20, cha: 10 })).toBe('生命恢复36');
    });

    it('mana_restore 无 coefficient 返回 法力恢复20', () => {
      const skill = makeSkill({ effect: { type: 'mana_restore', value: 20 } });
      expect(getSkillEffectBrief(skill)).toBe('法力恢复20');
    });

    it('buff 有单个 buffs 返回 增益:护盾', () => {
      const skill = makeSkill({
        type: 'buff',
        effect: { type: 'buff', value: 0 },
        buffs: [{ type: 'shield', value: 100, turns: 3 }],
      });
      expect(getSkillEffectBrief(skill)).toBe('增益:护盾');
    });

    it('buff 有多个 buffs 返回 增益:护盾/加攻', () => {
      const skill = makeSkill({
        type: 'buff',
        effect: { type: 'buff', value: 0 },
        buffs: [
          { type: 'shield', value: 100, turns: 3 },
          { type: 'attack_up', value: 20, turns: 2 },
        ],
      });
      expect(getSkillEffectBrief(skill)).toBe('增益:护盾/加攻');
    });

    it('buff 无 buffs 返回 增益', () => {
      const skill = makeSkill({
        type: 'buff',
        effect: { type: 'buff', value: 0 },
      });
      expect(getSkillEffectBrief(skill)).toBe('增益');
    });

    it('debuff 有 buffs 返回 减益:中毒', () => {
      const skill = makeSkill({
        type: 'debuff',
        effect: { type: 'debuff', value: 0 },
        buffs: [{ type: 'poison', value: 20, turns: 5 }],
      });
      expect(getSkillEffectBrief(skill)).toBe('减益:中毒');
    });

    it('debuff 无 buffs 返回 减益', () => {
      const skill = makeSkill({
        type: 'debuff',
        effect: { type: 'debuff', value: 0 },
      });
      expect(getSkillEffectBrief(skill)).toBe('减益');
    });

    it('未知 effect.type 返回空字符串', () => {
      const skill = { ...makeSkill(), effect: { type: 'unknown', value: 99 } } as Skill;
      expect(getSkillEffectBrief(skill)).toBe('');
    });
  });
});
