/**
 * @fileoverview 数据模块类型定义
 * @description 集中定义备份/导入、数据库配置、初始化服务等相关的数据结构和接口。
 *              本文件是 data 模块的类型基石，所有接口和类型别名均在此集中定义，
 *              通过 index.ts 的 export * 对外暴露。
 * @module data
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
import type { FactionStorage, RaceStorage, ClassStorage, CharacterDataStorage, PassiveSkill } from '../character/types';
import type { TalentTree } from '../character/talents/types';
import type { EnemyStorage } from '../enemy/types';
import type { BossStorage } from '../boss/types';
import type { SkillTemplateStorage } from '../skill/types';
import type { QuestDefinitionStorage } from '../quest/types';
import type { EquipmentItem } from '../equipment/types';
import type { ItemSet } from '../equipment/setTypes';
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
  RARITY_CONFIG
} from '@/config/inventory';

// ============================================================================
// 通用共享类型
// ============================================================================

/**
 * 通用操作结果接口
 *
 * 提供统一的异步操作返回格式，适用于所有需要成功/失败反馈的业务场景。
 *
 * @property {boolean} success - 操作是否成功
 * @property {string} [error] - 失败时的错误描述信息
 * @property {T} [data] - 成功时的返回数据，类型由泛型参数决定
 *
 * @see ValidationResult 备份验证的专用结果类型（继承此设计模式）
 * @see ImportResult 数据导入的专用结果类型（继承此设计模式）
 */
export interface OperationResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * 分页查询结果接口
 *
 * 提供统一的分页数据返回格式，适用于列表类数据的批量查询场景。
 *
 * @property {T[]} items - 当前页的数据项列表
 * @property {number} total - 数据总条数
 * @property {number} page - 当前页码（从 1 开始）
 * @property {number} pageSize - 每页条数
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================================================
// 备份数据结构
// ============================================================================

/**
 * 备份文件接口
 *
 * 定义导出/导入的备份文件顶层结构。备份文件以 JSON 格式序列化存储，
 * 包含版本信息、校验和及完整游戏数据。
 *
 * 数据流转：
 * 1. BackupService.createBackup() 收集全量数据并构建 BackupFile 对象
 * 2. BackupService.exportBackup() 将 BackupFile 序列化为 JSON 文件供用户下载
 * 3. ImportService.validateBackup() 校验版本和校验和后交 ImportService.importBackup() 写入数据库
 *
 * @property {string} version - 备份格式版本（用于兼容性检查）
 * @property {number} timestamp - 备份创建时间戳（毫秒），用作备份唯一标识
 * @property {string} checksum - 数据校验和（简单哈希），用于完整性验证
 * @property {string} gameVersion - 游戏版本号
 * @property {BackupData} data - 备份的数据内容
 *
 * @see BackupService.createBackup 构建 BackupFile 的核心方法
 * @see ImportService.validateBackup 导入前的校验逻辑
 */
export interface BackupFile {
  version: string;
  timestamp: number;
  checksum: string;
  gameVersion: string;
  data: BackupData;
}

/**
 * 备份数据接口
 *
 * 定义备份包含的全部数据结构，涵盖运行时数据（角色/背包/任务等）和
 * 完整配置表（阵营/种族/职业/技能模板等）。配置表字段为可选（v1.1 新增），
 * 确保向后兼容旧版本备份文件。
 *
 * 设计原则：
 * - 角色数据使用 `Record<string, Storage>` 以 characterId 为键，便于导入时按 ID 恢复
 * - 配置表使用数组格式，导入时直接 bulkPut 写入对应 config_* 表
 * - 可选字段兼容旧备份（旧版本备份可能不含配置表数据）
 *
 * @property {Record<string, CharacterDataStorage>} characters - 角色数据（以角色 ID 为键）
 * @property {Record<string, InventoryStorage>} inventory - 背包数据（以角色 ID 为键）
 * @property {Record<string, CharQuestStorage>} quests - 任务进度（以角色 ID 为键）
 * @property {Record<string, EquipmentStorage>} equipment - 装备状态（以角色 ID 为键）
 * @property {Record<string, SkillsData>} skills - 技能数据（以角色 ID 为键）
 * @property {Record<string, ExplorationStorage>} exploration - 探索进度（以角色 ID 为键）
 * @property {Record<string, CombatLogStorage>} combat - 战斗记录（以 battleLogId 为键；若缺失则降级为 ${combatId}_${timestamp}）
 * @property {Record<string, LogEntry[]>} adventureLog - 冒险日志（以角色 ID 为键）
 * @property {LocationData[]} map - 地图数据（地点和大陆配置）
 * @property {ShopConfig[]} shop - 商店配置
 * @property {Record<string, GameStateStorage>} gameState - 游戏状态（runtime_gameState 全量表，以 id 为键）
 * @property {Record<string, ShopItemsStorage>} shopItems - 商店商品数据（runtime_shopItems 全量表，以 shopId 为键）
 * @property {Record<string, MapStateStorage>} [mapState] - 地图运行时状态（以 map_{characterId} 为键）
 * @property {FactionStorage[]} [factions] - 阵营配置（v1.1+）
 * @property {RaceStorage[]} [races] - 种族配置（v1.1+）
 * @property {ClassStorage[]} [classes] - 职业配置（v1.1+）
 * @property {ItemStorage[]} [items] - 物品模板（v1.1+）
 * @property {EquipmentTemplateStorage[]} [equipmentItems] - 装备模板（v1.1+）
 * @property {EnemyStorage[]} [mobs] - 敌人模板（普通怪物，v1.1+）
 * @property {BossStorage[]} [bosses] - Boss 模板（v1.1+）
 * @property {SkillTemplateStorage[]} [skillTemplates] - 技能模板（v1.1+）
 *
 * @see BackupService.collectAllData 从数据库收集数据构建 BackupData
 * @see ImportService.importData 从 BackupData 恢复数据到数据库
 */
