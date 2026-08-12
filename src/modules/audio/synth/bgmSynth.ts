/**
 * @fileoverview BGM 背景音乐合成器
 * @description
 *   负责全部 6 种 BgmScene 的管风琴音乐合成，包含：
 *   - 场景切换调度（setBgmScene）
 *   - 资源清理（stopBgm）
 *   - 6 个场景实现（主菜单/探索/战斗/商店/胜利/失败）
 *   - 氛围振荡器与滤波器 LFO 管理
 *
 *   拆分自原 service.ts（QA-6），目的：
 *   - 将"BGM 合成逻辑"从"生命周期协调"中分离
 *   - BgmSynth 持有 BGM 相关状态（场景/Pattern/Loop/振荡器/LFO/定时器）
 *
 * @module audio/synth/bgmSynth
 */
import * as Tone from 'tone';
import type { AudioNodes } from '../effectChains';
import type { SfxSynth } from './sfxSynth';
import { useAudioStore } from '../store';
import type { BgmScene } from '../types';
import { BGM_CROSSFADE_SEC } from '@/config/audio';

/**
 * BGM 背景音乐合成器
 *
 * 持有 BGM 播放所需的全部状态（当前场景、Pattern、Loop、振荡器、LFO、定时器），
 * 封装 6 种场景的管风琴合成逻辑。
 *
 * 由 AudioService 在构造时创建，setBgmScene 调用前需确保 AudioContext 已就绪
 *（由 AudioService.setBgmScene 检查）。
 *
 * 公开方法：
 * - setBgmScene(scene)：切换 BGM 场景（不检查就绪状态，由调用方保证）
 * - stopBgm()：停止 BGM 并清理资源
 * - startBgmOscillator(freq?)：启动氛围振荡器（供 applyVolume 调用）
 * - stopBgmOscillator()：停止氛围振荡器（供 applyVolume 调用）
 * - getCurrentScene()：获取当前场景（供 applyVolume 判断）
 * - isBgmOscRunning()：振荡器是否运行（供 applyVolume 判断）
 * - applyBgmVolume(bgmDb)：应用 BGM 通道音量
 * - dispose()：清理全部 BGM 资源
 */
export class BgmSynth {
  /** 当前 BGM 场景 */
  private currentBgmScene: BgmScene | null = null;
  /** BGM 和弦 Pattern */
  private bgmPattern: Tone.Pattern<string> | Tone.Pattern<string[]> | null = null;
  /** BGM 旋律 Loop */
  private bgmLoop: Tone.Loop | null = null;
  /** BGM 持续氛围振荡器 */
  private bgmOsc: Tone.Oscillator | null = null;
  /** BGM 滤波器低频振荡器（呼吸感） */
  private bgmFilterLfo: Tone.LFO | null = null;
  /** BGM 场景延迟切换定时器（胜利/失败后 3 秒切回探索） */
  private bgmTransitionTimer: ReturnType<typeof setTimeout> | null = null;

  /** BGM 交叉淡变定时器（场景切换时先淡出旧 BGM 再启动新 BGM） */
  private bgmFadeTimer: ReturnType<typeof setTimeout> | null = null;

  /** 是否正在淡出（淡出期间 applyBgmVolume 不覆盖 volume ramp） */
  private isFading = false;

  /** 最近一次 applyBgmVolume 写入的 dB 值（淡入恢复用） */
  private lastBgmDb = 0;

  constructor(
    private nodes: AudioNodes,
    private sfxSynth: SfxSynth,
  ) {}

