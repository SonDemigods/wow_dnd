/**
 * 数据库核心模块
 * 
 * 封装基于 Dexie 的 IndexedDB 数据库操作，提供基础的数据库管理功能，
 * 包括数据库连接、重试机制等核心能力。
 * 
 * 注意：Storage 类型定义已迁移到各模块的 types.ts 中。
 * 此文件仅保留 Dexie 表声明的通用类型。
 */
import Dexie, { Table } from 'dexie';
import { DATABASE_CONFIG, DB_SERVICE_CONFIG, type DBServiceConfig } from '@/config/database';

// ==================== 各模块 Storage 类型导入 ====================
import type { FactionStorage, RaceStorage, ClassStorage, CharacterDataStorage } from '../character/types';
import type { ItemStorage, InventoryStorage } from '../inventory/types';
import type { EquipmentTemplateStorage, EquipmentStorage } from '../equipment/types';
import type { EnemyStorage } from '../enemy/types';
import type { BossStorage } from '../boss/types';
import type { LocationStorage, MapStateStorage } from '../map/types';
import type { ShopConfig, ShopItemsStorage } from '../shop/types';
import type { SkillTemplateStorage, SkillsData } from '../skill/types';
import type { QuestDefinitionStorage, CharQuestStorage } from '../quest/types';
import type { ExplorationStorage } from '../exploration/types';
import type { CombatLogStorage } from '../combat/types';
import type { AdventureLogData } from '../log/types';

/**
 * 全局游戏状态存储格式
 * 属于 data 模块自身的运行时状态，不归属任何业务模块
 */
export interface GameStateStorage {
  id: string;
  currentCharacterId?: string | null;
  currentShopId?: string | null;
  lastPlayedAt?: string;
  settings?: { soundEnabled: boolean; musicEnabled: boolean; autoSave: boolean; difficulty: string };
  initializedAt?: string;
  maxLevel?: number;
  [key: string]: unknown;
}

/**
 * 游戏数据库 Schema 接口定义
 * 
 * 定义数据库中所有表的结构，按数据类型分为三类：
 * 1. 配置表（config_*）：游戏定义数据，所有角色共享
 * 2. 角色表（char_*）：绑定角色ID，每个角色独立
 * 3. 运行时表（runtime_*）：日志和临时状态
 * 
 * 表类型已从 `Table<any, string>` 升级为具体的 Storage 类型，
 * 具体的 Storage 类型定义在各模块的 types.ts 中。
 */
export interface GameDatabaseSchema {
  // ==================== 配置表（config_*）====================
  config_factions: Table<FactionStorage, string>;
  config_races: Table<RaceStorage, string>;
  config_classes: Table<ClassStorage, string>;
  config_items: Table<ItemStorage, string>;
  config_equipmentItems: Table<EquipmentTemplateStorage, string>;
  config_mobs: Table<EnemyStorage, string>;
  config_bosses: Table<BossStorage, string>;
  config_quests: Table<QuestDefinitionStorage, string>;
  config_skills: Table<SkillTemplateStorage, string>;
  config_locations: Table<LocationStorage, string>;
  config_shops: Table<ShopConfig, string>;

  // ==================== 角色表（char_*）====================
  char_data: Table<CharacterDataStorage, string>;
  char_inventory: Table<InventoryStorage, string>;
  char_equipment: Table<EquipmentStorage, string>;
  char_skills: Table<SkillsData, string>;
  char_quests: Table<CharQuestStorage, string>;
  char_exploration: Table<ExplorationStorage, string>;

  // ==================== 运行时表（runtime_*）====================
  runtime_gameState: Table<GameStateStorage, string>;
  runtime_combatLogs: Table<CombatLogStorage, string>;
  runtime_adventureLogs: Table<AdventureLogData, string>;
  runtime_mapState: Table<MapStateStorage, string>;
  runtime_shopItems: Table<ShopItemsStorage, string>;
}

/**
 * 游戏数据库类
 * 
 * 继承 Dexie，封装游戏所需的所有数据表定义。
 * 使用单例模式，通过 db 实例对外提供服务。
 */
