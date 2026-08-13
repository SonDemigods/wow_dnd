/**
 * @fileoverview 数据库配置常量单元测试
 * @description 验证 @/config/database 中三项配置的结构不变量：
 * - DATABASE_CONFIG：name 非空（版本基线重构后为 wow_dnd_game_v1，已删除 version 死字段）
 * - DB_SERVICE_CONFIG：maxRetries 非负、delay 正数、backoff 为 exponential
 * - BACKUP_CONFIG：backupVersion 为 v1.0、supportedVersions 仅含 v1.0
 *   （版本基线重构后删除 autoBackupKey / maxAutoBackups，自动备份功能移除）
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

  it('name 为 wow_dnd_game_v1（改名让旧库自然废弃）', () => {
    expect(DATABASE_CONFIG.name).toBe('wow_dnd_game_v1');
  });

  it('不再包含 version 字段（死字段已删除）', () => {
    expect('version' in DATABASE_CONFIG).toBe(false);
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
  it('backupVersion 为 v1.0', () => {
    expect(BACKUP_CONFIG.backupVersion).toBe('v1.0');
  });

  it('supportedVersions 仅含 v1.0（不再兼容旧 v1.1）', () => {
    expect(BACKUP_CONFIG.supportedVersions).toEqual(['v1.0']);
  });

  it('supportedVersions 非空且包含当前 backupVersion', () => {
    expect(BACKUP_CONFIG.supportedVersions.length).toBeGreaterThan(0);
    expect(BACKUP_CONFIG.supportedVersions).toContain(BACKUP_CONFIG.backupVersion);
  });

  it('不再包含 autoBackupKey / maxAutoBackups 字段（自动备份功能已移除）', () => {
    expect('autoBackupKey' in BACKUP_CONFIG).toBe(false);
    expect('maxAutoBackups' in BACKUP_CONFIG).toBe(false);
  });
});
