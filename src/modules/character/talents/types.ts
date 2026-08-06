/**
 * @fileoverview 天赋树系统类型定义（Phase 6.2）
 * @description 定义天赋节点、天赋树、天赋效果等核心数据结构。
 *              每个职业拥有 3 系天赋树，玩家通过分配天赋点数激活天赋效果。
 * @module character/talents
 */
import type { ClassType } from '../../character/types';
import type { Stats } from '../../character/types';
import type { ResourceType } from '@/modules/combat/resources/types';
import type { PetType } from '@/modules/combat/pets/types';

// ============================================================================
// 天赋效果类型
// ============================================================================

/**
 * 资源上限字段联合类型
 *
 * P3-139 修复：将 resource_bonus 的 stat 字段收窄为精确联合类型，
 * 避免拼写错误导致天赋效果静默失效。
 * 形式为 `${ResourceType}_max`，对应 resourceBonuses 的 key。
 */
export type ResourceStatKey = `${ResourceType}_max`;

/**
 * 天赋效果类型枚举
 *
 * - `stat_bonus`：属性加成（力量/敏捷/智力等基础属性，stat 限定为 keyof Stats）
 * - `damage_multiplier`：伤害倍率（物理/魔法伤害百分比提升）
 * - `damage_reduction`：伤害减免（受到伤害百分比降低）
 * - `crit_bonus`：暴击加成（暴击率/暴击伤害提升）
 * - `resource_bonus`：资源加成（怒气/能量上限提升等，stat 限定为 ResourceStatKey）
 * - `skill_enhance`：技能增强（特定技能效果提升）
 * - `healing_multiplier`：治疗倍率（治疗效果百分比提升，P2-75 新增，替代 special 的"治疗效果提升"语义）
 * - `hp_multiplier`：生命上限倍率（每级提升 X% 生命上限，P3-139 新增，修复原 stat_bonus+hp_max 配置 bug）
 * - `unlock_pet`：解锁宠物（P3-156 新增，学习该天赋后解锁指定宠物，由天赋系统在加点时调用 petStore.unlockPet）
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
  | 'hp_multiplier'
  | 'unlock_pet'
  | 'special';

/**
 * 基础属性加成效果（stat_bonus）
 *
 * stat 字段限定为 keyof Stats（str/dex/con/int/wis/cha），
 * 编译期拦截 'hp_max' / 'armor' 等非法属性键。
 */
export interface StatBonusEffect {
  type: 'stat_bonus';
  /** 受影响的属性键，必须为 Stats 的合法 key */
  stat: keyof Stats;
  /** 每级天赋提供的属性值（绝对数值，如 str +3） */
  valuePerRank: number;
}

/**
 * 资源上限加成效果（resource_bonus）
 *
 * stat 字段限定为 ResourceStatKey（如 'rage_max' / 'mana_max'），
 * 对应 resourceBonuses 的 key。
 */
export interface ResourceBonusEffect {
  type: 'resource_bonus';
  /** 受影响的资源上限键，形如 `${ResourceType}_max` */
  stat: ResourceStatKey;
  /** 每级天赋提供的资源上限值（整数如 +10 怒气，或小数如 +0.10 法力倍率） */
  valuePerRank: number;
}

/**
 * 技能增强效果（skill_enhance）
 */
export interface SkillEnhanceEffect {
  type: 'skill_enhance';
  /** 目标技能 ID */
  targetSkill: string;
  /** 每级天赋提供的增强值（通常为百分比小数） */
  valuePerRank: number;
}

/**
 * 特殊效果（special）
 *
 * 需自定义处理逻辑，目前无消费方，仅为兼容保留。
 */
export interface SpecialEffect {
  type: 'special';
  /** 每级天赋提供的数值，含义视 description 而定 */
  valuePerRank: number;
  /** 效果描述（可选，缺省时 service 使用 '特殊效果' 兜底） */
  description?: string;
}

