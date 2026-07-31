/**
 * @fileoverview 音频服务核心
 * @description 基于 Tone.js 的音频合成服务，负责所有音效和背景音乐的生成与播放。
 * 所有音效通过代码合成，无需外部音频文件，完全离线可用。
 *
 * 架构（QA-6 拆分后）：
 * - service.ts：生命周期协调、事件绑定、公共 API（本文件）
 * - effectChains.ts：Tone.js 节点工厂、效果链连接、动态路由
 * - synth/sfxSynth.ts：52 种 SfxType 的音效合成
 * - synth/bgmSynth.ts：6 种 BgmScene 的管风琴背景音乐合成
 *
 * 优化升级：
 * - BGM 使用管风琴加法合成，产生史诗感
 * - 中古调式体系（多利亚、弗里吉亚、利底亚）
 * - 教堂混响、Shimmer、Chorus、Phaser 等奇幻效果器
 * - 动态效果路由，不同音效走不同效果链
 */

import * as Tone from 'tone';
import { eventBus, GameEvents } from '@/modules/bus';
import type { EventCallback, GameEventPayloadMap } from '@/modules/bus';
import { useAudioStore } from './store';
import type { IAudioService, SfxType, BgmScene, AudioSettings } from './types';
import { useToast } from '../../composables/useToast';
import {
  createAudioNodes,
  connectEffectChains,
  disposeAudioNodes,
  type AudioNodes,
} from './effectChains';
import { SfxSynth } from './synth/sfxSynth';
import { BgmSynth } from './synth/bgmSynth';

/**
 * 音频服务实现类
 *
 * 仅持有生命周期与协调状态，节点构造与合成逻辑委托给子模块。
 * 节点实例由 createAudioNodes() 创建，并共享给 SfxSynth / BgmSynth。
 */
class AudioService implements IAudioService {
  // ==================== 节点与合成器 ====================
  /**
   * 音频节点集合
   *
   * 在 init() 首次调用时通过 createAudioNodes() 创建；
   * destroy() 时通过 disposeAudioNodes() 释放并置 null，允许后续重新 init 重建。
   */
  private nodes: AudioNodes | null = null;

  /** SFX 合成器（playSfx 委托对象） */
  private sfxSynth: SfxSynth | null = null;

  /** BGM 合成器（setBgmScene/stopBgm 委托对象） */
  private bgmSynth: BgmSynth | null = null;

  // ==================== 状态 ====================
  /** 是否已执行 init()（生命周期标志，非 AudioContext 状态） */
  private initialized = false;

  /** AudioContext 是否已通过 Tone.start() 启动 */
  private contextReady = false;

  /** 四个 Reverb 节点的脉冲响应是否已生成 */
  private reverbReady = false;

  /**
   * AudioContext 启动失败时是否已通过 toast 通知过用户
   *
   * tryResume 在每次 playSfx/setBgmScene 调用时都可能触发，
   * 若 Tone.start() 持续失败（如浏览器策略限制），
   * 仅首次失败时通过 toast 提示用户，避免反复打扰。
   * 成功后重置该标志，下次失败可再次提示。
   */
  private resumeFailedNotified = false;

  /** Store 订阅取消函数 */
  private unsubscribeStore: (() => void) | null = null;

  /** 事件总线监听器记录（用于销毁时取消订阅） */
  private eventHandlers: { event: string; handler: EventCallback }[] = [];

  constructor() {
    // 构造函数中不启动音频上下文，等待用户交互
    // 节点延迟到 init() 创建，避免在未启动 AudioContext 时构造 Reverb 等节点
  }

