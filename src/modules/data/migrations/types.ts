/**
 * @fileoverview 数据迁移类型定义
 * @description 定义单次数据迁移的接口契约与迁移结果。
 *
 *   每个版本变更对应一个 Migration 文件（如 v1_to_v2.ts），
 *   纯函数转换 BackupData，可单元测试。
 *
 *   同一份 Migration 文件同时服务于两个入口：
 *   - 备份导入时：ImportService.importData 调用 runMigrations
 *   - 启动时手动迁移：MigrationService.runStartupMigration 调用 runMigrations
 *
 * @module data/migrations
 */
import type { BackupData } from '../types';

/**
 * 单次数据迁移定义
 *
 * @property from - 源版本
 * @property to - 目标版本
 * @property description - 变更说明（如"exploration cell 新增 sealed 字段"）
 * @property migrate - 纯函数转换，返回新对象（不修改原对象）
 */
export interface Migration {
  /** 源版本 */
  from: number;
  /** 目标版本 */
  to: number;
  /** 变更说明（如"exploration cell 新增 sealed 字段"） */
  description: string;
  /** 纯函数转换，返回新对象（不修改原对象） */
  migrate: (data: BackupData) => BackupData;
}

/**
 * 迁移结果
 *
 * @property success - 迁移是否成功
 * @property fromVersion - 迁移前的数据版本
 * @property toVersion - 迁移后的数据版本
 * @property migratedRecords - 迁移的记录数（估算）
 * @property error - 失败时的错误信息（成功时也可作为提示信息，如"无需迁移"）
 */
export interface MigrationResult {
  success: boolean;
  /** 迁移前的数据版本 */
  fromVersion: number;
  /** 迁移后的数据版本 */
  toVersion: number;
  /** 迁移的记录数（估算） */
  migratedRecords: number;
  /** 失败时的错误信息 */
  error?: string;
}
