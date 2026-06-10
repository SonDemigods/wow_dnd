/**
 * 数据库核心模块
 * 
 * 封装基于 Dexie 的 IndexedDB 数据库操作，提供基础的数据库管理功能，
 * 包括数据库连接、重试机制等核心能力。
 */
import Dexie, { Table } from 'dexie';
import { DATABASE_CONFIG, DB_SERVICE_CONFIG, type DBServiceConfig } from '@/config/database';

// ============================================================
// 数据库存储类型定义
// ============================================================
// 为避免循环依赖，在 data/core.ts 中统一定义所有数据表的存储格式。
// 各模块的 db.ts 文件应导入这些类型以实现编译期类型检查。

/** 阵营存储格式 */
export interface FactionStorage {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

/** 种族存储格式 */
export interface RaceStorage {
  id: string;
  name: string;
  icon: string;
  factionId: string;
  bonus?: Partial<Record<string, number>>;
  description: string;
}

/** 职业存储格式 */
export interface ClassStorage {
  id: string;
  name: string;
  icon: string;
  primaryStat: string;
  factionsIds: string[];
  raceIds: string[];
  description: string;
  color: string;
  bonus?: Partial<Record<string, number>>;
}

/** 物品模板存储格式 */
export interface ItemStorage {
  id: string;
  name: string;
  type: string;
  rarity: string;
  icon: string;
  description: string;
  bonus?: Partial<Record<string, number>>;
  effect?: { type: string; value: number | Partial<Record<string, number>> } | null;
  value: number;
  stackable: boolean;
  consumable?: boolean;
  template?: string | null;
  levelRequirement?: number | null;
  level?: number;
}

/** 装备模板存储格式 */
export interface EquipmentItemStorage {
  id: string;
  name: string;
  type: string;
  rarity: string;
  icon: string;
  description: string;
  bonus?: Partial<Record<string, number>>;
  effect?: { type: string; value: number | Partial<Record<string, number>> } | null;
  value: number;
  stackable: boolean;
  consumable?: boolean;
  levelRequirement?: number | null;
  slots: string[];
  [key: string]: unknown;
}

/** 敌人模板存储格式 */
export interface EnemyStorage {
  id: string;
  name: string;
  icon: string;
  maxHp: number;
  damage: [number, number];
  xp: number;
  gold: number;
  dangerLevel: string;
  isBoss?: number;
  physicalAttack?: number | null;
  physicalDefense?: number | null;
  magicAttack?: number | null;
  magicDefense?: number | null;
  critChance?: number | null;
  dodgeChance?: number | null;
}

/** 任务定义存储格式 */
export interface QuestConfigStorage {
  id: string;
  title: string;
  description: string;
  type: string;
  objectives: Array<{ key: string; type: string; description: string; target: number; [key: string]: unknown }>;
  levelRequirement: number;
  xpReward: number;
  goldReward: number;
  itemRewards?: Array<{ itemId: string; count: number }>;
  boardId: string;
}

/** 技能模板存储格式 */
export interface SkillConfigStorage {
  id: string;
  name: string;
  icon: string;
  description: string;
  mpCost: number;
  type: string;
  effect: { type: string; value: number; coefficient?: number };
  unlockLevel: number;
  classRestriction?: string | null;
}

/** 地点/大陆存储格式（通过 type 字段区分） */
export interface LocationStorage {
  id: string;
  name: string;
  icon: string;
  description: string;
  type: 'location' | 'continent';
  /** 地点特有字段 */
  continent?: string;
  enemies?: string[];
  quests?: string[];
  levelRange?: [number, number];
  mapX?: number;
  mapY?: number;
  color?: string;
  /** 大陆特有字段 */
  position?: string;
}

/** 商店配置存储格式 */
export interface ShopConfigStorage {
  id: string;
  name: string;
  type: string;
  icon: string;
  refreshInterval: number;
  priceVariation: { min: number; max: number };
}

/** 角色数据存储格式 */
export interface CharacterDataStorage {
  characterId: string;
  name: string;
  factionId: string;
  raceId: string;
  classId: string;
  level: number;
  exp: number;
  expToNextLevel: number;
  gold: number;
  baseStats: Record<string, number>;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  bonusStats: Partial<Record<string, number>>;
  createdTime: number;
  lastPlayedTime: number;
  updatedAt: number;
}

/** 背包存储格式 */
export interface InventoryStorage {
  characterId: string;
  items: Array<{ itemId: string; count: number }>;
  updatedAt?: number;
}

/** 装备存储格式 */
export interface EquipmentStorage {
  characterId: string;
  equipment: Record<string, { item: Record<string, unknown>; equippedAt: number } | null>;
  updatedAt?: number;
}

/** 角色技能存储格式 */
export interface CharSkillsStorage {
  characterId: string;
  skills: Array<{ id: string; name: string; [key: string]: unknown }>;
  skillBar: { slots: [string | null, string | null, string | null, string | null] };
  currentClass: string | null;
  updatedAt: number;
}

/** 角色任务存储格式 */
export interface CharQuestStorage {
  characterId: string;
  questId: string;
  status: string;
  progress: Array<{ objectiveKey: string; current: number; target: number }>;
  acceptedAt: number;
  completedAt?: number;
}

/** 探索进度存储格式 */
export interface ExplorationStorage {
  characterId: string;
  currentAreaId: string | null;
  /** 当前探索网格中分配的商店ID（与 runtime_gameState.currentShopId 不同） */
  assignedShopId?: string;
  /** 旧版本兼容字段 */
  currentShopId?: string;
  grid: Array<Array<{ x: number; y: number; type: string; explored: boolean; accessible: boolean; visited: boolean; [key: string]: unknown }>>;
  playerPosition: { x: number; y: number };
  visitedCells: number;
  remainingMoves: number;
  bossDefeated: boolean;
  explorationComplete: boolean;
  campUsed: boolean;
  updatedAt?: number;
}

/** 战斗日志存储格式 */
export interface CombatLogStorage {
  combatId: string;
  battleLogId?: string;
  timestamp: number;
  turn: number;
  actorType: string;
  actorId: string;
  actorName: string;
  eventType: string;
  message: string;
  [key: string]: unknown;
}

/** 冒险日志存储格式 */
export interface AdventureLogStorage {
  characterId: string;
  entries: Array<{ id: string; timestamp: number; type: string; message: string; icon?: string }>;
  updatedAt?: number;
}

/** 全局游戏状态存储格式 */
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

/** 地图状态存储格式 */
export interface MapStateStorage {
  id: string;
  view?: { zoomLevel: number; panX: number; panY: number; currentContinentId?: string };
  currentLocationId?: string;
  currentTab?: string;
}

/** 商店商品存储格式 */
export interface ShopItemsStorage {
  shopId: string;
  items: Array<{ itemId: string; price: number; quantity: number }>;
  lastRefresh: number;
}

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
  config_factions: Table<FactionStorage, string>;
  config_races: Table<RaceStorage, string>;
  config_classes: Table<ClassStorage, string>;
  config_items: Table<ItemStorage, string>;
  config_equipmentItems: Table<EquipmentItemStorage, string>;
  config_enemies: Table<EnemyStorage, string>;
  config_quests: Table<QuestConfigStorage, string>;
  config_skills: Table<SkillConfigStorage, string>;
  config_locations: Table<LocationStorage, string>;
  config_shops: Table<ShopConfigStorage, string>;

