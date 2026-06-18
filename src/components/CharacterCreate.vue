<template>
  <div class="character-create">
    <!-- 校验/确认弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click="cancelModal">
      <div v-motion :initial="{ opacity: 0, scale: 0.9 }" :enter="{ opacity: 1, scale: 1, transition: { duration: 200 } }" class="modal-box" @click.stop>
        <div class="modal-icon"><BaseIcon :name="modalIcon.name" :gradient="modalIcon.gradient" :size="48" /></div>
        <h3>{{ modalTitle }}</h3>
        <p>{{ modalMessage }}</p>
        <div class="modal-buttons">
          <button v-if="modalType === 'confirm'" class="modal-btn-cancel" @click="cancelModal">取消</button>
          <button class="modal-btn-confirm" @click="onModalConfirm">{{ modalConfirmText }}</button>
        </div>
      </div>
    </div>
    <!-- 顶部固定区域 -->
    <div class="create-header">
      <h2>创建新角色 - 步骤 {{ currentStep }}/4</h2>
      <div class="step-title">{{ currentStepTitle }}</div>
    </div>

    <!-- 中间滚动区域 -->
    <div class="scrollable-content">
      <!-- 步骤 1: 选择阵营 -->
      <div v-if="currentStep === 1" class="step-grid">
        <div class="faction-grid">
          <button
            v-for="faction in baseStore.factions.filter(
              (f) => f.id !== 'neutral'
            )"
            :key="faction.id"
            :class="[
              'faction-card',
              'main-faction',
              { active: selectedFaction === faction.id }
            ]"
            :style="{ '--faction-color': faction.color }"
            @click="selectFaction(faction.id)"
          >
            <div class="faction-icon"><BaseIcon :name="faction.icon" gradient="alliance" :size="32" /></div>
            <div class="faction-name">{{ faction.name }}</div>
            <div class="faction-desc">
              {{ getFactionRaceNames(faction.id) }}
            </div>
          </button>
        </div>
        <div class="neutral-faction-row">
          <button
            v-if="neutralFaction"
            :class="[
              'faction-card',
              'neutral-faction',
              { active: selectedFaction === 'neutral' }
            ]"
            :style="{ '--faction-color': '#4CAF50' }"
            @click="selectFaction('neutral')"
          >
            <div class="faction-icon"><BaseIcon :name="neutralFaction.icon" gradient="neutral" :size="32" /></div>
            <div class="faction-name">{{ neutralFaction.name }}</div>
            <div class="faction-desc">{{ getFactionRaceNames('neutral') }}</div>
          </button>
        </div>
      </div>

      <!-- 步骤 2: 选择种族 -->
      <div v-if="currentStep === 2" class="step-grid">
        <div :class="['race-grid', selectedFaction]">
          <button
            v-for="race in availableRaces"
            :key="race.id"
            :class="['race-card', { active: selectedRace === race.id }]"
            @click="selectRace(race.id)"
          >
            <div class="race-icon">{{ race.icon }}</div>
            <div class="race-name">{{ race.name }}</div>
            <div class="race-bonus" v-if="race.bonus">
              <span v-for="(value, stat) in race.bonus" :key="stat"
                >+{{ value }} {{ getStatName(stat) }}</span
              >
            </div>
          </button>
        </div>
      </div>

      <!-- 步骤 3: 选择职业 -->
      <div v-if="currentStep === 3" class="step-grid">
        <div class="class-grid">
          <button
            v-for="cls in availableClasses"
            :key="cls.id"
            :class="['class-card', { active: selectedClass === cls.id }]"
            :style="{ '--class-color': cls.color }"
            @click="selectClass(cls.id)"
          >
            <div class="class-icon"><BaseIcon :name="cls.icon" :size="28" /></div>
            <div class="class-name">{{ cls.name }}</div>
            <div class="class-bonus" v-if="cls.bonus">
              <span
                v-for="(value, stat) in cls.bonus"
                :key="stat"
                :class="{ negative: value && value < 0 }"
              >
                {{ value && value > 0 ? '+' : '' }}{{ value || 0 }}
                {{ getStatName(stat) }}
              </span>
            </div>
          </button>
        </div>
      </div>

      <!-- 步骤 4: 输入角色名 -->
      <div v-if="currentStep === 4" class="step-grid">
        <div class="character-preview">
          <div class="preview-row">
            <div class="preview-avatar">
              {{ baseStore.getRaceIcon(selectedRace || '') }}
            </div>
            <div class="name-input-wrapper">
              <input
                v-model="name"
                type="text"
                placeholder="输入角色名（最多8个汉字或16个英文字母）"
                class="name-input"
              />
            </div>
          </div>
          <div class="preview-details">
            <Tag
              type="faction"
              :text="baseStore.getFactionName(selectedFaction || '')"
              :color="baseStore.getFactionColor(selectedFaction || '')"
            />
            <Tag
              type="race"
              :text="baseStore.getRaceName(selectedRace || '')"
            />
            <Tag
              type="class"
              :text="baseStore.getClassName(selectedClass || '')"
              :color="baseStore.getClassColor(selectedClass || '')"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 底部固定区域 -->
    <div class="fixed-footer">
      <!-- 属性预览 -->
      <div v-if="currentStep <= 3" class="attribute-preview">
        <div class="preview-title">属性预览</div>
        <div class="attr-list">
          <div
            v-for="(value, stat) in currentAttributes"
            :key="stat"
            class="attr-item"
          >
            <BaseIcon :name="getStatIcon(stat).name" :gradient="getStatIcon(stat).gradient" :size="16" />
            <span class="attr-name">{{ getStatName(stat) }}</span>
            <span class="attr-value">{{ value }}</span>
          </div>
        </div>
      </div>

      <!-- 最终属性（步骤4） -->
      <div v-if="currentStep === 4" class="final-attributes">
        <div class="final-title">最终属性</div>
        <div class="attr-grid">
          <div
            v-for="(value, stat) in currentAttributes"
            :key="stat"
            class="attr-box"
          >
            <BaseIcon :name="getStatIcon(stat).name" :gradient="getStatIcon(stat).gradient" :size="14" />
            <div class="attr-label">{{ getStatName(stat) }}</div>
            <div class="attr-value">{{ value }}</div>
          </div>
        </div>
        <div class="divider"></div>
        <div class="secondary-section">
          <div class="secondary-title">次级属性</div>
          <div class="secondary-attrs">
            <div class="sec-attr">
              <BaseIcon name="sword-clash" gradient="physical" :size="14" />
              <span>物理攻击</span>
              <strong>{{ derivedAttributes.physicalAttack }}</strong>
            </div>
            <div class="sec-attr">
              <BaseIcon name="shield" gradient="earth" :size="14" />
              <span>物理防御</span>
              <strong>{{ derivedAttributes.physicalDefense }}</strong>
            </div>
            <div class="sec-attr">
              <BaseIcon name="magic-swirl" gradient="magic" :size="14" />
              <span>魔法攻击</span>
              <strong>{{ derivedAttributes.magicAttack }}</strong>
            </div>
            <div class="sec-attr">
              <BaseIcon name="magic-shield" gradient="magic" :size="14" />
              <span>魔法防御</span>
              <strong>{{ derivedAttributes.magicDefense }}</strong>
            </div>
            <div class="sec-attr">
              <BaseIcon name="explosion-rays" gradient="crit" :size="14" />
              <span>暴击率</span>
              <strong>{{ derivedAttributes.critChance }}%</strong>
            </div>
            <div class="sec-attr">
              <BaseIcon name="dodge" gradient="dodge" :size="14" />
              <span>闪避率</span>
              <strong>{{ derivedAttributes.dodgeChance }}%</strong>
            </div>
            <div class="sec-attr">
              <BaseIcon name="health-normal" gradient="blood" :size="14" />
              <span>最大HP</span>
              <strong>{{ derivedAttributes.maxHp }}</strong>
            </div>
            <div class="sec-attr">
              <BaseIcon name="magic-palm" gradient="mana" :size="14" />
              <span>最大MP</span>
              <strong>{{ derivedAttributes.maxMana }}</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- 导航按钮 -->
      <div class="navigation-buttons">
        <button v-if="currentStep > 1" class="nav-btn prev" @click="prevStep">
          上一步
        </button>
        <div class="spacer"></div>
        <button
          v-if="currentStep < 4"
          class="nav-btn next"
          :disabled="!canProceed"
          @click="nextStep"
        >
          下一步
        </button>
        <button
          v-if="currentStep === 4"
          class="nav-btn create"
          :disabled="!canCreate"
          @click="createCharacter"
        >
          创建角色
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 角色创建组件
 * @description 提供分步式的角色创建流程，依次选择阵营、种族、职业并输入角色名，实时预览属性加成和次级属性
 */

