/**
 * 数据模块类型定义
 * 
 * 定义备份、导入相关的数据结构和接口
 */
import type { InventoryStorage, ItemStorage } from '../inventory/types';
import type { CharQuestStorage } from '../quest/types';
import type { EquipmentStorage, EquipmentTemplateStorage } from '../equipment/types';
import type { SkillsData } from '../skill/types';
import type { ExplorationStorage } from '../exploration/types';
import type { CombatLogStorage } from '../combat/types';
import type { LogEntry } from '../log/types';
import type { LocationData } from '../map/types';
import type { ShopConfig, ShopItemsStorage } from '../shop/types';
import type { MapStateStorage } from '../map/types';
import type { GameStateStorage } from './core';
import type { FactionStorage, RaceStorage, ClassStorage, CharacterDataStorage } from '../character/types';
import type { EnemyStorage } from '../enemy/types';
import type { BossStorage } from '../boss/types';
import type { SkillTemplateStorage } from '../skill/types';
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
  FACTIONS
} from '@/data';
import {
  RARITY_SELL_DISCOUNT,
  RARITY_PRICE_MULTIPLIER,
  ITEM_TYPES,
  RARITY_CONFIG
} from '@/config/inventory';

// ==================== 通用共享类型 ====================

/**
 * 通用操作结果接口
 */
export interface OperationResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * 分页查询结果接口
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 备份文件接口
 * 
 * 定义导出/导入的备份文件结构
 */
export interface BackupFile {
  /** 备份格式版本 */
  version: string;
  /** 备份时间戳 */
  timestamp: number;
  /** 数据校验和（用于完整性验证） */
  checksum: string;
  /** 游戏版本号 */
  gameVersion: string;
  /** 备份的数据内容 */
  data: BackupData;
}

/**
 * 备份数据接口
 * 
 * 定义备份包含的所有数据结构，涵盖运行时数据和完整配置表。
 */
export interface BackupData {
  /** 角色数据（以角色ID为键） */
  characters: Record<string, CharacterDataStorage>;
  /** 背包数据（以角色ID为键） */
  inventory: Record<string, InventoryStorage>;
  /** 任务进度（以角色ID为键） */
  quests: Record<string, CharQuestStorage>;
  /** 装备状态（以角色ID为键） */
  equipment: Record<string, EquipmentStorage>;
  /** 技能数据（以角色ID为键） */
  skills: Record<string, SkillsData>;
  /** 探索进度（以角色ID为键） */
  exploration: Record<string, ExplorationStorage>;
  /** 战斗记录（以 battleLogId 为键；若缺失则降级为 ${combatId}_${timestamp}） */
  combat: Record<string, CombatLogStorage>;
  /** 冒险日志（以角色ID为键） */
  adventureLog: Record<string, LogEntry[]>;
  /** 地图数据（地点配置） */
  map: LocationData[];
  /** 商店配置 */
  shop: ShopConfig[];
  /** 游戏状态（runtime_gameState 全量表，以 id 为键） */
  gameState: Record<string, GameStateStorage>;
  /** 商店商品数据（runtime_shopItems 全量表，以 shopId 为键） */
  shopItems: Record<string, ShopItemsStorage>;
  /** 地图运行时状态（以 map_{characterId} 为键） */
  mapState?: Record<string, MapStateStorage>;
  // ==================== 配置表备份（v1.1 新增） ====================
  /** 阵营配置 */
  factions?: FactionStorage[];
  /** 种族配置 */
  races?: RaceStorage[];
  /** 职业配置 */
  classes?: ClassStorage[];
  /** 物品模板 */
  items?: ItemStorage[];
  /** 装备模板 */
  equipmentItems?: EquipmentTemplateStorage[];
  /** 敌人模板（普通怪物 + Boss 合并） */
  mobs?: EnemyStorage[];
  /** Boss 模板 */
  bosses?: BossStorage[];
  /** 技能模板 */
  skillTemplates?: SkillTemplateStorage[];
}

/**
 * 备份验证结果接口
 * 
 * 定义备份文件验证的返回结果
 */
export interface ValidationResult {
  /** 验证是否成功 */
  success: boolean;
  /** 错误信息（验证失败时） */
  error?: string;
  /** 备份版本（验证成功时） */
  version?: string;
  /** 备份时间戳（验证成功时） */
  timestamp?: number;
  /** 游戏版本（验证成功时） */
  gameVersion?: string;
}

/**
 * 导入结果接口
 * 
 * 定义数据导入操作的返回结果
 */
export interface ImportResult {
  /** 导入是否成功 */
  success: boolean;
  /** 错误信息（导入失败时） */
  error?: string;
  /** 成功导入的数据表列表 */
  importedStores: string[];
  /** 跳过的数据表列表 */
  skippedStores: string[];
}

/**
 * 版本兼容性检查结果接口
 * 
 * 定义备份版本兼容性检查的返回结果
 */
export interface CompatibilityResult {
  /** 是否兼容当前版本 */
  compatible: boolean;
  /** 兼容性信息 */
  message: string;
  /** 是否需要数据迁移 */
  requiresMigration: boolean;
}

// ==================== 数据库配置接口 ====================

/**
 * 数据库基础配置接口
 * @property {string} name - 数据库名称
 * @property {number} version - 数据库版本号
 */
export interface DatabaseConfig {
  name: string;
  version: number;
}

/**
 * 数据库服务配置接口
 * @property {number} maxRetries - 最大重试次数
 * @property {number} delay - 重试间隔（毫秒）
 * @property {'exponential' | 'linear'} backoff - 退避策略
 */
export interface DBServiceConfig {
  maxRetries: number;
  delay: number;
  backoff: 'exponential' | 'linear';
}

/**
 * 备份配置接口
 * @property {string} autoBackupKey - 自动备份存储键名
 * @property {number} maxAutoBackups - 最大自动备份数量
 * @property {string} backupVersion - 备份格式版本号
 * @property {string[]} supportedVersions - 支持的备份版本列表
 */
export interface BackupConfig {
  autoBackupKey: string;
  maxAutoBackups: number;
  backupVersion: string;
  supportedVersions: string[];
}

// ==================== 初始化与服务接口 ====================

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
  mobs: typeof MOBS;
  bosses: typeof BOSSES;
  equipment: typeof EQUIPMENT_ITEMS;
  items: typeof LOOT_ITEMS;
  classes: typeof CLASSES;
  classAbilities: typeof CLASS_ABILITIES;
  races: typeof RACES;
  factions: typeof FACTIONS;
  itemTypes: typeof ITEM_TYPES;
  rarityConfig: typeof RARITY_CONFIG;
  rarityPriceMultiplier: typeof RARITY_PRICE_MULTIPLIER;
  raritySellDiscount: typeof RARITY_SELL_DISCOUNT;
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