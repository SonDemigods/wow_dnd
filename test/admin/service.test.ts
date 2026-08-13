/**
 * @fileoverview 后台管理模块服务层（admin/service.ts）内存级测试
 *
 * 使用 fake-indexeddb 在内存中真实执行 Dexie 操作，覆盖 AdminService 的全部方法：
 *  - getAll / getById / add（成功 / 失败）/ update（成功 / 失败）/ delete（成功 / 失败）
 *  - clear / count / searchTable / getDashboardStats
 *  - 验证 try-catch 返回 AdminOperationResult 的 success / error 字段
 *
 * 设计说明（遵循 code_rule 红线）：
 *  - 顶部 `import 'fake-indexeddb/auto'` 注入 IndexedDB shim
 *  - 不 mock admin/db，直接使用真实的 adminService 实例
 *  - beforeEach 清空全部 CONFIG_TABLES 对应的表，确保 getDashboardStats 从干净状态开始
 *  - 失败路径：add 用重复主键触发 ConstraintError；update 用不存在 ID 触发 "记录不存在"；
 *    delete 用无效表名触发 Dexie SchemaError，验证 catch 返回 { success: false, error }
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { adminService } from '@/modules/admin/service';
import { adminDbService } from '@/modules/admin/db';
import { db } from '@/modules/data/core';
import { CONFIG_TABLES } from '@/modules/admin/types';
import type { GameDatabaseSchema } from '@/modules/data/core';

// ==================== 测试数据类型与 helper ====================

interface MobRecord {
  id: string;
  name: string;
  dangerLevel: string;
}

function makeMob(o: Partial<MobRecord> = {}): MobRecord {
  return {
    id: 'mob-1',
    name: '哥布林',
    dangerLevel: '低',
    ...o,
  };
}

// ==================== 测试用例 ====================

describe('AdminService - 后台管理服务层（fake-indexeddb 真实 CRUD）', () => {
  beforeEach(async () => {
    // 清空所有 CONFIG_TABLES 对应的表，确保 getDashboardStats 等方法从干净状态开始
    await Promise.all(
      CONFIG_TABLES.map(t => db.table<Record<string, unknown>, string>(t.dbTable as keyof GameDatabaseSchema).clear())
    );
  });

  // -------------------- getAll --------------------

  describe('getAll', () => {
    it('空表返回空数组', async () => {
      const result = await adminService.getAll<MobRecord>('config_mobs');
      expect(result).toEqual([]);
    });

    it('返回表中全部记录', async () => {
      await adminService.add('config_mobs', makeMob({ name: 'A' }), 'm1');
      await adminService.add('config_mobs', makeMob({ name: 'B' }), 'm2');

      const result = await adminService.getAll<MobRecord>('config_mobs');
      expect(result).toHaveLength(2);
      const names = result.map(m => m.name).sort();
      expect(names).toEqual(['A', 'B']);
    });
  });

  // -------------------- getById --------------------

  describe('getById', () => {
    it('记录存在时返回完整数据', async () => {
      await adminService.add('config_mobs', makeMob({ name: '哥布林' }), 'm1');

      const result = await adminService.getById<MobRecord>('config_mobs', 'm1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('m1');
      expect(result!.name).toBe('哥布林');
    });

    it('记录不存在时返回 undefined（Dexie get 未找到返回 undefined）', async () => {
      const result = await adminService.getById<MobRecord>('config_mobs', 'non-existent');
      expect(result).toBeUndefined();
    });
  });

  // -------------------- add --------------------

  describe('add', () => {
    it('成功：返回 success=true 及主键数据', async () => {
      const result = await adminService.add('config_mobs', makeMob({ name: '兽人' }), 'orc-1');

      expect(result.success).toBe(true);
      expect(result.data).toBe('orc-1');
      // 验证确实写入数据库
      const stored = await adminService.getById<MobRecord>('config_mobs', 'orc-1');
      expect(stored).not.toBeNull();
      expect(stored!.name).toBe('兽人');
    });

    it('失败：重复主键返回 success=false 及 error 字段', async () => {
      await adminService.add('config_mobs', makeMob({ name: 'A' }), 'dup-1');

      const result = await adminService.add('config_mobs', makeMob({ name: 'B' }), 'dup-1');

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(typeof result.error).toBe('string');
    });
  });

  // -------------------- update --------------------

  describe('update', () => {
    it('成功：返回 success=true 且数据已更新', async () => {
      await adminService.add('config_mobs', makeMob({ name: '旧名' }), 'm1');

      const result = await adminService.update<MobRecord>('config_mobs', 'm1', { name: '新名' });

      expect(result.success).toBe(true);
      const stored = await adminService.getById<MobRecord>('config_mobs', 'm1');
      expect(stored!.name).toBe('新名');
    });

    it('失败：记录不存在返回 success=false 及 error="记录不存在"', async () => {
      const result = await adminService.update<MobRecord>('config_mobs', 'non-existent', { name: 'x' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('记录不存在');
    });
  });

  // -------------------- delete --------------------

  describe('delete', () => {
    it('成功：删除后记录不可查', async () => {
      await adminService.add('config_mobs', makeMob({ name: 'A' }), 'm1');

      const result = await adminService.delete('config_mobs', 'm1');

      expect(result.success).toBe(true);
      expect(await adminService.getById<MobRecord>('config_mobs', 'm1')).toBeUndefined();
    });

    it('失败：无效表名返回 success=false 及 error 字段', async () => {
      const result = await adminService.delete('invalid_table_name', 'm1');

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(typeof result.error).toBe('string');
    });
  });

  // -------------------- clear --------------------

  describe('clear', () => {
    it('成功：清空后表为空', async () => {
      await adminService.add('config_mobs', makeMob({ name: 'A' }), 'm1');
      await adminService.add('config_mobs', makeMob({ name: 'B' }), 'm2');

      const result = await adminService.clear('config_mobs');

      expect(result.success).toBe(true);
      expect(await adminService.count('config_mobs')).toBe(0);
    });

    it('失败：无效表名返回 success=false 及 error 字段', async () => {
      const result = await adminService.clear('invalid_table_name');

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(typeof result.error).toBe('string');
    });
  });

  // -------------------- count --------------------

  describe('count', () => {
    it('空表返回 0', async () => {
      const result = await adminService.count('config_mobs');
      expect(result).toBe(0);
    });

    it('返回表中记录数量', async () => {
      await adminService.add('config_mobs', makeMob({ name: 'A' }), 'm1');
      await adminService.add('config_mobs', makeMob({ name: 'B' }), 'm2');

      const result = await adminService.count('config_mobs');
      expect(result).toBe(2);
    });
  });

  // -------------------- searchTable --------------------

  describe('searchTable', () => {
    it('按关键词搜索返回匹配记录', async () => {
      await adminService.add('config_mobs', makeMob({ id: 'goblin', name: '哥布林' }), 'goblin');
      await adminService.add('config_mobs', makeMob({ id: 'goblin-mage', name: '哥布林法师' }), 'goblin-mage');
      await adminService.add('config_mobs', makeMob({ id: 'orc', name: '兽人' }), 'orc');

      const result = await adminService.searchTable('config_mobs', '哥布林');

      expect(result).toHaveLength(2);
      const names = result.map(r => r.name).sort();
      expect(names).toEqual(['哥布林', '哥布林法师']);
    });

    it('空关键词返回空数组', async () => {
      await adminService.add('config_mobs', makeMob({ name: 'A' }), 'm1');

      const result = await adminService.searchTable('config_mobs', '');
      expect(result).toEqual([]);
    });
  });

  // -------------------- getDashboardStats --------------------

  describe('getDashboardStats', () => {
    it('空库时所有配置表计数为 0', async () => {
      const result = await adminService.getDashboardStats();

      expect(result.tableCounts).toBeDefined();
      // CONFIG_TABLES 共 15 张表，tableCounts 应包含全部表名
      expect(Object.keys(result.tableCounts)).toHaveLength(CONFIG_TABLES.length);
      for (const meta of CONFIG_TABLES) {
        expect(result.tableCounts[meta.dbTable]).toBe(0);
      }
    });

    it('写入数据后对应表计数更新', async () => {
      await adminService.add('config_mobs', makeMob({ name: 'A' }), 'm1');
      await adminService.add('config_mobs', makeMob({ name: 'B' }), 'm2');
      await adminService.add('config_items', { id: 'i1', name: '药水', type: 'consumable', rarity: 'common' }, 'i1');

      const result = await adminService.getDashboardStats();

      expect(result.tableCounts['config_mobs']).toBe(2);
      expect(result.tableCounts['config_items']).toBe(1);
      expect(result.tableCounts['config_bosses']).toBe(0);
    });
  });

  // -------------------- catch 分支：error 非 Error 实例 --------------------

  describe('catch 分支：error 非 Error 实例时返回默认错误信息', () => {
    it('add 抛出非 Error 值时返回 success=false 及 "添加失败"', async () => {
      // Arrange：spy adminDbService.add 抛出字符串（非 Error 实例）
      const spy = vi.spyOn(adminDbService, 'add').mockRejectedValueOnce('网络异常');

      // Act
      const result = await adminService.add('config_mobs', makeMob(), 'm1');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('添加失败');

      // Cleanup
      spy.mockRestore();
    });

    it('update 抛出非 Error 值时返回 success=false 及 "更新失败"', async () => {
      // Arrange
      const spy = vi.spyOn(adminDbService, 'update').mockRejectedValueOnce('超时');

      // Act
      const result = await adminService.update<MobRecord>('config_mobs', 'm1', { name: 'x' });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('更新失败');

      // Cleanup
      spy.mockRestore();
    });

    it('delete 抛出非 Error 值时返回 success=false 及 "删除失败"', async () => {
      // Arrange
      const spy = vi.spyOn(adminDbService, 'delete').mockRejectedValueOnce('锁定');

      // Act
      const result = await adminService.delete('config_mobs', 'm1');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('删除失败');

      // Cleanup
      spy.mockRestore();
    });

    it('clear 抛出非 Error 值时返回 success=false 及 "清空失败"', async () => {
      // Arrange
      const spy = vi.spyOn(adminDbService, 'clear').mockRejectedValueOnce('权限不足');

      // Act
      const result = await adminService.clear('config_mobs');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('清空失败');

      // Cleanup
      spy.mockRestore();
    });
  });
});
