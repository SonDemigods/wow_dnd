/**
 * @fileoverview 音频服务核心（AudioService）单元测试
 *
 * 覆盖：
 * 1. init：首次初始化、重复调用幂等、节点与合成器创建
 * 2. isReady：未初始化/未启动/已就绪状态
 * 3. playSfx / setBgmScene：未就绪时调用 tryResume、已就绪时委托子模块
 * 4. getSettings / updateSettings：store 代理
 * 5. destroy：资源清理、事件取消订阅、状态重置
 * 6. tryResume 失败回退：toast 提示
 * 7. applyVolume：音量映射、BGM 静音振荡器停止
 *
 * Mock 策略：
 *  - mock Tone.js（start/getContext/now）
 *  - mock effectChains（createAudioNodes/connectEffectChains/disposeAudioNodes）
 *  - mock SfxSynth / BgmSynth
 *  - mock useAudioStore / eventBus / useToast
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== Mock（使用 vi.hoisted 确保提升时已初始化） ====================

const {
  contextMock,
  createAudioNodesMock,
  connectEffectChainsMock,
  disposeAudioNodesMock,
  sfxSynthMock,
  bgmSynthMock,
  storeMock,
  eventBusMock,
  toastMock,
} = vi.hoisted(() => {
  const contextMock = { state: 'suspended' as 'suspended' | 'running' };
  const createAudioNodesMock = vi.fn();
  const connectEffectChainsMock = vi.fn();
  const disposeAudioNodesMock = vi.fn();
  const sfxSynthMock = {
    playSfx: vi.fn(),
    dispose: vi.fn(),
  };
  const bgmSynthMock = {
    setBgmScene: vi.fn(),
    stopBgm: vi.fn(),
    dispose: vi.fn(),
    stopBgmOscillator: vi.fn(),
    startBgmOscillator: vi.fn(),
    getCurrentScene: vi.fn().mockReturnValue(null),
    isBgmOscRunning: vi.fn().mockReturnValue(false),
    applyBgmVolume: vi.fn(),
  };
  const storeMock = {
    settings: { masterVolume: 0.7, sfxVolume: 0.8, bgmVolume: 0.5, muted: false, sfxEnabled: true, bgmEnabled: true },
    effectiveBgmVolume: 0.5,
    effectiveSfxVolume: 0.8,
    loadFromDb: vi.fn().mockResolvedValue(undefined),
    // P3-116：updateSettings 改为 async（委托 GameStore 持久化）
    updateSettings: vi.fn().mockResolvedValue(undefined),
    $subscribe: vi.fn().mockReturnValue(() => {}),
  };
  const eventBusMock = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };
  const toastMock = { show: vi.fn() };
  return {
    contextMock,
    createAudioNodesMock,
    connectEffectChainsMock,
    disposeAudioNodesMock,
    sfxSynthMock,
    bgmSynthMock,
    storeMock,
    eventBusMock,
    toastMock,
  };
});

// ==================== Tone.js Mock ====================

vi.mock('tone', () => ({
  start: vi.fn(async () => {
    contextMock.state = 'running';
  }),
  getContext: vi.fn(() => contextMock),
  now: vi.fn(() => 0),
}));

// ==================== effectChains Mock ====================

vi.mock('@/modules/audio/effectChains', () => ({
  createAudioNodes: (...args: unknown[]) => {
    createAudioNodesMock(...args);
    return {
      // 提供最小节点集，供 applyVolume 访问 volume.value
      masterVolume: { volume: { value: 0 } },
      magicChannel: { volume: { value: 0 } },
      combatChannel: { volume: { value: 0 } },
      uiChannel: { volume: { value: 0 } },
      explorationChannel: { volume: { value: 0 } },
      characterChannel: { volume: { value: 0 } },
      standardChannel: { volume: { value: 0 } },
      sfxReverb: { generate: vi.fn().mockResolvedValue(undefined) },
      cathedralReverb: { generate: vi.fn().mockResolvedValue(undefined) },
      combatReverb: { generate: vi.fn().mockResolvedValue(undefined) },
      bgmReverb: { generate: vi.fn().mockResolvedValue(undefined) },
    };
  },
  connectEffectChains: connectEffectChainsMock,
  disposeAudioNodes: disposeAudioNodesMock,
}));

// ==================== SfxSynth / BgmSynth Mock ====================

vi.mock('@/modules/audio/synth/sfxSynth', () => ({
  SfxSynth: vi.fn(function (this: unknown) {
    return sfxSynthMock;
  }),
}));

vi.mock('@/modules/audio/synth/bgmSynth', () => ({
  BgmSynth: vi.fn(function (this: unknown) {
    return bgmSynthMock;
  }),
}));

// ==================== Store / EventBus / Toast Mock ====================

vi.mock('@/modules/audio/store', () => ({
  useAudioStore: vi.fn(() => storeMock),
}));

vi.mock('@/modules/bus', () => ({
  eventBus: eventBusMock,
  GameEvents: {
    COMBAT_START: 'combat:start',
    COMBAT_END: 'combat:end',
    COMBAT_DEAL_DAMAGE: 'combat:deal_damage',
    COMBAT_CAST_HEAL: 'combat:cast_heal',
    COMBAT_CRITICAL_HIT: 'combat:critical_hit',
    COMBAT_DODGE: 'combat:dodge',
    COMBAT_SKIP_TURN: 'combat:skip_turn',
    CHARACTER_LEVEL_UP: 'character:level_up',
    CHARACTER_DEATH: 'character:death',
    CHARACTER_RESURRECTED: 'character:resurrected',
    CHARACTER_CREATED: 'character:created',
    CHARACTER_LOGOUT: 'character:logout',
    EXPLORATION_CELL_EXPLORED: 'exploration:cell_explored',
    EXPLORATION_ITEM_FOUND: 'exploration:item_found',
    EXPLORATION_TRAP_TRIGGERED: 'exploration:trap_triggered',
    EXPLORATION_BATTLE_TRIGGERED: 'exploration:battle_triggered',
    EXPLORATION_CAMP_USED: 'exploration:camp_used',
    EXPLORATION_RANDOM_EVENT: 'exploration:random_event',
    EXPLORATION_START: 'exploration:start',
    EXPLORATION_END: 'exploration:end',
    ZONE_ENTERED: 'zone:entered',
    SHOP_OPENED: 'shop:opened',
    SHOP_TRANSACTION: 'shop:transaction',
    SHOP_CLOSED: 'shop:closed',
    QUEST_ACCEPTED: 'quest:accepted',
    QUEST_COMPLETED: 'quest:completed',
    QUEST_REWARDED: 'quest:rewarded',
    SKILL_CAST: 'skill:cast',
    SKILL_LEARNED: 'skill:learned',
    UI_PANEL_OPENED: 'ui:panel_opened',
    UI_PANEL_CLOSED: 'ui:panel_closed',
    UI_CLICK: 'ui:click',
    CONFIRM_CONFIRMED: 'confirm:confirmed',
    CONFIRM_CANCELED: 'confirm:canceled',
    ITEM_DROPPED: 'item:dropped',
    DATA_EXPORTED: 'data:exported',
    DATA_IMPORTED: 'data:imported',
  },
}));

vi.mock('@/composables/useToast', () => ({
  useToast: vi.fn(() => toastMock),
}));

// ==================== 导入被测模块 ====================

import { audioService } from '@/modules/audio/service';
import * as Tone from 'tone';

// ==================== 测试用例 ====================

describe('AudioService 音频服务核心', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextMock.state = 'suspended';
    storeMock.effectiveBgmVolume = 0.5;
    storeMock.settings.masterVolume = 0.7;
    storeMock.settings.sfxVolume = 0.8;
    storeMock.settings.bgmVolume = 0.5;
    // 重置 audioService 内部状态（通过 destroy 后重新 init）
    audioService.destroy();
  });

  // -------------------- init --------------------

  describe('init 初始化', () => {
    it('首次 init 创建节点与合成器', async () => {
      await audioService.init();

      expect(createAudioNodesMock).toHaveBeenCalledTimes(1);
      // P3-116：loadFromDb 已移除，init 不再调用 store.loadFromDb
      // Store 订阅被注册
      expect(storeMock.$subscribe).toHaveBeenCalled();
    });

    it('重复 init 直接返回（幂等）', async () => {
      await audioService.init();
      createAudioNodesMock.mockClear();

      await audioService.init();
      // 不应再次创建节点
      expect(createAudioNodesMock).not.toHaveBeenCalled();
    });

    it('init 后 isReady 在 AudioContext 未启动时返回 false', async () => {
      await audioService.init();
      expect(audioService.isReady()).toBe(false);
    });

    it('init 后绑定事件总线监听器', async () => {
      await audioService.init();
      // 至少绑定了若干事件
      expect(eventBusMock.on).toHaveBeenCalled();
      expect(eventBusMock.on.mock.calls.length).toBeGreaterThan(10);
    });
  });

  // -------------------- playSfx / setBgmScene --------------------

  describe('playSfx / setBgmScene 未就绪回退', () => {
    it('未就绪时 playSfx 调用 tryResume 但不调用 sfxSynth', async () => {
      await audioService.init();
      sfxSynthMock.playSfx.mockClear();

      audioService.playSfx('attack_hit');
      // 未就绪时不委托给 sfxSynth
      expect(sfxSynthMock.playSfx).not.toHaveBeenCalled();
      // tryResume 调用了 Tone.start
      expect(Tone.start).toHaveBeenCalled();
    });

    it('未就绪时 setBgmScene 调用 tryResume 但不调用 bgmSynth', async () => {
      await audioService.init();
      bgmSynthMock.setBgmScene.mockClear();

      audioService.setBgmScene('combat');
      expect(bgmSynthMock.setBgmScene).not.toHaveBeenCalled();
      expect(Tone.start).toHaveBeenCalled();
    });

    it('就绪时 playSfx 委托给 sfxSynth', async () => {
      await audioService.init();
      // 模拟 AudioContext 启动
      contextMock.state = 'running';
      // 触发首次交互回调（模拟）
      // 由于 listenForFirstInteraction 注册了 document 事件监听，我们手动触发
      await simulateFirstInteraction();

      sfxSynthMock.playSfx.mockClear();
      audioService.playSfx('attack_hit');
      expect(sfxSynthMock.playSfx).toHaveBeenCalledWith('attack_hit');
    });

    it('就绪时 setBgmScene 委托给 bgmSynth', async () => {
      await audioService.init();
      contextMock.state = 'running';
      await simulateFirstInteraction();

      bgmSynthMock.setBgmScene.mockClear();
      audioService.setBgmScene('combat');
      expect(bgmSynthMock.setBgmScene).toHaveBeenCalledWith('combat');
    });

    it('stopBgm 委托给 bgmSynth', async () => {
      await audioService.init();
      bgmSynthMock.stopBgm.mockClear();
      audioService.stopBgm();
      expect(bgmSynthMock.stopBgm).toHaveBeenCalled();
    });
  });

  // -------------------- getSettings / updateSettings --------------------

  describe('getSettings / updateSettings', () => {
    it('getSettings 返回 store 设置的副本', async () => {
      await audioService.init();
      const settings = audioService.getSettings();
      expect(settings).toEqual(storeMock.settings);
      // 副本：修改不影响原对象
      settings.masterVolume = 0.1;
      expect(storeMock.settings.masterVolume).toBe(0.7);
    });

    it('updateSettings 代理到 store', async () => {
      await audioService.init();
      const partial = { masterVolume: 0.3 };
      audioService.updateSettings(partial);
      expect(storeMock.updateSettings).toHaveBeenCalledWith(partial);
    });
  });

  // -------------------- destroy --------------------

  describe('destroy 资源清理', () => {
    it('destroy 后 bgmSynth/sfxSynth/nodes 被清理', async () => {
      await audioService.init();
      bgmSynthMock.dispose.mockClear();
      sfxSynthMock.dispose.mockClear();
      disposeAudioNodesMock.mockClear();

      audioService.destroy();

      expect(bgmSynthMock.dispose).toHaveBeenCalled();
      expect(sfxSynthMock.dispose).toHaveBeenCalled();
      expect(disposeAudioNodesMock).toHaveBeenCalled();
    });

    it('destroy 后事件总线监听器全部取消', async () => {
      await audioService.init();
      const onCount = eventBusMock.on.mock.calls.length;
      eventBusMock.off.mockClear();

      audioService.destroy();

      expect(eventBusMock.off).toHaveBeenCalledTimes(onCount);
    });

    it('destroy 后 isReady 返回 false', async () => {
      await audioService.init();
      contextMock.state = 'running';
      await simulateFirstInteraction();
      expect(audioService.isReady()).toBe(true);

      audioService.destroy();
      expect(audioService.isReady()).toBe(false);
    });

    it('destroy 后可重新 init（状态重置）', async () => {
      await audioService.init();
      audioService.destroy();
      createAudioNodesMock.mockClear();

      await audioService.init();
      expect(createAudioNodesMock).toHaveBeenCalledTimes(1);
    });

    it('destroy 在未 init 时也不抛错（防御性）', () => {
      expect(() => audioService.destroy()).not.toThrow();
    });
  });

  // -------------------- tryResume 失败回退 --------------------

  describe('tryResume 失败回退', () => {
    it('Tone.start 失败时首次通过 toast 提示用户', async () => {
      await audioService.init();
      const startSpy = vi.mocked(Tone.start);
      startSpy.mockRejectedValueOnce(new Error('not allowed'));

      audioService.playSfx('attack_hit');
      // 等待微任务
      await vi.waitFor(() => {
        expect(toastMock.show).toHaveBeenCalledWith({
          message: '音效未能启动，请点击页面以启用音频',
          type: 'warning',
          duration: 3000,
        });
      });
    });

    it('Tone.start 失败时仅首次提示，后续失败不重复提示', async () => {
      await audioService.init();
      const startSpy = vi.mocked(Tone.start);
      startSpy.mockRejectedValue(new Error('not allowed'));

      audioService.playSfx('attack_hit');
      await vi.waitFor(() => expect(toastMock.show).toHaveBeenCalledTimes(1));

      audioService.playSfx('attack_hit');
      // 等待微任务
      await new Promise(r => setTimeout(r, 10));
      // 仍然只提示 1 次
      expect(toastMock.show).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------- applyVolume --------------------

  describe('applyVolume 音量映射', () => {
    it('init 后主音量与 SFX 通道音量被写入', async () => {
      storeMock.settings.masterVolume = 0.5;
      storeMock.settings.sfxVolume = 0.4;
      storeMock.settings.bgmVolume = 0.3;
      // P7-024 修复：applyVolume 现在使用 effective*Volume（含 muted 标志）
      storeMock.effectiveBgmVolume = 0.3;
      storeMock.effectiveSfxVolume = 0.4;

      await audioService.init();

      // applyVolume 在 init 中被调用
      // 主音量 dB = 20 * log10(0.5) ≈ -6.02
      // SFX dB = 20 * log10(0.4) ≈ -7.96  (通过 effectiveSfxVolume)
      // BGM dB = 20 * log10(0.3) ≈ -10.46  (通过 effectiveBgmVolume)
      expect(bgmSynthMock.applyBgmVolume).toHaveBeenCalledWith(expect.closeTo(-10.46, 1));
    });

    it('effectiveBgmVolume 为 0 时停止振荡器', async () => {
      storeMock.effectiveBgmVolume = 0;
      await audioService.init();

      expect(bgmSynthMock.stopBgmOscillator).toHaveBeenCalled();
    });

    it('有场景且振荡器未运行时启动振荡器', async () => {
      storeMock.effectiveBgmVolume = 0.5;
      bgmSynthMock.getCurrentScene.mockReturnValue('exploration');
      bgmSynthMock.isBgmOscRunning.mockReturnValue(false);

      await audioService.init();

      expect(bgmSynthMock.startBgmOscillator).toHaveBeenCalled();
    });
  });

  // -------------------- 辅助函数 --------------------

  /** 模拟首次用户交互，触发 listenForFirstInteraction 注册的 resume 回调 */
  async function simulateFirstInteraction(): Promise<void> {
    // audioService.init() 中通过 document.addEventListener 注册了一次性监听器
    // 我们手动派发 click 事件触发
    document.dispatchEvent(new Event('click'));
    // 等待 resume() 异步完成：contextReady + reverbReady 均被置 true
    // 仅等待 contextMock.state 不够，因为 resume() 是 async，contextReady 在 await Tone.start() 之后才设置
    await vi.waitFor(() => {
      expect(audioService.isReady()).toBe(true);
    });
  }
});
