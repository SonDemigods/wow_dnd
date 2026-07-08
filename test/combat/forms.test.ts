/**
 * @fileoverview 德鲁伊形态系统单元测试
 * @description 覆盖：
 * 1. druidForms 数据：4 种形态定义、getFormByType、getAllForms、getSwitchableForms
 * 2. forms/service 纯函数：
 *    - canSwitchForm（相同形态/未解锁/冷却中校验）
 *    - getFormStatModifiers / getFormHpMultiplier / getFormDamageMultiplier / getFormDefenseMultiplier
 *    - calculateFormSwitchHeal（向上取整）
 *    - getAvailableSkills / isSkillAvailableInForm / filterSkillsByForm
 *    - createInitialFormState / switchForm / tickCooldown / getCurrentForm
 *    - calculateFormStatDifference（新旧形态属性差值）
 * 3. FORM_SWITCH_CONFIG 常量
 */
import { describe, it, expect } from 'vitest';
import {
  DRUID_FORMS,
  DEFAULT_FORM,
  getFormByType,
  getAllForms,
  getSwitchableForms,
} from '@/modules/combat/forms/druidForms';
import {
  canSwitchForm,
  getFormStatModifiers,
  getFormHpMultiplier,
  getFormDamageMultiplier,
  getFormDefenseMultiplier,
  calculateFormSwitchHeal,
  getAvailableSkills,
  isSkillAvailableInForm,
  filterSkillsByForm,
  createInitialFormState,
  switchForm,
  tickCooldown,
  getCurrentForm,
  calculateFormStatDifference,
} from '@/modules/combat/forms/service';
import { FORM_SWITCH_CONFIG } from '@/modules/combat/forms/types';
import type { DruidFormType, FormState } from '@/modules/combat/forms/types';

// ============================================================
// FORM_SWITCH_CONFIG 常量
// ============================================================

describe('FORM_SWITCH_CONFIG 常量', () => {
  it('actionPointCost 为 1', () => {
    expect(FORM_SWITCH_CONFIG.actionPointCost).toBe(1);
  });

  it('defaultHealPercent 为 0.10（10%）', () => {
    expect(FORM_SWITCH_CONFIG.defaultHealPercent).toBe(0.10);
  });

  it('cooldownTurns 为 0（无冷却）', () => {
    expect(FORM_SWITCH_CONFIG.cooldownTurns).toBe(0);
  });
});

// ============================================================
// druidForms 数据定义
// ============================================================

