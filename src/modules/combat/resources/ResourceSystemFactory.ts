/**
 * @fileoverview 资源系统工厂
 * @description 根据职业 ID 创建对应的资源系统实例。
 *              潜行者等双资源职业返回数组，其他职业返回单例。
 *              未实现专属资源系统的职业返回空数组，由战斗 Store 回退到 MP 系统。
 * @module combat/resources
 */
import type { ResourceSystem, ResourceType } from './types';
import { RageSystem } from './RageSystem';
import { EnergySystem } from './EnergySystem';
import { ComboPointSystem } from './ComboPointSystem';
import { SoulShardSystem } from './SoulShardSystem';
import { ChiSystem } from './ChiSystem';
import { FocusSystem } from './FocusSystem';

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
  /** 完全替代 MP 的资源类型（战士怒气/盗贼能量/猎人集中值），存在时 UI 应隐藏 MP 条 */
  private static readonly MANA_REPLACING_TYPES = new Set<ResourceType>(['rage', 'energy', 'focus']);

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

      case 'hunter':
        // 猎人：集中值
        return [new FocusSystem(100)];

      default:
        // BIZ-6：设计决策说明
        // 以下职业使用默认 MP 系统（由战斗 Store 处理）：
        // - mage（法师）、priest（牧师）、paladin（圣骑士）、shaman（萨满）、
        //   druid（德鲁伊）、evoker（龙脉术士）
        //   → 这些职业在 WoW 中使用法力（MP），与当前实现一致。
        // - death_knight（亡灵骑士）：WoW 中使用符文系统，当前版本简化为 MP，后续版本可扩展 RuneSystem。
        // - demon_hunter（影刃猎手）：WoW 中使用怒气/魔能系统，当前版本简化为 MP，后续版本可扩展 FurySystem。
        return [];
    }
  }

  /**
   * 判断该职业是否使用替代 MP 的专属资源系统（rage/energy/focus）
   *
   * 用于非战斗 UI（主界面、角色面板等）决定是否隐藏 MP 资源条。
   * - 战士(怒气)/盗贼(能量)/猎人(集中值) → true，隐藏 MP 条
   * - 术士(灵魂碎片)/武僧(真气) → false，保留 MP 条（专属资源为辅助资源）
   * - 法师/牧师等 → false，使用 MP 系统
   *
   * @param classId - 职业 ID
   * @returns true 表示该职业完全替代 MP，应隐藏 MP 资源条
   */
  static replacesMana(classId: string): boolean {
    return this.create(classId).some(sys => this.MANA_REPLACING_TYPES.has(sys.type));
  }

  /**
   * 获取该职业的替代型资源系统实例（仅 rage/energy/focus）
   *
   * 用于非战斗 UI（主界面、角色面板）显示职业专属资源条。
   * 返回的实例携带初始值（战士怒气 0、盗贼能量 50、猎人集中值 100），仅供展示。
   *
   * @param classId - 职业 ID
   * @returns 替代型资源系统数组（空数组表示该职业使用 MP）
   */
  static getManaReplacingSystems(classId: string): ResourceSystem[] {
    return this.create(classId).filter(sys => this.MANA_REPLACING_TYPES.has(sys.type));
  }
}
