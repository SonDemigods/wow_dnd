/**
 * 数据服务模块
 *
 * 提供游戏数据的初始化、备份、导入等高级服务功能。
 * 包括：
 * - DataInitializer: 游戏数据初始化服务
 * - BackupService: 数据备份服务
 * - ImportService: 数据导入服务
 */
import type { Table } from 'dexie';
import { db, getTable } from './core';
import type { GameStateStorage, GameDatabaseSchema } from './core';
import { eventBus, GameEvents } from '../bus';
import type { FactionStorage, RaceStorage, ClassStorage } from '../character/types';
import type { ItemStorage } from '../inventory/types';
import type { EquipmentTemplateStorage } from '../equipment/types';
import type { EnemyStorage } from '../enemy/types';
import type { BossStorage } from '../boss/types';
import type { LocationData, MapStateStorage } from '../map/types';
import type { ShopConfig, ShopItemsStorage } from '../shop/types';
import type { SkillTemplateStorage } from '../skill/types';
import type { CombatLogStorage } from '../combat/types';
import type { AdventureLogData, LogEntry } from '../log/types';
import { BACKUP_CONFIG } from '@/config/database';
import { downloadBlob } from '@/utils/fileDownload';

import type {
  BackupFile,
  BackupData,
  ValidationResult,
  ImportResult,
  CompatibilityResult,
  IBackupService,
  IImportService
} from './types';
import {
  CONTINENTS,
  LOCATIONS,
  SHOPS,
  QUESTS,
  MOBS,
  BOSSES,
  EQUIPMENT_ITEMS,
  LOOT_ITEMS,
  CLASSES,
  CLASS_ABILITIES,
  MONSTER_ABILITIES,
  RACES,
  FACTIONS,
  MAX_LEVEL,
  CLASS_SPECIFIC_ITEMS,
  CLASS_PASSIVES,
  CLASS_TALENT_TREES,
  ITEM_SETS
} from '@/data';

/**
 * 需要备份的数组形状表配置
 *
 * 定义备份中"直接以数组形式存储"的表（配置表 + map/shop）。
 * collectAllData 读取与 importData 写入均基于此配置驱动，避免重复的 if/else
 * 和散落的类型断言（CODE-34/CODE-38）。
 *
 * 注意：getTable<T> 内部收敛了 Table 类型断言（CODE-5），调用方无需再断言。
 */

/** 数组形状备份字段名集合（用于类型安全的字段访问） */
type ArrayBackupField =
  | 'map'
  | 'shop'
  | 'factions'
  | 'races'
  | 'classes'
  | 'items'
  | 'equipmentItems'
  | 'mobs'
  | 'bosses'
  | 'skillTemplates';

const TABLES_TO_BACKUP: ReadonlyArray<{
  /** BackupData 中对应的字段名 */
  field: ArrayBackupField;
  /** GameDatabase 中对应的表名 */
  table: keyof GameDatabaseSchema;
  /** 导入结果中记录的存储表名 */
  storeName: string;
}> = [
  { field: 'map', table: 'config_locations', storeName: 'config_locations' },
  { field: 'shop', table: 'config_shops', storeName: 'config_shops' },
  { field: 'factions', table: 'config_factions', storeName: 'config_factions' },
  { field: 'races', table: 'config_races', storeName: 'config_races' },
  { field: 'classes', table: 'config_classes', storeName: 'config_classes' },
  { field: 'items', table: 'config_items', storeName: 'config_items' },
  { field: 'equipmentItems', table: 'config_equipmentItems', storeName: 'config_equipmentItems' },
  { field: 'mobs', table: 'config_mobs', storeName: 'config_mobs' },
  { field: 'bosses', table: 'config_bosses', storeName: 'config_bosses' },
  { field: 'skillTemplates', table: 'config_skills', storeName: 'config_skills' },
];

/**
 * 计算数据的校验和（简单哈希算法）
 *
 * 用于验证备份文件的完整性
 * @param data - 要计算校验和的数据
 * @returns 校验和字符串
 */
function calculateChecksum(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
  }
  return Math.abs(hash).toString(16);
}

/**
 * 数据初始化服务类
 *
 * 负责在游戏首次启动时初始化基础游戏数据，包括：
 * - 阵营、种族、职业数据
 * - 物品、装备、敌人数据
 * - 地图、商店、任务数据
 * - 配置信息
 */
export class DataInitializer {
  /** 初始化标志键名 */
  private initFlagKey = 'data_initialized';

