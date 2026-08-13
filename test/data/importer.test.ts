/**
 * @fileoverview data/importer.ts 子模块独立测试
 *
 * QA-11 拆分后，ImportService 类移至 ./importer.ts。
 * 原有完整行为测试见 ./service.test.ts（通过 re-export 入口验证）。
 *
 * 本文件聚焦于子模块独立可导入性、checkVersionCompatibility 纯函数行为。
 * 深度行为测试（validateBackup / importBackup / importData）由 service.test.ts 覆盖。
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { ImportService } from '@/modules/data/importer';
import {
  ImportService as ImportServiceFromService,
  importService
} from '@/modules/data/service';
import { BACKUP_CONFIG } from '@/config/database';

describe('data/importer 子模块独立测试', () => {
  describe('模块导出', () => {
    it('ImportService 是可实例化的类', () => {
      const service = new ImportService();
      expect(service).toBeInstanceOf(ImportService);
    });

    it('从子模块与从 service.ts re-export 导入的是同一个类', () => {
      expect(ImportService).toBe(ImportServiceFromService);
    });

    it('service.ts 导出的 importService 实例是 ImportService 类的实例', () => {
      expect(importService).toBeInstanceOf(ImportService);
    });
  });

  describe('实例方法存在', () => {
    it('暴露 validateBackup / importBackup / checkVersionCompatibility', () => {
      const service = new ImportService();
      expect(typeof service.validateBackup).toBe('function');
      expect(typeof service.importBackup).toBe('function');
      expect(typeof service.checkVersionCompatibility).toBe('function');
    });
  });

  describe('checkVersionCompatibility 行为', () => {
    let service: ImportService;

    beforeEach(() => {
      service = new ImportService();
    });

    it('当前支持的版本返回兼容且无需迁移', () => {
      const result = service.checkVersionCompatibility(BACKUP_CONFIG.backupVersion);
      expect(result.compatible).toBe(true);
      expect(result.requiresMigration).toBe(false);
      expect(result.message).toBe('版本兼容');
    });

    it('不支持的版本返回不兼容', () => {
      const result = service.checkVersionCompatibility('v0.9-unsupported');
      expect(result.compatible).toBe(false);
      expect(result.requiresMigration).toBe(false);
    });

    it('空字符串版本返回不兼容', () => {
      const result = service.checkVersionCompatibility('');
      expect(result.compatible).toBe(false);
    });
  });
});
