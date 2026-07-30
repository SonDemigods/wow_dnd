/**
 * @fileoverview 战斗日志 Composable（useCombatLog）单元测试
 *
 * 覆盖 useCombatLog 的：
 * 1. addCombatLog：自动填充 combatId/battleLogId/timestamp/turn 字段，并 push 到 state.combatLogs
 * 2. saveLogs：成功时调用 combatDbService.saveCombatLog；失败时捕获异常并 console.error
 * 3. createPlayerEffectContext：从 ctx.character 读取属性构建 EffectContext
 * 4. createEnemyEffectContext：从 EnemyInstance 读取属性构建 EffectContext
 *
 * Mock 策略：
 *  - state 直接构造 minimal mock 对象（combatId/combatLogs/turnCount 为 ref），不依赖真实 useCombatState
 *  - ctx 通过 makeMockCtx 构造 ICombatContext mock（character 域字段供 createPlayerEffectContext 读取）
 *  - enemy 直接传入字面量对象（createEnemyEffectContext 接收参数而非内部调用 store）
 *  - combatDbService mock 模块，断言 saveCombatLog 调用与参数
 *  - generateBattleLogId 走真实路径（generateId 工具函数）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { useCombatLog } from '@/modules/combat/composables/useCombatLog';
import type { CombatLog } from '@/modules/combat/types';
import type { EnemyInstance } from '@/modules/enemy/types';
import type { Attributes, Stats } from '@/modules/character/types';
import type { ICombatContext } from '@/modules/combat/combatContext';

// mock 战斗 DB 服务，避免触碰真实 IndexedDB
vi.mock('@/modules/combat/db', () => ({
  combatDbService: {
    saveCombatLog: vi.fn(),
  },
}));

import { combatDbService } from '@/modules/combat/db';

// ==================== 测试数据构造 helper ====================

/** 构造 minimal state mock（仅包含 useCombatLog 用到的字段） */
function makeStateMock(overrides: Partial<{
  combatId: string;
  combatLogs: CombatLog[];
  turnCount: number;
}> = {}) {
  return {
    combatId: ref(overrides.combatId ?? 'combat-1'),
    combatLogs: ref<CombatLog[]>(overrides.combatLogs ?? []),
    turnCount: ref(overrides.turnCount ?? 0),
    bossInstances: new Map(),
  } as never;
}

/** 构造 ICombatContext mock（仅 character 域字段被 useCombatLog 实际使用） */
function makeMockCtx(overrides: Partial<{
  hp: number;
  maxHp: number;
  attributes: Partial<Attributes>;
}> = {}): ICombatContext {
  return {
    character: {
      name: '英雄',
      classId: 'warrior',
      hp: overrides.hp ?? 80,
      maxHp: overrides.maxHp ?? 100,
      attributes: {
        maxHp: 100,
        maxMana: 50,
        physicalAttack: 20,
        physicalDefense: 10,
        magicAttack: 15,
        magicDefense: 8,
        critChance: 5,
        dodgeChance: 5,
        hpBonus: 0,
        mpBonus: 0,
        healBonus: 0,
        ...overrides.attributes,
      } as Attributes,
      effectiveStats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } as Stats,
      takeDamage: vi.fn(),
      gainExp: vi.fn(),
      gainGold: vi.fn(),
      handleDeath: vi.fn(),
      receiveHeal: vi.fn(),
      changeMp: vi.fn(),
    },
    skill: {
      castSkill: vi.fn(),
      getSkill: vi.fn(),
      tickCooldowns: vi.fn(),
      resetCooldowns: vi.fn(),
    },
    enemy: {
      getEnemyById: vi.fn(),
      deleteEnemy: vi.fn(),
      takeDamage: vi.fn(),
      createEnemy: vi.fn(),
      getAvailableSkills: vi.fn(),
      useSkill: vi.fn(),
      calculateDamage: vi.fn(),
      tickCooldowns: vi.fn(),
    },
    quest: { onEnemyKilled: vi.fn() },
    log: { addLogEntry: vi.fn() },
    inventory: { useItem: vi.fn(), getItemInfo: vi.fn(), addItem: vi.fn() },
  } as unknown as ICombatContext;
}