  /**
   * 检查数据是否已初始化
   * @returns true 表示已初始化，false 表示未初始化
   */
  async isDataInitialized(): Promise<boolean> {
    const result = await db.runtime_gameState.get(this.initFlagKey);
    return result !== undefined;
  }

  /**
   * 初始化游戏数据
   *
   * 如果数据已初始化则跳过，否则执行完整的初始化流程
   */
  async initializeData(): Promise<void> {
    const isInitialized = await this.isDataInitialized();

    if (import.meta.env.DEV) console.log('初始化游戏数据中...');

    try {
      await db.transaction(
        'rw',
        [
          db.config_factions,
          db.config_races,
          db.config_classes,
          db.config_items,
          db.config_equipmentItems,
          db.config_mobs,
          db.config_bosses,
          db.config_locations,
          db.config_shops,
          db.config_quests,
          db.config_skills,
          db.config_class_items,
          db.config_class_passives,
          db.config_class_talents,
          db.config_item_sets,
          db.runtime_gameState,
          db.runtime_mapState,
        ],
        async () => {
          // 地点和大陆数据每次都更新
          await this.initLocations();
          await this.initContinents();

          if (!isInitialized) {
            await this.initFactions();
            await this.initRaces();
            await this.initClasses();
            await this.initItems();
            await this.initEquipment();
            await this.initMobs();
            await this.initBosses();
            await this.initShops();
            await this.initQuests();
            await this.initSkillTemplates();
            await this.initGameConstants();
            // DATA-4：职业专属数据持久化（供 admin 后台编辑）
            await this.initClassItems();
            await this.initClassPassives();
            await this.initClassTalents();
            await this.initItemSets();

            await db.runtime_gameState.put({
              id: this.initFlagKey,
              initializedAt: new Date().toISOString()
            } as GameStateStorage);
          }
        }
      );

      if (import.meta.env.DEV) console.log('游戏数据初始化完成');

      // 通知 baseStore 重新加载最新数据
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, { type: 'init', action: 'bulk', id: '*' });
    } catch (error) {
      console.error('初始化游戏数据失败:', error);
      // DBG-3：生产环境仅输出简短信息，避免泄露完整堆栈
      if (error instanceof Error) {
        if (import.meta.env.DEV) {
          console.error('错误名称:', error.name);
          console.error('错误信息:', error.message);
          console.error('错误栈:', error.stack);
        } else {
          console.error('错误:', error.message);
        }
      }
      throw error;
    }
  }

  /**
   * 通用的表数据初始化方法
   *
   * 将数据数组批量写入指定的数据库表。
   * INIT-1：使用 bulkPut 替代逐条 await put，减少事务往返，加速冷启动。
   *
   * @param table - 目标数据库表
   * @param data - 待写入的数据数组
   */
  private async initTable(table: Table, data: readonly unknown[]): Promise<void> {
    if (data.length > 0) {
      await table.bulkPut(data as unknown[]);
    }
  }

  /**
   * 初始化阵营数据
   */
  private async initFactions(): Promise<void> {
    await this.initTable(db.config_factions, FACTIONS);
  }

  /**
   * 初始化种族数据
   */
  private async initRaces(): Promise<void> {
    await this.initTable(db.config_races, RACES);
  }

  /**
   * 初始化职业数据
   */
  private async initClasses(): Promise<void> {
    await this.initTable(db.config_classes, CLASSES);
  }

  /**
   * 初始化物品数据
   */
  private async initItems(): Promise<void> {
    await this.initTable(db.config_items, LOOT_ITEMS);
  }

  /**
   * 初始化装备数据
   */
  private async initEquipment(): Promise<void> {
    await this.initTable(db.config_equipmentItems, EQUIPMENT_ITEMS);
  }

  /**
   * 初始化普通怪物数据
   */
  private async initMobs(): Promise<void> {
    await this.initTable(db.config_mobs, MOBS);
  }

  /**
   * 初始化 Boss 怪物数据
   * ARCH-1 修复：移除对 boss 模块 DbService 的运行时依赖，内联字段转换逻辑，
   * 使用 bulkPut 批量写入（同时优化 PERF-1 的 N+1 写入问题）。
   * 字段转换与 boss/db.ts 的 saveBossTemplate 保持一致。
   */
  private async initBosses(): Promise<void> {
    if (BOSSES.length === 0) return;
    const bossData: BossStorage[] = BOSSES.map(boss => ({
      id: boss.id,
      name: boss.name,
      icon: boss.icon,
      maxHp: boss.maxHp,
      damage: boss.damage,
      xp: boss.xp,
      gold: boss.gold,
      dangerLevel: boss.dangerLevel,
      isBoss: 1,
      // undefined → null：确保 IndexedDB 索引字段存在
      physicalAttack: boss.physicalAttack ?? null,
      physicalDefense: boss.physicalDefense ?? null,
      magicAttack: boss.magicAttack ?? null,
      magicDefense: boss.magicDefense ?? null,
      critChance: boss.critChance ?? null,
      dodgeChance: boss.dodgeChance ?? null,
      // undefined 直接保留（这些字段不参与索引）
      skillPool: boss.skillPool || undefined,
      aiStrategy: boss.aiStrategy || undefined,
      phases: boss.phases || undefined,
      intro: boss.intro || undefined
    }));
    await db.config_bosses.bulkPut(bossData);
  }

  /**
   * 初始化地点数据
   */
  private async initLocations(): Promise<void> {
    await this.initTable(db.config_locations, LOCATIONS);
  }

  /**
   * 初始化大陆数据
   */
  private async initContinents(): Promise<void> {
    await this.initTable(db.config_locations, CONTINENTS);
  }

  /**
   * 初始化商店数据
   */
  private async initShops(): Promise<void> {
    await this.initTable(db.config_shops, SHOPS);
  }

  /**
   * 初始化任务数据
   */
  private async initQuests(): Promise<void> {
    await this.initTable(db.config_quests, QUESTS);
  }

  /**
   * 初始化技能模板数据（含职业技能与怪物技能）
   *
   * 注意：此处仍需 as unknown as SkillTemplateStorage 断言，因为 @/data 中的
   * CLASS_ABILITIES / MONSTER_ABILITIES 常量使用 typeof 推断类型，与 SkillTemplateStorage
   * 存在微妙的类型不匹配（如 classRestriction 字段由外层追加）。待 @/data 常量添加显式类型
   * 注解后可移除此断言。
   */
  private async initSkillTemplates(): Promise<void> {
    // 1. 写入职业技能模板（usableBy 默认为 'player'）
    for (const entry of CLASS_ABILITIES) {
      for (const skill of entry.skills) {
        await db.config_skills.put({
          ...skill,
          classRestriction: entry.class_id,
          usableBy: 'player'
        } as unknown as SkillTemplateStorage);
      }
    }
    // 2. 写入怪物/首领技能模板（usableBy = 'enemy'）
    for (const skill of MONSTER_ABILITIES) {
      await db.config_skills.put({
        ...skill,
        classRestriction: null,
        usableBy: 'enemy'
      } as unknown as SkillTemplateStorage);
    }
  }

  /**
   * 初始化游戏常量
   */
  private async initGameConstants(): Promise<void> {
    await db.runtime_gameState.put({
      id: 'game_constants',
      maxLevel: MAX_LEVEL
    } as GameStateStorage);
  }

  /**
   * 初始化职业专属装备数据（DATA-4）
   *
   * 将静态常量 CLASS_SPECIFIC_ITEMS 写入 config_class_items 表，
   * 供 admin 后台编辑。业务模块仍直接 import 静态常量保持同步访问。
   */
  private async initClassItems(): Promise<void> {
    await this.initTable(db.config_class_items, CLASS_SPECIFIC_ITEMS);
  }

  /**
   * 初始化职业被动技能数据（DATA-4）
   */
  private async initClassPassives(): Promise<void> {
    await this.initTable(db.config_class_passives, CLASS_PASSIVES);
  }

  /**
   * 初始化职业天赋树数据（DATA-4）
   */
  private async initClassTalents(): Promise<void> {
    await this.initTable(db.config_class_talents, CLASS_TALENT_TREES);
  }

  /**
   * 初始化套装定义数据（DATA-4）
   */
  private async initItemSets(): Promise<void> {
    await this.initTable(db.config_item_sets, ITEM_SETS);
  }

  /**
   * 重置数据初始化标志
   *
   * 调用此方法后，下次启动时会重新初始化数据
   */
  async resetData(): Promise<void> {
    await db.runtime_gameState.delete(this.initFlagKey);
    if (import.meta.env.DEV) console.log('数据初始化标志已重置');
  }

  /**
   * 修复基础数据：清空所有 config_ 开头的表，然后重新导入默认数据
   *
   * 用于用户手动触发的基础数据修复操作。
   * 注意：此操作不会影响角色数据（char_* 表）。
   */
  async reinitializeData(): Promise<void> {
    if (import.meta.env.DEV) console.log('开始修复基础数据...');

    try {
      await db.transaction(
        'rw',
        [
          db.config_factions,
          db.config_races,
          db.config_classes,
          db.config_items,
          db.config_equipmentItems,
          db.config_mobs,
          db.config_bosses,
          db.config_locations,
          db.config_shops,
          db.config_quests,
          db.config_skills,
          db.config_class_items,
          db.config_class_passives,
          db.config_class_talents,
          db.config_item_sets,
          db.runtime_gameState,
          db.runtime_mapState,
        ],
        async () => {
          // 清空所有 config 表
          await db.config_factions.clear();
          await db.config_races.clear();
          await db.config_classes.clear();
          await db.config_items.clear();
          await db.config_equipmentItems.clear();
          await db.config_mobs.clear();
          await db.config_bosses.clear();
          await db.config_locations.clear();
          await db.config_shops.clear();
          await db.config_quests.clear();
          await db.config_skills.clear();
          await db.config_class_items.clear();
          await db.config_class_passives.clear();
          await db.config_class_talents.clear();
          await db.config_item_sets.clear();

          // 重新导入所有基础数据
          await this.initFactions();
          await this.initRaces();
          await this.initClasses();
          await this.initItems();
          await this.initEquipment();
          await this.initMobs();
          await this.initBosses();
          await this.initLocations();
          await this.initContinents();
          await this.initShops();
          await this.initQuests();
          await this.initSkillTemplates();
          await this.initGameConstants();
          // DATA-4：职业专属数据持久化（供 admin 后台编辑）
          await this.initClassItems();
          await this.initClassPassives();
          await this.initClassTalents();
          await this.initItemSets();

          // 更新初始化标志
          await db.runtime_gameState.put({
            id: this.initFlagKey,
            initializedAt: new Date().toISOString()
          } as GameStateStorage);
        }
      );

      if (import.meta.env.DEV) console.log('基础数据修复完成');

      // 通知 baseStore 重新加载最新数据
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, { type: 'repair', action: 'bulk', id: '*' });
    } catch (error) {
      console.error('修复基础数据失败:', error);
      throw error;
    }
  }
}

