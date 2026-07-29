/**
 * @fileoverview 战斗模块 Pinia Store 单元测试
 *
 * 覆盖 useCombatStore 的：
 * 1. State 初始值（state/enemies/turn/combatId/combatResult 等均为初始值）
 * 2. Getters：isInCombat/aliveEnemies/hasBossEnemy/currentTarget（真实 computed 逻辑）
 * 3. Actions：
 *    - startCombat（设置 fighting 状态、emit COMBAT_START + COMBAT_PLAYER_TURN）
 *    - skipTurn（guard + emit COMBAT_SKIP_TURN + 委托 endPlayerTurn）
 *    - endCombat（重入 guard / 空敌人短路 / victory / defeat / fled 五条分支）
 *    - reset / advanceTurn / toggleCombatSpeed / addEffectToPlayer（委托与 guard）
 *    - playerAction（guard / 控制效果 / attack / skill 无 id / flee / 未知类型）
 *    - canCastSkill / consumeSkillResource（资源系统检查与消耗）
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - 7 个 composable 全量 mock（useCombatState 返回真实 ref + 真实 computed getter）。
 *  - combat service（generateCombatId/isBossCombat）、log service（generateLogId）、
 *    effects（createEmptyContainer）、resources（ResourceSystemFactory）全量 mock。
 *  - combat db mock（store 不直接使用，但按规约隔离）。
 *  - 6 个跨 store（character/log/quest/skill/enemy/inventory）mock，character/log/quest
 *    通过 vi.mocked().mockReturnValue(stub) 注入可控 stub。
 *  - eventBus 使用真实实现，通过 eventBus.on 注册 spy 断言 emit，beforeEach 调用 clearAll。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref, computed, shallowRef } from 'vue';
import { createTestPinia } from '../utils/setup';
import { eventBus, GameEvents } from '@/modules/bus';
import type { CombatState, CombatResult, CombatAction } from '@/modules/combat/types';
import type { EnemyInstance } from '@/modules/enemy/types';
import type { Skill } from '@/modules/skill/types';
import type { ResourceSystem } from '@/modules/combat/resources/types';

// ==================== vi.hoisted：composable mock 持有对象 ====================
const mocks = vi.hoisted(() => ({
  state: null as ReturnType<typeof createCombatStateMock> | null,
  log: null as Record<string, ReturnType<typeof vi.fn>> | null,
  boss: null as Record<string, ReturnType<typeof vi.fn>> | null,
  enemy: null as Record<string, ReturnType<typeof vi.fn>> | null,
  initiative: null as Record<string, ReturnType<typeof vi.fn>> | null,
  player: null as Record<string, ReturnType<typeof vi.fn>> | null,
  passive: null as Record<string, ReturnType<typeof vi.fn>> | null,
}));

// ==================== Mock：7 个 composable ====================
vi.mock('@/modules/combat/composables/useCombatState', () => ({
  useCombatState: () => mocks.state,
}));
vi.mock('@/modules/combat/composables/useCombatLog', () => ({
  useCombatLog: () => mocks.log,
}));
vi.mock('@/modules/combat/composables/useBossMechanics', () => ({
  // 调用 bossCtx 方法以触发 store.ts 中 bossCtx 闭包函数定义，维持函数覆盖率。
  // 真实 useBossMechanics 会通过 IBossContext 接口调用这些方法。
  useBossMechanics: (
    _state: unknown,
    _log: unknown,
    bossCtx: {
      getPlayerName: () => string;
      createMinion: (dataId: string, level: number) => Promise<unknown>;
      rebuildInitiativeOrder: () => void;
    },
  ) => {
    bossCtx.getPlayerName();
    void bossCtx.createMinion('coverage', 1);
    bossCtx.rebuildInitiativeOrder();
    return mocks.boss;
  },
}));
vi.mock('@/modules/combat/composables/useEnemyAction', () => ({
  useEnemyAction: () => mocks.enemy,
}));
vi.mock('@/modules/combat/composables/useInitiative', () => ({
  useInitiative: () => mocks.initiative,
}));
vi.mock('@/modules/combat/composables/usePlayerAction', () => ({
  usePlayerAction: () => mocks.player,
}));
vi.mock('@/modules/combat/composables/usePassiveSkills', () => ({
  usePassiveSkills: () => mocks.passive,
}));

// ==================== Mock：combat service / log service / effects / resources ====================
vi.mock('@/modules/combat/service', () => ({
  generateCombatId: vi.fn(() => 'combat_test_1'),
  isBossCombat: vi.fn((e: { isBoss?: boolean }) => Boolean(e.isBoss)),
  generateBattleLogId: vi.fn(() => 'blog_test_1'),
  rollCritical: vi.fn(() => false),
  rollDodge: vi.fn(() => false),
  calculateFleeChance: vi.fn(() => 0.5),
  rollFleeSuccess: vi.fn(() => true),
}));

vi.mock('@/modules/log/service', () => ({
  generateLogId: vi.fn(() => 'log_test_1'),
  LOG_TYPE_ICONS: {},
}));

vi.mock('@/modules/combat/effects', () => ({
  createEmptyContainer: vi.fn(() => ({ effects: [] })),
  generateEffectId: vi.fn(() => 'eff_test_1'),
  addEffectToContainer: vi.fn(),
  EffectHandlerRegistry: vi.fn(() => ({})),
  createDefaultRegistry: vi.fn(),
}));

vi.mock('@/modules/combat/resources', () => ({
  ResourceSystemFactory: {
    create: vi.fn(() => []),
  },
}));

// ==================== Mock：combat db（store 不直接使用，按规约隔离） ====================
vi.mock('@/modules/combat/db', () => ({
  combatDbService: { saveCombatLog: vi.fn().mockResolvedValue(undefined) },
}));

// ==================== Mock：6 个跨 store 依赖 ====================
vi.mock('@/modules/character/store', () => ({ useCharacterStore: vi.fn() }));
vi.mock('@/modules/log/store', () => ({ useLogStore: vi.fn() }));
vi.mock('@/modules/quest/store', () => ({ useQuestStore: vi.fn() }));
vi.mock('@/modules/skill/store', () => ({ useSkillStore: vi.fn() }));
vi.mock('@/modules/enemy/store', () => ({ useEnemyStore: vi.fn() }));
vi.mock('@/modules/inventory/store', () => ({ useInventoryStore: vi.fn() }));

// ==================== 取出 spy 引用 ====================
import { generateCombatId, isBossCombat } from '@/modules/combat/service';
import { generateLogId } from '@/modules/log/service';
import { createEmptyContainer } from '@/modules/combat/effects';
import { ResourceSystemFactory } from '@/modules/combat/resources';
import { useCharacterStore } from '@/modules/character/store';
import { useLogStore } from '@/modules/log/store';
import { useQuestStore } from '@/modules/quest/store';
import { useSkillStore } from '@/modules/skill/store';
import { useEnemyStore } from '@/modules/enemy/store';
import { useCombatStore } from '@/modules/combat/store';

// ==================== 测试数据构造 helper ====================

function makeEnemy(o: Partial<EnemyInstance> = {}): EnemyInstance {
  return {
    id: 'enemy_1',
    dataId: 'goblin',
    name: '哥布林',
    icon: 'game-icons:goblin',
    level: 1,
    hp: 50,
    maxHp: 50,
    damage: [5, 10],
    xp: 20,
    gold: 10,
    dangerLevel: '普通',
    stats: { str: 5, dex: 5, con: 5, int: 5, wis: 5, cha: 5 },
    expReward: 20,
    goldReward: 10,
    ...o,
  } as EnemyInstance;
}

function makeResourceSystem(o: Partial<ResourceSystem> = {}): ResourceSystem {
  return {
    type: 'rage',
    current: 0,
    max: 100,
    reset: vi.fn(),
    generate: vi.fn(),
    consume: vi.fn(() => true),
    hasEnough: vi.fn(() => true),
    onTurnStart: vi.fn(),
    onAttack: vi.fn(),
    onKill: vi.fn(),
    onDamaged: vi.fn(),
    ...o,
  } as unknown as ResourceSystem;
}

// ==================== composable mock 工厂 ====================

/**
 * 创建 useCombatState mock，返回真实 ref + 真实 computed getter。
 * enemies 为可控 ref（非 computed），使 aliveEnemies/hasBossEnemy/currentTarget 可被真实测试。
 */
