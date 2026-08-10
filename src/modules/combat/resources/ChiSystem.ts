/**
 * @fileoverview 武僧真气资源系统
 * @description 真气是武僧的终结资源，通过生成器技能积累，终结技全部消耗并按数量缩放。
 *              设计要点：
 *              - 战斗开始时 0 真气
 *              - 生成器技能直接生成（配置 generatesResource）
 *              - 上限 3 真气
 *              真气与能量（EnergySystem）配合：
 *              生成器技能消耗能量并积攒真气，终结技全部消耗真气造成缩放伤害。
 * @module combat/resources
 */
import { BaseResourceSystem } from './BaseResourceSystem';
import type { ResourceSource } from './types';

export class ChiSystem extends BaseResourceSystem {
  readonly type = 'chi' as const;

  constructor(initialValue: number = 0) {
    super({ maxValue: 3, initialValue, isInteger: true, isSecondary: true });
  }

  generate(amount: number, source: ResourceSource): void {
    if (source !== 'skill') {
      // 真气仅通过生成器技能积攒（generatesResource 触发）
      return;
    }
    // P9-074 修复：移除 Math.min(amount, 3) 重复裁剪——applyGeneration 已通过 maxValue 裁剪
    this.applyGeneration(amount);
  }
}
