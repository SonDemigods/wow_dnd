/**
 * @fileoverview 地图模块服务函数单元测试
 * @description 测试地点查询、解锁检查、区域状态判定等纯函数
 */
import { describe, it, expect } from 'vitest';
import {
  getLocationById,
  isLocationAccessible,
  getZoneStatus,
  getLocationsByContinent
} from '@/modules/map/service';
import type { LocationData, MapState } from '@/modules/map/types';

/** 创建测试用地点数据 */
function makeLocation(overrides: Partial<LocationData> = {}): LocationData {
  return {
    id: 'loc_001',
    name: '艾尔文森林',
    icon: 'game-icons:forest',
    description: '新手区域',
    continent: 'eastern_kingdoms',
    levelRange: [1, 10],
    color: '#green',
    mapX: 100,
    mapY: 200,
    type: 'location',
    ...overrides
  };
}

/** 创建测试用地图状态 */
function makeMapState(overrides: Partial<MapState> = {}): MapState {
  return {
    view: { zoomLevel: 1, panX: 0, panY: 0 },
    unlockedZones: [],
    completedZones: [],
    ...overrides
  };
}

describe('getLocationById', () => {
  it('存在指定 ID 时返回地点', () => {
    const loc = makeLocation({ id: 'loc_001' });
    const locations = new Map([['loc_001', loc]]);
    expect(getLocationById(locations, 'loc_001')).toBe(loc);
  });

  it('不存在指定 ID 时返回 undefined', () => {
    const locations = new Map();
    expect(getLocationById(locations, 'loc_999')).toBeUndefined();
  });

  it('空 Map 时返回 undefined', () => {
    const locations = new Map();
    expect(getLocationById(locations, 'any')).toBeUndefined();
  });
});

describe('isLocationAccessible', () => {
  it('角色等级等于最低等级时可访问', () => {
    const loc = makeLocation({ levelRange: [5, 10] });
    expect(isLocationAccessible(loc, 5)).toBe(true);
  });

  it('角色等级高于最低等级时可访问', () => {
    const loc = makeLocation({ levelRange: [5, 10] });
    expect(isLocationAccessible(loc, 8)).toBe(true);
  });

  it('角色等级低于最低等级时不可访问', () => {
    const loc = makeLocation({ levelRange: [5, 10] });
    expect(isLocationAccessible(loc, 4)).toBe(false);
  });

  it('角色等级为 0 时不可访问（当最低等级大于 0）', () => {
    const loc = makeLocation({ levelRange: [1, 10] });
    expect(isLocationAccessible(loc, 0)).toBe(false);
  });

  it('最低等级为 0 时等级 0 可访问', () => {
    const loc = makeLocation({ levelRange: [0, 5] });
    expect(isLocationAccessible(loc, 0)).toBe(true);
  });
});

describe('getZoneStatus', () => {
  it('区域在 completedZones 中时返回 completed', () => {
    const loc = makeLocation({ levelRange: [5, 10] });
    const state = makeMapState({ completedZones: ['zone_001'] });
    expect(getZoneStatus(state, 'zone_001', loc, 1)).toBe('completed');
  });

  it('completed 优先级高于 unlocked', () => {
    const loc = makeLocation({ levelRange: [5, 10] });
    const state = makeMapState({
      completedZones: ['zone_001'],
      unlockedZones: ['zone_001']
    });
    expect(getZoneStatus(state, 'zone_001', loc, 1)).toBe('completed');
  });

  it('区域在 unlockedZones 中时返回 unlocked', () => {
    const loc = makeLocation({ levelRange: [5, 10] });
    const state = makeMapState({ unlockedZones: ['zone_001'] });
    expect(getZoneStatus(state, 'zone_001', loc, 1)).toBe('unlocked');
  });

  it('unlocked 优先级高于等级满足', () => {
    const loc = makeLocation({ levelRange: [1, 10] });
    const state = makeMapState({ unlockedZones: ['zone_001'] });
    expect(getZoneStatus(state, 'zone_001', loc, 5)).toBe('unlocked');
  });

  it('区域不在 unlocked/completed 但等级满足时返回 unlocked', () => {
    const loc = makeLocation({ levelRange: [5, 10] });
    const state = makeMapState();
    expect(getZoneStatus(state, 'zone_001', loc, 5)).toBe('unlocked');
  });

  it('区域不在 unlocked/completed 且等级不满足时返回 locked', () => {
    const loc = makeLocation({ levelRange: [5, 10] });
    const state = makeMapState();
    expect(getZoneStatus(state, 'zone_001', loc, 3)).toBe('locked');
  });

  it('completedZones 为 undefined 时不报错', () => {
    const loc = makeLocation({ levelRange: [1, 10] });
    const state = makeMapState({ completedZones: undefined });
    expect(getZoneStatus(state, 'zone_001', loc, 1)).toBe('unlocked');
  });

  it('unlockedZones 为 undefined 时不报错', () => {
    const loc = makeLocation({ levelRange: [1, 10] });
    const state = makeMapState({ unlockedZones: undefined });
    expect(getZoneStatus(state, 'zone_001', loc, 1)).toBe('unlocked');
  });

  it('等级满足且 completed/unlocked 均为 undefined 时返回 unlocked', () => {
    const loc = makeLocation({ levelRange: [5, 10] });
    const state = makeMapState({ completedZones: undefined, unlockedZones: undefined });
    expect(getZoneStatus(state, 'zone_001', loc, 5)).toBe('unlocked');
  });
});

describe('getLocationsByContinent', () => {
  it('返回指定大陆下的所有地点', () => {
    const loc1 = makeLocation({ id: 'loc_1', continent: 'eastern_kingdoms' });
    const loc2 = makeLocation({ id: 'loc_2', continent: 'kalimdor' });
    const loc3 = makeLocation({ id: 'loc_3', continent: 'eastern_kingdoms' });
    const locations = new Map([
      ['loc_1', loc1],
      ['loc_2', loc2],
      ['loc_3', loc3]
    ]);
    const result = getLocationsByContinent(locations, 'eastern_kingdoms');
    expect(result).toHaveLength(2);
    expect(result.map(l => l.id)).toEqual(expect.arrayContaining(['loc_1', 'loc_3']));
  });

  it('无匹配大陆时返回空数组', () => {
    const loc1 = makeLocation({ continent: 'eastern_kingdoms' });
    const locations = new Map([['loc_1', loc1]]);
    expect(getLocationsByContinent(locations, 'kalimdor')).toEqual([]);
  });

  it('空 Map 时返回空数组', () => {
    const locations = new Map();
    expect(getLocationsByContinent(locations, 'any')).toEqual([]);
  });

  it('所有地点都属于指定大陆时全部返回', () => {
    const loc1 = makeLocation({ id: 'loc_1', continent: 'kalimdor' });
    const loc2 = makeLocation({ id: 'loc_2', continent: 'kalimdor' });
    const locations = new Map([
      ['loc_1', loc1],
      ['loc_2', loc2]
    ]);
    const result = getLocationsByContinent(locations, 'kalimdor');
    expect(result).toHaveLength(2);
  });
});
