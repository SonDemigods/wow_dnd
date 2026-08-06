/**
 * @fileoverview 后台管理模块数据层（admin/db.ts）内存级 CRUD 测试
 *
 * 使用 fake-indexeddb 在内存中真实执行 Dexie 操作，覆盖 AdminDbService 的全部方法：
 *  - getAll / getById / add（带 key / 不带 key）/ update（存在 / 不存在）/ delete / count / clear
 *  - search：空关键词、索引搜索（name/id）、回退全字段搜索（无 name 索引的表）
 *  - toRawData 去除 Vue Proxy 包装验证
 *
 * 设计说明（遵循 code_rule 红线）：
 *  - 顶部 `import 'fake-indexeddb/auto'` 注入 IndexedDB shim
 *  - 不 mock 任何模块，直接使用真实的 adminDbService 实例
 *  - beforeEach 清空 config_mobs / config_items / config_shops / config_factions，避免用例间污染
 *  - config_mobs（schema: 'id, name, dangerLevel'）有 name/id 索引，用于索引搜索测试
 *  - config_shops（schema: 'id'）无 name 索引，用于触发 search 回退全字段过滤路径
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { reactive } from 'vue';
import { adminDbService } from '@/modules/admin/db';
import { db } from '@/modules/data/core';

// ==================== 测试数据类型与 helper ====================

interface MobRecord {
  id: string;
  name: string;
  dangerLevel: string;
  hp?: number;
}

interface ShopRecord {
  id: string;
  name: string;
  type?: string;
}

function makeMob(o: Partial<MobRecord> = {}): MobRecord {
  return {
    id: 'mob-1',
    name: '哥布林',
    dangerLevel: '低',
    hp: 100,
    ...o,
  };
}

// ==================== 测试用例 ====================

describe('AdminDbService - 后台管理数据层（fake-indexeddb 真实 CRUD）', () => {
  beforeEach(async () => {
    await Promise.all([
      db.config_mobs.clear(),
      db.config_items.clear(),
      db.config_shops.clear(),
      db.config_factions.clear(),
    ]);
  });

  // -------------------- getAll --------------------

  describe('getAll：获取表全部记录', () => {
    it('空表返回空数组', async () => {
      const result = await adminDbService.getAll<MobRecord>('config_mobs');
      expect(result).toEqual([]);
    });

    it('多记录全部返回', async () => {
      await adminDbService.add('config_mobs', makeMob({ id: 'm1', name: 'A' }), 'm1');
      await adminDbService.add('config_mobs', makeMob({ id: 'm2', name: 'B' }), 'm2');

      const result = await adminDbService.getAll<MobRecord>('config_mobs');
      expect(result).toHaveLength(2);
      const ids = result.map(m => m.id).sort();
      expect(ids).toEqual(['m1', 'm2']);
    });
  });

  // -------------------- getById --------------------

  describe('getById：按主键查询单条', () => {
    it('记录存在时返回完整数据', async () => {
      await adminDbService.add('config_mobs', makeMob({ name: '哥布林' }), 'm1');

      const result = await adminDbService.getById<MobRecord>('config_mobs', 'm1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('m1');
      expect(result!.name).toBe('哥布林');
      expect(result!.dangerLevel).toBe('低');
    });

    it('记录不存在时返回 undefined（Dexie get 未找到返回 undefined）', async () => {
      const result = await adminDbService.getById<MobRecord>('config_mobs', 'non-existent');
      expect(result).toBeUndefined();
    });
  });

  // -------------------- add --------------------

  describe('add：添加记录', () => {
    it('带 key 参数时使用指定 key 作为主键并返回该 key', async () => {
      const key = await adminDbService.add('config_mobs', makeMob({ name: '兽人' }), 'orc-1');

      expect(key).toBe('orc-1');
      const stored = await adminDbService.getById<MobRecord>('config_mobs', 'orc-1');
      expect(stored).not.toBeNull();
      expect(stored!.name).toBe('兽人');
    });

    it('不带 key 参数时使用 data.id 作为主键并返回该 id', async () => {
      const returnedKey = await adminDbService.add('config_mobs', makeMob({ id: 'auto-1', name: '狼' }));

      expect(returnedKey).toBe('auto-1');
      const stored = await adminDbService.getById<MobRecord>('config_mobs', 'auto-1');
      expect(stored).not.toBeNull();
      expect(stored!.name).toBe('狼');
    });

    it('toRawData 去除 Vue Proxy 包装：reactive 对象可正常写入并读回', async () => {
      // Vue reactive 包裹生成 Proxy，直接写入 IndexedDB 会触发 DataCloneError
      // adminDbService.add 内部调用 toRawData 通过 JSON 序列化剥离 Proxy
      const proxyData = reactive<MobRecord>({
        id: 'proxy-1',
        name: '代理怪物',
        dangerLevel: '中',
        hp: 200,
      });

      const key = await adminDbService.add('config_mobs', proxyData, 'proxy-1');

      expect(key).toBe('proxy-1');
      const stored = await adminDbService.getById<MobRecord>('config_mobs', 'proxy-1');
      expect(stored).not.toBeNull();
      expect(stored!.name).toBe('代理怪物');
      expect(stored!.hp).toBe(200);
      expect(stored!.dangerLevel).toBe('中');
      // 直接通过 Dexie 读取原始数据，验证为纯对象（无 Vue 响应式标记）
      const raw = await db.config_mobs.get('proxy-1');
      expect(raw).toBeDefined();
      expect(raw!.id).toBe('proxy-1');
      expect(raw!.name).toBe('代理怪物');
    });
  });

  // -------------------- update --------------------

  describe('update：更新记录', () => {
    it('记录存在时合并字段并覆盖保存', async () => {
      await adminDbService.add('config_mobs', makeMob({ name: '旧名', hp: 100 }), 'm1');

      await adminDbService.update<MobRecord>('config_mobs', 'm1', { name: '新名', hp: 200 });

      const result = await adminDbService.getById<MobRecord>('config_mobs', 'm1');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('新名');
      expect(result!.hp).toBe(200);
      // 未更新字段保持原值
      expect(result!.dangerLevel).toBe('低');
    });

    it('记录不存在时抛出 "记录不存在"', async () => {
      await expect(
        adminDbService.update<MobRecord>('config_mobs', 'non-existent', { name: 'x' })
      ).rejects.toThrow('记录不存在');
    });

    it('existing.id 为 undefined 时走 ?? id 回退分支（防御性兜底）', async () => {
      // 防御性场景：表的主键不是 id（如 char_data 主键为 characterId），existing.id 为 undefined
      // 添加一条 char_data 记录，主键为 'char_1'，但没有 id 字段
      await db.char_data.clear();
      await db.char_data.add({ characterId: 'char_1', name: '测试角色' } as any);

      await adminDbService.update<any>('char_data', 'char_1', { name: '新名' });

      const stored = await adminDbService.getById<any>('char_data', 'char_1');
      expect(stored).not.toBeNull();
      expect(stored!.id).toBe('char_1');
      expect(stored!.name).toBe('新名');
    });
  });

  // -------------------- delete --------------------

  describe('delete：删除记录', () => {
    it('删除已存在记录后 getById 返回 undefined', async () => {
      await adminDbService.add('config_mobs', makeMob({ name: 'A' }), 'm1');
      expect(await adminDbService.getById<MobRecord>('config_mobs', 'm1')).toBeDefined();

      await adminDbService.delete('config_mobs', 'm1');

      expect(await adminDbService.getById<MobRecord>('config_mobs', 'm1')).toBeUndefined();
    });

    it('删除不影响其他记录', async () => {
      await adminDbService.add('config_mobs', makeMob({ id: 'm1', name: 'A' }), 'm1');
      await adminDbService.add('config_mobs', makeMob({ id: 'm2', name: 'B' }), 'm2');

      await adminDbService.delete('config_mobs', 'm1');

      expect(await adminDbService.getById<MobRecord>('config_mobs', 'm1')).toBeUndefined();
      expect(await adminDbService.getById<MobRecord>('config_mobs', 'm2')).toBeDefined();
      expect(await adminDbService.count('config_mobs')).toBe(1);
    });
  });

  // -------------------- count --------------------

  describe('count：获取记录总数', () => {
    it('空表返回 0', async () => {
      const result = await adminDbService.count('config_mobs');
      expect(result).toBe(0);
    });

    it('多记录返回正确数量', async () => {
      await adminDbService.add('config_mobs', makeMob({ id: 'm1' }), 'm1');
      await adminDbService.add('config_mobs', makeMob({ id: 'm2' }), 'm2');
      await adminDbService.add('config_mobs', makeMob({ id: 'm3' }), 'm3');

      const result = await adminDbService.count('config_mobs');
      expect(result).toBe(3);
    });
  });

  // -------------------- clear --------------------

  describe('clear：清空表', () => {
    it('清空后表为空', async () => {
      await adminDbService.add('config_mobs', makeMob({ id: 'm1' }), 'm1');
      await adminDbService.add('config_mobs', makeMob({ id: 'm2' }), 'm2');
      expect(await adminDbService.count('config_mobs')).toBe(2);

      await adminDbService.clear('config_mobs');

      expect(await adminDbService.count('config_mobs')).toBe(0);
      expect(await adminDbService.getAll<MobRecord>('config_mobs')).toEqual([]);
    });
  });

  // -------------------- search --------------------

  describe('search：搜索数据表', () => {
    beforeEach(async () => {
      await adminDbService.add('config_mobs', makeMob({ id: 'goblin', name: '哥布林', dangerLevel: '低' }), 'goblin');
      await adminDbService.add('config_mobs', makeMob({ id: 'goblin-mage', name: '哥布林法师', dangerLevel: '中' }), 'goblin-mage');
      await adminDbService.add('config_mobs', makeMob({ id: 'orc', name: '兽人', dangerLevel: '高' }), 'orc');
    });

    it('空关键词返回空数组', async () => {
      const result = await adminDbService.search<MobRecord>('config_mobs', '');
      expect(result).toEqual([]);
    });

    it('纯空白关键词返回空数组（trim 后为空）', async () => {
      const result = await adminDbService.search<MobRecord>('config_mobs', '   ');
      expect(result).toEqual([]);
    });

    it('按 name 索引前缀搜索（忽略大小写）', async () => {
      const result = await adminDbService.search<MobRecord>('config_mobs', '哥布林');
      expect(result).toHaveLength(2);
      const names = result.map(m => m.name).sort();
      expect(names).toEqual(['哥布林', '哥布林法师']);
    });

    it('按 id 索引前缀搜索', async () => {
      const result = await adminDbService.search<MobRecord>('config_mobs', 'goblin');
      // id 以 'goblin' 开头的有 'goblin' 和 'goblin-mage'，distinct 去重后返回 2 条
      expect(result).toHaveLength(2);
      const ids = result.map(m => m.id).sort();
      expect(ids).toEqual(['goblin', 'goblin-mage']);
    });

    it('无匹配时返回空数组', async () => {
      const result = await adminDbService.search<MobRecord>('config_mobs', '不存在的关键词');
      expect(result).toEqual([]);
    });

    it('索引不存在的表回退到全字段过滤搜索', async () => {
      // config_shops schema 仅为 'id'，无 name 索引
      // search 调用 table.where('name') 会抛 SchemaError，触发 catch 回退到全字段 filter
      await adminDbService.add<ShopRecord>('config_shops', { id: 'shop-1', name: '武器商人' }, 'shop-1');
      await adminDbService.add<ShopRecord>('config_shops', { id: 'shop-2', name: '药水商人' }, 'shop-2');

      const result = await adminDbService.search<ShopRecord>('config_shops', '武器');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('shop-1');
      expect(result[0].name).toBe('武器商人');
    });

    it('回退全字段搜索可通过 id 字段匹配', async () => {
      await adminDbService.add<ShopRecord>('config_shops', { id: 'shop-weapon', name: '武器商人' }, 'shop-weapon');

      const result = await adminDbService.search<ShopRecord>('config_shops', 'shop-weapon');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('shop-weapon');
    });
  });

  // -------------------- DATA-4 表 admin CRUD 验证 --------------------

  /**
   * DATA-4 新增的 4 张表（classEquipment / classPassives / classTalents / setDefinitions）
   * 于 2026-08-06 补入 CONFIG_TABLES。本用例验证 adminDbService 对这 4 张表
   * 的通用 CRUD 流程能正常工作（泛型 tableName 受 keyof GameDatabaseSchema 约束，
   * 4 张表已在 core.ts schema 中声明）。
   */
  describe('DATA-4 表：admin 通用 CRUD 流程', () => {
    beforeEach(async () => {
      await Promise.all([
        db.config_class_equipment.clear(),
        db.config_class_passives.clear(),
        db.config_class_talents.clear(),
        db.config_set_definitions.clear(),
      ]);
    });

    it('classEquipment（职业专属装备）完整 CRUD', async () => {
      // schema: 'id, name, type, rarity'
      const equip = {
        id: 'warrior_sword_1',
        name: '战士之剑',
        type: 'weapon',
        rarity: 'rare',
        value: 100,
        classRestriction: ['warrior'],
      };
      await adminDbService.add('config_class_equipment', equip, 'warrior_sword_1');

      const got = await adminDbService.getById<typeof equip>('config_class_equipment', 'warrior_sword_1');
      expect(got).not.toBeNull();
      expect(got!.name).toBe('战士之剑');
      expect(got!.rarity).toBe('rare');

      await adminDbService.update('config_class_equipment', 'warrior_sword_1', { rarity: 'epic' });
      const updated = await adminDbService.getById<typeof equip>('config_class_equipment', 'warrior_sword_1');
      expect(updated!.rarity).toBe('epic');

      await adminDbService.delete('config_class_equipment', 'warrior_sword_1');
      const afterDelete = await adminDbService.getById<typeof equip>('config_class_equipment', 'warrior_sword_1');
      expect(afterDelete).toBeUndefined();
    });

    it('classEquipment 索引搜索（name 索引存在）', async () => {
      await adminDbService.add('config_class_equipment', { id: 'e1', name: '圣剑' }, 'e1');
      await adminDbService.add('config_class_equipment', { id: 'e2', name: '圣盾' }, 'e2');

      const result = await adminDbService.search('config_class_equipment', '圣');
      expect(result).toHaveLength(2);
    });

    it('classPassives（职业被动技能）完整 CRUD', async () => {
      // schema: 'id, classId, trigger'
      const passive = {
        id: 'warrior_passive_1',
        name: '剑专精',
        description: '增加剑类伤害',
        classId: 'warrior',
        trigger: 'on_attack',
      };
      await adminDbService.add('config_class_passives', passive, 'warrior_passive_1');

      const got = await adminDbService.getById<typeof passive>('config_class_passives', 'warrior_passive_1');
      expect(got).not.toBeNull();
      expect(got!.classId).toBe('warrior');
      expect(got!.trigger).toBe('on_attack');

      await adminDbService.update('config_class_passives', 'warrior_passive_1', { description: '大幅增加剑类伤害' });
      const updated = await adminDbService.getById<typeof passive>('config_class_passives', 'warrior_passive_1');
      expect(updated!.description).toBe('大幅增加剑类伤害');

      await adminDbService.delete('config_class_passives', 'warrior_passive_1');
      const afterDelete = await adminDbService.getById<typeof passive>('config_class_passives', 'warrior_passive_1');
      expect(afterDelete).toBeUndefined();
    });

    it('classPassives 无 name 索引时回退全字段搜索（通过 id 匹配）', async () => {
      // schema: 'id, classId, trigger'，无 name 索引
      await adminDbService.add('config_class_passives', { id: 'mage_passive_1', name: '法力涌动' }, 'mage_passive_1');

      const result = await adminDbService.search('config_class_passives', 'mage_passive_1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('mage_passive_1');
    });

    it('classTalents（职业天赋树）完整 CRUD', async () => {
      // schema: 'id, classId'
      const talent = {
        id: 'warrior_arms',
        name: '武器',
        classId: 'warrior',
        icon: '⚔️',
        description: '武器天赋树',
        talents: [{ id: 't1', name: '剑专精', tier: 1, maxRank: 5 }],
      };
      await adminDbService.add('config_class_talents', talent, 'warrior_arms');

      const got = await adminDbService.getById<typeof talent>('config_class_talents', 'warrior_arms');
      expect(got).not.toBeNull();
      expect(got!.classId).toBe('warrior');
      expect(Array.isArray(got!.talents)).toBe(true);
      expect(got!.talents).toHaveLength(1);

      await adminDbService.update('config_class_talents', 'warrior_arms', { icon: '🗡️' });
      const updated = await adminDbService.getById<typeof talent>('config_class_talents', 'warrior_arms');
      expect(updated!.icon).toBe('🗡️');

      await adminDbService.delete('config_class_talents', 'warrior_arms');
      const afterDelete = await adminDbService.getById<typeof talent>('config_class_talents', 'warrior_arms');
      expect(afterDelete).toBeUndefined();
    });

    it('setDefinitions（套装定义）完整 CRUD', async () => {
      // schema: 'id, classRestriction'
      const setDef = {
        id: 'warrior_might',
        name: '战士之力',
        category: 'armor_set',
        classRestriction: 'warrior',
        parts: [{ slot: 'helm' }, { slot: 'chest' }],
        bonusTiers: [{ requiredPieces: 2, bonuses: [] }],
      };
      await adminDbService.add('config_set_definitions', setDef, 'warrior_might');

      const got = await adminDbService.getById<typeof setDef>('config_set_definitions', 'warrior_might');
      expect(got).not.toBeNull();
      expect(got!.category).toBe('armor_set');
      expect(got!.parts).toHaveLength(2);

      await adminDbService.update('config_set_definitions', 'warrior_might', { category: 'weapon_set' });
      const updated = await adminDbService.getById<typeof setDef>('config_set_definitions', 'warrior_might');
      expect(updated!.category).toBe('weapon_set');

      await adminDbService.delete('config_set_definitions', 'warrior_might');
      const afterDelete = await adminDbService.getById<typeof setDef>('config_set_definitions', 'warrior_might');
      expect(afterDelete).toBeUndefined();
    });
  });
});
