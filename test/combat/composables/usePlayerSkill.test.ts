/**
 * @fileoverview usePlayerSkill Composable 单元测试（QA-9）
 *
 * 直接测试 usePlayerSkill（不通过 usePlayerAction 编排），覆盖：
 *   - 资源不足时返回失败
 *   - castSkill 失败时透传 message
 *   - AOE / single / self 三个伤害技能分支
 *   - buff / debuff（all_enemies / single）效果分支
 *   - heal 恢复分支
 *
 * Mock 策略与 usePlayerAction.test.ts 一致，applySkillBuffs / applyDebuffToEnemy
 * 通过 SkillHelpers 接口注入 mock 实现。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { usePlayerSkill, type SkillHelpers } from '@/modules/combat/composables/usePlayerSkill';
import {
  createEmptyContainer,
  processDamagePipeline,
  type EffectContainer,
} from '@/modules/combat/effects';
import type { ICombatContext } from '@/modules/combat/combatContext';
import type { EnemyInstance } from '@/modules/enemy/types';

// ==================== Mock 模块 ====================

const characterMock = {
  name: '英雄',
  hp: 100,
  maxHp: 100,
  takeDamage: vi.fn(),
  attributes: {
    physicalAttack: 20,
    physicalDefense: 10,
    magicAttack: 15,
    magicDefense: 8,
    critChance: 0,
    dodgeChance: 0,
  } as never,
  effectiveStats: { dex: 10 } as never,
};
vi.mock('@/modules/character/store', () => ({
  useCharacterStore: vi.fn(() => characterMock),
}));

const enemyStoreMock = {
  getEnemyById: vi.fn(() => null),
  takeDamage: vi.fn(() => false),
};
vi.mock('@/modules/enemy/store', () => ({
  useEnemyStore: vi.fn(() => enemyStoreMock),
}));

const skillStoreMock = {
  getSkill: vi.fn(() => null),
  castSkill: vi.fn(),
  tickCooldowns: vi.fn(),
};
vi.mock('@/modules/skill/store', () => ({
  useSkillStore: vi.fn(() => skillStoreMock),
}));

const inventoryStoreMock = {
  getItemInfo: vi.fn(() => null),
  useItem: vi.fn().mockResolvedValue(undefined),
  addItem: vi.fn(),
};
vi.mock('@/modules/inventory/store', () => ({
  useInventoryStore: vi.fn(() => inventoryStoreMock),
}));

const logStoreMock = {
  addLogEntry: vi.fn(),
};
vi.mock('@/modules/log/store', () => ({
  useLogStore: vi.fn(() => logStoreMock),
}));

vi.mock('@/modules/log/service', () => ({
  generateLogId: vi.fn(() => 'log-id'),
}));

vi.mock('@/modules/bus', () => ({
  eventBus: { emit: vi.fn() },
  GameEvents: {
    COMBAT_DEAL_DAMAGE: 'combat:deal-damage',
    COMBAT_CRITICAL_HIT: 'combat:critical-hit',
    COMBAT_DODGE: 'combat:dodge',
    COMBAT_CAST_HEAL: 'combat:cast-heal',
    INVENTORY_FULL: 'inventory_full',
  },
}));

// mock combat/service（控制暴击判定）
const rollCriticalMock = vi.fn(() => false);
vi.mock('@/modules/combat/service', () => ({
  rollCritical: (...args: unknown[]) => rollCriticalMock(...([] as never[])),
  rollDodge: vi.fn(),
  calculateFleeChance: vi.fn(),
  rollFleeSuccess: vi.fn(),
  generateCombatId: vi.fn(),
  generateBattleLogId: vi.fn(),
  isBossCombat: vi.fn(),
}));

// mock critCalc（QA-12 后 critCalc 直接使用 Rng 接口，不再依赖 rollCritical）
// 通过控制 rollPlayerCrit 返回值来模拟暴击/非暴击场景
const rollPlayerCritMock = vi.hoisted(() => vi.fn(() => ({ isCrit: false, multiplier: 1 })));
vi.mock('@/modules/combat/composables/helpers/critCalc', () => ({
  rollPlayerCrit: rollPlayerCritMock,
  computeThornsDamage: (thorns: number, multiplier: number) => Math.floor(thorns * multiplier),
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
    ...o,
  } as EnemyInstance;
}

function makeStateMock(opts: { target?: EnemyInstance | null; alive?: EnemyInstance[] } = {}) {
  const target = opts.target !== undefined ? opts.target : makeEnemy();
  const alive = opts.alive !== undefined ? opts.alive : (target ? [target] : []);
  return {
    playerEffects: ref<EffectContainer>(createEmptyContainer()),
    enemyEffects: ref<Record<string, EffectContainer>>({}),
    effectRegistry: {
      reduceSum: vi.fn(() => 0),
      get: vi.fn(() => undefined),
    } as never,
    resourceSystems: ref<unknown[]>([]),
    aliveEnemies: { value: alive },
    currentTarget: { value: target },
  } as never;
}

function makeLogMock() {
  return {
    addCombatLog: vi.fn(),
    saveLogs: vi.fn().mockResolvedValue(undefined),
    createPlayerEffectContext: vi.fn(() => ({
      ownerId: 'player',
      ownerType: 'player',
      baseStats: { speed: 0, physicalAttack: 20, physicalDefense: 10, magicAttack: 15, magicDefense: 8 },
      currentHp: 100,
      maxHp: 100,
    })),
    createEnemyEffectContext: vi.fn(() => ({
      ownerId: 'e1',
      ownerType: 'enemy',
      baseStats: { speed: 0, physicalAttack: 10, physicalDefense: 5, magicAttack: 5, magicDefense: 3 },
      currentHp: 50,
      maxHp: 50,
    })),
  } as never;
}

function makeInitiativeMock() {
  return { endPlayerTurn: vi.fn(), buildInitiativeOrder: vi.fn() } as never;
}

function makeBossMock() {
  return {
    applyBossDefenseMechanics: vi.fn((_: EnemyInstance, rawDamage: number) => ({
      damage: rawDamage,
      blocked: false,
    })),
    applyBossCounterMechanics: vi.fn(),
    checkBossRevive: vi.fn(() => false),
  } as never;
}

function makeHelpersMock(): SkillHelpers {
  return {
    applySkillBuffs: vi.fn(),
    applyDebuffToEnemy: vi.fn(),
  };
}

/**
 * P3-146：usePlayerSkill 新增 passive 参数，构造 mock 注入
 * 默认返回空 stat_modifier 数组，使管线退化为原始行为。
 */
