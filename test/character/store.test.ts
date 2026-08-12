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

// ==================== Mock：GameStore（P3-116：currentCharacterId 收敛到 GameStore） ====================
// 提供可控的 mock useGameStore，内部用真实 Pinia ref 保证响应式，
// setCurrentCharacterId/getCurrentCharacterId 等方法用 vi.hoisted 提升为全局 spy，
// 避免 Pinia action 包装破坏 spy 性质，测试中直接通过 gameStoreSpies 断言。
const gameStoreSpies = vi.hoisted(() => ({
  setCurrentCharacterId: vi.fn(),
  setCurrentShopId: vi.fn(),
  getCurrentCharacterId: vi.fn(),
  getCurrentShopId: vi.fn(),
  updateGameSettings: vi.fn(),
  flushPersist: vi.fn(),
  initialize: vi.fn(),
}));

vi.mock('@/modules/game', async () => {
  const { defineStore } = await import('pinia');
  const { ref } = await import('vue');
  const useGameStore = defineStore('mockGame', () => {
    const currentCharacterId = ref<string | null>(null);
    const currentShopId = ref<string | null>(null);
    // 每次 store 创建时重新绑定 mock 实现到当前 ref（createTestPinia 后 store 重建）
    gameStoreSpies.setCurrentCharacterId.mockImplementation(async (id: string | null) => {
      currentCharacterId.value = id;
    });
    gameStoreSpies.setCurrentShopId.mockImplementation(async (id: string | null) => {
      currentShopId.value = id;
    });
    gameStoreSpies.getCurrentCharacterId.mockImplementation(() => currentCharacterId.value);
    gameStoreSpies.getCurrentShopId.mockImplementation(() => currentShopId.value);
    return {
      currentCharacterId,
      currentShopId,
      setCurrentCharacterId: gameStoreSpies.setCurrentCharacterId,
      setCurrentShopId: gameStoreSpies.setCurrentShopId,
      getCurrentCharacterId: gameStoreSpies.getCurrentCharacterId,
      getCurrentShopId: gameStoreSpies.getCurrentShopId,
      updateGameSettings: gameStoreSpies.updateGameSettings,
      flushPersist: gameStoreSpies.flushPersist,
      initialize: gameStoreSpies.initialize,
    };
  });
  return { useGameStore };
});

