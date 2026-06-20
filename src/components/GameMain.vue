<template>
  <div class="game-main">
    <div class="game-header">
      <div class="player-info">
        <div class="player-avatar"><BaseIcon :name="characterStore.raceIcon || undefined" :size="28" /></div>
        <div class="player-details">
          <div class="player-name">{{ character.name }}</div>
          <div class="player-meta">
            <span :class="['player-level', { 'level-up': levelUpTriggered }]">Lv.{{ character.level }}</span>
            <span class="player-gold"><BaseIcon name="coins" gradient="gold" :size="14" /> {{ gold }}</span>
          </div>
        </div>
      </div>
      <div class="player-resources">
        <ResourceBar icon="health-normal" iconGradient="blood" name="HP" :current="currentHp" :max="maxHp" :percent="hpPercent" type="hp" />
        <ResourceBar icon="magic-palm" iconGradient="mana" name="MP" :current="currentMp" :max="maxMp" :percent="mpPercent" type="mp" />
        <ResourceBar icon="star-formation" iconGradient="gold" name="EXP" :current="exp" :max="expToNext" :percent="expPercent" type="exp" />
      </div>
    </div>

    <div class="game-content">
      <div class="content-tabs">
        <button 
          :class="['content-tab', { active: currentContentTab === 'map' }]"
          @click="handleMapTabClick"
        >
          <BaseIcon name="treasure-map" gradient="nature" :size="16" /> 地图
        </button>
        <button 
          :class="['content-tab', { active: currentContentTab === 'explore', disabled: !hasCurrentLocation }]"
          @click="handleExploreTabClick"
        >
          <BaseIcon name="campfire" gradient="heal" :size="16" /> 探索
        </button>
        <div class="area-info">
          区域: {{ currentArea }}
        </div>
      </div>

      <div class="content-view">
        <template v-if="!loading">
          <MapView v-if="currentContentTab === 'map'" key="map-view" @enter-zone="currentContentTab = 'explore'" />
          <ExplorationView v-else key="explore-view" />
        </template>
      </div>
    </div>

    <div class="game-footer">
      <button class="footer-btn" @click="showCharacterInfo = true; onClickPanel('character_info')" title="角色">
        <BaseIcon name="person" gradient="gold" :size="16" />
        <span class="footer-text">角色</span>
      </button>
      <button class="footer-btn" @click="showInventory = true; onClickPanel('inventory')" title="背包">
        <BaseIcon name="backpack" gradient="earth" :size="16" />
        <span class="footer-text">背包</span>
      </button>
      <button class="footer-btn" @click="showSkills = true; onClickPanel('skills')" title="技能">
        <BaseIcon name="sword-spin" gradient="warrior" :size="16" />
        <span class="footer-text">技能</span>
      </button>
      <button class="footer-btn" @click="showQuests = true; onClickPanel('quests')" title="任务">
        <BaseIcon name="notebook" gradient="gold" :size="16" />
        <span class="footer-text">任务</span>
      </button>
      <button class="footer-btn" @click="showAdventureLog = true; onClickPanel('adventure_log')" title="日志">
        <BaseIcon name="scroll-unfurled" gradient="earth" :size="16" />
        <span class="footer-text">日志</span>
      </button>
      <button class="footer-btn" @click="showSystem = true; onClickPanel('system')" title="系统">
        <BaseIcon name="cog" gradient="metal" :size="16" />
        <span class="footer-text">系统</span>
      </button>
    </div>

    <CharacterInfoPopup 
      :visible="showCharacterInfo" 
      @close="showCharacterInfo = false; onPanelClose('character_info')" 
    />
    
    <InventoryPopup 
      :visible="showInventory" 
      @close="showInventory = false; onPanelClose('inventory')" 
    />
    
    <SkillsPopup 
      :visible="showSkills" 
      @close="showSkills = false; onPanelClose('skills')" 
    />
    
    <QuestPopup 
      :visible="showQuests" 
      @close="showQuests = false; onPanelClose('quests')" 
    />
    
    <AdventureLogPopup 
      :visible="showAdventureLog" 
      :current-area="currentArea"
      @close="showAdventureLog = false; onPanelClose('adventure_log')" 
    />
    
    <ShopPopup 
      :visible="showShop" 
      @close="handleShopClose" 
    />
    
    <QuestBoardPopup 
      :visible="showQuestBoard" 
      @close="showQuestBoard = false; onPanelClose('quest_board')" 
    />

    <CombatPopup
      v-if="showCombat"
      @close="handleCombatClose"
    />

    <AudioSettingsPopup
      :visible="showAudioSettings"
      @close="showAudioSettings = false; onPanelClose('audio_settings')"
    />

    <SystemPopup
      :visible="showSystem"
      @close="showSystem = false; onPanelClose('system')"
      @exit="handleExit"
      @open-audio="openAudioFromSystem"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 游戏主界面组件
 * @description 游戏的核心枢纽页面，集成地图/探索两个标签页，以及底部导航栏的角色、背包、技能、任务、日志等弹出面板
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useCharacterStore } from '@/modules/character';
import { useMapStore } from '@/modules/map';
import { useShopStore } from '@/modules/shop';
import { useLogStore } from '@/modules/log';
import { useExplorationStore, type ExplorationUICallbacks } from '@/modules/exploration';
import { eventBus, GameEvents } from '@/modules/bus/core';
import { useEnemiesStore } from '@/modules/enemy';
import { useCombatStore } from '@/modules/combat/store';
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
import AudioSettingsPopup from './popup/AudioSettingsPopup.vue';
import SystemPopup from './popup/SystemPopup.vue';
import ResourceBar from './common/ResourceBar.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';

