/**
 * 技能模块状态管理
 * 
 * 使用 Pinia 管理技能状态，响应式更新UI
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Skill, SkillBar, SkillType, SkillSlotIndex, SkillUseResult } from './types';
import { skillsService } from './service';
import { eventBus, GameEvents } from '../bus/core';

/**
 * 技能类型名称映射
 */
const SKILL_TYPE_NAMES: Record<SkillType, string> = {
  physical_damage: '物理伤害',
  magic_damage: '魔法伤害',
  heal: '治疗'
};

/**
 * 技能状态存储
 */
export const useSkillsStore = defineStore('skills', () => {
  // 状态
  const skills = ref<Skill[]>([]);
  const skillBar = ref<SkillBar>({ slots: [null, null, null, null] });
  const isLoading = ref(false);

  // 计算属性
  const unlockedSkills = computed(() => {
    return skillsService.getUnlockedSkills();
  });

  const lockedSkills = computed(() => {
    return skillsService.getLockedSkills();
  });

  const equippedSkills = computed(() => {
    return skillBar.value.slots.map(skillId => {
      if (!skillId) return null;
      return skills.value.find(s => s.id === skillId) || null;
    });
  });

  const skillBarSlots = computed(() => {
    return skillBar.value.slots.map((skillId, index) => {
      const skill = skillId ? skills.value.find(s => s.id === skillId) : null;
      return {
        index: index as SkillSlotIndex,
        skillId,
        skill,
        isEmpty: !skillId
      };
    });
  });

  const skillCountByType = computed(() => {
    const counts: Record<SkillType, number> = {
      physical_damage: 0,
      magic_damage: 0,
      heal: 0
    };
    
    skills.value.forEach(skill => {
      counts[skill.type]++;
    });
    
    return counts;
  });

  // 方法
  async function loadSkills(): Promise<void> {
    isLoading.value = true;
    await skillsService.initialize();
    skills.value = skillsService.getSkills();
    skillBar.value = skillsService.getSkillBar();
    isLoading.value = false;
  }

  function getSkill(skillId: string): Skill | null {
    return skillsService.getSkill(skillId);
  }

  function canUseSkill(skillId: string): boolean {
    return skillsService.canUseSkill(skillId);
  }

  function useSkill(skillId: string): SkillUseResult {
    const result = skillsService.useSkill(skillId);
    // 更新技能栏状态（如果需要）
    skillBar.value = skillsService.getSkillBar();
    return result;
  }

  function equipSkill(skillId: string, slotIndex: SkillSlotIndex): boolean {
    const success = skillsService.equipSkill(skillId, slotIndex);
    if (success) {
      skillBar.value = skillsService.getSkillBar();
    }
    return success;
  }

  function unequipSkill(slotIndex: SkillSlotIndex): boolean {
    const success = skillsService.unequipSkill(slotIndex);
    if (success) {
      skillBar.value = skillsService.getSkillBar();
    }
    return success;
  }

  function swapSkills(slotIndex1: SkillSlotIndex, slotIndex2: SkillSlotIndex): boolean {
    const success = skillsService.swapSkills(slotIndex1, slotIndex2);
    if (success) {
      skillBar.value = skillsService.getSkillBar();
    }
    return success;
  }

  function getSkillsByType(type: SkillType): Skill[] {
    return skillsService.getSkillsByType(type);
  }

  function checkLevelUnlocks(): void {
    skillsService.checkLevelUnlocks();
    skills.value = skillsService.getSkills();
    skillBar.value = skillsService.getSkillBar();
  }

  function addSkillTemplate(skill: Skill): void {
    skillsService.addSkillTemplate(skill);
  }

  function removeSkillTemplate(skillId: string): void {
    skillsService.removeSkillTemplate(skillId);
  }

  function setCharacter(characterId: string): void {
    skillsService.setCharacter(characterId);
    skills.value = skillsService.getSkills();
    skillBar.value = skillsService.getSkillBar();
  }

  function reset(): void {
    skillsService.reset();
    skills.value = [];
    skillBar.value = { slots: [null, null, null, null] };
  }

  function setupEventListeners(): void {
    eventBus.onGroup('skillStore', GameEvents.SKILL_LEARNED, () => {
      skills.value = skillsService.getSkills();
    });

    eventBus.onGroup('skillStore', GameEvents.SKILL_BAR_UPDATE, () => {
      skillBar.value = skillsService.getSkillBar();
    });

    eventBus.onGroup('skillStore', GameEvents.CHARACTER_SELECTED, (data) => {
      if (data?.characterId) {
        setCharacter(data.characterId);
      }
    });

    eventBus.onGroup('skillStore', GameEvents.CHARACTER_LOGOUT, () => {
      skills.value = [];
      skillBar.value = { slots: [null, null, null, null] };
    });

    eventBus.onGroup('skillStore', GameEvents.CHARACTER_LEVEL_UP, () => {
      checkLevelUnlocks();
    });
  }

  /**
   * 清理事件监听
   */
  function dispose(): void {
    eventBus.clearGroup('skillStore');
  }

  return {
    // 状态
    skills,
    skillBar,
    isLoading,
    
    // 计算属性
    unlockedSkills,
    lockedSkills,
    equippedSkills,
    skillBarSlots,
    skillCountByType,
    
    // 方法
    loadSkills,
    getSkill,
    canUseSkill,
    useSkill,
    equipSkill,
    unequipSkill,
    swapSkills,
    getSkillsByType,
    checkLevelUnlocks,
    addSkillTemplate,
    removeSkillTemplate,
    setCharacter,
    reset,
    setupEventListeners,
    dispose,
    
    // 常量
    SKILL_TYPE_NAMES
  };
});