function makePassiveMock() {
  return {
    onDamaged: vi.fn(),
    onAttack: vi.fn(),
    onKill: vi.fn(),
    getDamageReduction: vi.fn(() => 0),
    getStatModifiers: vi.fn(() => []),
  } as never;
}

/**
 * P3-156 M4-4：usePlayerSkill 新增 pet 参数，构造 mock 注入
 * 默认无激活宠物，避免干扰非宠物技能的现有测试。
 */
function makePetMock(opts: { hasActivePet?: boolean; activePet?: unknown } = {}) {
  return {
    petStore: {
      hasActivePet: opts.hasActivePet ?? false,
      activePet: opts.activePet ?? null,
      getSummonable: vi.fn(() => []),
    },
    summon: vi.fn(() => ({ success: false, message: 'mock' })),
    dismiss: vi.fn(() => ({ success: false, message: 'mock' })),
    petTakeTurn: vi.fn(),
    petTakeDamage: vi.fn(),
    petTickTurn: vi.fn(),
    selectPetTarget: vi.fn(() => null),
    createPetEffectContext: vi.fn(() => ({
      ownerId: 'pet-mock',
      ownerType: 'player',
      baseStats: { physicalAttack: 0, physicalDefense: 0, magicAttack: 0, magicDefense: 0, speed: 0 },
      currentHp: 0,
      maxHp: 0,
    })),
  } as never;
}

