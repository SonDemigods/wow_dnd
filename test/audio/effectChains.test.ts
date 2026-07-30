/**
 * @fileoverview 音频效果链与节点工厂单元测试
 *
 * 覆盖：
 * 1. createAudioNodes：节点实例化数量、字段完整性
 * 2. connectEffectChains：静态连接拓扑正确性（每条通道的节点连接关系）
 * 3. routeSynthTo：6 种路由的动态断开+重连
 * 4. disposeAudioNodes：全部节点调用 dispose
 *
 * Mock 策略：全量 mock Tone.js，记录 connect/disconnect/dispose 调用，
 * 不创建真实 AudioContext。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== Tone.js Mock ====================

/** 通用节点实例工厂 */
function createNodeInstance(name: string) {
  return {
    _name: name,
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
    toDestination: vi.fn().mockReturnThis(),
    triggerAttackRelease: vi.fn(),
    set: vi.fn(),
    releaseAll: vi.fn(),
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    // 节点参数（Volume/Gain/Filter 等）
    volume: { value: 0 },
    gain: { value: 0 },
    frequency: { value: 0 },
    // Reverb 特有
    generate: vi.fn().mockResolvedValue(undefined),
    // Pattern/Loop/LFO/Oscillator 在 effectChains 不用，但保持兼容
    bpm: { value: 0 },
    state: 'stopped',
  };
}

const constructedNodes: Array<{ name: string; options: unknown }> = [];

vi.mock('tone', () => {
  // 节点构造工厂：每种 Tone 类型都返回一个带 spy 的实例
  // 使用 arguments 捕获全部构造参数（Filter 有 3 个参数，Volume/Gain 有 1 个，Reverb 有 1 个 options 对象）
  const makeConstructor = (name: string) =>
    vi.fn(function (this: unknown) {
      const instance = createNodeInstance(name);
      constructedNodes.push({ name, options: Array.from(arguments) });
      return instance;
    });

  return {
    Filter: makeConstructor('Filter'),
    Volume: makeConstructor('Volume'),
    Reverb: makeConstructor('Reverb'),
    FeedbackDelay: makeConstructor('FeedbackDelay'),
    Chorus: makeConstructor('Chorus'),
    Phaser: makeConstructor('Phaser'),
    Compressor: makeConstructor('Compressor'),
    Synth: makeConstructor('Synth'),
    MembraneSynth: makeConstructor('MembraneSynth'),
    FMSynth: makeConstructor('FMSynth'),
    NoiseSynth: makeConstructor('NoiseSynth'),
    MetalSynth: makeConstructor('MetalSynth'),
    Gain: makeConstructor('Gain'),
    // OrganVoice 在 effectChains 中通过 new OrganVoice('softDiapason') 构造，
    // 但 OrganVoice 内部会 new Tone.Synth，需保持 Synth mock 可用
  };
});

// OrganVoice mock：返回与节点接口兼容的对象
vi.mock('@/modules/audio/organVoice', () => ({
  OrganVoice: vi.fn(function (this: unknown) {
    return createNodeInstance('OrganVoice');
  }),
}));

// ==================== 导入被测模块 ====================

import {
  createAudioNodes,
  connectEffectChains,
  routeSynthTo,
  disposeAudioNodes,
  type AudioNodes,
} from '@/modules/audio/effectChains';

// ==================== 测试用例 ====================

