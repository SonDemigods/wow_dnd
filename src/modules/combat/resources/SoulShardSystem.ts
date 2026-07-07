/**
 * @fileoverview 术士灵魂碎片资源系统
 * @description 灵魂碎片是术士的核心资源，通过施法获取，用于召唤和强化技能。
 *              设计要点：
 *              - 战斗开始时 1 灵魂碎片
 *              - 施放技能获取 1 灵魂碎片（source='skill'）
 *              - 击杀敌人获取 1 灵魂碎片
 *              - 上限 5 灵魂碎片
 *              灵魂碎片消耗于召唤恶魔、强化持续性伤害技能等。
 * @module combat/resources
 */
import { BaseResourceSystem } from './BaseResourceSystem';
import type { ResourceSource } from './types';

export class SoulShardSystem extends BaseResourceSystem {
  readonly type = 'soul_shard' as const;

  constructor(initialValue: number = 1) {
    super({ maxValue: 5, initialValue, isInteger: true });
  }

  generate(amount: number, source: ResourceSource): void {
    // 灵魂碎片按来源差异化生成
    let actual = amount;
    switch (source) {
      case 'skill':
        actual = Math.min(amount, 1); // 施法获取 1 碎片
        break;
      case 'kill':
        actual = Math.min(amount, 1); // 击杀获取 1 碎片
        break;
      default:
        // 其他来源不生成灵魂碎片
        return;
    }
    this.applyGeneration(actual);
  }

  onKill(): void {
    this.generate(1, 'kill');
  }
}
