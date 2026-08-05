<template>
  <BasePopup
    :visible="visible"
    title="系统设置"
    max-width="340px"
    :show-footer-close="false"
    @close="$emit('close')"
  >
    <div class="system-body">
      <button class="system-btn audio-btn" @click="openAudioSettings">
        <BaseIcon name="sound-on" gradient="gold" :size="20" />
        <span class="system-btn-label">音量设置</span>
      </button>
      <button v-if="showExitButton" class="system-btn exit-btn" @click="handleExit">
        <BaseIcon name="exit-door" gradient="blood" :size="20" />
        <span class="system-btn-label">返回主菜单</span>
      </button>

      <!-- 版本信息区块：显示三层版本号 -->
      <div class="about-section">
        <div class="about-title">版本信息</div>
        <div class="about-info">
          <div class="info-row">
            <span class="info-label">应用</span>
            <span class="info-value">{{ appVersion }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">数据</span>
            <span class="info-value">v{{ dataVersion }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">数据库</span>
            <span class="info-value">v{{ dbSchemaVersion }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <button class="popup-footer-btn" @click="handleClose">关闭</button>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
/**
 * @fileoverview 系统弹窗组件
 * @description 提供音量设置入口和退出游戏功能，作为游戏主界面底部"系统"按钮的弹出面板
 *
 * 版本号基线重构后新增"关于"区块，展示三层版本号（APP_VERSION / DATA_VERSION / DB_SCHEMA_VERSION），
 * 便于用户反馈问题时提供版本信息。
 */

import { eventBus, GameEvents } from '@/modules/bus';
import BasePopup from '../common/BasePopup.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import { APP_VERSION, DATA_VERSION, DB_SCHEMA_VERSION } from '@/config/version';

withDefaults(defineProps<{
  visible: boolean;
  /** 是否显示"返回主菜单"按钮：主菜单复用时传 false 隐藏，游戏内默认 true */
  showExitButton?: boolean;
}>(), {
  showExitButton: true,
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'exit'): void;
  (e: 'open-audio'): void;
}>();

/** 关于区块显示的版本号（来源于 version.ts 统一版本源） */
const appVersion = APP_VERSION;
const dataVersion = DATA_VERSION;
const dbSchemaVersion = DB_SCHEMA_VERSION;

function openAudioSettings() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'system_audio' });
  emit('close');
  emit('open-audio');
}

function handleExit() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'system_exit' });
  emit('exit');
}

function handleClose() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'system_close' });
  emit('close');
}
</script>

<style lang="less" scoped>
.system-body {
  .flex-col();
  gap: @spacing-3xl;
  padding: @spacing-md @spacing-xs;
}

.system-btn {
  display: flex;
  align-items: center;
  gap: @spacing-3xl;
  padding: @spacing-4xl 24px;
  border: @border-card;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  color: #ccc;
  cursor: pointer;
  transition: all 0.25s;
  font-size: @font-lg;
}

.system-btn:hover {
  transform: translateY(-2px);
}

.system-btn:active {
  transform: translateY(0);
}

.system-btn-icon {
  font-size: @font-5xl;
  line-height: 1;
}

.system-btn-label {
  font-weight: 500;
}

/* 音量按钮 */
.system-btn.audio-btn:hover {
  border-color: @accent-color;
  background: rgba(255, 215, 0, 0.08);
  color: @accent-color;
  box-shadow: 0 4px 16px @gold-bg;
}

/* 退出按钮 */
.system-btn.exit-btn {
  color: rgba(255, 100, 100, 0.8);
}

.system-btn.exit-btn:hover {
  border-color: @danger-color;
  background: rgba(255, 68, 68, 0.1);
  color: #ff6b6b;
  box-shadow: 0 4px 16px rgba(255, 68, 68, 0.1);
}

/* 关于区块：显示三层版本号 */
.about-section {
  margin-top: @spacing-md;
  padding: @spacing-3xl @spacing-2xl;
  border: @border-card;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
}

.about-title {
  color: @color-dodge;
  font-size: @font-md;
  font-weight: @font-weight-bold;
  margin-bottom: @spacing-xl;
  text-align: center;
  letter-spacing: 1px;
}

.about-info {
  display: flex;
  flex-direction: column;
  gap: @spacing-md;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: @font-sm;
}

.info-label {
  color: #888;
}

.info-value {
  color: @accent-color;
  font-weight: @font-weight-bold;
  font-family: monospace;
}
</style>
