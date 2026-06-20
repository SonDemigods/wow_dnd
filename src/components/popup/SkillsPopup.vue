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
              <BaseIcon v-if="slot.skill" :name="slot.skill.icon" :gradient="characterStore.classId" :size="24" />
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
              <BaseIcon :name="skill.icon" :gradient="characterStore.classId" :size="24" />
              <span v-if="!canUnlock(skill)" class="lock-badge"><BaseIcon name="padlock" :size="14" /></span>
              <span v-if="isSkillEquipped(skill.id)" class="equipped-badge"><BaseIcon name="check-mark" gradient="heal" :size="14" /></span>
            </div>
          </div>
        </div>

        <div :class="['skill-detail', { locked: selectedSkill && !canUnlock(selectedSkill) }]">
          <template v-if="selectedSkill">
            <div class="detail-top">
              <div class="detail-header">
                <BaseIcon :name="selectedSkill.icon" :gradient="characterStore.classId" :size="36" />
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
                  <span class="level-lock-icon"><BaseIcon name="padlock" :size="14" /></span>
                  <span class="level-lock-text">需要等级 {{ selectedSkill.unlockLevel }}</span>
                </template>
                <template v-else>
                  <span class="level-unlock-icon"><BaseIcon name="check-mark" gradient="heal" :size="14" /></span>
                  <span class="level-unlock-text">解锁等级 {{ selectedSkill.unlockLevel }}</span>
                </template>
              </div>
            </div>
          </template>
          <EmptyState v-else icon="sword-clash" text="点击技能查看详情" />
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
import BaseIcon from '@/components/common/BaseIcon.vue';
import EmptyState from '@/components/common/EmptyState.vue';

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

const skillBarSlots = computed(() => {
  // 依赖 barRenderKey 以在记忆/遗忘后强制重新计算
  void barRenderKey.value;
  return skillsStore.skillBarSlots;
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

<style lang="less" scoped>
.skills-content {
  display: flex;
  flex-direction: column;
  gap: @spacing-2xl;
}

.skill-bar-section h3,
.skills-grid-section h3 {
  font-size: @font-base;
  color: @accent-color;
  margin-bottom: @spacing-md;
  font-weight: @font-weight-bold;
}

.skill-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: @spacing-md;
  background: @overlay-dim;
  padding: @spacing-lg;
  border-radius: @radius-md;
  border: @border-card;
}

.bar-slot {
  position: relative;
  padding: @spacing-lg @spacing-sm;
  background: @white-05;
  border: @border-card;
  border-radius: @radius-md;
  text-align: center;
  cursor: pointer;
  transition: all @transition-quick;
  .flex-col();
  align-items: center;
  gap: @spacing-xs;
  min-height: 60px;
  justify-content: center;
  /* 技能记忆/遗忘动画 */
  animation: scaleIn 0.3s ease;
}

.bar-slot:hover {
  background: @white-10;
  border-color: @color-dodge;
}

.bar-slot.selected {
  border-color: @accent-color;
  background: @gold-bg-hover;
  box-shadow: 0 0 10px @gold-border;
}

.bar-slot.empty {
  border-style: dashed;
  border-color: @color-dark-line;
}

.bar-icon {
  font-size: @font-3xl;
}

.bar-name {
  font-size: @font-2xs;
  color: @popup-text-color;
  font-weight: @font-weight-bold;
}

.bar-empty {
  font-size: @font-4xl;
  color: @color-dark-line;
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: @spacing-sm;
  background: @overlay-dim;
  padding: @spacing-lg;
  border-radius: @radius-md;
  border: @border-card;
  max-height: 200px;
  overflow-y: auto;
  align-content: start;
}

.skills-grid::-webkit-scrollbar {
  width: 6px;
}

.skills-grid::-webkit-scrollbar-track {
  background: @overlay-light;
  border-radius: @radius-xs;
}

.skills-grid::-webkit-scrollbar-thumb {
  background: @popup-border-color;
  border-radius: @radius-xs;
}

.skill-slot {
  aspect-ratio: 1;
  background: @white-05;
  border: @border-card;
  border-radius: @radius-sm;
  .flex-center();
  cursor: pointer;
  transition: all @transition-quick;
  position: relative;
}

.skill-slot:hover {
  background: @white-10;
  transform: translateY(-2px);
}

.skill-slot.equipped {
  border-color: @heal-hp;
  background: @green-bg-hover;
}

.skill-slot.locked {
  opacity: @opacity-faded;
  cursor: not-allowed;
}

.skill-slot.locked:hover {
  transform: none;
}

.skill-slot.selected {
  background: @gold-bg-active;
  border-color: transparent;
}

.skill-slot.equipped.selected {
  border-color: @heal-hp;
}

.skill-icon {
  font-size: @font-3xl;
}

.lock-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  font-size: @font-2xs;
}

