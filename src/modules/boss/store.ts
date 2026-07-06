/**
 * @fileoverview Boss 模块状态管理（Pinia Store）
 * @description Boss 战斗期间的临时状态管理，战斗结束后由 combat store 统一清除。
 *              提供当前阶段、已触发机制等响应式状态的统一访问入口。
 *
 * 与 combat 层的关系：
 * - boss store 持有 Boss 专属的临时战斗状态（阶段、机制标记）
 * - combat composables 在战斗流程中调用 boss engine 函数，并通过 boss store 更新状态
 * - 战斗结束时，combat store 调用 boss store 的 reset() 清空所有暂态数据
 *
 * @module boss
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { BossPhase, BossMechanicType } from './types';
import type { EnemyInstance } from '../enemy/types';
import { BossPhaseManager } from './phase-manager';
import { processBossPhaseMechanics, applyPhaseStats } from './engine';

/**
 * Boss 战斗状态存储（Pinia Store）
 *
 * 全局单例，通过 `useBossStore()` 获取。
 * 仅在 Boss 战斗中激活，普通战斗不创建此 Store 的状态。
 */
export const useBossStore = defineStore('boss', () => {
  // ==================== 响应式状态 ====================

  /** 当前 Boss 实例引用（战斗期间持有，战斗结束时置 null） */
  const currentBoss = ref<EnemyInstance | null>(null);

  /** 当前所处的阶段配置（null 表示无阶段配置或未初始化） */
  const currentPhase = ref<BossPhase | null>(null);

  /** 当前阶段索引（-1 表示未初始化） */
  const currentPhaseIndex = ref(-1);

  /** 本轮触发的机制类型列表（每回合开始时清空，回合内累加） */
  const triggeredMechanicsThisTurn = ref<BossMechanicType[]>([]);

  /** 本场战斗中已触发过的所有机制类型（用于 UI 展示和历史追踪） */
  const allTriggeredMechanics = ref<BossMechanicType[]>([]);

  /** 战斗是否包含 Boss（用于 UI 条件渲染，如显示 Boss 血条特效） */
  const isBossCombat = ref(false);

  // ==================== 计算属性 ====================

  /** Boss 当前 HP 百分比（0-1），用于 UI 进度条和阶段指示器 */
  const hpPercent = computed(() => {
    if (!currentBoss.value) return 0;
    return currentBoss.value.hp / currentBoss.value.maxHp;
  });

  /** Boss 是否处于护盾状态 */
  const hasShield = computed(() => {
    const boss = currentBoss.value as EnemyInstance & { shield?: number } | null;
    return (boss?.shield ?? 0) > 0;
  });

  /** Boss 是否处于无敌状态 */
  const isInvulnerable = computed(() => {
    const boss = currentBoss.value as EnemyInstance & { invulnerable?: boolean } | null;
    return boss?.invulnerable === true;
  });

  /** Boss 是否处于蓄力状态 */
  const isCharging = computed(() => {
    const boss = currentBoss.value as EnemyInstance & { charging?: boolean } | null;
    return boss?.charging === true;
  });

  /** 获取阶段名称（中文描述），无阶段时返回空字符串 */
  const phaseName = computed(() => {
    return currentPhase.value?.name || '';
  });

  /** 下一阶段的 HP 阈值（用于 UI 显示"阶段切换预告"） */
  const nextPhaseThreshold = computed(() => {
    if (!currentBoss.value || !currentPhase.value) return null;
    const phases = (currentBoss.value as EnemyInstance & { phases?: BossPhase[] }).phases;
    if (!phases || currentPhaseIndex.value <= 0) return null;
    // 下一个阶段是当前阶段的上一级（phases 按阈值升序排列）
    return phases[currentPhaseIndex.value - 1]?.hpThreshold || null;
  });

  // ==================== 内部辅助 ====================

  /** 阶段管理器实例（战斗期间创建，reset 时销毁） */
  let phaseManager: BossPhaseManager | null = null;

  // ==================== Action：初始化 ====================

  /**
   * 初始化 Boss 战斗状态
   *
   * 在 combat store 检测到 Boss 敌人时调用，设置当前 Boss 实例并初始化阶段管理器。
   * 若 Boss 有阶段配置，则定位到初始阶段。
   *
   * @param boss - Boss 运行时实例
   */
  function initBossCombat(boss: EnemyInstance): void {
    currentBoss.value = boss;
    isBossCombat.value = true;
    triggeredMechanicsThisTurn.value = [];
    allTriggeredMechanics.value = [];

    // 检查 Boss 是否包含阶段配置（phases 字段通过 as 访问）
    const bossWithPhases = boss as EnemyInstance & { phases?: BossPhase[] };
    if (!bossWithPhases.phases || bossWithPhases.phases.length === 0) {
      currentPhase.value = null;
      phaseManager = null;
      return;
    }

    // 创建阶段管理器并定位初始阶段
    phaseManager = new BossPhaseManager();
    const result = phaseManager.getCurrentPhase(bossWithPhases.phases, boss.hp, boss.maxHp);
    currentPhase.value = result.phase;
    currentPhaseIndex.value = bossWithPhases.phases.indexOf(result.phase!);
  }

  // ==================== Action：回合流程 ====================

  /**
   * 检查阶段切换（每回合开始时调用）
   *
   * 对比 Boss 当前 HP 百分比与阶段阈值，检测是否需要切换阶段。
   * 若发生切换，自动应用新阶段的属性乘数并更新 currentPhase。
   *
   * @returns 是否发生了阶段切换
   */
  function checkPhaseSwitch(): boolean {
    if (!currentBoss.value || !phaseManager) return false;

    const bossWithPhases = currentBoss.value as EnemyInstance & { phases?: BossPhase[] };
    if (!bossWithPhases.phases || bossWithPhases.phases.length === 0) return false;

    const result = phaseManager.getCurrentPhase(
      bossWithPhases.phases,
      currentBoss.value.hp,
      currentBoss.value.maxHp
    );

    if (result.changed && result.phase) {
      // 应用新阶段的属性乘数
      applyPhaseStats(currentBoss.value, result.phase);
      currentPhase.value = result.phase;
      currentPhaseIndex.value = bossWithPhases.phases.indexOf(result.phase);
      return true;
    }

    return false;
  }

  /**
   * 处理当前阶段机制（每回合开始时调用）
   *
   * 遍历当前阶段的所有机制，逐一检查触发条件并执行。
   * 触发的机制类型写入 triggeredMechanicsThisTurn 和 allTriggeredMechanics。
   *
   * @param turnCount - 当前回合数
   * @returns 本轮触发的机制类型列表
   */
  function processMechanics(turnCount: number): BossMechanicType[] {
    triggeredMechanicsThisTurn.value = [];

    if (!currentBoss.value || !currentPhase.value) return [];

    const triggered = processBossPhaseMechanics(currentBoss.value, currentPhase.value, turnCount) as BossMechanicType[];

    triggeredMechanicsThisTurn.value = triggered;

    // 记录到历史列表（去重）
    for (const mechanic of triggered) {
      if (!allTriggeredMechanics.value.includes(mechanic)) {
        allTriggeredMechanics.value.push(mechanic);
      }
    }

    return triggered;
  }

  // ==================== Action：查询 ====================

  /**
   * 获取当前 Boss 实例
   *
   * @returns Boss 实例或 null（非 Boss 战斗或未初始化）
   */
  function getCurrentBoss(): EnemyInstance | null {
    return currentBoss.value;
  }

  /**
   * 获取当前阶段的下一个阈值（用于 UI 预告）
   *
   * @returns HP 百分比阈值或 null
   */
  function getNextPhaseThreshold(): number | null {
    return nextPhaseThreshold.value;
  }

  // ==================== Action：重置 ====================

  /**
   * 重置 Boss 战斗状态
   *
   * 清空所有响应式状态并销毁阶段管理器。
   * 在 combat store 结束战斗时调用。
   */
  function reset(): void {
    currentBoss.value = null;
    currentPhase.value = null;
    currentPhaseIndex.value = -1;
    triggeredMechanicsThisTurn.value = [];
    allTriggeredMechanics.value = [];
    isBossCombat.value = false;
    phaseManager = null;
  }

  // ==================== 导出 ====================

  return {
    // 状态
    currentBoss,
    currentPhase,
    currentPhaseIndex,
    triggeredMechanicsThisTurn,
    allTriggeredMechanics,
    isBossCombat,

    // 计算属性
    hpPercent,
    hasShield,
    isInvulnerable,
    isCharging,
    phaseName,
    nextPhaseThreshold,

    // Action
    initBossCombat,
    checkPhaseSwitch,
    processMechanics,
    getCurrentBoss,
    getNextPhaseThreshold,
    reset
  };
});
