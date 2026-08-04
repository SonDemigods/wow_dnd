/**
 * @fileoverview 天赋系统纯函数服务层（Phase 6.2）
 * @description 提供天赋点数分配校验、效果计算等纯函数。
 *              不持有状态、不调用 DB、不发射事件，可独立进行单元测试。
 * @module character/talents
 */
import type { Talent, TalentTree, TalentAllocation, TalentEffect } from './types';
import { TALENT_POINT_RULES } from './types';
import { getTalentById, getTalentTreesByClassId } from '@/data/config_class_talents';
import type { Stats } from '../types';

// ============================================================
// 天赋可学习性校验
// ============================================================

/**
 * 检查天赋是否满足前置条件
 *
 * 前置条件：requires 列表中的所有天赋必须已学习（等级 > 0）。
 *
 * @param talent - 目标天赋
 * @param allocations - 当前天赋分配状态
 * @returns 是否满足前置条件
 */
export function meetsRequirements(talent: Talent, allocations: TalentAllocation): boolean {
  if (!talent.requires || talent.requires.length === 0) {
    return true;
  }
  return talent.requires.every(reqId => (allocations[reqId] || 0) > 0);
}

/**
 * 计算指定天赋树中已投入的点数总和
 *
 * @param tree - 天赋树
 * @param allocations - 当前天赋分配状态
 * @returns 该天赋树已投入的总点数
 */
export function getTreeSpentPoints(tree: TalentTree, allocations: TalentAllocation): number {
  return tree.talents.reduce((sum, talent) => sum + (allocations[talent.id] || 0), 0);
}

/**
 * 检查天赋层级是否已解锁
 *
 * 解锁规则：
 * - tier 1：始终解锁
 * - tier 2：该天赋树已投入 >= tier2Requirement（默认 3）点
 * - tier 3：该天赋树已投入 >= tier3Requirement（默认 6）点
 * - tier 4：该天赋树已投入 >= tier4Requirement（默认 9）点（P3-156 新增）
 * - tier 5：该天赋树已投入 >= tier5Requirement（默认 10）点（P3-156 新增）
 * - tier 6：该天赋树已投入 >= tier6Requirement（默认 11）点（P3-156 新增）
 *
 * @param talent - 目标天赋
 * @param tree - 所属天赋树
 * @param allocations - 当前天赋分配状态
 * @returns 层级是否已解锁
 */
export function isTierUnlocked(
  talent: Talent,
  tree: TalentTree,
  allocations: TalentAllocation
): boolean {
  if (talent.tier === 1) return true;

  const spent = getTreeSpentPoints(tree, allocations);
  switch (talent.tier) {
    case 2:
      return spent >= TALENT_POINT_RULES.tier2Requirement;
    case 3:
      return spent >= TALENT_POINT_RULES.tier3Requirement;
    case 4:
      return spent >= TALENT_POINT_RULES.tier4Requirement;
    case 5:
      return spent >= TALENT_POINT_RULES.tier5Requirement;
    case 6:
      return spent >= TALENT_POINT_RULES.tier6Requirement;
    default:
      return false;
  }
}

/**
 * 综合检查天赋是否可以学习
 *
 * 校验项：
 * 1. 前置天赋是否已学习
 * 2. 层级是否已解锁
 * 3. 是否还有可用点数
 * 4. 当前等级是否已达 maxRank
 *
 * @param talentId - 目标天赋 ID
 * @param classId - 角色 职业 ID
 * @param allocations - 当前天赋分配状态
 * @param availablePoints - 剩余可用点数
 * @returns 校验结果对象
 */
export function canLearnTalent(
  talentId: string,
  classId: string,
  allocations: TalentAllocation,
  availablePoints: number
): { canLearn: boolean; reason: string } {
  // 1. 查找天赋定义
  const found = getTalentById(talentId);
  if (!found) {
    return { canLearn: false, reason: '天赋不存在' };
  }

  const { talent, tree } = found;

  // 2. 检查职业匹配
  if (tree.classId !== classId) {
    return { canLearn: false, reason: '该天赋不属于当前职业' };
  }

  // 3. 检查可用点数
  if (availablePoints <= 0) {
    return { canLearn: false, reason: '没有可用的天赋点数' };
  }

  // 4. 检查是否已达 maxRank
  const currentRank = allocations[talentId] || 0;
  if (currentRank >= talent.maxRank) {
    return { canLearn: false, reason: '该天赋已达最大等级' };
  }

  // 5. 检查前置条件
  if (!meetsRequirements(talent, allocations)) {
    return { canLearn: false, reason: '前置天赋未学习' };
  }

  // 6. 检查层级解锁
  if (!isTierUnlocked(talent, tree, allocations)) {
    return { canLearn: false, reason: `需要该系投入更多点数解锁第 ${talent.tier} 层` };
  }

  return { canLearn: true, reason: '' };
}

