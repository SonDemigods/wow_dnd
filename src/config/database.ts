/**
 * 数据库相关配置
 *
 * 包含数据库连接、重试策略、同步引擎和备份的配置常量。
 * 类型定义已移至 modules/data/types.ts，此处只保留配置数据。
 */

import type {
  DatabaseConfig,
  DBServiceConfig,
  SyncEngineConfig,
  BackupConfig
} from '../modules/data/types';

// 重新导出类型，保持下游导入路径不变
export type { DatabaseConfig, DBServiceConfig, SyncEngineConfig, BackupConfig };

export const DATABASE_CONFIG: DatabaseConfig = {
  name: 'wow_dnd_game',
  version: 1
};

export const DB_SERVICE_CONFIG: DBServiceConfig = {
  maxRetries: 3,
  delay: 1000,
  backoff: 'exponential'
};

export const SYNC_ENGINE_CONFIG: SyncEngineConfig = {
  debounceMs: 500,
  maxRetries: 3,
  delay: 1000,
  backoff: 'exponential'
};

export const BACKUP_CONFIG: BackupConfig = {
  autoBackupKey: 'wow_dnd_auto_backups',
  maxAutoBackups: 5,
  backupVersion: 'v1.0',
  supportedVersions: ['v1.0']
};