  /**
   * 初始化音频服务
   *
   * 流程：创建节点 → 同步音量 → 订阅 store → 绑定事件 → 监听首次交互。
   * 重复调用会直接返回（幂等）。
   *
   * P3-116 修复：音频设置由 GameStore.initialize 统一加载（在 App.vue 中先于本服务调用），
   * 本服务无需再调用 store.loadFromDb()。
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // 创建节点与合成器
    this.nodes = createAudioNodes();
    this.sfxSynth = new SfxSynth(this.nodes);
    this.bgmSynth = new BgmSynth(this.nodes, this.sfxSynth);

    // 订阅 store 状态变化以同步音量
    const store = useAudioStore();

    // 同步音量
    this.applyVolume();

    // 监听内部状态变化，同步音量
    this.unsubscribeStore = store.$subscribe(() => {
      this.applyVolume();
    });

    // 绑定游戏事件
    this.bindEvents();

    // 监听首次用户交互以启动 AudioContext
    this.listenForFirstInteraction();

    this.initialized = true;
    if (import.meta.env.DEV) {
      console.log('[AudioService] 音频服务已就绪，等待用户交互启动 AudioContext');
    }
  }

  /** 监听首次用户交互事件 */
  private listenForFirstInteraction(): void {
    const resume = async () => {
      if (this.contextReady) return;

      try {
        await Tone.start();
        this.contextReady = true;

        // 生成混响脉冲响应并建立效果链（需要在 AudioContext 运行后）
        await this.ensureReverbReady();

        if (import.meta.env.DEV) {
          console.log('[AudioService] AudioContext 已启动，效果链已连接');
        }
      } catch (e) {
        console.warn('[AudioService] AudioContext 启动失败:', e);
      }
    };

    // 架构边界说明：service 层原则上不操作 DOM，但 Tone.js 要求 AudioContext.resume()
    // 必须在用户手势回调中调用（浏览器 Autoplay Policy），此处注册一次性交互监听
    // 是音频服务的必要边界例外。监听器使用 { once: true } 自动注销，无泄漏风险。
    const events = ['click', 'touchstart', 'keydown'] as const;
    for (const event of events) {
      document.addEventListener(event, resume, { once: true });
    }
  }

  /** 尝试恢复 AudioContext（首次失败时通过 toast 提示用户） */
  private async tryResume(): Promise<void> {
    if (this.contextReady) return;

    try {
      await Tone.start();
      this.contextReady = true;
      // 重置通知标志：成功后下次失败可再次提示用户
      this.resumeFailedNotified = false;
      await this.ensureReverbReady();
    } catch (e) {
      console.warn('[AudioService] AudioContext 启动失败（可能需用户先与页面交互）:', e);
      // 首次失败时通过 toast 提示用户交互后才能播放音效，避免反复打扰
      if (!this.resumeFailedNotified) {
        this.resumeFailedNotified = true;
        try {
          useToast().show({
            message: '音效未能启动，请点击页面以启用音频',
            type: 'warning',
            duration: 3000,
          });
        } catch (toastErr) {
          // useToast 调用失败时不影响音频服务主流程
          console.warn('[AudioService] Toast 提示失败:', toastErr);
        }
      }
    }
  }

  /** 生成混响脉冲响应并建立效果链（需在 AudioContext 运行后调用） */
  private async ensureReverbReady(): Promise<void> {
    if (this.reverbReady || !this.nodes) return;
    await Promise.all([
      this.nodes.sfxReverb.generate(),
      this.nodes.cathedralReverb.generate(),
      this.nodes.combatReverb.generate(),
      this.nodes.bgmReverb.generate(),
    ]);
    this.reverbReady = true;
    connectEffectChains(this.nodes);
  }

  /** 检查音频服务是否已初始化并可用 */
  isReady(): boolean {
    return (
      this.initialized &&
      this.contextReady &&
      this.reverbReady &&
      Tone.getContext().state === 'running'
    );
  }

  // ==================== 音量控制 ====================

  /** 应用音量设置到各通道 */
  private applyVolume(): void {
    if (!this.nodes || !this.bgmSynth) return;
    const store = useAudioStore();

    // 主音量：masterVolume 映射到 -30..0 dB
    const masterDb = this.dbFromLinear(store.settings.masterVolume);
    this.nodes.masterVolume.volume.value = masterDb;

    // BGM 通道额外衰减（委托 BgmSynth）
    const bgmDb = this.dbFromLinear(store.settings.bgmVolume);
    this.bgmSynth.applyBgmVolume(bgmDb);

    // SFX 各通道
    const sfxDb = this.dbFromLinear(store.settings.sfxVolume);
    this.nodes.magicChannel.volume.value = sfxDb;
    this.nodes.combatChannel.volume.value = sfxDb;
    this.nodes.uiChannel.volume.value = sfxDb;
    this.nodes.explorationChannel.volume.value = sfxDb;
    this.nodes.characterChannel.volume.value = sfxDb;
    this.nodes.standardChannel.volume.value = sfxDb;

    // BGM 静音时停止振荡器；非静音且已有场景时启动振荡器
    if (store.effectiveBgmVolume === 0) {
      this.bgmSynth.stopBgmOscillator();
    } else if (this.bgmSynth.getCurrentScene() && !this.bgmSynth.isBgmOscRunning()) {
      this.bgmSynth.startBgmOscillator();
    }
  }

