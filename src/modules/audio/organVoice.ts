/**
 * @fileoverview 管风琴音色合成器
 * @description 通过加法合成模拟管风琴音栓组合，产生丰富的谐波结构。
 * 每个音符同时触发多个八度/五度泛音层，模拟真实管风琴的音栓(Stop)效果。
 */

import * as Tone from 'tone';

// ==================== 音栓配置类型 ====================

/** 单个音栓配置 */
export interface OrganStopConfig {
  /** 音栓名称，如 "Principal 8'" */
  name: string;
  /** 相对基础音的音程（半音），如 0=同音, 12=高八度, 19=五度+八度 */
  intervals: number[];
  /** 谐波振幅数组，[基频, 第2谐波, 第3谐波, ...] */
  partials: number[];
  /** 该音栓的相对音量 (0-1) */
  gain: number;
}

/** 管风琴音色预设名称 */
export type OrganPreset =
  | 'diapason'      // 基础音栓组：温暖庄严
  | 'fullOrgan'     // 全音栓：宏大辉煌
  | 'flute'         // 笛声音栓：柔和神秘
  | 'softDiapason'  // 轻柔基础：探索氛围
  | 'pedal';        // 踏板低音：深沉震撼

// ==================== 音栓预设 ====================

/** 基础音栓组 (Principal 8' + Octave 4' + Twelfth + Fifteenth) —— 温暖庄严 */
const DIAPASON_STOPS: OrganStopConfig[] = [
  {
    name: "Principal 8'",
    intervals: [0],
    partials: [1, 0.45, 0.18, 0.08, 0.03],
    gain: 0.7,
  },
  {
    name: "Octave 4'",
    intervals: [12],
    partials: [0.4, 0.18, 0.08, 0.03],
    gain: 0.4,
  },
  {
    name: 'Twelfth 2-2/3\'',
    intervals: [19],
    partials: [0.25, 0.1, 0.04],
    gain: 0.25,
  },
  {
    name: "Fifteenth 2'",
    intervals: [24],
    partials: [0.15, 0.06, 0.02],
    gain: 0.15,
  },
];

/** 全音栓 (Diapason + Mixture + Trumpet) —— 宏大辉煌 */
const FULL_ORGAN_STOPS: OrganStopConfig[] = [
  ...DIAPASON_STOPS,
  {
    name: 'Mixture IV',
    intervals: [19, 24, 28, 31],
    partials: [0.1, 0.05, 0.02, 0.01],
    gain: 0.18,
  },
  {
    name: "Trumpet 8'",
    intervals: [0],
    partials: [1, 0.6, 0.4, 0.25, 0.15, 0.08, 0.04],
    gain: 0.25,
  },
];

/** 笛声音栓组 (Flute 8' + Flute 4') —— 柔和神秘 */
const FLUTE_STOPS: OrganStopConfig[] = [
  {
    name: "Flute 8'",
    intervals: [0],
    partials: [1, 0.2, 0.06, 0.01],
    gain: 0.6,
  },
  {
    name: "Flute 4'",
    intervals: [12],
    partials: [0.3, 0.06, 0.02],
    gain: 0.3,
  },
];

/** 轻柔基础音栓 (Principal 8' only) —— 探索氛围 */
const SOFT_DIAPASON_STOPS: OrganStopConfig[] = [
  {
    name: "Principal 8'",
    intervals: [0],
    partials: [1, 0.3, 0.1, 0.04, 0.01],
    gain: 0.5,
  },
  {
    name: "Octave 4'",
    intervals: [12],
    partials: [0.2, 0.06, 0.02],
    gain: 0.2,
  },
];

/** 踏板低音 (Subbass 16' + Bourdon 16') —— 深沉震撼 */
const PEDAL_STOPS: OrganStopConfig[] = [
  {
    name: "Subbass 16'",
    intervals: [-12],
    partials: [1, 0.5, 0.25, 0.12],
    gain: 0.9,
  },
  {
    name: "Bourdon 16'",
    intervals: [-12],
    partials: [1, 0.2, 0.05],
    gain: 0.5,
  },
];