/** 构造 EnemyInstance mock（仅包含 createEnemyEffectContext 用到的字段） */
function makeEnemyMock(overrides: Partial<EnemyInstance> = {}): EnemyInstance {
  return {
    id: 'e1',
    dataId: 'slime',
    name: '史莱姆',
    icon: 'icon',
    maxHp: 50,
    hp: 30,
    damage: [3, 6],
    xp: 10,
    gold: 5,
    dangerLevel: 'low',
    level: 1,
    stats: { str: 5, dex: 5, con: 5, int: 5, wis: 5, cha: 5 },
    expReward: 10,
    goldReward: 5,
    physicalAttack: 12,
    physicalDefense: 5,
    magicAttack: 8,
    magicDefense: 4,
    ...overrides,
  } as EnemyInstance;
}

// ==================== 测试用例 ====================

describe('useCombatLog - 战斗日志 Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------- addCombatLog --------------------

  describe('addCombatLog：自动填充字段并 push 到日志列表', () => {
    it('自动填充 combatId / battleLogId / timestamp / turn，并保留传入字段', () => {
      const state = makeStateMock({ combatId: 'combat-abc', turnCount: 3 });
      const ctx = makeMockCtx();
      const log = useCombatLog(state, ctx);

      const before = Date.now();
      log.addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: '英雄',
        eventType: 'normal_attack',
        targetType: 'enemy',
        targetId: 'e1',
        targetName: '史莱姆',
        damage: 20,
        isCrit: false,
        isDodge: false,
        message: '对史莱姆造成 20 点伤害',
      });
      const after = Date.now();

      expect(state.combatLogs.value).toHaveLength(1);
      const entry = state.combatLogs.value[0];
      expect(entry.combatId).toBe('combat-abc');
      expect(entry.battleLogId).toEqual(expect.any(String));
      expect(entry.battleLogId.length).toBeGreaterThan(0);
      expect(entry.timestamp).toBeGreaterThanOrEqual(before);
      expect(entry.timestamp).toBeLessThanOrEqual(after);
      expect(entry.turn).toBe(3);
      expect(entry.actorType).toBe('player');
      expect(entry.damage).toBe(20);
      expect(entry.message).toBe('对史莱姆造成 20 点伤害');
    });

    it('多次调用 addCombatLog 顺序追加到 combatLogs', () => {
      const state = makeStateMock();
      const ctx = makeMockCtx();
      const log = useCombatLog(state, ctx);

      log.addCombatLog({ actorType: 'system', actorId: 'sys', actorName: '系统', eventType: 'combat_event', message: '战斗开始' });
      log.addCombatLog({ actorType: 'player', actorId: 'player', actorName: '英雄', eventType: 'normal_attack', message: '攻击' });
      log.addCombatLog({ actorType: 'enemy', actorId: 'e1', actorName: '史莱姆', eventType: 'normal_attack', message: '反击' });

      expect(state.combatLogs.value).toHaveLength(3);
      expect(state.combatLogs.value[0].message).toBe('战斗开始');
      expect(state.combatLogs.value[1].message).toBe('攻击');
      expect(state.combatLogs.value[2].message).toBe('反击');
      // battleLogId 互不相同
      const ids = state.combatLogs.value.map(l => l.battleLogId);
      expect(new Set(ids).size).toBe(3);
    });

    it('turn 字段随 state.turnCount 变化（实时读取）', () => {
      const state = makeStateMock({ turnCount: 1 });
      const ctx = makeMockCtx();
      const log = useCombatLog(state, ctx);

      log.addCombatLog({ actorType: 'player', actorId: 'p', actorName: 'p', eventType: 'normal_attack', message: '回合1' });
      state.turnCount.value = 5;
      log.addCombatLog({ actorType: 'player', actorId: 'p', actorName: 'p', eventType: 'normal_attack', message: '回合5' });

      expect(state.combatLogs.value[0].turn).toBe(1);
      expect(state.combatLogs.value[1].turn).toBe(5);
    });

    it('combatId 字段随 state.combatId 变化（实时读取）', () => {
      const state = makeStateMock({ combatId: 'old-combat' });
      const ctx = makeMockCtx();
      const log = useCombatLog(state, ctx);

      log.addCombatLog({ actorType: 'system', actorId: 'sys', actorName: '系统', eventType: 'combat_event', message: 'a' });
      state.combatId.value = 'new-combat';
      log.addCombatLog({ actorType: 'system', actorId: 'sys', actorName: '系统', eventType: 'combat_event', message: 'b' });

      expect(state.combatLogs.value[0].combatId).toBe('old-combat');
      expect(state.combatLogs.value[1].combatId).toBe('new-combat');
    });
  });

  // -------------------- saveLogs --------------------

  describe('saveLogs：批量持久化战斗日志', () => {
    it('空日志列表不调用 saveCombatLog', async () => {
      const state = makeStateMock({ combatLogs: [] });
      const ctx = makeMockCtx();
      const log = useCombatLog(state, ctx);

      await log.saveLogs();

      expect(combatDbService.saveCombatLog).not.toHaveBeenCalled();
    });

    it('多日志时对每条调用 saveCombatLog，参数为日志对象本身', async () => {
      const logs: CombatLog[] = [
        { combatId: 'c1', battleLogId: 'b1', timestamp: 1, turn: 0, actorType: 'player', actorId: 'p', actorName: 'p', eventType: 'normal_attack', message: 'a' },
        { combatId: 'c1', battleLogId: 'b2', timestamp: 2, turn: 1, actorType: 'enemy', actorId: 'e', actorName: 'e', eventType: 'normal_attack', message: 'b' },
      ];
      const state = makeStateMock({ combatLogs: logs });
      const ctx = makeMockCtx();
      const log = useCombatLog(state, ctx);

      await log.saveLogs();

      expect(combatDbService.saveCombatLog).toHaveBeenCalledTimes(2);
      expect(combatDbService.saveCombatLog).toHaveBeenNthCalledWith(1, logs[0]);
      expect(combatDbService.saveCombatLog).toHaveBeenNthCalledWith(2, logs[1]);
    });

    it('saveCombatLog 抛错时被捕获，console.error 被调用，不向上抛出', async () => {
      vi.mocked(combatDbService.saveCombatLog).mockRejectedValueOnce(new Error('db error'));
      const state = makeStateMock({
        combatLogs: [
          { combatId: 'c1', battleLogId: 'b1', timestamp: 1, turn: 0, actorType: 'system', actorId: 's', actorName: 's', eventType: 'combat_event', message: 'a' } as CombatLog,
        ],
      });
      const ctx = makeMockCtx();
      const log = useCombatLog(state, ctx);
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(log.saveLogs()).resolves.toBeUndefined();

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('保存战斗日志失败'), expect.any(Error));
      spy.mockRestore();
    });

    it('saveLogs 不修改 state.combatLogs 内容（仅读取）', async () => {
      const logs: CombatLog[] = [
        { combatId: 'c1', battleLogId: 'b1', timestamp: 1, turn: 0, actorType: 'system', actorId: 's', actorName: 's', eventType: 'combat_event', message: 'a' } as CombatLog,
      ];
      const state = makeStateMock({ combatLogs: logs });
      const ctx = makeMockCtx();
      const log = useCombatLog(state, ctx);

      await log.saveLogs();

      expect(state.combatLogs.value).toEqual(logs);
      expect(state.combatLogs.value).toHaveLength(1);
    });
  });

  // -------------------- createPlayerEffectContext --------------------

  describe('createPlayerEffectContext：构建玩家效果上下文', () => {
    it('从 ctx.character 读取属性构建 EffectContext', () => {
      const state = makeStateMock();
      const ctx = makeMockCtx({
        hp: 75,
        maxHp: 120,
        attributes: { physicalAttack: 30, physicalDefense: 15, magicAttack: 20, magicDefense: 10 } as Attributes,
      });
      const log = useCombatLog(state, ctx);

      const effectCtx = log.createPlayerEffectContext();

      expect(effectCtx.ownerId).toBe('player');
      expect(effectCtx.ownerType).toBe('player');
      expect(effectCtx.currentHp).toBe(75);
      expect(effectCtx.maxHp).toBe(120);
      expect(effectCtx.baseStats.physicalAttack).toBe(30);
      expect(effectCtx.baseStats.physicalDefense).toBe(15);
      expect(effectCtx.baseStats.magicAttack).toBe(20);
      expect(effectCtx.baseStats.magicDefense).toBe(10);
      // P1-8 修复：speed 使用 effectiveStats.dex，与 useInitiative 先攻计算一致
      expect(effectCtx.baseStats.speed).toBe(10);
    });

    it('不同 characterMock 实例返回独立上下文', () => {
      const ctx1 = makeMockCtx({ hp: 50, maxHp: 100 });
      const ctx2 = makeMockCtx({ hp: 80, maxHp: 200 });
      const log1 = useCombatLog(makeStateMock(), ctx1);
      const log2 = useCombatLog(makeStateMock(), ctx2);

      const effectCtx1 = log1.createPlayerEffectContext();
      const effectCtx2 = log2.createPlayerEffectContext();

      expect(effectCtx1.currentHp).toBe(50);
      expect(effectCtx1.maxHp).toBe(100);
      expect(effectCtx2.currentHp).toBe(80);
      expect(effectCtx2.maxHp).toBe(200);
    });
  });

  // -------------------- createEnemyEffectContext --------------------

  describe('createEnemyEffectContext：构建敌人效果上下文', () => {
    it('从 EnemyInstance 读取属性构建 EffectContext', () => {
      const state = makeStateMock();
      const ctx = makeMockCtx();
      const log = useCombatLog(state, ctx);
      const enemy = makeEnemyMock({
        id: 'boss-1',
        hp: 500,
        maxHp: 1000,
        physicalAttack: 50,
        physicalDefense: 25,
        magicAttack: 40,
        magicDefense: 20,
      });

      const effectCtx = log.createEnemyEffectContext(enemy);

      expect(effectCtx.ownerId).toBe('boss-1');
      expect(effectCtx.ownerType).toBe('enemy');
      expect(effectCtx.currentHp).toBe(500);
      expect(effectCtx.maxHp).toBe(1000);
      expect(effectCtx.baseStats.physicalAttack).toBe(50);
      expect(effectCtx.baseStats.physicalDefense).toBe(25);
      expect(effectCtx.baseStats.magicAttack).toBe(40);
      expect(effectCtx.baseStats.magicDefense).toBe(20);
      // P1-8 修复：speed 使用 enemy.stats.dex，与 useInitiative 先攻计算一致
      expect(effectCtx.baseStats.speed).toBe(5);
    });

    it('敌人属性缺失时回退为 0（|| 0 兜底）', () => {
      const state = makeStateMock();
      const ctx = makeMockCtx();
      const log = useCombatLog(state, ctx);
      const enemy = makeEnemyMock({
        physicalAttack: undefined,
        physicalDefense: undefined,
        magicAttack: undefined,
        magicDefense: undefined,
      });

      const effectCtx = log.createEnemyEffectContext(enemy);

      expect(effectCtx.baseStats.physicalAttack).toBe(0);
      expect(effectCtx.baseStats.physicalDefense).toBe(0);
      expect(effectCtx.baseStats.magicAttack).toBe(0);
      expect(effectCtx.baseStats.magicDefense).toBe(0);
    });

    it('不同敌人返回独立上下文', () => {
      const state = makeStateMock();
      const ctx = makeMockCtx();
      const log = useCombatLog(state, ctx);
      const e1 = makeEnemyMock({ id: 'e1', hp: 30 });
      const e2 = makeEnemyMock({ id: 'e2', hp: 60 });

      const effectCtx1 = log.createEnemyEffectContext(e1);
      const effectCtx2 = log.createEnemyEffectContext(e2);

      expect(effectCtx1.ownerId).toBe('e1');
      expect(effectCtx1.currentHp).toBe(30);
      expect(effectCtx2.ownerId).toBe('e2');
      expect(effectCtx2.currentHp).toBe(60);
    });
  });
});
