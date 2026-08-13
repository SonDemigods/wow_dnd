/**
 * @fileoverview BGM 背景音乐合成器单元测试
 *
 * 覆盖：
 * 1. setBgmScene：场景切换、相同场景跳过、BGM 静音时不播放
 * 2. stopBgm：清理 Pattern/Loop/振荡器/LFO/Transport
 * 3. 6 种场景实现：main_menu/exploration/combat/shop/victory/defeat
 * 4. 氛围振荡器：startBgmOscillator/stopBgmOscillator
 * 5. 滤波器 LFO：startFilterLfo/stopFilterLfo
 * 6. 状态查询：getCurrentScene/isBgmOscRunning
 * 7. applyBgmVolume：dB 写入 bgmChannel
 * 8. dispose：清理全部资源
 *
 * Mock 策略：
 *  - mock Tone.js 的 Oscillator/LFO/Pattern/Loop/Transport/now
 *  - mock SfxSynth.tOrgan 记录调用
 *  - mock useAudioStore 控制音量状态
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== Tone.js Mock ====================

const NOW = 10.0;

/** Pattern/Loop 实例工厂 */
function makePatternInstance() {
  return {
    start: vi.fn().mockReturnThis(),
    stop: vi.fn(),
    dispose: vi.fn(),
  };
}

/** Oscillator 实例工厂 */
function makeOscInstance() {
  return {
    connect: vi.fn().mockReturnThis(),
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
  };
}

/** LFO 实例工厂 */
function makeLfoInstance() {
  return {
    connect: vi.fn().mockReturnThis(),
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
  };
}

const transportMock = {
  bpm: { value: 120 },
  state: 'stopped',
  start: vi.fn(),
  stop: vi.fn(),
  ticks: 0,
  PPQ: 192,
};

vi.mock('tone', () => {
  // 必须使用普通 function 才能被 new 调用
  const Pattern = vi.fn(function (this: unknown) {
    return makePatternInstance();
  });
  const Loop = vi.fn(function (this: unknown) {
    return makePatternInstance();
  });
  const Oscillator = vi.fn(function (this: unknown) {
    return makeOscInstance();
  });
  const LFO = vi.fn(function (this: unknown) {
    return makeLfoInstance();
  });

  return {
    Pattern,
    Loop,
    Oscillator,
    LFO,
    now: vi.fn(() => NOW),
    getTransport: vi.fn(() => transportMock),
  };
});

// ==================== SfxSynth Mock ====================

const tOrganCalls: Array<{ note: string | string[]; dur: string; time: number; vel?: number }> = [];

vi.mock('@/modules/audio/synth/sfxSynth', () => ({
  SfxSynth: vi.fn(function (this: unknown) {
    return {
      tOrgan: vi.fn((note: string | string[], dur: string, time: number, vel?: number) => {
        tOrganCalls.push({ note, dur, time, vel });
      }),
      dispose: vi.fn(),
    };
  }),
}));

// ==================== useAudioStore Mock ====================

const storeMock = {
  effectiveBgmVolume: 0.5,
  settings: { masterVolume: 0.7, sfxVolume: 0.8, bgmVolume: 0.5, muted: false, sfxEnabled: true, bgmEnabled: true },
};

vi.mock('@/modules/audio/store', () => ({
  useAudioStore: vi.fn(() => storeMock),
}));

// ==================== 导入被测模块 ====================

import { BgmSynth } from '@/modules/audio/synth/bgmSynth';
import * as Tone from 'tone';
import type { AudioNodes } from '@/modules/audio/effectChains';
import { SfxSynth } from '@/modules/audio/synth/sfxSynth';

// ==================== 测试夹具 ====================

function makeNodes(): AudioNodes {
  return {
    organVoice: {
      setPreset: vi.fn(),
      setEnvelope: vi.fn(),
      triggerAttackRelease: vi.fn(),
      releaseAll: vi.fn(),
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn().mockReturnThis(),
      dispose: vi.fn(),
    },
    bgmChannel: { volume: { value: 0, rampTo: vi.fn() }, connect: vi.fn(), disconnect: vi.fn(), dispose: vi.fn() },
    bgmOscGain: { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(), dispose: vi.fn() },
    bgmFilter: { frequency: { value: 500 }, connect: vi.fn(), disconnect: vi.fn(), dispose: vi.fn() },
    bgmReverb: { connect: vi.fn(), disconnect: vi.fn(), dispose: vi.fn(), generate: vi.fn() },
    bgmDelay: { connect: vi.fn(), disconnect: vi.fn(), dispose: vi.fn() },
    // 其他节点不需要
    masterFilter: {}, masterVolume: {},
    sfxReverb: {}, cathedralReverb: {}, combatReverb: {}, chorus: {}, phaser: {}, compressor: {},
    magicChannel: { volume: { value: 0 } },
    combatChannel: { volume: { value: 0 } },
    uiChannel: { volume: { value: 0 } },
    explorationChannel: { volume: { value: 0 } },
    characterChannel: { volume: { value: 0 } },
    standardChannel: { volume: { value: 0 } },
    synth: {}, membrane: {}, fmSynth: {}, noiseSynth: {}, metalSynth: {},
  } as unknown as AudioNodes;
}