// ============================================================
// 天赋效果计算
// ============================================================

/**
 * 天赋效果聚合结果
 *
 * 按效果类型分组累加，便于战斗系统查询。
 */
export interface TalentEffectSummary {
  /** 属性加成（stat_bonus），key 为属性键，value 为总加成值 */
  statBonuses: Record<string, number>;
  /** 伤害倍率总和（damage_multiplier） */
  damageMultiplier: number;
  /** 伤害减免总和（damage_reduction） */
  damageReduction: number;
  /** 暴击率加成总和（crit_bonus） */
  critBonus: number;
  /** 资源加成（resource_bonus），key 为资源键，value 为总加成值 */
  resourceBonuses: Record<string, number>;
  /** 治疗倍率总和（healing_multiplier，P2-75 新增），如 0.24 表示治疗量提升 24% */
  healingMultiplier: number;
  /** 生命上限倍率总和（hp_multiplier，P3-139 新增），如 0.15 表示生命上限提升 15% */
  hpMultiplier: number;
  /** 特殊效果列表（special） */
  specialEffects: Array<{ description: string; value: number }>;
  /** 技能增强列表（skill_enhance） */
  skillEnhancements: Array<{ skillId: string; value: number }>;
  /** 已解锁宠物列表（unlock_pet，P3-156 新增），记录所有通过天赋解锁的宠物类型 ID */
  unlockedPets: string[];
}

/**
 * 创建空的天赋效果聚合对象
 */
export function createEmptyEffectSummary(): TalentEffectSummary {
  return {
    statBonuses: {},
    damageMultiplier: 0,
    damageReduction: 0,
    critBonus: 0,
    resourceBonuses: {},
    healingMultiplier: 0,
    hpMultiplier: 0,
    specialEffects: [],
    skillEnhancements: [],
    unlockedPets: []
  };
}

/**
 * 累加单个天赋效果到聚合结果
 *
 * P3-139 修复：基于可辨识联合类型，TS 自动收窄每个 case 的 effect 形状，
 * 不再需要 `if (effect.stat)` 守卫，stat 字段在对应分支中保证存在。
 *
 * @param summary - 聚合结果对象（会被修改）
 * @param effect - 天赋效果
 * @param rank - 当前天赋等级
 */
function accumulateEffect(summary: TalentEffectSummary, effect: TalentEffect, rank: number): void {
  if (rank <= 0) return;

  // P3-156 新增：unlock_pet 是一次性解锁效果，不参与数值累加，
  // 仅将 petType 收集到 unlockedPets 列表供调用方读取。
  // 此处提前返回，避免后续访问 effect.valuePerRank（UnlockPetEffect 无该字段）
  if (effect.type === 'unlock_pet') {
    if (!summary.unlockedPets.includes(effect.petType)) {
      summary.unlockedPets.push(effect.petType);
    }
    return;
  }

  const totalValue = effect.valuePerRank * rank;

  switch (effect.type) {
    case 'stat_bonus': {
      // effect 已收窄为 StatBonusEffect，stat 字段保证为 keyof Stats
      const { stat } = effect;
      summary.statBonuses[stat] = (summary.statBonuses[stat] || 0) + totalValue;
      break;
    }
    case 'damage_multiplier':
      summary.damageMultiplier += totalValue;
      break;
    case 'damage_reduction':
      summary.damageReduction += totalValue;
      break;
    case 'crit_bonus':
      summary.critBonus += totalValue;
      break;
    case 'resource_bonus': {
      // effect 已收窄为 ResourceBonusEffect，stat 字段保证为 ResourceStatKey
      const { stat } = effect;
      summary.resourceBonuses[stat] = (summary.resourceBonuses[stat] || 0) + totalValue;
      break;
    }
    case 'healing_multiplier':
      // P2-75 修复：将"治疗效果提升"从 special 提升为一等公民类型，
      // 供 skill/store.ts 在治疗计算中读取并应用（原 special 类型无消费方，导致天赋失效）
      summary.healingMultiplier += totalValue;
      break;
    case 'hp_multiplier':
      // P3-139 修复：新增 hp_multiplier 类型，替代原 stat_bonus+hp_max 的错误配置，
      // 让"每级提升 X% 生命上限"的天赋效果能被正确聚合（原配置因 hp_max 非 keyof Stats 被静默丢弃）
      summary.hpMultiplier += totalValue;
      break;
    case 'special':
      summary.specialEffects.push({
        description: effect.description || '特殊效果',
        value: totalValue
      });
      break;
    case 'skill_enhance':
      // effect 已收窄为 SkillEnhanceEffect，targetSkill 字段保证为 string
      summary.skillEnhancements.push({
        skillId: effect.targetSkill,
        value: totalValue
      });
      break;
  }
}

