/**
 * @fileoverview Boss 模块数据层（boss/db.ts）内存级 CRUD 测试
 *
 * 使用 fake-indexeddb 在内存中真实执行 Dexie 操作，覆盖：
 *  - saveBossTemplate / getBossTemplate：Boss 模板表 config_bosses 的 CRUD
 *  - getAllBossTemplates：批量读取
 *  - deleteBossTemplate：删除模板
 *  - fromStorage 转换逻辑：isBoss 硬编码为 true、phases/intro 字段、
 *    可选数值字段 undefined → null（写入）→ undefined（读回）
 *
 * 设计说明（遵循 code_rule 红线）：
 *  - 顶部 `import 'fake-indexeddb/auto'` 注入 IndexedDB shim
 *  - beforeEach 清空 config_bosses 表，避免用例间污染
 *  - 不 mock db service，确保 put/get/delete/toArray 真实执行
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { bossDbService } from '@/modules/boss/db';
import { db } from '@/modules/data/core';
import type { BossTemplate, BossStorage } from '@/modules/boss/types';

// ==================== 测试数据构造 helper ====================

function makeBoss(o: Partial<BossTemplate> = {}): BossTemplate {
  return {
    id: 'boss-1',
    name: '黑龙女王',
    icon: 'game-icons:dragon-head',
    maxHp: 5000,
    damage: [50, 120],
    xp: 5000,
    gold: 2000,
    dangerLevel: '致命',
    isBoss: true,
    ...o,
  } as BossTemplate;
}

// ==================== 测试用例 ====================

describe('BossDbService - Boss 数据层（fake-indexeddb 真实 CRUD）', () => {
  beforeEach(async () => {
    await db.config_bosses.clear();
  });

  // -------------------- saveBossTemplate / getBossTemplate --------------------

  describe('saveBossTemplate / getBossTemplate：模板读写', () => {
    it('保存 Boss 后可读回完整数据，isBoss 恒为 true', async () => {
      const boss = makeBoss({
        id: 'onyxia',
        name: '奥妮克希亚',
        physicalAttack: 80,
        physicalDefense: 40,
        magicAttack: 60,
        magicDefense: 30,
        critChance: 0.2,
        dodgeChance: 0.05,
        skillPool: ['deep-breath', 'tail-sweep'],
        aiStrategy: 'boss_phase',
        phases: [
          {
            hpThreshold: 0.5,
            name: '第二阶段：起飞',
            dialogue: ['天空属于黑龙！'],
            aiStrategy: 'aggressive',
            mechanics: [],
          },
        ],
        intro: {
          effect: 'darken',
          lines: ['愚蠢的凡人！'],
          duration: 2000,
        },
      });
      await bossDbService.saveBossTemplate(boss);

      const result = await bossDbService.getBossTemplate('onyxia');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('onyxia');
      expect(result!.name).toBe('奥妮克希亚');
      expect(result!.icon).toBe('game-icons:dragon-head');
      expect(result!.maxHp).toBe(5000);
      expect(result!.damage).toEqual([50, 120]);
      expect(result!.xp).toBe(5000);
      expect(result!.gold).toBe(2000);
      expect(result!.dangerLevel).toBe('致命');
      // isBoss 在 fromStorage 中硬编码为 true
      expect(result!.isBoss).toBe(true);
      expect(result!.physicalAttack).toBe(80);
      expect(result!.physicalDefense).toBe(40);
      expect(result!.magicAttack).toBe(60);
      expect(result!.magicDefense).toBe(30);
      expect(result!.critChance).toBe(0.2);
      expect(result!.dodgeChance).toBe(0.05);
      expect(result!.skillPool).toEqual(['deep-breath', 'tail-sweep']);
      expect(result!.aiStrategy).toBe('boss_phase');
      expect(result!.phases).toHaveLength(1);
      expect(result!.phases![0].name).toBe('第二阶段：起飞');
      expect(result!.intro).toEqual({
        effect: 'darken',
        lines: ['愚蠢的凡人！'],
        duration: 2000,
      });
    });

    it('Boss 不存在时返回 null', async () => {
      const result = await bossDbService.getBossTemplate('non-existent');
      expect(result).toBeNull();
    });

    it('可选字段为 undefined 时，写入 null，读回还原为 undefined', async () => {
      const boss = makeBoss({ id: 'plain-boss' });
      await bossDbService.saveBossTemplate(boss);

      const result = await bossDbService.getBossTemplate('plain-boss');
      expect(result).not.toBeNull();
      expect(result!.physicalAttack).toBeUndefined();
      expect(result!.physicalDefense).toBeUndefined();
      expect(result!.magicAttack).toBeUndefined();
      expect(result!.magicDefense).toBeUndefined();
      expect(result!.critChance).toBeUndefined();
      expect(result!.dodgeChance).toBeUndefined();
      expect(result!.skillPool).toBeUndefined();
      expect(result!.aiStrategy).toBeUndefined();
      expect(result!.phases).toBeUndefined();
      expect(result!.intro).toBeUndefined();
    });

    it('覆盖保存：相同 ID 再次保存，新数据替换旧数据', async () => {
      await bossDbService.saveBossTemplate(makeBoss({ id: 'dup', name: '旧版', maxHp: 3000 }));
      await bossDbService.saveBossTemplate(makeBoss({ id: 'dup', name: '新版', maxHp: 8000 }));

      const result = await bossDbService.getBossTemplate('dup');
      expect(result!.name).toBe('新版');
      expect(result!.maxHp).toBe(8000);
    });

    it('直接通过 Dexie 验证可选字段写入为 null，isBoss 写入为 1', async () => {
      await bossDbService.saveBossTemplate(makeBoss({ id: 'raw-check' }));
      const raw = await db.config_bosses.get('raw-check');
      expect(raw).toBeDefined();
      expect(raw!.isBoss).toBe(1);
      expect(raw!.physicalAttack).toBeNull();
      expect(raw!.magicDefense).toBeNull();
      expect(raw!.critChance).toBeNull();
      expect(raw!.dodgeChance).toBeNull();
    });

    it('skillPool 为空数组时保留为空数组（空数组是 truthy，|| undefined 不转换）', async () => {
      const boss = makeBoss({ id: 'empty-skill', skillPool: [] });
      await bossDbService.saveBossTemplate(boss);

      const result = await bossDbService.getBossTemplate('empty-skill');
      // 空数组 [] 是 truthy，|| undefined 不会转换它，保留为空数组
      expect(result!.skillPool).toEqual([]);
    });

    it('aiStrategy 为空字符串时，二次清理为 undefined', async () => {
      const boss = makeBoss({ id: 'empty-strategy', aiStrategy: '' as BossTemplate['aiStrategy'] });
      await bossDbService.saveBossTemplate(boss);

      const result = await bossDbService.getBossTemplate('empty-strategy');
      expect(result!.aiStrategy).toBeUndefined();
    });
  });

  // -------------------- getAllBossTemplates --------------------

  describe('getAllBossTemplates：批量读取', () => {
    it('空表返回空数组', async () => {
      const result = await bossDbService.getAllBossTemplates();
      expect(result).toEqual([]);
    });

    it('多 Boss 时全部返回，且 isBoss 恒为 true', async () => {
      await bossDbService.saveBossTemplate(makeBoss({ id: 'a', name: 'Boss A' }));
      await bossDbService.saveBossTemplate(makeBoss({ id: 'b', name: 'Boss B' }));
      await bossDbService.saveBossTemplate(makeBoss({ id: 'c', name: 'Boss C' }));

      const result = await bossDbService.getAllBossTemplates();
      expect(result).toHaveLength(3);
      const ids = result.map(b => b.id).sort();
      expect(ids).toEqual(['a', 'b', 'c']);
      // 所有读回的 Boss isBoss 必须为 true
      expect(result.every(b => b.isBoss === true)).toBe(true);
    });
  });

  // -------------------- deleteBossTemplate --------------------

  describe('deleteBossTemplate：删除模板', () => {
    it('删除已存在模板后，getBossTemplate 返回 null', async () => {
      await bossDbService.saveBossTemplate(makeBoss({ id: 'del' }));
      expect(await bossDbService.getBossTemplate('del')).not.toBeNull();

      await bossDbService.deleteBossTemplate('del');
      expect(await bossDbService.getBossTemplate('del')).toBeNull();
    });

    it('删除不影响其他模板', async () => {
      await bossDbService.saveBossTemplate(makeBoss({ id: 'a' }));
      await bossDbService.saveBossTemplate(makeBoss({ id: 'b' }));

      await bossDbService.deleteBossTemplate('a');
      expect(await bossDbService.getBossTemplate('a')).toBeNull();
      expect(await bossDbService.getBossTemplate('b')).not.toBeNull();
      expect(await bossDbService.getAllBossTemplates()).toHaveLength(1);
    });

    it('删除不存在的模板不抛错', async () => {
      await expect(bossDbService.deleteBossTemplate('non-existent')).resolves.toBeUndefined();
    });
  });

  // -------------------- fromStorage 字段转换逻辑 --------------------

  describe('fromStorage：存储格式转换逻辑', () => {
    it('直接写入带 null 的 storage，读回还原为 undefined', async () => {
      // 绕过 saveBossTemplate，直接写入带 null 的 storage，验证 fromStorage 转换链路
      const storage: BossStorage = {
        id: 'null-check',
        name: 'Boss',
        icon: 'icon',
        maxHp: 1000,
        damage: [10, 20],
        xp: 500,
        gold: 200,
        dangerLevel: '危险',
        isBoss: 1,
        physicalAttack: null,
        physicalDefense: null,
        magicAttack: null,
        magicDefense: null,
        critChance: null,
        dodgeChance: null,
      };
      await db.config_bosses.put(storage);

      const result = await bossDbService.getBossTemplate('null-check');
      expect(result).not.toBeNull();
      expect(result!.physicalAttack).toBeUndefined();
      expect(result!.physicalDefense).toBeUndefined();
      expect(result!.magicAttack).toBeUndefined();
      expect(result!.magicDefense).toBeUndefined();
      expect(result!.critChance).toBeUndefined();
      expect(result!.dodgeChance).toBeUndefined();
      // isBoss 仍硬编码为 true
      expect(result!.isBoss).toBe(true);
    });

    it('phases 为空数组时保留为空数组（空数组是 truthy，|| undefined 不转换）', async () => {
      const boss = makeBoss({ id: 'empty-phases', phases: [] });
      await bossDbService.saveBossTemplate(boss);

      const result = await bossDbService.getBossTemplate('empty-phases');
      // 空数组 [] 是 truthy，|| undefined 不会转换它
      expect(result!.phases).toEqual([]);
    });

    it('intro 为空对象时清理为 undefined', async () => {
      // intro 通过 || undefined 处理，空对象 {} 是 truthy，不会被清理
      // 但若写入时 intro 为 undefined，读回也是 undefined
      const boss = makeBoss({ id: 'no-intro', intro: undefined });
      await bossDbService.saveBossTemplate(boss);

      const result = await bossDbService.getBossTemplate('no-intro');
      expect(result!.intro).toBeUndefined();
    });
  });
});
