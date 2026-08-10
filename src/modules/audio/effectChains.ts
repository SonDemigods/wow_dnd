/**
 * @fileoverview 音频效果链与 Tone.js 节点工厂
 * @description
 *   集中创建 AudioService 所需的全部 Tone.js 节点（合成器、效果器、通道），
 *   并提供建立静态连接图、动态路由切换、节点销毁的统一入口。
 *
 *   拆分自原 service.ts（QA-6），目的：
 *   - 将"节点构造 + 连接拓扑"从"生命周期协调"中分离，便于独立测试与维护
 *   - service.ts 仅保留生命周期与公共 API 协调，不再持有节点构造细节
 *
 * 连接图（connectEffectChains 建立）：
 *   魔法通道: fmSynth/synth/metalSynth → phaser → cathedralReverb → magicChannel → masterVolume
 *   战斗通道: membrane/noiseSynth → compressor → combatReverb → combatChannel → masterVolume
 *   UI 通道:  synth/metal/noise → chorus → sfxReverb → uiChannel → masterVolume
 *   探索通道: synth → sfxReverb → explorationChannel → masterVolume
 *   角色通道: synth → chorus → cathedralReverb → characterChannel → masterVolume
 *   标准通道: synth → sfxReverb → standardChannel → masterVolume
 *   BGM 通道: organVoice → bgmDelay → bgmReverb → bgmChannel → masterVolume
 *   主输出:   masterVolume → masterFilter → destination
 *   BGM 氛围: bgmOsc → bgmOscGain → bgmFilter → bgmReverb
 *
 * @module audio/effectChains
 */
import * as Tone from 'tone';
import { OrganVoice } from './organVoice';
import type { SfxRoute } from './types';

/**
 * 音频节点集合
 *
 * 包含 AudioService 运行所需的全部 Tone.js 节点实例。
 * 由 createAudioNodes() 统一创建，供 SfxSynth / BgmSynth / AudioService 共享访问。
 *
 * 节点分类：
 * - 主控节点：masterFilter / masterVolume —— 控制最终输出
 * - 效果器：reverb / delay / chorus / phaser / compressor —— 音色塑形
 * - 通道：7 个 Volume 节点 —— 按类别控制音量
 * - 合成器：synth / membrane / fmSynth / noiseSynth / metalSynth / organVoice —— 音频源
 * - BGM 辅助：bgmOscGain / bgmFilter —— 氛围振荡器与滤波器
 */
export interface AudioNodes {
  // ==================== 主控节点 ====================
  /** 主输出柔和低通滤波 —— 削除刺耳高频，保留温暖音色 */
  masterFilter: Tone.Filter;
  /** 主输出音量节点 */
  masterVolume: Tone.Volume;

  // ==================== 效果器 ====================
  /** 音效标准混响 —— 通用空间感 */
  sfxReverb: Tone.Reverb;
  /** 音效教堂混响 —— 魔法/神圣场景 */
  cathedralReverb: Tone.Reverb;
  /** 音效短混响 —— 战斗冲击 */
  combatReverb: Tone.Reverb;
  /** BGM 教堂混响 —— 管风琴空间感 */
  bgmReverb: Tone.Reverb;
  /** BGM 延迟 */
  bgmDelay: Tone.FeedbackDelay;
  /** 合唱效果器 —— 增加厚度和流动感 */
  chorus: Tone.Chorus;
  /** 移相器 —— 魔法/灵异场景 */
  phaser: Tone.Phaser;
  /** 压缩器 —— 战斗冲击力 */
  compressor: Tone.Compressor;

  // ==================== 通道 ====================
  /** 魔法类音效通道 */
  magicChannel: Tone.Volume;
  /** 战斗类音效通道 */
  combatChannel: Tone.Volume;
  /** UI 类音效通道 */
  uiChannel: Tone.Volume;
  /** 探索类音效通道 */
  explorationChannel: Tone.Volume;
  /** 角色类音效通道 */
  characterChannel: Tone.Volume;
  /** 标准音效通道 */
  standardChannel: Tone.Volume;
  /** BGM 输出通道 */
  bgmChannel: Tone.Volume;

  // ==================== 合成器 ====================
  /** 通用单音合成器 —— UI 音、拾取、金币等短音 */
  synth: Tone.Synth;
  /** 打击合成器 —— 攻击命中、受伤等 */
  membrane: Tone.MembraneSynth;
  /** FM 合成器 —— 法术、魔法音效 */
  fmSynth: Tone.FMSynth;
  /** 噪声合成器 —— UI 点击、陷阱、击中等 */
  noiseSynth: Tone.NoiseSynth;
  /** 金属合成器 —— 硬币、铃声、商店 */
  metalSynth: Tone.MetalSynth;
  /** 管风琴音色 —— BGM 核心 */
  organVoice: OrganVoice;

  // ==================== BGM 辅助节点 ====================
  /** BGM 持续氛围振荡器增益（初始 0） */
  bgmOscGain: Tone.Gain;
  /** BGM 滤波器（500Hz lowpass） */
  bgmFilter: Tone.Filter;
}

