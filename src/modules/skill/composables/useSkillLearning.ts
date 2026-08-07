/**
 * @fileoverview 技能学习 Composable（P3-155 拆分自 store.ts）
 * @description 提供技能学习和等级解锁检查功能。
 * @module skill/composables
 */
import { useCharacterStore } from '@/modules/character/store';
import { canLearnSkill } from '../service';
import type { SkillState } from './useSkillState';
import type { Skill } from '../types';

export function useSkillLearning(state: SkillState) {
  const { skills, skillBar, skillTemplates, persist, logSkillLearned } = state;

  async function learnSkill(skillId: string): Promise<boolean> {
    const template = skillTemplates.value.get(skillId);
    if (!template) return false;

    const characterStore = useCharacterStore();
    if (!canLearnSkill(template, characterStore.level, skills.value)) {
      return false;
    }

    skills.value.push({ ...template });

    const emptySlot = skillBar.value.slots.findIndex(s => s === null);
    if (emptySlot !== -1) {
      skillBar.value.slots[emptySlot] = skillId;
    }

    await persist();
    logSkillLearned(template);

    return true;
  }

  async function checkLevelUnlocks(shouldAutoEquip: boolean = true): Promise<void> {
    const characterStore = useCharacterStore();
    const characterLevel = characterStore.level;

    let hasNewSkills = false;

    skillTemplates.value.forEach((template: Skill) => {
      const exists = skills.value.some(s => s.id === template.id);
      if (!exists && template.unlockLevel <= characterLevel) {
        skills.value.push({ ...template });
        hasNewSkills = true;

        if (shouldAutoEquip) {
          const emptySlot = skillBar.value.slots.findIndex(s => s === null);
          if (emptySlot !== -1) {
            skillBar.value.slots[emptySlot] = template.id;
          }
        }

        logSkillLearned(template);
      }
    });

    if (hasNewSkills) {
      await persist();
    }
  }

  return { learnSkill, checkLevelUnlocks };
}
