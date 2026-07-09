/**
 * @fileoverview Boss 机制 Composable（useBossMechanics）单元测试
 *
 * 覆盖 useBossMechanics 的：
 * 1. scaleBossEffectValue：纯函数，按 Boss 等级线性缩放效果值
 *    公式：baseValue × (1 + (level-1) × 0.08)，向下取整
 * 2. initBossFeatures：初始化 Boss 阶段管理器与出场演出
 *    - 仅 isBoss && phases.length > 0 的敌人创建 BossPhaseManager
 *    - 仅 isBoss && intro 的敌人加入 bossIntros
 * 3. applyMechanicEffect：各机制分支
 *    - stun_player：添加 stun 效果到 playerEffects + 日志
 *    - silence_player：添加 silence 效果到 playerEffects + 日志
 *    - debuff_aura：按 Boss 等级缩放后添加减益效果 + 日志
 *    - healing_zone：直接修改 e.hp（上限 maxHp）+ 日志
 *    - aoe_attack / default：不修改状态
 *
 * Mock 策略：
 *  - S3 解耦：useBossMechanics 通过 IBossContext 接口注入外部依赖，
 *    不再 import useCharacterStore / useEnemyStore，故无需 mock 这些 Store。
 *  - bossCtx mock 模块（getPlayerName / createMinion / rebuildInitiativeOrder）
 *  - state / log 构造 minimal mock（playerEffects 用真实 createEmptyContainer）
 *  - BossPhaseManager / effects 模块走真实路径
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import {
  useBossMechanics,
  type IBossContext,
} from '@/modules/combat/composables/useBossMechanics';
import { createEmptyContainer, type EffectContainer } from '@/modules/combat/effects';
import type { EnemyInstance } from '@/modules/enemy/types';
import type { BossPhase, BossIntro } from '@/modules/enemy/types';

// ==================== 测试数据构造 helper ====================

/** 构造 minimal state mock */
function makeStateMock() {
  return {
    bossPhaseManagers: new Map<string, unknown>(),
    bossIntros: ref<Record<string, BossIntro>>({}),
    playerEffects: ref<EffectContainer>(createEmptyContainer()),
    enemyPositions: ref<Record<string, { row: 'front' | 'back'; col: number }>>({}),
    enemyIds: ref<string[]>([]),
  } as never;
}

/** 构造 minimal log mock */
function makeLogMock() {
  return {
    addCombatLog: vi.fn(),
  } as never;
}

/** 构造 IBossContext mock（S3：替代旧 useCharacterStore / useEnemyStore mock） */
function makeBossCtxMock(overrides: Partial<IBossContext> = {}): IBossContext {
  return {
    getPlayerName: vi.fn(() => '英雄'),
    createMinion: vi.fn().mockResolvedValue(null),
    rebuildInitiativeOrder: vi.fn(),
    ...overrides,
  };
}

/** 构造 EnemyInstance（Boss） */
function makeBossEnemy(o: Partial<EnemyInstance> & { phases?: BossPhase[]; intro?: BossIntro } = {}): EnemyInstance {
  return {
    id: 'boss-1',
    dataId: 'dragon',
    name: '黑龙',
    icon: 'dragon',
    maxHp: 1000,
    hp: 1000,
    damage: [50, 80],
    xp: 500,
    gold: 200,
    dangerLevel: 'extreme',
    level: 5,
    stats: { str: 30, dex: 20, con: 30, int: 15, wis: 15, cha: 10 },
    expReward: 500,
    goldReward: 200,
    isBoss: true,
    ...o,
  } as EnemyInstance;
}

/** 构造普通敌人 */
function makeNormalEnemy(o: Partial<EnemyInstance> = {}): EnemyInstance {
  return {
    id: 'e1',
    dataId: 'slime',
    name: '史莱姆',
    icon: 'slime',
    maxHp: 50,
    hp: 50,
    damage: [3, 6],
    xp: 10,
    gold: 5,
    dangerLevel: 'low',
    level: 1,
    stats: { str: 5, dex: 5, con: 5, int: 5, wis: 5, cha: 5 },
    expReward: 10,
    goldReward: 5,
    ...o,
  } as EnemyInstance;
}

