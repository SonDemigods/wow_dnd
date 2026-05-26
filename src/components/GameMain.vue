<template>
  <div class="game-main">
    <div class="game-header">
      <div class="player-info" @click="showCharacterInfo = true">
        <div class="player-icon">{{ getRaceIcon(character.raceId || 'human') }}</div>
        <div class="player-details">
          <div class="player-name">{{ character.name }}</div>
          <div class="player-level">Lv.{{ character.level }}</div>
        </div>
      </div>
      <div class="player-resources">
        <div class="resource-bar hp-bar">
          <div class="resource-label">HP</div>
          <div class="resource-fill" :style="{ width: hpPercent + '%' }"></div>
          <div class="resource-text">{{ currentHp }} / {{ maxHp }}</div>
        </div>
        <div class="resource-bar mp-bar">
          <div class="resource-label">MP</div>
          <div class="resource-fill" :style="{ width: mpPercent + '%' }"></div>
          <div class="resource-text">{{ currentMp }} / {{ maxMp }}</div>
        </div>
        <div class="resource-bar exp-bar">
          <div class="resource-label">EXP</div>
          <div class="resource-fill" :style="{ width: expPercent + '%' }"></div>
          <div class="resource-text">{{ exp }} / {{ expToNext }}</div>
        </div>
      </div>
      <div class="header-actions">
        <div class="player-gold">💰 {{ gold }}</div>
      </div>
    </div>

    <div class="game-content">
      <div class="content-tabs">
        <button 
          :class="['content-tab', { active: currentContentTab === 'map' }]"
          @click="currentContentTab = 'map'"
        >
          🗺 大地图
        </button>
        <button 
          :class="['content-tab', { active: currentContentTab === 'explore' }]"
          @click="currentContentTab = 'explore'"
        >
          🏕 探索
        </button>
        <div class="area-info" v-if="currentContentTab === 'map'">
          区域: {{ currentArea }}
        </div>
      </div>

      <div class="content-view">
        <MapView v-if="currentContentTab === 'map'" />
        <ExplorationView v-else />
      </div>
    </div>

    <div class="game-footer">
      <button class="footer-btn" @click="showCharacterInfo = true" title="角色">
        <span class="footer-icon">👤</span>
        <span class="footer-text">角色</span>
      </button>
      <button class="footer-btn" @click="showInventory = true" title="背包">
        <span class="footer-icon">🎒</span>
        <span class="footer-text">背包</span>
      </button>
      <button class="footer-btn" @click="showSkills = true" title="技能">
        <span class="footer-icon">📜</span>
        <span class="footer-text">技能</span>
      </button>
      <button class="footer-btn" @click="showQuests = true" title="任务">
        <span class="footer-icon">📋</span>
        <span class="footer-text">任务</span>
      </button>
      <button class="footer-btn" @click="showAdventureLog = true" title="日志">
        <span class="footer-icon">📝</span>
        <span class="footer-text">日志</span>
      </button>
      <button class="footer-btn exit-btn" @click="handleExit" title="退出">
        <span class="footer-icon">🚪</span>
        <span class="footer-text">退出</span>
      </button>
    </div>

    <div v-if="showNotification" class="notification" :class="notificationType">
      {{ notificationMessage }}
    </div>

    <CharacterInfoPopup 
      :visible="showCharacterInfo" 
      @close="showCharacterInfo = false" 
    />
    
    <InventoryPopup 
      :visible="showInventory" 
      @close="showInventory = false" 
    />
    
    <SkillsPopup 
      :visible="showSkills" 
      @close="showSkills = false" 
    />
    
    <QuestPopup 
      :visible="showQuests" 
      @close="showQuests = false" 
    />
    
    <AdventureLogPopup 
      :visible="showAdventureLog" 
      :current-area="currentArea"
      @close="showAdventureLog = false" 
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useCharacterStore } from '@/modules/character';
import { useMapStore } from '@/modules/map';
import MapView from './MapView.vue';
import ExplorationView from './ExplorationView.vue';
import InventoryPopup from './InventoryPopup.vue';
import SkillsPopup from './SkillsPopup.vue';
import QuestPopup from './QuestPopup.vue';
import CharacterInfoPopup from './CharacterInfoPopup.vue';
import AdventureLogPopup from './AdventureLogPopup.vue';

const emit = defineEmits<{
  (e: 'exit'): void;
}>();

const characterStore = useCharacterStore();
const mapStore = useMapStore();

const currentContentTab = ref('map');
const showNotification = ref(false);
const notificationMessage = ref('');
const notificationType = ref('info');
const showCharacterInfo = ref(false);
const showInventory = ref(false);
const showSkills = ref(false);
const showQuests = ref(false);
const showAdventureLog = ref(false);

const character = computed(() => characterStore.character || {});
const currentHp = computed(() => characterStore.hp);
const maxHp = computed(() => characterStore.maxHp);
const currentMp = computed(() => characterStore.mana);
const maxMp = computed(() => characterStore.maxMana);
const hpPercent = computed(() => characterStore.hpPercentage);
const mpPercent = computed(() => characterStore.manaPercentage);
const exp = computed(() => characterStore.exp);
const expToNext = computed(() => characterStore.expToNextLevel);
const expPercent = computed(() => characterStore.expPercentage);
const gold = computed(() => characterStore.gold);
const currentArea = computed(() => mapStore.getCurrentLocation?.name || '未知区域');

