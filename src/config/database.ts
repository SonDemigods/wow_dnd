/**
 * 数据库相关配置
 *
 * 包含数据库连接、重试策略和备份的配置常量。
 * 类型定义位于 modules/data/types.ts，调用方应直接从该模块导入类型。
 * P2-80 修复：移除无意义的类型再导出，避免同一类型存在两个导入入口。
 */

import type {
  DatabaseConfig,
  DBServiceConfig,
  BackupConfig
} from '../modules/data/types';

/**
 * 数据库连接配置
 *
 * 数据库名改名（wow_dnd_game → wow_dnd_game_v1）让旧库自然废弃：
 * Dexie 不允许版本降级，若保留原名则必须保留 version(1/2/3) 链；
 * 改名后旧库不被读取，新库从 version(1) 干净开始。
 */
export const DATABASE_CONFIG: DatabaseConfig = {
  name: 'wow_dnd_game_v1'
};

/**
 * 数据库服务重试配置
 */
export const DB_SERVICE_CONFIG: DBServiceConfig = {
  maxRetries: 3,
  delay: 1000,
  backoff: 'exponential'
};

/**
 * 数据备份配置
 *
 * 版本基线重置：backupVersion 与 supportedVersions 统一从 v1.0 重新开始，
 * 旧 v1.1 备份将被 checkVersionCompatibility 拒绝（不再兼容历史备份）。
 * 自动备份 localStorage 功能已移除（autoBackupKey / maxAutoBackups 删除），
 * 仅保留手动导出/导入（JSON 文件下载/上传）。
 */
export const BACKUP_CONFIG: BackupConfig = {
  backupVersion: 'v1.0',
  supportedVersions: ['v1.0']
};