describe('DRUID_FORMS 形态数据', () => {
  it('包含 4 种形态', () => {
    expect(Object.keys(DRUID_FORMS)).toHaveLength(4);
    expect(Object.keys(DRUID_FORMS)).toEqual(
      expect.arrayContaining(['humanoid', 'bear', 'cat', 'moonkin'])
    );
  });

  it('DEFAULT_FORM 为 "humanoid"', () => {
    expect(DEFAULT_FORM).toBe('humanoid');
  });

  describe('humanoid 人形形态', () => {
    const form = DRUID_FORMS.humanoid;

    it('基础属性为平衡（全部倍率 1.0）', () => {
      expect(form.modifiers.hpMultiplier).toBe(1.0);
      expect(form.modifiers.damageMultiplier).toBe(1.0);
      expect(form.modifiers.defenseMultiplier).toBe(1.0);
      expect(form.modifiers.speedMultiplier).toBe(1.0);
    });

    it('无属性修正', () => {
      expect(form.modifiers.statModifiers).toEqual({});
    });

    it('healPercent 为 0.10', () => {
      expect(form.healPercent).toBe(0.10);
    });

    it('可用技能包含治疗和平衡法术', () => {
      expect(form.availableSkills).toEqual(
        expect.arrayContaining(['healing_touch', 'moonfire', 'wrath', 'rejuvenation'])
      );
    });
  });

  describe('bear 熊形态', () => {
    const form = DRUID_FORMS.bear;

    it('坦克定位：hp×1.3, def×1.3', () => {
      expect(form.modifiers.hpMultiplier).toBe(1.3);
      expect(form.modifiers.defenseMultiplier).toBe(1.3);
    });

    it('伤害削减：dmg×0.9, speed×0.8', () => {
      expect(form.modifiers.damageMultiplier).toBe(0.9);
      expect(form.modifiers.speedMultiplier).toBe(0.8);
    });

    it('属性修正：str+5, con+8, dex-3, int-5, wis-3', () => {
      expect(form.modifiers.statModifiers).toEqual({
        str: 5, con: 8, dex: -3, int: -5, wis: -3,
      });
    });

    it('可用技能包含坦克技能', () => {
      expect(form.availableSkills).toEqual(
        expect.arrayContaining(['mangle', 'swipe', 'growl', 'frenzied_regeneration'])
      );
    });
  });

  describe('cat 猎豹形态', () => {
    const form = DRUID_FORMS.cat;

    it('输出定位：dmg×1.2, speed×1.3', () => {
      expect(form.modifiers.damageMultiplier).toBe(1.2);
      expect(form.modifiers.speedMultiplier).toBe(1.3);
    });

    it('生存削减：hp×0.9, def×0.9', () => {
      expect(form.modifiers.hpMultiplier).toBe(0.9);
      expect(form.modifiers.defenseMultiplier).toBe(0.9);
    });

    it('属性修正：str+3, dex+8, con-2, int-5, wis-3', () => {
      expect(form.modifiers.statModifiers).toEqual({
        str: 3, dex: 8, con: -2, int: -5, wis: -3,
      });
    });
  });

  describe('moonkin 枭兽形态', () => {
    const form = DRUID_FORMS.moonkin;

    it('法术输出定位：dmg×1.15', () => {
      expect(form.modifiers.damageMultiplier).toBe(1.15);
    });

    it('生存提升：hp×1.1, def×1.1', () => {
      expect(form.modifiers.hpMultiplier).toBe(1.1);
      expect(form.modifiers.defenseMultiplier).toBe(1.1);
    });

    it('速度削减：speed×0.9', () => {
      expect(form.modifiers.speedMultiplier).toBe(0.9);
    });

    it('属性修正：str-3, dex-2, con+3, int+8, wis+5', () => {
      expect(form.modifiers.statModifiers).toEqual({
        str: -3, dex: -2, con: 3, int: 8, wis: 5,
      });
    });
  });
});

describe('getFormByType', () => {
  it('返回指定形态定义', () => {
    expect(getFormByType('humanoid')).toBe(DRUID_FORMS.humanoid);
    expect(getFormByType('bear')).toBe(DRUID_FORMS.bear);
    expect(getFormByType('cat')).toBe(DRUID_FORMS.cat);
    expect(getFormByType('moonkin')).toBe(DRUID_FORMS.moonkin);
  });
});

describe('getAllForms', () => {
  it('返回全部 4 种形态数组', () => {
    const all = getAllForms();
    expect(all).toHaveLength(4);
    expect(all.map(f => f.id)).toEqual(
      expect.arrayContaining(['humanoid', 'bear', 'cat', 'moonkin'])
    );
  });
});

describe('getSwitchableForms', () => {
  it('排除当前形态，返回其他 3 种', () => {
    const switchable = getSwitchableForms('humanoid');
    expect(switchable).toHaveLength(3);
    expect(switchable.map(f => f.id)).not.toContain('humanoid');
  });

  it('当前为 bear 时返回 humanoid/cat/moonkin', () => {
    const switchable = getSwitchableForms('bear');
    expect(switchable.map(f => f.id)).toEqual(
      expect.arrayContaining(['humanoid', 'cat', 'moonkin'])
    );
  });
});

// ============================================================
// canSwitchForm — 切换校验
// ============================================================

