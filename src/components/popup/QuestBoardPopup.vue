<template>
  <BasePopup :visible="visible" title="任务看板" @close="$emit('close')">
    <template #default>
      <div class="quest-tabs">
        <button 
          :class="['tab-btn', { active: currentTab === 'available' }]"
          @click="switchTab('available')"
        >
          可接取任务
        </button>
        <button 
          :class="['tab-btn', { active: currentTab === 'turnin' }]"
          @click="switchTab('turnin')"
        >
          可交付任务
        </button>
      </div>

      <div v-if="currentTab === 'available'" class="quest-list">
        <div 
          v-for="quest in availableQuests" 
          :key="quest.id"
          class="quest-card available"
        >
          <div class="quest-icon"><BaseIcon :name="getQuestIcon(quest.type)" gradient="gold" :size="28" /></div>
          <div class="quest-content">
            <div class="quest-header-row">
              <h3>{{ quest.title }}</h3>
              <span class="quest-level">Lv.{{ quest.levelRequirement }}</span>
            </div>
            <p class="quest-desc">{{ quest.description }}</p>
            <div class="quest-objectives">
              <div 
                v-for="obj in quest.objectives" 
                :key="obj.key"
                class="objective"
              >
                <span class="objective-text">{{ getObjectiveText(obj) }}</span>
                <span class="objective-target">{{ obj.target }}</span>
              </div>
            </div>
            <div class="quest-rewards">
              <span v-if="quest.goldReward"><BaseIcon name="coins" gradient="gold" :size="14" /> {{ quest.goldReward }}</span>
              <span v-if="quest.xpReward"><BaseIcon name="star-formation" gradient="gold" :size="14" /> {{ quest.xpReward }}</span>
              <span v-if="quest.itemRewards?.length"><BaseIcon name="chest" gradient="gold" :size="14" /> {{ quest.itemRewards.length }}</span>
            </div>
            <button 
              class="accept-btn"
              :disabled="characterLevel < quest.levelRequirement"
              @click="acceptQuest(quest.id)"
            >
              接取任务
            </button>
          </div>
        </div>

        <div v-if="!availableQuests.length" class="empty-state">
          <div class="empty-icon"><BaseIcon name="notebook" :size="32" /></div>
          <p>暂无可接取的任务</p>
        </div>
      </div>

      <div v-else class="quest-list">
        <div 
          v-for="quest in turnInQuests" 
          :key="quest.id"
          class="quest-card turnin"
        >
          <div class="quest-icon"><BaseIcon name="laurel-crown" gradient="gold" :size="28" /></div>
          <div class="quest-content">
            <div class="quest-header-row">
              <h3>{{ quest.title }}</h3>
              <span class="quest-status">可交付</span>
            </div>
            <p class="quest-desc">{{ quest.description }}</p>
            <div class="quest-rewards">
              <span v-if="quest.goldReward"><BaseIcon name="coins" gradient="gold" :size="14" /> {{ quest.goldReward }}</span>
              <span v-if="quest.xpReward"><BaseIcon name="star-formation" gradient="gold" :size="14" /> {{ quest.xpReward }}</span>
            </div>
            <button 
              class="claim-btn"
              @click="turnInQuest(quest.id)"
            >
              交付任务
            </button>
          </div>
        </div>

        <div v-if="!turnInQuests.length" class="empty-state">
          <div class="empty-icon"><BaseIcon name="laurel-crown" gradient="gold" :size="32" /></div>
          <p>暂无可交付的任务</p>
        </div>
      </div>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
/**
 * @fileoverview 任务看板弹窗组件
 * @description 提供可接取任务和可交付任务两个标签页，支持从当前区域任务板接受/提交任务
 */

import { ref, computed, onMounted, watch } from 'vue';
import { useQuestStore } from '@/modules/quest';
import { useCharacterStore } from '@/modules/character';
import { useExplorationStore } from '@/modules/exploration/store';
import { eventBus, GameEvents } from '@/modules/bus/core';
import { useToast } from '@/composables/useToast';
import { getObjectiveText } from '@/modules/quest';
import BasePopup from '../common/BasePopup.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';

const props = defineProps<{
  visible: boolean;
  boardId?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const explorationStore = useExplorationStore();
const characterStore = useCharacterStore();
const questStore = useQuestStore();
const toast = useToast();

const currentTab = ref<'available' | 'turnin'>('available');

function switchTab(tab: 'available' | 'turnin') {
  currentTab.value = tab;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'quest_board_tab' });
}

/** 当前任务板上可接取的任务定义列表，直接从 Store 响应式数据派生 */
const availableQuests = computed(() => {
  const boardId = getBoardId();
  return questStore.getQuestsFromBoard(boardId).filter(q => questStore.isQuestAvailable(q.id));
});

/** 当前任务板上可提交的任务定义列表，直接从 Store 响应式数据派生 */
const turnInQuests = computed(() => {
  const boardId = getBoardId();
  return questStore.getQuestsToTurnIn(boardId);
});

const characterLevel = computed(() => characterStore.level);

const questIcons: Record<string, string> = {
  kill: 'crossed-swords',
  collect: 'chest'
};

