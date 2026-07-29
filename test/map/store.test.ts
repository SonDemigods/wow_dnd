/**
 * @fileoverview 地图模块 Pinia Store 单元测试
 *
 * 覆盖 useMapStore 的：
 * 1. State 初始值（state.view 默认视图、currentLocation null、initialized false）
 * 2. Getters：getView / getCurrentLocation
 * 3. Actions：
 *    - initialize（加载 locations / 恢复 savedState / 恢复 currentLocation）
 *    - enterZone（切换 currentLocation + emit ZONE_ENTERED / 地点不存在返回 false）
 *    - isLocationUnlocked（地点不存在 / 等级满足 / 等级不足）
 *    - zoomTo / panTo / resetView（视图状态与边界 clamp）
 *    - setCurrentContinent / getState / saveCurrentTab / getCurrentTab
 *    - clearUIState（重置 state/currentLocation/locations/initialized）
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - mapDbService 全量 mock，避免触碰真实 IndexedDB。
 *  - map service 纯函数（getLocationById/isLocationAccessible/getLocationsByContinent/getZoneStatus）全量 mock。
 *  - eventBus 使用真实实现，通过 eventBus.on(ZONE_ENTERED, spy) 断言 emit，
 *    beforeEach 调用 eventBus.clearAll() 清理监听器。
 *  - locations/currentCharacterId 为 store 内部状态未导出，通过 getZones 遍历、
 *    saveMapState 调用等间接验证。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestPinia } from '../utils/setup';
import { eventBus, GameEvents } from '@/modules/bus';
import type { LocationData, MapState } from '@/modules/map/types';

/** mock 地图 DB 层 */
vi.mock('@/modules/map/db', () => ({
  mapDbService: {
    saveMapState: vi.fn().mockResolvedValue(undefined),
    getMapState: vi.fn().mockResolvedValue(null),
    getAllLocationData: vi.fn().mockResolvedValue([]),
    saveCurrentLocationId: vi.fn().mockResolvedValue(undefined),
    getCurrentLocationId: vi.fn().mockResolvedValue(null),
    saveCurrentTab: vi.fn().mockResolvedValue(undefined),
    getCurrentTab: vi.fn().mockResolvedValue(null),
  },
}));

/** mock 地图 service 纯函数 */
vi.mock('@/modules/map/service', () => ({
  getLocationById: vi.fn(),
  isLocationAccessible: vi.fn(),
  getLocationsByContinent: vi.fn(),
  getZoneStatus: vi.fn(),
  clamp: vi.fn((v: number, min: number, max: number) => Math.max(min, Math.min(max, v))),
}));

/** 从 mock 中取出 spy 引用，便于断言 */
import { mapDbService } from '@/modules/map/db';
import {
  getLocationById,
  isLocationAccessible,
  getLocationsByContinent,
  getZoneStatus,
  clamp,
} from '@/modules/map/service';
import { useMapStore } from '@/modules/map/store';

// ==================== 测试数据构造 helper ====================

function makeLocation(o: Partial<LocationData> = {}): LocationData {
  return {
    id: 'loc-1',
    name: '艾尔文森林',
    icon: 'game-icons:forest',
    description: '新手区域',
    continent: 'eastern-kingdoms',
    levelRange: [1, 5],
    color: '#00ff00',
    mapX: 10,
    mapY: 20,
    type: 'location',
    ...o,
  } as LocationData;
}

// ==================== 测试用例 ====================