/** 音色预设映射表 */
const ORGAN_PRESETS: Record<OrganPreset, OrganStopConfig[]> = {
  diapason: DIAPASON_STOPS,
  fullOrgan: FULL_ORGAN_STOPS,
  flute: FLUTE_STOPS,
  softDiapason: SOFT_DIAPASON_STOPS,
  pedal: PEDAL_STOPS,
};

// ==================== 管风琴音色类 ====================

/**
 * 管风琴音色合成器
 * 使用多层 Tone.Synth 叠加模拟管风琴音栓效果
 */
export class OrganVoice {
  /** 每个音栓对应的合成器实例 */
  private stopSynths: { synth: Tone.Synth; config: OrganStopConfig }[] = [];

  /** 输出增益节点 */
  private output = new Tone.Gain(0.5);

  /** 总包络设置 */
  private envelope = {
    attack: 0.08,
    decay: 0.3,
    sustain: 0.7,
    release: 1.5,
  };

  /** 当前激活的预设 */
  private currentPreset: OrganPreset = 'diapason';

  constructor(preset: OrganPreset = 'diapason') {
    this.buildStops(preset);
  }

  /** 根据预设构建音栓合成器 */
  private buildStops(preset: OrganPreset): void {
    // 销毁旧合成器
    this.disposeStops();

    const stops = ORGAN_PRESETS[preset];
    this.currentPreset = preset;

    for (const config of stops) {
      const synth = new Tone.Synth({
        oscillator: {
          type: 'custom',
          partials: config.partials,
        } as Tone.SynthOptions['oscillator'],
        envelope: { ...this.envelope },
        volume: Tone.gainToDb(config.gain),
      }).connect(this.output);

      this.stopSynths.push({ synth, config });
    }
  }

  /** 切换音色预设 */
  setPreset(preset: OrganPreset): void {
    if (preset === this.currentPreset) return;
    this.buildStops(preset);
  }

  /** 设置包络 */
  setEnvelope(env: { attack?: number; decay?: number; sustain?: number; release?: number }): void {
    this.envelope = { ...this.envelope, ...env };
    for (const { synth } of this.stopSynths) {
      synth.set({ envelope: this.envelope as Tone.SynthOptions['envelope'] });
    }
  }

  /** 设置总音量 (dB) */
  setVolume(db: number): void {
    this.output.gain.value = db;
  }

  /**
   * 触发一个音符
   * @param note - 音名，如 "C4"
   * @param duration - 持续时间，如 "2n"
   * @param time - 调度时间
   * @param velocity - 力度 0-1
   */
  triggerAttackRelease(
    note: string | string[],
    duration: string,
    time: number,
    velocity: number = 0.7,
  ): void {
    const notes = Array.isArray(note) ? note : [note];
    const velDb = velocity > 0 ? Tone.gainToDb(velocity) : -Infinity;

    // 每个合成器实例需要严格递增的调度时间，避免 Tone.js 报错
    for (const { synth, config } of this.stopSynths) {
      let synthTime = time;
      for (const n of notes) {
        for (const interval of config.intervals) {
          const transposed = Tone.Frequency(n).transpose(interval).toNote();
          // 每个音栓层独立触发，叠加出丰富谐波
          synth.triggerAttackRelease(
            transposed,
            duration,
            synthTime,
            velDb + Tone.gainToDb(config.gain),
          );
          // 微调时间确保同一合成器的每次调用时间严格递增
          synthTime += 0.001;
        }
      }
    }
  }

  /**
   * 释放所有音符
   */
  releaseAll(): void {
    for (const { synth } of this.stopSynths) {
      synth.triggerRelease();
    }
  }

  /** 连接到目标节点 */
  connect(node: Tone.InputNode): void {
    this.output.connect(node);
  }

  /** 断开连接 */
  disconnect(node?: Tone.InputNode): void {
    this.output.disconnect(node);
  }

  /** 销毁所有合成器 */
  dispose(): void {
    this.disposeStops();
    this.output.dispose();
  }

  private disposeStops(): void {
    for (const { synth } of this.stopSynths) {
      synth.dispose();
    }
    this.stopSynths = [];
  }
}