  /** 线性值（0-1）转 dB */
  private dbFromLinear(value: number): number {
    if (value <= 0) return -Infinity;
    return 20 * Math.log10(value);
  }

  // ==================== 公共 API ====================

  /** 播放指定音效（未就绪时调用 tryResume 尝试启动 AudioContext） */
  playSfx(type: SfxType): void {
    if (!this.isReady()) {
      this.tryResume();
      return;
    }
    this.sfxSynth?.playSfx(type);
  }

  /** 切换 BGM 场景（未就绪时调用 tryResume 尝试启动 AudioContext） */
  setBgmScene(scene: BgmScene): void {
    if (!this.isReady()) {
      this.tryResume();
      return;
    }
    this.bgmSynth?.setBgmScene(scene);
  }

  /** 停止 BGM 播放并清理资源 */
  stopBgm(): void {
    this.bgmSynth?.stopBgm();
  }

  /** 从 store 获取当前设置快照 */
  getSettings(): AudioSettings {
    return { ...useAudioStore().settings };
  }

  /**
   * 更新设置（自动持久化由 store 负责）
   *
   * P3-116 修复：store.updateSettings 已改为 async（委托 GameStore 持久化）。
   * 本方法保持 void 返回值以兼容 IAudioService 接口，内部以 fire-and-forget
   * 方式调用，持久化失败由 GameStore 内部 errorReporter 兜底。
   */
  updateSettings(settings: Partial<AudioSettings>): void {
    useAudioStore().updateSettings(settings).catch(err => {
      console.error('[AudioService] updateSettings 持久化失败:', err);
    });
  }

  // ==================== 事件绑定 ====================