/**
 * 创建全部 Tone.js 音频节点
 *
 * 实例化 AudioService 所需的所有合成器、效果器、通道节点。
 * 节点创建后尚未建立连接，需调用 connectEffectChains() 完成拓扑。
 *
 * @returns 包含全部节点的 AudioNodes 对象
 */
export function createAudioNodes(): AudioNodes {
  return {
    // ---- 主控节点 ----
    masterFilter: new Tone.Filter(6000, 'lowpass', -12),
    masterVolume: new Tone.Volume(-6),

    // ---- 效果器 ----
    sfxReverb: new Tone.Reverb({ decay: 2.5, wet: 0.35 }),
    cathedralReverb: new Tone.Reverb({ decay: 6, wet: 0.5 }),
    combatReverb: new Tone.Reverb({ decay: 0.8, wet: 0.25 }),
    bgmReverb: new Tone.Reverb({ decay: 8, wet: 0.6 }),
    bgmDelay: new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.2, wet: 0.1 }),
    chorus: new Tone.Chorus({
      frequency: 1.5,
      delayTime: 3.5,
      depth: 0.5,
      wet: 0.3,
    }),
    phaser: new Tone.Phaser({
      frequency: 0.5,
      octaves: 5,
      baseFrequency: 400,
      wet: 0.4,
    }),
    compressor: new Tone.Compressor({
      threshold: -24,
      ratio: 4,
      attack: 0.003,
      release: 0.25,
    }),

    // ---- 通道 ----
    magicChannel: new Tone.Volume(0),
    combatChannel: new Tone.Volume(0),
    uiChannel: new Tone.Volume(0),
    explorationChannel: new Tone.Volume(0),
    characterChannel: new Tone.Volume(0),
    standardChannel: new Tone.Volume(0),
    bgmChannel: new Tone.Volume(0),

    // ---- 合成器 ----
    synth: new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.003, decay: 0.15, sustain: 0, release: 0.5 },
    }),
    membrane: new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.3 },
    }),
    fmSynth: new Tone.FMSynth({
      harmonicity: 6,
      modulationIndex: 14,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 0.6, sustain: 0.05, release: 0.8 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.02, decay: 0.4, sustain: 0, release: 0.6 },
    }),
    noiseSynth: new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.02 },
    }),
    metalSynth: new Tone.MetalSynth({
      harmonicity: 6,
      modulationIndex: 32,
      resonance: 1200,
      octaves: 1.5,
      envelope: { attack: 0.001, decay: 0.6, sustain: 0.05, release: 0.2 },
    }),
    organVoice: new OrganVoice('softDiapason'),

    // ---- BGM 辅助节点 ----
    bgmOscGain: new Tone.Gain(0),
    bgmFilter: new Tone.Filter(500, 'lowpass'),
  };
}

/**
 * 建立所有效果链的静态连接
 *
 * 在 AudioContext 启动后（混响脉冲已生成）调用，建立 7 条通道 + 主输出链 + BGM 氛围链的完整连接图。
 * 此函数建立的是"默认路由"——合成器已连接到各自的默认效果链；
 * 播放音效时 routeSynthTo() 会临时断开并重连到目标路由。
 *
 * @param nodes - 由 createAudioNodes() 创建的节点集合
 */
export function connectEffectChains(nodes: AudioNodes): void {
  // ===== 魔法通道：合成器 → phaser → cathedralReverb → magicChannel =====
  nodes.fmSynth.connect(nodes.phaser);
  nodes.synth.connect(nodes.phaser);
  nodes.metalSynth.connect(nodes.phaser);
  nodes.phaser.connect(nodes.cathedralReverb);
  nodes.cathedralReverb.connect(nodes.magicChannel);
  nodes.magicChannel.connect(nodes.masterVolume);

  // ===== 战斗通道：合成器 → compressor → combatReverb → combatChannel =====
  nodes.membrane.connect(nodes.compressor);
  nodes.noiseSynth.connect(nodes.compressor);
  nodes.compressor.connect(nodes.combatReverb);
  nodes.combatReverb.connect(nodes.combatChannel);
  nodes.combatChannel.connect(nodes.masterVolume);

  // ===== UI 通道：合成器 → chorus → sfxReverb → uiChannel =====
  nodes.chorus.connect(nodes.sfxReverb);
  nodes.sfxReverb.connect(nodes.uiChannel);
  nodes.uiChannel.connect(nodes.masterVolume);

  // ===== 探索通道：合成器 → sfxReverb → explorationChannel =====
  nodes.sfxReverb.connect(nodes.explorationChannel);
  nodes.explorationChannel.connect(nodes.masterVolume);

  // ===== 角色通道：合成器 → chorus → cathedralReverb → characterChannel =====
  nodes.chorus.connect(nodes.cathedralReverb);
  nodes.cathedralReverb.connect(nodes.characterChannel);
  nodes.characterChannel.connect(nodes.masterVolume);

  // ===== 标准通道：合成器 → sfxReverb → standardChannel =====
  nodes.sfxReverb.connect(nodes.standardChannel);
  nodes.standardChannel.connect(nodes.masterVolume);

  // ===== BGM 通道：organVoice → bgmDelay → bgmReverb → bgmChannel =====
  nodes.organVoice.connect(nodes.bgmDelay);
  nodes.bgmDelay.connect(nodes.bgmReverb);
  nodes.bgmReverb.connect(nodes.bgmChannel);
  nodes.bgmChannel.connect(nodes.masterVolume);

  // BGM 氛围振荡器
  nodes.bgmFilter.connect(nodes.bgmReverb);
  nodes.bgmOscGain.connect(nodes.bgmFilter);

  // ===== 主输出链：masterVolume → masterFilter → destination =====
  nodes.masterVolume.connect(nodes.masterFilter);
  nodes.masterFilter.toDestination();
}

