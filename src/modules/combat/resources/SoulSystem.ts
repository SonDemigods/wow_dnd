/**
 * @fileoverview 影刃猎手灵魂资源系统
 * @description 灵魂是影刃猎手的辅助资源，通过攻击、击杀和技能积累，终结技消耗。
 *              设计要点：
 *              - 战斗开始时 0 灵魂
 *              - 攻击命中获取 1 灵魂
 *              - 击杀敌人获取 2 灵魂
 *              - 技能直接生成（如灵魂裂劈生成 1 点，上限 2）
 *              - 上限 5 灵魂
 *              灵魂消耗于眼棱、刃舞等终结技。
 *              影刃猎手在战斗中撕裂敌人灵魂，积蓄后释放毁灭性的恶魔能力。
 * @module combat/resources
 */
import { BaseResourceSystem } from './BaseResourceSystem';
import type { ResourceSource } from './types';

export class SoulSystem extends BaseResourceSystem {
  readonly type = 'soul' as const;

  constructor(initialValue: number = 0) {
    super({ maxValue: 5, initialValue, isInteger: true });
  }

  generate(amount: number, source: ResourceSource): void {
    let actual = amount;
    switch (source) {
      case 'attack':
        actual = Math.min(amount, 1); // 攻击命中获取 1 灵魂
        break;
      case 'kill':
        actual = Math.min(amount, 2); // 击杀获取 2 灵魂
        break;
      case 'skill':
        actual = Math.min(amount, 2); // 技能直接生成（如灵魂裂劈）
        break;
      default:
        // 回合/受伤不生成灵魂
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
}
