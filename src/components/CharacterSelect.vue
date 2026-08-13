<template>
  <div class="character-select">
    <!-- 版本不匹配警告横幅 -->
    <div v-if="versionMismatch" class="version-mismatch-banner">
      <BaseIcon name="butterfly-warning" gradient="fire" :size="20" />
      <span>
        检测到旧版存档（v{{ currentDataVersion }}），需迁移至 v{{ expectedDataVersion }} 才能进入游戏
      </span>
    </div>

    <!-- 4 个一级按钮 -->
    <div class="main-menu">
      <button class="menu-btn menu-btn-start" @click="openStartPopup">
        <BaseIcon :name="COMMON_ICONS.swordSpin" :size="24" />
        <span class="menu-btn-label">开始游戏</span>
      </button>
      <button class="menu-btn menu-btn-archive" @click="openArchivePopup">
        <BaseIcon name="cloud-upload" :size="24" />
        <span class="menu-btn-label">存档管理</span>
      </button>
      <button class="menu-btn menu-btn-system" @click="openSystemPopup">
        <BaseIcon :name="COMMON_ICONS.cog" :size="24" />
        <span class="menu-btn-label">系统设置</span>
      </button>
      <button class="menu-btn menu-btn-about" @click="openAboutPopup">
        <BaseIcon name="scroll-unfurled" :size="24" />
        <span class="menu-btn-label">关于</span>
      </button>
    </div>

    <!-- 二级弹窗：开始游戏 -->
    <CharacterSelectPopup
      :visible="showCharacterSelectPopup"
      :version-mismatch="versionMismatch"
      @close="showCharacterSelectPopup = false"
      @select="handleSelect"
      @create="handleCreate"
    />

    <!-- 二级弹窗：存档管理 -->
    <ArchiveManagerPopup
      :visible="showArchiveManager"
      :version-mismatch="versionMismatch"
      @close="showArchiveManager = false"
      @migrated="handleMigrated"
    />

    <!-- 二级弹窗：系统设置（复用 SystemPopup，隐藏退出游戏按钮） -->
    <SystemPopup
      :visible="showSystem"
      :show-exit-button="false"
      @close="showSystem = false"
      @open-audio="openAudioFromSystem"
    />

    <!-- 二级弹窗：关于 -->
    <AboutPopup
      :visible="showAbout"
      @close="showAbout = false"
    />

    <!-- 音量设置弹窗（懒挂载，参照 GameMain 的 popupMounted + showXxx 双标志） -->
    <AudioSettingsPopup
      v-if="popupMounted.audioSettings"
      :visible="showAudioSettings"
      @close="showAudioSettings = false"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 角色选择组件（主菜单）
 * @description 主菜单入口：4 个一级按钮（开始游戏/存档管理/系统设置/关于），
 *   二级功能统一以弹窗形式承载，降低主界面认知负担。
 *
 * 对外事件契约不变：emit select / create / migrated，由 App.vue 处理。
 * 角色列表/选择逻辑下沉到 CharacterSelectPopup；导出/导入/修复/迁移逻辑下沉到 ArchiveManagerPopup。
 * 本组件保留数据加载（loadData/loadCharacters/refreshData）与弹窗显隐编排。
 */

import { ref, computed, reactive, onMounted } from 'vue';
import { useCharacterStore } from '@/modules/character';
import { eventBus, GameEvents } from '@/modules/bus';
import BaseIcon from '@/components/common/BaseIcon.vue';
import { COMMON_ICONS } from '@/config/icons';
import { useBaseStore } from '@/modules/base';
import { useGameStore } from '@/modules/game';
import { errorHandler } from '@/services/ErrorHandler';
import CharacterSelectPopup from './popup/CharacterSelectPopup.vue';
import ArchiveManagerPopup from './popup/ArchiveManagerPopup.vue';
import SystemPopup from './popup/SystemPopup.vue';
import AboutPopup from './popup/AboutPopup.vue';
import AudioSettingsPopup from './popup/AudioSettingsPopup.vue';

defineProps<{
  /** 版本不匹配标志：true 时显示警告横幅，并禁用"进入游戏"按钮、显示"数据迁移"按钮 */
  versionMismatch?: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', id: string): void;
  (e: 'create'): void;
  /** 数据迁移成功后通知父组件（App.vue）重新初始化各 Store */
  (e: 'migrated'): void;
}>();

const baseStore = useBaseStore();
const characterStore = useCharacterStore();
const gameStore = useGameStore();

/**
 * 当前存档的数据版本戳（用于警告横幅显示 v{当前版本}）
 *
 * 从 gameStore 读取（initialize 时镜像自 runtime_gameState.dataVersion）。
 * null 表示尚未初始化完成，此时 versionMismatch 必为 false，不会进入此分支。
 */
const currentDataVersion = computed(() => gameStore.getCurrentDataVersion() ?? '?');

/** 当前代码期望的数据版本（用于警告横幅显示 v{期望版本}） */
const expectedDataVersion = computed(() => gameStore.getExpectedDataVersion());

// ==================== 弹窗显隐状态 ====================
/** 4 个二级弹窗互斥：同一时刻只开一个（用户点击遮罩关闭后再开下一个） */
const showCharacterSelectPopup = ref(false);
const showArchiveManager = ref(false);
const showSystem = ref(false);
const showAbout = ref(false);

/**
 * 音量设置弹窗懒挂载标志（B1/B2：异步组件延迟加载）
 *
 * 首次从系统菜单打开音量设置时置为 true 并保持，使 v-if 包裹的组件
 * 仅在用户实际需要时才挂载。参照 GameMain 的 popupMounted 模式。
 */
