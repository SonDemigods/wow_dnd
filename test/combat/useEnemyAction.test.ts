/**
 * @fileoverview 敌人行动 Composable（useEnemyAction）单元测试
 *
 * 覆盖 useEnemyAction 的：
 * 1. getStrategy：根据 AI 策略类型返回对应策略实例
 *    - aggressive / defensive / balanced / boss_phase 各返回对应策略
 *    - 未知策略类型回退到 balanced
 * 2. applyEnemyDamageToPlayer：smoke test
 *    - 验证返回结构 { actualDamage, shieldAbsorbed }
 *    - 验证调用 characterStore.takeDamage
 *    - 验证触发 passive.onDamaged（当 actualDamage > 0）
 *    - 验证记录战斗日志
 * 3. enemyBasicAttack / enemyAttackWithSkill / enemyAction：返回结构 smoke test
 *
 * Mock 策略：
 *  - useCharacterStore / useEnemyStore / useSkillStore mock 模块
 *  - eventBus mock 模块（避免触发真实监听器）
 *  - rollDodge mock 模块（控制闪避判定）
 *  - processDamagePipeline mock 模块（控制伤害管线结果）
 *  - state / log / passive 构造 minimal mock
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { useEnemyAction } from '@/modules/combat/composables/useEnemyAction';
import { createEmptyContainer, type EffectContainer } from '@/modules/combat/effects';
import type { EnemyInstance } from '@/modules/enemy/types';
import type { AiStrategyType } from '@/modules/enemy/types';
import type { ICombatContext } from '@/modules/combat/combatContext';

// mock characterStore
const characterMock = {
  name: '英雄',
  hp: 100,
  maxHp: 100,
  takeDamage: vi.fn(),
  attributes: { physicalAttack: 20, physicalDefense: 10, magicAttack: 15, magicDefense: 8 } as never,
};
vi.mock('@/modules/character/store', () => ({
  useCharacterStore: vi.fn(() => characterMock),
}));

// mock enemyStore
const enemyStoreMock = {
  getEnemyById: vi.fn(() => null),
  takeDamage: vi.fn(),
};
vi.mock('@/modules/enemy/store', () => ({
  useEnemyStore: vi.fn(() => enemyStoreMock),
}));

// mock skillStore
vi.mock('@/modules/skill/store', () => ({
  useSkillStore: vi.fn(() => ({ getSkill: vi.fn(() => null), tickCooldowns: vi.fn() })),
}));

// mock eventBus
vi.mock('@/modules/bus', () => ({
  eventBus: { emit: vi.fn() },
  GameEvents: {
    COMBAT_DEAL_DAMAGE: 'combat:deal-damage',
    COMBAT_ENEMY_DEATH: 'combat:enemy-death',
  },
}));

// mock rollDodge（控制闪避判定）
vi.mock('@/modules/combat/service', () => ({
  rollDodge: vi.fn(() => false),
  generateBattleLogId: vi.fn(() => 'log-id'),
  isBossCombat: vi.fn(() => false),
}));

// mock processDamagePipeline（控制伤害管线结果）
const pipeResultMock = { finalDamage: 20, absorbed: 0, thorns: 0 };
vi.mock('@/modules/combat/effects', async () => {
  const actual = await vi.importActual<typeof import('@/modules/combat/effects')>('@/modules/combat/effects');
  return {
    ...actual,
    processDamagePipeline: vi.fn(() => pipeResultMock),
  };
});

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
    physicalAttack: 10,
    aiStrategy: 'balanced',
    ...o,
  } as EnemyInstance;
}

function makeStateMock() {
  return {
    state: ref<'idle' | 'fighting' | 'victory' | 'defeat' | 'flee'>('fighting'),
    enemyIds: ref<string[]>(['e1']),
    targetEnemyId: ref<string | null>('e1'),
    turn: ref<'player' | 'enemy'>('enemy'),
    turnCount: ref(0),
    combatId: ref('combat-1'),
    combatLogs: ref<unknown[]>([]),
    playerEffects: ref<EffectContainer>(createEmptyContainer()),
    enemyEffects: ref<Record<string, EffectContainer>>({}),
    resourceSystems: ref<unknown[]>([]),
    enemies: { value: [] as EnemyInstance[] },
    aliveEnemies: { value: [] as EnemyInstance[] },
    currentTarget: { value: null as EnemyInstance | null },
    hasBossEnemy: { value: false },
    effectRegistry: {},
  } as never;
}

function makeLogMock() {
  return {
    addCombatLog: vi.fn(),
    saveLogs: vi.fn().mockResolvedValue(undefined),
    createPlayerEffectContext: vi.fn(() => ({ ownerId: 'player', ownerType: 'player', baseStats: { speed: 0, physicalAttack: 20, physicalDefense: 10, magicAttack: 15, magicDefense: 8 }, currentHp: 100, maxHp: 100 })),
    createEnemyEffectContext: vi.fn(() => ({ ownerId: 'e1', ownerType: 'enemy', baseStats: { speed: 0, physicalAttack: 10, physicalDefense: 5, magicAttack: 5, magicDefense: 3 }, currentHp: 50, maxHp: 50 })),
  } as never;
}

/** 构造 ICombatContext mock（character/skill/enemy 域字段供 useEnemyAction 实际使用） */
function makeMockCtx(overrides: Partial<ICombatContext> = {}): ICombatContext {
  return {
    character: {
      name: '英雄',
      classId: 'warrior',
      hp: 100,
      maxHp: 100,
      attributes: { physicalAttack: 20, physicalDefense: 10, magicAttack: 15, magicDefense: 8 } as never,
      effectiveStats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } as never,
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
    ...overrides,
  } as unknown as ICombatContext;
}

