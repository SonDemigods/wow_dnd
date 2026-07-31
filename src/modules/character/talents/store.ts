/**
 * @fileoverview 天赋系统状态管理 Store（Phase 6.2）
 * @description 管理天赋点数分配状态，提供学习/重置天赋的 Action。
 *              天赋效果通过 service.calculateTalentEffects 计算并暴露为计算属性，
 *              供战斗系统和角色属性系统消费。
 * @module character/talents
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { TalentAllocation } from './types';
import { TALENT_POINT_RULES } from './types';
import {
  canLearnTalent,
  learnTalent,
  calculateTalentEffects,
  calculateSpentPoints,
  resetAllocations,
  getTalentStatBonuses,
  type TalentEffectSummary
} from './service';
import { getTalentTreesByClassId } from '@/data/config_class_talents';

/**
 * 天赋 Store
 *
 * ## 导出接口分类
 *
 * | 分类 | 成员 | 说明 |
 * |------|------|------|
 * | 响应式状态 | `allocations`, `currentClassId` | 天赋分配状态 |
 * | 计算属性 | `availablePoints`, `totalPoints`, `spentPoints`, `effectSummary`, `statBonuses`, `talentTrees` | 派生状态 |
 * | 生命周期 | `initialize`, `reset` | 角色进入/退出时调用 |
 * | 操作 | `learn`, `resetAllocations` | 天赋学习/重置 |
 * | 查询 | `canLearn`, `getTalentRank`, `getTreeSpentPoints` | 纯查询 |
 */
export const useTalentStore = defineStore('talent', () => {
  // ==================== 响应式状态 ====================

  /** 天赋分配状态：key 为天赋 ID，value 为当前等级 */
  const allocations = ref<TalentAllocation>({});

  /** 当前角色职业 ID */
  const currentClassId = ref<string>('');

  /** 角色等级缓存（用于计算总点数） */
  const currentLevel = ref<number>(1);

  // ==================== 计算属性 ====================

  /** 已使用的总点数 */
  const spentPoints = computed(() => calculateSpentPoints(allocations.value));

  /** 总天赋点数（基于等级计算） */
  // P3-110 修复：与 service.ts 中 calculateAvailablePoints / createInitialTalentState 保持一致，
  // 使用 TALENT_POINT_RULES.pointsPerLevel 替代硬编码 2，确保规则变更时双方同步
  const totalPoints = computed(() =>
    Math.floor(currentLevel.value / TALENT_POINT_RULES.pointsPerLevel)
  );

  /** 剩余可用点数 */
  const availablePoints = computed(() =>
    Math.max(0, totalPoints.value - spentPoints.value)
  );

  /** 当前职业的天赋树列表 */
  const talentTrees = computed(() => {
    if (!currentClassId.value) return [];
    return getTalentTreesByClassId(currentClassId.value);
  });

  /** 天赋效果聚合（供战斗系统消费） */
  const effectSummary = computed<TalentEffectSummary>(() => {
    if (!currentClassId.value) {
      return {
        statBonuses: {},
        damageMultiplier: 0,
        damageReduction: 0,
        critBonus: 0,
        resourceBonuses: {},
        healingMultiplier: 0,
        hpMultiplier: 0,
        specialEffects: [],
        skillEnhancements: []
      };
    }
    return calculateTalentEffects(currentClassId.value, allocations.value);
  });

  /** 天赋提供的基础属性加成（可直接应用给角色） */
  const statBonuses = computed(() => {
    if (!currentClassId.value) return {};
    return getTalentStatBonuses(currentClassId.value, allocations.value);
  });

  // ==================== 生命周期 ====================

  /**
   * 初始化天赋系统（进入角色时调用）
   *
   * @param classId - 角色 职业 ID
   * @param level - 角色 等级
   * @param savedAllocations - 可选，从存档恢复的天赋分配
   */
  function initialize(classId: string, level: number, savedAllocations?: TalentAllocation): void {
    currentClassId.value = classId;
    currentLevel.value = level;
    allocations.value = savedAllocations ? { ...savedAllocations } : {};
  }

  /**
   * 重置天赋系统状态（退出角色时调用）
   */
  function reset(): void {
    allocations.value = {};
    currentClassId.value = '';
    currentLevel.value = 1;
  }

  /**
   * 更新角色等级（升级时调用，重新计算可用点数）
   *
   * @param level - 新等级
   */
  function updateLevel(level: number): void {
    currentLevel.value = level;
  }

  // ==================== Action：学习天赋 ====================

  /**
   * 学习一级天赋
   *
   * 完整流程：
   * 1. 调用 canLearnTalent 校验可学习性
   * 2. 通过 learnTalent 纯函数更新分配状态
   * 3. 返回操作结果
   *
   * 注意：此方法不直接持久化到 DB，由调用方（如角色 Store）统一持久化。
   *
   * @param talentId - 要学习的天赋 ID
   * @returns 是否学习成功
   */
  function learn(talentId: string): boolean {
    if (!currentClassId.value) return false;

    const result = canLearnTalent(
      talentId,
      currentClassId.value,
      allocations.value,
      availablePoints.value
    );

    if (!result.canLearn) {
      return false;
    }

    allocations.value = learnTalent(allocations.value, talentId);
    return true;
  }

  /**
   * 重置所有天赋分配
   *
   * 清空所有已学习天赋，返还所有点数。
   * 注意：实际游戏中可能需要消耗道具或金币，此处仅实现纯逻辑。
   */
  function resetAllAllocations(): void {
    allocations.value = resetAllocations();
  }

  // ==================== 查询方法 ====================

  /**
   * 检查天赋是否可以学习
   *
   * @param talentId - 天赋 ID
   * @returns 是否可学习
   */
  function canLearn(talentId: string): boolean {
    if (!currentClassId.value) return false;
    return canLearnTalent(
      talentId,
      currentClassId.value,
      allocations.value,
      availablePoints.value
    ).canLearn;
  }

  /**
   * 获取指定天赋的当前等级
   *
   * @param talentId - 天赋 ID
   * @returns 当前等级（0 表示未学习）
   */
  function getTalentRank(talentId: string): number {
    return allocations.value[talentId] || 0;
  }

  /**
   * 获取指定天赋树已投入的点数
   *
   * @param treeId - 天赋树 ID
   * @returns 已投入点数
   */
  function getTreeSpentPoints(treeId: string): number {
    const tree = talentTrees.value.find(t => t.id === treeId);
    if (!tree) return 0;
    return tree.talents.reduce(
      (sum, talent) => sum + (allocations.value[talent.id] || 0),
      0
    );
  }

  return {
    // 响应式状态
    allocations,
    currentClassId,
    currentLevel,

    // 计算属性
    spentPoints,
    totalPoints,
    availablePoints,
    talentTrees,
    effectSummary,
    statBonuses,

    // 生命周期
    initialize,
    reset,
    updateLevel,

    // 操作
    learn,
    resetAllAllocations,

    // 查询
    canLearn,
    getTalentRank,
    getTreeSpentPoints
  };
});
