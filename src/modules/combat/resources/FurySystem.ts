/**
 * @fileoverview 影刃猎手怒火资源系统
 * @description 怒火是影刃猎手的主资源（替代 MP），通过攻击、受伤、回合和击杀积累。
 *              设计要点：
 *              - 战斗开始时 0 怒火
 *              - 攻击命中获取 5 点
 *              - 受伤获取伤害的 15%（上限 15）
 *              - 每回合开始获取 2 点
 *              - 击杀敌人获取 20 点
 *              - 上限 100，整数型资源
 *              怒火与战士怒气类似但更激进（受伤获取比例更高），体现恶魔之血的狂暴特性。
 * @module combat/resources
 */
import { BaseResourceSystem } from './BaseResourceSystem';
import type { ResourceSource } from './types';

/** 怒火获取上限配置 */
const FURY_CAPS: Record<ResourceSource, number> = {
  attack: 5,
  damaged: 15,
  turn: 2,
  skill: 20,
  kill: 20,
};

export class FurySystem extends BaseResourceSystem {
  readonly type = 'fury' as const;

  constructor(initialValue: number = 0) {
    super({ maxValue: 100, initialValue, isInteger: true });
  }

  generate(amount: number, source: ResourceSource): void {
    const cap = FURY_CAPS[source] ?? amount;
    const actual = Math.min(amount, cap);
    this.applyGeneration(actual);
  }

  onTurnStart(): void {
    this.generate(2, 'turn');
  }

  onAttack(): void {
    this.generate(5, 'attack');
  }

  onDamaged(amount: number): void {
    this.generate(Math.floor(amount * 0.15), 'damaged');
  }

  onKill(): void {
    this.generate(20, 'kill');
  }
}
