/**
 * @fileoverview 迁移注册表与运行入口
 * @description
 *   迁移注册表按版本顺序排列，当前为空（DATA_VERSION = 1 为基线版本）。
 *   未来版本变更时，在此数组追加 Migration 文件导出。
 *
 *   runMigrations 将备份数据从 fromVersion 逐步迁移到 CURRENT_DATA_VERSION。
 *   当前无迁移，直接原样返回。
 *
 * @module data/migrations
 */
import type { BackupData } from '../types';
import type { Migration } from './types';
import { CURRENT_DATA_VERSION } from '@/config/version';

/**
 * 迁移注册表（按版本顺序排列）
 *
 * 当前为空，DATA_VERSION = 1 为基线版本。
 * 未来版本变更时，在此数组追加 Migration 文件导出。
 */
export const MIGRATIONS: readonly Migration[] = [];

/**
 * 运行迁移链
 *
 * 将备份数据从 fromVersion 逐步迁移到 CURRENT_DATA_VERSION。
 * 当前无迁移，直接原样返回。
 *
 * @param data - 备份数据（不会被修改）
 * @param fromVersion - 备份的数据版本
 * @returns 迁移后的新备份数据
 */
export function runMigrations(data: BackupData, fromVersion: number): BackupData {
  // 已是当前版本，无需迁移
  if (fromVersion === CURRENT_DATA_VERSION) {
    return data;
  }
  // 逐步应用匹配的迁移
  let result = data;
  for (const m of MIGRATIONS) {
    if (m.from >= fromVersion && m.to <= CURRENT_DATA_VERSION) {
      result = m.migrate(result);
    }
  }
  return result;
}

export type { Migration, MigrationResult } from './types';
