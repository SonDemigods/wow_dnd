/**
 * @fileoverview item-template 模块纯函数服务测试
 *
 * 覆盖：
 * 1. convertEquipmentToItem：装备模板 → Item 格式转换
 *    - 完整字段映射
 *    - 缺失可选字段时的默认值（stackable=false）
 *    - 装备专有字段（slots/classRestriction/setId）被丢弃
 * 2. mergeItemTemplates：普通物品 + 装备合并
 *    - 普通物品优先（ID 冲突时保留普通物品）
 *    - 装备模板转换为 Item 格式后插入
 *    - 空输入返回空 Map
 *    - 不修改入参数组
 */
import { describe, it, expect } from 'vitest';
import { convertEquipmentToItem, mergeItemTemplates } from '@/modules/item-template/service';
import type { Item } from '@/modules/item-template/types';
import type { EquipmentItem } from '@/modules/equipment/types';

// ==================== 测试数据 helper ====================

function makeEquipment(o: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: 'w1',
    name: '铁剑',
    type: 'weapon',
    rarity: 'common',
    icon: 'game-icons:broadsword',
    description: '一把铁剑',
    value: 100,
    stackable: false,
    slots: ['weapon1'],
    bonus: { str: 5 },
    levelRequirement: 5,
    classRestriction: ['warrior'],
    setId: 'warrior_set',
    ...o,
  } as EquipmentItem;
}

function makeItem(o: Partial<Item> = {}): Item {
  return {
    id: 'p1',
    name: '生命药水',
    type: 'potion',
    rarity: 'common',
    icon: 'game-icons:potion-ball',
    description: '恢复 50 点生命值',
    value: 10,
    stackable: true,
    ...o,
  } as Item;
}

// ==================== convertEquipmentToItem ====================

describe('convertEquipmentToItem：装备模板 → Item 格式', () => {
  it('完整字段映射（保留 id/name/type/rarity/level/icon/description/bonus/value/levelRequirement）', () => {
    const equip = makeEquipment({
      id: 'w1',
      name: '铁剑',
      type: 'weapon',
      rarity: 'rare',
      level: 10,
      icon: 'game-icons:broadsword',
      description: '一把铁剑',
      bonus: { str: 5, dex: 2 },
      value: 200,
      stackable: false,
      levelRequirement: 5,
    });

    const item = convertEquipmentToItem(equip);

    expect(item).toEqual({
      id: 'w1',
      name: '铁剑',
      type: 'weapon',
      rarity: 'rare',
      level: 10,
      icon: 'game-icons:broadsword',
      description: '一把铁剑',
      bonus: { str: 5, dex: 2 },
      value: 200,
      stackable: false,
      levelRequirement: 5,
    });
  });

  it('丢弃装备专有字段（slots/classRestriction/setId）', () => {
    const equip = makeEquipment({
      slots: ['weapon1', 'weapon2'],
      classRestriction: ['warrior', 'paladin'],
      setId: 'warrior_set',
    });

    const item = convertEquipmentToItem(equip);

    // 装备专有字段不应出现在 Item 中
    expect(item).not.toHaveProperty('slots');
    expect(item).not.toHaveProperty('classRestriction');
    expect(item).not.toHaveProperty('setId');
  });

  it('stackable 为 undefined 时默认 false', () => {
    const equip = makeEquipment({ stackable: undefined as unknown as boolean });
    const item = convertEquipmentToItem(equip);
    expect(item.stackable).toBe(false);
  });

  it('stackable 为 true 时保留', () => {
    // 装备通常不可堆叠，但测试覆盖该字段透传
    const equip = makeEquipment({ stackable: true });
    const item = convertEquipmentToItem(equip);
    expect(item.stackable).toBe(true);
  });

  it('levelRequirement 为 undefined 时不映射', () => {
    const equip = makeEquipment({ levelRequirement: undefined });
    const item = convertEquipmentToItem(equip);
    expect(item.levelRequirement).toBeUndefined();
  });

  it('bonus 为 undefined 时不映射（保持可选字段语义）', () => {
    const equip = makeEquipment({ bonus: undefined });
    const item = convertEquipmentToItem(equip);
    expect(item.bonus).toBeUndefined();
  });

  it('不映射 effect/consumable/template 字段（装备上下文中不适用）', () => {
    const equip = makeEquipment();
    const item = convertEquipmentToItem(equip);
    expect(item).not.toHaveProperty('effect');
    expect(item).not.toHaveProperty('consumable');
    expect(item).not.toHaveProperty('template');
  });
});

// ==================== mergeItemTemplates ====================

describe('mergeItemTemplates：合并普通物品与装备模板', () => {
  it('空输入返回空 Map', () => {
    const map = mergeItemTemplates([], []);
    expect(map.size).toBe(0);
  });

  it('仅普通物品时全部插入', () => {
    const items = [makeItem({ id: 'p1' }), makeItem({ id: 'p2' })];
    const map = mergeItemTemplates(items, []);
    expect(map.size).toBe(2);
    expect(map.get('p1')?.id).toBe('p1');
    expect(map.get('p2')?.id).toBe('p2');
  });

  it('仅装备时转换为 Item 格式后插入', () => {
    const equipment = [makeEquipment({ id: 'w1' }), makeEquipment({ id: 'a1', type: 'armor' })];
    const map = mergeItemTemplates([], equipment);
    expect(map.size).toBe(2);
    expect(map.get('w1')?.id).toBe('w1');
    expect(map.get('w1')?.type).toBe('weapon');
    expect(map.get('a1')?.id).toBe('a1');
  });

  it('普通物品与装备 ID 不冲突时全部插入', () => {
    const items = [makeItem({ id: 'p1' })];
    const equipment = [makeEquipment({ id: 'w1' })];
    const map = mergeItemTemplates(items, equipment);
    expect(map.size).toBe(2);
    expect(map.has('p1')).toBe(true);
    expect(map.has('w1')).toBe(true);
  });

  it('ID 冲突时普通物品优先（装备模板不覆盖）', () => {
    const items = [makeItem({ id: 'shared', name: '普通物品' })];
    const equipment = [makeEquipment({ id: 'shared', name: '装备物品' })];
    const map = mergeItemTemplates(items, equipment);
    expect(map.size).toBe(1);
    // 保留普通物品，装备被忽略
    expect(map.get('shared')?.name).toBe('普通物品');
  });

  it('不修改入参数组（纯函数）', () => {
    const items = [makeItem({ id: 'p1' })];
    const equipment = [makeEquipment({ id: 'w1' })];
    const itemsSnapshot = [...items];
    const equipmentSnapshot = [...equipment];

    mergeItemTemplates(items, equipment);

    expect(items).toEqual(itemsSnapshot);
    expect(equipment).toEqual(equipmentSnapshot);
  });

  it('多个 ID 冲突时全部保留普通物品', () => {
    const items = [
      makeItem({ id: 'shared1', name: '物品1' }),
      makeItem({ id: 'shared2', name: '物品2' }),
    ];
    const equipment = [
      makeEquipment({ id: 'shared1', name: '装备1' }),
      makeEquipment({ id: 'shared2', name: '装备2' }),
      makeEquipment({ id: 'unique', name: '独立装备' }),
    ];
    const map = mergeItemTemplates(items, equipment);
    expect(map.size).toBe(3);
    expect(map.get('shared1')?.name).toBe('物品1');
    expect(map.get('shared2')?.name).toBe('物品2');
    expect(map.get('unique')?.name).toBe('独立装备');
  });
});
