/**
 * @fileoverview 猎人集中值资源系统
 * @description 集中值是猎人的核心资源，通过攻击和回合回复积累，消耗于射击和宠物指令技能。
 *              设计要点：
 *              - 战斗开始时满集中值（100/100）
 *              - 每回合开始回复 10 点
 *              - 攻击命中获取 5 点
 *              - 上限 100，整数型资源
 *              集中值消耗于瞄准射击、多重射击等强力技能。
 * @module combat/resources
 */
import { BaseResourceSystem } from './BaseResourceSystem';
import type { ResourceSource } from './types';

/** 每回合被动回复的集中值 */
const FOCUS_REGEN_PER_TURN = 10;

/** 集中值获取上限配置 */
const FOCUS_CAPS: Record<ResourceSource, number> = {
  attack: 5,
  damaged: 3,
  turn: FOCUS_REGEN_PER_TURN,
  skill: 5,
  kill: 10,
  // P2-43：被动技能触发的资源生成不截断，按配置值全额生成
  passive: Infinity,
};

export class FocusSystem extends BaseResourceSystem {
  readonly type = 'focus' as const;

  constructor(initialValue: number = 100) {
    super({ maxValue: 100, initialValue, isInteger: true });
  }

  generate(amount: number, source: ResourceSource): void {
    const cap = FOCUS_CAPS[source] ?? amount;
    const actual = Math.min(amount, cap);
    this.applyGeneration(actual);
  }

  onTurnStart(): void {
    this.generate(FOCUS_REGEN_PER_TURN, 'turn');
  }

  onAttack(): void {
    this.generate(5, 'attack');
  }

  // P9-009 修复：实现 onDamaged 钩子，使猎人在受伤时获取集中值（FOCUS_CAPS.damaged = 3）
  onDamaged(amount: number): void {
    this.generate(Math.floor(amount * 0.1), 'damaged');
  }
}
