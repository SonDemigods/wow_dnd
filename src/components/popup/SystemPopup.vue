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
        <span class="system-btn-icon">🔊</span>
        <span class="system-btn-label">音量设置</span>
      </button>
      <button class="system-btn exit-btn" @click="handleExit">
        <span class="system-btn-icon">🚪</span>
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

<style scoped>
.system-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 4px;
}

.system-btn {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  border: 2px solid #4a4a4a;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  color: #ccc;
  cursor: pointer;
  transition: all 0.25s;
  font-size: 16px;
}

.system-btn:hover {
  transform: translateY(-2px);
}

.system-btn:active {
  transform: translateY(0);
}

.system-btn-icon {
  font-size: 28px;
  line-height: 1;
}

.system-btn-label {
  font-weight: 500;
}

/* 音量按钮 */
.system-btn.audio-btn:hover {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.08);
  color: #ffd700;
  box-shadow: 0 4px 16px rgba(255, 215, 0, 0.1);
}

/* 退出按钮 */
.system-btn.exit-btn {
  color: rgba(255, 100, 100, 0.8);
}

.system-btn.exit-btn:hover {
  border-color: #ff4444;
  background: rgba(255, 68, 68, 0.1);
  color: #ff6b6b;
  box-shadow: 0 4px 16px rgba(255, 68, 68, 0.1);
}
</style>
