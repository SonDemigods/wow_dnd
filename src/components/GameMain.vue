<template>
  <div class="game-main">
    <div class="game-header">
      <div class="player-info" @click="showCharacterInfo = true">
        <div class="player-avatar">{{ getRaceIcon(character.raceId || 'human') }}</div>
        <div class="player-details">
          <div class="player-name">{{ character.name }}</div>
          <div class="player-meta">
            <span class="player-level">Lv.{{ character.level }}</span>
            <span class="player-gold">💰 {{ gold }}</span>
          </div>
        </div>
      </div>
      <div class="player-resources">
        <ResourceBar icon="❤️" name="HP" :current="currentHp" :max="maxHp" :percent="hpPercent" type="hp" />
        <ResourceBar icon="💧" name="MP" :current="currentMp" :max="maxMp" :percent="mpPercent" type="mp" />
        <ResourceBar icon="⭐" name="EXP" :current="exp" :max="expToNext" :percent="expPercent" type="exp" />
      </div>
    </div>

    <div class="game-content">
      <div class="content-tabs">
        <button 
          :class="['content-tab', { active: currentContentTab === 'map' }]"
          @click="currentContentTab = 'map'; mapDbService.saveCurrentTab('map')"
        >
          🗺 地图
        </button>
        <button 
          :class="['content-tab', { active: currentContentTab === 'explore', disabled: !hasCurrentLocation }]"
          @click="handleExploreTabClick"
        >
          🏕 探索
        </button>
        <div class="area-info">
          区域: {{ currentArea }}
        </div>
      </div>

      <div class="content-view">
        <MapView v-if="currentContentTab === 'map'" @enter-zone="currentContentTab = 'explore'" />
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
        <span class="footer-icon">⚔️</span>
        <span class="footer-text">技能</span>
      </button>
      <button class="footer-btn" @click="showQuests = true" title="任务">
        <span class="footer-icon">📋</span>
        <span class="footer-text">任务</span>
      </button>
      <button class="footer-btn" @click="showAdventureLog = true" title="日志">
        <span class="footer-icon">📜</span>
        <span class="footer-text">日志</span>
      </button>
      <button class="footer-btn exit-btn" @click="handleExit" title="退出">
        <span class="footer-icon">🚪</span>
        <span class="footer-text">退出</span>
      </button>
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
    
    <ShopPopup 
      :visible="showShop" 
      :shop-id="currentShopId"
      @close="handleShopClose" 
    />
    
    <QuestBoardPopup 
      :visible="showQuestBoard" 
      @close="showQuestBoard = false" 
    />

    <CombatPopup
      :visible="showCombat"
      @close="handleCombatClose"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useCharacterStore } from '@/modules/character';
import { useMapStore } from '@/modules/map';
import { mapDbService } from '@/modules/map/db';
import { eventBus, GameEvents } from '@/modules/bus/core';
import { enemyService } from '@/modules/enemy/service';
import { combatService } from '@/modules/combat/service';
import { useToast } from '@/composables/useToast';
import type { CombatResult } from '@/modules/combat/types';
import MapView from './MapView.vue';
import ExplorationView from './ExplorationView.vue';
import InventoryPopup from './popup/InventoryPopup.vue';
import SkillsPopup from './popup/SkillsPopup.vue';
import QuestPopup from './popup/QuestPopup.vue';
import ShopPopup from './popup/ShopPopup.vue';
import QuestBoardPopup from './popup/QuestBoardPopup.vue';
import CharacterInfoPopup from './popup/CharacterInfoPopup.vue';
import AdventureLogPopup from './popup/AdventureLogPopup.vue';
import CombatPopup from './popup/CombatPopup.vue';
import ResourceBar from './common/ResourceBar.vue';

const emit = defineEmits<{
  (e: 'exit'): void;
}>();

const characterStore = useCharacterStore();
const mapStore = useMapStore();
const toast = useToast();

const currentContentTab = ref('map');
const showCharacterInfo = ref(false);
const showInventory = ref(false);
const showSkills = ref(false);
const showQuests = ref(false);
const showAdventureLog = ref(false);
const showShop = ref(false);
const showQuestBoard = ref(false);
const showCombat = ref(false);
const currentShopId = ref('shop_inn');

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
const currentArea = computed(() => mapStore.getCurrentLocation?.displayName || '未知区域');
const hasCurrentLocation = computed(() => !!mapStore.getCurrentLocation);

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

function showNotif(message: string, type: 'info' | 'success' | 'warning' | 'danger' = 'info') {
  toast.show({ message, type });
}

function handleExit() {
  emit('exit');
}

function handleExploreTabClick() {
  if (!hasCurrentLocation.value) {
    showNotif('请先在地图上选择一个区域', 'info');
    return;
  }
  currentContentTab.value = 'explore';
  mapDbService.saveCurrentTab('explore');
}

// 监听探索格子翻开事件，处理交互
function handleCellExplored(data: { cellType?: string; interactionId?: string }) {
  const cellType = data?.cellType;
  if (cellType === 'shop') {
    currentShopId.value = data?.interactionId || 'shop_inn';
    showShop.value = true;
  } else if (cellType === 'board') {
    showQuestBoard.value = true;
  }
}

// 监听探索战斗事件
async function handleBattleTriggered(data: { eventData?: { monsterId?: string } }) {
  if (!data?.eventData?.monsterId) return;
  
  const monsterId = data.eventData.monsterId;
  
  // 从数据库获取敌人模板数据
  const enemy = await enemyService.createEnemy(monsterId);
  
  if (enemy) {
    combatService.startCombat(enemy);
    showCombat.value = true;
  }
}

