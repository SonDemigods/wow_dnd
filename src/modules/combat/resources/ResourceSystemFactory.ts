/**
 * @fileoverview 资源系统工厂
 * @description 根据职业 ID 创建对应的资源系统实例。
 *              潜行者等双资源职业返回数组，其他职业返回单例。
 *              未实现专属资源系统的职业返回空数组，由战斗 Store 回退到 MP 系统。
 * @module combat/resources
 */
import type { ResourceSystem } from './types';
import { RageSystem } from './RageSystem';
import { EnergySystem } from './EnergySystem';
import { ComboPointSystem } from './ComboPointSystem';
import { SoulShardSystem } from './SoulShardSystem';
import { ChiSystem } from './ChiSystem';

/**
 * 资源系统工厂
 *
 * 使用方式：
 * ```typescript
 * const systems = ResourceSystemFactory.create('warrior');
 * // systems: ResourceSystem[]（战士为 [RageSystem]）
 * ```
 */
export class ResourceSystemFactory {
  /**
   * 根据职业 ID 创建资源系统
   * @param classId - 职业 ID
   * @returns 资源系统数组（空数组表示该职业使用默认 MP 系统）
   */
  static create(classId: string): ResourceSystem[] {
    switch (classId) {
      case 'warrior':
        // 战士：怒气系统
        return [new RageSystem(0)];

      case 'rogue':
        // 潜行者：能量 + 连击点双资源
        return [new EnergySystem(50), new ComboPointSystem(0)];

      case 'warlock':
        // 术士：灵魂碎片
        return [new SoulShardSystem(1)];

      case 'monk':
        // 武僧：真气
        return [new ChiSystem(1)];

      default:
        // BIZ-6：设计决策说明
        // 以下职业使用默认 MP 系统（由战斗 Store 处理）：
        // - mage（法师）、priest（牧师）、paladin（圣骑士）、shaman（萨满）、
        //   druid（德鲁伊）、hunter（猎人）、evoker（龙脉术士）
        //   → 这些职业在 WoW 中使用法力（MP），与当前实现一致。
        // - death_knight（亡灵骑士）：WoW 中使用符文系统，当前版本简化为 MP，后续版本可扩展 RuneSystem。
        // - demon_hunter（影刃猎手）：WoW 中使用怒气/魔能系统，当前版本简化为 MP，后续版本可扩展 FurySystem。
        return [];
    }
  }
}
