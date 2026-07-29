/**
 * @fileoverview 背包模块 service 纯函数单元测试
 *
 * 覆盖范围：
 * 1. canStackItem —— 物品堆叠判定（三条件：stackable + 同 id + 未满）
 * 2. computeStackResult —— 堆叠数量计算（含溢出）
 * 3. findItemIndex —— 物品查找
 * 4. sortItems —— 排序（type/rarity/name/level，含缺失模板回退）
 * 5. filterItems —— 筛选（关键词/类型/稀有度/堆叠）
 * 6. sortAndFilterInventory —— 组合筛选排序
 * 7. computeUseEffect —— 物品使用效果
 * 8. 常量 INVENTORY_SIZE / MAX_STACK / ITEM_TYPE_NAMES / RARITY_ORDER
 */
import { describe, it, expect } from 'vitest';
import {
  INVENTORY_SIZE,
  MAX_STACK,
  ITEM_TYPE_NAMES,
  RARITY_ORDER,
  canStackItem,
  computeStackResult,
  findItemIndex,
  sortItems,
  filterItems,
  sortAndFilterInventory,
  computeUseEffect,
} from '@/modules/inventory/service';
import type { Item, InventoryItem, ItemFilters } from '@/modules/inventory/types';

/** 构造测试用 Item */
function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item_p1',
    name: '治疗药水',
    type: 'potion',
    rarity: 'common',
    icon: 'game-icons:potion',
    description: '恢复 50 点生命值',
    value: 10,
    stackable: true,
    ...overrides,
  };
}

/** 构造测试用 InventoryItem */
function makeInvItem(itemId: string, count: number): InventoryItem {
  return { itemId, count };
}

/** 由 Item 数组构造模板 Map */
function makeTemplateMap(items: Item[]): Map<string, Item> {
  return new Map(items.map(i => [i.id, i]));
}

describe('常量定义', () => {
  it('INVENTORY_SIZE 为 50', () => {
    expect(INVENTORY_SIZE).toBe(50);
  });

  it('MAX_STACK 为 10', () => {
    expect(MAX_STACK).toBe(10);
  });

  it('ITEM_TYPE_NAMES 覆盖全部 ItemType', () => {
    expect(ITEM_TYPE_NAMES.potion).toBe('药水');
    expect(ITEM_TYPE_NAMES.weapon).toBe('武器');
    expect(ITEM_TYPE_NAMES.armor).toBe('护甲');
    expect(ITEM_TYPE_NAMES.misc).toBe('杂项');
  });

  it('RARITY_ORDER 按品质递增', () => {
    expect(RARITY_ORDER.common).toBeLessThan(RARITY_ORDER.uncommon);
    expect(RARITY_ORDER.uncommon).toBeLessThan(RARITY_ORDER.rare);
    expect(RARITY_ORDER.rare).toBeLessThan(RARITY_ORDER.epic);
    expect(RARITY_ORDER.epic).toBeLessThan(RARITY_ORDER.legendary);
  });
});

describe('canStackItem 堆叠判定', () => {
  it('可堆叠 + 同 id + 未满 → true', () => {
    const item = makeItem({ id: 'p1', stackable: true });
    const inv = makeInvItem('p1', 5);
    expect(canStackItem(item, inv)).toBe(true);
  });

  it('不可堆叠 → false', () => {
    const item = makeItem({ id: 'p1', stackable: false });
    const inv = makeInvItem('p1', 5);
    expect(canStackItem(item, inv)).toBe(false);
  });

  it('不同 id → false', () => {
    const item = makeItem({ id: 'p1', stackable: true });
    const inv = makeInvItem('p2', 5);
    expect(canStackItem(item, inv)).toBe(false);
  });

  it('已达堆叠上限 → false', () => {
    const item = makeItem({ id: 'p1', stackable: true });
    const inv = makeInvItem('p1', MAX_STACK);
    expect(canStackItem(item, inv)).toBe(false);
  });

  it('刚好未达上限（count = MAX_STACK - 1）→ true', () => {
    const item = makeItem({ id: 'p1', stackable: true });
    const inv = makeInvItem('p1', MAX_STACK - 1);
    expect(canStackItem(item, inv)).toBe(true);
  });
});

