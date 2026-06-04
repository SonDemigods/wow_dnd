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
 * 定义数据库中所有表的结构，按数据类型分为三类：
 * 1. 配置表（config_*）：游戏定义数据，所有角色共享
 * 2. 角色表（char_*）：绑定角色ID，每个角色独立
 * 3. 运行时表（runtime_*）：日志和临时状态
 */
export interface GameDatabaseSchema {
  // ==================== 配置表（config_*）====================
  /** 阵营定义 */
  config_factions: Table<Record<string, unknown>, string>;
  /** 种族定义 */
  config_races: Table<Record<string, unknown>, string>;
  /** 职业定义 */
  config_classes: Table<Record<string, unknown>, string>;
  /** 职业技能配置 */
  config_classAbilities: Table<Record<string, unknown>, string>;
  /** 物品模板 */
  config_items: Table<Record<string, unknown>, string>;
  /** 装备模板 */
  config_equipmentItems: Table<Record<string, unknown>, string>;
  /** 敌人模板 */
  config_enemies: Table<Record<string, unknown>, string>;
  /** 物品类型 */
  config_itemTypes: Table<Record<string, unknown>, string>;
  /** 稀有度配置 */
  config_rarityConfigs: Table<Record<string, unknown>, string>;
  /** 任务定义 */
  config_quests: Table<Record<string, unknown>, string>;
  /** 技能模板 */
  config_skills: Table<Record<string, unknown>, string>;
  /** 地点数据 */
  config_locations: Table<Record<string, unknown>, string>;
  /** 商店配置 */
  config_shops: Table<Record<string, unknown>, string>;

  // ==================== 角色表（char_*）====================
  /** 角色列表/档案 */
  char_profiles: Table<Record<string, unknown>, string>;
  /** 角色详细属性 */
  char_data: Table<Record<string, unknown>, string>;
  /** 背包物品 */
  char_inventory: Table<Record<string, unknown>, string>;
  /** 装备数据 */
  char_equipment: Table<Record<string, unknown>, string>;
  /** 角色已学技能 */
  char_skills: Table<Record<string, unknown>, string>;
  /** 角色任务进度 */
  char_quests: Table<Record<string, unknown>, string>;
  /** 探索进度 */
  char_exploration: Table<Record<string, unknown>, string>;

  // ==================== 运行时表（runtime_*）====================
  /** 全局游戏状态 */
  runtime_gameState: Table<Record<string, unknown>, string>;
  /** 战斗日志 */
  runtime_combatLogs: Table<Record<string, unknown>, string>;
  /** 冒险日志 */
  runtime_adventureLogs: Table<Record<string, unknown>, string>;
  /** 地图视图状态 */
  runtime_mapState: Table<Record<string, unknown>, string>;
  /** 商店库存状态 */
  runtime_shopInventories: Table<Record<string, unknown>, string>;
}

/**
 * 游戏数据库类
 * 
 * 继承 Dexie，封装游戏所需的所有数据表定义。
 * 使用单例模式，通过 db 实例对外提供服务。
 */
export class GameDatabase extends Dexie {
  // ==================== 配置表（config_*）====================
  config_factions!: Table<Record<string, unknown>, string>;
  config_races!: Table<Record<string, unknown>, string>;
  config_classes!: Table<Record<string, unknown>, string>;
  config_classAbilities!: Table<Record<string, unknown>, string>;
  config_items!: Table<Record<string, unknown>, string>;
  config_equipmentItems!: Table<Record<string, unknown>, string>;
  config_enemies!: Table<Record<string, unknown>, string>;
  config_itemTypes!: Table<Record<string, unknown>, string>;
  config_rarityConfigs!: Table<Record<string, unknown>, string>;
  config_quests!: Table<Record<string, unknown>, string>;
  config_skills!: Table<Record<string, unknown>, string>;
  config_locations!: Table<Record<string, unknown>, string>;
  config_shops!: Table<Record<string, unknown>, string>;

  // ==================== 角色表（char_*）====================
  char_profiles!: Table<Record<string, unknown>, string>;
  char_data!: Table<Record<string, unknown>, string>;
  char_inventory!: Table<Record<string, unknown>, string>;
  char_equipment!: Table<Record<string, unknown>, string>;
  char_skills!: Table<Record<string, unknown>, string>;
  char_quests!: Table<Record<string, unknown>, string>;
  char_exploration!: Table<Record<string, unknown>, string>;

  // ==================== 运行时表（runtime_*）====================
  runtime_gameState!: Table<Record<string, unknown>, string>;
  runtime_combatLogs!: Table<Record<string, unknown>, string>;
  runtime_adventureLogs!: Table<Record<string, unknown>, string>;
  runtime_mapState!: Table<Record<string, unknown>, string>;
  runtime_shopInventories!: Table<Record<string, unknown>, string>;

  /**
   * 构造函数：初始化数据库连接和表结构
   */
  constructor() {
    super(DATABASE_CONFIG.name);

    /**
     * 版本 1：按配置/角色/运行时分类的表结构
     */
    this.version(1).stores({
      // 配置表
      config_factions: 'id, name',
      config_races: 'id, name, factionId',
      config_classes: 'id, name, primaryStat',
      config_classAbilities: 'classId',
      config_items: 'id, name, type, rarity',
      config_equipmentItems: 'id, name, type, rarity',
      config_enemies: 'id, name, dangerLevel, isBoss',
      config_itemTypes: 'id, name',
      config_rarityConfigs: 'id',
      config_quests: 'id, boardId, type',
      config_skills: 'id, classRestriction, type',
      config_locations: 'id, continent, region',
      config_shops: 'id, locationId, type',
      
      // 角色表
      char_profiles: 'id, name, factionId, raceId, classId, level',
      char_data: 'characterId',
      char_inventory: 'characterId, itemId',
      char_equipment: 'characterId, slot',
      char_skills: 'characterId',
      char_quests: '[characterId+questId], characterId, status',
      char_exploration: 'characterId, locationId',
      
      // 运行时表
      runtime_combatLogs: 'combatId, timestamp',
      runtime_adventureLogs: 'characterId, timestamp',
      runtime_gameState: 'id',
      runtime_mapState: 'id',
      runtime_shopInventories: 'shopId'
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
    await this.runtime_gameState.put({
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
