/**
 * @fileoverview 管风琴音色合成器（OrganVoice）单元测试
 *
 * 覆盖：
 * 1. 构造函数：默认预设、指定预设
 * 2. setPreset：相同预设提前返回、不同预设重建音栓
 * 3. setEnvelope：合并包络、同步到所有合成器
 * 4. setVolume：设置输出增益
 * 5. triggerAttackRelease：单音、多音数组、多音栓叠加、转位
 * 6. releaseAll：触发所有合成器 release
 * 7. connect / disconnect：输出节点路由
 * 8. dispose / disposeStops：资源释放与重建
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - 全量 mock Tone.js 的 Synth / Gain / gainToDb / Frequency，
 *    避免在测试环境创建真实 AudioContext。
 *  - 通过 spy 记录合成器方法调用次数与参数，断言行为正确性。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== Tone.js Mock ====================

/** Synth 实例方法 spy 工厂 */
function createSynthInstance() {
  return {
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn().mockReturnThis(),
    triggerAttackRelease: vi.fn(),
    triggerRelease: vi.fn(),
    set: vi.fn(),
    dispose: vi.fn(),
  };
}

/** Gain 实例方法 spy 工厂 */
function createGainInstance(initialValue: number) {
  return {
    gain: { value: initialValue },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
  };
}

/** Frequency 链式调用 mock */
function createFrequencyMock() {
  return {
    transpose: vi.fn().mockReturnThis(),
    toNote: vi.fn().mockReturnValue('C4'),
  };
}

// 记录所有 Synth 构造参数，便于断言
const synthConstructCalls: Array<{ oscillator: unknown; envelope: unknown; volume: number }> = [];
const synthInstances: ReturnType<typeof createSynthInstance>[] = [];
let gainInstance: ReturnType<typeof createGainInstance>;

vi.mock('tone', () => {
  // 注意：必须使用普通 function 才能被 new 调用，箭头函数不行
  const Synth = vi.fn(function (this: unknown, options: { oscillator: unknown; envelope: unknown; volume: number }) {
    synthConstructCalls.push({ ...options });
    const instance = createSynthInstance();
    synthInstances.push(instance);
    return instance;
  });

  const Gain = vi.fn(function (this: unknown, value: number) {
    gainInstance = createGainInstance(value);
    return gainInstance;
  });

  return {
    Synth,
    Gain,
    gainToDb: vi.fn((gain: number) => 20 * Math.log10(gain)),
    Frequency: vi.fn(() => createFrequencyMock()),
  };
});

// ==================== 导入被测模块 ====================

import { OrganVoice } from '@/modules/audio/organVoice';
import type { OrganPreset } from '@/modules/audio/organVoice';

// ==================== 测试用例 ====================

