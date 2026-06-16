<template>
  <BasePopup :visible="visible" title="技能面板" @close="$emit('close')">
    <template #default>
      <div class="skills-content">
        <div class="skill-bar-section">
          <h3>已记忆技能 (战斗中使用)</h3>
          <div class="skill-bar" :key="barRenderKey">
            <div 
              v-for="(slot, index) in skillBarSlots" 
              :key="index"
              :class="['bar-slot', { empty: !slot.skill, selected: selectedSlotIndex === index }]"
              @click="selectBarSlot(index)"
            >
              <span v-if="slot.skill" class="bar-icon">{{ slot.skill.icon }}</span>
              <span v-if="slot.skill" class="bar-name">{{ slot.skill.name }}</span>
              <span v-if="!slot.skill" class="bar-empty">+</span>
            </div>
          </div>
        </div>

        <div class="skills-grid-section">
          <h3>已学习技能</h3>
          <div class="skills-grid">
            <div 
              v-for="skill in classSkills" 
              :key="skill.id"
              :class="['skill-slot', { equipped: isSkillEquipped(skill.id), locked: !canUnlock(skill), selected: selectedSkill?.id === skill.id }]"
              @click="selectSkill(skill)"
            >
              <span class="skill-icon">{{ skill.icon }}</span>
              <span v-if="!canUnlock(skill)" class="lock-badge">🔒</span>
              <span v-if="isSkillEquipped(skill.id)" class="equipped-badge">✓</span>
            </div>
          </div>
        </div>

        <div :class="['skill-detail', { locked: selectedSkill && !canUnlock(selectedSkill) }]">
          <template v-if="selectedSkill">
            <div class="detail-top">
              <div class="detail-header">
                <div class="detail-icon">{{ selectedSkill.icon }}</div>
                <div class="detail-info">
                  <h3>{{ selectedSkill.name }}</h3>
                  <SkillTags :skill="selectedSkill" />
                </div>
              </div>
              <div class="detail-actions">
                <button 
                  v-if="isSkillEquipped(selectedSkill.id)"
                  class="action-btn forget"
                  @click="deactivateSkill(selectedSkill.id)"
                >
                  遗忘
                </button>
                <button 
                  v-else-if="canUnlock(selectedSkill)"
                  class="action-btn memorize"
                  @click="activateSkill(selectedSkill.id)"
                >
                  记忆
                </button>
              </div>
            </div>
            <p class="detail-desc">{{ selectedSkill.description }}</p>
            <div class="detail-bottom">
              <div class="detail-effect">
                <span class="effect-label">效果:</span>
                <span :class="['effect-value', selectedSkill.type]">{{ getEffectText(selectedSkill) }}</span>
              </div>
              <div class="detail-level-req">
                <template v-if="!canUnlock(selectedSkill)">
                  <span class="level-lock-icon">🔒</span>
                  <span class="level-lock-text">需要等级 {{ selectedSkill.unlockLevel }}</span>
                </template>
                <template v-else>
                  <span class="level-unlock-icon">✅</span>
                  <span class="level-unlock-text">解锁等级 {{ selectedSkill.unlockLevel }}</span>
                </template>
              </div>
            </div>
          </template>
          <div v-else class="detail-placeholder">
            <span class="placeholder-icon">⚔️</span>
            <span class="placeholder-text">点击技能查看详情</span>
          </div>
        </div>
      </div>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
/**
 * @fileoverview 技能面板弹窗组件
 * @description 展示角色已学习的技能列表和战斗技能栏，支持将技能记忆/遗忘到战斗技能槽位中
 */

import { ref, computed, onMounted } from 'vue';
import { useSkillsStore } from '@/modules/skill';
import { useCharacterStore } from '@/modules/character';
import { eventBus, GameEvents } from '@/modules/bus/core';
import { useSkillDisplay } from '@/composables/useSkillDisplay';
import type { Skill, SkillSlotIndex } from '@/modules/skill';
import BasePopup from '../common/BasePopup.vue';
import SkillTags from '../common/SkillTags.vue';

