/**
 * @fileoverview 数据迁移服务
 * @description
 *   提供启动时手动迁移全量存档的能力。
 *
 *   迁移流程：
 *   1. 读取 runtime_gameState.dataVersion（当前存档版本戳）
 *   2. 若 dataVersion < CURRENT_DATA_VERSION，收集全量数据为 BackupData
 *   3. 调用 runMigrations 运行迁移链
 *   4. 清空所有表，写入迁移后的数据（复用 ImportService.importData）
 *   5. 更新 runtime_gameState.dataVersion = CURRENT_DATA_VERSION
 *
 *   复用 BackupService.collectAllData 读取数据，复用 ImportService.importData 写回数据，
 *   确保迁移路径与备份导入路径一致，避免两套写入逻辑分叉。
 *
 * @module data/migrations
 */
import { db } from '../core';
import { runMigrations } from './index';
import type { MigrationResult } from './types';
import { CURRENT_DATA_VERSION, APP_VERSION } from '@/config/version';
import { BackupService } from '../backup';
import { ImportService } from '../importer';

/**
 * 数据迁移服务
 *
 * 提供启动时手动迁移全量存档的能力。单机游戏存档量小，全量读写无性能瓶颈，
 * 且用户可控（迁移前可提示备份）。
 */
export class MigrationService {
  /**
   * 执行启动时全量迁移
   *
   * 流程：
   * 1. 读取 runtime_gameState.dataVersion（当前存档版本戳）
   * 2. 若 dataVersion < CURRENT_DATA_VERSION，收集全量数据并迁移
   * 3. 清空并重写所有表（复用 ImportService.importData）
   * 4. 更新版本戳
   *
   * @returns 迁移结果
   */
  async runStartupMigration(): Promise<MigrationResult> {
    // 1. 读取当前版本戳
    const gameState = await db.runtime_gameState.get('gameState');
    const fromVersion = gameState?.dataVersion ?? 1;

    // 已是最新版本，无需迁移
    if (fromVersion >= CURRENT_DATA_VERSION) {
      return {
        success: true,
        fromVersion,
        toVersion: CURRENT_DATA_VERSION,
        migratedRecords: 0,
        error: '当前存档已是最新版本，无需迁移'
      };
    }

    try {
      // 2. 收集全量数据（复用 BackupService.collectAllData）
      const backupService = new BackupService();
      const data = await backupService.collectAllData();

      // 3. 运行迁移链
      const migratedData = runMigrations(data, fromVersion);

      // 4. 写回迁移后的数据（复用 ImportService.importData）
      //    importData 内部会清空并重写所有表
      const importService = new ImportService();
      await importService.importData(migratedData);

      // 5. 更新版本戳
      await db.runtime_gameState.update('gameState', {
        dataVersion: CURRENT_DATA_VERSION,
        appVersion: APP_VERSION
      });

      return {
        success: true,
        fromVersion,
        toVersion: CURRENT_DATA_VERSION,
        migratedRecords: Object.keys(migratedData.characters).length
      };
    } catch (error) {
      return {
        success: false,
        fromVersion,
        toVersion: fromVersion,
        migratedRecords: 0,
        error: (error as Error).message
      };
    }
  }
}

/** 迁移服务单例 */
export const migrationService = new MigrationService();