describe('canSwitchForm 切换校验', () => {
  it('可切换到不同且已解锁的形态', () => {
    const state: FormState = {
      currentForm: 'humanoid',
      availableForms: ['humanoid', 'bear', 'cat', 'moonkin'],
      cooldownRemaining: 0,
    };
    const result = canSwitchForm('bear', state);
    expect(result.canSwitch).toBe(true);
    expect(result.reason).toBe('');
  });

  it('相同形态时不可切换', () => {
    const state: FormState = {
      currentForm: 'humanoid',
      availableForms: ['humanoid', 'bear'],
      cooldownRemaining: 0,
    };
    const result = canSwitchForm('humanoid', state);
    expect(result.canSwitch).toBe(false);
    expect(result.reason).toContain('已处于该形态');
  });

  it('未解锁的形态不可切换', () => {
    const state: FormState = {
      currentForm: 'humanoid',
      availableForms: ['humanoid'], // 仅解锁 humanoid
      cooldownRemaining: 0,
    };
    const result = canSwitchForm('bear', state);
    expect(result.canSwitch).toBe(false);
    expect(result.reason).toContain('尚未解锁');
  });

  it('冷却中不可切换', () => {
    const state: FormState = {
      currentForm: 'humanoid',
      availableForms: ['humanoid', 'bear'],
      cooldownRemaining: 2,
    };
    const result = canSwitchForm('bear', state);
    expect(result.canSwitch).toBe(false);
    expect(result.reason).toContain('冷却中');
    expect(result.reason).toContain('2');
  });

  it('冷却为 0 时可切换', () => {
    const state: FormState = {
      currentForm: 'humanoid',
      availableForms: ['humanoid', 'bear'],
      cooldownRemaining: 0,
    };
    expect(canSwitchForm('bear', state).canSwitch).toBe(true);
  });
});

// ============================================================
// 形态属性计算
// ============================================================

describe('getFormStatModifiers', () => {
  it('返回形态的完整 modifiers 对象', () => {
    const mods = getFormStatModifiers('bear');
    expect(mods.hpMultiplier).toBe(1.3);
    expect(mods.statModifiers.str).toBe(5);
  });

  it('humanoid 返回空 statModifiers', () => {
    const mods = getFormStatModifiers('humanoid');
    expect(mods.statModifiers).toEqual({});
  });
});

describe('getFormHpMultiplier', () => {
  it('bear 返回 1.3', () => {
    expect(getFormHpMultiplier('bear')).toBe(1.3);
  });

  it('cat 返回 0.9', () => {
    expect(getFormHpMultiplier('cat')).toBe(0.9);
  });

  it('humanoid 返回 1.0', () => {
    expect(getFormHpMultiplier('humanoid')).toBe(1.0);
  });
});

describe('getFormDamageMultiplier', () => {
  it('cat 返回 1.2', () => {
    expect(getFormDamageMultiplier('cat')).toBe(1.2);
  });

  it('bear 返回 0.9', () => {
    expect(getFormDamageMultiplier('bear')).toBe(0.9);
  });

  it('moonkin 返回 1.15', () => {
    expect(getFormDamageMultiplier('moonkin')).toBe(1.15);
  });
});

describe('getFormDefenseMultiplier', () => {
  it('bear 返回 1.3', () => {
    expect(getFormDefenseMultiplier('bear')).toBe(1.3);
  });

  it('cat 返回 0.9', () => {
    expect(getFormDefenseMultiplier('cat')).toBe(0.9);
  });

  it('humanoid 返回 1.0', () => {
    expect(getFormDefenseMultiplier('humanoid')).toBe(1.0);
  });
});

describe('calculateFormSwitchHeal', () => {
  it('返回 ceil(maxHp × healPercent)', () => {
    // healPercent=0.10, maxHp=100 → 10
    expect(calculateFormSwitchHeal('humanoid', 100)).toBe(10);
  });

  it('向上取整', () => {
    // 105 * 0.10 = 10.5 → ceil = 11
    expect(calculateFormSwitchHeal('bear', 105)).toBe(11);
  });

  it('maxHp=0 时返回 0', () => {
    expect(calculateFormSwitchHeal('cat', 0)).toBe(0);
  });

  it('所有形态 healPercent 均为 0.10', () => {
    for (const formType of ['humanoid', 'bear', 'cat', 'moonkin'] as DruidFormType[]) {
      expect(calculateFormSwitchHeal(formType, 100)).toBe(10);
    }
  });
});

// ============================================================
// 技能管理
// ============================================================

