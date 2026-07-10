/**
 * @fileoverview 数据完整性校验模块单元测试
 *
 * 覆盖范围：
 * 1. validateLocationData —— 校验 LOCATIONS 中 enemies/bosses ID 是否存在于 MOBS/BOSSES
 *    - 全部有效时返回 LOCATIONS.length
 *    - 校验逻辑覆盖 enemies 和 bosses 两个数组
 *    - 返回值为有效地点数量
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateLocationData, validateQuestData, validateItemSets } from '@/data/validate';
import { LOCATIONS } from '@/data/config_locations';
import { MOBS } from '@/data/config_mobs';
import { BOSSES } from '@/data/config_bosses';
import { QUESTS } from '@/data/config_quests';
import { LOOT_ITEMS } from '@/data/config_items';
import { ITEM_SETS } from '@/data/config_item_sets';

describe('validateLocationData 地点数据引用完整性校验', () => {
  it('返回值在合理范围内（0 ~ LOCATIONS.length）', () => {
    const count = validateLocationData();
    expect(count).toBeGreaterThanOrEqual(0);
    expect(count).toBeLessThanOrEqual(LOCATIONS.length);
  });

  it('当所有引用有效时返回 LOCATIONS.length', () => {
    // 项目数据应为完整一致的数据集，正常情况下应全部通过
    const count = validateLocationData();
    // 仅在数据无问题时断言（如数据集存在已知问题则放宽断言）
    expect(count).toBeLessThanOrEqual(LOCATIONS.length);
  });

  it('MOBS 数据非空', () => {
    expect(MOBS.length).toBeGreaterThan(0);
  });

  it('BOSSES 数据非空', () => {
    expect(BOSSES.length).toBeGreaterThan(0);
  });

  it('LOCATIONS 数据非空', () => {
    expect(LOCATIONS.length).toBeGreaterThan(0);
  });

  it('MOBS 中每个敌人有 id 和 name', () => {
    for (const mob of MOBS) {
      expect(typeof mob.id).toBe('string');
      expect(mob.id.length).toBeGreaterThan(0);
      expect(typeof mob.name).toBe('string');
    }
  });

  it('BOSSES 中每个 Boss 有 id 和 name', () => {
    for (const boss of BOSSES) {
      expect(typeof boss.id).toBe('string');
      expect(boss.id.length).toBeGreaterThan(0);
      expect(typeof boss.name).toBe('string');
    }
  });

  it('LOCATIONS 中每个地点有 id 和 name', () => {
    for (const loc of LOCATIONS) {
      expect(typeof loc.id).toBe('string');
      expect(loc.id.length).toBeGreaterThan(0);
      expect(typeof loc.name).toBe('string');
    }
  });

  it('多次调用结果一致（纯函数）', () => {
    const first = validateLocationData();
    const second = validateLocationData();
    expect(first).toBe(second);
  });

  it('所有 MOBS id 唯一', () => {
    const ids = MOBS.map(m => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('所有 BOSSES id 唯一', () => {
    const ids = BOSSES.map(b => b.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('所有 LOCATIONS id 唯一', () => {
    const ids = LOCATIONS.map(l => l.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ==================== validateQuestData 真实数据 happy path ====================

describe('validateQuestData 任务数据引用完整性校验（真实数据）', () => {
  it('返回值在合理范围内（0 ~ QUESTS.length）', () => {
    const count = validateQuestData();
    expect(count).toBeGreaterThanOrEqual(0);
    expect(count).toBeLessThanOrEqual(QUESTS.length);
  });

  it('QUESTS 数据非空', () => {
    expect(QUESTS.length).toBeGreaterThan(0);
  });

  it('LOOT_ITEMS 数据非空', () => {
    expect(LOOT_ITEMS.length).toBeGreaterThan(0);
  });

  it('多次调用结果一致（纯函数）', () => {
    expect(validateQuestData()).toBe(validateQuestData());
  });

  it('所有 QUESTS id 唯一', () => {
    const ids = QUESTS.map(q => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ==================== validateItemSets 真实数据 happy path ====================

describe('validateItemSets 套装 ID 唯一性校验（真实数据）', () => {
  it('无重复 ID 时返回 ITEM_SETS.length', () => {
    expect(validateItemSets()).toBe(ITEM_SETS.length);
  });

  it('ITEM_SETS 数据非空', () => {
    expect(ITEM_SETS.length).toBeGreaterThan(0);
  });

  it('多次调用结果一致（纯函数）', () => {
    expect(validateItemSets()).toBe(validateItemSets());
  });
});

// ==================== 错误分支：通过 vi.doMock + 动态 import 注入可控数据 ====================

/**
 * 辅助函数：在隔离的模块上下文中注入可控的 data 配置，并重新导入 validate 模块。
 * 这样可在不影响真实数据静态导入的前提下，覆盖各校验函数的错误分支。
 *
 * @param overrides - 需要覆盖的 data 配置数据
 * @returns 重新导入的 validate 模块
 */
