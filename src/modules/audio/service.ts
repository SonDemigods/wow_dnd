/**
 * @fileoverview 音频服务核心
 * @description 基于 Tone.js 的音频合成服务，负责所有音效和背景音乐的生成与播放。
 * 所有音效通过代码合成，无需外部音频文件，完全离线可用。
 *
 * 优化升级：
 * - BGM 使用管风琴加法合成，产生史诗感
 * - 中古调式体系（多利亚、弗里吉亚、利底亚）
 * - 教堂混响、Shimmer、Chorus、Phaser 等奇幻效果器
 * - 动态效果路由，不同音效走不同效果链
 */

import * as Tone from 'tone';
import { eventBus, GameEvents } from '../bus/core';
import { useAudioStore } from './store';
import { OrganVoice } from './organVoice';
import type { IAudioService, SfxType, BgmScene, AudioSettings, SfxRoute } from './types';
import { SFX_ROUTE_MAP } from './types';

/** 音频服务实现类 */
class AudioService implements IAudioService {
  // ==================== 主控节点 ====================
  /** 主输出柔和低通滤波 —— 削除刺耳高频，保留温暖音色 */
  private masterFilter = new Tone.Filter(6000, 'lowpass', -12);

  /** 主输出音量节点 */
  private masterVolume = new Tone.Volume(-6);

  // ==================== 效果器 ====================

  /** 音效标准混响 —— 通用空间感 */
  private sfxReverb = new Tone.Reverb({ decay: 2.5, wet: 0.35 });

  /** 音效教堂混响 —— 魔法/神圣场景 */
  private cathedralReverb = new Tone.Reverb({ decay: 6, wet: 0.5 });

  /** 音效短混响 —— 战斗冲击 */
  private combatReverb = new Tone.Reverb({ decay: 0.8, wet: 0.25 });

  /** BGM 教堂混响 —— 管风琴空间感 */
  private bgmReverb = new Tone.Reverb({ decay: 8, wet: 0.6 });

