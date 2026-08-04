/**
 * @fileoverview 数据服务层单元测试
 *
 * 覆盖范围：
 * 1. DataInitializer —— 游戏数据初始化服务
 *    - isDataInitialized：未初始化/已初始化状态检查
 *    - initializeData：首次初始化写入数据、已初始化时跳过、失败时抛错
 * 2. BackupService —— 数据备份服务
 *    - createBackup：生成完整备份对象（含 version/timestamp/checksum/data）
 *    - 校验和一致性：相同数据相同校验和，不同数据不同校验和
 *    - collectAllData：通过 createBackup 间接验证数据收集结构
 *    - exportBackup：调用 downloadBlob 下载文件
 * 3. ImportService —— 数据导入服务
 *    - checkVersionCompatibility：版本兼容性检查
 *    - validateBackup：有效/无效数据验证、版本兼容性处理
 *    - importBackup：成功导入/无效数据拒绝导入
 *
 * 设计说明（遵循 code_rule 红线）：
 * - 顶部 `import 'fake-indexeddb/auto'` 注入 IndexedDB shim
 * - beforeEach 清空所有数据库表，避免用例间污染
 * - 不 mock db，使用 fake-indexeddb 真实执行事务
 * - mock `@/utils/fileDownload` 的 downloadBlob 避免真实 DOM 操作
 * - mock `@/data` 的种子数据，提供简化的可控测试数据
 * - eventBus 使用真实实现，通过 spy 断言 emit 调用
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/modules/data/core';
import type { GameStateStorage } from '@/modules/data/core';
import { DataInitializer, BackupService, ImportService } from '@/modules/data/service';
import { eventBus, GameEvents } from '@/modules/bus';
import { BACKUP_CONFIG } from '@/config/database';
import type { BackupFile, BackupData, ImportResult } from '@/modules/data/types';
import type { CombatLogStorage } from '@/modules/combat/types';
import type { AdventureLogData, LogEntry } from '@/modules/log/types';
import type { MapStateStorage } from '@/modules/map/types';
import type { ShopItemsStorage } from '@/modules/shop/types';
import type { CharacterDataStorage } from '@/modules/character/types';

// ============================================================================
// Mock：@/data 种子数据（简化版本，包含 service.ts 实际访问的必要字段）
// ============================================================================

const { mockSeedData } = vi.hoisted(() => {
  /** 简化的阵营 mock 数据（schema: 'id, name'） */
  const factions = [
    { id: 'faction_test_1', name: '测试阵营A', icon: 'shield', color: '#000', description: '测试阵营A描述' },
    { id: 'faction_test_2', name: '测试阵营B', icon: 'axe', color: '#fff', description: '测试阵营B描述' },
  ];
  /** 简化的种族 mock 数据（schema: 'id, name, factionId'） */
  const races = [
    { id: 'race_test_1', name: '测试种族', factionId: 'faction_test_1', icon: 'icon', description: '测试种族描述', baseStats: { strength: 10, agility: 10, intellect: 10, stamina: 10, spirit: 10 } },
  ];
  /** 简化的职业 mock 数据（schema: 'id, name, primaryStat'） */
  const classes = [
    { id: 'class_test_1', name: '测试职业', primaryStat: 'strength', icon: 'icon', description: '测试职业描述' },
  ];
  /** 简化的物品 mock 数据（schema: 'id, name, type, rarity'） */
  const lootItems = [
    { id: 'item_test_1', name: '测试物品', type: 'consumable', rarity: 'common' },
  ];
  /** 简化的装备 mock 数据（schema: 'id, name, type, rarity'） */
  const equipmentItems = [
    { id: 'eq_test_1', name: '测试装备', type: 'weapon', rarity: 'rare' },
  ];
  /** 简化的怪物 mock 数据（schema: 'id, name, dangerLevel'） */
  const mobs = [
    { id: 'mob_test_1', name: '测试怪物', dangerLevel: '安全' },
  ];
  /** 简化的 Boss mock 数据（initBosses 访问 id/name/icon/maxHp/damage/xp/gold/dangerLevel） */
  const bosses = [
    {
      id: 'boss_test_1',
      name: '测试Boss',
      icon: 'icon',
      maxHp: 100,
      damage: [10, 20],
      xp: 50,
      gold: 25,
      dangerLevel: '危险',
      isBoss: true,
    },
  ];
  /** 简化的大陆 mock 数据（schema: 'id, type, continent'） */
  const continents = [
    { id: 'continent_test_1', name: '测试大陆', type: 'continent', position: 'west', color: '#000', icon: 'icon', description: '测试大陆描述' },
  ];
  /** 简化的地点 mock 数据（schema: 'id, type, continent'） */
  const locations = [
    { id: 'loc_test_1', name: '测试地点', type: 'location', continent: 'continent_test_1' },
  ];
  /** 简化的商店 mock 数据（schema: 'id'） */
  const shops = [
    { id: 'shop_test_1', name: '测试商店' },
  ];
  /** 简化的任务 mock 数据（schema: 'id, boardId, type'） */
  const quests = [
    { id: 'quest_test_1', boardId: 'board_1', type: 'kill', name: '测试任务' },
  ];
  /** 简化的职业技能 mock 数据（initSkillTemplates 访问 class_id 和 skills 数组） */
  const classAbilities = [
    {
      class_id: 'class_test_1',
      skills: [
        { id: 'skill_test_1', name: '测试技能', icon: 'icon', description: '测试', mpCost: 5, type: 'physical_damage', effect: { type: 'physical_damage', value: 10 }, unlockLevel: 1, cooldown: 0, targetType: 'single' },
      ],
    },
  ];
  /** 简化的怪物技能 mock 数据（initSkillTemplates 遍历 put） */
  const monsterAbilities = [
    { id: 'mob_skill_test_1', name: '怪物技能', icon: 'icon', description: '测试', mpCost: 0, type: 'physical_damage', effect: { type: 'physical_damage', value: 5 }, unlockLevel: 1, cooldown: 0, targetType: 'single' },
  ];
  /** 简化的职业被动 mock 数据（schema: 'id, classId, trigger'） */
  const classPassives = [
    { id: 'passive_test_1', classId: 'class_test_1', trigger: 'on_attack', name: '测试被动' },
  ];
  /** 简化的职业专属装备 mock 数据（schema: 'id, name, type, rarity'） */
  const classSpecificItems = [
    { id: 'class_item_test_1', name: '职业装备', type: 'weapon', rarity: 'rare' },
  ];
  /** 简化的职业天赋树 mock 数据（schema: 'id, classId'） */
  const classTalentTrees = [
    { id: 'talent_tree_test_1', classId: 'class_test_1', name: '测试天赋树' },
  ];
  /** 简化的套装 mock 数据（schema: 'id, classRestriction'） */
  const itemSets = [
    { id: 'item_set_test_1', classRestriction: 'class_test_1', name: '测试套装' },
  ];

  return {
    mockSeedData: {
      FACTIONS: factions,
      RACES: races,
      CLASSES: classes,
      LOOT_ITEMS: lootItems,
      EQUIPMENT_ITEMS: equipmentItems,
      MOBS: mobs,
      BOSSES: bosses,
      CONTINENTS: continents,
      LOCATIONS: locations,
      SHOPS: shops,
      QUESTS: quests,
      CLASS_ABILITIES: classAbilities,
      MONSTER_ABILITIES: monsterAbilities,
      CLASS_PASSIVES: classPassives,
      CLASS_SPECIFIC_ITEMS: classSpecificItems,
      CLASS_TALENT_TREES: classTalentTrees,
      ITEM_SETS: itemSets,
      MAX_LEVEL: 60,
    },
  };
});

