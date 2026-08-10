/**
 * @fileoverview 任务模块 service 纯函数单元测试
 *
 * 覆盖范围：
 * 1. canAcceptQuest —— 接取条件判定（含 BIZ-19 前置任务检查）
 * 2. checkPrerequisiteQuests —— 前置任务完成状态校验
 * 3. checkQuestProgress —— 击杀/收集事件进度更新
 * 4. calculateQuestRewards —— 奖励计算
 * 5. generateQuestInstance —— 任务实例生成
 * 6. getDefaultQuests —— 默认任务模板
 */
import { describe, it, expect } from 'vitest';
import {
  canAcceptQuest,
  checkPrerequisiteQuests,
  checkQuestProgress,
  calculateQuestRewards,
  generateQuestInstance,
  getDefaultQuests,
} from '@/modules/quest/service';
import type { QuestDefinition, QuestInstance } from '@/modules/quest/types';

/** 构造测试用任务定义 */
function makeDefinition(overrides: Partial<QuestDefinition> = {}): QuestDefinition {
  return {
    id: 'quest_test',
    title: '测试任务',
    description: '用于单元测试的任务',
    type: 'kill',
    objectives: [
      { key: 'kill_goblin', type: 'kill', target: 5, enemyId: 'goblin' },
    ],
    levelRequirement: 1,
    xpReward: 100,
    goldReward: 50,
    boardId: 'board_1',
    ...overrides,
  };
}

/** 构造测试用任务实例 */
function makeInstance(overrides: Partial<QuestInstance> = {}): QuestInstance {
  return {
    questId: 'quest_test',
    status: 'in_progress',
    progress: [{ objectiveKey: 'kill_goblin', current: 0, target: 5 }],
    acceptedAt: 1000,
    ...overrides,
  };
}