  /** BGM 延迟 */
  private bgmDelay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.2, wet: 0.1 });

  /** 合唱效果器 —— 增加厚度和流动感 */
  private chorus = new Tone.Chorus({
    frequency: 1.5,
    delayTime: 3.5,
    depth: 0.5,
    wet: 0.3,
  });

  /** 移相器 —— 魔法/灵异场景 */
  private phaser = new Tone.Phaser({
    frequency: 0.5,
    octaves: 5,
    baseFrequency: 400,
    wet: 0.4,
  });

  /** 压缩器 —— 战斗冲击力 */
  private compressor = new Tone.Compressor({
    threshold: -24,
    ratio: 4,
    attack: 0.003,
    release: 0.25,
  });

  // ==================== 音效通道 ====================

  /** 魔法类音效通道 */
  private magicChannel = new Tone.Volume(0);

  /** 战斗类音效通道 */
  private combatChannel = new Tone.Volume(0);

  /** UI 类音效通道 */
  private uiChannel = new Tone.Volume(0);

  /** 探索类音效通道 */
  private explorationChannel = new Tone.Volume(0);

  /** 角色类音效通道 */
  private characterChannel = new Tone.Volume(0);

  /** 标准音效通道 */
  private standardChannel = new Tone.Volume(0);

  /** BGM 输出通道 */
  private bgmChannel = new Tone.Volume(0);

  // ==================== 合成器 ====================

  /** 通用单音合成器 —— 用于 UI 音、拾取、金币等短音（三角波 → 更柔和的 sine） */
  private synth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.003, decay: 0.15, sustain: 0, release: 0.5 },
  });

  /** 打击合成器 —— 用于攻击命中、受伤等 */
  private membrane = new Tone.MembraneSynth({
    pitchDecay: 0.08,
    octaves: 5,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.3 },
  });

  /** FM 合成器 —— 用于法术、魔法音效 */
  private fmSynth = new Tone.FMSynth({
    harmonicity: 6,
    modulationIndex: 14,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.02, decay: 0.6, sustain: 0.05, release: 0.8 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 0.02, decay: 0.4, sustain: 0, release: 0.6 },
  });

  /** 噪声合成器 —— 用于 UI 点击、陷阱、击中等 */
  private noiseSynth = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.02 },
  });

  /** 金属合成器 —— 用于硬币、铃声、商店 */
  private metalSynth = new Tone.MetalSynth({
    harmonicity: 6,
    modulationIndex: 32,
    resonance: 1200,
    octaves: 1.5,
    envelope: { attack: 0.001, decay: 0.6, sustain: 0.05, release: 0.2 },
  });

  /** 管风琴音色 —— BGM 核心 */
  private organVoice = new OrganVoice('softDiapason');

  /** BGM 持续氛围振荡器 */
  private bgmOsc: Tone.Oscillator | null = null;
  private bgmOscGain = new Tone.Gain(0);

  /** BGM 滤波器低频振荡器 —— 探索/主菜单场景的呼吸感 */
  private bgmFilterLfo: Tone.LFO | null = null;
  private bgmFilter = new Tone.Filter(500, 'lowpass');

  // ==================== 状态 ====================
  private initialized = false;
  private contextReady = false;
  private reverbReady = false;
  private currentBgmScene: BgmScene | null = null;
  private bgmPattern: Tone.Pattern<string> | Tone.Pattern<string[]> | null = null;
  private bgmLoop: Tone.Loop | null = null;

  /** 各合成器的最后调度时间（按合成器 key 分别追踪） */
  private synthScheduleTimes = new Map<string, number>();

  /**
   * 安全调度合成器，确保传入的时间始终 >= 该合成器上次调度时间，
   * 避免 Tone.js 内部振荡器时间冲突。
   */
  private scheduleAt(key: string, time: number): number {
    const last = this.synthScheduleTimes.get(key) ?? 0;
    if (time <= last) {
      time = last + 0.005;
    }
    this.synthScheduleTimes.set(key, time);
    return time;
  }

  // ---- 合成器快捷方法，自动处理时间调度安全 ----

  private tSynth(note: string, dur: string, time: number, vel?: number): void {
    this.synth.triggerAttackRelease(note, dur, this.scheduleAt('synth', time), vel);
  }
  private tMembrane(note: string, dur: string, time: number, vel?: number): void {
    this.membrane.triggerAttackRelease(note, dur, this.scheduleAt('membrane', time), vel);
  }
  private tFM(note: string, dur: string, time: number, vel?: number): void {
    this.fmSynth.triggerAttackRelease(note, dur, this.scheduleAt('fmSynth', time), vel);
  }
  private tNoise(dur: string, time: number, vel?: number): void {
    this.noiseSynth.triggerAttackRelease(dur, this.scheduleAt('noiseSynth', time), vel);
  }
  private tMetal(note: string, dur: string, time: number, vel?: number): void {
    this.metalSynth.triggerAttackRelease(note, dur, this.scheduleAt('metalSynth', time), vel);
  }
  private tOrgan(note: string | string[], dur: string, time: number, vel?: number): void {
    this.organVoice.triggerAttackRelease(note, dur, this.scheduleAt('organVoice', time), vel);
  }

  constructor() {
    // 构造函数中不启动音频上下文，等待用户交互
  }

  /**
   * 初始化音频服务
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // 从 DB 加载持久化设置
    const store = useAudioStore();
    await store.loadFromDb();

    // 同步音量
    this.applyVolume();

    // 监听内部状态变化，同步音量
    store.$subscribe(() => {
      this.applyVolume();
    });

    // 绑定游戏事件
    this.bindEvents();

    // 监听首次用户交互以启动 AudioContext
    this.listenForFirstInteraction();

    this.initialized = true;
    console.log('[AudioService] 音频服务已就绪，等待用户交互启动 AudioContext');
  }

  /** 监听首次用户交互事件 */
  private listenForFirstInteraction(): void {
    const resume = async () => {
      if (this.contextReady) return;

      try {
        await Tone.start();
        this.contextReady = true;

        // 生成混响脉冲响应（需要在 AudioContext 运行后）
        if (!this.reverbReady) {
          await Promise.all([
            this.sfxReverb.generate(),
            this.cathedralReverb.generate(),
            this.combatReverb.generate(),
            this.bgmReverb.generate(),
          ]);
          this.reverbReady = true;

          // 建立效果链连接
          this.connectEffectChains();
        }

        console.log('[AudioService] AudioContext 已启动，效果链已连接');
      } catch (e) {
        console.warn('[AudioService] AudioContext 启动失败:', e);
      }
    };

    const events = ['click', 'touchstart', 'keydown'] as const;
    for (const event of events) {
      document.addEventListener(event, resume, { once: true });
    }
  }

  /** 建立所有效果链连接 */
  private connectEffectChains(): void {
    // ===== 魔法通道：合成器 → phaser → cathedralReverb → magicChannel =====
    this.fmSynth.connect(this.phaser);
    this.synth.connect(this.phaser);
    this.metalSynth.connect(this.phaser);
    this.phaser.connect(this.cathedralReverb);
    this.cathedralReverb.connect(this.magicChannel);
    this.magicChannel.connect(this.masterVolume);

    // ===== 战斗通道：合成器 → compressor → combatReverb → combatChannel =====
    this.membrane.connect(this.compressor);
    this.noiseSynth.connect(this.compressor);
    this.compressor.connect(this.combatReverb);
    this.combatReverb.connect(this.combatChannel);
    this.combatChannel.connect(this.masterVolume);

    // ===== UI 通道：合成器 → chorus → sfxReverb → uiChannel =====
    this.chorus.connect(this.sfxReverb);
    this.sfxReverb.connect(this.uiChannel);
    this.uiChannel.connect(this.masterVolume);

    // ===== 探索通道：合成器 → sfxReverb → explorationChannel =====
    this.explorationChannel.connect(this.masterVolume);

    // ===== 角色通道：合成器 → chorus → cathedralReverb → characterChannel =====
    this.characterChannel.connect(this.masterVolume);

    // ===== 标准通道：合成器 → sfxReverb → standardChannel =====
    this.standardChannel.connect(this.masterVolume);

    // ===== BGM 通道：organVoice → bgmDelay → bgmReverb → bgmChannel =====
    this.organVoice.connect(this.bgmDelay);
    this.bgmDelay.connect(this.bgmReverb);
    this.bgmReverb.connect(this.bgmChannel);
    this.bgmChannel.connect(this.masterVolume);

    // BGM 氛围振荡器
    this.bgmFilter.connect(this.bgmReverb);
    this.bgmOscGain.connect(this.bgmFilter);

    // ===== 主输出链：masterVolume → masterFilter → destination =====
    this.masterVolume.connect(this.masterFilter);
    this.masterFilter.toDestination();
  }

  /** 尝试恢复 AudioContext */
  private async tryResume(): Promise<void> {
    if (this.contextReady) return;

    try {
      await Tone.start();
      this.contextReady = true;
      if (!this.reverbReady) {
        await Promise.all([
          this.sfxReverb.generate(),
          this.cathedralReverb.generate(),
          this.combatReverb.generate(),
          this.bgmReverb.generate(),
        ]);
        this.reverbReady = true;
        this.connectEffectChains();
      }
    } catch {
      // 静默忽略
    }
  }

  /** 检查音频服务是否已初始化并可用 */
  isReady(): boolean {
    return this.initialized && this.contextReady && this.reverbReady && Tone.getContext().state === 'running';
  }

  // ==================== 音量控制 ====================

  /** 应用音量设置到各通道 */
  private applyVolume(): void {
    const store = useAudioStore();

    // 主音量：masterVolume 映射到 -30..0 dB
    const masterDb = this.dbFromLinear(store.settings.masterVolume);
    this.masterVolume.volume.value = masterDb;

    // BGM 通道额外衰减
    const bgmDb = this.dbFromLinear(store.effectiveBgmVolume) + this.dbFromLinear(store.settings.bgmVolume);
    this.bgmChannel.volume.value = bgmDb;

    // SFX 各通道
    const sfxDb = this.dbFromLinear(store.effectiveSfxVolume) + this.dbFromLinear(store.settings.sfxVolume);
    this.magicChannel.volume.value = sfxDb;
    this.combatChannel.volume.value = sfxDb;
    this.uiChannel.volume.value = sfxDb;
    this.explorationChannel.volume.value = sfxDb;
    this.characterChannel.volume.value = sfxDb;
    this.standardChannel.volume.value = sfxDb;

    // BGM 静音时停止振荡器
    if (store.effectiveBgmVolume === 0) {
      this.stopBgmOscillator();
    } else if (this.currentBgmScene && !this.bgmOsc) {
      this.startBgmOscillator();
    }
  }

  /** 线性值转 dB */
  private dbFromLinear(value: number): number {
    if (value <= 0) return -Infinity;
    return 20 * Math.log10(value);
  }

  // ==================== 动态效果路由 ====================

  /**
   * 根据音效类型获取对应的效果路由
   */
  private getRoute(type: SfxType): SfxRoute {
    return SFX_ROUTE_MAP[type] ?? 'standard';
  }

  /**
   * 将合成器临时连接到指定路由的效果链
   * 通过 disconnect + connect 实现动态路由
   */
  private routeSynthTo(route: SfxRoute): void {
    // 断开所有连接
    this.synth.disconnect();
    this.membrane.disconnect();
    this.fmSynth.disconnect();
    this.noiseSynth.disconnect();
    this.metalSynth.disconnect();

    switch (route) {
      case 'magic':
        // 魔法通道：phaser → cathedralReverb
        this.synth.connect(this.phaser);
        this.metalSynth.connect(this.phaser);
        this.fmSynth.connect(this.phaser);
        break;

      case 'combat':
        // 战斗通道：compressor → combatReverb
        this.membrane.connect(this.compressor);
        this.noiseSynth.connect(this.compressor);
        break;

      case 'ui':
        // UI 通道：chorus → sfxReverb
        this.synth.connect(this.chorus);
        this.metalSynth.connect(this.chorus);
        this.noiseSynth.connect(this.chorus);
        break;

      case 'exploration':
        // 探索通道：sfxReverb
        this.synth.connect(this.sfxReverb);
        this.membrane.connect(this.sfxReverb);
        this.fmSynth.connect(this.sfxReverb);
        this.noiseSynth.connect(this.sfxReverb);
        this.metalSynth.connect(this.sfxReverb);
        break;

      case 'character':
        // 角色通道：chorus → cathedralReverb
        this.synth.connect(this.chorus);
        this.metalSynth.connect(this.chorus);
        this.fmSynth.connect(this.chorus);
        break;

      case 'standard':
      default:
        // 标准通道：sfxReverb
        this.synth.connect(this.sfxReverb);
        this.membrane.connect(this.sfxReverb);
        this.fmSynth.connect(this.sfxReverb);
        this.noiseSynth.connect(this.sfxReverb);
        this.metalSynth.connect(this.sfxReverb);
        break;
    }
  }

  // ==================== 音效播放 ====================

  /** 播放指定音效 */
  playSfx(type: SfxType): void {
    if (!this.isReady()) {
      this.tryResume();
      return;
    }

    const route = this.getRoute(type);
    this.routeSynthTo(route);

    const now = Tone.now();

    switch (type) {
      // ==================== 战斗 ====================

      case 'attack_hit':
        // 厚重奇幻打击：sub-bass 冲击 + 金属共振 + 短混响尾音
        this.tMembrane('D1', '8n', now, 0.95);
        this.tMembrane('D2', '16n', now + 0.005, 0.7);
        this.tNoise('32n', now + 0.003, 0.35);
        this.tMetal('D4', '64n', now + 0.01, 0.2);
        break;

      case 'attack_miss':
        // 挥空：短促呼啸 + 微弱风噪
        this.tNoise('8n', now, 0.18);
        this.tSynth('A5', '128n', now + 0.02, 0.08);
        break;

      case 'attack_crit':
        // 暴击：强打击 + 冲击波扫频 + 高频水晶碎裂 + shimmer
        this.tMembrane('G1', '16n', now, 0.9);
        this.tMembrane('G2', '32n', now + 0.01, 0.7);
        this.tMembrane('G3', '64n', now + 0.02, 0.5);
        this.tFM('D6', '32n', now + 0.02, 0.45);
        this.tFM('G6', '64n', now + 0.04, 0.35);
        this.tNoise('32n', now + 0.005, 0.4);
        this.tMetal('G5', '64n', now + 0.03, 0.3);
        break;

      case 'player_hurt':
        // 玩家受伤：低频重击 + 不和谐音
        this.tMembrane('A0', '8n', now, 0.95);
        this.tFM('A2', '8n', now + 0.02, 0.35);
        this.tFM('Eb3', '16n', now + 0.03, 0.2);
        break;

      case 'enemy_hurt':
        // 敌人受伤：较高打击 + 噪声纹理
        this.tMembrane('E2', '16n', now, 0.75);
        this.tNoise('32n', now + 0.003, 0.25);
        this.tMetal('E4', '64n', now + 0.01, 0.15);
        break;

      case 'spell_cast':
        // 法术：多层正弦波叠加 + 音高滑音 + shimmer 混响
        this.fmSynth.set({ harmonicity: 8, modulationIndex: 12 });
        this.tFM('C5', '8n', now, 0.5);
        this.tFM('G5', '16n', now + 0.06, 0.4);
        this.tFM('E6', '16n', now + 0.12, 0.3);
        this.tFM('C7', '32n', now + 0.18, 0.2);
        this.tMetal('C6', '64n', now + 0.15, 0.15);
        this.fmSynth.set({ harmonicity: 6, modulationIndex: 14 });
        break;

      case 'physical_damage':
        // 物理伤害：沉重打击 + 低频膜鼓 + 噪声纹理
        this.tMembrane('C1', '8n', now, 0.9);
        this.tMembrane('C2', '16n', now + 0.005, 0.6);
        this.tNoise('32n', now + 0.003, 0.35);
        break;

      case 'magic_damage':
        // 魔法伤害：phaser 移相 + 下行音高 sweep + 水晶高频
        this.fmSynth.set({ harmonicity: 12, modulationIndex: 16 });
        this.tFM('G5', '16n', now, 0.55);
        this.tFM('D6', '32n', now + 0.04, 0.4);
        this.tFM('A6', '64n', now + 0.07, 0.25);
        this.tFM('E7', '128n', now + 0.10, 0.15);
        this.fmSynth.set({ harmonicity: 6, modulationIndex: 14 });
        this.tMetal('A5', '64n', now + 0.05, 0.2);
        break;

      case 'health_restore':
        // 生命恢复：温暖上行琶音 + 柔和铺底
        this.tSynth('C4', '16n', now, 0.5);
        this.tSynth('E4', '16n', now + 0.08, 0.5);
        this.tSynth('G4', '16n', now + 0.16, 0.5);
        this.tSynth('C5', '8n', now + 0.24, 0.4);
        break;

      case 'mana_restore':
        // 法力恢复：清脆星辰闪烁 + shimmer
        this.tMetal('C6', '32n', now, 0.4);
        this.tMetal('E6', '64n', now + 0.06, 0.3);
        this.tMetal('G6', '64n', now + 0.10, 0.25);
        this.tSynth('C7', '128n', now + 0.14, 0.2);
        this.tFM('C7', '128n', now + 0.14, 0.15);
        break;

      case 'combat_start':
        // 战斗号角：管风琴五度和弦 + 定音鼓滚奏
        this.tOrgan(['C3', 'G3', 'C4'], '8n', now, 0.35);
        this.tOrgan(['C3', 'G3', 'C4'], '8n', now + 0.15, 0.35);
        this.tOrgan(['C3', 'Eb3', 'Bb3'], '8n', now + 0.3, 0.38);
        this.tOrgan(['C3', 'F3', 'A3'], '8n', now + 0.5, 0.38);
        this.tMembrane('C2', '16n', now, 0.4);
        this.tMembrane('C2', '16n', now + 0.15, 0.4);
        break;

      case 'combat_victory':
        // 胜利旋律：D 多利亚上行琶音 + 管风琴和声
        this.tSynth('D4', '32n', now, 0.6);
        this.tSynth('F4', '32n', now + 0.08, 0.6);
        this.tSynth('A4', '32n', now + 0.16, 0.6);
        this.tSynth('D5', '32n', now + 0.24, 0.7);
        this.tSynth('F5', '16n', now + 0.32, 0.7);
        this.tSynth('A5', '16n', now + 0.42, 0.6);
        this.tSynth('D6', '8n', now + 0.54, 0.5);
        this.tOrgan(['D3', 'A3', 'D4'], '4n', now + 0.3, 0.2);
        break;

      case 'combat_defeat':
        // 失败：C 弗里吉亚下行
        this.tSynth('C4', '16n', now, 0.5);
        this.tSynth('Ab3', '16n', now + 0.2, 0.5);
        this.tSynth('F3', '8n', now + 0.4, 0.6);
        this.tMembrane('F1', '4n', now + 0.3, 0.35);
        this.tOrgan(['F2', 'C3', 'Ab3'], '4n', now + 0.3, 0.18);
        break;

      case 'combat_flee':
        // 逃跑：快速上行 + 风声
        this.tNoise('32n', now, 0.15);
        this.tSynth('D4', '64n', now + 0.03, 0.35);
        this.tSynth('F4', '64n', now + 0.06, 0.35);
        this.tSynth('A4', '64n', now + 0.09, 0.3);
        this.tSynth('D5', '128n', now + 0.12, 0.2);
        break;

      case 'combat_skip':
        // 跳过回合：轻快掠过
        this.tNoise('16n', now, 0.15);
        this.tSynth('E4', '64n', now + 0.02, 0.22);
        this.tSynth('G4', '64n', now + 0.04, 0.18);
        break;

      // ==================== 探索 ====================

      case 'step':
        // 脚步：石板脚步声 —— 低频 + 噪声
        this.tMembrane('C3', '128n', now, 0.15);
        this.tNoise('128n', now + 0.002, 0.08);
        break;

      case 'item_pickup':
        // 拾取：明亮双音 + 魔法光晕 shimmer 尾音
        this.tSynth('D5', '32n', now, 0.65);
        this.tSynth('A5', '32n', now + 0.06, 0.65);
        this.tMetal('D6', '32n', now + 0.1, 0.3);
        this.tFM('D6', '64n', now + 0.12, 0.15);
        break;

      case 'trap_trigger':
        // 陷阱：金属机关触发 + 低频冲击 + 尖锐警报
        this.tNoise('8n', now, 0.4);
        this.tMembrane('D2', '8n', now + 0.02, 0.55);
        this.tMetal('D5', '32n', now + 0.03, 0.3);
        this.tFM('A5', '64n', now + 0.05, 0.2);
        break;

      case 'door_open':
        // 开门：厚重石门滑动 + 低频轰鸣 + 混响
        this.tMembrane('F2', '8n', now, 0.5);
        this.tNoise('8n', now + 0.01, 0.2);
        this.tFM('F3', '8n', now + 0.03, 0.3);
        this.tFM('A4', '16n', now + 0.08, 0.2);
        break;

      case 'camp_rest':
        // 营地休息：温暖篝火氛围 + 柔和铺底和弦 + 篝火 crackle
        this.tOrgan(['D3', 'A3', 'D4'], '2n', now, 0.15);
        this.tNoise('2n', now + 0.01, 0.05);
        this.tOrgan(['D3', 'F3', 'A3', 'D4'], '2n', now + 1.0, 0.12);
        this.tNoise('2n', now + 1.01, 0.04);
        break;

      case 'random_event':
        // 随机事件：竖琴/钟琴上行琶音 + shimmer
        this.fmSynth.set({ harmonicity: 5, modulationIndex: 10 });
        this.tFM('D4', '32n', now, 0.4);
        this.tFM('F4', '32n', now + 0.05, 0.35);
        this.tFM('A4', '16n', now + 0.10, 0.3);
        this.fmSynth.set({ harmonicity: 6, modulationIndex: 14 });
        this.tMetal('D5', '32n', now + 0.12, 0.2);
        this.tSynth('D6', '64n', now + 0.14, 0.15);
        break;

      // ==================== 角色 ====================

      case 'level_up':
        // 升级：多层琶音 + 管风琴和声 + 钟琴高频闪烁 + shimmer
        this.tSynth('D4', '32n', now, 0.55);
        this.tSynth('F4', '32n', now + 0.06, 0.55);
        this.tSynth('A4', '32n', now + 0.12, 0.55);
        this.tSynth('D5', '32n', now + 0.18, 0.65);
        this.tSynth('F5', '16n', now + 0.24, 0.65);
        this.tSynth('A5', '16n', now + 0.30, 0.55);
        this.tSynth('D6', '8n', now + 0.38, 0.45);
        this.tMetal('D6', '32n', now + 0.38, 0.35);
        this.tOrgan(['D3', 'A3', 'D4', 'F4'], '4n', now + 0.2, 0.18);
        break;

      case 'death':
        // 死亡：深层下行 + 管风琴低音
        this.tFM('C2', '4n', now, 0.7);
        this.tSynth('B1', '8n', now + 0.15, 0.5);
        this.tSynth('G1', '4n', now + 0.3, 0.6);
        this.tNoise('8n', now + 0.4, 0.2);
        this.tOrgan(['C2', 'G2'], '4n', now + 0.1, 0.2);
        break;

      case 'coin':
        // 金币：清脆金属 + 随机微调
        this.tMetal('G6', '32n', now, 0.5);
        break;

      case 'heal':
        // 生命恢复：温暖上行纯五度
        this.tSynth('G4', '8n', now, 0.45);
        this.tSynth('D5', '16n', now + 0.1, 0.3);
        break;

      case 'character_create':
        // 创建角色：凯旋管风琴 + 金属闪光
        this.tSynth('D4', '32n', now, 0.55);
        this.tSynth('F4', '32n', now + 0.07, 0.55);
        this.tSynth('A4', '32n', now + 0.14, 0.55);
        this.tOrgan(['D3', 'A3', 'D4', 'F4'], '8n', now + 0.22, 0.3);
        this.tMetal('D6', '32n', now + 0.22, 0.35);
        break;

      case 'resurrect':
        // 复活：管风琴全音栓 + 合唱团感 pad + 强烈 shimmer
        this.tSynth('D3', '16n', now, 0.45);
        this.tSynth('F3', '16n', now + 0.10, 0.45);
        this.tSynth('A3', '16n', now + 0.20, 0.45);
        this.tSynth('D4', '16n', now + 0.30, 0.55);
        this.tOrgan(['D3', 'F3', 'A3', 'D4'], '2n', now + 0.40, 0.28);
        this.tMetal('D5', '32n', now + 0.40, 0.35);
        this.tFM('D6', '64n', now + 0.42, 0.25);
        break;

      case 'gain_exp':
        // 获得经验：轻快三连音上行
        this.tSynth('D4', '32n', now, 0.35);
        this.tSynth('F4', '32n', now + 0.04, 0.35);
        this.tSynth('A4', '32n', now + 0.08, 0.3);
        break;

      case 'mana_recover':
        // 法力恢复：清澈星辰闪烁
        this.tMetal('C6', '64n', now, 0.25);
        this.tMetal('E6', '64n', now + 0.05, 0.22);
        this.tSynth('C7', '128n', now + 0.10, 0.15);
        break;

      // ==================== UI ====================

      case 'ui_click':
        // UI 点击：鲁特琴拨弦风格 —— 短促温暖木质音
        this.tSynth('E5', '128n', now, 0.35);
        this.tSynth('B4', '128n', now + 0.005, 0.15);
        this.tNoise('128n', now + 0.002, 0.06);
        break;

      case 'ui_open':
        // 打开面板：羊皮纸展开 + 轻柔钟琴上行
        this.tNoise('16n', now, 0.06);
        this.tSynth('D4', '32n', now + 0.04, 0.15);
        this.tSynth('G4', '32n', now + 0.08, 0.12);
        this.tMetal('D5', '64n', now + 0.10, 0.1);
        break;

      case 'ui_close':
        // 关闭面板：书本合上 + 轻柔钟琴下行
        this.tNoise('16n', now, 0.05);
        this.tSynth('G4', '32n', now + 0.04, 0.12);
        this.tSynth('D4', '32n', now + 0.08, 0.12);
        this.tMetal('A4', '64n', now + 0.10, 0.08);
        break;

      case 'confirm':
        // 确认：中世纪小号短句（五度上行）
        this.tSynth('D5', '32n', now, 0.5);
        this.tSynth('A5', '32n', now + 0.05, 0.45);
        this.tMetal('D6', '64n', now + 0.08, 0.2);
        break;

      case 'cancel':
        // 取消：琉特琴下行滑音
        this.tSynth('A4', '32n', now, 0.3);
        this.tSynth('E4', '32n', now + 0.05, 0.25);
        break;

      // ==================== 商店 ====================

      case 'shop_open':
        // 商店开门：悦耳铃声
        this.tMetal('D5', '16n', now, 0.4);
        this.tMetal('F5', '32n', now + 0.1, 0.3);
        this.tSynth('D6', '64n', now + 0.12, 0.15);
        break;

      case 'shop_buy':
        this.coin(now);
        this.coin(now + 0.08);
        break;

      case 'shop_sell':
        this.coin(now);
        break;

      case 'shop_refresh':
        // 刷新商品：翻页卷动感
        this.tNoise('16n', now, 0.08);
        this.tSynth('E4', '64n', now + 0.03, 0.22);
        this.tSynth('G4', '64n', now + 0.06, 0.18);
        break;

      // ==================== 任务 ====================

      case 'quest_accept':
        // 接任务：自信短句（D 多利亚）
        this.tSynth('D4', '16n', now, 0.55);
        this.tSynth('F4', '16n', now + 0.12, 0.55);
        this.tSynth('A4', '8n', now + 0.24, 0.45);
        break;

      case 'quest_complete':
        // 完成：完整上行旋律 + 管风琴和声
        this.tSynth('D4', '32n', now, 0.55);
        this.tSynth('F4', '32n', now + 0.07, 0.55);
        this.tSynth('A4', '32n', now + 0.14, 0.55);
        this.tSynth('D5', '16n', now + 0.21, 0.65);
        this.tSynth('F5', '16n', now + 0.30, 0.55);
        this.tSynth('D6', '8n', now + 0.40, 0.4);
        this.tOrgan(['D3', 'A3', 'D4'], '4n', now + 0.25, 0.14);
        break;

      case 'quest_abandon':
        // 放弃任务：小调下行遗憾感
        this.tSynth('E4', '16n', now, 0.35);
        this.tSynth('C4', '16n', now + 0.1, 0.35);
        this.tSynth('A3', '8n', now + 0.2, 0.3);
        break;

      case 'quest_reward':
        // 领取奖励：金币 + 完成旋律组合
        this.tMetal('G6', '64n', now, 0.45);
        this.tMetal('G6', '64n', now + 0.07, 0.45);
        this.tSynth('D5', '16n', now + 0.15, 0.5);
        this.tSynth('F5', '16n', now + 0.22, 0.45);
        break;

      // ==================== 装备 & 物品 ====================

      case 'equip':
        // 装备：厚重金属啮合 + 魔法附魔闪烁
        this.tMembrane('A2', '8n', now, 0.65);
        this.tNoise('16n', now + 0.005, 0.18);
        this.tMetal('D5', '32n', now + 0.06, 0.4);
        this.tSynth('D4', '16n', now + 0.08, 0.3);
        this.tFM('D5', '64n', now + 0.10, 0.15);
        break;

      case 'unequip':
        // 卸下装备：轻版金属声
        this.tMembrane('D2', '16n', now, 0.4);
        this.tMetal('A4', '32n', now + 0.04, 0.3);
        this.tSynth('A3', '16n', now + 0.06, 0.2);
        break;

      case 'item_use':
        // 使用消耗品：气泡上升感
        this.fmSynth.set({ harmonicity: 3, modulationIndex: 8 });
        this.tFM('F4', '32n', now, 0.4);
        this.tFM('A4', '32n', now + 0.06, 0.35);
        this.tFM('C5', '16n', now + 0.12, 0.3);
        this.fmSynth.set({ harmonicity: 6, modulationIndex: 14 });
        break;

      case 'item_drop':
        // 丢弃物品：落地闷响
        this.tMembrane('C2', '8n', now, 0.55);
        this.tNoise('32n', now + 0.01, 0.15);
        break;

      // ==================== 技能 ====================

      case 'skill_memorize':
        // 记忆技能：魔法符文铭刻 + shimmer
        this.fmSynth.set({ harmonicity: 4, modulationIndex: 10 });
        this.tFM('D4', '16n', now, 0.4);
        this.tFM('A4', '32n', now + 0.08, 0.35);
        this.fmSynth.set({ harmonicity: 6, modulationIndex: 14 });
        this.tMetal('D5', '32n', now + 0.10, 0.25);
        this.tSynth('D6', '64n', now + 0.12, 0.15);
        break;

      case 'skill_forget':
        // 遗忘技能：符文消散
        this.fmSynth.set({ harmonicity: 4, modulationIndex: 10 });
        this.tFM('A4', '16n', now, 0.35);
        this.tFM('D4', '32n', now + 0.08, 0.3);
        this.fmSynth.set({ harmonicity: 6, modulationIndex: 14 });
        break;

      // ==================== 存档 ====================

      case 'data_export':
        // 导出：羊皮纸卷起
        this.tSynth('F4', '32n', now, 0.35);
        this.tSynth('A4', '32n', now + 0.06, 0.35);
        this.tSynth('C5', '16n', now + 0.12, 0.4);
        this.tNoise('16n', now + 0.02, 0.08);
        break;

      case 'data_import':
        // 导入：羊皮纸展开
        this.tNoise('16n', now, 0.08);
        this.tSynth('C5', '32n', now + 0.03, 0.35);
        this.tSynth('A4', '32n', now + 0.09, 0.35);
        this.tSynth('F4', '16n', now + 0.15, 0.4);
        break;

      // ==================== 系统 ====================

      case 'exit_menu':
        // 退出到菜单：沉重关门 + 管风琴低音
        this.tMembrane('A1', '4n', now, 0.65);
        this.tNoise('16n', now + 0.01, 0.18);
        this.tSynth('E3', '8n', now + 0.1, 0.25);
        this.tOrgan(['A1', 'E2'], '4n', now + 0.05, 0.14);
        break;
    }
  }

  /** 播放金币音效 */
  private coin(time: number): void {
    this.tMetal('G6', '64n', time, 0.45);
  }

  // ==================== 背景音乐 ====================

  /** 切换 BGM 场景 */
  setBgmScene(scene: BgmScene): void {
    if (!this.isReady()) {
      this.tryResume();
      return;
    }
    if (scene === this.currentBgmScene) return;

    this.currentBgmScene = scene;
    this.stopBgm();

    const store = useAudioStore();
    if (store.effectiveBgmVolume === 0) return;

    switch (scene) {
      case 'main_menu':
        this.playMainMenuBgm();
        break;
      case 'exploration':
        this.playExplorationBgm();
        break;
      case 'combat':
        this.playCombatBgm();
        break;
      case 'shop':
        this.playShopBgm();
        break;
      case 'victory':
        this.playVictoryBgm();
        break;
      case 'defeat':
        this.playDefeatBgm();
        break;
    }
  }

  /** 停止 BGM */
  stopBgm(): void {
    if (this.bgmPattern) {
      this.bgmPattern.stop();
      this.bgmPattern.dispose();
      this.bgmPattern = null;
    }
    if (this.bgmLoop) {
      this.bgmLoop.stop();
      this.bgmLoop.dispose();
      this.bgmLoop = null;
    }
    this.organVoice.releaseAll();
    this.stopBgmOscillator();
    this.stopFilterLfo();
  }

  /**
   * 播放主菜单 BGM —— 庄严管风琴圣咏
   * D 多利亚 → C 弗里吉亚交替，平行五度/八度进行，教堂混响
   */
  private playMainMenuBgm(): void {
    this.organVoice.setPreset('diapason');
    this.organVoice.setEnvelope({ attack: 1.5, decay: 1.2, sustain: 0.5, release: 3.5 });
    this.startBgmOscillator(36);
    this.startFilterLfo(0.25, 350);

    // D 多利亚 → C 弗里吉亚交替 —— 暗黑史诗感
    const progression = [
      ['D3', 'A3', 'D4'],              // D5（开放五度）
      ['C3', 'G3', 'C4'],              // C5
      ['F2', 'C3', 'F3', 'A3'],        // F（多利亚大六度）
      ['G2', 'D3', 'G3', 'B3'],        // G（多利亚大七度）
      ['C3', 'G3', 'C4', 'Eb4'],       // Cm（弗里吉亚转换）
      ['Ab2', 'Eb3', 'Ab3', 'C4'],     // Ab
      ['Bb2', 'F3', 'Bb3', 'D4'],      // Bb
      ['C3', 'G3', 'C4'],              // C5
    ];

    this.bgmPattern = new Tone.Pattern(
      (time, chord) => {
        this.tOrgan(chord, '2n', time, 0.1);
      },
      progression,
      'up'
    ).start(0);

    Tone.getTransport().bpm.value = 42;
    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
    }
  }

  /**
   * 播放探索 BGM —— 神秘管风琴铺底
   * D 多利亚调式，开放五度和弦，持续 pedal note
   */
  private playExplorationBgm(): void {
    this.organVoice.setPreset('softDiapason');
    this.organVoice.setEnvelope({ attack: 1.0, decay: 0.6, sustain: 0.4, release: 3 });
    this.startBgmOscillator(37); // D2 持续 pedal note
    this.startFilterLfo(0.12, 500);

    // D 多利亚调式 —— 开放五度和弦（无三音，保持调式暧昧感）
    const chords = [
      ['D3', 'A3', 'D4'],              // D5
      ['F2', 'C3', 'F3'],              // F5
      ['C3', 'G3', 'C4'],              // C5
      ['G2', 'D3', 'G3'],              // G5
      ['A2', 'E3', 'A3'],              // Am（无三音）
      ['C3', 'G3', 'C4', 'E4'],        // C（偶尔加入三音）
      ['D3', 'A3', 'D4', 'F4'],        // Dm
      ['G2', 'D3', 'G3', 'B3'],        // G
    ];

    this.bgmPattern = new Tone.Pattern(
      (time, chord) => {
        this.tOrgan(chord, '1m', time, 0.08);
      },
      chords,
      'up'
    ).start(0);

    // 旋律层：D 小调五声音阶 —— 随机漫步
    const melody = ['D4', 'F4', 'G4', 'A4', 'C5', 'A4', 'G4', 'F4',
                    'D4', 'C4', 'D4', 'F4', 'G4', 'A4', 'G4', 'F4'];

    this.bgmLoop = new Tone.Loop((time) => {
      const note = melody[Math.floor(Math.random() * melody.length)];
      this.tOrgan(note, '4n', time, 0.03);
    }, '4n').start(0);

    Tone.getTransport().bpm.value = 48;
    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
    }
  }

  /**
   * 播放战斗 BGM —— 压迫感管风琴
   * C 弗里吉亚，三全音，16' pedal 低音线
   */
  private playCombatBgm(): void {
    this.organVoice.setPreset('fullOrgan');
    this.organVoice.setEnvelope({ attack: 0.1, decay: 0.3, sustain: 0.5, release: 0.6 });
    this.startBgmOscillator(33); // C1 pedal
    this.stopFilterLfo();
    this.bgmFilter.frequency.value = 800;

    // C 弗里吉亚 —— 紧张低音线 + 三全音
    const bassLine = [
      ['C2', 'G2', 'C3'],              // C5
      ['C2', 'G2', 'C3'],              // C5
      ['Db2', 'Ab2', 'Db3'],           // Db5（弗里吉亚二度）
      ['C2', 'G2', 'C3'],              // C5
      ['Eb2', 'Bb2', 'Eb3'],           // Eb5
      ['Db2', 'Ab2', 'Db3'],           // Db5
      ['C2', 'Gb2', 'C3'],             // C + Gb（三全音！）
      ['F2', 'C3', 'F3'],              // F5
    ];

    this.bgmPattern = new Tone.Pattern(
      (time, chord) => {
        this.tOrgan(chord, '8n', time, 0.18);
      },
      bassLine,
      'up'
    ).start(0);

    Tone.getTransport().bpm.value = 95;
    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
    }
  }

  /**
   * 播放商店 BGM —— 温暖小管风琴
   * F 利底亚，爵士七和弦进行
   */
  private playShopBgm(): void {
    this.organVoice.setPreset('flute');
    this.organVoice.setEnvelope({ attack: 0.5, decay: 0.4, sustain: 0.5, release: 2.5 });
    this.startBgmOscillator(44);
    this.stopFilterLfo();
    this.bgmFilter.frequency.value = 400;

    // F 利底亚 —— 温暖爵士七和弦
    const progression = [
      ['F3', 'A3', 'C4', 'E4'],        // Fmaj7
      ['D3', 'F3', 'A3', 'C4'],        // Dm7
      ['G3', 'B3', 'D4', 'F4'],        // G7
      ['C3', 'E3', 'G3', 'B3'],        // Cmaj7
      ['A2', 'C3', 'E3', 'G3'],        // Am7
      ['D3', 'F3', 'A3', 'C4'],        // Dm7
      ['G3', 'B3', 'D4', 'F4'],        // G7
      ['C3', 'E3', 'G3', 'B3'],        // Cmaj7
    ];

    this.bgmPattern = new Tone.Pattern(
      (time, chord) => {
        this.tOrgan(chord, '2n', time, 0.15);
      },
      progression,
      'up'
    ).start(0);

    Tone.getTransport().bpm.value = 65;
    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
    }
  }

  /** BGM: 胜利 —— 简短管风琴胜利旋律后切回探索 */
  private playVictoryBgm(): void {
    this.organVoice.setPreset('fullOrgan');
    this.organVoice.setEnvelope({ attack: 0.1, decay: 0.3, sustain: 0.6, release: 2 });
    this.startBgmOscillator(37);

    const now = Tone.now();

    // D 多利亚 → D 大调（皮卡第三度）凯旋
    this.tOrgan(['D3', 'A3', 'D4', 'F4'], '8n', now, 0.28);
    this.tOrgan(['G3', 'B3', 'D4', 'G4'], '8n', now + 0.3, 0.25);
    this.tOrgan(['A3', 'C4', 'E4', 'A4'], '8n', now + 0.6, 0.25);
    this.tOrgan(['D3', 'A3', 'D4', 'F#4'], '4n', now + 0.9, 0.3);

    // 3 秒后切回探索
    setTimeout(() => {
      if (this.currentBgmScene === 'victory') {
        this.setBgmScene('exploration');
      }
    }, 3000);
  }

  /** BGM: 失败 —— 简短管风琴下行旋律后切回探索 */
  private playDefeatBgm(): void {
    this.organVoice.setPreset('diapason');
    this.organVoice.setEnvelope({ attack: 0.1, decay: 0.5, sustain: 0.4, release: 2 });
    this.startBgmOscillator(33);

    const now = Tone.now();

    // C 弗里吉亚下行
    this.tOrgan(['C3', 'G3', 'C4', 'Eb4'], '8n', now, 0.28);
    this.tOrgan(['Ab3', 'Eb4', 'Ab4', 'C5'], '8n', now + 0.35, 0.25);
    this.tOrgan(['F3', 'C4', 'F4', 'Ab4'], '8n', now + 0.7, 0.25);
    this.tOrgan(['G3', 'D4', 'G4', 'B4'], '4n', now + 1.0, 0.28);

    // 3 秒后切回探索
    setTimeout(() => {
      if (this.currentBgmScene === 'defeat') {
        this.setBgmScene('exploration');
      }
    }, 3000);
  }

  /** 启动 BGM 持续氛围振荡器 */
  private startBgmOscillator(freq: number = 37): void {
    if (this.bgmOsc) return;

    const store = useAudioStore();
    if (store.effectiveBgmVolume === 0) return;

    this.bgmOsc = new Tone.Oscillator({
      type: 'sine',
      frequency: freq,
    }).connect(this.bgmOscGain);
    this.bgmOscGain.gain.value = 0.025;
    this.bgmOsc.start();
  }

  /** 停止 BGM 持续氛围振荡器 */
  private stopBgmOscillator(): void {
    if (this.bgmOsc) {
      this.bgmOsc.stop();
      this.bgmOsc.dispose();
      this.bgmOsc = null;
    }
  }

  /** 启动滤波器低频振荡器 —— 制造"呼吸"效果 */
  private startFilterLfo(rate: number, baseFreq: number): void {
    if (this.bgmFilterLfo) return;

    this.bgmFilterLfo = new Tone.LFO({
      type: 'sine',
      min: baseFreq * 0.5,
      max: baseFreq,
      frequency: rate,
    }).connect(this.bgmFilter.frequency);
    this.bgmFilterLfo.start();
  }

  /** 停止滤波器低频振荡器 */
  private stopFilterLfo(): void {
    if (this.bgmFilterLfo) {
      this.bgmFilterLfo.stop();
      this.bgmFilterLfo.dispose();
      this.bgmFilterLfo = null;
    }
  }

  // ==================== 事件绑定 ====================

  /** 从 store 获取当前设置 */
  getSettings(): AudioSettings {
    return { ...useAudioStore().settings };
  }

  /** 更新设置 */
  updateSettings(settings: Partial<AudioSettings>): void {
    useAudioStore().updateSettings(settings);
  }

  /** 绑定游戏事件到音效 */
  private bindEvents(): void {
    // -- 战斗事件 --
    eventBus.on(GameEvents.COMBAT_START, () => {
      this.playSfx('combat_start');
      this.setBgmScene('combat');
    });

    eventBus.on(GameEvents.COMBAT_END, (data) => {
      switch (data.result) {
        case 'victory':
          this.playSfx('combat_victory');
          this.setBgmScene('victory');
          break;
        case 'defeat':
          this.playSfx('combat_defeat');
          this.setBgmScene('defeat');
          break;
        default:
          this.playSfx('combat_flee');
          this.setBgmScene('exploration');
          break;
      }
    });

    eventBus.on(GameEvents.COMBAT_PLAYER_TURN, () => {
      // 玩家回合开始，无额外音效
    });

    eventBus.on(GameEvents.COMBAT_ENEMY_TURN, () => {
      // 敌人回合开始
    });

    eventBus.on(GameEvents.COMBAT_DEAL_DAMAGE, (data) => {
      if (data.damageType === 'magic') {
        this.playSfx('magic_damage');
      } else if (data.actorType === 'player') {
        this.playSfx('attack_hit');
      } else if (data.actorType === 'enemy') {
        this.playSfx('enemy_hurt');
      } else {
        this.playSfx('physical_damage');
      }
    });

    eventBus.on(GameEvents.COMBAT_CAST_HEAL, (data) => {
      this.playSfx(data.healType === 'mana' ? 'mana_restore' : 'health_restore');
    });

    eventBus.on(GameEvents.COMBAT_CRITICAL_HIT, () => {
      this.playSfx('attack_crit');
    });

    eventBus.on(GameEvents.COMBAT_DODGE, () => {
      this.playSfx('attack_miss');
    });

    // -- 角色事件 --
    eventBus.on(GameEvents.CHARACTER_LEVEL_UP, () => {
      this.playSfx('level_up');
    });

    eventBus.on(GameEvents.CHARACTER_DEATH, () => {
      this.playSfx('death');
    });

    eventBus.on(GameEvents.CHARACTER_RESURRECTED, () => {
      this.playSfx('resurrect');
    });

    // -- 探索事件 --
    eventBus.on(GameEvents.EXPLORATION_CELL_EXPLORED, () => {
      this.playSfx('step');
    });

    eventBus.on(GameEvents.EXPLORATION_ITEM_FOUND, () => {
      this.playSfx('item_pickup');
    });

    eventBus.on(GameEvents.EXPLORATION_TRAP_TRIGGERED, () => {
      this.playSfx('trap_trigger');
    });

    eventBus.on(GameEvents.EXPLORATION_BATTLE_TRIGGERED, () => {
      this.setBgmScene('combat');
    });

    eventBus.on(GameEvents.ZONE_ENTERED, () => {
      this.playSfx('door_open');
    });

    eventBus.on(GameEvents.EXPLORATION_CAMP_USED, () => {
      this.playSfx('camp_rest');
    });

    eventBus.on(GameEvents.EXPLORATION_RANDOM_EVENT, () => {
      this.playSfx('random_event');
    });

    // -- 商店事件 --
    eventBus.on(GameEvents.SHOP_OPENED, () => {
      this.playSfx('shop_open');
      this.setBgmScene('shop');
    });

    eventBus.on(GameEvents.SHOP_TRANSACTION, () => {
      this.playSfx('shop_buy');
    });

    eventBus.on(GameEvents.SHOP_CLOSED, () => {
      this.setBgmScene('exploration');
    });

    // -- 任务事件 --
    eventBus.on(GameEvents.QUEST_ACCEPTED, () => {
      this.playSfx('quest_accept');
    });

    eventBus.on(GameEvents.QUEST_COMPLETED, () => {
      this.playSfx('quest_complete');
    });

    eventBus.on(GameEvents.QUEST_REWARDED, () => {
      this.playSfx('quest_reward');
    });

    // -- 技能事件 --
    eventBus.on(GameEvents.SKILL_CAST, () => {
      this.playSfx('spell_cast');
    });

    eventBus.on(GameEvents.SKILL_LEARNED, () => {
      this.playSfx('level_up');
    });

    // -- 探索开始/结束时控制 BGM --
    eventBus.on(GameEvents.EXPLORATION_START, () => {
      this.setBgmScene('exploration');
    });

    eventBus.on(GameEvents.EXPLORATION_END, () => {
      this.stopBgm();
    });

    // -- UI 面板事件 --
    eventBus.on(GameEvents.UI_PANEL_OPENED, () => {
      this.playSfx('ui_open');
    });

    eventBus.on(GameEvents.UI_PANEL_CLOSED, () => {
      this.playSfx('ui_close');
    });

    eventBus.on(GameEvents.UI_CLICK, () => {
      this.playSfx('ui_click');
    });

    // -- 确认/取消事件 --
    eventBus.on(GameEvents.CONFIRM_CONFIRMED, () => {
      this.playSfx('confirm');
    });

    eventBus.on(GameEvents.CONFIRM_CANCELED, () => {
      this.playSfx('cancel');
    });

    // -- 物品丢弃事件 --
    eventBus.on(GameEvents.ITEM_DROPPED, () => {
      this.playSfx('item_drop');
    });

    // -- 角色创建事件 --
    eventBus.on(GameEvents.CHARACTER_CREATED, () => {
      this.playSfx('character_create');
    });

    // -- 跳过回合事件 --
    eventBus.on(GameEvents.COMBAT_SKIP_TURN, () => {
      this.playSfx('combat_skip');
    });

    // -- 存档事件 --
    eventBus.on(GameEvents.DATA_EXPORTED, () => {
      this.playSfx('data_export');
    });

    eventBus.on(GameEvents.DATA_IMPORTED, () => {
      this.playSfx('data_import');
    });

    // -- 退出事件 --
    eventBus.on(GameEvents.CHARACTER_LOGOUT, () => {
      this.playSfx('exit_menu');
      this.setBgmScene('main_menu');
    });
  }
}

/** 音频服务单例 */
export const audioService = new AudioService();
