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
import { HolyPowerSystem } from './HolyPowerSystem';
import { RunicPowerSystem } from './RunicPowerSystem';
import { RuneSystem } from './RuneSystem';
import { FurySystem } from './FurySystem';
import { SoulSystem } from './SoulSystem';
import { EssenceSystem } from './EssenceSystem';

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
  /** 完全替代 MP 的资源类型（战士怒气/盗贼能量/猎人集中/亡灵骑士符能/影刃猎手怒火），存在时 UI 应隐藏 MP 条 */
  private static readonly MANA_REPLACING_TYPES = new Set<ResourceType>([
    'rage', 'energy', 'focus', 'runic_power', 'fury',
  ]);

  /**
   * 根据职业 ID 创建资源系统
   * @param classId - 职业 ID
   * @returns 资源系统数组（空数组表示该职业使用默认 MP 系统）
   */
  /** P8-009 修复：实例缓存，避免频繁调用时重复实例化 */
  private static _cache = new Map<string, ResourceSystem[]>();

  static create(classId: string): ResourceSystem[] {
    const cached = this._cache.get(classId);
    if (cached) return cached;
    const systems = this._doCreate(classId);
    this._cache.set(classId, systems);
    return systems;
  }

  /** 清除实例缓存（测试用） */
  static clearCache(): void {
    this._cache.clear();
  }

  private static _doCreate(classId: string): ResourceSystem[] {
    switch (classId) {
      case 'warrior':
        // 战士：怒气系统
        return [new RageSystem(0)];

      case 'rogue':
        // 潜行者：能量 + 连击点双资源
        return [new EnergySystem(100), new ComboPointSystem(0)];

      case 'warlock':
        // 术士：灵魂碎片（辅助，主资源为 MP）
        return [new SoulShardSystem(0)];

      case 'monk':
        // 武僧：能量 + 真气双资源（能量替代 MP）
        return [new EnergySystem(100), new ChiSystem(0)];

      case 'hunter':
        // 猎人：集中值
        return [new FocusSystem(100)];

      case 'paladin':
        // 圣骑士：神圣（辅助资源）+ MP（主资源，生成器技能积攒 holy_power）
        return [new HolyPowerSystem(0)];

      case 'death_knight':
        // 亡灵骑士：符能（主资源，替代 MP）+ 符文（辅助）
        return [new RunicPowerSystem(0), new RuneSystem(6)];

      case 'demon_hunter':
        // 影刃猎手：怒火（主资源，替代 MP）+ 灵魂（辅助）
        return [new FurySystem(0), new SoulSystem(0)];

      case 'evoker':
        // 龙脉术士：精华（辅助资源）+ MP（主资源，生成器技能积攒 essence）
        return [new EssenceSystem(0)];

      default:
        // 以下职业使用默认 MP 系统（由战斗 Store 处理）：
        // - mage（法师）、priest（牧师）、shaman（萨满）、druid（德鲁伊）
        return [];
    }
  }

  /**
   * 判断该职业是否使用替代 MP 的专属资源系统
   *
   * 用于非战斗 UI（主界面、角色面板等）决定是否隐藏 MP 资源条。
   * - 战士(怒气)/潜行者(能量)/猎人(集中)/武僧(能量)/亡灵骑士(符能)/影刃猎手(怒火) → true，隐藏 MP 条
   * - 圣骑士(神圣)/术士(碎片)/龙脉术士(精华) → false，保留 MP 条（双资源设计：MP 用于治疗/应急，专属资源用于核心输出）
   * - 法师/牧师/萨满/德鲁伊 → false，使用 MP 系统
   *
   * @param classId - 职业 ID
   * @returns true 表示该职业完全替代 MP，应隐藏 MP 资源条
   */
  static replacesMana(classId: string): boolean {
    return this.create(classId).some(sys => this.MANA_REPLACING_TYPES.has(sys.type));
  }

  /**
   * 获取该职业的替代型资源系统实例（仅主资源替代 MP 的系统）
   *
   * 用于非战斗 UI（主界面、角色面板）显示职业专属资源条。
   * 返回的实例携带初始值（战士怒气 0、潜行者能量 100、猎人集中值 100 等），仅供展示。
   *
   * @param classId - 职业 ID
   * @returns 替代型资源系统数组（空数组表示该职业使用 MP）
   */
  static getManaReplacingSystems(classId: string): ResourceSystem[] {
    return this.create(classId).filter(sys => this.MANA_REPLACING_TYPES.has(sys.type));
  }
}
