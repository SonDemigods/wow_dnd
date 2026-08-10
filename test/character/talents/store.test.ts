/**
 * @fileoverview 天赋系统 Pinia Store 单元测试
 *
 * 覆盖 useTalentStore 的：
 * 1. State 初始值（allocations/currentClassId/currentLevel）
 * 2. Getters：spentPoints / totalPoints / availablePoints / talentTrees / effectSummary / statBonuses
 * 3. Actions：
 *    - initialize（设置 classId/level/恢复存档）
 *    - updateLevel（影响 totalPoints）
 *    - learn（学习成功 / 不可学返回 false / 无职业返回 false）
 *    - canLearn（委托 service）
 *    - resetAllAllocations（清空 allocations）
 *    - getTalentRank / getTreeSpentPoints
 *    - reset 清空全部状态
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - talent service 全量 mock（canLearnTalent/learnTalent/calculateTalentEffects/
 *    calculateSpentPoints/resetAllocations/getTalentStatBonuses）。
 *  - @/data/config_class_talents 的 getTalentTreesByClassId 全量 mock，
 *    用于 talentTrees getter 与 getTreeSpentPoints 的隔离。
 *  - 纯内存状态，无 DB / eventBus 依赖。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestPinia } from '../../utils/setup';
import type { TalentTree } from '@/modules/character/talents/types';

// P3-156 M4-2：mock 宠物 Store，使用 hoisted 确保单例引用可断言
const { mockPetStore } = vi.hoisted(() => ({
  mockPetStore: { unlockPet: vi.fn() },
}));

/** mock 天赋 service 纯函数层 */
vi.mock('@/modules/character/talents/service', () => ({
  canLearnTalent: vi.fn(),
  learnTalent: vi.fn(),
  calculateTalentEffects: vi.fn(),
  calculateSpentPoints: vi.fn(),
  resetAllocations: vi.fn(),
  getTalentStatBonuses: vi.fn(),
}));

/** mock 配置缓存层（替代原 @/data/config_class_talents mock） */
const getTalentTreesByClassIdMock = vi.fn<(classId: string) => TalentTree[]>();
const getTalentByIdMock = vi.fn<(talentId: string) => { talent: TalentTree['talents'][number]; tree: TalentTree } | undefined>();
vi.mock('@/modules/config', () => ({
  configCache: {
    getTalentTreesByClassId: (classId: string) => getTalentTreesByClassIdMock(classId),
    getTalentById: (talentId: string) => getTalentByIdMock(talentId),
    loadTalentTrees: vi.fn(() => Promise.resolve()),
    loadAll: vi.fn(() => Promise.resolve()),
  },
}));

/** mock 宠物 Store（P3-156 M4-2：learn 方法会调用 petStore.unlockPet） */
vi.mock('@/modules/combat/pets', () => ({
  usePetStore: vi.fn(() => mockPetStore),
}));

/** mock 角色 Store（P9-006/007/026：initialize/learn 会调用 applyBonus/removeBonus/persistCharacter） */
const { mockCharacterStore } = vi.hoisted(() => ({
  mockCharacterStore: {
    applyBonus: vi.fn(() => Promise.resolve()),
    removeBonus: vi.fn(() => Promise.resolve()),
    persistCharacter: vi.fn(() => Promise.resolve()),
    getCharacterData: vi.fn(() => ({ name: 'test', classId: 'warrior', level: 10, talentAllocations: {} })),
    character: null as unknown,
  },
}));
vi.mock('@/modules/character/store', () => ({
  useCharacterStore: vi.fn(() => mockCharacterStore),
}));

/** 从 mock 中取出 spy 引用，便于断言 */
import {
  canLearnTalent,
  learnTalent,
  calculateTalentEffects,
  calculateSpentPoints,
  resetAllocations,
  getTalentStatBonuses,
} from '@/modules/character/talents/service';
import { useTalentStore } from '@/modules/character/talents/store';

// 从 mock 中取出 spy 引用
const getTalentTreesByClassId = getTalentTreesByClassIdMock;
const getTalentById = getTalentByIdMock;

// ==================== 测试数据构造 helper ====================

function makeTree(o: Partial<TalentTree> = {}): TalentTree {
  return {
    id: 'warrior_arms',
    name: '武器',
    classId: 'warrior' as never,
    icon: 'i',
    description: '武器系',
    talents: [
      { id: 't1', name: 'T1', description: 'd', icon: 'i', tier: 1, maxRank: 3, effects: [] },
      { id: 't2', name: 'T2', description: 'd', icon: 'i', tier: 2, maxRank: 3, effects: [] },
    ],
    ...o,
  } as TalentTree;
}

// ==================== 测试用例 ====================