function makePhase(o: Partial<BossPhase> = {}): BossPhase {
  return {
    hpThreshold: 0.5,
    name: '狂暴阶段',
    dialogue: ['怒了！'],
    aiStrategy: 'aggressive',
    mechanics: [],
    ...o,
  } as BossPhase;
}

// ==================== 测试用例 ====================

describe('useBossMechanics - Boss 机制 Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------- scaleBossEffectValue（纯函数） --------------------

  describe('scaleBossEffectValue：按 Boss 等级线性缩放', () => {
    it('等级 1 时无加成（baseValue × 1.0）', () => {
      const boss = useBossMechanics(makeStateMock(), makeLogMock(), makeBossCtxMock());
      expect(boss.scaleBossEffectValue(100, 1)).toBe(100);
      expect(boss.scaleBossEffectValue(50, 1)).toBe(50);
    });

    it('等级 5 时加成 32%（1 + 4×0.08 = 1.32），向下取整', () => {
      const boss = useBossMechanics(makeStateMock(), makeLogMock(), makeBossCtxMock());
      // 100 × 1.32 = 132
      expect(boss.scaleBossEffectValue(100, 5)).toBe(132);
      // 50 × 1.32 = 66
      expect(boss.scaleBossEffectValue(50, 5)).toBe(66);
    });

    it('等级 10 时加成 72%（1 + 9×0.08 = 1.72）', () => {
      const boss = useBossMechanics(makeStateMock(), makeLogMock(), makeBossCtxMock());
      // 100 × 1.72 = 172
      expect(boss.scaleBossEffectValue(100, 10)).toBe(172);
    });

    it('小数结果向下取整', () => {
      const boss = useBossMechanics(makeStateMock(), makeLogMock(), makeBossCtxMock());
      // 33 × 1.32 = 43.56 → 43
      expect(boss.scaleBossEffectValue(33, 5)).toBe(43);
    });

    it('baseValue 为 0 时返回 0', () => {
      const boss = useBossMechanics(makeStateMock(), makeLogMock(), makeBossCtxMock());
      expect(boss.scaleBossEffectValue(0, 10)).toBe(0);
    });
  });

  // -------------------- initBossFeatures --------------------

  describe('initBossFeatures：初始化 Boss 阶段管理器与出场演出', () => {
    it('为 isBoss && phases.length > 0 的敌人创建 BossPhaseManager', () => {
      const state = makeStateMock();
      const boss = useBossMechanics(state, makeLogMock(), makeBossCtxMock());

      const bossWithPhases = makeBossEnemy({
        id: 'boss-phases',
        phases: [makePhase()],
      });
      const bossNoPhases = makeBossEnemy({
        id: 'boss-no-phases',
        phases: [],
      });
      const normal = makeNormalEnemy({ id: 'normal-1' });

      boss.initBossFeatures([bossWithPhases, bossNoPhases, normal]);

      // 仅 boss-phases 创建了 BossPhaseManager
      expect(state.bossPhaseManagers.size).toBe(1);
      expect(state.bossPhaseManagers.has('boss-phases')).toBe(true);
      expect(state.bossPhaseManagers.has('boss-no-phases')).toBe(false);
      expect(state.bossPhaseManagers.has('normal-1')).toBe(false);
    });

    it('为 isBoss && intro 的敌人收集 bossIntros', () => {
      const state = makeStateMock();
      const boss = useBossMechanics(state, makeLogMock(), makeBossCtxMock());

      const intro: BossIntro = { effect: 'darken', lines: ['出场！'], duration: 1000 };
      const bossWithIntro = makeBossEnemy({ id: 'boss-intro', intro });
      const bossNoIntro = makeBossEnemy({ id: 'boss-no-intro', intro: undefined });
      const normal = makeNormalEnemy({ id: 'normal-1', intro: intro as never });

      boss.initBossFeatures([bossWithIntro, bossNoIntro, normal]);

      // 仅 boss-intro 收集了 intro（normal 虽有 intro 字段但 isBoss=false）
      expect(Object.keys(state.bossIntros.value)).toEqual(['boss-intro']);
      expect(state.bossIntros.value['boss-intro']).toEqual(intro);
    });

    it('再次调用 initBossFeatures 清空旧的 phaseManagers 与 intros', () => {
      const state = makeStateMock();
      const boss = useBossMechanics(state, makeLogMock(), makeBossCtxMock());

      const intro: BossIntro = { effect: 'shake', lines: ['1'], duration: 500 };
      boss.initBossFeatures([makeBossEnemy({ id: 'boss-1', phases: [makePhase()], intro })]);
      expect(state.bossPhaseManagers.size).toBe(1);
      expect(Object.keys(state.bossIntros.value)).toEqual(['boss-1']);

      // 第二次调用，传入不同的 Boss
      boss.initBossFeatures([makeBossEnemy({ id: 'boss-2', phases: [makePhase()] })]);
      expect(state.bossPhaseManagers.size).toBe(1);
      expect(state.bossPhaseManagers.has('boss-2')).toBe(true);
      expect(state.bossPhaseManagers.has('boss-1')).toBe(false);
      // boss-1 的 intro 被清空
      expect(state.bossIntros.value['boss-1']).toBeUndefined();
    });

    it('空敌人列表不创建任何 phaseManager / intro', () => {
      const state = makeStateMock();
      const boss = useBossMechanics(state, makeLogMock(), makeBossCtxMock());

      boss.initBossFeatures([]);

      expect(state.bossPhaseManagers.size).toBe(0);
      expect(state.bossIntros.value).toEqual({});
    });

    it('仅普通敌人（无 Boss）不创建 phaseManager / intro', () => {
      const state = makeStateMock();
      const boss = useBossMechanics(state, makeLogMock(), makeBossCtxMock());

      boss.initBossFeatures([makeNormalEnemy({ id: 'n1' }), makeNormalEnemy({ id: 'n2' })]);

      expect(state.bossPhaseManagers.size).toBe(0);
      expect(state.bossIntros.value).toEqual({});
    });
    it('清理后可重新初始化（验证 clear 语义）', () => {
      const state = makeStateMock();
      const boss = useBossMechanics(state, makeLogMock(), makeBossCtxMock());

      boss.initBossFeatures([makeBossEnemy({ id: 'boss-1', phases: [makePhase()] })]);
      expect(state.bossPhaseManagers.size).toBe(1);

      // 模拟 cleanup 后重新初始化
      state.bossPhaseManagers.clear();
      state.bossIntros.value = {};
      boss.initBossFeatures([makeBossEnemy({ id: 'boss-2', phases: [makePhase()] })]);

      expect(state.bossPhaseManagers.size).toBe(1);
      expect(state.bossPhaseManagers.has('boss-2')).toBe(true);
    });
  });

  // -------------------- applyMechanicEffect --------------------

  describe('applyMechanicEffect：应用 Boss 机制效果', () => {
    it('stun_player：添加 stun 效果到 playerEffects，并记录日志', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const bossCtx = makeBossCtxMock();
      const boss = useBossMechanics(state, log, bossCtx);

      const enemy = makeBossEnemy({ id: 'stun-boss', name: '黑龙' });
      const phase = makePhase({
        mechanics: [{ type: 'stun_player', intervalTurns: 3, params: { turns: 2 } }],
      });

      boss.applyMechanicEffect(enemy, 'stun_player', phase);

      // 验证 stun 效果已添加
      expect(state.playerEffects.value.effects).toHaveLength(1);
      expect(state.playerEffects.value.effects[0].type).toBe('stun');
      expect(state.playerEffects.value.effects[0].remainingTurns).toBe(2);
      expect(state.playerEffects.value.effects[0].source).toBe('enemy');
      expect(state.playerEffects.value.effects[0].sourceName).toBe('黑龙');
      // 验证日志
      expect(log.addCombatLog).toHaveBeenCalledTimes(1);
      const logCall = log.addCombatLog.mock.calls[0][0];
      expect(logCall.eventType).toBe('combat_event');
      expect(logCall.message).toContain('眩晕');
      expect(logCall.message).toContain('黑龙');
      expect(logCall.message).toContain('2');
    });

    it('stun_player：params.turns 缺失时默认 1 回合', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ name: '黑龙' });
      const phase = makePhase({
        mechanics: [{ type: 'stun_player', intervalTurns: 3 }],
      });

      boss.applyMechanicEffect(enemy, 'stun_player', phase);

      expect(state.playerEffects.value.effects[0].remainingTurns).toBe(1);
    });

    it('silence_player：添加 silence 效果，默认 2 回合', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ name: '法师杀手' });
      const phase = makePhase({
        mechanics: [{ type: 'silence_player', intervalTurns: 5, params: { turns: 3 } }],
      });

      boss.applyMechanicEffect(enemy, 'silence_player', phase);

      expect(state.playerEffects.value.effects[0].type).toBe('silence');
      expect(state.playerEffects.value.effects[0].remainingTurns).toBe(3);
      expect(log.addCombatLog).toHaveBeenCalledTimes(1);
      expect(log.addCombatLog.mock.calls[0][0].message).toContain('沉默');
    });

    it('silence_player：params 缺失时默认 2 回合', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ name: '法师杀手' });
      const phase = makePhase({
        mechanics: [{ type: 'silence_player', intervalTurns: 5 }],
      });

      boss.applyMechanicEffect(enemy, 'silence_player', phase);

      expect(state.playerEffects.value.effects[0].remainingTurns).toBe(2);
    });

    it('debuff_aura：按 Boss 等级缩放后添加减益效果', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ name: '光环Boss', level: 5 });
      const phase = makePhase({
        mechanics: [{
          type: 'debuff_aura',
          intervalTurns: 3,
          params: { debuffType: 'attack_down', value: 10, turns: 3 },
        }],
      });

      boss.applyMechanicEffect(enemy, 'debuff_aura', phase);

      // baseValue=10, bossLevel=5 → 10 × 1.32 = 13.2 → 13
      expect(state.playerEffects.value.effects[0].type).toBe('attack_down');
      expect(state.playerEffects.value.effects[0].value).toBe(13);
      expect(state.playerEffects.value.effects[0].remainingTurns).toBe(3);
      expect(log.addCombatLog).toHaveBeenCalledTimes(1);
      expect(log.addCombatLog.mock.calls[0][0].message).toContain('减益光环');
    });

    it('debuff_aura：params 缺失时使用默认值（debuffType=attack_down, value=10, turns=3）', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ name: 'Boss', level: 1 });
      const phase = makePhase({
        mechanics: [{ type: 'debuff_aura', intervalTurns: 3 }],
      });

      boss.applyMechanicEffect(enemy, 'debuff_aura', phase);

      expect(state.playerEffects.value.effects[0].type).toBe('attack_down');
      // level=1 → 10 × 1.0 = 10
      expect(state.playerEffects.value.effects[0].value).toBe(10);
      expect(state.playerEffects.value.effects[0].remainingTurns).toBe(3);
    });

    it('healing_zone：直接修改 e.hp（上限 maxHp），并记录治疗日志', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ name: '治疗Boss', hp: 100, maxHp: 1000 });
      const phase = makePhase({
        mechanics: [{ type: 'healing_zone', intervalTurns: 2, params: { healPerTurn: 50 } }],
      });

      boss.applyMechanicEffect(enemy, 'healing_zone', phase);

      expect(enemy.hp).toBe(150);
      expect(log.addCombatLog).toHaveBeenCalledTimes(1);
      const logCall = log.addCombatLog.mock.calls[0][0];
      expect(logCall.eventType).toBe('combat_heal');
      expect(logCall.message).toContain('50');
      expect(logCall.targetName).toBe('治疗Boss');
    });

    it('healing_zone：治疗量超过 maxHp 时截断为 maxHp', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ name: '治疗Boss', hp: 980, maxHp: 1000 });
      const phase = makePhase({
        mechanics: [{ type: 'healing_zone', intervalTurns: 2, params: { healPerTurn: 50 } }],
      });

      boss.applyMechanicEffect(enemy, 'healing_zone', phase);

      expect(enemy.hp).toBe(1000);
    });

    it('healing_zone：params.healPerTurn 缺失时默认 5', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ name: 'Boss', hp: 100, maxHp: 1000 });
      const phase = makePhase({
        mechanics: [{ type: 'healing_zone', intervalTurns: 2 }],
      });

      boss.applyMechanicEffect(enemy, 'healing_zone', phase);

      expect(enemy.hp).toBe(105);
    });

    it('aoe_attack：不修改 playerEffects，不记录日志（标记由 engine 设置）', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy();
      const phase = makePhase({
        mechanics: [{ type: 'aoe_attack', intervalTurns: 3 }],
      });

      boss.applyMechanicEffect(enemy, 'aoe_attack', phase);

      expect(state.playerEffects.value.effects).toHaveLength(0);
      expect(log.addCombatLog).not.toHaveBeenCalled();
    });

    it('未匹配的机制类型（default 分支）不修改状态', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy();
      const phase = makePhase({
        mechanics: [],
      });

      // reflect_damage / enrage / damage_shield 等走 default 分支
      boss.applyMechanicEffect(enemy, 'reflect_damage', phase);
      boss.applyMechanicEffect(enemy, 'enrage', phase);
      boss.applyMechanicEffect(enemy, 'damage_shield', phase);

      expect(state.playerEffects.value.effects).toHaveLength(0);
      expect(log.addCombatLog).not.toHaveBeenCalled();
    });

    it('phase.mechanics 中无匹配类型时，params 为空对象（不抛错）', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ name: 'Boss' });
      // phase 中没有 stun_player 机制，但 mechType 传入 stun_player
      const phase = makePhase({
        mechanics: [{ type: 'aoe_attack', intervalTurns: 3 }],
      });

      // 不应抛错，mechanic 找不到时 params 默认为 {}
      expect(() => boss.applyMechanicEffect(enemy, 'stun_player', phase)).not.toThrow();
      // stun 效果仍会添加（用默认参数）
      expect(state.playerEffects.value.effects).toHaveLength(1);
    });
  });

  // -------------------- 返回值结构 --------------------

  describe('返回值结构', () => {
    it('返回包含 3 个方法的对象', () => {
      const boss = useBossMechanics(makeStateMock(), makeLogMock(), makeBossCtxMock());
      expect(typeof boss.initBossFeatures).toBe('function');
      expect(typeof boss.applyMechanicEffect).toBe('function');
      expect(typeof boss.scaleBossEffectValue).toBe('function');
    });
  });

  // -------------------- 验证 bossCtx.getPlayerName 调用 --------------------

  describe('bossCtx.getPlayerName 调用', () => {
    it('applyMechanicEffect 触发时调用 bossCtx.getPlayerName 获取玩家名称', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const bossCtx = makeBossCtxMock();
      const boss = useBossMechanics(state, log, bossCtx);

      const enemy = makeBossEnemy({ name: '黑龙' });
      const phase = makePhase({
        mechanics: [{ type: 'stun_player', intervalTurns: 3, params: { turns: 1 } }],
      });

      boss.applyMechanicEffect(enemy, 'stun_player', phase);

      expect(bossCtx.getPlayerName).toHaveBeenCalled();
      // 日志中包含 getPlayerName 返回的玩家名称
      expect(log.addCombatLog.mock.calls[0][0].targetName).toBe('英雄');
    });
  });
});
