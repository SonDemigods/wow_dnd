/**
 * @fileoverview Boss 战斗引擎
 * @description Boss 机制执行器注册表、属性调整等核心逻辑。
 *              机制执行过程中动态注入的临时状态由 BossRuntimeState 接口定义，
 *              战斗结束后统一清除，不持久化。
 */

import type { BossPhase, BossMechanic, BossMechanicType } from './types';
import type { EnemyInstance } from '../enemy/types';

// ============================================================================
// Boss 运行时状态接口
// ============================================================================

/**
 * Boss 运行时动态属性
 *
 * 机制执行过程中注入到 EnemyInstance 上的临时状态。
 * 这些属性仅在当次战斗中有效，战斗结束后由 combat store 清除，不持久化到 IndexedDB。
 * 每个机制类型对应一个或多个状态字段，具体映射关系见 mechanicExecutors。
 */
interface BossRuntimeState {
  /** 护盾值（damage_shield 机制注入，吸收等量伤害） */
  shield?: number;
  /** 反弹伤害比例 0-1（reflect_damage 机制注入，如 0.2 表示反弹 20% 伤害） */
  reflectDamage?: number;
  /** 待召唤小怪数量（summon_minions 机制累加，由 combat store 消费后清零） */
  pendingSummons?: number;
  /** 下次攻击是否为 AOE（aoe_attack 机制标记，攻击后由 combat store 清除） */
  aoeNextAttack?: boolean;
  /** 待召唤精英怪标记（summon_elite 机制标记） */
  pendingEliteSummons?: boolean;
  /** 无敌标记（invulnerable 机制设置，期间免疫所有伤害） */
  invulnerable?: boolean;
  /** 蓄力标记（charge_attack 机制设置，下回合释放蓄力攻击） */
  charging?: boolean;
  /** 减益光环类型（debuff_aura 机制设置，如 'attack_down' 表示降低攻击力） */
  debuffAura?: string;
  /** 治疗区域每回合回复量（healing_zone 机制设置） */
  healingZone?: number;
  /** 可复活标记（revive 机制设置，死亡后自动复活一次） */
  canRevive?: boolean;
  /** 反击姿态标记（counter_stance 机制设置，被攻击时反击） */
  counterStance?: boolean;
}

/**
 * Boss 运行时实例类型（EnemyInstance + 运行时动态属性）
 *
 * 机制执行器内部使用此类型，以在 EnemyInstance 上安全地注入/读取运行时状态。
 * 公开 API（executeBossMechanic 等）接受 EnemyInstance，内部通过 as 断言转型。
 */
type BossRuntime = EnemyInstance & BossRuntimeState;

// ============================================================================
// 机制执行器注册表
// ============================================================================

/**
 * 机制执行器注册表
 *
 * 将 BossMechanicType 映射为具体的执行函数。每个执行器负责：
 * 1. 从 params 中提取机制参数（使用默认值兜底）
 * 2. 将运行时状态注入到 BossRuntime 实例上
 *
 * 未在此处直接处理战斗效果的机制（如 stun_player、split 等），
 * 仅设置标记位，由 combat store 在后续流程中消费。
 */
