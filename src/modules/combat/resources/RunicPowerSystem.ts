/**
 * @fileoverview 亡灵骑士符能资源系统
 * @description 符能是亡灵骑士的主资源（替代 MP），通过攻击、受伤、回合、击杀和符文技能积累。
 *              设计要点：
 *              - 战斗开始时 0 符能
 *              - 攻击命中获取 1 点
 *              - 受伤获取伤害的 10%（上限 2）
 *              - 每回合开始获取 1 点
 *              - 击杀敌人获取 2 点
 *              - 上限 20，整数型资源
 *              符能消耗于亡灵骑士的强力技能与大招。消耗符文（辅助资源）的技能也会通过 generatesResource 生成符能。
 * @module combat/resources
 */
import { BaseResourceSystem } from './BaseResourceSystem';
import type { ResourceSource } from './types';

/** 符能获取上限配置（max 20 体系下按比例下调） */
const RUNIC_POWER_CAPS: Record<ResourceSource, number> = {
  attack: 1,
  damaged: 2,
  turn: 1,
  skill: 4,
  kill: 2,
  // P2-43：被动技能触发的资源生成不截断，按配置值全额生成
  passive: Infinity,
};

export class RunicPowerSystem extends BaseResourceSystem {
  readonly type = 'runic_power' as const;

  constructor(initialValue: number = 0) {
    super({ maxValue: 20, initialValue, isInteger: true });
  }

  generate(amount: number, source: ResourceSource): void {
    const cap = RUNIC_POWER_CAPS[source] ?? amount;
    const actual = Math.min(amount, cap);
    this.applyGeneration(actual);
  }

  onTurnStart(): void {
    this.generate(1, 'turn');
  }

  onAttack(): void {
    this.generate(1, 'attack');
  }

  onDamaged(amount: number): void {
    this.generate(Math.floor(amount * 0.1), 'damaged');
  }

  onKill(): void {
    this.generate(2, 'kill');
  }
}
