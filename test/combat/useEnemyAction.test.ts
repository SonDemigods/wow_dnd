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
import { createEmptyContainer, processDamagePipeline, type EffectContainer } from '@/modules/combat/effects';
import { rollDodge } from '@/modules/combat/service';
import { wrapAsBossInstance } from '@/modules/boss/service';
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
    COMBAT_DODGE: 'combat:dodge',
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
    bossInstances: new Map(),
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
    // 显式重置 rollDodge（clearAllMocks 不会重置 mockReturnValue）
    vi.mocked(rollDodge).mockReturnValue(false);
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

  // -------------------- enemyBasicAttack --------------------

  describe('enemyBasicAttack：敌人普通攻击', () => {
    it('命中时返回 success=true 并包含伤害值', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const ctx = makeMockCtx();
      const action = useEnemyAction(state, log, ctx);

      const enemy = makeEnemy({ id: 'e1', name: '哥布林' });
      const result = action.enemyBasicAttack(enemy);

      expect(result.success).toBe(true);
      expect(result.type).toBe('attack');
      expect(result.damage).toBe(20); // pipeResult.finalDamage
      expect(result.message).toContain('哥布林');
      // 验证调用了 calculateDamage
      expect(ctx.enemy.calculateDamage).toHaveBeenCalledWith(enemy, ctx.character.attributes.physicalDefense);
    });

    it('玩家闪避时返回 isDodge=true 并记录 combat_miss 日志', () => {
      vi.mocked(rollDodge).mockReturnValue(true);
      const state = makeStateMock();
      const log = makeLogMock();
      const ctx = makeMockCtx();
      const action = useEnemyAction(state, log, ctx);

      const enemy = makeEnemy({ id: 'e1', name: '哥布林' });
      const result = action.enemyBasicAttack(enemy);

      expect(result.success).toBe(true);
      expect(result.isDodge).toBe(true);
      expect(result.message).toContain('闪避');
      const logCall = log.addCombatLog.mock.calls[0][0];
      expect(logCall.eventType).toBe('combat_miss');
      expect(logCall.isDodge).toBe(true);
    });

    it('闪避时不调用 character.takeDamage', () => {
      vi.mocked(rollDodge).mockReturnValue(true);
      const state = makeStateMock();
      const ctx = makeMockCtx();
      const action = useEnemyAction(state, makeLogMock(), ctx);

      action.enemyBasicAttack(makeEnemy({ id: 'e1' }));

      expect(ctx.character.takeDamage).not.toHaveBeenCalled();
    });
  });

  // -------------------- enemyAttackWithSkill --------------------

  describe('enemyAttackWithSkill：敌人技能攻击', () => {
    it('命中时返回 type=skill 并包含伤害值', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const ctx = makeMockCtx();
      const action = useEnemyAction(state, log, ctx);

      const enemy = makeEnemy({ id: 'e1', name: '法师' });
      const result = action.enemyAttackWithSkill(30, { id: 'sk1', name: '火球术' }, enemy);

      expect(result.success).toBe(true);
      expect(result.type).toBe('skill');
      expect(result.damage).toBe(20); // pipeResult.finalDamage
      expect(result.message).toContain('火球术');
    });

    it('玩家闪避时返回 isDodge=true', () => {
      vi.mocked(rollDodge).mockReturnValue(true);
      const state = makeStateMock();
      const log = makeLogMock();
      const ctx = makeMockCtx();
      const action = useEnemyAction(state, log, ctx);

      const enemy = makeEnemy({ id: 'e1', name: '法师' });
      const result = action.enemyAttackWithSkill(30, { id: 'sk1', name: '火球术' }, enemy);

      expect(result.success).toBe(true);
      expect(result.isDodge).toBe(true);
      expect(result.message).toContain('闪避');
      // 闪避日志包含技能信息
      const logCall = log.addCombatLog.mock.calls[0][0];
      expect(logCall.skillId).toBe('sk1');
      expect(logCall.skillName).toBe('火球术');
    });

    it('magic_damage 技能类型映射为 magical 伤害类型', () => {
      const state = makeStateMock();
      const ctx = makeMockCtx();
      const action = useEnemyAction(state, makeLogMock(), ctx);

      vi.mocked(processDamagePipeline).mockClear();
      action.enemyAttackWithSkill(30, { id: 'sk1', name: '火球术', type: 'magic_damage' }, makeEnemy({ id: 'e1' }));

      const callArgs = vi.mocked(processDamagePipeline).mock.calls[0];
      // 第 6 个参数（索引 5）为 damageType
      expect(callArgs[5]).toBe('magical');
    });

    it('未提供 type 时默认映射为 physical 伤害类型', () => {
      const state = makeStateMock();
      const ctx = makeMockCtx();
      const action = useEnemyAction(state, makeLogMock(), ctx);

      vi.mocked(processDamagePipeline).mockClear();
      action.enemyAttackWithSkill(30, { id: 'sk1', name: '重击' }, makeEnemy({ id: 'e1' }));

      const callArgs = vi.mocked(processDamagePipeline).mock.calls[0];
      expect(callArgs[5]).toBe('physical');
    });

    it('physical_damage 技能类型映射为 physical 伤害类型', () => {
      const state = makeStateMock();
      const ctx = makeMockCtx();
      const action = useEnemyAction(state, makeLogMock(), ctx);

      vi.mocked(processDamagePipeline).mockClear();
      action.enemyAttackWithSkill(30, { id: 'sk1', name: '猛击', type: 'physical_damage' }, makeEnemy({ id: 'e1' }));

      const callArgs = vi.mocked(processDamagePipeline).mock.calls[0];
      expect(callArgs[5]).toBe('physical');
    });
  });

  // -------------------- enemyAction --------------------

  describe('enemyAction：敌人行动决策', () => {
    it('战斗已结束时返回 success=false', () => {
      const state = makeStateMock();
      state.state.value = 'idle';
      const action = useEnemyAction(state, makeLogMock(), makeMockCtx());

      const result = action.enemyAction(makeEnemy({ id: 'e1' }));

      expect(result.success).toBe(false);
      expect(result.message).toContain('战斗已结束');
    });

    // -------- AOE 攻击分支 --------
    it('aoeNextAttack=true 时执行范围攻击（命中）', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const ctx = makeMockCtx();
      ctx.enemy.calculateDamage.mockReturnValue(10);
      const action = useEnemyAction(state, log, ctx);

      const enemy = makeEnemy({ id: 'e1', name: '巨龙' });
      // aoeNextAttack 是 Boss 运行时状态，需通过 bossInstances Map 设置
      state.bossInstances.set(enemy.id, wrapAsBossInstance(enemy));
      state.bossInstances.get(enemy.id)!.runtime.aoeNextAttack = true;
      const result = action.enemyAction(enemy);

      expect(result.success).toBe(true);
      expect(result.type).toBe('attack');
      // aoeDamage = round(10 * 0.8) = 8（P3-147：从 1.3 改为 0.8），actualDamage = pipeResult.finalDamage = 20
      expect(result.damage).toBe(20);
      // aoeNextAttack 应被重置（runtime 字段）
      expect(state.bossInstances.get(enemy.id)!.runtime.aoeNextAttack).toBe(false);
      // 应记录 AOE 特殊日志（最后一条）
      const lastLog = log.addCombatLog.mock.calls[log.addCombatLog.mock.calls.length - 1][0];
      expect(lastLog.message).toContain('范围攻击');
    });

    it('aoeNextAttack=true 且玩家闪避时返回 isDodge=true', () => {
      vi.mocked(rollDodge).mockReturnValue(true);
      const state = makeStateMock();
      const log = makeLogMock();
      const ctx = makeMockCtx();
      const action = useEnemyAction(state, log, ctx);

      const enemy = makeEnemy({ id: 'e1', name: '巨龙' });
      // aoeNextAttack 是 Boss 运行时状态，需通过 bossInstances Map 设置
      state.bossInstances.set(enemy.id, wrapAsBossInstance(enemy));
      state.bossInstances.get(enemy.id)!.runtime.aoeNextAttack = true;
      const result = action.enemyAction(enemy);

      expect(result.success).toBe(true);
      expect(result.isDodge).toBe(true);
      expect(result.message).toContain('范围攻击');
      expect(state.bossInstances.get(enemy.id)!.runtime.aoeNextAttack).toBe(false);
    });

    // -------- basic_attack 决策 --------
    it('无可用技能时执行普通攻击', () => {
      const state = makeStateMock();
      const ctx = makeMockCtx();
      ctx.enemy.getAvailableSkills.mockReturnValue([]);
      const action = useEnemyAction(state, makeLogMock(), ctx);

      const enemy = makeEnemy({ id: 'e1', name: '史莱姆', aiStrategy: 'balanced' });
      const result = action.enemyAction(enemy);

      expect(result.success).toBe(true);
      expect(result.type).toBe('attack');
      // 普通攻击调用 calculateDamage
      expect(ctx.enemy.calculateDamage).toHaveBeenCalled();
    });

    // -------- skill 决策：useSkill 失败 → fallback --------
    it('skill 决策但 useSkill 失败时回退到普通攻击', () => {
      const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const state = makeStateMock();
      const ctx = makeMockCtx();
      ctx.enemy.getAvailableSkills.mockReturnValue([{ id: 'sk1', name: '火焰冲击' }]);
      ctx.enemy.useSkill.mockReturnValue({ success: false, damage: 0, isHeal: false });
      const action = useEnemyAction(state, makeLogMock(), ctx);

      const enemy = makeEnemy({ id: 'e1', name: '法师', aiStrategy: 'aggressive' });
      const result = action.enemyAction(enemy);

      expect(result.success).toBe(true);
      expect(result.type).toBe('attack'); // fallback 到 basic_attack
      mathSpy.mockRestore();
    });

    // -------- skill 决策：isHeal 路径 --------
    it('skill 决策且 isHeal=true 但找不到敌人数据时返回 failure', () => {
      const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const state = makeStateMock();
      const ctx = makeMockCtx();
      ctx.enemy.getAvailableSkills.mockReturnValue([{ id: 'sk1', name: '火焰冲击' }]);
      ctx.enemy.useSkill.mockReturnValue({ success: true, damage: -30, isHeal: true });
      ctx.enemy.getEnemyById.mockReturnValue(null);
      const action = useEnemyAction(state, makeLogMock(), ctx);

      const enemy = makeEnemy({ id: 'e1', name: '法师', aiStrategy: 'aggressive' });
      const result = action.enemyAction(enemy);

      expect(result.success).toBe(false);
      expect(result.message).toContain('找不到敌人数据');
      mathSpy.mockRestore();
    });

    it('skill 决策且 isHeal=true 时恢复敌人生命值', () => {
      const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const state = makeStateMock();
      const log = makeLogMock();
      const ctx = makeMockCtx();
      ctx.enemy.getAvailableSkills.mockReturnValue([{ id: 'sk1', name: '火焰冲击' }]);
      ctx.enemy.useSkill.mockReturnValue({ success: true, damage: -30, isHeal: true });
      const healedEnemy = makeEnemy({ id: 'e1', name: '法师' });
      ctx.enemy.getEnemyById.mockReturnValue(healedEnemy);
      const action = useEnemyAction(state, log, ctx);

      const enemy = makeEnemy({ id: 'e1', name: '法师', aiStrategy: 'aggressive' });
      const result = action.enemyAction(enemy);

      expect(result.success).toBe(true);
      expect(result.type).toBe('skill');
      expect(result.heal).toBe(-30);
      expect(result.message).toContain('恢复');
      // 验证日志包含 combat_heal
      const healLog = log.addCombatLog.mock.calls[0][0];
      expect(healLog.eventType).toBe('combat_heal');
      mathSpy.mockRestore();
    });

    // -------- skill 决策：isBuff + isDebuff 路径 --------
    it('skill 决策且 isBuff + isDebuff 时对玩家施加减益效果', () => {
      const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const state = makeStateMock();
      state.effectRegistry = { get: vi.fn(() => undefined) };
      const log = makeLogMock();
      const ctx = makeMockCtx();
      ctx.enemy.getAvailableSkills.mockReturnValue([{ id: 'sk1', name: '削弱术' }]);
      ctx.enemy.useSkill.mockReturnValue({
        success: true, damage: 0, isHeal: false,
        isBuff: true, buffs: [{ type: 'attack_down', value: 5, turns: 2 }],
      });
      ctx.skill.getSkill.mockReturnValue({ type: 'debuff' } as never);
      const action = useEnemyAction(state, log, ctx);

      const enemy = makeEnemy({ id: 'e1', name: '巫师', aiStrategy: 'aggressive' });
      const result = action.enemyAction(enemy);

      expect(result.success).toBe(true);
      expect(result.type).toBe('skill');
      // 减益效果应写入 playerEffects
      expect(state.playerEffects.value.effects.length).toBe(1);
      expect(state.playerEffects.value.effects[0].type).toBe('attack_down');
      // 日志包含"减益效果"
      const debuffLog = log.addCombatLog.mock.calls.find(
        (c: never[]) => (c[0] as { message: string }).message.includes('减益')
      );
      expect(debuffLog).toBeDefined();
      mathSpy.mockRestore();
    });

    // -------- skill 决策：isBuff + !isDebuff（buff to enemy）路径 --------
    it('skill 决策且 isBuff + 非减益时对敌人自身施加增益（创建新容器）', () => {
      const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const state = makeStateMock();
      state.effectRegistry = { get: vi.fn(() => undefined) };
      const log = makeLogMock();
      const ctx = makeMockCtx();
      ctx.enemy.getAvailableSkills.mockReturnValue([{ id: 'sk1', name: '狂暴' }]);
      ctx.enemy.useSkill.mockReturnValue({
        success: true, damage: 0, isHeal: false,
        isBuff: true, buffs: [{ type: 'attack_up', value: 10, turns: 3 }],
      });
      ctx.skill.getSkill.mockReturnValue({ type: 'buff' } as never);
      const action = useEnemyAction(state, log, ctx);

      const enemy = makeEnemy({ id: 'e1', name: '战士', aiStrategy: 'aggressive' });
      const result = action.enemyAction(enemy);

      expect(result.success).toBe(true);
      expect(result.type).toBe('skill');
      // 敌人效果容器被创建并写入增益
      expect(state.enemyEffects.value['e1']).toBeDefined();
      expect(state.enemyEffects.value['e1'].effects.length).toBe(1);
      expect(state.enemyEffects.value['e1'].effects[0].type).toBe('attack_up');
      // 日志包含"增益效果"
      const buffLog = log.addCombatLog.mock.calls.find(
        (c: never[]) => (c[0] as { message: string }).message.includes('增益')
      );
      expect(buffLog).toBeDefined();
      mathSpy.mockRestore();
    });

    it('skill 决策且 isBuff 时复用已存在的敌人效果容器', () => {
      const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const state = makeStateMock();
      state.effectRegistry = { get: vi.fn(() => undefined) };
      // 预先创建容器并放入一个已有效果
      state.enemyEffects.value['e1'] = createEmptyContainer();
      state.enemyEffects.value['e1'].effects.push({
        id: 'old', type: 'defense_up', remainingTurns: 2, value: 5, source: 'enemy', sourceName: '战士',
      });
      const log = makeLogMock();
      const ctx = makeMockCtx();
      ctx.enemy.getAvailableSkills.mockReturnValue([{ id: 'sk1', name: '狂暴' }]);
      ctx.enemy.useSkill.mockReturnValue({
        success: true, damage: 0, isHeal: false,
        isBuff: true, buffs: [{ type: 'attack_up', value: 10, turns: 3 }],
      });
      ctx.skill.getSkill.mockReturnValue({ type: 'buff' } as never);
      const action = useEnemyAction(state, log, ctx);

      const enemy = makeEnemy({ id: 'e1', name: '战士', aiStrategy: 'aggressive' });
      action.enemyAction(enemy);

      // 容器中应有 2 个效果（旧 + 新）
      expect(state.enemyEffects.value['e1'].effects.length).toBe(2);
      mathSpy.mockRestore();
    });

    // -------- skill 决策：非 buff 非 heal → enemyAttackWithSkill --------
    it('skill 决策且非 buff 非 heal 时执行技能攻击', () => {
      const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const state = makeStateMock();
      const ctx = makeMockCtx();
      ctx.enemy.getAvailableSkills.mockReturnValue([{ id: 'sk1', name: '火焰冲击' }]);
      ctx.enemy.useSkill.mockReturnValue({ success: true, damage: 25, isHeal: false });
      ctx.skill.getSkill.mockReturnValue({ type: 'magic_damage' } as never);
      const action = useEnemyAction(state, makeLogMock(), ctx);

      const enemy = makeEnemy({ id: 'e1', name: '法师', aiStrategy: 'aggressive' });
      const result = action.enemyAction(enemy);

      expect(result.success).toBe(true);
      expect(result.type).toBe('skill');
      expect(result.damage).toBe(20); // pipeResult.finalDamage
      mathSpy.mockRestore();
    });

    // -------- heal 决策 --------
    it('heal 决策且 useSkill 失败时回退到普通攻击', () => {
      const state = makeStateMock();
      const ctx = makeMockCtx();
      ctx.enemy.getAvailableSkills.mockReturnValue([{ id: 'heal1', name: '自我治疗', isHeal: true }]);
      ctx.enemy.useSkill.mockReturnValue({ success: false, damage: 0, isHeal: false });
      const action = useEnemyAction(state, makeLogMock(), ctx);

      // defensive 策略在 hp < 40% 且有治疗技能时必定选择 heal
      const enemy = makeEnemy({ id: 'e1', name: '牧师', aiStrategy: 'defensive', hp: 20, maxHp: 100 });
      const result = action.enemyAction(enemy);

      expect(result.success).toBe(true);
      expect(result.type).toBe('attack'); // fallback 到 basic_attack
    });

    it('heal 决策且找不到敌人数据时返回 failure', () => {
      const state = makeStateMock();
      const ctx = makeMockCtx();
      ctx.enemy.getAvailableSkills.mockReturnValue([{ id: 'heal1', name: '自我治疗', isHeal: true }]);
      ctx.enemy.useSkill.mockReturnValue({ success: true, damage: -30, isHeal: true });
      ctx.enemy.getEnemyById.mockReturnValue(null);
      const action = useEnemyAction(state, makeLogMock(), ctx);

      const enemy = makeEnemy({ id: 'e1', name: '牧师', aiStrategy: 'defensive', hp: 20, maxHp: 100 });
      const result = action.enemyAction(enemy);

      expect(result.success).toBe(false);
      expect(result.message).toContain('找不到敌人数据');
    });

    it('heal 决策成功时恢复敌人生命值', () => {
      const state = makeStateMock();
      const log = makeLogMock();
      const ctx = makeMockCtx();
      ctx.enemy.getAvailableSkills.mockReturnValue([{ id: 'heal1', name: '自我治疗', isHeal: true }]);
      ctx.enemy.useSkill.mockReturnValue({ success: true, damage: -30, isHeal: true });
      ctx.enemy.getEnemyById.mockReturnValue(makeEnemy({ id: 'e1', name: '牧师' }));
      const action = useEnemyAction(state, log, ctx);

      const enemy = makeEnemy({ id: 'e1', name: '牧师', aiStrategy: 'defensive', hp: 20, maxHp: 100 });
      const result = action.enemyAction(enemy);

      expect(result.success).toBe(true);
      expect(result.type).toBe('skill');
      expect(result.heal).toBe(-30);
      expect(result.message).toContain('恢复');
    });

    // -------- aiStrategy 未设置时默认 balanced --------
    it('aiStrategy 未设置时使用 balanced 策略', () => {
      const state = makeStateMock();
      const ctx = makeMockCtx();
      ctx.enemy.getAvailableSkills.mockReturnValue([]);
      const action = useEnemyAction(state, makeLogMock(), ctx);

      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      delete (enemy as { aiStrategy?: string }).aiStrategy;
      const result = action.enemyAction(enemy);

      expect(result.success).toBe(true);
      expect(ctx.enemy.calculateDamage).toHaveBeenCalled();
    });
  });

  // -------------------- applyEnemyDamageToPlayer 补充 --------------------

  describe('applyEnemyDamageToPlayer：补充分支', () => {
    it('actualDamage > 0 时触发 resourceSystems 的 onDamaged 钩子', () => {
      const state = makeStateMock();
      const onDamagedSpy = vi.fn();
      state.resourceSystems.value = [{ onDamaged: onDamagedSpy }];
      const ctx = makeMockCtx();
      const action = useEnemyAction(state, makeLogMock(), ctx);

      action.applyEnemyDamageToPlayer(makeEnemy({ id: 'e1' }), 30);

      expect(onDamagedSpy).toHaveBeenCalledWith(20); // pipeResult.finalDamage
    });

    it('resourceSystems 中 onDamaged 为可选时不报错', () => {
      const state = makeStateMock();
      state.resourceSystems.value = [{}]; // 无 onDamaged 方法
      const ctx = makeMockCtx();
      const action = useEnemyAction(state, makeLogMock(), ctx);

      expect(() => action.applyEnemyDamageToPlayer(makeEnemy({ id: 'e1' }), 30)).not.toThrow();
    });

    it('damageReduction=0 时直接使用管线伤害值', () => {
      pipeResultMock.finalDamage = 50;
      const state = makeStateMock();
      const passive = makePassiveMock();
      passive.getDamageReduction.mockReturnValue(0);
      const ctx = makeMockCtx();
      const action = useEnemyAction(state, makeLogMock(), ctx, passive);

      const result = action.applyEnemyDamageToPlayer(makeEnemy({ id: 'e1' }), 50);

      expect(result.actualDamage).toBe(50);
      expect(ctx.character.takeDamage).toHaveBeenCalledWith(50);
    });
  });

  // -------------------- 边界分支补充：技能名称回退 --------------------

  describe('边界分支补充：技能名称缺失时回退为 skillId', () => {
    it('skill 决策 isHeal 路径：技能名称缺失时日志 skillName 回退为 skillId', () => {
      // 覆盖 useEnemyAction.ts 第 342 行：healSkillData?.name || decision.skillId falsy 分支
      const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const state = makeStateMock();
      const log = makeLogMock();
      const ctx = makeMockCtx();
      // availableSkills 中技能缺少 name 字段
      ctx.enemy.getAvailableSkills.mockReturnValue([{ id: 'sk1' } as never]);
      ctx.enemy.useSkill.mockReturnValue({ success: true, damage: -30, isHeal: true });
      ctx.enemy.getEnemyById.mockReturnValue(makeEnemy({ id: 'e1', name: '法师' }));
      const action = useEnemyAction(state, log, ctx);

      const enemy = makeEnemy({ id: 'e1', name: '法师', aiStrategy: 'aggressive' });
      action.enemyAction(enemy);

      // 日志 skillName 回退为 decision.skillId
      const healLog = log.addCombatLog.mock.calls[0][0] as { skillName: string };
      expect(healLog.skillName).toBe('sk1');
      mathSpy.mockRestore();
    });

    it('skill 决策 isBuff 路径：技能名称缺失时 skillName 回退为 skillId', () => {
      // 覆盖 useEnemyAction.ts 第 366 行：skillData?.name || decision.skillId falsy 分支
      const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const state = makeStateMock();
      state.effectRegistry = { get: vi.fn(() => undefined) };
      const log = makeLogMock();
      const ctx = makeMockCtx();
      ctx.enemy.getAvailableSkills.mockReturnValue([{ id: 'sk1' } as never]);
      ctx.enemy.useSkill.mockReturnValue({
        success: true, damage: 0, isHeal: false,
        isBuff: true, buffs: [{ type: 'attack_down', value: 5, turns: 2 }],
      });
      ctx.skill.getSkill.mockReturnValue({ type: 'debuff' } as never);
      const action = useEnemyAction(state, log, ctx);

      const enemy = makeEnemy({ id: 'e1', name: '巫师', aiStrategy: 'aggressive' });
      const result = action.enemyAction(enemy);

      // 验证日志 message 中包含 skillId（回退）
      const buffLog = log.addCombatLog.mock.calls[0][0] as { message: string };
      expect(buffLog.message).toContain('sk1');
      mathSpy.mockRestore();
    });

    it('skill 决策攻击路径：技能名称缺失时 skillName 回退为 skillId', () => {
      // 覆盖 useEnemyAction.ts 第 449 行：skillData?.name || decision.skillId falsy 分支
      const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const state = makeStateMock();
      const ctx = makeMockCtx();
      ctx.enemy.getAvailableSkills.mockReturnValue([{ id: 'sk1' } as never]);
      ctx.enemy.useSkill.mockReturnValue({ success: true, damage: 25, isHeal: false });
      ctx.skill.getSkill.mockReturnValue({ type: 'magic_damage' } as never);
      const action = useEnemyAction(state, makeLogMock(), ctx);

      const enemy = makeEnemy({ id: 'e1', name: '法师', aiStrategy: 'aggressive' });
      const result = action.enemyAction(enemy);

      // 技能攻击返回成功，skillName 回退为 skillId
      expect(result.success).toBe(true);
      expect(result.type).toBe('skill');
      mathSpy.mockRestore();
    });

    it('heal 决策路径：技能名称缺失时日志 skillName 回退为 skillId', () => {
      // 覆盖 useEnemyAction.ts 第 466 行：healSkillData?.name || decision.skillId falsy 分支
      const state = makeStateMock();
      const log = makeLogMock();
      const ctx = makeMockCtx();
      // 治疗技能缺少 name 字段
      ctx.enemy.getAvailableSkills.mockReturnValue([{ id: 'heal1', isHeal: true } as never]);
      ctx.enemy.useSkill.mockReturnValue({ success: true, damage: -30, isHeal: true });
      ctx.enemy.getEnemyById.mockReturnValue(makeEnemy({ id: 'e1', name: '牧师' }));
      const action = useEnemyAction(state, log, ctx);

      const enemy = makeEnemy({ id: 'e1', name: '牧师', aiStrategy: 'defensive', hp: 20, maxHp: 100 });
      action.enemyAction(enemy);

      // 日志 skillName 回退为 decision.skillId
      const healLog = log.addCombatLog.mock.calls[0][0] as { skillName: string };
      expect(healLog.skillName).toBe('heal1');
    });
  });

  // -------------------- 边界分支补充：护盾吸收 + 技能组合 --------------------

  describe('边界分支补充：护盾吸收与技能同时存在', () => {
    it('shieldAbsorbed>0 且传入 skill 时日志包含技能名与护盾吸收', () => {
      // 覆盖 useEnemyAction.ts 第 132 行：shieldAbsorbed>0 且 skill truthy 的组合分支
      pipeResultMock.absorbed = 5;
      const state = makeStateMock();
      const log = makeLogMock();
      const ctx = makeMockCtx();
      const action = useEnemyAction(state, log, ctx);

      const enemy = makeEnemy({ id: 'e1', name: '黑龙' });
      action.applyEnemyDamageToPlayer(enemy, 30, { id: 'sk1', name: '火焰冲击' });

      const logCall = log.addCombatLog.mock.calls[0][0] as { message: string };
      // 日志应同时包含技能名和护盾吸收
      expect(logCall.message).toContain('火焰冲击');
      expect(logCall.message).toContain('护盾吸收');
    });
  });
});
