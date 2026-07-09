/**
 * @fileoverview 先攻排序与回合推进 Composable（useInitiative）单元测试
 *
 * 覆盖 useInitiative 的：
 * 1. assignEnemyPositions：纯函数，3×2 网格位置分配
 *    - Boss 优先后排
 *    - 普通敌人优先前排，溢出后排
 * 2. advanceTurn：先攻索引推进 + turnCount 累加（回绕到 0 时）
 * 3. toggleCombatSpeed：1x ↔ 2x 切换
 * 4. buildInitiativeOrder / advanceToNextUnit / endPlayerTurn：smoke test
 *    - 验证返回值结构正确
 *    - 验证基本状态变更（不深入复杂业务逻辑）
 *
 * Mock 策略：
 *  - useCharacterStore / useSkillStore mock 模块（内部调用）
 *  - eventBus / boss engine mock 模块（避免触发真实事件/引擎）
 *  - state / log / enemyAction / boss / passive 构造 minimal mock
 *  - endCombat 直接传入 vi.fn()
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref, computed } from 'vue';
import { useInitiative } from '@/modules/combat/composables/useInitiative';
import { createEmptyContainer, type EffectContainer } from '@/modules/combat/effects';
import type { EnemyInstance } from '@/modules/enemy/types';
import type { CombatResult } from '@/modules/combat/types';
import type { Stats } from '@/modules/character/types';
import type { ICombatContext } from '@/modules/combat/combatContext';

// mock characterStore
vi.mock('@/modules/character/store', () => ({
  useCharacterStore: vi.fn(() => ({
    name: '英雄',
    effectiveStats: { dex: 10 } as never,
    attributes: { physicalAttack: 20, physicalDefense: 10, magicAttack: 15, magicDefense: 8 } as never,
    hp: 100,
    maxHp: 100,
  })),
}));

// mock skillStore（advanceToNextUnit 中调用 tickCooldowns）
vi.mock('@/modules/skill/store', () => ({
  useSkillStore: vi.fn(() => ({ tickCooldowns: vi.fn() })),
}));

// mock enemyStore
vi.mock('@/modules/enemy/store', () => ({
  useEnemyStore: vi.fn(() => ({ getEnemyById: vi.fn(() => null) })),
}));

// mock eventBus 避免触发真实监听器
vi.mock('@/modules/bus', () => ({
  eventBus: { emit: vi.fn() },
  GameEvents: { COMBAT_TURN_END: 'combat:turn:end' },
}));

// mock boss engine 避免触发真实阶段机制
vi.mock('@/modules/boss/engine', () => ({
  processBossPhaseMechanics: vi.fn(),
  applyPhaseStats: vi.fn(),
}));

// ==================== 测试数据构造 helper ====================

function makeEnemy(o: Partial<EnemyInstance> = {}): EnemyInstance {
  return {
    id: 'e1',
    dataId: 'slime',
    name: '史莱姆',
    icon: 'icon',
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

function makeStateMock() {
  return {
    state: ref<'idle' | 'fighting' | 'victory' | 'defeat' | 'flee'>('fighting'),
    enemyIds: ref<string[]>([]),
    targetEnemyId: ref<string | null>(null),
    turn: ref<'player' | 'enemy'>('player'),
    turnCount: ref(0),
    combatId: ref('combat-1'),
    combatLogs: ref<unknown[]>([]),
    combatResult: ref<CombatResult | null>(null),
    expGained: ref(0),
    goldGained: ref(0),
    initiativeOrder: ref<string[]>([]),
    currentInitiativeIndex: ref(0),
    combatSpeed: ref<1 | 2>(1),
    playerEffects: ref<EffectContainer>(createEmptyContainer()),
    enemyEffects: ref<Record<string, EffectContainer>>({}),
    enemyPositions: ref<Record<string, { row: 'front' | 'back'; col: number }>>({}),
    bossPhaseManagers: new Map<string, unknown>(),
    effectRegistry: {
      reduceSum: vi.fn(() => 0),
    },
    enemies: computed(() => []),
    aliveEnemies: computed(() => []),
    hasBossEnemy: computed(() => false),
    turnTimerId: ref<number | null>(null),
  } as never;
}

function makeLogMock() {
  return {
    addCombatLog: vi.fn(),
    saveLogs: vi.fn().mockResolvedValue(undefined),
    createPlayerEffectContext: vi.fn(() => ({ ownerId: 'player', ownerType: 'player', baseStats: { speed: 0 }, currentHp: 100, maxHp: 100 })),
    createEnemyEffectContext: vi.fn(() => ({ ownerId: 'e1', ownerType: 'enemy', baseStats: { speed: 0 }, currentHp: 50, maxHp: 50 })),
  } as never;
}

/** 构造 ICombatContext mock（character/skill/enemy 域字段供 useInitiative 实际使用） */
function makeMockCtx(opts: {
  characterEffectiveStats?: Partial<Stats>;
} = {}): ICombatContext {
  return {
    character: {
      name: '英雄',
      classId: 'warrior',
      hp: 100,
      maxHp: 100,
      attributes: { physicalAttack: 20, physicalDefense: 10, magicAttack: 15, magicDefense: 8 } as never,
      effectiveStats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...opts.characterEffectiveStats } as never,
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
      getEnemyById: vi.fn(() => null),
      deleteEnemy: vi.fn(),
      takeDamage: vi.fn(),
      createEnemy: vi.fn(),
      getAvailableSkills: vi.fn(() => []),
      useSkill: vi.fn(() => ({ success: false, damage: 0, isHeal: false })),
      calculateDamage: vi.fn(() => 10),
      tickCooldowns: vi.fn(),
    },
    quest: { onEnemyKilled: vi.fn() },
    log: { addLogEntry: vi.fn() },
    inventory: { useItem: vi.fn(), getItemInfo: vi.fn(), addItem: vi.fn() },
  } as unknown as ICombatContext;
}