describe('canAcceptQuest 接取条件判定', () => {
  describe('等级校验', () => {
    it('等级不足时拒绝接取', () => {
      const def = makeDefinition({ levelRequirement: 10 });
      expect(canAcceptQuest(def, 5, [])).toBe(false);
    });

    it('等级刚好满足时允许接取', () => {
      const def = makeDefinition({ levelRequirement: 10 });
      expect(canAcceptQuest(def, 10, [])).toBe(true);
    });

    it('等级超出要求时允许接取', () => {
      const def = makeDefinition({ levelRequirement: 1 });
      expect(canAcceptQuest(def, 99, [])).toBe(true);
    });
  });

  describe('已存在实例检查', () => {
    it('已有 in_progress 实例时拒绝接取', () => {
      const def = makeDefinition();
      const existing = makeInstance({ status: 'in_progress' });
      expect(canAcceptQuest(def, 10, [existing])).toBe(false);
    });

    it('已有 completed 实例时拒绝接取', () => {
      const def = makeDefinition();
      const existing = makeInstance({ status: 'completed' });
      expect(canAcceptQuest(def, 10, [existing])).toBe(false);
    });

    it('已有 turned_in 实例时拒绝接取', () => {
      const def = makeDefinition();
      const existing = makeInstance({ status: 'turned_in' });
      expect(canAcceptQuest(def, 10, [existing])).toBe(false);
    });

    it('已放弃的任务可以重新接取（无前置任务）', () => {
      const def = makeDefinition();
      const existing = makeInstance({ status: 'abandoned' });
      expect(canAcceptQuest(def, 10, [existing])).toBe(true);
    });
  });

  describe('前置任务检查（BIZ-19）', () => {
    it('无前置任务时允许接取', () => {
      const def = makeDefinition();
      expect(canAcceptQuest(def, 10, [])).toBe(true);
    });

    it('前置任务列表为空时允许接取', () => {
      const def = makeDefinition({ prerequisiteQuests: [] });
      expect(canAcceptQuest(def, 10, [])).toBe(true);
    });

    it('前置任务全部 completed 时允许接取', () => {
      const def = makeDefinition({ prerequisiteQuests: ['quest_pre1', 'quest_pre2'] });
      const activeQuests: QuestInstance[] = [
        { questId: 'quest_pre1', status: 'completed', progress: [], acceptedAt: 1 },
        { questId: 'quest_pre2', status: 'completed', progress: [], acceptedAt: 2 },
      ];
      expect(canAcceptQuest(def, 10, activeQuests)).toBe(true);
    });

    it('前置任务全部 turned_in 时允许接取', () => {
      const def = makeDefinition({ prerequisiteQuests: ['quest_pre1'] });
      const activeQuests: QuestInstance[] = [
        { questId: 'quest_pre1', status: 'turned_in', progress: [], acceptedAt: 1 },
      ];
      expect(canAcceptQuest(def, 10, activeQuests)).toBe(true);
    });

    it('前置任务存在未完成项时拒绝接取', () => {
      const def = makeDefinition({ prerequisiteQuests: ['quest_pre1', 'quest_pre2'] });
      const activeQuests: QuestInstance[] = [
        { questId: 'quest_pre1', status: 'completed', progress: [], acceptedAt: 1 },
        { questId: 'quest_pre2', status: 'in_progress', progress: [], acceptedAt: 2 },
      ];
      expect(canAcceptQuest(def, 10, activeQuests)).toBe(false);
    });

    it('前置任务不存在实例时拒绝接取', () => {
      const def = makeDefinition({ prerequisiteQuests: ['quest_pre1'] });
      expect(canAcceptQuest(def, 10, [])).toBe(false);
    });

    it('已放弃任务重新接取时仍需满足前置任务', () => {
      const def = makeDefinition({
        id: 'quest_test',
        prerequisiteQuests: ['quest_pre1'],
      });
      const existing = makeInstance({ status: 'abandoned' });
      const activeQuests: QuestInstance[] = [
        existing,
        { questId: 'quest_pre1', status: 'in_progress', progress: [], acceptedAt: 1 },
      ];
      expect(canAcceptQuest(def, 10, activeQuests)).toBe(false);
    });

    it('已放弃任务重新接取且前置任务已完成时允许', () => {
      const def = makeDefinition({
        id: 'quest_test',
        prerequisiteQuests: ['quest_pre1'],
      });
      const existing = makeInstance({ status: 'abandoned' });
      const activeQuests: QuestInstance[] = [
        existing,
        { questId: 'quest_pre1', status: 'completed', progress: [], acceptedAt: 1 },
      ];
      expect(canAcceptQuest(def, 10, activeQuests)).toBe(true);
    });
  });
});

describe('checkPrerequisiteQuests 前置任务校验', () => {
  it('无 prerequisiteQuests 字段时返回 true', () => {
    const def = makeDefinition();
    expect(checkPrerequisiteQuests(def, [])).toBe(true);
  });

  it('prerequisiteQuests 为空数组时返回 true', () => {
    const def = makeDefinition({ prerequisiteQuests: [] });
    expect(checkPrerequisiteQuests(def, [])).toBe(true);
  });

  it('所有前置任务 completed 时返回 true', () => {
    const def = makeDefinition({ prerequisiteQuests: ['q1', 'q2'] });
    const active: QuestInstance[] = [
      { questId: 'q1', status: 'completed', progress: [], acceptedAt: 1 },
      { questId: 'q2', status: 'completed', progress: [], acceptedAt: 2 },
    ];
    expect(checkPrerequisiteQuests(def, active)).toBe(true);
  });

  it('前置任务 turned_in 也视为完成', () => {
    const def = makeDefinition({ prerequisiteQuests: ['q1'] });
    const active: QuestInstance[] = [
      { questId: 'q1', status: 'turned_in', progress: [], acceptedAt: 1 },
    ];
    expect(checkPrerequisiteQuests(def, active)).toBe(true);
  });

  it('任一前置任务未完成时返回 false', () => {
    const def = makeDefinition({ prerequisiteQuests: ['q1', 'q2'] });
    const active: QuestInstance[] = [
      { questId: 'q1', status: 'completed', progress: [], acceptedAt: 1 },
      { questId: 'q2', status: 'abandoned', progress: [], acceptedAt: 2 },
    ];
    expect(checkPrerequisiteQuests(def, active)).toBe(false);
  });

  it('前置任务不存在实例时返回 false', () => {
    const def = makeDefinition({ prerequisiteQuests: ['q1'] });
    expect(checkPrerequisiteQuests(def, [])).toBe(false);
  });

  it('abandoned 状态视为未完成', () => {
    const def = makeDefinition({ prerequisiteQuests: ['q1'] });
    const active: QuestInstance[] = [
      { questId: 'q1', status: 'abandoned', progress: [], acceptedAt: 1 },
    ];
    expect(checkPrerequisiteQuests(def, active)).toBe(false);
  });
});

