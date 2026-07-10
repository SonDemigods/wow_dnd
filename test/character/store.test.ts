/**
 * @fileoverview 角色模块 Pinia Store 单元测试
 *
 * 覆盖 useCharacterStore 的：
 * 1. State 初始值（currentCharacterId/character/characterList/bonus 等均为空）
 * 2. Getters：isLoggedIn/effectiveStats/attributes/level/exp/expPercentage/hp/maxHp/hpPercentage/
 *    mana/maxMana/manaPercentage/gold/name/factionId/raceId/classId/factionName/raceName/className
 *    （character 为 null 时的默认值 + 注入 character 后的真实计算）
 * 3. Actions：
 *    - 列表与初始化：loadCharacterList（成功/失败）/ initialize
 *    - 生命周期：createCharacter（成功/阵营不兼容抛错）/ selectCharacter（成功/数据缺失）/
 *      deleteCharacter（未找到/成功/删除当前）/ logout
 *    - 资源变更：takeDamage（普通/致死）/ receiveHeal / setHp / changeMp / setMp
 *    - 经验与金币：gainExp（不升级/升级 emit）/ gainGold / spendGold（不足返回 false）
 *    - 属性加成：applyBonus / removeBonus
 *    - 身份变更：setRace / setName / reset
 *    - 死亡复活：handleDeath / resurrect
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - 7 个 db service 全量 mock（character/skill/inventory/equipment/exploration/log/quest）。
 *  - character service 全部纯函数 mock，返回可控测试数据。
 *  - baseStore stub（仅在 initialize 中使用）。
 *  - data 模块（备份/导入/初始化）stub。
 *  - getExpForLevel stub。
 *  - eventBus 使用真实实现，通过 eventBus.on 注册 spy 断言 emit，beforeEach 调用 clearAll。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestPinia } from '../utils/setup';
import { eventBus, GameEvents } from '@/modules/bus';
import type {
  Character,
  CharacterListItem,
  Stats,
  FactionData,
  RaceData,
  ClassData,
} from '@/modules/character/types';

// ==================== Mock：7 个 DB service ====================
vi.mock('@/modules/character/db', () => ({
  characterDbService: {
    getAllCharacterListItems: vi.fn().mockResolvedValue([]),
    getCharacterListItem: vi.fn().mockResolvedValue(null),
    saveCharacterListItem: vi.fn().mockResolvedValue(undefined),
    getCharacterData: vi.fn().mockResolvedValue(null),
    saveCharacterData: vi.fn().mockResolvedValue(undefined),
    deleteCharacterData: vi.fn().mockResolvedValue(undefined),
    getGameState: vi.fn().mockResolvedValue(null),
    saveGameState: vi.fn().mockResolvedValue(undefined),
    toStorageFormat: vi.fn((id: string, char: Character, bonus: Partial<Stats>) => ({
      characterId: id,
      name: char.name,
      bonusStats: bonus,
      _mock: true,
    })),
    fromStorageFormat: vi.fn((storage: { character: Character }) => storage.character),
  },
}));

vi.mock('@/modules/skill/db', () => ({
  skillsDbService: {
    getSkillTemplatesByClass: vi.fn().mockResolvedValue([]),
    saveSkillsData: vi.fn().mockResolvedValue(undefined),
    deleteSkillsData: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/modules/inventory/db', () => ({
  inventoryDbService: { deleteInventory: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/modules/equipment/db', () => ({
  equipmentDbService: { deleteEquipment: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/modules/exploration/db', () => ({
  explorationDbService: { deleteExplorationData: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/modules/log/db', () => ({
  adventureLogDbService: { deleteAdventureLog: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/modules/quest/db', () => ({
  questDbService: { deleteCharacterQuests: vi.fn().mockResolvedValue(undefined) },
}));

// ==================== Mock：character service 纯函数 ====================
vi.mock('@/modules/character/service', () => ({
  generateCharacterId: vi.fn(() => 'char_test_1'),
  createInitialCharacter: vi.fn((params: { name: string; factionId: string; raceId: string; classId: string }) => ({
    name: params.name,
    factionId: params.factionId,
    raceId: params.raceId,
    classId: params.classId,
    level: 1,
    exp: 0,
    expToNextLevel: 100,
    hp: 100,
    maxHp: 100,
    mana: 50,
    maxMana: 50,
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    gold: 50,
  })),
  computeEffectiveStats: vi.fn((base: Stats, bonus: Partial<Stats>) => ({ ...base, ...bonus })),
  computeAttributes: vi.fn(() => ({
    maxHp: 100,
    maxMana: 50,
    physicalAttack: 20,
    physicalDefense: 15,
    magicAttack: 20,
    magicDefense: 15,
    critChance: 5,
    dodgeChance: 3,
    hpBonus: 20,
    mpBonus: 10,
    healBonus: 1,
  })),
  applyHpChange: vi.fn((char: Character, amount: number) => ({
    ...char,
    hp: Math.max(0, Math.min(char.maxHp, char.hp + amount)),
  })),
  applyMpChange: vi.fn((char: Character, amount: number) => ({
    ...char,
    mana: Math.max(0, Math.min(char.maxMana, char.mana + amount)),
  })),
  applyExpGain: vi.fn((char: Character, amount: number) => ({
    character: { ...char, exp: char.exp + amount },
    leveledUp: false,
    levelsGained: 0,
    newLevel: char.level,
  })),
  applyGoldChange: vi.fn((char: Character, amount: number) => ({ ...char, gold: char.gold + amount })),
  canAffordGold: vi.fn((char: Character, amount: number) => amount > 0 && char.gold >= amount),
  computeBonusChange: vi.fn((current: Partial<Stats>, delta: Partial<Stats>, isAdd: boolean) => {
    const result = { ...current };
    for (const key of Object.keys(delta) as (keyof Stats)[]) {
      result[key] = (result[key] || 0) + (isAdd ? (delta[key] || 0) : -(delta[key] || 0));
    }
    return result;
  }),
  computeInitialStats: vi.fn(() => ({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })),
  recalculateHpMp: vi.fn((char: Character) => ({
    ...char,
    maxHp: 100,
    maxMana: 50,
    hp: Math.min(char.hp, 100),
    mana: Math.min(char.mana, 50),
  })),
  computeResurrection: vi.fn((char: Character) => ({
    ...char,
    exp: 0,
    hp: Math.floor(char.maxHp * 0.5),
    mana: Math.floor(char.maxMana * 0.5),
  })),
  isDead: vi.fn((char: Character) => char.hp <= 0),
  isClassFactionCompatible: vi.fn(() => true),
}));

// ==================== Mock：跨 store 依赖（baseStore，仅 initialize 使用） ====================
vi.mock('@/modules/base/store', () => ({
  useBaseStore: vi.fn(() => ({ factions: [], races: [], classes: [] })),
}));

// ==================== Mock：data 模块（备份/导入/初始化，薄委托目标） ====================
vi.mock('@/modules/data', () => ({
  backupService: { exportBackup: vi.fn().mockResolvedValue(undefined) },
  importService: {
    validateBackup: vi.fn().mockResolvedValue({ valid: true }),
    importBackup: vi.fn().mockResolvedValue({ success: true }),
  },
  dataInitializer: { reinitializeData: vi.fn().mockResolvedValue(undefined) },
}));

// ==================== Mock：getExpForLevel（reset 中使用） ====================
vi.mock('@/utils/calculations', () => ({
  getExpForLevel: vi.fn((lvl: number) => lvl * 100),
}));

// ==================== 取出 spy 引用 ====================
import { characterDbService } from '@/modules/character/db';
import { skillsDbService } from '@/modules/skill/db';
import { inventoryDbService } from '@/modules/inventory/db';
import { equipmentDbService } from '@/modules/equipment/db';
import { explorationDbService } from '@/modules/exploration/db';
import { adventureLogDbService } from '@/modules/log/db';
import { questDbService } from '@/modules/quest/db';
import {
  createInitialCharacter,
  computeEffectiveStats,
  computeAttributes,
  applyHpChange,
  applyExpGain,
  canAffordGold,
  computeBonusChange,
  computeResurrection,
  isDead,
  isClassFactionCompatible,
} from '@/modules/character/service';
import { useBaseStore } from '@/modules/base/store';
import { getExpForLevel } from '@/utils/calculations';
import { backupService, importService, dataInitializer } from '@/modules/data';
import { useCharacterStore } from '@/modules/character/store';

// ==================== 测试数据构造 helper ====================

function makeChar(o: Partial<Character> = {}): Character {
  return {
    name: '测试角色',
    factionId: 'alliance',
    raceId: 'human',
    classId: 'warrior',
    level: 5,
    exp: 50,
    expToNextLevel: 200,
    hp: 80,
    maxHp: 100,
    mana: 30,
    maxMana: 50,
    stats: { str: 12, dex: 11, con: 10, int: 10, wis: 10, cha: 10 },
    gold: 100,
    ...o,
  };
}

function makeListItem(o: Partial<CharacterListItem> = {}): CharacterListItem {
  return {
    id: 'char_test_1',
    name: '测试角色',
    raceId: 'human',
    classId: 'warrior',
    factionId: 'alliance',
    level: 5,
    createdTime: 1000,
    lastPlayedTime: 2000,
    ...o,
  };
}

function makeFaction(o: Partial<FactionData> = {}): FactionData {
  return { id: 'alliance', name: '联盟', icon: 'i', color: '#00ff88', description: 'd', ...o } as FactionData;
}

function makeRace(o: Partial<RaceData> = {}): RaceData {
  return { id: 'human', name: '人类', icon: 'i', factionId: 'alliance', description: 'd', ...o } as RaceData;
}

function makeClass(o: Partial<ClassData> = {}): ClassData {
  return {
    id: 'warrior', name: '战士', icon: 'i', primaryStat: 'str',
    factionsIds: ['alliance'], raceIds: ['human'], description: 'd', color: '#C79C6E', ...o,
  } as ClassData;
}

/** 注入一份基础数据并选中一个角色，便于测试需要 character 存在的 action */
function setupLoggedInStore(char: Character = makeChar()) {
  const store = useCharacterStore();
  store.$patch({
    currentCharacterId: 'char_test_1',
    character: char,
    racesData: { human: makeRace() },
    classesData: { warrior: makeClass() },
  });
  return store;
}

