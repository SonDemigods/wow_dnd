/**
 * @fileoverview 龙脉术士精华资源系统
 * @description 精华是龙脉术士的辅助资源，通过回合和技能生成，消耗于强力龙族技能。
 *              设计要点：
 *              - 战斗开始时 1 精华
 *              - 每回合开始获取 1 精华
 *              - 技能直接生成（如碧蓝打击生成 1 点，上限 2）
 *              - 上限 5 精华
 *              精华消耗于喷吐、逆转等强力龙族技能。
 *              龙脉术士积蓄龙族精华，在关键时刻释放强力龙族能力。
 * @module combat/resources
 */
import { BaseResourceSystem } from './BaseResourceSystem';
import type { ResourceSource } from './types';

export class EssenceSystem extends BaseResourceSystem {
  readonly type = 'essence' as const;

  constructor(initialValue: number = 1) {
    super({ maxValue: 5, initialValue, isInteger: true });
  }

  generate(amount: number, source: ResourceSource): void {
    let actual = amount;
    switch (source) {
      case 'turn':
        actual = Math.min(amount, 1); // 每回合获取 1 精华
        break;
      case 'skill':
        actual = Math.min(amount, 2); // 技能直接生成（如碧蓝打击）
        break;
      default:
        // 攻击/受伤/击杀不生成精华
        return;
    }
    this.applyGeneration(actual);
  }

  onTurnStart(): void {
    this.generate(1, 'turn');
  }
}
