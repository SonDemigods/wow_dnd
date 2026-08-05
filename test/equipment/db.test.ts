/**
 * @fileoverview 装备模块数据层（equipment/db.ts）内存级 CRUD 测试
 *
 * 使用 fake-indexeddb 在内存中真实执行 Dexie 操作，覆盖：
 *  - saveEquipment / getEquipment / deleteEquipment：装备表 char_equipment 的 CRUD
 *  - saveEquipmentTemplate / getEquipmentTemplate / getAllEquipmentTemplates / deleteEquipmentTemplate：
 *    装备模板表 config_equipmentItems 的 CRUD + mapTemplateToEquipmentItem 字段映射
 *  - 空数据兜底：getEquipment 角色不存在时返回全 null 的默认槽位映射
 *
 * 设计说明（遵循 code_rule 红线）：
 *  - 顶部 `import 'fake-indexeddb/auto'` 注入 IndexedDB shim
 *  - beforeEach 清空 char_equipment 与 config_equipmentItems 两张表
 *  - 不 mock db service，确保 put/get/delete/toArray 真实执行
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { equipmentDbService } from '@/modules/equipment/db';
import { db } from '@/modules/data/core';
import { createEmptySlotMap } from '@/modules/equipment/service';
import type { EquipmentItem, EquipmentSlot } from '@/modules/equipment/types';

// ==================== 测试数据构造 helper ====================

function makeEquipmentItem(o: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: 'eq-1',
    name: '铁剑',
    // P3.3：判别联合字面量（装备恒为 kind='equipment'，非消耗品）
    kind: 'equipment',
    subtype: 'sword',
    grip: 'one_handed',
    rarity: 'common',
    icon: 'game-icons:sword',
    description: '一把普通的铁剑',
    value: 50,
    stackable: false,
    consumable: false,
    slots: ['weapon1'],
    occupies: ['weapon1'],
    bonus: { str: 3 },
    levelRequirement: 1,
    capabilities: ['describable', 'equippable', 'sellable', 'enchantable'],
    ...o,
  } as EquipmentItem;
}

function makeEmptyEquipment(): Record<EquipmentSlot, string | null> {
  return createEmptySlotMap<string | null>(null);
}

// ==================== 测试用例 ====================

describe('EquipmentDbService - 装备数据层（fake-indexeddb 真实 CRUD）', () => {
  beforeEach(async () => {
    await Promise.all([
      db.char_equipment.clear(),
      db.config_equipmentItems.clear(),
    ]);
  });

  // -------------------- char_equipment 表 --------------------

  describe('saveEquipment / getEquipment：装备槽位读写', () => {
    it('保存装备后可读回完整槽位映射', async () => {
      const equipment: Record<EquipmentSlot, string | null> = {
        ...makeEmptyEquipment(),
        weapon1: 'sword-1',
        helm: 'helmet-1',
      };
      await equipmentDbService.saveEquipment('char-1', equipment);

      const result = await equipmentDbService.getEquipment('char-1');
      expect(result).toEqual(equipment);
      expect(result.weapon1).toBe('sword-1');
      expect(result.helm).toBe('helmet-1');
      expect(result.weapon2).toBeNull();
      expect(result.boots).toBeNull();
    });

    it('角色不存在时 getEquipment 返回默认全 null 槽位映射（不返回 null）', async () => {
      const result = await equipmentDbService.getEquipment('non-existent');
      expect(result).toEqual(makeEmptyEquipment());
      expect(Object.keys(result)).toHaveLength(7);
      expect(result.weapon1).toBeNull();
      expect(result.boots).toBeNull();
    });

    it('覆盖保存：相同 characterId 再次保存，新数据替换旧数据', async () => {
      const eq1 = { ...makeEmptyEquipment(), weapon1: 'old-sword' };
      const eq2 = { ...makeEmptyEquipment(), weapon1: 'new-sword' };
      await equipmentDbService.saveEquipment('char-1', eq1);
      await equipmentDbService.saveEquipment('char-1', eq2);

      const result = await equipmentDbService.getEquipment('char-1');
      expect(result.weapon1).toBe('new-sword');
    });

    it('多角色并存：不同 characterId 各自独立', async () => {
      await equipmentDbService.saveEquipment('char-1', { ...makeEmptyEquipment(), weapon1: 'a' });
      await equipmentDbService.saveEquipment('char-2', { ...makeEmptyEquipment(), weapon1: 'b' });

      expect((await equipmentDbService.getEquipment('char-1')).weapon1).toBe('a');
      expect((await equipmentDbService.getEquipment('char-2')).weapon1).toBe('b');
    });

    it('直接通过 Dexie 验证写入字段含 updatedAt 时间戳', async () => {
      await equipmentDbService.saveEquipment('char-1', { ...makeEmptyEquipment(), weapon1: 'w' });
      const raw = await db.char_equipment.get('char-1');
      expect(raw).toBeDefined();
      expect(raw!.characterId).toBe('char-1');
      expect(raw!.updatedAt).toBeTypeOf('number');
      expect(raw!.equipment.weapon1).toBe('w');
    });

    it('data.equipment 不是对象时返回默认全 null 槽位映射（类型守卫兜底）', async () => {
      // 直接写入损坏的数据（equipment 字段为字符串）
      await db.char_equipment.put({
        characterId: 'corrupt-str',
        equipment: 'not-an-object' as unknown as Record<EquipmentSlot, string | null>,
        updatedAt: Date.now()
      });
      const result = await equipmentDbService.getEquipment('corrupt-str');
      expect(result).toEqual(makeEmptyEquipment());
    });

    it('data.equipment 为 null 时返回默认全 null 槽位映射', async () => {
      await db.char_equipment.put({
        characterId: 'corrupt-null',
        equipment: null as unknown as Record<EquipmentSlot, string | null>,
        updatedAt: Date.now()
      });
      const result = await equipmentDbService.getEquipment('corrupt-null');
      expect(result).toEqual(makeEmptyEquipment());
    });
  });

  describe('deleteEquipment：删除装备', () => {
    it('删除已存在记录后，再读返回默认全 null 映射', async () => {
      await equipmentDbService.saveEquipment('char-1', { ...makeEmptyEquipment(), weapon1: 'w' });
      expect((await equipmentDbService.getEquipment('char-1')).weapon1).toBe('w');

      await equipmentDbService.deleteEquipment('char-1');
      expect(await equipmentDbService.getEquipment('char-1')).toEqual(makeEmptyEquipment());
    });

    it('删除不影响其他角色', async () => {
      await equipmentDbService.saveEquipment('char-1', { ...makeEmptyEquipment(), weapon1: 'a' });
      await equipmentDbService.saveEquipment('char-2', { ...makeEmptyEquipment(), weapon1: 'b' });

      await equipmentDbService.deleteEquipment('char-1');
      expect((await equipmentDbService.getEquipment('char-1')).weapon1).toBeNull();
      expect((await equipmentDbService.getEquipment('char-2')).weapon1).toBe('b');
    });

    it('删除不存在的记录不抛错', async () => {
      await expect(equipmentDbService.deleteEquipment('non-existent')).resolves.toBeUndefined();
    });
  });

  // -------------------- config_equipmentItems 表 --------------------

  describe('saveEquipmentTemplate / getEquipmentTemplate：模板读写与字段映射', () => {
    it('保存模板后可读回，字段类型被 mapTemplateToEquipmentItem 正确转换', async () => {
      const item = makeEquipmentItem({
        id: 'iron-sword',
        name: '铁剑',
        subtype: 'sword',
        rarity: 'common',
        bonus: { str: 5, dex: 2 },
        slots: ['weapon1', 'weapon2'],
        levelRequirement: 5,
        stackable: false,
      });
      await equipmentDbService.saveEquipmentTemplate(item);

      const result = await equipmentDbService.getEquipmentTemplate('iron-sword');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('iron-sword');
      expect(result!.name).toBe('铁剑');
      // P3.3：旧 type 字段已删除，改为 kind='equipment' + subtype='sword'
      expect(result!.kind).toBe('equipment');
      expect(result!.subtype).toBe('sword');
      expect(result!.grip).toBe('one_handed');
      expect(result!.consumable).toBe(false);
      expect(result!.rarity).toBe('common');
      expect(result!.icon).toBe('game-icons:sword');
      expect(result!.description).toBe('一把普通的铁剑');
      expect(result!.bonus).toEqual({ str: 5, dex: 2 });
      expect(result!.value).toBe(50);
      // P3.1：slots 始终由 subtype='sword' 派生为 ['weapon1','weapon2']，忽略输入 slots
      expect(result!.slots).toEqual(['weapon1', 'weapon2']);
      expect(result!.occupies).toEqual(['weapon1']);
      expect(result!.levelRequirement).toBe(5);
      expect(result!.stackable).toBe(false);
    });

    it('装备不存在时 getEquipmentTemplate 返回 null', async () => {
      const result = await equipmentDbService.getEquipmentTemplate('non-existent');
      expect(result).toBeNull();
    });

    it('可选字段缺失时使用默认值（bonus={}、levelRequirement=undefined、stackable=false、template=undefined）', async () => {
      const item: EquipmentItem = {
        id: 'plain',
        name: '普通装备',
        kind: 'equipment',
        subtype: 'chest',
        grip: undefined,
        rarity: 'common',
        icon: 'icon',
        description: '',
        value: 0,
        stackable: false,
        consumable: false,
        slots: ['chest'],
        occupies: ['chest'],
        capabilities: ['describable', 'equippable', 'sellable', 'enchantable'],
      };
      await equipmentDbService.saveEquipmentTemplate(item);

      const result = await equipmentDbService.getEquipmentTemplate('plain');
      expect(result).not.toBeNull();
      expect(result!.bonus).toEqual({});
      expect(result!.levelRequirement).toBeUndefined();
      expect(result!.stackable).toBe(false);
      expect(result!.template).toBeUndefined();
    });

    it('levelRequirement=0 时存储为 null，读回为 undefined（用 || 而非 ??，0 被视为 falsy）', async () => {
      const item = makeEquipmentItem({ id: 'zero-req', levelRequirement: 0 });
      await equipmentDbService.saveEquipmentTemplate(item);

      const result = await equipmentDbService.getEquipmentTemplate('zero-req');
      expect(result!.levelRequirement).toBeUndefined();
    });

    it('bonus 为 null 时 mapTemplateToEquipmentItem 返回空对象（|| 兜底分支）', async () => {
      // 直接写入 bonus 为 null 的损坏数据，验证 || {} 兜底
      await db.config_equipmentItems.put({
        id: 'null-bonus',
        name: '无加成装备',
        type: 'weapon',
        rarity: 'common',
        icon: 'icon',
        description: '',
        bonus: null as unknown as Record<string, number>,
        value: 0,
        slots: ['weapon1'],
        levelRequirement: null,
        stackable: false,
        template: '',
        capabilities: ['describable', 'equippable', 'sellable', 'enchantable'],
      });
      const result = await equipmentDbService.getEquipmentTemplate('null-bonus');
      expect(result).not.toBeNull();
      expect(result!.bonus).toEqual({});
    });

    it('DB slots 字段损坏时由 subtype 派生 slots（P3.1：slots 始终由 subtype 派生，忽略 DB slots）', async () => {
      // 直接写入 slots 为非数组的损坏数据，验证 slots 由 subtype 派生而非读 DB
      await db.config_equipmentItems.put({
        id: 'bad-slots',
        name: '损坏槽位装备',
        type: 'weapon',
        subtype: 'sword',
        rarity: 'common',
        icon: 'icon',
        description: '',
        bonus: { str: 1 },
        value: 0,
        slots: 'not-an-array' as unknown as string[],
        levelRequirement: null,
        stackable: false,
        template: '',
        capabilities: ['describable', 'equippable', 'sellable', 'enchantable'],
      });
      const result = await equipmentDbService.getEquipmentTemplate('bad-slots');
      expect(result).not.toBeNull();
      // slots 由 subtype='sword' 派生为 ['weapon1','weapon2']，忽略损坏的 DB slots
      expect(result!.slots).toEqual(['weapon1', 'weapon2']);
    });

    it('覆盖保存：相同 ID 再次保存，新数据替换旧数据', async () => {
      await equipmentDbService.saveEquipmentTemplate(makeEquipmentItem({ id: 'dup', name: '旧' }));
      await equipmentDbService.saveEquipmentTemplate(makeEquipmentItem({ id: 'dup', name: '新' }));

      const result = await equipmentDbService.getEquipmentTemplate('dup');
      expect(result!.name).toBe('新');
    });
  });

  describe('getAllEquipmentTemplates：批量读取', () => {
    it('空表返回空数组', async () => {
      const result = await equipmentDbService.getAllEquipmentTemplates();
      expect(result).toEqual([]);
    });

    it('多模板时全部返回，且字段被 mapTemplateToEquipmentItem 转换', async () => {
      await equipmentDbService.saveEquipmentTemplate(makeEquipmentItem({ id: 'a', name: 'A' }));
      await equipmentDbService.saveEquipmentTemplate(makeEquipmentItem({ id: 'b', name: 'B' }));
      await equipmentDbService.saveEquipmentTemplate(makeEquipmentItem({ id: 'c', name: 'C' }));

      const result = await equipmentDbService.getAllEquipmentTemplates();
      expect(result).toHaveLength(3);
      const ids = result.map(i => i.id).sort();
      expect(ids).toEqual(['a', 'b', 'c']);
    });
  });

  describe('deleteEquipmentTemplate：删除模板', () => {
    it('删除已存在模板后，getEquipmentTemplate 返回 null', async () => {
      await equipmentDbService.saveEquipmentTemplate(makeEquipmentItem({ id: 'del' }));
      expect(await equipmentDbService.getEquipmentTemplate('del')).not.toBeNull();

      await equipmentDbService.deleteEquipmentTemplate('del');
      expect(await equipmentDbService.getEquipmentTemplate('del')).toBeNull();
    });

    it('删除不影响其他模板', async () => {
      await equipmentDbService.saveEquipmentTemplate(makeEquipmentItem({ id: 'a' }));
      await equipmentDbService.saveEquipmentTemplate(makeEquipmentItem({ id: 'b' }));

      await equipmentDbService.deleteEquipmentTemplate('a');
      expect(await equipmentDbService.getEquipmentTemplate('a')).toBeNull();
      expect(await equipmentDbService.getEquipmentTemplate('b')).not.toBeNull();
      expect(await equipmentDbService.getAllEquipmentTemplates()).toHaveLength(1);
    });

    it('删除不存在的模板不抛错', async () => {
      await expect(equipmentDbService.deleteEquipmentTemplate('non-existent')).resolves.toBeUndefined();
    });
  });
});
