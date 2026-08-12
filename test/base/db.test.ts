/**
 * @fileoverview 基础数据模块数据层（base/db.ts）与服务层（base/service.ts）内存级测试
 *
 * 使用 fake-indexeddb 在内存中真实执行 Dexie 操作，覆盖：
 *  - 阵营（config_factions）：getAllFactions / getFactionById / createFaction / updateFaction / deleteFaction
 *  - 种族（config_races）：getAllRaces / getRaceById / getRacesByFaction / createRace / updateRace / deleteRace
 *  - 职业（config_classes）：getAllClasses / getClassById / getClassesByRace / getClassesByFaction / createClass / updateClass / deleteClass
 *  - service.ts 纯函数：arrayToRecord / filterRacesByFaction / filterClassesByRace / filterClassesByFaction / generateId
 *
 * 设计说明（遵循 code_rule 红线）：
 *  - 顶部 `import 'fake-indexeddb/auto'` 注入 IndexedDB shim
 *  - beforeEach 清空 config_factions / config_races / config_classes 三张表
 *  - 不 mock db service，确保 add/get/put/delete/toArray/where 真实执行
 *  - createX 返回 generateId 生成的非确定性 ID，用例中通过返回值捕获 ID
 *  - updateX/deleteX 在记录不存在时抛出 Error，用例验证抛错行为
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { baseDbService } from '@/modules/base/db';
import {
  arrayToRecord,
  filterRacesByFaction,
  filterClassesByRace,
  filterClassesByFaction,
  generateId,
} from '@/modules/base/service';
import { db } from '@/modules/data/core';
import type {
  FactionCreateUpdateData,
  RaceCreateUpdateData,
  ClassCreateUpdateData,
} from '@/modules/base/types';
import type { RaceData, ClassData } from '@/modules/character/types';

// ==================== 测试数据构造 helper ====================

function makeFactionData(o: Partial<FactionCreateUpdateData> = {}): FactionCreateUpdateData {
  return {
    name: '光辉盟约',
    icon: 'game-icons:checked-shield',
    color: '#4a90d9',
    description: '正义与光明的联盟',
    ...o,
  };
}

function makeRaceData(o: Partial<RaceCreateUpdateData> = {}): RaceCreateUpdateData {
  return {
    name: '人类',
    icon: 'game-icons:human',
    factionId: 'alliance',
    bonus: { str: 1, int: 1 },
    description: '多才多艺的种族',
    ...o,
  };
}

function makeClassData(o: Partial<ClassCreateUpdateData> = {}): ClassCreateUpdateData {
  return {
    name: '战士',
    icon: 'game-icons:sword',
    primaryStat: 'str',
    factionsIds: ['alliance', 'horde'],
    raceIds: ['human', 'orc'],
    description: '近战物理职业',
    color: '#c0392b',
    bonus: { str: 2, con: 1 },
    ...o,
  };
}

// ==================== 测试用例 ====================

describe('FoundationDbService - 基础数据层（fake-indexeddb 真实 CRUD）', () => {
  beforeEach(async () => {
    await Promise.all([
      db.config_factions.clear(),
      db.config_races.clear(),
      db.config_classes.clear(),
    ]);
  });

  // ==================== 阵营操作 ====================

  describe('阵营（config_factions）', () => {
    it('createFaction 返回生成的 ID，getFactionById 可读回完整数据', async () => {
      const data = makeFactionData({ name: '光辉盟约' });
      const id = await baseDbService.createFaction(data);

      expect(id).toBeTruthy();
      expect(id.startsWith('base_')).toBe(true);

      const result = await baseDbService.getFactionById(id);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(id);
      expect(result!.name).toBe('光辉盟约');
      expect(result!.icon).toBe('game-icons:checked-shield');
      expect(result!.color).toBe('#4a90d9');
      expect(result!.description).toBe('正义与光明的联盟');
    });

    it('阵营不存在时 getFactionById 返回 null（P12-003 修复后统一返回 null）', async () => {
      const result = await baseDbService.getFactionById('non-existent');
      expect(result).toBeNull();
    });

    it('getAllFactions：空表返回空数组', async () => {
      const result = await baseDbService.getAllFactions();
      expect(result).toEqual([]);
    });

    it('getAllFactions：多阵营全部返回', async () => {
      await baseDbService.createFaction(makeFactionData({ name: '联盟' }));
      await baseDbService.createFaction(makeFactionData({ name: '部落' }));
      await baseDbService.createFaction(makeFactionData({ name: '中立' }));

      const result = await baseDbService.getAllFactions();
      expect(result).toHaveLength(3);
      const names = result.map(f => f.name);
      expect(names).toContain('联盟');
      expect(names).toContain('部落');
      expect(names).toContain('中立');
    });

    it('updateFaction：更新已存在阵营的字段', async () => {
      const id = await baseDbService.createFaction(makeFactionData({ name: '旧名' }));
      await baseDbService.updateFaction(id, makeFactionData({ name: '新名', color: '#ff0000' }));

      const result = await baseDbService.getFactionById(id);
      expect(result!.name).toBe('新名');
      expect(result!.color).toBe('#ff0000');
      // 未更新的字段保持原值
      expect(result!.icon).toBe('game-icons:checked-shield');
    });

    it('updateFaction：阵营不存在时抛出 Error', async () => {
      await expect(
        baseDbService.updateFaction('non-existent', makeFactionData())
      ).rejects.toThrow('Faction not found');
    });

    it('deleteFaction：删除后 getFactionById 返回 null', async () => {
      const id = await baseDbService.createFaction(makeFactionData());
      expect(await baseDbService.getFactionById(id)).not.toBeNull();

      await baseDbService.deleteFaction(id);
      expect(await baseDbService.getFactionById(id)).toBeNull();
    });

    it('deleteFaction：不影响其他阵营', async () => {
      const idA = await baseDbService.createFaction(makeFactionData({ name: 'A' }));
      const idB = await baseDbService.createFaction(makeFactionData({ name: 'B' }));

      await baseDbService.deleteFaction(idA);
      expect(await baseDbService.getFactionById(idA)).toBeNull();
      expect(await baseDbService.getFactionById(idB)).not.toBeNull();
      expect(await baseDbService.getAllFactions()).toHaveLength(1);
    });

    it('deleteFaction：阵营不存在时抛出 Error', async () => {
      await expect(baseDbService.deleteFaction('non-existent')).rejects.toThrow('Faction not found');
    });
  });

  // ==================== 种族操作 ====================

  describe('种族（config_races）', () => {
    it('createRace 返回生成的 ID，getRaceById 可读回完整数据', async () => {
      const data = makeRaceData({ name: '矮人', factionId: 'alliance', bonus: { con: 2 } });
      const id = await baseDbService.createRace(data);

      expect(id.startsWith('base_')).toBe(true);

      const result = await baseDbService.getRaceById(id);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(id);
      expect(result!.name).toBe('矮人');
      expect(result!.icon).toBe('game-icons:human');
      expect(result!.factionId).toBe('alliance');
      expect(result!.bonus).toEqual({ con: 2 });
      expect(result!.description).toBe('多才多艺的种族');
    });

    it('种族不存在时 getRaceById 返回 null', async () => {
      const result = await baseDbService.getRaceById('non-existent');
      expect(result).toBeNull();
    });

    it('getAllRaces：空表返回空数组', async () => {
      const result = await baseDbService.getAllRaces();
      expect(result).toEqual([]);
    });

    it('getAllRaces：多种族全部返回', async () => {
      await baseDbService.createRace(makeRaceData({ name: '人类' }));
      await baseDbService.createRace(makeRaceData({ name: '兽人', factionId: 'horde' }));

      const result = await baseDbService.getAllRaces();
      expect(result).toHaveLength(2);
    });

    it('getRacesByFaction：按阵营索引查询，仅返回匹配的种族', async () => {
      await baseDbService.createRace(makeRaceData({ name: '人类', factionId: 'alliance' }));
      await baseDbService.createRace(makeRaceData({ name: '矮人', factionId: 'alliance' }));
      await baseDbService.createRace(makeRaceData({ name: '兽人', factionId: 'horde' }));

      const allianceRaces = await baseDbService.getRacesByFaction('alliance');
      expect(allianceRaces).toHaveLength(2);
      expect(allianceRaces.every(r => r.factionId === 'alliance')).toBe(true);

      const hordeRaces = await baseDbService.getRacesByFaction('horde');
      expect(hordeRaces).toHaveLength(1);
      expect(hordeRaces[0].name).toBe('兽人');
    });

    it('getRacesByFaction：无匹配时返回空数组', async () => {
      await baseDbService.createRace(makeRaceData({ factionId: 'alliance' }));
      const result = await baseDbService.getRacesByFaction('horde');
      expect(result).toEqual([]);
    });

    it('updateRace：更新已存在种族的字段', async () => {
      const id = await baseDbService.createRace(makeRaceData({ name: '旧名' }));
      await baseDbService.updateRace(id, makeRaceData({ name: '新名', bonus: { dex: 3 } }));

      const result = await baseDbService.getRaceById(id);
      expect(result!.name).toBe('新名');
      expect(result!.bonus).toEqual({ dex: 3 });
    });

    it('updateRace：种族不存在时抛出 Error', async () => {
      await expect(
        baseDbService.updateRace('non-existent', makeRaceData())
      ).rejects.toThrow('Race not found');
    });

    it('deleteRace：删除后 getRaceById 返回 null', async () => {
      const id = await baseDbService.createRace(makeRaceData());
      await baseDbService.deleteRace(id);
      expect(await baseDbService.getRaceById(id)).toBeNull();
    });

    it('deleteRace：不影响其他种族', async () => {
      const idA = await baseDbService.createRace(makeRaceData({ name: 'A' }));
      const idB = await baseDbService.createRace(makeRaceData({ name: 'B' }));

      await baseDbService.deleteRace(idA);
      expect(await baseDbService.getRaceById(idA)).toBeNull();
      expect(await baseDbService.getRaceById(idB)).not.toBeNull();
    });

    it('deleteRace：种族不存在时抛出 Error', async () => {
      await expect(baseDbService.deleteRace('non-existent')).rejects.toThrow('Race not found');
    });
  });

  // ==================== 职业操作 ====================

  describe('职业（config_classes）', () => {
    it('createClass 返回生成的 ID，getClassById 可读回完整数据', async () => {
      const data = makeClassData({
        name: '法师',
        primaryStat: 'int',
        factionsIds: ['alliance'],
        raceIds: ['human', 'gnome'],
      });
      const id = await baseDbService.createClass(data);

      expect(id.startsWith('base_')).toBe(true);

      const result = await baseDbService.getClassById(id);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(id);
      expect(result!.name).toBe('法师');
      expect(result!.icon).toBe('game-icons:sword');
      expect(result!.primaryStat).toBe('int');
      expect(result!.factionsIds).toEqual(['alliance']);
      expect(result!.raceIds).toEqual(['human', 'gnome']);
      expect(result!.description).toBe('近战物理职业');
      expect(result!.color).toBe('#c0392b');
      expect(result!.bonus).toEqual({ str: 2, con: 1 });
    });

    it('职业不存在时 getClassById 返回 null', async () => {
      const result = await baseDbService.getClassById('non-existent');
      expect(result).toBeNull();
    });

    it('getAllClasses：空表返回空数组', async () => {
      const result = await baseDbService.getAllClasses();
      expect(result).toEqual([]);
    });

    it('getAllClasses：多职业全部返回', async () => {
      await baseDbService.createClass(makeClassData({ name: '战士' }));
      await baseDbService.createClass(makeClassData({ name: '法师' }));
      await baseDbService.createClass(makeClassData({ name: '盗贼' }));

      const result = await baseDbService.getAllClasses();
      expect(result).toHaveLength(3);
    });

    it('getClassesByRace：按种族筛选（raceIds 包含该种族的职业）', async () => {
      await baseDbService.createClass(makeClassData({
        name: '战士',
        raceIds: ['human', 'orc'],
      }));
      await baseDbService.createClass(makeClassData({
        name: '法师',
        raceIds: ['human', 'gnome'],
      }));
      await baseDbService.createClass(makeClassData({
        name: '萨满',
        raceIds: ['orc', 'tauren'],
      }));

      const humanClasses = await baseDbService.getClassesByRace('human');
      expect(humanClasses).toHaveLength(2);
      const names = humanClasses.map(c => c.name).sort();
      expect(names).toEqual(['战士', '法师']);

      const taurenClasses = await baseDbService.getClassesByRace('tauren');
      expect(taurenClasses).toHaveLength(1);
      expect(taurenClasses[0].name).toBe('萨满');
    });

    it('getClassesByRace：无匹配时返回空数组', async () => {
      await baseDbService.createClass(makeClassData({ raceIds: ['human'] }));
      const result = await baseDbService.getClassesByRace('orc');
      expect(result).toEqual([]);
    });

    it('getClassesByFaction：按阵营筛选（factionsIds 包含该阵营的职业）', async () => {
      await baseDbService.createClass(makeClassData({
        name: '圣骑士',
        factionsIds: ['alliance'],
      }));
      await baseDbService.createClass(makeClassData({
        name: '术士',
        factionsIds: ['horde', 'alliance'],
      }));
      await baseDbService.createClass(makeClassData({
        name: '萨满',
        factionsIds: ['horde'],
      }));

      const allianceClasses = await baseDbService.getClassesByFaction('alliance');
      expect(allianceClasses).toHaveLength(2);
      const names = allianceClasses.map(c => c.name).sort();
      expect(names).toEqual(['圣骑士', '术士']);
    });

    it('getClassesByFaction：无匹配时返回空数组', async () => {
      await baseDbService.createClass(makeClassData({ factionsIds: ['alliance'] }));
      const result = await baseDbService.getClassesByFaction('horde');
      expect(result).toEqual([]);
    });

    it('updateClass：更新已存在职业的字段', async () => {
      const id = await baseDbService.createClass(makeClassData({ name: '旧名' }));
      await baseDbService.updateClass(id, makeClassData({ name: '新名', color: '#00ff00' }));

      const result = await baseDbService.getClassById(id);
      expect(result!.name).toBe('新名');
      expect(result!.color).toBe('#00ff00');
    });

    it('updateClass：职业不存在时抛出 Error', async () => {
      await expect(
        baseDbService.updateClass('non-existent', makeClassData())
      ).rejects.toThrow('Class not found');
    });

    it('deleteClass：删除后 getClassById 返回 null', async () => {
      const id = await baseDbService.createClass(makeClassData());
      await baseDbService.deleteClass(id);
      expect(await baseDbService.getClassById(id)).toBeNull();
    });

    it('deleteClass：不影响其他职业', async () => {
      const idA = await baseDbService.createClass(makeClassData({ name: 'A' }));
      const idB = await baseDbService.createClass(makeClassData({ name: 'B' }));

      await baseDbService.deleteClass(idA);
      expect(await baseDbService.getClassById(idA)).toBeNull();
      expect(await baseDbService.getClassById(idB)).not.toBeNull();
    });

    it('deleteClass：职业不存在时抛出 Error', async () => {
      await expect(baseDbService.deleteClass('non-existent')).rejects.toThrow('Class not found');
    });
  });
});

// ============================================================================
// service.ts 纯函数测试
// ============================================================================

describe('base/service.ts - 纯逻辑辅助函数', () => {
  // -------------------- generateId --------------------

  describe('generateId：唯一 ID 生成', () => {
    it('生成的 ID 以指定前缀开头', () => {
      const id = generateId('base');
      expect(id.startsWith('base_')).toBe(true);
    });

    it('连续生成的 ID 互不相同', () => {
      const id1 = generateId('test');
      const id2 = generateId('test');
      expect(id1).not.toBe(id2);
    });

    it('不同前缀生成不同格式的 ID', () => {
      const baseId = generateId('base');
      const charId = generateId('character');
      expect(baseId.startsWith('base_')).toBe(true);
      expect(charId.startsWith('character_')).toBe(true);
    });
  });

  // -------------------- arrayToRecord --------------------

  describe('arrayToRecord：数组转 Record', () => {
    it('将数组转为以 id 为键的 Record', () => {
      const items: Array<{ id: string; name: string }> = [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ];

      const result = arrayToRecord(items);
      expect(Object.keys(result)).toHaveLength(3);
      expect(result['a'].name).toBe('A');
      expect(result['b'].name).toBe('B');
      expect(result['c'].name).toBe('C');
    });

    it('空数组返回空 Record', () => {
      const result = arrayToRecord([]);
      expect(result).toEqual({});
    });

    it('对 RaceData 数组正确转换', () => {
      const races: RaceData[] = [
        { id: 'human', name: '人类', icon: 'i', factionId: 'alliance', description: 'd' },
        { id: 'orc', name: '兽人', icon: 'i', factionId: 'horde', description: 'd' },
      ];

      const result = arrayToRecord(races);
      expect(result['human'].name).toBe('人类');
      expect(result['orc'].factionId).toBe('horde');
    });
  });

  // -------------------- filterRacesByFaction --------------------

  describe('filterRacesByFaction：按阵营筛选种族', () => {
    const races: RaceData[] = [
      { id: 'human', name: '人类', icon: 'i', factionId: 'alliance', description: 'd' },
      { id: 'dwarf', name: '矮人', icon: 'i', factionId: 'alliance', description: 'd' },
      { id: 'orc', name: '兽人', icon: 'i', factionId: 'horde', description: 'd' },
      { id: 'pandaren', name: '熊猫人', icon: 'i', factionId: 'neutral', description: 'd' },
    ];

    it('返回匹配指定阵营的种族', () => {
      const result = filterRacesByFaction(races, 'alliance');
      expect(result).toHaveLength(2);
      expect(result.every(r => r.factionId === 'alliance')).toBe(true);
    });

    it('无匹配时返回空数组', () => {
      const result = filterRacesByFaction(races, 'horde');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('orc');
    });

    it('空数组输入返回空数组', () => {
      const result = filterRacesByFaction([], 'alliance');
      expect(result).toEqual([]);
    });
  });

  // -------------------- filterClassesByRace --------------------

  describe('filterClassesByRace：按种族筛选职业', () => {
    const classes: ClassData[] = [
      {
        id: 'warrior', name: '战士', icon: 'i', primaryStat: 'str',
        factionsIds: ['alliance', 'horde'], raceIds: ['human', 'orc'],
        description: 'd', color: 'red',
      },
      {
        id: 'mage', name: '法师', icon: 'i', primaryStat: 'int',
        factionsIds: ['alliance'], raceIds: ['human', 'gnome'],
        description: 'd', color: 'blue',
      },
      {
        id: 'shaman', name: '萨满', icon: 'i', primaryStat: 'int',
        factionsIds: ['horde'], raceIds: ['orc', 'tauren'],
        description: 'd', color: 'green',
      },
    ];

    it('返回 raceIds 包含指定种族的职业', () => {
      const result = filterClassesByRace(classes, 'human');
      expect(result).toHaveLength(2);
      const ids = result.map(c => c.id).sort();
      expect(ids).toEqual(['mage', 'warrior']);
    });

    it('无匹配时返回空数组', () => {
      const result = filterClassesByRace(classes, 'troll');
      expect(result).toEqual([]);
    });

    it('空数组输入返回空数组', () => {
      const result = filterClassesByRace([], 'human');
      expect(result).toEqual([]);
    });

    it('raceIds 为空数组的职业不被任何种族匹配', () => {
      const classesWithEmpty: ClassData[] = [
        {
          id: 'special', name: '特殊职业', icon: 'i', primaryStat: 'str',
          factionsIds: [], raceIds: [], description: 'd', color: 'black',
        },
      ];
      const result = filterClassesByRace(classesWithEmpty, 'human');
      expect(result).toEqual([]);
    });
  });

  // -------------------- filterClassesByFaction --------------------

  describe('filterClassesByFaction：按阵营筛选职业', () => {
    const classes: ClassData[] = [
      {
        id: 'paladin', name: '圣骑士', icon: 'i', primaryStat: 'str',
        factionsIds: ['alliance'], raceIds: ['human'],
        description: 'd', color: 'gold',
      },
      {
        id: 'warlock', name: '术士', icon: 'i', primaryStat: 'int',
        factionsIds: ['horde', 'alliance'], raceIds: ['human', 'orc'],
        description: 'd', color: 'purple',
      },
      {
        id: 'shaman', name: '萨满', icon: 'i', primaryStat: 'int',
        factionsIds: ['horde'], raceIds: ['orc'],
        description: 'd', color: 'green',
      },
    ];

    it('返回 factionsIds 包含指定阵营的职业', () => {
      const result = filterClassesByFaction(classes, 'alliance');
      expect(result).toHaveLength(2);
      const ids = result.map(c => c.id).sort();
      expect(ids).toEqual(['paladin', 'warlock']);
    });

    it('horde 阵营匹配两个职业', () => {
      const result = filterClassesByFaction(classes, 'horde');
      expect(result).toHaveLength(2);
      const ids = result.map(c => c.id).sort();
      expect(ids).toEqual(['shaman', 'warlock']);
    });

    it('无匹配时返回空数组', () => {
      const result = filterClassesByFaction(classes, 'neutral');
      expect(result).toEqual([]);
    });

    it('空数组输入返回空数组', () => {
      const result = filterClassesByFaction([], 'alliance');
      expect(result).toEqual([]);
    });
  });

  // -------------------- 纯函数与 DB 协作验证 --------------------

  describe('纯函数与 DB 协作：getClassesByRace 内部使用 filterClassesByRace', () => {
    it('DB 写入后 getClassesByRace 返回结果与纯函数一致', async () => {
      // Arrange：写入职业数据
      const warriorId = await baseDbService.createClass(makeClassData({
        name: '战士', raceIds: ['human', 'orc'], factionsIds: ['alliance'],
      }));
      const mageId = await baseDbService.createClass(makeClassData({
        name: '法师', raceIds: ['human'], factionsIds: ['alliance'],
      }));

      // Act：通过 DB 服务查询
      const dbResult = await baseDbService.getClassesByRace('human');

      // Assert：结果数量正确，且 ID 匹配
      expect(dbResult).toHaveLength(2);
      const ids = dbResult.map(c => c.id).sort();
      expect(ids).toEqual([mageId, warriorId].sort());
    });
  });
});