defineProps<{
  visible: boolean;
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const skillsStore = useSkillsStore();
const characterStore = useCharacterStore();

const selectedSkill = ref<Skill | null>(null);
const selectedSlotIndex = ref<number | null>(null);
const classSkills = ref<Skill[]>([]);
const barRenderKey = ref(0);

const allSkillsMap = computed(() => {
  const map = new Map<string, Skill>();
  skillsStore.skills.forEach(s => map.set(s.id, s));
  classSkills.value.forEach(s => {
    if (!map.has(s.id)) map.set(s.id, s);
  });
  return map;
});

const skillBarSlots = computed(() => {
  void barRenderKey.value;
  return skillsStore.skillBar.slots.map((skillId, index) => {
    let skill: Skill | null = null;
    if (skillId) {
      skill = allSkillsMap.value.get(skillId) || null;
    }
    return { index: index as SkillSlotIndex, skillId, skill };
  });
});

const { getSkillEffectText } = useSkillDisplay();

function getEffectText(skill: Skill): string {
  return getSkillEffectText(skill);
}

function isSkillEquipped(skillId: string): boolean {
  return skillsStore.skillBar.slots.includes(skillId);
}

function canUnlock(skill: Skill): boolean {
  return skill.unlockLevel <= characterStore.level;
}

function selectSkill(skill: Skill) {
  selectedSkill.value = skill;
  selectedSlotIndex.value = null;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'skill_select' });
}

function selectBarSlot(index: number) {
  selectedSlotIndex.value = index;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'skill_bar_slot' });
  const slot = skillBarSlots.value[index];
  if (slot.skill) {
    selectedSkill.value = slot.skill;
  }
}

function activateSkill(skillId: string) {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'skill_memorize' });
  const targetSlot = selectedSlotIndex.value ?? findEmptySlot();
  if (targetSlot === null) {
    const skillAtSlot0 = skillsStore.skillBar.slots[0];
    if (skillAtSlot0) {
      skillsStore.unequipSkill(skillAtSlot0);
    }
    skillsStore.equipSkill(skillId, 0 as SkillSlotIndex);
  } else {
    skillsStore.equipSkill(skillId, targetSlot as SkillSlotIndex);
  }
  selectedSlotIndex.value = null;
  barRenderKey.value++;
}

function deactivateSkill(skillId: string) {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'skill_forget' });
  const slotIndex = skillsStore.skillBar.slots.findIndex(id => id === skillId);
  if (slotIndex !== -1) {
    skillsStore.unequipSkill(skillId);
  }
  if (selectedSkill.value?.id === skillId) {
    selectedSkill.value = null;
  }
  barRenderKey.value++;
}

function findEmptySlot(): number | null {
  const emptyIndex = skillsStore.skillBar.slots.findIndex(slot => slot === null);
  return emptyIndex !== -1 ? emptyIndex : null;
}

async function loadClassSkills() {
  const classId = characterStore.classId;
  if (classId) {
    const templates = await skillsStore.getSkillTemplatesByClass(classId);
    classSkills.value = [...templates].sort((a, b) => a.unlockLevel - b.unlockLevel);
  } else {
    classSkills.value = [];
  }
}

async function loadData() {
  await skillsStore.initialize(characterStore.currentCharacterId!);
  await loadClassSkills();
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.skills-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.skill-bar-section h3,
.skills-grid-section h3 {
  font-size: 13px;
  color: #ffd700;
  margin-bottom: 8px;
  font-weight: bold;
}

.skill-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  background: rgba(0, 0, 0, 0.4);
  padding: 10px;
  border-radius: 6px;
  border: 2px solid #4a4a4a;
}

.bar-slot {
  position: relative;
  padding: 10px 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid #4a4a4a;
  border-radius: 6px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-height: 60px;
  justify-content: center;
  /* 技能记忆/遗忘动画 */
  animation: scaleIn 0.3s ease;
}

.bar-slot:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: #666;
}

.bar-slot.selected {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.15);
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
}

.bar-slot.empty {
  border-style: dashed;
  border-color: #555;
}

.bar-icon {
  font-size: 22px;
}

.bar-name {
  font-size: 10px;
  color: #fff;
  font-weight: bold;
}

