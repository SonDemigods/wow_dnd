<template>
  <BasePopup :visible="visible" title="任务看板" @close="$emit('close')">
    <template #default>
      <div class="quest-tabs">
        <button 
          :class="['tab-btn', { active: currentTab === 'available' }]"
          @click="currentTab = 'available'"
        >
          可接取任务
        </button>
        <button 
          :class="['tab-btn', { active: currentTab === 'turnin' }]"
          @click="currentTab = 'turnin'"
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
          <div class="quest-icon">{{ getQuestIcon(quest.type) }}</div>
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
                <span class="objective-text">{{ obj.description }}</span>
                <span class="objective-target">{{ obj.target }}</span>
              </div>
            </div>
            <div class="quest-rewards">
              <span v-if="quest.goldReward">💰 {{ quest.goldReward }}</span>
              <span v-if="quest.xpReward">✨ {{ quest.xpReward }}</span>
              <span v-if="quest.itemRewards?.length">📦 {{ quest.itemRewards.length }}</span>
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
          <div class="empty-icon">📋</div>
          <p>暂无可接取的任务</p>
        </div>
      </div>

      <div v-else class="quest-list">
        <div 
          v-for="quest in turnInQuests" 
          :key="quest.id"
          class="quest-card turnin"
        >
          <div class="quest-icon">🏆</div>
          <div class="quest-content">
            <div class="quest-header-row">
              <h3>{{ quest.title }}</h3>
              <span class="quest-status">可交付</span>
            </div>
            <p class="quest-desc">{{ quest.description }}</p>
            <div class="quest-rewards">
              <span v-if="quest.goldReward">💰 {{ quest.goldReward }}</span>
              <span v-if="quest.xpReward">✨ {{ quest.xpReward }}</span>
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
          <div class="empty-icon">🏆</div>
          <p>暂无可交付的任务</p>
        </div>
      </div>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { questService } from '@/modules/quest';
import { characterService } from '@/modules/character';
import type { QuestDefinition } from '@/modules/quest';
import BasePopup from '../common/BasePopup.vue';

const props = defineProps<{
  visible: boolean;
  boardId?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const currentTab = ref<'available' | 'turnin'>('available');

const availableQuests = ref<QuestDefinition[]>([]);
const turnInQuests = ref<QuestDefinition[]>([]);

const characterLevel = computed(() => characterService.getLevel());

const questIcons: Record<string, string> = {
  kill: '⚔️',
  collect: '📦'
};

function getQuestIcon(type: string) {
  return questIcons[type] || '📋';
}

function acceptQuest(questId: string) {
  const success = props.boardId 
    ? questService.acceptQuestFromBoard(props.boardId, questId)
    : questService.acceptQuest(questId);
  if (success) {
    const quest = questService.getQuestDefinition(questId);
    alert(`已接受任务: ${quest?.title || questId}`);
    loadQuests();
  } else {
    alert('无法接受此任务');
  }
}

function turnInQuest(questId: string) {
  const success = props.boardId
    ? questService.turnInQuestToBoard(props.boardId, questId)
    : questService.turnInQuest(questId);
  if (success) {
    const quest = questService.getQuestDefinition(questId);
    alert(`已领取奖励: ${quest?.title || questId}`);
    loadQuests();
  } else {
    alert('无法领取奖励');
  }
}

async function loadQuests() {
  await questService.init();

  if (props.boardId) {
    const boardQuests = questService.getQuestsFromBoard(props.boardId);
    availableQuests.value = boardQuests.filter(q => questService.isQuestAvailable(q.id));
    turnInQuests.value = questService.getQuestsToTurnIn(props.boardId);
  } else {
    const availableIds = questService.getAvailableQuests();
    availableQuests.value = availableIds.map(id => questService.getQuestDefinition(id)).filter(Boolean) as QuestDefinition[];

    const completedIds = questService.getCompletedQuests();
    turnInQuests.value = completedIds.map(id => questService.getQuestDefinition(id)).filter(Boolean) as QuestDefinition[];
  }
}

watch(() => props.visible, (val) => {
  if (val) loadQuests();
});

onMounted(() => {
  if (props.visible) loadQuests();
});
</script>

<style scoped>
.quest-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 8px 18px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid #4a4a4a;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.tab-btn:hover {
  border-color: #666;
}

.tab-btn.active {
  background: rgba(255, 215, 0, 0.2);
  border-color: #ffd700;
  color: #ffd700;
}

.quest-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;
}

.quest-card {
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid #4a4a4a;
  border-radius: 6px;
  padding: 14px;
  display: flex;
  gap: 10px;
}

.quest-card.available {
  border-color: #0099ff;
}

.quest-card.turnin {
  border-color: #4CAF50;
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

.quest-level {
  padding: 3px 8px;
  background: rgba(255, 215, 0, 0.2);
  border-radius: 4px;
  color: #ffd700;
  font-size: 12px;
}

.quest-status {
  padding: 3px 8px;
  background: rgba(76, 175, 80, 0.2);
  border-radius: 4px;
  color: #4CAF50;
  font-size: 12px;
}

.quest-desc {
  color: #aaa;
  font-size: 13px;
  margin: 6px 0;
}

.quest-objectives {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.objective {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.objective-text {
  flex: 1;
  color: #ccc;
  font-size: 13px;
}

.objective-target {
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

.accept-btn, .claim-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.accept-btn {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: #fff;
}

.claim-btn {
  background: linear-gradient(135deg, #ffd700, #ff8c00);
  color: #000;
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
