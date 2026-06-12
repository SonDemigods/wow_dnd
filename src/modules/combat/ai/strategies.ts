/**
 * @fileoverview AI 策略实现
 * @description 包含四种 AI 策略：aggressive、defensive、balanced、boss_phase
 */

import type { IAiStrategy, BattleContext, AiDecision } from './types';
import type { Enemy } from '@/modules/enemy/types';

/** 激进型：优先使用技能攻击，HP低于30%也不治疗 */
export class AggressiveStrategy implements IAiStrategy {
  readonly name = 'aggressive';
  decideAction(enemy: Enemy, ctx: BattleContext): AiDecision {
    const attackSkills = ctx.availableSkills.filter(s => !s.isHeal);
    if (attackSkills.length > 0 && Math.random() < 0.5) {
      const skill = attackSkills[Math.floor(Math.random() * attackSkills.length)];
      return { type: 'skill', skillId: skill.id };
    }
    return { type: 'basic_attack' };
  }
}

/** 防御型：HP低于40%优先治疗，少用技能 */
export class DefensiveStrategy implements IAiStrategy {
  readonly name = 'defensive';
  decideAction(enemy: Enemy, ctx: BattleContext): AiDecision {
    const hpPercent = ctx.enemyHp / ctx.enemyMaxHp;
    const healSkills = ctx.availableSkills.filter(s => s.isHeal);
    if (hpPercent < 0.4 && healSkills.length > 0) {
      return { type: 'heal', skillId: healSkills[0].id };
    }
    if (Math.random() < 0.2) {
      const attackSkills = ctx.availableSkills.filter(s => !s.isHeal);
      if (attackSkills.length > 0) {
        const skill = attackSkills[Math.floor(Math.random() * attackSkills.length)];
        return { type: 'skill', skillId: skill.id };
      }
    }
    return { type: 'basic_attack' };
  }
}

/** 均衡型：HP低于50%治疗，30%概率用技能 */
export class BalancedStrategy implements IAiStrategy {
  readonly name = 'balanced';
  decideAction(enemy: Enemy, ctx: BattleContext): AiDecision {
    const hpPercent = ctx.enemyHp / ctx.enemyMaxHp;
    const healSkills = ctx.availableSkills.filter(s => s.isHeal);
    if (hpPercent < 0.5 && healSkills.length > 0 && Math.random() < 0.6) {
      return { type: 'heal', skillId: healSkills[0].id };
    }
    const attackSkills = ctx.availableSkills.filter(s => !s.isHeal);
    if (attackSkills.length > 0 && Math.random() < 0.3) {
      const skill = attackSkills[Math.floor(Math.random() * attackSkills.length)];
      return { type: 'skill', skillId: skill.id };
    }
    return { type: 'basic_attack' };
  }
}

/** Boss 阶段型：HP低于50%切换激进，HP低于20%狂暴 */
export class BossPhaseStrategy implements IAiStrategy {
  readonly name = 'boss_phase';
  decideAction(enemy: Enemy, ctx: BattleContext): AiDecision {
    const hpPercent = ctx.enemyHp / ctx.enemyMaxHp;
    if (hpPercent < 0.2) {
      // 狂暴：必定使用技能，不治疗
      const attackSkills = ctx.availableSkills.filter(s => !s.isHeal);
      if (attackSkills.length > 0) {
        const skill = attackSkills[Math.floor(Math.random() * attackSkills.length)];
        return { type: 'skill', skillId: skill.id };
      }
      return { type: 'basic_attack' };
    }
    if (hpPercent < 0.5) {
      // 半血：高概率技能，小概率治疗
      const healSkills = ctx.availableSkills.filter(s => s.isHeal);
      if (healSkills.length > 0 && Math.random() < 0.2) {
        return { type: 'heal', skillId: healSkills[0].id };
      }
      const attackSkills = ctx.availableSkills.filter(s => !s.isHeal);
      if (attackSkills.length > 0 && Math.random() < 0.6) {
        const skill = attackSkills[Math.floor(Math.random() * attackSkills.length)];
        return { type: 'skill', skillId: skill.id };
      }
    }
    // 正常：均衡行为
    const healSkills2 = ctx.availableSkills.filter(s => s.isHeal);
    if (hpPercent < 0.5 && healSkills2.length > 0 && Math.random() < 0.5) {
      return { type: 'heal', skillId: healSkills2[0].id };
    }
    if (Math.random() < 0.3) {
      const attackSkills2 = ctx.availableSkills.filter(s => !s.isHeal);
      if (attackSkills2.length > 0) {
        const skill = attackSkills2[Math.floor(Math.random() * attackSkills2.length)];
        return { type: 'skill', skillId: skill.id };
      }
    }
    return { type: 'basic_attack' };
  }
}
