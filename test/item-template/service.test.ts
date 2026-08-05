/**
 * @fileoverview item-template 模块纯函数服务测试
 *
 * 覆盖：
 * 1. convertEquipmentToItem：装备模板 → Item 格式转换
 *    - P3.3 升级：convertEquipmentToItem 已改为 identity 函数（EquipmentItem 已是 Item 联合成员）
 *    - 完整字段透传（保留 id/name/kind/subtype/rarity/bonus/slots/occupies/...）
 *    - 装备专有字段（slots/classRestriction/setId）保留（不再丢弃）
 *    - identity 行为：stackable/bonus/levelRequirement 等可选字段原样透传
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
    kind: 'equipment',
    subtype: 'sword',
    grip: 'one_handed',
    rarity: 'common',
    icon: 'game-icons:broadsword',
    description: '一把铁剑',
    value: 100,
    stackable: false,
    consumable: false,
    slots: ['weapon1'],
    occupies: ['weapon1'],
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
    kind: 'consumable',
    subtype: 'potion',
    rarity: 'common',
    icon: 'game-icons:potion-ball',
    description: '恢复 50 点生命值',
    value: 10,
    stackable: true,
    consumable: true,
    effects: [],
    useMode: 'instant',
    ...o,
  } as Item;
}

// ==================== convertEquipmentToItem ====================

describe('convertEquipmentToItem：装备模板 → Item 格式', () => {
  it('完整字段透传（identity：保留 id/name/kind/subtype/rarity/level/icon/description/bonus/value/levelRequirement）', () => {
    const equip = makeEquipment({
      id: 'w1',
      name: '铁剑',
      kind: 'equipment',
      subtype: 'sword',
      grip: 'one_handed',
      rarity: 'rare',
      level: 10,
      icon: 'game-icons:broadsword',
      description: '一把铁剑',
      bonus: { str: 5, dex: 2 },
      value: 200,
      stackable: false,
      consumable: false,
      slots: ['weapon1', 'weapon2'],
      occupies: ['weapon1'],
      levelRequirement: 5,
    });

    const item = convertEquipmentToItem(equip);

    // P3.3：identity 函数原样返回，所有字段（含判别字面量与派生字段）保留
    expect(item).toEqual(equip);
    expect(item).toEqual({
      id: 'w1',
      name: '铁剑',
      kind: 'equipment',
      subtype: 'sword',
      grip: 'one_handed',
      rarity: 'rare',
      level: 10,
      icon: 'game-icons:broadsword',
      description: '一把铁剑',
      bonus: { str: 5, dex: 2 },
      value: 200,
      stackable: false,
      consumable: false,
      slots: ['weapon1', 'weapon2'],
      occupies: ['weapon1'],
      levelRequirement: 5,
      classRestriction: ['warrior'],
      setId: 'warrior_set',
    });
  });

  it('保留装备专有字段（slots/classRestriction/setId，P3.3 不再丢弃）', () => {
    const equip = makeEquipment({
      slots: ['weapon1', 'weapon2'],
      classRestriction: ['warrior', 'paladin'],
      setId: 'warrior_set',
    });

    const item = convertEquipmentToItem(equip);

    // P3.3：identity 函数保留装备专有字段，UI 通过 kind='equipment' 窄化即可安全访问
    expect(item).toHaveProperty('slots');
    expect(item).toHaveProperty('classRestriction');
    expect(item).toHaveProperty('setId');
    if (item.kind === 'equipment') {
      expect(item.slots).toEqual(['weapon1', 'weapon2']);
      expect(item.classRestriction).toEqual(['warrior', 'paladin']);
      expect(item.setId).toBe('warrior_set');
    }
  });

  it('stackable 为 undefined 时透传 undefined（identity 行为）', () => {
    const equip = makeEquipment({ stackable: undefined as unknown as false });
    const item = convertEquipmentToItem(equip);
    // P3.3：identity 函数原样返回，stackable 为 undefined（运行时类型由调用方保证）
    expect(item.stackable).toBeUndefined();
  });

  it('stackable 为 true 时保留', () => {
    // 装备通常不可堆叠，但测试覆盖该字段透传
    const equip = makeEquipment({ stackable: true });
    const item = convertEquipmentToItem(equip);
    expect(item.stackable).toBe(true);
  });

  it('levelRequirement 为 undefined 时透传 undefined', () => {
    const equip = makeEquipment({ levelRequirement: undefined });
    const item = convertEquipmentToItem(equip);
    expect(item.levelRequirement).toBeUndefined();
  });

  it('bonus 为 undefined 时透传 undefined（identity 行为）', () => {
    const equip = makeEquipment({ bonus: undefined });
    const item = convertEquipmentToItem(equip);
    expect(item.bonus).toBeUndefined();
  });

  it('identity 函数：输入无 effect/template 字段时输出也无（consumable 恒为 false 字面量）', () => {
    const equip = makeEquipment();
    const item = convertEquipmentToItem(equip);
    // P3.3：identity 函数原样返回，输入无 effect/template 字段则输出也无
    expect(item).not.toHaveProperty('effect');
    expect(item).not.toHaveProperty('template');
    // consumable 是装备的字面量字段，恒为 false
    expect(item.consumable).toBe(false);
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
    const equipment = [
      makeEquipment({ id: 'w1' }),
      makeEquipment({ id: 'a1', subtype: 'chest' }),
    ];
    const map = mergeItemTemplates([], equipment);
    expect(map.size).toBe(2);
    expect(map.get('w1')?.id).toBe('w1');
    // P3.3：装备保留 kind='equipment' 与 subtype（替代旧 type='weapon'）
    expect(map.get('w1')?.kind).toBe('equipment');
    expect(map.get('w1')?.subtype).toBe('sword');
    expect(map.get('a1')?.id).toBe('a1');
    expect(map.get('a1')?.subtype).toBe('chest');
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