import { ref, computed, onMounted } from 'vue';
import { useCharacterStore } from '@/modules/character';
import { useBaseStore } from '@/modules/base';
import { eventBus, GameEvents } from '@/modules/bus/core';
import Tag from './common/Tag.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import type {
  FactionType,
  RaceType,
  ClassType
} from '@/modules/character/types';
import { STAT_NAMES } from '@/config/character';
import {
  calculatePhysicalAttack,
  calculatePhysicalDefense,
  calculateMagicAttack,
  calculateMagicDefense,
  calculateCritChance,
  calculateDodgeChance,
  calculateMaxHp,
  calculateMaxMana
} from '@/utils/calculations';

const characterStore = useCharacterStore();
const baseStore = useBaseStore();

const emit = defineEmits<{
  (e: 'created'): void;
}>();

const currentStep = ref(1);
const name = ref('');
const selectedFaction = ref<string | null>(null);
const selectedRace = ref<string | null>(null);
const selectedClass = ref<string | null>(null);

/** 弹窗状态 */
const showModal = ref(false);
const modalType = ref<'error' | 'confirm'>('error');
const modalIcon = ref<{ name: string; gradient: string }>({ name: '', gradient: '' });
const modalTitle = ref('');
const modalMessage = ref('');
const modalConfirmText = ref('');