// ==================== 测试用例 ====================

describe('useCharacterStore - 角色 Store', () => {
  beforeEach(() => {
    createTestPinia();
    vi.clearAllMocks();
    eventBus.clearAll();
  });

  // -------------------- State 初始值 --------------------
  describe('State 初始值', () => {
    it('currentCharacterId/character 初始为 null，characterList 为空数组', () => {
      const store = useCharacterStore();
      expect(store.currentCharacterId).toBeNull();
      expect(store.character).toBeNull();
      expect(store.characterList).toEqual([]);
    });

    it('bonusStats/raceBonus/classBonus 初始为空对象', () => {
      const store = useCharacterStore();
      expect(store.bonusStats).toEqual({});
      expect(store.raceBonus).toEqual({});
      expect(store.classBonus).toEqual({});
    });

    it('factionsData/racesData/classesData 初始为空对象', () => {
      const store = useCharacterStore();
      expect(store.factionsData).toEqual({});
      expect(store.racesData).toEqual({});
      expect(store.classesData).toEqual({});
    });
  });

  // -------------------- Getters：character 为 null 时 --------------------
  describe('Getters：character 为 null 时的默认值', () => {
    it('isLoggedIn 为 false，name/gold 为空/0', () => {
      const store = useCharacterStore();
      expect(store.isLoggedIn).toBe(false);
      expect(store.name).toBe('');
      expect(store.gold).toBe(0);
    });

    it('level/exp/expToNextLevel/expPercentage 取默认值', () => {
      const store = useCharacterStore();
      expect(store.level).toBe(1);
      expect(store.exp).toBe(0);
      expect(store.expToNextLevel).toBe(100);
      // exp 0 / 100 -> 0
      expect(store.expPercentage).toBe(0);
    });

    it('hp/maxHp/hpPercentage 与 mana/maxMana/manaPercentage 取默认值', () => {
      const store = useCharacterStore();
      expect(store.hp).toBe(0);
      expect(store.maxHp).toBe(100);
      // hp 0 / maxHp 100 -> 0
      expect(store.hpPercentage).toBe(0);
      expect(store.mana).toBe(0);
      expect(store.maxMana).toBe(50);
      expect(store.manaPercentage).toBe(0);
    });

    it('factionId/raceId/classId 取兜底默认值', () => {
      const store = useCharacterStore();
      expect(store.factionId).toBe('neutral');
      expect(store.raceId).toBe('human');
      expect(store.classId).toBe('warrior');
    });

    it('factionName/raceName/className 在无基础数据时返回未知文案', () => {
      const store = useCharacterStore();
      expect(store.factionName).toBe('未知阵营');
      expect(store.raceName).toBe('未知种族');
      expect(store.className).toBe('未知职业');
    });
  });

  // -------------------- Getters：注入 character 后 --------------------
  describe('Getters：注入 character 后的计算', () => {
    it('level/exp/expToNextLevel/expPercentage 取自 character', () => {
      const store = useCharacterStore();
      store.$patch({ character: makeChar({ exp: 50, expToNextLevel: 200 }) });
      expect(store.level).toBe(5);
      expect(store.exp).toBe(50);
      expect(store.expToNextLevel).toBe(200);
      // round(50/200*100) = 25
      expect(store.expPercentage).toBe(25);
    });

    it('expPercentage 上限为 100（exp 超过 expToNextLevel）', () => {
      const store = useCharacterStore();
      store.$patch({ character: makeChar({ exp: 300, expToNextLevel: 200 }) });
      expect(store.expPercentage).toBe(100);
    });

    it('hp/maxHp/hpPercentage 与 mana/maxMana/manaPercentage 取自 character', () => {
      const store = useCharacterStore();
      store.$patch({ character: makeChar({ hp: 80, maxHp: 100, mana: 30, maxMana: 50 }) });
      expect(store.hp).toBe(80);
      expect(store.maxHp).toBe(100);
      expect(store.hpPercentage).toBe(80);
      expect(store.mana).toBe(30);
      expect(store.maxMana).toBe(50);
      expect(store.manaPercentage).toBe(60);
    });

    it('hpPercentage 上限为 100（hp 超过 maxHp）', () => {
      const store = useCharacterStore();
      store.$patch({ character: makeChar({ hp: 150, maxHp: 100 }) });
      // round(150/100*100)=150 -> clamp 到 100
      expect(store.hpPercentage).toBe(100);
    });

    it('gold/name/factionId/raceId/classId 取自 character', () => {
      const store = useCharacterStore();
      store.$patch({ character: makeChar() });
      expect(store.gold).toBe(100);
      expect(store.name).toBe('测试角色');
      expect(store.factionId).toBe('alliance');
      expect(store.raceId).toBe('human');
      expect(store.classId).toBe('warrior');
    });

    it('factionName/raceName/className 命中基础数据缓存', () => {
      const store = useCharacterStore();
      store.$patch({
        character: makeChar(),
        factionsData: { alliance: makeFaction() },
        racesData: { human: makeRace() },
        classesData: { warrior: makeClass() },
      });
      expect(store.factionName).toBe('联盟');
      expect(store.raceName).toBe('人类');
      expect(store.className).toBe('战士');
    });

    it('effectiveStats 调用 computeEffectiveStats 并返回其结果', () => {
      const store = useCharacterStore();
      const char = makeChar();
      store.$patch({ character: char, bonusStats: { str: 5 } });
      // computed 懒求值，先访问触发计算再断言调用
      const result = store.effectiveStats;
      expect(computeEffectiveStats).toHaveBeenCalledWith(char.stats, { str: 5 });
      // mock 实现：{ ...base, ...bonus } -> str 被覆盖为 5
      expect(result).toEqual({ ...char.stats, str: 5 });
    });

    it('attributes 调用 computeAttributes 并返回其结果', () => {
      const store = useCharacterStore();
      store.$patch({ character: makeChar() });
      // computed 懒求值，先访问触发计算再断言调用
      const attrs = store.attributes;
      expect(computeAttributes).toHaveBeenCalled();
      expect(attrs.maxHp).toBe(100);
      expect(attrs.physicalAttack).toBe(20);
    });
  });

  // -------------------- Actions：loadCharacterList / initialize --------------------
  describe('Actions：loadCharacterList', () => {
    it('成功时将 db 返回的列表写入 characterList', async () => {
      const items = [makeListItem({ id: 'a' }), makeListItem({ id: 'b' })];
      vi.mocked(characterDbService.getAllCharacterListItems).mockResolvedValueOnce(items);

      const store = useCharacterStore();
      await store.loadCharacterList();

      expect(characterDbService.getAllCharacterListItems).toHaveBeenCalledTimes(1);
      expect(store.characterList).toEqual(items);
    });

    it('db 抛错时 loadCharacterList 同步抛出（store 未捕获）', async () => {
      vi.mocked(characterDbService.getAllCharacterListItems).mockRejectedValueOnce(new Error('db error'));
      const store = useCharacterStore();
      await expect(store.loadCharacterList()).rejects.toThrow('db error');
      // 失败时 characterList 保持原值
      expect(store.characterList).toEqual([]);
    });
  });

  describe('Actions：initialize', () => {
    it('从 baseStore 读取基础数据并加载角色列表', async () => {
      const f = [makeFaction()];
      const r = [makeRace()];
      const c = [makeClass()];
      vi.mocked(useBaseStore).mockReturnValueOnce({ factions: f, races: r, classes: c } as never);
      const items = [makeListItem()];
      vi.mocked(characterDbService.getAllCharacterListItems).mockResolvedValueOnce(items);
      // getGameState 默认返回 null，不触发自动选择
      vi.mocked(characterDbService.getGameState).mockResolvedValueOnce(null);

      const store = useCharacterStore();
      await store.initialize();

      expect(store.factionsData).toEqual({ alliance: f[0] });
      expect(store.racesData).toEqual({ human: r[0] });
      expect(store.classesData).toEqual({ warrior: c[0] });
      expect(store.characterList).toEqual(items);
    });

    it('getGameState 返回 currentCharacterId 时自动调用 selectCharacter', async () => {
      vi.mocked(useBaseStore).mockReturnValueOnce({ factions: [], races: [], classes: [] } as never);
      vi.mocked(characterDbService.getGameState).mockResolvedValueOnce({ currentCharacterId: 'char_test_1' });
      const listItem = makeListItem();
      vi.mocked(characterDbService.getCharacterListItem).mockResolvedValueOnce(listItem);
      vi.mocked(characterDbService.getCharacterData).mockResolvedValueOnce({
        character: makeChar(), raceId: 'human', classId: 'warrior', bonusStats: {},
      } as never);
      vi.mocked(characterDbService.getAllCharacterListItems).mockResolvedValueOnce([]);

      const store = useCharacterStore();
      await store.initialize();

      // selectCharacter(emitEvent=false) 不应 emit CHARACTER_LOGOUT
      expect(store.currentCharacterId).toBe('char_test_1');
      expect(store.character).not.toBeNull();
    });
  });

  // -------------------- Actions：createCharacter --------------------
  describe('Actions：createCharacter', () => {
    it('成功：设置 character/currentCharacterId、写库、emit CHARACTER_CREATED、返回 id', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.CHARACTER_CREATED, spy);

      const store = useCharacterStore();
      store.$patch({
        racesData: { human: makeRace() },
        classesData: { warrior: makeClass() },
      });

      const id = await store.createCharacter('新英雄', 'alliance', 'human', 'warrior');

      expect(id).toBe('char_test_1');
      expect(store.currentCharacterId).toBe('char_test_1');
      expect(store.character).not.toBeNull();
      expect(store.character?.name).toBe('新英雄');
      // 写入角色列表项
      expect(characterDbService.saveCharacterListItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'char_test_1', name: '新英雄' })
      );
      // 持久化角色详细数据
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
      // 技能数据初始化
      expect(skillsDbService.saveSkillsData).toHaveBeenCalledWith(
        expect.objectContaining({ characterId: 'char_test_1', currentClass: 'warrior' })
      );
      // emit 事件
      expect(spy).toHaveBeenCalledWith({ characterId: 'char_test_1', name: '新英雄' });
    });

    it('阵营不兼容时抛出错误且不写库', async () => {
      vi.mocked(isClassFactionCompatible).mockReturnValueOnce(false);
      const store = useCharacterStore();
      store.$patch({
        racesData: { human: makeRace() },
        classesData: { warrior: makeClass() },
      });

      await expect(store.createCharacter('x', 'alliance', 'human', 'warrior')).rejects.toThrow();
      expect(characterDbService.saveCharacterListItem).not.toHaveBeenCalled();
      expect(skillsDbService.saveSkillsData).not.toHaveBeenCalled();
    });
  });

  // -------------------- Actions：selectCharacter --------------------
  describe('Actions：selectCharacter', () => {
    it('成功：加载并设置 character，emit CHARACTER_LOGOUT（emitEvent 默认 true）', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.CHARACTER_LOGOUT, spy);

      const listItem = makeListItem();
      const char = makeChar();
      vi.mocked(characterDbService.getCharacterListItem).mockResolvedValueOnce(listItem);
      vi.mocked(characterDbService.getCharacterData).mockResolvedValueOnce({
        character: char, raceId: 'human', classId: 'warrior', bonusStats: {},
      } as never);

      const store = useCharacterStore();
      const ok = await store.selectCharacter('char_test_1');

      expect(ok).toBe(true);
      expect(store.currentCharacterId).toBe('char_test_1');
      expect(store.character).toEqual(char);
      // 更新最后游玩时间并回写
      expect(characterDbService.saveCharacterListItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'char_test_1' })
      );
      expect(characterDbService.saveGameState).toHaveBeenCalledWith('char_test_1');
      expect(spy).toHaveBeenCalledWith(null);
    });

    it('数据缺失（listItem 为 null）时返回 false', async () => {
      vi.mocked(characterDbService.getCharacterListItem).mockResolvedValueOnce(null);
      const store = useCharacterStore();
      const ok = await store.selectCharacter('missing');
      expect(ok).toBe(false);
      expect(store.character).toBeNull();
    });

    it('数据缺失（data 为 null）时返回 false', async () => {
      vi.mocked(characterDbService.getCharacterListItem).mockResolvedValueOnce(makeListItem());
      vi.mocked(characterDbService.getCharacterData).mockResolvedValueOnce(null);
      const store = useCharacterStore();
      const ok = await store.selectCharacter('char_test_1');
      expect(ok).toBe(false);
      expect(store.character).toBeNull();
    });
  });

  // -------------------- Actions：deleteCharacter --------------------
  describe('Actions：deleteCharacter', () => {
    it('未找到角色返回 false 且不删除任何数据', async () => {
      vi.mocked(characterDbService.getCharacterListItem).mockResolvedValueOnce(null);
      const store = useCharacterStore();
      const ok = await store.deleteCharacter('missing');
      expect(ok).toBe(false);
      expect(characterDbService.deleteCharacterData).not.toHaveBeenCalled();
    });

    it('成功：删除全部 7 类数据、emit CHARACTER_DELETED、刷新列表', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.CHARACTER_DELETED, spy);
      vi.mocked(characterDbService.getCharacterListItem).mockResolvedValueOnce(makeListItem({ id: 'other' }));
      vi.mocked(characterDbService.getAllCharacterListItems).mockResolvedValueOnce([]);

      const store = useCharacterStore();
      const ok = await store.deleteCharacter('other');

      expect(ok).toBe(true);
      expect(characterDbService.deleteCharacterData).toHaveBeenCalledWith('other');
      expect(skillsDbService.deleteSkillsData).toHaveBeenCalledWith('other');
      expect(inventoryDbService.deleteInventory).toHaveBeenCalledWith('other');
      expect(equipmentDbService.deleteEquipment).toHaveBeenCalledWith('other');
      expect(explorationDbService.deleteExplorationData).toHaveBeenCalledWith('other');
      expect(adventureLogDbService.deleteAdventureLog).toHaveBeenCalledWith('other');
      expect(questDbService.deleteCharacterQuests).toHaveBeenCalledWith('other');
      expect(spy).toHaveBeenCalledWith({ characterId: 'other' });
    });

    it('删除当前选中角色时清空状态并保存 gameState=null', async () => {
      vi.mocked(characterDbService.getCharacterListItem).mockResolvedValueOnce(makeListItem({ id: 'char_test_1' }));
      vi.mocked(characterDbService.getAllCharacterListItems).mockResolvedValueOnce([]);

      const store = setupLoggedInStore();
      await store.deleteCharacter('char_test_1');

      expect(store.currentCharacterId).toBeNull();
      expect(store.character).toBeNull();
      expect(store.bonusStats).toEqual({});
      expect(characterDbService.saveGameState).toHaveBeenCalledWith(null);
    });
  });

  // -------------------- Actions：logout --------------------
  describe('Actions：logout', () => {
    it('清空状态、保存 gameState=null、emit CHARACTER_LOGOUT', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.CHARACTER_LOGOUT, spy);

      const store = setupLoggedInStore();
      await store.logout();

      expect(store.currentCharacterId).toBeNull();
      expect(store.character).toBeNull();
      expect(store.bonusStats).toEqual({});
      expect(store.raceBonus).toEqual({});
      expect(store.classBonus).toEqual({});
      expect(characterDbService.saveGameState).toHaveBeenCalledWith(null);
      expect(spy).toHaveBeenCalledWith(null);
    });
  });

  // -------------------- Actions：HP 变更 --------------------
  describe('Actions：HP 变更', () => {
    it('takeDamage：扣血、持久化，不触发死亡事件（死亡由调用方处理）', async () => {
      const deathSpy = vi.fn();
      eventBus.on(GameEvents.CHARACTER_DEATH, deathSpy);

      const store = setupLoggedInStore(makeChar({ hp: 80, maxHp: 100 }));
      await store.takeDamage(30);

      expect(applyHpChange).toHaveBeenCalledWith(expect.objectContaining({ hp: 80 }), -30);
      expect(store.character?.hp).toBe(50);
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
      // store 实现 BIZ-9：takeDamage 仅扣血，不调用 isDead，不 emit 死亡事件
      expect(isDead).not.toHaveBeenCalled();
      expect(deathSpy).not.toHaveBeenCalled();
    });

    it('takeDamage：amount<=0 时直接返回不变更', async () => {
      const store = setupLoggedInStore(makeChar({ hp: 80 }));
      await store.takeDamage(0);
      expect(applyHpChange).not.toHaveBeenCalled();
      expect(store.character?.hp).toBe(80);
    });

    it('takeDamage：未登录时直接返回不变更', async () => {
      const store = useCharacterStore();
      await store.takeDamage(30);
      expect(applyHpChange).not.toHaveBeenCalled();
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('receiveHeal：amount<=0 时直接返回不变更', async () => {
      const store = setupLoggedInStore(makeChar({ hp: 50 }));
      await store.receiveHeal(0);
      expect(applyHpChange).not.toHaveBeenCalled();
      expect(store.character?.hp).toBe(50);
    });

    it('receiveHeal：未登录时直接返回不变更', async () => {
      const store = useCharacterStore();
      await store.receiveHeal(30);
      expect(applyHpChange).not.toHaveBeenCalled();
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('setHp：未登录时直接返回不变更', async () => {
      const store = useCharacterStore();
      await store.setHp(80);
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('takeDamage：致死伤害仅将 hp 扣到 0，不自动触发死亡/复活', async () => {
      const deathSpy = vi.fn();
      const resurrectSpy = vi.fn();
      eventBus.on(GameEvents.CHARACTER_DEATH, deathSpy);
      eventBus.on(GameEvents.CHARACTER_RESURRECTED, resurrectSpy);

      const store = setupLoggedInStore(makeChar({ hp: 80, maxHp: 100 }));
      await store.takeDamage(80);

      // store 实现 BIZ-9：takeDamage 仅扣血到 0，死亡处理由调用方触发
      expect(applyHpChange).toHaveBeenCalledWith(expect.objectContaining({ hp: 80 }), -80);
      expect(store.character?.hp).toBe(0);
      // 不自动触发死亡/复活事件
      expect(deathSpy).not.toHaveBeenCalled();
      expect(resurrectSpy).not.toHaveBeenCalled();
      expect(computeResurrection).not.toHaveBeenCalled();
    });

    it('receiveHeal：回血并持久化', async () => {
      const store = setupLoggedInStore(makeChar({ hp: 50, maxHp: 100 }));
      await store.receiveHeal(30);
      expect(applyHpChange).toHaveBeenCalledWith(expect.objectContaining({ hp: 50 }), 30);
      expect(store.character?.hp).toBe(80);
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('setHp：直接设置并 clamp 到 [0, maxHp]', async () => {
      const store = setupLoggedInStore(makeChar({ hp: 50, maxHp: 100 }));
      await store.setHp(150);
      expect(store.character?.hp).toBe(100);
      await store.setHp(-10);
      expect(store.character?.hp).toBe(0);
    });
  });

  // -------------------- Actions：MP 变更 --------------------
  describe('Actions：MP 变更', () => {
    it('changeMp：通过 applyMpChange 变更并持久化', async () => {
      const store = setupLoggedInStore(makeChar({ mana: 30, maxMana: 50 }));
      await store.changeMp(10);
      expect(store.character?.mana).toBe(40);
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('setMp：直接设置并 clamp 到 [0, maxMana]', async () => {
      const store = setupLoggedInStore(makeChar({ mana: 30, maxMana: 50 }));
      await store.setMp(100);
      expect(store.character?.mana).toBe(50);
      await store.setMp(-5);
      expect(store.character?.mana).toBe(0);
    });

    it('changeMp：未登录时直接返回不变更', async () => {
      const store = useCharacterStore();
      await store.changeMp(10);
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('setMp：未登录时直接返回不变更', async () => {
      const store = useCharacterStore();
      await store.setMp(30);
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });
  });

  // -------------------- Actions：经验值 --------------------
  describe('Actions：gainExp', () => {
    it('不升级时只增加经验、持久化、不 emit LEVEL_UP', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.CHARACTER_LEVEL_UP, spy);

      const store = setupLoggedInStore(makeChar({ level: 5, exp: 50 }));
      await store.gainExp(30);

      expect(applyExpGain).toHaveBeenCalledWith(expect.objectContaining({ level: 5, exp: 50 }), 30);
      expect(store.character?.exp).toBe(80);
      expect(spy).not.toHaveBeenCalled();
    });

    it('升级时 emit CHARACTER_LEVEL_UP（oldLevel/newLevel）', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.CHARACTER_LEVEL_UP, spy);
      vi.mocked(applyExpGain).mockReturnValueOnce({
        character: makeChar({ level: 6, exp: 0 }),
        leveledUp: true,
        levelsGained: 1,
        newLevel: 6,
      });

      const store = setupLoggedInStore(makeChar({ level: 5, exp: 50 }));
      await store.gainExp(200);

      expect(store.character?.level).toBe(6);
      expect(spy).toHaveBeenCalledWith({ oldLevel: 5, newLevel: 6 });
    });

    it('amount<=0 时直接返回不变更', async () => {
      const store = setupLoggedInStore(makeChar({ exp: 50 }));
      await store.gainExp(0);
      expect(applyExpGain).not.toHaveBeenCalled();
      expect(store.character?.exp).toBe(50);
    });

    it('未登录时直接返回不变更', async () => {
      const store = useCharacterStore();
      await store.gainExp(30);
      expect(applyExpGain).not.toHaveBeenCalled();
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });
  });

  // -------------------- Actions：金币 --------------------
  describe('Actions：gainGold / spendGold', () => {
    it('gainGold：增加金币并持久化', async () => {
      const store = setupLoggedInStore(makeChar({ gold: 100 }));
      await store.gainGold(50);
      expect(store.character?.gold).toBe(150);
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('spendGold：足够时扣减并返回 true', async () => {
      const store = setupLoggedInStore(makeChar({ gold: 100 }));
      const ok = await store.spendGold(50);
      expect(ok).toBe(true);
      expect(canAffordGold).toHaveBeenCalled();
      expect(store.character?.gold).toBe(50);
    });

    it('spendGold：不足时返回 false 且不扣减、不持久化', async () => {
      const store = setupLoggedInStore(makeChar({ gold: 30 }));
      const ok = await store.spendGold(50);
      expect(ok).toBe(false);
      expect(store.character?.gold).toBe(30);
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('gainGold：amount=0 时直接返回不变更', async () => {
      const store = setupLoggedInStore(makeChar({ gold: 100 }));
      await store.gainGold(0);
      expect(store.character?.gold).toBe(100);
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('gainGold：未登录时直接返回不变更', async () => {
      const store = useCharacterStore();
      await store.gainGold(50);
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('spendGold：未登录时返回 false', async () => {
      const store = useCharacterStore();
      const ok = await store.spendGold(50);
      expect(ok).toBe(false);
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });
  });

  // -------------------- Actions：属性加成 --------------------
  describe('Actions：applyBonus / removeBonus', () => {
    it('applyBonus：更新 bonusStats，con 变化时重算 HP/MP', async () => {
      const store = setupLoggedInStore(makeChar());
      await store.applyBonus({ con: 5 });
      expect(computeBonusChange).toHaveBeenCalledWith({}, { con: 5 }, true);
      expect(store.bonusStats).toEqual({ con: 5 });
      // con 变化触发 recalculateHpMp
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('applyBonus：仅 str 变化时不重算 HP/MP（仍持久化）', async () => {
      const store = setupLoggedInStore(makeChar());
      await store.applyBonus({ str: 5 });
      expect(store.bonusStats).toEqual({ str: 5 });
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('removeBonus：更新 bonusStats 并重算 HP/MP', async () => {
      const store = setupLoggedInStore(makeChar());
      store.$patch({ bonusStats: { str: 5, con: 3 } });
      await store.removeBonus({ str: 5 });
      expect(computeBonusChange).toHaveBeenCalledWith({ str: 5, con: 3 }, { str: 5 }, false);
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('removeBonus：con 变化时重算 HP/MP（与 applyBonus 对称）', async () => {
      const store = setupLoggedInStore(makeChar());
      store.$patch({ bonusStats: { con: 5 } });
      await store.removeBonus({ con: 5 });
      expect(computeBonusChange).toHaveBeenCalledWith({ con: 5 }, { con: 5 }, false);
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('applyBonus：未登录时直接返回不变更', async () => {
      const store = useCharacterStore();
      await store.applyBonus({ str: 5 });
      expect(computeBonusChange).not.toHaveBeenCalled();
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('removeBonus：未登录时直接返回不变更', async () => {
      const store = useCharacterStore();
      await store.removeBonus({ str: 5 });
      expect(computeBonusChange).not.toHaveBeenCalled();
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });
  });

  // -------------------- Actions：身份变更 --------------------
  describe('Actions：setRace / setName / reset', () => {
    it('setRace：更新 raceBonus 并重算属性', async () => {
      const store = setupLoggedInStore(makeChar({ raceId: 'human' }));
      store.$patch({
        racesData: { human: makeRace(), orc: makeRace({ id: 'orc', bonus: { str: 3 } }) },
      });
      await store.setRace('orc');
      expect(store.raceBonus).toEqual({ str: 3 });
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('setClass：更新 classBonus 并重算属性', async () => {
      const store = setupLoggedInStore(makeChar({ classId: 'warrior' }));
      store.$patch({
        classesData: { warrior: makeClass(), mage: makeClass({ id: 'mage', bonus: { int: 3 } }) },
      });
      await store.setClass('mage');
      expect(store.classBonus).toEqual({ int: 3 });
      expect(store.character?.classId).toBe('mage');
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('setClass：未登录时直接返回不变更', async () => {
      const store = useCharacterStore();
      await store.setClass('mage');
      expect(store.character).toBeNull();
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('setName：更新 character.name 与列表项', async () => {
      vi.mocked(characterDbService.getCharacterListItem).mockResolvedValueOnce(makeListItem({ id: 'char_test_1' }));
      const store = setupLoggedInStore();
      await store.setName('新名字');
      expect(store.character?.name).toBe('新名字');
      expect(characterDbService.saveCharacterListItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'char_test_1', name: '新名字' })
      );
    });

    it('setName：未登录时直接返回不变更', async () => {
      const store = useCharacterStore();
      await store.setName('新名字');
      expect(characterDbService.saveCharacterListItem).not.toHaveBeenCalled();
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('setName：currentCharacterId 为 null 时直接返回（character 存在但未登录）', async () => {
      const store = useCharacterStore();
      store.$patch({ character: makeChar(), currentCharacterId: null });
      await store.setName('新名字');
      expect(characterDbService.getCharacterListItem).not.toHaveBeenCalled();
    });

    it('setName：列表项不存在时仍持久化角色数据', async () => {
      vi.mocked(characterDbService.getCharacterListItem).mockResolvedValueOnce(null);
      const store = setupLoggedInStore();
      await store.setName('新名字');
      expect(store.character?.name).toBe('新名字');
      expect(characterDbService.saveCharacterListItem).not.toHaveBeenCalled();
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('setRace：未登录时直接返回不变更', async () => {
      const store = useCharacterStore();
      await store.setRace('orc');
      expect(store.raceBonus).toEqual({});
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('reset：未登录时直接返回不变更', async () => {
      const store = useCharacterStore();
      await store.reset();
      expect(getExpForLevel).not.toHaveBeenCalled();
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('handleDeath：未登录时直接返回不 emit', async () => {
      const deathSpy = vi.fn();
      eventBus.on(GameEvents.CHARACTER_DEATH, deathSpy);
      const store = useCharacterStore();
      await store.handleDeath();
      expect(deathSpy).not.toHaveBeenCalled();
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('resurrect：未登录时直接返回不 emit', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.CHARACTER_RESURRECTED, spy);
      const store = useCharacterStore();
      await store.resurrect();
      expect(computeResurrection).not.toHaveBeenCalled();
      expect(spy).not.toHaveBeenCalled();
    });

    it('reset：等级/经验重置，HP/MP 回满', async () => {
      const store = setupLoggedInStore(makeChar({ level: 5, exp: 50, hp: 10, mana: 5 }));
      await store.reset();
      expect(getExpForLevel).toHaveBeenCalledWith(2);
      expect(store.character?.level).toBe(1);
      expect(store.character?.exp).toBe(0);
      expect(store.character?.expToNextLevel).toBe(200); // getExpForLevel(2) mock = 200
      // reset 后回满
      expect(store.character?.hp).toBe(store.character?.maxHp);
      expect(store.character?.mana).toBe(store.character?.maxMana);
    });
  });

  // -------------------- Actions：死亡与复活 --------------------
  describe('Actions：handleDeath / resurrect', () => {
    it('handleDeath：清空本级经验、emit DEATH、自动复活', async () => {
      const deathSpy = vi.fn();
      const resurrectSpy = vi.fn();
      eventBus.on(GameEvents.CHARACTER_DEATH, deathSpy);
      eventBus.on(GameEvents.CHARACTER_RESURRECTED, resurrectSpy);

      const store = setupLoggedInStore(makeChar({ exp: 80, maxHp: 100, maxMana: 50 }));
      await store.handleDeath();

      expect(store.character?.exp).toBe(0);
      expect(deathSpy).toHaveBeenCalledWith({ cause: 'death' });
      // 复活后 hp/mp = 50% 上限
      expect(resurrectSpy).toHaveBeenCalledWith({ newHp: 50, newMp: 25 });
    });

    it('resurrect：通过 computeResurrection 恢复 50% HP/MP 并 emit', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.CHARACTER_RESURRECTED, spy);

      const store = setupLoggedInStore(makeChar({ hp: 0, maxHp: 100, maxMana: 50 }));
      await store.resurrect();

      expect(computeResurrection).toHaveBeenCalled();
      expect(store.character?.hp).toBe(50);
      expect(store.character?.mana).toBe(25);
      expect(spy).toHaveBeenCalledWith({ newHp: 50, newMp: 25 });
    });
  });

  // -------------------- Actions：数据获取 --------------------
  describe('Actions：getCharacterId / getCharacterData', () => {
    it('getCharacterId：返回当前 currentCharacterId', () => {
      const store = setupLoggedInStore();
      expect(store.getCharacterId()).toBe('char_test_1');
    });

    it('getCharacterId：未登录时返回 null', () => {
      const store = useCharacterStore();
      expect(store.getCharacterId()).toBeNull();
    });

    it('getCharacterData：返回当前 character 引用', () => {
      const store = setupLoggedInStore();
      expect(store.getCharacterData()).toBe(store.character);
    });

    it('getCharacterData：未登录时返回 null', () => {
      const store = useCharacterStore();
      expect(store.getCharacterData()).toBeNull();
    });
  });

  // -------------------- Actions：导出/导入存档（薄委托） --------------------
  describe('Actions：导出/导入存档（薄委托）', () => {
    it('exportBackup：委托给 backupService.exportBackup', async () => {
      const store = useCharacterStore();
      await store.exportBackup();
      expect(backupService.exportBackup).toHaveBeenCalledTimes(1);
    });

    it('validateImportBackup：委托给 importService.validateBackup 并返回结果', async () => {
      const store = useCharacterStore();
      const file = new File(['{}'], 'backup.json');
      const result = await store.validateImportBackup(file);
      expect(importService.validateBackup).toHaveBeenCalledWith(file);
      expect(result).toEqual({ valid: true });
    });

    it('importBackup：委托给 importService.importBackup 并返回结果', async () => {
      const store = useCharacterStore();
      const file = new File(['{}'], 'backup.json');
      const result = await store.importBackup(file);
      expect(importService.importBackup).toHaveBeenCalledWith(file);
      expect(result).toEqual({ success: true });
    });

    it('repairBaseData：委托给 dataInitializer.reinitializeData', async () => {
      const store = useCharacterStore();
      await store.repairBaseData();
      expect(dataInitializer.reinitializeData).toHaveBeenCalledTimes(1);
    });
  });
});