describe('checkQuestProgress 进度更新', () => {
  it('击杀匹配的目标时累加进度', () => {
    const def = makeDefinition({
      objectives: [{ key: 'kill_goblin', type: 'kill', target: 5, enemyId: 'goblin' }],
    });
    const inst = makeInstance({
      progress: [{ objectiveKey: 'kill_goblin', current: 1, target: 5 }],
    });
    const result = checkQuestProgress(inst, def, { enemyId: 'goblin', amount: 1 });
    expect(result).not.toBeNull();
    expect(result!.progress[0].current).toBe(2);
  });

  it('收集匹配的目标时累加进度', () => {
    const def = makeDefinition({
      type: 'collect',
      objectives: [{ key: 'collect_herb', type: 'collect', target: 3, itemId: 'herb' }],
    });
    const inst: QuestInstance = {
      questId: 'quest_test',
      status: 'in_progress',
      progress: [{ objectiveKey: 'collect_herb', current: 0, target: 3 }],
      acceptedAt: 1,
    };
    const result = checkQuestProgress(inst, def, { itemId: 'herb', amount: 2 });
    expect(result).not.toBeNull();
    expect(result!.progress[0].current).toBe(2);
  });

  it('无匹配目标时返回 null', () => {
    const def = makeDefinition({
      objectives: [{ key: 'kill_goblin', type: 'kill', target: 5, enemyId: 'goblin' }],
    });
    const inst = makeInstance();
    const result = checkQuestProgress(inst, def, { enemyId: 'wolf' });
    expect(result).toBeNull();
  });

  it('目标匹配但进度数组中无对应 objectiveKey 时不更新进度', () => {
    // 击杀 goblin 匹配到目标，但 progress 中没有 objectiveKey='kill_goblin' 的条目
    const def = makeDefinition({
      objectives: [{ key: 'kill_goblin', type: 'kill', target: 5, enemyId: 'goblin' }],
    });
    const inst = makeInstance({
      progress: [{ objectiveKey: 'different_key', current: 0, target: 5 }],
    });
    const result = checkQuestProgress(inst, def, { enemyId: 'goblin' });
    // 匹配到目标但无进度条目，matched 仍为 false，返回 null
    expect(result).toBeNull();
  });

  it('进度不超过 target 上限', () => {
    const def = makeDefinition({
      objectives: [{ key: 'kill_goblin', type: 'kill', target: 5, enemyId: 'goblin' }],
    });
    const inst = makeInstance({
      progress: [{ objectiveKey: 'kill_goblin', current: 4, target: 5 }],
    });
    const result = checkQuestProgress(inst, def, { enemyId: 'goblin', amount: 10 });
    expect(result!.progress[0].current).toBe(5);
  });

  it('所有目标达成时 isComplete=true', () => {
    const def = makeDefinition({
      objectives: [{ key: 'kill_goblin', type: 'kill', target: 5, enemyId: 'goblin' }],
    });
    const inst = makeInstance({
      progress: [{ objectiveKey: 'kill_goblin', current: 4, target: 5 }],
    });
    const result = checkQuestProgress(inst, def, { enemyId: 'goblin' });
    expect(result!.isComplete).toBe(true);
  });

  it('未全部达成时 isComplete=false', () => {
    const def = makeDefinition({
      objectives: [
        { key: 'kill_goblin', type: 'kill', target: 5, enemyId: 'goblin' },
        { key: 'kill_wolf', type: 'kill', target: 3, enemyId: 'wolf' },
      ],
    });
    const inst = makeInstance({
      progress: [
        { objectiveKey: 'kill_goblin', current: 5, target: 5 },
        { objectiveKey: 'kill_wolf', current: 1, target: 3 },
      ],
    });
    const result = checkQuestProgress(inst, def, { enemyId: 'wolf' });
    expect(result!.isComplete).toBe(false);
  });

  it('不修改原始实例的进度（纯函数）', () => {
    const def = makeDefinition({
      objectives: [{ key: 'kill_goblin', type: 'kill', target: 5, enemyId: 'goblin' }],
    });
    const inst = makeInstance({
      progress: [{ objectiveKey: 'kill_goblin', current: 1, target: 5 }],
    });
    checkQuestProgress(inst, def, { enemyId: 'goblin' });
    expect(inst.progress[0].current).toBe(1);
  });

  it('默认 amount 为 1', () => {
    const def = makeDefinition();
    const inst = makeInstance({
      progress: [{ objectiveKey: 'kill_goblin', current: 0, target: 5 }],
    });
    const result = checkQuestProgress(inst, def, { enemyId: 'goblin' });
    expect(result!.progress[0].current).toBe(1);
  });

  it('同时传入 enemyId 和 itemId 时分别匹配各自目标', () => {
    const def = makeDefinition({
      objectives: [
        { key: 'kill_goblin', type: 'kill', target: 5, enemyId: 'goblin' },
        { key: 'collect_herb', type: 'collect', target: 3, itemId: 'herb' },
      ],
    });
    const inst = makeInstance({
      progress: [
        { objectiveKey: 'kill_goblin', current: 0, target: 5 },
        { objectiveKey: 'collect_herb', current: 0, target: 3 },
      ],
    });
    const result = checkQuestProgress(inst, def, { enemyId: 'goblin', itemId: 'herb' });
    expect(result!.progress[0].current).toBe(1);
    expect(result!.progress[1].current).toBe(1);
  });
});

