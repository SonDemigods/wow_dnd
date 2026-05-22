export interface DBConfig {
  name: string;
  version: number;
  stores: Record<string, { keyPath: string }>;
}

export const DB_CONFIG: DBConfig = {
  name: 'wow_dnd_game',
  version: 3,
  stores: {
    characters: { keyPath: 'id' },
    characterData: { keyPath: 'characterId' },
    inventory: { keyPath: 'characterId' },
    quests: { keyPath: 'characterId' },
    equipment: { keyPath: 'characterId' },
    skills: { keyPath: 'characterId' },
    exploration: { keyPath: 'characterId' },
    combat: { keyPath: 'characterId' },
    adventureLog: { keyPath: 'characterId' },
    gameState: { keyPath: 'id' },
    map: { keyPath: 'id' },
    shop: { keyPath: 'id' }
  }
};

export class DatabaseManager {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        for (const [storeName, config] of Object.entries(DB_CONFIG.stores)) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: config.keyPath });
          }
        }

        if (oldVersion < 2) {
          this.migrateV1toV2(db);
        }

        if (oldVersion < 3) {
          this.migrateV2toV3(db);
        }
      };
    });
  }

  private migrateV1toV2(_db: IDBDatabase): void {
  }

  private migrateV2toV3(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains('map')) {
      db.createObjectStore('map', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('shop')) {
      db.createObjectStore('shop', { keyPath: 'id' });
    }
  }

  getDatabase(): IDBDatabase | null {
    return this.db;
  }
}

export class IndexedDBService {
  constructor(private dbManager: DatabaseManager) {}

  async get<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const db = this.dbManager.getDatabase();
      if (!db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result ?? null);
    });
  }

  async set<T>(storeName: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.dbManager.getDatabase();
      if (!db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async delete(storeName: string, key: IDBValidKey): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.dbManager.getDatabase();
      if (!db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const db = this.dbManager.getDatabase();
      if (!db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result ?? []);
    });
  }

  async clear(storeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.dbManager.getDatabase();
      if (!db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

export interface SyncOptions {
  maxRetries: number;
  delay: number;
  backoff: 'exponential' | 'linear';
}

const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  maxRetries: 3,
  delay: 1000,
  backoff: 'exponential'
};

export class SyncEngine {
  private pendingSyncs: Map<string, unknown> = new Map();
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private options: SyncOptions;

  constructor(private dbService: IndexedDBService, options?: Partial<SyncOptions>) {
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
    }, 500);
  }

  async flush(): Promise<void> {
    const syncPromises: Promise<void>[] = [];

    for (const [cacheKey, data] of this.pendingSyncs) {
      const [storeName] = cacheKey.split(':');
      syncPromises.push(this.immediateSync(storeName, cacheKey, data));
    }

    await Promise.all(syncPromises);
    this.pendingSyncs.clear();
  }

  async immediateSync(storeName: string, _key: string, data: unknown): Promise<void> {
    let retries = 0;
    let delay = this.options.delay;

    while (retries < this.options.maxRetries) {
      try {
        await this.dbService.set(storeName, data);
        return;
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
  }

  async loadFromStore<T>(storeName: string, key: string): Promise<T | null> {
    try {
      return await this.dbService.get<T>(storeName, key);
    } catch (error) {
      console.error(`Failed to load from ${storeName}:`, error);
      return null;
    }
  }

  async clearStore(storeName: string): Promise<void> {
    await this.dbService.clear(storeName);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  setOptions(options: Partial<SyncOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

export const dbManager = new DatabaseManager();
export const dbService = new IndexedDBService(dbManager);
export const syncEngine = new SyncEngine(dbService);