export interface BackupData {
  characters: Record<string, CharacterDataStorage>;
  inventory: Record<string, InventoryStorage>;
  quests: Record<string, CharQuestStorage>;
  equipment: Record<string, EquipmentStorage>;
  skills: Record<string, SkillsData>;
  exploration: Record<string, ExplorationStorage>;
  combat: Record<string, CombatLogStorage>;
  adventureLog: Record<string, LogEntry[]>;
  map: LocationData[];
  shop: ShopConfig[];
  gameState: Record<string, GameStateStorage>;
  shopItems: Record<string, ShopItemsStorage>;
  mapState?: Record<string, MapStateStorage>;
  // ==================== 配置表备份（v1.1 新增，兼容旧备份不含这些字段） ====================
  factions?: FactionStorage[];
  races?: RaceStorage[];
  classes?: ClassStorage[];
  items?: ItemStorage[];
  equipmentItems?: EquipmentTemplateStorage[];
  mobs?: EnemyStorage[];
  bosses?: BossStorage[];
  skillTemplates?: SkillTemplateStorage[];
  // P6-200 修复：补齐遗漏的配置表备份字段
  questDefinitions?: QuestDefinitionStorage[];
  classEquipment?: EquipmentItem[];
  classPassives?: PassiveSkill[];
  classTalents?: TalentTree[];
  setDefinitions?: ItemSet[];
}

// ============================================================================
// 导入/验证结果接口
// ============================================================================

/**
 * 备份验证结果接口
 *
 * 定义备份文件验证操作的返回结果，用于 ImportService.validateBackup()。
 * 验证流程：文件读取 → JSON 解析 → 版本检查 → 校验和验证 → 兼容性检查。
 *
 * @property {boolean} success - 验证是否通过
 * @property {string} [error] - 验证失败时的错误描述（格式错误/文件损坏/版本不兼容）
 * @property {string} [version] - 备份格式版本（验证成功时返回）
 * @property {number} [timestamp] - 备份时间戳（验证成功时返回）
 * @property {string} [gameVersion] - 游戏版本号（验证成功时返回）
 *
 * @see ImportService.validateBackup 验证逻辑实现
 * @see CompatibilityResult 版本兼容性检查的独立结果类型
 */
export interface ValidationResult {
  success: boolean;
  error?: string;
  version?: string;
  timestamp?: number;
  gameVersion?: string;
}

/**
 * 导入结果接口
 *
 * 定义数据导入操作的返回结果，用于 ImportService.importBackup()。
 * 逐表导入过程中记录每个表的状态，便于用户了解哪些数据已恢复、哪些已跳过。
 *
 * @property {boolean} success - 导入是否成功（全部表完成即成功，即使部分跳过）
 * @property {string} [error] - 导入失败时的错误描述
 * @property {string[]} importedStores - 成功导入的数据库表名列表
 * @property {string[]} skippedStores - 跳过的数据库表名列表（数据为空或缺失）
 *
 * @see ImportService.importBackup 导入流程入口
 * @see ImportService.importData 逐表导入的核心逻辑
 */
export interface ImportResult {
  success: boolean;
  error?: string;
  importedStores: string[];
  skippedStores: string[];
}

/**
 * 版本兼容性检查结果接口
 *
 * 用于检查备份文件版本与当前游戏版本的兼容性。
 * 逻辑上在 ValidationResult 之前调用，但作为独立接口提供，
 * 允许在不读取完整文件的情况下快速判断兼容性。
 *
 * @property {boolean} compatible - 是否兼容当前版本
 * @property {string} message - 兼容性描述信息
 * @property {boolean} requiresMigration - 是否需要数据迁移（备份版本 < 当前版本）
 *
 * @see ImportService.checkVersionCompatibility 兼容性检查实现
 */
export interface CompatibilityResult {
  compatible: boolean;
  message: string;
  requiresMigration: boolean;
}

// ============================================================================
// 配置接口
// ============================================================================

/**
 * 数据库基础配置接口
 *
 * 定义 IndexedDB 数据库的基本连接参数，由 @/config/database 提供具体值。
 *
 * @property {string} name - 数据库名称（用于 IndexedDB.open()）
 *
 * @see GameDatabase 使用此配置初始化 Dexie 实例
 */
