/**
 * @fileoverview Boss 模块 Pinia Store 单元测试
 *
 * 覆盖 useBossStore 的：
 * 1. State 初始值（currentBoss/currentPhase/currentPhaseIndex/triggeredMechanicsThisTurn/
 *    allTriggeredMechanics/isBossCombat）
 * 2. Getters：hpPercent / hasShield / isInvulnerable / isCharging / phaseName / nextPhaseThreshold
 * 3. Actions：
 *    - initBossCombat（无 phases / 有 phases / getCurrentPhase 返回 null）
 *    - checkPhaseSwitch（无 boss / 切换发生 / 切换未发生）
 *    - processMechanics（无 boss / 触发机制并去重累加 allTriggeredMechanics）
 *    - getCurrentBoss / getNextPhaseThreshold
 *    - reset 清空全部状态
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - BossPhaseManager 类全量 mock：通过 vi.hoisted 共享 getCurrentPhase/reset 的 spy，
 *    使 store 内部 `new BossPhaseManager()` 创建的实例方法可被测试控制与断言。
 *  - engine 模块的 processBossPhaseMechanics / applyPhaseStats 全量 mock。
 *  - eventBus 使用真实实现（本 store 未直接 emit，无需断言事件）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestPinia } from '../utils/setup';
import type { EnemyInstance } from '@/modules/enemy/types';
import type { BossPhase, BossMechanicType } from '@/modules/boss/types';
import type { Stats } from '@/modules/character/types';

/** 通过 vi.hoisted 共享实例方法 spy，使 mock 工厂与测试体可访问同一引用 */
const phaseManagerMocks = vi.hoisted(() => ({
  getCurrentPhase: vi.fn(),
  reset: vi.fn(),
}));

/** mock BossPhaseManager 类，每次 new 返回携带共享 spy 的实例 */
vi.mock('@/modules/boss/phaseManager', () => ({
  BossPhaseManager: vi.fn(function () {
    return {
      getCurrentPhase: phaseManagerMocks.getCurrentPhase,
      reset: phaseManagerMocks.reset,
    };
  }),
}));

/** mock Boss 引擎纯逻辑函数，避免触发真实机制副作用 */
vi.mock('@/modules/boss/engine', () => ({
  processBossPhaseMechanics: vi.fn(),
  applyPhaseStats: vi.fn(),
}));

/** 从 mock 中取出 spy 引用，便于断言 */
import { BossPhaseManager } from '@/modules/boss/phaseManager';
import { processBossPhaseMechanics, applyPhaseStats } from '@/modules/boss/engine';
import { useBossStore } from '@/modules/boss/store';

// ==================== 测试数据构造 helper ====================

function makeStats(o: Partial<Stats> = {}): Stats {
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...o };
}

function makePhase(o: Partial<BossPhase> = {}): BossPhase {
  return {
    hpThreshold: 0.5,
    name: '狂暴阶段',
    dialogue: [],
    aiStrategy: 'aggressive',
    mechanics: [],
    ...o,
  } as BossPhase;
}

function makeBossInstance(o: Partial<EnemyInstance> = {}): EnemyInstance {
  return {
    id: 'boss-1',
    dataId: 'boss-1',
    name: '测试Boss',
    icon: 'game-icons:dragon',
    maxHp: 1000,
    hp: 1000,
    damage: [10, 20],
    xp: 500,
    gold: 200,
    dangerLevel: '致命',
    level: 10,
    stats: makeStats(),
    expReward: 500,
    goldReward: 200,
    isBoss: true,
    ...o,
  } as EnemyInstance;
}

// ==================== 测试用例 ====================