  /**
   * 切换 BGM 场景
   *
   * 调用前需确保 AudioContext 已就绪（由 AudioService.setBgmScene 检查）。
   * 若新场景与当前相同则跳过；若 BGM 音量为 0 则仅记录场景不播放。
   *
   * 若当前有活跃 BGM（Pattern/Loop 在运行），先淡出旧 BGM 再切换，
   * 避免硬切产生的信号中断感。无活跃 BGM 时直接启动。
   *
   * @param scene - 目标 BGM 场景
   */
  setBgmScene(scene: BgmScene): void {
    if (scene === this.currentBgmScene) return;

    const store = useAudioStore();
    if (store.effectiveBgmVolume === 0) {
      this.currentBgmScene = scene;
      return;
    }

    // 取消 pending 的淡变定时器
    if (this.bgmFadeTimer) {
      clearTimeout(this.bgmFadeTimer);
      this.bgmFadeTimer = null;
      this.isFading = false;
      // 旧 BGM 已被淡出至 -80dB，直接停止
      this.stopBgm();
    }

    // 若有活跃 BGM（Pattern/Loop），先淡出再切换
    if (this.bgmPattern || this.bgmLoop) {
      this.currentBgmScene = scene;
      this.isFading = true;
      this.nodes.bgmChannel.volume.rampTo(-80, BGM_CROSSFADE_SEC);

      this.bgmFadeTimer = setTimeout(() => {
        this.bgmFadeTimer = null;
        this.isFading = false;
        this.stopBgm();
        this.startScene(scene);
        // 淡入新 BGM
        this.nodes.bgmChannel.volume.value = -80;
        this.nodes.bgmChannel.volume.rampTo(this.lastBgmDb, BGM_CROSSFADE_SEC);
      }, BGM_CROSSFADE_SEC * 1000);
      return;
    }

    // 无活跃 BGM：直接启动
    this.currentBgmScene = scene;
    this.startScene(scene);
  }

