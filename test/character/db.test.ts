/**
 * @fileoverview 角色模块数据层（character/db.ts）内存级 CRUD 测试
 *
 * 使用 fake-indexeddb 在内存中真实执行 Dexie 操作，覆盖：
 *  - saveCharacterListItem / getCharacterListItem / getAllCharacterListItems：列表项读写
 *  - saveCharacterData / getCharacterData / deleteCharacterData：完整角色数据 CRUD
 *  - saveGameState / getGameState：当前选中角色 ID 持久化
 *  - toStorageFormat / fromStorageFormat：运行时 ↔ 存储格式字段映射
 *  - saveCharacterListItem 合并语义：仅更新列表字段，保留已有详情字段
 *
 * 设计说明（遵循 code_rule 红线）：
 *  - 顶部 `import 'fake-indexeddb/auto'` 注入 IndexedDB shim
 *  - beforeEach 清空 char_data 与 runtime_gameState 表
 *  - 不 mock db service，确保 put/get/delete/toArray 真实执行
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { characterDbService } from '@/modules/character/db';
import { db } from '@/modules/data/core';
import { POINTS_PER_LEVEL } from '@/config/character';
import type {
  Character,
  CharacterListItem,
  CharacterDataStorage,
  Stats,
  RaceType,
  ClassType,
  FactionType,
} from '@/modules/character/types';

// ==================== 测试数据构造 helper ====================

const baseStats: Stats = { str: 12, dex: 10, con: 14, int: 8, wis: 9, cha: 11 };

function makeCharacter(o: Partial<Character> = {}): Character {
  return {
    name: '阿尔萨斯',
    factionId: 'alliance',
    raceId: 'human',
    classId: 'paladin',
    level: 10,
    exp: 500,
    expToNextLevel: 1000,
    hp: 80,
    maxHp: 100,
    mana: 30,
    maxMana: 50,
    stats: { ...baseStats },
    // 四层属性模型（plan.md §3.2）：默认新角色无药剂、无升级分配
    potionStats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    allocatedStats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    unallocatedPoints: 0,
    gold: 250,
    ...o,
  };
}

function makeListItem(o: Partial<CharacterListItem> = {}): CharacterListItem {
  return {
    id: 'char-1',
    name: '阿尔萨斯',
    raceId: 'human' as RaceType,
    classId: 'paladin' as ClassType,
    factionId: 'alliance' as FactionType,
    level: 10,
    createdTime: 1700000000000,
    lastPlayedTime: 1700000001000,
    ...o,
  };
}

function makeStorageData(o: Partial<CharacterDataStorage> = {}): CharacterDataStorage {
  return {
    characterId: 'char-1',
    name: '阿尔萨斯',
    factionId: 'alliance',
    raceId: 'human',
    classId: 'paladin',
    level: 10,
    exp: 500,
    expToNextLevel: 1000,
    gold: 250,
    baseStats: { ...baseStats },
    // 四层属性新字段：默认新格式（含字段，不触发旧存档迁移）
    // 单独的"旧存档迁移"测试用例通过 ...o 覆盖为 undefined 验证迁移行为
    potionStats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    allocatedStats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    unallocatedPoints: 0,
    currentHp: 80,
    maxHp: 100,
    currentMp: 30,
    maxMp: 50,
    bonusStats: { str: 2 },
    createdTime: 1700000000000,
    lastPlayedTime: 1700000001000,
    updatedAt: 1700000002000,
    ...o,
  };
}

// ==================== 测试用例 ====================

describe('CharacterDbService - 角色数据层（fake-indexeddb 真实 CRUD）', () => {
  beforeEach(async () => {
    await Promise.all([
      db.char_data.clear(),
      db.runtime_gameState.clear(),
    ]);
  });

  // -------------------- saveCharacterListItem / getCharacterListItem --------------------

  describe('saveCharacterListItem / getCharacterListItem：列表项读写', () => {
    it('保存列表项后可读回完整字段', async () => {
      const item = makeListItem();
      await characterDbService.saveCharacterListItem(item);

      const result = await characterDbService.getCharacterListItem('char-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('char-1');
      expect(result!.name).toBe('阿尔萨斯');
      expect(result!.raceId).toBe('human');
      expect(result!.classId).toBe('paladin');
      expect(result!.factionId).toBe('alliance');
      expect(result!.level).toBe(10);
      expect(result!.createdTime).toBe(1700000000000);
      expect(result!.lastPlayedTime).toBe(1700000001000);
    });

    it('角色不存在时 getCharacterListItem 返回 null', async () => {
      const result = await characterDbService.getCharacterListItem('non-existent');
      expect(result).toBeNull();
    });

    it('覆盖保存：相同 ID 再次保存，新数据替换旧数据', async () => {
      await characterDbService.saveCharacterListItem(makeListItem({ name: '旧名', level: 5 }));
      await characterDbService.saveCharacterListItem(makeListItem({ name: '新名', level: 20 }));

      const result = await characterDbService.getCharacterListItem('char-1');
      expect(result!.name).toBe('新名');
      expect(result!.level).toBe(20);
    });

    it('saveCharacterListItem 仅更新列表字段，保留已有详情字段', async () => {
      // 先写入完整角色数据
      const fullData = makeStorageData({ characterId: 'char-merge', currentHp: 50, maxHp: 100 });
      await characterDbService.saveCharacterData(fullData);

      // 再写入列表项（应保留 currentHp/maxHp 等详情字段）
      await characterDbService.saveCharacterListItem(makeListItem({ id: 'char-merge', name: '更新名' }));

      const stored = await characterDbService.getCharacterData('char-merge');
      expect(stored).not.toBeNull();
      // 列表字段被更新
      expect(stored!.name).toBe('更新名');
      // 详情字段被保留
      expect(stored!.currentHp).toBe(50);
      expect(stored!.maxHp).toBe(100);
    });

    it('直接通过 Dexie 验证写入字段含 updatedAt 时间戳', async () => {
      await characterDbService.saveCharacterListItem(makeListItem({ id: 'char-ts' }));
      const raw = await db.char_data.get('char-ts');
      expect(raw).toBeDefined();
      expect(raw!.updatedAt).toBeTypeOf('number');
      expect(raw!.characterId).toBe('char-ts');
    });
  });

  // -------------------- getAllCharacterListItems --------------------

  describe('getAllCharacterListItems：批量读取', () => {
    it('空表返回空数组', async () => {
      const result = await characterDbService.getAllCharacterListItems();
      expect(result).toEqual([]);
    });

    it('多角色并存，全部返回', async () => {
      await characterDbService.saveCharacterListItem(makeListItem({ id: 'char-a', name: 'A' }));
      await characterDbService.saveCharacterListItem(makeListItem({ id: 'char-b', name: 'B' }));
      await characterDbService.saveCharacterListItem(makeListItem({ id: 'char-c', name: 'C' }));

      const result = await characterDbService.getAllCharacterListItems();
      expect(result).toHaveLength(3);
      const ids = result.map(c => c.id).sort();
      expect(ids).toEqual(['char-a', 'char-b', 'char-c']);
    });
  });

  // -------------------- saveCharacterData / getCharacterData --------------------

  describe('saveCharacterData / getCharacterData：完整角色数据读写', () => {
    it('保存完整数据后可读回所有字段', async () => {
      const data = makeStorageData({ characterId: 'char-full' });
      await characterDbService.saveCharacterData(data);

      const result = await characterDbService.getCharacterData('char-full');
      expect(result).not.toBeNull();
      expect(result!.characterId).toBe('char-full');
      expect(result!.name).toBe('阿尔萨斯');
      expect(result!.factionId).toBe('alliance');
      expect(result!.raceId).toBe('human');
      expect(result!.classId).toBe('paladin');
      expect(result!.level).toBe(10);
      expect(result!.exp).toBe(500);
      expect(result!.expToNextLevel).toBe(1000);
      expect(result!.gold).toBe(250);
      expect(result!.baseStats).toEqual(baseStats);
      expect(result!.currentHp).toBe(80);
      expect(result!.maxHp).toBe(100);
      expect(result!.currentMp).toBe(30);
      expect(result!.maxMp).toBe(50);
      expect(result!.bonusStats).toEqual({ str: 2 });
    });

    it('角色不存在时 getCharacterData 返回 undefined（Dexie get 未找到返回 undefined）', async () => {
      const result = await characterDbService.getCharacterData('non-existent');
      expect(result).toBeUndefined();
    });

    it('覆盖保存：相同 ID 再次保存，新数据替换旧数据', async () => {
      await characterDbService.saveCharacterData(makeStorageData({ characterId: 'dup', level: 5, gold: 100 }));
      await characterDbService.saveCharacterData(makeStorageData({ characterId: 'dup', level: 30, gold: 5000 }));

      const result = await characterDbService.getCharacterData('dup');
      expect(result!.level).toBe(30);
      expect(result!.gold).toBe(5000);
    });
  });

  // -------------------- deleteCharacterData --------------------

  describe('deleteCharacterData：删除角色数据', () => {
    it('删除已存在角色后，getCharacterData 返回 undefined', async () => {
      await characterDbService.saveCharacterData(makeStorageData({ characterId: 'del' }));
      expect(await characterDbService.getCharacterData('del')).not.toBeUndefined();

      await characterDbService.deleteCharacterData('del');
      expect(await characterDbService.getCharacterData('del')).toBeUndefined();
    });

    it('删除不影响其他角色', async () => {
      await characterDbService.saveCharacterData(makeStorageData({ characterId: 'a', name: 'A' }));
      await characterDbService.saveCharacterData(makeStorageData({ characterId: 'b', name: 'B' }));

      await characterDbService.deleteCharacterData('a');
      expect(await characterDbService.getCharacterData('a')).toBeUndefined();
      expect(await characterDbService.getCharacterData('b')).not.toBeUndefined();
    });

    it('删除不存在的角色不抛错', async () => {
      await expect(characterDbService.deleteCharacterData('non-existent')).resolves.toBeUndefined();
    });
  });

  // P3-116：getGameState / saveGameState 已迁移到 GameStore，本模块不再持有这两个方法
  // 相关测试用例已删除（GameState 读写测试见 test/game/store.test.ts）

  // -------------------- toStorageFormat / fromStorageFormat 字段映射 --------------------

  describe('toStorageFormat / fromStorageFormat：字段映射转换', () => {
    it('toStorageFormat：Character → CharacterDataStorage 字段名正确映射', () => {
      const character = makeCharacter({
        name: '测试角色',
        hp: 75,
        maxHp: 120,
        mana: 25,
        maxMana: 60,
        stats: { str: 15, dex: 12, con: 13, int: 10, wis: 8, cha: 14 },
        createdTime: 1700000005000,
      });
      const bonusStats: Partial<Stats> = { str: 3, dex: 1 };

      const storage = characterDbService.toStorageFormat('char-map', character, bonusStats);

      expect(storage.characterId).toBe('char-map');
      expect(storage.name).toBe('测试角色');
      expect(storage.factionId).toBe('alliance');
      expect(storage.raceId).toBe('human');
      expect(storage.classId).toBe('paladin');
      expect(storage.level).toBe(10);
      expect(storage.exp).toBe(500);
      expect(storage.expToNextLevel).toBe(1000);
      expect(storage.gold).toBe(250);
      // 字段名映射：stats → baseStats
      expect(storage.baseStats).toEqual({ str: 15, dex: 12, con: 13, int: 10, wis: 8, cha: 14 });
      // 字段名映射：hp → currentHp
      expect(storage.currentHp).toBe(75);
      expect(storage.maxHp).toBe(120);
      // 字段名映射：mana → currentMp
      expect(storage.currentMp).toBe(25);
      expect(storage.maxMp).toBe(60);
      expect(storage.bonusStats).toEqual({ str: 3, dex: 1 });
      // createdTime 从 Character 透传
      expect(storage.createdTime).toBe(1700000005000);
      // lastPlayedTime 与 updatedAt 为运行时生成的时间戳
      expect(storage.lastPlayedTime).toBeTypeOf('number');
      expect(storage.updatedAt).toBeTypeOf('number');
    });

    it('toStorageFormat：createdTime 缺失时兜底使用 Date.now()', () => {
      const character = makeCharacter({ createdTime: undefined });
      const before = Date.now();
      const storage = characterDbService.toStorageFormat('char-no-ct', character, {});
      const after = Date.now();

      expect(storage.createdTime).toBeGreaterThanOrEqual(before);
      expect(storage.createdTime).toBeLessThanOrEqual(after);
    });

    it('fromStorageFormat：CharacterDataStorage → Character 字段名反向映射', () => {
      const storage = makeStorageData({
        characterId: 'char-rev',
        currentHp: 65,
        maxHp: 110,
        currentMp: 20,
        maxMp: 55,
        baseStats: { str: 20, dex: 15, con: 18, int: 12, wis: 10, cha: 16 },
      });

      const character = characterDbService.fromStorageFormat(storage);

      expect(character.name).toBe('阿尔萨斯');
      expect(character.factionId).toBe('alliance');
      expect(character.raceId).toBe('human');
      expect(character.classId).toBe('paladin');
      expect(character.level).toBe(10);
      expect(character.exp).toBe(500);
      expect(character.expToNextLevel).toBe(1000);
      // 字段名反向映射：currentHp → hp
      expect(character.hp).toBe(65);
      expect(character.maxHp).toBe(110);
      // 字段名反向映射：currentMp → mana
      expect(character.mana).toBe(20);
      expect(character.maxMana).toBe(55);
      // 字段名反向映射：baseStats → stats
      expect(character.stats).toEqual({ str: 20, dex: 15, con: 18, int: 12, wis: 10, cha: 16 });
      expect(character.gold).toBe(250);
    });

    it('toStorageFormat → fromStorageFormat 往返一致（除时间戳外）', () => {
      const original = makeCharacter({
        name: '往返测试',
        hp: 90,
        maxHp: 150,
        mana: 40,
        maxMana: 80,
        stats: { str: 18, dex: 14, con: 16, int: 11, wis: 13, cha: 12 },
        createdTime: 1700000008000,
      });
      const bonus: Partial<Stats> = { con: 2 };

      const storage = characterDbService.toStorageFormat('char-rt', original, bonus);
      const restored = characterDbService.fromStorageFormat(storage);

      // 往返后所有 Character 字段应一致
      expect(restored.name).toBe(original.name);
      expect(restored.factionId).toBe(original.factionId);
      expect(restored.raceId).toBe(original.raceId);
      expect(restored.classId).toBe(original.classId);
      expect(restored.level).toBe(original.level);
      expect(restored.exp).toBe(original.exp);
      expect(restored.expToNextLevel).toBe(original.expToNextLevel);
      expect(restored.hp).toBe(original.hp);
      expect(restored.maxHp).toBe(original.maxHp);
      expect(restored.mana).toBe(original.mana);
      expect(restored.maxMana).toBe(original.maxMana);
      expect(restored.stats).toEqual(original.stats);
      expect(restored.gold).toBe(original.gold);
    });
  });

  // -------------------- 四层属性：旧存档迁移 --------------------
  describe('fromStorageFormat：旧存档迁移（plan.md §7.1）', () => {
    it('旧存档（无 potionStats）：反推 baseStats 并补发 unallocatedPoints', () => {
      // 旧存档 5 级，baseStats 含等级加成（每级全属性 +1，5 级已加 4 次）
      // baseStats = { str: 14, dex: 12, con: 13, int: 11, wis: 11, cha: 11 }
      // 反推后 = baseStats - 4 = { str: 10, dex: 8, con: 9, int: 7, wis: 7, cha: 7 }
      const storage = makeStorageData({
        level: 5,
        baseStats: { str: 14, dex: 12, con: 13, int: 11, wis: 11, cha: 11 },
        // 通过设为 undefined 触发旧存档迁移分支
        potionStats: undefined,
        allocatedStats: undefined,
        unallocatedPoints: undefined,
      } as Partial<CharacterDataStorage>);

      const character = characterDbService.fromStorageFormat(storage as CharacterDataStorage);

      // 反推剥离等级加成
      expect(character.stats).toEqual({ str: 10, dex: 8, con: 9, int: 7, wis: 7, cha: 7 });
      // 旧存档无药剂/无升级分配，初始化为全 0
      expect(character.potionStats).toEqual({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
      expect(character.allocatedStats).toEqual({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
      // 补发 (level - 1) * POINTS_PER_LEVEL = 4 * 3 = 12 点
      expect(character.unallocatedPoints).toBe(12);
    });

    it('旧存档迁移后 maxHp/maxMana 基于反推后的 con/int 重算', () => {
      // 旧存档 5 级，baseStats.con = 13 → 反推后 con = 9 → maxHp = 100 + 9*10 = 190
      const storage = makeStorageData({
        level: 5,
        baseStats: { str: 14, dex: 12, con: 13, int: 11, wis: 11, cha: 11 },
        maxHp: 230, // 旧 maxHp 基于旧 con=13 算出（100+13*10=230），迁移后失效
        currentHp: 200,
        maxMp: 100,
        currentMp: 80,
        potionStats: undefined,
        allocatedStats: undefined,
        unallocatedPoints: undefined,
      } as Partial<CharacterDataStorage>);

      const character = characterDbService.fromStorageFormat(storage as CharacterDataStorage);

      // con 反推为 9，maxHp = 100 + 9*10 = 190；currentHp 截断到新上限
      expect(character.maxHp).toBe(190);
      expect(character.hp).toBe(190); // 200 > 190，截断为 190
    });

    it('新存档（含 potionStats）：不触发迁移，字段直接透传', () => {
      const storage = makeStorageData({
        level: 8,
        baseStats: { str: 15, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
        potionStats: { str: 2, dex: 0, con: 1, int: 0, wis: 0, cha: 0 },
        allocatedStats: { str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
        unallocatedPoints: 5,
        maxHp: 220,
        currentHp: 180,
      });

      const character = characterDbService.fromStorageFormat(storage);

      // 直接透传，不反推
      expect(character.stats).toEqual({ str: 15, dex: 12, con: 12, int: 10, wis: 10, cha: 10 });
      expect(character.potionStats).toEqual({ str: 2, dex: 0, con: 1, int: 0, wis: 0, cha: 0 });
      expect(character.allocatedStats).toEqual({ str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 });
      expect(character.unallocatedPoints).toBe(5);
      // 新存档不重算 maxHp（信任存储值）
      expect(character.maxHp).toBe(220);
      expect(character.hp).toBe(180);
    });
  });
});
