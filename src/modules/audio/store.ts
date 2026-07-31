/**
 * @fileoverview 音频模块状态管理
 * @description Pinia store，管理音量、静音等音频设置状态。
 *
 *   P3-116 修复：音频设置收敛到 GameStore.gameSettings，本 store 通过只读 computed
 *   代理访问。所有修改必须通过 updateSettings() 或具体 setter 完成（内部委托
 *   gameStore.updateGameSettings），持久化由 GameStore 统一负责，本 store 不再
 *   直接访问 IndexedDB。
 *
 *   修改历史：
 *   - 去除去抖定时器：GameStore.updateGameSettings 即时持久化，无需去抖合并
 *   - 移除 loadFromDb/saveToDb：初始化由 GameStore.initialize 负责
 *   - 移除 audioDbService 依赖：持久化层已迁移到 GameStore
 */

import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useGameStore } from '@/modules/game';
import type { AudioSettings } from './types';

export const useAudioStore = defineStore('audio', () => {
  // ==================== 状态（只读 computed 代理 GameStore） ====================

  const gameStore = useGameStore();

  /**
   * 当前音频设置（只读 computed，从 GameStore.gameSettings 派生）
   *
   * P3-116 修复：所有修改必须通过 updateSettings() 或具体 setter 完成，
   * 直接对 settings.value 赋值会触发 Vue 警告且不生效。
   */
  const settings = computed<AudioSettings>(() => ({
    masterVolume: gameStore.gameSettings.masterVolume,
    sfxVolume: gameStore.gameSettings.sfxVolume,
    bgmVolume: gameStore.gameSettings.bgmVolume,
    muted: gameStore.gameSettings.muted,
    sfxEnabled: gameStore.gameSettings.sfxEnabled,
    bgmEnabled: gameStore.gameSettings.bgmEnabled,
  }));

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

  // ==================== 动作 ====================

  /**
   * 更新音频设置（立即更新状态并持久化）
   *
   * P3-116 修复：持久化由 GameStore 负责，无需去抖定时器。
   * 方法签名从同步改为 async，调用方需 await 或以 fire-and-forget 方式调用。
   */
  async function updateSettings(patch: Partial<AudioSettings>): Promise<void> {
    await gameStore.updateGameSettings(patch);
  }

  /** 切换静音 */
  async function toggleMute(): Promise<void> {
    await updateSettings({ muted: !settings.value.muted });
  }

  /** 设置主音量 */
  async function setMasterVolume(volume: number): Promise<void> {
    await updateSettings({ masterVolume: Math.max(0, Math.min(1, volume)) });
  }

  /** 设置音效音量 */
  async function setSfxVolume(volume: number): Promise<void> {
    await updateSettings({ sfxVolume: Math.max(0, Math.min(1, volume)) });
  }

  /** 设置背景音乐音量 */
  async function setBgmVolume(volume: number): Promise<void> {
    await updateSettings({ bgmVolume: Math.max(0, Math.min(1, volume)) });
  }

  /**
   * 强制立即保存到 DB（用于组件卸载前）
   *
   * P3-116 修复：GameStore.updateGameSettings 已即时持久化，
   * 此方法保留为向后兼容接口，内部委托 gameStore.flushPersist。
   */
  async function flushSave(): Promise<void> {
    await gameStore.flushPersist();
  }

  /**
   * 释放 Store 持有的资源（角色切换时由 GameBootstrap.dispose 调用）
   *
   * P3-116 修复：去抖定时器已移除，dispose 无需清理资源。
   * 保留方法以满足 Disposable 接口，供 GameBootstrap 调用。
   */
  function dispose(): void {
    // 无资源需要清理
  }

  return {
    settings,
    effectiveSfxVolume,
    effectiveBgmVolume,
    updateSettings,
    toggleMute,
    setMasterVolume,
    setSfxVolume,
    setBgmVolume,
    flushSave,
    dispose,
  };
});
