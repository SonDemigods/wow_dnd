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

    it('calculateChecksum 返回 Promise（P3-113 异步化）', async () => {
      const result = calculateChecksum({ a: 1 });
      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toBeTypeOf('string');
    });

    it('TABLES_TO_BACKUP 是数组', () => {
      expect(Array.isArray(TABLES_TO_BACKUP)).toBe(true);
    });
  });

  describe('calculateChecksum 纯函数行为（P3-113：SHA-256 异步）', () => {
    it('相同数据返回相同校验和', async () => {
      const data = { a: 1, b: 'test' };
      const [r1, r2] = await Promise.all([calculateChecksum(data), calculateChecksum(data)]);
      expect(r1).toBe(r2);
    });

    it('不同数据返回不同校验和', async () => {
      const [r1, r2] = await Promise.all([
        calculateChecksum({ a: 1 }),
        calculateChecksum({ a: 2 })
      ]);
      expect(r1).not.toBe(r2);
    });

    it('返回值为 64 字符的 SHA-256 十六进制字符串', async () => {
      const result = await calculateChecksum({ test: true });
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^[0-9a-f]+$/);
      // SHA-256 输出固定 256 位 = 64 个十六进制字符
      expect(result).toHaveLength(64);
    });

    it('空对象返回非空校验和', async () => {
      const result = await calculateChecksum({});
      expect(result.length).toBeGreaterThan(0);
    });

    it('P3-113：SHA-256 输出长度固定为 64 字符（碰撞概率 2^-128）', async () => {
      const results = await Promise.all([
        calculateChecksum({}),
        calculateChecksum({ a: 1 }),
        calculateChecksum('hello'),
        calculateChecksum([1, 2, 3]),
        calculateChecksum(null),
      ]);
      for (const r of results) {
        expect(r).toHaveLength(64);
      }
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
    it('暴露 createBackup / exportBackup / collectAllData（自动备份方法已移除）', () => {
      const service = new BackupService();
      expect(typeof service.createBackup).toBe('function');
      expect(typeof service.exportBackup).toBe('function');
      expect(typeof service.collectAllData).toBe('function');
      // 版本基线重构后自动备份方法已删除
      expect((service as unknown as Record<string, unknown>).getAutoBackups).toBeUndefined();
      expect((service as unknown as Record<string, unknown>).deleteBackup).toBeUndefined();
      expect((service as unknown as Record<string, unknown>).clearAutoBackups).toBeUndefined();
      expect((service as unknown as Record<string, unknown>).createAutoBackup).toBeUndefined();
    });
  });
});
