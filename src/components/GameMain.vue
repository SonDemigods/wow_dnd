<template>
  <div class="game-main">
    <div class="game-header">
      <div class="player-info" @click="showCharacterInfo = true">
        <div class="player-icon">{{ getRaceIcon(character.race || 'human') }}</div>
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
      </div>
      <div class="header-actions">
        <button class="action-btn" @click="showAdventureLog = true" title="冒险日志">
          📜
        </button>
        <div class="player-gold">💰 {{ gold }}</div>
      </div>
    </div>

    <div class="game-nav">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        :class="['nav-btn', { active: currentTab === tab.id }]"
        @click="currentTab = tab.id"
      >
        <div class="nav-icon">{{ tab.icon }}</div>
        <div class="nav-text">{{ tab.name }}</div>
      </button>
    </div>

    <div class="game-content">
      <component :is="currentComponent" />
    </div>

    <div v-if="showNotification" class="notification" :class="notificationType">
      {{ notificationMessage }}
    </div>

    <CharacterInfoPopup 
      :visible="showCharacterInfo" 
      @close="showCharacterInfo = false" 
    />
    
    <AdventureLogPopup 
      :visible="showAdventureLog" 
      :current-area="currentArea"
      @close="showAdventureLog = false" 
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, markRaw } from 'vue';
import { useCharacterStore } from '@/modules/character';
import { useMapStore } from '@/modules/map';
import MapView from './MapView.vue';
import ExplorationView from './ExplorationView.vue';
import CombatView from './CombatView.vue';
import ShopPopup from './ShopPopup.vue';
import QuestPopup from './QuestPopup.vue';
import InventoryPopup from './InventoryPopup.vue';
import SkillsPopup from './SkillsPopup.vue';
import CharacterInfoPopup from './CharacterInfoPopup.vue';
import AdventureLogPopup from './AdventureLogPopup.vue';

const characterStore = useCharacterStore();
const mapStore = useMapStore();

const currentTab = ref('map');
const showNotification = ref(false);
const notificationMessage = ref('');
const notificationType = ref('info');
const showCharacterInfo = ref(false);
const showAdventureLog = ref(false);

const tabs = [
  { id: 'map', name: '地图', icon: '🗺' },
  { id: 'explore', name: '探索', icon: '🏕' },
  { id: 'combat', name: '战斗', icon: '⚔️' },
  { id: 'shop', name: '商店', icon: '🏪' },
  { id: 'quest', name: '任务', icon: '📋' },
  { id: 'inventory', name: '背包', icon: '🎒' },
  { id: 'skills', name: '技能', icon: '📜' }
];

const character = computed(() => characterStore.getCharacterInfo());
const attributes = computed(() => characterStore.attributes);
const currentHp = computed(() => character.value.currentHp || attributes.value.maxHp);
const maxHp = computed(() => attributes.value.maxHp);
const currentMp = computed(() => character.value.currentMp || attributes.value.maxMana);
const maxMp = computed(() => attributes.value.maxMana);
const hpPercent = computed(() => Math.round((currentHp.value / maxHp.value) * 100));
const mpPercent = computed(() => Math.round((currentMp.value / maxMp.value) * 100));
const gold = computed(() => characterStore.gold);
const currentArea = computed(() => mapStore.getCurrentArea()?.name || '未知区域');

const currentComponent = computed(() => {
  const components: Record<string, any> = {
    map: markRaw(MapView),
    explore: markRaw(ExplorationView),
    combat: markRaw(CombatView),
    shop: markRaw(ShopPopup),
    quest: markRaw(QuestPopup),
    inventory: markRaw(InventoryPopup),
    skills: markRaw(SkillsPopup)
  };
  return components[currentTab.value];
});

const races: Record<string, string> = {
  human: '👨', dwarf: '🧔', gnome: '👦', nightelf: '🌙', draenei: '📜',
  orc: '👹', undead: '💀', tauren: '🐂', troll: '👺', bloodelves: '🧝'
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

defineExpose({ showNotif });
</script>

<style scoped>
.game-main {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}

.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: rgba(0, 0, 0, 0.5);
  border-bottom: 2px solid #4a4a4a;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  transition: background 0.2s;
}

.player-info:hover {
  background: rgba(255, 255, 255, 0.1);
}

.player-icon {
  font-size: 40px;
}

.player-details {
  display: flex;
  flex-direction: column;
}

.player-name {
  font-size: 18px;
  color: #fff;
  font-weight: bold;
}

.player-level {
  font-size: 14px;
  color: #ffd700;
}

.player-resources {
  flex: 1;
  max-width: 300px;
  margin: 0 24px;
}

.resource-bar {
  position: relative;
  height: 24px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  margin-bottom: 8px;
  overflow: hidden;
}

.hp-bar .resource-fill {
  background: linear-gradient(90deg, #ff4444, #ff0000);
}

.mp-bar .resource-fill {
  background: linear-gradient(90deg, #4444ff, #0000ff);
}

.resource-label {
  position: absolute;
  left: 8px;
  top: 2px;
  font-size: 12px;
  color: #fff;
  font-weight: bold;
  z-index: 1;
}

.resource-text {
  position: absolute;
  right: 8px;
  top: 2px;
  font-size: 12px;
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
  gap: 16px;
}

.action-btn {
  font-size: 28px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: background 0.2s;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.player-gold {
  font-size: 20px;
  font-weight: bold;
}

.game-nav {
  display: flex;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid #4a4a4a;
}

.nav-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.nav-btn:hover {
  border-color: #666;
  background: rgba(255, 255, 255, 0.1);
}

.nav-btn.active {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
}

.nav-icon {
  font-size: 24px;
}

.nav-text {
  color: #fff;
  font-size: 12px;
}

.game-content {
  padding: 20px;
  min-height: 500px;
}

.notification {
  position: fixed;
  top: 200px;
  left: 50%;
  transform: translateX(-50%);
  padding: 16px 32px;
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
</style>