  /** 绑定游戏事件到音效与 BGM 切换 */
  private bindEvents(): void {
    // 辅助方法：注册事件并记录，以便销毁时取消订阅
    const onEvent = <K extends keyof GameEventPayloadMap>(
      event: K,
      handler: (data: GameEventPayloadMap[K]) => void,
    ) => {
      eventBus.on(event, handler);
      this.eventHandlers.push({ event, handler: handler as EventCallback });
    };

    // -- 战斗事件 --
    onEvent(GameEvents.COMBAT_START, () => {
      this.playSfx('combat_start');
      this.setBgmScene('combat');
    });

    onEvent(GameEvents.COMBAT_END, (data) => {
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

    onEvent(GameEvents.COMBAT_DEAL_DAMAGE, (data) => {
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

    onEvent(GameEvents.COMBAT_CAST_HEAL, (data) => {
      this.playSfx(data.healType === 'mana' ? 'mana_restore' : 'health_restore');
    });

    onEvent(GameEvents.COMBAT_CRITICAL_HIT, () => {
      this.playSfx('attack_crit');
    });

    onEvent(GameEvents.COMBAT_DODGE, () => {
      this.playSfx('attack_miss');
    });

    // -- 角色事件 --
    onEvent(GameEvents.CHARACTER_LEVEL_UP, () => {
      this.playSfx('level_up');
    });

    onEvent(GameEvents.CHARACTER_DEATH, () => {
      this.playSfx('death');
    });

    onEvent(GameEvents.CHARACTER_RESURRECTED, () => {
      this.playSfx('resurrect');
    });

    // -- 探索事件 --
    onEvent(GameEvents.EXPLORATION_CELL_EXPLORED, () => {
      this.playSfx('step');
    });

    onEvent(GameEvents.EXPLORATION_ITEM_FOUND, () => {
      this.playSfx('item_pickup');
    });

    onEvent(GameEvents.EXPLORATION_TRAP_TRIGGERED, () => {
      this.playSfx('trap_trigger');
    });

    onEvent(GameEvents.EXPLORATION_BATTLE_TRIGGERED, () => {
      this.setBgmScene('combat');
    });

    onEvent(GameEvents.ZONE_ENTERED, () => {
      this.playSfx('door_open');
    });

    onEvent(GameEvents.EXPLORATION_CAMP_USED, () => {
      this.playSfx('camp_rest');
    });

    onEvent(GameEvents.EXPLORATION_RANDOM_EVENT, () => {
      this.playSfx('random_event');
    });

    // -- 商店事件 --
    onEvent(GameEvents.SHOP_OPENED, () => {
      this.playSfx('shop_open');
      this.setBgmScene('shop');
    });

    onEvent(GameEvents.SHOP_TRANSACTION, () => {
      this.playSfx('shop_buy');
    });

    onEvent(GameEvents.SHOP_CLOSED, () => {
      this.setBgmScene('exploration');
    });

    // -- 任务事件 --
    onEvent(GameEvents.QUEST_ACCEPTED, () => {
      this.playSfx('quest_accept');
    });

    onEvent(GameEvents.QUEST_COMPLETED, () => {
      this.playSfx('quest_complete');
    });

    onEvent(GameEvents.QUEST_REWARDED, () => {
      this.playSfx('quest_reward');
    });

    // -- 技能事件 --
    onEvent(GameEvents.SKILL_CAST, () => {
      this.playSfx('spell_cast');
    });

    onEvent(GameEvents.SKILL_LEARNED, () => {
      this.playSfx('level_up');
    });

    // -- 探索开始/结束时控制 BGM --
    onEvent(GameEvents.EXPLORATION_START, () => {
      this.setBgmScene('exploration');
    });

    onEvent(GameEvents.EXPLORATION_END, () => {
      this.stopBgm();
    });

    // -- UI 面板事件 --
    onEvent(GameEvents.UI_PANEL_OPENED, () => {
      this.playSfx('ui_open');
    });

    onEvent(GameEvents.UI_PANEL_CLOSED, () => {
      this.playSfx('ui_close');
    });

    onEvent(GameEvents.UI_CLICK, () => {
      this.playSfx('ui_click');
    });

    // -- 确认/取消事件 --
    onEvent(GameEvents.CONFIRM_CONFIRMED, () => {
      this.playSfx('confirm');
    });

    onEvent(GameEvents.CONFIRM_CANCELED, () => {
      this.playSfx('cancel');
    });

    // -- 物品丢弃事件 --
    onEvent(GameEvents.ITEM_DROPPED, () => {
      this.playSfx('item_drop');
    });

    // -- 角色创建事件 --
    onEvent(GameEvents.CHARACTER_CREATED, () => {
      this.playSfx('character_create');
    });

    // -- 跳过回合事件 --
    onEvent(GameEvents.COMBAT_SKIP_TURN, () => {
      this.playSfx('combat_skip');
    });

    // -- 存档事件 --
    onEvent(GameEvents.DATA_EXPORTED, () => {
      this.playSfx('data_export');
    });

    onEvent(GameEvents.DATA_IMPORTED, () => {
      this.playSfx('data_import');
    });

    // -- 退出事件 --
    onEvent(GameEvents.CHARACTER_LOGOUT, () => {
      this.playSfx('exit_menu');
      this.setBgmScene('main_menu');
    });
  }

  // ==================== 销毁 ====================

  /** 销毁音频服务，清理所有资源和事件订阅 */
  destroy(): void {
    // 1. 停止 BGM 并清理 BGM 资源（Pattern/Loop/振荡器/LFO/定时器）
    this.bgmSynth?.dispose();

    // 2. 取消 Store 订阅
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;

    // 3. 取消所有事件总线监听
    for (const { event, handler } of this.eventHandlers) {
      eventBus.off(event as keyof GameEventPayloadMap, handler as (data: unknown) => void);
    }
    this.eventHandlers = [];

    // 4. 释放 SFX 调度状态
    this.sfxSynth?.dispose();

    // 5. dispose 所有 Tone.js 节点（HMR/重复 init 时避免泄漏）
    if (this.nodes) {
      disposeAudioNodes(this.nodes);
      this.nodes = null;
    }

    this.sfxSynth = null;
    this.bgmSynth = null;

    // 6. 重置初始化标志，允许 destroy 后重新 init 重建节点
    // （否则 init() 会因 initialized === true 直接 return，
    //  后续 playSfx 调用已 dispose 节点会抛异常）
    this.initialized = false;
    this.contextReady = false;
    this.reverbReady = false;
    this.resumeFailedNotified = false;
  }
}

/** 音频服务单例 */
export const audioService = new AudioService();
