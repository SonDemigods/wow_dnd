/**
 * 技能模块服务层（纯函数）
 * 
 * 纯计算/校验函数，无状态、无副作用、无 DB 调用。
 * 所有状态管理由 Store 层负责。
 */
import type { Skill, SkillBar } from './types';
import type { Stats } from '../character/types';

/**
 * 计算技能伤害/效果值
 * @param skill - 技能数据
 * @param stats - 角色核心属性
 * @returns 计算后的效果值
 */
export function calculateSkillDamage(skill: Skill, stats: Stats): number {
  switch (skill.type) {
    case 'physical_damage':
      // 物理伤害 = 基础值 + 力量 * 系数
      return Math.floor(skill.effect.value + stats.str * (skill.effect.coefficient || 0.5));
    case 'magic_damage':
      // 魔法伤害 = 基础值 + 智力 * 系数
      return Math.floor(skill.effect.value + stats.int * (skill.effect.coefficient || 0.5));
    case 'health_restore':
      // 治疗量 = 基础值 + 智慧 * 系数
      return Math.floor(skill.effect.value + stats.wis * (skill.effect.coefficient || 0.3));
    case 'mana_restore':
      // 法力回复 = 基础值 + 智力 * 系数
      return Math.floor(skill.effect.value + stats.int * (skill.effect.coefficient || 0.3));
    default:
      return skill.effect.value;
  }
}

/**
 * 检查法力值是否足够施放技能
 * @param skill - 技能数据
 * @param currentMana - 当前法力值
 * @returns 是否足够
 */
export function checkManaCost(skill: Skill, currentMana: number): boolean {
  return currentMana >= skill.mpCost;
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
 * @param skillBar - 技能栏
 * @param slotIndex - 槽位索引
 * @returns 是否有效
 */
export function validateSkillBarSlot(_skillBar: SkillBar, slotIndex: number): boolean {
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
