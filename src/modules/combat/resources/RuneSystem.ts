/**
 * @fileoverview 亡灵骑士符文资源系统
 * @description 符文是亡灵骑士的辅助资源，每回合缓慢恢复，核心技能消耗。
 *              设计要点：
 *              - 战斗开始时 6 符文（满）
 *              - 每回合开始恢复 1 符文
 *              - 击杀敌人恢复 1 符文
 *              - 上限 6 符文
 *              符文消耗于核心技能（如符文打击、暗影之拥）。
 *              消耗符文的技能会额外生成符能（主资源）。
 * @module combat/resources
 */
import { BaseResourceSystem } from './BaseResourceSystem';
import type { ResourceSource } from './types';

export class RuneSystem extends BaseResourceSystem {
  readonly type = 'rune' as const;

  constructor(initialValue: number = 6) {
    super({ maxValue: 6, initialValue, isInteger: true, isSecondary: true });
  }

  generate(amount: number, source: ResourceSource): void {
    let actual = amount;
    switch (source) {
      case 'turn':
        actual = Math.min(amount, 1); // 每回合恢复 1 符文
        break;
      case 'kill':
        actual = Math.min(amount, 1); // 击杀恢复 1 符文
        break;
      default:
        // 其他来源不恢复符文
        return;
    }
    this.applyGeneration(actual);
  }

  onTurnStart(): void {
    this.generate(1, 'turn');
  }

  onKill(): void {
    this.generate(1, 'kill');
  }
}