describe('checkQuestProgress explore 进度更新（P3-149）', () => {
  it('explored=true 时累加 explore 目标进度', () => {
    const def = makeDefinition({
      type: 'explore',
      objectives: [{ key: 'explore_area', type: 'explore', target: 10 }],
    });
    const inst: QuestInstance = {
      questId: 'quest_test',
      status: 'in_progress',
      progress: [{ objectiveKey: 'explore_area', current: 3, target: 10 }],
      acceptedAt: 1,
    };
    const result = checkQuestProgress(inst, def, { explored: true });
    expect(result).not.toBeNull();
    expect(result!.progress[0].current).toBe(4);
  });

  it('explored=false 时不匹配 explore 目标，返回 null', () => {
    const def = makeDefinition({
      type: 'explore',
      objectives: [{ key: 'explore_area', type: 'explore', target: 10 }],
    });
    const inst: QuestInstance = {
      questId: 'quest_test',
      status: 'in_progress',
      progress: [{ objectiveKey: 'explore_area', current: 0, target: 10 }],
      acceptedAt: 1,
    };
    const result = checkQuestProgress(inst, def, { explored: false });
    expect(result).toBeNull();
  });

  it('未传 explored 时视为非探索事件，不匹配 explore 目标', () => {
    const def = makeDefinition({
      type: 'explore',
      objectives: [{ key: 'explore_area', type: 'explore', target: 10 }],
    });
    const inst: QuestInstance = {
      questId: 'quest_test',
      status: 'in_progress',
      progress: [{ objectiveKey: 'explore_area', current: 0, target: 10 }],
      acceptedAt: 1,
    };
    const result = checkQuestProgress(inst, def, { enemyId: 'goblin' });
    expect(result).toBeNull();
  });

  it('目标未限定 locationId 时任意区域新格均计数', () => {
    const def = makeDefinition({
      type: 'explore',
      objectives: [{ key: 'explore_area', type: 'explore', target: 10 }],
    });
    const inst: QuestInstance = {
      questId: 'quest_test',
      status: 'in_progress',
      progress: [{ objectiveKey: 'explore_area', current: 0, target: 10 }],
      acceptedAt: 1,
    };
    const result = checkQuestProgress(inst, def, { explored: true, locationId: 'somewhere_else' });
    expect(result!.progress[0].current).toBe(1);
  });

  it('目标限定 locationId 时仅匹配指定区域', () => {
    const def = makeDefinition({
      type: 'explore',
      objectives: [{ key: 'explore_area', type: 'explore', target: 10, locationId: 'teldrassil' }],
    });
    const inst: QuestInstance = {
      questId: 'quest_test',
      status: 'in_progress',
      progress: [{ objectiveKey: 'explore_area', current: 0, target: 10 }],
      acceptedAt: 1,
    };
    const matched = checkQuestProgress(inst, def, { explored: true, locationId: 'teldrassil' });
    expect(matched!.progress[0].current).toBe(1);

    const unmatched = checkQuestProgress(inst, def, { explored: true, locationId: 'elwynn' });
    expect(unmatched).toBeNull();
  });

  it('目标限定 locationId 但事件未带 locationId 时不匹配', () => {
    const def = makeDefinition({
      type: 'explore',
      objectives: [{ key: 'explore_area', type: 'explore', target: 10, locationId: 'teldrassil' }],
    });
    const inst: QuestInstance = {
      questId: 'quest_test',
      status: 'in_progress',
      progress: [{ objectiveKey: 'explore_area', current: 0, target: 10 }],
      acceptedAt: 1,
    };
    const result = checkQuestProgress(inst, def, { explored: true });
    expect(result).toBeNull();
  });

  it('explore 与 kill 混合目标：kill 事件只更新 kill 目标', () => {
    const def = makeDefinition({
      objectives: [
        { key: 'kill_goblin', type: 'kill', target: 5, enemyId: 'goblin' },
        { key: 'explore_area', type: 'explore', target: 10 },
      ],
    });
    const inst: QuestInstance = {
      questId: 'quest_test',
      status: 'in_progress',
      progress: [
        { objectiveKey: 'kill_goblin', current: 1, target: 5 },
        { objectiveKey: 'explore_area', current: 4, target: 10 },
      ],
      acceptedAt: 1,
    };
    const result = checkQuestProgress(inst, def, { enemyId: 'goblin' });
    expect(result!.progress[0].current).toBe(2);
    expect(result!.progress[1].current).toBe(4);
    expect(result!.isComplete).toBe(false);
  });

  it('进度不超过 target 上限', () => {
    const def = makeDefinition({
      type: 'explore',
      objectives: [{ key: 'explore_area', type: 'explore', target: 5 }],
    });
    const inst: QuestInstance = {
      questId: 'quest_test',
      status: 'in_progress',
      progress: [{ objectiveKey: 'explore_area', current: 5, target: 5 }],
      acceptedAt: 1,
    };
    const result = checkQuestProgress(inst, def, { explored: true });
    expect(result!.progress[0].current).toBe(5);
  });

  it('explore 目标达成时 isComplete=true', () => {
    const def = makeDefinition({
      type: 'explore',
      objectives: [{ key: 'explore_area', type: 'explore', target: 5 }],
    });
    const inst: QuestInstance = {
      questId: 'quest_test',
      status: 'in_progress',
      progress: [{ objectiveKey: 'explore_area', current: 4, target: 5 }],
      acceptedAt: 1,
    };
    const result = checkQuestProgress(inst, def, { explored: true });
    expect(result!.isComplete).toBe(true);
  });

  it('不修改原始实例的进度（纯函数）', () => {
    const def = makeDefinition({
      type: 'explore',
      objectives: [{ key: 'explore_area', type: 'explore', target: 10 }],
    });
    const inst: QuestInstance = {
      questId: 'quest_test',
      status: 'in_progress',
      progress: [{ objectiveKey: 'explore_area', current: 3, target: 10 }],
      acceptedAt: 1,
    };
    checkQuestProgress(inst, def, { explored: true });
    expect(inst.progress[0].current).toBe(3);
  });
});