export class GameDatabase extends Dexie {
  // ==================== 配置表（config_*）====================
  config_factions!: Table<FactionStorage, string>;
  config_races!: Table<RaceStorage, string>;
  config_classes!: Table<ClassStorage, string>;
  config_items!: Table<ItemStorage, string>;
  config_equipmentItems!: Table<EquipmentTemplateStorage, string>;
  config_mobs!: Table<EnemyStorage, string>;
  config_bosses!: Table<BossStorage, string>;
  config_quests!: Table<QuestDefinitionStorage, string>;
  config_skills!: Table<SkillTemplateStorage, string>;
  config_locations!: Table<LocationStorage, string>;
  config_shops!: Table<ShopConfig, string>;

  // ==================== 角色表（char_*）====================
  char_data!: Table<CharacterDataStorage, string>;
  char_inventory!: Table<InventoryStorage, string>;
  char_equipment!: Table<EquipmentStorage, string>;
  char_skills!: Table<SkillsData, string>;
  char_quests!: Table<CharQuestStorage, string>;
  char_exploration!: Table<ExplorationStorage, string>;

  // ==================== 运行时表（runtime_*）====================
  runtime_gameState!: Table<GameStateStorage, string>;
  runtime_combatLogs!: Table<CombatLogStorage, string>;
  runtime_adventureLogs!: Table<AdventureLogData, string>;
  runtime_mapState!: Table<MapStateStorage, string>;
  runtime_shopItems!: Table<ShopItemsStorage, string>;

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
      config_items: 'id, name, type, rarity',
      config_equipmentItems: 'id, name, type, rarity',
      config_mobs: 'id, name, dangerLevel',
      config_bosses: 'id, name, dangerLevel',
      config_quests: 'id, boardId, type',
      config_skills: 'id, classRestriction, type, usableBy',
      config_locations: 'id, type, continent',
      config_shops: 'id',
      
      // 角色表
      char_data: 'characterId',
      char_inventory: 'characterId',
      char_equipment: 'characterId',
      char_skills: 'characterId',
      char_quests: '[characterId+questId], characterId, status',
      char_exploration: 'characterId, currentAreaId',
      
      // 运行时表
      runtime_combatLogs: 'combatId, timestamp',
      runtime_adventureLogs: 'characterId, timestamp',
      runtime_gameState: 'id',
      runtime_mapState: 'id',
      runtime_shopItems: 'shopId'
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
      currentShopId: null,
      lastPlayedAt: new Date().toISOString(),
      settings: {
        soundEnabled: true,
        musicEnabled: true,
        autoSave: true,
        difficulty: 'normal'
      },
      initializedAt: new Date().toISOString()
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
 * 数据库服务类
 * 
 * 提供带重试机制的数据库操作封装，用于处理数据库操作失败时的自动重试。
 * 配置类型 DBServiceConfig 定义在 @/config/database 中。
 */
export class DBService {
  /** 当前配置选项 */
  private options: DBServiceConfig;

  /**
   * 构造函数
   * @param options - 可选配置，覆盖默认值
   */
  constructor(options?: Partial<DBServiceConfig>) {
    this.options = { ...DB_SERVICE_CONFIG, ...options };
  }

  /**
   * 带重试的异步操作封装
   * 
   * @param fn - 需要执行的异步函数
   * @returns Promise<T> - 函数执行结果
   */
  async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let delay = this.options.delay;

    for (let retries = 0; retries < this.options.maxRetries; retries++) {
      try {
        return await fn();
      } catch (error) {
        if (retries >= this.options.maxRetries - 1) {
          throw error;
        }
        await this.sleep(delay);
        if (this.options.backoff === 'exponential') {
          delay *= 2;
        }
      }
    }

    // 所有重试均已耗尽，抛出最终错误
    throw new Error('所有重试均已耗尽');
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
  setOptions(options: Partial<DBServiceConfig>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * DBService 实例
 * 
 * 全局唯一的数据库服务实例，提供带重试机制的操作能力
 */
export const dbService = new DBService();