function makeEnemyActionMock() {
  return {
    enemyAction: vi.fn(),
    applyEnemyDamageToPlayer: vi.fn(),
    enemyBasicAttack: vi.fn(),
    enemyAttackWithSkill: vi.fn(),
    getStrategy: vi.fn(),
  } as never;
}

function makeBossMock() {
  return {
    initBossFeatures: vi.fn(),
    applyMechanicEffect: vi.fn(),
    scaleBossEffectValue: vi.fn(),
  } as never;
}

function makePassiveMock() {
  return {
    loadPassives: vi.fn(),
    onCombatStart: vi.fn(),
    onTurnStart: vi.fn(),
    onAttack: vi.fn(),
    onDamaged: vi.fn(),
    onKill: vi.fn(),
    getPassives: vi.fn(() => []),
    getDamageReduction: vi.fn(() => 0),
    getStatModifiers: vi.fn(() => []),
  } as never;
}

// ==================== 测试用例 ====================

describe('useInitiative - 先攻排序与回合推进 Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------- assignEnemyPositions（纯函数） --------------------

  describe('assignEnemyPositions：3×2 网格位置分配', () => {
    it('Boss 优先占后排，普通敌人优先填前排', () => {
      const state = makeStateMock();
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      const boss = makeEnemy({ id: 'boss-1', isBoss: true });
      const e1 = makeEnemy({ id: 'e1' });
      const e2 = makeEnemy({ id: 'e2' });

      init.assignEnemyPositions([boss, e1, e2]);

      const positions = state.enemyPositions.value;
      // Boss 在后排
      expect(positions['boss-1'].row).toBe('back');
      // 普通敌人在前排
      expect(positions['e1'].row).toBe('front');
      expect(positions['e2'].row).toBe('front');
    });

    it('前排满后普通敌人填后排', () => {
      const state = makeStateMock();
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      const enemies = [
        makeEnemy({ id: 'e1' }),
        makeEnemy({ id: 'e2' }),
        makeEnemy({ id: 'e3' }),
        makeEnemy({ id: 'e4' }), // 前排满，应进后排
      ];
      init.assignEnemyPositions(enemies);

      const positions = state.enemyPositions.value;
      expect(positions['e1'].row).toBe('front');
      expect(positions['e2'].row).toBe('front');
      expect(positions['e3'].row).toBe('front');
      expect(positions['e4'].row).toBe('back');
    });

    it('多个 Boss 各占后排一个位置', () => {
      const state = makeStateMock();
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      const b1 = makeEnemy({ id: 'b1', isBoss: true });
      const b2 = makeEnemy({ id: 'b2', isBoss: true });

      init.assignEnemyPositions([b1, b2]);

      expect(state.enemyPositions.value['b1'].row).toBe('back');
      expect(state.enemyPositions.value['b2'].row).toBe('back');
      // col 互不相同
      expect(state.enemyPositions.value['b1'].col).not.toBe(state.enemyPositions.value['b2'].col);
    });

    it('空敌人列表时位置映射为空对象', () => {
      const state = makeStateMock();
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.assignEnemyPositions([]);

      expect(state.enemyPositions.value).toEqual({});
    });

    it('每个敌人 col ∈ {0, 1, 2}', () => {
      const state = makeStateMock();
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      const enemies = Array.from({ length: 6 }, (_, i) =>
        makeEnemy({ id: `e${i}`, isBoss: i < 2 })
      );
      init.assignEnemyPositions(enemies);

      for (const e of enemies) {
        const pos = state.enemyPositions.value[e.id];
        expect(pos.row).toMatch(/^(front|back)$/);
        expect(pos.col).toBeGreaterThanOrEqual(0);
        expect(pos.col).toBeLessThanOrEqual(2);
      }
    });
  });

  // -------------------- advanceTurn --------------------

  describe('advanceTurn：先攻索引推进', () => {
    it('推进索引并返回当前行动者', () => {
      const state = makeStateMock();
      state.initiativeOrder.value = ['player', 'e1', 'e2'];
      state.currentInitiativeIndex.value = 0;
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      const result = init.advanceTurn();

      expect(state.currentInitiativeIndex.value).toBe(1);
      expect(result.unitId).toBe('e1');
      expect(result.isPlayer).toBe(false);
    });

    it('索引回绕到 0 时 turnCount +1', () => {
      const state = makeStateMock();
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 1;
      state.turnCount.value = 0;
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      const result = init.advanceTurn();

      expect(state.currentInitiativeIndex.value).toBe(0);
      expect(state.turnCount.value).toBe(1);
      expect(result.unitId).toBe('player');
      expect(result.isPlayer).toBe(true);
    });

    it('识别玩家单位（unitId === "player"）', () => {
      const state = makeStateMock();
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 0;
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      const r1 = init.advanceTurn();
      expect(r1.isPlayer).toBe(false);

      state.currentInitiativeIndex.value = 0;
      const r2 = init.advanceTurn();
      // 推进到 e1
      expect(r2.isPlayer).toBe(false);
    });
  });

  // -------------------- toggleCombatSpeed --------------------

  describe('toggleCombatSpeed：1x ↔ 2x 切换', () => {
    it('1 → 2', () => {
      const state = makeStateMock();
      state.combatSpeed.value = 1;
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.toggleCombatSpeed();

      expect(state.combatSpeed.value).toBe(2);
    });

    it('2 → 1', () => {
      const state = makeStateMock();
      state.combatSpeed.value = 2;
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.toggleCombatSpeed();

      expect(state.combatSpeed.value).toBe(1);
    });

    it('多次切换在 1 和 2 间循环', () => {
      const state = makeStateMock();
      state.combatSpeed.value = 1;
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.toggleCombatSpeed();
      expect(state.combatSpeed.value).toBe(2);
      init.toggleCombatSpeed();
      expect(state.combatSpeed.value).toBe(1);
      init.toggleCombatSpeed();
      expect(state.combatSpeed.value).toBe(2);
    });
  });

  // -------------------- buildInitiativeOrder（smoke test） --------------------

  describe('buildInitiativeOrder：构建先攻顺序（smoke test）', () => {
    it('按速度降序排列玩家与敌人，结果写入 initiativeOrder', () => {
      const state = makeStateMock();
      // 模拟 enemies 计算属性返回敌人列表
      const e1 = makeEnemy({ id: 'e1', stats: { str: 5, dex: 8, con: 5, int: 5, wis: 5, cha: 5 } });
      const e2 = makeEnemy({ id: 'e2', stats: { str: 5, dex: 3, con: 5, int: 5, wis: 5, cha: 5 } });
      state.enemies = computed(() => [e1, e2]);
      // 玩家速度：effectiveStats.dex(10) + speedMod(0) = 10
      state.initiativeOrder.value = [];

      // buildInitiativeOrder 已改为无参函数：玩家速度从 ctx.character.effectiveStats 读取
      const ctx = makeMockCtx({ characterEffectiveStats: { dex: 10 } });
      const init = useInitiative(state, makeLogMock(), ctx, makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.buildInitiativeOrder();

      // 期望顺序：player(10) > e1(8) > e2(3)
      expect(state.initiativeOrder.value).toEqual(['player', 'e1', 'e2']);
      // currentInitiativeIndex 设为 player 的位置
      expect(state.currentInitiativeIndex.value).toBe(0);
    });

    it('玩家速度最高时排在第一位', () => {
      const state = makeStateMock();
      const slowEnemy = makeEnemy({ id: 'slow', stats: { str: 5, dex: 2, con: 5, int: 5, wis: 5, cha: 5 } });
      state.enemies = computed(() => [slowEnemy]);

      // buildInitiativeOrder 已改为无参函数：玩家速度从 ctx.character.effectiveStats 读取
      const ctx = makeMockCtx({ characterEffectiveStats: { dex: 15 } });
      const init = useInitiative(state, makeLogMock(), ctx, makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());
      init.buildInitiativeOrder();

      expect(state.initiativeOrder.value[0]).toBe('player');
    });
  });

  // -------------------- endPlayerTurn（smoke test） --------------------

  describe('endPlayerTurn：结束玩家回合（smoke test）', () => {
    it('调用 saveLogs 并推进到下一单位', () => {
      const state = makeStateMock();
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 0;
      const log = makeLogMock();
      const ctx = makeMockCtx();
      const init = useInitiative(state, log, ctx, makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.endPlayerTurn();

      expect(log.saveLogs).toHaveBeenCalled();
      // 索引推进到 1（e1）
      expect(state.currentInitiativeIndex.value).toBe(1);
    });
  });

  // -------------------- 返回值结构 --------------------

  describe('返回值结构', () => {
    it('返回包含 7 个方法的对象', () => {
      const init = useInitiative(makeStateMock(), makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());
      expect(typeof init.assignEnemyPositions).toBe('function');
      expect(typeof init.buildInitiativeOrder).toBe('function');
      expect(typeof init.advanceTurn).toBe('function');
      expect(typeof init.toggleCombatSpeed).toBe('function');
      expect(typeof init.advanceToNextUnit).toBe('function');
      expect(typeof init.singleEnemyTurn).toBe('function');
      expect(typeof init.endPlayerTurn).toBe('function');
    });
  });
});
