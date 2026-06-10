/**
 * @fileoverview 音频服务核心
 * @description 基于 Tone.js 的音频合成服务，负责所有音效和背景音乐的生成与播放。
 * 所有音效通过代码合成，无需外部音频文件，完全离线可用。
 */

import * as Tone from 'tone';
import { eventBus, GameEvents } from '../bus/core';
import { useAudioStore } from './store';
import type { IAudioService, SfxType, BgmScene, AudioSettings } from './types';

/** 音频服务实现类 */
class AudioService implements IAudioService {
  // ==================== 效果器 ====================
  /** 主输出音量节点 */
  private masterVolume = new Tone.Volume(-6).toDestination();

  /** 音效输出通道 */
  private sfxChannel = new Tone.Volume(0);

  /** 音效混响 —— 为所有音效增加空间感 */
  private sfxReverb = new Tone.Reverb({ decay: 1.5, wet: 0.3 });

  /** BGM 输出通道 */
  private bgmChannel = new Tone.Volume(0);

  /** BGM 混响 */
  private bgmReverb = new Tone.Reverb({ decay: 6, wet: 0.5 });

  /** BGM 延迟 */
  private bgmDelay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.25, wet: 0.12 });

  // 连接音效效果链
  // sfxChannel → sfxReverb → masterVolume
  // 注意：sfxReverb 必须在 init 时 await generate() 后再连接

  /** 通用单音合成器 —— 用于 UI 音、拾取、金币等短音 */
  private synth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.003, decay: 0.12, sustain: 0, release: 0.4 },
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
    harmonicity: 8,
    modulationIndex: 40,
    resonance: 3000,
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.6, sustain: 0.05, release: 0.2 },
  });

  /** BGM 复音合成器 —— 带平滑包络的 pad 音色 */
  private bgmSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.8, decay: 0.5, sustain: 0.55, release: 2.5 },
  } as any);

  /** BGM 滤波 —— 动态控制 BGM 频率范围 */
  private bgmFilter = new Tone.Filter(500, 'lowpass');

  /** BGM 持续氛围振荡器 */
  private bgmOsc: Tone.Oscillator | null = null;
  private bgmOscGain = new Tone.Gain(0);

  /** BGM 滤波器低频振荡器 —— 探索/主菜单场景的呼吸感 */
  private bgmFilterLfo: Tone.LFO | null = null;

  // ==================== 状态 ====================
  private initialized = false;
  private contextReady = false;
  private reverbReady = false;
  private currentBgmScene: BgmScene | null = null;
  private bgmPattern: Tone.Pattern<string> | Tone.Pattern<string[]> | null = null;
  private bgmLoop: Tone.Loop | null = null;

  /** 上次调度时间戳，防止同一帧内多次调度同一合成器冲突 */
  private lastScheduleTime = 0;

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
          await this.sfxReverb.generate();
          this.reverbReady = true;
          // 建立效果链连接
          this.synth.connect(this.sfxReverb);
          this.membrane.connect(this.sfxReverb);
          this.fmSynth.connect(this.sfxReverb);
          this.noiseSynth.connect(this.sfxReverb);
          this.metalSynth.connect(this.sfxReverb);
          this.sfxReverb.connect(this.sfxChannel);
          this.sfxChannel.connect(this.masterVolume);

          this.bgmSynth.chain(this.bgmDelay, this.bgmReverb, this.bgmChannel);
          this.bgmFilter.connect(this.bgmReverb);
          this.bgmOscGain.connect(this.bgmFilter);
          this.bgmChannel.connect(this.masterVolume);
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

  /** 尝试恢复 AudioContext */
  private async tryResume(): Promise<void> {
    if (this.contextReady) return;

    try {
      await Tone.start();
      this.contextReady = true;
      if (!this.reverbReady) {
        await this.sfxReverb.generate();
        this.reverbReady = true;
        this.synth.connect(this.sfxReverb);
        this.membrane.connect(this.sfxReverb);
        this.fmSynth.connect(this.sfxReverb);
        this.noiseSynth.connect(this.sfxReverb);
        this.metalSynth.connect(this.sfxReverb);
        this.sfxReverb.connect(this.sfxChannel);
        this.sfxChannel.connect(this.masterVolume);
        this.bgmSynth.chain(this.bgmDelay, this.bgmReverb, this.bgmChannel);
        this.bgmFilter.connect(this.bgmReverb);
        this.bgmOscGain.connect(this.bgmFilter);
        this.bgmChannel.connect(this.masterVolume);
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

    // SFX 通道
    const sfxDb = this.dbFromLinear(store.effectiveSfxVolume) + this.dbFromLinear(store.settings.sfxVolume);
    this.sfxChannel.volume.value = sfxDb;

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

  // ==================== 音效播放 ====================

  /** 播放指定音效 */
  playSfx(type: SfxType): void {
    if (!this.isReady()) {
      this.tryResume();
      return;
    }

    let now = Tone.now();

    // 防止同一帧内多次调度导致振荡器起始时间冲突
    if (now <= this.lastScheduleTime) {
      now = this.lastScheduleTime + 0.005;
    }
    this.lastScheduleTime = now;

    switch (type) {
      // -- 战斗 --
      case 'attack_hit':
        // 厚重打击：低音鼓 + 噪声冲击纹理
        this.membrane.triggerAttackRelease('D2', '8n', now, 0.9);
        this.noiseSynth.triggerAttackRelease('32n', now + 0.003, 0.3);
        break;

      case 'attack_miss':
        // 挥空：短促呼啸（默认噪声衰减已足够短）
        this.noiseSynth.triggerAttackRelease('8n', now, 0.2);
        break;

      case 'attack_crit':
        // 暴击：强打击 + 高频闪光
        this.membrane.triggerAttackRelease('G2', '16n', now, 0.8);
        this.membrane.triggerAttackRelease('G3', '32n', now + 0.01, 0.6);
        this.fmSynth.triggerAttackRelease('D6', '32n', now + 0.02, 0.4);
        this.noiseSynth.triggerAttackRelease('32n', now + 0.005, 0.35);
        break;

      case 'player_hurt':
        // 玩家受伤：低频重击
        this.membrane.triggerAttackRelease('A1', '8n', now, 0.9);
        this.fmSynth.triggerAttackRelease('A2', '8n', now + 0.02, 0.3);
        break;

      case 'enemy_hurt':
        // 敌人受伤：较高打击
        this.membrane.triggerAttackRelease('E2', '16n', now, 0.7);
        this.noiseSynth.triggerAttackRelease('32n', now + 0.003, 0.2);
        break;

      case 'spell_cast':
        // 法术：FM 扫频 + 混响尾音
        this.fmSynth.set({ harmonicity: 8 });
        this.fmSynth.triggerAttackRelease('C5', '8n', now, 0.5);
        this.fmSynth.triggerAttackRelease('G5', '16n', now + 0.06, 0.35);
        this.fmSynth.triggerAttackRelease('E6', '16n', now + 0.12, 0.2);
        this.fmSynth.set({ harmonicity: 6 });
        break;

      case 'physical_damage':
        // 物理伤害：沉重打击 低频膜鼓 + 噪声纹理
        this.membrane.triggerAttackRelease('C2', '8n', now, 0.85);
        this.noiseSynth.triggerAttackRelease('32n', now + 0.003, 0.35);
        break;

      case 'magic_damage':
        // 魔法伤害：FM 扫频 下行能量感 + 高音闪烁
        this.fmSynth.set({ harmonicity: 12 });
        this.fmSynth.triggerAttackRelease('G5', '16n', now, 0.55);
        this.fmSynth.triggerAttackRelease('D6', '32n', now + 0.04, 0.35);
        this.fmSynth.triggerAttackRelease('A6', '64n', now + 0.07, 0.2);
        this.fmSynth.set({ harmonicity: 6 });
        break;

      case 'health_restore':
        // 生命回复：温暖上行琶音 + 柔和铺底
        this.synth.triggerAttackRelease('C4', '16n', now, 0.45);
        this.synth.triggerAttackRelease('E4', '16n', now + 0.08, 0.45);
        this.synth.triggerAttackRelease('G4', '16n', now + 0.16, 0.45);
        this.bgmSynth.triggerAttackRelease(['C4', 'E4', 'G4'], '8n', now + 0.24, 0.2);
        break;

      case 'mana_restore':
        // 法力回复：清脆高音 星辰闪烁感
        this.metalSynth.triggerAttackRelease('C6', '32n', now, 0.35);
        this.metalSynth.triggerAttackRelease('E6', '64n', now + 0.06, 0.25);
        this.metalSynth.triggerAttackRelease('G6', '64n', now + 0.10, 0.2);
        this.synth.triggerAttackRelease('C7', '128n', now + 0.14, 0.15);
        break;

      case 'combat_start':
        // 战斗号角：下行五度 + 紧张节奏
        this.bgmSynth.triggerAttackRelease(['C3', 'G3', 'C4'], '16n', now, 0.4);
        this.bgmSynth.triggerAttackRelease(['C3', 'G3', 'C4'], '16n', now + 0.15, 0.4);
        this.bgmSynth.triggerAttackRelease(['C3', 'Eb3', 'Bb3'], '8n', now + 0.3, 0.5);
        this.bgmSynth.triggerAttackRelease(['C3', 'F3', 'A3'], '8n', now + 0.5, 0.5);
        break;

      case 'combat_victory':
        // 胜利旋律：C大调上行琶音
        this.synth.triggerAttackRelease('C4', '32n', now, 0.6);
        this.synth.triggerAttackRelease('E4', '32n', now + 0.08, 0.6);
        this.synth.triggerAttackRelease('G4', '32n', now + 0.16, 0.6);
        this.synth.triggerAttackRelease('C5', '32n', now + 0.24, 0.7);
        this.synth.triggerAttackRelease('E5', '16n', now + 0.32, 0.7);
        this.synth.triggerAttackRelease('G5', '16n', now + 0.42, 0.6);
        this.synth.triggerAttackRelease('C6', '8n', now + 0.54, 0.5);
        break;

      case 'combat_defeat':
        // 失败：C小调下行
        this.synth.triggerAttackRelease('C4', '16n', now, 0.5);
        this.synth.triggerAttackRelease('Ab3', '16n', now + 0.2, 0.5);
        this.synth.triggerAttackRelease('F3', '8n', now + 0.4, 0.6);
        this.membrane.triggerAttackRelease('F1', '4n', now + 0.3, 0.3);
        break;

      case 'combat_flee':
        // 逃跑：快速上行
        this.noiseSynth.triggerAttackRelease('32n', now, 0.15);
        this.synth.triggerAttackRelease('D4', '64n', now + 0.03, 0.3);
        this.synth.triggerAttackRelease('F4', '64n', now + 0.06, 0.3);
        this.synth.triggerAttackRelease('A4', '64n', now + 0.09, 0.3);
        break;

      // -- 探索 --
      case 'step':
        // 脚步：极短低频噪声
        this.noiseSynth.triggerAttackRelease('128n', now, 0.1);
        break;

      case 'item_pickup':
        // 拾取：明亮双音
        this.synth.triggerAttackRelease('D5', '32n', now, 0.6);
        this.synth.triggerAttackRelease('A5', '32n', now + 0.06, 0.6);
        this.metalSynth.triggerAttackRelease('D6', '32n', now + 0.1, 0.25);
        break;

      case 'trap_trigger':
        // 陷阱：冲击噪声 + 低频轰隆
        this.noiseSynth.triggerAttackRelease('8n', now, 0.35);
        this.membrane.triggerAttackRelease('D2', '8n', now + 0.02, 0.5);
        break;

      case 'door_open':
        // 开门：FM 扫频 → 打开
        this.fmSynth.set({ harmonicity: 3 });
        this.fmSynth.triggerAttackRelease('F3', '8n', now, 0.4);
        this.fmSynth.triggerAttackRelease('A4', '8n', now + 0.06, 0.3);
        this.fmSynth.set({ harmonicity: 6 });
        break;

      // -- 角色 --
      case 'level_up':
        // 升级：多层琶音 + 持续高音
        this.synth.triggerAttackRelease('C4', '32n', now, 0.5);
        this.synth.triggerAttackRelease('E4', '32n', now + 0.06, 0.5);
        this.synth.triggerAttackRelease('G4', '32n', now + 0.12, 0.5);
        this.synth.triggerAttackRelease('C5', '32n', now + 0.18, 0.6);
        this.synth.triggerAttackRelease('E5', '16n', now + 0.24, 0.6);
        this.synth.triggerAttackRelease('G5', '16n', now + 0.30, 0.5);
        this.synth.triggerAttackRelease('C6', '8n', now + 0.38, 0.4);
        this.metalSynth.triggerAttackRelease('C6', '32n', now + 0.38, 0.3);
        break;

      case 'death':
        // 死亡：深层下行
        this.fmSynth.triggerAttackRelease('C2', '4n', now, 0.7);
        this.synth.triggerAttackRelease('B1', '8n', now + 0.15, 0.5);
        this.synth.triggerAttackRelease('G1', '4n', now + 0.3, 0.6);
        this.noiseSynth.triggerAttackRelease('8n', now + 0.4, 0.2);
        break;

      case 'coin':
        // 金币：清脆金属
        this.metalSynth.triggerAttackRelease('G6', '32n', now, 0.45);
        break;

      case 'heal':
        // 治疗：温暖上行和弦
        this.synth.triggerAttackRelease('E4', '16n', now, 0.5);
        this.synth.triggerAttackRelease('A4', '16n', now + 0.1, 0.5);
        this.synth.triggerAttackRelease('C5', '16n', now + 0.2, 0.5);
        this.bgmSynth.triggerAttackRelease(['E4', 'A4', 'C5'], '8n', now + 0.3, 0.3);
        break;

      // -- UI --
      case 'ui_click':
        // UI 点击：轻快触感
        this.synth.triggerAttackRelease('E6', '128n', now, 0.3);
        this.noiseSynth.triggerAttackRelease('128n', now + 0.002, 0.08);
        break;

      case 'ui_open':
        // 打开面板：低沉柔和的闷响 + 微弱上行
        this.membrane.triggerAttackRelease('A1', '8n', now, 0.3);
        this.noiseSynth.triggerAttackRelease('16n', now + 0.005, 0.06);
        this.synth.triggerAttackRelease('D4', '32n', now + 0.06, 0.1);
        this.synth.triggerAttackRelease('G4', '32n', now + 0.10, 0.08);
        break;

      case 'ui_close':
        // 关闭面板：低沉柔和的闷响 + 微弱下行
        this.membrane.triggerAttackRelease('A1', '8n', now, 0.25);
        this.noiseSynth.triggerAttackRelease('16n', now + 0.005, 0.05);
        this.synth.triggerAttackRelease('G4', '32n', now + 0.06, 0.08);
        this.synth.triggerAttackRelease('D4', '32n', now + 0.10, 0.08);
        break;

      // -- 商店 --
      case 'shop_open':
        // 商店开门：悦耳铃声
        this.metalSynth.triggerAttackRelease('C5', '16n', now, 0.35);
        this.metalSynth.triggerAttackRelease('E5', '32n', now + 0.1, 0.25);
        break;

      case 'shop_buy':
        this.coin(now);
        this.coin(now + 0.08);
        break;

      case 'shop_sell':
        this.coin(now);
        break;

      // -- 任务 --
      case 'quest_accept':
        // 接任务：自信短句
        this.synth.triggerAttackRelease('C4', '16n', now, 0.5);
        this.synth.triggerAttackRelease('F4', '16n', now + 0.12, 0.5);
        this.synth.triggerAttackRelease('A4', '8n', now + 0.24, 0.4);
        break;

      case 'quest_complete':
        // 完成：完整上行旋律
        this.synth.triggerAttackRelease('C4', '32n', now, 0.5);
        this.synth.triggerAttackRelease('E4', '32n', now + 0.07, 0.5);
        this.synth.triggerAttackRelease('G4', '32n', now + 0.14, 0.5);
        this.synth.triggerAttackRelease('C5', '16n', now + 0.21, 0.6);
        this.synth.triggerAttackRelease('E5', '16n', now + 0.30, 0.5);
        this.synth.triggerAttackRelease('C6', '8n', now + 0.40, 0.35);
        break;

      // -- 装备 & 物品 --
      case 'equip':
        // 装备：厚重金属啮合声 —— 低频撞击 + 金属共振
        this.membrane.triggerAttackRelease('A2', '8n', now, 0.6);
        this.noiseSynth.triggerAttackRelease('16n', now + 0.005, 0.15);
        this.metalSynth.triggerAttackRelease('D5', '32n', now + 0.06, 0.35);
        this.synth.triggerAttackRelease('D4', '16n', now + 0.08, 0.25);
        break;

      case 'unequip':
        // 卸下装备：轻版金属声 —— 较弱的撞击 + 下行
        this.membrane.triggerAttackRelease('D2', '16n', now, 0.35);
        this.metalSynth.triggerAttackRelease('A4', '32n', now + 0.04, 0.25);
        this.synth.triggerAttackRelease('A3', '16n', now + 0.06, 0.18);
        break;

      case 'item_use':
        // 使用消耗品：气泡上升感 —— 温暖上行音
        this.fmSynth.set({ harmonicity: 3, modulationIndex: 8 });
        this.fmSynth.triggerAttackRelease('F4', '32n', now, 0.35);
        this.fmSynth.triggerAttackRelease('A4', '32n', now + 0.06, 0.3);
        this.fmSynth.triggerAttackRelease('C5', '16n', now + 0.12, 0.25);
        this.fmSynth.set({ harmonicity: 6, modulationIndex: 14 });
        break;

      case 'item_drop':
        // 丢弃物品：落地闷响
        this.membrane.triggerAttackRelease('C2', '8n', now, 0.5);
        this.noiseSynth.triggerAttackRelease('32n', now + 0.01, 0.12);
        break;

      // -- 角色创建 --
      case 'character_create':
        // 创建角色：凯旋号角 —— C大调和弦 + 金属闪光
        this.synth.triggerAttackRelease('C4', '32n', now, 0.5);
        this.synth.triggerAttackRelease('E4', '32n', now + 0.07, 0.5);
        this.synth.triggerAttackRelease('G4', '32n', now + 0.14, 0.5);
        this.bgmSynth.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], '8n', now + 0.22, 0.4);
        this.metalSynth.triggerAttackRelease('C6', '32n', now + 0.22, 0.3);
        break;

      // -- 战斗跳过 --
      case 'combat_skip':
        // 跳过回合：轻快掠过
        this.noiseSynth.triggerAttackRelease('16n', now, 0.15);
        this.synth.triggerAttackRelease('E4', '64n', now + 0.02, 0.2);
        this.synth.triggerAttackRelease('G4', '64n', now + 0.04, 0.15);
        break;

      // -- 任务放弃 --
      case 'quest_abandon':
        // 放弃任务：小调下行遗憾感
        this.synth.triggerAttackRelease('E4', '16n', now, 0.35);
        this.synth.triggerAttackRelease('C4', '16n', now + 0.1, 0.35);
        this.synth.triggerAttackRelease('A3', '8n', now + 0.2, 0.3);
        break;

      // -- 确认/取消 --
      case 'confirm':
        // 确认：肯定上行
        this.synth.triggerAttackRelease('C5', '32n', now, 0.45);
        this.synth.triggerAttackRelease('E5', '32n', now + 0.05, 0.4);
        break;

      case 'cancel':
        // 取消：平缓回退
        this.synth.triggerAttackRelease('B4', '32n', now, 0.3);
        this.synth.triggerAttackRelease('F4', '32n', now + 0.05, 0.25);
        break;

      // -- 技能记忆/遗忘 --
      case 'skill_memorize':
        // 记忆技能：魔法符文铭刻
        this.fmSynth.set({ harmonicity: 4, modulationIndex: 10 });
        this.fmSynth.triggerAttackRelease('D4', '16n', now, 0.35);
        this.fmSynth.triggerAttackRelease('A4', '32n', now + 0.08, 0.3);
        this.fmSynth.set({ harmonicity: 6, modulationIndex: 14 });
        this.metalSynth.triggerAttackRelease('D5', '32n', now + 0.10, 0.2);
        break;

      case 'skill_forget':
        // 遗忘技能：符文消散
        this.fmSynth.set({ harmonicity: 4, modulationIndex: 10 });
        this.fmSynth.triggerAttackRelease('A4', '16n', now, 0.3);
        this.fmSynth.triggerAttackRelease('D4', '32n', now + 0.08, 0.25);
        this.fmSynth.set({ harmonicity: 6, modulationIndex: 14 });
        break;

      // -- 存档 --
      case 'data_export':
        // 导出：书写/羊皮纸卷起
        this.synth.triggerAttackRelease('F4', '32n', now, 0.3);
        this.synth.triggerAttackRelease('A4', '32n', now + 0.06, 0.3);
        this.synth.triggerAttackRelease('C5', '16n', now + 0.12, 0.35);
        this.noiseSynth.triggerAttackRelease('16n', now + 0.02, 0.08);
        break;

      case 'data_import':
        // 导入：羊皮纸展开
        this.noiseSynth.triggerAttackRelease('16n', now, 0.08);
        this.synth.triggerAttackRelease('C5', '32n', now + 0.03, 0.3);
        this.synth.triggerAttackRelease('A4', '32n', now + 0.09, 0.3);
        this.synth.triggerAttackRelease('F4', '16n', now + 0.15, 0.35);
        break;

      // -- 系统 --
      case 'exit_menu':
        // 退出到菜单：沉重关门
        this.membrane.triggerAttackRelease('A1', '4n', now, 0.6);
        this.noiseSynth.triggerAttackRelease('16n', now + 0.01, 0.15);
        this.synth.triggerAttackRelease('E3', '8n', now + 0.1, 0.2);
        break;
    }
  }

  /** 播放金币音效 */
  private coin(time: number): void {
    this.metalSynth.triggerAttackRelease('G6', '64n', time, 0.4);
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
    this.bgmSynth.releaseAll();
    this.stopBgmOscillator();
    this.stopFilterLfo();
  }

  /**
   * 播放主菜单 BGM —— 缓慢、空灵的和弦进行（Eb 大调 / C 小调混合）
   * 使用 Pad 音色 + 滤波器呼吸效果
   */
  private playMainMenuBgm(): void {
    this.startBgmOscillator(50);
    this.startFilterLfo(0.3, 400);

    this.bgmSynth.set({
      envelope: { attack: 1.2, decay: 1.0, sustain: 0.5, release: 3 },
      oscillator: { type: 'sine' },
    } as any);

    const progression = [
      ['C3', 'Eb3', 'G3', 'Bb3'],    // Cm7
      ['Ab2', 'C3', 'Eb3', 'Ab3'],   // Ab
      ['F2', 'Ab2', 'C3', 'Eb3'],    // Fm7
      ['G2', 'B2', 'D3', 'F3'],      // G7
    ];

    this.bgmPattern = new Tone.Pattern(
      (time, chord) => {
        this.bgmSynth.triggerAttackRelease(chord, '2n', time, 0.25);
      },
      progression,
      'up'
    ).start(0);

    Tone.getTransport().bpm.value = 48;
    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
    }
  }

  /**
   * 播放探索 BGM —— 悠扬和弦进行 + 旋律漫步
   * D 多利亚调式，舒缓的 pad 铺底配合旋律线条
   */
  private playExplorationBgm(): void {
    this.startBgmOscillator(44);
    this.startFilterLfo(0.15, 600);

    // 统一包络：兼顾 pad 长音和旋律短音
    this.bgmSynth.set({
      envelope: { attack: 0.8, decay: 0.5, sustain: 0.4, release: 2.5 },
      oscillator: { type: 'sine' },
    } as any);

    // D 多利亚调式 和弦进行: Dm7 → F → Cmaj7 → Am7
    const chords = [
      ['D3', 'F3', 'A3', 'C4'],    // Dm7
      ['F2', 'A2', 'C3', 'F3'],    // F
      ['C3', 'E3', 'G3', 'B3'],    // Cmaj7
      ['A2', 'C3', 'E3', 'G3'],    // Am7
    ];

    this.bgmPattern = new Tone.Pattern(
      (time, chord) => {
        this.bgmSynth.triggerAttackRelease(chord, '1m', time, 0.15);
      },
      chords,
      'up'
    ).start(0);

    // 旋律层：D 小调五声音阶
    const melody = ['D4', 'F4', 'G4', 'A4', 'C5', 'A4', 'G4', 'F4',
                    'D4', 'C4', 'D4', 'F4', 'G4', 'A4', 'G4', 'F4'];

    this.bgmLoop = new Tone.Loop((time) => {
      const note = melody[Math.floor(Math.random() * melody.length)];
      this.bgmSynth.triggerAttackRelease(note, '4n', time, 0.06);
    }, '4n').start(0);

    Tone.getTransport().bpm.value = 50;
    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
    }
  }

  /**
   * 播放战斗 BGM —— 紧张低音循环
   */
  private playCombatBgm(): void {
    this.startBgmOscillator(44);
    this.stopFilterLfo();
    this.bgmFilter.frequency.value = 600;

    this.bgmSynth.set({
      envelope: { attack: 0.15, decay: 0.3, sustain: 0.4, release: 0.5 },
      oscillator: { type: 'sawtooth' },
    } as any);

    // 紧张的低音重复段 —— C 弗里吉亚
    const bassLine = ['C2', 'C2', 'Db2', 'C2', 'Eb2', 'Db2', 'C2', 'F2'];

    this.bgmPattern = new Tone.Pattern(
      (time, note) => {
        this.bgmSynth.triggerAttackRelease([note, Tone.Frequency(note).transpose(7).toNote()], '8n', time, 0.2);
      },
      bassLine,
      'up'
    ).start(0);

    Tone.getTransport().bpm.value = 100;
    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
    }
  }

  /**
   * 播放商店 BGM —— 温暖、舒适的和弦进行（C 大调）
   */
  private playShopBgm(): void {
    this.startBgmOscillator(44);
    this.stopFilterLfo();
    this.bgmFilter.frequency.value = 350;

    this.bgmSynth.set({
      envelope: { attack: 0.4, decay: 0.3, sustain: 0.5, release: 2 },
      oscillator: { type: 'triangle' },
    } as any);

    const progression = [
      ['C3', 'E3', 'G3', 'B3'],     // Cmaj7
      ['A2', 'C3', 'E3', 'G3'],     // Am7
      ['D3', 'F3', 'A3', 'C4'],     // Dm7
      ['G2', 'B2', 'D3', 'F3'],     // G7
    ];

    this.bgmPattern = new Tone.Pattern(
      (time, chord) => {
        this.bgmSynth.triggerAttackRelease(chord, '2n', time, 0.18);
      },
      progression,
      'up'
    ).start(0);

    Tone.getTransport().bpm.value = 68;
    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
    }
  }

  /** BGM: 胜利 —— 播放简短胜利旋律后切回探索 */
  private playVictoryBgm(): void {
    this.startBgmOscillator(55);

    const now = Tone.now();
    this.bgmSynth.set({
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.5, release: 1.5 },
      oscillator: { type: 'triangle' },
    } as any);

    // C 大调上行
    this.bgmSynth.triggerAttackRelease(['C3', 'E3', 'G3', 'C4'], '8n', now, 0.4);
    this.bgmSynth.triggerAttackRelease(['F3', 'A3', 'C4', 'F4'], '8n', now + 0.3, 0.35);
    this.bgmSynth.triggerAttackRelease(['G3', 'B3', 'D4', 'G4'], '8n', now + 0.6, 0.35);
    this.bgmSynth.triggerAttackRelease(['C3', 'E3', 'G3', 'C4'], '4n', now + 0.9, 0.4);

    // 3 秒后切回探索
    setTimeout(() => {
      if (this.currentBgmScene === 'victory') {
        this.setBgmScene('exploration');
      }
    }, 3000);
  }

  /** BGM: 失败 —— 播放简短失败旋律后切回探索 */
  private playDefeatBgm(): void {
    this.startBgmOscillator(36);

    const now = Tone.now();
    this.bgmSynth.set({
      envelope: { attack: 0.1, decay: 0.4, sustain: 0.4, release: 1.5 },
      oscillator: { type: 'triangle' },
    } as any);

    // 下行
    this.bgmSynth.triggerAttackRelease(['C3', 'Eb3', 'G3'], '8n', now, 0.4);
    this.bgmSynth.triggerAttackRelease(['Ab3', 'C3', 'Eb3'], '8n', now + 0.35, 0.35);
    this.bgmSynth.triggerAttackRelease(['F3', 'Ab3', 'C3'], '8n', now + 0.7, 0.35);
    this.bgmSynth.triggerAttackRelease(['G3', 'B2', 'D3'], '4n', now + 1.0, 0.4);

    // 3 秒后切回探索
    setTimeout(() => {
      if (this.currentBgmScene === 'defeat') {
        this.setBgmScene('exploration');
      }
    }, 3000);
  }

  /** 启动 BGM 持续氛围振荡器 */
  private startBgmOscillator(freq: number = 55): void {
    if (this.bgmOsc) return;

    const store = useAudioStore();
    if (store.effectiveBgmVolume === 0) return;

    this.bgmOsc = new Tone.Oscillator({
      type: 'sine',
      frequency: freq,
    }).connect(this.bgmOscGain);
    this.bgmOscGain.gain.value = 0.03;
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
      this.playSfx(data.damageType === 'magic' ? 'magic_damage' : 'physical_damage');
    });

    eventBus.on(GameEvents.COMBAT_CAST_HEAL, (data) => {
      this.playSfx(data.healType === 'mana' ? 'mana_restore' : 'health_restore');
    });

    // -- 角色事件 --
    eventBus.on(GameEvents.CHARACTER_HP_CHANGE, (data) => {
      if (data.newHp < data.oldHp) {
        this.playSfx('player_hurt');
      }
    });

    eventBus.on(GameEvents.CHARACTER_LEVEL_UP, () => {
      this.playSfx('level_up');
    });

    eventBus.on(GameEvents.CHARACTER_DEATH, () => {
      this.playSfx('death');
    });

    eventBus.on(GameEvents.CHARACTER_GAIN_GOLD, () => {
      this.playSfx('coin');
    });

    eventBus.on(GameEvents.CHARACTER_RECEIVE_HEAL, () => {
      this.playSfx('heal');
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

    // -- 装备事件 --
    eventBus.on(GameEvents.EQUIPMENT_CHANGE, () => {
      this.playSfx('equip');
    });

    // -- 物品使用事件 --
    eventBus.on(GameEvents.INVENTORY_USE_ITEM, () => {
      this.playSfx('item_use');
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

    // -- 放弃任务事件 --
    eventBus.on(GameEvents.QUEST_ABANDONED, () => {
      this.playSfx('quest_abandon');
    });

    // -- 技能记忆/遗忘事件 --
    eventBus.on(GameEvents.SKILL_MEMORIZED, () => {
      this.playSfx('skill_memorize');
    });

    eventBus.on(GameEvents.SKILL_FORGOTTEN, () => {
      this.playSfx('skill_forget');
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