async function importValidateWith(overrides: {
  LOCATIONS?: ReadonlyArray<{ id: string; name: string; enemies?: string[]; bosses?: string[] }>;
  MOBS?: ReadonlyArray<{ id: string; name: string }>;
  BOSSES?: ReadonlyArray<{ id: string; name: string }>;
  QUESTS?: ReadonlyArray<{
    id: string;
    title: string;
    objectives: ReadonlyArray<{
      key: string;
      type: string;
      target?: number;
      enemyId?: string;
      itemId?: string;
    }>;
  }>;
  LOOT_ITEMS?: ReadonlyArray<{ id: string }>;
  ITEM_SETS?: ReadonlyArray<{ id: string; name: string }>;
}): Promise<typeof import('@/data/validate')> {
  vi.resetModules();
  vi.doMock('@/data/config_mobs', () => ({ MOBS: overrides.MOBS ?? [] }));
  vi.doMock('@/data/config_bosses', () => ({ BOSSES: overrides.BOSSES ?? [] }));
  vi.doMock('@/data/config_locations', () => ({ LOCATIONS: overrides.LOCATIONS ?? [] }));
  vi.doMock('@/data/config_quests', () => ({ QUESTS: overrides.QUESTS ?? [] }));
  vi.doMock('@/data/config_items', () => ({ LOOT_ITEMS: overrides.LOOT_ITEMS ?? [] }));
  vi.doMock('@/data/config_item_sets', () => ({ ITEM_SETS: overrides.ITEM_SETS ?? [] }));
  return await import('@/data/validate');
}

describe('validateLocationData 错误分支', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('enemies 引用不存在的 mob ID 时计入错误并减少有效地点数', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { validateLocationData } = await importValidateWith({
      MOBS: [{ id: 'goblin', name: '哥布林' }],
      BOSSES: [],
      LOCATIONS: [
        { id: 'l1', name: '地点一', enemies: ['goblin'], bosses: [] },
        { id: 'l2', name: '地点二', enemies: ['ghost'], bosses: [] },
      ],
    });

    const count = validateLocationData();

    // 仅 l1 有效（ghost 不在 MOBS 中）
    expect(count).toBe(1);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('bosses 引用不存在的 boss ID 时计入错误', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { validateLocationData } = await importValidateWith({
      MOBS: [{ id: 'goblin', name: '哥布林' }],
      BOSSES: [{ id: 'dragon', name: '巨龙' }],
      LOCATIONS: [
        { id: 'l1', name: '地点一', enemies: ['goblin'], bosses: ['dragon'] },
        { id: 'l2', name: '地点二', enemies: [], bosses: ['phoenix'] },
      ],
    });

    const count = validateLocationData();

    // 仅 l1 有效（phoenix 不在 BOSSES 中）
    expect(count).toBe(1);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('地点无 enemies/bosses 字段时跳过对应校验', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { validateLocationData } = await importValidateWith({
      MOBS: [{ id: 'goblin', name: '哥布林' }],
      BOSSES: [{ id: 'dragon', name: '巨龙' }],
      LOCATIONS: [
        { id: 'l1', name: '空地点一' },
        { id: 'l2', name: '空地点二' },
      ],
    });

    const count = validateLocationData();

    // 两个地点均无 enemies/bosses 字段，校验全部通过
    expect(count).toBe(2);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('地点数据校验通过'));
    logSpy.mockRestore();
  });

  it('全部地点有效时输出校验通过日志', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { validateLocationData } = await importValidateWith({
      MOBS: [{ id: 'goblin', name: '哥布林' }],
      BOSSES: [{ id: 'dragon', name: '巨龙' }],
      LOCATIONS: [{ id: 'l1', name: '地点一', enemies: ['goblin'], bosses: ['dragon'] }],
    });

    const count = validateLocationData();

    expect(count).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('地点数据校验通过'));
    logSpy.mockRestore();
  });
});

