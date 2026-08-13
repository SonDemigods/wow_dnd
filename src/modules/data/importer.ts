/**
 * @fileoverview 数据导入服务
 *
 * 提供游戏数据的导入功能，包括：
 * - 验证备份文件
 * - 导入备份数据
 * - 版本兼容性检查
 *
 * 从 service.ts 拆分而来（QA-11），保持原逻辑与公开 API 完全不变。
 */
import type { Table } from 'dexie';
import { db, getTable } from './core';
import type { AdventureLogData, LogEntry } from '../log/types';
import { BACKUP_CONFIG } from '@/config/database';

import type {
  BackupFile,
  BackupData,
  ValidationResult,
  ImportResult,
  CompatibilityResult,
  IImportService
} from './types';
import { calculateChecksum, TABLES_TO_BACKUP } from './backup';

/**
 * 导入服务类
 *
 * 提供游戏数据的导入功能，包括：
 * - 验证备份文件
 * - 导入备份数据
 * - 版本兼容性检查
 */
export class ImportService implements IImportService {
  /** 支持的备份版本列表 */
  private readonly SUPPORTED_VERSIONS = BACKUP_CONFIG.supportedVersions;

  /**
   * 备份文件大小上限（50MB）
   *
   * P10-012 修复：原 validateBackup 与 importBackup 中各自重复定义的局部常量，
   * 提取为类级别私有常量统一管理。
   */
  private readonly MAX_BACKUP_SIZE = 50 * 1024 * 1024;