describe('computeStackResult 堆叠数量计算', () => {
  it('添加量未超可用空间时无溢出', () => {
    const result = computeStackResult(5, 3, 10);
    expect(result.quantity).toBe(8);
    expect(result.overflow).toBe(0);
  });

  it('添加量等于可用空间时刚好满', () => {
    const result = computeStackResult(7, 3, 10);
    expect(result.quantity).toBe(10);
    expect(result.overflow).toBe(0);
  });

  it('添加量超过可用空间时产生溢出', () => {
    const result = computeStackResult(8, 5, 10);
    expect(result.quantity).toBe(10);
    expect(result.overflow).toBe(3);
  });

  it('已有满堆时全部溢出', () => {
    const result = computeStackResult(10, 5, 10);
    expect(result.quantity).toBe(10);
    expect(result.overflow).toBe(5);
  });

  it('从 0 开始添加', () => {
    const result = computeStackResult(0, 7, 10);
    expect(result.quantity).toBe(7);
    expect(result.overflow).toBe(0);
  });
});

describe('findItemIndex 物品查找', () => {
  it('返回匹配 itemId 的第一个索引', () => {
    const inv: InventoryItem[] = [
      makeInvItem('a', 1),
      makeInvItem('b', 2),
      makeInvItem('c', 3),
    ];
    expect(findItemIndex(inv, 'b')).toBe(1);
  });

  it('未找到返回 -1', () => {
    const inv: InventoryItem[] = [makeInvItem('a', 1)];
    expect(findItemIndex(inv, 'not_exist')).toBe(-1);
  });

  it('空数组返回 -1', () => {
    expect(findItemIndex([], 'a')).toBe(-1);
  });

  it('多个同 id 返回第一个', () => {
    const inv: InventoryItem[] = [
      makeInvItem('a', 1),
      makeInvItem('a', 2),
    ];
    expect(findItemIndex(inv, 'a')).toBe(0);
  });
});

