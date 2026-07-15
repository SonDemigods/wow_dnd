/**
 * @fileoverview 战斗资源系统类型定义
 * @description 定义各职业专属资源的抽象接口。
 *              不同职业使用不同的资源（怒气、能量、灵魂碎片、真气等），
 *              通过统一的接口契约，使战斗系统可以透明地处理各类资源。
 * @module combat/resources
 */
import type { Ref } from 'vue';

/**
 * 资源类型枚举
 *
 * 每种资源对应一类职业的战斗能量来源：
 * - `rage`：战士怒气（攻击/受伤获取，消耗于强力技能）
 * - `energy`：潜行者能量（每回合回复定量，用于瞬发技能）
 * - `combo_point`：潜行者连击点（通过技能积累，终结技消耗）
 * - `soul_shard`：术士灵魂碎片（施法获取，召唤/强化技能消耗）
 * - `chi`：武僧真气（通过特定技能生成，消耗于终结技）
 * - `focus`：猎人集中值（攻击/回合回复获取，消耗于射击技能）
 * - `holy_power`：圣骑士神圣（攻击/受伤/技能积累，终结技消耗）
 * - `runic_power`：亡灵骑士符能（攻击/受伤/回合/击杀积累，替代 MP）
 * - `rune`：亡灵骑士符文（每回合恢复，核心技能消耗）
 * - `fury`：影刃猎手怒火（攻击/受伤/回合/击杀积累，替代 MP）
 * - `soul`：影刃猎手灵魂（攻击/击杀/技能积累，终结技消耗）
 * - `essence`：龙脉术士精华（回合/技能生成，强力龙族技能消耗）
 * - `mana`：法师/牧师等施法职业的法力（默认回退资源）
 */
export type ResourceType =
  | 'rage'
  | 'energy'
  | 'combo_point'
  | 'soul_shard'
  | 'chi'
  | 'focus'
  | 'holy_power'
  | 'runic_power'
  | 'rune'
  | 'fury'
  | 'soul'
  | 'essence'
  | 'mana';

/**
 * 资源获取来源
 *
 * 用于资源系统在 `generate` 方法中按来源差异化处理获取量上限。
 * - `attack`：主动攻击命中时获取
 * - `damaged`：受到伤害时获取
 * - `turn`：回合开始/结束被动获取
 * - `skill`：施放特定技能获取
 * - `kill`：击杀敌人时获取
 */
export type ResourceSource = 'attack' | 'damaged' | 'turn' | 'skill' | 'kill';

/**
 * 资源系统抽象接口
 *
 * 所有职业资源系统均需实现此接口，确保战斗 Store 可以统一管理资源生成与消耗。
 *
 * 实现类负责：
 * 1. 维护当前资源值（响应式，供 UI 绑定）
 * 2. 在战斗事件钩子中按职业规则生成资源
 * 3. 提供资源消耗检查与扣减能力
 */
export interface ResourceSystem {
  /** 资源类型标识 */
  readonly type: ResourceType;
  /** 当前资源值 */
  readonly currentValue: number;
  /** 资源上限 */
  readonly maxValue: number;
  /** 是否为整数型资源（如连击点/灵魂碎片通常为整数） */
  readonly isInteger: boolean;

  /**
   * 生成资源
   * @param amount - 期望生成量（实现类可按 source 调整实际获取量）
   * @param source - 资源来源（攻击/受伤/回合/技能/击杀）
   */
  generate(amount: number, source: ResourceSource): void;

  /**
   * 消耗资源
   * @param amount - 消耗量
   * @returns 是否消耗成功（资源不足时返回 false 且不改变当前值）
   */
  consume(amount: number): boolean;

  /**
   * 检查资源是否足够
   * @param amount - 需要的资源量
   */
  hasEnough(amount: number): boolean;

  /** 重置资源（战斗开始/结束时调用） */
  reset(): void;

  // ===== 战斗事件钩子（可选实现） =====

  /** 回合开始时触发 */
  onTurnStart?(): void;
  /** 回合结束时触发 */
  onTurnEnd?(): void;
  /** 主动攻击命中时触发 */
  onAttack?(): void;
  /** 受到伤害时触发 */
  onDamaged?(amount: number): void;
  /** 击杀敌人时触发 */
  onKill?(): void;

  /**
   * 暴露响应式引用，供 UI 组件绑定资源条
   * @internal 仅供 UI 读取，不应直接修改
   */
  readonly valueRef: Ref<number>;
  /** 资源上限的响应式引用 */
  readonly maxValueRef: Readonly<Ref<number>>;
}

/**
 * 资源系统工厂映射表类型
 *
 * key 为职业 ID，value 为该职业对应的资源系统类型（或类型数组，用于多资源职业如潜行者）。
 */
export type ResourceSystemFactoryMap = Record<string, ResourceType | ResourceType[]>;
