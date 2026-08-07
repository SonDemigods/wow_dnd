/**
 * @fileoverview 影刃猎手灵魂资源系统
 * @description 灵魂是影刃猎手的辅助资源，通过 fury 生成器技能积累，大招消耗。
 *              设计要点：
 *              - 战斗开始时 0 灵魂
 *              - fury 生成器技能直接生成（配置 generatesResource）
 *              - 上限 3 灵魂
 *              灵魂消耗于眼棱、恶魔变形等爆发技能。
 *              影刃猎手在战斗中撕裂敌人灵魂，积蓄后释放毁灭性的恶魔能力。
 * @module combat/resources
 */
import { BaseResourceSystem } from './BaseResourceSystem';
import type { ResourceSource } from './types';

export class SoulSystem extends BaseResourceSystem {
  readonly type = 'soul' as const;

  constructor(initialValue: number = 0) {
    super({ maxValue: 3, initialValue, isInteger: true, isSecondary: true });
  }

  generate(amount: number, source: ResourceSource): void {
    if (source !== 'skill') {
      // 灵魂仅通过 fury 生成器技能积攒（generatesResource 触发）
      return;
    }
    this.applyGeneration(Math.min(amount, 3));
  }
}
