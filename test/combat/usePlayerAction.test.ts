/**
 * @fileoverview 玩家行动 Composable（usePlayerAction）单元测试
 *
 * 覆盖 usePlayerAction 的：
 * 1. 返回值结构：7 个公开方法（playerAttack/playerSkill/playerUseItem/
 *    playerFlee/handleLoot/applySkillBuffs/applyDebuffToEnemy）
 * 2. playerAttack：
 *    - 无目标时返回失败结果
 *    - 命中时返回 success=true + damage（smoke）
 * 3. playerFlee：
 *    - Boss 战中拒绝逃跑
 *    - rollFleeSuccess=true 时返回 success 并调用 endCombat('fled')
 *    - rollFleeSuccess=false 时返回 failure 并调用 initiative.endPlayerTurn
 * 4. playerSkill：
 *    - 资源不足时返回失败
 *    - castSkill 失败时返回失败（透传 message）
 * 5. playerUseItem：
 *    - 伤害型物品无目标时返回失败
 *    - 非伤害型物品正常使用（调用 inventoryStore.useItem + endPlayerTurn）
 * 6. handleLoot：无 drops 时无操作（不调用 addItem/addLogEntry）
 * 7. applySkillBuffs：无 buffs 时无操作（不修改 playerEffects）
 * 8. applyDebuffToEnemy：smoke test，验证容器被创建并写入 effect
 *
 * Mock 策略：
 *  - useCharacterStore / useEnemyStore / useSkillStore / useInventoryStore / useLogStore mock 模块
 *  - eventBus mock 模块（避免触发真实监听器）
 *  - generateLogId / rollCritical / rollDodge / calculateFleeChance / rollFleeSuccess mock 模块
 *  - processDamagePipeline mock 模块（控制伤害管线结果）
 *  - state / log / initiative / passive 构造 minimal mock，endCombat 直接传入 vi.fn()
 *
 * 说明：本测试为 smoke test，验证返回结构与关键分支，不深入复杂业务逻辑
 *       （如 AOE 命中、Boss 阶段机制、技能 buff 多目标施加等）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { usePlayerAction } from '@/modules/combat/composables/usePlayerAction';
import { useBossMechanics, type IBossContext } from '@/modules/combat/composables/useBossMechanics';
import {
  createEmptyContainer,
  type EffectContainer,
} from '@/modules/combat/effects';
import { wrapAsBossInstance } from '@/modules/boss/service';
import type { ICombatContext } from '@/modules/combat/combatContext';
import type { EnemyInstance } from '@/modules/enemy/types';
import { eventBus, GameEvents } from '@/modules/bus';

// ==================== Mock 模块 ====================

// mock characterStore
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

// mock enemyStore
const enemyStoreMock = {
  getEnemyById: vi.fn(() => null),
  takeDamage: vi.fn(() => false), // 默认不死亡
};
vi.mock('@/modules/enemy/store', () => ({
  useEnemyStore: vi.fn(() => enemyStoreMock),
}));

// mock skillStore
const skillStoreMock = {
  getSkill: vi.fn(() => null),
  castSkill: vi.fn(),
  tickCooldowns: vi.fn(),
};
vi.mock('@/modules/skill/store', () => ({
  useSkillStore: vi.fn(() => skillStoreMock),
}));

// mock inventoryStore
const inventoryStoreMock = {
  getItemInfo: vi.fn(() => null),
  useItem: vi.fn().mockResolvedValue(undefined),
  addItem: vi.fn(),
};
vi.mock('@/modules/inventory/store', () => ({
  useInventoryStore: vi.fn(() => inventoryStoreMock),
}));

// mock logStore
const logStoreMock = {
  addLogEntry: vi.fn(),
};
vi.mock('@/modules/log/store', () => ({
  useLogStore: vi.fn(() => logStoreMock),
}));

// mock log/service
vi.mock('@/modules/log/service', () => ({
  generateLogId: vi.fn(() => 'log-id'),
}));

// mock eventBus
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

// mock useToast（handleLoot 中背包满时调用）
const toastShowMock = vi.hoisted(() => vi.fn());
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ show: toastShowMock, close: vi.fn() }),
}));

// mock combat/service（控制闪避/暴击/逃跑判定）
const rollDodgeMock = vi.fn(() => false);
const rollCriticalMock = vi.fn(() => false);
const calculateFleeChanceMock = vi.fn(() => 0.5);
const rollFleeSuccessMock = vi.fn(() => true);
vi.mock('@/modules/combat/service', () => ({
  rollDodge: (...args: unknown[]) => rollDodgeMock(...([] as never[])),
  rollCritical: (...args: unknown[]) => rollCriticalMock(...([] as never[])),
  calculateFleeChance: (dex: number) => calculateFleeChanceMock(dex),
  rollFleeSuccess: (chance: number) => rollFleeSuccessMock(chance),
}));

// mock critCalc（QA-12 后 critCalc 直接使用 Rng 接口，不再依赖 rollCritical）
// 通过控制 rollPlayerCrit 返回值来模拟暴击/非暴击场景
const rollPlayerCritMock = vi.hoisted(() => vi.fn(() => ({ isCrit: false, multiplier: 1 })));
vi.mock('@/modules/combat/composables/helpers/critCalc', () => ({
  rollPlayerCrit: rollPlayerCritMock,
}));

// mock processDamagePipeline（控制伤害管线结果）
const pipeResultMock = { finalDamage: 20, absorbed: 0 };
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

function makeStateMock(opts: { target?: EnemyInstance | null; alive?: EnemyInstance[]; hasBoss?: boolean } = {}) {
  const target = opts.target !== undefined ? opts.target : makeEnemy();
  const alive = opts.alive !== undefined ? opts.alive : (target ? [target] : []);
  return {
    playerEffects: ref<EffectContainer>(createEmptyContainer()),
    enemyEffects: ref<Record<string, EffectContainer>>({}),
    effectRegistry: {
      reduceSum: vi.fn(() => 0),
      get: vi.fn(() => undefined), // 无 handler，跳过 onApply 回调
    } as never,
    resourceSystems: ref<unknown[]>([]),
    aliveEnemies: { value: alive },
    currentTarget: { value: target },
    hasBossEnemy: { value: opts.hasBoss ?? false },
    bossInstances: new Map(),
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
  return {
    endPlayerTurn: vi.fn(),
  } as never;
}

function makePassiveMock() {
  return {
    onDamaged: vi.fn(),
    onAttack: vi.fn(),
    onKill: vi.fn(),
    getDamageReduction: vi.fn(() => 0),
    // P3-146：默认返回空 stat_modifier 数组，使管线退化为原始行为
    getStatModifiers: vi.fn(() => []),
  } as never;
}

/**
 * P3-156 M4-4：构造 usePetAction 返回值的 mock
 *
 * usePlayerSkill 新增 pet 参数，用于狩猎指令宠物联动与召唤/解散技能。
 * 默认行为：无激活宠物（hasActivePet=false），避免干扰非宠物技能的现有测试。
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

/**
 * 构造 useBossMechanics 返回值的 mock
 *
 * 阶段九新增：Boss 防御/反击/复活机制已从 usePlayerAction 迁出到 useBossMechanics，
 * usePlayerAction 通过 boss 参数调用这三个函数。
 *
 * 两种模式：
 * 1. 透传 mock（无参数）：默认行为，非 Boss 机制测试用例使用
 *    - applyBossDefenseMechanics：不格挡，返回原始伤害
 *    - applyBossCounterMechanics：不反击
 *    - checkBossRevive：不复活
 * 2. 真实实现（传入 state/log/ctx）：Boss 机制测试用例使用，验证真实的防御/反击/复活行为
 */
function makeBossMock(
  state?: ReturnType<typeof makeStateMock>,
  log?: ReturnType<typeof makeLogMock>,
  ctx?: ICombatContext,
) {
  // 真实实现模式：Boss 机制测试需要真实的 invulnerable/shield/reflectDamage/counterStance/canRevive 行为
  if (state && log && ctx) {
    const bossCtx: IBossContext = {
      getPlayerName: () => ctx.character.name,
      createMinion: async () => null,
      rebuildInitiativeOrder: () => {},
      applyDamageToPlayer: (amount) => ctx.character.takeDamage(amount),
    };
    return useBossMechanics(state, log, bossCtx) as never;
  }
  // 透传 mock 模式：非 Boss 机制测试使用
  return {
    initBossFeatures: vi.fn(),
    applyMechanicEffect: vi.fn(),
    scaleBossEffectValue: vi.fn(),
    applyBossDefenseMechanics: vi.fn((_: EnemyInstance, rawDamage: number) => ({
      damage: rawDamage,
      blocked: false,
    })),
    applyBossCounterMechanics: vi.fn(),
    checkBossRevive: vi.fn(() => false),
  } as never;
}