const currentStepTitle = computed(() => {
  switch (currentStep.value) {
    case 1:
      return '请选择阵营';
    case 2:
      return `请选择种族 (${baseStore.getFactionName(selectedFaction.value || '')})`;
    case 3:
      return '请选择职业';
    case 4:
      return '请输入角色名';
    default:
      return '';
  }
});

const neutralFaction = computed(() => {
  return baseStore.factions.find((f) => f.id === 'neutral');
});

const availableRaces = computed(() => {
  if (!selectedFaction.value) return [];
  return baseStore.races.filter(
    (r) => r.factionId === selectedFaction.value
  );
});

const availableClasses = computed(() => {
  if (!selectedRace.value) return [];
  return baseStore.classes.filter((c) =>
    c.raceIds.includes(selectedRace.value as RaceType)
  );
});

const currentAttributes = computed(() => {
  const base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

  if (selectedRace.value) {
    const raceData = baseStore.races.find(
      (r) => r.id === selectedRace.value
    );
    if (raceData?.bonus) {
      for (const [stat, value] of Object.entries(raceData.bonus)) {
        if (stat in base) {
          base[stat as keyof typeof base] += value;
        }
      }
    }
  }

  if (selectedClass.value) {
    const classData = baseStore.classes.find(
      (c) => c.id === selectedClass.value
    );
    if (classData?.bonus) {
      for (const [stat, value] of Object.entries(classData.bonus)) {
        if (stat in base) {
          base[stat as keyof typeof base] += value;
        }
      }
    }
  }

  return base;
});

const derivedAttributes = computed(() => {
  return {
    physicalAttack: calculatePhysicalAttack(currentAttributes.value),
    physicalDefense: calculatePhysicalDefense(currentAttributes.value),
    magicAttack: calculateMagicAttack(currentAttributes.value),
    magicDefense: calculateMagicDefense(currentAttributes.value),
    critChance: calculateCritChance(currentAttributes.value),
    dodgeChance: calculateDodgeChance(currentAttributes.value),
    maxHp: calculateMaxHp(currentAttributes.value),
    maxMana: calculateMaxMana(currentAttributes.value)
  };
});

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 1:
      return selectedFaction.value !== null;
    case 2:
      return selectedRace.value !== null;
    case 3:
      return selectedClass.value !== null;
    default:
      return true;
  }
});

const canCreate = computed(() => {
  return (
    name.value.trim().length > 0 &&
    selectedFaction.value &&
    selectedRace.value &&
    selectedClass.value
  );
});

