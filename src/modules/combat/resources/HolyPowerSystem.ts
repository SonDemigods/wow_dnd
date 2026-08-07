/**
 * @fileoverview 圣骑士神圣资源系统
 * @description 神圣是圣骑士的辅助资源，通过 MP 生成器技能积累，大招消耗。
 *              设计要点：
 *              - 战斗开始时 0 神圣
 *              - MP 生成器技能直接生成（配置 generatesResource）
 *              - 上限 4 神圣
 *              神圣消耗于圣光降临等大招。
 * @module combat/resources
 */
import { BaseResourceSystem } from './BaseResourceSystem';
import type { ResourceSource } from './types';

export class HolyPowerSystem extends BaseResourceSystem {
  readonly type = 'holy_power' as const;

  constructor(initialValue: number = 0) {
    super({ maxValue: 4, initialValue, isInteger: true, isSecondary: true });
  }

  generate(amount: number, source: ResourceSource): void {
    if (source !== 'skill') {
      // 神圣能量仅通过 MP 生成器技能积攒（generatesResource 触发）
      return;
    }
    this.applyGeneration(Math.min(amount, 4));
  }
}
