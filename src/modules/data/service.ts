/**
 * 数据服务模块
 *
 * 提供游戏数据的初始化、备份、导入等高级服务功能。
 * 包括：
 * - DataInitializer: 游戏数据初始化服务
 * - BackupService: 数据备份服务
 * - ImportService: 数据导入服务
 */
import { db } from './core';
import type { GameStateStorage } from './core';
import { eventBus, GameEvents } from '../bus/core';
import type { FactionStorage, RaceStorage, ClassStorage, CharacterDataStorage } from '../character/types';
import type { ItemStorage, InventoryStorage } from '../inventory/types';
import type { EquipmentItemStorage, EquipmentStorage } from '../equipment/types';
import type { EnemyStorage } from '../enemy/types';
import type { BossStorage } from '../boss/types';
import { bossDbService } from '../boss/db';
import type { BossTemplate } from '../boss/types';
import type { LocationStorage, MapStateStorage } from '../map/types';
import type { ShopConfigStorage, ShopItemsStorage } from '../shop/types';
import type { SkillConfigStorage, CharSkillsStorage } from '../skill/types';
import type { QuestConfigStorage, CharQuestStorage } from '../quest/types';
import type { ExplorationStorage } from '../exploration/types';
import type { CombatLogStorage } from '../combat/types';
import type { AdventureLogStorage } from '../log/types';
import { BACKUP_CONFIG } from '@/config/database';

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
  RACES,
  FACTIONS,
  MAX_LEVEL
} from '@/data';

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
    hash = hash & hash;
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

    console.log('初始化游戏数据中...');

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

            await db.runtime_gameState.put({
              id: this.initFlagKey,
              initializedAt: new Date().toISOString()
            } as GameStateStorage);
          }
        }
      );

      console.log('游戏数据初始化完成');
      
      // 通知 baseStore 重新加载最新数据
      eventBus.emit(GameEvents.GAME_DATA_UPDATED, { type: 'init', action: 'bulk', id: '*' });
    } catch (error) {
      console.error('初始化游戏数据失败:', error);
      if (error instanceof Error) {
        console.error('错误名称:', error.name);
        console.error('错误信息:', error.message);
        console.error('错误栈:', error.stack);
      }
      throw error;
    }
  }

  /**
   * 初始化阵营数据
   */
  private async initFactions(): Promise<void> {
    for (const faction of FACTIONS) {
      await db.config_factions.put(faction as unknown as FactionStorage);
    }
  }

  /**
   * 初始化种族数据
   */
  private async initRaces(): Promise<void> {
    for (const race of RACES) {
      await db.config_races.put(race as unknown as RaceStorage);
    }
  }

  /**
   * 初始化职业数据
   */
  private async initClasses(): Promise<void> {
    for (const cls of CLASSES) {
      await db.config_classes.put(cls as unknown as ClassStorage);
    }
  }

  /**
   * 初始化物品数据
   */
  private async initItems(): Promise<void> {
    for (const item of LOOT_ITEMS) {
      await db.config_items.put(item as unknown as ItemStorage);
    }
  }

  /**
   * 初始化装备数据
   */
  private async initEquipment(): Promise<void> {
    for (const equipment of EQUIPMENT_ITEMS) {
      await db.config_equipmentItems.put(equipment as unknown as EquipmentItemStorage);
    }
  }

  /**
   * 初始化普通怪物数据
   */
  private async initMobs(): Promise<void> {
    for (const mob of MOBS) {
      await db.config_mobs.put(mob as unknown as EnemyStorage);
    }
  }

  /**
   * 初始化 Boss 怪物数据
   */
  private async initBosses(): Promise<void> {
    for (const boss of BOSSES) {
      await bossDbService.saveBossTemplate(boss as unknown as BossTemplate);
    }
  }

  /**
   * 初始化地点数据
   */
  private async initLocations(): Promise<void> {
    for (const location of LOCATIONS) {
      await db.config_locations.put(location as unknown as LocationStorage);
    }
  }

  /**
   * 初始化大陆数据
   */
  private async initContinents(): Promise<void> {
    for (const continent of CONTINENTS) {
      await db.config_locations.put(continent as unknown as LocationStorage);
    }
  }

  /**
   * 初始化商店数据
   */
  private async initShops(): Promise<void> {
    for (const shop of SHOPS) {
      await db.config_shops.put(shop as unknown as ShopConfigStorage);
    }

    await db.runtime_gameState.put({
      id: 'shop_config',
    } as GameStateStorage);
  }

  /**
   * 初始化任务数据
   */
  private async initQuests(): Promise<void> {
    for (const quest of QUESTS) {
      await db.config_quests.put(quest as unknown as QuestConfigStorage);
    }
  }

  /**
   * 初始化技能模板数据
   */
  private async initSkillTemplates(): Promise<void> {
    for (const entry of CLASS_ABILITIES) {
      for (const skill of entry.skills) {
        await db.config_skills.put({
          ...skill,
          classRestriction: entry.class_id
        } as unknown as SkillConfigStorage);
      }
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
   * 重置数据初始化标志
   *
   * 调用此方法后，下次启动时会重新初始化数据
   */
  async resetData(): Promise<void> {
    await db.runtime_gameState.delete(this.initFlagKey);
    console.log('数据初始化标志已重置');
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `wow_dnd_backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
   * @returns BackupData - 备份数据对象
   */
  private async collectAllData(): Promise<BackupData> {
    const characterRecords = (await db.char_data.toArray()) as unknown[];
    const inventoryRecords = (await db.char_inventory.toArray()) as unknown[];
    const questsRecords = (await db.char_quests.toArray()) as unknown[];
    const equipmentRecords = (await db.char_equipment.toArray()) as unknown[];
    const skillsRecords = (await db.char_skills.toArray()) as unknown[];
    const explorationRecords =
      (await db.char_exploration.toArray()) as unknown[];
    const combatRecords = (await db.runtime_combatLogs.toArray()) as unknown[];
    const adventureLogRecords =
      (await db.runtime_adventureLogs.toArray()) as unknown[];
    const mapRecords = (await db.config_locations.toArray()) as unknown[];
    const shopRecords = (await db.config_shops.toArray()) as unknown[];
    const gameStateRecords = (await db.runtime_gameState.toArray()) as unknown[];
    const mapStateRecords = (await db.runtime_mapState.toArray()) as unknown[];
    const shopItemsRecords = (await db.runtime_shopItems.toArray()) as unknown[];

    // 收集完整配置表数据
    const factionsRecords = (await db.config_factions.toArray()) as unknown[];
    const racesRecords = (await db.config_races.toArray()) as unknown[];
    const classesRecords = (await db.config_classes.toArray()) as unknown[];
    const itemsRecords = (await db.config_items.toArray()) as unknown[];
    const equipmentItemsRecords = (await db.config_equipmentItems.toArray()) as unknown[];
    const mobsRecords = (await db.config_mobs.toArray()) as unknown[];
    const bossesRecords = (await db.config_bosses.toArray()) as unknown[];
    const skillTemplatesRecords = (await db.config_skills.toArray()) as unknown[];

    const characters: Record<string, unknown> = {};
    characterRecords.forEach((item: any) => {
      characters[item.characterId] = item;
    });

    const inventory: Record<string, unknown> = {};
    inventoryRecords.forEach((item: any) => {
      inventory[item.characterId] = item;
    });

    const quests: Record<string, unknown> = {};
    questsRecords.forEach((item: any) => {
      quests[item.characterId] = item;
    });

    const equipment: Record<string, unknown> = {};
    equipmentRecords.forEach((item: any) => {
      equipment[item.characterId] = item;
    });

    const skills: Record<string, unknown> = {};
    skillsRecords.forEach((item: any) => {
      skills[item.characterId] = item;
    });

    const exploration: Record<string, unknown> = {};
    explorationRecords.forEach((item: any) => {
      exploration[item.characterId] = item;
    });

    const combat: Record<string, unknown> = {};
    combatRecords.forEach((item: any) => {
      combat[item.battleLogId || `${item.combatId}_${item.timestamp}`] = item;
    });

    const adventureLog: Record<string, unknown[]> = {};
    adventureLogRecords.forEach((item: any) => {
      adventureLog[item.characterId] = item.entries || [];
    });

    const mapState: Record<string, unknown> = {};
    mapStateRecords.forEach((item: any) => {
      mapState[item.id] = item;
    });

    const gameState: Record<string, unknown> = {};
    gameStateRecords.forEach((item: any) => {
      gameState[item.id] = item;
    });

    const shopItems: Record<string, unknown> = {};
    shopItemsRecords.forEach((item: any) => {
      shopItems[item.shopId] = item;
    });

    return {
      characters: characters as BackupData['characters'],
      inventory: inventory as BackupData['inventory'],
      quests: quests as BackupData['quests'],
      equipment: equipment as BackupData['equipment'],
      skills: skills as BackupData['skills'],
      exploration: exploration as BackupData['exploration'],
      combat: combat as BackupData['combat'],
      adventureLog: adventureLog as BackupData['adventureLog'],
      map: mapRecords as BackupData['map'],
      shop: shopRecords as BackupData['shop'],
      gameState: gameState as BackupData['gameState'],
      shopItems: shopItems as BackupData['shopItems'],
      mapState: mapState as BackupData['mapState'],
      // 配置表数据
      factions: factionsRecords as Record<string, unknown>[],
      races: racesRecords as Record<string, unknown>[],
      classes: classesRecords as Record<string, unknown>[],
      items: itemsRecords as Record<string, unknown>[],
      equipmentItems: equipmentItemsRecords as Record<string, unknown>[],
      mobs: mobsRecords as Record<string, unknown>[],
      bosses: bossesRecords as Record<string, unknown>[],
      skillTemplates: skillTemplatesRecords as Record<string, unknown>[]
    };
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
    return new Promise((resolve, reject) => {
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
        reject(new Error('读取文件失败'));
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
          if (data.characters && Object.keys(data.characters).length > 0) {
            await db.char_data.bulkPut(Object.values(data.characters) as unknown as CharacterDataStorage[]);
            importedStores.push('char_data');
          } else {
            skippedStores.push('char_data');
          }

          if (data.inventory && Object.keys(data.inventory).length > 0) {
            await db.char_inventory.bulkPut(Object.values(data.inventory) as unknown as InventoryStorage[]);
            importedStores.push('char_inventory');
          } else {
            skippedStores.push('char_inventory');
          }

          if (data.quests && Object.keys(data.quests).length > 0) {
            await db.char_quests.bulkPut(Object.values(data.quests) as unknown as CharQuestStorage[]);
            importedStores.push('char_quests');
          } else {
            skippedStores.push('char_quests');
          }

          if (data.equipment && Object.keys(data.equipment).length > 0) {
            await db.char_equipment.bulkPut(Object.values(data.equipment) as unknown as EquipmentStorage[]);
            importedStores.push('char_equipment');
          } else {
            skippedStores.push('char_equipment');
          }

          if (data.skills && Object.keys(data.skills).length > 0) {
            await db.char_skills.bulkPut(Object.values(data.skills) as unknown as CharSkillsStorage[]);
            importedStores.push('char_skills');
          } else {
            skippedStores.push('char_skills');
          }

          if (data.exploration && Object.keys(data.exploration).length > 0) {
            await db.char_exploration.bulkPut(Object.values(data.exploration) as unknown as ExplorationStorage[]);
            importedStores.push('char_exploration');
          } else {
            skippedStores.push('char_exploration');
          }

          if (data.combat && Object.keys(data.combat).length > 0) {
            await db.runtime_combatLogs.bulkPut(Object.values(data.combat) as unknown as CombatLogStorage[]);
            importedStores.push('runtime_combatLogs');
          } else {
            skippedStores.push('runtime_combatLogs');
          }

          if (data.adventureLog && Object.keys(data.adventureLog).length > 0) {
            const logEntries = Object.entries(data.adventureLog).map(
              ([characterId, entries]) => ({
                characterId,
                entries
              })
            ) as unknown as AdventureLogStorage[];
            await db.runtime_adventureLogs.bulkPut(logEntries);
            importedStores.push('runtime_adventureLogs');
          } else {
            skippedStores.push('runtime_adventureLogs');
          }

          if (data.map && data.map.length > 0) {
            await db.config_locations.bulkPut(data.map as unknown as LocationStorage[]);
            importedStores.push('config_locations');
          } else {
            skippedStores.push('config_locations');
          }

          if (data.shop && data.shop.length > 0) {
            await db.config_shops.bulkPut(data.shop as unknown as ShopConfigStorage[]);
            importedStores.push('config_shops');
          } else {
            skippedStores.push('config_shops');
          }

          // 恢复配置表数据（v1.1 新增，兼容旧备份不含这些字段）
          if (data.factions && data.factions.length > 0) {
            await db.config_factions.bulkPut(data.factions as unknown as FactionStorage[]);
            importedStores.push('config_factions');
          }
          if (data.races && data.races.length > 0) {
            await db.config_races.bulkPut(data.races as unknown as RaceStorage[]);
            importedStores.push('config_races');
          }
          if (data.classes && data.classes.length > 0) {
            await db.config_classes.bulkPut(data.classes as unknown as ClassStorage[]);
            importedStores.push('config_classes');
          }
          if (data.items && data.items.length > 0) {
            await db.config_items.bulkPut(data.items as unknown as ItemStorage[]);
            importedStores.push('config_items');
          }
          if (data.equipmentItems && data.equipmentItems.length > 0) {
            await db.config_equipmentItems.bulkPut(data.equipmentItems as unknown as EquipmentItemStorage[]);
            importedStores.push('config_equipmentItems');
          }
          if (data.mobs && data.mobs.length > 0) {
            await db.config_mobs.bulkPut(data.mobs as unknown as EnemyStorage[]);
            importedStores.push('config_mobs');
          }
          if (data.bosses && data.bosses.length > 0) {
            await db.config_bosses.bulkPut(data.bosses as unknown as BossStorage[]);
            importedStores.push('config_bosses');
          }
          if (data.skillTemplates && data.skillTemplates.length > 0) {
            await db.config_skills.bulkPut(data.skillTemplates as unknown as SkillConfigStorage[]);
            importedStores.push('config_skills');
          }

          if (data.gameState && Object.keys(data.gameState).length > 0) {
            await db.runtime_gameState.bulkPut(Object.values(data.gameState) as unknown as GameStateStorage[]);
            importedStores.push('runtime_gameState');
          } else {
            skippedStores.push('runtime_gameState');
          }

          // 恢复地图运行时状态（含 currentLocationId、视图状态等）
          if (data.mapState && Object.keys(data.mapState).length > 0) {
            await db.runtime_mapState.bulkPut(Object.values(data.mapState) as unknown as MapStateStorage[]);
            importedStores.push('runtime_mapState');
          }

          // 恢复商店商品数据
          if (data.shopItems && Object.keys(data.shopItems).length > 0) {
            await db.runtime_shopItems.bulkPut(Object.values(data.shopItems) as unknown as ShopItemsStorage[]);
            importedStores.push('runtime_shopItems');
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

/**
 * 获取游戏数据
 *
 * 从 runtime_gameState 表中获取指定键的数据
 * @param key - 数据键名
 * @returns T | null - 数据对象或 null
 */
export async function getGameData<T>(key: string): Promise<T | null> {
  const result = await db.runtime_gameState.get(key);
  if (result) return result as unknown as T;

  console.warn(`数据库中未找到游戏数据: ${key}`);
  return null;
}
