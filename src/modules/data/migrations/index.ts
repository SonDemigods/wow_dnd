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
  // P9-022 修复：检测版本降级（备份版本高于当前代码版本），拒绝直接使用高版本数据
  if (fromVersion > CURRENT_DATA_VERSION) {
    throw new Error(`存档版本 v${fromVersion} 高于当前应用版本 v${CURRENT_DATA_VERSION}，可能存在兼容性问题，请更新应用`);
  }
  // P7-026 修复：改用显式链式步进，从 fromVersion 逐步推进到 CURRENT_DATA_VERSION
  // 每步只匹配 m.from === currentStep 的迁移，应用后推进 currentStep = m.to
  let result = data;
  let currentStep = fromVersion;
  while (currentStep < CURRENT_DATA_VERSION) {
    const migration = MIGRATIONS.find(m => m.from === currentStep);
    if (!migration) {
      // P8-017 修复：迁移链断裂时禁止静默推进
      // 当注册表为空时（无迁移定义），直接返回数据（无迁移可执行）
      if (MIGRATIONS.length === 0) {
        return result;
      }
      throw new Error(`迁移链断裂：找不到从版本 ${currentStep} 开始的迁移步骤`);
    }
    result = migration.migrate(result);
    currentStep = migration.to;
  }
  return result;
}

export type { Migration, MigrationResult } from './types';