vi.mock('@/data', () => mockSeedData);

// P1-30 修复后 MAX_LEVEL 从 @/config/character 直接导入，需同步 mock
vi.mock('@/config/character', () => ({
  MAX_LEVEL: mockSeedData.MAX_LEVEL,
}));

// ============================================================================
// Mock：@/utils/fileDownload 的 downloadBlob（避免真实 DOM 操作）
// ============================================================================

vi.mock('@/utils/fileDownload', () => ({
  downloadBlob: vi.fn(),
}));

import { downloadBlob } from '@/utils/fileDownload';

// ============================================================================
// 辅助常量与函数
// ============================================================================

/** 需要在 beforeEach 中清空的数据库表列表 */
const TABLES_TO_CLEAR = [
  db.config_factions, db.config_races, db.config_classes,
  db.config_items, db.config_equipmentItems, db.config_mobs,
  db.config_bosses, db.config_locations, db.config_shops,
  db.config_quests, db.config_skills, db.config_class_items,
  db.config_class_passives, db.config_class_talents, db.config_item_sets,
  db.char_data, db.char_inventory, db.char_quests, db.char_equipment,
  db.char_skills, db.char_exploration, db.runtime_combatLogs,
  db.runtime_adventureLogs, db.runtime_gameState, db.runtime_mapState,
  db.runtime_shopItems,
] as const;

/** 清空所有数据库表，避免用例间数据污染 */
async function clearAllTables(): Promise<void> {
  await Promise.all(TABLES_TO_CLEAR.map((t) => t.clear()));
}

/** 构造最小化的有效 BackupData（所有字段为空） */
function createMinimalBackupData(): BackupData {
  return {
    characters: {},
    inventory: {},
    quests: {},
    equipment: {},
    skills: {},
    exploration: {},
    combat: {},
    adventureLog: {},
    map: [],
    shop: [],
    gameState: {},
    shopItems: {},
  };
}

/** 将 BackupFile 序列化为 File 对象（validateBackup/importBackup 需要 File 输入） */
function backupToFile(backup: BackupFile): File {
  return new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' });
}

/**
 * 模拟 FileReader.readAsText 读取失败（触发 onerror 回调）
 *
 * 用于覆盖 validateBackup / importBackup 的 reader.onerror 分支。
 * onerror 在 readAsText 被调用时（onerror 已赋值后）通过微任务触发。
 */
function mockFileReaderReadError(): void {
  vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function (this: FileReader) {
    queueMicrotask(() => {
      if (this.onerror) this.onerror(new ProgressEvent('error'));
    });
  });
}

/**
 * 构造一条战斗日志记录
 * @param withBattleLogId - 是否包含 battleLogId（false 时触发 collectAllData 的降级键逻辑）
 */
function makeCombatLog(overrides: Partial<CombatLogStorage> & { combatId: string; timestamp: number; withBattleLogId?: boolean }): CombatLogStorage {
  const { withBattleLogId = true, ...rest } = overrides;
  const base: CombatLogStorage = {
    battleLogId: 'battle_default',
    turn: 1,
    actorType: 'player',
    actorId: 'char_1',
    actorName: '英雄',
    eventType: 'normal_attack',
    message: '攻击',
    ...rest,
  };
  return withBattleLogId ? base : (() => {
    const { battleLogId: _omit, ...withoutId } = base;
    return withoutId as CombatLogStorage;
  })();
}

