/**
 * @fileoverview 德鲁伊形态切换纯函数服务层（Phase 6.3）
 * @description 提供形态切换校验、属性计算、技能过滤等纯函数。
 *              不持有状态、不调用 DB、不发射事件，可独立进行单元测试。
 * @module combat/forms
 */
import type { DruidForm, DruidFormType, FormStatModifiers, FormState } from './types';
import { FORM_SWITCH_CONFIG } from './types';
import { DEFAULT_FORM, getFormByType } from './druidForms';
import type { Stats } from '@/modules/character/types';

// ============================================================
// 形态切换校验
// ============================================================

/**
 * 检查是否可以切换到目标形态
 *
 * 校验项：
 * 1. 目标形态不能与当前形态相同
 * 2. 目标形态必须已解锁
 * 3. 冷却时间必须为 0
 *
 * @param targetForm - 目标形态
 * @param state - 当前形态系统状态
 * @returns 校验结果
 */
export function canSwitchForm(
  targetForm: DruidFormType,
  state: FormState
): { canSwitch: boolean; reason: string } {
  // 1. 检查是否为相同形态
  if (state.currentForm === targetForm) {
    return { canSwitch: false, reason: '已处于该形态' };
  }

  // 2. 检查形态是否已解锁
  if (!state.availableForms.includes(targetForm)) {
    return { canSwitch: false, reason: '该形态尚未解锁' };
  }

  // 3. 检查冷却
  if (state.cooldownRemaining > 0) {
    return { canSwitch: false, reason: `形态切换冷却中（剩余 ${state.cooldownRemaining} 回合）` };
  }

  return { canSwitch: true, reason: '' };
}

// ============================================================
// 形态属性计算
// ============================================================

/**
 * 计算形态切换后的属性修正
 *
 * 返回当前形态的属性加成，供角色属性系统应用。
 *
 * @param formType - 形态 ID
 * @returns 属性修正对象
 */
export function getFormStatModifiers(formType: DruidFormType): FormStatModifiers {
  return getFormByType(formType).modifiers;
}

/**
 * 计算形态提供的生命上限倍率
 *
 * @param formType - 形态 ID
 * @returns 生命上限倍率（1.0 = 100%）
 */
export function getFormHpMultiplier(formType: DruidFormType): number {
  return getFormByType(formType).modifiers.hpMultiplier;
}

/**
 * 计算形态提供的伤害倍率
 *
 * @param formType - 形态 ID
 * @returns 伤害倍率（1.0 = 100%）
 */
export function getFormDamageMultiplier(formType: DruidFormType): number {
  return getFormByType(formType).modifiers.damageMultiplier;
}

/**
 * 计算形态提供的防御倍率
 *
 * @param formType - 形态 ID
 * @returns 防御倍率（1.0 = 100%）
 */
export function getFormDefenseMultiplier(formType: DruidFormType): number {
  return getFormByType(formType).modifiers.defenseMultiplier;
}

/**
 * 计算形态切换时的治疗量
 *
 * @param formType - 目标形态
 * @param maxHp - 角色最大生命值
 * @returns 治疗量（向上取整）
 */
export function calculateFormSwitchHeal(formType: DruidFormType, maxHp: number): number {
  const form = getFormByType(formType);
  return Math.ceil(maxHp * form.healPercent);
}

// ============================================================
// 形态技能管理
// ============================================================

/**
 * 获取当前形态可用的技能列表
 *
 * @param formType - 形态 ID
 * @returns 可用技能 ID 数组
 */
export function getAvailableSkills(formType: DruidFormType): string[] {
  return getFormByType(formType).availableSkills;
}

/**
 * 检查技能在当前形态下是否可用
 *
 * @param skillId - 技能 ID
 * @param formType - 当前形态
 * @returns 是否可用
 */
export function isSkillAvailableInForm(skillId: string, formType: DruidFormType): boolean {
  return getFormByType(formType).availableSkills.includes(skillId);
}

/**
 * 过滤出当前形态可用的技能
 *
 * @param skillIds - 角色已学习的全部技能
 * @param formType - 当前形态
 * @returns 当前形态可用的技能子集
 */
export function filterSkillsByForm(skillIds: string[], formType: DruidFormType): string[] {
  const available = getAvailableSkills(formType);
  return skillIds.filter(id => available.includes(id));
}

// ============================================================
// 形态状态管理
// ============================================================

/**
 * 创建初始形态状态
 *
 * 默认为人形形态，所有形态已解锁（简化逻辑，后续可改为等级解锁）。
 *
 * @returns 初始形态状态
 */
export function createInitialFormState(): FormState {
  return {
    currentForm: DEFAULT_FORM,
    availableForms: ['humanoid', 'bear', 'cat', 'moonkin'],
    cooldownRemaining: 0
  };
}

/**
 * 执行形态切换（纯函数，返回新状态）
 *
 * 注意：此函数不检查可切换性，调用方应先调用 canSwitchForm。
 *
 * @param state - 当前形态状态
 * @param targetForm - 目标形态
 * @returns 新的形态状态
 */
export function switchForm(
  state: FormState,
  targetForm: DruidFormType
): FormState {
  return {
    ...state,
    currentForm: targetForm,
    cooldownRemaining: FORM_SWITCH_CONFIG.cooldownTurns
  };
}

/**
 * 回合结束时减少冷却
 *
 * @param state - 当前形态状态
 * @returns 新的形态状态
 */
export function tickCooldown(state: FormState): FormState {
  if (state.cooldownRemaining <= 0) return state;
  return {
    ...state,
    cooldownRemaining: state.cooldownRemaining - 1
  };
}

/**
 * 获取当前形态定义
 *
 * @param state - 形态状态
 * @returns 当前形态定义
 */
export function getCurrentForm(state: FormState): DruidForm {
  return getFormByType(state.currentForm);
}

// ============================================================
// 属性差异计算（用于形态切换时增减属性）
// ============================================================

/**
 * 计算从旧形态切换到新形态时的属性差异
 *
 * 返回新旧形态的属性修正差值，正值表示新增加成，负值表示需移除的加成。
 * 角色属性系统可据此调整属性。
 *
 * @param oldForm - 旧形态
 * @param newForm - 新形态
 * @returns 属性差异（statModifiers 为基础属性差，倍率字段为差值）
 */
export function calculateFormStatDifference(
  oldForm: DruidFormType,
  newForm: DruidFormType
): {
  statModifiers: Partial<Stats>;
  hpMultiplierDelta: number;
  damageMultiplierDelta: number;
  defenseMultiplierDelta: number;
  speedMultiplierDelta: number;
} {
  const oldMods = getFormStatModifiers(oldForm);
  const newMods = getFormStatModifiers(newForm);

  const statKeys: Array<keyof Stats> = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const statDiff: Partial<Stats> = {};

  for (const key of statKeys) {
    const oldVal = oldMods.statModifiers[key] || 0;
    const newVal = newMods.statModifiers[key] || 0;
    const diff = newVal - oldVal;
    if (diff !== 0) {
      statDiff[key] = diff;
    }
  }

  return {
    statModifiers: statDiff,
    hpMultiplierDelta: newMods.hpMultiplier - oldMods.hpMultiplier,
    damageMultiplierDelta: newMods.damageMultiplier - oldMods.damageMultiplier,
    defenseMultiplierDelta: newMods.defenseMultiplier - oldMods.defenseMultiplier,
    speedMultiplierDelta: newMods.speedMultiplier - oldMods.speedMultiplier
  };
}
