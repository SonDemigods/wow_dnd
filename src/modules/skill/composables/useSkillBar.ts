/**
 * @fileoverview 技能栏管理 Composable（P3-155 拆分自 store.ts）
 * @description 提供技能装备、卸下和交换功能。
 * @module skill/composables
 */
import { useCharacterStore } from '@/modules/character/store';
import { validateSkillBarSlot } from '../service';
import type { SkillState } from './useSkillState';
import type { SkillSlotIndex } from '../types';

export function useSkillBar(state: SkillState) {
  const { skills, skillBar, skillTemplates, persist } = state;

  async function equipSkill(skillId: string, slotIndex: SkillSlotIndex): Promise<boolean> {
    if (!validateSkillBarSlot(slotIndex)) return false;

    const skill = skills.value.find(s => s.id === skillId)
      || skillTemplates.value.get(skillId);
    if (!skill) return false;

    const characterStore = useCharacterStore();
    if (skill.unlockLevel > characterStore.level) return false;

    if (!skills.value.some(s => s.id === skillId)) {
      skills.value.push({ ...skill });
    }

    skillBar.value.slots[slotIndex] = skillId;
    await persist();
    return true;
  }

  async function unequipSkill(skillId: string): Promise<boolean> {
    const slotIndex = skillBar.value.slots.findIndex(s => s === skillId);
    if (slotIndex === -1) return false;

    skillBar.value.slots[slotIndex] = null;
    await persist();
    return true;
  }

  async function swapSkills(slotIndex1: SkillSlotIndex, slotIndex2: SkillSlotIndex): Promise<boolean> {
    if (slotIndex1 === slotIndex2) return false;

    const temp = skillBar.value.slots[slotIndex1];
    skillBar.value.slots[slotIndex1] = skillBar.value.slots[slotIndex2];
    skillBar.value.slots[slotIndex2] = temp;

    await persist();
    return true;
  }

  return { equipSkill, unequipSkill, swapSkills };
}
