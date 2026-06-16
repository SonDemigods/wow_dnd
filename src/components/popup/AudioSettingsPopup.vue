<template>
  <BasePopup
    :visible="visible"
    title="音量设置"
    max-width="420px"
    :show-footer-close="false"
    @close="$emit('close')"
  >
    <div class="audio-body">
      <!-- 主音量 -->
      <div class="slider-group">
        <div class="slider-label">
          <span class="slider-icon">🔈</span>
          <span>主音量</span>
          <span class="slider-value">{{ Math.round(store.settings.masterVolume * 100) }}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          :value="Math.round(store.settings.masterVolume * 100)"
          class="audio-slider"
          :disabled="store.settings.muted"
          @input="onMasterVolumeChange"
        />
      </div>

      <!-- 音效音量 -->
      <div class="slider-group">
        <div class="slider-label">
          <span class="slider-icon">🔔</span>
          <span>音效音量</span>
          <span class="slider-value">{{ Math.round(store.settings.sfxVolume * 100) }}%</span>
        </div>
        <div class="slider-row">
          <input
            type="range"
            min="0"
            max="100"
            :value="Math.round(store.settings.sfxVolume * 100)"
            class="audio-slider"
            :disabled="!store.settings.sfxEnabled || store.settings.muted"
            @input="onSfxVolumeChange"
          />
          <button
            :class="['toggle-btn', { active: store.settings.sfxEnabled }]"
            @click="toggleSfx"
          >
            {{ store.settings.sfxEnabled ? '开' : '关' }}
          </button>
        </div>
      </div>

      <!-- 背景音乐音量 -->
      <div class="slider-group">
        <div class="slider-label">
          <span class="slider-icon">🎵</span>
          <span>背景音乐</span>
          <span class="slider-value">{{ Math.round(store.settings.bgmVolume * 100) }}%</span>
        </div>
        <div class="slider-row">
          <input
            type="range"
            min="0"
            max="100"
            :value="Math.round(store.settings.bgmVolume * 100)"
            class="audio-slider"
            :disabled="!store.settings.bgmEnabled || store.settings.muted"
            @input="onBgmVolumeChange"
          />
          <button
            :class="['toggle-btn', { active: store.settings.bgmEnabled }]"
            @click="toggleBgm"
          >
            {{ store.settings.bgmEnabled ? '开' : '关' }}
          </button>
        </div>
      </div>

      <!-- 全局静音 -->
      <div class="mute-row">
        <button :class="['mute-btn', { muted: store.settings.muted }]" @click="onMuteClick">
          <span class="mute-icon">{{ store.settings.muted ? '🔇' : '🔊' }}</span>
          <span>{{ store.settings.muted ? '已静音' : '正常' }}</span>
        </button>
      </div>
    </div>

    <template #footer>
      <button class="popup-footer-btn confirm" @click="emitClose">确定</button>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
/**
 * @fileoverview 音量设置弹窗组件
 * @description 提供主音量、音效、背景音乐的音量滑块与独立开关，支持全局静音切换
 */

import { useAudioStore } from '@/modules/audio';
import { eventBus, GameEvents } from '@/modules/bus/core';
import BasePopup from '../common/BasePopup.vue';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

function emitClose() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'audio_settings_close' });
  emit('close');
}

const store = useAudioStore();

function onMasterVolumeChange(e: Event) {
  const value = Number((e.target as HTMLInputElement).value) / 100;
  store.setMasterVolume(value);
}

function onSfxVolumeChange(e: Event) {
  const value = Number((e.target as HTMLInputElement).value) / 100;
  store.updateSettings({ sfxVolume: value });
}

function onBgmVolumeChange(e: Event) {
  const value = Number((e.target as HTMLInputElement).value) / 100;
  store.updateSettings({ bgmVolume: value });
}

function onMuteClick() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'audio_mute' });
  store.toggleMute();
}

function toggleSfx() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'audio_toggle_sfx' });
  store.updateSettings({ sfxEnabled: !store.settings.sfxEnabled });
}

function toggleBgm() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'audio_toggle_bgm' });
  store.updateSettings({ bgmEnabled: !store.settings.bgmEnabled });
}
</script>

<style scoped>
.audio-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 8px 0;
}

.slider-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.slider-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ccc;
  font-size: 14px;
}

.slider-icon {
  font-size: 16px;
  width: 24px;
}

.slider-value {
  margin-left: auto;
  color: #ffd700;
  font-size: 13px;
  font-weight: bold;
  min-width: 36px;
  text-align: right;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.audio-slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

.audio-slider:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.audio-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffd700;
  cursor: pointer;
  border: 2px solid #b8960f;
  transition: transform 0.15s;
}

.audio-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.audio-slider:disabled::-webkit-slider-thumb {
  background: #666;
  border-color: #444;
  cursor: not-allowed;
}

.toggle-btn {
  padding: 4px 14px;
  min-width: 48px;
  border: 1px solid #4a4a4a;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: #888;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn.active {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
  color: #ffd700;
}

.toggle-btn:hover {
  border-color: #888;
}

.toggle-btn.active:hover {
  border-color: #ffd700;
}

.mute-row {
  display: flex;
  justify-content: center;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.mute-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 24px;
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: #ccc;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.25s;
}

.mute-btn:hover {
  border-color: #888;
  background: rgba(255, 255, 255, 0.1);
}

.mute-btn.muted {
  border-color: #ff4444;
  background: rgba(255, 68, 68, 0.1);
  color: #ff6b6b;
}

.mute-icon {
  font-size: 18px;
}
</style>