/**
 * 构造一条冒险日志记录
 * @param withEntries - 是否包含 entries（false 时触发 collectAllData 的 entries || [] 降级）
 */
function makeAdventureLog(characterId: string, withEntries: boolean): AdventureLogData {
  const entries: LogEntry[] = withEntries
    ? [{ id: 'log_1', timestamp: 1000, type: 'combat', message: '战斗胜利' }]
    : [];
  return {
    characterId,
    entries: withEntries ? entries : (undefined as unknown as LogEntry[]),
    updatedAt: Date.now(),
  };
}

/**
 * 向数据库写入运行时数据，用于测试 collectAllData 的各项 forEach 回调分支
 */
async function seedRuntimeData(): Promise<void> {
  // 战斗日志：一条含 battleLogId，一条不含（触发降级键 ${combatId}_${timestamp}）
  await db.runtime_combatLogs.put(makeCombatLog({ combatId: 'combat_1', timestamp: 1000, battleLogId: 'battle_1' }));
  await db.runtime_combatLogs.put(makeCombatLog({ combatId: 'combat_2', timestamp: 2000, withBattleLogId: false }));
  // 冒险日志：一条含 entries，一条 entries 为 undefined（触发 || [] 降级）
  await db.runtime_adventureLogs.put(makeAdventureLog('char_1', true));
  await db.runtime_adventureLogs.put(makeAdventureLog('char_2', false));
  // 地图运行时状态
  await db.runtime_mapState.put({ id: 'map_char_1', currentLocationId: 'loc_1' } as MapStateStorage);
  // 商店商品运行时数据
  await db.runtime_shopItems.put({ shopId: 'shop_1', items: [], lastRefresh: Date.now() } as ShopItemsStorage);
  // 角色数据（覆盖 toCharacterRecord 循环体）
  await db.char_data.put({
    characterId: 'char_1', name: '英雄', factionId: 'f1', raceId: 'r1', classId: 'c1',
    level: 1, exp: 0, expToNextLevel: 100,
  } as CharacterDataStorage);
}

// ============================================================================
// 测试主体
// ============================================================================