/**
 * 备份服务类
 *
 * 提供游戏数据的备份功能，包括：
 * - 创建备份
 * - 导出备份文件
 * - 自动备份管理
 */
export class BackupService implements IBackupService {
  /** 自动备份存储键名 */
  private readonly AUTO_BACKUP_KEY = BACKUP_CONFIG.autoBackupKey;
  /** 最大自动备份数量 */
  private readonly MAX_AUTO_BACKUPS = BACKUP_CONFIG.maxAutoBackups;
  /** 备份版本号 */
  private readonly BACKUP_VERSION = BACKUP_CONFIG.backupVersion;

  /**
   * 创建备份
   *
   * 收集所有游戏数据并生成备份对象
   * @returns BackupFile - 备份文件对象
   */
  async createBackup(): Promise<BackupFile> {
    const timestamp = Date.now();
    const data = await this.collectAllData();
    const checksum = calculateChecksum(data);

    return {
      version: this.BACKUP_VERSION,
      timestamp,
      checksum,
      gameVersion: '1.0.0',
      data
    };
  }

  /**
   * 导出备份文件
   *
   * 将备份数据导出为 JSON 文件供用户下载
   */
  async exportBackup(): Promise<void> {
    const backup = await this.createBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json'
    });
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    downloadBlob(blob, `wow_dnd_backup_${dateStr}.json`);
  }

  /**
   * 获取所有自动备份
   * @returns BackupFile[] - 自动备份列表
   */
  async getAutoBackups(): Promise<BackupFile[]> {
    try {
      const stored = localStorage.getItem(this.AUTO_BACKUP_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('加载自动备份失败:', error);
    }
    return [];
  }

  /**
   * 删除指定备份
   * @param timestamp - 备份时间戳
   */
  async deleteBackup(timestamp: number): Promise<void> {
    const backups = await this.getAutoBackups();
    const filtered = backups.filter((b) => b.timestamp !== timestamp);
    localStorage.setItem(this.AUTO_BACKUP_KEY, JSON.stringify(filtered));
  }

  /**
   * 清除所有自动备份
   */
  async clearAutoBackups(): Promise<void> {
    localStorage.removeItem(this.AUTO_BACKUP_KEY);
  }

  /**
   * 创建自动备份
   *
   * 将最新备份添加到自动备份列表，超过最大数量时移除最旧的备份
   */
  async createAutoBackup(): Promise<void> {
    const backup = await this.createBackup();
    const backups = await this.getAutoBackups();
    backups.unshift(backup);

    if (backups.length > this.MAX_AUTO_BACKUPS) {
      backups.pop();
    }

    localStorage.setItem(this.AUTO_BACKUP_KEY, JSON.stringify(backups));
  }

  /**
   * 收集所有游戏数据
   *
   * 从数据库中读取所有需要备份的数据表，包括运行时数据和完整配置表。
   *
   * 性能与实现说明：
   * - PERF-2：所有互不依赖的表通过 Promise.all 并行读取，避免串行阻塞主线程。
   * - CODE-38：配置表清单与 TABLES_TO_BACKUP 保持一致，importData 写入时
   *   通过该配置驱动遍历，避免读取/写入两侧表名散落。
   * - CODE-5：配置表的 Table 类型断言收敛在 getTable<T> 内部，调用方无需
   *   `as unknown as XXX` 双重断言。
   *
   * @returns BackupData - 备份数据对象
   */
  private async collectAllData(): Promise<BackupData> {
    // PERF-2：互不依赖的表用 Promise.all 并行读取，避免串行阻塞主线程
    const [
      characterRecords, inventoryRecords, questsRecords, equipmentRecords,
      skillsRecords, explorationRecords, combatRecords, adventureLogRecords,
      gameStateRecords, mapStateRecords, shopItemsRecords,
      mapRecords, shopRecords, factionsRecords, racesRecords, classesRecords,
      itemsRecords, equipmentItemsRecords, mobsRecords, bossesRecords, skillTemplatesRecords
    ] = await Promise.all([
      // 角色表（Record 形状，以 characterId 为键）
      db.char_data.toArray(),
      db.char_inventory.toArray(),
      db.char_quests.toArray(),
      db.char_equipment.toArray(),
      db.char_skills.toArray(),
      db.char_exploration.toArray(),
      // 运行时表
      db.runtime_combatLogs.toArray(),
      db.runtime_adventureLogs.toArray(),
      db.runtime_gameState.toArray(),
      db.runtime_mapState.toArray(),
      db.runtime_shopItems.toArray(),
      // 配置表（数组形状）：通过 getTable<具体类型> 收敛 Table 类型断言（CODE-5）
      // 表清单与 TABLES_TO_BACKUP 配置保持一致
      getTable<LocationData>(db, 'config_locations').toArray(),
      getTable<ShopConfig>(db, 'config_shops').toArray(),
      getTable<FactionStorage>(db, 'config_factions').toArray(),
      getTable<RaceStorage>(db, 'config_races').toArray(),
      getTable<ClassStorage>(db, 'config_classes').toArray(),
      getTable<ItemStorage>(db, 'config_items').toArray(),
      getTable<EquipmentTemplateStorage>(db, 'config_equipmentItems').toArray(),
      getTable<EnemyStorage>(db, 'config_mobs').toArray(),
      getTable<BossStorage>(db, 'config_bosses').toArray(),
      getTable<SkillTemplateStorage>(db, 'config_skills').toArray(),
    ]);

    // 构建角色数据 Record（以 characterId 为键）
    const characters = this.toCharacterRecord(characterRecords);
    const inventory = this.toCharacterRecord(inventoryRecords);
    const quests = this.toCharacterRecord(questsRecords);
    const equipment = this.toCharacterRecord(equipmentRecords);
    const skills = this.toCharacterRecord(skillsRecords);
    const exploration = this.toCharacterRecord(explorationRecords);

    // combat 使用特殊键名（battleLogId 优先，缺失时降级为 combatId+timestamp 组合）
    const combat: Record<string, CombatLogStorage> = {};
    combatRecords.forEach((item) => {
      const key = item.battleLogId || `${item.combatId}_${item.timestamp}`;
      combat[key] = item;
    });

    // adventureLog 按 characterId 分组
    const adventureLog: Record<string, LogEntry[]> = {};
    adventureLogRecords.forEach((item) => {
      adventureLog[item.characterId] = item.entries || [];
    });

    // id-keyed Record
    const gameState: Record<string, GameStateStorage> = {};
    gameStateRecords.forEach((item) => { gameState[item.id] = item; });

    const mapState: Record<string, MapStateStorage> = {};
    mapStateRecords.forEach((item) => { mapState[item.id] = item; });

    const shopItems: Record<string, ShopItemsStorage> = {};
    shopItemsRecords.forEach((item) => { shopItems[item.shopId] = item; });

    return {
      characters,
      inventory,
      quests,
      equipment,
      skills,
      exploration,
      combat,
      adventureLog,
      map: mapRecords,
      shop: shopRecords,
      gameState,
      shopItems,
      mapState,
      factions: factionsRecords,
      races: racesRecords,
      classes: classesRecords,
      items: itemsRecords,
      equipmentItems: equipmentItemsRecords,
      mobs: mobsRecords,
      bosses: bossesRecords,
      skillTemplates: skillTemplatesRecords,
    };
  }

  /**
   * 将数组转换为以 characterId 为键的 Record
   */
  private toCharacterRecord<T extends { characterId: string }>(items: T[]): Record<string, T> {
    const record: Record<string, T> = {};
    for (const item of items) {
      record[item.characterId] = item;
    }
    return record;
  }
}

