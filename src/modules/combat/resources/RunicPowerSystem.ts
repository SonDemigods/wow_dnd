/**
 * @fileoverview 亡灵骑士符能资源系统
 * @description 符能是亡灵骑士的主资源（替代 MP），通过攻击、受伤、回合和击杀积累。
 *              设计要点：
 *              - 战斗开始时 0 符能
 *              - 攻击命中获取 5 点
 *              - 受伤获取伤害的 10%（上限 10）
 *              - 每回合开始获取 3 点
 *              - 击杀敌人获取 10 点
 *              - 上限 100，整数型资源
 *              符能消耗于亡灵骑士的各类技能。消耗符文（辅助资源）也会生成符能。
 * @module combat/resources
 */
import { BaseResourceSystem } from './BaseResourceSystem';
import type { ResourceSource } from './types';

/** 符能获取上限配置 */
const RUNIC_POWER_CAPS: Record<ResourceSource, number> = {
  attack: 5,
  damaged: 10,
  turn: 3,
  skill: 20,
  kill: 10,
};

export class RunicPowerSystem extends BaseResourceSystem {
  readonly type = 'runic_power' as const;

  constructor(initialValue: number = 0) {
    super({ maxValue: 100, initialValue, isInteger: true });
  }

  generate(amount: number, source: ResourceSource): void {
    const cap = RUNIC_POWER_CAPS[source] ?? amount;
    const actual = Math.min(amount, cap);
    this.applyGeneration(actual);
  }

  onTurnStart(): void {
    this.generate(3, 'turn');
  }

  onAttack(): void {
    this.generate(5, 'attack');
  }

  onDamaged(amount: number): void {
    this.generate(Math.floor(amount * 0.1), 'damaged');
  }

  onKill(): void {
    this.generate(10, 'kill');
  }
}
