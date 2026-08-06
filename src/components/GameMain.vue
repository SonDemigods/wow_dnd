<template>
  <div class="game-main">
    <div class="game-header">
      <div class="player-info">
        <div class="player-avatar"><BaseIcon :name="characterStore.raceIcon || undefined" :size="28" /></div>
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
      </button>
      <button class="footer-btn" @click="popupMounted.inventory = true; showInventory = true; onClickPanel('inventory')" title="背包">
        <BaseIcon name="backpack" gradient="gold" :size="16" />
        <span class="footer-text">背包</span>
      </button>
      <button class="footer-btn" @click="popupMounted.skills = true; showSkills = true; onClickPanel('skills')" title="技能">
        <BaseIcon name="sword-spin" gradient="gold" :size="16" />
        <span class="footer-text">技能</span>
      </button>
      <button class="footer-btn" @click="popupMounted.quests = true; showQuests = true; onClickPanel('quests')" title="任务">
        <BaseIcon name="notebook" gradient="gold" :size="16" />
        <span class="footer-text">任务</span>
      </button>
      <button class="footer-btn" @click="popupMounted.adventureLog = true; showAdventureLog = true; onClickPanel('adventure_log')" title="日志">
        <BaseIcon name="scroll-unfurled" gradient="gold" :size="16" />
        <span class="footer-text">日志</span>
      </button>
      <button class="footer-btn" @click="popupMounted.system = true; showSystem = true; onClickPanel('system')" title="系统">
        <BaseIcon name="cog" gradient="gold" :size="16" />
        <span class="footer-text">系统</span>
      </button>
    </div>

    <CharacterInfoPopup
      v-if="popupMounted.characterInfo"
      :visible="showCharacterInfo"
      @close="showCharacterInfo = false; onPanelClose('character_info')"
    />

    <InventoryPopup
      v-if="popupMounted.inventory"
      :visible="showInventory"
      @close="showInventory = false; onPanelClose('inventory')"
    />

    <SkillsPopup
      v-if="popupMounted.skills"
      :visible="showSkills"
      @close="showSkills = false; onPanelClose('skills')"
    />

    <QuestPopup
      v-if="popupMounted.quests"
      :visible="showQuests"
      @close="showQuests = false; onPanelClose('quests')"
    />

    <AdventureLogPopup
      v-if="popupMounted.adventureLog"
      :visible="showAdventureLog"
      :current-area="currentArea"
      @close="showAdventureLog = false; onPanelClose('adventure_log')"
    />

    <ShopPopup
      v-if="popupMounted.shop"
      :visible="showShop"
      @close="handleShopClose"
    />

    <QuestBoardPopup
      v-if="popupMounted.questBoard"
      :visible="showQuestBoard"
      @close="showQuestBoard = false; onPanelClose('quest_board')"
    />

    <CombatPopup
      v-if="showCombat"
      @close="handleCombatClose"
    />

    <AudioSettingsPopup
      v-if="popupMounted.audioSettings"
      :visible="showAudioSettings"
      @close="showAudioSettings = false; onPanelClose('audio_settings')"
    />

    <SystemPopup
      v-if="popupMounted.system"
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