async function loadData() {
  await baseStore.loadAllData();
}

function selectFaction(id: string) {
  selectedFaction.value = id;
  selectedRace.value = null;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'select_faction' });
}

function selectRace(id: string) {
  selectedRace.value = id;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'select_race' });
}

function selectClass(id: string) {
  selectedClass.value = id;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'select_class' });
}

function getFactionRaceNames(factionId: string) {
  const factionRaces = baseStore.races.filter(
    (r) => r.factionId === factionId
  );
  return factionRaces.map((r) => r.name).join(' · ');
}

function getStatName(stat: string) {
  return STAT_NAMES[stat as keyof typeof STAT_NAMES] || stat;
}

function getStatIcon(stat: string): { name: string; gradient: string } {
  const icons: Record<string, { name: string; gradient: string }> = {
    str: { name: 'biceps', gradient: 'physical' },
    dex: { name: 'boot-kick', gradient: 'lightning' },
    con: { name: 'heart-organ', gradient: 'blood' },
    int: { name: 'brain', gradient: 'magic' },
    wis: { name: 'eye-target', gradient: 'nature' },
    cha: { name: 'charm', gradient: 'gold' }
  };
  return icons[stat] || { name: 'uncertainty', gradient: 'shadow' };
}

function nextStep() {
  if (currentStep.value < 4) {
    currentStep.value++;
    eventBus.emit(GameEvents.UI_CLICK, { source: 'create_next' });
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--;
    eventBus.emit(GameEvents.UI_CLICK, { source: 'create_prev' });
  }
}

/** 计算名称的有效字符长度：中文计2，英文/数字计1 */
function calcNameLength(str: string): number {
  let len = 0;
  for (const ch of str) {
    len += /[\u4e00-\u9fff]/.test(ch) ? 2 : 1;
  }
  return len;
}

/** 校验角色名，返回错误信息，无错误返回 null */
function validateName(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return '角色名不能为空';
  }
  if (!/^[\u4e00-\u9fffa-zA-Z0-9]+$/.test(trimmed)) {
    return '角色名只能包含中文、英文和数字，不允许特殊符号';
  }
  const len = calcNameLength(trimmed);
  if (len > 16) {
    return '角色名过长，最多8个汉字或16个英文字母';
  }
  return null;
}

/** 显示错误弹窗 */
function showErrorModal(msg: string) {
  modalType.value = 'error';
  modalIcon.value = { name: 'caltrops', gradient: 'warning' };
  modalTitle.value = '角色名不符合要求';
  modalMessage.value = msg;
  modalConfirmText.value = '返回修改';
  showModal.value = true;
}

/** 显示确认弹窗 */
function showConfirmModal() {
  modalType.value = 'confirm';
  modalIcon.value = { name: 'check-mark', gradient: 'success' };
  modalTitle.value = '确认创建角色';
  modalMessage.value = `确认创建角色「${name.value.trim()}」吗？`;
  modalConfirmText.value = '确认创建';
  showModal.value = true;
}

/** 关闭弹窗 */
function cancelModal() {
  showModal.value = false;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'create_cancel_modal' });
}

/** 弹窗确认按钮回调 */
function onModalConfirm() {
  showModal.value = false;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'create_confirm_modal' });
  if (modalType.value === 'confirm') {
    doCreate();
  }
}

/** 执行实际创建逻辑 */
async function doCreate() {
  await characterStore.createCharacter(
    name.value.trim(),
    selectedFaction.value as FactionType,
    selectedRace.value as RaceType,
    selectedClass.value as ClassType
  );

  emit('created');
}

/** 点击创建角色：先校验，通过后弹出确认弹窗 */
async function createCharacter() {
  if (!canCreate.value) return;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'create_btn' });

  const error = validateName(name.value);
  if (error) {
    showErrorModal(error);
    return;
  }

  showConfirmModal();
}

onMounted(async () => {
  await loadData();
});
</script>

<style lang="less" scoped>
.character-create {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: @spacing-3xl;
  overflow: hidden;
}

/* 顶部固定区域 */
.create-header {
  flex: 0 0 auto;
  text-align: center;
  padding-bottom: @spacing-3xl;
  border-bottom: @border-sm;
  margin-bottom: @spacing-3xl;
}

