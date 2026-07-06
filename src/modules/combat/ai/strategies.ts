/**
 * @fileoverview AI 策略实现
 * @description 包含四种 AI 策略：aggressive、defensive、balanced、boss_phase
 */

import type { IAiStrategy, BattleContext, AiDecision } from './types';
import type { EnemyInstance } from '@/modules/enemy/types';

/** 激进型：优先使用技能攻击，HP低于30%也不生命恢复 */
export class AggressiveStrategy implements IAiStrategy {
  readonly name = 'aggressive';
  decideAction(_enemy: EnemyInstance, ctx: BattleContext): AiDecision {
    const attackSkills = ctx.availableSkills.filter(s => !s.isHeal);
    if (attackSkills.length > 0 && Math.random() < 0.5) {
      const skill = attackSkills[Math.floor(Math.random() * attackSkills.length)];
      return { type: 'skill', skillId: skill.id };
    }
    return { type: 'basic_attack' };
  }
}

/** 防御型：HP低于40%优先生命恢复，少用技能 */
export class DefensiveStrategy implements IAiStrategy {
  readonly name = 'defensive';
  decideAction(_enemy: EnemyInstance, ctx: BattleContext): AiDecision {
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

/** 均衡型：HP低于50%生命恢复优先，30%概率用技能 */
export class BalancedStrategy implements IAiStrategy {
  readonly name = 'balanced';
  decideAction(_enemy: EnemyInstance, ctx: BattleContext): AiDecision {
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

/** Boss 阶段型：HP低于20%狂暴，HP低于50%半血激进 */
export class BossPhaseStrategy implements IAiStrategy {
  readonly name = 'boss_phase';
  decideAction(_enemy: EnemyInstance, ctx: BattleContext): AiDecision {
    const hpPercent = ctx.enemyHp / ctx.enemyMaxHp;
    if (hpPercent < 0.2) {
      // 狂暴：必定使用技能，不生命恢复
      const attackSkills = ctx.availableSkills.filter(s => !s.isHeal);
      if (attackSkills.length > 0) {
        const skill = attackSkills[Math.floor(Math.random() * attackSkills.length)];
        return { type: 'skill', skillId: skill.id };
      }
      return { type: 'basic_attack' };
    }
    if (hpPercent < 0.5) {
      // 半血：高概率技能（60%），小概率生命恢复（20%），否则普通攻击
      const healSkills = ctx.availableSkills.filter(s => s.isHeal);
      if (healSkills.length > 0 && Math.random() < 0.2) {
        return { type: 'heal', skillId: healSkills[0].id };
      }
      const attackSkills = ctx.availableSkills.filter(s => !s.isHeal);
      if (attackSkills.length > 0 && Math.random() < 0.6) {
        const skill = attackSkills[Math.floor(Math.random() * attackSkills.length)];
        return { type: 'skill', skillId: skill.id };
      }
      return { type: 'basic_attack' };
    }
    // 正常血量：30% 概率使用技能，其余普通攻击
    const attackSkills = ctx.availableSkills.filter(s => !s.isHeal);
    if (attackSkills.length > 0 && Math.random() < 0.3) {
      const skill = attackSkills[Math.floor(Math.random() * attackSkills.length)];
      return { type: 'skill', skillId: skill.id };
    }
    return { type: 'basic_attack' };
  }
}
