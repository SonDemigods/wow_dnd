/**
 * @fileoverview 术士灵魂碎片资源系统
 * @description 灵魂碎片是术士的辅助资源，通过 MP 生成器技能积累，召唤/爆发消耗。
 *              设计要点：
 *              - 战斗开始时 0 灵魂碎片
 *              - MP 生成器技能直接生成（配置 generatesResource）
 *              - 上限 5 灵魂碎片
 *              灵魂碎片消耗于召唤恶魔、混乱之箭等爆发技能。
 * @module combat/resources
 */
import { BaseResourceSystem } from './BaseResourceSystem';
import type { ResourceSource } from './types';

export class SoulShardSystem extends BaseResourceSystem {
  readonly type = 'soul_shard' as const;

  constructor(initialValue: number = 0) {
    super({ maxValue: 5, initialValue, isInteger: true, isSecondary: true });
  }

  generate(amount: number, source: ResourceSource): void {
    if (source !== 'skill') {
      // 灵魂碎片仅通过 MP 生成器技能积攒（generatesResource 触发）
      return;
    }
    this.applyGeneration(Math.min(amount, 5));
  }
}
