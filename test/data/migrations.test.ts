/**
 * @fileoverview 数据迁移框架单元测试
 *
 * 覆盖 migrations/ 子模块：
 * 1. runMigrations：空迁移链原样返回数据（fromVersion === CURRENT_DATA_VERSION 与 fromVersion < CURRENT_DATA_VERSION 两路）
 * 2. MIGRATIONS：注册表当前为空（基线版本无迁移）
 * 3. MigrationService.runStartupMigration：存档已是最新版本时返回 migratedRecords: 0
 *
 * 版本基线重构后 DATA_VERSION = 1 为基线，迁移链为空。
 * 未来版本变更时新增 Migration 文件并在此测试中补充对应用例。
 *
 * 设计说明（遵循 code_rule 红线）：
 *  - 顶部 `import 'fake-indexeddb/auto'` 注入 IndexedDB shim
 *  - beforeEach 清空 runtime_gameState 表
 *  - 不 mock db，使用 fake-indexeddb 真实执行事务
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { runMigrations, MIGRATIONS } from '@/modules/data/migrations';
import { MigrationService, migrationService } from '@/modules/data/migrations/service';
import { CURRENT_DATA_VERSION } from '@/config/version';
import { db } from '@/modules/data/core';
import type { BackupData } from '@/modules/data/types';

/** 构造最小化的有效 BackupData（所有字段为空） */
function createMinimalBackupData(): BackupData {
  return {
    characters: {},
    inventory: {},
    quests: {},
    equipment: {},
    skills: {},
    exploration: {},
    combat: {},
    adventureLog: {},
    map: [],
    shop: [],
    gameState: {},
    shopItems: {},
  };
}

describe('migrations 迁移框架', () => {
  describe('MIGRATIONS 注册表', () => {
    it('当前为空数组（DATA_VERSION = 1 基线版本无迁移）', () => {
      expect(MIGRATIONS).toEqual([]);
      expect(MIGRATIONS.length).toBe(0);
    });
  });

  describe('runMigrations 运行迁移链', () => {
    it('fromVersion === CURRENT_DATA_VERSION 时原样返回数据', () => {
      const data = createMinimalBackupData();
      const result = runMigrations(data, CURRENT_DATA_VERSION);
      // 空迁移链原样返回同一引用
      expect(result).toBe(data);
    });

    it('fromVersion < CURRENT_DATA_VERSION 时也原样返回（注册表为空，无迁移可执行）', () => {
      const data = createMinimalBackupData();
      // 模拟旧版本存档（fromVersion = 0），但迁移链为空故原样返回
      const result = runMigrations(data, 0);
      expect(result).toBe(data);
    });

    it('不修改传入的原始数据', () => {
      const data = createMinimalBackupData();
      const original = { ...data };
      runMigrations(data, 0);
      // 原对象未被修改（纯函数语义）
      expect(data).toEqual(original);
    });
  });

  describe('MigrationService 迁移服务', () => {
    beforeEach(async () => {
      await db.runtime_gameState.clear();
    });

    it('runStartupMigration 在存档已是最新版本时返回 migratedRecords: 0', async () => {
      // Arrange：写入 dataVersion = CURRENT_DATA_VERSION 的 gameState
      await db.runtime_gameState.put({
        id: 'gameState',
        dataVersion: CURRENT_DATA_VERSION,
      });

      // Act
      const service = new MigrationService();
      const result = await service.runStartupMigration();

      // Assert
      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe(CURRENT_DATA_VERSION);
      expect(result.toVersion).toBe(CURRENT_DATA_VERSION);
      expect(result.migratedRecords).toBe(0);
      expect(result.error).toContain('最新版本');
    });

    it('runStartupMigration 在无 gameState 时视为版本 1（基线），无需迁移', async () => {
      // Arrange：不写入任何 gameState（模拟全新数据库）

      // Act
      const service = new MigrationService();
      const result = await service.runStartupMigration();

      // Assert：fromVersion 默认为 1（?? 1），等于 CURRENT_DATA_VERSION，无需迁移
      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe(1);
      expect(result.migratedRecords).toBe(0);
    });

    it('migrationService 单例是 MigrationService 类的实例', () => {
      expect(migrationService).toBeInstanceOf(MigrationService);
    });
  });
});
