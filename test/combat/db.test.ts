/**
 * @fileoverview 战斗模块数据层（combat/db.ts）内存级 CRUD 测试
 *
 * 使用 fake-indexeddb 在内存中真实执行 Dexie 操作，覆盖：
 *  - saveCombatLog / getCombatLogs：按 combatId 索引查询并按 timestamp 排序
 *  - getAllCombatLogs：批量读取全表
 *  - deleteCombatLog：按主键删除单条
 *  - deleteCombatLogs：按 combatId 删除该战斗的全部日志
 *  - clearAllCombatLogs：清空全表
 *  - mapStorageToLogs 字段映射：string → 字面量联合类型
 *
 * 设计说明（遵循 code_rule 红线）：
 *  - 顶部 `import 'fake-indexeddb/auto'` 注入 IndexedDB shim
 *  - beforeEach 清空 runtime_combatLogs 表，避免用例间污染
 *  - 不 mock db service，确保 put/get/delete/toArray/where 真实执行
 *
 * 表结构说明：
 *  runtime_combatLogs 的 Dexie schema 为 'combatId, timestamp'，
 *  即 combatId 为主键（唯一），timestamp 为二级索引。
 *  因此同一 combatId 只能存一条记录，put 会覆盖同 combatId 的旧记录。
 *  deleteCombatLog(key) 按主键删除，deleteCombatLogs 按 combatId 查询后逐条删除。
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { combatDbService } from '@/modules/combat/db';
import { db } from '@/modules/data/core';
import type { CombatLog } from '@/modules/combat/types';

// ==================== 测试数据构造 helper ====================

function makeLog(o: Partial<CombatLog> = {}): CombatLog {
  return {
    combatId: 'combat-1',
    battleLogId: 'combat-1',
    timestamp: 1000,
    turn: 1,
    actorType: 'player',
    actorId: 'char-1',
    actorName: '玩家',
    eventType: 'combat_damage',
    targetType: 'enemy',
    targetId: 'mob-1',
    targetName: '哥布林',
    skillId: 'slash',
    skillName: '劈砍',
    damage: 30,
    heal: 0,
    isCrit: false,
    isDodge: false,
    message: '玩家对哥布林造成 30 点伤害',
    ...o,
  };
}

// ==================== 测试用例 ====================

describe('CombatDbService - 战斗数据层（fake-indexeddb 真实 CRUD）', () => {
  beforeEach(async () => {
    await db.runtime_combatLogs.clear();
  });

  // -------------------- saveCombatLog / getCombatLogs --------------------

  describe('saveCombatLog / getCombatLogs：日志读写', () => {
    it('保存日志后可按 combatId 读回完整数据', async () => {
      const log = makeLog({
        combatId: 'combat-full',
        battleLogId: 'combat-full',
        damage: 50,
        isCrit: true,
        message: '暴击！造成 50 点伤害',
      });
      await combatDbService.saveCombatLog(log);

      const result = await combatDbService.getCombatLogs('combat-full');
      expect(result).toHaveLength(1);
      expect(result[0].combatId).toBe('combat-full');
      expect(result[0].battleLogId).toBe('combat-full');
      expect(result[0].timestamp).toBe(1000);
      expect(result[0].turn).toBe(1);
      expect(result[0].actorType).toBe('player');
      expect(result[0].actorId).toBe('char-1');
      expect(result[0].actorName).toBe('玩家');
      expect(result[0].eventType).toBe('combat_damage');
      expect(result[0].targetType).toBe('enemy');
      expect(result[0].targetId).toBe('mob-1');
      expect(result[0].targetName).toBe('哥布林');
      expect(result[0].skillId).toBe('slash');
      expect(result[0].skillName).toBe('劈砍');
      expect(result[0].damage).toBe(50);
      expect(result[0].isCrit).toBe(true);
      expect(result[0].isDodge).toBe(false);
      expect(result[0].message).toBe('暴击！造成 50 点伤害');
    });

    it('combatId 不存在时 getCombatLogs 返回空数组', async () => {
      const result = await combatDbService.getCombatLogs('non-existent');
      expect(result).toEqual([]);
    });

    it('覆盖保存：相同 combatId 再次保存，新数据替换旧数据', async () => {
      // combatId 是主键，相同 combatId 的 put 会覆盖
      await combatDbService.saveCombatLog(makeLog({
        combatId: 'combat-overwrite',
        battleLogId: 'combat-overwrite',
        damage: 10,
        message: '旧记录',
      }));
      await combatDbService.saveCombatLog(makeLog({
        combatId: 'combat-overwrite',
        battleLogId: 'combat-overwrite',
        damage: 99,
        message: '新记录',
      }));

      const result = await combatDbService.getCombatLogs('combat-overwrite');
      expect(result).toHaveLength(1);
      expect(result[0].damage).toBe(99);
      expect(result[0].message).toBe('新记录');
    });

    it('多战斗并存：不同 combatId 各自独立', async () => {
      await combatDbService.saveCombatLog(makeLog({
        combatId: 'combat-a', battleLogId: 'combat-a', damage: 10,
      }));
      await combatDbService.saveCombatLog(makeLog({
        combatId: 'combat-b', battleLogId: 'combat-b', damage: 20,
      }));

      const resultA = await combatDbService.getCombatLogs('combat-a');
      const resultB = await combatDbService.getCombatLogs('combat-b');
      expect(resultA).toHaveLength(1);
      expect(resultA[0].damage).toBe(10);
      expect(resultB).toHaveLength(1);
      expect(resultB[0].damage).toBe(20);
    });

    it('可选字段缺失时正常保存与读回', async () => {
      const log: CombatLog = {
        combatId: 'combat-min',
        battleLogId: 'combat-min',
        timestamp: 500,
        turn: 1,
        actorType: 'system',
        actorId: 'system',
        actorName: '系统',
        eventType: 'combat_start',
        isCrit: false,
        isDodge: false,
        message: '战斗开始',
      };
      await combatDbService.saveCombatLog(log);

      const result = await combatDbService.getCombatLogs('combat-min');
      expect(result).toHaveLength(1);
      expect(result[0].targetType).toBeUndefined();
      expect(result[0].targetId).toBeUndefined();
      expect(result[0].skillId).toBeUndefined();
      expect(result[0].damage).toBeUndefined();
    });
  });

  // -------------------- getAllCombatLogs --------------------

  describe('getAllCombatLogs：批量读取', () => {
    it('空表返回空数组', async () => {
      const result = await combatDbService.getAllCombatLogs();
      expect(result).toEqual([]);
    });

    it('多战斗日志混合时全部返回', async () => {
      await combatDbService.saveCombatLog(makeLog({ combatId: 'c-a', battleLogId: 'c-a' }));
      await combatDbService.saveCombatLog(makeLog({ combatId: 'c-b', battleLogId: 'c-b' }));
      await combatDbService.saveCombatLog(makeLog({ combatId: 'c-c', battleLogId: 'c-c' }));

      const result = await combatDbService.getAllCombatLogs();
      expect(result).toHaveLength(3);
    });
  });

  // -------------------- deleteCombatLog --------------------

  describe('deleteCombatLog：按主键删除单条', () => {
    it('删除已存在日志后，读回不包含该条', async () => {
      await combatDbService.saveCombatLog(makeLog({
        combatId: 'combat-del', battleLogId: 'combat-del',
      }));
      expect(await combatDbService.getCombatLogs('combat-del')).toHaveLength(1);

      // deleteCombatLog 按主键（combatId）删除
      await combatDbService.deleteCombatLog('combat-del');
      expect(await combatDbService.getCombatLogs('combat-del')).toEqual([]);
    });

    it('删除不影响其他日志', async () => {
      await combatDbService.saveCombatLog(makeLog({
        combatId: 'c-a', battleLogId: 'c-a', timestamp: 100,
      }));
      await combatDbService.saveCombatLog(makeLog({
        combatId: 'c-b', battleLogId: 'c-b', timestamp: 200,
      }));

      await combatDbService.deleteCombatLog('c-a');
      expect(await combatDbService.getCombatLogs('c-a')).toEqual([]);
      const keepResult = await combatDbService.getCombatLogs('c-b');
      expect(keepResult).toHaveLength(1);
      expect(keepResult[0].combatId).toBe('c-b');
    });

    it('删除不存在的日志不抛错', async () => {
      await expect(combatDbService.deleteCombatLog('non-existent')).resolves.toBeUndefined();
    });
  });

  // -------------------- deleteCombatLogs --------------------

  describe('deleteCombatLogs：按 combatId 批量删除', () => {
    it('删除指定战斗的日志', async () => {
      await combatDbService.saveCombatLog(makeLog({
        combatId: 'combat-del', battleLogId: 'combat-del', timestamp: 100,
      }));
      await combatDbService.saveCombatLog(makeLog({
        combatId: 'combat-keep', battleLogId: 'combat-keep', timestamp: 300,
      }));

      await combatDbService.deleteCombatLogs('combat-del');

      expect(await combatDbService.getCombatLogs('combat-del')).toEqual([]);
      // 其他战斗的日志不受影响
      const keepResult = await combatDbService.getCombatLogs('combat-keep');
      expect(keepResult).toHaveLength(1);
      expect(keepResult[0].combatId).toBe('combat-keep');
    });

    it('删除不存在的 combatId 不抛错', async () => {
      await expect(combatDbService.deleteCombatLogs('non-existent')).resolves.toBeUndefined();
    });
  });

  // -------------------- clearAllCombatLogs --------------------

  describe('clearAllCombatLogs：清空全表', () => {
    it('清空后 getAllCombatLogs 返回空数组', async () => {
      await combatDbService.saveCombatLog(makeLog({ combatId: 'c-a', battleLogId: 'c-a' }));
      await combatDbService.saveCombatLog(makeLog({ combatId: 'c-b', battleLogId: 'c-b' }));
      expect(await combatDbService.getAllCombatLogs()).toHaveLength(2);

      await combatDbService.clearAllCombatLogs();
      expect(await combatDbService.getAllCombatLogs()).toEqual([]);
    });
  });

  // -------------------- mapStorageToLogs 字段映射 --------------------

  describe('mapStorageToLogs：字段类型映射', () => {
    it('actorType / eventType / targetType 从 string 正确还原为字面量类型', async () => {
      const log = makeLog({
        combatId: 'combat-type', battleLogId: 'combat-type',
        actorType: 'enemy',
        eventType: 'combat_skill_cast',
        targetType: 'player',
      });
      await combatDbService.saveCombatLog(log);

      const result = await combatDbService.getCombatLogs('combat-type');
      expect(result).toHaveLength(1);
      // 类型映射后值保持一致
      expect(result[0].actorType).toBe('enemy');
      expect(result[0].eventType).toBe('combat_skill_cast');
      expect(result[0].targetType).toBe('player');
    });

    it('system 行动者类型正常存储与读回', async () => {
      const log = makeLog({
        combatId: 'combat-sys', battleLogId: 'combat-sys',
        actorType: 'system',
        eventType: 'combat_turn_start',
        message: '第 1 回合开始',
      });
      await combatDbService.saveCombatLog(log);

      const result = await combatDbService.getCombatLogs('combat-sys');
      expect(result).toHaveLength(1);
      expect(result[0].actorType).toBe('system');
      expect(result[0].eventType).toBe('combat_turn_start');
    });
  });
});
