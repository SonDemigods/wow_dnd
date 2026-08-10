/**
 * @fileoverview Boss 战斗引擎
 * @description Boss 机制执行器注册表、属性调整等核心逻辑。
 *              机制执行过程中动态注入的临时状态由 BossRuntimeState 接口定义，
 *              战斗结束后统一清除，不持久化。
 *
 * 阶段二升级：
 *   - 修复 `||` 吞 falsy 值问题（shieldAmount:0 / reflectPercent:0 等合法值被默认值覆盖）
 *   - 强化 params 类型：为每个机制定义独立 params 接口，消除 `as string` 断言
 *
 * 阶段三升级：
 *   - BossRuntimeState 接口提升至 boss/types.ts 公共类型，本文件改为导入
 *   - 3.3 子 PR：执行器入参从 EnemyInstance 迁移到组合式 BossInstance
 *     · 执行器读写 boss.runtime.xxx（运行时状态）和 boss.base.xxx（战斗属性）
 *     · executeBossMechanic 返回前调用 syncRuntimeToBase 同步 runtime 到 base 顶层
 *     · 移除 BossRuntime 别名与 `boss as BossRuntime` 断言
 */

import type { BossPhase, BossMechanic, BossMechanicType, BossInstance } from './types';

// ============================================================================
// 机制参数强类型定义（阶段二升级）
// ============================================================================

/**
 * 狂暴机制参数
 * @property attackMultiplier - 攻击力提升倍率（默认 1.5）
 */
interface EnrageParams {
  attackMultiplier?: number;
}

/**
 * 伤害护盾机制参数
 * @property shieldAmount - 护盾数值（默认 30）
 */
interface DamageShieldParams {
  shieldAmount?: number;
}

/**
 * 反弹伤害机制参数
 * @property reflectPercent - 反弹比例 0-1（默认 0.2）
 */
interface ReflectDamageParams {
  reflectPercent?: number;
}

/**
 * 召唤小怪机制参数
 * @property count - 召唤数量（默认 1）
 */
interface SummonMinionsParams {
  count?: number;
}

/**
 * 减益光环机制参数
 * @property debuffType - 减益类型（默认 'attack_down'）
 */
interface DebuffAuraParams {
  debuffType?: string;
}

/**
 * 治疗区域机制参数
 * @property healPerTurn - 每回合回复量（默认 5）
 */
interface HealingZoneParams {
  healPerTurn?: number;
}

/**
 * 机制参数联合类型
 *
 * 汇总所有带参数机制的 params 接口，供执行器按需读取。
 * 未带参数的机制（invulnerable/revive 等）不在此联合中。
 */
type MechanicParams = Partial<
  EnrageParams &
  DamageShieldParams &
  ReflectDamageParams &
  SummonMinionsParams &
  DebuffAuraParams &
  HealingZoneParams
>;

// ============================================================================
// 机制执行器注册表
// ============================================================================

/**
 * 机制执行器函数类型
 *
 * 每个 Boss 机制对应一个执行器：从 params 提取参数（默认值兜底），
 * 将运行时状态注入到 BossInstance.runtime 上，战斗属性修改到 BossInstance.base 上。
 */
type MechanicExecutor = (boss: BossInstance, params?: MechanicParams) => void;

/**
 * 机制执行器注册表
 *
 * 将 BossMechanicType 映射为具体的执行函数。执行器按职责拆分为三组
 *（属性与防御、召唤与攻击、玩家效果与场景），最终合并为完整注册表。
 * 每个执行器负责：
 * 1. 从 params 中提取机制参数（使用默认值兜底）
 * 2. 将运行时状态注入到 BossRuntime 实例上
 *
 * 未在此处直接处理战斗效果的机制（如 stun_player、split 等），
 * 仅设置标记位，由 combat store 在后续流程中消费。
 *
 * 拆分说明（CODE-40 修复）：原为单一巨型 Record（17 个执行器集中声明），
 * 现按职责分组以便维护与查找。合并后的 mechanicExecutors 行为与原实现完全一致。
 */

// ---- 属性与防御类执行器：调整 Boss 自身属性或设置防御性状态 ----
type StatAndDefenseMechanic =
  | 'enrage' | 'damage_shield' | 'reflect_damage'
  | 'invulnerable' | 'revive' | 'counter_stance';

