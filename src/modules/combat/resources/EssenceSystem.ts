/**
 * @fileoverview 龙脉术士精华资源系统
 * @description 精华是龙脉术士的辅助资源，通过 MP 生成器技能积累，大招消耗。
 *              设计要点：
 *              - 战斗开始时 0 精华
 *              - MP 生成器技能直接生成（配置 generatesResource）
 *              - 上限 3 精华
 *              精华消耗于翡翠浩劫等强力龙族大招。
 *              龙脉术士积蓄龙族精华，在关键时刻释放强力龙族能力。
 * @module combat/resources
 */
import { BaseResourceSystem } from './BaseResourceSystem';
import type { ResourceSource } from './types';

export class EssenceSystem extends BaseResourceSystem {
  readonly type = 'essence' as const;

  constructor(initialValue: number = 0) {
    super({ maxValue: 3, initialValue, isInteger: true, isSecondary: true });
  }

  generate(amount: number, source: ResourceSource): void {
    if (source !== 'skill') {
      // 精华仅通过 MP 生成器技能积攒（generatesResource 触发）
      return;
    }
    // P9-074 修复：移除 Math.min(amount, 3) 重复裁剪——applyGeneration 已通过 maxValue 裁剪
    this.applyGeneration(amount);
  }
}