.equipped-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  font-size: @font-2xs;
  color: @heal-hp;
  background: @overlay-heavy;
  border-radius: 50%;
  width: @spacing-2xl;
  height: @spacing-2xl;
  .flex-center();
}

.skill-detail {
  background: @overlay-mid;
  border-radius: @radius-md;
  padding: @spacing-2xl;
  border: @border-sm;
  flex-shrink: 0;
  min-height: 80px;
  transition: all @transition-normal;
}

.skill-detail.locked {
  border-color: @color-dodge;
  opacity: @opacity-high;
}

.detail-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: @spacing-xl;
  margin-bottom: @spacing-lg;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  gap: @spacing-xl;
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
  font-size: @font-lg;
  color: @popup-text-color;
  font-weight: @font-weight-bold;
  margin: 0 0 @spacing-sm 0;
}

.skill-detail.locked .detail-info h3 {
  color: #999;
}

.detail-actions {
  flex-shrink: 0;
}

.action-btn {
  padding: @spacing-md @spacing-3xl;
  border: none;
  border-radius: @radius-sm;
  font-size: @font-base;
  font-weight: @font-weight-bold;
  cursor: pointer;
  transition: all @transition-quick;
}

.action-btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

.action-btn:active {
  transform: translateY(0);
}

.action-btn.memorize {
  background: linear-gradient(135deg, @heal-hp, #45a049);
  color: @popup-text-color;
}

.action-btn.forget {
  background: linear-gradient(135deg, @damage-physical, #ee5a24);
  color: @popup-text-color;
}

.detail-desc {
  color: #aaa;
  font-size: @font-base;
  margin: 0 0 @spacing-lg 0;
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
  gap: @spacing-sm;
}

.effect-label {
  font-size: @font-sm;
  color: @color-dodge;
}

.effect-value {
  font-size: @font-base;
  font-weight: @font-weight-bold;
}

.effect-value.physical_damage {
  color: @damage-physical;
}

.effect-value.magic_damage {
  color: @damage-magic;
}

.effect-value.heal {
  color: @heal-hp;
}

.skill-detail.locked .effect-value {
  color: @color-dodge;
}

.detail-level-req {
  display: flex;
  align-items: center;
  gap: @spacing-xs;
  padding: @spacing-xs @spacing-lg;
  border-radius: @radius-sm;
  font-size: @font-sm;
  font-weight: @font-weight-bold;
}

.level-lock-icon {
  font-size: @font-sm;
}

.level-lock-text {
  color: @damage-physical;
}

.detail-level-req:has(.level-lock-icon) {
  background: rgba(255, 107, 107, 0.15);
  border: 1px solid rgba(255, 107, 107, 0.3);
}

.level-unlock-icon {
  font-size: @font-sm;
}

.level-unlock-text {
  color: @heal-hp;
}

.detail-level-req:has(.level-unlock-icon) {
  background: @green-bg;
  border: 1px solid rgba(76, 175, 80, 0.2);
}



@media (max-width: 600px) {
  .skill-bar {
    gap: @spacing-sm;
    padding: @spacing-md;
  }

  .bar-slot {
    padding: @spacing-md @spacing-xs;
    min-height: 50px;
  }

  .bar-icon {
    font-size: @font-xl;
  }

  .bar-name {
    font-size: 9px;
  }

  .skills-grid {
    max-height: 150px;
  }
}
</style>