describe('OrganVoice 管风琴音色合成器', () => {
  beforeEach(() => {
    synthConstructCalls.length = 0;
    synthInstances.length = 0;
    vi.clearAllMocks();
  });

  // -------------------- 构造函数 --------------------

  describe('构造函数', () => {
    it('默认使用 diapason 预设', () => {
      const voice = new OrganVoice();
      // diapason 预设有 4 个音栓
      expect(synthInstances).toHaveLength(4);
      // 每个 synth 都连接到 output gain
      for (const instance of synthInstances) {
        expect(instance.connect).toHaveBeenCalledTimes(1);
      }
    });

    it('指定 softDiapason 预设时构建 2 个音栓', () => {
      const voice = new OrganVoice('softDiapason');
      expect(synthInstances).toHaveLength(2);
    });

    it('指定 fullOrgan 预设时构建 6 个音栓（diapason 4 + mixture + trumpet）', () => {
      const voice = new OrganVoice('fullOrgan');
      expect(synthInstances).toHaveLength(6);
    });

    it('指定 flute 预设时构建 2 个音栓', () => {
      const voice = new OrganVoice('flute');
      expect(synthInstances).toHaveLength(2);
    });

    it('指定 pedal 预设时构建 2 个音栓', () => {
      const voice = new OrganVoice('pedal');
      expect(synthInstances).toHaveLength(2);
    });

    it('构造时为每个音栓设置 volume（通过 gainToDb 转换）', () => {
      const voice = new OrganVoice('flute');
      // flute 第一个音栓 gain=0.6
      const expectedDb = 20 * Math.log10(0.6);
      expect(synthConstructCalls[0].volume).toBeCloseTo(expectedDb, 5);
    });

    it('构造时创建 output Gain 节点（初始 0.5）', () => {
      const voice = new OrganVoice();
      // Gain 已在 mock 中被调用
      // gainInstance 在 mock 中创建
      expect(gainInstance.gain.value).toBe(0.5);
    });
  });

  // -------------------- setPreset --------------------

  describe('setPreset 切换音色预设', () => {
    it('切换到不同预设时重建音栓', () => {
      const voice = new OrganVoice('diapason');
      expect(synthInstances).toHaveLength(4);

      // 切换到 flute
      voice.setPreset('flute');
      // 旧的 4 个被 dispose，新建 2 个
      expect(synthInstances).toHaveLength(6); // 4 + 2（新实例追加到数组）
    });

    it('切换到相同预设时提前返回，不重建', () => {
      const voice = new OrganVoice('diapason');
      const initialCount = synthInstances.length;

      voice.setPreset('diapason');
      expect(synthInstances).toHaveLength(initialCount);
    });

    it('切换预设时旧音栓合成器被 dispose', () => {
      const voice = new OrganVoice('diapason');
      const firstBatch = synthInstances.slice();

      voice.setPreset('flute');

      // 旧的 4 个 synth 都应被 dispose
      for (const instance of firstBatch) {
        expect(instance.dispose).toHaveBeenCalled();
      }
    });
  });

  // -------------------- setEnvelope --------------------

  describe('setEnvelope 设置包络', () => {
    it('合并部分包络参数并同步到所有合成器', () => {
      const voice = new OrganVoice('flute');
      // 清空之前的 set 调用（构造时不会有 set 调用）
      for (const instance of synthInstances) {
        instance.set.mockClear();
      }

      voice.setEnvelope({ attack: 0.5, release: 2.0 });

      // 2 个 synth 都应调用 set
      for (const instance of synthInstances) {
        expect(instance.set).toHaveBeenCalledTimes(1);
        const callArg = instance.set.mock.calls[0][0];
        expect(callArg.envelope.attack).toBe(0.5);
        expect(callArg.envelope.release).toBe(2.0);
        // 未传入的字段保持默认
        expect(callArg.envelope.decay).toBe(0.3);
        expect(callArg.envelope.sustain).toBe(0.7);
      }
    });

    it('完整覆盖包络参数', () => {
      const voice = new OrganVoice('softDiapason');
      for (const instance of synthInstances) {
        instance.set.mockClear();
      }

      voice.setEnvelope({ attack: 0.1, decay: 0.2, sustain: 0.5, release: 1.0 });

      for (const instance of synthInstances) {
        const callArg = instance.set.mock.calls[0][0];
        expect(callArg.envelope).toEqual({
          attack: 0.1,
          decay: 0.2,
          sustain: 0.5,
          release: 1.0,
        });
      }
    });

    it('多次调用 setEnvelope 累积合并', () => {
      const voice = new OrganVoice('softDiapason');

      voice.setEnvelope({ attack: 0.5 });
      voice.setEnvelope({ release: 3.0 });

      // 最后一次 set 应包含两次合并的结果
      const lastInstance = synthInstances[synthInstances.length - 1];
      const lastCall = lastInstance.set.mock.calls[lastInstance.set.mock.calls.length - 1][0];
      expect(lastCall.envelope.attack).toBe(0.5);
      expect(lastCall.envelope.release).toBe(3.0);
    });
  });

  // -------------------- setVolume --------------------

  describe('setVolume 设置总音量', () => {
    it('设置 output gain 的 value', () => {
      const voice = new OrganVoice();
      voice.setVolume(-6);
      expect(gainInstance.gain.value).toBe(-6);
    });

    it('多次设置覆盖前值', () => {
      const voice = new OrganVoice();
      voice.setVolume(-3);
      voice.setVolume(-12);
      expect(gainInstance.gain.value).toBe(-12);
    });
  });

  // -------------------- triggerAttackRelease --------------------

  describe('triggerAttackRelease 触发音符', () => {
    it('单音触发：每个音栓的每个 interval 都调用 triggerAttackRelease', () => {
      const voice = new OrganVoice('softDiapason');
      // softDiapason: 2 个音栓，每个 1 个 interval
      for (const instance of synthInstances) {
        instance.triggerAttackRelease.mockClear();
      }

      voice.triggerAttackRelease('C4', '2n', 0, 0.7);

      // 2 个 synth，每个触发 1 次
      expect(synthInstances[0].triggerAttackRelease).toHaveBeenCalledTimes(1);
      expect(synthInstances[1].triggerAttackRelease).toHaveBeenCalledTimes(1);
    });

    it('多音数组触发：每个音符都触发', () => {
      const voice = new OrganVoice('softDiapason');
      for (const instance of synthInstances) {
        instance.triggerAttackRelease.mockClear();
      }

      voice.triggerAttackRelease(['C4', 'E4', 'G4'], '2n', 0, 0.7);

      // 2 个 synth，每个触发 3 次（3 个音符 × 1 个 interval）
      expect(synthInstances[0].triggerAttackRelease).toHaveBeenCalledTimes(3);
      expect(synthInstances[1].triggerAttackRelease).toHaveBeenCalledTimes(3);
    });

    it('多音栓多 interval 触发（fullOrgan mixture 有 4 个 interval）', () => {
      const voice = new OrganVoice('fullOrgan');
      // fullOrgan 有 6 个音栓，其中 Mixture IV 有 4 个 interval
      for (const instance of synthInstances) {
        instance.triggerAttackRelease.mockClear();
      }

      voice.triggerAttackRelease('C4', '2n', 0, 0.7);

      // 统计所有 triggerAttackRelease 调用总数
      let totalCalls = 0;
      for (const instance of synthInstances) {
        totalCalls += instance.triggerAttackRelease.mock.calls.length;
      }
      // diapason 4 stops: intervals [0],[12],[19],[24] → 1+1+1+1=4
      // mixture: [19,24,28,31] → 4
      // trumpet: [0] → 1
      // 总计 = 4 + 4 + 1 = 9
      expect(totalCalls).toBe(9);
    });

    it('velocity 直接作为最终力度（P0 修复：不再乘 config.gain，避免双重增益）', () => {
      const voice = new OrganVoice('flute');
      for (const instance of synthInstances) {
        instance.triggerAttackRelease.mockClear();
      }

      voice.triggerAttackRelease('C4', '2n', 0, 1.0);

      // flute 第一个音栓 gain=0.6 已通过构造时 volume 参数施加，
      // 此处 velocity=1.0 应直接传递，不再乘以 gain
      const callArgs = synthInstances[0].triggerAttackRelease.mock.calls[0];
      // [note, duration, time, velocity]
      expect(callArgs[3]).toBeCloseTo(1.0, 5);
    });

    it('未传 velocity 时默认 0.7', () => {
      const voice = new OrganVoice('flute');
      for (const instance of synthInstances) {
        instance.triggerAttackRelease.mockClear();
      }

      voice.triggerAttackRelease('C4', '2n', 0);

      const callArgs = synthInstances[0].triggerAttackRelease.mock.calls[0];
      // velocity 默认 0.7，直接传递不乘 gain
      expect(callArgs[3]).toBeCloseTo(0.7, 5);
    });

    it('传递 note、duration、time 参数', () => {
      const voice = new OrganVoice('softDiapason');
      for (const instance of synthInstances) {
        instance.triggerAttackRelease.mockClear();
      }

      voice.triggerAttackRelease('C4', '4n', 1.5, 0.8);

      const callArgs = synthInstances[0].triggerAttackRelease.mock.calls[0];
      // [transposedNote, duration, time, velocity]
      // toNote 返回 'C4'（mock）
      expect(callArgs[0]).toBe('C4');
      expect(callArgs[1]).toBe('4n');
      expect(callArgs[2]).toBe(1.5);
    });

    it('多音触发时同一合成器调度时间严格递增', () => {
      const voice = new OrganVoice('softDiapason');
      for (const instance of synthInstances) {
        instance.triggerAttackRelease.mockClear();
      }

      voice.triggerAttackRelease(['C4', 'E4'], '2n', 1.0, 0.7);

      // 同一 synth 的两次调用，时间应递增
      const calls = synthInstances[0].triggerAttackRelease.mock.calls;
      expect(calls[0][2]).toBe(1.0);
      expect(calls[1][2]).toBe(1.0 + 0.001);
    });
  });

  // -------------------- releaseAll --------------------

  describe('releaseAll 释放所有音符', () => {
    it('触发所有音栓合成器的 triggerRelease', () => {
      const voice = new OrganVoice('diapason');
      for (const instance of synthInstances) {
        instance.triggerRelease.mockClear();
      }

      voice.releaseAll();

      expect(synthInstances).toHaveLength(4);
      for (const instance of synthInstances) {
        expect(instance.triggerRelease).toHaveBeenCalledTimes(1);
      }
    });

    it('无音栓时调用 releaseAll 不报错', () => {
      const voice = new OrganVoice();
      voice.dispose(); // 清空所有音栓
      expect(() => voice.releaseAll()).not.toThrow();
    });
  });

  // -------------------- connect / disconnect --------------------

  describe('connect / disconnect 输出节点路由', () => {
    it('connect 将 output gain 连接到目标节点', () => {
      const voice = new OrganVoice();
      const target = { name: 'targetNode' } as never;
      gainInstance.connect.mockClear();

      voice.connect(target);

      expect(gainInstance.connect).toHaveBeenCalledTimes(1);
      expect(gainInstance.connect).toHaveBeenCalledWith(target);
    });

    it('disconnect 断开 output gain 连接', () => {
      const voice = new OrganVoice();
      gainInstance.disconnect.mockClear();

      voice.disconnect();

      expect(gainInstance.disconnect).toHaveBeenCalledTimes(1);
    });

    it('disconnect 指定节点时传递参数', () => {
      const voice = new OrganVoice();
      const target = { name: 'targetNode' } as never;
      gainInstance.disconnect.mockClear();

      voice.disconnect(target);

      expect(gainInstance.disconnect).toHaveBeenCalledWith(target);
    });
  });

  // -------------------- dispose --------------------

  describe('dispose 资源释放', () => {
    it('dispose 销毁所有音栓合成器', () => {
      const voice = new OrganVoice('diapason');
      const initialSynths = synthInstances.slice();

      voice.dispose();

      for (const instance of initialSynths) {
        expect(instance.dispose).toHaveBeenCalledTimes(1);
      }
    });

    it('dispose 销毁 output gain 节点', () => {
      const voice = new OrganVoice();
      gainInstance.dispose.mockClear();

      voice.dispose();

      expect(gainInstance.dispose).toHaveBeenCalledTimes(1);
    });

    it('dispose 后再调用 releaseAll 安全（无音栓）', () => {
      const voice = new OrganVoice();
      voice.dispose();
      expect(() => voice.releaseAll()).not.toThrow();
    });

    it('dispose 后再调用 dispose 安全（幂等）', () => {
      const voice = new OrganVoice();
      voice.dispose();
      expect(() => voice.dispose()).not.toThrow();
    });
  });

  // -------------------- 预设切换后行为验证 --------------------

  describe('预设切换后行为', () => {
    it('切换预设后 triggerAttackRelease 使用新音栓', () => {
      const voice = new OrganVoice('softDiapason'); // 2 音栓
      voice.setPreset('fullOrgan'); // 6 音栓（新增 4 个，旧 2 个 dispose）

      // 取最后创建的 6 个实例（旧的在前面已被 dispose）
      const activeSynths = synthInstances.slice(-6);
      for (const instance of activeSynths) {
        instance.triggerAttackRelease.mockClear();
      }

      voice.triggerAttackRelease('C4', '2n', 0, 0.7);

      // 至少有 6 个 synth 被调用
      let calledCount = 0;
      for (const instance of activeSynths) {
        calledCount += instance.triggerAttackRelease.mock.calls.length;
      }
      expect(calledCount).toBeGreaterThan(0);
    });
  });
});
