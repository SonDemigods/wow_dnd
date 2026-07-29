/**
 * @fileoverview 音频模块状态管理
 * @description Pinia store，管理音量、静音等音频设置状态。
 * 持久化委托给 AudioDbService（IndexedDB）。
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { audioDbService } from './db';
import type { AudioSettings } from './types';
import { DEFAULT_AUDIO_SETTINGS } from './types';

export const useAudioStore = defineStore('audio', () => {
  // ==================== 状态 ====================
  const settings = ref<AudioSettings>({ ...DEFAULT_AUDIO_SETTINGS });

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
  const saveTimer = ref<ReturnType<typeof setTimeout> | null>(null);

  /** 将当前设置写入数据库 */
  async function saveToDb(): Promise<void> {
    await audioDbService.saveSettings(settings.value);
  }

  /** 从数据库加载设置 */
  async function loadFromDb(): Promise<void> {
    const saved = await audioDbService.loadSettings();
    if (saved) {
      settings.value = {
        masterVolume: saved.masterVolume ?? DEFAULT_AUDIO_SETTINGS.masterVolume,
        sfxVolume: saved.sfxVolume ?? DEFAULT_AUDIO_SETTINGS.sfxVolume,
        bgmVolume: saved.bgmVolume ?? DEFAULT_AUDIO_SETTINGS.bgmVolume,
        muted: saved.muted ?? DEFAULT_AUDIO_SETTINGS.muted,
        sfxEnabled: saved.sfxEnabled ?? DEFAULT_AUDIO_SETTINGS.sfxEnabled,
        bgmEnabled: saved.bgmEnabled ?? DEFAULT_AUDIO_SETTINGS.bgmEnabled,
      };
    }
  }

  // ==================== 动作 ====================

  /**
   * 更新音频设置（立即更新状态，去抖写入 DB）
   */
  function updateSettings(patch: Partial<AudioSettings>): void {
    settings.value = { ...settings.value, ...patch };

    if (saveTimer.value) clearTimeout(saveTimer.value);
    saveTimer.value = setTimeout(() => {
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

  /** 设置音效音量 */
  function setSfxVolume(volume: number): void {
    updateSettings({ sfxVolume: Math.max(0, Math.min(1, volume)) });
  }

  /** 设置背景音乐音量 */
  function setBgmVolume(volume: number): void {
    updateSettings({ bgmVolume: Math.max(0, Math.min(1, volume)) });
  }

  /** 强制立即保存到 DB（用于组件卸载前） */
  async function flushSave(): Promise<void> {
    if (saveTimer.value) {
      clearTimeout(saveTimer.value);
      saveTimer.value = null;
    }
    await saveToDb();
  }

  /**
   * 释放 Store 持有的资源（角色切换时由 GameBootstrap.dispose 调用）
   *
   * 清理 saveTimer 去抖定时器并强制 flush 未写入的设置，
   * 避免快速角色切换时丢失音量等设置。
   * P2-66 修复：调用 flushSave 确保待写入数据落盘。
   * 注意：Disposable 接口要求 dispose(): void，因此 flushSave 以 fire-and-forget 方式调用，
   * 通过 .catch 记录错误而非中断 dispose 流程。
   */
  function dispose(): void {
    if (saveTimer.value) {
      clearTimeout(saveTimer.value);
      saveTimer.value = null;
    }
    // P2-66 修复：强制 flush，避免快速角色切换丢失设置
    flushSave().catch(err => console.error('[AudioStore] dispose flush 失败:', err));
  }

  return {
    settings,
    effectiveSfxVolume,
    effectiveBgmVolume,
    loadFromDb,
    updateSettings,
    toggleMute,
    setMasterVolume,
    setSfxVolume,
    setBgmVolume,
    flushSave,
    dispose,
  };
});
