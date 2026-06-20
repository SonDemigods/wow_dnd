<template>
  <BasePopup
    :visible="visible"
    title="系统"
    max-width="340px"
    :show-footer-close="false"
    @close="$emit('close')"
  >
    <div class="system-body">
      <button class="system-btn audio-btn" @click="openAudioSettings">
        <BaseIcon name="sound-on" gradient="gold" :size="20" />
        <span class="system-btn-label">音量设置</span>
      </button>
      <button class="system-btn exit-btn" @click="handleExit">
        <BaseIcon name="exit-door" gradient="blood" :size="20" />
        <span class="system-btn-label">退出游戏</span>
      </button>
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
 */

import { eventBus, GameEvents } from '@/modules/bus/core';
import BasePopup from '../common/BasePopup.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'exit'): void;
  (e: 'open-audio'): void;
}>();

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
</style>