function makeMockCtx(): ICombatContext {
  return {
    character: {
      get name() { return characterMock.name; },
      get classId() { return 'warrior' as never; },
      get hp() { return characterMock.hp; },
      get maxHp() { return characterMock.maxHp; },
      get attributes() { return characterMock.attributes; },
      get effectiveStats() { return characterMock.effectiveStats; },
      takeDamage: characterMock.takeDamage,
      gainExp: vi.fn(),
      gainGold: vi.fn(),
      handleDeath: vi.fn(),
      receiveHeal: vi.fn(),
      changeMp: vi.fn(),
    },
    skill: {
      getSkill: skillStoreMock.getSkill,
      castSkill: skillStoreMock.castSkill,
      tickCooldowns: skillStoreMock.tickCooldowns,
      resetCooldowns: vi.fn(),
    },
    enemy: {
      getEnemyById: enemyStoreMock.getEnemyById,
      takeDamage: enemyStoreMock.takeDamage,
      deleteEnemy: vi.fn(),
      createEnemy: vi.fn(),
      getAvailableSkills: vi.fn(),
      useSkill: vi.fn(),
      calculateDamage: vi.fn(),
      tickCooldowns: vi.fn(),
    },
    quest: { onEnemyKilled: vi.fn() },
    log: { addLogEntry: logStoreMock.addLogEntry },
    inventory: {
      getItemInfo: inventoryStoreMock.getItemInfo,
      useItem: inventoryStoreMock.useItem,
      addItem: inventoryStoreMock.addItem,
    },
  } as unknown as ICombatContext;
}

// ==================== 测试用例 ====================

