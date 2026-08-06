/**
 * @fileoverview 天赋系统纯函数服务层单元测试（QA-3）
 *
 * 覆盖 service.ts 的 12 个导出函数：
 * 1. meetsRequirements：前置条件校验
 * 2. getTreeSpentPoints：单树已投入点数
 * 3. isTierUnlocked：tier1/2/3 解锁阈值边界
 * 4. canLearnTalent：综合校验 6 个失败分支 + 成功路径
 * 5. createEmptyEffectSummary：空聚合对象形状
 * 6. calculateTalentEffects：8 种 effect 类型累加
 * 7. getTalentStatBonuses：仅 stat_bonus 映射、过滤非基础属性
 * 8. calculateSpentPoints：已使用总点数
 * 9. calculateAvailablePoints：剩余点数 clamp 至 0
 * 10. learnTalent：纯函数返回新对象、不修改原对象
 * 11. resetAllocations：返回空对象
 * 12. createInitialTalentState：按等级计算初始点数
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - mock @/modules/config 的 configCache.getTalentById / getTalentTreesByClassId，
 *    使 canLearnTalent / calculateTalentEffects / getTalentStatBonuses 在受控 fixture 下测试。
 *  - 纯函数无状态、无 DB、无 eventBus 依赖。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Talent, TalentTree, TalentEffect } from '@/modules/character/talents/types';
import { TALENT_POINT_RULES } from '@/modules/character/talents/types';

/** mock configCache，使 service 在受控 fixture 下测试（替代原 @/data/config_class_talents） */
const getTalentByIdMock = vi.fn();
const getTalentTreesByClassIdMock = vi.fn();
vi.mock('@/modules/config', () => ({
  configCache: {
    getTalentById: (id: string) => getTalentByIdMock(id),
    getTalentTreesByClassId: (id: string) => getTalentTreesByClassIdMock(id),
    getSetDefinitions: vi.fn(() => []),
    getPassivesByClassId: vi.fn(() => []),
    loadAll: vi.fn(() => Promise.resolve()),
  },
}));

import {
  meetsRequirements,
  getTreeSpentPoints,
  isTierUnlocked,
  canLearnTalent,
  createEmptyEffectSummary,
  calculateTalentEffects,
  getTalentStatBonuses,
  calculateSpentPoints,
  calculateAvailablePoints,
  learnTalent,
  resetAllocations,
  createInitialTalentState,
} from '@/modules/character/talents/service';
// 从 configCache mock 中取出 spy 引用
const getTalentById = getTalentByIdMock;
const getTalentTreesByClassId = getTalentTreesByClassIdMock;

// ==================== Fixture 工厂 ====================

/** 构造天赋节点 */
function makeTalent(o: Partial<Talent> = {}): Talent {
  return {
    id: 't1',
    name: 'T1',
    description: 'd',
    icon: 'i',
    tier: 1,
    maxRank: 3,
    effects: [],
    ...o,
  } as Talent;
}

/** 构造天赋树 */
function makeTree(o: Partial<TalentTree> = {}): TalentTree {
  return {
    id: 'warrior_arms',
    name: '武器',
    classId: 'warrior' as never,
    icon: 'i',
    description: '武器系',
    talents: [
      makeTalent({ id: 't1', tier: 1 }),
      makeTalent({ id: 't2', tier: 2 }),
      makeTalent({ id: 't3', tier: 3 }),
    ],
    ...o,
  } as TalentTree;
}

/**
 * 构造天赋效果
 *
 * P3-139 修复后：TalentEffect 为可辨识联合类型，每个分支有独立的必填字段。
 * 默认构造 stat_bonus 分支（stat='str'），调用方可通过 o 覆盖 type 与其他字段。
 * 对于 resource_bonus 分支，stat 默认为 'rage_max'（合法 ResourceStatKey）。
 */
function makeEffect(o: Partial<TalentEffect> = {}): TalentEffect {
  // 根据传入的 type 推断默认必填字段（可辨识联合分支的差异化默认值）
  const type = o.type ?? 'stat_bonus';
  const defaultsByType: Record<string, Partial<TalentEffect>> = {
    stat_bonus: { stat: 'str' },
    resource_bonus: { stat: 'rage_max' },
    skill_enhance: { targetSkill: 'fireball' },
    special: {},
    damage_multiplier: {},
    damage_reduction: {},
    crit_bonus: {},
    healing_multiplier: {},
    hp_multiplier: {},
    unlock_pet: { petType: 'cat' },
  };
  return {
    type: 'stat_bonus',
    valuePerRank: 1,
    ...defaultsByType[type],
    ...o,
  } as TalentEffect;
}

