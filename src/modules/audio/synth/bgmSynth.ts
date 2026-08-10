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
import { defaultRng } from '@/utils/rng';
import type { BgmScene } from '../types';

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
   * @param scene - 目标 BGM 场景
   */
  setBgmScene(scene: BgmScene): void {
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

  /**
   * 停止 BGM 播放并清理资源
   *
   * 清理顺序：定时器 → Pattern → Loop → OrganVoice → 振荡器 → LFO → Transport
   */
  stopBgm(): void {
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

    this.bgmPattern = new Tone.Pattern(
      (time, chord) => {
        this.sfxSynth.tOrgan(chord, '1m', time, 0.08);
      },
      chords,
      'up'
    ).start(0);

    // 旋律层：D 小调五声音阶 —— 随机漫步
    const melody = ['D4', 'F4', 'G4', 'A4', 'C5', 'A4', 'G4', 'F4',
                    'D4', 'C4', 'D4', 'F4', 'G4', 'A4', 'G4', 'F4'];

    this.bgmLoop = new Tone.Loop((time) => {
      const note = defaultRng.pick(melody);
      this.sfxSynth.tOrgan(note, '4n', time, 0.03);
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
   * F 利底亚，爵士七和弦进行
   */
  private playShopBgm(): void {
    this.nodes.organVoice.setPreset('flute');
    this.nodes.organVoice.setEnvelope({ attack: 0.5, decay: 0.4, sustain: 0.5, release: 2.5 });
    this.startBgmOscillator(44);
    this.stopFilterLfo();
    this.nodes.bgmFilter.frequency.value = 400;

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

  /** BGM: 胜利 —— 简短管风琴胜利旋律后切回探索 */
  private playVictoryBgm(): void {
    this.nodes.organVoice.setPreset('fullOrgan');
    this.nodes.organVoice.setEnvelope({ attack: 0.1, decay: 0.3, sustain: 0.6, release: 2 });
    this.startBgmOscillator(37);

    const now = Tone.now();

    // D 多利亚 → D 大调（皮卡第三度）凯旋
    this.sfxSynth.tOrgan(['D3', 'A3', 'D4', 'F4'], '8n', now, 0.28);
    this.sfxSynth.tOrgan(['G3', 'B3', 'D4', 'G4'], '8n', now + 0.3, 0.25);
    this.sfxSynth.tOrgan(['A3', 'C4', 'E4', 'A4'], '8n', now + 0.6, 0.25);
    this.sfxSynth.tOrgan(['D3', 'A3', 'D4', 'F#4'], '4n', now + 0.9, 0.3);

    // 3 秒后切回探索
    this.bgmTransitionTimer = setTimeout(() => {
      this.bgmTransitionTimer = null;
      if (this.currentBgmScene === 'victory') {
        this.setBgmScene('exploration');
      }
    }, 3000);
  }

  /** BGM: 失败 —— 简短管风琴下行旋律后切回探索 */
  private playDefeatBgm(): void {
    this.nodes.organVoice.setPreset('diapason');
    this.nodes.organVoice.setEnvelope({ attack: 0.1, decay: 0.5, sustain: 0.4, release: 2 });
    this.startBgmOscillator(33);

    const now = Tone.now();

    // C 弗里吉亚下行
    this.sfxSynth.tOrgan(['C3', 'G3', 'C4', 'Eb4'], '8n', now, 0.28);
    this.sfxSynth.tOrgan(['Ab3', 'Eb4', 'Ab4', 'C5'], '8n', now + 0.35, 0.25);
    this.sfxSynth.tOrgan(['F3', 'C4', 'F4', 'Ab4'], '8n', now + 0.7, 0.25);
    this.sfxSynth.tOrgan(['G3', 'D4', 'G4', 'B4'], '4n', now + 1.0, 0.28);

    // 3 秒后切回探索
    this.bgmTransitionTimer = setTimeout(() => {
      this.bgmTransitionTimer = null;
      if (this.currentBgmScene === 'defeat') {
        this.setBgmScene('exploration');
      }
    }, 3000);
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
   *
   * @param bgmDb - BGM 通道音量（dB）
   */
  applyBgmVolume(bgmDb: number): void {
    this.nodes.bgmChannel.volume.value = bgmDb;
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
    // P9-093 修复：stopBgm() 已调用 stopBgmOscillator() 和 stopFilterLfo() 释放 bgmOsc/bgmFilterLfo，
    // 此处仅清理残余引用，不再重复 dispose
    this.bgmOsc = null;
    this.bgmFilterLfo = null;
    this.currentBgmScene = null;
  }
}