const mechanicExecutors: Record<BossMechanicType, (boss: BossRuntime, params?: Record<string, number>) => void> = {
  /** 狂暴：按 attackMultiplier 倍率提升物理攻击力（默认 1.5 倍） */
  enrage: (boss, params) => {
    const multiplier = params?.attackMultiplier || 1.5;
    boss.physicalAttack = Math.round((boss.physicalAttack || 10) * multiplier);
  },
  /** 伤害护盾：叠加 shieldAmount 数值的护盾（默认 30） */
  damage_shield: (boss, params) => {
    const shieldAmount = params?.shieldAmount || 30;
    boss.shield = (boss.shield || 0) + shieldAmount;
  },
  /** 反弹伤害：设置反弹比例（默认 20%） */
  reflect_damage: (boss, params) => {
    boss.reflectDamage = params?.reflectPercent || 0.2;
  },
  /** 召唤小怪：累加待召唤数量（由 combat store 实际创建） */
  summon_minions: (boss, params) => {
    boss.pendingSummons = (boss.pendingSummons || 0) + (params?.count || 1);
  },
  /** 范围攻击：标记下次攻击为 AOE */
  aoe_attack: (boss, _params) => {
    boss.aoeNextAttack = true;
  },
  /** 召唤精英怪：标记待召唤（由 combat store 处理） */
  summon_elite: (boss) => { boss.pendingEliteSummons = true; },
  /** 无敌：设置免疫所有伤害标记 */
  invulnerable: (boss) => { boss.invulnerable = true; },
  /** 冲锋攻击：设置蓄力标记，下回合释放 */
  charge_attack: (boss) => { boss.charging = true; },
  /** 眩晕玩家：标记触发（由 combat store 处理玩家端效果） */
  stun_player: () => { /* 由 combat store 处理 */ },
  /** 沉默玩家：标记触发（由 combat store 处理玩家端效果） */
  silence_player: () => { /* 由 combat store 处理 */ },
  /** 减益光环：设置光环类型（默认 'attack_down'） */
  debuff_aura: (boss, params) => { boss.debuffAura = params?.debuffType || 'attack_down'; },
  /** 场地危险：标记触发（由 UI 层渲染特效） */
  arena_hazard: () => { /* UI 特效 */ },
  /** 治疗区域：设置每回合回复量（默认 5） */
  healing_zone: (boss, params) => { boss.healingZone = params?.healPerTurn || 5; },
  /** 分裂：标记触发（由 combat store 处理分裂逻辑） */
  split: () => { /* 由 combat store 处理 */ },
  /** 复活：标记可复活一次 */
  revive: (boss) => { boss.canRevive = true; },
  /** 偷取增益：标记触发（由 combat store 处理偷取逻辑） */
  steal_buff: () => { /* 由 combat store 处理 */ },
  /** 反击姿态：标记进入反击状态 */
  counter_stance: (boss) => { boss.counterStance = true; },
};

// ============================================================================
// 公开 API
// ============================================================================

/**
 * 执行单个 Boss 机制
 *
 * 根据机制的 intervalTurns 判断是否到达触发间隔，满足条件时调用对应执行器。
 *
 * @param boss - Boss 运行时实例
 * @param mechanic - 要执行的机制配置
 * @param turnCount - 当前回合数
 * @returns 是否实际触发了该机制（未到间隔或执行器不存在时返回 false）
 */
export function executeBossMechanic(boss: EnemyInstance, mechanic: BossMechanic, turnCount: number): boolean {
  // 未到触发间隔，跳过
  if (mechanic.lastTriggerTurn && turnCount - mechanic.lastTriggerTurn < mechanic.intervalTurns) {
    return false;
  }
  const executor = mechanicExecutors[mechanic.type];
  if (executor) {
    // mechanic.params 定义为 Record<string, string | number>，
    // 但所有执行器仅消费 number 值，此处断言为安全的窄化类型
    const params = mechanic.params as Record<string, number> | undefined;
    executor(boss as BossRuntime, params);
    mechanic.lastTriggerTurn = turnCount;
    return true;
  }
  return false;
}

/**
 * 遍历阶段内所有机制并执行就绪的
 *
 * @param boss - Boss 运行时实例
 * @param phase - 当前阶段配置
 * @param turnCount - 当前回合数
 * @returns 本轮触发的机制类型列表（供日志/特效使用）
 */
export function processBossPhaseMechanics(boss: EnemyInstance, phase: BossPhase, turnCount: number): string[] {
  const triggered: string[] = [];
  for (const mechanic of phase.mechanics) {
    if (executeBossMechanic(boss, mechanic, turnCount)) {
      triggered.push(mechanic.type);
    }
  }
  return triggered;
}

/**
 * 应用阶段属性乘数到 Boss 实例
 *
 * 阶段切换时调用，将 statMultipliers 中的倍率应用到 Boss 的战斗属性上。
 * 未配置的乘数不会修改对应属性。写入的是 EnemyData 上的可选字段（如 physicalAttack），
 * 而非 Stats（六维属性），因此无需 as any 转换。
 *
 * @param boss - Boss 实例（战斗属性被原地修改）
 * @param phase - 目标阶段配置
 */
export function applyPhaseStats(boss: EnemyInstance, phase: BossPhase): void {
  if (!phase.statMultipliers) return;
  const m = phase.statMultipliers;
  if (m.physicalAttack) boss.physicalAttack = Math.round((boss.physicalAttack || 10) * m.physicalAttack);
  if (m.magicAttack) boss.magicAttack = Math.round((boss.magicAttack || 10) * m.magicAttack);
  if (m.physicalDefense) boss.physicalDefense = Math.round((boss.physicalDefense || 5) * m.physicalDefense);
  // magicDefense 仅在已配置时才应用乘数（未配置 = undefined 时不修改）
  if (m.magicDefense && boss.magicDefense !== undefined) boss.magicDefense = Math.round(boss.magicDefense * m.magicDefense);
}