.bar-empty {
  font-size: 24px;
  color: #555;
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: 6px;
  background: rgba(0, 0, 0, 0.4);
  padding: 10px;
  border-radius: 6px;
  border: 2px solid #4a4a4a;
  max-height: 200px;
  overflow-y: auto;
  align-content: start;
}

.skills-grid::-webkit-scrollbar {
  width: 6px;
}

.skills-grid::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
}

.skills-grid::-webkit-scrollbar-thumb {
  background: #4a4a4a;
  border-radius: 3px;
}

.skill-slot {
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid #4a4a4a;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.skill-slot:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.skill-slot.equipped {
  border-color: #4CAF50;
  background: rgba(76, 175, 80, 0.15);
}

.skill-slot.locked {
  opacity: 0.4;
  cursor: not-allowed;
}

.skill-slot.locked:hover {
  transform: none;
}

.skill-slot.selected {
  background: rgba(255, 215, 0, 0.2);
  border-color: transparent;
}

.skill-slot.equipped.selected {
  border-color: #4CAF50;
}

.skill-icon {
  font-size: 22px;
}

.lock-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  font-size: 10px;
}

.equipped-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  font-size: 10px;
  color: #4CAF50;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 50%;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.skill-detail {
  background: rgba(0, 0, 0, 0.5);
  border-radius: 6px;
  padding: 14px;
  border: 1px solid #4a4a4a;
  flex-shrink: 0;
  min-height: 80px;
  transition: all 0.3s ease;
}

.skill-detail.locked {
  border-color: #666;
  opacity: 0.85;
}

.detail-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
}

.detail-icon {
  font-size: 36px;
  flex-shrink: 0;
}

.skill-detail.locked .detail-icon {
  filter: grayscale(0.5);
}

.detail-info {
  flex: 1;
}

.detail-info h3 {
  font-size: 16px;
  color: #fff;
  font-weight: bold;
  margin: 0 0 6px 0;
}

.skill-detail.locked .detail-info h3 {
  color: #999;
}

.detail-actions {
  flex-shrink: 0;
}

.action-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

.action-btn:active {
  transform: translateY(0);
}

.action-btn.memorize {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: #fff;
}

.action-btn.forget {
  background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  color: #fff;
}

.detail-desc {
  color: #aaa;
  font-size: 13px;
  margin: 0 0 10px 0;
  line-height: 1.4;
}

.skill-detail.locked .detail-desc {
  color: #777;
}

.detail-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-effect {
  display: flex;
  align-items: center;
  gap: 6px;
}

.effect-label {
  font-size: 12px;
  color: #888;
}

.effect-value {
  font-size: 13px;
  font-weight: bold;
}

.effect-value.physical_damage {
  color: #ff6b6b;
}

.effect-value.magic_damage {
  color: #a29bfe;
}

.effect-value.heal {
  color: #4CAF50;
}

.skill-detail.locked .effect-value {
  color: #666;
}

.detail-level-req {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.level-lock-icon {
  font-size: 12px;
}

.level-lock-text {
  color: #ff6b6b;
}

.detail-level-req:has(.level-lock-icon) {
  background: rgba(255, 107, 107, 0.15);
  border: 1px solid rgba(255, 107, 107, 0.3);
}

.level-unlock-icon {
  font-size: 12px;
}

.level-unlock-text {
  color: #4CAF50;
}

.detail-level-req:has(.level-unlock-icon) {
  background: rgba(76, 175, 80, 0.1);
  border: 1px solid rgba(76, 175, 80, 0.2);
}

.detail-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
}

.placeholder-icon {
  font-size: 28px;
  opacity: 0.5;
}

.placeholder-text {
  color: #666;
  font-size: 14px;
}

@media (max-width: 600px) {
  .skill-bar {
    gap: 6px;
    padding: 8px;
  }

  .bar-slot {
    padding: 8px 4px;
    min-height: 50px;
  }

  .bar-icon {
    font-size: 18px;
  }

  .bar-name {
    font-size: 9px;
  }

  .skills-grid {
    max-height: 150px;
  }
}
</style>