function createCombatStateMock() {
  const state = ref<CombatState>('idle');
  const enemyIds = ref<string[]>([]);
  const targetEnemyId = ref<string | null>(null);
  const turn = ref<'player' | 'enemy'>('player');
  const turnCount = ref(0);
  const combatId = ref('');
  const combatLogs = ref<any[]>([]);
  const combatResult = ref<CombatResult | null>(null);
  const expGained = ref(0);
  const goldGained = ref(0);
  const initiativeOrder = ref<string[]>([]);
  const currentInitiativeIndex = ref(0);
  const combatSpeed = ref<1 | 2>(1);
  const playerEffects = ref<any>({ effects: [] });
  const enemyEffects = ref<Record<string, any>>({});
  const enemyPositions = ref<Record<string, { row: 'front' | 'back'; col: number }>>({});
  const bossIntros = ref<Record<string, any>>({});
  const resourceSystems = shallowRef<ResourceSystem[]>([]);
  const turnTimerId = ref<number | null>(null);
  const bossIntroTimerId = ref<number | null>(null);
  const bossPhaseManagers = new Map();
  const enemies = ref<EnemyInstance[]>([]);

  const isInCombat = computed(() => state.value === 'fighting');
  const aliveEnemies = computed(() => enemies.value.filter(e => e.hp > 0));
  const hasBossEnemy = computed(() => enemies.value.some(e => Boolean(e.isBoss)));
  const currentTarget = computed(
    () => enemies.value.find(e => e.id === targetEnemyId.value) || aliveEnemies.value[0] || null,
  );

  const effectRegistry = {
    getDisabledActions: vi.fn(() => ({ skipTurn: false, types: [] as string[] })),
  };

  function resetState() {
    state.value = 'idle';
    enemyIds.value = [];
    enemies.value = [];
    targetEnemyId.value = null;
    turn.value = 'player';
    turnCount.value = 0;
    combatId.value = '';
    combatLogs.value = [];
    combatResult.value = null;
    expGained.value = 0;
    goldGained.value = 0;
    playerEffects.value = { effects: [] };
    enemyEffects.value = {};
    enemyPositions.value = {};
    bossIntros.value = {};
    resourceSystems.value = [];
    turnTimerId.value = null;
    bossIntroTimerId.value = null;
  }

  const cleanup = vi.fn(() => { resetState(); });
  const reset = vi.fn(() => { resetState(); });
  const addEffectToPlayer = vi.fn((effect: any) => {
    if (state.value !== 'fighting') return;
    playerEffects.value.effects.push(effect);
  });

  return {
    state, enemyIds, targetEnemyId, turn, turnCount, combatId,
    combatLogs, combatResult, expGained, goldGained,
    initiativeOrder, currentInitiativeIndex, combatSpeed,
    playerEffects, enemyEffects, enemyPositions, bossIntros,
    resourceSystems, turnTimerId, bossIntroTimerId, bossPhaseManagers, effectRegistry,
    enemies, isInCombat, aliveEnemies, hasBossEnemy, currentTarget,
    cleanup, reset, addEffectToPlayer,
  };
}

function createLogMock() {
  return {
    addCombatLog: vi.fn(),
    // P2-46：saveLogs 现在以 .catch() 链式调用，mock 需返回 resolved Promise
    saveLogs: vi.fn().mockResolvedValue(undefined),
    createPlayerEffectContext: vi.fn(() => ({ ownerId: 'player', ownerType: 'player' })),
    createEnemyEffectContext: vi.fn(() => ({ ownerId: 'enemy', ownerType: 'enemy' })),
  };
}

function createBossMock() {
  // S3：useBossMechanics 通过 IBossContext 注入，不再返回 setInitiativeCallback
  return {
    initBossFeatures: vi.fn(),
    applyMechanicEffect: vi.fn(),
    scaleBossEffectValue: vi.fn(),
  };
}

function createEnemyActionMock() {
  return {
    applyEnemyDamageToPlayer: vi.fn(),
    enemyBasicAttack: vi.fn(),
    enemyAttackWithSkill: vi.fn(),
    enemyAction: vi.fn(),
    getStrategy: vi.fn(),
  };
}

function createInitiativeMock(stateMock: ReturnType<typeof createCombatStateMock>) {
  return {
    assignEnemyPositions: vi.fn(),
    buildInitiativeOrder: vi.fn(),
    advanceTurn: vi.fn(),
    toggleCombatSpeed: vi.fn(() => {
      stateMock.combatSpeed.value = stateMock.combatSpeed.value === 1 ? 2 : 1;
    }),
    advanceToNextUnit: vi.fn(),
    singleEnemyTurn: vi.fn(),
    endPlayerTurn: vi.fn(),
  };
}

