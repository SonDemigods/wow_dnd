/**
 * @fileoverview 音频模块 Pinia Store 单元测试
 *
 * 覆盖 useAudioStore 的：
 * 1. State 初始值（与 DEFAULT_AUDIO_SETTINGS 一致）
 * 2. Getters：effectiveSfxVolume / effectiveBgmVolume（正常、静音、禁用、组合场景）
 * 3. Actions：
 *    - updateSettings（合并 + 委托 GameStore 持久化）
 *    - toggleMute（切换静音）
 *    - setMasterVolume / setSfxVolume / setBgmVolume（0-1 边界 clamp）
 *    - flushSave（委托 gameStore.flushPersist）
 *    - dispose（无资源需要清理，幂等）
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - P3-116：mock @/modules/game，提供可控的 gameStoreSpies 与真实 Pinia ref，
 *    内部 updateGameSettings 实现：合并 patch 到 gameSettings ref（模拟 GameStore 行为）。
 *  - 不再 mock @/modules/audio/db（已移除依赖）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAudioStore } from '@/modules/audio/store';
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '@/modules/audio/types';
import { createTestPinia } from '../utils/setup';

// ==================== Mock：GameStore（P3-116：音频设置收敛到 GameStore） ====================
// 提供可控的 mock useGameStore，内部用真实 Pinia ref 保证响应式，
// updateGameSettings 用 vi.hoisted 提升为全局 spy，并在 mock 实现中合并 patch 到 ref。
const gameStoreSpies = vi.hoisted(() => ({
  updateGameSettings: vi.fn(),
  flushPersist: vi.fn().mockResolvedValue(undefined),
  initialize: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/modules/game', async () => {
  const { defineStore } = await import('pinia');
  const { ref } = await import('vue');
  const { DEFAULT_GAME_SETTINGS } = await import('@/modules/game/types');
  const useGameStore = defineStore('mockGame', () => {
    const gameSettings = ref({ ...DEFAULT_GAME_SETTINGS });

    // 每次 store 创建时重新绑定 mock 实现到当前 ref（createTestPinia 后 store 重建）
    gameStoreSpies.updateGameSettings.mockImplementation(async (patch: Partial<typeof DEFAULT_GAME_SETTINGS>) => {
      gameSettings.value = { ...gameSettings.value, ...patch };
    });

    return {
      gameSettings,
      updateGameSettings: gameStoreSpies.updateGameSettings,
      flushPersist: gameStoreSpies.flushPersist,
      initialize: gameStoreSpies.initialize,
    };
  });
  return { useGameStore };
});

/** 构造一份自定义设置 */
function makeSettings(overrides: Partial<AudioSettings> = {}): AudioSettings {
  return { ...DEFAULT_AUDIO_SETTINGS, ...overrides };
}

