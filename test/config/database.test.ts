/**
 * @fileoverview 数据库配置常量单元测试
 * @description 验证 @/config/database 中三项配置的结构不变量：
 * - DATABASE_CONFIG：name 非空、version 正整数
 * - DB_SERVICE_CONFIG：maxRetries 非负、delay 正数、backoff 为 exponential
 * - BACKUP_CONFIG：autoBackupKey 非空、maxAutoBackups 正整数、
 *   supportedVersions 非空且包含当前 backupVersion
 *
 * supportedVersions 未包含当前版本会导致存档导入校验失败。
 */
import { describe, it, expect } from 'vitest';
import { DATABASE_CONFIG, DB_SERVICE_CONFIG, BACKUP_CONFIG } from '@/config/database';

describe('DATABASE_CONFIG 数据库连接配置', () => {
  it('name 为非空字符串', () => {
    expect(typeof DATABASE_CONFIG.name).toBe('string');
    expect(DATABASE_CONFIG.name.length).toBeGreaterThan(0);
  });

  it('version 为正整数', () => {
    expect(Number.isInteger(DATABASE_CONFIG.version)).toBe(true);
    expect(DATABASE_CONFIG.version).toBeGreaterThan(0);
  });
});

describe('DB_SERVICE_CONFIG 重试配置', () => {
  it('maxRetries 为非负整数', () => {
    expect(Number.isInteger(DB_SERVICE_CONFIG.maxRetries)).toBe(true);
    expect(DB_SERVICE_CONFIG.maxRetries).toBeGreaterThanOrEqual(0);
  });

  it('delay 为正数', () => {
    expect(DB_SERVICE_CONFIG.delay).toBeGreaterThan(0);
  });

  it('backoff 为 exponential', () => {
    expect(DB_SERVICE_CONFIG.backoff).toBe('exponential');
  });
});

describe('BACKUP_CONFIG 备份配置', () => {
  it('autoBackupKey 为非空字符串', () => {
    expect(BACKUP_CONFIG.autoBackupKey.length).toBeGreaterThan(0);
  });

  it('maxAutoBackups 为正整数', () => {
    expect(Number.isInteger(BACKUP_CONFIG.maxAutoBackups)).toBe(true);
    expect(BACKUP_CONFIG.maxAutoBackups).toBeGreaterThan(0);
  });

  it('backupVersion 为非空字符串', () => {
    expect(BACKUP_CONFIG.backupVersion.length).toBeGreaterThan(0);
  });

  it('supportedVersions 非空且包含当前 backupVersion', () => {
    expect(BACKUP_CONFIG.supportedVersions.length).toBeGreaterThan(0);
    expect(BACKUP_CONFIG.supportedVersions).toContain(BACKUP_CONFIG.backupVersion);
  });
});