describe('DataInitializer 数据初始化服务', () => {
  let initializer: DataInitializer;

  beforeEach(async () => {
    await clearAllTables();
    initializer = new DataInitializer();
    eventBus.clearAll();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  // ==================== isDataInitialized ====================

  describe('isDataInitialized 检查初始化状态', () => {
    it('未初始化时返回 false', async () => {
      // Act
      const result = await initializer.isDataInitialized();

      // Assert
      expect(result).toBe(false);
    });

    it('已初始化时返回 true', async () => {
      // Arrange：写入初始化标志
      await db.runtime_gameState.put({
        id: 'data_initialized',
        initializedAt: new Date().toISOString(),
      } as GameStateStorage);

      // Act
      const result = await initializer.isDataInitialized();

      // Assert
      expect(result).toBe(true);
    });
  });

  // ==================== initializeData ====================

  describe('initializeData 初始化游戏数据', () => {
    it('首次初始化写入各表数据', async () => {
      // Act
      await initializer.initializeData();

      // Assert：验证各 config 表均写入了 mock 种子数据
      expect(await db.config_factions.count()).toBe(mockSeedData.FACTIONS.length);
      expect(await db.config_races.count()).toBe(mockSeedData.RACES.length);
      expect(await db.config_classes.count()).toBe(mockSeedData.CLASSES.length);
      expect(await db.config_items.count()).toBe(mockSeedData.LOOT_ITEMS.length);
      expect(await db.config_equipmentItems.count()).toBe(mockSeedData.EQUIPMENT_ITEMS.length);
      expect(await db.config_mobs.count()).toBe(mockSeedData.MOBS.length);
      expect(await db.config_bosses.count()).toBe(mockSeedData.BOSSES.length);
      expect(await db.config_shops.count()).toBe(mockSeedData.SHOPS.length);
      expect(await db.config_quests.count()).toBe(mockSeedData.QUESTS.length);
      expect(await db.config_locations.count()).toBe(
        mockSeedData.LOCATIONS.length + mockSeedData.CONTINENTS.length
      );
      // 职业专属数据表（DATA-4）
      expect(await db.config_class_items.count()).toBe(mockSeedData.CLASS_SPECIFIC_ITEMS.length);
      expect(await db.config_class_passives.count()).toBe(mockSeedData.CLASS_PASSIVES.length);
      expect(await db.config_class_talents.count()).toBe(mockSeedData.CLASS_TALENT_TREES.length);
      expect(await db.config_item_sets.count()).toBe(mockSeedData.ITEM_SETS.length);
      // 技能模板：CLASS_ABILITIES 的 skills + MONSTER_ABILITIES
      const expectedSkills =
        mockSeedData.CLASS_ABILITIES.reduce((sum, entry) => sum + entry.skills.length, 0) +
        mockSeedData.MONSTER_ABILITIES.length;
      expect(await db.config_skills.count()).toBe(expectedSkills);
      // 游戏常量
      const constants = await db.runtime_gameState.get('game_constants');
      expect(constants).toBeDefined();
      expect(constants!.maxLevel).toBe(mockSeedData.MAX_LEVEL);
    });

    it('首次初始化后写入初始化标志', async () => {
      // Act
      await initializer.initializeData();

      // Assert
      const isInit = await initializer.isDataInitialized();
      expect(isInit).toBe(true);
      const flag = await db.runtime_gameState.get('data_initialized');
      expect(flag).toBeDefined();
      expect(flag!.initializedAt).toBeDefined();
    });

    it('首次初始化触发 eventBus.emit 通知', async () => {
      // Arrange
      const emitSpy = vi.spyOn(eventBus, 'emit');

      // Act
      await initializer.initializeData();

      // Assert
      expect(emitSpy).toHaveBeenCalledWith(
        GameEvents.GAME_DATA_UPDATED,
        { type: 'init', action: 'bulk', id: '*' }
      );
    });

    it('已初始化时跳过数据写入（仅更新 locations/continents）', async () => {
      // Arrange：首次初始化
      await initializer.initializeData();
      const factionsCountBefore = await db.config_factions.count();
      const racesCountBefore = await db.config_races.count();
      const classesCountBefore = await db.config_classes.count();
      const emitSpy = vi.spyOn(eventBus, 'emit');

      // Act：再次初始化
      await initializer.initializeData();

      // Assert：阵营/种族/职业等表数据量不变（跳过写入）
      expect(await db.config_factions.count()).toBe(factionsCountBefore);
      expect(await db.config_races.count()).toBe(racesCountBefore);
      expect(await db.config_classes.count()).toBe(classesCountBefore);
      // eventBus.emit 仍然被调用（每次初始化都通知）
      expect(emitSpy).toHaveBeenCalledWith(
        GameEvents.GAME_DATA_UPDATED,
        { type: 'init', action: 'bulk', id: '*' }
      );
    });

    it('初始化过程中抛出错误时向上传播', async () => {
      // Arrange：spy isDataInitialized 使其抛错
      vi.spyOn(initializer, 'isDataInitialized').mockRejectedValueOnce(
        new Error('数据库读取失败')
      );

      // Act & Assert
      await expect(initializer.initializeData()).rejects.toThrow('数据库读取失败');
    });

    it('事务内抛出 Error 时进入 catch 并记录错误后向上抛出', async () => {
      // Arrange：spy 私有方法 initLocations 使其在事务内抛 Error
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(initializer as unknown as { initLocations: () => Promise<void> }, 'initLocations')
        .mockRejectedValueOnce(new Error('地点表写入失败'));

      // Act & Assert
      await expect(initializer.initializeData()).rejects.toThrow('地点表写入失败');
      expect(errorSpy).toHaveBeenCalled();
    });

    it('事务内抛出非 Error 值时进入 catch 并向上抛出原值', async () => {
      // Arrange：spy 私有方法使其 reject 一个非 Error 值（覆盖 error instanceof Error 的 false 分支）
      vi.spyOn(initializer as unknown as { initLocations: () => Promise<void> }, 'initLocations')
        .mockRejectedValueOnce('非Error字符串');

      // Act & Assert
      await expect(initializer.initializeData()).rejects.toBe('非Error字符串');
    });

    it('initTable 传入空数组时跳过 bulkPut（data.length === 0 分支）', async () => {
      // 直接调用私有 initTable 方法传入空数组，覆盖 if (data.length > 0) 的 false 分支
      const before = await db.config_factions.count();
      await (initializer as unknown as { initTable: (t: typeof db.config_factions, d: readonly unknown[]) => Promise<void> })
        .initTable(db.config_factions, []);
      const after = await db.config_factions.count();
      expect(after).toBe(before); // 没有写入任何数据
    });

    it('initBosses 在 BOSSES 为空时提前返回不写入数据', async () => {
      // 临时将 mock 种子数据的 BOSSES 置空，触发 if (BOSSES.length === 0) return
      const originalBosses = mockSeedData.BOSSES;
      mockSeedData.BOSSES = [];
      try {
        await (initializer as unknown as { initBosses: () => Promise<void> }).initBosses();
        expect(await db.config_bosses.count()).toBe(0);
      } finally {
        mockSeedData.BOSSES = originalBosses;
      }
    });
  });

  // ==================== resetData ====================

  describe('resetData 重置初始化标志', () => {
    it('删除初始化标志后 isDataInitialized 返回 false', async () => {
      // Arrange：先写入初始化标志
      await db.runtime_gameState.put({
        id: 'data_initialized',
        initializedAt: new Date().toISOString(),
      } as GameStateStorage);
      expect(await initializer.isDataInitialized()).toBe(true);

      // Act
      await initializer.resetData();

      // Assert
      expect(await initializer.isDataInitialized()).toBe(false);
      expect(await db.runtime_gameState.get('data_initialized')).toBeUndefined();
    });
  });

  // ==================== reinitializeData ====================

  describe('reinitializeData 修复基础数据', () => {
    it('清空所有 config 表后重新导入种子数据', async () => {
      // Arrange：先初始化，再写入额外数据（验证 reinitialize 会清空多余数据）
      await initializer.initializeData();
      await db.config_factions.put({
        id: 'extra_faction', name: '额外阵营', icon: 'i', color: '#000', description: '多余',
      });
      expect(await db.config_factions.count()).toBe(mockSeedData.FACTIONS.length + 1);

      // Act
      await initializer.reinitializeData();

      // Assert：额外数据被清空，数据量恢复为种子数据量
      expect(await db.config_factions.count()).toBe(mockSeedData.FACTIONS.length);
      expect(await db.config_races.count()).toBe(mockSeedData.RACES.length);
      expect(await db.config_bosses.count()).toBe(mockSeedData.BOSSES.length);
      // 初始化标志仍存在
      expect(await initializer.isDataInitialized()).toBe(true);
    });

    it('修复完成后触发 eventBus.emit 通知（type=repair）', async () => {
      // Arrange
      await initializer.initializeData();
      const emitSpy = vi.spyOn(eventBus, 'emit');

      // Act
      await initializer.reinitializeData();

      // Assert
      expect(emitSpy).toHaveBeenCalledWith(
        GameEvents.GAME_DATA_UPDATED,
        { type: 'repair', action: 'bulk', id: '*' }
      );
    });

    it('修复过程中抛出错误时向上传播', async () => {
      // Arrange：spy 私有方法 initFactions 使其抛错
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(initializer as unknown as { initFactions: () => Promise<void> }, 'initFactions')
        .mockRejectedValueOnce(new Error('阵营表修复失败'));

      // Act & Assert
      await expect(initializer.reinitializeData()).rejects.toThrow('阵营表修复失败');
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  // ==================== 生产环境日志（DEV=false 分支） ====================

  describe('生产环境日志（DEV=false）', () => {
    it('initializeData 成功时不输出 DEV 日志', async () => {
      // Arrange：切换到生产环境，监听 console.log
      vi.stubEnv('DEV', false);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      await initializer.initializeData();

      // Assert：DEV 日志分支被跳过（不打印 '初始化游戏数据中...' / '游戏数据初始化完成'）
      expect(logSpy).not.toHaveBeenCalled();
      // 数据仍正确写入
      expect(await db.config_factions.count()).toBe(mockSeedData.FACTIONS.length);
    });

    it('initializeData 出错时生产环境仅输出简短错误信息', async () => {
      // Arrange：生产环境 + 事务内抛 Error
      vi.stubEnv('DEV', false);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(initializer as unknown as { initLocations: () => Promise<void> }, 'initLocations')
        .mockRejectedValueOnce(new Error('地点表写入失败'));

      // Act & Assert：进入 catch 的 else 分支，输出 '错误:' 简短信息
      await expect(initializer.initializeData()).rejects.toThrow('地点表写入失败');
      expect(errorSpy).toHaveBeenCalledWith('错误:', '地点表写入失败');
    });

    it('resetData 在生产环境不输出 DEV 日志', async () => {
      // Arrange：写入初始化标志后切换生产环境
      await db.runtime_gameState.put({
        id: 'data_initialized',
        initializedAt: new Date().toISOString(),
      } as GameStateStorage);
      vi.stubEnv('DEV', false);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      await initializer.resetData();

      // Assert：DEV 日志分支被跳过
      expect(logSpy).not.toHaveBeenCalled();
      expect(await initializer.isDataInitialized()).toBe(false);
    });

    it('reinitializeData 在生产环境不输出 DEV 日志', async () => {
      // Arrange：先初始化，再切换生产环境
      await initializer.initializeData();
      vi.stubEnv('DEV', false);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Act
      await initializer.reinitializeData();

      // Assert：DEV 日志分支被跳过（不打印 '开始修复基础数据...' / '基础数据修复完成'）
      expect(logSpy).not.toHaveBeenCalled();
      expect(await db.config_factions.count()).toBe(mockSeedData.FACTIONS.length);
    });
  });
});

// ============================================================================
// BackupService 测试
// ============================================================================

describe('BackupService 数据备份服务', () => {
  let backupService: BackupService;
  let initializer: DataInitializer;

  beforeEach(async () => {
    await clearAllTables();
    backupService = new BackupService();
    initializer = new DataInitializer();
    eventBus.clearAll();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==================== createBackup ====================

  describe('createBackup 创建备份', () => {
    it('生成包含 version/timestamp/checksum/data 的完整备份对象', async () => {
      // Arrange：先初始化数据
      await initializer.initializeData();

      // Act
      const backup = await backupService.createBackup();

      // Assert
      expect(backup.version).toBe(BACKUP_CONFIG.backupVersion);
      expect(typeof backup.timestamp).toBe('number');
      expect(backup.timestamp).toBeGreaterThan(0);
      expect(typeof backup.checksum).toBe('string');
      expect(backup.checksum.length).toBeGreaterThan(0);
      expect(backup.gameVersion).toBe('1.0.0');
      expect(backup.data).toBeDefined();
    });

    it('相同数据返回相同校验和', async () => {
      // Arrange
      await initializer.initializeData();

      // Act
      const backup1 = await backupService.createBackup();
      const backup2 = await backupService.createBackup();

      // Assert：data 相同则 checksum 相同（timestamp 不同不影响 checksum）
      expect(backup1.checksum).toBe(backup2.checksum);
    });

    it('不同数据返回不同校验和', async () => {
      // Arrange
      await initializer.initializeData();
      const backup1 = await backupService.createBackup();

      // Act：修改数据库数据
      await db.config_factions.put({
        id: 'new_faction_extra',
        name: '额外阵营',
        icon: 'icon',
        color: '#fff',
        description: '新增',
      });

      const backup2 = await backupService.createBackup();

      // Assert
      expect(backup1.checksum).not.toBe(backup2.checksum);
    });
  });

  // ==================== collectAllData（通过 createBackup 间接验证）====================

  describe('collectAllData 收集各表数据（通过 createBackup 间接验证）', () => {
    it('收集到的数据包含所有 BackupData 必填字段', async () => {
      // Arrange
      await initializer.initializeData();

      // Act
      const backup = await backupService.createBackup();

      // Assert：验证 BackupData 的所有必填字段都存在
      expect(backup.data.characters).toBeDefined();
      expect(backup.data.inventory).toBeDefined();
      expect(backup.data.quests).toBeDefined();
      expect(backup.data.equipment).toBeDefined();
      expect(backup.data.skills).toBeDefined();
      expect(backup.data.exploration).toBeDefined();
      expect(backup.data.combat).toBeDefined();
      expect(backup.data.adventureLog).toBeDefined();
      expect(backup.data.map).toBeDefined();
      expect(backup.data.shop).toBeDefined();
      expect(backup.data.gameState).toBeDefined();
      expect(backup.data.shopItems).toBeDefined();
    });

    it('收集到的配置表数据与数据库一致', async () => {
      // Arrange
      await initializer.initializeData();

      // Act
      const backup = await backupService.createBackup();

      // Assert：验证配置表数据被正确收集
      expect(backup.data.factions).toBeDefined();
      expect(backup.data.factions!.length).toBe(mockSeedData.FACTIONS.length);
      expect(backup.data.races).toBeDefined();
      expect(backup.data.races!.length).toBe(mockSeedData.RACES.length);
      expect(backup.data.classes).toBeDefined();
      expect(backup.data.classes!.length).toBe(mockSeedData.CLASSES.length);
      expect(backup.data.bosses).toBeDefined();
      expect(backup.data.bosses!.length).toBe(mockSeedData.BOSSES.length);
    });

    it('收集到的运行时数据包含 gameState', async () => {
      // Arrange
      await initializer.initializeData();

      // Act
      const backup = await backupService.createBackup();

      // Assert：gameState 应包含初始化标志和游戏常量
      expect(Object.keys(backup.data.gameState).length).toBeGreaterThan(0);
      expect(backup.data.gameState['data_initialized']).toBeDefined();
      expect(backup.data.gameState['game_constants']).toBeDefined();
    });
  });

  // ==================== exportBackup ====================

  describe('exportBackup 导出备份文件', () => {
    it('调用 downloadBlob 下载 JSON 文件', async () => {
      // Arrange
      await initializer.initializeData();

      // Act
      await backupService.exportBackup();

      // Assert
      expect(downloadBlob).toHaveBeenCalledTimes(1);
      const [blob, filename] = vi.mocked(downloadBlob).mock.calls[0];
      expect(blob).toBeInstanceOf(Blob);
      expect(filename).toContain('wow_dnd_backup_');
      expect(filename).toContain('.json');
    });

    it('导出的 Blob 包含有效的 BackupFile JSON', async () => {
      // Arrange
      await initializer.initializeData();

      // Act
      await backupService.exportBackup();

      // Assert：解析 Blob 内容验证
      const [blob] = vi.mocked(downloadBlob).mock.calls[0];
      const text = await (blob as Blob).text();
      const parsed = JSON.parse(text) as BackupFile;
      expect(parsed.version).toBe(BACKUP_CONFIG.backupVersion);
      expect(parsed.checksum).toBeDefined();
      expect(parsed.data).toBeDefined();
    });
  });

  // ==================== collectAllData 运行时数据收集 ====================

  describe('collectAllData 收集运行时数据（combat/adventureLog/mapState/shopItems）', () => {
    it('正确收集战斗日志键（含 battleLogId 降级键）', async () => {
      // Arrange
      await seedRuntimeData();

      // Act
      const backup = await backupService.createBackup();

      // Assert：含 battleLogId 的记录以 battleLogId 为键
      expect(backup.data.combat['battle_1']).toBeDefined();
      // 不含 battleLogId 的记录以 ${combatId}_${timestamp} 为键
      expect(backup.data.combat['combat_2_2000']).toBeDefined();
    });

    it('正确收集冒险日志（entries 缺失时降级为空数组）', async () => {
      // Arrange
      await seedRuntimeData();

      // Act
      const backup = await backupService.createBackup();

      // Assert：含 entries 的角色日志保留条目
      expect(backup.data.adventureLog['char_1']).toHaveLength(1);
      // entries 缺失的角色降级为空数组
      expect(backup.data.adventureLog['char_2']).toEqual([]);
    });

    it('正确收集 mapState、shopItems、characters 运行时数据', async () => {
      // Arrange
      await seedRuntimeData();

      // Act
      const backup = await backupService.createBackup();

      // Assert
      expect(backup.data.mapState!['map_char_1']).toBeDefined();
      expect(backup.data.shopItems['shop_1']).toBeDefined();
      expect(backup.data.characters['char_1']).toBeDefined();
    });
  });
});

// ============================================================================
// ImportService 测试
// ============================================================================

describe('ImportService 数据导入服务', () => {
  let importService: ImportService;
  let backupService: BackupService;
  let initializer: DataInitializer;

  beforeEach(async () => {
    await clearAllTables();
    importService = new ImportService();
    backupService = new BackupService();
    initializer = new DataInitializer();
    eventBus.clearAll();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==================== checkVersionCompatibility ====================

  describe('checkVersionCompatibility 版本兼容性检查', () => {
    it('支持的版本返回兼容且无需迁移', () => {
      // Act
      const result = importService.checkVersionCompatibility(BACKUP_CONFIG.backupVersion);

      // Assert
      expect(result.compatible).toBe(true);
      expect(result.requiresMigration).toBe(false);
      expect(result.message).toBe('版本兼容');
    });

    it('不支持的版本返回不兼容', () => {
      // Act
      const result = importService.checkVersionCompatibility('v0.9');

      // Assert
      expect(result.compatible).toBe(false);
      expect(result.requiresMigration).toBe(false);
      expect(result.message).toContain('版本');
    });

    it('空版本字符串返回不兼容', () => {
      // Act
      const result = importService.checkVersionCompatibility('');

      // Assert
      expect(result.compatible).toBe(false);
    });
  });

  // ==================== validateBackup ====================

  describe('validateBackup 验证备份文件', () => {
    it('有效数据返回 success=true', async () => {
      // Arrange：先初始化数据并创建有效备份
      await initializer.initializeData();
      const backup = await backupService.createBackup();
      const file = backupToFile(backup);

      // Act
      const result = await importService.validateBackup(file);

      // Assert
      expect(result.success).toBe(true);
      expect(result.version).toBe(BACKUP_CONFIG.backupVersion);
      expect(result.timestamp).toBe(backup.timestamp);
    });

    it('checksum 不匹配时返回错误', async () => {
      // Arrange
      await initializer.initializeData();
      const backup = await backupService.createBackup();
      const corruptedBackup: BackupFile = { ...backup, checksum: 'invalid_checksum' };
      const file = backupToFile(corruptedBackup);

      // Act
      const result = await importService.validateBackup(file);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('损坏');
    });

    it('缺少 version 字段时返回格式错误', async () => {
      // Arrange：构造缺少 version 的非法 JSON
      const invalidData = { timestamp: Date.now(), checksum: 'abc', data: createMinimalBackupData() };
      const file = new File([JSON.stringify(invalidData)], 'backup.json', { type: 'application/json' });

      // Act
      const result = await importService.validateBackup(file);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('格式错误');
    });

    it('JSON 解析失败时返回格式错误', async () => {
      // Arrange：构造非法 JSON 字符串
      const file = new File(['{invalid json}'], 'backup.json', { type: 'application/json' });

      // Act
      const result = await importService.validateBackup(file);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('格式错误');
    });

    it('版本不兼容时返回版本错误', async () => {
      // Arrange：构造版本不兼容的备份（修改 version 不影响 checksum，因为 checksum 基于 data）
      await initializer.initializeData();
      const backup = await backupService.createBackup();
      const incompatibleBackup: BackupFile = { ...backup, version: 'v0.9' };
      const file = backupToFile(incompatibleBackup);

      // Act
      const result = await importService.validateBackup(file);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('版本');
    });
  });

  // ==================== importBackup ====================

  describe('importBackup 导入备份文件', () => {
    it('有效备份时成功导入数据到各表', async () => {
      // Arrange：先初始化数据并创建备份
      await initializer.initializeData();
      const backup = await backupService.createBackup();
      const file = backupToFile(backup);

      // 清空数据库模拟数据丢失
      await clearAllTables();
      expect(await db.config_factions.count()).toBe(0);

      // Act
      const result = await importService.importBackup(file);

      // Assert：导入成功
      expect(result.success).toBe(true);
      expect(result.importedStores.length).toBeGreaterThan(0);
      // 验证数据已写入数据库
      expect(await db.config_factions.count()).toBe(mockSeedData.FACTIONS.length);
      expect(await db.config_races.count()).toBe(mockSeedData.RACES.length);
      // gameState 应包含备份中的数据
      expect(await db.runtime_gameState.count()).toBeGreaterThan(0);
    });

    it('空备份数据时所有表计入 skippedStores', async () => {
      // Arrange：清空数据库后创建备份（所有数据为空，checksum 由 createBackup 正确计算）
      await clearAllTables();
      const emptyBackup = await backupService.createBackup();
      const file = backupToFile(emptyBackup);

      // Act
      const result = await importService.importBackup(file);

      // Assert：数据为空时所有表计入 skippedStores
      expect(result.success).toBe(true);
      expect(result.skippedStores.length).toBeGreaterThan(0);
    });

    it('无效数据（checksum 不匹配）时不导入并返回错误', async () => {
      // Arrange
      await initializer.initializeData();
      const backup = await backupService.createBackup();
      const corruptedBackup: BackupFile = { ...backup, checksum: 'invalid_checksum' };
      const file = backupToFile(corruptedBackup);

      // Act
      const result = await importService.importBackup(file);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.importedStores).toEqual([]);
    });

    it('导入包含配置表数据的备份后数据库数据正确', async () => {
      // Arrange：先向数据库写入测试数据，再 createBackup 获取正确 checksum
      await clearAllTables();
      await db.config_factions.put({
        id: 'faction_imported', name: '导入阵营', icon: 'shield', color: '#000', description: '导入测试',
      });
      await db.runtime_gameState.put({ id: 'imported_key', maxLevel: 99 } as GameStateStorage);
      const backup = await backupService.createBackup();
      const file = backupToFile(backup);

      // 清空数据库模拟数据丢失
      await clearAllTables();
      expect(await db.config_factions.count()).toBe(0);

      // Act
      const result = await importService.importBackup(file);

      // Assert：导入后数据恢复
      expect(result.success).toBe(true);
      expect(result.importedStores).toContain('config_factions');
      const factions = await db.config_factions.toArray();
      expect(factions.length).toBe(1);
      expect(factions[0].id).toBe('faction_imported');
    });
  });

  // ==================== validateBackup 文件读取错误 ====================

  describe('validateBackup 文件读取错误', () => {
    it('FileReader 触发 onerror 时返回读取失败', async () => {
      // Arrange：mock readAsText 触发 onerror
      mockFileReaderReadError();
      const file = new File(['{}'], 'backup.json', { type: 'application/json' });

      // Act
      const result = await importService.validateBackup(file);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('读取文件失败');
    });
  });

  // ==================== importBackup 文件读取错误与导入异常 ====================

  describe('importBackup 文件读取错误', () => {
    it('验证通过但后续读取失败时返回读取失败结果', async () => {
      // Arrange：mock validateBackup 成功（绕过首次读取），mock 第二次读取失败
      vi.spyOn(importService, 'validateBackup').mockResolvedValueOnce({
        success: true,
        version: BACKUP_CONFIG.backupVersion,
        timestamp: Date.now(),
      });
      mockFileReaderReadError();
      const file = new File(['{}'], 'backup.json', { type: 'application/json' });

      // Act
      const result = await importService.importBackup(file);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('读取文件失败');
      expect(result.importedStores).toEqual([]);
    });
  });

  describe('importBackup 导入过程异常', () => {
    it('importData 抛出异常时 catch 返回导入失败结果', async () => {
      // Arrange：创建有效备份文件，mock 私有方法 importData 抛错（覆盖 importBackup 的 catch）
      await initializer.initializeData();
      const backup = await backupService.createBackup();
      const file = backupToFile(backup);
      vi.spyOn(
        importService as unknown as { importData: (data: BackupData) => Promise<ImportResult> },
        'importData'
      ).mockRejectedValueOnce(new Error('导入数据异常'));

      // Act
      const result = await importService.importBackup(file);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('导入失败');
      expect(result.error).toContain('导入数据异常');
      expect(result.importedStores).toEqual([]);
    });
  });

  // ==================== importData 事务异常 ====================

  describe('importData 事务异常', () => {
    it('事务失败时返回错误结果（不向上抛出）', async () => {
      // Arrange：创建有效备份文件，mock db.transaction 抛错（覆盖 importData 的 catch）
      await initializer.initializeData();
      const backup = await backupService.createBackup();
      const file = backupToFile(backup);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('事务锁定失败'));

      // Act
      const result = await importService.importBackup(file);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('事务锁定失败');
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  // ==================== importData 冒险日志映射 ====================

  describe('importData 冒险日志映射', () => {
    it('导入含 adventureLog 数据的备份时写入 runtime_adventureLogs', async () => {
      // Arrange：构造含 adventureLog 条目的备份数据
      const logEntry: LogEntry = { id: 'log_1', timestamp: 1000, type: 'combat', message: '战斗胜利' };
      const backupData: BackupData = {
        ...createMinimalBackupData(),
        adventureLog: { char_1: [logEntry] },
      };
      const backup: BackupFile = {
        version: BACKUP_CONFIG.backupVersion,
        timestamp: Date.now(),
        checksum: 'placeholder',
        gameVersion: '1.0.0',
        data: backupData,
      };
      const file = backupToFile(backup);
      // mock validateBackup 成功，绕过 checksum 校验以聚焦 importData 映射逻辑
      vi.spyOn(importService, 'validateBackup').mockResolvedValueOnce({
        success: true,
        version: BACKUP_CONFIG.backupVersion,
        timestamp: backup.timestamp,
      });

      // Act
      const result = await importService.importBackup(file);

      // Assert
      expect(result.success).toBe(true);
      expect(result.importedStores).toContain('runtime_adventureLogs');
      const logs = await db.runtime_adventureLogs.toArray();
      expect(logs).toHaveLength(1);
      expect(logs[0].characterId).toBe('char_1');
      expect(logs[0].entries).toHaveLength(1);
      expect(logs[0].updatedAt).toBeTypeOf('number');
    });

    it('备份不含 adventureLog 字段时计入 skippedStores', async () => {
      // Arrange：构造不含 adventureLog 的备份数据（模拟旧版本备份，覆盖三元运算 false 分支）
      const { adventureLog: _omit, ...rest } = createMinimalBackupData();
      const backupData = rest as BackupData;
      const backup: BackupFile = {
        version: BACKUP_CONFIG.backupVersion,
        timestamp: Date.now(),
        checksum: 'placeholder',
        gameVersion: '1.0.0',
        data: backupData,
      };
      const file = backupToFile(backup);
      vi.spyOn(importService, 'validateBackup').mockResolvedValueOnce({
        success: true,
        version: BACKUP_CONFIG.backupVersion,
        timestamp: backup.timestamp,
      });

      // Act
      const result = await importService.importBackup(file);

      // Assert
      expect(result.success).toBe(true);
      expect(result.skippedStores).toContain('runtime_adventureLogs');
      expect(await db.runtime_adventureLogs.count()).toBe(0);
    });
  });

  // ==================== checkVersionCompatibility 旧版迁移 ====================

  describe('checkVersionCompatibility 旧版迁移', () => {
    it('支持的旧版本返回兼容且需要迁移', () => {
      // Arrange：覆盖私有 SUPPORTED_VERSIONS 模拟多版本支持场景（最新版置于末尾，旧版 'v0.9' 非末尾 → 需迁移）
      (importService as unknown as { SUPPORTED_VERSIONS: string[] }).SUPPORTED_VERSIONS = ['v0.9', 'v1.0'];

      // Act
      const result = importService.checkVersionCompatibility('v0.9');

      // Assert
      expect(result.compatible).toBe(true);
      expect(result.requiresMigration).toBe(true);
    });
  });
});
