/**
 * @fileoverview 潜行者/武僧能量资源系统
 * @description 能量是瞬发资源，每回合回复定量，用于快速施放技能。
 *              设计要点：
 *              - 战斗开始时满能量（100/100）
 *              - 每回合开始回复 20 点
 *              - 能量上限 100，整数型资源
 *              能量与连击点（ComboPointSystem）/真气（ChiSystem）配合使用：
 *              生成器技能消耗能量并积攒副资源，终结技消耗副资源。
 * @module combat/resources
 */
import { BaseResourceSystem } from './BaseResourceSystem';
import type { ResourceSource } from './types';

/** 每回合被动回复的能量值 */
const ENERGY_REGEN_PER_TURN = 20;

export class EnergySystem extends BaseResourceSystem {
  readonly type = 'energy' as const;

  constructor(initialValue: number = 100) {
    super({ maxValue: 100, initialValue, isInteger: true });
  }

  generate(amount: number, _source: ResourceSource): void {
    // 能量无获取上限差异，直接累加
    this.applyGeneration(amount);
  }

  onTurnStart(): void {
    this.generate(ENERGY_REGEN_PER_TURN, 'turn');
  }
}
