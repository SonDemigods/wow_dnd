/**
 * 数据模块类型定义
 * 
 * 定义备份、导入相关的数据结构和接口
 */
import type { InventoryItem } from '../inventory/types';
import type { QuestInstance } from '../quest/types';
import type { EquipmentState } from '../equipment/types';
import type { SkillsData } from '../skill/types';
import type { ExplorationState } from '../exploration/types';
import type { CombatLog } from '../combat/types';
import type { LogEntry } from '../log/types';
import type { LocationData } from '../map/types';
import type { ShopConfig } from '../shop/types';

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
 * 游戏状态数据接口
 * 
 * 对应 runtime_gameState 表中 id='gameState' 的记录，
 * 存储游戏运行时的全局状态。各模块通过此记录共享持久化状态。
 */
export interface GameStateData {
  /** 当前选中的角色ID（null 表示未选择角色） */
  currentCharacterId: string | null;
  /** 上次游玩时间（ISO 8601 格式） */
  lastPlayedAt: string;
  /** 游戏设置 */
  settings: {
    soundEnabled: boolean;
    musicEnabled: boolean;
    autoSave: boolean;
    difficulty: string;
  };
  /** 当前打开的商店ID（null 表示未打开商店，由商店模块管理） */
  currentShopId?: string | null;
}

/**
 * 角色详细数据接口
 * 
 * 定义单个角色的详细属性数据
 */
export interface CharacterData {
  /** 角色ID */
  characterId: string;
  /** 角色等级 */
  level: number;
  /** 经验值 */
  exp: number;
  /** 金币数量 */
  gold: number;
  /** 当前生命值 */
  hp: number;
  /** 最大生命值 */
  maxHp: number;
  /** 当前魔法值 */
  mp: number;
  /** 最大魔法值 */
  maxMp: number;
  /** 属性值映射 */
  stats: Record<string, number>;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 备份数据接口
 * 
 * 定义备份包含的所有数据结构
 */
export interface BackupData {
  /** 角色数据（以角色ID为键） */
  characters: Record<string, unknown>;
  /** 背包数据（以角色ID为键） */
  inventory: Record<string, InventoryItem>;
  /** 任务进度（以角色ID为键） */
  quests: Record<string, QuestInstance>;
  /** 装备状态（以角色ID为键） */
  equipment: Record<string, EquipmentState>;
  /** 技能数据（以角色ID为键） */
  skills: Record<string, SkillsData>;
  /** 探索进度（以角色ID为键） */
  exploration: Record<string, ExplorationState>;
  /** 战斗记录（以角色ID为键） */
  combat: Record<string, CombatLog>;
  /** 冒险日志（以角色ID为键） */
  adventureLog: Record<string, LogEntry[]>;
  /** 地图数据 */
  map: LocationData[];
  /** 商店配置 */
  shop: ShopConfig[];
  /** 游戏状态 */
  gameState: GameStateData;
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
 * 同步引擎配置接口
 * @property {number} debounceMs - 防抖间隔（毫秒）
 * @property {number} maxRetries - 最大重试次数
 * @property {number} delay - 重试间隔（毫秒）
 * @property {'exponential' | 'linear'} backoff - 退避策略
 */
export interface SyncEngineConfig {
  debounceMs: number;
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