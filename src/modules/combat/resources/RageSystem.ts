/**
 * @fileoverview 战士怒气资源系统
 * @description 怒气是战士的核心资源，通过攻击、受伤和技能施放积累，消耗于强力技能。
 *              设计要点：
 *              - 战斗开始时 0 怒气（需要主动战斗积累）
 *              - 攻击命中获取 5 点（onAttack，普攻与技能施放均触发，上限 5）
 *              - 受伤获取伤害的 10%（上限 10 点）
 *              - 每回合被动获取 1 点
 *              - 击杀敌人获取 10 点
 *              - 技能施放获取 1 点（source='skill'，上限 20，由 combat store 调用 generate(1,'skill')）
 *              上限 100 点，整数型资源。
 * @module combat/resources
 */
import { BaseResourceSystem } from './BaseResourceSystem';
import type { ResourceSource } from './types';

/** 怒气获取上限配置 */
const RAGE_CAPS: Record<ResourceSource, number> = {
  attack: 5,
  damaged: 10,
  turn: 1,
  skill: 20,
  kill: 10,
};

export class RageSystem extends BaseResourceSystem {
  readonly type = 'rage' as const;

  constructor(initialValue: number = 0) {
    super({ maxValue: 100, initialValue, isInteger: true });
  }

  generate(amount: number, source: ResourceSource): void {
    const cap = RAGE_CAPS[source] ?? amount;
    const actual = Math.min(amount, cap);
    this.applyGeneration(actual);
  }

  onTurnStart(): void {
    this.generate(1, 'turn');
  }

  onAttack(): void {
    this.generate(5, 'attack');
  }

  onDamaged(amount: number): void {
    // 受到伤害时获取怒气（伤害的 10%，上限 10）
    this.generate(Math.floor(amount * 0.1), 'damaged');
  }

  onKill(): void {
    this.generate(10, 'kill');
  }
}