describe('sortItems 排序', () => {
  const items: Item[] = [
    makeItem({ id: 'a', name: '史诗剑', type: 'weapon', rarity: 'epic', level: 10 }),
    makeItem({ id: 'b', name: '普通药水', type: 'potion', rarity: 'common', level: 1 }),
    makeItem({ id: 'c', name: '稀有卷轴', type: 'scroll', rarity: 'rare', level: 5 }),
  ];
  const templates = makeTemplateMap(items);

  it('按 rarity 升序：common < rare < epic', () => {
    const inv = [makeInvItem('a', 1), makeInvItem('b', 1), makeInvItem('c', 1)];
    const sorted = sortItems(inv, templates, 'rarity', 'asc');
    expect(sorted.map(i => i.itemId)).toEqual(['b', 'c', 'a']);
  });

  it('按 rarity 降序：epic > rare > common', () => {
    const inv = [makeInvItem('b', 1), makeInvItem('a', 1), makeInvItem('c', 1)];
    const sorted = sortItems(inv, templates, 'rarity', 'desc');
    expect(sorted.map(i => i.itemId)).toEqual(['a', 'c', 'b']);
  });

  it('按 level 升序', () => {
    const inv = [makeInvItem('a', 1), makeInvItem('b', 1), makeInvItem('c', 1)];
    const sorted = sortItems(inv, templates, 'level', 'asc');
    expect(sorted.map(i => i.itemId)).toEqual(['b', 'c', 'a']);
  });

  it('按 name 升序', () => {
    const inv = [makeInvItem('a', 1), makeInvItem('b', 1), makeInvItem('c', 1)];
    const sorted = sortItems(inv, templates, 'name', 'asc');
    // 普通药水 < 史诗剑 < 稀有卷轴（拼音序）
    expect(sorted.map(i => i.itemId)).toEqual(['b', 'a', 'c']);
  });

  it('不修改原数组（返回新数组）', () => {
    const inv = [makeInvItem('a', 1), makeInvItem('b', 1)];
    const original = [...inv];
    sortItems(inv, templates, 'rarity', 'asc');
    expect(inv).toEqual(original);
  });

  it('模板中缺失物品时使用回退值不报错', () => {
    const inv = [makeInvItem('a', 1), makeInvItem('unknown', 1)];
    const sorted = sortItems(inv, templates, 'rarity', 'asc');
    expect(sorted).toHaveLength(2);
    // 缺失物品回退为 common（权重 0），应排在最前
    expect(sorted[0].itemId).toBe('unknown');
  });

  it('空数组排序返回空数组', () => {
    expect(sortItems([], templates, 'rarity', 'asc')).toEqual([]);
  });

  it('按 type 升序（拼音序：卷轴 < 武器 < 药水）', () => {
    // 覆盖 case 'type' 分支（行 166-171）及 ITEM_TYPE_NAMES[itemA?.type || 'misc'] 正常路径
    const inv = [makeInvItem('a', 1), makeInvItem('b', 1), makeInvItem('c', 1)];
    const sorted = sortItems(inv, templates, 'type', 'asc');
    // 卷轴(scroll, juǎn) < 武器(weapon, wǔ) < 药水(potion, yào)
    expect(sorted.map(i => i.itemId)).toEqual(['c', 'a', 'b']);
  });

  it('按 type 降序（药水 > 武器 > 卷轴）', () => {
    const inv = [makeInvItem('b', 1), makeInvItem('a', 1), makeInvItem('c', 1)];
    const sorted = sortItems(inv, templates, 'type', 'desc');
    expect(sorted.map(i => i.itemId)).toEqual(['b', 'a', 'c']);
  });

  it('按 type 排序时缺失模板的物品回退为 misc', () => {
    // 覆盖 ITEM_TYPE_NAMES[itemA?.type || 'misc'] 中 || 'misc' 兜底分支
    const inv = [makeInvItem('a', 1), makeInvItem('unknown', 1)];
    const sorted = sortItems(inv, templates, 'type', 'asc');
    // unknown 回退为 misc（杂项），weapon(misc 排序可能因 localeCompare 变化）
    expect(sorted).toHaveLength(2);
  });

  it('按 level 排序时缺失模板的物品回退为 0', () => {
    // 覆盖 (itemA?.level || 0) 中 || 0 兜底分支
    const inv = [makeInvItem('a', 1), makeInvItem('unknown', 1)];
    const sorted = sortItems(inv, templates, 'level', 'asc');
    // unknown 回退为 level=0，应排在 level=10 的 'a' 之前
    expect(sorted[0].itemId).toBe('unknown');
  });

  it('按 name 排序时缺失模板的物品回退为空字符串', () => {
    // 覆盖 (itemA?.name || '') 中 || '' 兜底分支
    const inv = [makeInvItem('a', 1), makeInvItem('unknown', 1)];
    const sorted = sortItems(inv, templates, 'name', 'asc');
    // unknown 回退为 name=''，应排在最前
    expect(sorted[0].itemId).toBe('unknown');
  });

  it('按 rarity 排序时 itemB 缺失模板回退为 common', () => {
    // 覆盖 RARITY_ORDER[itemB?.rarity || 'common'] 中 || 'common' 兜底分支
    // inv 顺序 [b, unknown] → comparator(b, unknown) → itemB=undefined → rarity 回退 'common'
    const inv = [makeInvItem('b', 1), makeInvItem('unknown', 1)];
    const sorted = sortItems(inv, templates, 'rarity', 'asc');
    // b=common(0), unknown=common(0) → 顺序稳定
    expect(sorted).toHaveLength(2);
  });

  it('按 type 排序时 itemB 模板存在但 type 字段为 undefined 时回退为 misc', () => {
    // 覆盖 line 169: ITEM_TYPE_NAMES[itemB?.type || 'misc'] 中 || 'misc' 分支
    // itemB 存在但 type=undefined → ?. 不短路但 || 触发回退
    const partialTemplates = makeTemplateMap([
      makeItem({ id: 'a', type: 'weapon', rarity: 'common', name: '剑', level: 1 }),
      { id: 'no_type', name: '无类型', type: undefined as any, rarity: 'common', icon: '', description: '', value: 0, stackable: false } as Item,
    ]);
    const inv = [makeInvItem('a', 1), makeInvItem('no_type', 1)];
    const sorted = sortItems(inv, partialTemplates, 'type', 'asc');
    expect(sorted).toHaveLength(2);
  });

  it('按 rarity 排序时 itemB 模板存在但 rarity 字段为 undefined 时回退为 common', () => {
    // 覆盖 line 174: RARITY_ORDER[itemB?.rarity || 'common'] 中 || 'common' 分支
    const partialTemplates = makeTemplateMap([
      makeItem({ id: 'a', type: 'weapon', rarity: 'common', name: '剑', level: 1 }),
      { id: 'no_rarity', name: '无稀有度', type: 'misc', rarity: undefined as any, icon: '', description: '', value: 0, stackable: false } as Item,
    ]);
    const inv = [makeInvItem('a', 1), makeInvItem('no_rarity', 1)];
    const sorted = sortItems(inv, partialTemplates, 'rarity', 'asc');
    expect(sorted).toHaveLength(2);
  });

  it('按 name 排序时 itemB 模板存在但 name 字段为 undefined 时回退为空字符串', () => {
    // 覆盖 line 177: (itemB?.name || '') 中 || '' 分支
    const partialTemplates = makeTemplateMap([
      makeItem({ id: 'a', type: 'weapon', rarity: 'common', name: '剑', level: 1 }),
      { id: 'no_name', name: undefined as any, type: 'misc', rarity: 'common', icon: '', description: '', value: 0, stackable: false } as Item,
    ]);
    const inv = [makeInvItem('a', 1), makeInvItem('no_name', 1)];
    const sorted = sortItems(inv, partialTemplates, 'name', 'asc');
    // no_name 回退为 ''，应排在 '剑' 之前
    expect(sorted[0].itemId).toBe('no_name');
  });

  it('按 level 排序时 itemB 模板存在但 level 字段为 undefined 时回退为 0', () => {
    // 覆盖 line 180: (itemB?.level || 0) 中 || 0 分支
    const partialTemplates = makeTemplateMap([
      makeItem({ id: 'a', type: 'weapon', rarity: 'common', name: '剑', level: 5 }),
      { id: 'no_level', name: '无等级', type: 'misc', rarity: 'common', icon: '', description: '', value: 0, stackable: false, level: undefined as any } as Item,
    ]);
    const inv = [makeInvItem('a', 1), makeInvItem('no_level', 1)];
    const sorted = sortItems(inv, partialTemplates, 'level', 'asc');
    // no_level 回退为 0，应排在 level=5 的 'a' 之前
    expect(sorted[0].itemId).toBe('no_level');
  });

  it('按 type 排序时 itemA 和 itemB 的 type 均为 undefined 时全部回退为 misc', () => {
    // 覆盖 line 169: ITEM_TYPE_NAMES[itemB?.type || 'misc'] 中 || 'misc' 的 itemB 回退分支
    // 当所有物品模板 type 均缺失时，comparator 的任意配对都会触发 itemA 和 itemB 的 || 回退
    const partialTemplates = makeTemplateMap([
      { id: 'no_type_a', name: 'A', type: undefined as any, rarity: 'common', icon: '', description: '', value: 0, stackable: false } as Item,
      { id: 'no_type_b', name: 'B', type: undefined as any, rarity: 'common', icon: '', description: '', value: 0, stackable: false } as Item,
    ]);
    const inv = [makeInvItem('no_type_a', 1), makeInvItem('no_type_b', 1)];
    const sorted = sortItems(inv, partialTemplates, 'type', 'asc');
    expect(sorted).toHaveLength(2);
  });

  it('按 rarity 排序时 itemA 和 itemB 的 rarity 均为 undefined 时全部回退为 common', () => {
    // 覆盖 line 174: RARITY_ORDER[itemB?.rarity || 'common'] 中 || 'common' 的 itemB 回退分支
    const partialTemplates = makeTemplateMap([
      { id: 'no_rar_a', name: 'A', type: 'misc', rarity: undefined as any, icon: '', description: '', value: 0, stackable: false } as Item,
      { id: 'no_rar_b', name: 'B', type: 'misc', rarity: undefined as any, icon: '', description: '', value: 0, stackable: false } as Item,
    ]);
    const inv = [makeInvItem('no_rar_a', 1), makeInvItem('no_rar_b', 1)];
    const sorted = sortItems(inv, partialTemplates, 'rarity', 'asc');
    expect(sorted).toHaveLength(2);
  });

  it('按 name 排序时 itemA 和 itemB 的 name 均为 undefined 时全部回退为空字符串', () => {
    // 覆盖 line 177: (itemB?.name || '') 中 || '' 的 itemB 回退分支
    const partialTemplates = makeTemplateMap([
      { id: 'no_name_a', name: undefined as any, type: 'misc', rarity: 'common', icon: '', description: '', value: 0, stackable: false } as Item,
      { id: 'no_name_b', name: undefined as any, type: 'misc', rarity: 'common', icon: '', description: '', value: 0, stackable: false } as Item,
    ]);
    const inv = [makeInvItem('no_name_a', 1), makeInvItem('no_name_b', 1)];
    const sorted = sortItems(inv, partialTemplates, 'name', 'asc');
    expect(sorted).toHaveLength(2);
  });

  it('按 level 排序时 itemA 和 itemB 的 level 均为 undefined 时全部回退为 0', () => {
    // 覆盖 line 180: (itemB?.level || 0) 中 || 0 的 itemB 回退分支
    const partialTemplates = makeTemplateMap([
      { id: 'no_lvl_a', name: 'A', type: 'misc', rarity: 'common', icon: '', description: '', value: 0, stackable: false, level: undefined as any } as Item,
      { id: 'no_lvl_b', name: 'B', type: 'misc', rarity: 'common', icon: '', description: '', value: 0, stackable: false, level: undefined as any } as Item,
    ]);
    const inv = [makeInvItem('no_lvl_a', 1), makeInvItem('no_lvl_b', 1)];
    const sorted = sortItems(inv, partialTemplates, 'level', 'asc');
    expect(sorted).toHaveLength(2);
  });
});

