/**
 * 数据库核心模块
 * 
 * 封装基于 Dexie 的 IndexedDB 数据库操作，提供基础的数据库管理功能，
 * 包括数据库连接、重试机制、防抖同步等核心能力。
 */
import Dexie, { Table } from 'dexie';
import { DATABASE_CONFIG, DB_SERVICE_CONFIG } from '@/config/database';

/**
 * 游戏数据库 Schema 接口定义
 * 
 * 定义数据库中所有表的结构，分为三类：
 * 1. 角色数据相关表（characters, characterData, inventory, quests, equipment, skills, adventureLog）
 * 2. 基础游戏数据相关表（factions, races, classes, items, equipmentItems, enemies, itemTypes, rarityConfigs, classAbilities）
 * 3. 全局状态相关表（gameState, map, shop）
 */
export interface GameDatabaseSchema {
  /** 角色列表 */
  characters: Table<Record<string, unknown>, string>;
  /** 角色详细数据 */
  characterData: Table<Record<string, unknown>, string>;
  /** 背包物品 */
  inventory: Table<Record<string, unknown>, string>;
  /** 任务进度 */
  quests: Table<Record<string, unknown>, string>;
  /** 装备数据 */
  equipment: Table<Record<string, unknown>, string>;
  /** 技能数据 */
  skills: Table<Record<string, unknown>, string>;
  /** 探索进度 */
  exploration: Table<Record<string, unknown>, string>;
  /** 战斗记录 */
  combat: Table<Record<string, unknown>, string>;
  /** 冒险日志 */
  adventureLog: Table<Record<string, unknown>, string>;
  
  /** 阵营数据 */
  factions: Table<Record<string, unknown>, string>;
  /** 种族数据 */
  races: Table<Record<string, unknown>, string>;
  /** 职业数据 */
  classes: Table<Record<string, unknown>, string>;
  /** 物品模板 */
  items: Table<Record<string, unknown>, string>;
  /** 装备模板 */
  equipmentItems: Table<Record<string, unknown>, string>;
  /** 敌人模板 */
  enemies: Table<Record<string, unknown>, string>;
  /** 物品类型配置 */
  itemTypes: Table<Record<string, unknown>, string>;
  /** 稀有度配置 */
  rarityConfigs: Table<Record<string, unknown>, string>;
  /** 职业技能配置 */
  classAbilities: Table<Record<string, unknown>, string>;
  
  /** 游戏全局状态 */
  gameState: Table<Record<string, unknown>, string>;
  /** 地图数据 */
  map: Table<Record<string, unknown>, string>;
  /** 商店数据 */
  shop: Table<Record<string, unknown>, string>;
}

/**
 * 游戏数据库类
 * 
 * 继承 Dexie，封装游戏所需的所有数据表定义。
 * 使用单例模式，通过 db 实例对外提供服务。
 */
export class GameDatabase extends Dexie {
  // 角色数据相关表
  characters!: Table<Record<string, unknown>, string>;
  characterData!: Table<Record<string, unknown>, string>;
  inventory!: Table<Record<string, unknown>, string>;
  quests!: Table<Record<string, unknown>, string>;
  equipment!: Table<Record<string, unknown>, string>;
  skills!: Table<Record<string, unknown>, string>;
  exploration!: Table<Record<string, unknown>, string>;
  combat!: Table<Record<string, unknown>, string>;
  adventureLog!: Table<Record<string, unknown>, string>;
  
  // 基础游戏数据相关表
  factions!: Table<Record<string, unknown>, string>;
  races!: Table<Record<string, unknown>, string>;
  classes!: Table<Record<string, unknown>, string>;
  items!: Table<Record<string, unknown>, string>;
  equipmentItems!: Table<Record<string, unknown>, string>;
  enemies!: Table<Record<string, unknown>, string>;
  itemTypes!: Table<Record<string, unknown>, string>;
  rarityConfigs!: Table<Record<string, unknown>, string>;
  classAbilities!: Table<Record<string, unknown>, string>;
  
  // 全局状态相关表
  gameState!: Table<Record<string, unknown>, string>;
  map!: Table<Record<string, unknown>, string>;
  shop!: Table<Record<string, unknown>, string>;

  /**
   * 构造函数：初始化数据库连接和表结构
   */
  constructor() {
    super(DATABASE_CONFIG.name);

    /**
     * 版本 1：初始版本
     * 定义所有数据表及其索引
     */
    this.version(1).stores({
      characters: 'id, name, factionId, raceId, classId, level',
      characterData: 'characterId',
      inventory: 'characterId, itemId',
      quests: 'characterId, status',
      equipment: 'characterId, slot',
      skills: 'characterId, skillId',
      exploration: 'characterId, locationId',
      combat: 'characterId, timestamp',
      adventureLog: 'characterId, timestamp',
      factions: 'id, name',
      races: 'id, name, factionId',
      classes: 'id, name, primaryStat',
      items: 'id, name, type, rarity',
      equipmentItems: 'id, name, type, rarity',
      enemies: 'id, name, dangerLevel, isBoss',
      itemTypes: 'id, name',
      rarityConfigs: 'id',
      classAbilities: 'classId',
      gameState: 'id',
      map: 'id',
      shop: 'id'
    });

    /**
     * 数据库首次创建时触发，初始化默认游戏状态
     */
    this.on('populate', () => this.populateInitialData());
  }

