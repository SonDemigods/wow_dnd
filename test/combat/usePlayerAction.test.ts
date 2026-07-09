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
import {
  createEmptyContainer,
  type EffectContainer,
} from '@/modules/combat/effects';
import type { EnemyInstance } from '@/modules/enemy/types';

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
  },
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
  } as never;
}

// ==================== 测试用例 ====================

describe('usePlayerAction - 玩家行动 Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    characterMock.hp = 100;
    pipeResultMock.finalDamage = 20;
    pipeResultMock.absorbed = 0;
    pipeResultMock.thorns = 0;
    rollDodgeMock.mockReturnValue(false);
    rollCriticalMock.mockReturnValue(false);
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
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
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
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
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
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
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
        initiative,
        vi.fn(),
        makePassiveMock(),
      );

      const result = action.playerAttack();

      expect(result.success).toBe(true);
      expect(result.isDodge).toBe(true);
      expect(initiative.endPlayerTurn).toHaveBeenCalled();
    });

    it('暴击时返回 isCrit=true', () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      rollCriticalMock.mockReturnValue(true);
      enemyStoreMock.takeDamage.mockReturnValue(false);
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);

      const action = usePlayerAction(
        state,
        makeLogMock(),
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
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
        makeInitiativeMock(),
        endCombat,
        makePassiveMock(),
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
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
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
        makeInitiativeMock(),
        endCombat,
        makePassiveMock(),
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
        initiative,
        endCombat,
        makePassiveMock(),
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
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
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
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
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
        effect: { type: 'physical_damage', value: 50 },
      });
      const state = makeStateMock({ target: null, alive: [] });

      const action = usePlayerAction(
        state,
        makeLogMock(),
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
      );

      const result = await action.playerUseItem('item1');

      expect(result.success).toBe(false);
      expect(result.type).toBe('item');
      expect(result.message).toContain('目标');
    });

    it('非伤害型物品正常使用，调用 inventoryStore.useItem', async () => {
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '生命药水',
        effect: { type: 'health_restore', value: 30 },
      });
      const initiative = makeInitiativeMock();

      const action = usePlayerAction(
        makeStateMock(),
        makeLogMock(),
        initiative,
        vi.fn(),
        makePassiveMock(),
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
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
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
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
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
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
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
        makeInitiativeMock(),
        vi.fn(),
        makePassiveMock(),
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
});