/**
 * 将合成器临时连接到指定路由的效果链
 *
 * 播放音效前调用，通过 disconnect + connect 实现动态路由切换。
 * 不同路由走不同的效果器组合，产生不同的听感特征。
 *
 * P9-033 修复：断开共享效果器到所有通道的连接后仅重连目标通道，
 * 防止信号 fan-out 到多个通道导致音量倍增。
 *
 * @param nodes - 音频节点集合
 * @param route - 目标效果路由
 */
export function routeSynthTo(nodes: AudioNodes, route: SfxRoute): void {
  // 断开所有合成器
  nodes.synth.disconnect();
  nodes.membrane.disconnect();
  nodes.fmSynth.disconnect();
  nodes.noiseSynth.disconnect();
  nodes.metalSynth.disconnect();

  // P9-033 修复：断开共享效果器到各通道的连接，防止 fan-out
  nodes.sfxReverb.disconnect();
  nodes.chorus.disconnect();
  nodes.cathedralReverb.disconnect();
  nodes.phaser.disconnect();
  nodes.compressor.disconnect();

  // 重新连接共享效果器到主输出链（效果器→masterVolume）
  nodes.sfxReverb.connect(nodes.masterVolume);
  nodes.chorus.connect(nodes.masterVolume);
  nodes.cathedralReverb.connect(nodes.masterVolume);
  nodes.phaser.connect(nodes.masterVolume);
  nodes.compressor.connect(nodes.masterVolume);

  switch (route) {
    case 'magic':
      // 魔法通道：phaser → cathedralReverb
      nodes.synth.connect(nodes.phaser);
      nodes.metalSynth.connect(nodes.phaser);
      nodes.fmSynth.connect(nodes.phaser);
      break;

    case 'combat':
      // 战斗通道：compressor → combatReverb
      nodes.membrane.connect(nodes.compressor);
      nodes.noiseSynth.connect(nodes.compressor);
      break;

    case 'ui':
      // UI 通道：chorus → sfxReverb
      nodes.synth.connect(nodes.chorus);
      nodes.metalSynth.connect(nodes.chorus);
      nodes.noiseSynth.connect(nodes.chorus);
      break;

    case 'exploration':
      // 探索通道：sfxReverb
      nodes.synth.connect(nodes.sfxReverb);
      nodes.membrane.connect(nodes.sfxReverb);
      nodes.fmSynth.connect(nodes.sfxReverb);
      nodes.noiseSynth.connect(nodes.sfxReverb);
      nodes.metalSynth.connect(nodes.sfxReverb);
      break;

    case 'character':
      // 角色通道：chorus → cathedralReverb
      nodes.synth.connect(nodes.chorus);
      nodes.metalSynth.connect(nodes.chorus);
      nodes.fmSynth.connect(nodes.chorus);
      break;

    case 'standard':
    default:
      // 标准通道：sfxReverb
      nodes.synth.connect(nodes.sfxReverb);
      nodes.membrane.connect(nodes.sfxReverb);
      nodes.fmSynth.connect(nodes.sfxReverb);
      nodes.noiseSynth.connect(nodes.sfxReverb);
      nodes.metalSynth.connect(nodes.sfxReverb);
      break;
  }
}

/**
 * 销毁全部 Tone.js 节点，释放 AudioContext 资源
 *
 * 在 AudioService.destroy() 中调用，确保 HMR 或重复 init 时不会泄漏节点。
 * 销毁后节点不可再使用，需重新调用 createAudioNodes() 创建新实例。
 *
 * @param nodes - 待销毁的节点集合
 */
export function disposeAudioNodes(nodes: AudioNodes): void {
  const disposables: { dispose?: () => void }[] = [
    nodes.synth, nodes.membrane, nodes.fmSynth, nodes.noiseSynth, nodes.metalSynth,
    nodes.organVoice, nodes.masterFilter, nodes.masterVolume,
    nodes.sfxReverb, nodes.cathedralReverb, nodes.combatReverb, nodes.bgmReverb, nodes.bgmDelay,
    nodes.chorus, nodes.phaser, nodes.compressor,
    nodes.magicChannel, nodes.combatChannel, nodes.uiChannel, nodes.explorationChannel,
    nodes.characterChannel, nodes.standardChannel, nodes.bgmChannel,
    nodes.bgmOscGain, nodes.bgmFilter,
  ];
  disposables.forEach(n => n.dispose?.());
}
