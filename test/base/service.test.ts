/**
 * @fileoverview 基础数据模块 service 纯函数单元测试
 *
 * 覆盖范围：
 * 1. arrayToRecord —— 以 id 为键将数组转为 Record
 * 2. filterRacesByFaction —— 按阵营筛选种族
 * 3. filterClassesByRace —— 按种族筛选职业
 * 4. filterClassesByFaction —— 按阵营筛选职业
 * 5. generateId（重新导出）—— 验证从 base/service 可访问
 */
import { describe, it, expect } from 'vitest';
import {
  arrayToRecord,
  filterRacesByFaction,
  filterClassesByRace,
  filterClassesByFaction,
  generateId,
} from '@/modules/base/service';
import type { RaceData, ClassData, FactionType, RaceType } from '@/modules/character/types';

/** 构造测试用种族数据 */
function makeRace(overrides: Partial<RaceData> = {}): RaceData {
  return {
    id: 'human',
    name: '人类',
    icon: 'game-icons:human',
    factionId: 'alliance',
    description: '人类种族',
    ...overrides,
  } as RaceData;
}

/** 构造测试用职业数据 */
function makeClass(overrides: Partial<ClassData> = {}): ClassData {
  return {
    id: 'warrior',
    name: '战士',
    icon: 'game-icons:sword',
    primaryStat: 'str',
    factionsIds: ['alliance', 'horde'],
    raceIds: ['human', 'orc'],
    description: '战士职业',
    color: '#C79C6E',
    ...overrides,
  } as ClassData;
}

describe('arrayToRecord 数组转 Record', () => {
  it('将数组转为以 id 为键的 Record', () => {
    const items = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    const record = arrayToRecord(items);
    expect(record.a).toEqual({ id: 'a', name: 'A' });
    expect(record.b).toEqual({ id: 'b', name: 'B' });
  });

  it('空数组返回空对象', () => {
    expect(arrayToRecord([])).toEqual({});
  });

  it('单元素数组正确转换', () => {
    const items = [{ id: 'only', val: 1 }];
    const record = arrayToRecord(items);
    expect(record.only).toEqual({ id: 'only', val: 1 });
    expect(Object.keys(record)).toHaveLength(1);
  });

  it('重复 id 后者覆盖前者', () => {
    const items = [
      { id: 'dup', v: 1 },
      { id: 'dup', v: 2 },
    ];
    const record = arrayToRecord(items);
    expect(record.dup.v).toBe(2);
  });

  it('保留对象引用', () => {
    const obj = { id: 'ref', data: { x: 1 } };
    const record = arrayToRecord([obj]);
    expect(record.ref).toBe(obj);
  });
});

describe('filterRacesByFaction 按阵营筛选种族', () => {
  it('只返回匹配阵营的种族', () => {
    const races = [
      makeRace({ id: 'human', factionId: 'alliance' }),
      makeRace({ id: 'orc', factionId: 'horde' }),
      makeRace({ id: 'pandaren', factionId: 'neutral' }),
    ];
    const result = filterRacesByFaction(races, 'alliance');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('human');
  });

  it('返回多个匹配阵营的种族', () => {
    const races = [
      makeRace({ id: 'human', factionId: 'alliance' }),
      makeRace({ id: 'dwarf', factionId: 'alliance' }),
      makeRace({ id: 'orc', factionId: 'horde' }),
    ];
    const result = filterRacesByFaction(races, 'alliance' as FactionType);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.id).sort()).toEqual(['dwarf', 'human']);
  });

  it('无匹配时返回空数组', () => {
    const races = [makeRace({ id: 'human', factionId: 'alliance' })];
    expect(filterRacesByFaction(races, 'horde' as FactionType)).toEqual([]);
  });

  it('空数组返回空数组', () => {
    expect(filterRacesByFaction([], 'alliance')).toEqual([]);
  });

  it('不修改原数组', () => {
    const races = [
      makeRace({ id: 'human', factionId: 'alliance' }),
      makeRace({ id: 'orc', factionId: 'horde' }),
    ];
    const snapshot = [...races];
    filterRacesByFaction(races, 'alliance');
    expect(races).toEqual(snapshot);
  });
});

describe('filterClassesByRace 按种族筛选职业', () => {
  it('返回 raceIds 包含指定种族的职业', () => {
    const classes = [
      makeClass({ id: 'warrior', raceIds: ['human', 'orc'] }),
      makeClass({ id: 'mage', raceIds: ['human'] }),
      makeClass({ id: 'druid', raceIds: ['night_elf'] }),
    ];
    const result = filterClassesByRace(classes, 'human' as RaceType);
    expect(result).toHaveLength(2);
    expect(result.map(c => c.id).sort()).toEqual(['mage', 'warrior']);
  });

  it('无匹配时返回空数组', () => {
    const classes = [makeClass({ id: 'warrior', raceIds: ['orc'] })];
    expect(filterClassesByRace(classes, 'human' as RaceType)).toEqual([]);
  });

  it('空数组返回空数组', () => {
    expect(filterClassesByRace([], 'human' as RaceType)).toEqual([]);
  });

  it('raceIds 为空数组的职业不会被任何种族匹配', () => {
    const classes = [makeClass({ id: 'special', raceIds: [] })];
    expect(filterClassesByRace(classes, 'human' as RaceType)).toEqual([]);
  });

  it('同一职业匹配多个种族之一即返回', () => {
    const classes = [makeClass({ id: 'paladin', raceIds: ['human', 'dwarf', 'draenei'] })];
    expect(filterClassesByRace(classes, 'draenei' as RaceType)).toHaveLength(1);
  });
});

describe('filterClassesByFaction 按阵营筛选职业', () => {
  it('返回 factionsIds 包含指定阵营的职业', () => {
    const classes = [
      makeClass({ id: 'warrior', factionsIds: ['alliance', 'horde'] }),
      makeClass({ id: 'paladin', factionsIds: ['alliance'] }),
      makeClass({ id: 'shaman', factionsIds: ['horde'] }),
    ];
    const result = filterClassesByFaction(classes, 'alliance');
    expect(result).toHaveLength(2);
    expect(result.map(c => c.id).sort()).toEqual(['paladin', 'warrior']);
  });

  it('无匹配时返回空数组', () => {
    const classes = [makeClass({ id: 'paladin', factionsIds: ['alliance'] })];
    expect(filterClassesByFaction(classes, 'horde' as FactionType)).toEqual([]);
  });

  it('空数组返回空数组', () => {
    expect(filterClassesByFaction([], 'alliance')).toEqual([]);
  });

  it('factionsIds 为空数组的职业不会被任何阵营匹配', () => {
    const classes = [makeClass({ id: 'special', factionsIds: [] })];
    expect(filterClassesByFaction(classes, 'alliance')).toEqual([]);
  });

  it('中立阵营职业正确匹配', () => {
    const classes = [makeClass({ id: 'monk', factionsIds: ['alliance', 'horde', 'neutral'] })];
    expect(filterClassesByFaction(classes, 'neutral' as FactionType)).toHaveLength(1);
  });
});

describe('generateId 重新导出验证', () => {
  it('base/service 导出的 generateId 可正常工作', () => {
    const id = generateId('base');
    expect(id.startsWith('base_')).toBe(true);
  });

  it('多次调用生成不同 ID', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      ids.add(generateId('test'));
    }
    expect(ids.size).toBe(20);
  });
});
