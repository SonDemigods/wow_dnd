/**
 * @fileoverview Buff/Debuff 效果系统 — 类型定义
 * @description 效果类型、效果实例、效果容器、效果上下文等核心数据结构
 */

// P3-164：EffectType 拆分到独立文件，供 skill 等外部模块引用以消除循环依赖
export type { EffectType } from './effect-type';
import type { EffectType } from './effect-type';

/** 叠加策略 */
export type StackStrategy = 'replace' | 'max' | 'additive' | 'independent';

/** 单个效果实例 */
export interface Effect {
  id: string;
  type: EffectType;
  /** 剩余持续回合数 */
  remainingTurns: number;
  /** 效果数值（伤害/护盾量/百分比值） */
  value: number;
  /** 来源类型 */
  source: 'skill' | 'item' | 'enemy' | 'passive';
  /** 来源名称 */
  sourceName: string;
  /** 叠加策略，默认 'max' */
  stackStrategy?: StackStrategy;
  /** P3-180：最大叠加层数（仅对 additive/independent 策略生效，默认 5） */
  maxStacks?: number;
}

/** 效果容器（每个单位可拥有多个效果） */
export interface EffectContainer {
  effects: Effect[];
}

/** 效果上下文 — 提供给 Handler 的效果持有者信息 */
export interface EffectContext {
  /** 效果持有者 ID */
  ownerId: string;
  /** 持有者类型 */
  ownerType: 'player' | 'enemy';
  /** 持有者基础属性 */
  baseStats: {
    physicalAttack: number;
    physicalDefense: number;
    magicAttack: number;
    magicDefense: number;
    speed: number;
  };
  /** 当前生命值 */
  currentHp: number;
  /** 最大生命值 */
  maxHp: number;
}

/** 效果每回合推进的返回值 */
export interface TickResult {
  /** 持续伤害量 */
  dotDamage: number;
  /** 持续生命恢复量 */
  regenAmount: number;
}

/** 伤害计算管线的输出 */
export interface DamagePipelineResult {
  /** 攻击方预期伤害 */
  expectedDamage: number;
  /** 防御方修正后的实际伤害 */
  actualDamage: number;
  /** 护盾吸收量 */
  absorbed: number;
  /** 最终扣血量 */
  finalDamage: number;
}

/** 伤害类型 */
export type DamageType = 'physical' | 'magical';
