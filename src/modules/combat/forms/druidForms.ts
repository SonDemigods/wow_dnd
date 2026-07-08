/**
 * @fileoverview 德鲁伊形态数据（Phase 6.3）
 * @description 定义 4 种德鲁伊形态的属性加成和可用技能。
 *              形态切换由 forms/service.ts 处理，形态效果应用到战斗由 combat Store 消费。
 * @module combat/forms
 */
import type { DruidForm, DruidFormType } from './types';

/**
 * 全部德鲁伊形态定义
 *
 * 设计原则：
 * 1. 每种形态有明确的定位（坦克/输出/施法/平衡）
 * 2. 形态间属性差异明显，鼓励根据战况切换
 * 3. 切换形态恢复 10% 生命，作为切换的奖励
 * 4. 技能集互斥，人形形态可使用所有基础技能
 */
export const DRUID_FORMS: Record<DruidFormType, DruidForm> = {
  // ============================================================
  // 人形形态：平衡的施法形态
  // ============================================================
  humanoid: {
    id: 'humanoid',
    name: '人形形态',
    icon: 'game-icons:elf',
    description: '平衡的施法形态，可使用治疗和平衡法术',
    modifiers: {
      statModifiers: {},
      hpMultiplier: 1.0,
      damageMultiplier: 1.0,
      defenseMultiplier: 1.0,
      speedMultiplier: 1.0
    },
    availableSkills: ['healing_touch', 'moonfire', 'wrath', 'rejuvenation'],
    healPercent: 0.10
  },

  // ============================================================
  // 熊形态：坦克形态，高生命高防御
  // ============================================================
  bear: {
    id: 'bear',
    name: '熊形态',
    icon: 'game-icons:bear',
    description: '坚韧的坦克形态，生命和防御大幅提升',
    modifiers: {
      statModifiers: { str: 5, con: 8, dex: -3, int: -5, wis: -3 },
      hpMultiplier: 1.3,       // +30% 生命
      damageMultiplier: 0.9,   // -10% 伤害
      defenseMultiplier: 1.3,  // +30% 防御
      speedMultiplier: 0.8     // -20% 速度
    },
    availableSkills: ['mangle', 'swipe', 'growl', 'frenzied_regeneration'],
    healPercent: 0.10
  },

  // ============================================================
  // 猎豹形态：近战输出，高敏捷高暴击
  // ============================================================
  cat: {
    id: 'cat',
    name: '猎豹形态',
    icon: 'game-icons:panther',
    description: '敏捷的近战输出形态，暴击和速度大幅提升',
    modifiers: {
      statModifiers: { str: 3, dex: 8, con: -2, int: -5, wis: -3 },
      hpMultiplier: 0.9,       // -10% 生命
      damageMultiplier: 1.2,   // +20% 伤害
      defenseMultiplier: 0.9,  // -10% 防御
      speedMultiplier: 1.3     // +30% 速度
    },
    availableSkills: ['shred', 'rake', 'ferocious_bite', 'prowl'],
    healPercent: 0.10
  },

  // ============================================================
  // 枭兽形态：远程法术输出，高智力高暴击
  // ============================================================
  moonkin: {
    id: 'moonkin',
    name: '枭兽形态',
    icon: 'game-icons:owl',
    description: '远程法术输出形态，魔法伤害和暴击大幅提升',
    modifiers: {
      statModifiers: { str: -3, dex: -2, con: 3, int: 8, wis: 5 },
      hpMultiplier: 1.1,       // +10% 生命
      damageMultiplier: 1.15,  // +15% 伤害
      defenseMultiplier: 1.1,  // +10% 防御
      speedMultiplier: 0.9     // -10% 速度
    },
    availableSkills: ['starfall', 'starsurge', 'moonfire_boosted', 'sunfire'],
    healPercent: 0.10
  }
};

/**
 * 默认初始形态（人形）
 */
export const DEFAULT_FORM: DruidFormType = 'humanoid';

/**
 * 根据形态 ID 获取形态定义
 * @param formType - 形态 ID
 * @returns 形态定义
 */
export function getFormByType(formType: DruidFormType): DruidForm {
  return DRUID_FORMS[formType];
}

/**
 * 获取所有形态定义列表
 * @returns 全部形态数组
 */
export function getAllForms(): DruidForm[] {
  return Object.values(DRUID_FORMS);
}

/**
 * 获取德鲁伊可切换的目标形态列表（不含当前形态）
 * @param currentForm - 当前形态
 * @returns 可切换的形态列表
 */
export function getSwitchableForms(currentForm: DruidFormType): DruidForm[] {
  return Object.values(DRUID_FORMS).filter(form => form.id !== currentForm);
}