/**
 * 解锁宠物效果（unlock_pet，P3-156 新增）
 *
 * 学习该天赋后解锁指定宠物。此效果为"一次性解锁"语义，不参与数值累加，
 * 由天赋系统在 learnTalent 时读取天赋定义并调用 petStore.unlockPet(petType)。
 *
 * 典型用途：猎人"野兽掌握"天赋树 T4-T6 节点，解锁猎豹/野猪/魔暴龙。
 *
 * @property {PetType} petType - 要解锁的宠物类型 ID（如 'cat' / 'boar' / 'devilsaur'）
 */
export interface UnlockPetEffect {
  type: 'unlock_pet';
  /** 要解锁的宠物类型 ID（HunterPetType 或 WarlockPetType） */
  petType: PetType;
}

/**
 * 无 stat 字段的数值累加效果
 *
 * 涵盖 damage_multiplier / damage_reduction / crit_bonus / healing_multiplier / hp_multiplier，
 * 这些类型仅需 valuePerRank 字段进行累加。
 */
export interface SimpleMultiplierEffect {
  type: 'damage_multiplier' | 'damage_reduction' | 'crit_bonus' | 'healing_multiplier' | 'hp_multiplier';
  /** 每级天赋提供的数值（百分比小数，如 0.05 = 5%） */
  valuePerRank: number;
  /** 效果描述（可选，仅用于配置文档化） */
  description?: string;
}

/**
 * 天赋效果可辨识联合类型
 *
 * P3-139 修复：将原 `stat?: keyof Stats | string` 宽松类型拆分为可辨识联合，
 * 让 stat_bonus 的 stat 字段编译期保证为 keyof Stats，
 * resource_bonus 的 stat 字段编译期保证为 ResourceStatKey，
 * 消除 'hp_max' 等非法键导致的静默失效 bug。
 */
export type TalentEffect =
  | StatBonusEffect
  | ResourceBonusEffect
  | SkillEnhanceEffect
  | SpecialEffect
  | UnlockPetEffect
  | SimpleMultiplierEffect;

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
 * @property {number} tier - 天赋层级（1-6，需逐层解锁；T4-T6 为 P3-156 扩展，用于宠物解锁等特殊节点）
 * @property {number} maxRank - 最大等级（通常为 3-5，解锁型节点为 1）
 * @property {string[]} [requires] - 前置天赋 ID 列表（需全部学习到指定等级才可学习）
 * @property {TalentEffect[]} effects - 天赋效果列表
 */
export interface Talent {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  col?: 1 | 2 | 3;
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
 *
 * P3-156 扩展：新增 tier4/5/6 解锁阈值，用于猎人"野兽掌握"天赋树的宠物解锁节点。
 * 阈值递增设计：T1-T3 满级（9 点）解锁 T4，之后每投入 1 点解锁下一层，
 * 确保玩家在 level 18（9 点天赋）解锁猎豹，level 20 解锁野猪，level 22 解锁魔暴龙。
 */
export const TALENT_POINT_RULES = {
  /** 天赋点数起始等级：10 级起 */
  pointsStartLevel: 10,
  /** 起始等级后每级获得的天赋点数 */
  pointsPerLevelFrom: 2,
  /** 行解锁：全树累计投入点数阈值（索引 = tier-1） */
  rowUnlockRequirements: [0, 3, 6, 9, 12, 15] as const,
  /** 单个天赋最大可分配点数（上限保护） */
  maxPointsPerTalent: 2,
} as const;

/**
 * 计算角色在指定等级时应拥有的总天赋点数
 *
 * 10 级起每级 2 点，20 级满级共 22 点。
 * @param level - 角色等级
 * @returns 总天赋点数
 */
export function calculateTotalTalentPoints(level: number): number {
  if (level < TALENT_POINT_RULES.pointsStartLevel) return 0;
  return (level - TALENT_POINT_RULES.pointsStartLevel + 1) * TALENT_POINT_RULES.pointsPerLevelFrom;
}