describe('useBossStore - Boss 战斗 Store', () => {
  beforeEach(() => {
    createTestPinia();
    vi.clearAllMocks();
  });

  // -------------------- State 初始值 --------------------
  describe('State 初始值', () => {
    it('currentBoss/currentPhase 初始为 null', () => {
      const store = useBossStore();
      expect(store.currentBoss).toBeNull();
      expect(store.currentPhase).toBeNull();
    });

    it('currentPhaseIndex 初始为 -1', () => {
      const store = useBossStore();
      expect(store.currentPhaseIndex).toBe(-1);
    });

    it('triggeredMechanicsThisTurn/allTriggeredMechanics 初始为空数组', () => {
      const store = useBossStore();
      expect(store.triggeredMechanicsThisTurn).toEqual([]);
      expect(store.allTriggeredMechanics).toEqual([]);
    });

    it('isBossCombat 初始为 false', () => {
      const store = useBossStore();
      expect(store.isBossCombat).toBe(false);
    });
  });

  // -------------------- Getters --------------------
  describe('Getters', () => {
    it('hpPercent：无 boss 时返回 0', () => {
      const store = useBossStore();
      expect(store.hpPercent).toBe(0);
    });

    it('hpPercent：按 hp/maxHp 计算', () => {
      const store = useBossStore();
      store.$patch({
        currentBoss: makeBossInstance({ hp: 300, maxHp: 1000 }),
      });
      expect(store.hpPercent).toBeCloseTo(0.3, 5);
    });

    it('hasShield：shield>0 时为 true，否则为 false', () => {
      const store = useBossStore();
      store.currentBoss = makeBossInstance({ shield: 50 } as Partial<EnemyInstance>);
      expect(store.hasShield).toBe(true);
      store.currentBoss = makeBossInstance();
      expect(store.hasShield).toBe(false);
    });

    it('isInvulnerable：invulnerable=true 时为 true，否则为 false', () => {
      const store = useBossStore();
      store.currentBoss = makeBossInstance({ invulnerable: true } as Partial<EnemyInstance>);
      expect(store.isInvulnerable).toBe(true);
      store.currentBoss = makeBossInstance();
      expect(store.isInvulnerable).toBe(false);
    });

    it('isCharging：charging=true 时为 true，否则为 false', () => {
      const store = useBossStore();
      store.currentBoss = makeBossInstance({ charging: true } as Partial<EnemyInstance>);
      expect(store.isCharging).toBe(true);
      store.currentBoss = makeBossInstance();
      expect(store.isCharging).toBe(false);
    });

    it('phaseName：有阶段返回名称，无阶段返回空字符串', () => {
      const store = useBossStore();
      expect(store.phaseName).toBe('');
      store.$patch({ currentPhase: makePhase({ name: '第二阶段' }) });
      expect(store.phaseName).toBe('第二阶段');
    });

    it('nextPhaseThreshold：无 boss 或无阶段时返回 null', () => {
      const store = useBossStore();
      expect(store.nextPhaseThreshold).toBeNull();
    });

    it('nextPhaseThreshold：currentPhaseIndex>0 时返回上一阶段阈值', () => {
      const store = useBossStore();
      const phase0 = makePhase({ hpThreshold: 0.75, name: '一阶段' });
      const phase1 = makePhase({ hpThreshold: 0.5, name: '二阶段' });
      const boss = makeBossInstance({
        hp: 400,
        maxHp: 1000,
        phases: [phase0, phase1],
      } as Partial<EnemyInstance>);
      store.$patch({
        currentBoss: boss,
        currentPhase: phase1,
        currentPhaseIndex: 1,
      });
      // currentPhaseIndex-1 = 0 → phases[0].hpThreshold = 0.75
      expect(store.nextPhaseThreshold).toBe(0.75);
    });

    it('nextPhaseThreshold：currentPhaseIndex=0 时返回 null', () => {
      const store = useBossStore();
      const phase0 = makePhase({ hpThreshold: 0.75, name: '一阶段' });
      const boss = makeBossInstance({
        phases: [phase0],
      } as Partial<EnemyInstance>);
      store.$patch({
        currentBoss: boss,
        currentPhase: phase0,
        currentPhaseIndex: 0,
      });
      expect(store.nextPhaseThreshold).toBeNull();
    });
  });

  // -------------------- Action: initBossCombat --------------------
  describe('Action: initBossCombat', () => {
    it('无 phases 配置时：设置 boss、开启战斗、不创建 phaseManager、currentPhase 为 null', () => {
      const store = useBossStore();
      const boss = makeBossInstance();

      store.initBossCombat(boss);

      expect(store.currentBoss).toEqual(boss);
      expect(store.isBossCombat).toBe(true);
      expect(store.currentPhase).toBeNull();
      expect(store.currentPhaseIndex).toBe(-1);
      expect(BossPhaseManager).not.toHaveBeenCalled();
    });

    it('有 phases 配置时：创建 phaseManager、定位初始阶段并写入 currentPhase/currentPhaseIndex', () => {
      const store = useBossStore();
      const phase0 = makePhase({ hpThreshold: 0.75, name: '一阶段' });
      const phase1 = makePhase({ hpThreshold: 0.5, name: '二阶段' });
      const boss = makeBossInstance({
        hp: 1000,
        maxHp: 1000,
        phases: [phase0, phase1],
      } as Partial<EnemyInstance>);
      phaseManagerMocks.getCurrentPhase.mockReturnValueOnce({ phase: phase1, changed: true });

      store.initBossCombat(boss);

      expect(BossPhaseManager).toHaveBeenCalledTimes(1);
      expect(phaseManagerMocks.getCurrentPhase).toHaveBeenCalledWith([phase0, phase1], 1000, 1000);
      expect(store.currentPhase).toEqual(phase1);
      expect(store.currentPhaseIndex).toBe(1);
      expect(store.isBossCombat).toBe(true);
    });

    it('有 phases 但 getCurrentPhase 返回 null phase 时：currentPhase 保持 null', () => {
      const store = useBossStore();
      const phase0 = makePhase({ hpThreshold: 0.75, name: '一阶段' });
      const boss = makeBossInstance({
        phases: [phase0],
      } as Partial<EnemyInstance>);
      phaseManagerMocks.getCurrentPhase.mockReturnValueOnce({ phase: null, changed: false });

      store.initBossCombat(boss);

      expect(store.currentPhase).toBeNull();
      expect(store.currentPhaseIndex).toBe(-1);
    });

    it('初始化时清空已触发机制列表', () => {
      const store = useBossStore();
      store.$patch({
        triggeredMechanicsThisTurn: ['enrage' as BossMechanicType],
        allTriggeredMechanics: ['enrage' as BossMechanicType],
      });
      const boss = makeBossInstance();

      store.initBossCombat(boss);

      expect(store.triggeredMechanicsThisTurn).toEqual([]);
      expect(store.allTriggeredMechanics).toEqual([]);
    });
  });

  // -------------------- Action: checkPhaseSwitch --------------------
  describe('Action: checkPhaseSwitch', () => {
    it('未初始化 boss 时返回 false', () => {
      const store = useBossStore();
      expect(store.checkPhaseSwitch()).toBe(false);
    });

    it('未创建 phaseManager（无 phases）时返回 false', () => {
      const store = useBossStore();
      const boss = makeBossInstance(); // 无 phases
      store.initBossCombat(boss);

      expect(store.checkPhaseSwitch()).toBe(false);
    });

    it('发生切换时：调用 applyPhaseStats、更新 currentPhase/currentPhaseIndex、返回 true', () => {
      const store = useBossStore();
      const phase0 = makePhase({ hpThreshold: 0.75, name: '一阶段' });
      const phase1 = makePhase({ hpThreshold: 0.5, name: '二阶段' });
      const boss = makeBossInstance({
        hp: 400,
        maxHp: 1000,
        phases: [phase0, phase1],
      } as Partial<EnemyInstance>);
      // 初始化定位到 phase1
      phaseManagerMocks.getCurrentPhase.mockReturnValueOnce({ phase: phase1, changed: true });
      store.initBossCombat(boss);

      // 切换到 phase0
      phaseManagerMocks.getCurrentPhase.mockReturnValueOnce({ phase: phase0, changed: true });

      const result = store.checkPhaseSwitch();

      expect(result).toBe(true);
      expect(applyPhaseStats).toHaveBeenCalledWith(store.currentBoss, phase0);
      expect(store.currentPhase).toEqual(phase0);
      expect(store.currentPhaseIndex).toBe(0);
    });

    it('未发生切换时返回 false 且不调用 applyPhaseStats', () => {
      const store = useBossStore();
      const phase0 = makePhase({ hpThreshold: 0.75, name: '一阶段' });
      const phase1 = makePhase({ hpThreshold: 0.5, name: '二阶段' });
      const boss = makeBossInstance({
        hp: 400,
        maxHp: 1000,
        phases: [phase0, phase1],
      } as Partial<EnemyInstance>);
      phaseManagerMocks.getCurrentPhase.mockReturnValueOnce({ phase: phase1, changed: true });
      store.initBossCombat(boss);

      phaseManagerMocks.getCurrentPhase.mockReturnValueOnce({ phase: phase1, changed: false });
      vi.mocked(applyPhaseStats).mockClear();

      const result = store.checkPhaseSwitch();

      expect(result).toBe(false);
      expect(applyPhaseStats).not.toHaveBeenCalled();
      expect(store.currentPhase).toEqual(phase1);
    });
  });

  // -------------------- Action: processMechanics --------------------
  describe('Action: processMechanics', () => {
    it('无 boss 或无 phase 时返回空数组且不清空已记录机制', () => {
      const store = useBossStore();
      // 无 boss / phase
      expect(store.processMechanics(1)).toEqual([]);
      expect(store.triggeredMechanicsThisTurn).toEqual([]);
    });

    it('有 boss 和 phase 时：调用 engine、写入 triggeredMechanicsThisTurn、去重累加 allTriggeredMechanics', () => {
      const store = useBossStore();
      const phase = makePhase({ name: '一阶段' });
      const boss = makeBossInstance({ phases: [phase] } as Partial<EnemyInstance>);
      phaseManagerMocks.getCurrentPhase.mockReturnValueOnce({ phase, changed: true });
      store.initBossCombat(boss);

      const triggered: BossMechanicType[] = ['enrage', 'damage_shield'];
      vi.mocked(processBossPhaseMechanics).mockReturnValueOnce([...triggered]);

      const result = store.processMechanics(2);

      expect(processBossPhaseMechanics).toHaveBeenCalledWith(boss, phase, 2);
      expect(result).toEqual(triggered);
      expect(store.triggeredMechanicsThisTurn).toEqual(triggered);
      expect(store.allTriggeredMechanics).toEqual(triggered);
    });

    it('多次触发同一机制时 allTriggeredMechanics 去重', () => {
      const store = useBossStore();
      const phase = makePhase({ name: '一阶段' });
      const boss = makeBossInstance({ phases: [phase] } as Partial<EnemyInstance>);
      phaseManagerMocks.getCurrentPhase.mockReturnValueOnce({ phase, changed: true });
      store.initBossCombat(boss);

      vi.mocked(processBossPhaseMechanics).mockReturnValueOnce(['enrage']);
      store.processMechanics(1);
      vi.mocked(processBossPhaseMechanics).mockReturnValueOnce(['enrage', 'invulnerable']);
      store.processMechanics(2);

      expect(store.allTriggeredMechanics).toEqual(['enrage', 'invulnerable']);
      expect(store.triggeredMechanicsThisTurn).toEqual(['enrage', 'invulnerable']);
    });
  });

  // -------------------- Action: 查询 --------------------
  describe('Action: getCurrentBoss / getNextPhaseThreshold', () => {
    it('getCurrentBoss 返回当前 boss 实例', () => {
      const store = useBossStore();
      const boss = makeBossInstance();
      store.initBossCombat(boss);
      expect(store.getCurrentBoss()).toEqual(boss);
    });

    it('getCurrentBoss 未初始化时返回 null', () => {
      const store = useBossStore();
      expect(store.getCurrentBoss()).toBeNull();
    });

    it('getNextPhaseThreshold 与 getter 一致', () => {
      const store = useBossStore();
      const phase0 = makePhase({ hpThreshold: 0.75, name: '一阶段' });
      const phase1 = makePhase({ hpThreshold: 0.5, name: '二阶段' });
      const boss = makeBossInstance({
        hp: 400,
        maxHp: 1000,
        phases: [phase0, phase1],
      } as Partial<EnemyInstance>);
      store.$patch({
        currentBoss: boss,
        currentPhase: phase1,
        currentPhaseIndex: 1,
      });
      expect(store.getNextPhaseThreshold()).toBe(0.75);
    });
  });

  // -------------------- Action: reset --------------------
  describe('Action: reset', () => {
    it('reset 清空全部状态', () => {
      const store = useBossStore();
      const phase = makePhase({ name: '一阶段' });
      const boss = makeBossInstance({ phases: [phase] } as Partial<EnemyInstance>);
      phaseManagerMocks.getCurrentPhase.mockReturnValueOnce({ phase, changed: true });
      store.initBossCombat(boss);
      vi.mocked(processBossPhaseMechanics).mockReturnValueOnce(['enrage']);
      store.processMechanics(1);

      store.reset();

      expect(store.currentBoss).toBeNull();
      expect(store.currentPhase).toBeNull();
      expect(store.currentPhaseIndex).toBe(-1);
      expect(store.triggeredMechanicsThisTurn).toEqual([]);
      expect(store.allTriggeredMechanics).toEqual([]);
      expect(store.isBossCombat).toBe(false);
    });

    it('reset 后再次 checkPhaseSwitch 返回 false（phaseManager 已销毁）', () => {
      const store = useBossStore();
      const phase = makePhase({ name: '一阶段' });
      const boss = makeBossInstance({ phases: [phase] } as Partial<EnemyInstance>);
      phaseManagerMocks.getCurrentPhase.mockReturnValueOnce({ phase, changed: true });
      store.initBossCombat(boss);

      store.reset();
      // reset 后 currentBoss 为 null，应直接返回 false
      expect(store.checkPhaseSwitch()).toBe(false);
    });
  });
});
