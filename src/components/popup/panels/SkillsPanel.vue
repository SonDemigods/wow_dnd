<template>
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
      <div ref="skillsGridContainerRef" class="skills-grid">
        <RecycleScroller
          :items="skillsGridData"
          :item-size="skillsItemSize"
          :grid-items="skillsGridItems"
          :item-secondary-size="skillsItemSize"
          key-field="id"
          class="skills-scroller"
        >
          <template #default="{ item }">
            <div
              :class="['skill-slot', { equipped: isSkillEquipped(item.skill.id), locked: !canUnlock(item.skill), selected: selectedSkill?.id === item.skill.id }]"
              @click="selectSkill(item.skill)"
            >
              <BaseIcon :name="item.skill.icon" :gradient="characterStore.classId" :size="24" />
              <span v-if="!canUnlock(item.skill)" class="lock-badge"><BaseIcon name="padlock" :size="14" /></span>
              <span v-if="isSkillEquipped(item.skill.id)" class="equipped-badge"><BaseIcon name="check-mark" gradient="heal" :size="14" /></span>
            </div>
          </template>
        </RecycleScroller>
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

<script setup lang="ts">
/**
 * @fileoverview 技能面板内容组件（无 BasePopup 外壳）
 * @description 展示角色已学习技能与战斗技能栏，支持记忆/遗忘到技能槽位。供 BuildPopup 分段复用。
 */
import { ref, computed, onMounted } from 'vue';
import { RecycleScroller } from 'vue-virtual-scroller';
import { useSkillStore } from '@/modules/skill';
import { useCharacterStore } from '@/modules/character';
import { eventBus, GameEvents } from '@/modules/bus';
import { useToast } from '@/composables/useToast';
import { errorHandler } from '@/services/ErrorHandler';
import { useSkillDisplay } from '@/composables/useSkillDisplay';
import { useResponsiveGrid } from '@/composables/useResponsiveGrid';
import type { Skill, SkillSlotIndex } from '@/modules/skill';
import SkillTags from '../../common/SkillTags.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import EmptyState from '../../common/EmptyState.vue';

const skillsStore = useSkillStore();
const characterStore = useCharacterStore();
const toast = useToast();

const selectedSkill = ref<Skill | null>(null);
const selectedSlotIndex = ref<SkillSlotIndex | null>(null);
const classSkills = ref<Skill[]>([]);
const barRenderKey = ref(0);

/** 虚拟网格容器 ref，供 useResponsiveGrid 测量宽度计算列数 */
const skillsGridContainerRef = ref<HTMLElement | null>(null);
const { gridItems: skillsGridItems, itemSize: skillsItemSize } = useResponsiveGrid(skillsGridContainerRef, 48, 6);

/** RecycleScroller 渲染数据：技能列表映射为带 id 的条目 */
const skillsGridData = computed(() =>
  classSkills.value.map(skill => ({ id: skill.id, skill }))
);

const skillBarSlots = computed(() => {
  void barRenderKey.value;
  return skillsStore.skillBarSlots;
});

const { getSkillEffectText } = useSkillDisplay();

function getEffectText(skill: Skill): string {
  return getSkillEffectText(skill, characterStore.effectiveStats);
}

function isSkillEquipped(skillId: string): boolean {
  return skillsStore.skillBar.slots.includes(skillId);
}

function canUnlock(skill: Skill): boolean {
  return skill.unlockLevel <= characterStore.level;
}

function selectSkill(skill: Skill) {
  selectedSkill.value = skill;
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
  try {
    const targetSlot = selectedSlotIndex.value ?? findEmptySlot();
    if (targetSlot === null) {
      const skillAtSlot0 = skillsStore.skillBar.slots[0];
      if (skillAtSlot0) {
        skillsStore.unequipSkill(skillAtSlot0);
      }
      skillsStore.equipSkill(skillId, 0);
    } else {
      skillsStore.equipSkill(skillId, targetSlot);
    }
    selectedSlotIndex.value = null;
    barRenderKey.value++;
  } catch (err) {
    console.error('[SkillsPanel] activateSkill 失败:', err);
    toast.show({ message: '技能记忆失败，请重试', type: 'danger' });
  }
}

function deactivateSkill(skillId: string) {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'skill_forget' });
  try {
    const slotIndex = skillsStore.skillBar.slots.findIndex(id => id === skillId);
    if (slotIndex !== -1) {
      skillsStore.unequipSkill(skillId);
    }
    if (selectedSkill.value?.id === skillId) {
      selectedSkill.value = null;
    }
    barRenderKey.value++;
  } catch (err) {
    console.error('[SkillsPanel] deactivateSkill 失败:', err);
    toast.show({ message: '技能遗忘失败，请重试', type: 'danger' });
  }
}

function findEmptySlot(): SkillSlotIndex | null {
  const emptyIndex = skillsStore.skillBar.slots.findIndex(slot => !slot);
  return emptyIndex !== -1 ? (emptyIndex as SkillSlotIndex) : null;
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
  try {
    const id = characterStore.currentCharacterId;
    if (!id) return;
    await skillsStore.initialize(id);
    await loadClassSkills();
  } catch (e) {
    console.error('[SkillsPanel] loadData 失败:', e);
    errorHandler.report(e);
    toast.show({ message: '加载技能数据失败，请重试', type: 'danger' });
  }
}

onMounted(async () => {
  await loadData();
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: @spacing-xs;
  min-height: 60px;
  justify-content: center;
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
  background: @overlay-dim;
  padding: @spacing-lg;
  border-radius: @radius-md;
  border: @border-card;
}

.skills-scroller {
  max-height: 180px;
  .custom-scrollbar();
}

.skills-scroller :deep(.vue-recycle-scroller__item-view) {
  padding: 3px;
  box-sizing: border-box;
}

.skill-slot {
  width: 100%;
  height: 100%;
  background: @white-05;
  border: @border-card;
  border-radius: @radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all @transition-quick;
  position: relative;
  box-sizing: border-box;
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
  display: flex;
  align-items: center;
  justify-content: center;
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
  .action-btn-base();
  padding: @spacing-md @spacing-3xl;
  border: none;
  border-radius: @radius-sm;
  font-size: @font-base;
  transition: all @transition-quick;

  &:hover {
    filter: brightness(1.1);
  }

  &:active {
    transform: translateY(0);
  }
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

  .skills-scroller {
    max-height: 130px;
  }
}
</style>