const statAndDefenseExecutors: Record<StatAndDefenseMechanic, MechanicExecutor> = {
  /** 狂暴：按 attackMultiplier 倍率提升物理攻击力（默认 1.5 倍，仅触发一次） */
  enrage: (boss, params) => {
    if (boss.runtime.enraged) return;
    // P10-015 修复：enrage 修改 base 属性前，先保存 originalBaseStats 快照
    // 防止 enrage 先于 applyPhaseStats 执行时，快照捕获到已 enrage 的值
    if (!boss.runtime.originalBaseStats) {
      boss.runtime.originalBaseStats = {
        physicalAttack: boss.base.physicalAttack,
        magicAttack: boss.base.magicAttack,
        physicalDefense: boss.base.physicalDefense,
        magicDefense: boss.base.magicDefense,
      };
    }
    // 阶段二修复：|| 会吞掉 0，改用 ?? 仅在 undefined/null 时回退
    const multiplier = params?.attackMultiplier ?? 1.5;
    boss.base.physicalAttack = Math.round((boss.base.physicalAttack ?? 10) * multiplier);
    boss.runtime.enraged = true;
  },
  /** 伤害护盾：叠加 shieldAmount 数值的护盾（默认 30） */
  damage_shield: (boss, params) => {
    // 阶段二修复：shieldAmount:0 是合法值（清空护盾），不应被默认值覆盖
    const shieldAmount = params?.shieldAmount ?? 30;
    // P8-401 修复：shieldAmount=0 时清空护盾（与注释语义一致），其余追加
    boss.runtime.shield = shieldAmount === 0 ? 0 : (boss.runtime.shield ?? 0) + shieldAmount;
  },
  /** 反弹伤害：设置反弹比例（默认 20%） */
  reflect_damage: (boss, params) => {
    // 阶段二修复：reflectPercent:0 是合法值（不反弹），不应被默认值覆盖
    boss.runtime.reflectDamage = params?.reflectPercent ?? 0.2;
  },
  /** 无敌：设置免疫所有伤害标记 */
  invulnerable: (boss) => { boss.runtime.invulnerable = true; },
  /** 复活：标记可复活一次 */
  revive: (boss) => { boss.runtime.canRevive = true; },
  /** 反击姿态：标记进入反击状态 */
  counter_stance: (boss) => { boss.runtime.counterStance = true; },
};

// ---- 召唤与攻击类执行器：召唤援军或改变攻击模式 ----
type SummonAndAttackMechanic =
  | 'summon_minions' | 'summon_elite' | 'aoe_attack' | 'charge_attack';

const summonAndAttackExecutors: Record<SummonAndAttackMechanic, MechanicExecutor> = {
  /** 召唤小怪：累加待召唤数量（由 combat store 实际创建） */
  summon_minions: (boss, params) => {
    // 阶段二修复：count:0 是合法值（不召唤），不应被默认值覆盖
    const count = params?.count ?? 1;
    boss.runtime.pendingSummons = (boss.runtime.pendingSummons ?? 0) + count;
  },
  /** 召唤精英怪：标记待召唤（由 combat store 处理） */
  summon_elite: (boss) => { boss.runtime.pendingEliteSummons = true; },
  /** 范围攻击：标记下次攻击为 AOE */
  aoe_attack: (boss) => { boss.runtime.aoeNextAttack = true; },
  /** 冲锋攻击：设置蓄力标记，下回合释放 */
  charge_attack: (boss) => { boss.runtime.charging = true; },
};

// ---- 玩家效果与场景类执行器：影响玩家或场地，多数仅设置标记由 combat store/UI 消费 ----
type PlayerEffectAndSceneMechanic =
  | 'stun_player' | 'silence_player' | 'debuff_aura'
  | 'arena_hazard' | 'healing_zone' | 'split' | 'steal_buff';

const playerEffectAndSceneExecutors: Record<PlayerEffectAndSceneMechanic, MechanicExecutor> = {
  /** 眩晕玩家：标记触发（由 combat store 处理玩家端效果） */
  stun_player: () => { /* 由 combat store 处理 */ },
  /** 沉默玩家：标记触发（由 combat store 处理玩家端效果） */
  silence_player: () => { /* 由 combat store 处理 */ },
  /** 减益光环：设置光环类型（默认 'attack_down'） */
  debuff_aura: (boss, params) => {
    // debuffType 为字符串，空字符串回退到默认值是合理的（与数值 0 的语义不同）
    boss.runtime.debuffAura = params?.debuffType || 'attack_down';
  },
  /** 场地危险：标记触发（由 UI 层渲染特效） */
  arena_hazard: () => { /* UI 特效 */ },
  /** 治疗区域：设置每回合回复量（默认 5） */
  healing_zone: (boss, params) => {
    // 阶段二修复：healPerTurn:0 是合法值（不治疗），不应被默认值覆盖
    boss.runtime.healingZone = params?.healPerTurn ?? 5;
  },
  /** 分裂：标记触发（由 combat store 处理分裂逻辑） */
  split: () => { /* 由 combat store 处理 */ },
  /** 偷取增益：标记触发（由 combat store 处理偷取逻辑） */
  steal_buff: () => { /* 由 combat store 处理 */ },
};

