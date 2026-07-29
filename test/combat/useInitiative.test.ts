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
import { processBossPhaseMechanics, applyPhaseStats } from '@/modules/boss/engine';
import type { EnemyInstance, BossPhase } from '@/modules/enemy/types';
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
  GameEvents: {
    COMBAT_TURN_END: 'combat:turn:end',
    COMBAT_PLAYER_TURN: 'combat_player_turn',
    COMBAT_BOSS_PHASE: 'combat_boss_phase',
  },
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
    resourceSystems: ref<unknown[]>([]),
    effectRegistry: {
      reduceSum: vi.fn(() => 0),
      tickAll: vi.fn(() => ({ expiredIds: [], dotDamage: 0, regenAmount: 0 })),
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

  // -------------------- advanceTurn：空数组防御 --------------------

  describe('advanceTurn：空数组防御', () => {
    it('initiativeOrder 为空时返回空 unitId 且不推进索引', () => {
      const state = makeStateMock();
      state.initiativeOrder.value = [];
      state.currentInitiativeIndex.value = 0;
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      const result = init.advanceTurn();

      expect(result.unitId).toBe('');
      expect(result.isPlayer).toBe(false);
      // 索引不变（取模运算未执行）
      expect(state.currentInitiativeIndex.value).toBe(0);
    });
  });

  // -------------------- advanceToNextUnit --------------------

  describe('advanceToNextUnit：推进到下一行动者', () => {
    it('state 非 fighting 时直接 return 不推进', () => {
      const state = makeStateMock();
      state.state.value = 'idle';
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 0;
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.advanceToNextUnit();

      // 索引未推进
      expect(state.currentInitiativeIndex.value).toBe(0);
    });

    it('推进到玩家回合时设置 turn=player 并触发 tickCooldowns/onTurnStart/emit', () => {
      const state = makeStateMock();
      state.initiativeOrder.value = ['e1', 'player'];
      state.currentInitiativeIndex.value = 0; // 当前 e1
      const resourceOnTurnStart = vi.fn();
      state.resourceSystems.value = [{ onTurnStart: resourceOnTurnStart }];
      const ctx = makeMockCtx();
      const passive = makePassiveMock();
      const init = useInitiative(state, makeLogMock(), ctx, makeEnemyActionMock(), makeBossMock(), vi.fn(), passive);

      init.advanceToNextUnit();

      // 推进到索引 1（player）
      expect(state.currentInitiativeIndex.value).toBe(1);
      expect(state.turn.value).toBe('player');
      expect(ctx.skill.tickCooldowns).toHaveBeenCalled();
      expect(resourceOnTurnStart).toHaveBeenCalled();
      expect(passive.onTurnStart).toHaveBeenCalled();
    });

    it('推进到敌人回合时设置 turn=enemy 并启动 setTimeout 调度', () => {
      vi.useFakeTimers();
      const state = makeStateMock();
      const enemy = makeEnemy({ id: 'e1', hp: 50 });
      state.enemies = computed(() => [enemy]);
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 0; // 当前 player
      const ctx = makeMockCtx();
      const enemyAction = makeEnemyActionMock();
      const init = useInitiative(state, makeLogMock(), ctx, enemyAction, makeBossMock(), vi.fn(), makePassiveMock());

      init.advanceToNextUnit();

      // 推进到索引 1（e1，enemy）
      expect(state.currentInitiativeIndex.value).toBe(1);
      expect(state.turn.value).toBe('enemy');
      expect(state.turnTimerId.value).not.toBeNull();

      // 推进 timer，触发 singleEnemyTurn
      vi.advanceTimersByTime(500);
      expect(enemyAction.enemyAction).toHaveBeenCalled();
      // timer 已清空
      expect(state.turnTimerId.value).toBeNull();

      vi.useRealTimers();
    });

    it('combatSpeed=2 时 setTimeout 延迟减半（250ms）', () => {
      vi.useFakeTimers();
      const state = makeStateMock();
      const enemy = makeEnemy({ id: 'e1', hp: 50 });
      state.enemies = computed(() => [enemy]);
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 0;
      state.combatSpeed.value = 2;
      const ctx = makeMockCtx();
      const enemyAction = makeEnemyActionMock();
      const init = useInitiative(state, makeLogMock(), ctx, enemyAction, makeBossMock(), vi.fn(), makePassiveMock());

      init.advanceToNextUnit();

      // 2x 速度下延迟为 250ms，249ms 不足以触发
      vi.advanceTimersByTime(249);
      expect(enemyAction.enemyAction).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(enemyAction.enemyAction).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('先攻索引回绕到 0 时触发 tickAllEffects 并 turnCount+1', () => {
      const state = makeStateMock();
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 1; // 当前 e1，推进后回绕到 0
      const ctx = makeMockCtx();
      const init = useInitiative(state, makeLogMock(), ctx, makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.advanceToNextUnit();

      // 索引回绕到 0，触发 tickAllEffects
      expect(state.currentInitiativeIndex.value).toBe(0);
      expect(state.effectRegistry.tickAll).toHaveBeenCalled();
      expect(state.turnCount.value).toBe(1);
    });

    it('resourceSystems 中 onTurnStart 为空时安全跳过（可选链）', () => {
      const state = makeStateMock();
      state.initiativeOrder.value = ['e1', 'player'];
      state.currentInitiativeIndex.value = 0;
      // onTurnStart 为 undefined 的资源系统
      state.resourceSystems.value = [{ onTurnStart: undefined }];
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      expect(() => init.advanceToNextUnit()).not.toThrow();
    });

    it('passive 未传入时不调用 onTurnStart（可选链）', () => {
      const state = makeStateMock();
      state.initiativeOrder.value = ['e1', 'player'];
      state.currentInitiativeIndex.value = 0;
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn());

      expect(() => init.advanceToNextUnit()).not.toThrow();
      expect(state.turn.value).toBe('player');
    });
  });

  // -------------------- tickAllEffects --------------------

  describe('tickAllEffects：效果 tick 处理', () => {
    it('player dotDamage>0 时调用 takeDamage 并记录伤害日志', () => {
      const state = makeStateMock();
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 1; // 推进后回绕到 0
      const ctx = makeMockCtx();
      vi.mocked(state.effectRegistry.tickAll).mockReturnValue({ expiredIds: [], dotDamage: 15, regenAmount: 0 });
      const log = makeLogMock();
      const init = useInitiative(state, log, ctx, makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.advanceToNextUnit();

      expect(ctx.character.takeDamage).toHaveBeenCalledWith(15);
      expect(log.addCombatLog).toHaveBeenCalledWith(expect.objectContaining({ damage: 15, eventType: 'combat_damage' }));
    });

    it('player regenAmount>0 时调用 receiveHeal 并记录恢复日志', () => {
      const state = makeStateMock();
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 1;
      const ctx = makeMockCtx();
      vi.mocked(state.effectRegistry.tickAll).mockReturnValue({ expiredIds: [], dotDamage: 0, regenAmount: 20 });
      const log = makeLogMock();
      const init = useInitiative(state, log, ctx, makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.advanceToNextUnit();

      expect(ctx.character.receiveHeal).toHaveBeenCalledWith(20);
      expect(log.addCombatLog).toHaveBeenCalledWith(expect.objectContaining({ heal: 20, eventType: 'combat_heal' }));
    });

    it('enemy dotDamage>0 且敌人存在时调用 takeDamage 并记录日志', () => {
      const state = makeStateMock();
      const enemy = makeEnemy({ id: 'e1', hp: 50, maxHp: 50 });
      state.enemies = computed(() => [enemy]);
      state.enemyEffects.value = { e1: createEmptyContainer() };
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 1;
      const ctx = makeMockCtx();
      ctx.enemy.getEnemyById = vi.fn(() => enemy);
      // regen 通过 takeDamage(eId, -regenAmount) 实现，mock 需要真正修改 hp
      ctx.enemy.takeDamage = vi.fn((id: string, damage: number) => {
        const target = [enemy].find(e => e.id === id);
        if (target) {
          target.hp = Math.max(0, Math.min(target.maxHp, target.hp - damage));
        }
        return false;
      });
      // tickAll 第一次（player）返回 0，第二次（enemy e1）返回 dotDamage
      vi.mocked(state.effectRegistry.tickAll)
        .mockReturnValueOnce({ expiredIds: [], dotDamage: 0, regenAmount: 0 })
        .mockReturnValueOnce({ expiredIds: [], dotDamage: 12, regenAmount: 0 });
      const log = makeLogMock();
      const init = useInitiative(state, log, ctx, makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.advanceToNextUnit();

      expect(ctx.enemy.takeDamage).toHaveBeenCalledWith('e1', 12);
      expect(log.addCombatLog).toHaveBeenCalledWith(expect.objectContaining({ damage: 12, targetId: 'e1' }));
    });

    it('enemy regenAmount>0 且敌人存在时增加 hp 并记录恢复日志', () => {
      const state = makeStateMock();
      const enemy = makeEnemy({ id: 'e1', hp: 30, maxHp: 50 });
      state.enemies = computed(() => [enemy]);
      state.enemyEffects.value = { e1: createEmptyContainer() };
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 1;
      const ctx = makeMockCtx();
      ctx.enemy.getEnemyById = vi.fn(() => enemy);
      // regen 通过 takeDamage(eId, -regenAmount) 实现，mock 需要真正修改 hp
      ctx.enemy.takeDamage = vi.fn((id: string, damage: number) => {
        const target = [enemy].find(e => e.id === id);
        if (target) {
          target.hp = Math.max(0, Math.min(target.maxHp, target.hp - damage));
        }
        return false;
      });
      vi.mocked(state.effectRegistry.tickAll)
        .mockReturnValueOnce({ expiredIds: [], dotDamage: 0, regenAmount: 0 })
        .mockReturnValueOnce({ expiredIds: [], dotDamage: 0, regenAmount: 10 });
      const log = makeLogMock();
      const init = useInitiative(state, log, ctx, makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.advanceToNextUnit();

      // hp 增加，但不超过 maxHp
      expect(enemy.hp).toBe(40);
      expect(log.addCombatLog).toHaveBeenCalledWith(expect.objectContaining({ heal: 10, targetId: 'e1' }));
    });

    it('enemy regenAmount>0 时 hp 不超过 maxHp', () => {
      const state = makeStateMock();
      const enemy = makeEnemy({ id: 'e1', hp: 48, maxHp: 50 });
      state.enemies = computed(() => [enemy]);
      state.enemyEffects.value = { e1: createEmptyContainer() };
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 1;
      const ctx = makeMockCtx();
      ctx.enemy.getEnemyById = vi.fn(() => enemy);
      // regen 通过 takeDamage(eId, -regenAmount) 实现，mock 需要真正修改 hp
      ctx.enemy.takeDamage = vi.fn((id: string, damage: number) => {
        const target = [enemy].find(e => e.id === id);
        if (target) {
          target.hp = Math.max(0, Math.min(target.maxHp, target.hp - damage));
        }
        return false;
      });
      vi.mocked(state.effectRegistry.tickAll)
        .mockReturnValueOnce({ expiredIds: [], dotDamage: 0, regenAmount: 0 })
        .mockReturnValueOnce({ expiredIds: [], dotDamage: 0, regenAmount: 10 });
      const init = useInitiative(state, makeLogMock(), ctx, makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.advanceToNextUnit();

      // hp 被 maxHp 限制为 50
      expect(enemy.hp).toBe(50);
    });

    it('已死亡敌人（hp<=0）的效果容器被清理', () => {
      const state = makeStateMock();
      const deadEnemy = makeEnemy({ id: 'e1', hp: 0, maxHp: 50 });
      state.enemies = computed(() => [deadEnemy]);
      state.enemyEffects.value = { e1: createEmptyContainer() };
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 1;
      const ctx = makeMockCtx();
      ctx.enemy.getEnemyById = vi.fn(() => deadEnemy);
      const init = useInitiative(state, makeLogMock(), ctx, makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.advanceToNextUnit();

      // e1 因 hp<=0 被加入 deadEnemyIds，效果容器被删除
      expect(state.enemyEffects.value.e1).toBeUndefined();
    });

    it('敌人不存在（getEnemyById 返回 null）时效果容器被清理', () => {
      const state = makeStateMock();
      state.enemies = computed(() => []);
      state.enemyEffects.value = { ghostE1: createEmptyContainer() };
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 1;
      const ctx = makeMockCtx();
      ctx.enemy.getEnemyById = vi.fn(() => null);
      const init = useInitiative(state, makeLogMock(), ctx, makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.advanceToNextUnit();

      expect(state.enemyEffects.value.ghostE1).toBeUndefined();
    });

    it('character.hp<=0 时调用 endCombat("defeat") 并 saveLogs', () => {
      const state = makeStateMock();
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 1;
      const ctx = makeMockCtx();
      ctx.character.hp = 0; // 玩家已死亡
      const log = makeLogMock();
      const endCombat = vi.fn();
      const init = useInitiative(state, log, ctx, makeEnemyActionMock(), makeBossMock(), endCombat, makePassiveMock());

      init.advanceToNextUnit();

      expect(endCombat).toHaveBeenCalledWith('defeat');
      // P2-37 修复：tickAllEffects 中移除了重复的 saveLogs 调用，由 endCombat 内部统一处理
      // 此处 endCombat 为 mock，不会调用 saveLogs；真实 endCombat 会调用
    });

    it('所有敌人 hp<=0 时调用 endCombat("victory")', () => {
      const state = makeStateMock();
      const deadEnemy = makeEnemy({ id: 'e1', hp: 0, maxHp: 50 });
      state.enemies = computed(() => [deadEnemy]);
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 1;
      const ctx = makeMockCtx();
      ctx.character.hp = 100;
      const endCombat = vi.fn();
      const init = useInitiative(state, makeLogMock(), ctx, makeEnemyActionMock(), makeBossMock(), endCombat, makePassiveMock());

      init.advanceToNextUnit();

      expect(endCombat).toHaveBeenCalledWith('victory');
    });

    it('enemies 为空数组时不触发 victory（length>0 守卫）', () => {
      const state = makeStateMock();
      state.enemies = computed(() => []);
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 1;
      const ctx = makeMockCtx();
      ctx.character.hp = 100;
      const endCombat = vi.fn();
      const init = useInitiative(state, makeLogMock(), ctx, makeEnemyActionMock(), makeBossMock(), endCombat, makePassiveMock());

      init.advanceToNextUnit();

      // enemies 为空，不触发 victory
      expect(endCombat).not.toHaveBeenCalled();
    });

    it('dotDamage 与 regenAmount 同时为 0 时不调用 takeDamage/receiveHeal', () => {
      const state = makeStateMock();
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 1;
      const ctx = makeMockCtx();
      vi.mocked(state.effectRegistry.tickAll).mockReturnValue({ expiredIds: [], dotDamage: 0, regenAmount: 0 });
      const init = useInitiative(state, makeLogMock(), ctx, makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.advanceToNextUnit();

      expect(ctx.character.takeDamage).not.toHaveBeenCalled();
      expect(ctx.character.receiveHeal).not.toHaveBeenCalled();
    });
  });

  // -------------------- singleEnemyTurn --------------------

  describe('singleEnemyTurn：单个敌人回合', () => {
    it('state 非 fighting 时直接 return', () => {
      const state = makeStateMock();
      state.state.value = 'idle';
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 0;
      const enemyAction = makeEnemyActionMock();
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), enemyAction, makeBossMock(), vi.fn(), makePassiveMock());

      init.singleEnemyTurn('e1');

      expect(enemyAction.enemyAction).not.toHaveBeenCalled();
    });

    it('敌人不存在于 enemies 列表时推进到下一单位', () => {
      const state = makeStateMock();
      state.enemies = computed(() => []);
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 0;
      const enemyAction = makeEnemyActionMock();
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), enemyAction, makeBossMock(), vi.fn(), makePassiveMock());

      init.singleEnemyTurn('e1');

      // enemyAction 未被调用（敌人不存在）
      expect(enemyAction.enemyAction).not.toHaveBeenCalled();
    });

    it('敌人 hp<=0 时从先攻序列移除并清理效果容器', () => {
      const state = makeStateMock();
      const deadEnemy = makeEnemy({ id: 'e1', hp: 0 });
      state.enemies = computed(() => [deadEnemy]);
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 1; // 当前指向 e1
      state.enemyEffects.value = { e1: createEmptyContainer() };
      const enemyAction = makeEnemyActionMock();
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), enemyAction, makeBossMock(), vi.fn(), makePassiveMock());

      init.singleEnemyTurn('e1');

      // e1 从先攻序列移除
      expect(state.initiativeOrder.value).not.toContain('e1');
      // 效果容器被清理
      expect(state.enemyEffects.value.e1).toBeUndefined();
      // enemyAction 未被调用
      expect(enemyAction.enemyAction).not.toHaveBeenCalled();
    });

    it('敌人 hp<=0 且移除索引在当前索引之前时递减当前索引', () => {
      const state = makeStateMock();
      const deadEnemy = makeEnemy({ id: 'e1', hp: 0 });
      state.enemies = computed(() => [deadEnemy]);
      state.initiativeOrder.value = ['player', 'e1', 'e2'];
      state.currentInitiativeIndex.value = 2; // 当前指向 e2
      state.enemyEffects.value = { e1: createEmptyContainer() };
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.singleEnemyTurn('e1');

      // e1 从先攻序列移除
      expect(state.initiativeOrder.value).toEqual(['player', 'e2']);
      // e1 在索引 1，当前索引 2，移除后递减为 1（e2）
      // 然后 advanceToNextUnit 推进：(1+1)%2 = 0（player）
      expect(state.currentInitiativeIndex.value).toBe(0);
      expect(state.turn.value).toBe('player');
    });

    it('敌人活着时执行 enemyAction 并推进回合', () => {
      const state = makeStateMock();
      const enemy = makeEnemy({ id: 'e1', hp: 50 });
      state.enemies = computed(() => [enemy]);
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 1;
      const ctx = makeMockCtx();
      const enemyAction = makeEnemyActionMock();
      const log = makeLogMock();
      const init = useInitiative(state, log, ctx, enemyAction, makeBossMock(), vi.fn(), makePassiveMock());

      init.singleEnemyTurn('e1');

      expect(enemyAction.enemyAction).toHaveBeenCalledWith(enemy);
      expect(ctx.enemy.tickCooldowns).toHaveBeenCalledWith('e1');
      expect(log.addCombatLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'combat_turn_start' }));
    });

    it('敌人行动后玩家 hp<=0 时调用 endCombat("defeat")', () => {
      const state = makeStateMock();
      const enemy = makeEnemy({ id: 'e1', hp: 50 });
      state.enemies = computed(() => [enemy]);
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 1;
      const ctx = makeMockCtx();
      ctx.character.hp = 0; // 玩家死亡
      const enemyAction = makeEnemyActionMock();
      const endCombat = vi.fn();
      const log = makeLogMock();
      const init = useInitiative(state, log, ctx, enemyAction, makeBossMock(), endCombat, makePassiveMock());

      init.singleEnemyTurn('e1');

      expect(endCombat).toHaveBeenCalledWith('defeat');
      // P2-37 修复：singleEnemyTurn 中移除了重复的 saveLogs 调用，由 endCombat 内部统一处理
    });
  });

  // -------------------- singleEnemyTurn：Boss 阶段处理 --------------------

  describe('singleEnemyTurn：Boss 阶段处理', () => {
    /** 构造 BossPhase 配置 */
    function makeBossPhase(overrides: Partial<BossPhase> = {}): BossPhase {
      return {
        hpThreshold: 0.5,
        name: '狂暴阶段',
        dialogue: ['尝尝我的厉害！', '感受愤怒吧！'],
        transitionEffect: 'flame',
        aiStrategy: 'aggressive',
        mechanics: [{ type: 'enrage', intervalTurns: 1 }],
        statMultipliers: { physicalAttack: 1.5 },
        ...overrides,
      };
    }

    it('Boss 阶段切换时应用属性并记录日志、emit 事件', () => {
      const state = makeStateMock();
      const bossEnemy = makeEnemy({ id: 'boss1', isBoss: true, hp: 30, maxHp: 100 });
      const phase = makeBossPhase();
      bossEnemy.phases = [phase];
      state.enemies = computed(() => [bossEnemy]);
      state.initiativeOrder.value = ['player', 'boss1'];
      state.currentInitiativeIndex.value = 1;
      // mock phaseManager 返回阶段切换
      const phaseManager = {
        getCurrentPhase: vi.fn(() => ({ phase, changed: true })),
        reset: vi.fn(),
      };
      state.bossPhaseManagers.set('boss1', phaseManager);
      // mock processBossPhaseMechanics 返回空（无机制触发）
      vi.mocked(processBossPhaseMechanics).mockReturnValue([]);
      const ctx = makeMockCtx();
      const log = makeLogMock();
      const init = useInitiative(state, log, ctx, makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.singleEnemyTurn('boss1');

      // 阶段切换时调用 applyPhaseStats
      expect(applyPhaseStats).toHaveBeenCalledWith(bossEnemy, phase);
      // aiStrategy 被更新
      expect(bossEnemy.aiStrategy).toBe('aggressive');
      // 阶段转换日志
      expect(log.addCombatLog).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'combat_event',
        message: expect.stringContaining('阶段转换'),
      }));
    });

    it('Boss 阶段切换时发射 COMBAT_BOSS_PHASE 事件', async () => {
      const state = makeStateMock();
      const bossEnemy = makeEnemy({ id: 'boss1', isBoss: true, hp: 30, maxHp: 100 });
      const phase = makeBossPhase();
      bossEnemy.phases = [phase];
      state.enemies = computed(() => [bossEnemy]);
      state.initiativeOrder.value = ['player', 'boss1'];
      state.currentInitiativeIndex.value = 1;
      const phaseManager = {
        getCurrentPhase: vi.fn(() => ({ phase, changed: true })),
        reset: vi.fn(),
      };
      state.bossPhaseManagers.set('boss1', phaseManager);
      vi.mocked(processBossPhaseMechanics).mockReturnValue([]);
      const { eventBus, GameEvents } = await import('@/modules/bus');
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.singleEnemyTurn('boss1');

      expect(eventBus.emit).toHaveBeenCalledWith(GameEvents.COMBAT_BOSS_PHASE, expect.objectContaining({
        enemyId: 'boss1',
        phaseName: '狂暴阶段',
      }));
    });

    it('Boss 阶段切换时 dialogue 逐条记录日志', () => {
      const state = makeStateMock();
      const bossEnemy = makeEnemy({ id: 'boss1', isBoss: true, hp: 30, maxHp: 100 });
      const phase = makeBossPhase({ dialogue: ['第一句台词', '第二句台词'] });
      bossEnemy.phases = [phase];
      state.enemies = computed(() => [bossEnemy]);
      state.initiativeOrder.value = ['player', 'boss1'];
      state.currentInitiativeIndex.value = 1;
      const phaseManager = {
        getCurrentPhase: vi.fn(() => ({ phase, changed: true })),
        reset: vi.fn(),
      };
      state.bossPhaseManagers.set('boss1', phaseManager);
      vi.mocked(processBossPhaseMechanics).mockReturnValue([]);
      const log = makeLogMock();
      const init = useInitiative(state, log, makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.singleEnemyTurn('boss1');

      // dialogue 每条记录一次日志
      expect(log.addCombatLog).toHaveBeenCalledWith(expect.objectContaining({ message: '"第一句台词"' }));
      expect(log.addCombatLog).toHaveBeenCalledWith(expect.objectContaining({ message: '"第二句台词"' }));
    });

    it('Boss 阶段未切换时不调用 applyPhaseStats', () => {
      const state = makeStateMock();
      const bossEnemy = makeEnemy({ id: 'boss1', isBoss: true, hp: 30, maxHp: 100 });
      const phase = makeBossPhase();
      bossEnemy.phases = [phase];
      state.enemies = computed(() => [bossEnemy]);
      state.initiativeOrder.value = ['player', 'boss1'];
      state.currentInitiativeIndex.value = 1;
      // changed: false，阶段未切换
      const phaseManager = {
        getCurrentPhase: vi.fn(() => ({ phase, changed: false })),
        reset: vi.fn(),
      };
      state.bossPhaseManagers.set('boss1', phaseManager);
      vi.mocked(processBossPhaseMechanics).mockReturnValue([]);
      vi.mocked(applyPhaseStats).mockClear();
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      // 记录调用前的 turnCount（singleEnemyTurn 内部 advanceToNextUnit 会使索引回绕并 turnCount+1）
      const expectedTurnCount = state.turnCount.value;

      init.singleEnemyTurn('boss1');

      // 阶段未切换，不调用 applyPhaseStats
      expect(applyPhaseStats).not.toHaveBeenCalled();
      // 但 currentPhase 存在，仍调用 processBossPhaseMechanics
      expect(processBossPhaseMechanics).toHaveBeenCalledWith(bossEnemy, phase, expectedTurnCount);
    });

    it('Boss 阶段机制触发时记录机制日志并调用 applyMechanicEffect', () => {
      const state = makeStateMock();
      const bossEnemy = makeEnemy({ id: 'boss1', isBoss: true, hp: 30, maxHp: 100 });
      const phase = makeBossPhase();
      bossEnemy.phases = [phase];
      state.enemies = computed(() => [bossEnemy]);
      state.initiativeOrder.value = ['player', 'boss1'];
      state.currentInitiativeIndex.value = 1;
      const phaseManager = {
        getCurrentPhase: vi.fn(() => ({ phase, changed: false })),
        reset: vi.fn(),
      };
      state.bossPhaseManagers.set('boss1', phaseManager);
      // mock processBossPhaseMechanics 返回触发的机制
      vi.mocked(processBossPhaseMechanics).mockReturnValue(['enrage']);
      const boss = makeBossMock();
      const log = makeLogMock();
      const init = useInitiative(state, log, makeMockCtx(), makeEnemyActionMock(), boss, vi.fn(), makePassiveMock());

      init.singleEnemyTurn('boss1');

      // 机制日志
      expect(log.addCombatLog).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('狂暴'),
      }));
      // 调用 boss.applyMechanicEffect
      expect(boss.applyMechanicEffect).toHaveBeenCalledWith(bossEnemy, 'enrage', phase);
    });

    it('phaseManager 不存在时不处理阶段逻辑', () => {
      const state = makeStateMock();
      const bossEnemy = makeEnemy({ id: 'boss1', isBoss: true, hp: 30, maxHp: 100 });
      bossEnemy.phases = [makeBossPhase()];
      state.enemies = computed(() => [bossEnemy]);
      state.initiativeOrder.value = ['player', 'boss1'];
      state.currentInitiativeIndex.value = 1;
      // bossPhaseManagers 不包含 boss1
      vi.mocked(processBossPhaseMechanics).mockClear();
      vi.mocked(applyPhaseStats).mockClear();
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.singleEnemyTurn('boss1');

      expect(processBossPhaseMechanics).not.toHaveBeenCalled();
      expect(applyPhaseStats).not.toHaveBeenCalled();
    });

    it('currentPhase 为 null 时不调用 applyPhaseStats 和 processBossPhaseMechanics', () => {
      const state = makeStateMock();
      const bossEnemy = makeEnemy({ id: 'boss1', isBoss: true, hp: 30, maxHp: 100 });
      bossEnemy.phases = [makeBossPhase()];
      state.enemies = computed(() => [bossEnemy]);
      state.initiativeOrder.value = ['player', 'boss1'];
      state.currentInitiativeIndex.value = 1;
      // getCurrentPhase 返回 null
      const phaseManager = {
        getCurrentPhase: vi.fn(() => ({ phase: null, changed: false })),
        reset: vi.fn(),
      };
      state.bossPhaseManagers.set('boss1', phaseManager);
      vi.mocked(processBossPhaseMechanics).mockClear();
      vi.mocked(applyPhaseStats).mockClear();
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.singleEnemyTurn('boss1');

      expect(applyPhaseStats).not.toHaveBeenCalled();
      expect(processBossPhaseMechanics).not.toHaveBeenCalled();
    });

    it('非 Boss 敌人不进入阶段处理逻辑', () => {
      const state = makeStateMock();
      const normalEnemy = makeEnemy({ id: 'e1', isBoss: false, hp: 50 });
      state.enemies = computed(() => [normalEnemy]);
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 1;
      vi.mocked(processBossPhaseMechanics).mockClear();
      vi.mocked(applyPhaseStats).mockClear();
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.singleEnemyTurn('e1');

      expect(processBossPhaseMechanics).not.toHaveBeenCalled();
      expect(applyPhaseStats).not.toHaveBeenCalled();
    });

    it('Boss phases 为空数组时不进入阶段处理', () => {
      const state = makeStateMock();
      const bossEnemy = makeEnemy({ id: 'boss1', isBoss: true, hp: 30, maxHp: 100 });
      bossEnemy.phases = [];
      state.enemies = computed(() => [bossEnemy]);
      state.initiativeOrder.value = ['player', 'boss1'];
      state.currentInitiativeIndex.value = 1;
      vi.mocked(processBossPhaseMechanics).mockClear();
      vi.mocked(applyPhaseStats).mockClear();
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.singleEnemyTurn('boss1');

      expect(processBossPhaseMechanics).not.toHaveBeenCalled();
      expect(applyPhaseStats).not.toHaveBeenCalled();
    });

    it('阶段切换且 dialogue 为空数组时不记录台词日志', () => {
      const state = makeStateMock();
      const bossEnemy = makeEnemy({ id: 'boss1', isBoss: true, hp: 30, maxHp: 100 });
      const phase = makeBossPhase({ dialogue: [] });
      bossEnemy.phases = [phase];
      state.enemies = computed(() => [bossEnemy]);
      state.initiativeOrder.value = ['player', 'boss1'];
      state.currentInitiativeIndex.value = 1;
      const phaseManager = {
        getCurrentPhase: vi.fn(() => ({ phase, changed: true })),
        reset: vi.fn(),
      };
      state.bossPhaseManagers.set('boss1', phaseManager);
      vi.mocked(processBossPhaseMechanics).mockReturnValue([]);
      const log = makeLogMock();
      const init = useInitiative(state, log, makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.singleEnemyTurn('boss1');

      // 不应记录台词日志（message 以双引号包裹的）
      const dialogueCalls = vi.mocked(log.addCombatLog).mock.calls.filter(
        call => typeof call[0] === 'object' && call[0] !== null && 'message' in call[0] && typeof (call[0] as { message: string }).message === 'string' && (call[0] as { message: string }).message.startsWith('"')
      );
      expect(dialogueCalls.length).toBe(0);
    });

    it('阶段切换且 aiStrategy 缺失时不更新敌人策略', () => {
      // 覆盖 useInitiative.ts 第 302 行：if (currentPhase.aiStrategy) falsy 分支
      const state = makeStateMock();
      const bossEnemy = makeEnemy({ id: 'boss1', isBoss: true, hp: 30, maxHp: 100 });
      const phase = makeBossPhase({ aiStrategy: undefined });
      bossEnemy.phases = [phase];
      state.enemies = computed(() => [bossEnemy]);
      state.initiativeOrder.value = ['player', 'boss1'];
      state.currentInitiativeIndex.value = 1;
      const phaseManager = {
        getCurrentPhase: vi.fn(() => ({ phase, changed: true })),
        reset: vi.fn(),
      };
      state.bossPhaseManagers.set('boss1', phaseManager);
      vi.mocked(processBossPhaseMechanics).mockReturnValue([]);
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.singleEnemyTurn('boss1');

      // aiStrategy 缺失，不应赋值（保持 undefined）
      expect(bossEnemy.aiStrategy).toBeUndefined();
      // 阶段切换日志仍记录
      expect(applyPhaseStats).toHaveBeenCalledWith(bossEnemy, phase);
    });

    it('阶段切换且 transitionEffect 缺失时事件 effect 默认为 darken', async () => {
      // 覆盖 useInitiative.ts 第 316 行：currentPhase.transitionEffect || 'darken' falsy 分支
      const state = makeStateMock();
      const bossEnemy = makeEnemy({ id: 'boss1', isBoss: true, hp: 30, maxHp: 100 });
      const phase = makeBossPhase({ transitionEffect: undefined });
      bossEnemy.phases = [phase];
      state.enemies = computed(() => [bossEnemy]);
      state.initiativeOrder.value = ['player', 'boss1'];
      state.currentInitiativeIndex.value = 1;
      const phaseManager = {
        getCurrentPhase: vi.fn(() => ({ phase, changed: true })),
        reset: vi.fn(),
      };
      state.bossPhaseManagers.set('boss1', phaseManager);
      vi.mocked(processBossPhaseMechanics).mockReturnValue([]);
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.singleEnemyTurn('boss1');

      const { eventBus, GameEvents } = await import('@/modules/bus');
      expect(eventBus.emit).toHaveBeenCalledWith(GameEvents.COMBAT_BOSS_PHASE, expect.objectContaining({
        effect: 'darken',
      }));
    });

    it('机制触发未知 mechType 时日志回退为原始 mechType', () => {
      // 覆盖 useInitiative.ts 第 340 行：mechNames[mechType] || mechType falsy 分支
      const state = makeStateMock();
      const bossEnemy = makeEnemy({ id: 'boss1', isBoss: true, hp: 30, maxHp: 100 });
      const phase = makeBossPhase();
      bossEnemy.phases = [phase];
      state.enemies = computed(() => [bossEnemy]);
      state.initiativeOrder.value = ['player', 'boss1'];
      state.currentInitiativeIndex.value = 1;
      const phaseManager = {
        getCurrentPhase: vi.fn(() => ({ phase, changed: false })),
        reset: vi.fn(),
      };
      state.bossPhaseManagers.set('boss1', phaseManager);
      // 返回未知机制类型（不在 mechNames 映射中）
      vi.mocked(processBossPhaseMechanics).mockReturnValue(['unknown_mech' as never]);
      const boss = makeBossMock();
      const log = makeLogMock();
      const init = useInitiative(state, log, makeMockCtx(), makeEnemyActionMock(), boss, vi.fn(), makePassiveMock());

      init.singleEnemyTurn('boss1');

      // 未知机制类型回退为原始字符串
      expect(log.addCombatLog).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('unknown_mech'),
      }));
      expect(boss.applyMechanicEffect).toHaveBeenCalledWith(bossEnemy, 'unknown_mech', phase);
    });
  });

  // -------------------- 边界分支补充：regenAmount 时 enemy 为 null --------------------

  describe('边界分支补充：tick 阶段后 enemy 为 null', () => {
    it('enemy dotDamage>0 但二次查询 getEnemyById 返回 null 时不记录伤害日志', () => {
      // 覆盖 useInitiative.ts 第 205 行：if (enemy) falsy 分支
      // 阶段 1（line 170）getEnemyById 返回 enemy（不被跳过），阶段 2（line 204）返回 null
      const state = makeStateMock();
      const enemy = makeEnemy({ id: 'e1', hp: 30, maxHp: 50 });
      state.enemies = computed(() => [enemy]);
      state.enemyEffects.value = { e1: createEmptyContainer() };
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 1;
      const ctx = makeMockCtx();
      // 第一次调用返回 enemy（line 170），第二次调用返回 null（line 204）
      ctx.enemy.getEnemyById = vi.fn()
        .mockReturnValueOnce(enemy)
        .mockReturnValue(null);
      ctx.enemy.takeDamage = vi.fn();
      vi.mocked(state.effectRegistry.tickAll)
        .mockReturnValueOnce({ expiredIds: [], dotDamage: 0, regenAmount: 0 })
        .mockReturnValueOnce({ expiredIds: [], dotDamage: 12, regenAmount: 0 });
      const log = makeLogMock();
      const init = useInitiative(state, log, ctx, makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.advanceToNextUnit();

      // takeDamage 被调用（line 203），但 enemy 为 null 不记录日志
      expect(ctx.enemy.takeDamage).toHaveBeenCalledWith('e1', 12);
      expect(log.addCombatLog).not.toHaveBeenCalledWith(expect.objectContaining({ eventType: 'combat_damage', targetId: 'e1' }));
    });

    it('enemy regenAmount>0 但二次查询 getEnemyById 返回 null 时不调用 takeDamage', () => {
      // 覆盖 useInitiative.ts 第 217 行：if (enemy) falsy 分支
      const state = makeStateMock();
      const enemy = makeEnemy({ id: 'e1', hp: 30, maxHp: 50 });
      state.enemies = computed(() => [enemy]);
      state.enemyEffects.value = { e1: createEmptyContainer() };
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 1;
      const ctx = makeMockCtx();
      // 第一次调用返回 enemy（line 170），第二次调用返回 null（line 216）
      ctx.enemy.getEnemyById = vi.fn()
        .mockReturnValueOnce(enemy)
        .mockReturnValue(null);
      const takeDamageSpy = vi.fn();
      ctx.enemy.takeDamage = takeDamageSpy;
      vi.mocked(state.effectRegistry.tickAll)
        .mockReturnValueOnce({ expiredIds: [], dotDamage: 0, regenAmount: 0 })
        .mockReturnValueOnce({ expiredIds: [], dotDamage: 0, regenAmount: 10 });
      const log = makeLogMock();
      const init = useInitiative(state, log, ctx, makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.advanceToNextUnit();

      // enemy 为 null，不调用 takeDamage，不记录恢复日志
      expect(takeDamageSpy).not.toHaveBeenCalled();
      expect(log.addCombatLog).not.toHaveBeenCalledWith(expect.objectContaining({ eventType: 'combat_heal', targetId: 'e1' }));
    });
  });

  // -------------------- 边界分支补充：buildInitiativeOrder stats 回退 --------------------

  describe('边界分支补充：buildInitiativeOrder 中 stats 缺失', () => {
    it('敌人 stats 缺失时 dex 回退为 5', () => {
      // 覆盖 useInitiative.ts 第 89 行：e.stats?.dex ?? 5 falsy 分支
      const state = makeStateMock();
      const enemyNoStats = makeEnemy({ id: 'e1' });
      // 使用类型断言清除 stats，触发 ?? 5 回退
      (enemyNoStats as { stats?: unknown }).stats = undefined;
      state.enemies = computed(() => [enemyNoStats]);
      state.initiativeOrder.value = ['player', 'e1'];
      state.currentInitiativeIndex.value = 0;
      const ctx = makeMockCtx();
      const init = useInitiative(state, makeLogMock(), ctx, makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.buildInitiativeOrder();

      // 验证先攻顺序已构建（包含 player 和 e1）
      expect(state.initiativeOrder.value).toContain('player');
      expect(state.initiativeOrder.value).toContain('e1');
    });

    it('玩家 effectiveStats.dex 为 0 时 speed 回退为 0', () => {
      // 覆盖 useInitiative.ts 第 78 行：ctx.character.effectiveStats.dex || 0 falsy 分支
      const state = makeStateMock();
      state.enemies = computed(() => []);
      state.initiativeOrder.value = [];
      state.currentInitiativeIndex.value = 0;
      // 构造 dex=0 的 ctx（触发 || 0 回退）
      const ctx = makeMockCtx({ characterEffectiveStats: { dex: 0 } as never });
      const init = useInitiative(state, makeLogMock(), ctx, makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.buildInitiativeOrder();

      // 验证先攻顺序包含 player
      expect(state.initiativeOrder.value).toContain('player');
    });
  });

  // -------------------- 边界分支补充：assignEnemyPositions 超出格子 --------------------

  describe('边界分支补充：assignEnemyPositions Boss 超出后排', () => {
    it('Boss 数量超过后排位置时 col 回退为 0', () => {
      // 覆盖 useInitiative.ts 第 48 行：backSlots.shift() ?? 0 falsy 分支
      const state = makeStateMock();
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      // 4 个 Boss，超过后排 3 个位置
      const bosses = Array.from({ length: 4 }, (_, i) =>
        makeEnemy({ id: `boss${i}`, isBoss: true })
      );

      init.assignEnemyPositions(bosses);

      // 第 4 个 Boss 的 col 回退为 0（backSlots 已空，?? 0）
      expect(state.enemyPositions.value['boss3']).toEqual({ row: 'back', col: 0 });
    });

    it('前排和后排都满时第 7 个普通敌人不分配位置', () => {
      // 覆盖 useInitiative.ts 第 57 行：backSlots.length > 0 的 falsy 分支
      // 3 前排 + 3 后排 = 6 格全部占满，第 7 个普通敌人无处可放
      const state = makeStateMock();
      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      const enemies = Array.from({ length: 7 }, (_, i) =>
        makeEnemy({ id: `e${i}` })
      );

      init.assignEnemyPositions(enemies);

      // 前 6 个敌人有位置
      for (let i = 0; i < 6; i++) {
        expect(state.enemyPositions.value[`e${i}`]).toBeDefined();
      }
      // 第 7 个敌人（e6）无位置（frontSlots 和 backSlots 都已空）
      expect(state.enemyPositions.value['e6']).toBeUndefined();
    });
  });

  // -------------------- 边界分支补充：buildInitiativeOrder playerIndex < 0 --------------------

  describe('边界分支补充：buildInitiativeOrder 中 player 不在先攻序列', () => {
    it('initiativeOrder 不含 player 时 currentInitiativeIndex 回退为 0', () => {
      // 覆盖 useInitiative.ts 第 98 行：playerIndex >= 0 ? playerIndex : 0 的 falsy 分支
      // 使用 writable computed 在 setter 中过滤掉 'player'，使 indexOf 返回 -1
      const inner = ref<string[]>([]);
      const writableFiltering = computed({
        get: () => inner.value,
        set: (val: string[]) => {
          // 模拟 setter 过滤掉 'player'（防御性回退测试）
          inner.value = val.filter(id => id !== 'player');
        },
      });

      const enemy = makeEnemy({ id: 'e1' });
      const state = makeStateMock();
      state.enemies = computed(() => [enemy]);
      // 替换 initiativeOrder 为过滤型 writable computed
      (state as { initiativeOrder: unknown }).initiativeOrder = writableFiltering;

      const init = useInitiative(state, makeLogMock(), makeMockCtx(), makeEnemyActionMock(), makeBossMock(), vi.fn(), makePassiveMock());

      init.buildInitiativeOrder();

      // player 被过滤，currentInitiativeIndex 回退为 0
      expect(state.currentInitiativeIndex.value).toBe(0);
      // initiativeOrder 中不含 player
      expect(state.initiativeOrder.value).not.toContain('player');
    });
  });
});
