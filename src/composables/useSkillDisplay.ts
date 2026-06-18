/**
 * @fileoverview 技能展示公共 composable
 * @description 提供技能类型、目标类型、效果文本等展示相关的工具函数，供 SkillsPopup 和 CombatPopup 共用
 */

import type { Skill } from '@/modules/skill';

/** 技能类型中文名映射 */
const skillTypeNames: Record<string, string> = {
  physical_damage: '物理伤害',
  magic_damage: '魔法伤害',
  health_restore: '生命恢复',
  mana_restore: '法力恢复',
  buff: '增益',
  debuff: '减益'
};

/** 技能类型图标映射 */
const skillTypeIcons: Record<string, string> = {
  physical_damage: 'game-icons:sword-clash',
  magic_damage: 'game-icons:magic-swirl',
  health_restore: 'game-icons:health-increase',
  mana_restore: 'game-icons:magic-palm',
  buff: 'game-icons:upgrade',
  debuff: 'game-icons:downgrade'
};

/** 目标类型中文名映射 */
const targetTypeNames: Record<string, string> = {
  single: '单体',
  all_enemies: '多目标',
  self: '自身',
  ally: '友方'
};

/** 效果类型中文名映射 */
const effectTypeNames: Record<string, string> = {
  poison: '中毒', burn: '灼烧', stun: '眩晕', freeze: '冰冻',
  silence: '沉默', shield: '护盾', attack_up: '加攻', attack_down: '降攻',
  defense_up: '加防', defense_down: '降防', speed_up: '加速', speed_down: '减速',
  regen: '回复', thorn: '荆棘', vulnerable: '易伤'
};

export function useSkillDisplay() {
  /** 获取技能类型中文名 */
  function getSkillTypeName(type: string): string {
    return skillTypeNames[type] || type;
  }

  /** 获取技能类型图标 */
  function getSkillTypeIcon(type: string): string {
    return skillTypeIcons[type] || 'game-icons:sparkles';
  }

  /** 获取目标类型中文名 */
  function getTargetTypeName(type: string): string {
    return targetTypeNames[type] || type;
  }

  /** 获取效果类型中文名 */
  function getEffectTypeName(type: string): string {
    return effectTypeNames[type] || type;
  }

  /** 获取技能效果描述文本（详细版，用于技能详情面板） */
  function getSkillEffectText(skill: Skill): string {
    if (!skill.effect) return '';
    const { type, value } = skill.effect;
    if (type === 'physical_damage' || type === 'magic_damage') return `造成 ${value} 点伤害`;
    if (type === 'health_restore') return `恢复 ${value} 点生命值`;
    if (type === 'mana_restore') return `恢复 ${value} 点法力值`;
    if (type === 'buff' && skill.buffs) {
      return skill.buffs.map(b => {
        const names: Record<string, string> = {
          shield: `护盾 +${b.value}`, attack_up: `攻击 +${b.value}`,
          defense_up: `防御 +${b.value}`, speed_up: `速度 +${b.value}`,
          regen: `每回合回复 ${b.value}`, thorn: `反弹 ${Math.round(b.value * 100)}% 伤害`
        };
        return `${names[b.type] || b.type} (${b.turns}回合)`;
      }).join('，');
    }
    if (type === 'debuff' && skill.buffs) {
      return skill.buffs.map(b => {
        const names: Record<string, string> = {
          poison: `每回合中毒伤害 ${b.value}`, burn: `每回合灼烧伤害 ${b.value}`,
          stun: `眩晕`, attack_down: `攻击 -${b.value}`,
          defense_down: `防御 -${b.value}`, speed_down: `速度 -${b.value}`,
          silence: `沉默`
        };
        return `${names[b.type] || b.type} (${b.turns}回合)`;
      }).join('，');
    }
    return `${value}`;
  }

  /** 获取技能效果简述（紧凑版，用于战斗按钮） */
  function getSkillEffectBrief(skill: Skill): string {
    const effect = skill.effect;
    if (!effect) return '';
    const value = effect.value || 0;
    const coeff = effect.coefficient ? `x${effect.coefficient}` : '';
    switch (effect.type) {
      case 'physical_damage': return `物理伤害${value}${coeff}`;
      case 'magic_damage': return `魔法伤害${value}${coeff}`;
      case 'health_restore': return `生命恢复${value}${coeff}`;
      case 'mana_restore': return `法力恢复${value}${coeff}`;
      case 'buff': {
        if (skill.buffs && skill.buffs.length > 0) {
          const names = skill.buffs.map(b => getEffectTypeName(b.type));
          return `增益:${names.join('/')}`;
        }
        return '增益';
      }
      case 'debuff': {
        if (skill.buffs && skill.buffs.length > 0) {
          const names = skill.buffs.map(b => getEffectTypeName(b.type));
          return `减益:${names.join('/')}`;
        }
        return '减益';
      }
      default: return '';
    }
  }

  return {
    getSkillTypeName,
    getSkillTypeIcon,
    getTargetTypeName,
    getEffectTypeName,
    getSkillEffectText,
    getSkillEffectBrief
  };
}