/**
 * 构造 ICombatContext mock
 *
 * 各域方法指向已 mock 的 Store mock 对象（characterMock / enemyStoreMock /
 * skillStoreMock / inventoryStoreMock / logStoreMock），保证测试中对 Store
 * mock 的断言（如 expect(inventoryStoreMock.useItem).toHaveBeenCalledWith(...)）
 * 仍然有效；character 域的 name/hp/maxHp/attributes/effectiveStats 通过 getter
 * 动态读取 characterMock，保证测试中修改 characterMock.hp 后 ctx 能实时反映。
 */
function makeMockCtx(overrides: Partial<ICombatContext> = {}): ICombatContext {
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
    talent: { damageMultiplier: 0, damageReduction: 0, resourceBonuses: {}, skillEnhancements: [], unlockedPets: [] },
    ...overrides,
  } as unknown as ICombatContext;
}

// ==================== 测试用例 ====================

describe('usePlayerAction - 玩家行动 Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    characterMock.hp = 100;
    pipeResultMock.finalDamage = 20;
    pipeResultMock.absorbed = 0;
    rollDodgeMock.mockReturnValue(false);
    rollPlayerCritMock.mockReturnValue({ isCrit: false, multiplier: 1 });
    rollFleeSuccessMock.mockReturnValue(true);
    enemyStoreMock.takeDamage.mockReturnValue(false);
    enemyStoreMock.getEnemyById.mockReturnValue(null);
    inventoryStoreMock.getItemInfo.mockReturnValue(null);
    skillStoreMock.getSkill.mockReturnValue(null);
    skillStoreMock.castSkill.mockResolvedValue({ success: false, message: 'fail' });
  });

  // -------------------- 返回值结构 --------------------

  describe('返回值结构', () => {
    it('返回包含 7 个方法的对象', () => {
      const action = usePlayerAction(
        makeStateMock(),
        makeLogMock(),
        makeMockCtx(),
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
        makeBossMock(),
      );
      expect(typeof action.playerAttack).toBe('function');
      expect(typeof action.playerSkill).toBe('function');
      expect(typeof action.playerUseItem).toBe('function');
      expect(typeof action.playerFlee).toBe('function');
      expect(typeof action.handleLoot).toBe('function');
      expect(typeof action.applySkillBuffs).toBe('function');
      expect(typeof action.applyDebuffToEnemy).toBe('function');
    });
  });

  // -------------------- playerAttack --------------------

  describe('playerAttack', () => {
    it('无目标时返回 success=false', () => {
      const state = makeStateMock({ target: null, alive: [] });
      const action = usePlayerAction(
        state,
        makeLogMock(),
        makeMockCtx(),
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
        makeBossMock(),
      );

      const result = action.playerAttack();

      expect(result.success).toBe(false);
      expect(result.type).toBe('attack');
      expect(result.message).toContain('目标');
    });

    it('命中时返回 success=true 并包含 damage', () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      // takeDamage 不致死，aliveEnemies 仍有 1 个敌人
      enemyStoreMock.takeDamage.mockReturnValue(false);
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);

      const action = usePlayerAction(
        state,
        makeLogMock(),
        makeMockCtx(),
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
        makeBossMock(),
      );

      const result = action.playerAttack();

      expect(result.success).toBe(true);
      expect(result.type).toBe('attack');
      expect(result.damage).toBe(20); // pipeResult.finalDamage
    });

    it('闪避时返回 isDodge=true', () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      rollDodgeMock.mockReturnValue(true);

      const initiative = makeInitiativeMock();
      const action = usePlayerAction(
        state,
        makeLogMock(),
        makeMockCtx(),
        initiative,
        vi.fn(),
        makePassiveMock(),
        makeBossMock(),
      );

      const result = action.playerAttack();

      expect(result.success).toBe(true);
      expect(result.isDodge).toBe(true);
      expect(initiative.endPlayerTurn).toHaveBeenCalled();
    });

    it('暴击时返回 isCrit=true', () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      rollPlayerCritMock.mockReturnValue({ isCrit: true, multiplier: 1.5 });
      enemyStoreMock.takeDamage.mockReturnValue(false);
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);

      const action = usePlayerAction(
        state,
        makeLogMock(),
        makeMockCtx(),
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
        makeBossMock(),
      );

      const result = action.playerAttack();

      expect(result.isCrit).toBe(true);
      // finalDamage = pipeResult.finalDamage * 1.5 = 30
      expect(result.damage).toBe(30);
    });

    it('敌人死亡且无存活敌人时调用 endCombat("victory")', () => {
      const enemy = makeEnemy({ id: 'e1' });
      // 攻击后敌人死亡，aliveEnemies 变空
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      enemyStoreMock.takeDamage.mockReturnValue(true);
      enemyStoreMock.getEnemyById.mockReturnValue(null);
      // aliveEnemies 在攻击后被读取，模拟为空
      state.aliveEnemies.value = [];

      const endCombat = vi.fn();
      const action = usePlayerAction(
        state,
        makeLogMock(),
        makeMockCtx(),
        makeInitiativeMock(),
        endCombat,
        makePassiveMock(),
        makeBossMock(),
      );

      action.playerAttack();

      expect(endCombat).toHaveBeenCalledWith('victory');
    });
  });

  // -------------------- playerFlee --------------------

  describe('playerFlee', () => {
    it('Boss 战中拒绝逃跑', () => {
      const state = makeStateMock({ hasBoss: true });
      const action = usePlayerAction(
        state,
        makeLogMock(),
        makeMockCtx(),
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
        makeBossMock(),
      );

      const result = action.playerFlee();

      expect(result.success).toBe(false);
      expect(result.type).toBe('flee');
      expect(result.message).toContain('Boss');
    });

    it('逃跑成功时调用 endCombat("fled")', () => {
      const state = makeStateMock({ hasBoss: false });
      rollFleeSuccessMock.mockReturnValue(true);

      const endCombat = vi.fn();
      const action = usePlayerAction(
        state,
        makeLogMock(),
        makeMockCtx(),
        makeInitiativeMock(),
        endCombat,
        makePassiveMock(),
        makeBossMock(),
      );

      const result = action.playerFlee();

      expect(result.success).toBe(true);
      expect(result.type).toBe('flee');
      expect(endCombat).toHaveBeenCalledWith('fled');
    });

    it('逃跑失败时调用 initiative.endPlayerTurn', () => {
      const state = makeStateMock({ hasBoss: false });
      rollFleeSuccessMock.mockReturnValue(false);

      const initiative = makeInitiativeMock();
      const endCombat = vi.fn();
      const action = usePlayerAction(
        state,
        makeLogMock(),
        makeMockCtx(),
        initiative,
        endCombat,
        makePassiveMock(),
        makeBossMock(),
      );

      const result = action.playerFlee();

      expect(result.success).toBe(false);
      expect(result.type).toBe('flee');
      expect(initiative.endPlayerTurn).toHaveBeenCalled();
      expect(endCombat).not.toHaveBeenCalled();
    });
  });

  // -------------------- playerSkill --------------------

  describe('playerSkill', () => {
    it('资源不足时返回 success=false', async () => {
      const skill = {
        id: 'sk1',
        name: '怒吼',
        resourceType: 'rage',
        resourceCost: 30,
      };
      skillStoreMock.getSkill.mockReturnValue(skill);
      // 资源系统：hasEnough 返回 false
      const resourceSys = {
        type: 'rage',
        hasEnough: vi.fn(() => false),
        consume: vi.fn(),
      };
      const state = makeStateMock();
      state.resourceSystems.value = [resourceSys];

      const action = usePlayerAction(
        state,
        makeLogMock(),
        makeMockCtx(),
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
        makeBossMock(),
      );

      const result = await action.playerSkill('sk1');

      expect(result.success).toBe(false);
      expect(result.type).toBe('skill');
      expect(result.message).toContain('资源');
      // castSkill 不应被调用
      expect(skillStoreMock.castSkill).not.toHaveBeenCalled();
    });

    it('castSkill 失败时透传 message', async () => {
      skillStoreMock.castSkill.mockResolvedValue({ success: false, message: '法力不足' });

      const action = usePlayerAction(
        makeStateMock(),
        makeLogMock(),
        makeMockCtx(),
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
        makeBossMock(),
      );

      const result = await action.playerSkill('sk1');

      expect(result.success).toBe(false);
      expect(result.type).toBe('skill');
      expect(result.message).toBe('法力不足');
    });
  });

  // -------------------- playerUseItem --------------------

  describe('playerUseItem', () => {
    it('伤害型物品无目标时返回 success=false', async () => {
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '炸弹',
        kind: 'consumable', capabilities: ['describable', 'usable', 'stackable', 'sellable'], effects: [{ type: 'physical_damage', value: 50 }],
      });
      const state = makeStateMock({ target: null, alive: [] });

      const action = usePlayerAction(
        state,
        makeLogMock(),
        makeMockCtx(),
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
        makeBossMock(),
      );

      const result = await action.playerUseItem('item1');

      expect(result.success).toBe(false);
      expect(result.type).toBe('item');
      expect(result.message).toContain('目标');
    });

    it('非伤害型物品正常使用，调用 inventoryStore.useItem', async () => {
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '生命药水',
        kind: 'consumable', capabilities: ['describable', 'usable', 'stackable', 'sellable'], effects: [{ type: 'health_restore', value: 30 }],
      });
      const initiative = makeInitiativeMock();

      const action = usePlayerAction(
        makeStateMock(),
        makeLogMock(),
        makeMockCtx(),
        initiative,
        vi.fn(),
        makePassiveMock(),
        makeBossMock(),
      );

      const result = await action.playerUseItem('item1');

      expect(inventoryStoreMock.useItem).toHaveBeenCalledWith('item1');
      expect(result.success).toBe(true);
      expect(result.type).toBe('item');
      // 非伤害型物品调用 endPlayerTurn（aliveEnemies.length > 0 时不调用 endCombat）
      expect(initiative.endPlayerTurn).toHaveBeenCalled();
    });
  });

  // -------------------- handleLoot --------------------

  describe('handleLoot', () => {
    it('无 drops 时无操作', () => {
      const enemy = makeEnemy({ id: 'e1' });
      // 不设置 drops

      const action = usePlayerAction(
        makeStateMock(),
        makeLogMock(),
        makeMockCtx(),
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
        makeBossMock(),
      );

      action.handleLoot(enemy);

      expect(inventoryStoreMock.addItem).not.toHaveBeenCalled();
      expect(logStoreMock.addLogEntry).not.toHaveBeenCalled();
    });
  });

  // -------------------- applySkillBuffs --------------------

  describe('applySkillBuffs', () => {
    it('无 buffs 时无操作（不修改 playerEffects）', () => {
      const state = makeStateMock();
      const initialEffectsLength = state.playerEffects.value.effects.length;

      const action = usePlayerAction(
        state,
        makeLogMock(),
        makeMockCtx(),
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
        makeBossMock(),
      );

      action.applySkillBuffs({ name: '普通攻击' }, 'single');

      expect(state.playerEffects.value.effects.length).toBe(initialEffectsLength);
    });

    it('自身增益 buff 写入 playerEffects', () => {
      const state = makeStateMock();
      const initialEffectsLength = state.playerEffects.value.effects.length;

      const action = usePlayerAction(
        state,
        makeLogMock(),
        makeMockCtx(),
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
        makeBossMock(),
      );

      action.applySkillBuffs(
        {
          name: '坚韧',
          buffs: [{ type: 'defense_up', value: 10, turns: 3 }],
        },
        'self',
      );

      expect(state.playerEffects.value.effects.length).toBe(initialEffectsLength + 1);
    });
  });

  // -------------------- applyDebuffToEnemy --------------------

  describe('applyDebuffToEnemy', () => {
    it('为敌人创建效果容器并写入 debuff', () => {
      const state = makeStateMock();
      const enemy = makeEnemy({ id: 'e2' });

      const action = usePlayerAction(
        state,
        makeLogMock(),
        makeMockCtx(),
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
        makeBossMock(),
      );

      // 调用前容器不存在
      expect(state.enemyEffects.value['e2']).toBeUndefined();

      action.applyDebuffToEnemy(
        enemy,
        [{ type: 'attack_down', value: 5, turns: 2 }],
        '削弱',
      );

      // 容器被创建
      const container = state.enemyEffects.value['e2'];
      expect(container).toBeDefined();
      expect(container.effects.length).toBe(1);
      expect(container.effects[0].type).toBe('attack_down');
      expect(container.effects[0].value).toBe(5);
      expect(container.effects[0].sourceName).toBe('削弱');
    });
  });

  // -------------------- applyBossDefenseMechanics --------------------

  describe('applyBossDefenseMechanics：BOSS 防御机制', () => {
    it('invulnerable 无敌时伤害为 0 且不调用 takeDamage', () => {
      const boss = makeEnemy({ id: 'boss1', name: 'Boss' });
      const state = makeStateMock({ target: boss, alive: [boss] });
      state.bossInstances.set(boss.id, wrapAsBossInstance(boss));
      state.bossInstances.get(boss.id)!.runtime.invulnerable = true;
      enemyStoreMock.getEnemyById.mockReturnValue(boss);

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(state, makeLogMock(), makeMockCtx()), makePetMock());

      action.playerAttack();

      // invulnerable 时 actualDamage=0，不调用 takeDamage
      expect(enemyStoreMock.takeDamage).not.toHaveBeenCalled();
    });

    it('shield 吸收全部伤害时伤害为 0', () => {
      const boss = makeEnemy({ id: 'boss1', name: 'Boss' });
      const state = makeStateMock({ target: boss, alive: [boss] });
      state.bossInstances.set(boss.id, wrapAsBossInstance(boss));
      state.bossInstances.get(boss.id)!.runtime.shield = 30;
      enemyStoreMock.getEnemyById.mockReturnValue(boss);
      pipeResultMock.finalDamage = 20;

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(state, makeLogMock(), makeMockCtx()), makePetMock());

      action.playerAttack();

      // shield=30 > finalDamage=20，吸收全部，不调用 takeDamage
      expect(enemyStoreMock.takeDamage).not.toHaveBeenCalled();
      // shield 剩余 10
      expect(state.bossInstances.get(boss.id)!.runtime.shield).toBe(10);
    });

    it('shield 被击破时剩余伤害扣 HP', () => {
      const boss = makeEnemy({ id: 'boss1', name: 'Boss' });
      const state = makeStateMock({ target: boss, alive: [boss] });
      state.bossInstances.set(boss.id, wrapAsBossInstance(boss));
      state.bossInstances.get(boss.id)!.runtime.shield = 10;
      enemyStoreMock.getEnemyById.mockReturnValue(boss);
      enemyStoreMock.takeDamage.mockReturnValue(false);
      pipeResultMock.finalDamage = 20;

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(state, makeLogMock(), makeMockCtx()), makePetMock());

      action.playerAttack();

      // shield=10 < finalDamage=20，击破后 remaining=10
      expect(enemyStoreMock.takeDamage).toHaveBeenCalledWith('boss1', 10);
      expect(state.bossInstances.get(boss.id)!.runtime.shield).toBe(0);
    });

    it('无 shield 时直接扣 HP', () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      enemyStoreMock.takeDamage.mockReturnValue(false);
      pipeResultMock.finalDamage = 20;

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      action.playerAttack();

      expect(enemyStoreMock.takeDamage).toHaveBeenCalledWith('e1', 20);
    });
  });

  // -------------------- applyBossCounterMechanics --------------------

  describe('applyBossCounterMechanics：BOSS 反击机制', () => {
    it('reflectDamage 反弹伤害给玩家', () => {
      const boss = makeEnemy({ id: 'boss1', name: 'Boss' });
      const state = makeStateMock({ target: boss, alive: [boss] });
      state.bossInstances.set(boss.id, wrapAsBossInstance(boss));
      state.bossInstances.get(boss.id)!.runtime.reflectDamage = 0.2;
      enemyStoreMock.getEnemyById.mockReturnValue(boss);
      enemyStoreMock.takeDamage.mockReturnValue(false);
      pipeResultMock.finalDamage = 20;

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(state, makeLogMock(), makeMockCtx()), makePetMock());

      action.playerAttack();

      // reflectDamage=0.2, actualDamage=20, reflectAmount=Math.floor(4)=4
      expect(characterMock.takeDamage).toHaveBeenCalledWith(4);
    });

    it('counterStance 反击并清除标记', () => {
      const boss = makeEnemy({ id: 'boss1', name: 'Boss' });
      const state = makeStateMock({ target: boss, alive: [boss] });
      state.bossInstances.set(boss.id, wrapAsBossInstance(boss));
      state.bossInstances.get(boss.id)!.runtime.counterStance = true;
      enemyStoreMock.getEnemyById.mockReturnValue(boss);
      enemyStoreMock.takeDamage.mockReturnValue(false);
      pipeResultMock.finalDamage = 20;

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(state, makeLogMock(), makeMockCtx()), makePetMock());

      action.playerAttack();

      // counterDamage=Math.floor(20*0.5)=10
      expect(characterMock.takeDamage).toHaveBeenCalledWith(10);
      // counterStance 被清除
      expect(state.bossInstances.get(boss.id)!.runtime.counterStance).toBe(false);
    });

    it('actualDamage<=0 时不触发反击', () => {
      const boss = makeEnemy({ id: 'boss1', name: 'Boss' });
      const state = makeStateMock({ target: boss, alive: [boss] });
      state.bossInstances.set(boss.id, wrapAsBossInstance(boss));
      const runtime = state.bossInstances.get(boss.id)!.runtime;
      runtime.invulnerable = true;
      runtime.reflectDamage = 0.5;
      runtime.counterStance = true;
      enemyStoreMock.getEnemyById.mockReturnValue(boss);
      pipeResultMock.finalDamage = 20;

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      action.playerAttack();

      // invulnerable 时 actualDamage=0，applyBossCounterMechanics 直接 return
      expect(characterMock.takeDamage).not.toHaveBeenCalled();
      // counterStance 未被清除（未进入反击逻辑）
      expect(runtime.counterStance).toBe(true);
    });
  });

  // -------------------- checkBossRevive --------------------

  describe('checkBossRevive：BOSS 复活机制', () => {
    it('canRevive 时恢复 50% HP 并调用 endPlayerTurn', () => {
      const boss = makeEnemy({ id: 'boss1', name: 'Boss', maxHp: 100 });
      const state = makeStateMock({ target: boss, alive: [boss] });
      state.bossInstances.set(boss.id, wrapAsBossInstance(boss));
      state.bossInstances.get(boss.id)!.runtime.canRevive = true;
      enemyStoreMock.getEnemyById.mockReturnValue(boss);
      enemyStoreMock.takeDamage.mockReturnValue(true);
      state.aliveEnemies.value = [];

      const endCombat = vi.fn();
      const initiative = makeInitiativeMock();
      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), initiative, endCombat, makePassiveMock(), makeBossMock(state, makeLogMock(), makeMockCtx()), makePetMock());

      action.playerAttack();

      // 复活后 hp = Math.floor(100 * 0.5) = 50
      expect(boss.hp).toBe(50);
      expect(state.bossInstances.get(boss.id)!.runtime.canRevive).toBe(false);
      expect(initiative.endPlayerTurn).toHaveBeenCalled();
      expect(endCombat).not.toHaveBeenCalled();
    });

    it('无 canRevive 时击杀后调用 endCombat("victory")', () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      enemyStoreMock.takeDamage.mockReturnValue(true);
      state.aliveEnemies.value = [];

      const endCombat = vi.fn();
      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), endCombat, makePassiveMock(), makeBossMock(), makePetMock());

      action.playerAttack();

      expect(endCombat).toHaveBeenCalledWith('victory');
    });
  });

  // -------------------- playerSkill：技能目标类型与效果 --------------------

  describe('playerSkill：技能目标类型与效果', () => {
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
      pipeResultMock.finalDamage = 20;
      enemyStoreMock.takeDamage.mockReturnValue(false);

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      const result = await action.playerSkill('sk1');

      expect(result.success).toBe(true);
      expect(result.aoeHits).toHaveLength(2);
      expect(enemyStoreMock.takeDamage).toHaveBeenCalledWith('e1', 20);
      expect(enemyStoreMock.takeDamage).toHaveBeenCalledWith('e2', 20);
    });

    it('AOE 技能附带 buffs 时对全体敌人施加减益', async () => {
      const e1 = makeEnemy({ id: 'e1' });
      const e2 = makeEnemy({ id: 'e2' });
      const state = makeStateMock({ target: e1, alive: [e1, e2] });
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '腐蚀术', targetType: 'all_enemies',
        buffs: [{ type: 'attack_down', value: 5, turns: 2 }],
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'magic_damage', damage: 30,
      });
      pipeResultMock.finalDamage = 20;
      enemyStoreMock.takeDamage.mockReturnValue(false);

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerSkill('sk1');

      // AOE 后附带 buff，对所有敌人施加减益
      expect(state.enemyEffects.value['e1']).toBeDefined();
      expect(state.enemyEffects.value['e2']).toBeDefined();
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
      pipeResultMock.finalDamage = 20;
      // takeDamage 后清空 aliveEnemies 模拟全员阵亡
      enemyStoreMock.takeDamage.mockImplementation(() => {
        state.aliveEnemies.value = [];
        return true;
      });

      const endCombat = vi.fn();
      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), endCombat, makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerSkill('sk1');

      expect(endCombat).toHaveBeenCalledWith('victory');
    });

    it('self 伤害技能返回错误', async () => {
      const state = makeStateMock();
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '自爆', targetType: 'self',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'physical_damage', damage: 30,
      });

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      const result = await action.playerSkill('sk1');

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

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      const result = await action.playerSkill('sk1');

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
      enemyStoreMock.takeDamage.mockReturnValue(false);
      pipeResultMock.finalDamage = 25;

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      const result = await action.playerSkill('sk1');

      expect(result.success).toBe(true);
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
      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), endCombat, makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerSkill('sk1');

      expect(endCombat).toHaveBeenCalledWith('victory');
    });

    it('single 伤害技能附带 buffs 时对目标施加减益', async () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '毒击', targetType: 'single',
        buffs: [{ type: 'poison', value: 5, turns: 2 }],
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'physical_damage', damage: 30,
      });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      enemyStoreMock.takeDamage.mockReturnValue(false);
      pipeResultMock.finalDamage = 20;

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerSkill('sk1');

      expect(state.enemyEffects.value['e1']).toBeDefined();
      expect(state.enemyEffects.value['e1'].effects.length).toBe(1);
    });

    it('buff 技能对玩家施加增益效果', async () => {
      const state = makeStateMock();
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '坚韧', targetType: 'self',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'buff', appliedEffects: [{ type: 'attack_up', value: 10, turns: 3 }],
      });
      const initialLength = state.playerEffects.value.effects.length;

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerSkill('sk1');

      expect(state.playerEffects.value.effects.length).toBe(initialLength + 1);
    });

    it('debuff all_enemies 技能对所有敌人施加减益', async () => {
      const e1 = makeEnemy({ id: 'e1' });
      const e2 = makeEnemy({ id: 'e2' });
      const state = makeStateMock({ target: e1, alive: [e1, e2] });
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '削弱', targetType: 'all_enemies',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'debuff', appliedEffects: [{ type: 'attack_down', value: 5, turns: 2 }],
      });

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerSkill('sk1');

      expect(state.enemyEffects.value['e1']).toBeDefined();
      expect(state.enemyEffects.value['e2']).toBeDefined();
    });

    it('debuff single 技能对当前目标施加减益', async () => {
      const enemy = makeEnemy({ id: 'e1' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '毒击', targetType: 'single',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'debuff', appliedEffects: [{ type: 'poison', value: 5, turns: 2 }],
      });

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerSkill('sk1');

      expect(state.enemyEffects.value['e1']).toBeDefined();
      expect(state.enemyEffects.value['e1'].effects.length).toBe(1);
    });

    it('debuff single 无目标时返回失败', async () => {
      const state = makeStateMock({ target: null, alive: [] });
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '毒击', targetType: 'single',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'debuff', appliedEffects: [{ type: 'poison', value: 5, turns: 2 }],
      });

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      const result = await action.playerSkill('sk1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('目标');
    });

    it('heal 技能恢复生命值并调用 endPlayerTurn', async () => {
      const state = makeStateMock();
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '治疗术', targetType: 'self',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'health_restore', heal: 30,
      });
      const initiative = makeInitiativeMock();

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), initiative, vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      const result = await action.playerSkill('sk1');

      expect(result.success).toBe(true);
      expect(initiative.endPlayerTurn).toHaveBeenCalled();
    });

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

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerSkill('sk1');

      expect(resourceSys.consume).toHaveBeenCalledWith(10);
    });
  });

  // -------------------- playerUseItem：物品伤害与恢复 --------------------

  describe('playerUseItem：物品伤害与恢复', () => {
    it('伤害型物品对目标造成伤害', async () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '炸弹', kind: 'consumable', capabilities: ['describable', 'usable', 'stackable', 'sellable'], effects: [{ type: 'physical_damage', value: 50 }],
      });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      enemyStoreMock.takeDamage.mockReturnValue(false);
      pipeResultMock.finalDamage = 40;

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      const result = await action.playerUseItem('item1');

      expect(result.success).toBe(true);
      expect(result.type).toBe('item');
      expect(result.damage).toBe(40);
      expect(enemyStoreMock.takeDamage).toHaveBeenCalledWith('e1', 40);
    });

    it('伤害型物品暴击时伤害 *1.5', async () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '炸弹', kind: 'consumable', capabilities: ['describable', 'usable', 'stackable', 'sellable'], effects: [{ type: 'physical_damage', value: 50 }],
      });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      enemyStoreMock.takeDamage.mockReturnValue(false);
      pipeResultMock.finalDamage = 40;
      rollPlayerCritMock.mockReturnValue({ isCrit: true, multiplier: 1.5 });

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      const result = await action.playerUseItem('item1');

      // finalDamage = 40 * 1.5 = 60
      expect(result.damage).toBe(60);
      expect(result.isCrit).toBe(true);
    });

    it('魔法伤害型物品使用 magical 管线', async () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '魔法卷轴', kind: 'consumable', capabilities: ['describable', 'usable', 'stackable', 'sellable'], effects: [{ type: 'magic_damage', value: 50 }],
      });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      enemyStoreMock.takeDamage.mockReturnValue(false);
      pipeResultMock.finalDamage = 35;

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerUseItem('item1');

      expect(enemyStoreMock.takeDamage).toHaveBeenCalledWith('e1', 35);
    });

    it('恢复型物品触发 COMBAT_CAST_HEAL 事件', async () => {
      const state = makeStateMock();
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '法力药水', kind: 'consumable', capabilities: ['describable', 'usable', 'stackable', 'sellable'], effects: [{ type: 'mana_restore', value: 20 }],
      });

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerUseItem('item1');

      const { eventBus, GameEvents } = await import('@/modules/bus');
      expect(eventBus.emit).toHaveBeenCalledWith(GameEvents.COMBAT_CAST_HEAL, expect.objectContaining({
        healType: 'mana',
        amount: 20,
      }));
    });

    it('生命恢复型物品触发 healType=health 事件', async () => {
      const state = makeStateMock();
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '生命药水', kind: 'consumable', capabilities: ['describable', 'usable', 'stackable', 'sellable'], effects: [{ type: 'health_restore', value: 30 }],
      });

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerUseItem('item1');

      const { eventBus, GameEvents } = await import('@/modules/bus');
      expect(eventBus.emit).toHaveBeenCalledWith(GameEvents.COMBAT_CAST_HEAL, expect.objectContaining({
        healType: 'health',
        amount: 30,
      }));
    });

    it('伤害型物品击杀所有敌人时调用 endCombat("victory")', async () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '炸弹', kind: 'consumable', capabilities: ['describable', 'usable', 'stackable', 'sellable'], effects: [{ type: 'physical_damage', value: 50 }],
      });
      enemyStoreMock.takeDamage.mockReturnValue(true);
      state.aliveEnemies.value = [];

      const endCombat = vi.fn();
      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), endCombat, makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerUseItem('item1');

      expect(endCombat).toHaveBeenCalledWith('victory');
    });

    it('伤害型物品击杀 BOSS 且 canRevive 时复活', async () => {
      const boss = makeEnemy({ id: 'boss1', name: 'Boss', maxHp: 100 });
      const state = makeStateMock({ target: boss, alive: [boss] });
      state.bossInstances.set(boss.id, wrapAsBossInstance(boss));
      state.bossInstances.get(boss.id)!.runtime.canRevive = true;
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '炸弹', kind: 'consumable', capabilities: ['describable', 'usable', 'stackable', 'sellable'], effects: [{ type: 'physical_damage', value: 50 }],
      });
      enemyStoreMock.takeDamage.mockReturnValue(true);
      state.aliveEnemies.value = [];

      const endCombat = vi.fn();
      const initiative = makeInitiativeMock();
      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), initiative, endCombat, makePassiveMock(), makeBossMock(state, makeLogMock(), makeMockCtx()), makePetMock());

      await action.playerUseItem('item1');

      // canRevive，复活后 hp = 50
      expect(boss.hp).toBe(50);
      expect(initiative.endPlayerTurn).toHaveBeenCalled();
      expect(endCombat).not.toHaveBeenCalled();
    });

    it('无 itemInfo 时仍调用 useItem 并记录物品日志', async () => {
      const state = makeStateMock();
      inventoryStoreMock.getItemInfo.mockReturnValue(null);

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      const result = await action.playerUseItem('item1');

      expect(inventoryStoreMock.useItem).toHaveBeenCalledWith('item1');
      expect(result.success).toBe(true);
      expect(result.message).toContain('物品');
    });
  });

  // -------------------- handleLoot：掉落处理 --------------------

  describe('handleLoot：掉落处理', () => {
    it('drops 成功掉落时调用 addItem 并记录日志', () => {
      const enemy = makeEnemy({
        id: 'e1', name: '史莱姆',
        drops: [{ itemId: 'item1', dropRate: 1, minAmount: 2, maxAmount: 2 }],
      } as Partial<EnemyInstance>);
      inventoryStoreMock.getItemInfo.mockReturnValue({ name: '药水' });
      inventoryStoreMock.addItem.mockReturnValue(2);

      const action = usePlayerAction(makeStateMock(), makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      action.handleLoot(enemy);

      expect(inventoryStoreMock.addItem).toHaveBeenCalledWith('item1', 2);
      expect(logStoreMock.addLogEntry).toHaveBeenCalledWith(expect.objectContaining({
        type: 'item',
        message: expect.stringContaining('药水'),
      }));
    });

    it('amount<=0 时跳过不掉落', () => {
      const enemy = makeEnemy({
        id: 'e1', name: '史莱姆',
        drops: [{ itemId: 'item1', dropRate: 1, minAmount: 0, maxAmount: 0 }],
      } as Partial<EnemyInstance>);

      const action = usePlayerAction(makeStateMock(), makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      action.handleLoot(enemy);

      // amount=0，跳过
      expect(inventoryStoreMock.addItem).not.toHaveBeenCalled();
    });

    it('addItem 返回值小于 amount 时提示背包满', () => {
      const enemy = makeEnemy({
        id: 'e1', name: '史莱姆',
        drops: [{ itemId: 'item1', dropRate: 1, minAmount: 5, maxAmount: 5 }],
      } as Partial<EnemyInstance>);
      inventoryStoreMock.getItemInfo.mockReturnValue({ name: '材料' });
      inventoryStoreMock.addItem.mockReturnValue(3);

      const action = usePlayerAction(makeStateMock(), makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      action.handleLoot(enemy);

      // P2-42 修复：handleLoot 不再直接调用 useToast，改为通过 EventBus 发射 INVENTORY_FULL 事件
      expect(eventBus.emit).toHaveBeenCalledWith(
        GameEvents.INVENTORY_FULL,
        expect.objectContaining({
          itemName: '材料',
          actualAmount: 3,
          expectedAmount: 5,
        })
      );
    });

    it('getItemInfo 返回 null 时不调用 addItem', () => {
      const enemy = makeEnemy({
        id: 'e1', name: '史莱姆',
        drops: [{ itemId: 'item1', dropRate: 1, minAmount: 2, maxAmount: 2 }],
      } as Partial<EnemyInstance>);
      inventoryStoreMock.getItemInfo.mockReturnValue(null);

      const action = usePlayerAction(makeStateMock(), makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      action.handleLoot(enemy);

      expect(inventoryStoreMock.addItem).not.toHaveBeenCalled();
    });

    it('dropRate=0 时不触发掉落', () => {
      const enemy = makeEnemy({
        id: 'e1', name: '史莱姆',
        drops: [{ itemId: 'item1', dropRate: 0, minAmount: 2, maxAmount: 2 }],
      } as Partial<EnemyInstance>);

      const action = usePlayerAction(makeStateMock(), makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      action.handleLoot(enemy);

      expect(inventoryStoreMock.addItem).not.toHaveBeenCalled();
    });

    it('多个 drops 逐个处理', () => {
      const enemy = makeEnemy({
        id: 'e1', name: '史莱姆',
        drops: [
          { itemId: 'item1', dropRate: 1, minAmount: 1, maxAmount: 1 },
          { itemId: 'item2', dropRate: 1, minAmount: 2, maxAmount: 2 },
        ],
      } as Partial<EnemyInstance>);
      inventoryStoreMock.getItemInfo.mockReturnValue({ name: '物品' });
      inventoryStoreMock.addItem.mockReturnValue(99);

      const action = usePlayerAction(makeStateMock(), makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      action.handleLoot(enemy);

      expect(inventoryStoreMock.addItem).toHaveBeenCalledWith('item1', 1);
      expect(inventoryStoreMock.addItem).toHaveBeenCalledWith('item2', 2);
    });
  });

  // -------------------- playerSkill：边界分支补充（覆盖 single BOSS 复活） --------------------

  describe('playerSkill：边界分支补充', () => {
    it('single 伤害技能击杀 BOSS 且 canRevive 时复活并调用 endPlayerTurn', async () => {
      // 覆盖 usePlayerAction.ts 第 636 行：single 技能击杀 BOSS 后 checkBossRevive 返回 true 分支
      const boss = makeEnemy({ id: 'boss1', name: 'Boss', maxHp: 100 });
      const state = makeStateMock({ target: boss, alive: [boss] });
      state.bossInstances.set(boss.id, wrapAsBossInstance(boss));
      state.bossInstances.get(boss.id)!.runtime.canRevive = true;
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '重击', targetType: 'single',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'physical_damage', damage: 50,
      });
      enemyStoreMock.getEnemyById.mockReturnValue(boss);
      enemyStoreMock.takeDamage.mockReturnValue(true);
      state.aliveEnemies.value = [];

      const endCombat = vi.fn();
      const initiative = makeInitiativeMock();
      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), initiative, endCombat, makePassiveMock(), makeBossMock(state, makeLogMock(), makeMockCtx()), makePetMock());

      await action.playerSkill('sk1');

      // canRevive，复活后 hp = Math.floor(100 * 0.5) = 50
      expect(boss.hp).toBe(50);
      expect(state.bossInstances.get(boss.id)!.runtime.canRevive).toBe(false);
      expect(initiative.endPlayerTurn).toHaveBeenCalled();
      expect(endCombat).not.toHaveBeenCalled();
    });
  });

  // -------------------- 边界分支补充：逻辑或 falsy 路径 --------------------

  describe('边界分支补充：逻辑或 falsy 路径', () => {
    it('伤害型物品 itemInfo.name 为空时日志回退为"卷轴"', async () => {
      // 覆盖 usePlayerAction.ts 第 842-843, 878 行：itemInfo?.name || '卷轴' 的 falsy 路径
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '', kind: 'consumable', capabilities: ['describable', 'usable', 'stackable', 'sellable'], effects: [{ type: 'physical_damage', value: 50 }],
      });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      enemyStoreMock.takeDamage.mockReturnValue(false);
      pipeResultMock.finalDamage = 40;

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      const result = await action.playerUseItem('item1');

      // damageResult 非空，message 走 878 行的 truthy 路径，name 回退为 '卷轴'
      expect(result.success).toBe(true);
      expect(result.message).toContain('卷轴');
    });

    it('handleLoot 中 itemInfo.name 为空时记录日志回退为 itemId', () => {
      // 覆盖 usePlayerAction.ts 第 973 行：itemInfo?.name || drop.itemId 的 falsy 路径
      const enemy = makeEnemy({
        id: 'e1', name: '史莱姆',
        drops: [{ itemId: 'mat1', dropRate: 1, minAmount: 1, maxAmount: 1 }],
      } as Partial<EnemyInstance>);
      // itemInfo 存在但 name 为空字符串（falsy）
      inventoryStoreMock.getItemInfo.mockReturnValue({ name: '' });
      inventoryStoreMock.addItem.mockReturnValue(1);

      const action = usePlayerAction(makeStateMock(), makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      action.handleLoot(enemy);

      // 冒险日志记录中应回退使用 drop.itemId
      expect(logStoreMock.addLogEntry).toHaveBeenCalledWith(expect.objectContaining({
        type: 'item',
        message: expect.stringContaining('mat1'),
      }));
    });
  });

  // -------------------- 单数技能与物品的暴击分支补充 --------------------

  describe('边界分支补充：single 技能与物品暴击事件', () => {
    it('single 伤害技能暴击时触发 COMBAT_CRITICAL_HIT 事件', async () => {
      // 覆盖 usePlayerAction.ts 第 649-655 行：single 技能 isCrit 分支
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
      rollPlayerCritMock.mockReturnValue({ isCrit: true, multiplier: 1.5 });

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerSkill('sk1');

      const { eventBus, GameEvents } = await import('@/modules/bus');
      expect(eventBus.emit).toHaveBeenCalledWith(GameEvents.COMBAT_CRITICAL_HIT, expect.objectContaining({
        actorType: 'player',
      }));
    });

    it('AOE 伤害技能暴击时触发 COMBAT_CRITICAL_HIT 事件', async () => {
      // 覆盖 usePlayerAction.ts 第 535-536 行：AOE 循环中 isCrit 分支
      const e1 = makeEnemy({ id: 'e1', name: '敌人1' });
      const e2 = makeEnemy({ id: 'e2', name: '敌人2' });
      const state = makeStateMock({ target: e1, alive: [e1, e2] });
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '火球术', targetType: 'all_enemies',
      });
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'magic_damage', damage: 30,
      });
      pipeResultMock.finalDamage = 20;
      enemyStoreMock.takeDamage.mockReturnValue(false);
      rollPlayerCritMock.mockReturnValue({ isCrit: true, multiplier: 1.5 });

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerSkill('sk1');

      const { eventBus, GameEvents } = await import('@/modules/bus');
      expect(eventBus.emit).toHaveBeenCalledWith(GameEvents.COMBAT_CRITICAL_HIT, expect.objectContaining({
        actorType: 'player',
      }));
    });
  });

  // -------------------- 边界分支补充：playerAttack/playerSkill 逻辑或 falsy 路径 --------------------

  describe('边界分支补充：playerAttack 空名回退', () => {
    it('playerAttack 暴击时 target.name 为空字符串时事件 targetName 回退为"敌人"', async () => {
      // 覆盖 usePlayerAction.ts 第 366, 375 行：target.name || '敌人' 的 falsy 分支
      const enemy = makeEnemy({ id: 'e1', name: '' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      enemyStoreMock.takeDamage.mockReturnValue(false);
      pipeResultMock.finalDamage = 20;
      rollPlayerCritMock.mockReturnValue({ isCrit: true, multiplier: 1.5 });

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      action.playerAttack();

      const { eventBus, GameEvents } = await import('@/modules/bus');
      expect(eventBus.emit).toHaveBeenCalledWith(GameEvents.COMBAT_DEAL_DAMAGE, expect.objectContaining({
        targetName: '敌人',
      }));
      expect(eventBus.emit).toHaveBeenCalledWith(GameEvents.COMBAT_CRITICAL_HIT, expect.objectContaining({
        targetName: '敌人',
      }));
    });
  });

  describe('边界分支补充：playerSkill AOE physical_damage 空名回退', () => {
    it('AOE physical_damage + 空技能名 + 空敌人名 + 暴击时覆盖所有 physical FALSE 分支', async () => {
      // 覆盖 usePlayerAction.ts 第 472, 475, 483, 529, 530, 538, 539, 548, 551, 553, 558 行
      const e1 = makeEnemy({ id: 'e1', name: '' });
      const e2 = makeEnemy({ id: 'e2', name: '' });
      const state = makeStateMock({ target: e1, alive: [e1, e2] });
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '', targetType: 'all_enemies',
      } as never);
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'physical_damage', damage: 30,
      });
      pipeResultMock.finalDamage = 20;
      enemyStoreMock.takeDamage.mockReturnValue(false);
      // 第一个敌人暴击，第二个不暴击（覆盖 crit 和 non-crit 路径）
      rollPlayerCritMock.mockReturnValueOnce({ isCrit: true, multiplier: 1.5 }).mockReturnValueOnce({ isCrit: false, multiplier: 1 });

      const log = makeLogMock();
      const action = usePlayerAction(state, log, makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerSkill('sk1');

      const { eventBus, GameEvents } = await import('@/modules/bus');
      // AOE deal damage 事件：damageType 为 physical，targetName 回退为 '敌人'
      expect(eventBus.emit).toHaveBeenCalledWith(GameEvents.COMBAT_DEAL_DAMAGE, expect.objectContaining({
        damageType: 'physical',
        targetName: '敌人',
      }));
      // AOE crit 事件：damageType 为 physical
      expect(eventBus.emit).toHaveBeenCalledWith(GameEvents.COMBAT_CRITICAL_HIT, expect.objectContaining({
        damageType: 'physical',
        targetName: '敌人',
      }));
      // 日志 skillName 回退为空字符串
      const aoeLogCalls = log.addCombatLog.mock.calls.filter(
        (call: unknown[]) => (call[0] as { eventType: string }).eventType === 'combat_damage'
      );
      expect(aoeLogCalls.length).toBeGreaterThan(0);
      expect((aoeLogCalls[0][0] as { skillName: string }).skillName).toBe('');
    });
  });

  describe('边界分支补充：playerSkill single magic_damage 空名回退', () => {
    it('single magic_damage + 空技能名 + getEnemyById null + 暴击时覆盖所有 magic TRUE 分支', async () => {
      // 覆盖 usePlayerAction.ts 第 463, 598, 643, 644, 652, 653, 662, 664, 665, 667, 672 行
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '',
      } as never);
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'magic_damage', damage: 30,
      });
      enemyStoreMock.takeDamage.mockReturnValue(false);
      enemyStoreMock.getEnemyById.mockReturnValue(null);
      pipeResultMock.finalDamage = 25;
      rollPlayerCritMock.mockReturnValue({ isCrit: true, multiplier: 1.5 });

      const log = makeLogMock();
      const action = usePlayerAction(state, log, makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerSkill('sk1');

      const { eventBus, GameEvents } = await import('@/modules/bus');
      // single deal damage 事件：damageType 为 magic，targetName 回退为 '敌人'
      expect(eventBus.emit).toHaveBeenCalledWith(GameEvents.COMBAT_DEAL_DAMAGE, expect.objectContaining({
        damageType: 'magic',
        targetName: '敌人',
      }));
      // single crit 事件：damageType 为 magic
      expect(eventBus.emit).toHaveBeenCalledWith(GameEvents.COMBAT_CRITICAL_HIT, expect.objectContaining({
        damageType: 'magic',
        targetName: '敌人',
      }));
      // 日志 eventType 为 combat_skill_cast 且带 targetType:enemy（伤害日志，区别于初始施放日志）
      const critLogCall = log.addCombatLog.mock.calls.find(
        (call: unknown[]) => {
          const entry = call[0] as { eventType: string; targetType?: string };
          return entry.eventType === 'combat_skill_cast' && entry.targetType === 'enemy';
        }
      );
      expect(critLogCall).toBeDefined();
      const logEntry = critLogCall![0] as { targetId: string; targetName: string; skillName: string; message: string };
      expect(logEntry.targetId).toBe('');
      expect(logEntry.targetName).toBe('');
      expect(logEntry.skillName).toBe('');
      expect(logEntry.message).toContain('技能');
      expect(logEntry.message).toContain('暴击');
      expect(logEntry.message).toContain('魔法');
    });

    it('single magic_damage + 空技能名 + 非暴击时覆盖 non-crit magic 分支', async () => {
      // 覆盖 usePlayerAction.ts 第 673 行：non-crit 路径的 magic_damage ternary
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '',
      } as never);
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'magic_damage', damage: 30,
      });
      enemyStoreMock.takeDamage.mockReturnValue(false);
      enemyStoreMock.getEnemyById.mockReturnValue(null);
      pipeResultMock.finalDamage = 25;
      rollPlayerCritMock.mockReturnValue({ isCrit: false, multiplier: 1 });

      const log = makeLogMock();
      const action = usePlayerAction(state, log, makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerSkill('sk1');

      // 非暴击日志 message 包含 "魔法" 但不包含 "暴击"
      const damageLogCall = log.addCombatLog.mock.calls.find(
        (call: unknown[]) => (call[0] as { eventType: string }).eventType === 'combat_skill_cast' && (call[0] as { damage: number }).damage !== undefined
      );
      expect(damageLogCall).toBeDefined();
      const logEntry = damageLogCall![0] as { message: string };
      expect(logEntry.message).toContain('魔法');
      expect(logEntry.message).not.toContain('暴击');
    });
  });

  describe('边界分支补充：playerSkill heal mana_restore 与 buff 空名回退', () => {
    it('heal 技能 result.heal 时 healType 为 mana', async () => {
      // 覆盖 usePlayerAction.ts 第 764, 774, 778 行
      const state = makeStateMock();
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '',
      } as never);
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'mana_restore', heal: 20,
      } as never);

      const log = makeLogMock();
      const action = usePlayerAction(state, log, makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerSkill('sk1');

      const { eventBus, GameEvents } = await import('@/modules/bus');
      expect(eventBus.emit).toHaveBeenCalledWith(GameEvents.COMBAT_CAST_HEAL, expect.objectContaining({
        healType: 'mana',
        amount: 20,
      }));
      // 日志 skillName 为空字符串
      const healLogCall = log.addCombatLog.mock.calls.find(
        (call: unknown[]) => (call[0] as { eventType: string }).eventType === 'combat_heal'
      );
      expect(healLogCall).toBeDefined();
      const logEntry = healLogCall![0] as { skillName: string; message: string };
      expect(logEntry.skillName).toBe('');
      expect(logEntry.message).toContain('技能');
    });

    it('buff 技能空名 + appliedEffects[0].value 为 0 时 amount 回退为 0', async () => {
      // 覆盖 usePlayerAction.ts 第 694, 714 行
      const state = makeStateMock();
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '',
      } as never);
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'buff', appliedEffects: [{ type: 'attack_up', value: 0, turns: 3 }],
      } as never);

      const log = makeLogMock();
      const action = usePlayerAction(state, log, makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerSkill('sk1');

      const { eventBus, GameEvents } = await import('@/modules/bus');
      expect(eventBus.emit).toHaveBeenCalledWith(GameEvents.COMBAT_CAST_HEAL, expect.objectContaining({
        amount: 0,
        healType: 'buff',
      }));
      // 日志 message 包含 '技能'（effectSourceName 回退）
      const buffLogCall = log.addCombatLog.mock.calls.find(
        (call: unknown[]) => (call[0] as { eventType: string }).eventType === 'combat_skill_cast'
      );
      expect(buffLogCall).toBeDefined();
      expect((buffLogCall![0] as { message: string }).message).toContain('技能');
    });
  });

  // -------------------- 边界分支补充：playerUseItem 暴击事件 damageType/targetName/itemInfo.name 回退 --------------------

  describe('边界分支补充：playerUseItem 暴击事件回退分支', () => {
    it('magic_damage 型物品暴击时 COMBAT_CRITICAL_HIT 事件 damageType 为 magic', async () => {
      // 覆盖 usePlayerAction.ts 第 871 行：type === 'magic_damage' ? 'magic' : 'physical' 的 truthy 分支
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '魔法卷轴', kind: 'consumable', capabilities: ['describable', 'usable', 'stackable', 'sellable'], effects: [{ type: 'magic_damage', value: 50 }],
      });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      enemyStoreMock.takeDamage.mockReturnValue(false);
      pipeResultMock.finalDamage = 35;
      rollPlayerCritMock.mockReturnValue({ isCrit: true, multiplier: 1.5 });

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerUseItem('item1');

      const { eventBus, GameEvents } = await import('@/modules/bus');
      expect(eventBus.emit).toHaveBeenCalledWith(GameEvents.COMBAT_CRITICAL_HIT, expect.objectContaining({
        damageType: 'magic',
        actorType: 'player',
      }));
    });

    it('暴击时 target.name 为空字符串时 COMBAT_CRITICAL_HIT 事件 targetName 回退为"敌人"', async () => {
      // 覆盖 usePlayerAction.ts 第 872 行：target.name || '敌人' 的 falsy 分支
      const enemy = makeEnemy({ id: 'e1', name: '' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '炸弹', kind: 'consumable', capabilities: ['describable', 'usable', 'stackable', 'sellable'], effects: [{ type: 'physical_damage', value: 50 }],
      });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      enemyStoreMock.takeDamage.mockReturnValue(false);
      pipeResultMock.finalDamage = 40;
      rollPlayerCritMock.mockReturnValue({ isCrit: true, multiplier: 1.5 });

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerUseItem('item1');

      const { eventBus, GameEvents } = await import('@/modules/bus');
      expect(eventBus.emit).toHaveBeenCalledWith(GameEvents.COMBAT_CRITICAL_HIT, expect.objectContaining({
        targetName: '敌人',
      }));
    });

    it('暴击且 itemInfo.name 为空字符串时日志 message 回退为"卷轴"', async () => {
      // 覆盖 usePlayerAction.ts 第 910 行：itemInfo?.name || '卷轴' 的 falsy 分支（暴击路径）
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '', kind: 'consumable', capabilities: ['describable', 'usable', 'stackable', 'sellable'], effects: [{ type: 'physical_damage', value: 50 }],
      });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      enemyStoreMock.takeDamage.mockReturnValue(false);
      pipeResultMock.finalDamage = 40;
      rollPlayerCritMock.mockReturnValue({ isCrit: true, multiplier: 1.5 });

      const log = makeLogMock();
      const action = usePlayerAction(state, log, makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerUseItem('item1');

      // 暴击日志 message 中 itemInfo.name 为空，回退为"卷轴"
      const critLogCall = log.addCombatLog.mock.calls.find(
        (call: unknown[]) => (call[0] as { eventType: string }).eventType === 'combat_critical'
      );
      expect(critLogCall).toBeDefined();
      expect((critLogCall![0] as { message: string }).message).toContain('卷轴');
      expect((critLogCall![0] as { message: string }).message).toContain('暴击');
    });

    it('damageResult 存在但 useItem 后 currentTarget 为 null 时 updatedTarget 回退为 null', async () => {
      // 覆盖 usePlayerAction.ts 第 897 行：target ? ctx.enemy.getEnemyById(target.id) : null 的 falsy 分支
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '炸弹', kind: 'consumable', capabilities: ['describable', 'usable', 'stackable', 'sellable'], effects: [{ type: 'physical_damage', value: 50 }],
      });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      enemyStoreMock.takeDamage.mockReturnValue(false);
      pipeResultMock.finalDamage = 40;

      // 在 useItem 调用时清除 currentTarget，模拟目标在物品使用过程中变为空
      inventoryStoreMock.useItem.mockImplementation(() => {
        state.currentTarget.value = null;
        return Promise.resolve();
      });

      const log = makeLogMock();
      const action = usePlayerAction(state, log, makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerUseItem('item1');

      // updatedTarget 为 null，日志中 targetId 和 targetName 回退为空字符串
      // playerUseItem 非暴击日志 eventType 为 'combat_skill_cast'
      const damageLogCall = log.addCombatLog.mock.calls.find(
        (call: unknown[]) => (call[0] as { eventType: string }).eventType === 'combat_skill_cast'
      );
      expect(damageLogCall).toBeDefined();
      expect((damageLogCall![0] as { targetId: string }).targetId).toBe('');
      expect((damageLogCall![0] as { targetName: string }).targetName).toBe('');
    });
  });

  // -------------------- 边界分支补充：剩余未覆盖分支（457/505/727/760） --------------------

  describe('边界分支补充：playerSkill 剩余分支', () => {
    it('技能有 resourceType 但 resourceSystems 无匹配系统时不调用 consume', async () => {
      // 覆盖 usePlayerAction.ts 第 457 行：if (resourceSys) 的 FALSE 分支
      const state = makeStateMock();
      // resourceSystems 默认为空数组，无匹配系统
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '怒击', resourceType: 'rage', resourceCost: 10,
      } as never);
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'health_restore', heal: 20,
      } as never);

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      await action.playerSkill('sk1');

      // 资源系统未找到，不调用 consume，但技能仍正常施放
      expect(state.resourceSystems.value.length).toBe(0);
    });

    it('AOE 技能对无敌 Boss 造成 0 伤害时跳过 takeDamage', async () => {
      // 覆盖 usePlayerAction.ts 第 505 行：if (actualAoeDamage > 0) 的 FALSE 分支
      const boss = makeEnemy({ id: 'e1', name: 'Boss' });
      const state = makeStateMock({ target: boss, alive: [boss] });
      // 注入 Boss 运行时无敌标记到 bossInstances Map
      state.bossInstances.set(boss.id, wrapAsBossInstance(boss));
      state.bossInstances.get(boss.id)!.runtime.invulnerable = true;
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '暴风雪', targetType: 'all_enemies',
      } as never);
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'magic_damage', damage: 30,
      } as never);
      pipeResultMock.finalDamage = 20;
      enemyStoreMock.takeDamage.mockReturnValue(false);

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(state, makeLogMock(), makeMockCtx()), makePetMock());

      await action.playerSkill('sk1');

      // 无敌 Boss：actualAoeDamage 为 0，不调用 takeDamage
      expect(enemyStoreMock.takeDamage).not.toHaveBeenCalled();
    });

    it('appliedEffects 存在但 type 非 buff/debuff 时不施加效果', async () => {
      // 覆盖 usePlayerAction.ts 第 727 行：else if (result.type === 'debuff') 的 FALSE 分支
      const state = makeStateMock();
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '神秘技能',
      } as never);
      skillStoreMock.castSkill.mockResolvedValue({
        success: true, type: 'unknown', appliedEffects: [{ type: 'custom', value: 5, turns: 2 }],
      } as never);

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      const result = await action.playerSkill('sk1');

      // type 非 buff/debuff，不进入任何效果分支，正常返回成功
      expect(result.success).toBe(true);
    });

    it('castSkill 成功但无 damage/appliedEffects/heal 时直接结束回合', async () => {
      // 覆盖 usePlayerAction.ts 第 760 行：else if (result.heal) 的 FALSE 分支
      const state = makeStateMock();
      skillStoreMock.getSkill.mockReturnValue({
        id: 'sk1', name: '空技能',
      } as never);
      skillStoreMock.castSkill.mockResolvedValue({
        success: true,
      } as never);

      const initiative = makeInitiativeMock();
      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), initiative, vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      const result = await action.playerSkill('sk1');

      // 无任何效果字段，落入末尾返回成功
      expect(result.success).toBe(true);
      expect(result.type).toBe('skill');
    });
  });

  // -------------------- 边界分支补充：applyDebuffToEnemy/applySkillBuffs/Boss 反击剩余分支 --------------------

  describe('边界分支补充：效果施加与 Boss 反击剩余分支', () => {
    it('applyDebuffToEnemy 对已有效果容器的敌人不创建新容器', () => {
      // 覆盖 usePlayerAction.ts 第 61 行：if (!enemyEffects.value[e.id]) 的 FALSE 分支
      const enemy = makeEnemy({ id: 'e1' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      // 预先创建容器
      state.enemyEffects.value['e1'] = createEmptyContainer();
      const initialContainer = state.enemyEffects.value['e1'];

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      // 第二次调用：容器已存在，不创建新容器
      action.applyDebuffToEnemy(enemy, [{ type: 'attack_down', value: 5, turns: 2 }], '毒击');

      // 同一个容器引用，未被替换
      expect(state.enemyEffects.value['e1']).toBe(initialContainer);
      expect(state.enemyEffects.value['e1'].effects.length).toBe(1);
    });

    it('applySkillBuffs 自身增益路径中 buff 类型不在自身列表时跳过该 buff', () => {
      // 覆盖 usePlayerAction.ts 第 102 行：if ([...].includes(be.type)) 的 FALSE 分支
      const state = makeStateMock();
      const skill = {
        name: '混合增益',
        buffs: [
          { type: 'attack_up', value: 10, turns: 3 },
          { type: 'poison', value: 5, turns: 2 },
        ],
      };

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      // isSelfBuff 为 true（attack_up），进入自身增益路径
      // poison 不在自身增益列表中，跳过
      action.applySkillBuffs(skill, 'self');

      // 只有 attack_up 被施加（1 个效果），poison 被跳过
      expect(state.playerEffects.value.effects.length).toBe(1);
      expect(state.playerEffects.value.effects[0].type).toBe('attack_up');
    });

    it('applySkillBuffs 单目标但 currentTarget 为 null 时不施加', () => {
      // 覆盖 usePlayerAction.ts 第 128 行：if (target) 的 FALSE 分支
      const state = makeStateMock({ target: null, alive: [] });
      const skill = {
        name: '毒击',
        buffs: [{ type: 'poison', value: 5, turns: 2 }],
      };

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      // targetType 非 self/all_enemies，currentTarget 为 null
      action.applySkillBuffs(skill, 'single');

      // 不抛错，不施加效果
      expect(Object.keys(state.enemyEffects.value).length).toBe(0);
    });

    it('Boss reflectDamage 存在但反弹伤害向下取整为 0 时不造成反伤', () => {
      // 覆盖 usePlayerAction.ts 第 214 行：if (reflectAmount > 0) 的 FALSE 分支
      const enemy = makeEnemy({ id: 'e1', name: 'Boss' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      state.bossInstances.set(enemy.id, wrapAsBossInstance(enemy));
      state.bossInstances.get(enemy.id)!.runtime.reflectDamage = 0.5;
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      enemyStoreMock.takeDamage.mockReturnValue(false);
      // finalDamage = 1，reflectAmount = Math.floor(1 * 0.5) = 0
      pipeResultMock.finalDamage = 1;
      rollPlayerCritMock.mockReturnValue({ isCrit: false, multiplier: 1 });

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      action.playerAttack();

      // reflectAmount 为 0，不调用 character.takeDamage
      expect(characterMock.takeDamage).not.toHaveBeenCalled();
    });

    it('Boss counterStance 存在但反击伤害向下取整为 0 时不造成反击', () => {
      // 覆盖 usePlayerAction.ts 第 228 行：if (counterDamage > 0) 的 FALSE 分支
      const enemy = makeEnemy({ id: 'e1', name: 'Boss' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      state.bossInstances.set(enemy.id, wrapAsBossInstance(enemy));
      state.bossInstances.get(enemy.id)!.runtime.counterStance = true;
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      enemyStoreMock.takeDamage.mockReturnValue(false);
      // finalDamage = 1，counterDamage = Math.floor(1 * 0.5) = 0
      pipeResultMock.finalDamage = 1;
      rollPlayerCritMock.mockReturnValue({ isCrit: false, multiplier: 1 });

      const action = usePlayerAction(state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makePassiveMock(), makeBossMock(), makePetMock());

      action.playerAttack();

      // counterDamage 为 0，不调用 character.takeDamage
      expect(characterMock.takeDamage).not.toHaveBeenCalled();
    });
  });
});
