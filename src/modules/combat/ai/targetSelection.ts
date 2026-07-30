/**
 * @fileoverview AI 目标选择策略
 * @description 为敌人 AI 提供目标选择能力。当前游戏仅有玩家单一目标，此模块为未来多角色队伍系统
 *              预留扩展点。所有选择器实现 ITargetSelector 接口，可按敌人 AI 策略类型灵活替换（CMB-4 修复）。
 *
 * 阶段十二升级：RandomTargetSelector 通过构造函数注入 Rng，支持确定性目标选择与战斗回放。
 * @module combat/ai
 */

import { defaultRng, type Rng } from '@/utils/rng';

/** 战斗参与者（目标的抽象表示） */
export interface Combatant {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 当前生命值 */
  hp: number;
  /** 最大生命值 */
  maxHp: number;
  /** 仇恨值（威胁等级，越高越容易被选为目标） */
  threat?: number;
  /** 是否为玩家方 */
  isPlayer?: boolean;
}

/** 目标选择器接口 */
export interface ITargetSelector {
  /** 选择器名称 */
  readonly name: string;
  /**
   * 从候选目标中选择一个攻击目标
   * @param candidates - 候选目标列表（已过滤掉死亡单位）
   * @returns 选中的目标，无候选时返回 null
   */
  select(candidates: Combatant[]): Combatant | null;
}

/**
 * 仇恨优先选择器
 *
 * 选择仇恨值最高的目标。仇恨值相同时优先攻击 HP 较低（接近击杀）的目标。
 * 适用于激进型与 Boss 型 AI。
 */
export class ThreatBasedTargetSelector implements ITargetSelector {
  readonly name = 'threat_based';

  select(candidates: Combatant[]): Combatant | null {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    return candidates.reduce((best, current) => {
      const currentThreat = current.threat ?? 0;
      const bestThreat = best.threat ?? 0;
      // 仇恨值更高的优先
      if (currentThreat > bestThreat) return current;
      // 仇恨值相同时，HP 更低的优先（更容易击杀）
      if (currentThreat === bestThreat && current.hp < best.hp) return current;
      return best;
    });
  }
}

/**
 * 随机选择器
 *
 * 从候选目标中均匀随机选择一个。适用于低智商怪物或召唤物。
 *
 * 阶段十二：通过构造函数注入 Rng，注入确定性 RNG 可复现目标选择序列。
 */
export class RandomTargetSelector implements ITargetSelector {
  readonly name = 'random';

  constructor(private readonly rng: Rng = defaultRng) {}

  select(candidates: Combatant[]): Combatant | null {
    if (candidates.length === 0) return null;
    return this.rng.pick(candidates);
  }
}

/**
 * 最低 HP 选择器
 *
 * 选择当前 HP 最低的目标（斩杀优先）。适用于激进型 AI 的变体。
 */
export class LowestHpTargetSelector implements ITargetSelector {
  readonly name = 'lowest_hp';

  select(candidates: Combatant[]): Combatant | null {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    return candidates.reduce((best, current) => (current.hp < best.hp ? current : best));
  }
}

/** 选择器注册表 */
const selectorRegistry = new Map<string, ITargetSelector>([
  ['threat_based', new ThreatBasedTargetSelector()],
  ['random', new RandomTargetSelector()],
  ['lowest_hp', new LowestHpTargetSelector()],
]);

/**
 * 按名称获取目标选择器
 * @param name - 选择器名称
 * @returns 选择器实例，未注册时回退到仇恨优先选择器
 */
export function getTargetSelector(name: string): ITargetSelector {
  return selectorRegistry.get(name) ?? selectorRegistry.get('threat_based')!;
}
