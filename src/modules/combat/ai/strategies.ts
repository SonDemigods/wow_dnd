/**
 * @fileoverview AI 策略实现
 * @description 包含四种 AI 策略：aggressive、defensive、balanced、boss_phase
 *
 * 阶段十二升级：通过构造函数注入 Rng，支持确定性 AI 决策与战斗回放。
 * 每个策略类持有独立 rng 实例，注入 createSeededRng(seed) 即可复现决策序列。
 *
 * P3-162 升级：新增 buff/defend 决策类型，策略可主动施放增益/减益技能和防御。
 * 技能分类从两类（heal / non-heal）重构为三类（heal / buff / attack）。
 * 决策维度扩展：除敌人 HP 外，综合考量玩家 HP、回合数、已有 buff/debuff 状态。
 */

import type { IAiStrategy, BattleContext, AiDecision } from './types';
import type { EnemyInstance } from '@/modules/enemy/types';
import { defaultRng, type Rng } from '@/utils/rng';
import {
  AGGRESSIVE_SKILL_CHANCE,
  AGGRESSIVE_BUFF_CHANCE,
  DEFENSIVE_HEAL_HP_THRESHOLD,
  DEFENSIVE_SKILL_CHANCE,
  DEFENSIVE_BUFF_CHANCE,
  DEFENSIVE_DEFEND_HP_THRESHOLD,
  DEFENSIVE_DEFEND_CHANCE,
  DEFENSIVE_DEFEND_CHANCE_LOW_HP,
  BALANCED_HEAL_HP_THRESHOLD,
  BALANCED_HEAL_CHANCE,
  BALANCED_SKILL_CHANCE,
  BALANCED_BUFF_CHANCE,
  BALANCED_DEFEND_CHANCE,
  BOSS_ENRAGE_HP_THRESHOLD,
  BOSS_HALF_HP_THRESHOLD,
  BOSS_HALF_HEAL_CHANCE,
  BOSS_HALF_SKILL_CHANCE,
  BOSS_NORMAL_SKILL_CHANCE,
  BOSS_BUFF_CHANCE,
  BOSS_HALF_BUFF_CHANCE,
} from '@/config/combat';

/** 玩家残血阈值（低于此值敌人会优先攻击终结） */
const PLAYER_LOW_HP_THRESHOLD = 0.25;

/** P4-019 修复：安全计算 HP 百分比，防止 maxHp=0 时产生 NaN */
function safeHpPercent(hp: number, maxHp: number): number {
  return hp / Math.max(1, maxHp);
}

/** 激进型：猛攻至上，偶尔开场强化 */
export class AggressiveStrategy implements IAiStrategy {
  readonly name = 'aggressive';
  constructor(private readonly rng: Rng = defaultRng) {}
  decideAction(_enemy: EnemyInstance, ctx: BattleContext): AiDecision {
    const playerHpPercent = safeHpPercent(ctx.playerHp, ctx.playerMaxHp);
    const attackSkills = ctx.availableSkills.filter(s => !s.isHeal && !s.isBuff);
    const buffSkills = ctx.availableSkills.filter(s => s.isBuff);

    // 1. 玩家残血（<25%）→ 必定攻击终结
    if (playerHpPercent < PLAYER_LOW_HP_THRESHOLD) {
      if (attackSkills.length > 0 && this.rng.bool(0.7)) {
        const skill = this.rng.pick(attackSkills);
        return { type: 'skill', skillId: skill.id };
      }
      return { type: 'basic_attack' };
    }

    // 2. 开场阶段（回合 1-2）且有 buff 技能且无已有增益 → buff 增强
    if (ctx.turnCount <= 2 && buffSkills.length > 0 && !ctx.enemyHasBuff && this.rng.bool(0.6)) {
      const skill = this.rng.pick(buffSkills);
      return { type: 'buff', skillId: skill.id };
    }

    // 3. 常规：50% 攻击技能 / 10% buff / 兜底普攻
    if (attackSkills.length > 0 && this.rng.bool(AGGRESSIVE_SKILL_CHANCE)) {
      const skill = this.rng.pick(attackSkills);
      return { type: 'skill', skillId: skill.id };
    }
    if (buffSkills.length > 0 && !ctx.enemyHasBuff && this.rng.bool(AGGRESSIVE_BUFF_CHANCE)) {
      const skill = this.rng.pick(buffSkills);
      return { type: 'buff', skillId: skill.id };
    }
    return { type: 'basic_attack' };
  }
}