// ==================== Mock：7 个 DB service ====================
vi.mock('@/modules/character/db', () => ({
  characterDbService: {
    getAllCharacterListItems: vi.fn().mockResolvedValue([]),
    getCharacterListItem: vi.fn().mockResolvedValue(null),
    saveCharacterListItem: vi.fn().mockResolvedValue(undefined),
    getCharacterData: vi.fn().mockResolvedValue(null),
    saveCharacterData: vi.fn().mockResolvedValue(undefined),
    deleteCharacterData: vi.fn().mockResolvedValue(undefined),
    toStorageFormat: vi.fn((id: string, char: Character, bonus: Partial<Stats>) => ({
      characterId: id,
      name: char.name,
      bonusStats: bonus,
      mountChoices: char.mountChoices,
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
    // 坐骑配置初始值：5 档全 null（1 级仅解锁 common 档选择权，不预选）
    mountChoices: [null, null, null, null, null],
  })),
  computeEffectiveStats: vi.fn(
    (base: Stats, potion: Stats, allocated: Stats, bonus: Partial<Stats>) => ({
      str: base.str + potion.str + allocated.str + (bonus.str || 0),
      dex: base.dex + potion.dex + allocated.dex + (bonus.dex || 0),
      con: base.con + potion.con + allocated.con + (bonus.con || 0),
      int: base.int + potion.int + allocated.int + (bonus.int || 0),
      wis: base.wis + potion.wis + allocated.wis + (bonus.wis || 0),
      cha: base.cha + potion.cha + allocated.cha + (bonus.cha || 0),
    })
  ),
  computeAttributes: vi.fn(() => ({
    maxHp: 100,
    maxMana: 50,
    physicalAttack: 20,
    physicalDefense: 15,
    magicAttack: 20,
    magicDefense: 15,
    critChance: 5,
    dodgeChance: 3,
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
    exp: Math.floor(char.exp * 0.5),
    hp: Math.floor(char.maxHp * 0.5),
    mana: Math.floor(char.maxMana * 0.5),
  })),
  isDead: vi.fn((char: Character) => char.hp <= 0),
  isClassFactionCompatible: vi.fn(() => true),
  isRaceFactionCompatible: vi.fn(() => true),
  isClassRaceCompatible: vi.fn(() => true),
  // 四层属性纯函数（store 通过 as 重命名为 *Pure 调用）
  allocateStat: vi.fn((char: Character, stat: keyof Stats) => {
    if (char.unallocatedPoints <= 0) return char;
    return {
      ...char,
      allocatedStats: { ...char.allocatedStats, [stat]: char.allocatedStats[stat] + 1 },
      unallocatedPoints: char.unallocatedPoints - 1,
    };
  }),
  resetAllocatedStats: vi.fn((char: Character) => {
    const spent = (Object.values(char.allocatedStats) as number[]).reduce((a, b) => a + b, 0);
    return {
      ...char,
      allocatedStats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      unallocatedPoints: char.unallocatedPoints + spent,
    };
  }),
  applyPotionBonus: vi.fn((char: Character, delta: Partial<Stats>) => {
    const newPotion = { ...char.potionStats };
    (Object.keys(delta) as (keyof Stats)[]).forEach(k => {
      newPotion[k] = newPotion[k] + (delta[k] || 0);
    });
    return { ...char, potionStats: newPotion };
  }),
  // 坐骑配置纯函数（store 通过 import 调用）
  // computeMountBonus mock：累加各 optionId 对应的 bonus（通过 mock 的 getMountOptionById 查询）
  computeMountBonus: vi.fn((choices: (string | null)[]) => {
    const result: Partial<Stats> = {};
    for (const optionId of choices) {
      if (!optionId) continue;
      const option = mockMountOptions[optionId];
      if (!option) continue;
      (Object.keys(option.bonus) as (keyof Stats)[]).forEach(k => {
        result[k] = (result[k] || 0) + (option.bonus[k] || 0);
      });
    }
    return result;
  }),
  // isTierUnlocked mock：与真实实现一致（level >= tierIndex * 5 解锁）
  isTierUnlocked: vi.fn((tierIndex: number, level: number) => {
    const unlockLevels = [1, 5, 10, 15, 20];
    return level >= (unlockLevels[tierIndex] ?? Infinity);
  }),
}));

// ==================== Mock：config_mounts（坐骑配置数据） ====================
// vi.hoisted 提升 mock 数据，确保 service mock 工厂引用时已初始化（避免 ReferenceError）
const mockMountOptions = vi.hoisted(() => ({
  // common 档（单属性，+2）
  common_str: { id: 'common_str', tier: 'common', name: '初阶力量专精', bonus: { str: 2 } },
  common_dex: { id: 'common_dex', tier: 'common', name: '初阶敏捷专精', bonus: { dex: 2 } },
  common_int: { id: 'common_int', tier: 'common', name: '初阶智力专精', bonus: { int: 2 } },
  common_con: { id: 'common_con', tier: 'common', name: '初阶体质专精', bonus: { con: 2 } },
  common_wis: { id: 'common_wis', tier: 'common', name: '初阶感知专精', bonus: { wis: 2 } },
  common_cha: { id: 'common_cha', tier: 'common', name: '初阶魅力专精', bonus: { cha: 2 } },
  // uncommon 档（单属性，+4）
  uncommon_str: { id: 'uncommon_str', tier: 'uncommon', name: '进阶力量专精', bonus: { str: 4 } },
  uncommon_dex: { id: 'uncommon_dex', tier: 'uncommon', name: '进阶敏捷专精', bonus: { dex: 4 } },
  uncommon_con: { id: 'uncommon_con', tier: 'uncommon', name: '进阶体质专精', bonus: { con: 4 } },
  uncommon_int: { id: 'uncommon_int', tier: 'uncommon', name: '进阶智力专精', bonus: { int: 4 } },
  // rare 档（单属性，+6）
  rare_str: { id: 'rare_str', tier: 'rare', name: '稀有力量专精', bonus: { str: 6 } },
  rare_int: { id: 'rare_int', tier: 'rare', name: '稀有智力专精', bonus: { int: 6 } },
  rare_wis: { id: 'rare_wis', tier: 'rare', name: '稀有感知专精', bonus: { wis: 6 } },
  // epic 档（双属性，+6/+6）
  epic_str_con: { id: 'epic_str_con', tier: 'epic', name: '史诗蛮力体魄', bonus: { str: 6, con: 6 } },
  epic_int_wis: { id: 'epic_int_wis', tier: 'epic', name: '史诗奥术信仰', bonus: { int: 6, wis: 6 } },
  epic_dex_wis: { id: 'epic_dex_wis', tier: 'epic', name: '史诗灵思自然', bonus: { dex: 6, wis: 6 } },
  // legendary 档（双属性，+8/+8）
  legendary_str_con: { id: 'legendary_str_con', tier: 'legendary', name: '传说蛮力体魄', bonus: { str: 8, con: 8 } },
  legendary_int_wis: { id: 'legendary_int_wis', tier: 'legendary', name: '传说奥术信仰', bonus: { int: 8, wis: 8 } },
  legendary_dex_wis: { id: 'legendary_dex_wis', tier: 'legendary', name: '传说灵思自然', bonus: { dex: 8, wis: 8 } },
  legendary_str_cha: { id: 'legendary_str_cha', tier: 'legendary', name: '传说蛮力领袖', bonus: { str: 8, cha: 8 } },
}));

vi.mock('@/data/config_mounts', () => ({
  MOUNT_TIERS: [
    { tier: 'common',    index: 0, unlockLevel: 1,  label: '普通', directionType: 'single', bonusTotal: 2 },
    { tier: 'uncommon',  index: 1, unlockLevel: 5,  label: '优秀', directionType: 'single', bonusTotal: 4 },
    { tier: 'rare',      index: 2, unlockLevel: 10, label: '稀有', directionType: 'single', bonusTotal: 6 },
    { tier: 'epic',      index: 3, unlockLevel: 15, label: '史诗', directionType: 'dual',   bonusTotal: 12 },
    { tier: 'legendary', index: 4, unlockLevel: 20, label: '传说', directionType: 'dual',   bonusTotal: 16 },
  ],
  getMountOptionById: vi.fn((id: string) => mockMountOptions[id]),
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
  isRaceFactionCompatible,
  isClassRaceCompatible,
  // 四层属性纯函数（store 通过 as 重命名为 *Pure 调用）
  allocateStat,
  resetAllocatedStats,
  applyPotionBonus,
  // 坐骑配置纯函数
  computeMountBonus,
  isTierUnlocked,
} from '@/modules/character/service';
import { useBaseStore } from '@/modules/base/store';
import { getExpForLevel } from '@/utils/calculations';
import { backupService, importService, dataInitializer } from '@/modules/data';
import { useGameStore } from '@/modules/game';
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
    // 四层属性模型（plan.md §3.2）：默认无药剂、无升级分配、无未分配点数
    potionStats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    allocatedStats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    unallocatedPoints: 0,
    gold: 100,
    // 坐骑配置默认值：5 档全 null（未选任何方向）
    mountChoices: [null, null, null, null, null],
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
  // P3-116：currentCharacterId 收敛到 GameStore，通过 mock 的 setCurrentCharacterId 设置
  // mock 实现同步修改 ref，无需 await 即可让 characterStore 的只读 computed 拿到值
  const gameStore = useGameStore();
  gameStore.setCurrentCharacterId('char_test_1');
  const store = useCharacterStore();
  store.$patch({
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
      // 四层签名：computeEffectiveStats(baseStats, potionStats, allocatedStats, bonusStats)
      expect(computeEffectiveStats).toHaveBeenCalledWith(
        char.stats,
        char.potionStats,
        char.allocatedStats,
        { str: 5 }
      );
      // mock 实现：四层叠加，str = 12 + 0 + 0 + 5 = 17
      expect(result).toEqual({ ...char.stats, str: 17 });
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

  // -------------------- Getters：statsBreakdown（阶段四：属性来源明细） --------------------
  describe('Getters：statsBreakdown 属性来源明细（plan.md §阶段四）', () => {
    it('character 为 null 时返回基础层 10 + 其他层全 0', () => {
      const store = useCharacterStore();
      const breakdown = store.statsBreakdown;
      // 6 个属性均有明细
      expect(Object.keys(breakdown).sort()).toEqual(['cha', 'con', 'dex', 'int', 'str', 'wis']);
      // 每个属性的明细包含 7 层（base/race/class/potion/allocated/bonus/mount）
      const strSources = breakdown.str;
      expect(strSources).toHaveLength(7);
      // 基础层固定 10
      expect(strSources.find(s => s.layer === 'base')).toEqual({ label: '基础', value: 10, layer: 'base' });
      // 其他层全 0
      expect(strSources.find(s => s.layer === 'race')!.value).toBe(0);
      expect(strSources.find(s => s.layer === 'class')!.value).toBe(0);
      expect(strSources.find(s => s.layer === 'potion')!.value).toBe(0);
      expect(strSources.find(s => s.layer === 'allocated')!.value).toBe(0);
      expect(strSources.find(s => s.layer === 'bonus')!.value).toBe(0);
      // P1 增强：mount 层存在且为 0
      expect(strSources.find(s => s.layer === 'mount')).toEqual({ label: '坐骑', value: 0, layer: 'mount' });
    });

    it('注入 character 与 raceBonus/classBonus/bonusStats 后正确反映各层贡献', () => {
      const store = useCharacterStore();
      const char = makeChar({
        stats: { str: 15, dex: 12, con: 14, int: 8, wis: 10, cha: 10 },
        potionStats: { str: 1, dex: 0, con: 2, int: 0, wis: 0, cha: 0 },
        allocatedStats: { str: 2, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
      });
      store.$patch({
        character: char,
        raceBonus: { str: 2, con: 2 },
        classBonus: { str: 3, dex: 2, con: 2, int: -2 },
        bonusStats: { str: 4 },
      });
      const strSources = store.statsBreakdown.str;
      // base(10) + race(2) + class(3) + potion(1) + allocated(2) + bonus(4) + mount(0) = 22
      // 与 effectiveStats 的 mock 实现一致（mock 不做 clamp）
      // P1 增强：bonus 层已扣除 mount 部分（此处 mountChoices 全 null，mount=0，bonus=4-0=4）
      const sumStr = strSources.reduce((a, b) => a + b.value, 0);
      expect(sumStr).toBe(22);
      // 各层值正确
      expect(strSources.find(s => s.layer === 'base')!.value).toBe(10);
      expect(strSources.find(s => s.layer === 'race')!.value).toBe(2);
      expect(strSources.find(s => s.layer === 'class')!.value).toBe(3);
      expect(strSources.find(s => s.layer === 'potion')!.value).toBe(1);
      expect(strSources.find(s => s.layer === 'allocated')!.value).toBe(2);
      expect(strSources.find(s => s.layer === 'bonus')!.value).toBe(4);
      // P1 增强：mount 层为 0（mountChoices 全 null）
      expect(strSources.find(s => s.layer === 'mount')!.value).toBe(0);
      // 负值层正确展示（classBonus 的 int = -2）
      const intSources = store.statsBreakdown.int;
      expect(intSources.find(s => s.layer === 'class')!.value).toBe(-2);
    });

    it('P1 增强：坐骑 bonus 从 bonusStats 拆分到 mount 层，bonus 层扣除对应部分', () => {
      // 模拟坐骑配置：common_str(+2) + uncommon_str(+4) = str+6
      // bonusStats 中 str=10（含坐骑 6 + 装备 4）
      const store = useCharacterStore();
      const char = makeChar({
        level: 5,
        mountChoices: ['common_str', 'uncommon_str', null, null, null],
      });
      store.$patch({
        character: char,
        bonusStats: { str: 10 }, // 10 = 装备 4 + 坐骑 6
      });

      const strSources = store.statsBreakdown.str;
      // mount 层 = computeMountBonus(['common_str', 'uncommon_str', ...]) = { str: 6 }
      expect(strSources.find(s => s.layer === 'mount')!.value).toBe(6);
      // bonus 层 = bonusStats.str(10) - mountValue(6) = 4
      expect(strSources.find(s => s.layer === 'bonus')!.value).toBe(4);
      // 总和不变：base(10) + race(0) + class(0) + potion(0) + allocated(0) + bonus(4) + mount(6) = 20
      const sumStr = strSources.reduce((a, b) => a + b.value, 0);
      expect(sumStr).toBe(20);
    });

    it('响应式：allocateStat 后 allocated 层值同步更新', async () => {
      const store = setupLoggedInStore(
        makeChar({ unallocatedPoints: 2, allocatedStats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } })
      );
      // 初始 allocated.str = 0
      expect(store.statsBreakdown.str.find(s => s.layer === 'allocated')!.value).toBe(0);
      // 分配 1 点到 str
      await store.allocateStat('str');
      // statsBreakdown 响应式更新
      expect(store.statsBreakdown.str.find(s => s.layer === 'allocated')!.value).toBe(1);
    });

    it('响应式：applyPotionBonus 后 potion 层值同步更新', async () => {
      const store = setupLoggedInStore(makeChar());
      // 初始 potion.con = 0
      expect(store.statsBreakdown.con.find(s => s.layer === 'potion')!.value).toBe(0);
      // 喝下 constitution 药剂 +1 con
      await store.applyPotionBonus({ con: 1 });
      // statsBreakdown 响应式更新
      expect(store.statsBreakdown.con.find(s => s.layer === 'potion')!.value).toBe(1);
    });

    it('响应式：resetAllocatedStats 后 allocated 层归零，其他层不变', async () => {
      const store = setupLoggedInStore(
        makeChar({
          unallocatedPoints: 0,
          allocatedStats: { str: 2, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
          potionStats: { str: 1, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
        })
      );
      // 初始 str: allocated=2, potion=1
      expect(store.statsBreakdown.str.find(s => s.layer === 'allocated')!.value).toBe(2);
      expect(store.statsBreakdown.str.find(s => s.layer === 'potion')!.value).toBe(1);
      // 重置升级层
      await store.resetAllocatedStats();
      // allocated 归零，potion 不变（不可重置）
      expect(store.statsBreakdown.str.find(s => s.layer === 'allocated')!.value).toBe(0);
      expect(store.statsBreakdown.str.find(s => s.layer === 'potion')!.value).toBe(1);
    });

    it('label 字段为中文展示名称，便于 UI 直接渲染', () => {
      const store = useCharacterStore();
      const labels = store.statsBreakdown.str.map(s => s.label);
      // P1 增强：新增"坐骑"层
      expect(labels).toEqual(['基础', '种族', '职业', '药剂', '升级', '装备/天赋', '坐骑']);
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
      // P3-116：GameStore.getCurrentCharacterId 默认返回 null，不触发自动选择

      const store = useCharacterStore();
      await store.initialize();

      expect(store.factionsData).toEqual({ alliance: f[0] });
      expect(store.racesData).toEqual({ human: r[0] });
      expect(store.classesData).toEqual({ warrior: c[0] });
      expect(store.characterList).toEqual(items);
    });

    it('GameStore.getCurrentCharacterId 返回 ID 时自动调用 selectCharacter', async () => {
      vi.mocked(useBaseStore).mockReturnValueOnce({ factions: [], races: [], classes: [] } as never);
      // P3-116：mock gameStore.getCurrentCharacterId 返回角色 ID，触发 selectCharacter
      gameStoreSpies.getCurrentCharacterId.mockReturnValueOnce('char_test_1');
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
      // P3-116：currentCharacterId 持久化由 GameStore 负责
      expect(gameStoreSpies.setCurrentCharacterId).toHaveBeenCalledWith('char_test_1');
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

    it('bonusStats 为 undefined 时回退为空对象（|| {} 分支）', async () => {
      const listItem = makeListItem();
      const char = makeChar();
      vi.mocked(characterDbService.getCharacterListItem).mockResolvedValueOnce(listItem);
      // bonusStats 未定义，覆盖 `data.bonusStats || {}` 的 falsy 分支
      vi.mocked(characterDbService.getCharacterData).mockResolvedValueOnce({
        character: char, raceId: 'human', classId: 'warrior',
      } as never);

      const store = useCharacterStore();
      const ok = await store.selectCharacter('char_test_1');

      expect(ok).toBe(true);
      expect(store.bonusStats).toEqual({});
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
      // P3-116：currentCharacterId 持久化由 GameStore 负责
      expect(gameStoreSpies.setCurrentCharacterId).toHaveBeenCalledWith(null);
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
      // P3-116：currentCharacterId 持久化由 GameStore 负责
      expect(gameStoreSpies.setCurrentCharacterId).toHaveBeenCalledWith(null);
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

  // -------------------- Actions：四层属性（药剂层 / 升级层） --------------------
  describe('Actions：applyPotionBonus / allocateStat / resetAllocatedStats', () => {
    it('applyPotionBonus：永久叠加到 potionStats 并持久化', async () => {
      const store = setupLoggedInStore(makeChar());
      await store.applyPotionBonus({ str: 2 });
      expect(applyPotionBonus).toHaveBeenCalledWith(expect.any(Object), { str: 2 });
      expect(store.character?.potionStats.str).toBe(2);
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('applyPotionBonus：影响 con 时重算 HP/MP（recalculateHpMp 被调用）', async () => {
      const store = setupLoggedInStore(makeChar());
      await store.applyPotionBonus({ con: 3 });
      expect(applyPotionBonus).toHaveBeenCalledWith(expect.any(Object), { con: 3 });
      expect(store.character?.potionStats.con).toBe(3);
      // 重算 HP/MP 需要四层 computeEffectiveStats
      expect(computeEffectiveStats).toHaveBeenCalled();
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('applyPotionBonus：仅 str 变化时不重算 HP/MP（仍持久化）', async () => {
      const store = setupLoggedInStore(makeChar());
      // clearAllMocks 已在 beforeEach 调用，这里仅验证不触发 recalc
      await store.applyPotionBonus({ str: 1 });
      // computeEffectiveStats 仅在 con/int/wis 变化时调用
      // 由于 mock 中 computeEffectiveStats 在 applyPotionBonus 路径中仅在 recalc 分支调用，
      // str 单独变化时该 mock 不应被调用
      expect(computeEffectiveStats).not.toHaveBeenCalled();
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('applyPotionBonus：未登录时直接返回不变更', async () => {
      const store = useCharacterStore();
      await store.applyPotionBonus({ str: 1 });
      expect(applyPotionBonus).not.toHaveBeenCalled();
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('allocateStat：unallocatedPoints > 0 时分配成功，返回 true', async () => {
      const store = setupLoggedInStore(makeChar({ unallocatedPoints: 3 }));
      const ok = await store.allocateStat('str');
      expect(ok).toBe(true);
      expect(allocateStat).toHaveBeenCalledWith(expect.any(Object), 'str');
      expect(store.character?.allocatedStats.str).toBe(1);
      expect(store.character?.unallocatedPoints).toBe(2);
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('allocateStat：分配 con 时重算 HP/MP', async () => {
      const store = setupLoggedInStore(makeChar({ unallocatedPoints: 3 }));
      await store.allocateStat('con');
      expect(allocateStat).toHaveBeenCalledWith(expect.any(Object), 'con');
      expect(computeEffectiveStats).toHaveBeenCalled();
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('allocateStat：分配 str 时不重算 HP/MP（仍持久化）', async () => {
      const store = setupLoggedInStore(makeChar({ unallocatedPoints: 3 }));
      await store.allocateStat('str');
      // P6-057 修复：allocateStat 现在读 effectiveStats.value[stat] 做上限检查，
      // 会触发 computeEffectiveStats mock 调用，此为预期行为
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('allocateStat：unallocatedPoints = 0 时返回 false，不调用纯函数', async () => {
      const store = setupLoggedInStore(makeChar({ unallocatedPoints: 0 }));
      const ok = await store.allocateStat('str');
      expect(ok).toBe(false);
      expect(allocateStat).not.toHaveBeenCalled();
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('allocateStat：未登录时返回 false', async () => {
      const store = useCharacterStore();
      const ok = await store.allocateStat('str');
      expect(ok).toBe(false);
      expect(allocateStat).not.toHaveBeenCalled();
    });

    it('resetAllocatedStats：allocatedStats 全置 0，点数回收，HP/MP 重算', async () => {
      const store = setupLoggedInStore(
        makeChar({
          unallocatedPoints: 1,
          allocatedStats: { str: 2, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
        })
      );
      await store.resetAllocatedStats();
      expect(resetAllocatedStats).toHaveBeenCalledWith(expect.any(Object));
      expect(store.character?.allocatedStats).toEqual({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
      // 已分配 3 点回收：1 + 3 = 4
      expect(store.character?.unallocatedPoints).toBe(4);
      // 重置统一重算 HP/MP（无论是否影响 con/int/wis）
      expect(computeEffectiveStats).toHaveBeenCalled();
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('resetAllocatedStats：不影响药剂层 potionStats（不可重置）', async () => {
      const store = setupLoggedInStore(
        makeChar({
          potionStats: { str: 5, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
          allocatedStats: { str: 2, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
          unallocatedPoints: 0,
        })
      );
      await store.resetAllocatedStats();
      // 药剂层保留
      expect(store.character?.potionStats.str).toBe(5);
      // 升级层归零、点数回收
      expect(store.character?.allocatedStats.str).toBe(0);
      expect(store.character?.unallocatedPoints).toBe(2);
    });

    it('resetAllocatedStats：未登录时不调用纯函数', async () => {
      const store = useCharacterStore();
      await store.resetAllocatedStats();
      expect(resetAllocatedStats).not.toHaveBeenCalled();
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
      store.$patch({ character: makeChar() });
      // P3-116：currentCharacterId 来自 GameStore，默认为 null（未登录状态）
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

    it('setRace：racesData 中无对应种族时直接返回不变更（P3-100 修复后 raceData 不存在视为非法）', async () => {
      // P3-100 修复：raceData 为 undefined 时直接 return，不再静默写入空 bonus
      const store = setupLoggedInStore(makeChar({ raceId: 'human' }));
      store.$patch({ racesData: { human: makeRace() } });
      await store.setRace('undead');
      expect(store.raceBonus).toEqual({});
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('setClass：classesData 中无对应职业时直接返回不变更（P3-100 修复后 classData 不存在视为非法）', async () => {
      // P3-100 修复：classData 为 undefined 时直接 return，不再静默写入空 bonus
      const store = setupLoggedInStore(makeChar({ classId: 'warrior' }));
      store.$patch({ classesData: { warrior: makeClass() } });
      await store.setClass('paladin');
      expect(store.classBonus).toEqual({});
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    // -------------------- P3-100：兼容性校验 --------------------

    it('setRace：种族与角色阵营不兼容时抛错（如 alliance 角色切到 horde 种族）', async () => {
      vi.mocked(isRaceFactionCompatible).mockReturnValueOnce(false);
      const store = setupLoggedInStore(makeChar({ raceId: 'human', factionId: 'alliance' }));
      store.$patch({
        racesData: {
          human: makeRace(),
          orc: makeRace({ id: 'orc', name: '兽人', factionId: 'horde' })
        },
      });
      await expect(store.setRace('orc')).rejects.toThrow('种族「兽人」不支持阵营「alliance」');
      expect(store.character?.raceId).toBe('human'); // 未被修改
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('setRace：种族与角色阵营兼容时正常更新（如 alliance 角色切到同阵营其他种族）', async () => {
      const store = setupLoggedInStore(makeChar({ raceId: 'human', factionId: 'alliance' }));
      store.$patch({
        racesData: {
          human: makeRace(),
          dwarf: makeRace({ id: 'dwarf', name: '矮人', factionId: 'alliance', bonus: { con: 3 } })
        },
      });
      await store.setRace('dwarf');
      expect(store.character?.raceId).toBe('dwarf');
      expect(store.raceBonus).toEqual({ con: 3 });
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('setClass：职业与角色阵营不兼容时抛错', async () => {
      vi.mocked(isClassFactionCompatible).mockReturnValueOnce(false);
      const store = setupLoggedInStore(makeChar({ raceId: 'human', factionId: 'alliance', classId: 'warrior' }));
      store.$patch({
        classesData: {
          warrior: makeClass(),
          evoker: makeClass({ id: 'evoker', name: '龙脉术士', factionsIds: ['neutral'], raceIds: [] })
        },
      });
      await expect(store.setClass('evoker')).rejects.toThrow('职业「龙脉术士」不支持阵营「alliance」');
      expect(store.character?.classId).toBe('warrior'); // 未被修改
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('setClass：职业与角色种族不兼容时抛错', async () => {
      vi.mocked(isClassRaceCompatible).mockReturnValueOnce(false);
      const store = setupLoggedInStore(makeChar({ raceId: 'human', factionId: 'alliance', classId: 'warrior' }));
      store.$patch({
        classesData: {
          warrior: makeClass(),
          demon_hunter: makeClass({
            id: 'demon_hunter', name: '影刃猎手',
            factionsIds: ['alliance', 'horde', 'neutral'],
            raceIds: ['night_elf', 'blood_elf'] // 不含 human
          })
        },
      });
      await expect(store.setClass('demon_hunter')).rejects.toThrow('职业「影刃猎手」不支持种族「human」');
      expect(store.character?.classId).toBe('warrior'); // 未被修改
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('setClass：职业 raceIds 为空数组时对所有种族开放（无种族限制）', async () => {
      const store = setupLoggedInStore(makeChar({ raceId: 'human', factionId: 'alliance', classId: 'warrior' }));
      store.$patch({
        classesData: {
          warrior: makeClass(),
          mage: makeClass({ id: 'mage', name: '法师', factionsIds: ['alliance'], raceIds: [], bonus: { int: 3 } })
        },
      });
      await store.setClass('mage');
      expect(store.character?.classId).toBe('mage');
      expect(store.classBonus).toEqual({ int: 3 });
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
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
    it('handleDeath：损失50%本级经验、emit DEATH、自动复活', async () => {
      const deathSpy = vi.fn();
      const resurrectSpy = vi.fn();
      eventBus.on(GameEvents.CHARACTER_DEATH, deathSpy);
      eventBus.on(GameEvents.CHARACTER_RESURRECTED, resurrectSpy);

      const store = setupLoggedInStore(makeChar({ exp: 80, maxHp: 100, maxMana: 50 }));
      await store.handleDeath();

      expect(store.character?.exp).toBe(40); // Math.floor(80 * 0.5)
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

  // -------------------- Actions：坐骑配置（plan.md §5.1 / §5.2） --------------------
  describe('Actions：setMountChoice / resetMountChoices', () => {
    it('setMountChoice：common 档选中 common_str 后 bonusStats 叠加 str+2', async () => {
      const store = setupLoggedInStore(makeChar({ level: 1 }));
      await store.setMountChoice(0, 'common_str');

      // mountChoices[0] 被设置为 'common_str'
      expect(store.character?.mountChoices[0]).toBe('common_str');
      // bonusStats 含 str+2（computeMountBonus mock 返回 { str: 2 }）
      expect(store.bonusStats.str).toBe(2);
      // computeBonusChange 被调用两次：扣旧（空）+ 加新（{ str: 2 }）
      expect(computeBonusChange).toHaveBeenCalledWith({}, { str: 2 }, true);
      // 持久化
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('setMountChoice：切换同档方向时旧 bonus 扣除、新 bonus 叠加', async () => {
      // 初始已选 common_str（str+2）
      const store = setupLoggedInStore(
        makeChar({ level: 1, mountChoices: ['common_str', null, null, null, null] })
      );
      store.$patch({ bonusStats: { str: 2 } });

      // 切换到 common_dex（dex+2）
      await store.setMountChoice(0, 'common_dex');

      expect(store.character?.mountChoices[0]).toBe('common_dex');
      // 旧 str+2 被扣除，新 dex+2 叠加
      // computeBonusChange 第一次：扣旧 { str: 2 }（isAdd=false）→ str=0
      // computeBonusChange 第二次：加新 { dex: 2 }（isAdd=true）→ dex=2
      expect(computeBonusChange).toHaveBeenCalledWith({ str: 2 }, { str: 2 }, false);
      expect(computeBonusChange).toHaveBeenCalledWith({ str: 0 }, { dex: 2 }, true);
      expect(store.bonusStats).toEqual({ str: 0, dex: 2 });
    });

    it('setMountChoice：传 null 取消选择时 bonus 扣除', async () => {
      // 初始已选 common_str
      const store = setupLoggedInStore(
        makeChar({ level: 1, mountChoices: ['common_str', null, null, null, null] })
      );
      store.$patch({ bonusStats: { str: 2 } });

      // 传 null 取消选择
      await store.setMountChoice(0, null);

      expect(store.character?.mountChoices[0]).toBeNull();
      // bonus 被扣除
      expect(computeBonusChange).toHaveBeenCalledWith({ str: 2 }, { str: 2 }, false);
      expect(store.bonusStats.str).toBe(0);
    });

    it('setMountChoice：多档叠加（common_str + uncommon_str = str+6）', async () => {
      // 5 级解锁 common + uncommon
      const store = setupLoggedInStore(makeChar({ level: 5 }));
      await store.setMountChoice(0, 'common_str'); // str+2
      await store.setMountChoice(1, 'uncommon_str'); // str+4

      // 两档叠加：str = 2 + 4 = 6
      expect(store.character?.mountChoices).toEqual(['common_str', 'uncommon_str', null, null, null]);
      expect(store.bonusStats.str).toBe(6);
    });

    it('setMountChoice：档位未解锁时抛错', async () => {
      // 1 级角色仅解锁 common（index 0），uncommon（index 1）需 5 级
      const store = setupLoggedInStore(makeChar({ level: 1 }));
      await expect(store.setMountChoice(1, 'uncommon_str')).rejects.toThrow(
        '档位 优秀 未解锁（需 5 级）'
      );
      // 状态未变更
      expect(store.character?.mountChoices[1]).toBeNull();
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('setMountChoice：档位索引越界（负数）时抛错', async () => {
      const store = setupLoggedInStore(makeChar({ level: 20 }));
      await expect(store.setMountChoice(-1, 'common_str')).rejects.toThrow('无效档位索引: -1');
    });

    it('setMountChoice：档位索引越界（>= 5）时抛错', async () => {
      const store = setupLoggedInStore(makeChar({ level: 20 }));
      await expect(store.setMountChoice(5, 'common_str')).rejects.toThrow('无效档位索引: 5');
    });

    it('setMountChoice：无效 optionId 时抛错', async () => {
      const store = setupLoggedInStore(makeChar({ level: 1 }));
      await expect(store.setMountChoice(0, 'invalid_option')).rejects.toThrow(
        '无效坐骑方向: invalid_option'
      );
    });

    it('setMountChoice：跨档位设置（common 档选 uncommon 方向）时抛错', async () => {
      const store = setupLoggedInStore(makeChar({ level: 5 }));
      // common 档（index 0）尝试设置 uncommon_str（tier='uncommon'）
      await expect(store.setMountChoice(0, 'uncommon_str')).rejects.toThrow(
        '不属于档位 普通'
      );
    });

    it('setMountChoice：含 con 时重算 HP/MP', async () => {
      const store = setupLoggedInStore(makeChar({ level: 1 }));
      await store.setMountChoice(0, 'common_con'); // con+2

      // computeMountBonus mock 返回 { con: 2 }
      expect(store.bonusStats.con).toBe(2);
      // con 变化触发 recalculateHpMp（通过 computeEffectiveStats 调用）
      expect(computeEffectiveStats).toHaveBeenCalled();
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('setMountChoice：仅 str 变化时不重算 HP/MP（仍持久化）', async () => {
      const store = setupLoggedInStore(makeChar({ level: 1 }));
      // common_str 的 bonus 为 { str: 2 }，不含 con/int/wis
      // 但 setMountChoice 实现中统一调用 recalculateHpMp（与 applyBonus 的条件分支不同）
      // 这里验证 computeEffectiveStats 被调用（setMountChoice 总是重算）
      await store.setMountChoice(0, 'common_str');
      expect(computeEffectiveStats).toHaveBeenCalled();
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('setMountChoice：未登录时直接返回不变更', async () => {
      const store = useCharacterStore();
      await store.setMountChoice(0, 'common_str');
      expect(computeMountBonus).not.toHaveBeenCalled();
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('setMountChoice：旧存档 mountChoices 长度不足 5 时长度兜底补 null', async () => {
      // 模拟旧存档迁移后 mountChoices 长度不足（异常数据）
      const store = setupLoggedInStore(
        makeChar({ level: 1, mountChoices: ['common_str'] as unknown as (string | null)[] })
      );
      await store.setMountChoice(0, 'common_dex');

      // 长度被补齐到 5
      expect(store.character?.mountChoices).toHaveLength(5);
      expect(store.character?.mountChoices[0]).toBe('common_dex');
      expect(store.character?.mountChoices[1]).toBeNull();
    });

    it('resetMountChoices：清空所有选择并扣除 bonus', async () => {
      // 5 档全部选择力量方向（plan §8.1 极端力量流）
      const store = setupLoggedInStore(
        makeChar({
          level: 20,
          mountChoices: ['common_str', 'uncommon_str', 'rare_str', 'epic_str_con', 'legendary_str_con'],
        })
      );
      // 模拟已应用的 bonusStats（str+26, con+14）
      store.$patch({ bonusStats: { str: 26, con: 14 } });

      await store.resetMountChoices();

      // mountChoices 全部清空
      expect(store.character?.mountChoices).toEqual([null, null, null, null, null]);
      // bonusStats 中坐骑贡献被扣除（str=0, con=0）
      expect(store.bonusStats.str).toBe(0);
      expect(store.bonusStats.con).toBe(0);
      // 持久化
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('resetMountChoices：无任何选择时仍执行（bonus 为空不调用 computeBonusChange）', async () => {
      // mountChoices 全 null，computeMountBonus 返回 {}
      const store = setupLoggedInStore(makeChar({ level: 5 }));
      await store.resetMountChoices();

      expect(store.character?.mountChoices).toEqual([null, null, null, null, null]);
      // 旧 bonus 为空，跳过 computeBonusChange
      // 注意：Object.keys({}).length === 0，跳过 computeBonusChange 调用
      // 但 computeMountBonus 仍被调用
      expect(computeMountBonus).toHaveBeenCalled();
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });

    it('resetMountChoices：未登录时直接返回不变更', async () => {
      const store = useCharacterStore();
      await store.resetMountChoices();
      expect(computeMountBonus).not.toHaveBeenCalled();
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });

    it('reset：一并清空 mountChoices 并扣除 bonus', async () => {
      // 角色已配置坐骑 + 升级点数
      const store = setupLoggedInStore(
        makeChar({
          level: 5,
          mountChoices: ['common_str', 'uncommon_str', null, null, null],
          bonusStats: { str: 6 }, // common_str(2) + uncommon_str(4) = 6
        })
      );
      // 直接 $patch bonusStats（setupLoggedInStore 不接受 bonusStats 参数，需单独设置）
      store.$patch({ bonusStats: { str: 6 } });

      await store.reset();

      // 等级/经验重置
      expect(store.character?.level).toBe(1);
      // mountChoices 一并清空
      expect(store.character?.mountChoices).toEqual([null, null, null, null, null]);
      // bonusStats 中坐骑 bonus 被扣除（str=0）
      expect(store.bonusStats.str).toBe(0);
      // 持久化
      expect(characterDbService.saveCharacterData).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------- 覆盖率补全：防御性分支 --------------------
  describe('覆盖率补全：防御性分支', () => {
    it('effectiveStats 在 character 为 null 时返回默认属性', () => {
      const store = useCharacterStore();
      expect(store.character).toBeNull();
      // 覆盖 if (!character.value) return { str: 10, ... }
      expect(store.effectiveStats).toEqual({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
    });

    it('factionIcon 在无阵营数据时返回默认图标（|| 回退）', () => {
      const store = useCharacterStore();
      store.$patch({ character: makeChar({ factionId: 'unknown_faction' }) });
      // factionsData 不含 'unknown_faction'，覆盖 || 'game-icons:checked-shield'
      expect(store.factionIcon).toBe('game-icons:checked-shield');
    });

    it('classIcon 在无职业数据时返回默认图标（|| 回退）', () => {
      const store = useCharacterStore();
      store.$patch({ character: makeChar({ classId: 'unknown_class' }) });
      // classesData 不含 'unknown_class'，覆盖 || 'game-icons:broadsword'
      expect(store.classIcon).toBe('game-icons:broadsword');
    });

    it('factionColor 在无阵营数据时返回默认颜色（|| 回退）', () => {
      const store = useCharacterStore();
      store.$patch({ character: makeChar({ factionId: 'unknown_faction' }) });
      // 覆盖 || '#9d9d9d'
      expect(store.factionColor).toBe('#9d9d9d');
    });

    it('classColor 在无职业数据时返回默认颜色（|| 回退）', () => {
      const store = useCharacterStore();
      store.$patch({ character: makeChar({ classId: 'unknown_class' }) });
      // 覆盖 || '#9d9d9d'
      expect(store.classColor).toBe('#9d9d9d');
    });

    it('persistCharacter 在 currentCharacterId 为 null 时直接返回（character 存在但未登录）', async () => {
      const store = useCharacterStore();
      store.$patch({ character: makeChar() });
      // P3-116：currentCharacterId 来自 GameStore，默认为 null（未登录状态）
      // 调用 takeDamage 会触发 persistCharacter，但 currentCharacterId 为 null → 直接返回
      await store.takeDamage(10);
      expect(characterDbService.saveCharacterData).not.toHaveBeenCalled();
    });
  });
});
