/**
 * 地图模块服务层
 * 
 * 提供地图管理的核心业务逻辑
 */
import type { 
  IMapService, 
  MapState, 
  MapView, 
  LocationData, 
  LocationMarker 
} from './types';
import { mapDbService } from './db';
import { eventBus, GameEvents } from '../bus/core';

/**
 * 默认地图状态
 */
const DEFAULT_MAP_VIEW: MapView = {
  zoomLevel: 1,
  panX: 0,
  panY: 0,
  showMarkers: true
};

/**
 * 默认地点数据
 */
const DEFAULT_LOCATIONS: LocationData[] = [
  {
    name: 'village',
    displayName: '宁静村庄',
    icon: '🏡',
    description: '一个宁静的小村庄，是冒险者的起点。在这里你可以接受任务、购买装备。',
    continent: 'azeroth',
    region: '东部王国',
    enemies: ['enemy_goblin', 'enemy_wolf'],
    quests: ['quest_kill_goblin', 'quest_collect_herbs', 'quest_kill_wolf'],
    levelRange: [1, 3],
    color: '#4CAF50',
    mapX: 0.5,
    mapY: 0.5
  },
  {
    name: 'goblin_camp',
    displayName: '哥布林营地',
    icon: '⛺',
    description: '哥布林的营地，充满了危险。适合1-3级的冒险者。',
    continent: 'azeroth',
    region: '东部王国',
    enemies: ['enemy_goblin'],
    quests: ['quest_kill_goblin'],
    levelRange: [1, 3],
    color: '#f44336',
    mapX: 0.65,
    mapY: 0.55
  },
  {
    name: 'forest',
    displayName: '幽暗森林',
    icon: '🌲',
    description: '一片茂密的森林，狼群在此出没。适合2-4级的冒险者。',
    continent: 'azeroth',
    region: '东部王国',
    enemies: ['enemy_wolf'],
    quests: ['quest_kill_wolf'],
    levelRange: [2, 4],
    color: '#2E7D32',
    mapX: 0.4,
    mapY: 0.35
  },
  {
    name: 'mine',
    displayName: '废弃矿洞',
    icon: '⛏️',
    description: '曾经繁荣的矿洞，现在被兽人占领。适合5-7级的冒险者。',
    continent: 'azeroth',
    region: '东部王国',
    enemies: ['enemy_orc', 'enemy_orc_boss'],
    quests: ['quest_kill_boss_orc'],
    levelRange: [5, 7],
    color: '#795548',
    mapX: 0.3,
    mapY: 0.65
  },
  {
    name: 'herb_field',
    displayName: '草药田',
    icon: '🌿',
    description: '一片长满草药的田地。适合1-2级的冒险者采集。',
    continent: 'azeroth',
    region: '东部王国',
    enemies: [],
    quests: ['quest_collect_herbs'],
    levelRange: [1, 2],
    color: '#8BC34A',
    mapX: 0.55,
    mapY: 0.4
  }
];

/**
 * 默认地点标记
 */
const DEFAULT_MARKERS: LocationMarker[] = [
  {
    id: 'marker_village',
    x: 50,
    y: 50,
    icon: '🏡',
    name: '宁静村庄',
    locationId: 'village',
    requiredLevel: 1
  },
  {
    id: 'marker_goblin_camp',
    x: 65,
    y: 55,
    icon: '⛺',
    name: '哥布林营地',
    locationId: 'goblin_camp',
    requiredLevel: 1
  },
  {
    id: 'marker_forest',
    x: 40,
    y: 35,
    icon: '🌲',
    name: '幽暗森林',
    locationId: 'forest',
    requiredLevel: 2
  },
  {
    id: 'marker_mine',
    x: 30,
    y: 65,
    icon: '⛏️',
    name: '废弃矿洞',
    locationId: 'mine',
    requiredLevel: 5,
    difficulty: 'heroic'
  },
  {
    id: 'marker_herb_field',
    x: 55,
    y: 40,
    icon: '🌿',
    name: '草药田',
    locationId: 'herb_field',
    requiredLevel: 1
  }
];

/**
 * 地图服务实现类
 */
export class MapService implements IMapService {
  /** 当前地图状态 */
  private state: MapState = {
    view: { ...DEFAULT_MAP_VIEW }
  };
  
  /** 地点数据缓存 */
  private locations: Map<string, LocationData> = new Map();
  
  /** 地点标记缓存 */
  private markers: Map<string, LocationMarker[]> = new Map();
  
  /**
   * 初始化服务
   */
  async init(): Promise<void> {
    // 加载地图状态
    const savedState = await mapDbService.getMapState();
    if (savedState) {
      this.state = savedState;
    }
    
    // 加载地点数据
    await this.loadLocations();
    
    // 加载地点标记
    await this.loadMarkers();
    
    // 初始化默认数据
    await this.initDefaultData();
  }
  
  /**
   * 加载地点数据
   */
  private async loadLocations(): Promise<void> {
    const locationList = await mapDbService.getAllLocationData();
    locationList.forEach(location => {
      this.locations.set(location.name, location);
    });
  }
  
  /**
   * 加载地点标记
   */
  private async loadMarkers(): Promise<void> {
    const markerList = await mapDbService.getAllLocationMarkers();
    markerList.forEach(marker => {
      const continentId = this.getContinentId(marker.locationId);
      if (!this.markers.has(continentId)) {
        this.markers.set(continentId, []);
      }
      this.markers.get(continentId)?.push(marker);
    });
  }
  
