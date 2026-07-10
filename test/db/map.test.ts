/**
 * @fileoverview 地图模块数据层（map/db.ts）内存级 CRUD 测试
 *
 * 使用 fake-indexeddb 在内存中真实执行 Dexie 操作，覆盖：
 *  - saveMapState / getMapState / clearMapState：地图状态表 runtime_mapState 的 CRUD（按角色ID隔离）
 *  - saveCurrentLocationId / getCurrentLocationId：当前区域 ID 的合并写入
 *  - saveCurrentTab / getCurrentTab：当前标签页的合并写入
 *  - getLocationData / getAllLocationData：地点表 config_locations 的读取 + where('type').equals('location') 索引查询
 *  - 事务合并写入：saveMapState 与 saveCurrentLocationId / saveCurrentTab 写入同一记录的不同字段
 *
 * 设计说明（遵循 code_rule 红线）：
 *  - 顶部 `import 'fake-indexeddb/auto'` 注入 IndexedDB shim
 *  - beforeEach 清空 runtime_mapState 与 config_locations 两张表
 *  - 不 mock db service，验证事务合并写入与 where().equals() 索引查询真实行为
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { mapDbService } from '@/modules/map/db';
import { db } from '@/modules/data/core';
import type { MapState, LocationStorage } from '@/modules/map/types';

// ==================== 测试数据构造 helper ====================

function makeMapState(o: Partial<MapState> = {}): MapState {
  return {
    view: { zoomLevel: 1, panX: 0, panY: 0 },
    unlockedZones: ['zone-1'],
    completedZones: [],
    ...o,
  };
}

function makeLocationStorage(o: Partial<LocationStorage> = {}): LocationStorage {
  return {
    id: 'loc-1',
    name: '森林',
    icon: 'game-icons:forest',
    description: '一片幽暗的森林',
    type: 'location',
    continent: 'main',
    enemies: ['spider'],
    bosses: ['boss-1'],
    quests: ['quest-1'],
    levelRange: [1, 5],
    color: '#228B22',
    mapX: 100,
    mapY: 200,
    ...o,
  };
}

// ==================== 测试用例 ====================

describe('MapDbService - 地图数据层（fake-indexeddb 真实 CRUD）', () => {
  beforeEach(async () => {
    await Promise.all([
      db.runtime_mapState.clear(),
      db.config_locations.clear(),
    ]);
  });

  // -------------------- runtime_mapState 表 --------------------

  describe('saveMapState / getMapState：地图状态读写', () => {
    it('保存地图状态后可读回完整数据', async () => {
      const state = makeMapState({
        view: { zoomLevel: 2, panX: 10, panY: 20 },
        unlockedZones: ['zone-1', 'zone-2'],
        completedZones: ['zone-1'],
      });
      await mapDbService.saveMapState('char-1', state);

      const result = await mapDbService.getMapState('char-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('map_char-1');
      expect(result!.view).toEqual({ zoomLevel: 2, panX: 10, panY: 20 });
      expect(result!.unlockedZones).toEqual(['zone-1', 'zone-2']);
      expect(result!.completedZones).toEqual(['zone-1']);
    });

    it('角色不存在时 getMapState 返回 null', async () => {
      const result = await mapDbService.getMapState('non-existent');
      expect(result).toBeNull();
    });

    it('覆盖保存：相同角色再次保存，新数据替换旧数据', async () => {
      await mapDbService.saveMapState('char-1', makeMapState({ unlockedZones: ['old'] }));
      await mapDbService.saveMapState('char-1', makeMapState({ unlockedZones: ['new'] }));

      const result = await mapDbService.getMapState('char-1');
      expect(result!.unlockedZones).toEqual(['new']);
    });

    it('多角色并存：不同 characterId 各自独立', async () => {
      await mapDbService.saveMapState('char-1', makeMapState({ unlockedZones: ['a'] }));
      await mapDbService.saveMapState('char-2', makeMapState({ unlockedZones: ['b'] }));

      expect((await mapDbService.getMapState('char-1'))!.unlockedZones).toEqual(['a']);
      expect((await mapDbService.getMapState('char-2'))!.unlockedZones).toEqual(['b']);
    });
  });

  describe('saveCurrentLocationId / getCurrentLocationId：当前区域 ID 读写', () => {
    it('保存当前区域 ID 后可读回', async () => {
      await mapDbService.saveCurrentLocationId('char-1', 'forest-1');

      const result = await mapDbService.getCurrentLocationId('char-1');
      expect(result).toBe('forest-1');
    });

    it('角色不存在时 getCurrentLocationId 返回 null', async () => {
      const result = await mapDbService.getCurrentLocationId('non-existent');
      expect(result).toBeNull();
    });

    it('覆盖保存：相同角色再次保存，新 ID 替换旧 ID', async () => {
      await mapDbService.saveCurrentLocationId('char-1', 'old-loc');
      await mapDbService.saveCurrentLocationId('char-1', 'new-loc');

      const result = await mapDbService.getCurrentLocationId('char-1');
      expect(result).toBe('new-loc');
    });

    it('多角色并存：不同 characterId 各自独立', async () => {
      await mapDbService.saveCurrentLocationId('char-1', 'loc-a');
      await mapDbService.saveCurrentLocationId('char-2', 'loc-b');

      expect(await mapDbService.getCurrentLocationId('char-1')).toBe('loc-a');
      expect(await mapDbService.getCurrentLocationId('char-2')).toBe('loc-b');
    });
  });

  describe('saveCurrentTab / getCurrentTab：当前标签页读写', () => {
    it('保存当前标签页后可读回', async () => {
      await mapDbService.saveCurrentTab('char-1', 'quests');

      const result = await mapDbService.getCurrentTab('char-1');
      expect(result).toBe('quests');
    });

    it('角色不存在时 getCurrentTab 返回 null', async () => {
      const result = await mapDbService.getCurrentTab('non-existent');
      expect(result).toBeNull();
    });

    it('覆盖保存：相同角色再次保存，新标签替换旧标签', async () => {
      await mapDbService.saveCurrentTab('char-1', 'shop');
      await mapDbService.saveCurrentTab('char-1', 'quests');

      const result = await mapDbService.getCurrentTab('char-1');
      expect(result).toBe('quests');
    });

    it('多角色并存：不同 characterId 各自独立', async () => {
      await mapDbService.saveCurrentTab('char-1', 'tab-a');
      await mapDbService.saveCurrentTab('char-2', 'tab-b');

      expect(await mapDbService.getCurrentTab('char-1')).toBe('tab-a');
      expect(await mapDbService.getCurrentTab('char-2')).toBe('tab-b');
    });
  });

  describe('事务合并写入：saveMapState 与 saveCurrentLocationId / saveCurrentTab', () => {
    it('先 saveMapState 再 saveCurrentLocationId，两个字段共存于同一记录', async () => {
      await mapDbService.saveMapState('char-1', makeMapState({ unlockedZones: ['zone-1'] }));
      await mapDbService.saveCurrentLocationId('char-1', 'forest-1');

      const state = await mapDbService.getMapState('char-1');
      expect(state).not.toBeNull();
      expect(state!.unlockedZones).toEqual(['zone-1']); // 旧字段保留
      expect(state!.currentLocationId).toBe('forest-1'); // 新字段合并
    });

    it('先 saveCurrentLocationId 再 saveMapState，两个字段共存于同一记录', async () => {
      await mapDbService.saveCurrentLocationId('char-1', 'cave-1');
      await mapDbService.saveMapState('char-1', makeMapState({ completedZones: ['zone-1'] }));

      const state = await mapDbService.getMapState('char-1');
      expect(state).not.toBeNull();
      expect(state!.currentLocationId).toBe('cave-1'); // 旧字段保留
      expect(state!.completedZones).toEqual(['zone-1']); // 新字段合并
    });

    it('saveCurrentTab 与 saveCurrentLocationId 合并写入同一记录', async () => {
      await mapDbService.saveCurrentLocationId('char-1', 'forest-1');
      await mapDbService.saveCurrentTab('char-1', 'quests');

      const state = await mapDbService.getMapState('char-1');
      expect(state).not.toBeNull();
      expect(state!.currentLocationId).toBe('forest-1');
      expect(state!.currentTab).toBe('quests');
    });

    it('saveMapState 不会清除已存在的 currentLocationId', async () => {
      await mapDbService.saveCurrentLocationId('char-1', 'keep-loc');
      await mapDbService.saveMapState('char-1', makeMapState());

      // saveMapState 仅写入 view/unlockedZones/completedZones，合并已有记录
      const loc = await mapDbService.getCurrentLocationId('char-1');
      expect(loc).toBe('keep-loc');
    });

    it('saveCurrentLocationId 不会清除已存在的 view 状态', async () => {
      await mapDbService.saveMapState('char-1', makeMapState({ view: { zoomLevel: 5, panX: 1, panY: 2 } }));
      await mapDbService.saveCurrentLocationId('char-1', 'new-loc');

      const state = await mapDbService.getMapState('char-1');
      expect(state).not.toBeNull();
      expect(state!.view).toEqual({ zoomLevel: 5, panX: 1, panY: 2 });
      expect(state!.currentLocationId).toBe('new-loc');
    });
  });

  describe('clearMapState：清空地图状态', () => {
    it('清空指定角色后 getMapState 返回 null', async () => {
      await mapDbService.saveMapState('char-1', makeMapState());
      expect(await mapDbService.getMapState('char-1')).not.toBeNull();

      await mapDbService.clearMapState('char-1');
      expect(await mapDbService.getMapState('char-1')).toBeNull();
    });

    it('清空不影响其他角色', async () => {
      await mapDbService.saveMapState('char-1', makeMapState({ unlockedZones: ['a'] }));
      await mapDbService.saveMapState('char-2', makeMapState({ unlockedZones: ['b'] }));

      await mapDbService.clearMapState('char-1');
      expect(await mapDbService.getMapState('char-1')).toBeNull();
      expect((await mapDbService.getMapState('char-2'))!.unlockedZones).toEqual(['b']);
    });

    it('清空不存在的角色不抛错', async () => {
      await expect(mapDbService.clearMapState('non-existent')).resolves.toBeUndefined();
    });
  });

  // -------------------- config_locations 表 --------------------

  describe('getLocationData：单地点读取与字段映射', () => {
    it('保存地点后可读回，mapToLocationData 正确转换字段', async () => {
      const loc = makeLocationStorage({
        id: 'forest',
        name: '幽暗森林',
        continent: 'main-continent',
        levelRange: [2, 8],
        color: '#228B22',
        mapX: 150,
        mapY: 250,
      });
      await db.config_locations.put(loc);

      const result = await mapDbService.getLocationData('forest');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('forest');
      expect(result!.name).toBe('幽暗森林');
      expect(result!.icon).toBe('game-icons:forest');
      expect(result!.description).toBe('一片幽暗的森林');
      expect(result!.continent).toBe('main-continent');
      expect(result!.enemies).toEqual(['spider']);
      expect(result!.bosses).toEqual(['boss-1']);
      expect(result!.quests).toEqual(['quest-1']);
      expect(result!.levelRange).toEqual([2, 8]);
      expect(result!.color).toBe('#228B22');
      expect(result!.mapX).toBe(150);
      expect(result!.mapY).toBe(250);
      expect(result!.type).toBe('location');
    });

    it('地点不存在时返回 null', async () => {
      const result = await mapDbService.getLocationData('non-existent');
      expect(result).toBeNull();
    });

    it('可选字段缺失时使用默认值（continent=""、levelRange=[1,1]、color="#000000"、mapX=0、mapY=0）', async () => {
      await db.config_locations.put({
        id: 'minimal',
        name: '最小地点',
        icon: 'icon',
        description: '',
        type: 'location',
      } as LocationStorage);

      const result = await mapDbService.getLocationData('minimal');
      expect(result).not.toBeNull();
      expect(result!.continent).toBe('');
      expect(result!.levelRange).toEqual([1, 1]);
      expect(result!.color).toBe('#000000');
      expect(result!.mapX).toBe(0);
      expect(result!.mapY).toBe(0);
      expect(result!.type).toBe('location');
    });
  });

  describe('getAllLocationData：where(type).equals(location) 索引查询', () => {
    it('空表返回空数组', async () => {
      const result = await mapDbService.getAllLocationData();
      expect(result).toEqual([]);
    });

    it('仅返回 type=location 的地点，排除 type=continent 的大陆数据', async () => {
      await db.config_locations.put(makeLocationStorage({ id: 'loc-1', name: '森林', type: 'location' }));
      await db.config_locations.put(makeLocationStorage({ id: 'loc-2', name: '洞穴', type: 'location' }));
      await db.config_locations.put({
        id: 'cont-1',
        name: '主大陆',
        icon: 'icon',
        description: '',
        type: 'continent',
        position: 'center',
      } as LocationStorage);

      const result = await mapDbService.getAllLocationData();
      expect(result).toHaveLength(2);
      const ids = result.map(l => l.id).sort();
      expect(ids).toEqual(['loc-1', 'loc-2']);
      // 验证 continent 类型数据被排除
      expect(result.find(l => l.id === 'cont-1')).toBeUndefined();
    });

    it('多地点时全部返回，且字段被 mapToLocationData 转换', async () => {
      await db.config_locations.put(makeLocationStorage({ id: 'a', name: 'A' }));
      await db.config_locations.put(makeLocationStorage({ id: 'b', name: 'B' }));
      await db.config_locations.put(makeLocationStorage({ id: 'c', name: 'C' }));

      const result = await mapDbService.getAllLocationData();
      expect(result).toHaveLength(3);
      expect(result.every(l => l.type === 'location')).toBe(true);
    });
  });
});
