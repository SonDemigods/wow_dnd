/**
 * @fileoverview Buff/Debuff 效果系统 — 类型定义
 * @description 效果类型、效果实例、效果容器、效果上下文等核心数据结构
 */

/** 效果类型 */
export type EffectType =
  | 'poison'       // 中毒：每回合扣血
  | 'burn'         // 灼烧：每回合扣血（比毒强）
  | 'stun'         // 眩晕：跳过回合
  | 'freeze'       // 冰冻：跳过回合+减速
  | 'silence'      // 沉默：无法使用技能
  | 'shield'       // 护盾：吸收伤害
  | 'attack_up'    // 攻击上升
  | 'attack_down'  // 攻击下降
  | 'defense_up'   // 防御上升
  | 'defense_down' // 防御下降
  | 'speed_up'     // 速度上升
  | 'speed_down'   // 速度下降
  | 'regen'        // 恢复：每回合回血
  | 'thorn'        // 荆棘：反弹伤害
  | 'vulnerable';  // 易伤：受到的伤害增加

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
  /** 持续治疗量 */
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
  /** 荆棘反弹伤害 */
  thorns: number;
}

/** 伤害类型 */
export type DamageType = 'physical' | 'magical';
