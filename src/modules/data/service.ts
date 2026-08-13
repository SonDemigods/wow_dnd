/**
 * @fileoverview 数据服务模块（re-export 入口）
 *
 * 历史上此文件包含 DataInitializer、BackupService、ImportService 三个类的实现，
 * QA-11 阶段已将实现拆分为：
 * - ./initializer.ts：DataInitializer 类与 dataInitializer 实例
 * - ./backup.ts：BackupService 类与 backupService 实例（含 calculateChecksum、TABLES_TO_BACKUP）
 * - ./importer.ts：ImportService 类与 importService 实例
 *
 * 为保持向后兼容（其他模块仍可通过 `@/modules/data/service` 引用），此文件
 * 作为 re-export 入口聚合所有原导出符号。新代码应优先使用 `@/modules/data`
 * 公共入口或直接引用子模块。
 *
 * 注意：遵循硬约束"禁止使用 `export *`"，所有导出均显式命名。
 */
export { DataInitializer } from './initializer';
export { BackupService, calculateChecksum, TABLES_TO_BACKUP } from './backup';
export type { ArrayBackupField, Table } from './backup';
export { ImportService } from './importer';

import { DataInitializer } from './initializer';
import { BackupService } from './backup';
import { ImportService } from './importer';

/**
 * 数据初始化服务实例
 */
export const dataInitializer = new DataInitializer();

/**
 * 备份服务实例
 */
export const backupService = new BackupService();

/**
 * 导入服务实例
 */
export const importService = new ImportService();