.create-header h2 {
  font-size: @font-3xl;
  color: @accent-color;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  margin: 0 0 @spacing-lg 0;
}

.step-title {
  font-size: @font-xl;
  color: @text-primary;
  margin: 0;
}

/* 中间滚动区域 */
.scrollable-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: @spacing-md 0;
}

.step-grid {
  width: 100%;
}

/* 阵营选择 */
.faction-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: @spacing-xl;
  margin-bottom: @spacing-xl;
}

.neutral-faction-row {
  display: flex;
  justify-content: center;
}

.faction-card {
  padding: @spacing-4xl @spacing-xl;
  background: rgba(13, 17, 23, 0.95);
  border: @border-hover;
  border-radius: @radius-xl;
  cursor: pointer;
  transition: all @transition-normal;
  text-align: center;
}

.faction-card.main-faction {
  min-height: 160px;
}

.faction-card.neutral-faction {
  width: 100%;
  max-width: 360px;
}

.faction-card:hover {
  border-color: @color-dodge;
  background: @white-05;
  transform: translateY(-2px);
}

.faction-card.active {
  border-color: var(--faction-color);
  background: @gold-bg;
  box-shadow: 0 0 15px var(--faction-color);
}

.faction-icon {
  font-size: 40px;
  margin-bottom: @spacing-lg;
}

.faction-name {
  font-size: @font-xl;
  color: @text-primary;
  font-weight: @font-weight-bold;
  margin-bottom: @spacing-sm;
}

.faction-desc {
  font-size: @font-sm;
  color: @text-secondary;
  line-height: 1.4;
}

/* 种族选择 */
.race-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: @spacing-lg;
}

.race-card {
  padding: @spacing-2xl @spacing-md;
  background: rgba(13, 17, 23, 0.95);
  border: @border-hover;
  border-radius: @radius-lg;
  cursor: pointer;
  transition: all @transition-normal;
  text-align: center;
}

.race-card:hover {
  transform: translateY(-2px);
  border-color: @color-dodge;
}

.race-grid.alliance .race-card.active {
  border-color: #0078ff;
  background: @gold-bg;
  box-shadow: 0 0 15px #0078ff;
}

.race-grid.horde .race-card.active {
  border-color: #ff4400;
  background: @gold-bg;
  box-shadow: 0 0 15px #ff4400;
}

.race-grid.neutral .race-card.active {
  border-color: #4caf50;
  background: @gold-bg;
  box-shadow: 0 0 15px #4caf50;
}

.race-icon {
  font-size: 32px;
  margin-bottom: @spacing-sm;
}

.race-name {
  font-size: @font-base;
  color: @text-primary;
  font-weight: @font-weight-bold;
  margin-bottom: @spacing-xs;
}

.race-bonus {
  .flex-col();
  gap: @spacing-2xs;
  font-size: @font-sm;
  color: @heal-hp;
}

/* 职业选择 */
.class-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: @spacing-lg;
}

.class-card {
  padding: @spacing-2xl @spacing-md;
  background: rgba(13, 17, 23, 0.95);
  border: @border-hover;
  border-radius: @radius-lg;
  cursor: pointer;
  transition: all @transition-normal;
  text-align: center;
}

.class-card:hover {
  transform: translateY(-2px);
  border-color: @color-dodge;
}

.class-card.active {
  border-color: var(--class-color);
  background: @gold-bg;
  box-shadow: 0 0 15px var(--class-color);
}

.class-icon {
  font-size: 32px;
  margin-bottom: @spacing-sm;
}

.class-name {
  font-size: @font-base;
  color: @text-primary;
  font-weight: @font-weight-bold;
  margin-bottom: @spacing-xs;
}

.class-bonus {
  .flex-col();
  gap: @spacing-2xs;
  font-size: @font-sm;
}

.class-bonus span {
  color: @heal-hp;
}

.class-bonus span.negative {
  color: #ff4444;
}

/* 角色预览（步骤4） */
.character-preview {
  background: rgba(13, 17, 23, 0.95);
  border-radius: @radius-xl;
  padding: @spacing-4xl;
  border: @border-card;
}

.preview-row {
  display: flex;
  align-items: center;
  gap: @spacing-xl;
}

