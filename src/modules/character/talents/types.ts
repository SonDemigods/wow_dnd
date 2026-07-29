/**
 * @fileoverview 天赋树系统类型定义（Phase 6.2）
 * @description 定义天赋节点、天赋树、天赋效果等核心数据结构。
 *              每个职业拥有 3 系天赋树，玩家通过分配天赋点数激活天赋效果。
 * @module character/talents
 */
import type { ClassType } from '../../character/types';
import type { Stats } from '../../character/types';

// ============================================================================
// 天赋效果类型
// ============================================================================

/**
 * 天赋效果类型枚举
 *
 * - `stat_bonus`：属性加成（力量/敏捷/智力等）
 * - `damage_multiplier`：伤害倍率（物理/魔法伤害百分比提升）
 * - `damage_reduction`：伤害减免（受到伤害百分比降低）
 * - `crit_bonus`：暴击加成（暴击率/暴击伤害提升）
 * - `resource_bonus`：资源加成（怒气/能量上限提升等）
 * - `skill_enhance`：技能增强（特定技能效果提升）
 * - `healing_multiplier`：治疗倍率（治疗效果百分比提升，P2-75 新增，替代 special 的"治疗效果提升"语义）
 * - `special`：特殊效果（需自定义处理逻辑，目前无消费方，仅为兼容保留）
 */
export type TalentEffectType =
  | 'stat_bonus'
  | 'damage_multiplier'
  | 'damage_reduction'
  | 'crit_bonus'
  | 'resource_bonus'
  | 'skill_enhance'
  | 'healing_multiplier'
  | 'special';

/**
 * 天赋效果接口
 *
 * @property {TalentEffectType} type - 效果类型
 * @property {string} [stat] - 受影响的属性键（stat_bonus 时使用，如 'str'、'dex'）
 * @property {number} valuePerRank - 每级天赋提供的数值（可为整数或百分比小数）
 * @property {string} [targetSkill] - 目标技能 ID（skill_enhance 时使用）
 * @property {string} [description] - 效果描述
 */
export interface TalentEffect {
  type: TalentEffectType;
  stat?: keyof Stats | string;
  valuePerRank: number;
  targetSkill?: string;
  description?: string;
}

// ============================================================================
// 天赋节点类型
// ============================================================================

/**
 * 天赋节点接口
 *
 * 描述单个天赋的完整信息，包括前置条件、最大等级、效果等。
 *
 * @property {string} id - 天赋唯一标识（如 'warrior_arms_t1'）
 * @property {string} name - 天赋名称
 * @property {string} description - 天赋描述
 * @property {string} icon - 图标（Iconify 格式）
 * @property {number} tier - 天赋层级（1-3，需逐层解锁）
 * @property {number} maxRank - 最大等级（通常为 3-5）
 * @property {string[]} [requires] - 前置天赋 ID 列表（需全部学习到指定等级才可学习）
 * @property {TalentEffect[]} effects - 天赋效果列表
 */
export interface Talent {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 1 | 2 | 3;
  maxRank: number;
  requires?: string[];
  effects: TalentEffect[];
}

// ============================================================================
// 天赋树类型
// ============================================================================

/**
 * 天赋树接口
 *
 * 一个职业的一系天赋集合，按 tier 分层组织。
 *
 * @property {string} id - 天赋树 ID（如 'warrior_arms'）
 * @property {string} name - 天赋树名称（如 '武器'）
 * @property {string} classId - 所属职业 ID
 * @property {string} icon - 天赋树图标
 * @property {string} description - 天赋树描述
 * @property {Talent[]} talents - 天赋节点列表
 */
export interface TalentTree {
  id: string;
  name: string;
  classId: ClassType;
  icon: string;
  description: string;
  talents: Talent[];
}

// ============================================================================
// 天赋状态类型
// ============================================================================

/**
 * 天赋学习状态
 *
 * 记录玩家已学习天赋的等级分配情况。
 * key 为天赋 ID，value 为当前等级（0 表示未学习）。
 */
export type TalentAllocation = Record<string, number>;

/**
 * 天赋树系统状态接口
 *
 * @property {TalentAllocation} allocations - 天赋等级分配映射
 * @property {number} totalPoints - 已使用的总点数
 * @property {number} availablePoints - 剩余可用点数
 */
export interface TalentState {
  allocations: TalentAllocation;
  totalPoints: number;
  availablePoints: number;
}

// ============================================================================
// 天赋点数配置
// ============================================================================

/**
 * 天赋点数获取规则
 *
 * 角色每升 X 级获得 1 点天赋点数。
 */
export const TALENT_POINT_RULES = {
  /** 每 N 级获得 1 点天赋点 */
  pointsPerLevel: 2,
  /** 角色等级 1 时初始点数 */
  basePoints: 0,
  /** 单个天赋最大可分配点数（覆盖 Talent.maxRank） */
  maxPointsPerTalent: 5,
  /** 解锁第 2 层天赋所需该系投入点数 */
  tier2Requirement: 3,
  /** 解锁第 3 层天赋所需该系投入点数 */
  tier3Requirement: 6,
} as const;

/**
 * 计算角色在指定等级时应拥有的总天赋点数
 * @param level - 角色等级
 * @returns 总天赋点数
 */
export function calculateTotalTalentPoints(level: number): number {
  return TALENT_POINT_RULES.basePoints + Math.floor(level / TALENT_POINT_RULES.pointsPerLevel);
}