describe('usePlayerSkill - 玩家技能 Composable（QA-9）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    characterMock.hp = 100;
    pipeResultMock.finalDamage = 20;
    pipeResultMock.absorbed = 0;
    pipeResultMock.thorns = 0;
    rollPlayerCritMock.mockReturnValue({ isCrit: false, multiplier: 1 });
    enemyStoreMock.takeDamage.mockReturnValue(false);
    enemyStoreMock.getEnemyById.mockReturnValue(null);
    skillStoreMock.getSkill.mockReturnValue(null);
    skillStoreMock.castSkill.mockResolvedValue({ success: false, message: 'fail' });
  });

  it('返回包含 playerSkill 方法的对象', () => {
    const skill = usePlayerSkill(
      makeStateMock(),
      makeLogMock(),
      makeMockCtx(),
      makeInitiativeMock(),
      vi.fn(),
      makeBossMock(),
      makeHelpersMock(),
      makePassiveMock(), makePetMock(),
    );
    expect(typeof skill.playerSkill).toBe('function');
  });

  describe('资源与失败路径', () => {
    it('资源不足时返回 success=false 且不调用 castSkill', async () => {
      const skill = {
        id: 'sk1', name: '怒吼', resourceType: 'rage', resourceCost: 30,
      };
      skillStoreMock.getSkill.mockReturnValue(skill);
      const resourceSys = {
        type: 'rage', hasEnough: vi.fn(() => false), consume: vi.fn(),
      };
      const state = makeStateMock();
      state.resourceSystems.value = [resourceSys];

      const result = await usePlayerSkill(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makeHelpersMock(), makePassiveMock(), makePetMock(),
      ).playerSkill('sk1');

      expect(result.success).toBe(false);
      expect(result.type).toBe('skill');
      expect(result.message).toContain('资源');
      expect(skillStoreMock.castSkill).not.toHaveBeenCalled();
    });

    it('castSkill 失败时透传 message', async () => {
      skillStoreMock.castSkill.mockResolvedValue({ success: false, message: '法力不足' });

      const result = await usePlayerSkill(
        makeStateMock(), makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makeHelpersMock(), makePassiveMock(), makePetMock(),
      ).playerSkill('sk1');

      expect(result.success).toBe(false);
      expect(result.message).toBe('法力不足');
    });
  });

  describe('伤害技能分支', () => {
    it('AOE 伤害技能对所有存活敌人造成伤害', async () => {
      const e1 = makeEnemy({ id: 'e1', name: '敌人1' });
      const e2 = makeEnemy({ id: 'e2', name: '敌人2' });
      const state = makeStateMock({ target: e1, alive: [e1, e2] });
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '火球术', targetType: 'all_enemies',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'magic_damage', damage: 30,
      });
      enemyStoreMock.takeDamage.mockReturnValue(false);

      const result = await usePlayerSkill(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makeHelpersMock(), makePassiveMock(), makePetMock(),
      ).playerSkill('sk1');

      expect(result.success).toBe(true);
      expect(result.aoeHits).toHaveLength(2);
      expect(enemyStoreMock.takeDamage).toHaveBeenCalledWith('e1', 20);
      expect(enemyStoreMock.takeDamage).toHaveBeenCalledWith('e2', 20);
    });

    it('AOE 技能附带 buffs 时调用注入的 applySkillBuffs', async () => {
      const e1 = makeEnemy({ id: 'e1' });
      const e2 = makeEnemy({ id: 'e2' });
      const state = makeStateMock({ target: e1, alive: [e1, e2] });
      const skillData = {
        id: 'sk1', name: '腐蚀术', targetType: 'all_enemies',
        buffs: [{ type: 'attack_down', value: 5, turns: 2 }],
      };
      skillStoreMock.getSkill.mockReturnValue(skillData);
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'magic_damage', damage: 30,
      });
      const helpers = makeHelpersMock();

      await usePlayerSkill(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), helpers, makePassiveMock(), makePetMock(),
      ).playerSkill('sk1');

      expect(helpers.applySkillBuffs).toHaveBeenCalledWith(skillData, 'all_enemies');
    });

    it('AOE 技能击杀所有敌人时调用 endCombat("victory")', async () => {
      const e1 = makeEnemy({ id: 'e1' });
      const e2 = makeEnemy({ id: 'e2' });
      const state = makeStateMock({ target: e1, alive: [e1, e2] });
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '火球术', targetType: 'all_enemies',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'magic_damage', damage: 30,
      });
      enemyStoreMock.takeDamage.mockImplementation(() => {
        state.aliveEnemies.value = [];
        return true;
      });

      const endCombat = vi.fn();
      await usePlayerSkill(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), endCombat, makeBossMock(), makeHelpersMock(), makePassiveMock(), makePetMock(),
      ).playerSkill('sk1');

      expect(endCombat).toHaveBeenCalledWith('victory');
    });

    it('AOE 暴击时每个敌人独立判定（rollCritical 被多次调用）', async () => {
      const e1 = makeEnemy({ id: 'e1' });
      const e2 = makeEnemy({ id: 'e2' });
      const state = makeStateMock({ target: e1, alive: [e1, e2] });
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '火球术', targetType: 'all_enemies',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'magic_damage', damage: 30,
      });
      // 第一个敌人暴击，第二个不暴击
      rollPlayerCritMock.mockReturnValueOnce({ isCrit: true, multiplier: 1.5 })
                         .mockReturnValueOnce({ isCrit: false, multiplier: 1 });

      const result = await usePlayerSkill(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makeHelpersMock(), makePassiveMock(), makePetMock(),
      ).playerSkill('sk1');

      expect(rollPlayerCritMock).toHaveBeenCalledTimes(2);
      // aoeHits[0] 暴击 damage=20*1.5=30，aoeHits[1] 非暴击 damage=20
      expect(result.aoeHits![0].isCrit).toBe(true);
      expect(result.aoeHits![1].isCrit).toBe(false);
    });

    it('self 伤害技能返回错误', async () => {
      const state = makeStateMock();
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '自爆', targetType: 'self',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'physical_damage', damage: 30,
      });

      const result = await usePlayerSkill(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makeHelpersMock(), makePassiveMock(), makePetMock(),
      ).playerSkill('sk1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('不能对自己');
    });

    it('single 伤害技能无目标时返回失败', async () => {
      const state = makeStateMock({ target: null, alive: [] });
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '重击', targetType: 'single',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'physical_damage', damage: 30,
      });

      const result = await usePlayerSkill(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makeHelpersMock(), makePassiveMock(), makePetMock(),
      ).playerSkill('sk1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('目标');
    });

    it('single 伤害技能对当前目标造成伤害', async () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '重击', targetType: 'single',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'physical_damage', damage: 30,
      });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      pipeResultMock.finalDamage = 25;

      await usePlayerSkill(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makeHelpersMock(), makePassiveMock(), makePetMock(),
      ).playerSkill('sk1');

      expect(enemyStoreMock.takeDamage).toHaveBeenCalledWith('e1', 25);
    });

    it('single 伤害技能击杀目标时调用 endCombat("victory")', async () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '重击', targetType: 'single',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'physical_damage', damage: 30,
      });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      enemyStoreMock.takeDamage.mockReturnValue(true);
      state.aliveEnemies.value = [];

      const endCombat = vi.fn();
      await usePlayerSkill(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), endCombat, makeBossMock(), makeHelpersMock(), makePassiveMock(), makePetMock(),
      ).playerSkill('sk1');

      expect(endCombat).toHaveBeenCalledWith('victory');
    });

    it('single 伤害技能附带 buffs 时调用注入的 applySkillBuffs', async () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      const skillData = {
        id: 'sk1', name: '毒击', targetType: 'single',
        buffs: [{ type: 'poison', value: 5, turns: 2 }],
      };
      skillStoreMock.getSkill.mockReturnValue(skillData);
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'physical_damage', damage: 30,
      });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      pipeResultMock.finalDamage = 20;
      const helpers = makeHelpersMock();

      await usePlayerSkill(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), helpers, makePassiveMock(), makePetMock(),
      ).playerSkill('sk1');

      expect(helpers.applySkillBuffs).toHaveBeenCalledWith(skillData, 'single');
    });

    it('single 伤害技能荆棘反伤使用 computeThornsDamage 计算', async () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '重击', targetType: 'single',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'physical_damage', damage: 30,
      });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      enemyStoreMock.takeDamage.mockReturnValue(false);
      pipeResultMock.finalDamage = 25;
      pipeResultMock.thorns = 5;
      // 暴击时 thorns × 1.5 = Math.floor(7.5) = 7
      rollPlayerCritMock.mockReturnValue({ isCrit: true, multiplier: 1.5 });

      await usePlayerSkill(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makeHelpersMock(), makePassiveMock(), makePetMock(),
      ).playerSkill('sk1');

      expect(characterMock.takeDamage).toHaveBeenCalledWith(7);
    });
  });

  describe('buff / debuff 分支', () => {
    it('buff 技能调用注入的 effectRegistry.onApply 并发射 COMBAT_CAST_HEAL 事件', async () => {
      const state = makeStateMock();
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '坚韧', targetType: 'self',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'buff', appliedEffects: [{ type: 'attack_up', value: 10, turns: 3 }],
      });

      await usePlayerSkill(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makeHelpersMock(), makePassiveMock(), makePetMock(),
      ).playerSkill('sk1');

      const { eventBus, GameEvents } = await import('@/modules/bus');
      expect(eventBus.emit).toHaveBeenCalledWith(GameEvents.COMBAT_CAST_HEAL, expect.objectContaining({
        healType: 'buff',
        amount: 10,
      }));
    });

    it('debuff all_enemies 技能调用注入的 applyDebuffToEnemy 多次', async () => {
      const e1 = makeEnemy({ id: 'e1' });
      const e2 = makeEnemy({ id: 'e2' });
      const state = makeStateMock({ target: e1, alive: [e1, e2] });
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '削弱', targetType: 'all_enemies',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'debuff', appliedEffects: [{ type: 'attack_down', value: 5, turns: 2 }],
      });
      const helpers = makeHelpersMock();

      await usePlayerSkill(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), helpers, makePassiveMock(), makePetMock(),
      ).playerSkill('sk1');

      expect(helpers.applyDebuffToEnemy).toHaveBeenCalledTimes(2);
      expect(helpers.applyDebuffToEnemy).toHaveBeenCalledWith(e1, expect.any(Array), '削弱');
      expect(helpers.applyDebuffToEnemy).toHaveBeenCalledWith(e2, expect.any(Array), '削弱');
    });

    it('debuff single 技能对当前目标调用 applyDebuffToEnemy', async () => {
      const enemy = makeEnemy({ id: 'e1' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '毒击', targetType: 'single',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'debuff', appliedEffects: [{ type: 'poison', value: 5, turns: 2 }],
      });
      const helpers = makeHelpersMock();

      await usePlayerSkill(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), helpers, makePassiveMock(), makePetMock(),
      ).playerSkill('sk1');

      expect(helpers.applyDebuffToEnemy).toHaveBeenCalledTimes(1);
      expect(helpers.applyDebuffToEnemy).toHaveBeenCalledWith(enemy, expect.any(Array), '毒击');
    });

    it('debuff single 无目标时返回失败且不调用 applyDebuffToEnemy', async () => {
      const state = makeStateMock({ target: null, alive: [] });
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '毒击', targetType: 'single',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'debuff', appliedEffects: [{ type: 'poison', value: 5, turns: 2 }],
      });
      const helpers = makeHelpersMock();

      const result = await usePlayerSkill(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), helpers, makePassiveMock(), makePetMock(),
      ).playerSkill('sk1');

      expect(result.success).toBe(false);
      expect(helpers.applyDebuffToEnemy).not.toHaveBeenCalled();
    });
  });

  describe('heal 分支', () => {
    it('heal 技能恢复生命值并调用 endPlayerTurn', async () => {
      const state = makeStateMock();
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '治疗术', targetType: 'self',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'health_restore', heal: 30,
      });
      const initiative = makeInitiativeMock();

      const result = await usePlayerSkill(
        state, makeLogMock(), makeMockCtx(), initiative, vi.fn(), makeBossMock(), makeHelpersMock(), makePassiveMock(), makePetMock(),
      ).playerSkill('sk1');

      expect(result.success).toBe(true);
      expect(initiative.endPlayerTurn).toHaveBeenCalled();
    });

    it('mana_restore 类型时 healType 为 mana', async () => {
      const state = makeStateMock();
      skillStoreMock.getSkill.mockReturnValue({ id: 'sk1', name: '' });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'mana_restore', heal: 20,
      } as never);

      await usePlayerSkill(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makeHelpersMock(), makePassiveMock(), makePetMock(),
      ).playerSkill('sk1');

      const { eventBus, GameEvents } = await import('@/modules/bus');
      expect(eventBus.emit).toHaveBeenCalledWith(GameEvents.COMBAT_CAST_HEAL, expect.objectContaining({
        healType: 'mana',
        amount: 20,
      }));
    });
  });

  describe('资源消耗', () => {
    it('资源充足时消耗专属资源', async () => {
      const state = makeStateMock();
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '怒击', targetType: 'self', resourceType: 'rage', resourceCost: 10,
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'health_restore', heal: 20,
      });
      const resourceSys = {
        type: 'rage', hasEnough: vi.fn(() => true), consume: vi.fn(),
      };
      state.resourceSystems.value = [resourceSys];

      await usePlayerSkill(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makeHelpersMock(), makePassiveMock(), makePetMock(),
      ).playerSkill('sk1');

      expect(resourceSys.consume).toHaveBeenCalledWith(10);
    });

    it('技能有 resourceType 但 resourceSystems 无匹配系统时不调用 consume', async () => {
      const state = makeStateMock();
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '怒击', resourceType: 'rage', resourceCost: 10,
      } as never);
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'health_restore', heal: 20,
      } as never);

      await usePlayerSkill(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makeHelpersMock(), makePassiveMock(), makePetMock(),
      ).playerSkill('sk1');

      expect(state.resourceSystems.value.length).toBe(0);
    });
  });

  // ==================== P3-156 M4-4：宠物联动技能 ====================
  describe('P3-156 M4-4：宠物联动技能', () => {
    /** 构造激活宠物实例 mock */
    function makeActivePetMock() {
      return {
        instanceId: 'pet-1',
        name: '荒野之狼',
        damage: 30,
        defense: 4,
        speed: 14,
        hp: 45,
        maxHp: 45,
      } as never;
    }

    it('requiresActivePet 技能无激活宠物时返回失败且不调用 castSkill', async () => {
      skillStoreMock.getSkill.mockReturnValue({
        id: 'hunter_kill_command', name: '狩猎指令',
        requiresActivePet: true, resourceType: 'focus', resourceCost: 25,
        type: 'physical_damage', effect: { type: 'physical_damage', value: 48 },
      } as never);

      const result = await usePlayerSkill(
        makeStateMock(), makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(),
        makeBossMock(), makeHelpersMock(), makePassiveMock(),
        makePetMock({ hasActivePet: false }),
      ).playerSkill('hunter_kill_command');

      expect(result.success).toBe(false);
      expect(result.message).toContain('宠物');
      expect(skillStoreMock.castSkill).not.toHaveBeenCalled();
    });

    it('requiresActivePet 技能有激活宠物时正常施放并触发宠物联动撕咬', async () => {
      const enemy = makeEnemy({ id: 'e1', hp: 200, maxHp: 200 });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      enemyStoreMock.takeDamage.mockReturnValue(false);
      pipeResultMock.finalDamage = 48;

      skillStoreMock.getSkill.mockReturnValue({
        id: 'hunter_kill_command', name: '狩猎指令',
        requiresActivePet: true, resourceType: 'focus', resourceCost: 25,
        type: 'physical_damage', effect: { type: 'physical_damage', value: 48 },
        targetType: 'single',
      } as never);
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'physical_damage', damage: 48, message: '使用了 狩猎指令',
      } as never);

      const petMock = makePetMock({ hasActivePet: true, activePet: makeActivePetMock() });
      const logMock = makeLogMock();

      await usePlayerSkill(
        state, logMock, makeMockCtx(), makeInitiativeMock(), vi.fn(),
        makeBossMock(), makeHelpersMock(), makePassiveMock(), petMock,
      ).playerSkill('hunter_kill_command');

      // 玩家技能伤害 + 宠物撕咬伤害 = 2 次 takeDamage
      expect(enemyStoreMock.takeDamage).toHaveBeenCalledTimes(2);
      // 验证宠物撕咬走管线时 baseDamage = pet.damage 30 × 1.5 = 45
      // processDamagePipeline 第 7 个参数（index 6）为 baseDamage
      const pipelineCalls = vi.mocked(processDamagePipeline).mock.calls;
      expect(pipelineCalls.length).toBeGreaterThanOrEqual(2);
      expect(pipelineCalls[1][6]).toBe(45);
      // 战斗日志中存在 actorType='pet' 的记录
      const petLogs = logMock.addCombatLog.mock.calls.filter(
        (c: unknown[]) => (c[0] as { actorType: string }).actorType === 'pet'
      );
      expect(petLogs.length).toBeGreaterThan(0);
    });

    it('requiresActivePet 技能目标被玩家伤害击杀时不触发宠物联动', async () => {
      const enemy = makeEnemy({ id: 'e1', hp: 10, maxHp: 10 });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      enemyStoreMock.takeDamage.mockReturnValue(true); // 玩家伤害击杀
      pipeResultMock.finalDamage = 48;

      skillStoreMock.getSkill.mockReturnValue({
        id: 'hunter_kill_command', name: '狩猎指令',
        requiresActivePet: true, resourceType: 'focus', resourceCost: 25,
        type: 'physical_damage', effect: { type: 'physical_damage', value: 48 },
        targetType: 'single',
      } as never);
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'physical_damage', damage: 48, message: '使用了 狩猎指令',
      } as never);

      const petMock = makePetMock({ hasActivePet: true, activePet: makeActivePetMock() });

      await usePlayerSkill(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(),
        makeBossMock(), makeHelpersMock(), makePassiveMock(), petMock,
      ).playerSkill('hunter_kill_command');

      // 仅玩家伤害 1 次，宠物未攻击尸体
      expect(enemyStoreMock.takeDamage).toHaveBeenCalledTimes(1);
    });

    it('summon_pet 已有激活宠物时返回失败', async () => {
      skillStoreMock.getSkill.mockReturnValue({
        id: 'hunter_summon_pet', name: '召唤宠物',
        specialAction: 'summon_pet', type: 'buff', effect: { type: 'buff', value: 0 },
      } as never);

      const result = await usePlayerSkill(
        makeStateMock(), makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(),
        makeBossMock(), makeHelpersMock(), makePassiveMock(),
        makePetMock({ hasActivePet: true }),
      ).playerSkill('hunter_summon_pet');

      expect(result.success).toBe(false);
      expect(result.message).toContain('已有');
      expect(skillStoreMock.castSkill).not.toHaveBeenCalled();
    });

    it('summon_pet 无可召唤宠物时返回失败', async () => {
      skillStoreMock.getSkill.mockReturnValue({
        id: 'hunter_summon_pet', name: '召唤宠物',
        specialAction: 'summon_pet', type: 'buff', effect: { type: 'buff', value: 0 },
      } as never);
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'buff', message: '使用了 召唤宠物',
      } as never);

      const petMock = makePetMock({ hasActivePet: false });
      petMock.petStore.getSummonable.mockReturnValue([]);

      const result = await usePlayerSkill(
        makeStateMock(), makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(),
        makeBossMock(), makeHelpersMock(), makePassiveMock(), petMock,
      ).playerSkill('hunter_summon_pet');

      expect(result.success).toBe(false);
      expect(result.message).toContain('没有可召唤');
    });

    it('summon_pet 成功召唤时重建先攻并结束回合', async () => {
      const initiative = makeInitiativeMock();
      skillStoreMock.getSkill.mockReturnValue({
        id: 'hunter_summon_pet', name: '召唤宠物',
        specialAction: 'summon_pet', type: 'buff', effect: { type: 'buff', value: 0 },
      } as never);
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'buff', message: '使用了 召唤宠物',
      } as never);

      const petMock = makePetMock({ hasActivePet: false });
      petMock.petStore.getSummonable.mockReturnValue([{ id: 'wolf', name: '荒野之狼' }]);
      petMock.summon.mockReturnValue({ success: true, message: '召唤了 荒野之狼' });

      const result = await usePlayerSkill(
        makeStateMock(), makeLogMock(), makeMockCtx(), initiative, vi.fn(),
        makeBossMock(), makeHelpersMock(), makePassiveMock(), petMock,
      ).playerSkill('hunter_summon_pet');

      expect(result.success).toBe(true);
      expect(petMock.summon).toHaveBeenCalledWith('wolf');
      expect(initiative.buildInitiativeOrder).toHaveBeenCalled();
      expect(initiative.endPlayerTurn).toHaveBeenCalled();
    });

    it('dismiss_pet 无激活宠物时返回失败', async () => {
      skillStoreMock.getSkill.mockReturnValue({
        id: 'hunter_dismiss_pet', name: '解散宠物',
        specialAction: 'dismiss_pet', type: 'buff', effect: { type: 'buff', value: 0 },
      } as never);

      const result = await usePlayerSkill(
        makeStateMock(), makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(),
        makeBossMock(), makeHelpersMock(), makePassiveMock(),
        makePetMock({ hasActivePet: false }),
      ).playerSkill('hunter_dismiss_pet');

      expect(result.success).toBe(false);
      expect(result.message).toContain('没有');
      expect(skillStoreMock.castSkill).not.toHaveBeenCalled();
    });

    it('dismiss_pet 成功解散时重建先攻并结束回合', async () => {
      const initiative = makeInitiativeMock();
      skillStoreMock.getSkill.mockReturnValue({
        id: 'hunter_dismiss_pet', name: '解散宠物',
        specialAction: 'dismiss_pet', type: 'buff', effect: { type: 'buff', value: 0 },
      } as never);
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'buff', message: '使用了解散宠物',
      } as never);

      const petMock = makePetMock({ hasActivePet: true, activePet: makeActivePetMock() });
      petMock.dismiss.mockReturnValue({ success: true, message: '已解散召唤物' });

      const result = await usePlayerSkill(
        makeStateMock(), makeLogMock(), makeMockCtx(), initiative, vi.fn(),
        makeBossMock(), makeHelpersMock(), makePassiveMock(), petMock,
      ).playerSkill('hunter_dismiss_pet');

      expect(result.success).toBe(true);
      expect(petMock.dismiss).toHaveBeenCalled();
      expect(initiative.buildInitiativeOrder).toHaveBeenCalled();
      expect(initiative.endPlayerTurn).toHaveBeenCalled();
    });
  });
});