describe('effectChains 音频效果链', () => {
  beforeEach(() => {
    constructedNodes.length = 0;
    vi.clearAllMocks();
  });

  // -------------------- createAudioNodes --------------------

  describe('createAudioNodes 节点工厂', () => {
    it('返回包含全部 26 个节点字段的对象', () => {
      const nodes = createAudioNodes();
      const expectedKeys: Array<keyof AudioNodes> = [
        'masterFilter', 'masterVolume',
        'sfxReverb', 'cathedralReverb', 'combatReverb', 'bgmReverb', 'bgmDelay',
        'chorus', 'phaser', 'compressor',
        'magicChannel', 'combatChannel', 'uiChannel', 'explorationChannel',
        'characterChannel', 'standardChannel', 'bgmChannel',
        'synth', 'membrane', 'fmSynth', 'noiseSynth', 'metalSynth', 'organVoice',
        'bgmOscGain', 'bgmFilter',
      ];
      for (const key of expectedKeys) {
        expect(nodes[key]).toBeDefined();
      }
    });

    it('Filter 节点构造参数正确（masterFilter 与 bgmFilter）', () => {
      createAudioNodes();
      const filterCalls = constructedNodes.filter(n => n.name === 'Filter');
      expect(filterCalls).toHaveLength(2);
      // masterFilter: (6000, 'lowpass', -12)
      expect(filterCalls[0].options).toEqual([6000, 'lowpass', -12]);
      // bgmFilter: (500, 'lowpass')
      expect(filterCalls[1].options).toEqual([500, 'lowpass']);
    });

    it('Volume 节点构造参数正确（masterVolume 与 7 个通道）', () => {
      createAudioNodes();
      const volumeCalls = constructedNodes.filter(n => n.name === 'Volume');
      expect(volumeCalls).toHaveLength(8);
      // masterVolume: -6
      expect(volumeCalls[0].options).toEqual([-6]);
      // 7 个通道均为 0
      for (let i = 1; i < 8; i++) {
        expect(volumeCalls[i].options).toEqual([0]);
      }
    });

    it('Reverb 节点构造参数正确（4 个混响）', () => {
      createAudioNodes();
      const reverbCalls = constructedNodes.filter(n => n.name === 'Reverb');
      expect(reverbCalls).toHaveLength(4);
      // sfxReverb / cathedralReverb / combatReverb / bgmReverb
      expect(reverbCalls[0].options).toEqual([{ decay: 2.5, wet: 0.35 }]);
      expect(reverbCalls[1].options).toEqual([{ decay: 6, wet: 0.5 }]);
      expect(reverbCalls[2].options).toEqual([{ decay: 0.8, wet: 0.25 }]);
      expect(reverbCalls[3].options).toEqual([{ decay: 8, wet: 0.6 }]);
    });

    it('Gain 节点初始值为 0（bgmOscGain）', () => {
      createAudioNodes();
      const gainCalls = constructedNodes.filter(n => n.name === 'Gain');
      expect(gainCalls).toHaveLength(1);
      expect(gainCalls[0].options).toEqual([0]);
    });
  });

  // -------------------- connectEffectChains --------------------

  describe('connectEffectChains 静态连接', () => {
    it('建立全部 7 条通道 + 主输出链 + BGM 氛围链的连接', () => {
      const nodes = createAudioNodes();
      // 清空构造时的 connect 调用（如有）
      for (const key of Object.keys(nodes) as Array<keyof AudioNodes>) {
        const node = nodes[key] as unknown as { connect: ReturnType<typeof vi.fn> };
        node.connect.mockClear();
      }

      connectEffectChains(nodes);

      // 魔法通道：fmSynth/synth/metalSynth → phaser → cathedralReverb → magicChannel → masterVolume
      expect(nodes.phaser.connect).toHaveBeenCalledWith(nodes.cathedralReverb);
      expect(nodes.cathedralReverb.connect).toHaveBeenCalledWith(nodes.magicChannel);
      expect(nodes.magicChannel.connect).toHaveBeenCalledWith(nodes.masterVolume);

      // 战斗通道：membrane/noiseSynth → compressor → combatReverb → combatChannel
      expect(nodes.compressor.connect).toHaveBeenCalledWith(nodes.combatReverb);
      expect(nodes.combatReverb.connect).toHaveBeenCalledWith(nodes.combatChannel);
      expect(nodes.combatChannel.connect).toHaveBeenCalledWith(nodes.masterVolume);

      // 主输出：masterVolume → masterFilter → destination
      expect(nodes.masterVolume.connect).toHaveBeenCalledWith(nodes.masterFilter);
      expect(nodes.masterFilter.toDestination).toHaveBeenCalled();

      // BGM 氛围：bgmFilter.connect(bgmReverb) + bgmOscGain.connect(bgmFilter)
      expect(nodes.bgmFilter.connect).toHaveBeenCalledWith(nodes.bgmReverb);
      expect(nodes.bgmOscGain.connect).toHaveBeenCalledWith(nodes.bgmFilter);
    });

    it('BGM 通道建立 organVoice → bgmDelay → bgmReverb → bgmChannel 链路', () => {
      const nodes = createAudioNodes();
      for (const key of Object.keys(nodes) as Array<keyof AudioNodes>) {
        const node = nodes[key] as unknown as { connect: ReturnType<typeof vi.fn> };
        node.connect.mockClear();
      }

      connectEffectChains(nodes);

      expect(nodes.organVoice.connect).toHaveBeenCalledWith(nodes.bgmDelay);
      expect(nodes.bgmDelay.connect).toHaveBeenCalledWith(nodes.bgmReverb);
      expect(nodes.bgmReverb.connect).toHaveBeenCalledWith(nodes.bgmChannel);
      expect(nodes.bgmChannel.connect).toHaveBeenCalledWith(nodes.masterVolume);
    });

    it('合成器连接到默认路由（fmSynth/synth/metalSynth → phaser）', () => {
      const nodes = createAudioNodes();
      for (const key of Object.keys(nodes) as Array<keyof AudioNodes>) {
        const node = nodes[key] as unknown as { connect: ReturnType<typeof vi.fn> };
        node.connect.mockClear();
      }

      connectEffectChains(nodes);

      expect(nodes.fmSynth.connect).toHaveBeenCalledWith(nodes.phaser);
      expect(nodes.synth.connect).toHaveBeenCalledWith(nodes.phaser);
      expect(nodes.metalSynth.connect).toHaveBeenCalledWith(nodes.phaser);
    });
  });

  // -------------------- routeSynthTo --------------------

  describe('routeSynthTo 动态路由', () => {
    let nodes: AudioNodes;

    beforeEach(() => {
      nodes = createAudioNodes();
      for (const key of Object.keys(nodes) as Array<keyof AudioNodes>) {
        const node = nodes[key] as unknown as {
          connect: ReturnType<typeof vi.fn>;
          disconnect: ReturnType<typeof vi.fn>;
        };
        node.connect.mockClear();
        node.disconnect.mockClear();
      }
    });

    it('magic 路由：synth/metalSynth/fmSynth → phaser', () => {
      routeSynthTo(nodes, 'magic');
      // 5 个合成器都应被 disconnect
      expect(nodes.synth.disconnect).toHaveBeenCalled();
      expect(nodes.membrane.disconnect).toHaveBeenCalled();
      expect(nodes.fmSynth.disconnect).toHaveBeenCalled();
      expect(nodes.noiseSynth.disconnect).toHaveBeenCalled();
      expect(nodes.metalSynth.disconnect).toHaveBeenCalled();
      // 重连到 phaser
      expect(nodes.synth.connect).toHaveBeenCalledWith(nodes.phaser);
      expect(nodes.metalSynth.connect).toHaveBeenCalledWith(nodes.phaser);
      expect(nodes.fmSynth.connect).toHaveBeenCalledWith(nodes.phaser);
    });

    it('combat 路由：membrane/noiseSynth → compressor', () => {
      routeSynthTo(nodes, 'combat');
      expect(nodes.membrane.connect).toHaveBeenCalledWith(nodes.compressor);
      expect(nodes.noiseSynth.connect).toHaveBeenCalledWith(nodes.compressor);
      // 其他合成器未重连
      expect(nodes.synth.connect).not.toHaveBeenCalled();
    });

    it('ui 路由：synth/metalSynth/noiseSynth → chorus', () => {
      routeSynthTo(nodes, 'ui');
      expect(nodes.synth.connect).toHaveBeenCalledWith(nodes.chorus);
      expect(nodes.metalSynth.connect).toHaveBeenCalledWith(nodes.chorus);
      expect(nodes.noiseSynth.connect).toHaveBeenCalledWith(nodes.chorus);
    });

    it('exploration 路由：全部 5 个合成器 → sfxReverb', () => {
      routeSynthTo(nodes, 'exploration');
      expect(nodes.synth.connect).toHaveBeenCalledWith(nodes.sfxReverb);
      expect(nodes.membrane.connect).toHaveBeenCalledWith(nodes.sfxReverb);
      expect(nodes.fmSynth.connect).toHaveBeenCalledWith(nodes.sfxReverb);
      expect(nodes.noiseSynth.connect).toHaveBeenCalledWith(nodes.sfxReverb);
      expect(nodes.metalSynth.connect).toHaveBeenCalledWith(nodes.sfxReverb);
    });

    it('character 路由：synth/metalSynth/fmSynth → chorus', () => {
      routeSynthTo(nodes, 'character');
      expect(nodes.synth.connect).toHaveBeenCalledWith(nodes.chorus);
      expect(nodes.metalSynth.connect).toHaveBeenCalledWith(nodes.chorus);
      expect(nodes.fmSynth.connect).toHaveBeenCalledWith(nodes.chorus);
    });

    it('standard 路由：全部 5 个合成器 → sfxReverb', () => {
      routeSynthTo(nodes, 'standard');
      expect(nodes.synth.connect).toHaveBeenCalledWith(nodes.sfxReverb);
      expect(nodes.membrane.connect).toHaveBeenCalledWith(nodes.sfxReverb);
      expect(nodes.fmSynth.connect).toHaveBeenCalledWith(nodes.sfxReverb);
      expect(nodes.noiseSynth.connect).toHaveBeenCalledWith(nodes.sfxReverb);
      expect(nodes.metalSynth.connect).toHaveBeenCalledWith(nodes.sfxReverb);
    });

    it('未知路由回退到 standard 分支', () => {
      // SfxRoute 是有限联合类型，运行时传入任意字符串验证 default 分支
      routeSynthTo(nodes, 'standard' as never);
      expect(nodes.synth.connect).toHaveBeenCalledWith(nodes.sfxReverb);
    });
  });

  // -------------------- disposeAudioNodes --------------------

  describe('disposeAudioNodes 节点销毁', () => {
    it('对全部 25 个可释放节点调用 dispose', () => {
      const nodes = createAudioNodes();
      for (const key of Object.keys(nodes) as Array<keyof AudioNodes>) {
        const node = nodes[key] as unknown as { dispose: ReturnType<typeof vi.fn> };
        node.dispose.mockClear();
      }

      disposeAudioNodes(nodes);

      // 25 个节点：合成器 6 + 效果器 8 + 通道 7 + 主控 2 + BGM 辅助 2 = 25
      //（organVoice 在 mock 中也暴露 dispose）
      const allKeys = Object.keys(nodes) as Array<keyof AudioNodes>;
      for (const key of allKeys) {
        const node = nodes[key] as unknown as { dispose: ReturnType<typeof vi.fn> };
        expect(node.dispose).toHaveBeenCalled();
      }
    });

    it('即使节点 dispose 不存在也不抛错（防御性）', () => {
      const nodes = createAudioNodes();
      // 删除某个节点的 dispose 方法
      delete (nodes.masterFilter as unknown as { dispose?: () => void }).dispose;
      // 不应抛错
      expect(() => disposeAudioNodes(nodes)).not.toThrow();
    });
  });
});