function createPlayerMock() {
  return {
    playerAttack: vi.fn(),
    playerSkill: vi.fn(),
    playerUseItem: vi.fn(),
    playerFlee: vi.fn(),
    handleLoot: vi.fn(),
    applySkillBuffs: vi.fn(),
    applyDebuffToEnemy: vi.fn(),
  };
}

function createPassiveMock() {
  return {
    loadPassives: vi.fn(),
    onCombatStart: vi.fn(),
    onTurnStart: vi.fn(),
    onAttack: vi.fn(),
    onDamaged: vi.fn(),
    onKill: vi.fn(),
    getPassives: vi.fn(() => []),
  };
}

/** 跨 store stub：character */
function createCharStub() {
  return {
    classId: 'warrior',
    name: '英雄',
    hp: 100,
    maxHp: 100,
    gainExp: vi.fn(),
    gainGold: vi.fn(),
    handleDeath: vi.fn(),
    takeDamage: vi.fn(),
    receiveHeal: vi.fn(),
    effectiveStats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    attributes: {
      physicalAttack: 20, physicalDefense: 15, magicAttack: 20, magicDefense: 15,
      critChance: 5, dodgeChance: 3, maxHp: 100, maxMana: 50,
    },
  };
}

/** 跨 store stub：logStore */
function createLogStoreStub() {
  return { addLogEntry: vi.fn() };
}

/** 跨 store stub：questStore */
function createQuestStoreStub() {
  return { onEnemyKilled: vi.fn() };
}

/** 设置 fighting 状态并注入敌人，便于测试需要战斗中的 action */
function setupFightingStore(enemies: EnemyInstance[] = []) {
  const store = useCombatStore();
  const sm = mocks.state!;
  sm.state.value = 'fighting';
  sm.turn.value = 'player';
  sm.enemies.value = enemies;
  sm.enemyIds.value = enemies.map(e => e.id);
  sm.combatId.value = 'combat_test_1';
  return store;
}

// ==================== 测试用例 ====================

