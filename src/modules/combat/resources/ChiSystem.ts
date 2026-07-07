/**
 * @fileoverview 武僧真气资源系统
 * @description 真气是武僧的核心资源，通过特定技能生成，消耗于终结技。
 *              设计要点：
 *              - 战斗开始时 1 真气
 *              - 攻击命中获取 1 真气
 *              - 每回合开始获取 1 真气
 *              - 上限 5 真气
 *              真气消耗于旭日踢、真气波等强力技能。
 * @module combat/resources
 */
import { BaseResourceSystem } from './BaseResourceSystem';
import type { ResourceSource } from './types';

export class ChiSystem extends BaseResourceSystem {
  readonly type = 'chi' as const;

  constructor(initialValue: number = 1) {
    super({ maxValue: 5, initialValue, isInteger: true });
  }

  generate(amount: number, source: ResourceSource): void {
    // 真气按来源差异化生成
    let actual = amount;
    switch (source) {
      case 'attack':
        actual = Math.min(amount, 1); // 攻击命中获取 1 真气
        break;
      case 'turn':
        actual = Math.min(amount, 1); // 回合开始获取 1 真气
        break;
      case 'skill':
        actual = Math.min(amount, 2); // 技能直接生成（如猛虎掌）
        break;
      default:
        // 受伤/击杀不生成真气
        return;
    }
    this.applyGeneration(actual);
  }

  onTurnStart(): void {
    this.generate(1, 'turn');
  }

  onAttack(): void {
    this.generate(1, 'attack');
  }
}