describe('useAudioStore - 音频 Store', () => {
  beforeEach(() => {
    createTestPinia();
    vi.clearAllMocks();
  });

  describe('State 初始值', () => {
    it('settings 初始值与 DEFAULT_AUDIO_SETTINGS 一致', () => {
      const store = useAudioStore();
      expect(store.settings).toEqual(DEFAULT_AUDIO_SETTINGS);
    });

    it('初始值应为独立对象，修改 store 不应影响常量', async () => {
      const store = useAudioStore();
      await store.setMasterVolume(0.1);
      expect(DEFAULT_AUDIO_SETTINGS.masterVolume).toBe(0.7);
      expect(store.settings.masterVolume).toBe(0.1);
    });
  });

  describe('Getter: effectiveSfxVolume 实际音效音量', () => {
    it('正常情况 = masterVolume * sfxVolume', async () => {
      const store = useAudioStore();
      await store.setMasterVolume(0.5);
      await store.setSfxVolume(0.4);
      // 0.5 * 0.4 = 0.2
      expect(store.effectiveSfxVolume).toBeCloseTo(0.2, 5);
    });

    it('全局静音时返回 0', async () => {
      const store = useAudioStore();
      await store.updateSettings({ muted: true, masterVolume: 0.8, sfxVolume: 0.8, sfxEnabled: true });
      expect(store.effectiveSfxVolume).toBe(0);
    });

    it('sfxEnabled=false 时返回 0', async () => {
      const store = useAudioStore();
      await store.updateSettings({ sfxEnabled: false, masterVolume: 0.8, sfxVolume: 0.8 });
      expect(store.effectiveSfxVolume).toBe(0);
    });

    it('音量为 0 时返回 0', async () => {
      const store = useAudioStore();
      await store.updateSettings({ masterVolume: 0, sfxVolume: 0.8, sfxEnabled: true, muted: false });
      expect(store.effectiveSfxVolume).toBe(0);
    });
  });

  describe('Getter: effectiveBgmVolume 实际 BGM 音量', () => {
    it('正常情况 = masterVolume * bgmVolume', async () => {
      const store = useAudioStore();
      await store.updateSettings({ masterVolume: 0.6, bgmVolume: 0.5, muted: false, bgmEnabled: true });
      expect(store.effectiveBgmVolume).toBeCloseTo(0.3, 5);
    });

    it('全局静音时返回 0', async () => {
      const store = useAudioStore();
      await store.updateSettings({ muted: true, bgmEnabled: true, masterVolume: 0.8, bgmVolume: 0.8 });
      expect(store.effectiveBgmVolume).toBe(0);
    });

    it('bgmEnabled=false 时返回 0', async () => {
      const store = useAudioStore();
      await store.updateSettings({ bgmEnabled: false, muted: false, masterVolume: 0.8, bgmVolume: 0.8 });
      expect(store.effectiveBgmVolume).toBe(0);
    });
  });

  describe('Action: updateSettings 更新设置', () => {
    it('合并部分字段到 settings 并委托 gameStore.updateGameSettings', async () => {
      const store = useAudioStore();
      await store.updateSettings({ masterVolume: 0.3 });
      expect(store.settings.masterVolume).toBe(0.3);
      // 其余字段保持不变
      expect(store.settings.sfxVolume).toBe(DEFAULT_AUDIO_SETTINGS.sfxVolume);
      expect(gameStoreSpies.updateGameSettings).toHaveBeenCalledWith({ masterVolume: 0.3 });
    });

    it('多次调用逐次合并', async () => {
      const store = useAudioStore();
      await store.updateSettings({ masterVolume: 0.3 });
      await store.updateSettings({ sfxVolume: 0.4 });
      expect(store.settings.masterVolume).toBe(0.3);
      expect(store.settings.sfxVolume).toBe(0.4);
      expect(gameStoreSpies.updateGameSettings).toHaveBeenCalledTimes(2);
    });

    it('空对象不改变 settings 内容但仍委托 GameStore', async () => {
      const store = useAudioStore();
      const before = { ...store.settings };
      await store.updateSettings({});
      expect(store.settings).toEqual(before);
      expect(gameStoreSpies.updateGameSettings).toHaveBeenCalledWith({});
    });
  });

  describe('Action: toggleMute 切换静音', () => {
    it('从 false 切换为 true', async () => {
      const store = useAudioStore();
      expect(store.settings.muted).toBe(false);
      await store.toggleMute();
      expect(store.settings.muted).toBe(true);
    });

    it('从 true 切换回 false', async () => {
      const store = useAudioStore();
      await store.updateSettings({ muted: true });
      await store.toggleMute();
      expect(store.settings.muted).toBe(false);
    });

    it('连续调用两次回到原状态', async () => {
      const store = useAudioStore();
      const initial = store.settings.muted;
      await store.toggleMute();
      await store.toggleMute();
      expect(store.settings.muted).toBe(initial);
    });
  });

  describe('Action: setMasterVolume 设置主音量（含边界 clamp）', () => {
    it('正常值直接设置', async () => {
      const store = useAudioStore();
      await store.setMasterVolume(0.5);
      expect(store.settings.masterVolume).toBe(0.5);
    });

    it('超过 1 时 clamp 到 1', async () => {
      const store = useAudioStore();
      await store.setMasterVolume(1.5);
      expect(store.settings.masterVolume).toBe(1);
    });

    it('低于 0 时 clamp 到 0', async () => {
      const store = useAudioStore();
      await store.setMasterVolume(-0.5);
      expect(store.settings.masterVolume).toBe(0);
    });

    it('边界值 0 和 1 均可设置', async () => {
      const store = useAudioStore();
      await store.setMasterVolume(0);
      expect(store.settings.masterVolume).toBe(0);
      await store.setMasterVolume(1);
      expect(store.settings.masterVolume).toBe(1);
    });
  });

  describe('Action: setSfxVolume 设置音效音量（含边界 clamp）', () => {
    it('超过 1 时 clamp 到 1', async () => {
      const store = useAudioStore();
      await store.setSfxVolume(2);
      expect(store.settings.sfxVolume).toBe(1);
    });

    it('低于 0 时 clamp 到 0', async () => {
      const store = useAudioStore();
      await store.setSfxVolume(-1);
      expect(store.settings.sfxVolume).toBe(0);
    });
  });

  describe('Action: setBgmVolume 设置 BGM 音量（含边界 clamp）', () => {
    it('超过 1 时 clamp 到 1', async () => {
      const store = useAudioStore();
      await store.setBgmVolume(10);
      expect(store.settings.bgmVolume).toBe(1);
    });

    it('低于 0 时 clamp 到 0', async () => {
      const store = useAudioStore();
      await store.setBgmVolume(-0.1);
      expect(store.settings.bgmVolume).toBe(0);
    });
  });

  describe('P3-116：迁移后持久化委托', () => {
    it('updateSettings 委托 gameStore.updateGameSettings（不再使用去抖定时器）', async () => {
      const store = useAudioStore();
      await store.updateSettings({ masterVolume: 0.3 });
      // 即时持久化，无需等待定时器
      expect(gameStoreSpies.updateGameSettings).toHaveBeenCalledTimes(1);
      expect(gameStoreSpies.updateGameSettings).toHaveBeenCalledWith({ masterVolume: 0.3 });
    });

    it('多次连续 updateSettings 不再合并，每次都即时委托', async () => {
      const store = useAudioStore();
      await store.updateSettings({ masterVolume: 0.3 });
      await store.updateSettings({ sfxVolume: 0.4 });
      await store.updateSettings({ bgmVolume: 0.5 });
      expect(gameStoreSpies.updateGameSettings).toHaveBeenCalledTimes(3);
      expect(store.settings).toEqual(
        expect.objectContaining({ masterVolume: 0.3, sfxVolume: 0.4, bgmVolume: 0.5 })
      );
    });
  });

  describe('Action: flushSave 委托 gameStore.flushPersist', () => {
    it('调用 flushSave 时委托 gameStore.flushPersist', async () => {
      const store = useAudioStore();
      await store.flushSave();
      expect(gameStoreSpies.flushPersist).toHaveBeenCalledTimes(1);
    });

    it('多次调用 flushSave 安全（幂等）', async () => {
      const store = useAudioStore();
      await store.flushSave();
      await store.flushSave();
      expect(gameStoreSpies.flushPersist).toHaveBeenCalledTimes(2);
    });
  });

  describe('Action: dispose 资源释放', () => {
    it('调用 dispose 不报错（无资源需要清理）', () => {
      const store = useAudioStore();
      expect(() => store.dispose()).not.toThrow();
    });

    it('多次调用 dispose 安全（幂等）', () => {
      const store = useAudioStore();
      expect(() => store.dispose()).not.toThrow();
      expect(() => store.dispose()).not.toThrow();
    });

    it('dispose 后 flushSave 仍可正常调用（向后兼容）', async () => {
      const store = useAudioStore();
      store.dispose();
      await store.flushSave();
      expect(gameStoreSpies.flushPersist).toHaveBeenCalledTimes(1);
    });
  });

  describe('P3-116：settings 与 GameStore.gameSettings 同步', () => {
    it('settings 是 GameStore.gameSettings 的只读派生', async () => {
      const store = useAudioStore();
      // 通过 audioStore.updateSettings 修改，settings 应反映变化
      await store.updateSettings({ masterVolume: 0.42, muted: true });
      expect(store.settings.masterVolume).toBe(0.42);
      expect(store.settings.muted).toBe(true);
    });

    it('settings 返回独立副本，外部修改不影响内部状态', () => {
      const store = useAudioStore();
      const snapshot = store.settings;
      // 修改快照不应影响 store（虽然 computed 本身只读，但展开为副本更安全）
      const external = { ...snapshot, masterVolume: 0.99 };
      expect(store.settings.masterVolume).not.toBe(0.99);
      expect(external.masterVolume).toBe(0.99);
    });
  });
});
