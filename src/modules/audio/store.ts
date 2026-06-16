/**
 * @fileoverview 音频模块状态管理
 * @description Pinia store，管理音量、静音等音频设置状态。
 * 持久化委托给 AudioDbService（IndexedDB）。
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { audioDbService } from './db';
import type { AudioSettings } from './types';

/** 默认音频设置 */
const defaultSettings: AudioSettings = {
  masterVolume: 0.7,
  sfxVolume: 0.8,
  bgmVolume: 0.5,
  muted: false,
  sfxEnabled: true,
  bgmEnabled: true,
};

export const useAudioStore = defineStore('audio', () => {
  // ==================== 状态 ====================
  const settings = ref<AudioSettings>({ ...defaultSettings });
  const loaded = ref(false);

  // ==================== 计算属性 ====================
  /** 实际生效的音效音量（考虑静音与主音量） */
  const effectiveSfxVolume = computed(() =>
    settings.value.muted || !settings.value.sfxEnabled
      ? 0
      : settings.value.masterVolume * settings.value.sfxVolume
  );

  /** 实际生效的 BGM 音量 */
  const effectiveBgmVolume = computed(() =>
    settings.value.muted || !settings.value.bgmEnabled
      ? 0
      : settings.value.masterVolume * settings.value.bgmVolume
  );

  // ==================== 持久化 ====================
  /** DB 写入去抖定时器 */
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  /** 将当前设置写入数据库 */
  async function saveToDb(): Promise<void> {
    await audioDbService.saveSettings(settings.value);
  }

  /** 从数据库加载设置 */
  async function loadFromDb(): Promise<void> {
    const saved = await audioDbService.loadSettings();
    if (saved) {
      settings.value = {
        masterVolume: saved.masterVolume ?? defaultSettings.masterVolume,
        sfxVolume: saved.sfxVolume ?? defaultSettings.sfxVolume,
        bgmVolume: saved.bgmVolume ?? defaultSettings.bgmVolume,
        muted: saved.muted ?? defaultSettings.muted,
        sfxEnabled: saved.sfxEnabled ?? defaultSettings.sfxEnabled,
        bgmEnabled: saved.bgmEnabled ?? defaultSettings.bgmEnabled,
      };
    }
    loaded.value = true;
  }

  // ==================== 动作 ====================

  /**
   * 更新音频设置（立即更新状态，去抖写入 DB）
   */
  function updateSettings(patch: Partial<AudioSettings>): void {
    settings.value = { ...settings.value, ...patch };

    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveToDb();
    }, 300);
  }

  /** 切换静音 */
  function toggleMute(): void {
    updateSettings({ muted: !settings.value.muted });
  }

  /** 设置主音量 */
  function setMasterVolume(volume: number): void {
    updateSettings({ masterVolume: Math.max(0, Math.min(1, volume)) });
  }

  /** 强制立即保存到 DB（用于组件卸载前） */
  async function flushSave(): Promise<void> {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    await saveToDb();
  }

  return {
    settings,
    loaded,
    effectiveSfxVolume,
    effectiveBgmVolume,
    loadFromDb,
    updateSettings,
    toggleMute,
    setMasterVolume,
    flushSave,
  };
});
