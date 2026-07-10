/**
 * @fileoverview 音频模块 Pinia Store 单元测试
 *
 * 覆盖 useAudioStore 的：
 * 1. State 初始值（与 DEFAULT_AUDIO_SETTINGS 一致）
 * 2. Getters：effectiveSfxVolume / effectiveBgmVolume（正常、静音、禁用、组合场景）
 * 3. Actions：
 *    - updateSettings（合并 + 去抖写库）
 *    - toggleMute（切换静音）
 *    - setMasterVolume / setSfxVolume / setBgmVolume（0-1 边界 clamp）
 *    - loadFromDb（有数据 / 无数据 / 字段缺失回退默认）
 *    - flushSave（清除定时器并立即写库）
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - audioDbService 全量 mock，断言调用次数与参数，不触碰真实 IndexedDB。
 *  - 使用 vi.useFakeTimers 验证 300ms 去抖写库逻辑。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAudioStore } from '@/modules/audio/store';
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '@/modules/audio/types';
import { createTestPinia } from '../utils/setup';

/** mock 音频数据层，避免触碰真实 IndexedDB */
vi.mock('@/modules/audio/db', () => ({
  audioDbService: {
    saveSettings: vi.fn().mockResolvedValue(undefined),
    loadSettings: vi.fn().mockResolvedValue(null),
  },
}));

