/**
 * @fileoverview 宠物行动 Composable（usePetAction）单元测试（P3-156）
 *
 * 覆盖 usePetAction 的：
 * 1. petTakeTurn：攻击造成伤害、敌人闪避、buff 类技能仅写日志、无目标、宠物未激活
 * 2. petTakeDamage：包装 petStore.takeDamage
 * 3. petTickTurn：包装 petStore.tickTurn
 * 4. summon：成功、资源不足、未解锁、已有激活、灵魂碎片系统未初始化
 * 5. dismiss：成功、无宠物
 * 6. selectPetTarget：优先 currentTarget、回退 aliveEnemies[0]
 *
 * Mock 策略：
 *  - usePetStore mock 模块（控制 hasActivePet/activePet/petTakeAction 等）
 *  - processDamagePipeline mock 模块（控制伤害管线结果）
 *  - rollDodge mock 模块（控制闪避判定）
 *  - calculatePetSkillDamage / getPetByType 用实际实现（importActual）
 *  - state / log / ctx 构造 minimal mock
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { createEmptyContainer, type EffectContainer } from '@/modules/combat/effects';
import { rollDodge } from '@/modules/combat/service';
import type { PetInstance, PetSkill, WarlockPetType } from '@/modules/combat/pets';
import type { EnemyInstance } from '@/modules/enemy/types';
import type { ICombatContext } from '@/modules/combat/combatContext';

// ==================== Mock 数据 ====================

const petSkillAttack: PetSkill = {
  id: 'firebolt', name: '火球术', description: '', category: 'attack',
  damageMultiplier: 1.0, cooldown: 0, priority: 10,
};

const petSkillBuff: PetSkill = {
  id: 'fire_shield', name: '火焰护盾', description: '', category: 'buff',
  damageMultiplier: 0, cooldown: 3, priority: 5,
};

function makePetInstance(overrides: Partial<PetInstance> = {}): PetInstance {
  return {
    instanceId: 'pet_001',
    petId: 'imp' as WarlockPetType,
    name: '小鬼',
    level: 5,
    hp: 30,
    maxHp: 30,
    damage: 15,
    defense: 2,
    speed: 12,
    stats: { str: 3, dex: 8, con: 4, int: 12, wis: 8, cha: 6 },
    skills: [petSkillAttack],
    aiBehavior: 'caster',
    durationRemaining: 0,
    skillCooldowns: {},
    ...overrides,
  };
}

// petStore mock（可控的 hasActivePet / activePet / petTakeAction 等）
// 注意：真实 Pinia store 的 computed 属性在 store 实例上会自动解包为值，
// 因此 mock 中 hasActivePet/activePet 使用普通值（非 ref），通过直接赋值控制。
const petStoreMock = {
  hasActivePet: false,
  activePet: null as PetInstance | null,
  petTakeAction: vi.fn((): PetSkill | null => petSkillAttack),
  takeDamage: vi.fn(),
  tickTurn: vi.fn(),
  canSummon: vi.fn(() => ({ canSummon: true, reason: '' })),
  summon: vi.fn(() => true),
  dismiss: vi.fn(),
  unlockedPets: [] as never[],
  // P9-068 修复：测试更新 — 补充 petStore 接口完整字段
  unlockPet: vi.fn(),
  reset: vi.fn(),
};

vi.mock('@/modules/combat/pets', async () => {
  const actual = await vi.importActual<typeof import('@/modules/combat/pets')>('@/modules/combat/pets');
  return {
    ...actual,
    usePetStore: vi.fn(() => petStoreMock),
  };
});

// mock rollDodge（控制闪避判定）
vi.mock('@/modules/combat/service', () => ({
  rollDodge: vi.fn(() => false),
  generateBattleLogId: vi.fn(() => 'log-id'),
  isBossCombat: vi.fn(() => false),
  generateCombatId: vi.fn(() => 'combat-1'),
  calculateFleeChance: vi.fn(() => 0.5),
  rollFleeSuccess: vi.fn(() => true),
  rollCritical: vi.fn(() => ({ isCrit: false, multiplier: 1 })),
}));

// mock processDamagePipeline（控制伤害管线结果）
const pipeResultMock = { expectedDamage: 15, actualDamage: 15, absorbed: 0, finalDamage: 15 };
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
    dodgeChance: 0,
    ...o,
  } as EnemyInstance;
}

function makeStateMock(enemies: EnemyInstance[] = [], target: EnemyInstance | null = null) {
  return {
    state: ref<'idle' | 'fighting' | 'ended'>('fighting'),
    enemyIds: ref(enemies.map(e => e.id)),
    targetEnemyId: ref<string | null>(target?.id ?? null),
    turn: ref<'player' | 'enemy' | 'pet'>('pet'),
    turnCount: ref(1),
    combatId: ref('combat-1'),
    combatLogs: ref<unknown[]>([]),
    enemies: ref(enemies),
    aliveEnemies: ref(enemies.filter(e => e.hp > 0)),
    currentTarget: ref(target),
    hasBossEnemy: ref(false),
    playerEffects: ref<EffectContainer>(createEmptyContainer()),
    enemyEffects: ref<Record<string, EffectContainer>>({}),
    effectRegistry: { reduceSum: vi.fn(() => 0), reduceMultiplier: vi.fn(() => 1) },
    resourceSystems: ref([
      { type: 'soul_shard', currentValue: 3, hasEnough: vi.fn(() => true), consume: vi.fn(() => true) },
    ]),
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

function makeBossMock() {
  return {
    applyBossDefenseMechanics: vi.fn((_e: unknown, d: number) => ({ damage: d, blocked: false })),
    applyBossCounterMechanics: vi.fn(),
    checkBossRevive: vi.fn(() => false),
  } as never;
}

function makeMockCtx(overrides: Partial<ICombatContext> = {}): ICombatContext {
  return {
    character: {
      name: '英雄', classId: 'warlock', hp: 100, maxHp: 100, mana: 50, maxMana: 50,
      attributes: { physicalAttack: 20, physicalDefense: 10, magicAttack: 15, magicDefense: 8 } as never,
      effectiveStats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } as never,
      takeDamage: vi.fn(), gainExp: vi.fn(), gainGold: vi.fn(), handleDeath: vi.fn(), receiveHeal: vi.fn(), changeMp: vi.fn(),
    },
    skill: { castSkill: vi.fn(), getSkill: vi.fn(), tickCooldowns: vi.fn(), resetCooldowns: vi.fn() },
    enemy: {
      getEnemyById: vi.fn(() => null), deleteEnemy: vi.fn(), takeDamage: vi.fn(() => false),
      createEnemy: vi.fn(), getAvailableSkills: vi.fn(() => []),
      useSkill: vi.fn(() => ({ success: false, damage: 0, isHeal: false })),
      calculateDamage: vi.fn(() => 10), tickCooldowns: vi.fn(),
    },
    quest: { onEnemyKilled: vi.fn() },
    log: { addLogEntry: vi.fn() },
    inventory: { useItem: vi.fn(), getItemInfo: vi.fn(), addItem: vi.fn() },
    talent: { damageMultiplier: 0, damageReduction: 0, resourceBonuses: {}, skillEnhancements: [], unlockedPets: [] },
    ...overrides,
  } as unknown as ICombatContext;
}

// ==================== 测试用例 ====================

describe('usePetAction - 宠物行动 Composable（P3-156）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    petStoreMock.hasActivePet = false;
    petStoreMock.activePet = null;
    pipeResultMock.finalDamage = 15;
    vi.mocked(rollDodge).mockReturnValue(false);
    petStoreMock.petTakeAction.mockReturnValue(petSkillAttack);
  });

  // -------------------- petTakeTurn --------------------

  describe('petTakeTurn：宠物回合行动', () => {
    it('宠物攻击造成伤害并写日志', async () => {
      const pet = makePetInstance();
      petStoreMock.hasActivePet = true;
      petStoreMock.activePet = pet;
      const enemy = makeEnemy();
      const state = makeStateMock([enemy], enemy);
      const ctx = makeMockCtx();
      const logMock = makeLogMock();

      const { usePetAction } = await import('@/modules/combat/composables/usePetAction');
      const action = usePetAction(state, logMock, ctx, makeBossMock(), petStoreMock);
      action.petTakeTurn();

      expect(ctx.enemy.takeDamage).toHaveBeenCalledWith('e1', 15);
      expect(logMock.addCombatLog).toHaveBeenCalled();
    });

    it('敌人闪避时不造成伤害', async () => {
      const pet = makePetInstance();
      petStoreMock.hasActivePet = true;
      petStoreMock.activePet = pet;
      const enemy = makeEnemy();
      const state = makeStateMock([enemy], enemy);
      const ctx = makeMockCtx();
      vi.mocked(rollDodge).mockReturnValue(true);

      const { usePetAction } = await import('@/modules/combat/composables/usePetAction');
      const action = usePetAction(state, makeLogMock(), ctx, makeBossMock(), petStoreMock);
      action.petTakeTurn();

      expect(ctx.enemy.takeDamage).not.toHaveBeenCalled();
    });

    it('buff 类技能（damageMultiplier=0）仅写日志不造成伤害', async () => {
      const pet = makePetInstance();
      petStoreMock.hasActivePet = true;
      petStoreMock.activePet = pet;
      petStoreMock.petTakeAction.mockReturnValue(petSkillBuff);
      const enemy = makeEnemy();
      const state = makeStateMock([enemy], enemy);
      const ctx = makeMockCtx();

      const { usePetAction } = await import('@/modules/combat/composables/usePetAction');
      const action = usePetAction(state, makeLogMock(), ctx, makeBossMock(), petStoreMock);
      action.petTakeTurn();

      expect(ctx.enemy.takeDamage).not.toHaveBeenCalled();
      expect(petStoreMock.petTakeAction).toHaveBeenCalled();
    });

    it('无目标时不行动', async () => {
      const pet = makePetInstance();
      petStoreMock.hasActivePet = true;
      petStoreMock.activePet = pet;
      const state = makeStateMock([], null);
      const ctx = makeMockCtx();

      const { usePetAction } = await import('@/modules/combat/composables/usePetAction');
      const action = usePetAction(state, makeLogMock(), ctx, makeBossMock(), petStoreMock);
      action.petTakeTurn();

      expect(ctx.enemy.takeDamage).not.toHaveBeenCalled();
    });

    it('宠物未激活时不行动', async () => {
      petStoreMock.hasActivePet = false;
      petStoreMock.activePet = null;
      const enemy = makeEnemy();
      const state = makeStateMock([enemy], enemy);
      const ctx = makeMockCtx();

      const { usePetAction } = await import('@/modules/combat/composables/usePetAction');
      const action = usePetAction(state, makeLogMock(), ctx, makeBossMock(), petStoreMock);
      action.petTakeTurn();

      expect(ctx.enemy.takeDamage).not.toHaveBeenCalled();
      expect(petStoreMock.petTakeAction).not.toHaveBeenCalled();
    });

    it('伤害被护盾完全吸收时不调用 takeDamage', async () => {
      const pet = makePetInstance();
      petStoreMock.hasActivePet = true;
      petStoreMock.activePet = pet;
      pipeResultMock.finalDamage = 0;
      const enemy = makeEnemy();
      const state = makeStateMock([enemy], enemy);
      const ctx = makeMockCtx();

      const { usePetAction } = await import('@/modules/combat/composables/usePetAction');
      const action = usePetAction(state, makeLogMock(), ctx, makeBossMock(), petStoreMock);
      action.petTakeTurn();

      expect(ctx.enemy.takeDamage).not.toHaveBeenCalled();
    });
  });

  // -------------------- petTakeDamage / petTickTurn --------------------

  describe('petTakeDamage / petTickTurn：包装方法', () => {
    it('petTakeDamage 调用 petStore.takeDamage', async () => {
      const state = makeStateMock();
      const ctx = makeMockCtx();
      const { usePetAction } = await import('@/modules/combat/composables/usePetAction');
      const action = usePetAction(state, makeLogMock(), ctx, makeBossMock(), petStoreMock);
      action.petTakeDamage(10);
      expect(petStoreMock.takeDamage).toHaveBeenCalledWith(10);
    });

    it('petTickTurn 调用 petStore.tickTurn', async () => {
      const state = makeStateMock();
      const ctx = makeMockCtx();
      const { usePetAction } = await import('@/modules/combat/composables/usePetAction');
      const action = usePetAction(state, makeLogMock(), ctx, makeBossMock(), petStoreMock);
      action.petTickTurn();
      expect(petStoreMock.tickTurn).toHaveBeenCalled();
    });
  });

  // -------------------- summon --------------------

  describe('summon：召唤宠物（资源消耗闭环）', () => {
    it('资源足够且已解锁时召唤成功并消耗灵魂碎片', async () => {
      const state = makeStateMock();
      const soulShardSys = state.resourceSystems.value[0];
      const ctx = makeMockCtx();
      const { usePetAction } = await import('@/modules/combat/composables/usePetAction');
      const action = usePetAction(state, makeLogMock(), ctx, makeBossMock(), petStoreMock);
      const result = action.summon('imp' as WarlockPetType);

      expect(result.success).toBe(true);
      expect(petStoreMock.summon).toHaveBeenCalled();
      expect(soulShardSys.consume).toHaveBeenCalled();
    });

    it('资源不足时召唤失败', async () => {
      const state = makeStateMock();
      const soulShardSys = state.resourceSystems.value[0];
      (soulShardSys.hasEnough as ReturnType<typeof vi.fn>).mockReturnValue(false);
      (soulShardSys.consume as ReturnType<typeof vi.fn>).mockReturnValue(false);
      petStoreMock.canSummon.mockReturnValue({ canSummon: false, reason: '灵魂碎片不足' });
      const ctx = makeMockCtx();
      const { usePetAction } = await import('@/modules/combat/composables/usePetAction');
      const action = usePetAction(state, makeLogMock(), ctx, makeBossMock(), petStoreMock);
      const result = action.summon('doomguard' as WarlockPetType);

      expect(result.success).toBe(false);
      expect(petStoreMock.summon).not.toHaveBeenCalled();
    });

    it('灵魂碎片系统未初始化时召唤失败', async () => {
      const state = makeStateMock();
      state.resourceSystems.value = [];
      const ctx = makeMockCtx();
      const { usePetAction } = await import('@/modules/combat/composables/usePetAction');
      const action = usePetAction(state, makeLogMock(), ctx, makeBossMock(), petStoreMock);
      const result = action.summon('imp' as WarlockPetType);

      expect(result.success).toBe(false);
      expect(result.message).toContain('灵魂碎片系统');
    });
  });

  // -------------------- dismiss --------------------

  describe('dismiss：解散宠物', () => {
    it('有激活宠物时解散成功', async () => {
      petStoreMock.activePet = makePetInstance();
      const state = makeStateMock();
      const ctx = makeMockCtx();
      const { usePetAction } = await import('@/modules/combat/composables/usePetAction');
      const action = usePetAction(state, makeLogMock(), ctx, makeBossMock(), petStoreMock);
      const result = action.dismiss();

      expect(result.success).toBe(true);
      expect(petStoreMock.dismiss).toHaveBeenCalled();
    });

    it('无激活宠物时解散失败', async () => {
      petStoreMock.activePet = null;
      const state = makeStateMock();
      const ctx = makeMockCtx();
      const { usePetAction } = await import('@/modules/combat/composables/usePetAction');
      const action = usePetAction(state, makeLogMock(), ctx, makeBossMock(), petStoreMock);
      const result = action.dismiss();

      expect(result.success).toBe(false);
    });
  });

  // -------------------- selectPetTarget --------------------

  describe('selectPetTarget：目标选择', () => {
    it('优先选择玩家当前目标', async () => {
      const target = makeEnemy({ id: 'e_target', name: '目标敌人' });
      const other = makeEnemy({ id: 'e_other', name: '其他敌人' });
      const state = makeStateMock([target, other], target);
      const ctx = makeMockCtx();
      const { usePetAction } = await import('@/modules/combat/composables/usePetAction');
      const action = usePetAction(state, makeLogMock(), ctx, makeBossMock(), petStoreMock);
      const selected = action.selectPetTarget();

      expect(selected?.id).toBe('e_target');
    });

    it('无当前目标时回退到第一个存活敌人', async () => {
      const e1 = makeEnemy({ id: 'e1' });
      const e2 = makeEnemy({ id: 'e2' });
      const state = makeStateMock([e1, e2], null);
      const ctx = makeMockCtx();
      const { usePetAction } = await import('@/modules/combat/composables/usePetAction');
      const action = usePetAction(state, makeLogMock(), ctx, makeBossMock(), petStoreMock);
      const selected = action.selectPetTarget();

      expect(selected?.id).toBe('e1');
    });

    it('无存活敌人时返回 null', async () => {
      const state = makeStateMock([], null);
      const ctx = makeMockCtx();
      const { usePetAction } = await import('@/modules/combat/composables/usePetAction');
      const action = usePetAction(state, makeLogMock(), ctx, makeBossMock(), petStoreMock);
      const selected = action.selectPetTarget();

      expect(selected).toBeNull();
    });
  });
});