/** 防御型：稳扎稳打，防御为先 */
export class DefensiveStrategy implements IAiStrategy {
  readonly name = 'defensive';
  constructor(private readonly rng: Rng = defaultRng) {}
  decideAction(_enemy: EnemyInstance, ctx: BattleContext): AiDecision {
    const hpPercent = safeHpPercent(ctx.enemyHp, ctx.enemyMaxHp);
    const playerHpPercent = safeHpPercent(ctx.playerHp, ctx.playerMaxHp);
    const attackSkills = ctx.availableSkills.filter(s => !s.isHeal && !s.isBuff);
    const buffSkills = ctx.availableSkills.filter(s => s.isBuff);
    const healSkills = ctx.availableSkills.filter(s => s.isHeal);

    // 1. 低血（<40%）→ 治疗保命
    if (hpPercent < DEFENSIVE_HEAL_HP_THRESHOLD) {
      if (healSkills.length > 0) {
        return { type: 'heal', skillId: healSkills[0].id };
      }
      // 无治疗技能时 → defend 苟活
      if (this.rng.bool(0.5)) {
        return { type: 'defend' };
      }
      return { type: 'basic_attack' };
    }

    // 2. 中血（40%~60%）→ 防御 + 偶尔反击
    if (hpPercent < DEFENSIVE_DEFEND_HP_THRESHOLD) {
      if (this.rng.bool(DEFENSIVE_DEFEND_CHANCE_LOW_HP)) {
        return { type: 'defend' };
      }
      if (buffSkills.length > 0 && !ctx.enemyHasBuff && this.rng.bool(0.2)) {
        const skill = this.rng.pick(buffSkills);
        return { type: 'buff', skillId: skill.id };
      }
      if (attackSkills.length > 0 && this.rng.bool(0.15)) {
        const skill = this.rng.pick(attackSkills);
        return { type: 'skill', skillId: skill.id };
      }
      return { type: 'basic_attack' };
    }

    // 3. 高血（≥60%）→ buff/defend 准备 + 偶尔攻击
    if (buffSkills.length > 0 && !ctx.enemyHasBuff && this.rng.bool(DEFENSIVE_BUFF_CHANCE)) {
      const skill = this.rng.pick(buffSkills);
      return { type: 'buff', skillId: skill.id };
    }
    if (this.rng.bool(DEFENSIVE_DEFEND_CHANCE)) {
      return { type: 'defend' };
    }
    // 玩家残血时也会补刀
    if (playerHpPercent < PLAYER_LOW_HP_THRESHOLD && attackSkills.length > 0 && this.rng.bool(0.3)) {
      const skill = this.rng.pick(attackSkills);
      return { type: 'skill', skillId: skill.id };
    }
    if (attackSkills.length > 0 && this.rng.bool(DEFENSIVE_SKILL_CHANCE)) {
      const skill = this.rng.pick(attackSkills);
      return { type: 'skill', skillId: skill.id };
    }
    return { type: 'basic_attack' };
  }
}

/** 均衡型：攻守兼备，随机应变 */
export class BalancedStrategy implements IAiStrategy {
  readonly name = 'balanced';
  constructor(private readonly rng: Rng = defaultRng) {}
  decideAction(_enemy: EnemyInstance, ctx: BattleContext): AiDecision {
    const hpPercent = safeHpPercent(ctx.enemyHp, ctx.enemyMaxHp);
    const playerHpPercent = safeHpPercent(ctx.playerHp, ctx.playerMaxHp);
    const attackSkills = ctx.availableSkills.filter(s => !s.isHeal && !s.isBuff);
    const buffSkills = ctx.availableSkills.filter(s => s.isBuff);
    const healSkills = ctx.availableSkills.filter(s => s.isHeal);

    // 1. 低血（<50%）→ 治疗优先
    if (hpPercent < BALANCED_HEAL_HP_THRESHOLD) {
      if (healSkills.length > 0 && this.rng.bool(BALANCED_HEAL_CHANCE)) {
        return { type: 'heal', skillId: healSkills[0].id };
      }
      if (attackSkills.length > 0 && this.rng.bool(0.25)) {
        const skill = this.rng.pick(attackSkills);
        return { type: 'skill', skillId: skill.id };
      }
      return { type: 'basic_attack' };
    }

    // 2. 高血（≥50%）→ 多维度混合
    // 2a. 玩家残血 → 补刀
    if (playerHpPercent < PLAYER_LOW_HP_THRESHOLD && attackSkills.length > 0 && this.rng.bool(0.5)) {
      const skill = this.rng.pick(attackSkills);
      return { type: 'skill', skillId: skill.id };
    }

    // 2b. 开场 buff
    if (ctx.turnCount <= 2 && buffSkills.length > 0 && !ctx.enemyHasBuff && this.rng.bool(0.4)) {
      const skill = this.rng.pick(buffSkills);
      return { type: 'buff', skillId: skill.id };
    }

    // 2c. 常规：攻击/buff/defend 混合
    if (attackSkills.length > 0 && this.rng.bool(BALANCED_SKILL_CHANCE)) {
      const skill = this.rng.pick(attackSkills);
      return { type: 'skill', skillId: skill.id };
    }
    if (buffSkills.length > 0 && !ctx.enemyHasBuff && this.rng.bool(BALANCED_BUFF_CHANCE)) {
      const skill = this.rng.pick(buffSkills);
      return { type: 'buff', skillId: skill.id };
    }
    if (this.rng.bool(BALANCED_DEFEND_CHANCE)) {
      return { type: 'defend' };
    }
    return { type: 'basic_attack' };
  }
}

