/**
 * @fileoverview Boss 战斗引擎
 * @description Boss 阶段管理、机制执行器、属性调整等核心逻辑
 */

import type { BossInstance, BossPhase, BossMechanic, BossMechanicType } from './types';
import type { Enemy } from '../enemy/types';

/** Boss 阶段管理器 */
export class BossPhaseManager {
  private currentPhaseIndex = 0;

  constructor(private boss: BossInstance) {}

  /** 获取当前阶段 */
  getCurrentPhase(phases: BossPhase[], currentHp: number, maxHp: number): BossPhase | null {
    const hpPercent = currentHp / maxHp;
    // 找到满足 HP 阈值的第一个阶段（从低到高）
    for (let i = phases.length - 1; i >= 0; i--) {
      if (hpPercent <= phases[i].hpThreshold) {
        if (i !== this.currentPhaseIndex) {
          this.currentPhaseIndex = i;
          return phases[i];
        }
        return phases[i];
      }
    }
    this.currentPhaseIndex = 0;
    return phases[0] || null;
  }

  /** 检查阶段是否切换 */
  checkPhaseTransition(phases: BossPhase[], currentHp: number, maxHp: number): { changed: boolean; newPhase?: BossPhase } {
    const hpPercent = currentHp / maxHp;
    for (let i = phases.length - 1; i >= 0; i--) {
      if (hpPercent <= phases[i].hpThreshold && i !== this.currentPhaseIndex) {
        const oldIndex = this.currentPhaseIndex;
        this.currentPhaseIndex = i;
        return { changed: true, newPhase: phases[i] };
      }
    }
    return { changed: false };
  }

  reset(): void {
    this.currentPhaseIndex = 0;
  }
}

/** 机制执行器注册表 */
const mechanicExecutors: Record<BossMechanicType, (boss: Enemy, params?: Record<string, number>) => void> = {
  enrage: (boss, params) => {
    if (boss.stats) {
      const multiplier = params?.attackMultiplier || 1.5;
      boss.stats.physicalAttack = Math.round((boss.stats.physicalAttack || boss.physicalAttack || 10) * multiplier);
    }
  },
  damage_shield: (boss, params) => {
    const shieldAmount = params?.shieldAmount || 30;
    (boss as any).shield = ((boss as any).shield || 0) + shieldAmount;
  },
  reflect_damage: (boss, params) => {
    (boss as any).reflectDamage = params?.reflectPercent || 0.2;
  },
  summon_minions: (boss, params) => {
    // 标记需要召唤小怪（由 combat store 处理）
    (boss as any).pendingSummons = (boss as any).pendingSummons || 0;
    (boss as any).pendingSummons += params?.count || 1;
  },
  aoe_attack: (boss, _params) => {
    (boss as any).aoeNextAttack = true;
  },
  // 其余机制预留占位
  summon_elite: (boss) => { (boss as any).pendingEliteSummons = 1; },
  invulnerable: (boss) => { (boss as any).invulnerable = true; },
  charge_attack: (boss) => { (boss as any).charging = true; },
  stun_player: () => { /* 由 combat store 处理 */ },
  silence_player: () => { /* 由 combat store 处理 */ },
  debuff_aura: (boss, params) => { (boss as any).debuffAura = params?.debuffType || 'attack_down'; },
  arena_hazard: () => { /* UI 特效 */ },
  healing_zone: (boss, params) => { (boss as any).healingZone = params?.healPerTurn || 5; },
  split: () => { /* 由 combat store 处理 */ },
  revive: (boss) => { (boss as any).canRevive = true; },
  steal_buff: () => { /* 由 combat store 处理 */ },
  counter_stance: (boss) => { (boss as any).counterStance = true; },
};

/** 执行 Boss 机制 */
export function executeBossMechanic(boss: Enemy, mechanic: BossMechanic, turnCount: number): boolean {
  if (mechanic.lastTriggerTurn && turnCount - mechanic.lastTriggerTurn < mechanic.intervalTurns) {
    return false;
  }
  const executor = mechanicExecutors[mechanic.type];
  if (executor) {
    executor(boss, mechanic.params);
    mechanic.lastTriggerTurn = turnCount;
    return true;
  }
  return false;
}

/** 检查并执行 Boss 阶段内所有就绪的机制 */
export function processBossPhaseMechanics(boss: Enemy, phase: BossPhase, turnCount: number): string[] {
  const triggered: string[] = [];
  for (const mechanic of phase.mechanics) {
    if (executeBossMechanic(boss, mechanic, turnCount)) {
      triggered.push(mechanic.type);
    }
  }
  return triggered;
}

/** 应用阶段属性乘数 */
export function applyPhaseStats(boss: Enemy, phase: BossPhase): void {
  if (!phase.statMultipliers || !boss.stats) return;
  const m = phase.statMultipliers;
  if (m.physicalAttack) boss.stats.physicalAttack = Math.round((boss.physicalAttack || boss.stats.physicalAttack || 10) * m.physicalAttack);
  if (m.magicAttack) boss.stats.magicAttack = Math.round((boss.magicAttack || boss.stats.magicAttack || 10) * m.magicAttack);
  if (m.physicalDefense) boss.stats.physicalDefense = Math.round((boss.physicalDefense || boss.stats.physicalDefense || 5) * m.physicalDefense);
  if (m.magicDefense && boss.stats.magicDefense !== undefined) boss.stats.magicDefense = Math.round(boss.stats.magicDefense * m.magicDefense);
}
