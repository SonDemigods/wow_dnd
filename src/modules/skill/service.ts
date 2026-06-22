/**
 * 技能模块服务层（纯函数）
 * 
 * 纯计算/校验函数，无状态、无副作用、无 DB 调用。
 * 所有状态管理由 Store 层负责。
 */
import type { Skill, SkillBar, SkillBuffEffect } from './types';
import type { Stats } from '../character/types';

/**
 * 计算技能伤害/效果值
 * @param skill - 技能数据
 * @param stats - 角色核心属性
 * @returns 计算后的效果值
 */
export function calculateSkillDamage(skill: Skill, stats: Stats): number {
  switch (skill.type) {
    case 'physical_damage': {
      const coef = skill.effect.coefficient ?? getSkillCoefficient(skill.unlockLevel, 'damage');
      return Math.floor(skill.effect.value + stats.str * coef);
    }
    case 'magic_damage': {
      const coef = skill.effect.coefficient ?? getSkillCoefficient(skill.unlockLevel, 'damage');
      return Math.floor(skill.effect.value + stats.int * coef);
    }
    case 'health_restore': {
      const coef = skill.effect.coefficient ?? getSkillCoefficient(skill.unlockLevel, 'heal');
      return Math.floor(skill.effect.value + stats.wis * coef);
    }
    case 'mana_restore': {
      const coef = skill.effect.coefficient ?? getSkillCoefficient(skill.unlockLevel, 'heal');
      return Math.floor(skill.effect.value + stats.int * coef);
    }
    case 'buff':
    case 'debuff':
      return 0;
    default:
      return skill.effect.value;
  }
}

/**
 * 按解锁等级获取技能系数（分层缩放）
 * @param unlockLevel - 技能解锁等级
 * @param type - 技能类型
 * @returns 系数值
 */
export function getSkillCoefficient(unlockLevel: number, type: 'damage' | 'heal' | 'buff'): number {
  if (type === 'buff') return 0;

  const baseCoef = type === 'heal' ? 0.30 : 0.50;
  const tierBonus = type === 'heal' ? 0.035 : 0.040;

  // Lv 1-2: 基础系数 / Lv 3-5: +1 档 / Lv 6-8: +2 档 / Lv 9-10: +3 档
  const tier = unlockLevel <= 2 ? 0 : unlockLevel <= 5 ? 1 : unlockLevel <= 8 ? 2 : 3;
  return baseCoef + tier * tierBonus;
}

/**
 * 计算 Buff/Debuff 技能的实际效果值（受属性加成）
 * @param buffEffect - Buff/Debuff 效果配置
 * @param stats - 角色核心属性
 * @returns 计算后的效果值
 */
export function calculateBuffValue(buffEffect: SkillBuffEffect, stats: Stats): number {
  const { type, value } = buffEffect;

  switch (type) {
    // ===== 百分比类：value 即百分比点数 =====
    case 'attack_up':
    case 'attack_down':
      return Math.floor(value + stats.wis * 0.30);

    case 'defense_up':
    case 'defense_down':
      return Math.floor(value + stats.wis * 0.25);

    case 'vulnerable':
      return Math.floor(value + stats.wis * 0.20);

    // ===== 固定值类：缩放匹配 HP 成长 =====
    case 'poison':
      return Math.floor(value + stats.wis * 0.50);

    case 'burn':
      return Math.floor(value + stats.wis * 0.60);

    case 'regen':
      return Math.floor(value + stats.wis * 0.50);

    case 'shield':
      return Math.floor(value + stats.wis * 0.80);

    // ===== 倍率类：轻微缩放 =====
    case 'thorn':
      return Math.min(0.60, value + stats.wis * 0.005);

    // ===== 控制类：不缩放 =====
    case 'stun':
    case 'freeze':
    case 'silence':
      return value;

    // ===== 速度类：平坦值缩放 =====
    case 'speed_up':
    case 'speed_down':
      return Math.floor(value + stats.dex * 0.30);

    default:
      return value;
  }
}

/**
 * 判断角色是否可以学习某个技能模板
 * @param skillTemplate - 技能模板
 * @param characterLevel - 角色等级
 * @param currentSkills - 已学技能列表
 * @returns 是否可以学习
 */
export function canLearnSkill(
  skillTemplate: Skill,
  characterLevel: number,
  currentSkills: Skill[]
): boolean {
  if (skillTemplate.unlockLevel > characterLevel) return false;
  return !currentSkills.some(s => s.id === skillTemplate.id);
}

/**
 * 验证技能栏槽位索引是否有效
 * @param slotIndex - 槽位索引
 * @returns 是否有效
 */
export function validateSkillBarSlot(slotIndex: number): boolean {
  return slotIndex >= 0 && slotIndex <= 3;
}

/**
 * 检查技能是否已装备在技能栏中
 * @param skillBar - 技能栏
 * @param skillId - 技能ID
 * @returns 是否已装备
 */
export function isSkillEquipped(skillBar: SkillBar, skillId: string): boolean {
  return skillBar.slots.includes(skillId);
}

/**
 * 校验技能是否可施放
 * @param skill - 技能数据
 * @param currentMana - 当前法力值
 * @returns 校验结果
 */
export function canCastSkill(
  skill: Skill,
  currentMana: number
): { canCast: boolean; reason: string } {
  if (currentMana < skill.mpCost) {
    return { canCast: false, reason: '法力不足' };
  }
  return { canCast: true, reason: '' };
}
