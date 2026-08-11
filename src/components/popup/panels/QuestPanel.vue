<template>
  <div class="quest-panel">
    <div class="quest-list">
      <div
        v-for="quest in activeQuests"
        :key="quest.questId"
        class="quest-card"
      >
        <BaseIcon :name="getQuestIcon(quest.definition.type).name" :gradient="getQuestIcon(quest.definition.type).gradient" :size="34" />
        <div class="quest-content">
          <div class="quest-header-row">
            <h3>{{ quest.definition.title }}</h3>
            <span :class="['quest-status', quest.instance.status]">{{ getStatusText(quest.instance.status) }}</span>
          </div>
          <p class="quest-desc">{{ quest.definition.description }}</p>
          <div class="objectives">
            <div
              v-for="(obj, idx) in quest.definition.objectives"
              :key="obj.key"
              :class="['objective', { completed: isObjectiveCompleted(quest.instance, idx) }]"
            >
              <span class="objective-checkbox"><BaseIcon :name="getObjectiveIconName(quest.instance, idx)" gradient="heal" :size="14" /></span>
              <span class="objective-text">{{ getObjectiveText(obj) }}</span>
              <span class="objective-progress">{{ getObjectiveProgress(quest.instance, idx) }}/{{ obj.target }}</span>
            </div>
          </div>
          <div class="quest-rewards">
            <span v-if="quest.definition.goldReward"><BaseIcon name="two-coins" gradient="gold" :size="14" /> {{ quest.definition.goldReward }}</span>
            <span v-if="quest.definition.xpReward"><BaseIcon name="star-formation" gradient="gold" :size="14" /> {{ quest.definition.xpReward }}</span>
          </div>
          <div class="quest-actions" v-if="quest.instance.status !== 'completed'">
            <button
              class="abandon-btn"
              @click="abandonQuest(quest.questId)"
            >
              放弃
            </button>
          </div>
        </div>
      </div>
    </div>

    <EmptyState v-if="!activeQuests.length" icon="notebook" text="暂无进行中的任务" />

    <ConfirmPopup
      :visible="confirmState.visible"
      title="确认放弃"
      :message="confirmState.message"
      type="danger"
      @confirm="onConfirmAbandon"
      @cancel="confirmState.visible = false"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 任务面板内容组件（无 BasePopup 外壳）
 * @description 展示玩家当前进行中的任务列表，支持查看目标进度和放弃任务。供 ProgressPopup 分段复用。
 */
import { reactive, computed, onMounted, watch } from 'vue';
import { useQuestStore } from '@/modules/quest';
import { eventBus, GameEvents } from '@/modules/bus';
import { useToast } from '@/composables/useToast';
import type { QuestInstance, QuestStatus } from '@/modules/quest';
import { getObjectiveText } from '@/modules/quest';
import BaseIcon from '@/components/common/BaseIcon.vue';
import ConfirmPopup from '../../common/ConfirmPopup.vue';
import EmptyState from '../../common/EmptyState.vue';

const props = defineProps<{
  visible: boolean;
}>();

const toast = useToast();
const questStore = useQuestStore();

/** 活跃任务列表，直接从 Quest Store 响应式数据派生 */
const activeQuests = computed(() => {
  const inProgressIds = questStore.activeQuests.map(i => i.questId);
  const completedIds = questStore.completedQuests.map(i => i.questId);
  const allIds = [...inProgressIds, ...completedIds];

  return allIds
    .map(id => {
      const definition = questStore.getQuestDefinition(id);
      const instance = questStore.getQuestInstance(id);
      if (!definition || !instance) return null;
      return { questId: id, definition, instance };
    })
    .filter((q): q is NonNullable<typeof q> => q !== null);
});

const confirmState = reactive({
  visible: false,
  message: '',
  questId: ''
});

const questIcons: Record<string, { name: string; gradient: string }> = {
  kill: { name: 'sword-clash', gradient: 'physical' },
  collect: { name: 'treasure-map', gradient: 'gold' },
  explore: { name: 'compass', gradient: 'nature' }
};