  /**
   * 初始化默认数据
   */
  private async initDefaultData(): Promise<void> {
    // 初始化地点数据
    for (const location of DEFAULT_LOCATIONS) {
      if (!this.locations.has(location.name)) {
        await mapDbService.saveLocationData(location);
        this.locations.set(location.name, location);
      }
    }
    
    // 初始化地点标记
    for (const marker of DEFAULT_MARKERS) {
      const continentId = this.getContinentId(marker.locationId);
      const existingMarkers = this.markers.get(continentId) || [];
      if (!existingMarkers.find(m => m.id === marker.id)) {
        await mapDbService.saveLocationMarker(marker);
        if (!this.markers.has(continentId)) {
          this.markers.set(continentId, []);
        }
        this.markers.get(continentId)?.push(marker);
      }
    }
  }
  
  /**
   * 获取地点所属大陆ID
   * @param locationId - 地点ID
   * @returns 大陆ID
   */
  private getContinentId(locationId: string): string {
    const location = this.locations.get(locationId);
    return location?.continent || 'azeroth';
  }
  
  /**
   * 获取地图状态
   * @returns 地图状态
   */
  getState(): MapState {
    return { ...this.state };
  }
  
  /**
   * 获取地点数据
   * @param locationId - 地点ID
   * @returns 地点数据
   */
  getLocationData(locationId: string): LocationData | null {
    return this.locations.get(locationId) || null;
  }
  
  /**
   * 获取大陆下的地点
   * @param continentId - 大陆ID
   * @returns 地点列表
   */
  getLocationsByContinent(continentId: string): LocationData[] {
    return Array.from(this.locations.values()).filter(
      location => location.continent === continentId
    );
  }
  
  /**
   * 获取地点标记
   * @param continentId - 大陆ID
   * @returns 标记列表
   */
  getLocationMarkers(continentId: string): LocationMarker[] {
    return this.markers.get(continentId) || [];
  }
  
  /**
   * 获取已解锁的地点
   * @param playerLevel - 玩家等级
   * @returns 地点ID列表
   */
  getUnlockedLocations(playerLevel: number): string[] {
    const unlocked: string[] = [];
    
    this.locations.forEach((location, locationId) => {
      if (this.isLocationUnlocked(locationId, playerLevel)) {
        unlocked.push(locationId);
      }
    });
    
    return unlocked;
  }
  
  /**
   * 检查地点是否解锁
   * @param locationId - 地点ID
   * @param playerLevel - 玩家等级
   * @returns 是否解锁
   */
  isLocationUnlocked(locationId: string, playerLevel: number): boolean {
    const location = this.locations.get(locationId);
    if (!location) return false;
    
    // 村庄始终解锁（新手村）
    if (locationId === 'village') return true;
    
    // 检查等级要求
    const [minLevel] = location.levelRange;
    return playerLevel >= minLevel;
  }
  
  /**
   * 进入地点
   * @param locationId - 地点ID
   * @returns 是否成功进入
   */
  enterLocation(locationId: string): boolean {
    const location = this.locations.get(locationId);
    if (!location) return false;
    
    // 触发进入地点事件
    eventBus.emit(GameEvents.ZONE_ENTERED, { locationId, location });
    
    return true;
  }
  
  /**
   * 缩放到指定级别
   * @param level - 缩放级别
   */
  zoomTo(level: number): void {
    // 限制缩放级别在1-5之间
    const clampedLevel = Math.max(1, Math.min(5, level));
    this.state.view.zoomLevel = clampedLevel;
    this.saveState();
  }
  
  /**
   * 平移到指定位置
   * @param x - X坐标
   * @param y - Y坐标
   */
  panTo(x: number, y: number): void {
    // 限制平移范围
    this.state.view.panX = Math.max(-50, Math.min(50, x));
    this.state.view.panY = Math.max(-50, Math.min(50, y));
    this.saveState();
  }
  
  /**
   * 重置视图
   */
  resetView(): void {
    this.state.view = { ...DEFAULT_MAP_VIEW };
    this.saveState();
  }
  
  /**
   * 重置地图数据
   */
  reset(): void {
    this.state = { view: { ...DEFAULT_MAP_VIEW } };
    this.locations.clear();
    this.markers.clear();
    
    mapDbService.clearMapState();
    mapDbService.clearAllLocationData();
    mapDbService.clearAllLocationMarkers();
  }
  
  /**
   * 保存状态
   */
  private saveState(): void {
    mapDbService.saveMapState(this.state);
  }
  
  /**
   * 设置当前大陆
   * @param continentId - 大陆ID
   */
  setCurrentContinent(continentId: string): void {
    this.state.view.currentContinentId = continentId;
    this.saveState();
  }
  
  /**
   * 设置激活的标记
   * @param markerId - 标记ID
   */
  setActiveMarker(markerId: string | undefined): void {
    this.state.view.activeMarkerId = markerId;
    this.saveState();
  }
  
  /**
   * 切换标记显示
   */
  toggleMarkers(): void {
    this.state.view.showMarkers = !this.state.view.showMarkers;
    this.saveState();
  }
}

/**
 * 地图服务实例
 */
export const mapService = new MapService();