<template>
  <BasePopup :visible="visible" title="任务日志" @close="$emit('close')">
    <template #default>
      <div class="quest-list">
        <div 
          v-for="quest in activeQuests" 
          :key="quest.questId"
          class="quest-card"
        >
          <div class="quest-icon">{{ getQuestIcon(quest.definition.type) }}</div>
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
                <span class="objective-checkbox">{{ isObjectiveCompleted(quest.instance, idx) ? '☑️' : '⬜' }}</span>
                <span class="objective-text">{{ obj.description }}</span>
                <span class="objective-progress">{{ getObjectiveProgress(quest.instance, idx) }}/{{ obj.target }}</span>
              </div>
            </div>
            <div class="quest-rewards">
              <span v-if="quest.definition.goldReward">💰 {{ quest.definition.goldReward }}</span>
              <span v-if="quest.definition.xpReward">✨ {{ quest.definition.xpReward }}</span>
            </div>
            <div class="quest-actions">
              <button 
                v-if="quest.instance.status === 'completed'"
                class="claim-btn"
                @click="claimReward(quest.questId)"
              >
                领取奖励
              </button>
              <button 
                v-else
                class="abandon-btn"
                @click="abandonQuest(quest.questId)"
              >
                放弃任务
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!activeQuests.length" class="empty-state">
        <div class="empty-icon">📝</div>
        <p>暂无进行中的任务</p>
      </div>
    </template>
  </BasePopup>

  <ConfirmPopup
    :visible="confirmState.visible"
    title="确认放弃"
    :message="confirmState.message"
    type="danger"
    @confirm="onConfirmAbandon"
    @cancel="confirmState.visible = false"
  />
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';
import { questService } from '@/modules/quest';
import { useToast } from '@/composables/useToast';
import type { QuestDefinition, QuestInstance, QuestStatus } from '@/modules/quest';
import BasePopup from '../common/BasePopup.vue';
import ConfirmPopup from '../common/ConfirmPopup.vue';

interface ActiveQuest {
  questId: string;
  definition: QuestDefinition;
  instance: QuestInstance;
}

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const toast = useToast();
const activeQuests = ref<ActiveQuest[]>([]);

const confirmState = reactive({
  visible: false,
  message: '',
  questId: ''
});

const questIcons: Record<string, string> = {
  kill: '⚔️',
  collect: '📦'
};

const statusTexts: Record<string, string> = {
  in_progress: '进行中',
  completed: '可交付'
};

function getQuestIcon(type: string) {
  return questIcons[type] || '📋';
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

function claimReward(questId: string) {
  const success = questService.turnInQuest(questId);
  if (success) {
    const quest = questService.getQuestDefinition(questId);
    toast.show({ message: `已领取奖励: ${quest?.title || questId}`, type: 'success', icon: '🏆' });
    loadQuests();
  } else {
    toast.show({ message: '无法领取奖励', type: 'danger', icon: '❌' });
  }
}

function abandonQuest(questId: string) {
  confirmState.questId = questId;
  confirmState.message = '确定放弃此任务吗？放弃后任务进度将被清除。';
  confirmState.visible = true;
}

function onConfirmAbandon() {
  const questId = confirmState.questId;
  confirmState.visible = false;
  const success = questService.abandonQuest(questId);
  if (success) {
    loadQuests();
    toast.show({ message: '已放弃任务', type: 'warning', icon: '⚠️' });
  }
}

async function loadQuests() {
  await questService.init();
  
  const inProgressIds = questService.getInProgressQuests();
  const completedIds = questService.getCompletedQuests();
  const allIds = [...inProgressIds, ...completedIds];
  
  activeQuests.value = allIds
    .map(id => {
      const definition = questService.getQuestDefinition(id);
      const instance = questService.getQuestInstance(id);
      if (!definition || !instance) return null;
      return { questId: id, definition, instance };
    })
    .filter(Boolean) as ActiveQuest[];
}

watch(() => props.visible, (val) => {
  if (val) loadQuests();
});

onMounted(() => {
  if (props.visible) loadQuests();
});
</script>

<style scoped>
.quest-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.quest-card {
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid #4a4a4a;
  border-radius: 6px;
  padding: 14px;
  display: flex;
  gap: 10px;
}

.quest-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.quest-content {
  flex: 1;
}

.quest-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.quest-content h3 {
  font-size: 16px;
  color: #fff;
  font-weight: bold;
  margin: 0;
}

.quest-status {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.quest-status.in_progress {
  background: rgba(0, 153, 255, 0.2);
  color: #0099ff;
}

.quest-status.completed {
  background: rgba(76, 175, 80, 0.2);
  color: #4CAF50;
}

.quest-desc {
  color: #aaa;
  font-size: 13px;
  margin: 6px 0;
}

.objectives {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.objective {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.objective.completed {
  background: rgba(76, 175, 80, 0.2);
}

.objective-checkbox {
  font-size: 12px;
  color: #888;
}

.objective.completed .objective-checkbox {
  color: #4CAF50;
}

.objective-text {
  flex: 1;
  color: #ccc;
  font-size: 13px;
}

.objective-progress {
  color: #ffd700;
  font-size: 13px;
}

.quest-rewards {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.quest-rewards span {
  padding: 3px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  font-size: 13px;
}

.quest-actions {
  display: flex;
  gap: 10px;
}

.claim-btn, .abandon-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.claim-btn {
  background: linear-gradient(135deg, #ffd700, #ff8c00);
  color: #000;
}

.abandon-btn {
  background: linear-gradient(135deg, #ff4444, #cc0000);
  color: #fff;
}

.claim-btn:hover, .abandon-btn:hover {
  transform: translateY(-2px);
}

.empty-state {
  text-align: center;
  padding: 32px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 6px;
  border: 2px dashed #4a4a4a;
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.empty-state p {
  color: #888;
  font-size: 14px;
}
</style>