describe('calculateQuestRewards 奖励计算', () => {
  it('正确提取经验和金币奖励', () => {
    const def = makeDefinition({ xpReward: 200, goldReward: 100 });
    const rewards = calculateQuestRewards(def);
    expect(rewards.exp).toBe(200);
    expect(rewards.gold).toBe(100);
  });

  it('无物品奖励时返回空数组', () => {
    const def = makeDefinition();
    const rewards = calculateQuestRewards(def);
    expect(rewards.items).toEqual([]);
  });

  it('正确提取物品奖励', () => {
    const def = makeDefinition({
      itemRewards: [
        { itemId: 'item_001', count: 2 },
        { itemId: 'item_002', count: 1 },
      ],
    });
    const rewards = calculateQuestRewards(def);
    expect(rewards.items).toHaveLength(2);
    expect(rewards.items[0]).toEqual({ itemId: 'item_001', count: 2 });
    expect(rewards.items[1]).toEqual({ itemId: 'item_002', count: 1 });
  });
});

describe('generateQuestInstance 任务实例生成', () => {
  it('生成 in_progress 状态的实例', () => {
    const def = makeDefinition();
    const inst = generateQuestInstance(def);
    expect(inst.status).toBe('in_progress');
    expect(inst.questId).toBe('quest_test');
  });

  it('所有目标进度初始化为 0', () => {
    const def = makeDefinition({
      objectives: [
        { key: 'obj1', type: 'kill', target: 5, enemyId: 'goblin' },
        { key: 'obj2', type: 'collect', target: 3, itemId: 'herb' },
      ],
    });
    const inst = generateQuestInstance(def);
    expect(inst.progress).toHaveLength(2);
    expect(inst.progress[0].current).toBe(0);
    expect(inst.progress[1].current).toBe(0);
    expect(inst.progress[0].target).toBe(5);
    expect(inst.progress[1].target).toBe(3);
  });

  it('设置 acceptedAt 时间戳', () => {
    const def = makeDefinition();
    const inst = generateQuestInstance(def);
    expect(typeof inst.acceptedAt).toBe('number');
    expect(inst.acceptedAt).toBeGreaterThan(0);
  });

  it('objectiveKey 与 definition 中的 key 对应', () => {
    const def = makeDefinition({
      objectives: [
        { key: 'kill_a', type: 'kill', target: 1, enemyId: 'a' },
        { key: 'kill_b', type: 'kill', target: 2, enemyId: 'b' },
      ],
    });
    const inst = generateQuestInstance(def);
    expect(inst.progress[0].objectiveKey).toBe('kill_a');
    expect(inst.progress[1].objectiveKey).toBe('kill_b');
  });
});