.preview-avatar {
  font-size: 40px;
  flex-shrink: 0;
}

.name-input-wrapper {
  flex: 1;
  min-width: 0;
}

.name-input {
  width: 100%;
  padding: @spacing-xl @spacing-2xl;
  background: @white-10;
  border: @border-card;
  border-radius: @radius-lg;
  color: @text-primary;
  font-size: @font-lg;
  font-weight: @font-weight-bold;
  outline: none;
  transition: border-color @transition-normal;
  box-sizing: border-box;
}

.name-input:focus {
  border-color: @accent-color;
}

.name-input::placeholder {
  color: @color-dim-gray;
}

.preview-details {
  display: flex;
  gap: @spacing-xs;
  margin-top: @spacing-lg;
  flex-wrap: nowrap;
  justify-content: center;
}

/* 底部固定区域 */
.fixed-footer {
  flex: 0 0 auto;
  padding-top: 16px;
  border-top: @border-sm;
  background: inherit;
}

/* 属性预览 */
.attribute-preview {
  background: @gradient-attr-panel;
  border-radius: @radius-lg;
  padding: @spacing-md;
  border: 1px solid rgba(255, 215, 0.15);
  margin-bottom: @spacing-md;
}

.preview-title {
  font-size: @font-sm;
  color: @accent-color;
  margin-bottom: @spacing-sm;
  font-weight: @font-weight-bold;
  text-align: center;
  padding-bottom: @spacing-xs;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.attr-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: @spacing-xs;
}

