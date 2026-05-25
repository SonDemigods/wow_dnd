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
import { BACKUP_CONFIG } from '@/config/database';
import type { BackupFile, BackupData, ValidationResult, ImportResult, CompatibilityResult } from './types';
import { 
  CONTINENTS, 
  LOCATIONS, 
  SHOPS, 
  QUESTS, 
  ENEMIES, 
  EQUIPMENT_ITEMS, 
  LOOT_ITEMS, 
  CLASSES, 
  CLASS_ABILITIES, 
  RACES, 
  FACTIONS, 
  ITEM_TYPES, 
  RARITY_CONFIG, 
  ITEM_BASE_PRICES, 
  RARITY_PRICE_MULTIPLIER, 
  RARITY_SELL_DISCOUNT, 
  ITEM_POOLS, 
  SHOP_TYPE_ITEM_POOL,
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
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * 初始化数据接口
 * 
 * 定义游戏初始化数据的结构
 */
export interface InitData {
  map: {
    continents: typeof CONTINENTS;
    locations: typeof LOCATIONS;
  };
  shops: typeof SHOPS;
  quests: typeof QUESTS;
  enemies: typeof ENEMIES;
  equipment: typeof EQUIPMENT_ITEMS;
  items: typeof LOOT_ITEMS;
  classes: typeof CLASSES;
  classAbilities: typeof CLASS_ABILITIES;
  races: typeof RACES;
  factions: typeof FACTIONS;
  itemTypes: typeof ITEM_TYPES;
  rarityConfig: typeof RARITY_CONFIG;
  itemBasePrices: typeof ITEM_BASE_PRICES;
  rarityPriceMultiplier: typeof RARITY_PRICE_MULTIPLIER;
  raritySellDiscount: typeof RARITY_SELL_DISCOUNT;
  itemPools: typeof ITEM_POOLS;
  shopTypeItemPool: typeof SHOP_TYPE_ITEM_POOL;
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
    const result = await db.gameState.get(this.initFlagKey);
    return result !== undefined;
  }

  /**
   * 初始化游戏数据
   * 
   * 如果数据已初始化则跳过，否则执行完整的初始化流程
   */
  async initializeData(): Promise<void> {
    const isInitialized = await this.isDataInitialized();
    if (isInitialized) {
      console.log('Data already initialized, skipping...');
      return;
    }

    console.log('Initializing game data...');

    try {
      await db.transaction('rw', 
        db.factions, db.races, db.classes, db.items, 
        db.equipmentItems, db.enemies, db.itemTypes, 
        db.rarityConfigs, db.classAbilities, db.map, 
        db.shop, db.gameState, 
        async () => {
          await this.initConstants();
          await this.initMapData();
          await this.initShopData();
          await this.initQuestData();
          await this.initFactions();
          await this.initRaces();
          await this.initClasses();
          await this.initItemTypes();
          await this.initItems();
          await this.initEquipment();
          await this.initEnemies();
          await this.initRarityConfig();
          await this.initClassAbilities();

          await db.gameState.put({
            id: this.initFlagKey,
            initializedAt: new Date().toISOString()
          });
        });

      console.log('Game data initialization completed.');
    } catch (error) {
      console.error('Failed to initialize game data:', error);
      throw error;
    }
  }

  /**
   * 初始化游戏常量
   */
  private async initConstants(): Promise<void> {
    await db.gameState.put({
      id: 'game_constants',
      maxLevel: MAX_LEVEL
    });
  }

  /**
   * 初始化地图数据
   */
  private async initMapData(): Promise<void> {
    await db.map.put({
      id: 'continents',
      data: CONTINENTS
    });

    await db.map.put({
      id: 'locations',
      data: LOCATIONS
    });
  }

  /**
   * 初始化商店数据
   */
  private async initShopData(): Promise<void> {
    for (const [_shopId, shopConfig] of Object.entries(SHOPS)) {
      await db.shop.put(shopConfig as Record<string, unknown>);
    }

    await db.gameState.put({
      id: 'shop_config',
      itemBasePrices: ITEM_BASE_PRICES,
      rarityPriceMultiplier: RARITY_PRICE_MULTIPLIER,
      raritySellDiscount: RARITY_SELL_DISCOUNT,
      itemPools: ITEM_POOLS,
      shopTypeItemPool: SHOP_TYPE_ITEM_POOL
    });
  }

  /**
   * 初始化任务数据
   */
  private async initQuestData(): Promise<void> {
    await db.gameState.put({
      id: 'quest_templates',
      data: QUESTS
    });
  }

  /**
   * 初始化阵营数据
   */
  private async initFactions(): Promise<void> {
    for (const [_id, faction] of Object.entries(FACTIONS)) {
      await db.factions.add(faction);
    }
  }

  /**
   * 初始化种族数据
   */
  private async initRaces(): Promise<void> {
    for (const [_id, race] of Object.entries(RACES)) {
      await db.races.add(race);
    }
  }

  /**
   * 初始化职业数据
   */
  private async initClasses(): Promise<void> {
    for (const [_id, cls] of Object.entries(CLASSES)) {
      await db.classes.add(cls);
    }
  }

  /**
   * 初始化物品类型数据
   */
  private async initItemTypes(): Promise<void> {
    for (const [_id, itemType] of Object.entries(ITEM_TYPES)) {
      await db.itemTypes.add(itemType);
    }
  }

  /**
   * 初始化物品数据
   */
  private async initItems(): Promise<void> {
    for (const item of LOOT_ITEMS) {
      await db.items.add(item);
    }
  }

  /**
   * 初始化装备数据
   */
  private async initEquipment(): Promise<void> {
    for (const equipment of EQUIPMENT_ITEMS) {
      await db.equipmentItems.add(equipment);
    }
  }

  /**
   * 初始化敌人数据
   */
  private async initEnemies(): Promise<void> {
    for (const [id, enemy] of Object.entries(ENEMIES)) {
      await db.enemies.add({ id, ...enemy });
    }
  }

  /**
   * 初始化稀有度配置
   */
  private async initRarityConfig(): Promise<void> {
    await db.rarityConfigs.put({
      id: 'rarity_config',
      config: RARITY_CONFIG
    });
  }

  /**
   * 初始化职业技能数据
   */
  private async initClassAbilities(): Promise<void> {
    for (const [classId, abilities] of Object.entries(CLASS_ABILITIES)) {
      await db.classAbilities.add({ classId, abilities });
    }
  }

  /**
   * 重置数据初始化标志
   * 
   * 调用此方法后，下次启动时会重新初始化数据
   */
  async resetData(): Promise<void> {
    await db.gameState.delete(this.initFlagKey);
    console.log('Data initialization flag cleared.');
  }
}