describe('getAvailableSkills', () => {
  it('返回形态的可用技能列表', () => {
    const skills = getAvailableSkills('humanoid');
    expect(skills).toEqual(
      expect.arrayContaining(['healing_touch', 'moonfire', 'wrath', 'rejuvenation'])
    );
  });

  it('bear 返回坦克技能', () => {
    const skills = getAvailableSkills('bear');
    expect(skills).toContain('mangle');
    expect(skills).toContain('growl');
  });
});

describe('isSkillAvailableInForm', () => {
  it('技能在当前形态可用时返回 true', () => {
    expect(isSkillAvailableInForm('healing_touch', 'humanoid')).toBe(true);
    expect(isSkillAvailableInForm('mangle', 'bear')).toBe(true);
  });

  it('技能不在当前形态时返回 false', () => {
    expect(isSkillAvailableInForm('mangle', 'humanoid')).toBe(false);
    expect(isSkillAvailableInForm('healing_touch', 'bear')).toBe(false);
  });
});

describe('filterSkillsByForm', () => {
  it('过滤出当前形态可用的技能', () => {
    const allSkills = ['healing_touch', 'mangle', 'moonfire', 'growl'];
    const filtered = filterSkillsByForm(allSkills, 'humanoid');
    // humanoid 可用：healing_touch, moonfire（mangle/growl 不可用）
    expect(filtered).toEqual(expect.arrayContaining(['healing_touch', 'moonfire']));
    expect(filtered).not.toContain('mangle');
    expect(filtered).not.toContain('growl');
  });

  it('空技能列表返回空数组', () => {
    expect(filterSkillsByForm([], 'humanoid')).toEqual([]);
  });

  it('无可用技能时返回空数组', () => {
    expect(filterSkillsByForm(['unknown_skill'], 'humanoid')).toEqual([]);
  });

  it('保留所有匹配的技能', () => {
    const allSkills = ['healing_touch', 'moonfire', 'wrath', 'rejuvenation'];
    const filtered = filterSkillsByForm(allSkills, 'humanoid');
    expect(filtered).toHaveLength(4);
  });
});

// ============================================================
// 状态管理
// ============================================================

describe('createInitialFormState', () => {
  it('默认为 humanoid 形态', () => {
    const state = createInitialFormState();
    expect(state.currentForm).toBe('humanoid');
  });

  it('所有形态已解锁', () => {
    const state = createInitialFormState();
    expect(state.availableForms).toEqual(
      expect.arrayContaining(['humanoid', 'bear', 'cat', 'moonkin'])
    );
    expect(state.availableForms).toHaveLength(4);
  });

  it('冷却为 0', () => {
    const state = createInitialFormState();
    expect(state.cooldownRemaining).toBe(0);
  });
});

describe('switchForm', () => {
  it('返回新状态，currentForm 更新为目标形态', () => {
    const state = createInitialFormState();
    const newState = switchForm(state, 'bear');
    expect(newState.currentForm).toBe('bear');
  });

  it('不修改原状态（不可变更新）', () => {
    const state = createInitialFormState();
    const newState = switchForm(state, 'bear');
    expect(state.currentForm).toBe('humanoid');
    expect(newState).not.toBe(state);
  });

  it('cooldownRemaining 设置为 FORM_SWITCH_CONFIG.cooldownTurns（=0）', () => {
    const state = createInitialFormState();
    const newState = switchForm(state, 'cat');
    expect(newState.cooldownRemaining).toBe(FORM_SWITCH_CONFIG.cooldownTurns);
    expect(newState.cooldownRemaining).toBe(0);
  });

  it('保留 availableForms', () => {
    const state: FormState = {
      currentForm: 'humanoid',
      availableForms: ['humanoid', 'bear'],
      cooldownRemaining: 0,
    };
    const newState = switchForm(state, 'bear');
    expect(newState.availableForms).toEqual(['humanoid', 'bear']);
  });
});