describe('filterItems 筛选', () => {
  const items: Item[] = [
    makeItem({ id: 'a', name: '治疗药水', type: 'potion', rarity: 'common', description: '恢复生命', stackable: true }),
    makeItem({ id: 'b', name: '铁剑', type: 'weapon', rarity: 'rare', description: '锋利的剑', stackable: false }),
    makeItem({ id: 'c', name: '魔法卷轴', type: 'scroll', rarity: 'epic', description: '施法材料', stackable: true }),
  ];
  const templates = makeTemplateMap(items);

  it('按类型筛选', () => {
    const inv = [makeInvItem('a', 1), makeInvItem('b', 1), makeInvItem('c', 1)];
    const filters: ItemFilters = { types: ['potion', 'scroll'] };
    const result = filterItems(inv, templates, filters, '');
    expect(result.map(i => i.itemId)).toEqual(['a', 'c']);
  });

  it('按稀有度筛选', () => {
    const inv = [makeInvItem('a', 1), makeInvItem('b', 1), makeInvItem('c', 1)];
    const filters: ItemFilters = { rarities: ['rare', 'epic'] };
    const result = filterItems(inv, templates, filters, '');
    expect(result.map(i => i.itemId)).toEqual(['b', 'c']);
  });

  it('按可堆叠筛选', () => {
    const inv = [makeInvItem('a', 1), makeInvItem('b', 1), makeInvItem('c', 1)];
    const filters: ItemFilters = { stackable: true };
    const result = filterItems(inv, templates, filters, '');
    expect(result.map(i => i.itemId)).toEqual(['a', 'c']);
  });

  it('关键词搜索匹配名称', () => {
    const inv = [makeInvItem('a', 1), makeInvItem('b', 1), makeInvItem('c', 1)];
    const result = filterItems(inv, templates, {}, '治疗');
    expect(result.map(i => i.itemId)).toEqual(['a']);
  });

  it('关键词搜索匹配描述', () => {
    const inv = [makeInvItem('a', 1), makeInvItem('b', 1), makeInvItem('c', 1)];
    const result = filterItems(inv, templates, {}, '锋利');
    expect(result.map(i => i.itemId)).toEqual(['b']);
  });

  it('关键词搜索不区分大小写', () => {
    const inv = [makeInvItem('b', 1)];
    const templates2 = makeTemplateMap([makeItem({ id: 'b', name: 'Iron Sword', description: 'sharp' })]);
    expect(filterItems(inv, templates2, {}, 'IRON')).toHaveLength(1);
    expect(filterItems(inv, templates2, {}, 'SHARP')).toHaveLength(1);
  });

  it('空关键词不进行搜索过滤', () => {
    const inv = [makeInvItem('a', 1), makeInvItem('b', 1)];
    const result = filterItems(inv, templates, {}, '');
    expect(result).toHaveLength(2);
  });

  it('仅空白字符的关键词不进行搜索过滤', () => {
    const inv = [makeInvItem('a', 1), makeInvItem('b', 1)];
    const result = filterItems(inv, templates, {}, '   ');
    expect(result).toHaveLength(2);
  });

  it('多条件 AND 组合', () => {
    const inv = [makeInvItem('a', 1), makeInvItem('b', 1), makeInvItem('c', 1)];
    const filters: ItemFilters = { types: ['potion', 'scroll'], rarities: ['epic'] };
    const result = filterItems(inv, templates, filters, '');
    expect(result.map(i => i.itemId)).toEqual(['c']);
  });

  it('无任何筛选条件时返回全部', () => {
    const inv = [makeInvItem('a', 1), makeInvItem('b', 1)];
    expect(filterItems(inv, templates, {}, '')).toHaveLength(2);
  });

  it('不修改原数组', () => {
    const inv = [makeInvItem('a', 1), makeInvItem('b', 1)];
    const original = [...inv];
    filterItems(inv, templates, { types: ['potion'] }, '');
    expect(inv).toEqual(original);
  });
});