.attr-item {
  display: flex;
  align-items: center;
  gap: @spacing-sm;
  padding: @spacing-xs @spacing-sm;
  background: rgba(255, 255, 255, 0.03);
  border-radius: @radius-sm;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.attr-item .attr-icon {
  font-size: @font-lg;
  width: 22px;
  height: 22px;
  .flex-center();
  background: @gold-bg;
  border-radius: @radius-sm;
  color: @accent-color;
}

.attr-item .attr-name {
  flex: 1;
  color: #b0b0b0;
  font-size: @font-sm;
}

.attr-item .attr-value {
  font-size: @font-md;
  font-weight: @font-weight-bold;
  color: @text-primary;
  min-width: 28px;
  text-align: right;
}

/* 最终属性 */
.final-attributes {
  background: @gradient-attr-panel;
  border-radius: @radius-lg;
  padding: @spacing-md;
  border: 1px solid rgba(255, 215, 0.15);
  margin-bottom: @spacing-md;
}

.final-title {
  font-size: @font-sm;
  color: @accent-color;
  margin-bottom: @spacing-sm;
  font-weight: @font-weight-bold;
  text-align: center;
  padding-bottom: @spacing-xs;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.attr-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: @spacing-xs;
  margin-bottom: @spacing-sm;
}

.attr-box {
  padding: 4px 4px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: @radius-sm;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.attr-box .attr-icon {
  font-size: @font-md;
  margin-bottom: @spacing-2xs;
}

.attr-box .attr-label {
  font-size: @font-sm;
  color: #a0a0a0;
  margin-bottom: @spacing-2xs;
}

.attr-box .attr-value {
  font-size: @font-md;
  color: @text-primary;
  font-weight: @font-weight-bold;
}

.divider {
  height: 1px;
  background: rgba(255, 215, 0, 0.2);
  margin: 4px 0;
}

.secondary-section {
  padding-top: 4px;
}

.secondary-title {
  font-size: @font-sm;
  color: @accent-color;
  margin-bottom: @spacing-sm;
  font-weight: @font-weight-bold;
  text-align: center;
}

.secondary-attrs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: @spacing-xs;
}

.sec-attr {
  display: flex;
  align-items: center;
  gap: @spacing-sm;
  padding: @spacing-xs @spacing-sm;
  background: rgba(255, 255, 255, 0.03);
  border-radius: @radius-sm;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.sec-attr .sec-icon {
  font-size: @font-sm;
  width: 18px;
  height: 18px;
  .flex-center();
  background: @gold-bg;
  border-radius: @radius-sm;
  color: @accent-color;
}

.sec-attr span {
  flex: 1;
  color: #b0b0b0;
  font-size: @font-sm;
}

.sec-attr strong {
  color: @text-primary;
  font-size: @font-base;
  font-weight: @font-weight-bold;
  min-width: 40px;
  text-align: right;
}

/* 导航按钮 */
.navigation-buttons {
  display: flex;
  justify-content: space-between;
  gap: @spacing-xl;
}

.spacer {
  flex: 1;
}

.nav-btn {
  padding: @spacing-xl 24px;
  border: none;
  border-radius: @radius-lg;
  font-size: @font-base;
  font-weight: @font-weight-bold;
  cursor: pointer;
  transition: all @transition-normal;
  flex-shrink: 0;
}

.nav-btn.prev {
  background: @popup-border-color;
  color: @text-primary;
}

.nav-btn.next {
  background: linear-gradient(135deg, #0078ff, #0056cc);
  color: @popup-text-color;
}

.nav-btn.create {
  background: @gradient-gold-btn;
  color: @color-text-dark;
}

.nav-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.nav-btn.prev:hover:not(:disabled) {
  background: @color-dim-gray;
}

.nav-btn.next:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(0, 120, 255, 0.3);
}

.nav-btn.create:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
}

.nav-btn:disabled {
  opacity: @opacity-dimmed;
  cursor: not-allowed;
}

/* 校验/确认弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: @overlay-deep;
  .flex-center();
  z-index: @z-popup;
}

.modal-box {
  background: rgba(20, 25, 35, 0.98);
  border: 2px solid @accent-color;
  border-radius: @radius-xl;
  padding: 24px;
  max-width: 360px;
  width: 90%;
  text-align: center;
}

.modal-icon {
  font-size: 48px;
  margin-bottom: @spacing-3xl;
}

.modal-box h3 {
  color: @accent-color;
  font-size: @font-2xl;
  margin-bottom: @spacing-xl;
}

.modal-box p {
  color: #b0b0b0;
  font-size: @font-md;
  margin-bottom: 20px;
  line-height: 1.5;
}

.modal-buttons {
  display: flex;
  gap: @spacing-xl;
  justify-content: center;
}

.modal-btn-cancel {
  padding: @spacing-lg 24px;
  background: @white-10;
  border: 1px solid @color-dim-gray;
  border-radius: @radius-md;
  color: @text-primary;
  font-size: @font-md;
  cursor: pointer;
  transition: all @transition-normal;
}

.modal-btn-cancel:hover {
  background: @white-20;
  border-color: @color-dodge;
}

.modal-btn-confirm {
  padding: @spacing-lg 24px;
  background: @gradient-gold-btn;
  border: none;
  border-radius: @radius-md;
  color: @color-text-dark;
  font-size: @font-md;
  font-weight: @font-weight-bold;
  cursor: pointer;
  transition: all @transition-normal;
}

.modal-btn-confirm:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 215, 0, 0.4);
}

/* 移动端适配 */
@media (max-width: 480px) {
  .character-create {
    padding: 12px;
    max-height: calc(100vh - 40px);
  }

  .create-header h2 {
    font-size: 18px;
  }

  .step-title {
    font-size: 16px;
  }

  .faction-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .faction-card.main-faction {
    min-height: auto;
  }

  .faction-icon {
    font-size: 36px;
  }

  .faction-name {
    font-size: 16px;
  }

  .faction-desc {
    font-size: 12px;
  }

  .race-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .race-card {
    padding: 12px 6px;
  }

  .race-icon {
    font-size: 28px;
  }

  .race-name {
    font-size: 12px;
  }

  .class-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .class-card {
    padding: 12px 6px;
  }

  .class-icon {
    font-size: 28px;
  }

  .class-name {
    font-size: 12px;
  }

  .attr-list {
    grid-template-columns: repeat(2, 1fr);
  }

  .attr-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .attr-box {
    padding: 10px 6px;
  }

  .attr-value {
    font-size: 16px;
  }

  .secondary-attrs {
    grid-template-columns: repeat(2, 1fr);
  }

  .preview-row {
    gap: 10px;
  }

  .preview-avatar {
    font-size: 36px;
  }

  .name-input {
    padding: 10px 12px;
    font-size: 14px;
  }

  .nav-btn {
    padding: 10px 18px;
    font-size: 14px;
  }
}
</style>
