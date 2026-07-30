/**
 * @fileoverview SFX 音效合成器
 * @description
 *   负责全部 52 种 SfxType 的音效合成，包含：
 *   - 合成器调度安全保护（scheduleAt）
 *   - 6 种合成器的快捷触发方法（tSynth/tMembrane/tFM/tNoise/tMetal/tOrgan）
 *   - playSfx 巨型 switch 分发（按 SfxType 路由 + 合成）
 *   - 动态效果路由切换（routeSynthTo 委托 effectChains）
 *
 *   拆分自原 service.ts（QA-6），目的：
 *   - 将"音效合成逻辑"从"生命周期协调"中分离
 *   - tOrgan 等触发方法对 BgmSynth 公开，供 BGM 播放复用
 *
 * @module audio/synth/sfxSynth
 */
import * as Tone from 'tone';
import type { AudioNodes } from '../effectChains';
import { routeSynthTo } from '../effectChains';
import { SFX_ROUTE_MAP, type SfxType, type SfxRoute } from '../types';

/**
 * SFX 音效合成器
 *
 * 持有合成器调度状态（synthScheduleTimes），封装全部音效触发逻辑。
 * 由 AudioService 在构造时创建，playSfx 调用前需确保 AudioContext 已就绪。
 *
 * 公开方法：
 * - playSfx(type)：播放指定音效（含路由切换 + 合成触发）
 * - tOrgan(...)：管风琴触发方法（供 BgmSynth 复用）
 * - dispose()：清理调度状态
 */
export class SfxSynth {
  /** 各合成器的最后调度时间（按合成器 key 分别追踪，避免时间冲突） */
  private synthScheduleTimes = new Map<string, number>();

  constructor(private nodes: AudioNodes) {}

  /**
   * 安全调度合成器，确保传入的时间始终 >= 该合成器上次调度时间
   *
   * 避免 Tone.js 内部振荡器时间冲突。
   *
   * @param key - 合成器标识（如 'synth' / 'membrane' / 'fmSynth' 等）
   * @param time - 期望的调度时间
   * @returns 调整后的安全调度时间
   */
  private scheduleAt(key: string, time: number): number {
    const last = this.synthScheduleTimes.get(key) ?? 0;
    if (time <= last) {
      time = last + 0.005;
    }
    this.synthScheduleTimes.set(key, time);
    return time;
  }

  // ============================================================
  // 合成器快捷方法（自动处理时间调度安全）
  // ============================================================

  /** 通用 Synth 触发 */
  tSynth(note: string, dur: string, time: number, vel?: number): void {
    this.nodes.synth.triggerAttackRelease(note, dur, this.scheduleAt('synth', time), vel);
  }

  /** MembraneSynth 触发（打击/命中） */
  tMembrane(note: string, dur: string, time: number, vel?: number): void {
    this.nodes.membrane.triggerAttackRelease(note, dur, this.scheduleAt('membrane', time), vel);
  }

  /** FMSynth 触发（法术/魔法） */
  tFM(note: string, dur: string, time: number, vel?: number): void {
    this.nodes.fmSynth.triggerAttackRelease(note, dur, this.scheduleAt('fmSynth', time), vel);
  }

  /** NoiseSynth 触发（噪声/风声） */
  tNoise(dur: string, time: number, vel?: number): void {
    this.nodes.noiseSynth.triggerAttackRelease(dur, this.scheduleAt('noiseSynth', time), vel);
  }

  /** MetalSynth 触发（金属/硬币） */
  tMetal(note: string, dur: string, time: number, vel?: number): void {
    this.nodes.metalSynth.triggerAttackRelease(note, dur, this.scheduleAt('metalSynth', time), vel);
  }

  /** OrganVoice 触发（管风琴，BGM 与战斗号角共用） */
  tOrgan(note: string | string[], dur: string, time: number, vel?: number): void {
    this.nodes.organVoice.triggerAttackRelease(note, dur, this.scheduleAt('organVoice', time), vel);
  }

  // ============================================================
  // 音效播放
  // ============================================================

  /**
   * 根据音效类型获取对应的效果路由
   *
   * @param type - 音效类型
   * @returns 效果路由（未匹配时回退到 'standard'）
   */
  private getRoute(type: SfxType): SfxRoute {
    return SFX_ROUTE_MAP[type] ?? 'standard';
  }

