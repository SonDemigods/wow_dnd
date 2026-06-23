/**
 * @fileoverview 地图模块统一导出入口
 * @module map
 */
export type {
  ContinentData,
  MapView,
  MapState,
  LocationData,
  ZoneStatus,
  ZoneRewards,
  MapZone,
  MapStateStorage,
  LocationStorage
} from './types';

export { mapDbService } from './db';

export { useMapStore } from './store';