  /**
   * 验证备份文件
   *
   * 检查备份文件的格式、完整性和版本兼容性
   * @param file - 备份文件
   * @returns ValidationResult - 验证结果
   */
  async validateBackup(file: File): Promise<ValidationResult> {
    // P10-012 修复：MAX_BACKUP_SIZE 已提取为类级别私有常量
    if (file.size > this.MAX_BACKUP_SIZE) {
      return { success: false, error: '备份文件过大（超过 50MB），请检查是否选择了正确的文件' };
    }
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const content = reader.result as string;
          const backup = JSON.parse(content) as BackupFile;
          resolve(await this.validateBackupData(backup));
        } catch {
          resolve({ success: false, error: '备份文件格式错误' });
        }
      };

      reader.onerror = () => {
        resolve({ success: false, error: '读取文件失败' });
      };

      // P10-013 修复：补充 onabort 回调，与 onerror 一致，防止文件读取被中止时 Promise 永不 resolve
      reader.onabort = () => {
        resolve({ success: false, error: '读取文件失败' });
      };

      reader.readAsText(file);
    });
  }

  /**
   * 验证已解析的备份对象（内部方法）
   *
   * P9-056 修复：抽取公共验证逻辑，供 validateBackup 和 importBackup 复用，
   * 避免重复读取文件——importBackup 读取一次后直接调用本方法校验。
   *
   * @param backup - 已解析的备份对象
   * @returns ValidationResult - 验证结果
   */
  private async validateBackupData(backup: BackupFile): Promise<ValidationResult> {
    if (!backup.version) {
      return { success: false, error: '备份文件格式错误' };
    }

    const checksum = await calculateChecksum(backup.data);
    if (checksum !== backup.checksum) {
      return { success: false, error: '备份文件已损坏' };
    }

    const compatibility = this.checkVersionCompatibility(backup.version);
    if (!compatibility.compatible) {
      return { success: false, error: compatibility.message };
    }

    return {
      success: true,
      version: backup.version,
      timestamp: backup.timestamp,
      gameVersion: backup.gameVersion
    };
  }

  /**
   * 导入备份文件
   *
   * 验证备份文件后，将数据导入数据库
   * @param file - 备份文件
   * @returns ImportResult - 导入结果
   */
  async importBackup(file: File): Promise<ImportResult> {
    // P9-056 修复：一次 FileReader 读取同时完成校验与导入，避免重复读取文件
    // P10-012 修复：MAX_BACKUP_SIZE 已提取为类级别私有常量
    if (file.size > this.MAX_BACKUP_SIZE) {
      return {
        success: false,
        error: '备份文件过大（超过 50MB），请检查是否选择了正确的文件',
        importedStores: [],
        skippedStores: []
      };
    }

    const reader = new FileReader();
    return new Promise((resolve) => {
      // P2-3：补充 onerror 回调，防止文件读取失败时 Promise 永不 resolve 导致 UI 卡死
      reader.onerror = () => {
        resolve({
          success: false,
          error: '读取文件失败',
          importedStores: [],
          skippedStores: []
        });
      };
      // P10-013 修复：补充 onabort 回调，与 onerror 一致，防止文件读取被中止时 Promise 永不 resolve
      reader.onabort = () => {
        resolve({
          success: false,
          error: '读取文件失败',
          importedStores: [],
          skippedStores: []
        });
      };
      reader.onload = async () => {
        try {
          const content = reader.result as string;
          const backup = JSON.parse(content) as BackupFile;

          // 复用 validateBackupData 校验，无需二次读取文件
          const validation = await this.validateBackupData(backup);
          if (!validation.success) {
            resolve({
              success: false,
              error: validation.error,
              importedStores: [],
              skippedStores: []
            });
            return;
          }

          const result = await this.importData(backup.data);
          resolve(result);
        } catch (error) {
          resolve({
            success: false,
            error: '导入失败: ' + (error as Error).message,
            importedStores: [],
            skippedStores: []
          });
        }
      };

      reader.readAsText(file);
    });
  }

  /**
   * 检查版本兼容性
   *
   * 版本号基线重构后：message 包含具体版本信息，便于用户排查导入失败原因
   * （如备份文件版本 v1.1 不受支持，当前支持版本：v1.0）。
   *
   * @param backupVersion - 备份版本号
   * @returns CompatibilityResult - 兼容性检查结果
   */
  checkVersionCompatibility(backupVersion: string): CompatibilityResult {
    if (this.SUPPORTED_VERSIONS.includes(backupVersion)) {
      return {
        compatible: true,
        message: '版本兼容',
        requiresMigration:
          backupVersion !==
          this.SUPPORTED_VERSIONS[this.SUPPORTED_VERSIONS.length - 1]
      };
    }
    return {
      compatible: false,
      message: `备份文件版本 ${backupVersion} 不受支持，当前支持版本：${this.SUPPORTED_VERSIONS.join(', ')}`,
      requiresMigration: false
    };
  }

  /**
   * 导入数据到数据库
   *
   * 将备份数据写入数据库的各个表。
   *
   * 可见性说明：原为 private，版本号基线重构后改为 public，
   * 供 MigrationService.runStartupMigration 复用（写回迁移后的全量数据）。
   *
   * P4-009 修复：导入前对备份数据做结构性校验，拒绝缺少关键字段的无效备份。
   *
   * @param data - 备份数据
   * @returns ImportResult - 导入结果
   */
  async importData(data: BackupData): Promise<ImportResult> {
    const importedStores: string[] = [];
    const skippedStores: string[] = [];

    // P4-009 修复：结构性校验 — 拒绝非对象类型或 null/undefined 的备份数据
    if (!data || (typeof data !== 'object')) {
      return { success: false, error: '备份数据格式无效', importedStores, skippedStores };
    }

    // 版本号基线重构后：DATA_VERSION = 1 为基线，导入的备份无需迁移。
    // 未来版本变更时，此处调用 runMigrations(data, backup.dataVersion)，
    // 由 migrations/index.ts 中的注册表驱动数据格式升级。

    try {
      await db.transaction(
        'rw',
        [
          db.char_data,
          db.char_inventory,
          db.char_quests,
          db.char_equipment,
          db.char_skills,
          db.char_exploration,
          db.runtime_combatLogs,
          db.runtime_adventureLogs,
          db.config_locations,
          db.config_shops,
          db.runtime_gameState,
          db.config_factions,
          db.config_races,
          db.config_classes,
          db.config_items,
          db.config_equipment_items,
          db.config_mobs,
          db.config_bosses,
          db.config_skills,
          // P6-200 修复：补齐遗漏的配置表到导入事务
          db.config_quests,
          db.config_class_equipment,
          db.config_class_passives,
          db.config_class_talents,
          db.config_set_definitions,
          db.runtime_mapState,
          db.runtime_shopItems,
          // P7-001 修复：补齐 runtime_shopSoldItems 到导入事务
          db.runtime_shopSoldItems,
        ],
        async () => {
          // 辅助函数：Record 形状数据有数据则 clear+bulkPut，否则计入 skipped
          // P9-018 修复：导入前 clear 目标表，避免旧数据残留
          const bulkPutIfNotEmpty = async <T>(
            table: Table,
            record: Record<string, T> | undefined,
            storeName: string
          ) => {
            await table.clear();
            if (record && Object.keys(record).length > 0) {
              await table.bulkPut(Object.values(record));
              importedStores.push(storeName);
            } else {
              skippedStores.push(storeName);
            }
          };

          // 辅助函数：数组形状数据有数据则 clear+bulkPut，否则计入 skipped（CODE-34）
          const bulkPutArrayIfNotEmpty = async (
            table: Table,
            items: readonly unknown[] | undefined,
            storeName: string
          ) => {
            await table.clear();
            if (items && items.length > 0) {
              await table.bulkPut(items as unknown[]);
              importedStores.push(storeName);
            } else {
              skippedStores.push(storeName);
            }
          };

          // Record 形状的表（角色表 + 运行时表）
          await bulkPutIfNotEmpty(db.char_data, data.characters, 'char_data');
          await bulkPutIfNotEmpty(db.char_inventory, data.inventory, 'char_inventory');
          // P10-002 修复：char_quests 改为数组形状导入（每角色多行），避免 Record 折叠丢失
          await bulkPutArrayIfNotEmpty(db.char_quests, data.quests, 'char_quests');
          await bulkPutIfNotEmpty(db.char_equipment, data.equipment, 'char_equipment');
          await bulkPutIfNotEmpty(db.char_skills, data.skills, 'char_skills');
          await bulkPutIfNotEmpty(db.char_exploration, data.exploration, 'char_exploration');
          await bulkPutIfNotEmpty(db.runtime_combatLogs, data.combat, 'runtime_combatLogs');
          await bulkPutIfNotEmpty(db.runtime_gameState, data.gameState, 'runtime_gameState');
          await bulkPutIfNotEmpty(db.runtime_mapState, data.mapState, 'runtime_mapState');
          await bulkPutIfNotEmpty(db.runtime_shopItems, data.shopItems, 'runtime_shopItems');
          // P7-001 修复：补齐 runtime_shopSoldItems 导入
          await bulkPutIfNotEmpty(db.runtime_shopSoldItems, data.shopSoldItems, 'runtime_shopSoldItems');

          // adventureLog：转换为 AdventureLogData[] 后统一处理
          // P9-060 修复：保留备份中的原始 updatedAt 时间戳，而非用 Date.now()
          // 兼容旧格式（Record<string, LogEntry[]>）：若 adventureLog 为对象则降级为 Date.now()
          const adventureLogEntries: AdventureLogData[] = Array.isArray(data.adventureLog)
            ? data.adventureLog
            : data.adventureLog
              ? Object.entries(data.adventureLog as unknown as Record<string, LogEntry[]>).map(
                  ([characterId, entries]) => ({
                    characterId,
                    entries,
                    // 旧版备份无 updatedAt 字段，用当前时间降级（仅影响旧存档导入）
                    updatedAt: Date.now()
                  })
                )
              : [];
          await bulkPutArrayIfNotEmpty(
            db.runtime_adventureLogs,
            adventureLogEntries,
            'runtime_adventureLogs'
          );

          // CODE-34：数组形状的配置表通过 TABLES_TO_BACKUP 配置驱动，
          // 消除 11 处结构相同的 if/else；断言收敛在 getTable 内部（CODE-5）
          for (const { field, table, storeName } of TABLES_TO_BACKUP) {
            await bulkPutArrayIfNotEmpty(getTable<unknown>(db, table), data[field], storeName);
          }
        }
      );

      return { success: true, importedStores, skippedStores };
    } catch (error) {
      console.error('导入数据失败:', error);
      return {
        success: false,
        error: (error as Error).message,
        importedStores,
        skippedStores
      };
    }
  }
}

/** 显式导出 LogEntry 类型别名，便于本模块在类型上下文中引用 */
export type { LogEntry };
