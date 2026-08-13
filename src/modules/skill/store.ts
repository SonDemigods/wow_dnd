/**
 * @fileoverview 技能模块状态管理（Pinia Store — 组合入口）
 * @description P3-155 拆分后，Store 仅负责组合各 composable 并暴露扁平公共 API。
 *              状态/持久化/初始化在 useSkillState，学习在 useSkillLearning，
 *              施放在 useSkillCasting，技能栏在 useSkillBar。
 * @module skill
 */
import { defineStore } from 'pinia';
import { useSkillState } from './composables/useSkillState';
import { useSkillLearning } from './composables/useSkillLearning';
import { useSkillCasting } from './composables/useSkillCasting';
import { useSkillBar } from './composables/useSkillBar';

export const useSkillStore = defineStore('skills', () => {
  const state = useSkillState();
  const learning = useSkillLearning(state);
  const casting = useSkillCasting(state);
  const bar = useSkillBar(state);

  // initialize 需要在模板加载后调用 checkLevelUnlocks
  async function initialize(characterId?: string): Promise<void> {
    await state.initialize(characterId);
    await learning.checkLevelUnlocks(false);
  }

  return {
    // 响应式状态
    skills: state.skills,
    skillBar: state.skillBar,
    skillTemplates: state.skillTemplates,
    monsterSkillTemplates: state.monsterSkillTemplates,
    currentCharacterId: state.currentCharacterId,
    isLoading: state.isLoading,
    cooldowns: state.cooldowns,

    // 计算属性
    unlockedSkills: state.unlockedSkills,
    lockedSkills: state.lockedSkills,
    equippedSkills: state.equippedSkills,
    skillBarSlots: state.skillBarSlots,
    skillCountByType: state.skillCountByType,

    // 初始化 & 重置
    initialize,
    reset: state.reset,

    // 学习
    learnSkill: learning.learnSkill,
    checkLevelUnlocks: learning.checkLevelUnlocks,

    // 施放
    castSkill: casting.castSkill,
    canUseSkill: casting.canUseSkill,

    // 技能栏
    equipSkill: bar.equipSkill,
    unequipSkill: bar.unequipSkill,
    swapSkills: bar.swapSkills,

    // 查询
    getSkill: state.getSkill,
    getAvailableSkills: state.getAvailableSkills,
    getSkillsByType: state.getSkillsByType,

    // 模板管理
    loadTemplatesForClass: state.loadTemplatesForClass,
    loadMonsterSkillTemplates: state.loadMonsterSkillTemplates,
    getSkillTemplatesByClass: state.getSkillTemplatesByClass,
    addSkillTemplate: state.addSkillTemplate,
    removeSkillTemplate: state.removeSkillTemplate,

    // 冷却管理
    tickCooldowns: state.tickCooldowns,
    resetCooldowns: state.resetCooldowns,
    isOnCooldown: state.isOnCooldown,
    getCooldownRemaining: state.getCooldownRemaining,

    // 常量
    SKILL_TYPE_NAMES: state.SKILL_TYPE_NAMES,
  };
});
