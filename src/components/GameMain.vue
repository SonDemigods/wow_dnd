<template>
  <div class="game-main">
    <div class="game-header">
      <div class="player-info">
        <div class="player-avatar"><BaseIcon :name="raceIcon || undefined" :size="28" /></div>
        <div class="player-details">
          <div class="player-name">{{ character.name }}</div>
          <div class="player-meta">
            <span :class="['player-level', { 'level-up': levelUpTriggered }]">Lv.{{ character.level }}</span>
            <span class="player-gold"><BaseIcon name="two-coins" gradient="gold" :size="14" /> {{ gold }}</span>
          </div>
        </div>
      </div>
      <div class="player-resources">
        <ResourceBar icon="health-normal" iconGradient="blood" name="生命" :current="currentHp" :max="maxHp" :percent="hpPercent" type="hp" />
        <ResourceBar v-if="showManaBar" icon="magic-palm" iconGradient="mana" name="法力" :current="currentMp" :max="maxMp" :percent="mpPercent" type="mp" />
        <ClassResourceBar v-for="(sys, idx) in classResourceSystems" :key="'class-res-' + idx" :resource-system="sys" />
        <ResourceBar icon="star-formation" iconGradient="gold" name="经验" :current="exp" :max="expToNext" :percent="expPercent" type="exp" />
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
      <button class="footer-btn" @click="popupMounted.characterInfo = true; showCharacterInfo = true; onClickPanel('character_info')" title="角色">
        <BaseIcon name="person" gradient="gold" :size="16" />
        <span class="footer-text">角色</span>
        <MenuBadge :count="characterBadge" variant="danger" />
      </button>
      <button class="footer-btn" @click="popupMounted.inventory = true; showInventory = true; onClickPanel('inventory')" title="背包">
        <BaseIcon name="backpack" gradient="gold" :size="16" />
        <span class="footer-text">背包</span>
        <MenuBadge :count="inventoryBadge" variant="warning" />
      </button>
      <button class="footer-btn" @click="popupMounted.build = true; showBuild = true; onClickPanel('build')" title="构筑">
        <BaseIcon name="sword-spin" gradient="gold" :size="16" />
        <span class="footer-text">构筑</span>
        <MenuBadge :count="buildBadge" variant="danger" />
      </button>
      <button class="footer-btn" @click="popupMounted.progress = true; showProgress = true; onClickPanel('progress')" title="进度">
        <BaseIcon name="notebook" gradient="gold" :size="16" />
        <span class="footer-text">进度</span>
        <MenuBadge :count="progressBadge" variant="info" />
      </button>
      <button class="footer-btn" @click="popupMounted.system = true; showSystem = true; onClickPanel('system')" title="系统">
        <BaseIcon name="cog" gradient="gold" :size="16" />
        <span class="footer-text">系统</span>
      </button>
    </div>

    <CharacterInfoPopup
      v-if="popupMounted.characterInfo"
      :visible="showCharacterInfo"
      @close="showCharacterInfo = false; popupMounted.characterInfo = false; onPanelClose('character_info')"
      @open-inventory="handleOpenInventoryFromCharacter"
    />

    <InventoryPopup
      v-if="popupMounted.inventory"
      :visible="showInventory"
      @close="showInventory = false; popupMounted.inventory = false; onPanelClose('inventory')"
    />

    <BuildPopup
      v-if="popupMounted.build"
      :visible="showBuild"
      @close="showBuild = false; popupMounted.build = false; onPanelClose('build')"
    />

    <ProgressPopup
      v-if="popupMounted.progress"
      :visible="showProgress"
      :current-area="currentArea"
      @close="showProgress = false; popupMounted.progress = false; onPanelClose('progress')"
    />

    <ShopPopup
      v-if="popupMounted.shop"
      :visible="showShop"
      @close="handleShopClose"
    />

    <QuestBoardPopup
      v-if="popupMounted.questBoard"
      :visible="showQuestBoard"
      @close="showQuestBoard = false; popupMounted.questBoard = false; onPanelClose('quest_board')"
    />

    <CombatPopup
      v-if="showCombat"
      @close="handleCombatClose"
    />

    <AudioSettingsPopup
      v-if="popupMounted.audioSettings"
      :visible="showAudioSettings"
      @close="showAudioSettings = false; popupMounted.audioSettings = false; onPanelClose('audio_settings')"
    />

    <SystemPopup
      v-if="popupMounted.system"
      :visible="showSystem"
      @close="showSystem = false; popupMounted.system = false; onPanelClose('system')"
      @exit="handleExit"
      @open-audio="openAudioFromSystem"
    />

    <MultiOptionEventPopup
      :visible="showMultiOptionEvent"
      :event="currentMultiOptionEvent"
      @close="handleMultiOptionEventClose"
      @select="handleEventChoice"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 游戏主界面组件
 * @description 游戏的核心枢纽页面，集成地图/探索两个标签页，以及底部导航栏的角色、背包、技能、任务、日志等弹出面板
 */

import { defineAsyncComponent, h, onMounted, onUnmounted } from 'vue';
import { useGameActions } from '@/composables/useGameActions';
import ResourceBar from './common/ResourceBar.vue';
import ClassResourceBar from './common/ClassResourceBar.vue';
import MenuBadge from './common/MenuBadge.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';

/**
 * 弹窗与视图组件懒加载（B1/B2：首屏 bundle 优化）
 *
 * 10 个弹窗 + 2 个内容视图改为 defineAsyncComponent，首屏不包含弹窗代码，
 * 用户点击底部导航栏时才动态加载对应弹窗 chunk。
 * delay=200ms 避免快速加载时闪烁占位组件；timeout=10s 防止网络异常无限等待。
 */