const popupMounted = reactive({
  audioSettings: false,
});
const showAudioSettings = ref(false);

// ==================== 数据加载 ====================

async function loadData() {
  await baseStore.loadAllData();
}

async function loadCharacters() {
  await characterStore.loadCharacterList();
}

/**
 * 刷新基础数据与角色列表
 *
 * 由 App.vue 在角色创建完成（handleCharacterCreated）和数据迁移成功（handleMigrated）后调用。
 * 角色列表刷新后，CharacterSelectPopup 通过响应式 store 自动更新展示。
 */
async function refreshData() {
  await loadData();
  await loadCharacters();
}

onMounted(async () => {
  // P8-504 修复：try/catch 包裹数据加载，防止 unhandled rejection
  try {
    await loadData();
    await loadCharacters();
  } catch (e) {
    console.error('[CharacterSelect] 初始化数据加载失败:', e);
    errorHandler.report(e);
  }
});

// ==================== 一级按钮处理 ====================

function openStartPopup() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'menu_start_game' });
  showCharacterSelectPopup.value = true;
}

function openArchivePopup() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'menu_archive' });
  showArchiveManager.value = true;
}

function openSystemPopup() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'menu_system' });
  showSystem.value = true;
}

function openAboutPopup() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'menu_about' });
  showAbout.value = true;
}

// ==================== 二级弹窗事件转发 ====================

/** CharacterSelectPopup 选中角色后转发给 App.vue */
function handleSelect(id: string) {
  emit('select', id);
}

/** CharacterSelectPopup 触发创建角色，转发给 App.vue 显示创建 modal */
function handleCreate() {
  emit('create');
}

/**
 * ArchiveManagerPopup 迁移成功后：
 * - emit('migrated') 通知 App.vue 重新初始化各 Store（刷新 versionMismatch）
 * - App.vue 的 handleMigrated 会回调本组件的 refreshData 刷新角色列表
 */
function handleMigrated() {
  emit('migrated');
}

/** 从系统菜单打开音量设置：关闭系统弹窗 → 懒挂载并打开音量设置弹窗 */
function openAudioFromSystem() {
  showSystem.value = false;
  popupMounted.audioSettings = true;
  showAudioSettings.value = true;
}

defineExpose({
  refreshData
});
</script>

<style lang="less" scoped>
.character-select {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

/* 版本不匹配警告横幅 */
.version-mismatch-banner {
  display: flex;
  align-items: center;
  gap: @spacing-md;
  padding: @spacing-xl @spacing-3xl;
  margin-bottom: @spacing-3xl;
  background: rgba(255, 68, 0, 0.12);
  border: 1px solid rgba(255, 68, 0, 0.5);
  border-radius: @radius-md;
  color: #ff7a4d;
  font-size: @font-md;
  font-weight: @font-weight-bold;
  animation: version-banner-pulse 2s ease-in-out infinite;
}

.version-mismatch-banner :deep(svg) {
  flex-shrink: 0;
}

@keyframes version-banner-pulse {
  0%, 100% {
    box-shadow: 0 0 8px rgba(255, 68, 0, 0.2);
  }
  50% {
    box-shadow: 0 0 16px rgba(255, 68, 0, 0.4);
  }
}

/* 4 个一级按钮：2x2 网格 */
.main-menu {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  max-width: 560px;
  margin: 0 auto;
}

/* 移动端：单列 */
@media (max-width: 480px) {
  .main-menu {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

.menu-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: @spacing-md;
  padding: @spacing-5xl @spacing-3xl;
  border-radius: @radius-lg;
  font-size: @font-xl;
  font-weight: @font-weight-bold;
  cursor: pointer;
  transition: all @transition-normal;
  border: 2px solid;
  min-height: 120px;
  box-sizing: border-box;
}

.menu-btn:hover {
  transform: translateY(-2px);
}

.menu-btn-label {
  letter-spacing: 1px;
}

/* 开始游戏 - 金色（主操作） */
.menu-btn-start {
  background: rgba(255, 215, 0, 0.15);
  border-color: rgba(255, 215, 0, 0.4);
  color: @accent-color;
}

.menu-btn-start:hover {
  background: rgba(255, 215, 0, 0.25);
  border-color: @accent-color;
  box-shadow: 0 4px 16px rgba(255, 215, 0, 0.3);
}

/* 存档管理 - 蓝色 */
.menu-btn-archive {
  background: rgba(0, 150, 255, 0.15);
  border-color: rgba(0, 150, 255, 0.4);
  color: #0096ff;
}

.menu-btn-archive:hover {
  background: rgba(0, 150, 255, 0.25);
  border-color: #0096ff;
  box-shadow: 0 4px 16px rgba(0, 150, 255, 0.3);
}

/* 系统设置 - 绿色 */
.menu-btn-system {
  background: rgba(0, 200, 100, 0.15);
  border-color: rgba(0, 200, 100, 0.4);
  color: #00c864;
}

.menu-btn-system:hover {
  background: rgba(0, 200, 100, 0.25);
  border-color: #00c864;
  box-shadow: 0 4px 16px rgba(0, 200, 100, 0.3);
}

/* 关于 - 暖灰色（低优先级，不抢主操作焦点） */
.menu-btn-about {
  background: @white-05;
  border-color: @white-15;
  color: @color-dodge;
}

.menu-btn-about:hover {
  background: @white-10;
  border-color: @color-dodge;
  box-shadow: 0 4px 16px @white-10;
}
</style>
