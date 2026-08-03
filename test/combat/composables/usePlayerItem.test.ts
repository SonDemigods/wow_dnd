/**
 * @fileoverview usePlayerItem Composable 单元测试（QA-9）
 *
 * 直接测试 usePlayerItem（不通过 usePlayerAction 编排），覆盖：
 *   - 伤害型物品（physical_damage / magic_damage）分支
 *   - 恢复型物品（health_restore / mana_restore）分支
 *   - 暴击倍率影响（QA-12 联动）
 *   - Boss 复活机制
 *   - 无 itemInfo 的边界路径
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { usePlayerItem } from '@/modules/combat/composables/usePlayerItem';
import { useBossMechanics, type IBossContext } from '@/modules/combat/composables/useBossMechanics';
import {
  createEmptyContainer,
  type EffectContainer,
} from '@/modules/combat/effects';
import type { ICombatContext } from '@/modules/combat/combatContext';
import type { EnemyInstance } from '@/modules/enemy/types';
import { wrapAsBossInstance } from '@/modules/boss/service';
import type { BossEnemyInstance } from '@/modules/boss/types';

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

const logStoreMock = { addLogEntry: vi.fn() };
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

const pipeResultMock = { finalDamage: 40, absorbed: 0, thorns: 0 };
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

/** 构造 BossEnemyInstance（用于 Boss 复活等 Boss 专属机制测试） */
function makeBossEnemy(o: Partial<BossEnemyInstance> = {}): BossEnemyInstance {
  return {
    ...makeEnemy(),
    id: 'boss1',
    name: 'Boss',
    isBoss: true,
    phases: [],
    ...o,
  };
}