const statusTexts: Record<string, string> = {
  in_progress: '进行中',
  completed: '可交付'
};

function getQuestIcon(type: string) {
  return questIcons[type] || { name: 'scroll-unfurled', gradient: 'gold' };
}

function getStatusText(status: QuestStatus) {
  return statusTexts[status] || status;
}

function isObjectiveCompleted(instance: QuestInstance, index: number): boolean {
  return instance.progress[index]?.current >= instance.progress[index]?.target;
}

function getObjectiveProgress(instance: QuestInstance, index: number): number {
  return instance.progress[index]?.current || 0;
}

function getObjectiveIconName(instance: QuestInstance, index: number) {
  return isObjectiveCompleted(instance, index) ? 'check-mark' : 'empty-box';
}

function abandonQuest(questId: string) {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'quest_abandon_btn' });
  confirmState.questId = questId;
  confirmState.message = '确定放弃此任务吗？放弃后任务进度将被清除。';
  confirmState.visible = true;
}

async function onConfirmAbandon() {
  const questId = confirmState.questId;
  confirmState.visible = false;
  try {
    const success = await questStore.abandonQuest(questId);
    if (success) {
      await loadQuests();
      toast.show({ message: '已放弃任务', type: 'warning', icon: '⚠️' });
    }
  } catch (err) {
    console.error('[QuestPanel] onConfirmAbandon 失败:', err);
    toast.show({ message: '放弃任务失败，请重试', type: 'danger' });
  }
}

async function loadQuests() {
  try {
    await questStore.init();
  } catch (err) {
    console.error('[QuestPanel] loadQuests 失败:', err);
    toast.show({ message: '加载任务失败，请重试', type: 'danger' });
  }
}

watch(() => props.visible, (val) => {
  if (val) loadQuests();
});

onMounted(() => {
  if (props.visible) loadQuests();
});
</script>

<style lang="less" scoped>
.quest-list {
  display: flex;
  flex-direction: column;
  gap: @spacing-lg;
}

.quest-card {
  background: @white-05;
  border: @border-card;
  border-radius: @radius-md;
  padding: 14px;
  display: flex;
  gap: @spacing-lg;
  animation: card-slide-in 0.35s ease;
}

.quest-content {
  flex: 1;
}

.quest-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: @spacing-sm;
}

.quest-content h3 {
  font-size: @font-lg;
  color: @popup-text-color;
  font-weight: @font-weight-bold;
  margin: 0;
}

.quest-status {
  padding: 3px @spacing-md;
  border-radius: @radius-sm;
  font-size: @font-sm;
}

.quest-status.in_progress {
  background: rgba(0, 153, 255, 0.2);
  color: @skill-blue;
}

.quest-status.completed {
  background: rgba(76, 175, 80, 0.2);
  color: @heal-hp;
}

.quest-desc {
  color: #aaa;
  font-size: @font-base;
  margin: 6px 0;
}

.objectives {
  display: flex;
  flex-direction: column;
  gap: @spacing-sm;
  margin-bottom: @spacing-lg;
}

.objective {
  display: flex;
  align-items: center;
  gap: @spacing-md;
  padding: @spacing-sm @spacing-lg;
  background: @white-05;
  border-radius: @radius-sm;
}

.objective.completed {
  background: rgba(76, 175, 80, 0.2);
}

.objective-checkbox {
  font-size: @font-sm;
  color: @color-dodge;
}

.objective.completed .objective-checkbox {
  color: @heal-hp;
}

.objective-text {
  flex: 1;
  color: #ccc;
  font-size: @font-base;
}

.objective-progress {
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

.quest-actions {
  display: flex;
  gap: @spacing-lg;
}

.abandon-btn {
  padding: @spacing-sm 14px;
  border: none;
  border-radius: @radius-sm;
  font-size: @font-base;
  font-weight: @font-weight-bold;
  cursor: pointer;
  background: rgba(255, 68, 68, 0.2);
  color: @danger-color;
  transition: all @transition-quick;
}

.abandon-btn:hover {
  background: rgba(255, 68, 68, 0.35);
}
</style>