const emit = defineEmits<{
  (e: 'exit'): void;
}>();

const characterStore = useCharacterStore();
const mapStore = useMapStore();
const shopStore = useShopStore();
const logStore = useLogStore();
const toast = useToast();

const currentContentTab = ref('map');
/** 是否正在初始化，初始化完成前不渲染内容区域，避免页面闪烁 */
const loading = ref(true);
const showCharacterInfo = ref(false);
const showInventory = ref(false);
const showSkills = ref(false);
const showQuests = ref(false);
const showAdventureLog = ref(false);
const showShop = ref(false);
const showQuestBoard = ref(false);
const showCombat = ref(false);
const showAudioSettings = ref(false);
const showSystem = ref(false);
/** 是否触发升级动画 */
const levelUpTriggered = ref(false);

const character = computed(() => characterStore.character || { name: '...', level: 1 });
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
const hasCurrentLocation = computed(() => !!mapStore.getCurrentLocation);

function showNotif(message: string, type: 'info' | 'success' | 'warning' | 'danger' = 'info') {
  toast.show({ message, type });
}

function handleExit() {
  emit('exit');
}

/** 面板打开时发送总线事件和点击音效 */
function onClickPanel(name: string) {
  eventBus.emit(GameEvents.UI_CLICK, { source: `nav_${name}` });
  onPanelOpen(name);
}

/** 面板打开时发送总线事件 */
function onPanelOpen(name: string) {
  eventBus.emit(GameEvents.UI_PANEL_OPENED, { panel: name });
}

/** 面板关闭时发送总线事件 */
function onPanelClose(name: string) {
  eventBus.emit(GameEvents.UI_PANEL_CLOSED, { panel: name });
}

/** 从系统菜单打开音量设置 */
function openAudioFromSystem() {
  showAudioSettings.value = true;
  onPanelOpen('audio_settings');
}

function handleMapTabClick() {
  currentContentTab.value = 'map';
  eventBus.emit(GameEvents.UI_CLICK, { source: 'tab_map' });
  mapStore.saveCurrentTab('map');
}

function handleExploreTabClick() {
  if (!hasCurrentLocation.value) {
    showNotif('请先在地图上选择一个区域', 'info');
    return;
  }
  currentContentTab.value = 'explore';
  eventBus.emit(GameEvents.UI_CLICK, { source: 'tab_explore' });
  mapStore.saveCurrentTab('explore');
}

// 监听探索格子翻开事件，处理交互
async function handleCellExplored(data: { cellType?: string; interactionId?: string }) {
  const cellType = data?.cellType;
  if (cellType === 'shop') {
    const shopId = data?.interactionId || '';
    if (!shopId) {
      console.warn('[GameMain] 商店交互ID为空，无法打开商店');
      return;
    }
    await shopStore.selectShop(shopId);
    showShop.value = true;
    onPanelOpen('shop');
  } else if (cellType === 'board') {
    showQuestBoard.value = true;
    onPanelOpen('quest_board');
  }
}