describe('tickCooldown', () => {
  it('冷却 >0 时减少 1', () => {
    const state: FormState = {
      currentForm: 'humanoid',
      availableForms: ['humanoid', 'bear'],
      cooldownRemaining: 3,
    };
    const newState = tickCooldown(state);
    expect(newState.cooldownRemaining).toBe(2);
  });

  it('冷却为 0 时保持 0', () => {
    const state: FormState = {
      currentForm: 'humanoid',
      availableForms: ['humanoid'],
      cooldownRemaining: 0,
    };
    const newState = tickCooldown(state);
    expect(newState.cooldownRemaining).toBe(0);
  });

  it('不修改原状态', () => {
    const state: FormState = {
      currentForm: 'humanoid',
      availableForms: ['humanoid'],
      cooldownRemaining: 2,
    };
    const newState = tickCooldown(state);
    expect(state.cooldownRemaining).toBe(2);
    expect(newState).not.toBe(state);
  });

  it('冷却为 1 时减少到 0', () => {
    const state: FormState = {
      currentForm: 'humanoid',
      availableForms: ['humanoid'],
      cooldownRemaining: 1,
    };
    expect(tickCooldown(state).cooldownRemaining).toBe(0);
  });
});

describe('getCurrentForm', () => {
  it('返回当前形态定义', () => {
    const state: FormState = {
      currentForm: 'bear',
      availableForms: ['humanoid', 'bear'],
      cooldownRemaining: 0,
    };
    expect(getCurrentForm(state)).toBe(DRUID_FORMS.bear);
  });

  it('默认 humanoid', () => {
    const state = createInitialFormState();
    expect(getCurrentForm(state).id).toBe('humanoid');
  });
});

// ============================================================
// calculateFormStatDifference — 属性差异
// ============================================================

describe('calculateFormStatDifference', () => {
  it('humanoid → bear 的属性差异', () => {
    const diff = calculateFormStatDifference('humanoid', 'bear');
    // bear: str+5, con+8, dex-3, int-5, wis-3
    // humanoid: 无修正
    // 差值 = bear - humanoid
    expect(diff.statModifiers).toEqual({
      str: 5, con: 8, dex: -3, int: -5, wis: -3,
    });
    expect(diff.hpMultiplierDelta).toBe(1.3 - 1.0);
    expect(diff.damageMultiplierDelta).toBe(0.9 - 1.0);
    expect(diff.defenseMultiplierDelta).toBe(1.3 - 1.0);
    expect(diff.speedMultiplierDelta).toBe(0.8 - 1.0);
  });

  it('bear → humanoid 的属性差异（反向）', () => {
    const diff = calculateFormStatDifference('bear', 'humanoid');
    // 差值 = humanoid - bear
    expect(diff.statModifiers).toEqual({
      str: -5, con: -8, dex: 3, int: 5, wis: 3,
    });
    expect(diff.hpMultiplierDelta).toBe(1.0 - 1.3);
    expect(diff.damageMultiplierDelta).toBe(1.0 - 0.9);
  });

  it('相同形态时差异为 0', () => {
    const diff = calculateFormStatDifference('bear', 'bear');
    expect(diff.statModifiers).toEqual({});
    expect(diff.hpMultiplierDelta).toBe(0);
    expect(diff.damageMultiplierDelta).toBe(0);
    expect(diff.defenseMultiplierDelta).toBe(0);
    expect(diff.speedMultiplierDelta).toBe(0);
  });

  it('cat → moonkin 的属性差异', () => {
    const diff = calculateFormStatDifference('cat', 'moonkin');
    // cat: str+3, dex+8, con-2, int-5, wis-3
    // moonkin: str-3, dex-2, con+3, int+8, wis+5
    // 差值 = moonkin - cat
    expect(diff.statModifiers).toEqual({
      str: -3 - 3, // -6
      dex: -2 - 8, // -10
      con: 3 - (-2), // 5
      int: 8 - (-5), // 13
      wis: 5 - (-3), // 8
    });
    expect(diff.hpMultiplierDelta).toBe(1.1 - 0.9);
    expect(diff.damageMultiplierDelta).toBe(1.15 - 1.2);
  });

  it('差值为 0 的属性不出现在 statModifiers 中', () => {
    // humanoid 无修正，cat 有 str/dex/con/int/wis 修正（无 cha）
    // humanoid → cat：cha 差值为 0，不应出现
    const diff = calculateFormStatDifference('humanoid', 'cat');
    expect(diff.statModifiers).not.toHaveProperty('cha');
  });
});