describe('useTalentStore - 天赋 Store', () => {
  beforeEach(() => {
    createTestPinia();
    vi.clearAllMocks();
  });

  // -------------------- State 初始值 --------------------
  describe('State 初始值', () => {
    it('allocations 初始为空对象', () => {
      const store = useTalentStore();
      expect(store.allocations).toEqual({});
    });

    it('currentClassId 初始为空字符串', () => {
      const store = useTalentStore();
      expect(store.currentClassId).toBe('');
    });

    it('currentLevel 初始为 1', () => {
      const store = useTalentStore();
      expect(store.currentLevel).toBe(1);
    });
  });

  // -------------------- Getters --------------------
  describe('Getters', () => {
    it('spentPoints：委托 calculateSpentPoints 计算', () => {
      vi.mocked(calculateSpentPoints).mockReturnValueOnce(3);
      const store = useTalentStore();
      store.$patch({ allocations: { t1: 1, t2: 2 } });
      expect(store.spentPoints).toBe(3);
      expect(calculateSpentPoints).toHaveBeenCalledWith({ t1: 1, t2: 2 });
    });

    it('totalPoints：等级 < 10 时为 0', () => {
      const store = useTalentStore();
      store.$patch({ currentLevel: 9 });
      expect(store.totalPoints).toBe(0);
    });

    it('totalPoints：等级 10 = 2，等级 20 = 22', () => {
      const store = useTalentStore();
      store.$patch({ currentLevel: 10 });
      expect(store.totalPoints).toBe(2);
      store.$patch({ currentLevel: 20 });
      expect(store.totalPoints).toBe(22);
    });

    it('availablePoints：totalPoints - spentPoints，最小为 0', () => {
      vi.mocked(calculateSpentPoints).mockReturnValueOnce(1);
      const store = useTalentStore();
      store.$patch({ currentLevel: 10 }); // totalPoints = 2
      expect(store.availablePoints).toBe(1);
    });

    it('availablePoints：spent 超过 total 时 clamp 为 0', () => {
      vi.mocked(calculateSpentPoints).mockReturnValueOnce(10);
      const store = useTalentStore();
      store.$patch({ currentLevel: 4 }); // totalPoints = 0
      expect(store.availablePoints).toBe(0);
    });

    it('talentTrees：无 classId 时返回空数组', () => {
      const store = useTalentStore();
      expect(store.talentTrees).toEqual([]);
      expect(getTalentTreesByClassId).not.toHaveBeenCalled();
    });

    it('talentTrees：有 classId 时委托 getTalentTreesByClassId', () => {
      const trees = [makeTree()];
      vi.mocked(getTalentTreesByClassId).mockReturnValue(trees);
      const store = useTalentStore();
      store.$patch({ currentClassId: 'warrior' });
      expect(store.talentTrees).toEqual(trees);
      expect(getTalentTreesByClassId).toHaveBeenCalledWith('warrior');
    });

    it('effectSummary：无 classId 时返回空聚合对象', () => {
      const store = useTalentStore();
      expect(store.effectSummary).toEqual({
        statBonuses: {},
        damageMultiplier: 0,
        damageReduction: 0,
        critBonus: 0,
        resourceBonuses: {},
        healingMultiplier: 0,
        hpMultiplier: 0,
        specialEffects: [],
        skillEnhancements: [],
        unlockedPets: [],
      });
    });

    it('effectSummary：有 classId 时委托 calculateTalentEffects', () => {
      const summary = { statBonuses: { str: 2 }, damageMultiplier: 0.1, damageReduction: 0,
        critBonus: 0, resourceBonuses: {}, healingMultiplier: 0, hpMultiplier: 0, specialEffects: [], skillEnhancements: [], unlockedPets: [] };
      vi.mocked(calculateTalentEffects).mockReturnValue(summary);
      const store = useTalentStore();
      store.$patch({ currentClassId: 'warrior', allocations: { t1: 1 } });
      expect(store.effectSummary).toEqual(summary);
      expect(calculateTalentEffects).toHaveBeenCalledWith('warrior', { t1: 1 });
    });

    it('statBonuses：无 classId 时返回空对象', () => {
      const store = useTalentStore();
      expect(store.statBonuses).toEqual({});
    });

    it('statBonuses：有 classId 时委托 getTalentStatBonuses', () => {
      vi.mocked(getTalentStatBonuses).mockReturnValue({ str: 2 });
      const store = useTalentStore();
      store.$patch({ currentClassId: 'warrior' });
      expect(store.statBonuses).toEqual({ str: 2 });
      expect(getTalentStatBonuses).toHaveBeenCalledWith('warrior', store.allocations);
    });
  });

  // -------------------- Action: initialize --------------------
  describe('Action: initialize', () => {
    it('设置 classId/level，未提供存档时 allocations 为空对象', async () => {
      const store = useTalentStore();
      await store.initialize('warrior', 10);
      expect(store.currentClassId).toBe('warrior');
      expect(store.currentLevel).toBe(10);
      expect(store.allocations).toEqual({});
    });

    it('提供 savedAllocations 时拷贝恢复', async () => {
      const store = useTalentStore();
      const saved = { t1: 2, t2: 1 };
      await store.initialize('warrior', 10, saved);
      expect(store.allocations).toEqual(saved);
      // 应为拷贝，修改 store 不影响原对象
      store.$patch({ allocations: { t1: 3 } });
      expect(saved.t1).toBe(2);
    });

    // P9-006/007 修复：initialize 不应调用 applyBonus/removeBonus（bonusStats 已从 DB 恢复），
    // 仅对齐 diff 基线，防止重复施加
    it('initialize 不重复 applyBonus（对齐基线）', async () => {
      vi.mocked(getTalentStatBonuses).mockReturnValue({ str: 5, con: 3 });
      const store = useTalentStore();
      await store.initialize('warrior', 10);
      // initialize 后不应调用 applyBonus 或 removeBonus
      expect(mockCharacterStore.applyBonus).not.toHaveBeenCalled();
      expect(mockCharacterStore.removeBonus).not.toHaveBeenCalled();
    });
  });

  // -------------------- Action: learn 持久化 --------------------
  describe('Action: learn 持久化（P9-026）', () => {
    it('learn 后调用 persistCharacter 落盘', async () => {
      vi.mocked(canLearnTalent).mockReturnValue({ canLearn: true, reason: '' });
      vi.mocked(learnTalent).mockReturnValue({ t1: 1 });
      vi.mocked(calculateSpentPoints).mockReturnValueOnce(0);
      vi.mocked(getTalentStatBonuses).mockReturnValue({});
      const store = useTalentStore();
      await store.initialize('warrior', 10);

      // learn 应返回 true
      const result = store.learn('t1');
      expect(result).toBe(true);

      // P9-026 修复：syncAllocationsToCharacter 应调用 persistCharacter
      expect(mockCharacterStore.persistCharacter).toHaveBeenCalled();
    });
  });

  // -------------------- Action: updateLevel --------------------
  describe('Action: updateLevel', () => {
    it('更新等级并影响 totalPoints', async () => {
      const store = useTalentStore();
      await store.initialize('warrior', 9);
      expect(store.totalPoints).toBe(0);
      store.updateLevel(10);
      expect(store.currentLevel).toBe(10);
      expect(store.totalPoints).toBe(2);
    });
  });

  // -------------------- Action: learn --------------------
  describe('Action: learn', () => {
    it('无 classId 时返回 false 且不调用 service', () => {
      const store = useTalentStore();
      expect(store.learn('t1')).toBe(false);
      expect(canLearnTalent).not.toHaveBeenCalled();
    });

    it('canLearnTalent 返回 canLearn=false 时返回 false 且不更新 allocations', async () => {
      vi.mocked(canLearnTalent).mockReturnValue({ canLearn: false, reason: '没有可用点数' });
      const store = useTalentStore();
      await store.initialize('warrior', 10);
      store.$patch({ allocations: { t1: 1 } });

      expect(store.learn('t2')).toBe(false);
      expect(learnTalent).not.toHaveBeenCalled();
      expect(store.allocations).toEqual({ t1: 1 });
    });

    it('canLearnTalent 返回 canLearn=true 时调用 learnTalent、返回 true、更新 allocations', async () => {
      vi.mocked(canLearnTalent).mockReturnValue({ canLearn: true, reason: '' });
      vi.mocked(learnTalent).mockReturnValue({ t1: 1 });
      vi.mocked(calculateSpentPoints).mockReturnValueOnce(0);
      const store = useTalentStore();
      await store.initialize('warrior', 10);

      expect(store.learn('t1')).toBe(true);
      expect(canLearnTalent).toHaveBeenCalledWith('t1', 'warrior', {}, 2);
      expect(learnTalent).toHaveBeenCalledWith({}, 't1');
      expect(store.allocations).toEqual({ t1: 1 });
    });

    // P3-156 M4-2：unlock_pet 效果接入测试
    it('学习含 unlock_pet 效果的天赋时调用 petStore.unlockPet', async () => {
      vi.mocked(canLearnTalent).mockReturnValue({ canLearn: true, reason: '' });
      vi.mocked(learnTalent).mockReturnValue({ hunter_beast_t4: 1 });
      vi.mocked(calculateSpentPoints).mockReturnValueOnce(0);
      vi.mocked(getTalentById).mockReturnValue({
        talent: {
          id: 'hunter_beast_t4', name: '驯服猎豹', description: '解锁猎豹',
          icon: 'game-icons:cat', tier: 4, maxRank: 1, requires: ['hunter_beast_t3'],
          effects: [{ type: 'unlock_pet', petType: 'cat' }]
        } as never,
        tree: {} as never
      });

      const store = useTalentStore();
      await store.initialize('hunter', 20);

      // P3-172：通过回调注入替代直接 import usePetStore
      store.setPetCallbacks(mockPetStore.unlockPet, vi.fn());

      expect(store.learn('hunter_beast_t4')).toBe(true);
      expect(mockPetStore.unlockPet).toHaveBeenCalledWith('cat');
    });

    it('学习不含 unlock_pet 效果的天赋时不调用 petStore.unlockPet', async () => {
      vi.mocked(canLearnTalent).mockReturnValue({ canLearn: true, reason: '' });
      vi.mocked(learnTalent).mockReturnValue({ hunter_beast_t1: 1 });
      vi.mocked(calculateSpentPoints).mockReturnValueOnce(0);
      vi.mocked(getTalentById).mockReturnValue({
        talent: {
          id: 'hunter_beast_t1', name: '野兽训练', description: '提升敏捷',
          icon: 'game-icons:paw', tier: 1, maxRank: 3,
          effects: [{ type: 'stat_bonus', stat: 'dex', valuePerRank: 3 }]
        } as never,
        tree: {} as never
      });

      const store = useTalentStore();
      await store.initialize('hunter', 10);

      expect(store.learn('hunter_beast_t1')).toBe(true);
      expect(mockPetStore.unlockPet).not.toHaveBeenCalled();
    });
  });

  // -------------------- Action: canLearn --------------------
  describe('Action: canLearn', () => {
    it('无 classId 时返回 false', () => {
      const store = useTalentStore();
      expect(store.canLearn('t1')).toBe(false);
      expect(canLearnTalent).not.toHaveBeenCalled();
    });

    it('委托 canLearnTalent 返回 canLearn 字段', async () => {
      vi.mocked(canLearnTalent).mockReturnValue({ canLearn: true, reason: '' });
      const store = useTalentStore();
      await store.initialize('warrior', 10);
      expect(store.canLearn('t1')).toBe(true);
    });

    it('canLearnTalent 返回 false 时 canLearn 返回 false', async () => {
      vi.mocked(canLearnTalent).mockReturnValue({ canLearn: false, reason: '已达最大等级' });
      const store = useTalentStore();
      await store.initialize('warrior', 10);
      expect(store.canLearn('t1')).toBe(false);
    });
  });

  // -------------------- Action: resetAllAllocations --------------------
  describe('Action: resetAllAllocations', () => {
    it('委托 resetAllocations 清空 allocations', () => {
      vi.mocked(resetAllocations).mockReturnValue({});
      const store = useTalentStore();
      store.$patch({ allocations: { t1: 2, t2: 1 } });

      store.resetAllAllocations();

      expect(resetAllocations).toHaveBeenCalledTimes(1);
      expect(store.allocations).toEqual({});
    });
  });

  // -------------------- Action: getTalentRank --------------------
  describe('Action: getTalentRank', () => {
    it('已学习天赋返回当前等级', () => {
      const store = useTalentStore();
      store.$patch({ allocations: { t1: 2 } });
      expect(store.getTalentRank('t1')).toBe(2);
    });

    it('未学习天赋返回 0', () => {
      const store = useTalentStore();
      expect(store.getTalentRank('unknown')).toBe(0);
    });
  });

  // -------------------- Action: getTreeSpentPoints --------------------
  describe('Action: getTreeSpentPoints', () => {
    it('treeId 不存在时返回 0', async () => {
      vi.mocked(getTalentTreesByClassId).mockReturnValue([makeTree({ id: 'arms' })]);
      const store = useTalentStore();
      await store.initialize('warrior', 10);
      expect(store.getTreeSpentPoints('fury')).toBe(0);
    });

    it('累加该树下所有已学习天赋的等级', async () => {
      const tree = makeTree({
        id: 'arms',
        talents: [
          { id: 't1', name: 'T1', description: 'd', icon: 'i', tier: 1, maxRank: 3, effects: [] },
          { id: 't2', name: 'T2', description: 'd', icon: 'i', tier: 2, maxRank: 3, effects: [] },
          { id: 't3', name: 'T3', description: 'd', icon: 'i', tier: 3, maxRank: 3, effects: [] },
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const store = useTalentStore();
      await store.initialize('warrior', 10);
      store.$patch({ allocations: { t1: 2, t3: 1 } }); // t2 未学习

      expect(store.getTreeSpentPoints('arms')).toBe(3);
    });
  });

  // -------------------- Action: reset --------------------
  describe('Action: reset', () => {
    it('清空 allocations/classId/level', async () => {
      const store = useTalentStore();
      await store.initialize('warrior', 10, { t1: 2 });

      store.reset();

      expect(store.allocations).toEqual({});
      expect(store.currentClassId).toBe('');
      expect(store.currentLevel).toBe(1);
    });
  });
});
