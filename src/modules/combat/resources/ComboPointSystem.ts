/**
 * @fileoverview 潜行者连击点资源系统
 * @description 连击点是潜行者的终结资源，通过生成器技能积累，终结技全部消耗并按数量缩放。
 *              设计要点：
 *              - 战斗开始时 0 连击点
 *              - 生成器技能直接生成（配置 generatesResource）
 *              - 上限 6 连击点
 *              连击点与能量（EnergySystem）配合：
 *              生成器技能消耗能量并积攒连击点，终结技全部消耗连击点造成缩放伤害。
 * @module combat/resources
 */
import { BaseResourceSystem } from './BaseResourceSystem';
import type { ResourceSource } from './types';

export class ComboPointSystem extends BaseResourceSystem {
  readonly type = 'combo_point' as const;

  constructor(initialValue: number = 0) {
    super({ maxValue: 6, initialValue, isInteger: true });
  }

  generate(amount: number, source: ResourceSource): void {
    if (source !== 'skill') {
      // 连击点仅通过生成器技能积攒（generatesResource 触发）
      return;
    }
    this.applyGeneration(Math.min(amount, 6));
  }
}
