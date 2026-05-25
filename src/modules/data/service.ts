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

export class DataInitializer {
  private initFlagKey = 'data_initialized';

  async isDataInitialized(): Promise<boolean> {
    const result = await db.gameState.get(this.initFlagKey);
    return result !== undefined;
  }

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

  private async initConstants(): Promise<void> {
    await db.gameState.put({
      id: 'game_constants',
      maxLevel: MAX_LEVEL
    });
  }

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

  private async initQuestData(): Promise<void> {
    await db.gameState.put({
      id: 'quest_templates',
      data: QUESTS
    });
  }

  private async initFactions(): Promise<void> {
    for (const [_id, faction] of Object.entries(FACTIONS)) {
      await db.factions.add(faction);
    }
  }

  private async initRaces(): Promise<void> {
    for (const [_id, race] of Object.entries(RACES)) {
      await db.races.add(race);
    }
  }

  private async initClasses(): Promise<void> {
    for (const [_id, cls] of Object.entries(CLASSES)) {
      await db.classes.add(cls);
    }
  }

  private async initItemTypes(): Promise<void> {
    for (const [_id, itemType] of Object.entries(ITEM_TYPES)) {
      await db.itemTypes.add(itemType);
    }
  }

  private async initItems(): Promise<void> {
    for (const item of LOOT_ITEMS) {
      await db.items.add(item);
    }
  }

  private async initEquipment(): Promise<void> {
    for (const equipment of EQUIPMENT_ITEMS) {
      await db.equipmentItems.add(equipment);
    }
  }

  private async initEnemies(): Promise<void> {
    for (const [id, enemy] of Object.entries(ENEMIES)) {
      await db.enemies.add({ id, ...enemy });
    }
  }

  private async initRarityConfig(): Promise<void> {
    await db.rarityConfigs.put({
      id: 'rarity_config',
      config: RARITY_CONFIG
    });
  }

  private async initClassAbilities(): Promise<void> {
    for (const [classId, abilities] of Object.entries(CLASS_ABILITIES)) {
      await db.classAbilities.add({ classId, abilities });
    }
  }

  async resetData(): Promise<void> {
    await db.gameState.delete(this.initFlagKey);
    console.log('Data initialization flag cleared.');
  }
}

export interface IBackupService {
  createBackup(): Promise<BackupFile>;
  exportBackup(): Promise<void>;
  getAutoBackups(): Promise<BackupFile[]>;
  deleteBackup(timestamp: number): Promise<void>;
  clearAutoBackups(): Promise<void>;
}

export interface IImportService {
  validateBackup(file: File): Promise<ValidationResult>;
  importBackup(file: File): Promise<ImportResult>;
  checkVersionCompatibility(backupVersion: string): CompatibilityResult;
}

export class BackupService implements IBackupService {
  private readonly AUTO_BACKUP_KEY = BACKUP_CONFIG.autoBackupKey;
  private readonly MAX_AUTO_BACKUPS = BACKUP_CONFIG.maxAutoBackups;
  private readonly BACKUP_VERSION = BACKUP_CONFIG.backupVersion;

  async createBackup(): Promise<BackupFile> {
    const timestamp = Date.now();
    const data = await this.collectAllData();
    const checksum = this.calculateChecksum(data);

    return {
      version: this.BACKUP_VERSION,
      timestamp,
      checksum,
      gameVersion: '1.0.0',
      data
    };
  }

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

  async deleteBackup(timestamp: number): Promise<void> {
    const backups = await this.getAutoBackups();
    const filtered = backups.filter(b => b.timestamp !== timestamp);
    localStorage.setItem(this.AUTO_BACKUP_KEY, JSON.stringify(filtered));
  }

  async clearAutoBackups(): Promise<void> {
    localStorage.removeItem(this.AUTO_BACKUP_KEY);
  }

  async createAutoBackup(): Promise<void> {
    const backup = await this.createBackup();
    const backups = await this.getAutoBackups();
    backups.unshift(backup);
    
    if (backups.length > this.MAX_AUTO_BACKUPS) {
      backups.pop();
    }
    
    localStorage.setItem(this.AUTO_BACKUP_KEY, JSON.stringify(backups));
  }

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

  private calculateChecksum(data: unknown): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

export class ImportService implements IImportService {
  private readonly SUPPORTED_VERSIONS = BACKUP_CONFIG.supportedVersions;

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
          
          const checksum = this.calculateChecksum(backup.data);
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

  private calculateChecksum(data: unknown): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

export const dataInitializer = new DataInitializer();
export const backupService = new BackupService();
export const importService = new ImportService();

export async function getGameData<T>(key: string): Promise<T | null> {
  const result = await db.gameState.get(key);
  if (result) return result as unknown as T;
  
  console.warn(`Game data not found in database: ${key}`);
  return null;
}