  // ==================== 角色表（char_*）====================
  char_data: Table<CharacterDataStorage, string>;
  char_inventory: Table<InventoryStorage, string>;
  char_equipment: Table<EquipmentStorage, string>;
  char_skills: Table<CharSkillsStorage, string>;
  char_quests: Table<CharQuestStorage, string>;
  char_exploration: Table<ExplorationStorage, string>;

  // ==================== 运行时表（runtime_*）====================
  runtime_gameState: Table<GameStateStorage, string>;
  runtime_combatLogs: Table<CombatLogStorage, string>;
  runtime_adventureLogs: Table<AdventureLogStorage, string>;
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
  config_equipmentItems!: Table<EquipmentItemStorage, string>;
  config_enemies!: Table<EnemyStorage, string>;
  config_quests!: Table<QuestConfigStorage, string>;
  config_skills!: Table<SkillConfigStorage, string>;
  config_locations!: Table<LocationStorage, string>;
  config_shops!: Table<ShopConfigStorage, string>;

  // ==================== 角色表（char_*）====================
  char_data!: Table<CharacterDataStorage, string>;
  char_inventory!: Table<InventoryStorage, string>;
  char_equipment!: Table<EquipmentStorage, string>;
  char_skills!: Table<CharSkillsStorage, string>;
  char_quests!: Table<CharQuestStorage, string>;
  char_exploration!: Table<ExplorationStorage, string>;

  // ==================== 运行时表（runtime_*）====================
  runtime_gameState!: Table<GameStateStorage, string>;
  runtime_combatLogs!: Table<CombatLogStorage, string>;
  runtime_adventureLogs!: Table<AdventureLogStorage, string>;
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
      config_enemies: 'id, name, dangerLevel, isBoss',
      config_quests: 'id, boardId, type',
      config_skills: 'id, classRestriction, type',
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