/** 从 mock 中取出 spy 引用，便于断言 */
import { audioDbService } from '@/modules/audio/db';

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

    it('初始值应为独立对象，修改 store 不应影响常量', () => {
      const store = useAudioStore();
      store.setMasterVolume(0.1);
      expect(DEFAULT_AUDIO_SETTINGS.masterVolume).toBe(0.7);
      expect(store.settings.masterVolume).toBe(0.1);
    });
  });

  describe('Getter: effectiveSfxVolume 实际音效音量', () => {
    it('正常情况 = masterVolume * sfxVolume', () => {
      const store = useAudioStore();
      store.setMasterVolume(0.5);
      store.setSfxVolume(0.4);
      // 0.5 * 0.4 = 0.2，但需考虑去抖写库不影响 getter 计算
      expect(store.effectiveSfxVolume).toBeCloseTo(0.2, 5);
    });

    it('全局静音时返回 0', () => {
      const store = useAudioStore();
      store.updateSettings({ muted: true, masterVolume: 0.8, sfxVolume: 0.8, sfxEnabled: true });
      expect(store.effectiveSfxVolume).toBe(0);
    });

    it('sfxEnabled=false 时返回 0', () => {
      const store = useAudioStore();
      store.updateSettings({ sfxEnabled: false, masterVolume: 0.8, sfxVolume: 0.8 });
      expect(store.effectiveSfxVolume).toBe(0);
    });

    it('音量为 0 时返回 0', () => {
      const store = useAudioStore();
      store.updateSettings({ masterVolume: 0, sfxVolume: 0.8, sfxEnabled: true, muted: false });
      expect(store.effectiveSfxVolume).toBe(0);
    });
  });

  describe('Getter: effectiveBgmVolume 实际 BGM 音量', () => {
    it('正常情况 = masterVolume * bgmVolume', () => {
      const store = useAudioStore();
      store.updateSettings({ masterVolume: 0.6, bgmVolume: 0.5, muted: false, bgmEnabled: true });
      expect(store.effectiveBgmVolume).toBeCloseTo(0.3, 5);
    });

    it('全局静音时返回 0', () => {
      const store = useAudioStore();
      store.updateSettings({ muted: true, bgmEnabled: true, masterVolume: 0.8, bgmVolume: 0.8 });
      expect(store.effectiveBgmVolume).toBe(0);
    });

    it('bgmEnabled=false 时返回 0', () => {
      const store = useAudioStore();
      store.updateSettings({ bgmEnabled: false, muted: false, masterVolume: 0.8, bgmVolume: 0.8 });
      expect(store.effectiveBgmVolume).toBe(0);
    });
  });

  describe('Action: updateSettings 更新设置', () => {
    it('合并部分字段到 settings', () => {
      const store = useAudioStore();
      store.updateSettings({ masterVolume: 0.3 });
      expect(store.settings.masterVolume).toBe(0.3);
      // 其余字段保持不变
      expect(store.settings.sfxVolume).toBe(DEFAULT_AUDIO_SETTINGS.sfxVolume);
    });

    it('多次调用逐次合并', () => {
      const store = useAudioStore();
      store.updateSettings({ masterVolume: 0.3 });
      store.updateSettings({ sfxVolume: 0.4 });
      expect(store.settings.masterVolume).toBe(0.3);
      expect(store.settings.sfxVolume).toBe(0.4);
    });

    it('空对象不改变 settings 内容', () => {
      const store = useAudioStore();
      const before = { ...store.settings };
      store.updateSettings({});
      expect(store.settings).toEqual(before);
    });
  });

  describe('Action: toggleMute 切换静音', () => {
    it('从 false 切换为 true', () => {
      const store = useAudioStore();
      expect(store.settings.muted).toBe(false);
      store.toggleMute();
      expect(store.settings.muted).toBe(true);
    });

    it('从 true 切换回 false', () => {
      const store = useAudioStore();
      store.updateSettings({ muted: true });
      store.toggleMute();
      expect(store.settings.muted).toBe(false);
    });

    it('连续调用两次回到原状态', () => {
      const store = useAudioStore();
      const initial = store.settings.muted;
      store.toggleMute();
      store.toggleMute();
      expect(store.settings.muted).toBe(initial);
    });
  });

  describe('Action: setMasterVolume 设置主音量（含边界 clamp）', () => {
    it('正常值直接设置', () => {
      const store = useAudioStore();
      store.setMasterVolume(0.5);
      expect(store.settings.masterVolume).toBe(0.5);
    });

    it('超过 1 时 clamp 到 1', () => {
      const store = useAudioStore();
      store.setMasterVolume(1.5);
      expect(store.settings.masterVolume).toBe(1);
    });

    it('低于 0 时 clamp 到 0', () => {
      const store = useAudioStore();
      store.setMasterVolume(-0.5);
      expect(store.settings.masterVolume).toBe(0);
    });

    it('边界值 0 和 1 均可设置', () => {
      const store = useAudioStore();
      store.setMasterVolume(0);
      expect(store.settings.masterVolume).toBe(0);
      store.setMasterVolume(1);
      expect(store.settings.masterVolume).toBe(1);
    });
  });

  describe('Action: setSfxVolume 设置音效音量（含边界 clamp）', () => {
    it('超过 1 时 clamp 到 1', () => {
      const store = useAudioStore();
      store.setSfxVolume(2);
      expect(store.settings.sfxVolume).toBe(1);
    });

    it('低于 0 时 clamp 到 0', () => {
      const store = useAudioStore();
      store.setSfxVolume(-1);
      expect(store.settings.sfxVolume).toBe(0);
    });
  });

  describe('Action: setBgmVolume 设置 BGM 音量（含边界 clamp）', () => {
    it('超过 1 时 clamp 到 1', () => {
      const store = useAudioStore();
      store.setBgmVolume(10);
      expect(store.settings.bgmVolume).toBe(1);
    });

    it('低于 0 时 clamp 到 0', () => {
      const store = useAudioStore();
      store.setBgmVolume(-0.1);
      expect(store.settings.bgmVolume).toBe(0);
    });
  });

  describe('去抖写库逻辑（300ms）', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('updateSettings 后 300ms 内不写库', () => {
      const store = useAudioStore();
      store.updateSettings({ masterVolume: 0.3 });
      vi.advanceTimersByTime(299);
      expect(audioDbService.saveSettings).not.toHaveBeenCalled();
    });

    it('300ms 后触发写库一次', async () => {
      const store = useAudioStore();
      store.updateSettings({ masterVolume: 0.3 });
      vi.advanceTimersByTime(300);
      // flush microtasks 让 await 完成
      await vi.runOnlyPendingTimersAsync();
      expect(audioDbService.saveSettings).toHaveBeenCalledTimes(1);
      expect(audioDbService.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ masterVolume: 0.3 })
      );
    });

    it('多次连续 updateSettings 仅写库一次（去抖合并）', async () => {
      const store = useAudioStore();
      store.updateSettings({ masterVolume: 0.3 });
      store.updateSettings({ sfxVolume: 0.4 });
      store.updateSettings({ bgmVolume: 0.5 });
      vi.advanceTimersByTime(300);
      await vi.runOnlyPendingTimersAsync();
      expect(audioDbService.saveSettings).toHaveBeenCalledTimes(1);
      expect(store.settings).toEqual(
        expect.objectContaining({ masterVolume: 0.3, sfxVolume: 0.4, bgmVolume: 0.5 })
      );
    });
  });

  describe('Action: loadFromDb 从数据库加载', () => {
    it('DB 有完整数据时正确加载', async () => {
      const saved = makeSettings({
        masterVolume: 0.3, sfxVolume: 0.4, bgmVolume: 0.5,
        muted: true, sfxEnabled: false, bgmEnabled: false,
      });
      vi.mocked(audioDbService.loadSettings).mockResolvedValueOnce(saved);

      const store = useAudioStore();
      await store.loadFromDb();

      expect(store.settings).toEqual(saved);
    });

    it('DB 返回 null 时保持默认值不变', async () => {
      vi.mocked(audioDbService.loadSettings).mockResolvedValueOnce(null);
      const store = useAudioStore();
      await store.loadFromDb();
      expect(store.settings).toEqual(DEFAULT_AUDIO_SETTINGS);
    });

    it('DB 数据字段缺失时使用默认值兜底', async () => {
      // 模拟旧版本存档缺少部分字段
      vi.mocked(audioDbService.loadSettings).mockResolvedValueOnce({
        masterVolume: 0.3,
      } as AudioSettings);

      const store = useAudioStore();
      await store.loadFromDb();

      expect(store.settings.masterVolume).toBe(0.3);
      // 缺失字段回退到默认
      expect(store.settings.sfxVolume).toBe(DEFAULT_AUDIO_SETTINGS.sfxVolume);
      expect(store.settings.bgmVolume).toBe(DEFAULT_AUDIO_SETTINGS.bgmVolume);
      expect(store.settings.muted).toBe(DEFAULT_AUDIO_SETTINGS.muted);
    });
  });

  describe('Action: flushSave 立即写库', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('未安排定时器时直接写库', async () => {
      const store = useAudioStore();
      await store.flushSave();
      expect(audioDbService.saveSettings).toHaveBeenCalledTimes(1);
    });

    it('有待执行的去抖定时器时清除并立即写库一次', async () => {
      const store = useAudioStore();
      store.updateSettings({ masterVolume: 0.3 });
      // 此时去抖定时器已安排但未触发
      expect(audioDbService.saveSettings).not.toHaveBeenCalled();

      await store.flushSave();

      // 推进时间也不会再触发第二次
      vi.advanceTimersByTime(500);
      await vi.runOnlyPendingTimersAsync();
      expect(audioDbService.saveSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('Action: dispose 资源释放', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('未安排定时器时调用 dispose 不报错', () => {
      const store = useAudioStore();
      expect(() => store.dispose()).not.toThrow();
    });

    it('有待执行的去抖定时器时清除定时器，不再触发写库', () => {
      const store = useAudioStore();
      store.updateSettings({ masterVolume: 0.3 });
      // 此时去抖定时器已安排但未触发
      expect(audioDbService.saveSettings).not.toHaveBeenCalled();

      store.dispose();

      // 推进时间，定时器不应再触发
      vi.advanceTimersByTime(500);
      expect(audioDbService.saveSettings).not.toHaveBeenCalled();
    });

    it('多次调用 dispose 安全（幂等）', () => {
      const store = useAudioStore();
      store.updateSettings({ masterVolume: 0.3 });
      store.dispose();
      expect(() => store.dispose()).not.toThrow();
    });
  });
});