describe('getDefaultQuests 默认任务模板', () => {
  it('返回 5 个默认任务', () => {
    const quests = getDefaultQuests();
    expect(quests).toHaveLength(5);
  });

  it('包含击杀豺狼人任务', () => {
    const quests = getDefaultQuests();
    const gnollQuest = quests.find(q => q.id === 'quest_kill_gnoll');
    expect(gnollQuest).toBeDefined();
    expect(gnollQuest!.type).toBe('kill');
    expect(gnollQuest!.objectives[0].enemyId).toBe('mob_gnoll');
    expect(gnollQuest!.objectives[0].target).toBe(10);
  });

  it('包含采集草药任务', () => {
    const quests = getDefaultQuests();
    const herbQuest = quests.find(q => q.id === 'quest_collect_herbs');
    expect(herbQuest).toBeDefined();
    expect(herbQuest!.type).toBe('collect');
  });

  it('包含多目标兽人任务', () => {
    const quests = getDefaultQuests();
    const orcQuest = quests.find(q => q.id === 'quest_kill_boss_orc');
    expect(orcQuest).toBeDefined();
    expect(orcQuest!.objectives).toHaveLength(2);
  });

  it('每个任务都有必要的字段', () => {
    const quests = getDefaultQuests();
    for (const q of quests) {
      expect(q.id).toBeTruthy();
      expect(q.title).toBeTruthy();
      expect(q.description).toBeTruthy();
      expect(q.objectives.length).toBeGreaterThan(0);
      expect(q.levelRequirement).toBeGreaterThan(0);
      expect(q.xpReward).toBeGreaterThan(0);
      expect(q.boardId).toBeTruthy();
    }
  });
});
