/**
 * @fileoverview 德鲁伊形态系统状态管理 Store（Phase 6.3）
 * @description 管理德鲁伊形态切换状态，提供切换形态的 Action。
 *              形态效果通过 service 纯函数计算，供战斗系统和角色属性系统消费。
 * @module combat/forms
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { DruidForm, DruidFormType, FormState } from './types';
import {
  canSwitchForm,
  switchForm,
  tickCooldown,
  getCurrentForm,
  getFormStatModifiers,
  calculateFormSwitchHeal,
  getAvailableSkills,
  isSkillAvailableInForm,
  createInitialFormState
} from './service';
import { getSwitchableForms, getFormByType } from './druidForms';
// P2-39/P2-47 修复：直接依赖 useCharacterStore 和 useLogStore，
// 不再调用 createCombatContext 创建完整 ICombatContext（其中 6 个 Store 引用全部未使用）
import { useCharacterStore } from '@/modules/character/store';
import { useLogStore } from '@/modules/log/store';
import { generateLogId } from '@/modules/log/service';

/**
 * 德鲁伊形态 Store
 *
 * ## 导出接口分类
 *
 * | 分类 | 成员 | 说明 |
 * |------|------|------|
 * | 响应式状态 | `currentForm`, `availableForms`, `cooldownRemaining` | 形态状态 |
 * | 计算属性 | `currentFormDef`, `statModifiers`, `switchableForms`, `hpMultiplier`, `damageMultiplier`, `defenseMultiplier`, `speedMultiplier` | 派生状态 |
 * | 生命周期 | `initialize`, `reset` | 战斗进入/退出时调用 |
 * | 操作 | `switchTo`, `tickCooldownEnd` | 形态切换/冷却 |
 * | 查询 | `canSwitch`, `isSkillAvailable`, `getAvailableSkills`, `calculateHealAmount` | 纯查询 |
 */
export const useFormStore = defineStore('druidForm', () => {
  // P2-39/P2-47 修复：直接持有需要的外部 Store 引用，不再创建完整 ICombatContext
  const characterStore = useCharacterStore();
  const logStore = useLogStore();

  // ==================== 响应式状态 ====================

  /** 形态系统完整状态 */
  const formState = ref<FormState>(createInitialFormState());

  // ==================== 计算属性 ====================

  /** 当前形态定义 */
  const currentFormDef = computed<DruidForm>(() => getCurrentForm(formState.value));

  /** 当前形态 ID */
  const currentForm = computed<DruidFormType>(() => formState.value.currentForm);

  /** 当前形态的属性修正 */
  const statModifiers = computed(() => getFormStatModifiers(formState.value.currentForm));

  /** 可切换的形态列表（不含当前形态） */
  const switchableForms = computed(() => getSwitchableForms(formState.value.currentForm));

  /** 当前形态生命上限倍率 */
  const hpMultiplier = computed(() => statModifiers.value.hpMultiplier);

  /** 当前形态伤害倍率 */
  const damageMultiplier = computed(() => statModifiers.value.damageMultiplier);

  /** 当前形态防御倍率 */
  const defenseMultiplier = computed(() => statModifiers.value.defenseMultiplier);

  /** 当前形态速度倍率 */
  const speedMultiplier = computed(() => statModifiers.value.speedMultiplier);

  // ==================== 生命周期 ====================

  /**
   * 初始化形态系统（进入战斗时调用）
   *
   * 默认重置为人形形态，冷却清零。
   * 可传入 savedState 从存档恢复。
   */
  function initialize(savedState?: Partial<FormState>): void {
    formState.value = {
      ...createInitialFormState(),
      ...savedState
    };
  }

  /**
   * 重置形态系统（退出战斗时调用）
   */
  function reset(): void {
    formState.value = createInitialFormState();
  }

  // ==================== Action：形态切换 ====================

  /**
   * 切换到目标形态
   *
   * 完整流程：
   * 1. 调用 canSwitchForm 校验可切换性
   * 2. 计算治疗量并应用到角色
   * 3. 通过 switchForm 纯函数更新状态
   * 4. 记录冒险日志
   *
   * P3-96 修复：返回类型由 `Promise<boolean>` 改为 `Promise<{ success: boolean; reason?: string }>`，
   *            冷却/未解锁/同形态等失败场景携带 reason 字段，供调用方做响应式反馈（如 toast 提示）。
   *
   * @param targetForm - 目标形态
   * @returns `{ success, reason? }` — 成功仅返回 `{ success: true }`；失败返回 `{ success: false, reason }`
   */
  async function switchTo(targetForm: DruidFormType): Promise<{ success: boolean; reason?: string }> {
    const result = canSwitchForm(targetForm, formState.value);
    if (!result.canSwitch) {
      // P3-96 修复：返回失败原因，调用方可据 reason 给出 toast 提示
      return { success: false, reason: result.reason };
    }

    // P3-87 修复：直接调用 getFormByType，避免创建多余的临时对象
    const newForm = getFormByType(targetForm);

    // 应用形态切换治疗
    const healAmount = calculateFormSwitchHeal(targetForm, characterStore.maxHp);
    if (healAmount > 0) {
      // P1-11 修复：await receiveHeal 并添加 try-catch，避免未捕获的 Promise rejection
      try {
        await characterStore.receiveHeal(healAmount);
      } catch (e) {
        console.error('[FormsStore] receiveHeal 失败:', e);
      }
    }

    // 更新形态状态
    formState.value = switchForm(formState.value, targetForm);

    // 记录冒险日志
    logStore.addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'combat',
      message: `切换为${newForm.name}，恢复 ${healAmount} 点生命`,
      icon: newForm.icon
    });

    return { success: true };
  }

  /**
   * 回合结束时减少冷却
   */
  function tickCooldownEnd(): void {
    formState.value = tickCooldown(formState.value);
  }

  // ==================== 查询方法 ====================

  /**
   * 检查是否可以切换到目标形态
   *
   * @param targetForm - 目标形态
   * @returns 是否可切换
   */
  function canSwitch(targetForm: DruidFormType): boolean {
    return canSwitchForm(targetForm, formState.value).canSwitch;
  }

  /**
   * 检查技能在当前形态下是否可用
   *
   * @param skillId - 技能 ID
   * @returns 是否可用
   */
  function isSkillAvailable(skillId: string): boolean {
    return isSkillAvailableInForm(skillId, formState.value.currentForm);
  }

  /**
   * 获取当前形态可用的技能列表
   *
   * @returns 可用技能 ID 数组
   */
  function getSkills(): string[] {
    return getAvailableSkills(formState.value.currentForm);
  }

  /**
   * 计算切换到目标形态的治疗量
   *
   * @param targetForm - 目标形态
   * @returns 治疗量
   */
  function calculateHealAmount(targetForm: DruidFormType): number {
    return calculateFormSwitchHeal(targetForm, characterStore.maxHp);
  }

  return {
    // 响应式状态
    formState,
    currentForm,

    // 计算属性
    currentFormDef,
    statModifiers,
    switchableForms,
    hpMultiplier,
    damageMultiplier,
    defenseMultiplier,
    speedMultiplier,

    // 生命周期
    initialize,
    reset,

    // 操作
    switchTo,
    tickCooldownEnd,

    // 查询
    canSwitch,
    isSkillAvailable,
    getSkills,
    calculateHealAmount
  };
});