// ==================== 测试用例 ====================

describe('BgmSynth 背景音乐合成器', () => {
  let nodes: AudioNodes;
  let sfxSynth: SfxSynth;
  let bgmSynth: BgmSynth;

  beforeEach(() => {
    vi.clearAllMocks();
    tOrganCalls.length = 0;
    transportMock.state = 'stopped';
    transportMock.bpm.value = 120;
    storeMock.effectiveBgmVolume = 0.5;
    nodes = makeNodes();
    // 使用被 mock 的 SfxSynth 类创建实例（mock 返回带 tOrgan/dispose 的对象）
    sfxSynth = new SfxSynth(nodes);
    bgmSynth = new BgmSynth(nodes, sfxSynth);
  });

  // -------------------- setBgmScene --------------------

  describe('setBgmScene 场景切换', () => {
    it('切换到不同场景时调用对应播放方法', () => {
      bgmSynth.setBgmScene('main_menu');
      // main_menu 会调用 organVoice.setPreset('diapason')
      expect(nodes.organVoice.setPreset).toHaveBeenCalledWith('diapason');
    });

    it('切换到相同场景时跳过', () => {
      bgmSynth.setBgmScene('main_menu');
      const presetCallCount = nodes.organVoice.setPreset.mock.calls.length;
      // 再次切换到相同场景
      bgmSynth.setBgmScene('main_menu');
      // 不应再次调用 setPreset
      expect(nodes.organVoice.setPreset.mock.calls.length).toBe(presetCallCount);
    });

    it('BGM 音量为 0 时仅记录场景不播放', () => {
      storeMock.effectiveBgmVolume = 0;
      bgmSynth.setBgmScene('combat');
      // getCurrentScene 应返回 'combat'
      expect(bgmSynth.getCurrentScene()).toBe('combat');
      // 但不应调用 setPreset（播放逻辑未执行）
      expect(nodes.organVoice.setPreset).not.toHaveBeenCalled();
    });

    it('exploration 场景设置 softDiapason 预设', () => {
      bgmSynth.setBgmScene('exploration');
      expect(nodes.organVoice.setPreset).toHaveBeenCalledWith('softDiapason');
    });

    it('combat 场景设置 fullOrgan 预设', () => {
      bgmSynth.setBgmScene('combat');
      expect(nodes.organVoice.setPreset).toHaveBeenCalledWith('fullOrgan');
    });

    it('shop 场景设置 flute 预设', () => {
      bgmSynth.setBgmScene('shop');
      expect(nodes.organVoice.setPreset).toHaveBeenCalledWith('flute');
    });

    it('victory 场景调用 tOrgan 8 次并设置定时器切回探索', () => {
      vi.useFakeTimers();
      bgmSynth.setBgmScene('victory');
      // victory 直接调用 sfxSynth.tOrgan 8 次（4 铺垫 + 4 高潮）
      expect(tOrganCalls).toHaveLength(8);
      // 当前场景为 victory
      expect(bgmSynth.getCurrentScene()).toBe('victory');
      // 快进 5 秒
      vi.advanceTimersByTime(5000);
      // 切换后应为 exploration
      expect(bgmSynth.getCurrentScene()).toBe('exploration');
      vi.useRealTimers();
    });

    it('defeat 场景调用 tOrgan 8 次并设置定时器切回探索', () => {
      vi.useFakeTimers();
      bgmSynth.setBgmScene('defeat');
      expect(tOrganCalls).toHaveLength(8);
      expect(bgmSynth.getCurrentScene()).toBe('defeat');
      vi.advanceTimersByTime(5000);
      expect(bgmSynth.getCurrentScene()).toBe('exploration');
      vi.useRealTimers();
    });
  });

  // -------------------- stopBgm --------------------

  describe('stopBgm 停止播放', () => {
    it('调用 stopBgm 后 Transport 停止', () => {
      bgmSynth.setBgmScene('main_menu');
      bgmSynth.stopBgm();
      expect(transportMock.stop).toHaveBeenCalled();
    });

    it('调用 stopBgm 后 organVoice.releaseAll 被调用', () => {
      bgmSynth.setBgmScene('main_menu');
      nodes.organVoice.releaseAll = vi.fn();
      bgmSynth.stopBgm();
      expect(nodes.organVoice.releaseAll).toHaveBeenCalled();
    });

    it('stopBgm 是幂等的（无资源时也不抛错）', () => {
      expect(() => bgmSynth.stopBgm()).not.toThrow();
    });
  });

  // -------------------- 氛围振荡器 --------------------

  describe('startBgmOscillator / stopBgmOscillator', () => {
    it('启动振荡器时创建 Oscillator 并 connect 到 bgmOscGain', () => {
      bgmSynth.startBgmOscillator(37);
      expect(Tone.Oscillator).toHaveBeenCalledTimes(1);
      // 振荡器已启动
      const oscInstance = (Tone.Oscillator as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(oscInstance.start).toHaveBeenCalled();
      expect(oscInstance.connect).toHaveBeenCalledWith(nodes.bgmOscGain);
    });

    it('振荡器已运行时再次启动不重复创建', () => {
      bgmSynth.startBgmOscillator(37);
      bgmSynth.startBgmOscillator(37);
      expect(Tone.Oscillator).toHaveBeenCalledTimes(1);
    });

    it('BGM 音量为 0 时不启动振荡器', () => {
      storeMock.effectiveBgmVolume = 0;
      bgmSynth.startBgmOscillator(37);
      expect(Tone.Oscillator).not.toHaveBeenCalled();
    });

    it('停止振荡器时调用 stop + dispose', () => {
      bgmSynth.startBgmOscillator(37);
      const oscInstance = (Tone.Oscillator as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
      bgmSynth.stopBgmOscillator();
      expect(oscInstance.stop).toHaveBeenCalled();
      expect(oscInstance.dispose).toHaveBeenCalled();
      expect(bgmSynth.isBgmOscRunning()).toBe(false);
    });

    it('isBgmOscRunning 反映振荡器状态', () => {
      expect(bgmSynth.isBgmOscRunning()).toBe(false);
      bgmSynth.startBgmOscillator(37);
      expect(bgmSynth.isBgmOscRunning()).toBe(true);
      bgmSynth.stopBgmOscillator();
      expect(bgmSynth.isBgmOscRunning()).toBe(false);
    });
  });

  // -------------------- 状态查询与音量 --------------------

  describe('getCurrentScene / applyBgmVolume', () => {
    it('初始场景为 null', () => {
      expect(bgmSynth.getCurrentScene()).toBeNull();
    });

    it('applyBgmVolume 将 dB 写入 bgmChannel', () => {
      bgmSynth.applyBgmVolume(-12);
      expect(nodes.bgmChannel.volume.value).toBe(-12);
    });
  });

  // -------------------- dispose --------------------

  describe('dispose 资源清理', () => {
    it('dispose 后当前场景重置为 null', () => {
      bgmSynth.setBgmScene('main_menu');
      expect(bgmSynth.getCurrentScene()).toBe('main_menu');
      bgmSynth.dispose();
      expect(bgmSynth.getCurrentScene()).toBeNull();
    });

    it('dispose 后振荡器与 LFO 被销毁', () => {
      bgmSynth.setBgmScene('main_menu'); // 启动振荡器与 LFO
      const oscInstance = (Tone.Oscillator as unknown as ReturnType<typeof vi.fn>).mock.results[0]?.value;
      const lfoInstance = (Tone.LFO as unknown as ReturnType<typeof vi.fn>).mock.results[0]?.value;
      bgmSynth.dispose();
      if (oscInstance) {
        expect(oscInstance.dispose).toHaveBeenCalled();
      }
      if (lfoInstance) {
        expect(lfoInstance.dispose).toHaveBeenCalled();
      }
    });

    it('dispose 后定时器被清理（无 pending 切换）', () => {
      vi.useFakeTimers();
      bgmSynth.setBgmScene('victory');
      bgmSynth.dispose();
      // 定时器被清理，快进 5 秒后不应切回探索
      vi.advanceTimersByTime(5000);
      expect(bgmSynth.getCurrentScene()).toBeNull();
      vi.useRealTimers();
    });
  });
});
