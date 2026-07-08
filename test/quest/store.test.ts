/**
 * @fileoverview 任务模块 Pinia Store 单元测试
 *
 * 覆盖 useQuestStore 的：
 * 1. State 初始值（questDefinitions / questInstances 为空 Map、currentCharacterId 为 null）
 * 2. Getters：definitionList / instanceList / activeQuests / completedQuests / turnedInQuests /
 *    availableQuests（canAcceptQuest 过滤）/ inProgressQuests（定义 + 进度合并视图）
 * 3. Actions：
 *    - initialize（加载定义 + 实例 / DB 为空时写入默认模板 / 空 characterId）
 *    - acceptQuest（成功 emit QUEST_ACCEPTED + log / 定义不存在 / 等级不足 / 重复接取）
 *    - onEnemyKilled（部分进度 / 完成+发奖+emit QUEST_COMPLETED / 不匹配）
 *    - onItemCollected（批量累加 / 完成）
 *    - completeQuest（手动完成 / 状态非 in_progress / 目标未达成）
 *    - claimReward（status → turned_in + emit QUEST_REWARDED / 非 completed 拒绝）
 *    - abandonQuest（status → abandoned + log / 非 in_progress 拒绝）
 *    - 查询（getQuestDefinition / getQuestInstance / isQuestAvailable / getQuestsFromBoard / getQuestsToTurnIn）
 *    - 任务板操作（acceptQuestFromBoard / turnInQuestToBoard 的 boardId 校验）
 *    - reset（清空 questInstances + clearAllQuestInstances）
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - questDbService 全量 mock，断言调用与参数，不触碰真实 IndexedDB。
 *  - useCharacterStore / useInventoryStore / useLogStore 用 vi.hoisted stub 隔离跨 store 调用。
 *  - generateLogId mock 为固定值。
 *  - eventBus 使用真实实现（纯内存发布订阅），通过 eventBus.on 注册 spy 断言 emit，
 *    beforeEach 调用 eventBus.clearAll() 避免监听器残留。
 *  - service 层纯函数（checkQuestProgress / calculateQuestRewards / canAcceptQuest /
 *    generateQuestInstance / getDefaultQuests）使用真实实现，与样板模式一致。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useQuestStore } from '@/modules/quest/store';
import { createTestPinia } from '../utils/setup';
import { eventBus, GameEvents } from '@/modules/bus';
import type { QuestDefinition, QuestInstance, QuestObjective } from '@/modules/quest/types';

/** 跨 store stub + db stub：用 vi.hoisted 保证 mock 工厂可引用 */
const mocks = vi.hoisted(() => ({
  characterStore: {
    level: 5,
    getCharacterId: vi.fn().mockReturnValue('char-1'),
    gainExp: vi.fn().mockResolvedValue(undefined),
    gainGold: vi.fn().mockResolvedValue(undefined),
  },
  inventoryStore: {
    addItem: vi.fn(),
  },
  logStore: {
    addLogEntry: vi.fn(),
  },
  questDb: {
    getAllQuestDefinitions: vi.fn().mockResolvedValue([]),
    saveQuestDefinition: vi.fn().mockResolvedValue(undefined),
    getQuestDefinition: vi.fn().mockResolvedValue(null),
    deleteQuestDefinition: vi.fn().mockResolvedValue(undefined),
    clearAllQuestDefinitions: vi.fn().mockResolvedValue(undefined),
    getQuestDefinitionsByBoard: vi.fn().mockResolvedValue([]),
    saveQuestInstance: vi.fn().mockResolvedValue(undefined),
    getQuestInstance: vi.fn().mockResolvedValue(null),
    getAllQuestInstances: vi.fn().mockResolvedValue([]),
    deleteQuestInstance: vi.fn().mockResolvedValue(undefined),
    clearAllQuestInstances: vi.fn().mockResolvedValue(undefined),
    deleteCharacterQuests: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/modules/quest/db', () => ({ questDbService: mocks.questDb }));
vi.mock('@/modules/character/store', () => ({ useCharacterStore: () => mocks.characterStore }));
vi.mock('@/modules/inventory/store', () => ({ useInventoryStore: () => mocks.inventoryStore }));
vi.mock('@/modules/log/store', () => ({ useLogStore: () => mocks.logStore }));
vi.mock('@/modules/log/service', () => ({ generateLogId: vi.fn().mockReturnValue('log-id') }));

import { questDbService } from '@/modules/quest/db';

// ==================== 测试数据 helper ====================

function makeKillObjective(o: Partial<QuestObjective> = {}): QuestObjective {
  return { key: 'kill_goblin', type: 'kill', target: 1, enemyId: 'goblin', ...o };
}

function makeCollectObjective(o: Partial<QuestObjective> = {}): QuestObjective {
  return { key: 'collect_herb', type: 'collect', target: 1, itemId: 'item_herb', ...o };
}

function makeDefinition(o: Partial<QuestDefinition> = {}): QuestDefinition {
  return {
    id: 'q1',
    title: '测试任务',
    description: 'desc',
    type: 'kill',
    objectives: [makeKillObjective()],
    levelRequirement: 1,
    xpReward: 100,
    goldReward: 50,
    boardId: 'village',
    ...o,
  };
}

function makeInstance(o: Partial<QuestInstance> = {}): QuestInstance {
  return {
    questId: 'q1',
    status: 'in_progress',
    progress: [{ objectiveKey: 'kill_goblin', current: 0, target: 1 }],
    acceptedAt: 1000,
    ...o,
  };
}

function defMap(...defs: QuestDefinition[]): Map<string, QuestDefinition> {
  return new Map(defs.map(d => [d.id, d]));
}

function instMap(...insts: QuestInstance[]): Map<string, QuestInstance> {
  return new Map(insts.map(i => [i.questId, i]));
}

describe('useQuestStore - 任务 Store', () => {
  beforeEach(() => {
    createTestPinia();
    vi.clearAllMocks();
    eventBus.clearAll();
    // 重置 characterStore.level 为默认值（部分用例会修改）
    mocks.characterStore.level = 5;
  });

  // -------------------- State 初始值 --------------------
  describe('State 初始值', () => {
    it('questDefinitions / questInstances 初始为空 Map', () => {
      const store = useQuestStore();
      expect(store.questDefinitions.size).toBe(0);
      expect(store.questInstances.size).toBe(0);
    });

    it('currentCharacterId 初始为 null', () => {
      const store = useQuestStore();
      expect(store.currentCharacterId).toBeNull();
    });
  });

  // -------------------- Getters --------------------
  describe('Getters', () => {
    it('definitionList / instanceList 返回数组视图', () => {
      const store = useQuestStore();
      const def = makeDefinition();
      const inst = makeInstance();
      store.$patch({
        questDefinitions: defMap(def),
        questInstances: instMap(inst),
      });
      expect(store.definitionList).toEqual([def]);
      expect(store.instanceList).toEqual([inst]);
    });

    it('activeQuests 过滤 status=in_progress', () => {
      const store = useQuestStore();
      store.$patch({
        questInstances: instMap(
          makeInstance({ questId: 'q1', status: 'in_progress' }),
          makeInstance({ questId: 'q2', status: 'completed' }),
          makeInstance({ questId: 'q3', status: 'turned_in' }),
        ),
      });
      expect(store.activeQuests).toHaveLength(1);
      expect(store.activeQuests[0].questId).toBe('q1');
    });

    it('completedQuests 过滤 status=completed', () => {
      const store = useQuestStore();
      store.$patch({
        questInstances: instMap(
          makeInstance({ questId: 'q1', status: 'in_progress' }),
          makeInstance({ questId: 'q2', status: 'completed' }),
        ),
      });
      expect(store.completedQuests).toHaveLength(1);
      expect(store.completedQuests[0].questId).toBe('q2');
    });

    it('turnedInQuests 过滤 status=turned_in', () => {
      const store = useQuestStore();
      store.$patch({
        questInstances: instMap(
          makeInstance({ questId: 'q1', status: 'completed' }),
          makeInstance({ questId: 'q2', status: 'turned_in' }),
        ),
      });
      expect(store.turnedInQuests).toHaveLength(1);
      expect(store.turnedInQuests[0].questId).toBe('q2');
    });

    it('availableQuests: 等级满足且无活跃实例的定义可接取', () => {
      const store = useQuestStore();
      store.$patch({
        questDefinitions: defMap(
          makeDefinition({ id: 'low', levelRequirement: 1 }),
          makeDefinition({ id: 'high', levelRequirement: 10 }),
          makeDefinition({ id: 'taken', levelRequirement: 1 }),
        ),
        questInstances: instMap(
          makeInstance({ questId: 'taken', status: 'in_progress' }),
        ),
      });
      // characterStore.level = 5：low 可接、high 等级不足、taken 已有活跃实例
      const ids = store.availableQuests.map(d => d.id);
      expect(ids).toEqual(['low']);
    });

    it('availableQuests: 已放弃的任务可重新接取', () => {
      const store = useQuestStore();
      store.$patch({
        questDefinitions: defMap(makeDefinition({ id: 'q1', levelRequirement: 1 })),
        questInstances: instMap(
          makeInstance({ questId: 'q1', status: 'abandoned' }),
        ),
      });
      expect(store.availableQuests).toHaveLength(1);
      expect(store.availableQuests[0].id).toBe('q1');
    });

    it('inProgressQuests: 合并定义 + 进度视图', () => {
      const store = useQuestStore();
      const def = makeDefinition({ id: 'q1', title: '击杀哥布林' });
      const inst = makeInstance({
        questId: 'q1',
        status: 'in_progress',
        progress: [{ objectiveKey: 'kill_goblin', current: 3, target: 10 }],
      });
      store.$patch({
        questDefinitions: defMap(def),
        questInstances: instMap(inst),
      });
      expect(store.inProgressQuests).toHaveLength(1);
      const view = store.inProgressQuests[0];
      expect(view.title).toBe('击杀哥布林');
      expect(view.progress).toEqual([{ objectiveKey: 'kill_goblin', current: 3, target: 10 }]);
    });
  });

  // -------------------- Actions: initialize --------------------
  describe('Actions: initialize', () => {
    it('initialize 加载任务定义与角色实例，设置 currentCharacterId', async () => {
      const def = makeDefinition();
      const inst = makeInstance();
      vi.mocked(questDbService.getAllQuestDefinitions).mockResolvedValueOnce([def]);
      vi.mocked(questDbService.getAllQuestInstances).mockResolvedValueOnce([inst]);

      const store = useQuestStore();
      await store.initialize('char-1');

      expect(store.currentCharacterId).toBe('char-1');
      expect(store.definitionList).toEqual([def]);
      expect(store.instanceList).toEqual([inst]);
    });

    it('initialize 空 characterId 时 questInstances 为空', async () => {
      vi.mocked(questDbService.getAllQuestDefinitions).mockResolvedValueOnce([makeDefinition()]);
      const store = useQuestStore();
      await store.initialize('');
      expect(store.questInstances.size).toBe(0);
      expect(questDbService.getAllQuestInstances).not.toHaveBeenCalled();
    });

    it('DB 无任务定义时写入默认模板（getDefaultQuests 4 个）', async () => {
      vi.mocked(questDbService.getAllQuestDefinitions).mockResolvedValueOnce([]);
      vi.mocked(questDbService.getAllQuestInstances).mockResolvedValueOnce([]);

      const store = useQuestStore();
      await store.initialize('char-1');

      // getDefaultQuests 返回 4 个任务模板
      expect(store.questDefinitions.size).toBe(4);
      expect(questDbService.saveQuestDefinition).toHaveBeenCalledTimes(4);
    });
  });

  // -------------------- Actions: acceptQuest --------------------
  describe('Actions: acceptQuest', () => {
    it('成功接取：创建 in_progress 实例 + emit QUEST_ACCEPTED + 记录日志', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.QUEST_ACCEPTED, spy);

      const def = makeDefinition({ id: 'q1', levelRequirement: 1 });
      const store = useQuestStore();
      store.$patch({
        currentCharacterId: 'char-1',
        questDefinitions: defMap(def),
      });

      const result = await store.acceptQuest('q1');

      expect(result).toBe(true);
      const inst = store.getQuestInstance('q1');
      expect(inst).not.toBeNull();
      expect(inst!.status).toBe('in_progress');
      expect(inst!.progress).toEqual([{ objectiveKey: 'kill_goblin', current: 0, target: 1 }]);
      expect(spy).toHaveBeenCalledWith({ questId: 'q1', definition: def });
      expect(questDbService.saveQuestInstance).toHaveBeenCalledWith(inst, 'char-1');
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(expect.objectContaining({
        type: 'quest',
        message: expect.stringContaining('测试任务'),
      }));
    });

    it('任务定义不存在时返回 false', async () => {
      const store = useQuestStore();
      store.$patch({ currentCharacterId: 'char-1' });
      const result = await store.acceptQuest('nope');
      expect(result).toBe(false);
    });

    it('等级不足时返回 false', async () => {
      const store = useQuestStore();
      store.$patch({
        currentCharacterId: 'char-1',
        questDefinitions: defMap(makeDefinition({ id: 'q1', levelRequirement: 99 })),
      });
      // characterStore.level = 5
      const result = await store.acceptQuest('q1');
      expect(result).toBe(false);
    });

    it('已有 in_progress 实例时返回 false（不可重复接取）', async () => {
      const store = useQuestStore();
      store.$patch({
        currentCharacterId: 'char-1',
        questDefinitions: defMap(makeDefinition({ id: 'q1', levelRequirement: 1 })),
        questInstances: instMap(makeInstance({ questId: 'q1', status: 'in_progress' })),
      });
      const result = await store.acceptQuest('q1');
      expect(result).toBe(false);
    });
  });

  // -------------------- Actions: onEnemyKilled / onItemCollected --------------------
  describe('Actions: onEnemyKilled / onItemCollected', () => {
    it('onEnemyKilled 部分进度：current 累加但未达成，状态不变', async () => {
      const store = useQuestStore();
      store.$patch({
        currentCharacterId: 'char-1',
        questDefinitions: defMap(makeDefinition({
          id: 'q1',
          objectives: [makeKillObjective({ key: 'kill_goblin', target: 3, enemyId: 'goblin' })],
        })),
        questInstances: instMap(makeInstance({
          questId: 'q1',
          progress: [{ objectiveKey: 'kill_goblin', current: 0, target: 3 }],
        })),
      });

      await store.onEnemyKilled('goblin');

      const inst = store.getQuestInstance('q1');
      expect(inst!.progress[0].current).toBe(1);
      expect(inst!.status).toBe('in_progress');
      expect(questDbService.saveQuestInstance).toHaveBeenCalled();
    });

    it('onEnemyKilled 完成进度：status → completed + emit QUEST_COMPLETED + 发奖', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.QUEST_COMPLETED, spy);

      const def = makeDefinition({
        id: 'q1',
        xpReward: 100,
        goldReward: 50,
        itemRewards: [{ itemId: 'item_potion', count: 2 }],
        objectives: [makeKillObjective({ key: 'kill_goblin', target: 1, enemyId: 'goblin' })],
      });
      const store = useQuestStore();
      store.$patch({
        currentCharacterId: 'char-1',
        questDefinitions: defMap(def),
        questInstances: instMap(makeInstance({
          questId: 'q1',
          progress: [{ objectiveKey: 'kill_goblin', current: 0, target: 1 }],
        })),
      });

      await store.onEnemyKilled('goblin');

      const inst = store.getQuestInstance('q1');
      expect(inst!.status).toBe('completed');
      expect(inst!.completedAt).toBeDefined();
      expect(spy).toHaveBeenCalledWith({ questId: 'q1', definition: def });
      expect(mocks.characterStore.gainExp).toHaveBeenCalledWith(100);
      expect(mocks.characterStore.gainGold).toHaveBeenCalledWith(50);
      expect(mocks.inventoryStore.addItem).toHaveBeenCalledWith('item_potion', 2);
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(expect.objectContaining({
        type: 'quest',
        message: expect.stringContaining('完成了任务'),
      }));
    });

    it('onEnemyKilled 不匹配的 enemyId 不影响进度', async () => {
      const store = useQuestStore();
      store.$patch({
        currentCharacterId: 'char-1',
        questDefinitions: defMap(makeDefinition({
          id: 'q1',
          objectives: [makeKillObjective({ enemyId: 'goblin' })],
        })),
        questInstances: instMap(makeInstance({
          questId: 'q1',
          progress: [{ objectiveKey: 'kill_goblin', current: 0, target: 1 }],
        })),
      });

      await store.onEnemyKilled('wolf');

      const inst = store.getQuestInstance('q1');
      expect(inst!.progress[0].current).toBe(0);
      expect(inst!.status).toBe('in_progress');
    });

    it('onItemCollected 批量累加 amount', async () => {
      const store = useQuestStore();
      store.$patch({
        currentCharacterId: 'char-1',
        questDefinitions: defMap(makeDefinition({
          id: 'q1',
          type: 'collect',
          objectives: [makeCollectObjective({ key: 'collect_herb', target: 5, itemId: 'item_herb' })],
        })),
        questInstances: instMap(makeInstance({
          questId: 'q1',
          progress: [{ objectiveKey: 'collect_herb', current: 0, target: 5 }],
        })),
      });

      await store.onItemCollected('item_herb', 3);

      const inst = store.getQuestInstance('q1');
      expect(inst!.progress[0].current).toBe(3);
      expect(inst!.status).toBe('in_progress');
    });

    it('onItemCollected 完成时触发 QUEST_COMPLETED', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.QUEST_COMPLETED, spy);

      const store = useQuestStore();
      store.$patch({
        currentCharacterId: 'char-1',
        questDefinitions: defMap(makeDefinition({
          id: 'q1',
          type: 'collect',
          xpReward: 80,
          goldReward: 30,
          objectives: [makeCollectObjective({ key: 'collect_herb', target: 5, itemId: 'item_herb' })],
        })),
        questInstances: instMap(makeInstance({
          questId: 'q1',
          progress: [{ objectiveKey: 'collect_herb', current: 4, target: 5 }],
        })),
      });

      await store.onItemCollected('item_herb', 1);

      expect(store.getQuestInstance('q1')!.status).toBe('completed');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(mocks.characterStore.gainExp).toHaveBeenCalledWith(80);
    });
  });

  // -------------------- Actions: completeQuest --------------------
  describe('Actions: completeQuest', () => {
    it('手动完成：progress 全部达成时 emit QUEST_COMPLETED + 发奖', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.QUEST_COMPLETED, spy);

      const def = makeDefinition({ id: 'q1', xpReward: 200, goldReward: 100 });
      const store = useQuestStore();
      store.$patch({
        currentCharacterId: 'char-1',
        questDefinitions: defMap(def),
        questInstances: instMap(makeInstance({
          questId: 'q1',
          status: 'in_progress',
          progress: [{ objectiveKey: 'kill_goblin', current: 1, target: 1 }],
        })),
      });

      const result = await store.completeQuest('q1');

      expect(result).toBe(true);
      expect(store.getQuestInstance('q1')!.status).toBe('completed');
      expect(spy).toHaveBeenCalledWith({ questId: 'q1', definition: def });
      expect(mocks.characterStore.gainExp).toHaveBeenCalledWith(200);
      expect(mocks.characterStore.gainGold).toHaveBeenCalledWith(100);
    });

    it('实例不存在时返回 false', async () => {
      const store = useQuestStore();
      store.$patch({
        questDefinitions: defMap(makeDefinition({ id: 'q1' })),
      });
      const result = await store.completeQuest('q1');
      expect(result).toBe(false);
    });

    it('状态非 in_progress 时返回 false', async () => {
      const store = useQuestStore();
      store.$patch({
        questDefinitions: defMap(makeDefinition({ id: 'q1' })),
        questInstances: instMap(makeInstance({ questId: 'q1', status: 'completed' })),
      });
      const result = await store.completeQuest('q1');
      expect(result).toBe(false);
    });

    it('目标未全部达成时返回 false', async () => {
      const store = useQuestStore();
      store.$patch({
        questDefinitions: defMap(makeDefinition({ id: 'q1' })),
        questInstances: instMap(makeInstance({
          questId: 'q1',
          status: 'in_progress',
          progress: [{ objectiveKey: 'kill_goblin', current: 0, target: 1 }],
        })),
      });
      const result = await store.completeQuest('q1');
      expect(result).toBe(false);
    });
  });

  // -------------------- Actions: claimReward --------------------
  describe('Actions: claimReward', () => {
    it('成功领取：status → turned_in + emit QUEST_REWARDED + 记录日志', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.QUEST_REWARDED, spy);

      const def = makeDefinition({ id: 'q1', xpReward: 100, goldReward: 50 });
      const store = useQuestStore();
      store.$patch({
        currentCharacterId: 'char-1',
        questDefinitions: defMap(def),
        questInstances: instMap(makeInstance({
          questId: 'q1',
          status: 'completed',
          completedAt: 2000,
        })),
      });

      const result = await store.claimReward('q1');

      expect(result).toBe(true);
      expect(store.getQuestInstance('q1')!.status).toBe('turned_in');
      expect(spy).toHaveBeenCalledWith({ questId: 'q1', definition: def });
      expect(questDbService.saveQuestInstance).toHaveBeenCalled();
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(expect.objectContaining({
        type: 'quest',
        message: expect.stringContaining('提交了任务'),
      }));
    });

    it('状态非 completed 时返回 false', async () => {
      const store = useQuestStore();
      store.$patch({
        questDefinitions: defMap(makeDefinition({ id: 'q1' })),
        questInstances: instMap(makeInstance({ questId: 'q1', status: 'in_progress' })),
      });
      const result = await store.claimReward('q1');
      expect(result).toBe(false);
    });

    it('任务定义不存在时返回 false', async () => {
      const store = useQuestStore();
      store.$patch({
        questInstances: instMap(makeInstance({ questId: 'q1', status: 'completed' })),
      });
      const result = await store.claimReward('q1');
      expect(result).toBe(false);
    });
  });

  // -------------------- Actions: abandonQuest --------------------
  describe('Actions: abandonQuest', () => {
    it('成功放弃：status → abandoned + 记录日志（无 emit）', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.QUEST_COMPLETED, spy);

      const store = useQuestStore();
      store.$patch({
        currentCharacterId: 'char-1',
        questDefinitions: defMap(makeDefinition({ id: 'q1', title: '测试任务' })),
        questInstances: instMap(makeInstance({ questId: 'q1', status: 'in_progress' })),
      });

      const result = await store.abandonQuest('q1');

      expect(result).toBe(true);
      expect(store.getQuestInstance('q1')!.status).toBe('abandoned');
      expect(questDbService.saveQuestInstance).toHaveBeenCalled();
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(expect.objectContaining({
        type: 'quest',
        message: expect.stringContaining('放弃了任务'),
      }));
      // 放弃任务不触发 QUEST_COMPLETED 事件
      expect(spy).not.toHaveBeenCalled();
    });

    it('状态非 in_progress 时返回 false', async () => {
      const store = useQuestStore();
      store.$patch({
        questInstances: instMap(makeInstance({ questId: 'q1', status: 'completed' })),
      });
      const result = await store.abandonQuest('q1');
      expect(result).toBe(false);
    });
  });

  // -------------------- Actions: 查询 --------------------
  describe('Actions: 查询', () => {
    it('getQuestDefinition 命中返回定义，未命中返回 null', () => {
      const store = useQuestStore();
      const def = makeDefinition({ id: 'q1' });
      store.$patch({ questDefinitions: defMap(def) });
      expect(store.getQuestDefinition('q1')).toEqual(def);
      expect(store.getQuestDefinition('nope')).toBeNull();
    });

    it('getQuestInstance 命中返回实例，未命中返回 null', () => {
      const store = useQuestStore();
      const inst = makeInstance({ questId: 'q1' });
      store.$patch({ questInstances: instMap(inst) });
      expect(store.getQuestInstance('q1')).toEqual(inst);
      expect(store.getQuestInstance('nope')).toBeNull();
    });

    it('isQuestAvailable: 可接取返回 true，不可接取返回 false', () => {
      const store = useQuestStore();
      store.$patch({
        questDefinitions: defMap(
          makeDefinition({ id: 'ok', levelRequirement: 1 }),
          makeDefinition({ id: 'high', levelRequirement: 99 }),
        ),
      });
      // characterStore.level = 5
      expect(store.isQuestAvailable('ok')).toBe(true);
      expect(store.isQuestAvailable('high')).toBe(false);
      expect(store.isQuestAvailable('nope')).toBe(false);
    });

    it('getQuestsFromBoard 按 boardId 过滤定义', () => {
      const store = useQuestStore();
      store.$patch({
        questDefinitions: defMap(
          makeDefinition({ id: 'q1', boardId: 'village' }),
          makeDefinition({ id: 'q2', boardId: 'village' }),
          makeDefinition({ id: 'q3', boardId: 'forest' }),
        ),
      });
      const result = store.getQuestsFromBoard('village');
      expect(result).toHaveLength(2);
      expect(result.map(d => d.id).sort()).toEqual(['q1', 'q2']);
    });

    it('getQuestsToTurnIn 返回 completed 且 boardId 匹配的定义', () => {
      const store = useQuestStore();
      store.$patch({
        questDefinitions: defMap(
          makeDefinition({ id: 'q1', boardId: 'village' }),
          makeDefinition({ id: 'q2', boardId: 'forest' }),
          makeDefinition({ id: 'q3', boardId: 'village' }),
        ),
        questInstances: instMap(
          makeInstance({ questId: 'q1', status: 'completed' }),
          makeInstance({ questId: 'q2', status: 'completed' }),
          makeInstance({ questId: 'q3', status: 'in_progress' }),
        ),
      });
      const result = store.getQuestsToTurnIn('village');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('q1');
    });
  });

  // -------------------- Actions: 任务板操作 --------------------
  describe('Actions: 任务板操作', () => {
    it('acceptQuestFromBoard: boardId 匹配时接取成功', async () => {
      const store = useQuestStore();
      store.$patch({
        currentCharacterId: 'char-1',
        questDefinitions: defMap(makeDefinition({ id: 'q1', boardId: 'village', levelRequirement: 1 })),
      });
      const result = await store.acceptQuestFromBoard('village', 'q1');
      expect(result).toBe(true);
      expect(store.getQuestInstance('q1')).not.toBeNull();
    });

    it('acceptQuestFromBoard: boardId 不匹配时返回 false', async () => {
      const store = useQuestStore();
      store.$patch({
        currentCharacterId: 'char-1',
        questDefinitions: defMap(makeDefinition({ id: 'q1', boardId: 'village' })),
      });
      const result = await store.acceptQuestFromBoard('forest', 'q1');
      expect(result).toBe(false);
      expect(store.getQuestInstance('q1')).toBeNull();
    });

    it('turnInQuestToBoard: boardId 匹配时领取成功', async () => {
      const store = useQuestStore();
      store.$patch({
        currentCharacterId: 'char-1',
        questDefinitions: defMap(makeDefinition({ id: 'q1', boardId: 'village' })),
        questInstances: instMap(makeInstance({ questId: 'q1', status: 'completed', completedAt: 1 })),
      });
      const result = await store.turnInQuestToBoard('village', 'q1');
      expect(result).toBe(true);
      expect(store.getQuestInstance('q1')!.status).toBe('turned_in');
    });

    it('turnInQuestToBoard: boardId 不匹配时返回 false', async () => {
      const store = useQuestStore();
      store.$patch({
        questDefinitions: defMap(makeDefinition({ id: 'q1', boardId: 'village' })),
        questInstances: instMap(makeInstance({ questId: 'q1', status: 'completed', completedAt: 1 })),
      });
      const result = await store.turnInQuestToBoard('forest', 'q1');
      expect(result).toBe(false);
      expect(store.getQuestInstance('q1')!.status).toBe('completed');
    });
  });

  // -------------------- Actions: reset --------------------
  describe('Actions: reset', () => {
    it('reset 清空 questInstances 并调用 clearAllQuestInstances', async () => {
      const store = useQuestStore();
      store.$patch({
        questInstances: instMap(makeInstance({ questId: 'q1' })),
      });
      expect(store.questInstances.size).toBe(1);

      await store.reset();

      expect(store.questInstances.size).toBe(0);
      expect(questDbService.clearAllQuestInstances).toHaveBeenCalledTimes(1);
    });
  });
});