// 监听物品发现事件
function handleItemFound(data: { itemId?: string; count?: number; itemName?: string }) {
  const itemName = data?.itemName || '未知物品';
  const count = data?.count || 1;
  showNotif(`发现物品: ${itemName} x${count}`, 'success');
}

// 监听陷阱触发事件
function handleTrapTriggered(data: { damage?: number; trapType?: string }) {
  const damage = data?.damage || 0;
  const trapType = data?.trapType || '陷阱';
  showNotif(`触发${trapType}，受到 ${damage} 点伤害`, 'danger');
}

// 监听随机事件
function handleRandomEvent(data: { message?: string; icon?: string }) {
  const message = data?.message || '触发了随机事件';
  showNotif(message, 'info');
}

function handleCombatClose(_result?: CombatResult) {
  showCombat.value = false;
}

function handleShopClose() {
  showShop.value = false;
  eventBus.emit(GameEvents.SHOP_CLOSED, { shopId: currentShopId.value });
}

/** 事件监听分组标识，用于组件卸载时统一清理 */
const EVENT_GROUP = 'gameMain';

onMounted(async () => {
  eventBus.onGroup(EVENT_GROUP, GameEvents.EXPLORATION_CELL_EXPLORED, handleCellExplored);
  eventBus.onGroup(EVENT_GROUP, GameEvents.EXPLORATION_BATTLE_TRIGGERED, handleBattleTriggered);
  eventBus.onGroup(EVENT_GROUP, GameEvents.EXPLORATION_ITEM_FOUND, handleItemFound);
  eventBus.onGroup(EVENT_GROUP, GameEvents.EXPLORATION_TRAP_TRIGGERED, handleTrapTriggered);
  eventBus.onGroup(EVENT_GROUP, GameEvents.EXPLORATION_RANDOM_EVENT, handleRandomEvent);
  
  // 初始化地图模块（从数据库恢复当前区域等状态）
  await mapStore.init();
  
  // 从数据库恢复上次的标签页状态
  const savedTab = await mapDbService.getCurrentTab();
  if (savedTab === 'explore' && hasCurrentLocation.value) {
    currentContentTab.value = 'explore';
  }
});

onUnmounted(() => {
  eventBus.clearGroup(EVENT_GROUP);
});

defineExpose({ showNotif });
</script>

<style scoped>
.game-main {
  height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  padding: 8px 12px;
  border-radius: 10px;
  transition: background 0.2s;
}

.player-info:hover {
  background: rgba(255, 215, 0, 0.1);
}

.player-avatar {
  font-size: 32px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 215, 0, 0.15);
  border: 2px solid rgba(255, 215, 0, 0.3);
  border-radius: 10px;
  flex-shrink: 0;
}

.player-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.player-name {
  font-size: 18px;
  color: #f0f0f0;
  font-weight: bold;
  line-height: 1.2;
}

.player-level {
  font-size: 12px;
  color: #ffd700;
  font-weight: bold;
  background: rgba(255, 215, 0, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}

.player-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.player-gold {
  font-size: 12px;
  font-weight: bold;
  color: #ffd700;
}

.player-resources {
  flex: 1;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 6px;
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

.content-tab.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.area-info {
  margin-left: auto;
  color: #8b8b8b;
  font-size: 14px;
}

.content-view {
  flex: 1;
  padding: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.game-footer {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 10px 12px 14px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.7) 100%);
  border-top: 1px solid rgba(255, 215, 0, 0.2);
  position: relative;
}

.game-footer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.4), transparent);
}

.footer-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 8px 4px 6px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 52px;
  position: relative;
  border-radius: 10px;
}

.footer-btn::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 2px;
  background: #ffd700;
  border-radius: 1px;
  transition: width 0.3s ease;
  box-shadow: 0 0 6px rgba(255, 215, 0, 0.5);
}

.footer-btn:hover {
  color: #ffd700;
  background: rgba(255, 215, 0, 0.08);
  transform: translateY(-2px);
}

.footer-btn:hover::after {
  width: 70%;
}

.footer-btn:active {
  transform: translateY(0) scale(0.95);
}

.footer-btn.exit-btn {
  color: rgba(255, 100, 100, 0.7);
}

.footer-btn.exit-btn:hover {
  color: #ff6b6b;
  background: rgba(255, 68, 68, 0.1);
}

.footer-btn.exit-btn::after {
  background: #ff4444;
  box-shadow: 0 0 6px rgba(255, 68, 68, 0.5);
}

.footer-icon {
  font-size: 24px;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.footer-text {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

@media (max-width: 768px) {
  .game-header {
    padding: 10px 16px;
  }
  
  .player-avatar {
    font-size: 26px;
    width: 40px;
    height: 40px;
  }
  
  .player-name {
    font-size: 15px;
  }
  
  .player-level {
    font-size: 11px;
  }
  
  .player-gold {
    font-size: 11px;
  }
  
  .player-resources {
    max-width: 100%;
    order: 3;
    width: 100%;
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
    padding: 6px 4px 5px;
    min-width: 48px;
  }
  
  .footer-icon {
    font-size: 22px;
  }
  
  .footer-text {
    font-size: 9px;
  }
}

@media (max-width: 480px) {
  .game-footer {
    padding: 8px 8px 12px;
  }

  .footer-btn {
    min-width: 42px;
    padding: 6px 2px 4px;
  }
  
  .footer-icon {
    font-size: 20px;
  }
  
  .footer-text {
    font-size: 9px;
  }
}
</style>