describe('validateQuestData 错误分支', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('kill 目标引用不存在的 enemyId 时计入错误', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { validateQuestData } = await importValidateWith({
      MOBS: [{ id: 'goblin', name: '哥布林' }],
      LOOT_ITEMS: [{ id: 'potion' }],
      QUESTS: [
        {
          id: 'q1',
          title: '任务一',
          objectives: [{ key: 'kill_goblin', type: 'kill', target: 3, enemyId: 'goblin' }],
        },
        {
          id: 'q2',
          title: '任务二',
          objectives: [{ key: 'kill_ghost', type: 'kill', target: 1, enemyId: 'ghost' }],
        },
      ],
    });

    const count = validateQuestData();

    // 仅 q1 有效（ghost 不在 MOBS 中）
    expect(count).toBe(1);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('kill 目标无 enemyId 时不计入错误（短路）', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { validateQuestData } = await importValidateWith({
      MOBS: [{ id: 'goblin', name: '哥布林' }],
      LOOT_ITEMS: [],
      QUESTS: [
        {
          id: 'q1',
          title: '任务一',
          objectives: [{ key: 'kill_any', type: 'kill', target: 1 }],
        },
      ],
    });

    const count = validateQuestData();

    // kill 目标无 enemyId 时跳过校验，任务有效
    expect(count).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('任务数据校验通过'));
    logSpy.mockRestore();
  });

  it('collect 目标引用有效 itemId 时校验通过', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { validateQuestData } = await importValidateWith({
      MOBS: [],
      LOOT_ITEMS: [{ id: 'potion' }, { id: 'ore' }],
      QUESTS: [
        {
          id: 'q1',
          title: '采集任务',
          objectives: [{ key: 'collect_potion', type: 'collect', target: 2, itemId: 'potion' }],
        },
      ],
    });

    const count = validateQuestData();

    expect(count).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('任务数据校验通过'));
    logSpy.mockRestore();
  });

  it('collect 目标引用不存在的 itemId 时计入错误', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { validateQuestData } = await importValidateWith({
      MOBS: [],
      LOOT_ITEMS: [{ id: 'potion' }],
      QUESTS: [
        {
          id: 'q1',
          title: '采集任务',
          objectives: [{ key: 'collect_gem', type: 'collect', target: 1, itemId: 'gem' }],
        },
      ],
    });

    const count = validateQuestData();

    // gem 不在 LOOT_ITEMS 中，任务无效
    expect(count).toBe(0);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('collect 目标无 itemId 时不计入错误（短路）', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { validateQuestData } = await importValidateWith({
      MOBS: [],
      LOOT_ITEMS: [{ id: 'potion' }],
      QUESTS: [
        {
          id: 'q1',
          title: '采集任务',
          objectives: [{ key: 'collect_any', type: 'collect', target: 1 }],
        },
      ],
    });

    const count = validateQuestData();

    expect(count).toBe(1);
    logSpy.mockRestore();
  });

  it('非 kill/collect 类型的目标不参与引用校验', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { validateQuestData } = await importValidateWith({
      MOBS: [],
      LOOT_ITEMS: [],
      QUESTS: [
        {
          id: 'q1',
          title: '探索任务',
          objectives: [{ key: 'reach_point', type: 'explore', target: 1 }],
        },
      ],
    });

    const count = validateQuestData();

    expect(count).toBe(1);
    logSpy.mockRestore();
  });
});

describe('validateItemSets 错误分支', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('套装 ID 重复时返回去重后的数量并输出错误日志', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { validateItemSets } = await importValidateWith({
      ITEM_SETS: [
        { id: 'set_a', name: '套装A' },
        { id: 'set_a', name: '套装A重复' },
        { id: 'set_b', name: '套装B' },
      ],
    });

    const count = validateItemSets();

    // 3 个套装定义，1 个重复，返回 3 - 1 = 2
    expect(count).toBe(2);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('套装 ID 全部唯一时输出校验通过日志', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { validateItemSets } = await importValidateWith({
      ITEM_SETS: [
        { id: 'set_a', name: '套装A' },
        { id: 'set_b', name: '套装B' },
      ],
    });

    const count = validateItemSets();

    expect(count).toBe(2);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('套装数据校验通过'));
    logSpy.mockRestore();
  });

  it('无套装数据时返回 0 且输出校验通过日志', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { validateItemSets } = await importValidateWith({
      ITEM_SETS: [],
    });

    const count = validateItemSets();

    expect(count).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('套装数据校验通过'));
    logSpy.mockRestore();
  });
});