  /**
   * 播放指定音效
   *
   * 调用前需确保 AudioContext 已就绪（由 AudioService.playSfx 检查）。
   * 流程：路由切换 → 获取当前时间 → 按 SfxType 分发到对应合成逻辑。
   *
   * @param type - 音效类型
   */
  playSfx(type: SfxType): void {
    const route = this.getRoute(type);
    routeSynthTo(this.nodes, route);

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
        this.nodes.fmSynth.set({ harmonicity: 8, modulationIndex: 12 });
        this.tFM('C5', '8n', now, 0.5);
        this.tFM('G5', '16n', now + 0.06, 0.4);
        this.tFM('E6', '16n', now + 0.12, 0.3);
        this.tFM('C7', '32n', now + 0.18, 0.2);
        this.tMetal('C6', '64n', now + 0.15, 0.15);
        this.nodes.fmSynth.set({ harmonicity: 6, modulationIndex: 14 });
        break;

      case 'physical_damage':
        // 物理伤害：沉重打击 + 低频膜鼓 + 噪声纹理
        this.tMembrane('C1', '8n', now, 0.9);
        this.tMembrane('C2', '16n', now + 0.005, 0.6);
        this.tNoise('32n', now + 0.003, 0.35);
        break;

      case 'magic_damage':
        // 魔法伤害：phaser 移相 + 下行音高 sweep + 水晶高频
        this.nodes.fmSynth.set({ harmonicity: 12, modulationIndex: 16 });
        this.tFM('G5', '16n', now, 0.55);
        this.tFM('D6', '32n', now + 0.04, 0.4);
        this.tFM('A6', '64n', now + 0.07, 0.25);
        this.tFM('E7', '128n', now + 0.10, 0.15);
        this.nodes.fmSynth.set({ harmonicity: 6, modulationIndex: 14 });
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
        this.nodes.fmSynth.set({ harmonicity: 5, modulationIndex: 10 });
        this.tFM('D4', '32n', now, 0.4);
        this.tFM('F4', '32n', now + 0.05, 0.35);
        this.tFM('A4', '16n', now + 0.10, 0.3);
        this.nodes.fmSynth.set({ harmonicity: 6, modulationIndex: 14 });
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
        this.nodes.fmSynth.set({ harmonicity: 3, modulationIndex: 8 });
        this.tFM('F4', '32n', now, 0.4);
        this.tFM('A4', '32n', now + 0.06, 0.35);
        this.tFM('C5', '16n', now + 0.12, 0.3);
        this.nodes.fmSynth.set({ harmonicity: 6, modulationIndex: 14 });
        break;

      case 'item_drop':
        // 丢弃物品：落地闷响
        this.tMembrane('C2', '8n', now, 0.55);
        this.tNoise('32n', now + 0.01, 0.15);
        break;

      // ==================== 技能 ====================

      case 'skill_memorize':
        // 记忆技能：魔法符文铭刻 + shimmer
        this.nodes.fmSynth.set({ harmonicity: 4, modulationIndex: 10 });
        this.tFM('D4', '16n', now, 0.4);
        this.tFM('A4', '32n', now + 0.08, 0.35);
        this.nodes.fmSynth.set({ harmonicity: 6, modulationIndex: 14 });
        this.tMetal('D5', '32n', now + 0.10, 0.25);
        this.tSynth('D6', '64n', now + 0.12, 0.15);
        break;

      case 'skill_forget':
        // 遗忘技能：符文消散
        this.nodes.fmSynth.set({ harmonicity: 4, modulationIndex: 10 });
        this.tFM('A4', '16n', now, 0.35);
        this.tFM('D4', '32n', now + 0.08, 0.3);
        this.nodes.fmSynth.set({ harmonicity: 6, modulationIndex: 14 });
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

  /** 播放金币音效（shop_buy / shop_sell 复用） */
  private coin(time: number): void {
    this.tMetal('G6', '64n', time, 0.45);
  }

  /** 清理调度状态 */
  dispose(): void {
    this.synthScheduleTimes.clear();
  }
}