function makePassiveMock() {
  return {
    onDamaged: vi.fn(),
    getDamageReduction: vi.fn(() => 0),
    loadPassives: vi.fn(),
    onCombatStart: vi.fn(),
    onTurnStart: vi.fn(),
    onAttack: vi.fn(),
    onKill: vi.fn(),
    getPassives: vi.fn(() => []),
    getStatModifiers: vi.fn(() => []),
  } as never;
}

// ==================== 测试用例 ====================

describe('useEnemyAction - 敌人行动 Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    characterMock.hp = 100;
    pipeResultMock.finalDamage = 20;
    pipeResultMock.absorbed = 0;
    pipeResultMock.thorns = 0;
  });

  // -------------------- getStrategy --------------------

  describe('getStrategy：AI 策略获取', () => {
    it('aggressive 类型返回 AggressiveStrategy 实例', () => {
      const action = useEnemyAction(makeStateMock(), makeLogMock(), makeMockCtx());
      const strategy = action.getStrategy('aggressive');
      expect(strategy).toBeDefined();
      expect(typeof strategy.decideAction).toBe('function');
    });

    it('defensive 类型返回 DefensiveStrategy 实例', () => {
      const action = useEnemyAction(makeStateMock(), makeLogMock(), makeMockCtx());
      const strategy = action.getStrategy('defensive');
      expect(strategy).toBeDefined();
      expect(typeof strategy.decideAction).toBe('function');
    });

    it('balanced 类型返回 BalancedStrategy 实例', () => {
      const action = useEnemyAction(makeStateMock(), makeLogMock(), makeMockCtx());
      const strategy = action.getStrategy('balanced');
      expect(strategy).toBeDefined();
      expect(typeof strategy.decideAction).toBe('function');
    });

    it('boss_phase 类型返回 BossPhaseStrategy 实例', () => {
      const action = useEnemyAction(makeStateMock(), makeLogMock(), makeMockCtx());
      const strategy = action.getStrategy('boss_phase');
      expect(strategy).toBeDefined();
      expect(typeof strategy.decideAction).toBe('function');
    });

    it('未知策略类型回退到 balanced', () => {
      const action = useEnemyAction(makeStateMock(), makeLogMock(), makeMockCtx());
      const fallback = action.getStrategy('unknown' as AiStrategyType);
      const balanced = action.getStrategy('balanced');
      // 回退策略应与 balanced 相同实例
      expect(fallback).toBe(balanced);
    });
  });

  // -------------------- applyEnemyDamageToPlayer --------------------

  describe('applyEnemyDamageToPlayer：对玩家造成伤害（smoke test）', () => {
    it('返回 { actualDamage, shieldAbsorbed } 结构，并调用 characterStore.takeDamage', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const ctx = makeMockCtx();
      const action = useEnemyAction(state, log, ctx);

      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const result = action.applyEnemyDamageToPlayer(enemy, 30);

      expect(result).toHaveProperty('actualDamage');
      expect(result).toHaveProperty('shieldAbsorbed');
      expect(ctx.character.takeDamage).toHaveBeenCalled();
      expect(log.addCombatLog).toHaveBeenCalled();
    });

    it('actualDamage > 0 时触发 passive.onDamaged', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const passive = makePassiveMock();
      const ctx = makeMockCtx();
      const action = useEnemyAction(state, log, ctx, passive);

      const enemy = makeEnemy({ id: 'e1' });
      action.applyEnemyDamageToPlayer(enemy, 30);

      expect(passive.onDamaged).toHaveBeenCalledWith(20); // pipeResult.finalDamage
    });

    it('actualDamage = 0 时不触发 passive.onDamaged', () => {
      pipeResultMock.finalDamage = 0;
      const state = makeStateMock();
      const log = makeLogMock();
      const passive = makePassiveMock();
      const ctx = makeMockCtx();
      const action = useEnemyAction(state, log, ctx, passive);

      const enemy = makeEnemy({ id: 'e1' });
      action.applyEnemyDamageToPlayer(enemy, 30);

      expect(passive.onDamaged).not.toHaveBeenCalled();
    });

    it('被动减伤生效时 actualDamage 被按比例削减', () => {
      pipeResultMock.finalDamage = 100;
      const state = makeStateMock();
      const log = makeLogMock();
      const passive = makePassiveMock();
      passive.getDamageReduction.mockReturnValue(0.2); // 减伤 20%
      const ctx = makeMockCtx();
      const action = useEnemyAction(state, log, ctx, passive);

      const enemy = makeEnemy({ id: 'e1' });
      const result = action.applyEnemyDamageToPlayer(enemy, 100);

      // 100 × (1 - 0.2) = 80
      expect(result.actualDamage).toBe(80);
      expect(ctx.character.takeDamage).toHaveBeenCalledWith(80);
    });

    it('护盾吸收时日志包含"护盾吸收"字样', () => {
      pipeResultMock.absorbed = 5;
      const state = makeStateMock();
      const log = makeLogMock();
      const ctx = makeMockCtx();
      const action = useEnemyAction(state, log, ctx);

      const enemy = makeEnemy({ id: 'e1', name: '黑龙' });
      action.applyEnemyDamageToPlayer(enemy, 30);

      const logCall = log.addCombatLog.mock.calls[0][0];
      expect(logCall.message).toContain('护盾吸收');
    });

    it('荆棘反伤时调用 enemiesStore.takeDamage', () => {
      pipeResultMock.thorns = 10;
      const state = makeStateMock();
      const log = makeLogMock();
      const ctx = makeMockCtx();
      const action = useEnemyAction(state, log, ctx);

      const enemy = makeEnemy({ id: 'e1', name: '黑龙' });
      action.applyEnemyDamageToPlayer(enemy, 30);

      expect(ctx.enemy.takeDamage).toHaveBeenCalledWith('e1', 10);
      // 荆棘反伤会额外记录 1 条日志
      expect(log.addCombatLog).toHaveBeenCalledTimes(2);
      const thornsLog = log.addCombatLog.mock.calls[1][0];
      expect(thornsLog.message).toContain('荆棘反伤');
    });

    it('传入 skill 时日志 eventType 为 combat_skill_cast', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const ctx = makeMockCtx();
      const action = useEnemyAction(state, log, ctx);

      const enemy = makeEnemy({ id: 'e1', name: '黑龙' });
      action.applyEnemyDamageToPlayer(enemy, 30, { id: 'sk1', name: '火焰冲击' });

      const logCall = log.addCombatLog.mock.calls[0][0];
      expect(logCall.eventType).toBe('combat_skill_cast');
      expect(logCall.skillId).toBe('sk1');
      expect(logCall.skillName).toBe('火焰冲击');
      expect(logCall.message).toContain('火焰冲击');
    });
  });

  // -------------------- 返回值结构 --------------------

  describe('返回值结构', () => {
    it('返回包含 5 个方法的对象', () => {
      const action = useEnemyAction(makeStateMock(), makeLogMock(), makeMockCtx());
      expect(typeof action.applyEnemyDamageToPlayer).toBe('function');
      expect(typeof action.enemyBasicAttack).toBe('function');
      expect(typeof action.enemyAttackWithSkill).toBe('function');
      expect(typeof action.enemyAction).toBe('function');
      expect(typeof action.getStrategy).toBe('function');
    });
  });
});