/**
 * 机制执行器完整注册表
 *
 * 由上述三组分类执行器合并而来，覆盖所有 BossMechanicType。
 * executeBossMechanic 通过此注册表查找并调用对应执行器。
 */
const mechanicExecutors: Record<BossMechanicType, MechanicExecutor> = {
  ...statAndDefenseExecutors,
  ...summonAndAttackExecutors,
  ...playerEffectAndSceneExecutors
};

// ============================================================================
// 公开 API
// ============================================================================

/**
 * 执行单个 Boss 机制
 *
 * 根据机制的 intervalTurns 判断是否到达触发间隔，满足条件时调用对应执行器。
 * 执行器修改 boss.runtime.xxx 后，调用 syncRuntimeToBase 同步到 boss.base 顶层，
 * 供仍通过 EnemyInstance 顶层字段访问的 combat 层读取。
 *
 * @param boss - 组合式 Boss 实例（base 与 enemy store 同引用，runtime 为运行时状态）
 * @param mechanic - 要执行的机制配置
 * @param turnCount - 当前回合数
 * @returns 是否实际触发了该机制（未到间隔或执行器不存在时返回 false）
 */
export function executeBossMechanic(boss: BossInstance, mechanic: BossMechanic, turnCount: number): boolean {
  // 未到触发间隔，跳过
  if (mechanic.lastTriggerTurn !== undefined && turnCount - mechanic.lastTriggerTurn < mechanic.intervalTurns) {
    return false;
  }
  const executor = mechanicExecutors[mechanic.type];
  if (executor) {
    // 阶段二升级：params 类型为 Record<string, string | number>，
    // 此处安全窄化为 MechanicParams 联合类型（所有字段均为 optional，结构兼容）
    const params = mechanic.params as MechanicParams | undefined;
    executor(boss, params);
    // 阶段三 3.5：执行器修改 boss.runtime.xxx，combat 层通过 bossInstances Map 直接读取 runtime
    //（不再需要 syncRuntimeToBase 同步到 base 顶层）
    mechanic.lastTriggerTurn = turnCount;
    return true;
  }
  return false;
}

/**
 * 遍历阶段内所有机制并执行就绪的
 *
 * @param boss - 组合式 Boss 实例
 * @param phase - 当前阶段配置
 * @param turnCount - 当前回合数
 * @returns 本轮触发的机制类型列表（供日志/特效使用）
 */
export function processBossPhaseMechanics(boss: BossInstance, phase: BossPhase, turnCount: number): BossMechanicType[] {
  const triggered: BossMechanicType[] = [];
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
 * 未配置的乘数不会修改对应属性。写入的是 boss.base 上的可选字段（如 physicalAttack），
 * 而非 Stats（六维属性），因此无需 as any 转换。
 *
 * @param boss - 组合式 Boss 实例（boss.base 战斗属性被原地修改）
 * @param phase - 目标阶段配置
 */
export function applyPhaseStats(boss: BossInstance, phase: BossPhase): void {
  if (!phase.statMultipliers) return;
  const m = phase.statMultipliers;

  // P7-021 修复：首次调用时保存原始 base 属性快照，后续基于快照重算，防止阶段切换累积连乘
  if (!boss.runtime.originalBaseStats) {
    boss.runtime.originalBaseStats = {
      physicalAttack: boss.base.physicalAttack,
      magicAttack: boss.base.magicAttack,
      physicalDefense: boss.base.physicalDefense,
      magicDefense: boss.base.magicDefense,
    };
  }
  const orig = boss.runtime.originalBaseStats;

  // P6-006 修复：改用 !== undefined 判断，允许配置乘数 0（用于清零属性）
  if (m.physicalAttack !== undefined) boss.base.physicalAttack = Math.round((orig.physicalAttack ?? 10) * m.physicalAttack);
  if (m.magicAttack !== undefined) boss.base.magicAttack = Math.round((orig.magicAttack ?? 10) * m.magicAttack);
  if (m.physicalDefense !== undefined) boss.base.physicalDefense = Math.round((orig.physicalDefense ?? 5) * m.physicalDefense);
  if (m.magicDefense !== undefined) boss.base.magicDefense = Math.round((orig.magicDefense ?? 5) * m.magicDefense);
}
