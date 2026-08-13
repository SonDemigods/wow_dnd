/**
 * @fileoverview 版本号统一源单元测试
 *
 * 验证 @/config/version 中三层版本号常量的值与类型：
 * - APP_VERSION：语义化版本字符串，与 package.json 同步
 * - DATA_VERSION：正整数，数据格式版本
 * - CURRENT_DATA_VERSION：等于 DATA_VERSION（供迁移服务比较）
 * - DB_SCHEMA_VERSION：Dexie schema 版本，仅管表结构演进
 *
 * 版本基线重构后，此文件是版本号的唯一断言源。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { APP_VERSION, DATA_VERSION, CURRENT_DATA_VERSION, DB_SCHEMA_VERSION } from '@/config/version';

describe('config/version 版本号统一源', () => {
  describe('APP_VERSION 应用版本号', () => {
    it('为语义化版本字符串 1.0.0', () => {
      expect(APP_VERSION).toBe('1.0.0');
    });

    it('与 package.json 的 version 字段同步', () => {
      const pkgPath = resolve(__dirname, '../../package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      expect(APP_VERSION).toBe(pkg.version);
    });

    it('符合 semver 格式（major.minor.patch）', () => {
      expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('DATA_VERSION 数据格式版本', () => {
    it('为正整数', () => {
      expect(Number.isInteger(DATA_VERSION)).toBe(true);
      expect(DATA_VERSION).toBeGreaterThan(0);
    });

    it('当前基线版本为 1', () => {
      expect(DATA_VERSION).toBe(1);
    });
  });

  describe('CURRENT_DATA_VERSION 当前期望数据版本', () => {
    it('等于 DATA_VERSION', () => {
      expect(CURRENT_DATA_VERSION).toBe(DATA_VERSION);
    });
  });

  describe('DB_SCHEMA_VERSION 数据库 Schema 版本', () => {
    it('为正整数', () => {
      expect(Number.isInteger(DB_SCHEMA_VERSION)).toBe(true);
      expect(DB_SCHEMA_VERSION).toBeGreaterThan(0);
    });

    it('当前基线版本为 1（GameDatabase 构造函数使用此常量调用 version()）', () => {
      expect(DB_SCHEMA_VERSION).toBe(1);
    });
  });
});
