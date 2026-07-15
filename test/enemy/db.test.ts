/**
 * @fileoverview 普通怪物数据层（enemy/db.ts）内存级 CRUD 测试
 *
 * 使用 fake-indexeddb 在内存中真实执行 Dexie 操作，覆盖：
 *  - saveEnemyTemplate / getEnemyTemplate：怪物模板表 config_mobs 的 CRUD
 *  - getAllEnemyTemplates：批量读取
 *  - deleteEnemyTemplate：删除模板
 *  - fromStorageBase 导出函数：damage 回退、null→undefined、Number() 转换
 *
 * 设计说明（遵循 code_rule 红线）：
 *  - 顶部 `import 'fake-indexeddb/auto'` 注入 IndexedDB shim
 *  - beforeEach 清空 config_mobs 表，避免用例间污染
 *  - 不 mock db service，确保 put/get/delete/toArray 真实执行
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { enemyDbService, fromStorageBase } from '@/modules/enemy/db';
import { db } from '@/modules/data/core';
import type { EnemyData, EnemyStorage } from '@/modules/enemy/types';

// ==================== 测试数据构造 helper ====================

function makeEnemy(o: Partial<EnemyData> = {}): EnemyData {
  return {
    id: 'mob-1',
    name: '森林蜘蛛',
    icon: 'game-icons:spider',
    maxHp: 50,
    damage: [2, 5],
    xp: 30,
    gold: 15,
    dangerLevel: '普通',
    ...o,
  } as EnemyData;
}

// ==================== 测试用例 ====================

describe('EnemyDbService - 普通怪物数据层（fake-indexeddb 真实 CRUD）', () => {
  beforeEach(async () => {
    await db.config_mobs.clear();
  });

  // -------------------- saveEnemyTemplate / getEnemyTemplate --------------------

  describe('saveEnemyTemplate / getEnemyTemplate：模板读写', () => {
    it('保存怪物后可读回完整数据', async () => {
      const enemy = makeEnemy({
        id: 'spider',
        name: '森林蜘蛛',
        physicalAttack: 10,
        physicalDefense: 5,
        magicAttack: 3,
        magicDefense: 2,
        critChance: 0.1,
        dodgeChance: 0.05,
        skillPool: ['poison-bite'],
        aiStrategy: 'aggressive',
      });
      await enemyDbService.saveEnemyTemplate(enemy);

      const result = await enemyDbService.getEnemyTemplate('spider');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('spider');
      expect(result!.name).toBe('森林蜘蛛');
      expect(result!.icon).toBe('game-icons:spider');
      expect(result!.maxHp).toBe(50);
      expect(result!.damage).toEqual([2, 5]);
      expect(result!.xp).toBe(30);
      expect(result!.gold).toBe(15);
      expect(result!.dangerLevel).toBe('普通');
      expect(result!.physicalAttack).toBe(10);
      expect(result!.physicalDefense).toBe(5);
      expect(result!.magicAttack).toBe(3);
      expect(result!.magicDefense).toBe(2);
      expect(result!.critChance).toBe(0.1);
      expect(result!.dodgeChance).toBe(0.05);
      expect(result!.skillPool).toEqual(['poison-bite']);
      expect(result!.aiStrategy).toBe('aggressive');
    });

    it('怪物不存在时返回 null', async () => {
      const result = await enemyDbService.getEnemyTemplate('non-existent');
      expect(result).toBeNull();
    });

    it('可选字段为 undefined 时，写入 null，读回还原为 undefined', async () => {
      const enemy = makeEnemy({ id: 'plain' });
      await enemyDbService.saveEnemyTemplate(enemy);

      const result = await enemyDbService.getEnemyTemplate('plain');
      expect(result).not.toBeNull();
      expect(result!.physicalAttack).toBeUndefined();
      expect(result!.physicalDefense).toBeUndefined();
      expect(result!.magicAttack).toBeUndefined();
      expect(result!.magicDefense).toBeUndefined();
      expect(result!.critChance).toBeUndefined();
      expect(result!.dodgeChance).toBeUndefined();
      expect(result!.skillPool).toBeUndefined();
      expect(result!.aiStrategy).toBeUndefined();
    });

    it('覆盖保存：相同 ID 再次保存，新数据替换旧数据', async () => {
      await enemyDbService.saveEnemyTemplate(makeEnemy({ id: 'dup', name: '旧', maxHp: 50 }));
      await enemyDbService.saveEnemyTemplate(makeEnemy({ id: 'dup', name: '新', maxHp: 100 }));

      const result = await enemyDbService.getEnemyTemplate('dup');
      expect(result!.name).toBe('新');
      expect(result!.maxHp).toBe(100);
    });

    it('直接通过 Dexie 验证可选字段写入为 null', async () => {
      await enemyDbService.saveEnemyTemplate(makeEnemy({ id: 'raw-check' }));
      const raw = await db.config_mobs.get('raw-check');
      expect(raw).toBeDefined();
      expect(raw!.physicalAttack).toBeNull();
      expect(raw!.magicDefense).toBeNull();
      expect(raw!.critChance).toBeNull();
      expect(raw!.dodgeChance).toBeNull();
    });
  });

  // -------------------- getAllEnemyTemplates --------------------

  describe('getAllEnemyTemplates：批量读取', () => {
    it('空表返回空数组', async () => {
      const result = await enemyDbService.getAllEnemyTemplates();
      expect(result).toEqual([]);
    });

    it('多怪物时全部返回，且字段被 fromStorageBase 转换', async () => {
      await enemyDbService.saveEnemyTemplate(makeEnemy({ id: 'a', name: 'A' }));
      await enemyDbService.saveEnemyTemplate(makeEnemy({ id: 'b', name: 'B' }));
      await enemyDbService.saveEnemyTemplate(makeEnemy({ id: 'c', name: 'C' }));

      const result = await enemyDbService.getAllEnemyTemplates();
      expect(result).toHaveLength(3);
      const ids = result.map(e => e.id).sort();
      expect(ids).toEqual(['a', 'b', 'c']);
    });
  });

  // -------------------- deleteEnemyTemplate --------------------

  describe('deleteEnemyTemplate：删除模板', () => {
    it('删除已存在模板后，getEnemyTemplate 返回 null', async () => {
      await enemyDbService.saveEnemyTemplate(makeEnemy({ id: 'del' }));
      expect(await enemyDbService.getEnemyTemplate('del')).not.toBeNull();

      await enemyDbService.deleteEnemyTemplate('del');
      expect(await enemyDbService.getEnemyTemplate('del')).toBeNull();
    });

    it('删除不影响其他模板', async () => {
      await enemyDbService.saveEnemyTemplate(makeEnemy({ id: 'a' }));
      await enemyDbService.saveEnemyTemplate(makeEnemy({ id: 'b' }));

      await enemyDbService.deleteEnemyTemplate('a');
      expect(await enemyDbService.getEnemyTemplate('a')).toBeNull();
      expect(await enemyDbService.getEnemyTemplate('b')).not.toBeNull();
      expect(await enemyDbService.getAllEnemyTemplates()).toHaveLength(1);
    });

    it('删除不存在的模板不抛错', async () => {
      await expect(enemyDbService.deleteEnemyTemplate('non-existent')).resolves.toBeUndefined();
    });
  });

  // -------------------- fromStorageBase 导出函数 --------------------

  describe('fromStorageBase：存储格式转换逻辑', () => {
    it('damage 数组长度不足时回退为 [1, 3]', () => {
      const storage: EnemyStorage = {
        id: 'broken',
        name: '损坏数据',
        icon: 'icon',
        maxHp: 50,
        damage: [5] as unknown as [number, number],
        xp: 10,
        gold: 5,
        dangerLevel: '普通',
      };
      const result = fromStorageBase(storage);
      expect(result.damage).toEqual([1, 3]);
    });

    it('damage 为非数组时回退为 [1, 3]', () => {
      const storage = {
        id: 'broken',
        name: '损坏数据',
        icon: 'icon',
        maxHp: 50,
        damage: 'invalid' as unknown as [number, number],
        xp: 10,
        gold: 5,
        dangerLevel: '普通',
      } as EnemyStorage;
      const result = fromStorageBase(storage);
      expect(result.damage).toEqual([1, 3]);
    });

    it('null 字段还原为 undefined', () => {
      const storage: EnemyStorage = {
        id: 'mob',
        name: '怪物',
        icon: 'icon',
        maxHp: 50,
        damage: [1, 3],
        xp: 10,
        gold: 5,
        dangerLevel: '普通',
        physicalAttack: null,
        physicalDefense: null,
        magicAttack: null,
        magicDefense: null,
        critChance: null,
        dodgeChance: null,
      };
      const result = fromStorageBase(storage);
      expect(result.physicalAttack).toBeUndefined();
      expect(result.physicalDefense).toBeUndefined();
      expect(result.magicAttack).toBeUndefined();
      expect(result.magicDefense).toBeUndefined();
      expect(result.critChance).toBeUndefined();
      expect(result.dodgeChance).toBeUndefined();
    });

    it('数值字段通过 Number() 转换（字符串数字转为数值）', () => {
      const storage = {
        id: 'mob',
        name: '怪物',
        icon: 'icon',
        maxHp: '100' as unknown as number,
        damage: ['2', '8'] as unknown as [number, number],
        xp: '50' as unknown as number,
        gold: '25' as unknown as number,
        dangerLevel: '普通',
        physicalAttack: '15' as unknown as number | null,
      } as EnemyStorage;
      const result = fromStorageBase(storage);
      expect(result.maxHp).toBe(100);
      expect(result.damage).toEqual([2, 8]);
      expect(result.xp).toBe(50);
      expect(result.gold).toBe(25);
      expect(result.physicalAttack).toBe(15);
    });

    it('maxHp 转换失败时回退为默认值 10', () => {
      const storage = {
        id: 'mob',
        name: '怪物',
        icon: 'icon',
        maxHp: 'invalid' as unknown as number,
        damage: [1, 3],
        xp: 10,
        gold: 5,
        dangerLevel: '普通',
      } as EnemyStorage;
      const result = fromStorageBase(storage);
      expect(result.maxHp).toBe(10);
    });

    it('xp/gold 转换失败时回退为 0', () => {
      const storage = {
        id: 'mob',
        name: '怪物',
        icon: 'icon',
        maxHp: 50,
        damage: [1, 3],
        xp: 'invalid' as unknown as number,
        gold: 'invalid' as unknown as number,
        dangerLevel: '普通',
      } as EnemyStorage;
      const result = fromStorageBase(storage);
      expect(result.xp).toBe(0);
      expect(result.gold).toBe(0);
    });

    it('dangerLevel 为空字符串时回退为"普通"', () => {
      const storage = {
        id: 'mob',
        name: '怪物',
        icon: 'icon',
        maxHp: 50,
        damage: [1, 3],
        xp: 10,
        gold: 5,
        dangerLevel: '' as EnemyData['dangerLevel'],
      } as EnemyStorage;
      const result = fromStorageBase(storage);
      expect(result.dangerLevel).toBe('普通');
    });

    it('aiStrategy 字符串断言为 AiStrategyType', () => {
      const storage: EnemyStorage = {
        id: 'mob',
        name: '怪物',
        icon: 'icon',
        maxHp: 50,
        damage: [1, 3],
        xp: 10,
        gold: 5,
        dangerLevel: '普通',
        aiStrategy: 'defensive',
      };
      const result = fromStorageBase(storage);
      expect(result.aiStrategy).toBe('defensive');
    });

    it('正常数据完整转换', () => {
      const storage: EnemyStorage = {
        id: 'goblin',
        name: '哥布林',
        icon: 'game-icons:goblin',
        maxHp: 80,
        damage: [3, 7],
        xp: 40,
        gold: 20,
        dangerLevel: '困难',
        physicalAttack: 12,
        magicDefense: 3,
        critChance: 0.15,
        skillPool: ['slash', 'taunt'],
        aiStrategy: 'balanced',
      };
      const result = fromStorageBase(storage);
      expect(result.id).toBe('goblin');
      expect(result.name).toBe('哥布林');
      expect(result.maxHp).toBe(80);
      expect(result.damage).toEqual([3, 7]);
      expect(result.xp).toBe(40);
      expect(result.gold).toBe(20);
      expect(result.dangerLevel).toBe('困难');
      expect(result.physicalAttack).toBe(12);
      expect(result.magicDefense).toBe(3);
      expect(result.critChance).toBe(0.15);
      expect(result.skillPool).toEqual(['slash', 'taunt']);
      expect(result.aiStrategy).toBe('balanced');
    });
  });
});
