<template>
  <div v-if="visible" class="popup-overlay">
    <div class="popup-content">
      <div class="quest-view">
        <div class="quest-header">
          <h2>任务看板</h2>
          <button class="close-btn" @click="$emit('close')">×</button>
        </div>

    <div class="quest-tabs">
      <button 
        :class="['tab-btn', { active: currentTab === 'available' }]"
        @click="currentTab = 'available'"
      >
        可接取任务      </button>
      <button 
        :class="['tab-btn', { active: currentTab === 'active' }]"
        @click="currentTab = 'active'"
      >
        进行中任务      </button>
      <button 
        :class="['tab-btn', { active: currentTab === 'completed' }]"
        @click="currentTab = 'completed'"
      >
        已完成任务      </button>
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
            <span class="quest-level">Lv.{{ quest.requiredLevel }}</span>
          </div>
          <p class="quest-desc">{{ quest.description }}</p>
          <div class="quest-rewards">
            <span v-if="quest.rewards.gold">💰 {{ quest.rewards.gold }}</span>
            <span v-if="quest.rewards.exp">✨ {{ quest.rewards.exp }}</span>
            <span v-if="quest.rewards.items">📦 {{ quest.rewards.items.length }}</span>
          </div>
          <button 
            class="accept-btn"
            :disabled="characterLevel < quest.requiredLevel"
            @click="acceptQuest(quest.id)"
          >
            接取任务
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="currentTab === 'active'" class="quest-list">
      <div 
        v-for="quest in activeQuests" 
        :key="quest.id"
        class="quest-card active"
      >
        <div class="quest-icon">{{ getQuestIcon(quest.type) }}</div>
        <div class="quest-content">
          <div class="quest-header-row">
            <h3>{{ quest.title }}</h3>
            <span class="quest-status">{{ getStatusText(quest.status) }}</span>
          </div>
          <p class="quest-desc">{{ quest.description }}</p>
          <div class="objectives">
            <div 
              v-for="obj in quest.objectives" 
              :key="obj.id"
              :class="['objective', { completed: obj.completed }]"
            >
              <span class="objective-checkbox">{{ obj.completed ? '☑️' : '⬜' }}</span>
              <span class="objective-text">{{ obj.description }}</span>
              <span class="objective-progress">{{ obj.current }}/{{ obj.required }}</span>
            </div>
          </div>
          <div class="quest-actions">
            <button 
              v-if="quest.status === 'completed'"
              class="claim-btn"
              @click="claimReward(quest.id)"
            >
              领取奖励
            </button>
            <button 
              v-else
              class="abandon-btn"
              @click="abandonQuest(quest.id)"
            >
              放弃任务
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="quest-list">
      <div 
        v-for="quest in completedQuests" 
        :key="quest.id"
        class="quest-card completed"
      >
        <div class="quest-icon">🏆</div>
        <div class="quest-content">
          <h3>{{ quest.title }}</h3>
          <p class="quest-desc">{{ quest.description }}</p>
          <div class="quest-rewards">
            <span v-if="quest.rewards.gold">💰 {{ quest.rewards.gold }}</span>
            <span v-if="quest.rewards.exp">✨ {{ quest.rewards.exp }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!availableQuests.length && currentTab === 'available'" class="empty-state">
      <div class="empty-icon">📋</div>
      <p>暂无可用任务</p>
    </div>

    <div v-if="!activeQuests.length && currentTab === 'active'" class="empty-state">
      <div class="empty-icon">📝</div>
      <p>暂无进行中的任务</p>
    </div>

    <div v-if="!completedQuests.length && currentTab === 'completed'" class="empty-state">
      <div class="empty-icon">🏆</div>
      <p>暂无已完成的任务</p>
    </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { questService } from '@/modules/quest';
import { characterService } from '@/modules/character';
import type { Quest, QuestStatus } from '@/modules/quest';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const currentTab = ref<'available' | 'active' | 'completed'>('available');

const availableQuests = ref<Quest[]>([]);
const activeQuests = ref<Quest[]>([]);
const completedQuests = ref<Quest[]>([]);

const characterLevel = computed(() => characterService.getLevel());

const questIcons: Record<string, string> = {
  main: '⭐',
  side: '📌',
  daily: '📅'
};

const statusTexts: Record<QuestStatus, string> = {
  available: '可接取',
  not_available: '不可接',
  in_progress: '进行中',
  completed: '可交付',
  turned_in: '已领取',
  abandoned: '已放弃'
};

function getQuestIcon(type: string) {
  return questIcons[type] || '📋';
}

function getStatusText(status: QuestStatus) {
  return statusTexts[status];
}

function acceptQuest(questId: string) {
  const success = questService.acceptQuest(questId);
  if (success) {
    const quest = questService.getQuestDefinition(questId);
    alert(`已接受任务: ${quest?.title || questId}`);
    loadQuests();
  } else {
    alert('无法接受此任务');
  }
}

function claimReward(questId: string) {
  const success = questService.turnInQuest(questId);
  if (success) {
    const quest = questService.getQuestDefinition(questId);
    alert(`已领取奖励: ${quest?.title || questId}`);
    loadQuests();
  } else {
    alert('无法领取奖励');
  }
}

function abandonQuest(questId: string) {
  if (!confirm('确定放弃此任务吗？')) return;
  const success = questService.abandonQuest(questId);
  if (success) {
    loadQuests();
    alert('已放弃任务');
  }
}

function loadQuests() {
  const availableIds = questService.getAvailableQuests();
  availableQuests.value = availableIds.map(id => questService.getQuestDefinition(id)).filter(Boolean);
  
  const activeIds = questService.getInProgressQuests();
  activeQuests.value = activeIds.map(id => questService.getQuestDefinition(id)).filter(Boolean);
  
  const completedIds = questService.getCompletedQuests();
  completedQuests.value = completedIds.map(id => questService.getQuestDefinition(id)).filter(Boolean);
}

onMounted(() => {
  loadQuests();
});
</script>

<style scoped>
.quest-view {
  max-width: 800px;
  margin: 0 auto;
}

.quest-header {
  margin-bottom: 20px;
}

.quest-header h2 {
  font-size: 24px;
  color: #ffd700;
}

.quest-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.tab-btn {
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  color: #fff;
  font-size: 16px;
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
  gap: 12px;
}

.quest-card {
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  gap: 12px;
}

.quest-card.available {
  border-color: #0099ff;
}

.quest-card.active {
  border-color: #ffd700;
}

.quest-card.completed {
  border-color: #4CAF50;
  opacity: 0.8;
}

.quest-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.quest-content {
  flex: 1;
}

.quest-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.quest-content h3 {
  font-size: 18px;
  color: #fff;
  font-weight: bold;
}

.quest-level {
  padding: 4px 8px;
  background: rgba(255, 215, 0, 0.2);
  border-radius: 4px;
  color: #ffd700;
  font-size: 12px;
}

.quest-status {
  padding: 4px 8px;
  background: rgba(0, 153, 255, 0.2);
  border-radius: 4px;
  color: #0099ff;
  font-size: 12px;
}

.quest-desc {
  color: #aaa;
  font-size: 14px;
  margin-bottom: 12px;
}

.quest-rewards {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.quest-rewards span {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  font-size: 14px;
}

.objectives {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.objective {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.objective.completed {
  background: rgba(76, 175, 80, 0.2);
}

.objective-checkbox {
  font-size: 14px;
  color: #888;
}

.objective.completed .objective-checkbox {
  color: #4CAF50;
}

.objective-text {
  flex: 1;
  color: #ccc;
  font-size: 14px;
}

.objective-progress {
  color: #ffd700;
  font-size: 14px;
}

.quest-actions {
  display: flex;
  gap: 12px;
}

.accept-btn, .claim-btn, .abandon-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
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

.abandon-btn {
  background: linear-gradient(135deg, #ff4444, #cc0000);
  color: #fff;
}

.accept-btn:hover:not(:disabled), .claim-btn:hover, .abandon-btn:hover {
  transform: translateY(-2px);
}

.accept-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 40px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 8px;
  border: 2px dashed #4a4a4a;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state p {
  color: #888;
}
</style>