import { ref, reactive, computed, defineAsyncComponent, h, onMounted, onUnmounted } from 'vue';
import { useCharacterStore } from '@/modules/character';
import { useMapStore } from '@/modules/map';
import { useShopStore } from '@/modules/shop';
import { useExplorationStore, type ExplorationUICallbacks, type MultiOptionEventResult } from '@/modules/exploration';
import { gameBootstrap } from '@/services/GameBootstrap';
import { eventBus, GameEvents } from '@/modules/bus';
import { useEnemyStore } from '@/modules/enemy';
import { useCombatStore } from '@/modules/combat';
import { ResourceSystemFactory } from '@/modules/combat/resources';
import { useToast } from '@/composables/useToast';
import type { CombatResult } from '@/modules/combat';
import ResourceBar from './common/ResourceBar.vue';
import ClassResourceBar from './common/ClassResourceBar.vue';
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
const SkillsPopup = defineAsyncComponent({
  loader: () => import('./popup/SkillsPopup.vue'),
  loadingComponent: AsyncPopupLoading,
  errorComponent: AsyncPopupError,
  delay: 200,
  timeout: 10000,
});
const QuestPopup = defineAsyncComponent({
  loader: () => import('./popup/QuestPopup.vue'),
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
const AdventureLogPopup = defineAsyncComponent({
  loader: () => import('./popup/AdventureLogPopup.vue'),
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

const emit = defineEmits<{
  (e: 'exit'): void;
}>();

const characterStore = useCharacterStore();
const mapStore = useMapStore();
const shopStore = useShopStore();
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
/**
 * 弹窗懒挂载标志（B1/B2：异步组件延迟加载）
 *
 * 每个弹窗首次打开时将对应标志置为 true 并保持，使 v-if 包裹的异步组件
 * 仅在用户实际需要时才挂载（触发 defineAsyncComponent 的 loader），
 * 避免进入游戏瞬间加载全部弹窗 chunk。
 */
const popupMounted = reactive({
  characterInfo: false,
  inventory: false,
  skills: false,
  quests: false,
  adventureLog: false,
  shop: false,
  questBoard: false,
  audioSettings: false,
  system: false,
});
/** 是否触发升级动画 */
const levelUpTriggered = ref(false);
/**
 * 升级动画定时器 ID（setup 作用域，onMounted/onUnmounted 闭包共享同一引用）
 *
 * CHARACTER_LEVEL_UP 事件回调中通过 setTimeout 延迟 1500ms 复位 levelUpTriggered，
 * 若组件在动画期间卸载，需在 onUnmounted 中清理该定时器，
 * 避免卸载后访问已卸载组件的响应式状态触发 Vue 警告。
 */
let levelUpTimerId: ReturnType<typeof setTimeout> | null = null;

const character = computed(() => characterStore.character || { name: '...', level: 1 });
const currentHp = computed(() => characterStore.hp);
const maxHp = computed(() => characterStore.maxHp);
const currentMp = computed(() => characterStore.mana);
const maxMp = computed(() => characterStore.maxMana);
const hpPercent = computed(() => characterStore.hpPercentage);
const mpPercent = computed(() => characterStore.manaPercentage);
/** 是否显示 MP 资源条（战士/盗贼/猎人等替代型资源职业隐藏 MP 条） */
const showManaBar = computed(() => !ResourceSystemFactory.replacesMana(characterStore.classId));
/** 职业专属资源系统（仅替代型：怒气/能量/集中值），非战斗时携带初始值供展示 */
const classResourceSystems = computed(() => ResourceSystemFactory.getManaReplacingSystems(characterStore.classId));
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
  popupMounted.audioSettings = true;
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
    await shopStore.openShop(shopId);
    popupMounted.shop = true;
    showShop.value = true;
    onPanelOpen('shop');
  } else if (cellType === 'board') {
    popupMounted.questBoard = true;
    showQuestBoard.value = true;
    onPanelOpen('quest_board');
  }
}

// 监听探索战斗事件
// P2 TS-5 修复：参数类型与 ExplorationUICallbacks.onBattleTriggered 接口对齐，移除 as 断言
// 接口契约保证 eventData.monsterId/areaLevel 必填，调用方（exploration/store.ts）负责保证
async function handleBattleTriggered(data: { eventData: { monsterId: string; areaLevel: number } }) {
  const { monsterId, areaLevel } = data.eventData;

  // 从数据库获取敌人模板数据，传入地图等级
  const enemy = await useEnemyStore().createEnemy(monsterId, areaLevel);

  if (enemy) {
    await useCombatStore().startCombat([enemy]);
    showCombat.value = true;
  }
}

// 监听物品发现事件
// P2 TS-5 修复：参数类型与 ExplorationUICallbacks.onItemFound 接口对齐
function handleItemFound(data: { itemId: string; count: number; itemName: string }) {
  showNotif(`发现物品: ${data.itemName} x${data.count}`, 'success');
}

// 监听陷阱触发事件
// P2 TS-5 修复：参数类型与 ExplorationUICallbacks.onTrapTriggered 接口对齐
function handleTrapTriggered(data: { damage: number; trapType: string }) {
  showNotif(`触发${data.trapType}，受到 ${data.damage} 点伤害`, 'danger');
}

// 监听随机事件
// P2 TS-5 修复：参数类型与 ExplorationUICallbacks.onRandomEvent 接口对齐
function handleRandomEvent(data: { message: string; icon: string }) {
  showNotif(data.message, 'info');
}

// 监听多选项事件：展示事件描述，由玩家在弹窗中选择后调用 applyEventChoice
// P2 TS-5 修复：使用 MultiOptionEventResult 类型替代手写类型
function handleMultiOptionEvent(data: MultiOptionEventResult) {
  // 展示事件描述（完整选项弹窗可后续扩展，当前以通知形式提示并自动选择第一项）
  showNotif(data.message, 'info');
  const explorationStore = useExplorationStore();
  // 自动应用第一个选项（后续可替换为交互式弹窗）
  if (data.choices.length > 0) {
    explorationStore.applyEventChoice(data.choices[0]);
  }
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
  // P2 TS-5 修复：处理器参数类型已与 ExplorationUICallbacks 接口对齐，移除 as 断言
  explorationStore.registerUICallbacks({
    onCellExplored: handleCellExplored,
    onBattleTriggered: handleBattleTriggered,
    onItemFound: handleItemFound,
    onTrapTriggered: handleTrapTriggered,
    onRandomEvent: handleRandomEvent,
    onMultiOptionEvent: handleMultiOptionEvent
  });
  
  // 初始化所有角色相关模块（EXP-5：统一由 GameBootstrap 编排，避免探索模块隐式初始化其他 Store）
  const cid = characterStore.currentCharacterId;
  if (cid) {
    await gameBootstrap.initialize(cid);

    // 从数据库恢复上次的标签页状态（按角色隔离，通过 mapStore action 获取）
    const savedTab = await mapStore.getCurrentTab();
    if (savedTab === 'explore' && hasCurrentLocation.value) {
      currentContentTab.value = 'explore';
    }
  }
  // 初始化完成，解除加载状态
  loading.value = false;

  // 监听角色升级事件，触发升级动画
  eventBus.on(GameEvents.CHARACTER_LEVEL_UP, onLevelUp);
});

/** 角色升级事件处理器：触发升级动画并延迟复位 */
function onLevelUp(): void {
  levelUpTriggered.value = true;
  showNotif('升级了！', 'success');
  // 清理上一次未触发的定时器，避免快速连续升级时定时器堆叠
  if (levelUpTimerId !== null) {
    clearTimeout(levelUpTimerId);
  }
  levelUpTimerId = setTimeout(() => {
    levelUpTimerId = null;
    levelUpTriggered.value = false;
  }, 1500);
}

onUnmounted(() => {
  // 移除升级事件监听并清理未触发的升级动画定时器，防止卸载后访问响应式状态
  eventBus.off(GameEvents.CHARACTER_LEVEL_UP, onLevelUp);
  if (levelUpTimerId !== null) {
    clearTimeout(levelUpTimerId);
    levelUpTimerId = null;
  }
  // 统一清理所有模块（EXP-5：按初始化逆序 dispose，清理监听器与状态）
  gameBootstrap.dispose();
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