/** Boss 阶段型：分阶段逐步升级 */
export class BossPhaseStrategy implements IAiStrategy {
  readonly name = 'boss_phase';
  constructor(private readonly rng: Rng = defaultRng) {}
  decideAction(_enemy: EnemyInstance, ctx: BattleContext): AiDecision {
    const hpPercent = safeHpPercent(ctx.enemyHp, ctx.enemyMaxHp);
    const playerHpPercent = safeHpPercent(ctx.playerHp, ctx.playerMaxHp);
    const attackSkills = ctx.availableSkills.filter(s => !s.isHeal && !s.isBuff);
    const buffSkills = ctx.availableSkills.filter(s => s.isBuff);
    const healSkills = ctx.availableSkills.filter(s => s.isHeal);

    // 1. 狂暴（<20%）→ 全力攻击，不 buff/治疗
    if (hpPercent < BOSS_ENRAGE_HP_THRESHOLD) {
      if (playerHpPercent < 0.3 && attackSkills.length > 0) {
        const skill = this.rng.pick(attackSkills);
        return { type: 'skill', skillId: skill.id };
      }
      if (attackSkills.length > 0) {
        const skill = this.rng.pick(attackSkills);
        return { type: 'skill', skillId: skill.id };
      }
      return { type: 'basic_attack' };
    }

    // 2. 半血（<50%）→ 混合 buff/治疗/攻击
    if (hpPercent < BOSS_HALF_HP_THRESHOLD) {
      // 2a. 玩家残血 → 补刀优先
      if (playerHpPercent < PLAYER_LOW_HP_THRESHOLD && attackSkills.length > 0 && this.rng.bool(0.5)) {
        const skill = this.rng.pick(attackSkills);
        return { type: 'skill', skillId: skill.id };
      }
      // 2b. 治疗
      if (healSkills.length > 0 && this.rng.bool(BOSS_HALF_HEAL_CHANCE)) {
        return { type: 'heal', skillId: healSkills[0].id };
      }
      // 2c. buff（无已有增益时）
      if (buffSkills.length > 0 && !ctx.enemyHasBuff && this.rng.bool(BOSS_HALF_BUFF_CHANCE)) {
        const skill = this.rng.pick(buffSkills);
        return { type: 'buff', skillId: skill.id };
      }
      // 2d. 攻击技能
      if (attackSkills.length > 0 && this.rng.bool(BOSS_HALF_SKILL_CHANCE)) {
        const skill = this.rng.pick(attackSkills);
        return { type: 'skill', skillId: skill.id };
      }
      return { type: 'basic_attack' };
    }

    // 3. 正常（≥50%）→ 偶尔 buff + 攻击
    // 3a. 开场 buff（回合 1-3）
    if (ctx.turnCount <= 3 && buffSkills.length > 0 && !ctx.enemyHasBuff && this.rng.bool(0.4)) {
      const skill = this.rng.pick(buffSkills);
      return { type: 'buff', skillId: skill.id };
    }
    // 3b. 常规攻击 + 偶尔 buff
    if (attackSkills.length > 0 && this.rng.bool(BOSS_NORMAL_SKILL_CHANCE)) {
      const skill = this.rng.pick(attackSkills);
      return { type: 'skill', skillId: skill.id };
    }
    if (buffSkills.length > 0 && !ctx.enemyHasBuff && this.rng.bool(BOSS_BUFF_CHANCE)) {
      const skill = this.rng.pick(buffSkills);
      return { type: 'buff', skillId: skill.id };
    }
    return { type: 'basic_attack' };
  }
}