  /** 启动指定场景的 BGM 播放 */
  private startScene(scene: BgmScene): void {
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

  /**
   * 停止 BGM 播放并清理资源
   *
   * 清理顺序：定时器 → Pattern → Loop → OrganVoice → 振荡器 → LFO → Transport
   */
  stopBgm(): void {
    if (this.bgmFadeTimer) {
      clearTimeout(this.bgmFadeTimer);
      this.bgmFadeTimer = null;
    }
    this.isFading = false;
    if (this.bgmTransitionTimer) {
      clearTimeout(this.bgmTransitionTimer);
      this.bgmTransitionTimer = null;
    }
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
    this.nodes.organVoice.releaseAll();
    this.stopBgmOscillator();
    this.stopFilterLfo();
    Tone.getTransport().stop();
  }

  // ============================================================
  // 场景实现
  // ============================================================

  /**
   * 播放主菜单 BGM —— 庄严管风琴圣咏
   * D 多利亚 → C 弗里吉亚交替，平行五度/八度进行，教堂混响
   */
  private playMainMenuBgm(): void {
    this.nodes.organVoice.setPreset('diapason');
    this.nodes.organVoice.setEnvelope({ attack: 1.5, decay: 1.2, sustain: 0.5, release: 3.5 });
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
        this.sfxSynth.tOrgan(chord, '2n', time, 0.1);
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
    this.nodes.organVoice.setPreset('softDiapason');
    this.nodes.organVoice.setEnvelope({ attack: 1.0, decay: 0.6, sustain: 0.4, release: 3 });
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

    // 旋律层：D 多利亚主题 —— 4+4 小节 call-response 结构
    // 上行乐句（call）：D→F→A→C5 级进展开多利亚大六度色彩
    // 下行回应（response）：C5→A→F→D 回归主音，形成拱形起伏
    const melody = [
      'D4', 'F4', 'A4', 'C5',
      'C5', 'A4', 'F4', 'D4',
      'A4', 'C5', 'D5', 'C5',
      'D4', 'A4', 'F4', 'D4',
    ];
    const totalBeats = melody.length;

    this.bgmPattern = new Tone.Pattern(
      (time, chord) => {
        this.sfxSynth.tOrgan(chord, '1m', time, 0.08);
      },
      chords,
      'up'
    ).start(0);

    this.bgmLoop = new Tone.Loop((time) => {
      // 用 Transport 坐标计算旋律索引，确保与和弦 Pattern 对齐
      const ticks = Tone.getTransport().ticks;
      const beat = Math.floor(ticks / (Tone.getTransport().PPQ * 4)) % totalBeats;
      this.sfxSynth.tOrgan(melody[beat], '4n', time, 0.04);
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
    this.nodes.organVoice.setPreset('fullOrgan');
    this.nodes.organVoice.setEnvelope({ attack: 0.1, decay: 0.3, sustain: 0.5, release: 0.6 });
    this.startBgmOscillator(33); // C1 pedal
    this.stopFilterLfo();
    this.nodes.bgmFilter.frequency.value = 800;

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
        this.sfxSynth.tOrgan(chord, '8n', time, 0.18);
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
   * F 利底亚，中世纪三和弦/空五度进行（利底亚增四度 B 制造梦幻感）
   */
  private playShopBgm(): void {
    this.nodes.organVoice.setPreset('flute');
    this.nodes.organVoice.setEnvelope({ attack: 0.5, decay: 0.4, sustain: 0.5, release: 2.5 });
    this.startBgmOscillator(44);
    this.stopFilterLfo();
    this.nodes.bgmFilter.frequency.value = 400;

    // F 利底亚 —— 中世纪三和弦进行（空五度 + 利底亚增四度 B）
    const progression = [
      ['F3', 'C4', 'F4'],              // F5（空五度）
      ['C3', 'G3', 'C4'],              // C5
      ['G3', 'D4', 'G4', 'B4'],        // G（含利底亚增四度 B）
      ['F3', 'C4', 'F4', 'A4'],        // F（加入三音）
      ['Bb2', 'F3', 'Bb3', 'D4'],      // Bb
      ['C3', 'G3', 'C4', 'E4'],        // C（加入三音）
      ['D3', 'A3', 'D4', 'B4'],        // Dm（含利底亚增四度 B）
      ['F3', 'C4', 'F4'],              // F5（回归主音）
    ];

    this.bgmPattern = new Tone.Pattern(
      (time, chord) => {
        this.sfxSynth.tOrgan(chord, '2n', time, 0.15);
      },
      progression,
      'up'
    ).start(0);

    Tone.getTransport().bpm.value = 65;
    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
    }
  }

  /** BGM: 胜利 —— 管风琴凯旋旋律，音栓逐层叠加后切回探索 */
  private playVictoryBgm(): void {
    this.nodes.organVoice.setEnvelope({ attack: 0.1, decay: 0.3, sustain: 0.6, release: 2 });
    this.startBgmOscillator(37);

    const now = Tone.now();

    // D 多利亚 → D 大调（皮卡第三度）凯旋
    // 前 4 和弦：flute 预设，柔和铺垫（Dm→G→Am→Dm）
    this.nodes.organVoice.setPreset('flute');
    this.sfxSynth.tOrgan(['D3', 'A3', 'D4', 'F4'], '8n', now, 0.18);
    this.sfxSynth.tOrgan(['G3', 'D4', 'G4', 'B4'], '8n', now + 0.35, 0.18);
    this.sfxSynth.tOrgan(['A3', 'E4', 'A4', 'C5'], '8n', now + 0.70, 0.20);
    this.sfxSynth.tOrgan(['D3', 'A3', 'D4', 'F4'], '8n', now + 1.05, 0.20);

    // 后 4 和弦：diapason 预设，力度渐强（G→A→D→D picardy）
    this.nodes.organVoice.setPreset('diapason');
    this.sfxSynth.tOrgan(['G3', 'D4', 'G4', 'B4'], '8n', now + 1.40, 0.22);
    this.sfxSynth.tOrgan(['A3', 'E4', 'A4', 'C5'], '8n', now + 1.75, 0.25);

    // 高潮：fullOrgan 全音栓 + 皮卡迪三度（F→F#）
    this.nodes.organVoice.setPreset('fullOrgan');
    this.sfxSynth.tOrgan(['D3', 'A3', 'D4', 'F#4'], '4n', now + 2.10, 0.30);
    this.sfxSynth.tOrgan(['D3', 'A3', 'D4', 'F#4'], '2n', now + 2.80, 0.32);

    // 5 秒后切回探索
    this.bgmTransitionTimer = setTimeout(() => {
      this.bgmTransitionTimer = null;
      if (this.currentBgmScene === 'victory') {
        this.setBgmScene('exploration');
      }
    }, 5000);
  }

  /** BGM: 失败 —— 管风琴下行葬礼进行曲后切回探索 */
  private playDefeatBgm(): void {
    this.nodes.organVoice.setEnvelope({ attack: 0.1, decay: 0.5, sustain: 0.4, release: 2 });
    this.startBgmOscillator(33);

    const now = Tone.now();

    // C 弗里吉亚下行 —— 8 和弦葬礼进行曲
    // 前 4 和弦：diapason 预设，沉重下行（Cm→Ab→Fm→G）
    this.nodes.organVoice.setPreset('diapason');
    this.sfxSynth.tOrgan(['C3', 'G3', 'C4', 'Eb4'], '8n', now, 0.20);
    this.sfxSynth.tOrgan(['Ab2', 'Eb3', 'Ab3', 'C4'], '8n', now + 0.40, 0.20);
    this.sfxSynth.tOrgan(['F2', 'C3', 'F3', 'Ab3'], '8n', now + 0.80, 0.22);
    this.sfxSynth.tOrgan(['G2', 'D3', 'G3', 'B3'], '8n', now + 1.20, 0.22);

    // 后 4 和弦：渐弱收束（Cm→Ab→G→Cm 终止）
    this.sfxSynth.tOrgan(['C3', 'G3', 'C4', 'Eb4'], '8n', now + 1.60, 0.22);
    this.sfxSynth.tOrgan(['Ab2', 'Eb3', 'Ab3', 'C4'], '4n', now + 2.00, 0.20);
    this.sfxSynth.tOrgan(['G2', 'D3', 'G3', 'B3'], '4n', now + 2.70, 0.18);
    this.sfxSynth.tOrgan(['C3', 'G3', 'C4', 'Eb4'], '2n', now + 3.40, 0.15);

    // 5 秒后切回探索
    this.bgmTransitionTimer = setTimeout(() => {
      this.bgmTransitionTimer = null;
      if (this.currentBgmScene === 'defeat') {
        this.setBgmScene('exploration');
      }
    }, 5000);
  }

  // ============================================================
  // 氛围振荡器与滤波器 LFO
  // ============================================================

  /**
   * 启动 BGM 持续氛围振荡器
   *
   * 若已启动或 BGM 音量为 0 则跳过。
   *
   * @param freq - 振荡器频率（默认 37，对应 D2 pedal note）
   */
  startBgmOscillator(freq: number = 37): void {
    if (this.bgmOsc) return;

    const store = useAudioStore();
    if (store.effectiveBgmVolume === 0) return;

    this.bgmOsc = new Tone.Oscillator({
      type: 'sine',
      frequency: freq,
    }).connect(this.nodes.bgmOscGain);
    this.nodes.bgmOscGain.gain.value = 0.025;
    this.bgmOsc.start();
  }

  /** 停止 BGM 持续氛围振荡器 */
  stopBgmOscillator(): void {
    if (this.bgmOsc) {
      this.bgmOsc.stop();
      this.bgmOsc.dispose();
      this.bgmOsc = null;
    }
  }

  /**
   * 启动滤波器低频振荡器 —— 制造"呼吸"效果
   *
   * @param rate - LFO 频率
   * @param baseFreq - 基准滤波频率（LFO 在 0.5×baseFreq ~ baseFreq 之间振荡）
   */
  private startFilterLfo(rate: number, baseFreq: number): void {
    if (this.bgmFilterLfo) return;

    this.bgmFilterLfo = new Tone.LFO({
      type: 'sine',
      min: baseFreq * 0.5,
      max: baseFreq,
      frequency: rate,
    }).connect(this.nodes.bgmFilter.frequency);
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

  // ============================================================
  // 状态查询与音量控制（供 AudioService.applyVolume 调用）
  // ============================================================

  /** 获取当前 BGM 场景 */
  getCurrentScene(): BgmScene | null {
    return this.currentBgmScene;
  }

  /** 氛围振荡器是否正在运行 */
  isBgmOscRunning(): boolean {
    return this.bgmOsc !== null;
  }

  /**
   * 应用 BGM 通道音量
   *
   * 由 AudioService.applyVolume 调用，将 dB 值写入 bgmChannel 节点。
   * 淡出期间（isFading）跳过写入，避免覆盖 volume ramp。
   *
   * @param bgmDb - BGM 通道音量（dB）
   */
  applyBgmVolume(bgmDb: number): void {
    this.lastBgmDb = bgmDb;
    if (!this.isFading) {
      this.nodes.bgmChannel.volume.value = bgmDb;
    }
  }

  /** 重置当前场景（供 AudioService.destroy 调用） */
  resetScene(): void {
    this.currentBgmScene = null;
  }

  /**
   * 清理全部 BGM 资源
   *
   * 停止 BGM、清理定时器、销毁振荡器与 LFO。
   * 由 AudioService.destroy 调用。
   */
  dispose(): void {
    this.stopBgm();
    if (this.bgmTransitionTimer) {
      clearTimeout(this.bgmTransitionTimer);
      this.bgmTransitionTimer = null;
    }
    // stopBgm() 已清理 bgmFadeTimer 和 isFading
    this.bgmOsc = null;
    this.bgmFilterLfo = null;
    this.currentBgmScene = null;
  }
}
