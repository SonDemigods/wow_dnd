/**
 * @fileoverview Boss 机制 Composable（useBossMechanics）单元测试
 *
 * 覆盖 useBossMechanics 的：
 * 1. scaleBossEffectValue：纯函数，按 Boss 等级线性缩放效果值
 *    公式：baseValue × (1 + (level-1) × 0.08)，向下取整
 * 2. initBossFeatures：初始化 Boss 阶段管理器与出场演出
 *    - 仅 isBoss && phases.length > 0 的敌人创建 BossPhaseManager
 *    - 仅 isBoss && intro 的敌人加入 bossIntros
 *    - 为 isBoss 的敌人创建 bossInstances 映射（base 与 enemy 同引用）
 * 3. applyMechanicEffect：各机制分支
 *    - stun_player：添加 stun 效果到 playerEffects + 日志
 *    - silence_player：添加 silence 效果到 playerEffects + 日志
 *    - debuff_aura：按 Boss 等级缩放后添加减益效果 + 日志
 *    - healing_zone：直接修改 e.hp（上限 maxHp）+ 日志
 *    - aoe_attack / default：不修改状态
 *    - summon_minions：异步召唤小怪（前排优先分配位置）
 * 4. applyBossDefenseMechanics：Boss 防御机制（阶段九迁移）
 *    - invulnerable 无敌免疫伤害
 *    - shield 吸收伤害（全额吸收 / 击破溢出）
 *    - 非 Boss 直接返回原伤害
 * 5. applyBossCounterMechanics：Boss 反击机制（阶段九迁移）
 *    - reflectDamage 反弹伤害
 *    - counterStance 反击姿态（50% 伤害，触发后清除）
 *    - actualDamage <= 0 时不触发
 * 6. checkBossRevive：Boss 复活机制（阶段九迁移）
 *    - canRevive 时恢复 50% HP
 *    - 复活后清除 canRevive 标记
 *    - 非 Boss 不复活
 *
 * Mock 策略：
 *  - S3 解耦：useBossMechanics 通过 IBossContext 接口注入外部依赖，
 *    不再 import useCharacterStore / useEnemyStore，故无需 mock 这些 Store。
 *  - bossCtx mock 模块（getPlayerName / createMinion / rebuildInitiativeOrder / applyDamageToPlayer）
 *  - state / log 构造 minimal mock（playerEffects 用真实 createEmptyContainer）
 *  - BossPhaseManager / effects 模块走真实路径
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import {
  useBossMechanics,
  type IBossContext,
} from '@/modules/combat/composables/useBossMechanics';
import { createEmptyContainer, type EffectContainer } from '@/modules/combat/effects';
import { wrapAsBossInstance } from '@/modules/boss/service';
import type { EnemyInstance } from '@/modules/enemy/types';
import type { BossPhase, BossIntro } from '@/modules/enemy/types';

// ==================== 测试数据构造 helper ====================

/** 构造 minimal state mock */
function makeStateMock() {
  return {
    bossPhaseManagers: new Map<string, unknown>(),
    bossInstances: new Map(),
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
    applyDamageToPlayer: vi.fn(),
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
      const bossInstance = wrapAsBossInstance(enemy);
      const phase = makePhase({
        mechanics: [{ type: 'stun_player', intervalTurns: 3, params: { turns: 2 } }],
      });

      boss.applyMechanicEffect(bossInstance, 'stun_player', phase);

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
      const bossInstance = wrapAsBossInstance(enemy);
      const phase = makePhase({
        mechanics: [{ type: 'stun_player', intervalTurns: 3 }],
      });

      boss.applyMechanicEffect(bossInstance, 'stun_player', phase);

      expect(state.playerEffects.value.effects[0].remainingTurns).toBe(1);
    });

    it('silence_player：添加 silence 效果，默认 2 回合', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ name: '法师杀手' });
      const bossInstance = wrapAsBossInstance(enemy);
      const phase = makePhase({
        mechanics: [{ type: 'silence_player', intervalTurns: 5, params: { turns: 3 } }],
      });

      boss.applyMechanicEffect(bossInstance, 'silence_player', phase);

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
      const bossInstance = wrapAsBossInstance(enemy);
      const phase = makePhase({
        mechanics: [{ type: 'silence_player', intervalTurns: 5 }],
      });

      boss.applyMechanicEffect(bossInstance, 'silence_player', phase);

      expect(state.playerEffects.value.effects[0].remainingTurns).toBe(2);
    });

    it('debuff_aura：按 Boss 等级缩放后添加减益效果', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ name: '光环Boss', level: 5 });
      const bossInstance = wrapAsBossInstance(enemy);
      const phase = makePhase({
        mechanics: [{
          type: 'debuff_aura',
          intervalTurns: 3,
          params: { debuffType: 'attack_down', value: 10, turns: 3 },
        }],
      });

      boss.applyMechanicEffect(bossInstance, 'debuff_aura', phase);

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
      const bossInstance = wrapAsBossInstance(enemy);
      const phase = makePhase({
        mechanics: [{ type: 'debuff_aura', intervalTurns: 3 }],
      });

      boss.applyMechanicEffect(bossInstance, 'debuff_aura', phase);

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
      const bossInstance = wrapAsBossInstance(enemy);
      const phase = makePhase({
        mechanics: [{ type: 'healing_zone', intervalTurns: 2, params: { healPerTurn: 50 } }],
      });

      boss.applyMechanicEffect(bossInstance, 'healing_zone', phase);

      // wrapAsBossInstance 保持 base 与 enemy 同引用，enemy.hp 同步更新
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
      const bossInstance = wrapAsBossInstance(enemy);
      const phase = makePhase({
        mechanics: [{ type: 'healing_zone', intervalTurns: 2, params: { healPerTurn: 50 } }],
      });

      boss.applyMechanicEffect(bossInstance, 'healing_zone', phase);

      expect(enemy.hp).toBe(1000);
    });

    it('healing_zone：params.healPerTurn 缺失时默认 5', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ name: 'Boss', hp: 100, maxHp: 1000 });
      const bossInstance = wrapAsBossInstance(enemy);
      const phase = makePhase({
        mechanics: [{ type: 'healing_zone', intervalTurns: 2 }],
      });

      boss.applyMechanicEffect(bossInstance, 'healing_zone', phase);

      expect(enemy.hp).toBe(105);
    });

    it('aoe_attack：不修改 playerEffects，不记录日志（标记由 engine 设置）', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy();
      const bossInstance = wrapAsBossInstance(enemy);
      const phase = makePhase({
        mechanics: [{ type: 'aoe_attack', intervalTurns: 3 }],
      });

      boss.applyMechanicEffect(bossInstance, 'aoe_attack', phase);

      expect(state.playerEffects.value.effects).toHaveLength(0);
      expect(log.addCombatLog).not.toHaveBeenCalled();
    });

    it('未匹配的机制类型（default 分支）不修改状态', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy();
      const bossInstance = wrapAsBossInstance(enemy);
      const phase = makePhase({
        mechanics: [],
      });

      // reflect_damage / enrage / damage_shield 等走 default 分支
      boss.applyMechanicEffect(bossInstance, 'reflect_damage', phase);
      boss.applyMechanicEffect(bossInstance, 'enrage', phase);
      boss.applyMechanicEffect(bossInstance, 'damage_shield', phase);

      expect(state.playerEffects.value.effects).toHaveLength(0);
      expect(log.addCombatLog).not.toHaveBeenCalled();
    });

    it('phase.mechanics 中无匹配类型时，params 为空对象（不抛错）', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ name: 'Boss' });
      const bossInstance = wrapAsBossInstance(enemy);
      // phase 中没有 stun_player 机制，但 mechType 传入 stun_player
      const phase = makePhase({
        mechanics: [{ type: 'aoe_attack', intervalTurns: 3 }],
      });

      // 不应抛错，mechanic 找不到时 params 默认为 {}
      expect(() => boss.applyMechanicEffect(bossInstance, 'stun_player', phase)).not.toThrow();
      // stun 效果仍会添加（用默认参数）
      expect(state.playerEffects.value.effects).toHaveLength(1);
    });
  });

  // -------------------- applyMechanicEffect: summon_minions（异步召唤小怪） --------------------

  describe('applyMechanicEffect：summon_minions 异步召唤小怪', () => {
    it('pendingSummons 为 0 时不调用 createMinion / rebuildInitiativeOrder', async () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const bossCtx = makeBossCtxMock();
      const boss = useBossMechanics(state, log, bossCtx);

      const enemy = makeBossEnemy({ name: '召唤Boss' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.pendingSummons = 0;
      const phase = makePhase({
        mechanics: [{ type: 'summon_minions', intervalTurns: 3 }],
      });

      boss.applyMechanicEffect(bossInstance, 'summon_minions', phase);
      await flushPromises();

      expect(bossCtx.createMinion).not.toHaveBeenCalled();
      expect(bossCtx.rebuildInitiativeOrder).not.toHaveBeenCalled();
      expect(log.addCombatLog).not.toHaveBeenCalled();
    });

    it('pendingSummons 缺失（undefined）时不调用 createMinion', async () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const bossCtx = makeBossCtxMock();
      const boss = useBossMechanics(state, log, bossCtx);

      const enemy = makeBossEnemy({ name: '召唤Boss' });
      const bossInstance = wrapAsBossInstance(enemy);
      const phase = makePhase({
        mechanics: [{ type: 'summon_minions', intervalTurns: 3 }],
      });

      boss.applyMechanicEffect(bossInstance, 'summon_minions', phase);
      await flushPromises();

      expect(bossCtx.createMinion).not.toHaveBeenCalled();
    });

    it('成功召唤多个小怪：调用 createMinion 多次、添加到 enemyPositions/enemyIds、调用 rebuildInitiativeOrder、记录日志', async () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const bossCtx = makeBossCtxMock({
        createMinion: vi.fn()
          .mockResolvedValueOnce({ id: 'm1', name: '史莱姆A' })
          .mockResolvedValueOnce({ id: 'm2', name: '史莱姆B' }),
      });
      const boss = useBossMechanics(state, log, bossCtx);

      const enemy = makeBossEnemy({ id: 'boss-summon', name: '召唤师', level: 3 });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.pendingSummons = 2;
      const phase = makePhase({
        mechanics: [{ type: 'summon_minions', intervalTurns: 3 }],
      });

      boss.applyMechanicEffect(bossInstance, 'summon_minions', phase);
      await flushPromises();

      // createMinion 调用 2 次，参数为 ('slime', bossLevel)
      expect(bossCtx.createMinion).toHaveBeenCalledTimes(2);
      expect(bossCtx.createMinion).toHaveBeenCalledWith('slime', 3);
      // 小怪分配到前排，列号 0 和 1
      expect(state.enemyPositions.value['m1']).toEqual({ row: 'front', col: 0 });
      expect(state.enemyPositions.value['m2']).toEqual({ row: 'front', col: 1 });
      // enemyIds 追加小怪 id
      expect(state.enemyIds.value).toEqual(['m1', 'm2']);
      // 一次性重建先攻顺序
      expect(bossCtx.rebuildInitiativeOrder).toHaveBeenCalledTimes(1);
      // 每个小怪一条日志
      expect(log.addCombatLog).toHaveBeenCalledTimes(2);
      const firstCall = log.addCombatLog.mock.calls[0][0];
      expect(firstCall.message).toContain('召唤了');
      expect(firstCall.message).toContain('史莱姆A');
      expect(firstCall.targetId).toBe('m1');
      expect(firstCall.eventType).toBe('combat_event');
      // finally 重置 pendingSummons（runtime 字段）
      expect(bossInstance.runtime.pendingSummons).toBe(0);
    });

    it('createMinion 返回 null 时跳过该小怪但仍处理其他小怪', async () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const bossCtx = makeBossCtxMock({
        createMinion: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'm2', name: '史莱姆B' }),
      });
      const boss = useBossMechanics(state, log, bossCtx);

      const enemy = makeBossEnemy({ name: '召唤师' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.pendingSummons = 2;
      const phase = makePhase({
        mechanics: [{ type: 'summon_minions', intervalTurns: 3 }],
      });

      boss.applyMechanicEffect(bossInstance, 'summon_minions', phase);
      await flushPromises();

      // 仅 m2 被添加
      expect(state.enemyIds.value).toEqual(['m2']);
      expect(state.enemyPositions.value['m2']).toEqual({ row: 'front', col: 0 });
      // 仍然调用 rebuildInitiativeOrder（因为 newMinions.length > 0）
      expect(bossCtx.rebuildInitiativeOrder).toHaveBeenCalledTimes(1);
      // 仅一条日志
      expect(log.addCombatLog).toHaveBeenCalledTimes(1);
      // pendingSummons 被重置（runtime 字段）
      expect(bossInstance.runtime.pendingSummons).toBe(0);
    });

    it('所有 createMinion 都返回 null 时不调用 rebuildInitiativeOrder 与日志', async () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const bossCtx = makeBossCtxMock({
        createMinion: vi.fn().mockResolvedValue(null),
      });
      const boss = useBossMechanics(state, log, bossCtx);

      const enemy = makeBossEnemy({ name: '召唤师' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.pendingSummons = 2;
      const phase = makePhase({
        mechanics: [{ type: 'summon_minions', intervalTurns: 3 }],
      });

      boss.applyMechanicEffect(bossInstance, 'summon_minions', phase);
      await flushPromises();

      expect(bossCtx.rebuildInitiativeOrder).not.toHaveBeenCalled();
      expect(log.addCombatLog).not.toHaveBeenCalled();
      // finally 仍重置 pendingSummons（runtime 字段）
      expect(bossInstance.runtime.pendingSummons).toBe(0);
    });

    it('createMinion 抛错时调用 console.error 并在 finally 重置 pendingSummons', async () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const bossCtx = makeBossCtxMock({
        createMinion: vi.fn().mockRejectedValue(new Error('创建失败')),
      });
      const boss = useBossMechanics(state, log, bossCtx);

      const enemy = makeBossEnemy({ name: '召唤师' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.pendingSummons = 2;
      const phase = makePhase({
        mechanics: [{ type: 'summon_minions', intervalTurns: 3 }],
      });

      boss.applyMechanicEffect(bossInstance, 'summon_minions', phase);
      await flushPromises();

      // P2-32 修复：catch 块现在使用 console.error 记录完整错误信息（包含错误对象）
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('召唤小怪失败'), expect.any(Error));
      // finally 仍重置 pendingSummons（runtime 字段）
      expect(bossInstance.runtime.pendingSummons).toBe(0);
      // 不调用 rebuildInitiativeOrder（因为异常前 newMinions 为空）
      expect(bossCtx.rebuildInitiativeOrder).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('已有前排位置时寻找可用列（覆盖 find 命中分支）', async () => {
      const state = makeStateMock();
      // 预设前排已有 col 0 和 col 1
      state.enemyPositions.value = {
        existing1: { row: 'front', col: 0 },
        existing2: { row: 'front', col: 1 },
      };
      const log = makeLogMock();
      const bossCtx = makeBossCtxMock({
        createMinion: vi.fn().mockResolvedValue({ id: 'm1', name: '新史莱姆' }),
      });
      const boss = useBossMechanics(state, log, bossCtx);

      const enemy = makeBossEnemy({ name: '召唤师' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.pendingSummons = 1;
      const phase = makePhase({
        mechanics: [{ type: 'summon_minions', intervalTurns: 3 }],
      });

      boss.applyMechanicEffect(bossInstance, 'summon_minions', phase);
      await flushPromises();

      // 应该分配到 col 2（最后一个可用列）
      expect(state.enemyPositions.value['m1']).toEqual({ row: 'front', col: 2 });
    });

    it('前排位置已满（col 0/1/2 全占）时回退到 col 0（覆盖 ?? 0 分支）', async () => {
      const state = makeStateMock();
      state.enemyPositions.value = {
        e0: { row: 'front', col: 0 },
        e1: { row: 'front', col: 1 },
        e2: { row: 'front', col: 2 },
      };
      const log = makeLogMock();
      const bossCtx = makeBossCtxMock({
        createMinion: vi.fn().mockResolvedValue({ id: 'm1', name: '新史莱姆' }),
      });
      const boss = useBossMechanics(state, log, bossCtx);

      const enemy = makeBossEnemy({ name: '召唤师' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.pendingSummons = 1;
      const phase = makePhase({
        mechanics: [{ type: 'summon_minions', intervalTurns: 3 }],
      });

      boss.applyMechanicEffect(bossInstance, 'summon_minions', phase);
      await flushPromises();

      // P2-41 修复：前排三列全满时回退到后排 col 0
      expect(state.enemyPositions.value['m1']).toEqual({ row: 'back', col: 0 });
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
      const bossInstance = wrapAsBossInstance(enemy);
      const phase = makePhase({
        mechanics: [{ type: 'stun_player', intervalTurns: 3, params: { turns: 1 } }],
      });

      boss.applyMechanicEffect(bossInstance, 'stun_player', phase);

      expect(bossCtx.getPlayerName).toHaveBeenCalled();
      // 日志中包含 getPlayerName 返回的玩家名称
      expect(log.addCombatLog.mock.calls[0][0].targetName).toBe('英雄');
    });
  });

  // -------------------- initBossFeatures：bossInstances Map 初始化 --------------------

  describe('initBossFeatures：bossInstances Map 初始化', () => {
    it('为 isBoss 的敌人创建 bossInstances 映射', () => {
      const state = makeStateMock();
      const boss = useBossMechanics(state, makeLogMock(), makeBossCtxMock());

      const bossEnemy = makeBossEnemy({ id: 'boss-1' });
      const normal = makeNormalEnemy({ id: 'normal-1' });

      boss.initBossFeatures([bossEnemy, normal]);

      expect(state.bossInstances.has('boss-1')).toBe(true);
      expect(state.bossInstances.has('normal-1')).toBe(false);
    });

    it('bossInstance.base 与 enemy 保持同引用', () => {
      const state = makeStateMock();
      const boss = useBossMechanics(state, makeLogMock(), makeBossCtxMock());

      const bossEnemy = makeBossEnemy({ id: 'boss-1' });
      boss.initBossFeatures([bossEnemy]);

      const bossInstance = state.bossInstances.get('boss-1');
      expect(bossInstance).toBeDefined();
      expect(bossInstance.base).toBe(bossEnemy);
    });

    it('非 Boss 敌人不创建 bossInstances', () => {
      const state = makeStateMock();
      const boss = useBossMechanics(state, makeLogMock(), makeBossCtxMock());

      boss.initBossFeatures([makeNormalEnemy({ id: 'n1' }), makeNormalEnemy({ id: 'n2' })]);

      expect(state.bossInstances.size).toBe(0);
    });
  });

  // -------------------- applyBossDefenseMechanics --------------------

  describe('applyBossDefenseMechanics：Boss 防御机制', () => {
    it('invulnerable 无敌时伤害为 0 且 blocked=true', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ id: 'boss-1', name: '无敌Boss' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.invulnerable = true;
      state.bossInstances.set(enemy.id, bossInstance);

      const result = boss.applyBossDefenseMechanics(enemy, 100);

      expect(result.damage).toBe(0);
      expect(result.blocked).toBe(true);
    });

    it('invulnerable 时记录"免疫伤害"日志', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ id: 'boss-1', name: '无敌Boss' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.invulnerable = true;
      state.bossInstances.set(enemy.id, bossInstance);

      boss.applyBossDefenseMechanics(enemy, 100);

      expect(log.addCombatLog).toHaveBeenCalledTimes(1);
      const logCall = log.addCombatLog.mock.calls[0][0];
      expect(logCall.message).toContain('无敌');
      expect(logCall.message).toContain('免疫');
      expect(logCall.targetName).toBe('无敌Boss');
    });

    it('shield 大于伤害时吸收全部，shield 剩余', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ id: 'boss-1', name: '护盾Boss' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.shield = 50;
      state.bossInstances.set(enemy.id, bossInstance);

      const result = boss.applyBossDefenseMechanics(enemy, 30);

      expect(result.damage).toBe(0);
      expect(result.blocked).toBe(true);
      expect(bossInstance.runtime.shield).toBe(20);
    });

    it('shield 等于伤害时全部吸收（边界）', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ id: 'boss-1' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.shield = 30;
      state.bossInstances.set(enemy.id, bossInstance);

      const result = boss.applyBossDefenseMechanics(enemy, 30);

      expect(result.damage).toBe(0);
      expect(result.blocked).toBe(true);
      expect(bossInstance.runtime.shield).toBe(0);
    });

    it('shield 小于伤害时击破，返回剩余伤害', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ id: 'boss-1' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.shield = 10;
      state.bossInstances.set(enemy.id, bossInstance);

      const result = boss.applyBossDefenseMechanics(enemy, 30);

      expect(result.damage).toBe(20);
      expect(result.blocked).toBe(false);
    });

    it('shield 被击破时 shield 归零', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ id: 'boss-1' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.shield = 10;
      state.bossInstances.set(enemy.id, bossInstance);

      boss.applyBossDefenseMechanics(enemy, 30);

      expect(bossInstance.runtime.shield).toBe(0);
    });

    it('shield 被击破时记录"护盾被击破"日志', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ id: 'boss-1', name: '护盾Boss' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.shield = 10;
      state.bossInstances.set(enemy.id, bossInstance);

      boss.applyBossDefenseMechanics(enemy, 30);

      expect(log.addCombatLog).toHaveBeenCalledTimes(1);
      const logCall = log.addCombatLog.mock.calls[0][0];
      expect(logCall.message).toContain('护盾被击破');
      expect(logCall.message).toContain('10');
      expect(logCall.targetName).toBe('护盾Boss');
    });

    it('无 shield（undefined）时直接返回原伤害', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ id: 'boss-1' });
      const bossInstance = wrapAsBossInstance(enemy);
      // runtime.shield 未设置（undefined）
      state.bossInstances.set(enemy.id, bossInstance);

      const result = boss.applyBossDefenseMechanics(enemy, 50);

      expect(result.damage).toBe(50);
      expect(result.blocked).toBe(false);
      expect(log.addCombatLog).not.toHaveBeenCalled();
    });

    it('非 Boss（bossInstances 无此 id）时直接返回原伤害', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeNormalEnemy({ id: 'normal-1' });
      // bossInstances 为空，不包含 normal-1

      const result = boss.applyBossDefenseMechanics(enemy, 50);

      expect(result.damage).toBe(50);
      expect(result.blocked).toBe(false);
      expect(log.addCombatLog).not.toHaveBeenCalled();
    });
  });

  // -------------------- applyBossCounterMechanics --------------------

  describe('applyBossCounterMechanics：Boss 反击机制', () => {
    it('reflectDamage 反弹伤害给玩家', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const bossCtx = makeBossCtxMock();
      const boss = useBossMechanics(state, log, bossCtx);

      const enemy = makeBossEnemy({ id: 'boss-1', name: '反弹Boss' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.reflectDamage = 0.2;
      state.bossInstances.set(enemy.id, bossInstance);

      boss.applyBossCounterMechanics(enemy, 50);

      // reflectAmount = Math.floor(50 * 0.2) = 10
      expect(bossCtx.applyDamageToPlayer).toHaveBeenCalledWith(10);
    });

    it('reflectDamage 反弹值 = Math.floor(actualDamage * reflectDamage)', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const bossCtx = makeBossCtxMock();
      const boss = useBossMechanics(state, log, bossCtx);

      const enemy = makeBossEnemy({ id: 'boss-1' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.reflectDamage = 0.33;
      state.bossInstances.set(enemy.id, bossInstance);

      boss.applyBossCounterMechanics(enemy, 100);

      // reflectAmount = Math.floor(100 * 0.33) = Math.floor(33) = 33
      expect(bossCtx.applyDamageToPlayer).toHaveBeenCalledWith(33);
    });

    it('reflectDamage 反弹伤害记录日志', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const bossCtx = makeBossCtxMock();
      const boss = useBossMechanics(state, log, bossCtx);

      const enemy = makeBossEnemy({ id: 'boss-1', name: '反弹Boss' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.reflectDamage = 0.2;
      state.bossInstances.set(enemy.id, bossInstance);

      boss.applyBossCounterMechanics(enemy, 50);

      expect(log.addCombatLog).toHaveBeenCalledTimes(1);
      const logCall = log.addCombatLog.mock.calls[0][0];
      expect(logCall.eventType).toBe('combat_damage');
      expect(logCall.message).toContain('反弹');
      expect(logCall.message).toContain('10');
      expect(logCall.targetType).toBe('player');
    });

    it('counterStance 反击对玩家造成 50% 伤害', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const bossCtx = makeBossCtxMock();
      const boss = useBossMechanics(state, log, bossCtx);

      const enemy = makeBossEnemy({ id: 'boss-1' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.counterStance = true;
      state.bossInstances.set(enemy.id, bossInstance);

      boss.applyBossCounterMechanics(enemy, 50);

      // counterDamage = Math.floor(50 * 0.5) = 25
      expect(bossCtx.applyDamageToPlayer).toHaveBeenCalledWith(25);
    });

    it('counterStance 反击伤害 = Math.floor(actualDamage * 0.5)', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const bossCtx = makeBossCtxMock();
      const boss = useBossMechanics(state, log, bossCtx);

      const enemy = makeBossEnemy({ id: 'boss-1' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.counterStance = true;
      state.bossInstances.set(enemy.id, bossInstance);

      boss.applyBossCounterMechanics(enemy, 55);

      // counterDamage = Math.floor(55 * 0.5) = Math.floor(27.5) = 27
      expect(bossCtx.applyDamageToPlayer).toHaveBeenCalledWith(27);
    });

    it('counterStance 反击后清除标记', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const bossCtx = makeBossCtxMock();
      const boss = useBossMechanics(state, log, bossCtx);

      const enemy = makeBossEnemy({ id: 'boss-1' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.counterStance = true;
      state.bossInstances.set(enemy.id, bossInstance);

      boss.applyBossCounterMechanics(enemy, 50);

      expect(bossInstance.runtime.counterStance).toBe(false);
    });

    it('reflectDamage + counterStance 同时触发两次 applyDamageToPlayer', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const bossCtx = makeBossCtxMock();
      const boss = useBossMechanics(state, log, bossCtx);

      const enemy = makeBossEnemy({ id: 'boss-1' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.reflectDamage = 0.2;
      bossInstance.runtime.counterStance = true;
      state.bossInstances.set(enemy.id, bossInstance);

      boss.applyBossCounterMechanics(enemy, 50);

      // reflectAmount = Math.floor(50 * 0.2) = 10
      // counterDamage = Math.floor(50 * 0.5) = 25
      expect(bossCtx.applyDamageToPlayer).toHaveBeenCalledTimes(2);
      expect(bossCtx.applyDamageToPlayer).toHaveBeenNthCalledWith(1, 10);
      expect(bossCtx.applyDamageToPlayer).toHaveBeenNthCalledWith(2, 25);
      // 两条日志
      expect(log.addCombatLog).toHaveBeenCalledTimes(2);
      // counterStance 被清除
      expect(bossInstance.runtime.counterStance).toBe(false);
    });

    it('actualDamage <= 0 时不触发反击', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const bossCtx = makeBossCtxMock();
      const boss = useBossMechanics(state, log, bossCtx);

      const enemy = makeBossEnemy({ id: 'boss-1' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.reflectDamage = 0.5;
      bossInstance.runtime.counterStance = true;
      state.bossInstances.set(enemy.id, bossInstance);

      boss.applyBossCounterMechanics(enemy, 0);

      expect(bossCtx.applyDamageToPlayer).not.toHaveBeenCalled();
      expect(log.addCombatLog).not.toHaveBeenCalled();
      // counterStance 未被清除（未进入反击逻辑）
      expect(bossInstance.runtime.counterStance).toBe(true);
    });

    it('非 Boss（bossInstances 无此 id）时不触发反击', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const bossCtx = makeBossCtxMock();
      const boss = useBossMechanics(state, log, bossCtx);

      const enemy = makeNormalEnemy({ id: 'normal-1' });
      // bossInstances 为空

      boss.applyBossCounterMechanics(enemy, 50);

      expect(bossCtx.applyDamageToPlayer).not.toHaveBeenCalled();
      expect(log.addCombatLog).not.toHaveBeenCalled();
    });

    it('reflectDamage 反弹值向下取整为 0 时不造成反伤', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const bossCtx = makeBossCtxMock();
      const boss = useBossMechanics(state, log, bossCtx);

      const enemy = makeBossEnemy({ id: 'boss-1' });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.reflectDamage = 0.01;
      state.bossInstances.set(enemy.id, bossInstance);

      boss.applyBossCounterMechanics(enemy, 50);

      // reflectAmount = Math.floor(50 * 0.01) = Math.floor(0.5) = 0
      expect(bossCtx.applyDamageToPlayer).not.toHaveBeenCalled();
    });
  });

  // -------------------- checkBossRevive --------------------

  describe('checkBossRevive：Boss 复活机制', () => {
    it('canRevive 时恢复 50% HP 并返回 true', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ id: 'boss-1', maxHp: 1000, hp: 0 });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.canRevive = true;
      state.bossInstances.set(enemy.id, bossInstance);

      const result = boss.checkBossRevive(enemy);

      expect(result).toBe(true);
      expect(enemy.hp).toBe(500);
    });

    it('HP 恢复值 = Math.floor(maxHp * 0.5) 向下取整', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ id: 'boss-1', maxHp: 999, hp: 0 });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.canRevive = true;
      state.bossInstances.set(enemy.id, bossInstance);

      boss.checkBossRevive(enemy);

      // Math.floor(999 * 0.5) = Math.floor(499.5) = 499
      expect(enemy.hp).toBe(499);
    });

    it('canRevive 时记录复活日志', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ id: 'boss-1', name: '黑龙', maxHp: 1000, hp: 0 });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.canRevive = true;
      state.bossInstances.set(enemy.id, bossInstance);

      boss.checkBossRevive(enemy);

      expect(log.addCombatLog).toHaveBeenCalledTimes(1);
      const logCall = log.addCombatLog.mock.calls[0][0];
      expect(logCall.message).toContain('复活');
      expect(logCall.message).toContain('50%');
      expect(logCall.targetName).toBe('黑龙');
      expect(logCall.targetId).toBe('boss-1');
    });

    it('canRevive 后标记被清除（不可重复复活）', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ id: 'boss-1', maxHp: 1000, hp: 0 });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.canRevive = true;
      state.bossInstances.set(enemy.id, bossInstance);

      boss.checkBossRevive(enemy);

      expect(bossInstance.runtime.canRevive).toBe(false);

      // 第二次调用不复活
      enemy.hp = 0;
      const result2 = boss.checkBossRevive(enemy);
      expect(result2).toBe(false);
      expect(enemy.hp).toBe(0);
    });

    it('无 canRevive 时返回 false 且不修改 HP', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ id: 'boss-1', maxHp: 1000, hp: 0 });
      const bossInstance = wrapAsBossInstance(enemy);
      // canRevive 未设置（undefined）
      state.bossInstances.set(enemy.id, bossInstance);

      const result = boss.checkBossRevive(enemy);

      expect(result).toBe(false);
      expect(enemy.hp).toBe(0);
      expect(log.addCombatLog).not.toHaveBeenCalled();
    });

    it('canRevive=false 时返回 false', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeBossEnemy({ id: 'boss-1', maxHp: 1000, hp: 0 });
      const bossInstance = wrapAsBossInstance(enemy);
      bossInstance.runtime.canRevive = false;
      state.bossInstances.set(enemy.id, bossInstance);

      const result = boss.checkBossRevive(enemy);

      expect(result).toBe(false);
      expect(enemy.hp).toBe(0);
    });

    it('非 Boss（bossInstances 无此 id）时返回 false', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const boss = useBossMechanics(state, log, makeBossCtxMock());

      const enemy = makeNormalEnemy({ id: 'normal-1', maxHp: 100, hp: 0 });
      // bossInstances 为空

      const result = boss.checkBossRevive(enemy);

      expect(result).toBe(false);
      expect(log.addCombatLog).not.toHaveBeenCalled();
    });
  });
});
