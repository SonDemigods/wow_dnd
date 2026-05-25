import Dexie, { Table } from 'dexie';
import { DATABASE_CONFIG, DB_SERVICE_CONFIG, SYNC_ENGINE_CONFIG } from '@/config/database';

export interface GameDatabaseSchema {
  characters: Table<Record<string, unknown>, string>;
  characterData: Table<Record<string, unknown>, string>;
  inventory: Table<Record<string, unknown>, string>;
  quests: Table<Record<string, unknown>, string>;
  equipment: Table<Record<string, unknown>, string>;
  skills: Table<Record<string, unknown>, string>;
  exploration: Table<Record<string, unknown>, string>;
  combat: Table<Record<string, unknown>, string>;
  adventureLog: Table<Record<string, unknown>, string>;
  
  factions: Table<Record<string, unknown>, string>;
  races: Table<Record<string, unknown>, string>;
  classes: Table<Record<string, unknown>, string>;
  items: Table<Record<string, unknown>, string>;
  equipmentItems: Table<Record<string, unknown>, string>;
  enemies: Table<Record<string, unknown>, string>;
  itemTypes: Table<Record<string, unknown>, string>;
  rarityConfigs: Table<Record<string, unknown>, string>;
  classAbilities: Table<Record<string, unknown>, string>;
  
  gameState: Table<Record<string, unknown>, string>;
  map: Table<Record<string, unknown>, string>;
  shop: Table<Record<string, unknown>, string>;
}

export class GameDatabase extends Dexie {
  characters!: Table<Record<string, unknown>, string>;
  characterData!: Table<Record<string, unknown>, string>;
  inventory!: Table<Record<string, unknown>, string>;
  quests!: Table<Record<string, unknown>, string>;
  equipment!: Table<Record<string, unknown>, string>;
  skills!: Table<Record<string, unknown>, string>;
  exploration!: Table<Record<string, unknown>, string>;
  combat!: Table<Record<string, unknown>, string>;
  adventureLog!: Table<Record<string, unknown>, string>;
  
  factions!: Table<Record<string, unknown>, string>;
  races!: Table<Record<string, unknown>, string>;
  classes!: Table<Record<string, unknown>, string>;
  items!: Table<Record<string, unknown>, string>;
  equipmentItems!: Table<Record<string, unknown>, string>;
  enemies!: Table<Record<string, unknown>, string>;
  itemTypes!: Table<Record<string, unknown>, string>;
  rarityConfigs!: Table<Record<string, unknown>, string>;
  classAbilities!: Table<Record<string, unknown>, string>;
  
  gameState!: Table<Record<string, unknown>, string>;
  map!: Table<Record<string, unknown>, string>;
  shop!: Table<Record<string, unknown>, string>;

  constructor() {
    super(DATABASE_CONFIG.name);

    this.version(1).stores({
      characters: 'id, name, factionId, raceId, classId',
      characterData: 'characterId',
      inventory: 'characterId',
      quests: 'characterId',
      equipment: 'characterId',
      skills: 'characterId',
      exploration: 'characterId',
      combat: 'characterId',
      adventureLog: 'characterId',
      gameState: 'id',
      map: 'id',
      shop: 'id'
    });

    this.version(2).stores({
      factions: 'id, name',
      races: 'id, name, factionId',
      classes: 'id, name, primaryStat',
      items: 'id, name, type, rarity',
      equipmentItems: 'id, name, type, rarity',
      enemies: 'id, name, dangerLevel',
      itemTypes: 'id, name',
      rarityConfigs: 'id',
      classAbilities: 'classId'
    }).upgrade(async () => {
      console.log('Migrating from version 1 to 2 - Adding base data tables');
    });

    this.version(3).stores({
      characters: 'id, name, factionId, raceId, classId, level',
      enemies: 'id, name, dangerLevel, isBoss'
    }).upgrade(async () => {
      console.log('Migrating from version 2 to 3 - Optimizing indexes');
    });

    this.version(4).stores({
      inventory: 'characterId, itemId',
      quests: 'characterId, status',
      equipment: 'characterId, slot',
      skills: 'characterId, skillId',
      exploration: 'characterId, locationId'
    }).upgrade(async () => {
      console.log('Migrating from version 3 to 4 - Adding optimized indexes');
    });

    this.on('populate', () => this.populateInitialData());
  }

  private async populateInitialData(): Promise<void> {
    await this.gameState.put({
      id: 'gameState',
      currentCharacterId: null,
      lastPlayedAt: new Date().toISOString(),
      settings: {
        soundEnabled: true,
        musicEnabled: true,
        autoSave: true,
        difficulty: 'normal'
      }
    });
  }
}

export const db = new GameDatabase();

export interface DBServiceOptions {
  maxRetries: number;
  delay: number;
  backoff: 'exponential' | 'linear';
}

export class DBService {
  private options: DBServiceOptions;

  constructor(options?: Partial<DBServiceOptions>) {
    this.options = { ...DB_SERVICE_CONFIG, ...options };
  }

  async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let retries = 0;
    let delay = this.options.delay;

    while (retries < this.options.maxRetries) {
      try {
        return await fn();
      } catch (error) {
        retries++;
        if (retries >= this.options.maxRetries) {
          throw error;
        }
        await this.sleep(delay);
        if (this.options.backoff === 'exponential') {
          delay *= 2;
        }
      }
    }

    throw new Error('Max retries exceeded');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  setOptions(options: Partial<DBServiceOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

export interface SyncOptions {
  debounceMs: number;
  maxRetries: number;
  delay: number;
  backoff: 'exponential' | 'linear';
}

const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  debounceMs: 500,
  maxRetries: 3,
  delay: 1000,
  backoff: 'exponential'
};

export class SyncEngine {
  private pendingSyncs: Map<string, unknown> = new Map();
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private options: SyncOptions;

  constructor(options?: Partial<SyncOptions>) {
    this.options = { ...DEFAULT_SYNC_OPTIONS, ...options };

    window.addEventListener('beforeunload', () => {
      this.flush();
    });
  }

  async sync(storeName: string, key: string, data: unknown): Promise<void> {
    const cacheKey = `${storeName}:${key}`;
    this.pendingSyncs.set(cacheKey, data);

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      this.flush();
    }, this.options.debounceMs);
  }

  async flush(): Promise<void> {
    const syncPromises: Promise<void>[] = [];

    for (const [cacheKey, data] of this.pendingSyncs) {
      const [storeName, key] = cacheKey.split(':');
      syncPromises.push(this.immediateSync(storeName, key, data));
    }

    await Promise.all(syncPromises);
    this.pendingSyncs.clear();
  }

  async immediateSync(storeName: string, key: string, data: unknown): Promise<void> {
    let retries = 0;
    let delay = this.options.delay;

    while (retries < this.options.maxRetries) {
      try {
        await this.performSync(storeName, data);
        return;
      } catch (error) {
        retries++;
        if (retries >= this.options.maxRetries) {
          console.error(`Failed to sync ${storeName}:${key} after ${retries} attempts`, error);
          throw error;
        }
        await this.sleep(delay);
        if (this.options.backoff === 'exponential') {
          delay *= 2;
        }
      }
    }
  }

  private async performSync(storeName: string, data: unknown): Promise<void> {
    const table = (db as any)[storeName];
    if (!table) {
      throw new Error(`Store ${storeName} not found in database`);
    }
    await table.put(data);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  setOptions(options: Partial<SyncOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

export const dbService = new DBService();
export const syncEngine = new SyncEngine();