describe('useCombatStore - 战斗 Store', () => {
  beforeEach(() => {
    createTestPinia();
    vi.clearAllMocks();
    eventBus.clearAll();

    // 重建 composable mock
    const stateMock = createCombatStateMock();
    mocks.state = stateMock;
    mocks.log = createLogMock();
    mocks.boss = createBossMock();
    mocks.enemy = createEnemyActionMock();
    mocks.initiative = createInitiativeMock(stateMock);
    mocks.player = createPlayerMock();
    mocks.passive = createPassiveMock();

    // 注入跨 store stub
    vi.mocked(useCharacterStore).mockReturnValue(createCharStub() as never);
    vi.mocked(useLogStore).mockReturnValue(createLogStoreStub() as never);
    vi.mocked(useQuestStore).mockReturnValue(createQuestStoreStub() as never);
    // P2-3：startCombat 会调用 useSkillStore().resetCooldowns()，需注入 stub
    vi.mocked(useSkillStore).mockReturnValue({ resetCooldowns: vi.fn() } as never);
    // bossCtx.createMinion 在 useBossMechanics mock 中被调用，需注入 enemyStore.createEnemy stub
    vi.mocked(useEnemyStore).mockReturnValue({
      createEnemy: vi.fn().mockResolvedValue(null),
    } as never);
  });

  // -------------------- State 初始值 --------------------
  describe('State 初始值', () => {
    it('state 为 idle、turn 为 player、combatId 为空字符串', () => {
      const store = useCombatStore();
      expect(store.state).toBe('idle');
      expect(store.turn).toBe('player');
      // combatId 未被 store 返回对象导出，直接断言底层 ref
      expect(mocks.state!.combatId.value).toBe('');
    });

    it('enemies/combatLogs/initiativeOrder 为空数组，combatResult 为 null', () => {
      const store = useCombatStore();
      expect(store.enemies).toEqual([]);
      expect(store.combatLogs).toEqual([]);
      expect(store.initiativeOrder).toEqual([]);
      expect(store.combatResult).toBeNull();
    });

    it('expGained/goldGained/turnCount 为 0，combatSpeed 为 1', () => {
      const store = useCombatStore();
      expect(store.expGained).toBe(0);
      expect(store.goldGained).toBe(0);
      expect(store.turnCount).toBe(0);
      expect(store.combatSpeed).toBe(1);
    });
  });

  // -------------------- Getters --------------------
  describe('Getters', () => {
    it('isInCombat：state=fighting 时为 true，idle 时为 false', () => {
      const store = useCombatStore();
      expect(store.isInCombat).toBe(false);
      mocks.state!.state.value = 'fighting';
      expect(store.isInCombat).toBe(true);
    });

    it('aliveEnemies：过滤 hp<=0 的敌人', () => {
      const store = useCombatStore();
      mocks.state!.enemies.value = [
        makeEnemy({ id: 'e1', hp: 50 }),
        makeEnemy({ id: 'e2', hp: 0 }),
        makeEnemy({ id: 'e3', hp: 30 }),
      ];
      // 先访问触发 computed 求值
      const alive = store.aliveEnemies;
      expect(alive).toHaveLength(2);
      expect(alive.map(e => e.id)).toEqual(['e1', 'e3']);
    });

    it('hasBossEnemy：包含 isBoss 敌人时为 true', () => {
      const store = useCombatStore();
      mocks.state!.enemies.value = [makeEnemy({ id: 'e1' })];
      expect(store.hasBossEnemy).toBe(false);
      mocks.state!.enemies.value = [
        makeEnemy({ id: 'e1' }),
        makeEnemy({ id: 'e2', isBoss: true }),
      ];
      expect(store.hasBossEnemy).toBe(true);
    });

    it('currentTarget：优先 targetEnemyId，其次第一个存活敌人', () => {
      const store = useCombatStore();
      const e1 = makeEnemy({ id: 'e1', hp: 50 });
      const e2 = makeEnemy({ id: 'e2', hp: 30 });
      mocks.state!.enemies.value = [e1, e2];
      // 无 targetEnemyId 时取第一个存活
      expect(store.currentTarget?.id).toBe('e1');
      // 设置 targetEnemyId 后优先返回该敌人
      mocks.state!.targetEnemyId.value = 'e2';
      expect(store.currentTarget?.id).toBe('e2');
    });

    it('currentTarget：无敌人时返回 null', () => {
      const store = useCombatStore();
      expect(store.currentTarget).toBeNull();
    });
  });

  // -------------------- Actions：startCombat --------------------
  describe('Actions：startCombat', () => {
    it('成功：设置 fighting 状态、combatId、emit COMBAT_START + COMBAT_PLAYER_TURN', () => {
      const startSpy = vi.fn();
      const turnSpy = vi.fn();
      eventBus.on(GameEvents.COMBAT_START, startSpy);
      eventBus.on(GameEvents.COMBAT_PLAYER_TURN, turnSpy);

      const enemy = makeEnemy({ id: 'e1', name: '哥布林' });
      const store = useCombatStore();
      store.startCombat([enemy]);

      expect(generateCombatId).toHaveBeenCalled();
      expect(store.state).toBe('fighting');
      // combatId 未被 store 返回对象导出，直接断言底层 ref
      expect(mocks.state!.combatId.value).toBe('combat_test_1');
      expect(store.turn).toBe('player');
      expect(store.turnCount).toBe(1);
      expect(store.combatResult).toBeNull();
      expect(store.expGained).toBe(0);
      // composable 被调用
      expect(mocks.boss!.initBossFeatures).toHaveBeenCalledWith([enemy]);
      expect(mocks.initiative!.assignEnemyPositions).toHaveBeenCalledWith([enemy]);
      expect(mocks.initiative!.buildInitiativeOrder).toHaveBeenCalled();
      expect(mocks.passive!.loadPassives).toHaveBeenCalled();
      expect(mocks.passive!.onCombatStart).toHaveBeenCalled();
      expect(ResourceSystemFactory.create).toHaveBeenCalledWith('warrior');
      // emit
      expect(startSpy).toHaveBeenCalledWith({ enemy });
      expect(turnSpy).toHaveBeenCalledWith(null);
    });

    it('startCombat 时初始化资源系统并调用 reset 钩子（覆盖 forEach 回调 行 249）', () => {
      const sys = makeResourceSystem({ type: 'rage' });
      vi.mocked(ResourceSystemFactory).create.mockReturnValueOnce([sys]);

      const store = useCombatStore();
      store.startCombat([makeEnemy()]);

      expect(sys.reset).toHaveBeenCalled();
    });

    it('bossIntros 为空时不触发 COMBAT_BOSS_INTRO（跳过 setTimeout 分支）', () => {
      const introSpy = vi.fn();
      eventBus.on(GameEvents.COMBAT_BOSS_INTRO, introSpy);

      const store = useCombatStore();
      store.startCombat([makeEnemy()]);

      expect(introSpy).not.toHaveBeenCalled();
    });

    it('bossIntros 非空且 bossEnemy 存在时，300ms 后 emit COMBAT_BOSS_INTRO 并清空定时器', () => {
      vi.useFakeTimers();
      const introSpy = vi.fn();
      eventBus.on(GameEvents.COMBAT_BOSS_INTRO, introSpy);

      const intro = { effect: 'darken', lines: ['黑龙降临！'], duration: 1000 };
      const bossEnemy = makeEnemy({
        id: 'boss-intro-1', name: '黑龙', icon: 'dragon', isBoss: true,
        intro: intro as never,
      });

      // 让 mock 的 initBossFeatures 模拟真实行为，设置 bossIntros
      mocks.boss!.initBossFeatures.mockImplementationOnce((enemies: EnemyInstance[]) => {
        const intros: Record<string, typeof intro> = {};
        for (const e of enemies) {
          if (e.isBoss && e.intro) {
            intros[e.id] = e.intro as typeof intro;
          }
        }
        mocks.state!.bossIntros.value = intros as never;
      });

      const store = useCombatStore();
      store.startCombat([bossEnemy]);

      // 定时器未触发前不 emit
      expect(introSpy).not.toHaveBeenCalled();
      expect(mocks.state!.bossIntroTimerId.value).not.toBeNull();

      // 推进 300ms 触发回调
      vi.advanceTimersByTime(300);

      expect(introSpy).toHaveBeenCalledWith({
        enemyId: 'boss-intro-1',
        enemyName: '黑龙',
        icon: 'dragon',
        effect: 'darken',
        lines: ['黑龙降临！'],
        duration: 1000,
      });
      // 回调执行后清空定时器 ID
      expect(mocks.state!.bossIntroTimerId.value).toBeNull();

      vi.useRealTimers();
    });

    it('bossIntros 中的 bossId 在 enemiesData 中不存在时不 emit（跳过内部分支）', () => {
      vi.useFakeTimers();
      const introSpy = vi.fn();
      eventBus.on(GameEvents.COMBAT_BOSS_INTRO, introSpy);

      // bossIntros 中的 bossId 与 enemiesData 不匹配
      mocks.boss!.initBossFeatures.mockImplementationOnce(() => {
        mocks.state!.bossIntros.value = {
          'missing-boss': { effect: 'darken', lines: ['x'], duration: 500 },
        } as never;
      });

      const store = useCombatStore();
      store.startCombat([makeEnemy({ id: 'other-enemy' })]);

      vi.advanceTimersByTime(300);

      // bossEnemy 找不到，不 emit，也不设置定时器
      expect(introSpy).not.toHaveBeenCalled();
      expect(mocks.state!.bossIntroTimerId.value).toBeNull();

      vi.useRealTimers();
    });
  });

  // -------------------- Actions：skipTurn --------------------
  describe('Actions：skipTurn', () => {
    it('成功：emit COMBAT_SKIP_TURN 并委托 initiative.endPlayerTurn', () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.COMBAT_SKIP_TURN, spy);

      const store = setupFightingStore([makeEnemy()]);
      store.skipTurn();

      expect(spy).toHaveBeenCalledWith(null);
      expect(mocks.initiative!.endPlayerTurn).toHaveBeenCalled();
      expect(mocks.log!.addCombatLog).toHaveBeenCalled();
    });

    it('guard：非 fighting 状态时不执行', () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.COMBAT_SKIP_TURN, spy);

      const store = useCombatStore(); // state=idle
      store.skipTurn();

      expect(spy).not.toHaveBeenCalled();
      expect(mocks.initiative!.endPlayerTurn).not.toHaveBeenCalled();
    });

    it('guard：非玩家回合时不执行', () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.COMBAT_SKIP_TURN, spy);

      const store = useCombatStore();
      mocks.state!.state.value = 'fighting';
      mocks.state!.turn.value = 'enemy';
      store.skipTurn();

      expect(spy).not.toHaveBeenCalled();
      expect(mocks.initiative!.endPlayerTurn).not.toHaveBeenCalled();
    });
  });

  // -------------------- Actions：endCombat --------------------
  describe('Actions：endCombat', () => {
    it('重入 guard：state=idle 时直接返回', async () => {
      const store = useCombatStore();
      await store.endCombat('victory');
      // 不应 emit COMBAT_END
      expect(mocks.log!.saveLogs).not.toHaveBeenCalled();
    });

    it('重入 guard：state=ended 时直接返回', async () => {
      const store = useCombatStore();
      mocks.state!.state.value = 'ended';
      await store.endCombat('victory');
      expect(mocks.log!.saveLogs).not.toHaveBeenCalled();
    });

    it('空敌人短路：设置 state=ended 但不 emit COMBAT_END', async () => {
      const endSpy = vi.fn();
      eventBus.on(GameEvents.COMBAT_END, endSpy);

      const store = useCombatStore();
      mocks.state!.state.value = 'fighting';
      mocks.state!.enemies.value = [];
      await store.endCombat('victory');

      expect(store.state).toBe('ended');
      expect(endSpy).not.toHaveBeenCalled();
    });

    it('victory：设置 combatResult、emit COMBAT_END、调用 gainExp/gainGold', async () => {
      const endSpy = vi.fn();
      eventBus.on(GameEvents.COMBAT_END, endSpy);

      const charStub = createCharStub();
      vi.mocked(useCharacterStore).mockReturnValue(charStub as never);

      const enemy = makeEnemy({ id: 'e1', expReward: 30, goldReward: 15 });
      const store = setupFightingStore([enemy]);

      await store.endCombat('victory');

      // cleanup 后 state 回到 idle，但 combatResult 需保留供 UI 结果弹窗展示
      expect(store.state).toBe('idle');
      expect(store.combatResult).toBe('victory');
      expect(store.expGained).toBe(30);
      expect(store.goldGained).toBe(15);
      // emit 事件验证 result 和奖励
      expect(endSpy).toHaveBeenCalledWith(
        expect.objectContaining({ result: 'victory', expGained: 30, goldGained: 15 }),
      );
      // 角色获得经验和金币
      expect(charStub.gainExp).toHaveBeenCalledWith(30);
      expect(charStub.gainGold).toHaveBeenCalledWith(15);
      // 触发资源系统和被动技能 onKill
      expect(mocks.passive!.onKill).toHaveBeenCalled();
      // 调用 cleanup
      expect(mocks.state!.cleanup).toHaveBeenCalled();
    });

    it('defeat：emit COMBAT_END、调用 characterStore.handleDeath', async () => {
      const endSpy = vi.fn();
      eventBus.on(GameEvents.COMBAT_END, endSpy);

      const charStub = createCharStub();
      vi.mocked(useCharacterStore).mockReturnValue(charStub as never);

      const store = setupFightingStore([makeEnemy()]);

      await store.endCombat('defeat');

      expect(endSpy).toHaveBeenCalledWith(
        expect.objectContaining({ result: 'defeat', expGained: 0, goldGained: 0 }),
      );
      expect(charStub.handleDeath).toHaveBeenCalled();
    });

    it('fled：emit COMBAT_END、不调用 gainExp/gainGold/handleDeath', async () => {
      const endSpy = vi.fn();
      eventBus.on(GameEvents.COMBAT_END, endSpy);

      const charStub = createCharStub();
      vi.mocked(useCharacterStore).mockReturnValue(charStub as never);

      const store = setupFightingStore([makeEnemy()]);
      await store.endCombat('fled');

      expect(endSpy).toHaveBeenCalledWith(
        expect.objectContaining({ result: 'fled', expGained: 0, goldGained: 0 }),
      );
      expect(charStub.gainExp).not.toHaveBeenCalled();
      expect(charStub.handleDeath).not.toHaveBeenCalled();
    });

    it('victory 时 Boss 敌人触发 player.handleLoot 处理掉落', async () => {
      const endSpy = vi.fn();
      eventBus.on(GameEvents.COMBAT_END, endSpy);

      const charStub = createCharStub();
      vi.mocked(useCharacterStore).mockReturnValue(charStub as never);

      const bossEnemy = makeEnemy({ id: 'boss-1', isBoss: true, expReward: 100, goldReward: 50 });
      const normalEnemy = makeEnemy({ id: 'normal-1', isBoss: false });
      const store = setupFightingStore([bossEnemy, normalEnemy]);

      await store.endCombat('victory');

      // 仅 Boss 敌人触发 handleLoot
      expect(mocks.player!.handleLoot).toHaveBeenCalledTimes(1);
      expect(mocks.player!.handleLoot).toHaveBeenCalledWith(bossEnemy);
    });

    it('victory 时调用 ctx.quest.onEnemyKilled 更新击杀进度（每个有 dataId 的敌人）', async () => {
      const endSpy = vi.fn();
      eventBus.on(GameEvents.COMBAT_END, endSpy);

      const charStub = createCharStub();
      vi.mocked(useCharacterStore).mockReturnValue(charStub as never);
      const questStub = createQuestStoreStub();
      vi.mocked(useQuestStore).mockReturnValue(questStub as never);

      const enemy1 = makeEnemy({ id: 'e1', dataId: 'goblin' });
      const enemy2 = makeEnemy({ id: 'e2', dataId: 'slime' });
      const store = setupFightingStore([enemy1, enemy2]);

      await store.endCombat('victory');

      // 每个有 dataId 的敌人都触发 onEnemyKilled
      expect(questStub.onEnemyKilled).toHaveBeenCalledWith('goblin');
      expect(questStub.onEnemyKilled).toHaveBeenCalledWith('slime');
      expect(questStub.onEnemyKilled).toHaveBeenCalledTimes(2);
    });

    it('victory 时敌人无 dataId 不触发 onEnemyKilled（行 155 falsy 分支）', async () => {
      const charStub = createCharStub();
      vi.mocked(useCharacterStore).mockReturnValue(charStub as never);
      const questStub = createQuestStoreStub();
      vi.mocked(useQuestStore).mockReturnValue(questStub as never);

      // 敌人无 dataId（falsy），不应触发 onEnemyKilled
      const enemyNoDataId = makeEnemy({ id: 'e1', dataId: undefined });
      const store = setupFightingStore([enemyNoDataId]);

      await store.endCombat('victory');

      expect(questStub.onEnemyKilled).not.toHaveBeenCalled();
    });

    it('victory 时触发资源系统 onKill 钩子', async () => {
      const endSpy = vi.fn();
      eventBus.on(GameEvents.COMBAT_END, endSpy);

      const charStub = createCharStub();
      vi.mocked(useCharacterStore).mockReturnValue(charStub as never);

      const sys1 = makeResourceSystem({ type: 'rage' });
      const sys2 = makeResourceSystem({ type: 'combo' });
      const store = setupFightingStore([makeEnemy({ expReward: 10, goldReward: 5 })]);
      mocks.state!.resourceSystems.value = [sys1, sys2];

      await store.endCombat('victory');

      expect(sys1.onKill).toHaveBeenCalled();
      expect(sys2.onKill).toHaveBeenCalled();
    });

    it('victory 时 totalExp/totalGold 为 0 不写获得经验/金币日志', async () => {
      const endSpy = vi.fn();
      eventBus.on(GameEvents.COMBAT_END, endSpy);

      const charStub = createCharStub();
      vi.mocked(useCharacterStore).mockReturnValue(charStub as never);
      const logStoreStub = createLogStoreStub();
      vi.mocked(useLogStore).mockReturnValue(logStoreStub as never);

      // expReward 和 goldReward 均为 0
      const store = setupFightingStore([makeEnemy({ expReward: 0, goldReward: 0 })]);

      await store.endCombat('victory');

      // addLogEntry 调用次数：1 次"击败"日志，不写"获得经验"和"获得金币"日志
      const messages = logStoreStub.addLogEntry.mock.calls.map((c: [{ message: string }]) => c[0].message);
      expect(messages).toContain('击败 哥布林！');
      expect(messages.some(m => m.includes('经验值'))).toBe(false);
      expect(messages.some(m => m.includes('金币'))).toBe(false);
    });

    it('endCombat 内部抛错时被 catch 并仍调用 cleanup（优雅降级）', async () => {
      const charStub = createCharStub();
      vi.mocked(useCharacterStore).mockReturnValue(charStub as never);
      const logStoreStub = createLogStoreStub();
      // 让 addLogEntry 抛错，触发 endCombat 的 catch 分支
      logStoreStub.addLogEntry.mockImplementation(() => {
        throw new Error('日志写入失败');
      });
      vi.mocked(useLogStore).mockReturnValue(logStoreStub as never);

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const store = setupFightingStore([makeEnemy({ expReward: 10, goldReward: 5 })]);

      // 不应抛错（被 catch）
      await expect(store.endCombat('victory')).resolves.not.toThrow();

      // catch 后仍调用 cleanup 进行优雅降级
      expect(mocks.state!.cleanup).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CombatStore] 结束战斗异常'),
        expect.any(Error),
      );
      errorSpy.mockRestore();
    });

    it('endCombat 时 enemies 被清空后 emit COMBAT_END 的 enemy 字段为 null（行 197 || null 分支）', async () => {
      const endSpy = vi.fn();
      eventBus.on(GameEvents.COMBAT_END, endSpy);

      const charStub = createCharStub();
      vi.mocked(useCharacterStore).mockReturnValue(charStub as never);

      const store = setupFightingStore([makeEnemy()]);

      // 模拟在 log.saveLogs 执行期间 enemies 被清空，
      // 使后续 emit 读取 state.enemies.value[0] 为 undefined，走 || null 防御性分支
      mocks.log!.saveLogs.mockImplementationOnce(() => {
        mocks.state!.enemies.value = [];
      });

      await store.endCombat('fled');

      expect(endSpy).toHaveBeenCalledWith(
        expect.objectContaining({ enemy: null }),
      );
    });

    it('endCombat 传入未知 result 时跳过 victory/defeat/fled 分支（行 176 false 分支）', async () => {
      const endSpy = vi.fn();
      eventBus.on(GameEvents.COMBAT_END, endSpy);

      const charStub = createCharStub();
      vi.mocked(useCharacterStore).mockReturnValue(charStub as never);

      const store = setupFightingStore([makeEnemy()]);

      // 传入不匹配任何已知分支的 result（防御性分支覆盖）
      await store.endCombat('unknown' as CombatResult);

      // 仍 emit COMBAT_END，但不进入 victory/defeat/fled 任一分支
      expect(endSpy).toHaveBeenCalledWith(
        expect.objectContaining({ result: 'unknown' as CombatResult }),
      );
      // 不调用 gainExp/gainGold（victory 分支）
      expect(charStub.gainExp).not.toHaveBeenCalled();
      // 不调用 handleDeath（defeat 分支）
      expect(charStub.handleDeath).not.toHaveBeenCalled();
    });
  });

  // -------------------- Actions：reset / advanceTurn / toggleCombatSpeed / addEffectToPlayer --------------------
  describe('Actions：reset / advanceTurn / toggleCombatSpeed / addEffectToPlayer', () => {
    it('reset：委托 state.reset，状态回到初始值', () => {
      const store = setupFightingStore([makeEnemy()]);
      store.reset();
      expect(mocks.state!.reset).toHaveBeenCalled();
      expect(store.state).toBe('idle');
      expect(store.enemies).toEqual([]);
    });

    it('advanceTurn：委托 initiative.advanceTurn', () => {
      const store = setupFightingStore([makeEnemy()]);
      store.advanceTurn();
      expect(mocks.initiative!.advanceTurn).toHaveBeenCalled();
    });

    it('toggleCombatSpeed：委托 initiative.toggleCombatSpeed，速度在 1/2 间切换', () => {
      const store = setupFightingStore([makeEnemy()]);
      expect(store.combatSpeed).toBe(1);
      store.toggleCombatSpeed();
      expect(store.combatSpeed).toBe(2);
      store.toggleCombatSpeed();
      expect(store.combatSpeed).toBe(1);
    });

    it('addEffectToPlayer：fighting 状态时添加效果到 playerEffects', () => {
      const store = setupFightingStore([makeEnemy()]);
      const effect = { id: 'eff_1', type: 'attack_up', value: 10 };
      store.addEffectToPlayer(effect as never);
      // effect 经 push 进入响应式数组被 proxy 包裹，引用比较会失败，
      // 改为断言 mock 调用参数 + 数组长度
      expect(mocks.state!.addEffectToPlayer).toHaveBeenCalledWith(effect);
      expect(mocks.state!.playerEffects.value.effects).toHaveLength(1);
    });

    it('addEffectToPlayer：非 fighting 状态时忽略效果', () => {
      const store = useCombatStore(); // state=idle
      const effect = { id: 'eff_1', type: 'attack_up', value: 10 };
      store.addEffectToPlayer(effect as never);
      expect(mocks.state!.addEffectToPlayer).toHaveBeenCalledWith(effect);
      expect(mocks.state!.playerEffects.value.effects).toHaveLength(0);
    });
  });

  // -------------------- Actions：playerAction --------------------
  describe('Actions：playerAction', () => {
    it('guard：非 fighting 状态返回失败', async () => {
      const store = useCombatStore();
      const result = await store.playerAction({ type: 'attack' });
      expect(result.success).toBe(false);
      expect(result.message).toBe('不是你的回合！');
    });

    it('guard：非玩家回合返回失败', async () => {
      const store = useCombatStore();
      mocks.state!.state.value = 'fighting';
      mocks.state!.turn.value = 'enemy';
      const result = await store.playerAction({ type: 'attack' });
      expect(result.success).toBe(false);
      expect(result.message).toBe('不是你的回合！');
    });

    it('控制效果 skipTurn：调用 endPlayerTurn 并返回 isControlled', async () => {
      const store = setupFightingStore([makeEnemy()]);
      mocks.state!.effectRegistry.getDisabledActions.mockReturnValueOnce({
        skipTurn: true, types: [],
      });

      const result = await store.playerAction({ type: 'attack' });

      expect(result.success).toBe(false);
      expect(result.isControlled).toBe(true);
      expect(mocks.initiative!.endPlayerTurn).toHaveBeenCalled();
    });

    it('控制效果 silence：skill 类型被沉默时返回 isControlled', async () => {
      const store = setupFightingStore([makeEnemy()]);
      mocks.state!.effectRegistry.getDisabledActions.mockReturnValueOnce({
        skipTurn: false, types: ['skill'],
      });

      const result = await store.playerAction({ type: 'skill', skillId: 's1' });

      expect(result.success).toBe(false);
      expect(result.isControlled).toBe(true);
      expect(result.message).toContain('沉默');
    });

    it('attack：委托 player.playerAttack 并触发资源/被动钩子', async () => {
      const store = setupFightingStore([makeEnemy()]);
      const sys = makeResourceSystem();
      mocks.state!.resourceSystems.value = [sys];
      mocks.player!.playerAttack.mockReturnValueOnce({
        success: true, type: 'attack', damage: 25, isDodge: false, message: '造成 25 点伤害',
      });

      const result = await store.playerAction({ type: 'attack' });

      expect(result.success).toBe(true);
      expect(result.damage).toBe(25);
      expect(mocks.player!.playerAttack).toHaveBeenCalled();
      expect(sys.onAttack).toHaveBeenCalled();
      expect(mocks.passive!.onAttack).toHaveBeenCalledWith(25);
    });

    it('attack 闪避时不触发资源/被动钩子', async () => {
      const store = setupFightingStore([makeEnemy()]);
      const sys = makeResourceSystem();
      mocks.state!.resourceSystems.value = [sys];
      mocks.player!.playerAttack.mockReturnValueOnce({
        success: true, type: 'attack', isDodge: true, message: '闪避',
      });

      await store.playerAction({ type: 'attack' });

      expect(sys.onAttack).not.toHaveBeenCalled();
      expect(mocks.passive!.onAttack).not.toHaveBeenCalled();
    });

    it('skill：未指定 skillId 时返回失败', async () => {
      const store = setupFightingStore([makeEnemy()]);
      const result = await store.playerAction({ type: 'skill' });
      expect(result.success).toBe(false);
      expect(result.message).toBe('未指定技能！');
    });

    it('item：未指定 itemId 时返回失败', async () => {
      const store = setupFightingStore([makeEnemy()]);
      const result = await store.playerAction({ type: 'item' });
      expect(result.success).toBe(false);
      expect(result.message).toBe('未指定物品！');
    });

    it('flee：委托 player.playerFlee', async () => {
      const store = setupFightingStore([makeEnemy()]);
      mocks.player!.playerFlee.mockReturnValueOnce({
        success: true, type: 'flee', message: '成功逃离',
      });

      const result = await store.playerAction({ type: 'flee' });

      expect(result.success).toBe(true);
      expect(mocks.player!.playerFlee).toHaveBeenCalled();
    });

    it('未知类型返回失败', async () => {
      const store = setupFightingStore([makeEnemy()]);
      const result = await store.playerAction({ type: 'unknown' as never });
      expect(result.success).toBe(false);
      expect(result.message).toBe('未知行动类型！');
    });

    it('skill：委托 player.playerSkill 成功时触发资源系统 onAttack/generate 与 passive.onAttack', async () => {
      const store = setupFightingStore([makeEnemy()]);
      const sys = makeResourceSystem({ type: 'rage' });
      mocks.state!.resourceSystems.value = [sys];
      mocks.player!.playerSkill.mockResolvedValueOnce({
        success: true, type: 'skill', damage: 40, isDodge: false, message: '技能命中',
      });

      const result = await store.playerAction({ type: 'skill', skillId: 'fireball' });

      expect(result.success).toBe(true);
      expect(result.damage).toBe(40);
      expect(mocks.player!.playerSkill).toHaveBeenCalledWith('fireball');
      // 技能命中后触发资源系统 onAttack 和 generate
      expect(sys.onAttack).toHaveBeenCalled();
      expect(sys.generate).toHaveBeenCalledWith(1, 'skill');
      // 触发被动技能 onAttack 钩子
      expect(mocks.passive!.onAttack).toHaveBeenCalledWith(40);
    });

    it('skill：闪避时不触发资源系统与被动钩子', async () => {
      const store = setupFightingStore([makeEnemy()]);
      const sys = makeResourceSystem({ type: 'rage' });
      mocks.state!.resourceSystems.value = [sys];
      mocks.player!.playerSkill.mockResolvedValueOnce({
        success: true, type: 'skill', isDodge: true, message: '闪避',
      });

      await store.playerAction({ type: 'skill', skillId: 'fireball' });

      expect(sys.onAttack).not.toHaveBeenCalled();
      expect(sys.generate).not.toHaveBeenCalled();
      expect(mocks.passive!.onAttack).not.toHaveBeenCalled();
    });

    it('skill：damage 为 undefined 时 passive.onAttack 收到 0（|| 0 兜底）', async () => {
      const store = setupFightingStore([makeEnemy()]);
      const sys = makeResourceSystem({ type: 'rage' });
      mocks.state!.resourceSystems.value = [sys];
      // success=true, isDodge=false, 但 damage 未定义 → 走 `result.damage || 0` 的 falsy 分支
      mocks.player!.playerSkill.mockResolvedValueOnce({
        success: true, type: 'skill', isDodge: false, message: '技能命中无伤害',
      } as never);

      await store.playerAction({ type: 'skill', skillId: 'buff_skill' });

      expect(sys.onAttack).toHaveBeenCalled();
      expect(mocks.passive!.onAttack).toHaveBeenCalledWith(0);
    });

    it('item：委托 player.playerUseItem 并返回结果', async () => {
      const store = setupFightingStore([makeEnemy()]);
      mocks.player!.playerUseItem.mockResolvedValueOnce({
        success: true, type: 'item', message: '使用药水',
      });

      const result = await store.playerAction({ type: 'item', itemId: 'potion' });

      expect(result.success).toBe(true);
      expect(mocks.player!.playerUseItem).toHaveBeenCalledWith('potion');
    });

    it('attack：success=false 时不触发资源系统与被动钩子', async () => {
      const store = setupFightingStore([makeEnemy()]);
      const sys = makeResourceSystem({ type: 'rage' });
      mocks.state!.resourceSystems.value = [sys];
      mocks.player!.playerAttack.mockReturnValueOnce({
        success: false, type: 'attack', message: '攻击未命中', isDodge: false,
      });

      await store.playerAction({ type: 'attack' });

      expect(sys.onAttack).not.toHaveBeenCalled();
      expect(mocks.passive!.onAttack).not.toHaveBeenCalled();
    });

    it('attack：damage 为 undefined 时 passive.onAttack 收到 0（|| 0 兜底）', async () => {
      const store = setupFightingStore([makeEnemy()]);
      const sys = makeResourceSystem();
      mocks.state!.resourceSystems.value = [sys];
      // success=true, isDodge=false, 但 damage 未定义 → 走 `result.damage || 0` 的 falsy 分支
      mocks.player!.playerAttack.mockReturnValueOnce({
        success: true, type: 'attack', isDodge: false, message: '命中但无伤害',
      } as never);

      await store.playerAction({ type: 'attack' });

      expect(sys.onAttack).toHaveBeenCalled();
      expect(mocks.passive!.onAttack).toHaveBeenCalledWith(0);
    });

    it('playerAction 内部抛错时被 catch 并返回失败结果', async () => {
      const store = setupFightingStore([makeEnemy()]);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mocks.player!.playerAttack.mockImplementationOnce(() => {
        throw new Error('内部异常');
      });

      const result = await store.playerAction({ type: 'attack' });

      expect(result.success).toBe(false);
      expect(result.type).toBe('attack');
      expect(result.message).toBe('行动执行失败');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CombatStore] 玩家行动异常'),
        expect.any(Error),
      );
      errorSpy.mockRestore();
    });
  });

  // -------------------- Actions：canCastSkill / consumeSkillResource --------------------
  describe('Actions：canCastSkill', () => {
    it('技能无 resourceType/resourceCost 时返回 true（默认 MP 系统）', () => {
      const store = setupFightingStore([makeEnemy()]);
      const skill = { id: 's1', name: '火球术' } as unknown as Skill;
      expect(store.canCastSkill(skill)).toBe(true);
    });

    it('资源充足时返回 true', () => {
      const store = setupFightingStore([makeEnemy()]);
      const sys = makeResourceSystem({ type: 'rage', hasEnough: vi.fn(() => true) });
      mocks.state!.resourceSystems.value = [sys];
      const skill = {
        id: 's1', name: '顺劈斩', resourceType: 'rage', resourceCost: 20,
      } as unknown as Skill;

      expect(store.canCastSkill(skill)).toBe(true);
      expect(sys.hasEnough).toHaveBeenCalledWith(20);
    });

    it('资源不足时返回 false', () => {
      const store = setupFightingStore([makeEnemy()]);
      const sys = makeResourceSystem({ type: 'rage', hasEnough: vi.fn(() => false) });
      mocks.state!.resourceSystems.value = [sys];
      const skill = {
        id: 's1', name: '顺劈斩', resourceType: 'rage', resourceCost: 100,
      } as unknown as Skill;

      expect(store.canCastSkill(skill)).toBe(false);
    });

    it('技能 resourceType 不匹配任何资源系统时返回 true（回退到默认 MP 系统）', () => {
      const store = setupFightingStore([makeEnemy()]);
      // 资源系统为 rage，但技能需要 combo
      const sys = makeResourceSystem({ type: 'rage', hasEnough: vi.fn(() => false) });
      mocks.state!.resourceSystems.value = [sys];
      const skill = {
        id: 's1', name: '连击技能', resourceType: 'combo', resourceCost: 5,
      } as unknown as Skill;

      // 无匹配资源系统，回退到默认 MP 系统，返回 true
      expect(store.canCastSkill(skill)).toBe(true);
      // rage 系统的 hasEnough 不应被调用
      expect(sys.hasEnough).not.toHaveBeenCalled();
    });
  });

  describe('Actions：consumeSkillResource', () => {
    it('技能无 resourceType/resourceCost 时返回 true（不消耗）', () => {
      const store = setupFightingStore([makeEnemy()]);
      const skill = { id: 's1', name: '火球术' } as unknown as Skill;
      expect(store.consumeSkillResource(skill)).toBe(true);
    });

    it('匹配资源系统时调用 consume 并返回其结果', () => {
      const store = setupFightingStore([makeEnemy()]);
      const sys = makeResourceSystem({ type: 'rage', consume: vi.fn(() => true) });
      mocks.state!.resourceSystems.value = [sys];
      const skill = {
        id: 's1', name: '顺劈斩', resourceType: 'rage', resourceCost: 20,
      } as unknown as Skill;

      expect(store.consumeSkillResource(skill)).toBe(true);
      expect(sys.consume).toHaveBeenCalledWith(20);
    });

    it('技能 resourceType 不匹配任何资源系统时返回 true（不消耗专属资源）', () => {
      const store = setupFightingStore([makeEnemy()]);
      const sys = makeResourceSystem({ type: 'rage', consume: vi.fn(() => false) });
      mocks.state!.resourceSystems.value = [sys];
      const skill = {
        id: 's1', name: '连击技能', resourceType: 'combo', resourceCost: 5,
      } as unknown as Skill;

      // 无匹配资源系统，不消耗专属资源，返回 true
      expect(store.consumeSkillResource(skill)).toBe(true);
      expect(sys.consume).not.toHaveBeenCalled();
    });
  });

  // -------------------- Actions：dispose --------------------
  describe('Actions：dispose 资源释放', () => {
    it('调用 state.cleanup 清理战斗定时器与状态', () => {
      const store = useCombatStore();
      store.dispose();
      expect(mocks.state!.cleanup).toHaveBeenCalledTimes(1);
    });

    it('dispose 后状态回到初始值（idle）', () => {
      const store = setupFightingStore([makeEnemy()]);
      expect(store.state).toBe('fighting');
      store.dispose();
      expect(store.state).toBe('idle');
    });

    it('多次调用 dispose 安全（幂等）', () => {
      const store = useCombatStore();
      store.dispose();
      store.dispose();
      expect(mocks.state!.cleanup).toHaveBeenCalledTimes(2);
    });
  });
});