const races: Record<string, string> = {
  human: '👨', dwarf: '🧔', gnome: '👦', nightelf: '🌙', draenei: '📜',
  orc: '👹', undead: '💀', tauren: '🐂', troll: '👺', bloodelves: '🧝',
  worgen: '🐺', pandaren: '🐼', goblin: '👺', voidelf: '🌌', lightforgeddraenei: '✨',
  darkirondwarf: '⛏️', kul_tiran: '🌊', mechagnome: '🤖', nightborne: '🌙',
  highmountaintauren: '⛰️', magharorc: '🔥', zandalari: '🐊', vulpera: '🦊',
  dracthyr: '🐉', earthen: '🪨', harenei: '✨'
};

function getRaceIcon(race: string) {
  return races[race] || '👤';
}

function showNotif(message: string, type: string = 'info') {
  notificationMessage.value = message;
  notificationType.value = type;
  showNotification.value = true;
  setTimeout(() => {
    showNotification.value = false;
  }, 3000);
}

function handleExit() {
  emit('exit');
}

defineExpose({ showNotif });
</script>

<style scoped>
.game-main {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  display: flex;
  flex-direction: column;
}

.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: rgba(0, 0, 0, 0.5);
  border-bottom: 2px solid #4a4a4a;
  flex-wrap: wrap;
  gap: 12px;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  transition: background 0.2s;
}

.player-info:hover {
  background: rgba(255, 255, 255, 0.1);
}

.player-icon {
  font-size: 36px;
}

.player-details {
  display: flex;
  flex-direction: column;
}

.player-name {
  font-size: 16px;
  color: #fff;
  font-weight: bold;
}

.player-level {
  font-size: 12px;
  color: #ffd700;
}

.player-resources {
  flex: 1;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.resource-bar {
  position: relative;
  height: 20px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.hp-bar .resource-fill {
  background: linear-gradient(90deg, #ff4444, #ff0000);
}

.mp-bar .resource-fill {
  background: linear-gradient(90deg, #4444ff, #0000ff);
}

.exp-bar .resource-fill {
  background: linear-gradient(90deg, #ffd700, #daa520);
}

.resource-label {
  position: absolute;
  left: 6px;
  top: 2px;
  font-size: 10px;
  color: #fff;
  font-weight: bold;
  z-index: 1;
}

.resource-text {
  position: absolute;
  right: 6px;
  top: 2px;
  font-size: 10px;
  color: #fff;
  z-index: 1;
}

.resource-fill {
  height: 100%;
  transition: width 0.3s;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.player-gold {
  font-size: 18px;
  font-weight: bold;
}

.game-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-tabs {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid #4a4a4a;
}

.content-tab {
  padding: 8px 24px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid #4a4a4a;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.content-tab:hover {
  border-color: #666;
  background: rgba(255, 255, 255, 0.1);
}

.content-tab.active {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
  color: #ffd700;
}

.area-info {
  margin-left: auto;
  color: #8b8b8b;
  font-size: 14px;
}

.content-view {
  flex: 1;
  padding: 16px;
  overflow: auto;
}

.game-footer {
  display: flex;
  justify-content: space-around;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.5);
  border-top: 2px solid #4a4a4a;
}

.footer-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  transition: all 0.3s;
  min-width: 60px;
}

.footer-btn:hover {
  border-color: #666;
  background: rgba(255, 255, 255, 0.1);
}

.footer-btn.exit-btn:hover {
  border-color: #ff4444;
  background: rgba(255, 68, 68, 0.2);
}

.footer-icon {
  font-size: 22px;
}

.footer-text {
  font-size: 11px;
}

.notification {
  position: fixed;
  top: 120px;
  left: 50%;
  transform: translateX(-50%);
  padding: 14px 28px;
  border-radius: 8px;
  color: #fff;
  font-weight: bold;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

.notification.info {
  background: rgba(0, 150, 255, 0.9);
}

.notification.success {
  background: rgba(76, 175, 80, 0.9);
}

.notification.error {
  background: rgba(255, 0, 0, 0.9);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@media (max-width: 768px) {
  .game-header {
    padding: 10px 16px;
  }
  
  .player-icon {
    font-size: 28px;
  }
  
  .player-name {
    font-size: 14px;
  }
  
  .player-level {
    font-size: 11px;
  }
  
  .player-resources {
    max-width: 100%;
    order: 3;
    width: 100%;
  }
  
  .resource-bar {
    height: 18px;
  }
  
  .resource-label,
  .resource-text {
    font-size: 9px;
  }
  
  .player-gold {
    font-size: 16px;
  }
  
  .content-tabs {
    padding: 10px 16px;
    gap: 10px;
  }
  
  .content-tab {
    padding: 6px 16px;
    font-size: 12px;
  }
  
  .area-info {
    font-size: 12px;
  }
  
  .footer-btn {
    padding: 6px 10px;
    min-width: 50px;
  }
  
  .footer-icon {
    font-size: 18px;
  }
  
  .footer-text {
    font-size: 10px;
  }
}

@media (max-width: 480px) {
  .footer-btn {
    min-width: 45px;
    padding: 4px 6px;
  }
  
  .footer-icon {
    font-size: 16px;
  }
  
  .footer-text {
    font-size: 9px;
  }
}
</style>