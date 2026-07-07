/**
 * @fileoverview 潜行者连击点资源系统
 * @description 连击点是潜行者的终结资源，通过特定技能积累，终结技消耗。
 *              设计要点：
 *              - 战斗开始时 0 连击点
 *              - 攻击命中获取 1 连击点
 *              - 击杀敌人获取 2 连击点
 *              - 上限 5 连击点
 *              连击点与能量（EnergySystem）配合：
 *              生成连击点的技能消耗能量，终结技消耗连击点造成大量伤害。
 * @module combat/resources
 */
import { BaseResourceSystem } from './BaseResourceSystem';
import type { ResourceSource } from './types';

export class ComboPointSystem extends BaseResourceSystem {
  readonly type = 'combo_point' as const;

  constructor(initialValue: number = 0) {
    super({ maxValue: 5, initialValue, isInteger: true });
  }

  generate(amount: number, source: ResourceSource): void {
    // 连击点按来源差异化生成
    let actual = amount;
    switch (source) {
      case 'attack':
        actual = Math.min(amount, 1); // 攻击命中获取 1 点
        break;
      case 'kill':
        actual = Math.min(amount, 2); // 击杀获取 2 点
        break;
      case 'skill':
        // 技能直接生成（如伏击技能生成 2 连击点）
        actual = Math.min(amount, 3);
        break;
      default:
        // 其他来源不生成连击点
        return;
    }
    this.applyGeneration(actual);
  }

  onAttack(): void {
    this.generate(1, 'attack');
  }

  onKill(): void {
    this.generate(2, 'kill');
  }

  /** 重置时清空连击点（切换目标时也应清空，由调用方按需触发） */
  reset(): void {
    this.valueRef.value = 0;
  }
}