function getQuestIcon(type: string) {
  return questIcons[type] || 'notebook';
}

// 获取当前区域的任务板ID
function getBoardId(): string {
  // 优先使用传入的 boardId，否则使用当前探索区域ID
  return props.boardId || explorationStore.currentAreaId || 'village';
}

async function acceptQuest(questId: string) {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'quest_board_accept' });
  const boardId = getBoardId();
  const success = await questStore.acceptQuestFromBoard(boardId, questId);
  if (success) {
    const quest = questStore.getQuestDefinition(questId);
    toast.show({ message: `已接受任务: ${quest?.title || questId}`, type: 'success', icon: '✅' });
    loadQuests();
  } else {
    toast.show({ message: '无法接受此任务', type: 'danger', icon: '❌' });
  }
}

async function turnInQuest(questId: string) {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'quest_board_turnin' });
  const boardId = getBoardId();
  const success = await questStore.turnInQuestToBoard(boardId, questId);
  if (success) {
    const quest = questStore.getQuestDefinition(questId);
    toast.show({ message: `已领取奖励: ${quest?.title || questId}`, type: 'success', icon: '🏆' });
    loadQuests();
  } else {
    toast.show({ message: '无法领取奖励', type: 'danger', icon: '❌' });
  }
}

async function loadQuests() {
  await questStore.init();
}

watch(() => props.visible, (val) => {
  if (val) loadQuests();
});

onMounted(() => {
  if (props.visible) loadQuests();
});
</script>

<style lang="less" scoped>
.quest-tabs {
  display: flex;
  gap: @spacing-lg;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: @spacing-md 18px;
  background: @white-10;
  border: @border-card;
  border-radius: @radius-md;
  color: @popup-text-color;
  font-size: @font-md;
  cursor: pointer;
  transition: all @transition-normal;
}

.tab-btn:hover {
  border-color: @color-dim-gray;
}

.tab-btn.active {
  background: @gold-bg-active;
  border-color: @accent-color;
  color: @accent-color;
}

.quest-list {
  .flex-col();
  gap: @spacing-lg;
  max-height: 400px;
  overflow-y: auto;
}

.quest-card {
  background: @white-05;
  border: @border-card;
  border-radius: @radius-md;
  padding: 14px;
  display: flex;
  gap: @spacing-lg;
  /* 任务卡片入场动画 */
  animation: card-slide-in 0.35s ease;
}

.quest-card.available {
  border-color: @skill-blue;
}

.quest-card.turnin {
  border-color: @heal-hp;
}

.quest-icon {
  font-size: @font-5xl;
  flex-shrink: 0;
}

.quest-content {
  flex: 1;
}

.quest-header-row {
  .flex-between();
  margin-bottom: @spacing-sm;
}

.quest-content h3 {
  font-size: @font-lg;
  color: @popup-text-color;
  font-weight: @font-weight-bold;
  margin: 0;
}

.quest-level {
  padding: 3px @spacing-md;
  background: @gold-bg-active;
  border-radius: @radius-sm;
  color: @accent-color;
  font-size: @font-sm;
}

.quest-status {
  padding: 3px @spacing-md;
  background: rgba(76, 175, 80, 0.2);
  border-radius: @radius-sm;
  color: @heal-hp;
  font-size: @font-sm;
}

.quest-desc {
  color: #aaa;
  font-size: @font-base;
  margin: 6px 0;
}

.quest-objectives {
  .flex-col();
  gap: @spacing-xs;
  margin-bottom: @spacing-md;
}

.objective {
  display: flex;
  align-items: center;
  gap: @spacing-md;
  padding: @spacing-xs @spacing-md;
  background: @white-05;
  border-radius: @radius-sm;
}

.objective-text {
  flex: 1;
  color: #ccc;
  font-size: @font-base;
}

.objective-target {
  color: @accent-color;
  font-size: @font-base;
}

.quest-rewards {
  display: flex;
  gap: @spacing-lg;
  margin-bottom: @spacing-lg;
}

.quest-rewards span {
  padding: 3px @spacing-md;
  background: @white-10;
  border-radius: @radius-sm;
  font-size: @font-base;
}

.accept-btn, .claim-btn {
  padding: @spacing-sm 14px;
  border: none;
  border-radius: @radius-sm;
  font-size: @font-base;
  font-weight: @font-weight-bold;
  cursor: pointer;
  transition: all @transition-normal;
}

.accept-btn {
  background: linear-gradient(135deg, @heal-hp, #45a049);
  color: @popup-text-color;
}

.claim-btn {
  background: linear-gradient(135deg, @accent-color, #ff8c00);
  color: @color-text-dark;
}

.accept-btn:hover:not(:disabled), .claim-btn:hover {
  transform: translateY(-2px);
}

.accept-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 32px;
  background: @overlay-mid;
  border-radius: @radius-md;
  border: 2px dashed @popup-border-color;
}

.empty-icon {
  font-size: 40px;
  margin-bottom: @spacing-xl;
}

.empty-state p {
  color: @color-dodge;
  font-size: @font-md;
}
</style>
