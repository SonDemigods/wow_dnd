/**
 * @fileoverview 圣骑士神圣资源系统
 * @description 神圣是圣骑士的辅助资源，通过攻击、受伤和技能积累，消耗于终结技。
 *              设计要点：
 *              - 战斗开始时 0 神圣
 *              - 攻击命中获取 1 神圣
 *              - 受伤获取 1 神圣（上限 1）
 *              - 技能直接生成（如十字军打击生成 2 点，上限 3）
 *              - 上限 5 神圣
 *              神圣消耗于圣殿骑士的裁决、愤怒之锤等终结技。
 *              与潜行者连击类似，但来源更广（包含受伤触发）。
 * @module combat/resources
 */
import { BaseResourceSystem } from './BaseResourceSystem';
import type { ResourceSource } from './types';

export class HolyPowerSystem extends BaseResourceSystem {
  readonly type = 'holy_power' as const;

  constructor(initialValue: number = 0) {
    super({ maxValue: 5, initialValue, isInteger: true });
  }

  generate(amount: number, source: ResourceSource): void {
    let actual = amount;
    switch (source) {
      case 'attack':
        actual = Math.min(amount, 1); // 攻击命中获取 1 神圣
        break;
      case 'damaged':
        actual = Math.min(amount, 1); // 受伤获取 1 神圣
        break;
      case 'skill':
        actual = Math.min(amount, 3); // 技能直接生成（如十字军打击）
        break;
      default:
        // 回合/击杀不生成神圣
        return;
    }
    this.applyGeneration(actual);
  }

  onAttack(): void {
    this.generate(1, 'attack');
  }

  onDamaged(_amount: number): void {
    this.generate(1, 'damaged');
  }
}
