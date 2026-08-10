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
import { calculateTotalTalentPoints } from './types';
import {
  canLearnTalent,
  learnTalent,
  unlearnTalent,
  calculateTalentEffects,
  calculateSpentPoints,
  resetAllocations,
  getTalentStatBonuses,
  getColSpentPoints,
  isTierUnlocked,
  meetsRequirements,
  type TalentEffectSummary
} from './service';
import { configCache } from '@/modules/config';
import { useCharacterStore } from '@/modules/character/store';
import type { Stats } from '@/modules/character/types';

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
  // ==================== 回调注入（P3-172：消除 talents → combat/pets 循环依赖） ====================

  /**
   * 宠物解锁/锁定回调（由 GameBootstrap 注入）
   *
   * P3-172：talents → combat/pets 的反向依赖改为回调注入，
   * 参照 inventory↔quest 模式。GameBootstrap 在启动时设置回调，
   * talents store 不再直接 import usePetStore。
   */
  let onPetUnlock: ((petType: string) => void) | null = null;
  let onPetLock: ((petType: string) => void) | null = null;

  /**
   * 设置宠物回调（由 GameBootstrap 调用）
   */
  function setPetCallbacks(unlock: (petType: string) => void, lock: (petType: string) => void): void {
    onPetUnlock = unlock;
    onPetLock = lock;
  }

  /**
   * 清除宠物回调引用（由 GameBootstrap dispose 调用）
   *
   * P10-042 修复：角色切换/退出时清空回调，避免闭包残留指向旧 petStore 实例。
   * setPetCallbacks 常与 clearPetCallbacks 配对使用（initialize 设置 → dispose 清除）。
   */
  function clearPetCallbacks(): void {
    onPetUnlock = null;
    onPetLock = null;
  }

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
  // 使用 calculateTotalTalentPoints 与 service.ts/types.ts 保持一致（10 级起每级 2 点）
  const totalPoints = computed(() => calculateTotalTalentPoints(currentLevel.value));

  /** 剩余可用点数 */
  const availablePoints = computed(() =>
    Math.max(0, totalPoints.value - spentPoints.value)
  );

  /** 当前职业的天赋树列表 */
  const talentTrees = computed(() => {
    if (!currentClassId.value) return [];
    return configCache.getTalentTreesByClassId(currentClassId.value);
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
        // P9-083 修复：hpMultiplier 字段移除（死代码）
        specialEffects: [],
        skillEnhancements: [],
        unlockedPets: []
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
  async function initialize(classId: string, level: number, savedAllocations?: TalentAllocation): Promise<void> {
    // 确保天赋树缓存已从 DB 加载（供 talentTrees computed 同步查询）
    await configCache.loadTalentTrees();
    currentClassId.value = classId;
    currentLevel.value = level;
    // 过滤无效 key（旧存档中可能存在当前树不存在的天赋 ID）
    if (savedAllocations) {
      const validKeys = new Set<string>();
      const trees = configCache.getTalentTreesByClassId(classId);
      for (const tree of trees) {
        for (const talent of tree.talents) {
          validKeys.add(talent.id);
        }
      }
      const filtered: TalentAllocation = {};
      for (const [key, value] of Object.entries(savedAllocations)) {
        if (validKeys.has(key)) {
          filtered[key] = value;
        }
      }
      allocations.value = filtered;
    } else {
      allocations.value = {};
    }

    // P9-006 修复：角色加载时 bonusStats 已从 DB 恢复（含已持久化的天赋 stat_bonus），
    // 此处仅对齐 diff 基线，不调用 applyBonus/removeBonus，避免重复施加。
    // P9-007 修复：重置 lastAppliedStats 避免上一角色的基线残留影响 delta 计算。
    lastAppliedStats = {};
    lastAppliedStats = { ...statBonuses.value };
  }

  /**
   * 重置天赋系统状态（退出角色时调用）
   */
  function reset(): void {
    // 重置前移除已应用的 stat_bonus
    removeStatBonusesFromCharacter();
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

    // P3-156 M4-2：学习含 unlock_pet 效果的天赋时，即时调用 petStore.unlockPet
    applyUnlockPetEffects(talentId);

    // 应用 stat_bonus 变化到角色
    applyStatBonusesToCharacter();
    syncAllocationsToCharacter();

    return true;
  }

  /**
   * 检查并应用天赋的 unlock_pet 效果
   *
   * P3-156 M4-2 新增：学习含 unlock_pet 效果的天赋时，调用 petStore.unlockPet 解锁对应宠物。
   *
   * 设计说明：
   * - 此处的即时调用用于战斗中学习天赋的即时反馈
   * - 非战斗时 petStore 可能未初始化（owner 默认 'warlock'），unlockPet 仍会执行但
   *   添加的猎人宠物不会影响当前 owner 的可用列表
   * - 战斗开始时 petStore.initialize 会重置状态，combat/store.ts 会从
   *   effectSummary.unlockedPets 重新同步，确保状态一致
   *
   * @param talentId - 刚学习的天赋 ID
   */
  function applyUnlockPetEffects(talentId: string): void {
    const found = configCache.getTalentById(talentId);
    if (!found) return;

    for (const effect of found.talent.effects) {
      if (effect.type === 'unlock_pet') {
        // P3-172：通过回调注入替代直接 import usePetStore
        onPetUnlock?.(effect.petType);
      }
    }
  }

  // ==================== stat_bonus 属性接入 ====================

  /** 上次应用到角色的 stat_bonus 快照（用于计算 delta） */
  let lastAppliedStats: Partial<Stats> = {};

  /**
   * 将当前天赋 stat_bonus 应用到角色
   *
   * 计算 delta（当前 - 上次），正数部分 applyBonus，负数部分 removeBonus。
   * 跳过战斗状态（战斗中属性变更走 combat pipeline）。
   */
  function applyStatBonusesToCharacter(): void {
    const current = statBonuses.value;
    const delta: Partial<Stats> = {};
    const removeDelta: Partial<Stats> = {};
    const keys: (keyof Stats)[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    for (const key of keys) {
      const newVal = current[key] || 0;
      const oldVal = lastAppliedStats[key] || 0;
      const diff = newVal - oldVal;
      if (diff > 0) delta[key] = diff;
      else if (diff < 0) removeDelta[key] = -diff;
    }
    const characterStore = useCharacterStore();
    // P9-027 修复：同步执行 applyBonus/removeBonus（Pinia action 的同步部分立即更新 bonusStats），
    // 避免异步 IIFE 导致快速连续调用时 lastAppliedStats 未更新而重复叠加
    if (Object.keys(removeDelta).length > 0) {
      characterStore.removeBonus(removeDelta);
    }
    if (Object.keys(delta).length > 0) {
      characterStore.applyBonus(delta);
    }
    lastAppliedStats = { ...current };
  }

  /**
   * 移除所有已应用的天赋 stat_bonus
   *
   * 在 reset/logout 时调用，将天赋 bonus 从角色 bonusStats 中扣除。
   */
  function removeStatBonusesFromCharacter(): void {
    if (Object.keys(lastAppliedStats).length === 0) return;
    const characterStore = useCharacterStore();
    characterStore.removeBonus(lastAppliedStats);
    lastAppliedStats = {};
  }

  /**
   * 同步天赋分配到角色数据（持久化用）
   *
   * talentStore.allocations 是运行时数据源，
   * character.talentAllocations 用于持久化到 IndexedDB。
   *
   * P9-026 修复：同步后调用 persistCharacter 确保落盘，
   * 避免非 stat_bonus 天赋（如 unlock_pet）学习后分配丢失。
   */
  function syncAllocationsToCharacter(): void {
    const characterStore = useCharacterStore();
    const char = characterStore.getCharacterData();
    if (char) {
      characterStore.character = { ...char, talentAllocations: { ...allocations.value } };
      void characterStore.persistCharacter();
    }
  }

  /**
   * 重置所有天赋分配
   *
   * 清空所有已学习天赋，返还所有点数。
   * 注意：实际游戏中可能需要消耗道具或金币，此处仅实现纯逻辑。
   */
  function resetAllAllocations(): void {
    allocations.value = resetAllocations();
    // 重置后需移除所有已应用的 stat_bonus 并重新应用（此时为空 = 全部移除）
    applyStatBonusesToCharacter();
    syncAllocationsToCharacter();
  }

  // ==================== Action：取消学习天赋 ====================

  /**
   * 取消学习一级天赋（减点）
   *
   * 完整流程：
   * 1. 校验天赋当前等级 > 0
   * 2. 通过 unlearnTalent 纯函数更新分配状态
   * 3. 如果是 unlock_pet 效果且等级降到 0，需要回退宠物解锁
   *
   * @param talentId - 要取消的天赋 ID
   * @returns 是否取消成功
   */
  function unlearn(talentId: string): boolean {
    if (!currentClassId.value) return false;
    const currentRank = allocations.value[talentId] || 0;
    if (currentRank <= 0) return false;

    // P8-012 修复：取消前检查是否会导致后续行解锁降级
    if (!canUnlearn(talentId)) return false;

    allocations.value = unlearnTalent(allocations.value, talentId);

    // 如果 rank 降到 0 且天赋含 unlock_pet 效果，回退宠物解锁
    if ((allocations.value[talentId] || 0) === 0) {
      rollbackUnlockPetEffects(talentId);
    }

    // 应用 stat_bonus 变化到角色
    applyStatBonusesToCharacter();
    syncAllocationsToCharacter();

    return true;
  }

  /**
   * 回退天赋的 unlock_pet 效果
   *
   * 当含 unlock_pet 效果的天赋等级降到 0 时，需要从宠物解锁列表中移除。
   * 实际宠物状态由战斗开始时从 effectSummary.unlockedPets 重新同步，
   * 此处仅影响非战斗状态下的即时反馈。
   *
   * @param talentId - 被取消的天赋 ID
   */
  function rollbackUnlockPetEffects(talentId: string): void {
    const found = configCache.getTalentById(talentId);
    if (!found) return;

    for (const effect of found.talent.effects) {
      if (effect.type === 'unlock_pet') {
        // P3-172：通过回调注入替代直接 import usePetStore
        onPetLock?.(effect.petType);
      }
    }
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

  /**
   * 获取指定列（系）已投入的点数
   *
   * 合并为 1 棵树后，UI 仍需展示单系投入。按 talent.col 过滤统计。
   *
   * @param col - 列号（1/2/3）
   * @returns 该列已投入的总点数
   */
  function getColPoints(col: number): number {
    const tree = talentTrees.value[0];
    if (!tree) return 0;
    return getColSpentPoints(tree, col, allocations.value);
  }

  /**
   * 检查天赋是否可以取消学习
   *
   * @param talentId - 天赋 ID
   * @returns 是否可取消
   */
  function canUnlearn(talentId: string): boolean {
    if (!currentClassId.value) return false;
    if ((allocations.value[talentId] || 0) <= 0) return false;

    // P8-012 修复：检查取消后是否会导致后续行解锁降级
    // 模拟取消后状态，遍历所有已学习天赋，确认其所在行仍满足解锁要求
    const simulated = unlearnTalent(allocations.value, talentId);
    for (const tree of talentTrees.value) {
      for (const talent of tree.talents) {
        if ((simulated[talent.id] || 0) > 0 && !isTierUnlocked(talent, tree, simulated)) {
          return false;
        }
        // P10-004 修复：检查取消后是否导致其他已学天赋失去前置依赖
        if ((simulated[talent.id] || 0) > 0 && !meetsRequirements(talent, simulated)) {
          return false;
        }
      }
    }
    return true;
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

    // P3-172：宠物回调注入（GameBootstrap 调用）
    setPetCallbacks,
    // P10-042 修复：宠物回调清除（GameBootstrap dispose 调用）
    clearPetCallbacks,

    // 操作
    learn,
    unlearn,
    resetAllAllocations,

    // 查询
    canLearn,
    canUnlearn,
    getTalentRank,
    getTreeSpentPoints,
    getColPoints
  };
});