/**
 * 备份服务接口
 */
export interface IBackupService {
  createBackup(): Promise<BackupFile>;
  exportBackup(): Promise<void>;
  getAutoBackups(): Promise<BackupFile[]>;
  deleteBackup(timestamp: number): Promise<void>;
  clearAutoBackups(): Promise<void>;
}

/**
 * 导入服务接口
 */
export interface IImportService {
  validateBackup(file: File): Promise<ValidationResult>;
  importBackup(file: File): Promise<ImportResult>;
  checkVersionCompatibility(backupVersion: string): CompatibilityResult;
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
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
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
      console.error('Failed to load auto backups:', error);
    }
    return [];
  }

  /**
   * 删除指定备份
   * @param timestamp - 备份时间戳
   */
  async deleteBackup(timestamp: number): Promise<void> {
    const backups = await this.getAutoBackups();
    const filtered = backups.filter(b => b.timestamp !== timestamp);
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
   * 从数据库中读取所有需要备份的数据表
   * @returns BackupData - 备份数据对象
   */
  private async collectAllData(): Promise<BackupData> {
    const characters = await db.characters.toArray() as unknown[];
    const characterDataRecords = await db.characterData.toArray() as unknown[];
    const inventoryRecords = await db.inventory.toArray() as unknown[];
    const questsRecords = await db.quests.toArray() as unknown[];
    const equipmentRecords = await db.equipment.toArray() as unknown[];
    const skillsRecords = await db.skills.toArray() as unknown[];
    const explorationRecords = await db.exploration.toArray() as unknown[];
    const combatRecords = await db.combat.toArray() as unknown[];
    const adventureLogRecords = await db.adventureLog.toArray() as unknown[];
    const mapRecords = await db.map.toArray() as unknown[];
    const shopRecords = await db.shop.toArray() as unknown[];
    const gameStateRecord = await db.gameState.get('gameState');

    const characterData: Record<string, unknown> = {};
    characterDataRecords.forEach((item: any) => {
      characterData[item.characterId] = item;
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
      combat[item.characterId] = item;
    });

    const adventureLog: Record<string, unknown[]> = {};
    adventureLogRecords.forEach((item: any) => {
      adventureLog[item.characterId] = item.entries || [];
    });

    return {
      characters: characters as BackupData['characters'],
      characterData: characterData as BackupData['characterData'],
      inventory: inventory as BackupData['inventory'],
      quests: quests as BackupData['quests'],
      equipment: equipment as BackupData['equipment'],
      skills: skills as BackupData['skills'],
      exploration: exploration as BackupData['exploration'],
      combat: combat as BackupData['combat'],
      adventureLog: adventureLog as BackupData['adventureLog'],
      map: mapRecords as BackupData['map'],
      shop: shopRecords as BackupData['shop'],
      gameState: gameStateRecord as BackupData['gameState']
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
      return { success: false, error: validation.error, importedStores: [], skippedStores: [] };
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
          resolve({ success: false, error: '导入失败: ' + (error as Error).message, importedStores: [], skippedStores: [] });
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
        requiresMigration: backupVersion !== this.SUPPORTED_VERSIONS[this.SUPPORTED_VERSIONS.length - 1]
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
      await db.transaction('rw', 
        db.characters, db.characterData, db.inventory,
        db.quests, db.equipment, db.skills,
        db.exploration, db.combat, db.adventureLog,
        db.map, db.shop, db.gameState,
        async () => {
          if (data.characters && data.characters.length > 0) {
            await db.characters.bulkPut(data.characters);
            importedStores.push('characters');
          } else {
            skippedStores.push('characters');
          }

          if (data.characterData && Object.keys(data.characterData).length > 0) {
            await db.characterData.bulkPut(Object.values(data.characterData));
            importedStores.push('characterData');
          } else {
            skippedStores.push('characterData');
          }

          if (data.inventory && Object.keys(data.inventory).length > 0) {
            await db.inventory.bulkPut(Object.values(data.inventory));
            importedStores.push('inventory');
          } else {
            skippedStores.push('inventory');
          }

          if (data.quests && Object.keys(data.quests).length > 0) {
            await db.quests.bulkPut(Object.values(data.quests));
            importedStores.push('quests');
          } else {
            skippedStores.push('quests');
          }

          if (data.equipment && Object.keys(data.equipment).length > 0) {
            await db.equipment.bulkPut(Object.values(data.equipment));
            importedStores.push('equipment');
          } else {
            skippedStores.push('equipment');
          }

          if (data.skills && Object.keys(data.skills).length > 0) {
            await db.skills.bulkPut(Object.values(data.skills));
            importedStores.push('skills');
          } else {
            skippedStores.push('skills');
          }

          if (data.exploration && Object.keys(data.exploration).length > 0) {
            await db.exploration.bulkPut(Object.values(data.exploration));
            importedStores.push('exploration');
          } else {
            skippedStores.push('exploration');
          }

          if (data.combat && Object.keys(data.combat).length > 0) {
            await db.combat.bulkPut(Object.values(data.combat));
            importedStores.push('combat');
          } else {
            skippedStores.push('combat');
          }

          if (data.adventureLog && Object.keys(data.adventureLog).length > 0) {
            const logEntries = Object.entries(data.adventureLog).map(([characterId, entries]) => ({
              characterId,
              entries
            }));
            await db.adventureLog.bulkPut(logEntries);
            importedStores.push('adventureLog');
          } else {
            skippedStores.push('adventureLog');
          }

          if (data.map && data.map.length > 0) {
            await db.map.bulkPut(data.map);
            importedStores.push('map');
          } else {
            skippedStores.push('map');
          }

          if (data.shop && data.shop.length > 0) {
            await db.shop.bulkPut(data.shop);
            importedStores.push('shop');
          } else {
            skippedStores.push('shop');
          }

          if (data.gameState) {
            await db.gameState.put({ id: 'gameState', ...data.gameState });
            importedStores.push('gameState');
          } else {
            skippedStores.push('gameState');
          }
        }
      );

      return { success: true, importedStores, skippedStores };
    } catch (error) {
      console.error('Failed to import data:', error);
      return { success: false, error: (error as Error).message, importedStores, skippedStores };
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
 * 从 gameState 表中获取指定键的数据
 * @param key - 数据键名
 * @returns T | null - 数据对象或 null
 */
export async function getGameData<T>(key: string): Promise<T | null> {
  const result = await db.gameState.get(key);
  if (result) return result as unknown as T;
  
  console.warn(`Game data not found in database: ${key}`);
  return null;
}