/**
 * 导入服务类
 *
 * 提供游戏数据的导入功能，包括：
 * - 验证备份文件
 * - 导入备份数据
 * - 版本兼容性检查
 */
export class ImportService implements IImportService {
  /** 支持的备份版本列表 */
  private readonly SUPPORTED_VERSIONS = BACKUP_CONFIG.supportedVersions;

  /**
   * 验证备份文件
   *
   * 检查备份文件的格式、完整性和版本兼容性
   * @param file - 备份文件
   * @returns ValidationResult - 验证结果
   */
  async validateBackup(file: File): Promise<ValidationResult> {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = () => {
        try {
          const content = reader.result as string;
          const backup = JSON.parse(content);

          if (!backup.version) {
            resolve({ success: false, error: '备份文件格式错误' });
            return;
          }

          const checksum = calculateChecksum(backup.data);
          if (checksum !== backup.checksum) {
            resolve({ success: false, error: '备份文件已损坏' });
            return;
          }

          const compatibility = this.checkVersionCompatibility(backup.version);
          if (!compatibility.compatible) {
            resolve({ success: false, error: compatibility.message });
            return;
          }

          resolve({
            success: true,
            version: backup.version,
            timestamp: backup.timestamp,
            gameVersion: backup.gameVersion
          });
        } catch (error) {
          resolve({ success: false, error: '备份文件格式错误' });
        }
      };

      reader.onerror = () => {
        resolve({ success: false, error: '读取文件失败' });
      };

      reader.readAsText(file);
    });
  }

  /**
   * 导入备份文件
   *
   * 验证备份文件后，将数据导入数据库
   * @param file - 备份文件
   * @returns ImportResult - 导入结果
   */
  async importBackup(file: File): Promise<ImportResult> {
    const validation = await this.validateBackup(file);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error,
        importedStores: [],
        skippedStores: []
      };
    }

    const reader = new FileReader();
    return new Promise((resolve) => {
      // P2-3：补充 onerror 回调，防止文件读取失败时 Promise 永不 resolve 导致 UI 卡死
      reader.onerror = () => {
        resolve({
          success: false,
          error: '读取文件失败',
          importedStores: [],
          skippedStores: []
        });
      };
      reader.onload = async () => {
        try {
          const content = reader.result as string;
          const backup = JSON.parse(content) as BackupFile;

          const result = await this.importData(backup.data);
          resolve(result);
        } catch (error) {
          resolve({
            success: false,
            error: '导入失败: ' + (error as Error).message,
            importedStores: [],
            skippedStores: []
          });
        }
      };

      reader.readAsText(file);
    });
  }

  /**
   * 检查版本兼容性
   *
   * @param backupVersion - 备份版本号
   * @returns CompatibilityResult - 兼容性检查结果
   */
  checkVersionCompatibility(backupVersion: string): CompatibilityResult {
    if (this.SUPPORTED_VERSIONS.includes(backupVersion)) {
      return {
        compatible: true,
        message: '版本兼容',
        requiresMigration:
          backupVersion !==
          this.SUPPORTED_VERSIONS[this.SUPPORTED_VERSIONS.length - 1]
      };
    }
    return {
      compatible: false,
      message: '备份文件版本过旧，请更新游戏',
      requiresMigration: false
    };
  }

  /**
   * 导入数据到数据库
   *
   * 将备份数据写入数据库的各个表
   * @param data - 备份数据
   * @returns ImportResult - 导入结果
   */
  private async importData(data: BackupData): Promise<ImportResult> {
    const importedStores: string[] = [];
    const skippedStores: string[] = [];

    try {
      await db.transaction(
        'rw',
        [
          db.char_data,
          db.char_inventory,
          db.char_quests,
          db.char_equipment,
          db.char_skills,
          db.char_exploration,
          db.runtime_combatLogs,
          db.runtime_adventureLogs,
          db.config_locations,
          db.config_shops,
          db.runtime_gameState,
          db.config_factions,
          db.config_races,
          db.config_classes,
          db.config_items,
          db.config_equipmentItems,
          db.config_mobs,
          db.config_bosses,
          db.config_skills,
          db.runtime_mapState,
          db.runtime_shopItems,
        ],
        async () => {
          // 辅助函数：Record 形状数据有数据则 bulkPut，否则计入 skipped
          const bulkPutIfNotEmpty = async <T>(
            table: Table,
            record: Record<string, T> | undefined,
            storeName: string
          ) => {
            if (record && Object.keys(record).length > 0) {
              await table.bulkPut(Object.values(record));
              importedStores.push(storeName);
            } else {
              skippedStores.push(storeName);
            }
          };

          // 辅助函数：数组形状数据有数据则 bulkPut，否则计入 skipped（CODE-34）
          const bulkPutArrayIfNotEmpty = async (
            table: Table,
            items: readonly unknown[] | undefined,
            storeName: string
          ) => {
            if (items && items.length > 0) {
              await table.bulkPut(items as unknown[]);
              importedStores.push(storeName);
            } else {
              skippedStores.push(storeName);
            }
          };

          // Record 形状的表（角色表 + 运行时表）
          await bulkPutIfNotEmpty(db.char_data, data.characters, 'char_data');
          await bulkPutIfNotEmpty(db.char_inventory, data.inventory, 'char_inventory');
          await bulkPutIfNotEmpty(db.char_quests, data.quests, 'char_quests');
          await bulkPutIfNotEmpty(db.char_equipment, data.equipment, 'char_equipment');
          await bulkPutIfNotEmpty(db.char_skills, data.skills, 'char_skills');
          await bulkPutIfNotEmpty(db.char_exploration, data.exploration, 'char_exploration');
          await bulkPutIfNotEmpty(db.runtime_combatLogs, data.combat, 'runtime_combatLogs');
          await bulkPutIfNotEmpty(db.runtime_gameState, data.gameState, 'runtime_gameState');
          await bulkPutIfNotEmpty(db.runtime_mapState, data.mapState, 'runtime_mapState');
          await bulkPutIfNotEmpty(db.runtime_shopItems, data.shopItems, 'runtime_shopItems');

          // adventureLog：转换为 AdventureLogData[] 后统一处理
          // 注意：补全 updatedAt 字段（AdventureLogData 必填，旧实现缺失导致类型不匹配）
          const adventureLogEntries: AdventureLogData[] = data.adventureLog
            ? Object.entries(data.adventureLog).map(([characterId, entries]) => ({
                characterId,
                entries,
                updatedAt: Date.now()
              }))
            : [];
          await bulkPutArrayIfNotEmpty(
            db.runtime_adventureLogs,
            adventureLogEntries,
            'runtime_adventureLogs'
          );

          // CODE-34：数组形状的配置表通过 TABLES_TO_BACKUP 配置驱动，
          // 消除 11 处结构相同的 if/else；断言收敛在 getTable 内部（CODE-5）
          for (const { field, table, storeName } of TABLES_TO_BACKUP) {
            await bulkPutArrayIfNotEmpty(getTable<unknown>(db, table), data[field], storeName);
          }
        }
      );

      return { success: true, importedStores, skippedStores };
    } catch (error) {
      console.error('导入数据失败:', error);
      return {
        success: false,
        error: (error as Error).message,
        importedStores,
        skippedStores
      };
    }
  }
}

/**
 * 数据初始化服务实例
 */
export const dataInitializer = new DataInitializer();

/**
 * 备份服务实例
 */
export const backupService = new BackupService();

/**
 * 导入服务实例
 */
export const importService = new ImportService();


