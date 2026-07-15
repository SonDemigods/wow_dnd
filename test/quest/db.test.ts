/**
 * @fileoverview 任务模块数据层（quest/db.ts）内存级 CRUD 测试
 *
 * 使用 fake-indexeddb 在内存中真实执行 Dexie 操作，覆盖：
 *  - saveQuestInstance / getQuestInstance：复合主键 [characterId+questId] 的写入与精确查询
 *  - getAllQuestInstances：where('characterId').equals() 索引查询
 *  - deleteQuestInstance / deleteCharacterQuests：复合主键删除 / 按角色批量删除
 *  - clearAllQuestInstances：清空表
 *  - saveQuestDefinition / getQuestDefinition：定义表 config_quests 的 CRUD
 *  - getAllQuestDefinitions / getQuestDefinitionsByBoard：全量查询 / where('boardId').equals() 索引查询
 *  - _mapToDefinition 字段映射（objectives / itemRewards / prerequisiteQuests）
 *
 * 设计说明（遵循 code_rule 红线）：
 *  - 顶部 `import 'fake-indexeddb/auto'` 注入 IndexedDB shim
 *  - beforeEach 清空 char_quests 与 config_quests 两张表
 *  - 不 mock db service，验证 Dexie 复合主键与 where().equals() 索引查询真实行为
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { questDbService } from '@/modules/quest/db';
import { db } from '@/modules/data/core';
import type {
  QuestDefinition,
  QuestInstance,
  QuestObjective,
} from '@/modules/quest/types';

// ==================== 测试数据构造 helper ====================

function makeObjective(o: Partial<QuestObjective> = {}): QuestObjective {
  return {
    key: 'kill_enemy',
    type: 'kill',
    target: 5,
    enemyId: 'spider',
    ...o,
  } as QuestObjective;
}

function makeDefinition(o: Partial<QuestDefinition> = {}): QuestDefinition {
  return {
    id: 'quest-1',
    title: '清剿蜘蛛',
    description: '消灭 5 只蜘蛛',
    type: 'kill',
    objectives: [makeObjective()],
    levelRequirement: 1,
    xpReward: 100,
    goldReward: 50,
    boardId: 'forest-board',
    ...o,
  } as QuestDefinition;
}

function makeInstance(o: Partial<QuestInstance> = {}): QuestInstance {
  return {
    questId: 'quest-1',
    status: 'in_progress',
    progress: [{ objectiveKey: 'kill_enemy', current: 2, target: 5 }],
    acceptedAt: 1700000000000,
    ...o,
  } as QuestInstance;
}

// ==================== 测试用例 ====================

describe('QuestDbService - 任务数据层（fake-indexeddb 真实 CRUD）', () => {
  beforeEach(async () => {
    await Promise.all([
      db.char_quests.clear(),
      db.config_quests.clear(),
    ]);
  });

  // -------------------- 任务实例表 char_quests（复合主键） --------------------

  describe('saveQuestInstance / getQuestInstance：复合主键 [characterId+questId]', () => {
    it('保存后可通过复合主键读回完整数据', async () => {
      const instance = makeInstance();
      await questDbService.saveQuestInstance(instance, 'char-1');

      const result = await questDbService.getQuestInstance('char-1', 'quest-1');
      expect(result).not.toBeNull();
      expect(result!.questId).toBe('quest-1');
      expect(result!.status).toBe('in_progress');
      expect(result!.progress).toEqual([{ objectiveKey: 'kill_enemy', current: 2, target: 5 }]);
      expect(result!.acceptedAt).toBe(1700000000000);
    });

    it('复合主键精确查询：不同角色 + 不同任务的组合互不干扰', async () => {
      await questDbService.saveQuestInstance(makeInstance({ questId: 'q1', acceptedAt: 100 }), 'char-A');
      await questDbService.saveQuestInstance(makeInstance({ questId: 'q2', acceptedAt: 200 }), 'char-A');
      await questDbService.saveQuestInstance(makeInstance({ questId: 'q1', acceptedAt: 300 }), 'char-B');

      const r1 = await questDbService.getQuestInstance('char-A', 'q1');
      const r2 = await questDbService.getQuestInstance('char-A', 'q2');
      const r3 = await questDbService.getQuestInstance('char-B', 'q1');
      const r4 = await questDbService.getQuestInstance('char-B', 'q2');

      expect(r1!.acceptedAt).toBe(100);
      expect(r2!.acceptedAt).toBe(200);
      expect(r3!.acceptedAt).toBe(300);
      expect(r4).toBeNull();
    });

    it('复合主键不存在时返回 null', async () => {
      const result = await questDbService.getQuestInstance('non-existent-char', 'non-existent-quest');
      expect(result).toBeNull();
    });

    it('覆盖保存：相同复合主键再次保存，新数据替换旧数据', async () => {
      await questDbService.saveQuestInstance(
        makeInstance({ status: 'in_progress', progress: [{ objectiveKey: 'k', current: 1, target: 5 }] }),
        'char-1'
      );
      await questDbService.saveQuestInstance(
        makeInstance({ status: 'completed', progress: [{ objectiveKey: 'k', current: 5, target: 5 }] }),
        'char-1'
      );

      const result = await questDbService.getQuestInstance('char-1', 'quest-1');
      expect(result!.status).toBe('completed');
      expect(result!.progress[0].current).toBe(5);
    });
  });

  describe('getAllQuestInstances：where(characterId).equals() 索引查询', () => {
    it('空表返回空数组', async () => {
      const result = await questDbService.getAllQuestInstances('char-1');
      expect(result).toEqual([]);
    });

    it('按 characterId 过滤，仅返回该角色的任务（验证索引正确性）', async () => {
      await questDbService.saveQuestInstance(makeInstance({ questId: 'q1' }), 'char-A');
      await questDbService.saveQuestInstance(makeInstance({ questId: 'q2' }), 'char-A');
      await questDbService.saveQuestInstance(makeInstance({ questId: 'q3' }), 'char-B');

      const resultA = await questDbService.getAllQuestInstances('char-A');
      const resultB = await questDbService.getAllQuestInstances('char-B');

      expect(resultA).toHaveLength(2);
      expect(resultA.map(r => r.questId).sort()).toEqual(['q1', 'q2']);
      expect(resultB).toHaveLength(1);
      expect(resultB[0].questId).toBe('q3');
    });

    it('查询不存在的角色返回空数组', async () => {
      await questDbService.saveQuestInstance(makeInstance(), 'char-A');
      const result = await questDbService.getAllQuestInstances('non-existent');
      expect(result).toEqual([]);
    });
  });

  describe('deleteQuestInstance：复合主键删除', () => {
    it('删除指定 (characterId, questId) 后再读返回 null', async () => {
      await questDbService.saveQuestInstance(makeInstance({ questId: 'q1' }), 'char-1');
      await questDbService.saveQuestInstance(makeInstance({ questId: 'q2' }), 'char-1');

      await questDbService.deleteQuestInstance('char-1', 'q1');
      expect(await questDbService.getQuestInstance('char-1', 'q1')).toBeNull();
      expect(await questDbService.getQuestInstance('char-1', 'q2')).not.toBeNull();
    });

    it('删除不影响其他角色相同 questId 的实例', async () => {
      await questDbService.saveQuestInstance(makeInstance({ questId: 'q1' }), 'char-A');
      await questDbService.saveQuestInstance(makeInstance({ questId: 'q1' }), 'char-B');

      await questDbService.deleteQuestInstance('char-A', 'q1');
      expect(await questDbService.getQuestInstance('char-A', 'q1')).toBeNull();
      expect(await questDbService.getQuestInstance('char-B', 'q1')).not.toBeNull();
    });
  });

  describe('deleteCharacterQuests：按角色批量删除', () => {
    it('删除指定角色的全部任务实例，不影响其他角色', async () => {
      await questDbService.saveQuestInstance(makeInstance({ questId: 'q1' }), 'char-A');
      await questDbService.saveQuestInstance(makeInstance({ questId: 'q2' }), 'char-A');
      await questDbService.saveQuestInstance(makeInstance({ questId: 'q3' }), 'char-B');

      await questDbService.deleteCharacterQuests('char-A');

      expect(await questDbService.getAllQuestInstances('char-A')).toEqual([]);
      expect(await questDbService.getAllQuestInstances('char-B')).toHaveLength(1);
    });

    it('删除不存在角色的任务不抛错', async () => {
      await expect(questDbService.deleteCharacterQuests('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('clearAllQuestInstances：清空全部', () => {
    it('清空后所有角色的任务实例均被删除', async () => {
      await questDbService.saveQuestInstance(makeInstance({ questId: 'q1' }), 'char-A');
      await questDbService.saveQuestInstance(makeInstance({ questId: 'q2' }), 'char-B');

      await questDbService.clearAllQuestInstances();
      expect(await questDbService.getAllQuestInstances('char-A')).toEqual([]);
      expect(await questDbService.getAllQuestInstances('char-B')).toEqual([]);
    });
  });

  // -------------------- 任务定义表 config_quests --------------------

  describe('saveQuestDefinition / getQuestDefinition：定义读写与字段映射', () => {
    it('保存后可读回，_mapToDefinition 正确转换 objectives 与 itemRewards', async () => {
      const def = makeDefinition({
        id: 'collect-herb',
        title: '采集草药',
        type: 'collect',
        objectives: [
          makeObjective({ key: 'collect_herb', type: 'collect', target: 3, itemId: 'herb', enemyId: undefined }),
        ],
        itemRewards: [{ itemId: 'gold-pouch', count: 1 }],
        prerequisiteQuests: ['intro-quest'],
      });
      await questDbService.saveQuestDefinition(def);

      const result = await questDbService.getQuestDefinition('collect-herb');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('collect-herb');
      expect(result!.title).toBe('采集草药');
      expect(result!.type).toBe('collect');
      expect(result!.objectives).toEqual([
        { key: 'collect_herb', type: 'collect', target: 3, itemId: 'herb', enemyId: undefined, locationId: undefined },
      ]);
      expect(result!.itemRewards).toEqual([{ itemId: 'gold-pouch', count: 1 }]);
      expect(result!.prerequisiteQuests).toEqual(['intro-quest']);
      expect(result!.boardId).toBe('forest-board');
    });

    it('定义不存在时返回 null', async () => {
      const result = await questDbService.getQuestDefinition('non-existent');
      expect(result).toBeNull();
    });

    it('覆盖保存：相同 ID 再次保存，新数据替换旧数据', async () => {
      await questDbService.saveQuestDefinition(makeDefinition({ id: 'dup', title: '旧' }));
      await questDbService.saveQuestDefinition(makeDefinition({ id: 'dup', title: '新' }));

      const result = await questDbService.getQuestDefinition('dup');
      expect(result!.title).toBe('新');
    });
  });

  describe('getAllQuestDefinitions：全量查询', () => {
    it('空表返回空数组', async () => {
      const result = await questDbService.getAllQuestDefinitions();
      expect(result).toEqual([]);
    });

    it('多定义时全部返回', async () => {
      await questDbService.saveQuestDefinition(makeDefinition({ id: 'q1', boardId: 'b1' }));
      await questDbService.saveQuestDefinition(makeDefinition({ id: 'q2', boardId: 'b1' }));
      await questDbService.saveQuestDefinition(makeDefinition({ id: 'q3', boardId: 'b2' }));

      const result = await questDbService.getAllQuestDefinitions();
      expect(result).toHaveLength(3);
    });
  });

  describe('getQuestDefinitionsByBoard：where(boardId).equals() 索引查询', () => {
    it('按 boardId 过滤返回该任务板上的所有定义', async () => {
      await questDbService.saveQuestDefinition(makeDefinition({ id: 'q1', boardId: 'forest' }));
      await questDbService.saveQuestDefinition(makeDefinition({ id: 'q2', boardId: 'forest' }));
      await questDbService.saveQuestDefinition(makeDefinition({ id: 'q3', boardId: 'desert' }));

      const forest = await questDbService.getQuestDefinitionsByBoard('forest');
      const desert = await questDbService.getQuestDefinitionsByBoard('desert');

      expect(forest).toHaveLength(2);
      expect(forest.map(q => q.id).sort()).toEqual(['q1', 'q2']);
      expect(desert).toHaveLength(1);
      expect(desert[0].id).toBe('q3');
    });

    it('查询不存在的 boardId 返回空数组', async () => {
      await questDbService.saveQuestDefinition(makeDefinition({ boardId: 'forest' }));
      const result = await questDbService.getQuestDefinitionsByBoard('non-existent');
      expect(result).toEqual([]);
    });
  });

  describe('deleteQuestDefinition / clearAllQuestDefinitions', () => {
    it('删除指定定义后再读返回 null', async () => {
      await questDbService.saveQuestDefinition(makeDefinition({ id: 'del' }));
      expect(await questDbService.getQuestDefinition('del')).not.toBeNull();

      await questDbService.deleteQuestDefinition('del');
      expect(await questDbService.getQuestDefinition('del')).toBeNull();
    });

    it('clearAllQuestDefinitions 清空后 getAllQuestDefinitions 返回空数组', async () => {
      await questDbService.saveQuestDefinition(makeDefinition({ id: 'a' }));
      await questDbService.saveQuestDefinition(makeDefinition({ id: 'b' }));

      await questDbService.clearAllQuestDefinitions();
      expect(await questDbService.getAllQuestDefinitions()).toEqual([]);
    });
  });
});