function makeStateMock(opts: { target?: EnemyInstance | null; alive?: EnemyInstance[]; hasBoss?: boolean } = {}) {
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
  return { endPlayerTurn: vi.fn() } as never;
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

/**
 * P3-146：usePlayerItem 新增 passive 参数，构造 mock 注入
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

describe('usePlayerItem - 玩家物品 Composable（QA-9）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    characterMock.hp = 100;
    pipeResultMock.finalDamage = 40;
    pipeResultMock.absorbed = 0;
    pipeResultMock.thorns = 0;
    rollPlayerCritMock.mockReturnValue({ isCrit: false, multiplier: 1 });
    enemyStoreMock.takeDamage.mockReturnValue(false);
    enemyStoreMock.getEnemyById.mockReturnValue(null);
    inventoryStoreMock.getItemInfo.mockReturnValue(null);
    inventoryStoreMock.useItem.mockResolvedValue(undefined);
  });

  it('返回包含 playerUseItem 方法的对象', () => {
    const item = usePlayerItem(
      makeStateMock(), makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makePassiveMock(),
    );
    expect(typeof item.playerUseItem).toBe('function');
  });

  describe('伤害型物品', () => {
    it('无目标时返回 success=false', async () => {
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '炸弹', effect: { type: 'physical_damage', value: 50 },
      });
      const state = makeStateMock({ target: null, alive: [] });

      const result = await usePlayerItem(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makePassiveMock(),
      ).playerUseItem('item1');

      expect(result.success).toBe(false);
      expect(result.type).toBe('item');
      expect(result.message).toContain('目标');
    });

    it('physical_damage 物品对目标造成伤害', async () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '炸弹', effect: { type: 'physical_damage', value: 50 },
      });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      enemyStoreMock.takeDamage.mockReturnValue(false);
      pipeResultMock.finalDamage = 40;

      const result = await usePlayerItem(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makePassiveMock(),
      ).playerUseItem('item1');

      expect(result.success).toBe(true);
      expect(result.type).toBe('item');
      expect(result.damage).toBe(40);
      expect(enemyStoreMock.takeDamage).toHaveBeenCalledWith('e1', 40);
    });

    it('magic_damage 物品使用 magical 管线', async () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '魔法卷轴', effect: { type: 'magic_damage', value: 50 },
      });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      pipeResultMock.finalDamage = 35;

      await usePlayerItem(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makePassiveMock(),
      ).playerUseItem('item1');

      expect(enemyStoreMock.takeDamage).toHaveBeenCalledWith('e1', 35);
    });

    it('暴击时伤害 ×CRIT_DAMAGE_MULTIPLIER（QA-12 联动）', async () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '炸弹', effect: { type: 'physical_damage', value: 50 },
      });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      pipeResultMock.finalDamage = 40;
      rollPlayerCritMock.mockReturnValue({ isCrit: true, multiplier: 1.5 });

      const result = await usePlayerItem(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makePassiveMock(),
      ).playerUseItem('item1');

      // finalDamage = 40 * 1.5 = 60
      expect(result.damage).toBe(60);
      expect(result.isCrit).toBe(true);
    });

    it('荆棘反伤使用 computeThornsDamage 计算（暴击时受倍率影响）', async () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '炸弹', effect: { type: 'physical_damage', value: 50 },
      });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      pipeResultMock.finalDamage = 40;
      pipeResultMock.thorns = 6;
      rollPlayerCritMock.mockReturnValue({ isCrit: true, multiplier: 1.5 });

      await usePlayerItem(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makePassiveMock(),
      ).playerUseItem('item1');

      // 暴击时 thorns * 1.5 = Math.floor(9) = 9
      expect(characterMock.takeDamage).toHaveBeenCalledWith(9);
    });

    it('击杀所有敌人时调用 endCombat("victory")', async () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '炸弹', effect: { type: 'physical_damage', value: 50 },
      });
      enemyStoreMock.takeDamage.mockReturnValue(true);
      state.aliveEnemies.value = [];

      const endCombat = vi.fn();
      await usePlayerItem(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), endCombat, makeBossMock(), makePassiveMock(),
      ).playerUseItem('item1');

      expect(endCombat).toHaveBeenCalledWith('victory');
    });

    it('击杀 BOSS 且 canRevive 时复活并调用 endPlayerTurn', async () => {
      const boss = makeBossEnemy({ id: 'boss1', name: 'Boss', maxHp: 100 });
      const state = makeStateMock({ target: boss, alive: [boss] });
      state.bossInstances.set(boss.id, wrapAsBossInstance(boss));
      state.bossInstances.get(boss.id)!.runtime.canRevive = true;
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '炸弹', effect: { type: 'physical_damage', value: 50 },
      });
      enemyStoreMock.takeDamage.mockReturnValue(true);
      state.aliveEnemies.value = [];

      // 使用真实 useBossMechanics 以验证复活逻辑（顶部已静态导入）
      const ctx = makeMockCtx();
      const bossCtx: IBossContext = {
        getPlayerName: () => ctx.character.name,
        createMinion: async () => null,
        rebuildInitiativeOrder: () => {},
        applyDamageToPlayer: (amount) => ctx.character.takeDamage(amount),
      };
      const realBoss = useBossMechanics(state, makeLogMock(), bossCtx);

      const endCombat = vi.fn();
      const initiative = makeInitiativeMock();
      await usePlayerItem(
        state, makeLogMock(), ctx, initiative, endCombat, realBoss as never, makePassiveMock(),
      ).playerUseItem('item1');

      expect(boss.hp).toBe(50);
      expect(initiative.endPlayerTurn).toHaveBeenCalled();
      expect(endCombat).not.toHaveBeenCalled();
    });
  });

  describe('恢复型物品', () => {
    it('mana_restore 物品触发 healType=mana 事件', async () => {
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '法力药水', effect: { type: 'mana_restore', value: 20 },
      });

      await usePlayerItem(
        makeStateMock(), makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makePassiveMock(),
      ).playerUseItem('item1');

      const { eventBus, GameEvents } = await import('@/modules/bus');
      expect(eventBus.emit).toHaveBeenCalledWith(GameEvents.COMBAT_CAST_HEAL, expect.objectContaining({
        healType: 'mana',
        amount: 20,
      }));
    });

    it('health_restore 物品触发 healType=health 事件', async () => {
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '生命药水', effect: { type: 'health_restore', value: 30 },
      });

      await usePlayerItem(
        makeStateMock(), makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makePassiveMock(),
      ).playerUseItem('item1');

      const { eventBus, GameEvents } = await import('@/modules/bus');
      expect(eventBus.emit).toHaveBeenCalledWith(GameEvents.COMBAT_CAST_HEAL, expect.objectContaining({
        healType: 'health',
        amount: 30,
      }));
    });
  });

  describe('边界路径', () => {
    it('无 itemInfo 时仍调用 useItem 并记录物品日志', async () => {
      inventoryStoreMock.getItemInfo.mockReturnValue(null);

      const result = await usePlayerItem(
        makeStateMock(), makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makePassiveMock(),
      ).playerUseItem('item1');

      expect(inventoryStoreMock.useItem).toHaveBeenCalledWith('item1');
      expect(result.success).toBe(true);
      expect(result.message).toContain('物品');
    });

    it('itemInfo.name 为空时日志回退为"卷轴"', async () => {
      const enemy = makeEnemy({ id: 'e1', name: '史莱姆' });
      const state = makeStateMock({ target: enemy, alive: [enemy] });
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '', effect: { type: 'physical_damage', value: 50 },
      });
      enemyStoreMock.getEnemyById.mockReturnValue(enemy);
      pipeResultMock.finalDamage = 40;

      const result = await usePlayerItem(
        state, makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makePassiveMock(),
      ).playerUseItem('item1');

      expect(result.success).toBe(true);
      expect(result.message).toContain('卷轴');
    });

    it('非伤害/恢复型 effect 时仅记录物品使用日志', async () => {
      inventoryStoreMock.getItemInfo.mockReturnValue({
        name: '神秘物品', effect: { type: 'custom', value: 50 },
      });

      const result = await usePlayerItem(
        makeStateMock(), makeLogMock(), makeMockCtx(), makeInitiativeMock(), vi.fn(), makeBossMock(), makePassiveMock(),
      ).playerUseItem('item1');

      expect(result.success).toBe(true);
      // 非伤害型，无 damage
      expect(result.damage).toBeUndefined();
    });
  });
});