const AsyncPopupLoading = () => h('div', { class: 'popup-async-loading' }, '加载中...');
const AsyncPopupError = () => h('div', { class: 'popup-async-loading popup-async-error' }, '加载失败');
// 战斗弹窗全屏遮罩加载占位（与 .combat-overlay 样式一致，避免加载期间主界面裸露）
const AsyncCombatLoading = () => h('div', { class: 'combat-async-loading' }, '加载中...');
const AsyncCombatError = () => h('div', { class: 'combat-async-loading popup-async-error' }, '加载失败');

const MapView = defineAsyncComponent({
  loader: () => import('./MapView.vue'),
  loadingComponent: AsyncPopupLoading,
  errorComponent: AsyncPopupError,
  delay: 200,
  timeout: 10000,
});
const ExplorationView = defineAsyncComponent({
  loader: () => import('./ExplorationView.vue'),
  loadingComponent: AsyncPopupLoading,
  errorComponent: AsyncPopupError,
  delay: 200,
  timeout: 10000,
});
const InventoryPopup = defineAsyncComponent({
  loader: () => import('./popup/InventoryPopup.vue'),
  loadingComponent: AsyncPopupLoading,
  errorComponent: AsyncPopupError,
  delay: 200,
  timeout: 10000,
});
const BuildPopup = defineAsyncComponent({
  loader: () => import('./popup/BuildPopup.vue'),
  loadingComponent: AsyncPopupLoading,
  errorComponent: AsyncPopupError,
  delay: 200,
  timeout: 10000,
});
const ProgressPopup = defineAsyncComponent({
  loader: () => import('./popup/ProgressPopup.vue'),
  loadingComponent: AsyncPopupLoading,
  errorComponent: AsyncPopupError,
  delay: 200,
  timeout: 10000,
});
const ShopPopup = defineAsyncComponent({
  loader: () => import('./popup/ShopPopup.vue'),
  loadingComponent: AsyncPopupLoading,
  errorComponent: AsyncPopupError,
  delay: 200,
  timeout: 10000,
});
const QuestBoardPopup = defineAsyncComponent({
  loader: () => import('./popup/QuestBoardPopup.vue'),
  loadingComponent: AsyncPopupLoading,
  errorComponent: AsyncPopupError,
  delay: 200,
  timeout: 10000,
});
const CharacterInfoPopup = defineAsyncComponent({
  loader: () => import('./popup/CharacterInfoPopup.vue'),
  loadingComponent: AsyncPopupLoading,
  errorComponent: AsyncPopupError,
  delay: 200,
  timeout: 10000,
});
const CombatPopup = defineAsyncComponent({
  loader: () => import('./popup/CombatPopup.vue'),
  loadingComponent: AsyncCombatLoading,
  errorComponent: AsyncCombatError,
  delay: 0,
  timeout: 10000,
});
const AudioSettingsPopup = defineAsyncComponent({
  loader: () => import('./popup/AudioSettingsPopup.vue'),
  loadingComponent: AsyncPopupLoading,
  errorComponent: AsyncPopupError,
  delay: 200,
  timeout: 10000,
});
const SystemPopup = defineAsyncComponent({
  loader: () => import('./popup/SystemPopup.vue'),
  loadingComponent: AsyncPopupLoading,
  errorComponent: AsyncPopupError,
  delay: 200,
  timeout: 10000,
});
const MultiOptionEventPopup = defineAsyncComponent({
  loader: () => import('./popup/MultiOptionEventPopup.vue'),
  loadingComponent: AsyncPopupLoading,
  errorComponent: AsyncPopupError,
  delay: 200,
  timeout: 10000,
});

const emit = defineEmits<{
  (e: 'exit'): void;
}>();

const {
  currentContentTab, loading,
  showCharacterInfo, showInventory, showBuild, showProgress,
  showShop, showQuestBoard, showCombat, showAudioSettings, showSystem,
  showMultiOptionEvent, currentMultiOptionEvent,
  popupMounted, levelUpTriggered,
  character, currentHp, maxHp, currentMp, maxMp, hpPercent, mpPercent,
  showManaBar, classResourceSystems, exp, expToNext, expPercent, gold,
  currentArea, hasCurrentLocation, raceIcon,
  characterBadge, inventoryBadge, buildBadge, progressBadge,
  showNotif, handleExit, onClickPanel, onPanelClose,
  openAudioFromSystem, handleMapTabClick, handleExploreTabClick,
  handleCombatClose, handleShopClose,
  handleEventChoice, handleMultiOptionEventClose,
  init, cleanup,
} = useGameActions(() => emit('exit'));

/** 角色面板装备段"前往背包"跳转：关闭角色面板，打开背包 */
function handleOpenInventoryFromCharacter() {
  showCharacterInfo.value = false;
  popupMounted.characterInfo = false;
  popupMounted.inventory = true;
  showInventory.value = true;
}

// P9-104 修复：init() 包裹 try-catch，避免初始化异常导致未捕获 rejection
onMounted(async () => {
  try {
    await init();
  } catch (err) {
    console.error('[GameMain] init 失败:', err);
  }
});
onUnmounted(() => cleanup());
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
  display: flex;
  align-items: center;
  gap: 4px;
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

/* ===== 异步组件加载占位（B1/B2） ===== */
.popup-async-loading {
  .flex-center();
  min-height: 200px;
  color: @accent-color;
  font-size: @font-lg;
  letter-spacing: 1px;
}

.popup-async-error {
  color: #ff6b6b;
}

/* 战斗弹窗异步加载占位：全屏遮罩，与 .combat-overlay 保持一致 */
.combat-async-loading {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.92);
  z-index: @z-combat-overlay;
  .flex-center();
  color: @accent-color;
  font-size: @font-lg;
  letter-spacing: 1px;
}
</style>