/**
 * 计算指定天赋分配下的所有激活效果
 *
 * 遍历职业的所有天赋树，对已学习的天赋累加效果。
 *
 * @param classId - 角色 职业 ID
 * @param allocations - 当前天赋分配状态
 * @returns 效果聚合结果
 */
export function calculateTalentEffects(
  classId: string,
  allocations: TalentAllocation
): TalentEffectSummary {
  const summary = createEmptyEffectSummary();
  const trees = getTalentTreesByClassId(classId);

  for (const tree of trees) {
    for (const talent of tree.talents) {
      const rank = allocations[talent.id] || 0;
      if (rank <= 0) continue;

      for (const effect of talent.effects) {
        accumulateEffect(summary, effect, rank);
      }
    }
  }

  return summary;
}

/**
 * 计算天赋提供的属性加成（仅 stat_bonus 类型）
 *
 * 返回 Partial<Stats>，可直接传给 characterStore.applyBonus。
 *
 * @param classId - 角色 职业 ID
 * @param allocations - 当前天赋分配状态
 * @returns 属性加成对象
 */
export function getTalentStatBonuses(
  classId: string,
  allocations: TalentAllocation
): Partial<Stats> {
  const summary = calculateTalentEffects(classId, allocations);
  const stats: Partial<Stats> = {};

  // 仅映射基础属性（str/dex/con/int/wis/cha）
  const validStatKeys: Array<keyof Stats> = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  for (const key of validStatKeys) {
    if (summary.statBonuses[key] !== undefined) {
      stats[key] = summary.statBonuses[key];
    }
  }

  return stats;
}

// ============================================================
// 天赋状态管理辅助
// ============================================================

/**
 * 计算当前已使用的总点数
 *
 * @param allocations - 当前天赋分配状态
 * @returns 已使用的总点数
 */
export function calculateSpentPoints(allocations: TalentAllocation): number {
  return Object.values(allocations).reduce((sum, rank) => sum + rank, 0);
}

/**
 * 计算剩余可用点数
 *
 * @param level - 角色等级
 * @param allocations - 当前天赋分配状态
 * @returns 剩余可用点数
 */
export function calculateAvailablePoints(level: number, allocations: TalentAllocation): number {
  const total = Math.floor(level / TALENT_POINT_RULES.pointsPerLevel);
  const spent = calculateSpentPoints(allocations);
  return Math.max(0, total - spent);
}

/**
 * 学习天赋（纯函数，返回新的分配状态）
 *
 * 注意：此函数不检查可学习性，调用方应先调用 canLearnTalent。
 *
 * @param allocations - 当前天赋分配状态
 * @param talentId - 要学习的天赋 ID
 * @returns 新的天赋分配状态
 */
export function learnTalent(
  allocations: TalentAllocation,
  talentId: string
): TalentAllocation {
  return {
    ...allocations,
    [talentId]: (allocations[talentId] || 0) + 1
  };
}

/**
 * 重置天赋分配（清空所有点数）
 *
 * @returns 空的天赋分配状态
 */
export function resetAllocations(): TalentAllocation {
  return {};
}

/**
 * 初始化角色的天赋状态
 *
 * @param level - 角色等级
 * @returns 初始天赋状态
 */
export function createInitialTalentState(level: number): {
  allocations: TalentAllocation;
  totalPoints: number;
  availablePoints: number;
} {
  const total = Math.floor(level / TALENT_POINT_RULES.pointsPerLevel);
  return {
    allocations: {},
    totalPoints: total,
    availablePoints: total
  };
}
