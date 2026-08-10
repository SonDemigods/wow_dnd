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
   * 验证备份文件
   *
   * 检查备份文件的格式、完整性和版本兼容性
   * @param file - 备份文件
   * @returns ValidationResult - 验证结果
   */
  async validateBackup(file: File): Promise<ValidationResult> {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const content = reader.result as string;
          const backup = JSON.parse(content);

          if (!backup.version) {
            resolve({ success: false, error: '备份文件格式错误' });
            return;
          }

          const checksum = await calculateChecksum(backup.data);
          if (checksum !== backup.checksum) {
            resolve({ success: false, error: '备份文件已损坏' });
            return;
          }

          const compatibility = this.checkVersionCompatibility(backup.version);
          if (!compatibility.compatible) {
            resolve({ success: false, error: compatibility.message });
            return;
          }

          resolve({
            success: true,
            version: backup.version,
            timestamp: backup.timestamp,
            gameVersion: backup.gameVersion
          });
        } catch {
          resolve({ success: false, error: '备份文件格式错误' });
        }
      };

      reader.onerror = () => {
        resolve({ success: false, error: '读取文件失败' });
      };

      reader.readAsText(file);
    });
  }

  /**
   * 导入备份文件
   *
   * 验证备份文件后，将数据导入数据库
   * @param file - 备份文件
   * @returns ImportResult - 导入结果
   */
  async importBackup(file: File): Promise<ImportResult> {
    const validation = await this.validateBackup(file);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error,
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
      reader.onload = async () => {
        try {
          const content = reader.result as string;
          const backup = JSON.parse(content) as BackupFile;

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
          db.runtime_mapState,
          db.runtime_shopItems,
        ],
        async () => {
          // 辅助函数：Record 形状数据有数据则 bulkPut，否则计入 skipped
          const bulkPutIfNotEmpty = async <T>(
            table: Table,
            record: Record<string, T> | undefined,
            storeName: string
          ) => {
            if (record && Object.keys(record).length > 0) {
              await table.bulkPut(Object.values(record));
              importedStores.push(storeName);
            } else {
              skippedStores.push(storeName);
            }
          };

          // 辅助函数：数组形状数据有数据则 bulkPut，否则计入 skipped（CODE-34）
          const bulkPutArrayIfNotEmpty = async (
            table: Table,
            items: readonly unknown[] | undefined,
            storeName: string
          ) => {
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
          await bulkPutIfNotEmpty(db.char_quests, data.quests, 'char_quests');
          await bulkPutIfNotEmpty(db.char_equipment, data.equipment, 'char_equipment');
          await bulkPutIfNotEmpty(db.char_skills, data.skills, 'char_skills');
          await bulkPutIfNotEmpty(db.char_exploration, data.exploration, 'char_exploration');
          await bulkPutIfNotEmpty(db.runtime_combatLogs, data.combat, 'runtime_combatLogs');
          await bulkPutIfNotEmpty(db.runtime_gameState, data.gameState, 'runtime_gameState');
          await bulkPutIfNotEmpty(db.runtime_mapState, data.mapState, 'runtime_mapState');
          await bulkPutIfNotEmpty(db.runtime_shopItems, data.shopItems, 'runtime_shopItems');

          // adventureLog：转换为 AdventureLogData[] 后统一处理
          // 注意：补全 updatedAt 字段（AdventureLogData 必填，旧实现缺失导致类型不匹配）
          const adventureLogEntries: AdventureLogData[] = data.adventureLog
            ? Object.entries(data.adventureLog).map(([characterId, entries]) => ({
                characterId,
                entries,
                updatedAt: Date.now()
              }))
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