export interface DatabaseConfig {
  name: string;
}

/**
 * 数据库服务重试配置接口
 *
 * 定义 DBService.withRetry() 的重试行为参数。
 * 注意与 DatabaseConfig 区分：DatabaseConfig 是数据库连接参数，此接口是操作重试策略。
 *
 * @property {number} maxRetries - 最大重试次数（含首次尝试）
 * @property {number} delay - 初始重试间隔（毫秒）
 * @property {'exponential' | 'linear'} backoff - 退避策略（exponential = 间隔翻倍，linear = 固定间隔）
 *
 * @see DBService.withRetry 重试逻辑实现
 */
export interface DBServiceConfig {
  maxRetries: number;
  delay: number;
  backoff: 'exponential' | 'linear';
}

/**
 * 备份配置接口
 *
 * 定义 BackupService 的所有可配置参数，由 @/config/database 提供具体值。
 *
 * 版本基线重构后移除了 autoBackupKey / maxAutoBackups（自动备份 localStorage 功能删除）。
 *
 * @property {string} backupVersion - 当前备份格式版本号（写入 BackupFile.version）
 * @property {string[]} supportedVersions - 支持的备份版本列表（用于兼容性检查）
 *
 * @see BackupService 使用此配置管理备份生命周期
 * @see ImportService.checkVersionCompatibility 使用 supportedVersions 判断兼容性
 */
export interface BackupConfig {
  backupVersion: string;
  supportedVersions: string[];
}

// ============================================================================
// 初始化与服务接口
// ============================================================================

/**
 * 初始化数据接口
 *
 * 定义 DataInitializer 所需的全量初始化数据源结构。
 * 注意：此处使用 typeof 从运行时常量推导类型，导致 types.ts 产生运行时依赖。
 * 理想做法是将 InitData 移至 service.ts 或独立文件，使 types.ts 回归纯类型定义。
 *
 * @property {object} map - 地图相关初始化数据
 * @property {typeof CONTINENTS} map.continents - 大陆数据常量引用
 * @property {typeof LOCATIONS} map.locations - 地点数据常量引用
 * @property {typeof SHOPS} shops - 商店数据常量引用
 * @property {typeof QUESTS} quests - 任务数据常量引用
 * @property {typeof MOBS} mobs - 普通怪物数据常量引用
 * @property {typeof BOSSES} bosses - Boss 数据常量引用
 * @property {typeof EQUIPMENT_ITEMS} equipment - 装备物品数据常量引用
 * @property {typeof LOOT_ITEMS} items - 掉落物品数据常量引用
 * @property {typeof CLASSES} classes - 职业数据常量引用
 * @property {typeof CLASS_ABILITIES} classAbilities - 职业技能数据常量引用
 * @property {typeof RACES} races - 种族数据常量引用
 * @property {typeof FACTIONS} factions - 阵营数据常量引用
 * @property {typeof RARITY_CONFIG} rarityConfig - 稀有度配置常量引用
 * @property {typeof RARITY_PRICE_MULTIPLIER} rarityPriceMultiplier - 稀有度价格倍率常量引用
 * @property {typeof RARITY_SELL_DISCOUNT} raritySellDiscount - 稀有度出售折扣常量引用
 *
 * @see DataInitializer.initializeData 使用此接口确定初始化数据源
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
  rarityConfig: typeof RARITY_CONFIG;
  rarityPriceMultiplier: typeof RARITY_PRICE_MULTIPLIER;
  raritySellDiscount: typeof RARITY_SELL_DISCOUNT;
}

/**
 * 备份服务接口
 *
 * 定义 BackupService 的公共 API 契约，用于依赖注入和测试 Mock。
 * 所有方法均以异步方式操作，createBackup/exportBackup 涉及 IndexedDB 全量读取。
 *
 * 版本基线重构后移除了自动备份相关方法（getAutoBackups / deleteBackup /
 * clearAutoBackups / createAutoBackup），仅保留手动导出/导入。
 *
 * @property {() => Promise<BackupFile>} createBackup - 创建当前游戏的完整备份
 * @property {() => Promise<void>} exportBackup - 触发浏览器下载备份 JSON 文件
 *
 * @see BackupService 具体实现
 */
export interface IBackupService {
  createBackup(): Promise<BackupFile>;
  exportBackup(): Promise<void>;
}

/**
 * 导入服务接口
 *
 * 定义 ImportService 的公共 API 契约，用于依赖注入和测试 Mock。
 *
 * @property {(file: File) => Promise<ValidationResult>} validateBackup - 验证备份文件的格式、完整性和兼容性
 * @property {(file: File) => Promise<ImportResult>} importBackup - 验证并导入备份文件到数据库
 * @property {(backupVersion: string) => CompatibilityResult} checkVersionCompatibility - 检查备份版本兼容性
 *
 * @see ImportService 具体实现
 */
export interface IImportService {
  validateBackup(file: File): Promise<ValidationResult>;
  importBackup(file: File): Promise<ImportResult>;
  checkVersionCompatibility(backupVersion: string): CompatibilityResult;
}
