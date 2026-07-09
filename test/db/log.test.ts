/**
 * @fileoverview 冒险日志模块数据层（log/db.ts）内存级 CRUD 测试
 *
 * 使用 fake-indexeddb 在内存中真实执行 Dexie 操作，覆盖：
 *  - saveAdventureLog：写入/覆盖（put 语义）+ toRawData 去响应式
 *  - getAdventureLog：命中 / 未命中返回 null
 *  - deleteAdventureLog：删除指定角色日志，删除不存在记录不报错
 *  - clearAllAdventureLogs：批量清空
 *
 * 设计说明（遵循 code_rule「Dexie 数据库：使用 fake-indexeddb 进行内存级 CRUD 测试」红线）：
 *  - 文件顶部 `import 'fake-indexeddb/auto'` 注入 IndexedDB shim，使 Dexie 走真实代码路径
 *  - 共享全局 db 单例，beforeEach 调用 clear() 清空 runtime_adventureLogs 表，避免用例间污染
 *  - 不 mock db service，确保 where/put/get/delete/toArray 等 Dexie 调用被真实执行
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { adventureLogDbService } from '@/modules/log/db';
import { db } from '@/modules/data/core';
import type { LogEntry, AdventureLogData } from '@/modules/log/types';

// ==================== 测试数据构造 helper ====================

function makeLogEntry(o: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 'log-1',
    timestamp: 1700000000000,
    type: 'combat',
    message: '击败了敌人',
    ...o,
  } as LogEntry;
}

// ==================== 测试用例 ====================

describe('AdventureLogDbService - 冒险日志数据层（fake-indexeddb 真实 CRUD）', () => {
  beforeEach(async () => {
    // 清空表，确保每个用例从空库开始
    await db.runtime_adventureLogs.clear();
  });

  describe('saveAdventureLog：保存日志', () => {
    it('首次保存：数据被写入 DB，可被 getAdventureLog 读回', async () => {
      const logs = [makeLogEntry({ id: 'l1', message: '战斗胜利' })];
      await adventureLogDbService.saveAdventureLog('char-1', logs);

      const result = await adventureLogDbService.getAdventureLog('char-1');
      expect(result).not.toBeNull();
      expect(result!.characterId).toBe('char-1');
      expect(result!.entries).toEqual(logs);
      expect(result!.updatedAt).toBeTypeOf('number');
    });

    it('覆盖保存：相同 characterId 再次保存，新数据替换旧数据', async () => {
      const oldLogs = [makeLogEntry({ id: 'old', message: '旧日志' })];
      const newLogs = [makeLogEntry({ id: 'new', message: '新日志' })];

      await adventureLogDbService.saveAdventureLog('char-1', oldLogs);
      await adventureLogDbService.saveAdventureLog('char-1', newLogs);

      const result = await adventureLogDbService.getAdventureLog('char-1');
      expect(result!.entries).toEqual(newLogs);
      expect(result!.entries).toHaveLength(1);
      expect(result!.entries[0].id).toBe('new');
    });

    it('多角色并存：不同 characterId 各自独立存储', async () => {
      await adventureLogDbService.saveAdventureLog('char-1', [makeLogEntry({ id: 'a' })]);
      await adventureLogDbService.saveAdventureLog('char-2', [makeLogEntry({ id: 'b' })]);

      const r1 = await adventureLogDbService.getAdventureLog('char-1');
      const r2 = await adventureLogDbService.getAdventureLog('char-2');
      expect(r1!.entries[0].id).toBe('a');
      expect(r2!.entries[0].id).toBe('b');
    });

    it('空 entries 数组也可正常保存', async () => {
      await adventureLogDbService.saveAdventureLog('char-1', []);
      const result = await adventureLogDbService.getAdventureLog('char-1');
      expect(result).not.toBeNull();
      expect(result!.entries).toEqual([]);
    });
  });

  describe('getAdventureLog：读取日志', () => {
    it('角色不存在时返回 null', async () => {
      const result = await adventureLogDbService.getAdventureLog('non-existent');
      expect(result).toBeNull();
    });

    it('直接通过 Dexie 读取验证字段结构匹配 AdventureLogData', async () => {
      const logs = [makeLogEntry({ id: 'verify', timestamp: 1700000000001 })];
      await adventureLogDbService.saveAdventureLog('char-x', logs);

      // 直接通过 Dexie 表读取，验证写入的字段结构
      const raw = await db.runtime_adventureLogs.get('char-x') as unknown as AdventureLogData | undefined;
      expect(raw).toBeDefined();
      expect(raw!.characterId).toBe('char-x');
      expect(raw!.entries).toEqual(logs);
      expect(raw!.updatedAt).toBeTypeOf('number');
    });
  });

  describe('deleteAdventureLog：删除日志', () => {
    it('删除已存在的记录后，再读返回 null', async () => {
      await adventureLogDbService.saveAdventureLog('char-1', [makeLogEntry()]);
      expect(await adventureLogDbService.getAdventureLog('char-1')).not.toBeNull();

      await adventureLogDbService.deleteAdventureLog('char-1');
      expect(await adventureLogDbService.getAdventureLog('char-1')).toBeNull();
    });

    it('删除不存在的记录不抛错（Dexie delete 语义）', async () => {
      await expect(adventureLogDbService.deleteAdventureLog('non-existent')).resolves.toBeUndefined();
    });

    it('删除某角色日志不影响其他角色', async () => {
      await adventureLogDbService.saveAdventureLog('char-1', [makeLogEntry({ id: 'a' })]);
      await adventureLogDbService.saveAdventureLog('char-2', [makeLogEntry({ id: 'b' })]);

      await adventureLogDbService.deleteAdventureLog('char-1');
      expect(await adventureLogDbService.getAdventureLog('char-1')).toBeNull();
      expect(await adventureLogDbService.getAdventureLog('char-2')).not.toBeNull();
    });
  });

  describe('clearAllAdventureLogs：清空全部', () => {
    it('清空后所有角色的日志均被删除', async () => {
      await adventureLogDbService.saveAdventureLog('char-1', [makeLogEntry()]);
      await adventureLogDbService.saveAdventureLog('char-2', [makeLogEntry()]);
      await adventureLogDbService.saveAdventureLog('char-3', [makeLogEntry()]);

      await adventureLogDbService.clearAllAdventureLogs();

      expect(await adventureLogDbService.getAdventureLog('char-1')).toBeNull();
      expect(await adventureLogDbService.getAdventureLog('char-2')).toBeNull();
      expect(await adventureLogDbService.getAdventureLog('char-3')).toBeNull();
    });

    it('空库清空不抛错', async () => {
      await expect(adventureLogDbService.clearAllAdventureLogs()).resolves.toBeUndefined();
    });
  });
});