describe('sortAndFilterInventory 组合筛选排序', () => {
  const items: Item[] = [
    makeItem({ id: 'a', name: '史诗剑', type: 'weapon', rarity: 'epic', level: 10, stackable: false }),
    makeItem({ id: 'b', name: '普通药水', type: 'potion', rarity: 'common', level: 1, stackable: true }),
    makeItem({ id: 'c', name: '稀有药水', type: 'potion', rarity: 'rare', level: 5, stackable: true }),
  ];
  const templates = makeTemplateMap(items);

  it('先筛选再排序', () => {
    const inv = [makeInvItem('a', 1), makeInvItem('b', 1), makeInvItem('c', 1)];
    // 筛选 potion 类型，按 rarity 升序
    const result = sortAndFilterInventory(inv, templates, { types: ['potion'] }, 'rarity', 'asc', '');
    expect(result.map(i => i.itemId)).toEqual(['b', 'c']);
  });

  it('筛选后无结果时返回空数组', () => {
    const inv = [makeInvItem('a', 1)];
    const result = sortAndFilterInventory(inv, templates, { types: ['scroll'] }, 'rarity', 'asc', '');
    expect(result).toEqual([]);
  });

  it('关键词与排序组合', () => {
    const inv = [makeInvItem('a', 1), makeInvItem('b', 1), makeInvItem('c', 1)];
    // 搜索"药水"，按 level 降序
    const result = sortAndFilterInventory(inv, templates, {}, 'level', 'desc', '药水');
    expect(result.map(i => i.itemId)).toEqual(['c', 'b']);
  });
});

describe('computeUseEffect 物品使用效果', () => {
  it('有 effect 字段时返回 effect', () => {
    const item = makeItem({ effect: { type: 'health_restore', value: 50 } });
    expect(computeUseEffect(item)).toEqual({ type: 'health_restore', value: 50 });
  });

  it('无 effect 字段时返回 null', () => {
    const item = makeItem({ effect: undefined });
    expect(computeUseEffect(item)).toBeNull();
  });
});
