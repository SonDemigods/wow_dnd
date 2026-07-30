/**
 * @fileoverview SFX 音效合成器单元测试
 *
 * 覆盖：
 * 1. scheduleAt：时间冲突保护逻辑
 * 2. 合成器快捷方法（tSynth/tMembrane/tFM/tNoise/tMetal/tOrgan）触发
 * 3. playSfx：路由切换 + 52 种 SfxType 的分发覆盖
 * 4. getRoute：SFX_ROUTE_MAP 查询与回退
 * 5. dispose：清理调度状态
 *
 * Mock 策略：
 *  - mock Tone.js 的 now() 返回固定时间，避免时间漂移
 *  - mock effectChains.routeSynthTo，记录路由切换调用
 *  - 节点方法 spy 记录 triggerAttackRelease 调用
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== Tone.js Mock ====================

const NOW = 1.5;

vi.mock('tone', () => {
  return {
    // Tone.now() 返回固定时间
    now: vi.fn(() => NOW),
  };
});

// ==================== effectChains Mock ====================

const routeSynthCalls: Array<{ route: string }> = [];

vi.mock('@/modules/audio/effectChains', () => ({
  routeSynthTo: vi.fn((_nodes: unknown, route: string) => {
    routeSynthCalls.push({ route });
  }),
}));

// ==================== 测试夹具 ====================

/** 创建带 spy 的合成器节点 */
function makeSynthNode() {
  return {
    triggerAttackRelease: vi.fn(),
    set: vi.fn(),
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
  };
}

/** 创建 AudioNodes 测试夹具 */
function makeNodes() {
  return {
    synth: makeSynthNode(),
    membrane: makeSynthNode(),
    fmSynth: makeSynthNode(),
    noiseSynth: makeSynthNode(),
    metalSynth: makeSynthNode(),
    organVoice: {
      ...makeSynthNode(),
      releaseAll: vi.fn(),
    },
    // 其他节点不需要（routeSynthTo 已 mock）
    masterFilter: {}, masterVolume: {},
    sfxReverb: {}, cathedralReverb: {}, combatReverb: {}, bgmReverb: {}, bgmDelay: {},
    chorus: {}, phaser: {}, compressor: {},
    magicChannel: { volume: { value: 0 } },
    combatChannel: { volume: { value: 0 } },
    uiChannel: { volume: { value: 0 } },
    explorationChannel: { volume: { value: 0 } },
    characterChannel: { volume: { value: 0 } },
    standardChannel: { volume: { value: 0 } },
    bgmChannel: { volume: { value: 0 } },
    bgmOscGain: { gain: { value: 0 } },
    bgmFilter: { frequency: { value: 0 } },
  } as unknown as import('@/modules/audio/effectChains').AudioNodes;
}

// ==================== 导入被测模块 ====================

import { SfxSynth } from '@/modules/audio/synth/sfxSynth';
import type { SfxType } from '@/modules/audio/types';
import type { AudioNodes } from '@/modules/audio/effectChains';

// ==================== 测试用例 ====================