// ==================== 测试用例 ====================

describe('talents/service - 天赋纯函数服务层', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------- meetsRequirements --------------------
  describe('meetsRequirements - 前置条件校验', () => {
    it('requires 为空时返回 true', () => {
      const talent = makeTalent({ requires: [] });
      expect(meetsRequirements(talent, {})).toBe(true);
    });

    it('requires 为 undefined 时返回 true', () => {
      const talent = makeTalent({});
      delete talent.requires;
      expect(meetsRequirements(talent, {})).toBe(true);
    });

    it('所有前置天赋已学习（等级 > 0）时返回 true', () => {
      const talent = makeTalent({ requires: ['a', 'b'] });
      expect(meetsRequirements(talent, { a: 1, b: 2 })).toBe(true);
    });

    it('部分前置未学习时返回 false', () => {
      const talent = makeTalent({ requires: ['a', 'b'] });
      expect(meetsRequirements(talent, { a: 1, b: 0 })).toBe(false);
    });

    it('全部前置未学习时返回 false', () => {
      const talent = makeTalent({ requires: ['a', 'b'] });
      expect(meetsRequirements(talent, { a: 0, b: 0 })).toBe(false);
    });

    it('前置 ID 在 allocations 中不存在时返回 false', () => {
      const talent = makeTalent({ requires: ['a'] });
      expect(meetsRequirements(talent, {})).toBe(false);
    });
  });

  // -------------------- getTreeSpentPoints --------------------
  describe('getTreeSpentPoints - 单树已投入点数', () => {
    it('空 allocations 返回 0', () => {
      const tree = makeTree();
      expect(getTreeSpentPoints(tree, {})).toBe(0);
    });

    it('部分天赋已学习时累加等级', () => {
      const tree = makeTree({
        talents: [
          makeTalent({ id: 't1' }),
          makeTalent({ id: 't2' }),
          makeTalent({ id: 't3' }),
        ],
      });
      expect(getTreeSpentPoints(tree, { t1: 2, t3: 1 })).toBe(3);
    });

    it('全部天赋已学习时累加全部等级', () => {
      const tree = makeTree({
        talents: [
          makeTalent({ id: 't1' }),
          makeTalent({ id: 't2' }),
        ],
      });
      expect(getTreeSpentPoints(tree, { t1: 3, t2: 3 })).toBe(6);
    });

    it('allocations 中包含树外天赋 ID 时不计入', () => {
      const tree = makeTree({
        talents: [makeTalent({ id: 't1' })],
      });
      expect(getTreeSpentPoints(tree, { t1: 1, other: 5 })).toBe(1);
    });
  });

  // -------------------- isTierUnlocked --------------------
  describe('isTierUnlocked - 层级解锁', () => {
    it('tier 1 始终解锁（allocations 为空）', () => {
      const tree = makeTree();
      const talent = makeTalent({ tier: 1 });
      expect(isTierUnlocked(talent, tree, {})).toBe(true);
    });

    it('tier 2：已投入点数 < 阈值时未解锁', () => {
      const tree = makeTree({
        talents: [makeTalent({ id: 't1', tier: 1 })],
      });
      const talent = makeTalent({ tier: 2 });
      // tier2Requirement 默认 3，spent=2
      expect(isTierUnlocked(talent, tree, { t1: 2 })).toBe(false);
    });

    it('tier 2：已投入点数 = 阈值时解锁（边界）', () => {
      const tree = makeTree({
        talents: [makeTalent({ id: 't1', tier: 1 })],
      });
      const talent = makeTalent({ tier: 2 });
      expect(isTierUnlocked(talent, tree, { t1: 3 })).toBe(true);
    });

    it('tier 2：已投入点数 > 阈值时解锁', () => {
      const tree = makeTree({
        talents: [makeTalent({ id: 't1', tier: 1 })],
      });
      const talent = makeTalent({ tier: 2 });
      expect(isTierUnlocked(talent, tree, { t1: 4 })).toBe(true);
    });

    it('tier 3：已投入点数 < 阈值时未解锁', () => {
      const tree = makeTree({
        talents: [makeTalent({ id: 't1', tier: 1 })],
      });
      const talent = makeTalent({ tier: 3 });
      // tier3Requirement 默认 6，spent=5
      expect(isTierUnlocked(talent, tree, { t1: 5 })).toBe(false);
    });

    it('tier 3：已投入点数 = 阈值时解锁（边界）', () => {
      const tree = makeTree({
        talents: [makeTalent({ id: 't1', tier: 1 })],
      });
      const talent = makeTalent({ tier: 3 });
      expect(isTierUnlocked(talent, tree, { t1: 6 })).toBe(true);
    });

    it('tier 3：已投入点数 > 阈值时解锁', () => {
      const tree = makeTree({
        talents: [makeTalent({ id: 't1', tier: 1 })],
      });
      const talent = makeTalent({ tier: 3 });
      expect(isTierUnlocked(talent, tree, { t1: 7 })).toBe(true);
    });

    // P3-156 新增：tier 4/5/6 解锁阈值边界测试
    it('tier 4：已投入点数 < 阈值（9）时未解锁', () => {
      const tree = makeTree({
        talents: [makeTalent({ id: 't1', tier: 1 })],
      });
      const talent = makeTalent({ tier: 4 });
      expect(isTierUnlocked(talent, tree, { t1: 8 })).toBe(false);
    });

    it('tier 4：已投入点数 = 阈值（9）时解锁（边界）', () => {
      const tree = makeTree({
        talents: [makeTalent({ id: 't1', tier: 1 })],
      });
      const talent = makeTalent({ tier: 4 });
      expect(isTierUnlocked(talent, tree, { t1: 9 })).toBe(true);
    });

    it('tier 5：已投入点数 < 阈值（10）时未解锁', () => {
      const tree = makeTree({
        talents: [makeTalent({ id: 't1', tier: 1 })],
      });
      const talent = makeTalent({ tier: 5 });
      expect(isTierUnlocked(talent, tree, { t1: 9 })).toBe(false);
    });

    it('tier 5：已投入点数 = 阈值（10）时解锁（边界）', () => {
      const tree = makeTree({
        talents: [makeTalent({ id: 't1', tier: 1 })],
      });
      const talent = makeTalent({ tier: 5 });
      expect(isTierUnlocked(talent, tree, { t1: 10 })).toBe(true);
    });

    it('tier 6：已投入点数 < 阈值（11）时未解锁', () => {
      const tree = makeTree({
        talents: [makeTalent({ id: 't1', tier: 1 })],
      });
      const talent = makeTalent({ tier: 6 });
      expect(isTierUnlocked(talent, tree, { t1: 10 })).toBe(false);
    });

    it('tier 6：已投入点数 = 阈值（11）时解锁（边界）', () => {
      const tree = makeTree({
        talents: [makeTalent({ id: 't1', tier: 1 })],
      });
      const talent = makeTalent({ tier: 6 });
      expect(isTierUnlocked(talent, tree, { t1: 11 })).toBe(true);
    });

    it('未知 tier（非 1/2/3/4/5/6）返回 false', () => {
      const tree = makeTree();
      const talent = makeTalent({ tier: 99 as never });
      expect(isTierUnlocked(talent, tree, { t1: 100 })).toBe(false);
    });
  });

  // -------------------- canLearnTalent --------------------
  describe('canLearnTalent - 综合可学习性校验', () => {
    /** 构造已注册天赋的常见场景 */
    function setupFoundTalent(overrides: Partial<Talent> = {}, treeOverrides: Partial<TalentTree> = {}) {
      const tree = makeTree({
        classId: 'warrior' as never,
        talents: [makeTalent({ id: 't1', tier: 1, maxRank: 3, ...overrides })],
        ...treeOverrides,
      });
      const talent = tree.talents[0];
      vi.mocked(getTalentById).mockReturnValue({ talent, tree });
      return { talent, tree };
    }

    it('天赋不存在时返回 false', () => {
      vi.mocked(getTalentById).mockReturnValue(undefined);
      const result = canLearnTalent('unknown', 'warrior', {}, 5);
      expect(result).toEqual({ canLearn: false, reason: '天赋不存在' });
    });

    it('职业不匹配时返回 false', () => {
      const tree = makeTree({ classId: 'mage' as never, talents: [makeTalent({ id: 't1' })] });
      vi.mocked(getTalentById).mockReturnValue({ talent: tree.talents[0], tree });
      const result = canLearnTalent('t1', 'warrior', {}, 5);
      expect(result).toEqual({ canLearn: false, reason: '该天赋不属于当前职业' });
    });

    it('可用点数 <= 0 时返回 false', () => {
      setupFoundTalent();
      const result = canLearnTalent('t1', 'warrior', {}, 0);
      expect(result).toEqual({ canLearn: false, reason: '没有可用的天赋点数' });
    });

    it('可用点数为负数时返回 false', () => {
      setupFoundTalent();
      const result = canLearnTalent('t1', 'warrior', {}, -1);
      expect(result).toEqual({ canLearn: false, reason: '没有可用的天赋点数' });
    });

    it('当前等级已达 maxRank 时返回 false', () => {
      setupFoundTalent({ maxRank: 3 });
      const result = canLearnTalent('t1', 'warrior', { t1: 3 }, 5);
      expect(result).toEqual({ canLearn: false, reason: '该天赋已达最大等级' });
    });

    it('前置天赋未学习时返回 false', () => {
      // tier 1 + requires，避免 isTierUnlocked 分支干扰
      setupFoundTalent({ tier: 1, requires: ['pre'], maxRank: 3 });
      const result = canLearnTalent('t1', 'warrior', {}, 5);
      expect(result).toEqual({ canLearn: false, reason: '前置天赋未学习' });
    });

    it('层级未解锁时返回 false', () => {
      // tier 2，spent=0 < tier2Requirement
      setupFoundTalent({ tier: 2, maxRank: 3 });
      const result = canLearnTalent('t1', 'warrior', {}, 5);
      expect(result.canLearn).toBe(false);
      expect(result.reason).toContain('需要该系投入更多点数解锁第 2 层');
    });

    it('全部校验通过时返回 canLearn=true', () => {
      setupFoundTalent({ tier: 1, maxRank: 3 });
      const result = canLearnTalent('t1', 'warrior', {}, 5);
      expect(result).toEqual({ canLearn: true, reason: '' });
    });

    it('已投入部分等级但未满 maxRank 时可继续学习', () => {
      setupFoundTalent({ tier: 1, maxRank: 5 });
      const result = canLearnTalent('t1', 'warrior', { t1: 2 }, 5);
      expect(result.canLearn).toBe(true);
    });
  });

  // -------------------- createEmptyEffectSummary --------------------
  describe('createEmptyEffectSummary - 空聚合对象', () => {
    it('返回形状正确的空对象', () => {
      const summary = createEmptyEffectSummary();
      expect(summary).toEqual({
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

    it('每次调用返回独立对象（非单例引用）', () => {
      const a = createEmptyEffectSummary();
      const b = createEmptyEffectSummary();
      a.statBonuses.str = 1;
      a.damageMultiplier = 0.5;
      a.hpMultiplier = 0.15;
      expect(b.statBonuses.str).toBeUndefined();
      expect(b.damageMultiplier).toBe(0);
      expect(b.hpMultiplier).toBe(0);
    });
  });

  // -------------------- calculateTalentEffects --------------------
  describe('calculateTalentEffects - 效果聚合', () => {
    it('无天赋树时返回空聚合对象', () => {
      vi.mocked(getTalentTreesByClassId).mockReturnValue([]);
      const summary = calculateTalentEffects('warrior', {});
      expect(summary).toEqual(createEmptyEffectSummary());
    });

    it('allocations 为空时不累加任何效果', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'stat_bonus', stat: 'str', valuePerRank: 2 })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const summary = calculateTalentEffects('warrior', {});
      expect(summary.statBonuses.str).toBeUndefined();
    });

    it('rank <= 0 的天赋跳过不累加', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'stat_bonus', stat: 'str', valuePerRank: 2 })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const summary = calculateTalentEffects('warrior', { t1: 0 });
      expect(summary.statBonuses.str).toBeUndefined();
    });

    it('stat_bonus 累加 valuePerRank * rank', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'stat_bonus', stat: 'str', valuePerRank: 2 })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const summary = calculateTalentEffects('warrior', { t1: 3 });
      expect(summary.statBonuses.str).toBe(6);
    });

    it('stat_bonus 同属性多天赋累加', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'stat_bonus', stat: 'str', valuePerRank: 2 })],
          }),
          makeTalent({
            id: 't2',
            effects: [makeEffect({ type: 'stat_bonus', stat: 'str', valuePerRank: 1 })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const summary = calculateTalentEffects('warrior', { t1: 2, t2: 1 });
      expect(summary.statBonuses.str).toBe(5);
    });

    it('damage_multiplier 累加', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'damage_multiplier', valuePerRank: 0.1 })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const summary = calculateTalentEffects('warrior', { t1: 3 });
      expect(summary.damageMultiplier).toBeCloseTo(0.3);
    });

    it('damage_reduction 累加', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'damage_reduction', valuePerRank: 0.05 })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const summary = calculateTalentEffects('warrior', { t1: 2 });
      expect(summary.damageReduction).toBeCloseTo(0.1);
    });

    it('crit_bonus 累加', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'crit_bonus', valuePerRank: 0.02 })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const summary = calculateTalentEffects('warrior', { t1: 4 });
      expect(summary.critBonus).toBeCloseTo(0.08);
    });

    it('resource_bonus 累加到 resourceBonuses', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'resource_bonus', stat: 'rage_max', valuePerRank: 5 })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const summary = calculateTalentEffects('warrior', { t1: 2 });
      expect(summary.resourceBonuses.rage_max).toBe(10);
    });

    it('resource_bonus 同资源多天赋累加', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'resource_bonus', stat: 'mana_max', valuePerRank: 0.1 })],
          }),
          makeTalent({
            id: 't2',
            effects: [makeEffect({ type: 'resource_bonus', stat: 'mana_max', valuePerRank: 0.05 })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const summary = calculateTalentEffects('mage', { t1: 3, t2: 2 });
      expect(summary.resourceBonuses.mana_max).toBeCloseTo(0.4);
    });

    it('healing_multiplier 累加（P2-75 修复）', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'healing_multiplier', valuePerRank: 0.08 })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const summary = calculateTalentEffects('warrior', { t1: 3 });
      expect(summary.healingMultiplier).toBeCloseTo(0.24);
    });

    it('hp_multiplier 累加（P3-139 修复，替代原 stat_bonus+hp_max 错误配置）', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'hp_multiplier', valuePerRank: 0.05 })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const summary = calculateTalentEffects('warrior', { t1: 3 });
      expect(summary.hpMultiplier).toBeCloseTo(0.15);
      // 验证不再误写入 statBonuses（原 bug：stat_bonus+hp_max 会污染 statBonuses['hp_max']）
      expect(summary.statBonuses.hp_max).toBeUndefined();
      expect(summary.statBonuses).toEqual({});
    });

    it('hp_multiplier 多天赋累加', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'hp_multiplier', valuePerRank: 0.05 })],
          }),
          makeTalent({
            id: 't2',
            effects: [makeEffect({ type: 'hp_multiplier', valuePerRank: 0.03 })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const summary = calculateTalentEffects('warrior', { t1: 3, t2: 2 });
      expect(summary.hpMultiplier).toBeCloseTo(0.21);
    });

    it('special 效果追加到 specialEffects 列表', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'special', valuePerRank: 1, description: '暴击触发闪电' })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const summary = calculateTalentEffects('warrior', { t1: 2 });
      expect(summary.specialEffects).toEqual([{ description: '暴击触发闪电', value: 2 }]);
    });

    it('special 缺少 description 时使用默认描述', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'special', valuePerRank: 1 })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const summary = calculateTalentEffects('warrior', { t1: 1 });
      expect(summary.specialEffects[0].description).toBe('特殊效果');
    });

    it('skill_enhance 追加到 skillEnhancements', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'skill_enhance', targetSkill: 'fireball', valuePerRank: 0.15 })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const summary = calculateTalentEffects('warrior', { t1: 2 });
      expect(summary.skillEnhancements).toEqual([{ skillId: 'fireball', value: 0.3 }]);
    });

    // P3-156 新增：unlock_pet 效果聚合测试
    it('unlock_pet 收集 petType 到 unlockedPets', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'unlock_pet', petType: 'cat' })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const summary = calculateTalentEffects('hunter', { t1: 1 });
      expect(summary.unlockedPets).toEqual(['cat']);
    });

    it('unlock_pet 多天赋累加不同 petType', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'unlock_pet', petType: 'cat' })],
          }),
          makeTalent({
            id: 't2',
            effects: [makeEffect({ type: 'unlock_pet', petType: 'boar' })],
          }),
          makeTalent({
            id: 't3',
            effects: [makeEffect({ type: 'unlock_pet', petType: 'devilsaur' })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const summary = calculateTalentEffects('hunter', { t1: 1, t2: 1, t3: 1 });
      expect(summary.unlockedPets).toEqual(['cat', 'boar', 'devilsaur']);
    });

    it('unlock_pet 相同 petType 不重复收集（去重）', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'unlock_pet', petType: 'cat' })],
          }),
          makeTalent({
            id: 't2',
            effects: [makeEffect({ type: 'unlock_pet', petType: 'cat' })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const summary = calculateTalentEffects('hunter', { t1: 1, t2: 1 });
      expect(summary.unlockedPets).toEqual(['cat']);
    });

    it('unlock_pet rank=0 时不收集', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'unlock_pet', petType: 'cat' })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const summary = calculateTalentEffects('hunter', { t1: 0 });
      expect(summary.unlockedPets).toEqual([]);
    });

    it('多天赋树效果跨树累加', () => {
      const tree1 = makeTree({
        id: 'arms',
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'stat_bonus', stat: 'str', valuePerRank: 2 })],
          }),
        ],
      });
      const tree2 = makeTree({
        id: 'fury',
        talents: [
          makeTalent({
            id: 't2',
            effects: [makeEffect({ type: 'stat_bonus', stat: 'str', valuePerRank: 1 })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree1, tree2]);
      const summary = calculateTalentEffects('warrior', { t1: 2, t2: 1 });
      expect(summary.statBonuses.str).toBe(5);
    });
  });

  // -------------------- getTalentStatBonuses --------------------
  describe('getTalentStatBonuses - 属性加成映射', () => {
    it('仅返回基础属性 str/dex/con/int/wis/cha', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [
              makeEffect({ type: 'stat_bonus', stat: 'str', valuePerRank: 2 }),
              makeEffect({ type: 'stat_bonus', stat: 'dex', valuePerRank: 1 }),
              makeEffect({ type: 'stat_bonus', stat: 'con', valuePerRank: 3 }),
              makeEffect({ type: 'stat_bonus', stat: 'int', valuePerRank: 1 }),
              makeEffect({ type: 'stat_bonus', stat: 'wis', valuePerRank: 1 }),
              makeEffect({ type: 'stat_bonus', stat: 'cha', valuePerRank: 1 }),
            ],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const bonuses = getTalentStatBonuses('warrior', { t1: 1 });
      expect(bonuses).toEqual({ str: 2, dex: 1, con: 3, int: 1, wis: 1, cha: 1 });
    });

    it('非基础属性（如 armor）不映射到返回值', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'stat_bonus', stat: 'armor', valuePerRank: 5 })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const bonuses = getTalentStatBonuses('warrior', { t1: 1 });
      expect(bonuses).toEqual({});
    });

    it('无 stat_bonus 效果时返回空对象', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'damage_multiplier', valuePerRank: 0.1 })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const bonuses = getTalentStatBonuses('warrior', { t1: 3 });
      expect(bonuses).toEqual({});
    });

    it('allocations 为空时返回空对象', () => {
      const tree = makeTree({
        talents: [
          makeTalent({
            id: 't1',
            effects: [makeEffect({ type: 'stat_bonus', stat: 'str', valuePerRank: 2 })],
          }),
        ],
      });
      vi.mocked(getTalentTreesByClassId).mockReturnValue([tree]);
      const bonuses = getTalentStatBonuses('warrior', {});
      expect(bonuses).toEqual({});
    });
  });

  // -------------------- calculateSpentPoints --------------------
  describe('calculateSpentPoints - 已使用总点数', () => {
    it('空 allocations 返回 0', () => {
      expect(calculateSpentPoints({})).toBe(0);
    });

    it('单天赋已学习返回其等级', () => {
      expect(calculateSpentPoints({ t1: 3 })).toBe(3);
    });

    it('多天赋已学习时累加等级', () => {
      expect(calculateSpentPoints({ t1: 2, t2: 3, t3: 1 })).toBe(6);
    });

    it('包含 0 等级时不影响总和', () => {
      expect(calculateSpentPoints({ t1: 2, t2: 0, t3: 1 })).toBe(3);
    });
  });

  // -------------------- calculateAvailablePoints --------------------
  describe('calculateAvailablePoints - 剩余可用点数', () => {
    it('等级 1、无 allocations：total=floor(1/2)=0，available=0', () => {
      expect(calculateAvailablePoints(1, {})).toBe(0);
    });

    it('等级 2、无 allocations：total=1，available=1', () => {
      expect(calculateAvailablePoints(2, {})).toBe(1);
    });

    it('等级 10、无 allocations：total=5，available=5', () => {
      expect(calculateAvailablePoints(10, {})).toBe(5);
    });

    it('奇数等级向下取整：等级 11 → total=5', () => {
      expect(calculateAvailablePoints(11, {})).toBe(5);
    });

    it('已使用部分点数：total - spent', () => {
      expect(calculateAvailablePoints(10, { t1: 2 })).toBe(3);
    });

    it('spent 超过 total 时 clamp 至 0', () => {
      expect(calculateAvailablePoints(4, { t1: 5 })).toBe(0);
    });

    it('spent 等于 total 时返回 0', () => {
      expect(calculateAvailablePoints(10, { t1: 5 })).toBe(0);
    });
  });

  // -------------------- learnTalent --------------------
  describe('learnTalent - 学习天赋（纯函数）', () => {
    it('未学习时返回等级 1', () => {
      const result = learnTalent({}, 't1');
      expect(result).toEqual({ t1: 1 });
    });

    it('已学习时等级 +1', () => {
      const result = learnTalent({ t1: 2 }, 't1');
      expect(result).toEqual({ t1: 3 });
    });

    it('不修改原 allocations 对象（返回新对象）', () => {
      const original = { t1: 1, t2: 2 };
      const result = learnTalent(original, 't1');
      expect(original).toEqual({ t1: 1, t2: 2 });
      expect(result).not.toBe(original);
    });

    it('学习新天赋时保留其他天赋等级', () => {
      const result = learnTalent({ t1: 1, t2: 2 }, 't3');
      expect(result).toEqual({ t1: 1, t2: 2, t3: 1 });
    });
  });

  // -------------------- resetAllocations --------------------
  describe('resetAllocations - 重置分配', () => {
    it('返回空对象', () => {
      expect(resetAllocations()).toEqual({});
    });

    it('每次调用返回新的空对象', () => {
      const a = resetAllocations();
      const b = resetAllocations();
      expect(a).not.toBe(b);
      a.t1 = 1;
      expect(b.t1).toBeUndefined();
    });
  });

  // -------------------- createInitialTalentState --------------------
  describe('createInitialTalentState - 初始天赋状态', () => {
    it('等级 1：totalPoints=0、availablePoints=0、allocations 为空', () => {
      const state = createInitialTalentState(1);
      expect(state).toEqual({
        allocations: {},
        totalPoints: 0,
        availablePoints: 0,
      });
    });

    it('等级 2：totalPoints=1、availablePoints=1', () => {
      const state = createInitialTalentState(2);
      expect(state.totalPoints).toBe(1);
      expect(state.availablePoints).toBe(1);
    });

    it('等级 10：totalPoints=5、availablePoints=5', () => {
      const state = createInitialTalentState(10);
      expect(state.totalPoints).toBe(5);
      expect(state.availablePoints).toBe(5);
    });

    it('奇数等级向下取整', () => {
      const state = createInitialTalentState(11);
      expect(state.totalPoints).toBe(5);
    });

    it('allocations 始终为空对象且独立', () => {
      const state = createInitialTalentState(10);
      expect(state.allocations).toEqual({});
      state.allocations.t1 = 1;
      const state2 = createInitialTalentState(10);
      expect(state2.allocations.t1).toBeUndefined();
    });
  });

  // -------------------- 配置规则一致性（回归保护） --------------------
  describe('TALENT_POINT_RULES 规则常量', () => {
    it('pointsPerLevel 为 2', () => {
      expect(TALENT_POINT_RULES.pointsPerLevel).toBe(2);
    });

    it('tier2Requirement 为 3', () => {
      expect(TALENT_POINT_RULES.tier2Requirement).toBe(3);
    });

    it('tier3Requirement 为 6', () => {
      expect(TALENT_POINT_RULES.tier3Requirement).toBe(6);
    });

    // P3-156 新增：tier4/5/6 阈值验证
    it('tier4Requirement 为 9', () => {
      expect(TALENT_POINT_RULES.tier4Requirement).toBe(9);
    });

    it('tier5Requirement 为 10', () => {
      expect(TALENT_POINT_RULES.tier5Requirement).toBe(10);
    });

    it('tier6Requirement 为 11', () => {
      expect(TALENT_POINT_RULES.tier6Requirement).toBe(11);
    });
  });
});
