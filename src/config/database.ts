export interface DatabaseConfig {
  name: string;
  version: number;
}

export interface DBServiceConfig {
  maxRetries: number;
  delay: number;
  backoff: 'exponential' | 'linear';
}

export interface SyncEngineConfig {
  debounceMs: number;
  maxRetries: number;
  delay: number;
  backoff: 'exponential' | 'linear';
}

export interface BackupConfig {
  autoBackupKey: string;
  maxAutoBackups: number;
  backupVersion: string;
  supportedVersions: string[];
}

export const DATABASE_CONFIG: DatabaseConfig = {
  name: 'wow_dnd_game',
  version: 3
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
  backupVersion: 'v1.1',
  supportedVersions: ['v1.0', 'v1.1']
};