  /**
   * 初始化默认游戏状态
   * 
   * 在数据库首次创建时调用，设置初始游戏配置
   */
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

/**
 * 数据库实例
 * 
 * 游戏全局唯一的数据库连接实例，所有数据库操作通过此实例进行
 */
export const db = new GameDatabase();

/**
 * DBService 配置选项接口
 */
export interface DBServiceOptions {
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试间隔（毫秒） */
  delay: number;
  /** 退避策略：exponential（指数退避）| linear（线性退避） */
  backoff: 'exponential' | 'linear';
}

/**
 * 数据库服务类
 * 
 * 提供带重试机制的数据库操作封装，用于处理数据库操作失败时的自动重试。
 */
export class DBService {
  /** 当前配置选项 */
  private options: DBServiceOptions;

  /**
   * 构造函数
   * @param options - 可选配置，覆盖默认值
   */
  constructor(options?: Partial<DBServiceOptions>) {
    this.options = { ...DB_SERVICE_CONFIG, ...options };
  }

  /**
   * 带重试的异步操作封装
   * 
   * @param fn - 需要执行的异步函数
   * @returns Promise<T> - 函数执行结果
   */
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

  /**
   * 等待指定时间
   * @param ms - 等待时间（毫秒）
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 更新配置选项
   * @param options - 新的配置选项
   */
  setOptions(options: Partial<DBServiceOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * SyncEngine 配置选项接口
 */
export interface SyncOptions {
  /** 防抖延迟（毫秒） */
  debounceMs: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试间隔（毫秒） */
  delay: number;
  /** 退避策略 */
  backoff: 'exponential' | 'linear';
}

/**
 * SyncEngine 默认配置
 */
const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  debounceMs: 500,
  maxRetries: 3,
  delay: 1000,
  backoff: 'exponential'
};

/**
 * 同步引擎类
 * 
 * 提供防抖批量同步功能，将短时间内的多次写入操作合并为一次批量写入，
 * 减少数据库IO次数，优化性能。
 */
export class SyncEngine {
  /** 待同步的数据缓存 */
  private pendingSyncs: Map<string, unknown> = new Map();
  /** 防抖定时器 ID */
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  /** 当前配置选项 */
  private options: SyncOptions;

  /**
   * 构造函数
   * @param options - 可选配置
   */
  constructor(options?: Partial<SyncOptions>) {
    this.options = { ...DEFAULT_SYNC_OPTIONS, ...options };

    /**
     * 监听页面卸载事件，确保未同步的数据被写入
     */
    window.addEventListener('beforeunload', () => {
      this.flush();
    });
  }

  /**
   * 异步同步数据（带防抖）
   * 
   * @param storeName - 数据表名称
   * @param key - 数据键
   * @param data - 要同步的数据
   */
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

  /**
   * 立即刷新所有待同步数据
   */
  async flush(): Promise<void> {
    const syncPromises: Promise<void>[] = [];

    for (const [cacheKey, data] of this.pendingSyncs) {
      const [storeName, key] = cacheKey.split(':');
      syncPromises.push(this.immediateSync(storeName, key, data));
    }

    await Promise.all(syncPromises);
    this.pendingSyncs.clear();
  }

  /**
   * 立即同步单条数据（带重试）
   * 
   * @param storeName - 数据表名称
   * @param key - 数据键
   * @param data - 要同步的数据
   */
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

  /**
   * 执行实际的数据库写入操作
   * 
   * @param storeName - 数据表名称
   * @param data - 要写入的数据
   */
  private async performSync(storeName: string, data: unknown): Promise<void> {
    const table = (db as any)[storeName];
    if (!table) {
      throw new Error(`Store ${storeName} not found in database`);
    }
    await table.put(data);
  }

  /**
   * 等待指定时间
   * @param ms - 等待时间（毫秒）
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 更新配置选项
   * @param options - 新的配置选项
   */
  setOptions(options: Partial<SyncOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * DBService 实例
 * 
 * 全局唯一的数据库服务实例，提供带重试机制的操作能力
 */
export const dbService = new DBService();

/**
 * SyncEngine 实例
 * 
 * 全局唯一的同步引擎实例，提供防抖批量同步能力
 */
export const syncEngine = new SyncEngine();