describe('useMapStore - 地图 Store', () => {
  beforeEach(() => {
    createTestPinia();
    vi.clearAllMocks();
    eventBus.clearAll();
  });

  // -------------------- State 初始值 --------------------
  describe('State 初始值', () => {
    it('state.view 为默认视图（zoomLevel=1, panX=0, panY=0）', () => {
      const store = useMapStore();
      expect(store.state.view).toEqual({ zoomLevel: 1, panX: 0, panY: 0 });
    });

    it('currentLocation 初始为 null', () => {
      const store = useMapStore();
      expect(store.currentLocation).toBeNull();
    });

    it('initialized 初始为 false', () => {
      const store = useMapStore();
      expect(store.initialized).toBe(false);
    });
  });

  // -------------------- Getters --------------------
  describe('Getters', () => {
    it('getView 返回 state.view', () => {
      const store = useMapStore();
      store.$patch({ state: { view: { zoomLevel: 3, panX: 5, panY: 6 } } });
      expect(store.getView).toEqual({ zoomLevel: 3, panX: 5, panY: 6 });
    });

    it('getCurrentLocation 返回 currentLocation', () => {
      const store = useMapStore();
      const loc = makeLocation();
      store.$patch({ currentLocation: loc });
      expect(store.getCurrentLocation).toEqual(loc);
    });

    it('getCurrentLocation 初始为 null', () => {
      const store = useMapStore();
      expect(store.getCurrentLocation).toBeNull();
    });
  });

  // -------------------- Action: initialize --------------------
  describe('Action: initialize', () => {
    it('无 savedState 时使用默认视图，并加载 locations（getZones 可遍历）', async () => {
      vi.mocked(mapDbService.getMapState).mockResolvedValueOnce(null);
      vi.mocked(mapDbService.getAllLocationData).mockResolvedValueOnce([
        makeLocation({ id: 'l1' }),
        makeLocation({ id: 'l2' }),
      ]);
      vi.mocked(mapDbService.getCurrentLocationId).mockResolvedValueOnce(null);
      vi.mocked(getZoneStatus).mockReturnValue('locked');

      const store = useMapStore();
      await store.initialize('c1');

      expect(store.initialized).toBe(true);
      expect(store.state.view).toEqual({ zoomLevel: 1, panX: 0, panY: 0 });
      // locations 已加载（getZones 遍历 locations，返回 2 个区域）
      const zones = store.getZones(1);
      expect(zones).toHaveLength(2);
      expect(getZoneStatus).toHaveBeenCalledTimes(2);
    });

    it('有 savedState 时恢复 view 与 unlockedZones', async () => {
      const saved: MapState = {
        view: { zoomLevel: 4, panX: 10, panY: 15, currentContinentId: 'ek' },
        unlockedZones: ['z1'],
        completedZones: ['z2'],
      };
      vi.mocked(mapDbService.getMapState).mockResolvedValueOnce(saved);
      vi.mocked(mapDbService.getAllLocationData).mockResolvedValueOnce([]);
      vi.mocked(mapDbService.getCurrentLocationId).mockResolvedValueOnce(null);

      const store = useMapStore();
      await store.initialize('c1');

      expect(store.state.view.zoomLevel).toBe(4);
      expect(store.state.view.currentContinentId).toBe('ek');
      expect(store.state.unlockedZones).toEqual(['z1']);
      expect(store.state.completedZones).toEqual(['z2']);
    });

    it('恢复上次选中的 currentLocation', async () => {
      const loc = makeLocation({ id: 'loc-1' });
      vi.mocked(mapDbService.getMapState).mockResolvedValueOnce(null);
      vi.mocked(mapDbService.getAllLocationData).mockResolvedValueOnce([loc]);
      vi.mocked(mapDbService.getCurrentLocationId).mockResolvedValueOnce('loc-1');
      vi.mocked(getLocationById).mockReturnValueOnce(loc);

      const store = useMapStore();
      await store.initialize('c1');

      expect(getLocationById).toHaveBeenCalled();
      expect(store.currentLocation).toEqual(loc);
    });
  });

  // -------------------- Action: enterZone --------------------
  describe('Action: enterZone', () => {
    it('切换 currentLocation 并 emit ZONE_ENTERED，返回 true', () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.ZONE_ENTERED, spy);
      const loc = makeLocation({ id: 'zone-a' });
      vi.mocked(getLocationById).mockReturnValueOnce(loc);

      const store = useMapStore();
      const result = store.enterZone('zone-a');

      expect(result).toBe(true);
      expect(store.currentLocation).toEqual(loc);
      expect(spy).toHaveBeenCalledWith({ locationId: 'zone-a', location: loc });
    });

    it('地点不存在时返回 false 且不 emit', () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.ZONE_ENTERED, spy);
      vi.mocked(getLocationById).mockReturnValueOnce(undefined);

      const store = useMapStore();
      const result = store.enterZone('no-zone');

      expect(result).toBe(false);
      expect(store.currentLocation).toBeNull();
      expect(spy).not.toHaveBeenCalled();
    });

    it('已初始化角色时持久化当前区域 ID（fire-and-forget）', async () => {
      const loc = makeLocation({ id: 'zone-a' });
      vi.mocked(getLocationById).mockReturnValueOnce(loc);
      vi.mocked(mapDbService.getMapState).mockResolvedValueOnce(null);
      vi.mocked(mapDbService.getAllLocationData).mockResolvedValueOnce([]);
      vi.mocked(mapDbService.getCurrentLocationId).mockResolvedValueOnce(null);

      const store = useMapStore();
      await store.initialize('c1');

      store.enterZone('zone-a');
      expect(mapDbService.saveCurrentLocationId).toHaveBeenCalledWith('c1', 'zone-a');
    });
  });

  // -------------------- Action: isLocationUnlocked --------------------
  describe('Action: isLocationUnlocked', () => {
    it('地点不存在时返回 false', () => {
      vi.mocked(getLocationById).mockReturnValueOnce(undefined);
      const store = useMapStore();
      expect(store.isLocationUnlocked('no', 5)).toBe(false);
      expect(isLocationAccessible).not.toHaveBeenCalled();
    });

    it('地点存在且等级满足时返回 true', () => {
      const loc = makeLocation();
      vi.mocked(getLocationById).mockReturnValueOnce(loc);
      vi.mocked(isLocationAccessible).mockReturnValueOnce(true);
      const store = useMapStore();
      expect(store.isLocationUnlocked('loc-1', 5)).toBe(true);
      expect(isLocationAccessible).toHaveBeenCalledWith(loc, 5);
    });

    it('地点存在但等级不足时返回 false', () => {
      const loc = makeLocation();
      vi.mocked(getLocationById).mockReturnValueOnce(loc);
      vi.mocked(isLocationAccessible).mockReturnValueOnce(false);
      const store = useMapStore();
      expect(store.isLocationUnlocked('loc-1', 0)).toBe(false);
    });
  });

  // -------------------- Action: zoomTo / panTo / resetView --------------------
  describe('Action: 视图操作（含 clamp）', () => {
    it('zoomTo 正常值直接设置', () => {
      const store = useMapStore();
      store.zoomTo(3);
      expect(store.state.view.zoomLevel).toBe(3);
    });

    it('zoomTo 低于下限 clamp 到 1', () => {
      const store = useMapStore();
      store.zoomTo(0);
      expect(store.state.view.zoomLevel).toBe(1);
    });

    it('zoomTo 超过上限 clamp 到 5', () => {
      const store = useMapStore();
      store.zoomTo(10);
      expect(store.state.view.zoomLevel).toBe(5);
    });

    it('panTo 正常值直接设置', () => {
      const store = useMapStore();
      store.panTo(20, 30);
      expect(store.state.view.panX).toBe(20);
      expect(store.state.view.panY).toBe(30);
    });

    it('panTo 超出边界 clamp 到 [-50, 50]', () => {
      const store = useMapStore();
      store.panTo(-100, 100);
      expect(store.state.view.panX).toBe(-50);
      expect(store.state.view.panY).toBe(50);
    });

    it('resetView 恢复默认视图', () => {
      const store = useMapStore();
      store.zoomTo(4);
      store.panTo(20, 30);
      store.resetView();
      expect(store.state.view).toEqual({ zoomLevel: 1, panX: 0, panY: 0 });
    });

    it('已初始化角色时视图变更触发 saveMapState', async () => {
      vi.mocked(mapDbService.getMapState).mockResolvedValueOnce(null);
      vi.mocked(mapDbService.getAllLocationData).mockResolvedValueOnce([]);
      vi.mocked(mapDbService.getCurrentLocationId).mockResolvedValueOnce(null);
      const store = useMapStore();
      await store.initialize('c1');
      vi.mocked(mapDbService.saveMapState).mockClear();

      store.zoomTo(3);
      expect(mapDbService.saveMapState).toHaveBeenCalledTimes(1);
      expect(mapDbService.saveMapState).toHaveBeenCalledWith('c1', store.state);
    });

    it('未初始化角色时视图变更不持久化', () => {
      const store = useMapStore();
      store.zoomTo(3);
      expect(mapDbService.saveMapState).not.toHaveBeenCalled();
    });
  });

  // -------------------- Action: setCurrentContinent --------------------
  describe('Action: setCurrentContinent', () => {
    it('设置 view.currentContinentId', () => {
      const store = useMapStore();
      store.setCurrentContinent('kalimdor');
      expect(store.state.view.currentContinentId).toBe('kalimdor');
    });
  });

  // -------------------- Action: getState --------------------
  describe('Action: getState', () => {
    it('返回 state 的深拷贝（含 unlockedZones/completedZones 拷贝）', () => {
      const store = useMapStore();
      store.$patch({
        state: {
          view: { zoomLevel: 2, panX: 1, panY: 1 },
          unlockedZones: ['z1'],
          completedZones: ['z2'],
        },
      });

      const snapshot = store.getState();
      expect(snapshot.view).toEqual({ zoomLevel: 2, panX: 1, panY: 1 });
      expect(snapshot.unlockedZones).toEqual(['z1']);
      expect(snapshot.completedZones).toEqual(['z2']);

      // 修改快照不影响 store
      snapshot.unlockedZones!.push('zX');
      snapshot.view.zoomLevel = 9;
      expect(store.state.view.zoomLevel).toBe(2);
      expect(store.state.unlockedZones).toEqual(['z1']);
    });

    it('unlockedZones/completedZones 未定义时 getState 返回 undefined', () => {
      const store = useMapStore();
      const snapshot = store.getState();
      expect(snapshot.unlockedZones).toBeUndefined();
      expect(snapshot.completedZones).toBeUndefined();
    });
  });

  // -------------------- Action: getLocationData / getLocationsByContinent --------------------
  describe('Action: getLocationData / getLocationsByContinent', () => {
    it('getLocationData 委托 service.getLocationById', () => {
      const loc = makeLocation();
      vi.mocked(getLocationById).mockReturnValueOnce(loc);
      const store = useMapStore();
      expect(store.getLocationData('loc-1')).toEqual(loc);
      expect(getLocationById).toHaveBeenCalledWith(expect.any(Map), 'loc-1');
    });

    it('getLocationsByContinent 委托 service 并返回结果', () => {
      const list = [makeLocation({ id: 'l1' }), makeLocation({ id: 'l2' })];
      vi.mocked(getLocationsByContinent).mockReturnValueOnce(list);
      const store = useMapStore();
      expect(store.getLocationsByContinent('ek')).toEqual(list);
      expect(getLocationsByContinent).toHaveBeenCalledWith(expect.any(Map), 'ek');
    });
  });

  // -------------------- Action: saveCurrentTab / getCurrentTab --------------------
  describe('Action: saveCurrentTab / getCurrentTab', () => {
    it('未初始化角色时 saveCurrentTab 不持久化、getCurrentTab 返回 null', async () => {
      const store = useMapStore();
      await store.saveCurrentTab('zones');
      expect(mapDbService.saveCurrentTab).not.toHaveBeenCalled();
      expect(await store.getCurrentTab()).toBeNull();
    });

    it('已初始化角色时按角色 ID 持久化与读取', async () => {
      vi.mocked(mapDbService.getMapState).mockResolvedValueOnce(null);
      vi.mocked(mapDbService.getAllLocationData).mockResolvedValueOnce([]);
      vi.mocked(mapDbService.getCurrentLocationId).mockResolvedValueOnce(null);
      vi.mocked(mapDbService.getCurrentTab).mockResolvedValueOnce('quests');

      const store = useMapStore();
      await store.initialize('c1');

      await store.saveCurrentTab('zones');
      expect(mapDbService.saveCurrentTab).toHaveBeenCalledWith('c1', 'zones');

      expect(await store.getCurrentTab()).toBe('quests');
      expect(mapDbService.getCurrentTab).toHaveBeenCalledWith('c1');
    });
  });

  // -------------------- Action: clearUIState --------------------
  describe('Action: clearUIState', () => {
    it('重置 state/currentLocation/initialized，并清空 locations', async () => {
      vi.mocked(mapDbService.getMapState).mockResolvedValueOnce(null);
      vi.mocked(mapDbService.getAllLocationData).mockResolvedValueOnce([makeLocation({ id: 'l1' })]);
      vi.mocked(mapDbService.getCurrentLocationId).mockResolvedValueOnce(null);
      vi.mocked(getZoneStatus).mockReturnValue('unlocked');

      const store = useMapStore();
      await store.initialize('c1');
      store.zoomTo(4);
      store.enterZone('l1');
      expect(store.initialized).toBe(true);
      expect(store.getZones(1)).toHaveLength(1);

      store.clearUIState();

      expect(store.state.view).toEqual({ zoomLevel: 1, panX: 0, panY: 0 });
      expect(store.currentLocation).toBeNull();
      expect(store.initialized).toBe(false);
      // locations 已清空，getZones 不再返回区域
      expect(store.getZones(1)).toEqual([]);
    });
  });

  // -------------------- 防御性分支补充 --------------------
  describe('防御性分支补充', () => {
    it('loadLocations：地点缺少 mapX/mapY 坐标时跳过并 console.warn（if FALSE 分支）', async () => {
      // 覆盖 line 73 的 else 分支与 line 76 的 console.warn
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(mapDbService.getMapState).mockResolvedValueOnce(null);
      vi.mocked(mapDbService.getAllLocationData).mockResolvedValueOnce([
        makeLocation({ id: 'has-coords', mapX: 1, mapY: 2 }),
        { ...makeLocation({ id: 'no-coords' }), mapX: null as unknown as number, mapY: null as unknown as number },
      ]);
      vi.mocked(mapDbService.getCurrentLocationId).mockResolvedValueOnce(null);
      vi.mocked(getZoneStatus).mockReturnValue('locked');

      const store = useMapStore();
      await store.initialize('c1');

      // 缺坐标的地点被跳过，只加载有坐标的地点
      expect(store.getZones(1)).toHaveLength(1);
      expect(store.getZones(1)[0].id).toBe('has-coords');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no-coords'));
      warnSpy.mockRestore();
    });

    it('savedState 有 view 但无 unlockedZones/completedZones 时回退为空数组（?? 分支）', async () => {
      // 覆盖 line 98 (unlockedZones ?? []) 与 line 99 (completedZones ?? []) 的 ?? 分支
      const saved: MapState = {
        view: { zoomLevel: 2, panX: 3, panY: 4 },
        // 不提供 unlockedZones 与 completedZones
      };
      vi.mocked(mapDbService.getMapState).mockResolvedValueOnce(saved);
      vi.mocked(mapDbService.getAllLocationData).mockResolvedValueOnce([]);
      vi.mocked(mapDbService.getCurrentLocationId).mockResolvedValueOnce(null);

      const store = useMapStore();
      await store.initialize('c1');

      // ?? 回退为空数组
      expect(store.state.unlockedZones).toEqual([]);
      expect(store.state.completedZones).toEqual([]);
      expect(store.state.view.zoomLevel).toBe(2);
    });

    it('恢复 currentLocationId 时 getLocationById 返回 undefined → 不设置 currentLocation（if FALSE 分支）', async () => {
      // 覆盖 line 112 的 if (location) FALSE 分支
      vi.mocked(mapDbService.getMapState).mockResolvedValueOnce(null);
      vi.mocked(mapDbService.getAllLocationData).mockResolvedValueOnce([]);
      vi.mocked(mapDbService.getCurrentLocationId).mockResolvedValueOnce('missing-loc');
      vi.mocked(getLocationById).mockReturnValueOnce(undefined);

      const store = useMapStore();
      await store.initialize('c1');

      // savedLocationId 存在但地点未找到，currentLocation 保持 null
      expect(store.currentLocation).toBeNull();
      expect(getLocationById).toHaveBeenCalledWith(expect.any(Map), 'missing-loc');
    });

    it('safeSaveState：saveMapState 抛错时 catch 记录错误不影响调用方', async () => {
      // 覆盖 line 63 的 console.error catch 分支
      vi.mocked(mapDbService.getMapState).mockResolvedValueOnce(null);
      vi.mocked(mapDbService.getAllLocationData).mockResolvedValueOnce([]);
      vi.mocked(mapDbService.getCurrentLocationId).mockResolvedValueOnce(null);
      vi.mocked(mapDbService.saveMapState).mockRejectedValueOnce(new Error('db write fail'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const store = useMapStore();
      await store.initialize('c1');
      store.zoomTo(3); // 触发 safeSaveState（fire-and-forget）

      // 等待微任务执行完 catch 回调
      await new Promise(resolve => setTimeout(resolve, 0));

      // catch 记录错误
      expect(errorSpy).toHaveBeenCalledWith('[map] 保存地图状态失败:', expect.any(Error));
      errorSpy.mockRestore();
    });

    it('enterZone：saveCurrentLocationId 抛错时 catch 记录错误不影响切换', async () => {
      // 覆盖 line 175 的 console.error catch 分支
      const loc = makeLocation({ id: 'zone-a' });
      vi.mocked(getLocationById).mockReturnValueOnce(loc);
      vi.mocked(mapDbService.saveCurrentLocationId).mockRejectedValueOnce(new Error('write fail'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const store = useMapStore();
      // 先 initialize 设置 currentCharacterId
      vi.mocked(mapDbService.getMapState).mockResolvedValueOnce(null);
      vi.mocked(mapDbService.getAllLocationData).mockResolvedValueOnce([]);
      vi.mocked(mapDbService.getCurrentLocationId).mockResolvedValueOnce(null);
      await store.initialize('c1');

      store.enterZone('zone-a'); // 触发 fire-and-forget 持久化

      // 等待微任务执行完 catch 回调
      await new Promise(resolve => setTimeout(resolve, 0));

      // 切换仍成功，catch 记录错误
      expect(store.currentLocation).toEqual(loc);
      expect(errorSpy).toHaveBeenCalledWith('[map] 保存当前区域失败:', expect.any(Error));
      errorSpy.mockRestore();
    });
  });
});
