/**
 * @fileoverview data/backup.ts 子模块独立测试
 *
 * QA-11 拆分后，BackupService 类及 calculateChecksum / TABLES_TO_BACKUP
 * 移至 ./backup.ts。原有完整行为测试见 ./service.test.ts（通过 re-export 入口验证）。
 *
 * 本文件聚焦于子模块独立可导入性、calculateChecksum 纯函数行为、
 * 以及 TABLES_TO_BACKUP 配置完整性。深度行为测试由 service.test.ts 覆盖。
 */
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import {
  BackupService,
  calculateChecksum,
  TABLES_TO_BACKUP
} from '@/modules/data/backup';
import {
  BackupService as BackupServiceFromService,
  backupService
} from '@/modules/data/service';

describe('data/backup 子模块独立测试', () => {
  describe('模块导出', () => {
    it('BackupService 是可实例化的类', () => {
      const service = new BackupService();
      expect(service).toBeInstanceOf(BackupService);
    });

    it('从子模块与从 service.ts re-export 导入的是同一个类', () => {
      expect(BackupService).toBe(BackupServiceFromService);
    });

    it('service.ts 导出的 backupService 实例是 BackupService 类的实例', () => {
      expect(backupService).toBeInstanceOf(BackupService);
    });

    it('calculateChecksum 是函数', () => {
      expect(typeof calculateChecksum).toBe('function');
    });

    it('TABLES_TO_BACKUP 是数组', () => {
      expect(Array.isArray(TABLES_TO_BACKUP)).toBe(true);
    });
  });

  describe('calculateChecksum 纯函数行为', () => {
    it('相同数据返回相同校验和', () => {
      const data = { a: 1, b: 'test' };
      expect(calculateChecksum(data)).toBe(calculateChecksum(data));
    });

    it('不同数据返回不同校验和', () => {
      expect(calculateChecksum({ a: 1 })).not.toBe(calculateChecksum({ a: 2 }));
    });

    it('返回值为十六进制字符串', () => {
      const result = calculateChecksum({ test: true });
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^[0-9a-f]+$/);
    });

    it('空对象返回非空校验和', () => {
      const result = calculateChecksum({});
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('TABLES_TO_BACKUP 配置完整性', () => {
    it('包含全部 10 个数组形状配置表', () => {
      expect(TABLES_TO_BACKUP.length).toBe(10);
    });

    it('每项包含 field / table / storeName 三个字段', () => {
      for (const item of TABLES_TO_BACKUP) {
        expect(item).toHaveProperty('field');
        expect(item).toHaveProperty('table');
        expect(item).toHaveProperty('storeName');
      }
    });

    it('覆盖 factions/races/classes/items/equipmentItems/mobs/bosses/skillTemplates/map/shop', () => {
      const fields = TABLES_TO_BACKUP.map(item => item.field);
      expect(fields).toEqual(
        expect.arrayContaining([
          'factions', 'races', 'classes', 'items', 'equipmentItems',
          'mobs', 'bosses', 'skillTemplates', 'map', 'shop'
        ])
      );
    });
  });

  describe('实例方法存在', () => {
    it('暴露 createBackup / exportBackup / getAutoBackups / deleteBackup / clearAutoBackups / createAutoBackup', () => {
      const service = new BackupService();
      expect(typeof service.createBackup).toBe('function');
      expect(typeof service.exportBackup).toBe('function');
      expect(typeof service.getAutoBackups).toBe('function');
      expect(typeof service.deleteBackup).toBe('function');
      expect(typeof service.clearAutoBackups).toBe('function');
      expect(typeof service.createAutoBackup).toBe('function');
    });
  });
});