// 监听探索战斗事件
async function handleBattleTriggered(data: { eventData?: { monsterId?: string; areaLevel?: number } }) {
  if (!data?.eventData?.monsterId) return;
  
  const monsterId = data.eventData.monsterId;
  const areaLevel = data.eventData.areaLevel || 1;
  
  // 从数据库获取敌人模板数据，传入地图等级
  const enemy = await useEnemiesStore().createEnemy(monsterId, areaLevel);
  
  if (enemy) {
    useCombatStore().startCombat([enemy]);
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
  onPanelClose('combat');
}

async function handleShopClose() {
  showShop.value = false;
  onPanelClose('shop');
  await shopStore.closeShop();
}

onMounted(async () => {
  const explorationStore = useExplorationStore();

  // 注册探索 UI 回调（替代 EventBus 跨模块数据事件监听）
  explorationStore.registerUICallbacks({
    onCellExplored: handleCellExplored,
    onBattleTriggered: handleBattleTriggered,
    onItemFound: handleItemFound,
    onTrapTriggered: handleTrapTriggered,
    onRandomEvent: handleRandomEvent
  } as ExplorationUICallbacks);
  
  // 初始化地图模块（按角色ID从数据库恢复当前区域等状态）
  const cid = characterStore.currentCharacterId;
  if (cid) {
    await mapStore.initialize(cid);
    await logStore.initialize(cid);
    
    // 从数据库恢复上次的标签页状态（按角色隔离，通过 mapStore action 获取）
    const savedTab = await mapStore.getCurrentTab();
    if (savedTab === 'explore' && hasCurrentLocation.value) {
      currentContentTab.value = 'explore';
    }
  }
  // 初始化完成，解除加载状态
  loading.value = false;

  // 监听角色升级事件，触发升级动画
  eventBus.on(GameEvents.CHARACTER_LEVEL_UP, () => {
    levelUpTriggered.value = true;
    showNotif('升级了！', 'success');
    setTimeout(() => {
      levelUpTriggered.value = false;
    }, 1500);
  });
});

onUnmounted(() => {
  useExplorationStore().unregisterUICallbacks();
});

defineExpose({ showNotif });
</script>

<style lang="less" scoped>
.game-main {
  height: 100vh;
  background: linear-gradient(135deg, @primary-bg 0%, #16213e 50%, #0f3460 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: @spacing-xl 24px;
  background: rgba(0, 0, 0, 0.5);
  border-bottom: 2px solid @popup-border-color;
  flex-wrap: wrap;
  gap: @spacing-xl;
}

.player-info {
  display: flex;
  align-items: center;
  gap: @spacing-xl;
  cursor: pointer;
  padding: @spacing-md @spacing-xl;
  border-radius: 10px;
  transition: background @transition-quick;
}

.player-info:hover {
  background: @gold-bg;
}

.player-avatar {
  font-size: 32px;
  width: 48px;
  height: 48px;
  .flex-center();
  background: @gold-bg-hover;
  border: 2px solid rgba(255, 215, 0, 0.3);
  border-radius: 10px;
  flex-shrink: 0;
}

.player-details {
  .flex-col();
  gap: @spacing-xs;
}

.player-name {
  font-size: @font-xl;
  color: @text-primary;
  font-weight: @font-weight-bold;
  line-height: 1.2;
}

.player-level {
  font-size: @font-sm;
  color: @accent-color;
  font-weight: @font-weight-bold;
  background: @gold-bg;
  padding: @spacing-2xs @spacing-md;
  border-radius: @radius-sm;
}

.player-level.level-up {
  animation: level-up-text 0.6s ease, level-up-glow 1.5s ease;
}

.player-meta {
  display: flex;
  align-items: center;
  gap: @spacing-md;
}

.player-gold {
  font-size: @font-sm;
  font-weight: @font-weight-bold;
  color: @accent-color;
}

.player-resources {
  flex: 1;
  max-width: 400px;
  .flex-col();
  gap: @spacing-sm;
}

.game-content {
  flex: 1;
  .flex-col();
  overflow: hidden;
}

.content-tabs {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: @spacing-xl 24px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: @border-sm;
}

.content-tab {
  padding: @spacing-md 24px;
  background: @white-05;
  border: @border-card;
  border-radius: @radius-md;
  color: @popup-text-color;
  font-size: @font-md;
  cursor: pointer;
  transition: all @transition-normal;
}

.content-tab:hover {
  border-color: @color-dim-gray;
  background: @white-10;
}

.content-tab.active {
  border-color: @accent-color;
  background: @gold-bg;
  color: @accent-color;
}

.content-tab.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.area-info {
  margin-left: auto;
  color: @text-secondary;
  font-size: @font-md;
}

.content-view {
  flex: 1;
  padding: @spacing-3xl;
  overflow: hidden;
  .flex-col();
}

.game-footer {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: @spacing-lg @spacing-xl @spacing-2xl;
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
  .flex-col-center();
  gap: 5px;
  padding: @spacing-md @spacing-xs @spacing-sm;
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
  background: @accent-color;
  border-radius: 1px;
  transition: width 0.3s ease;
  box-shadow: 0 0 6px rgba(255, 215, 0, 0.5);
}

.footer-btn:hover {
  color: @accent-color;
  background: rgba(255, 215, 0, 0.08);
  transform: translateY(-2px);
}

.footer-btn:hover::after {
  width: 70%;
}

.footer-btn:active {
  transform: translateY(0) scale(0.95);
}

.footer-icon {
  font-size: @font-4xl;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.footer-text {
  font-size: @font-2xs;
  font-weight: @font-weight-normal;
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