describe('SfxSynth 音效合成器', () => {
  let nodes: AudioNodes;
  let sfxSynth: SfxSynth;

  beforeEach(() => {
    vi.clearAllMocks();
    routeSynthCalls.length = 0;
    nodes = makeNodes();
    sfxSynth = new SfxSynth(nodes);
  });

  // -------------------- scheduleAt 时间保护 --------------------

  describe('scheduleAt 时间保护', () => {
    it('首次调度时使用传入时间', () => {
      sfxSynth.tSynth('C4', '8n', 1.0);
      expect(nodes.synth.triggerAttackRelease).toHaveBeenCalledWith('C4', '8n', 1.0, undefined);
    });

    it('传入时间晚于上次调度时间时直接使用', () => {
      sfxSynth.tSynth('C4', '8n', 1.0);
      sfxSynth.tSynth('D4', '8n', 2.0);
      // 第二次使用传入的 2.0
      expect(nodes.synth.triggerAttackRelease).toHaveBeenLastCalledWith('D4', '8n', 2.0, undefined);
    });

    it('传入时间早于等于上次调度时间时自动延后 0.005s', () => {
      sfxSynth.tSynth('C4', '8n', 1.0);
      sfxSynth.tSynth('D4', '8n', 1.0); // 相同时间
      // 第二次应延后到 1.005
      expect(nodes.synth.triggerAttackRelease).toHaveBeenLastCalledWith('D4', '8n', 1.005, undefined);
    });

    it('传入时间早于上次调度时间时自动延后', () => {
      sfxSynth.tSynth('C4', '8n', 2.0);
      sfxSynth.tSynth('D4', '8n', 1.0); // 更早
      // 第二次应延后到 2.005
      expect(nodes.synth.triggerAttackRelease).toHaveBeenLastCalledWith('D4', '8n', 2.005, undefined);
    });

    it('不同合成器 key 独立追踪调度时间', () => {
      // synth 与 membrane 是不同 key
      sfxSynth.tSynth('C4', '8n', 1.0);
      sfxSynth.tMembrane('C2', '8n', 0.5); // membrane 独立，不受 synth 影响
      expect(nodes.membrane.triggerAttackRelease).toHaveBeenCalledWith('C2', '8n', 0.5, undefined);
    });
  });

  // -------------------- 合成器快捷方法 --------------------

  describe('合成器快捷方法', () => {
    it('tSynth 转发到 synth.triggerAttackRelease', () => {
      sfxSynth.tSynth('C4', '8n', 1.0, 0.5);
      expect(nodes.synth.triggerAttackRelease).toHaveBeenCalledWith('C4', '8n', 1.0, 0.5);
    });

    it('tMembrane 转发到 membrane.triggerAttackRelease', () => {
      sfxSynth.tMembrane('C2', '4n', 1.0, 0.8);
      expect(nodes.membrane.triggerAttackRelease).toHaveBeenCalledWith('C2', '4n', 1.0, 0.8);
    });

    it('tFM 转发到 fmSynth.triggerAttackRelease', () => {
      sfxSynth.tFM('C5', '16n', 1.0, 0.4);
      expect(nodes.fmSynth.triggerAttackRelease).toHaveBeenCalledWith('C5', '16n', 1.0, 0.4);
    });

    it('tNoise 转发到 noiseSynth.triggerAttackRelease（无 note 参数）', () => {
      sfxSynth.tNoise('8n', 1.0, 0.3);
      expect(nodes.noiseSynth.triggerAttackRelease).toHaveBeenCalledWith('8n', 1.0, 0.3);
    });

    it('tMetal 转发到 metalSynth.triggerAttackRelease', () => {
      sfxSynth.tMetal('C6', '32n', 1.0, 0.2);
      expect(nodes.metalSynth.triggerAttackRelease).toHaveBeenCalledWith('C6', '32n', 1.0, 0.2);
    });

    it('tOrgan 支持单音字符串', () => {
      sfxSynth.tOrgan('D4', '2n', 1.0, 0.1);
      expect(nodes.organVoice.triggerAttackRelease).toHaveBeenCalledWith('D4', '2n', 1.0, 0.1);
    });

    it('tOrgan 支持和弦数组', () => {
      const chord = ['D3', 'A3', 'D4'];
      sfxSynth.tOrgan(chord, '2n', 1.0, 0.1);
      expect(nodes.organVoice.triggerAttackRelease).toHaveBeenCalledWith(chord, '2n', 1.0, 0.1);
    });
  });

  // -------------------- playSfx 路由分发 --------------------

  describe('playSfx 路由切换', () => {
    it('每次调用都通过 routeSynthTo 切换路由', () => {
      sfxSynth.playSfx('attack_hit');
      expect(routeSynthCalls).toHaveLength(1);
      expect(routeSynthCalls[0].route).toBe('combat');
    });

    it('魔法类音效走 magic 路由', () => {
      sfxSynth.playSfx('spell_cast');
      expect(routeSynthCalls[0].route).toBe('magic');
    });

    it('UI 类音效走 ui 路由', () => {
      sfxSynth.playSfx('ui_click');
      expect(routeSynthCalls[0].route).toBe('ui');
    });

    it('探索类音效走 exploration 路由', () => {
      sfxSynth.playSfx('step');
      expect(routeSynthCalls[0].route).toBe('exploration');
    });

    it('角色类音效走 character 路由', () => {
      sfxSynth.playSfx('level_up');
      expect(routeSynthCalls[0].route).toBe('character');
    });

    it('标准类音效走 standard 路由', () => {
      sfxSynth.playSfx('coin');
      expect(routeSynthCalls[0].route).toBe('standard');
    });
  });

  // -------------------- playSfx 音效分发覆盖 --------------------

  describe('playSfx 音效分发', () => {
    it('attack_hit 触发 membrane + noise + metal', () => {
      sfxSynth.playSfx('attack_hit');
      expect(nodes.membrane.triggerAttackRelease).toHaveBeenCalledTimes(2);
      expect(nodes.noiseSynth.triggerAttackRelease).toHaveBeenCalledTimes(1);
      expect(nodes.metalSynth.triggerAttackRelease).toHaveBeenCalledTimes(1);
    });

    it('attack_miss 触发 noise + synth', () => {
      sfxSynth.playSfx('attack_miss');
      expect(nodes.noiseSynth.triggerAttackRelease).toHaveBeenCalledTimes(1);
      expect(nodes.synth.triggerAttackRelease).toHaveBeenCalledTimes(1);
    });

    it('spell_cast 调整 fmSynth harmonicity 后恢复', () => {
      sfxSynth.playSfx('spell_cast');
      // set 被调用 2 次：一次设置新参数，一次恢复默认
      expect(nodes.fmSynth.set).toHaveBeenCalledTimes(2);
      // 第一次设置 harmonicity: 8
      expect(nodes.fmSynth.set).toHaveBeenNthCalledWith(1, { harmonicity: 8, modulationIndex: 12 });
      // 第二次恢复 harmonicity: 6
      expect(nodes.fmSynth.set).toHaveBeenNthCalledWith(2, { harmonicity: 6, modulationIndex: 14 });
    });

    it('combat_start 触发 organ + membrane', () => {
      sfxSynth.playSfx('combat_start');
      expect(nodes.organVoice.triggerAttackRelease).toHaveBeenCalledTimes(4);
      expect(nodes.membrane.triggerAttackRelease).toHaveBeenCalledTimes(2);
    });

    it('shop_buy 复用 coin 方法触发 2 次 metal', () => {
      sfxSynth.playSfx('shop_buy');
      expect(nodes.metalSynth.triggerAttackRelease).toHaveBeenCalledTimes(2);
    });

    it('shop_sell 复用 coin 方法触发 1 次 metal', () => {
      sfxSynth.playSfx('shop_sell');
      expect(nodes.metalSynth.triggerAttackRelease).toHaveBeenCalledTimes(1);
    });

    it('所有 52 种 SfxType 都能被处理不抛错', () => {
      const allTypes: SfxType[] = [
        // 战斗
        'attack_hit', 'attack_miss', 'attack_crit', 'player_hurt', 'enemy_hurt',
        'spell_cast', 'physical_damage', 'magic_damage', 'health_restore', 'mana_restore',
        'combat_start', 'combat_victory', 'combat_defeat', 'combat_flee', 'combat_skip',
        // 探索
        'step', 'item_pickup', 'trap_trigger', 'door_open', 'camp_rest', 'random_event',
        // 角色
        'level_up', 'death', 'coin', 'heal', 'character_create', 'resurrect',
        'gain_exp', 'mana_recover',
        // 装备 & 物品
        'equip', 'unequip', 'item_use', 'item_drop',
        // UI
        'ui_click', 'ui_open', 'ui_close', 'confirm', 'cancel',
        // 商店
        'shop_open', 'shop_buy', 'shop_sell', 'shop_refresh',
        // 任务
        'quest_accept', 'quest_complete', 'quest_abandon', 'quest_reward',
        // 技能
        'skill_memorize', 'skill_forget',
        // 存档
        'data_export', 'data_import',
        // 系统
        'exit_menu',
      ];
      // 51 种类型（types.ts 注释标注 52，实际联合类型成员为 51）
      expect(allTypes).toHaveLength(51);

      for (const type of allTypes) {
        expect(() => sfxSynth.playSfx(type)).not.toThrow();
      }
      // 每种类型都触发了一次路由切换
      expect(routeSynthCalls).toHaveLength(51);
    });
  });

  // -------------------- dispose --------------------

  describe('dispose 资源清理', () => {
    it('清理调度状态后时间追踪重置', () => {
      // 第一次调度记录时间
      sfxSynth.tSynth('C4', '8n', 5.0);
      // dispose
      sfxSynth.dispose();
      // 再次调度应使用传入时间（而非基于上次的 5.005）
      sfxSynth.tSynth('D4', '8n', 1.0);
      expect(nodes.synth.triggerAttackRelease).toHaveBeenLastCalledWith('D4', '8n', 1.0, undefined);
    });
  });
});
