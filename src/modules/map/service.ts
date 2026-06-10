/**
 * 地图模块服务层
 * 
 * 提供地图管理的核心业务逻辑。
 * 地图数据按角色ID隔离存储，切换角色时加载对应角色的地图状态。
 */
import type { 
  IMapService, 
  MapState, 
  MapView, 
  LocationData,
  MapZone
} from './types';
import { mapDbService } from './db';
import { eventBus, GameEvents } from '../bus/core';
import { logService } from '../log/service';

/**
 * 默认地图状态
 */
const DEFAULT_MAP_VIEW: MapView = {
  zoomLevel: 1,
  panX: 0,
  panY: 0
};

/**
 * 地图服务实现类
 */
export class MapService implements IMapService {
  /** 当前地图状态 */
  private state: MapState = {
    view: { ...DEFAULT_MAP_VIEW }
  };
  
  /** 地点数据缓存（全局共享，所有角色共用） */
  private locations: Map<string, LocationData> = new Map();
  
  /** 当前角色ID */
  private currentCharacterId: string | null = null;
  
  /**
   * 初始化服务（按角色ID从数据库加载地图状态和数据）
   * @param characterId - 角色ID
   */
  async init(characterId: string): Promise<void> {
    this.currentCharacterId = characterId;

    // 加载地图状态
    const savedState = await mapDbService.getMapState(characterId);
    if (savedState?.view) {
      this.state = { view: savedState.view };
    } else {
      this.state = { view: { ...DEFAULT_MAP_VIEW } };
    }
    
    // 从数据库加载地点数据（全局共享）
    await this.loadLocations();
  }
  
  /**
   * 从数据库加载地点数据
   * 只加载包含 mapX/mapY 字段的记录（过滤掉大陆数据）
   */
  private async loadLocations(): Promise<void> {
    const locationList = await mapDbService.getAllLocationData();
    this.locations.clear();
    locationList.forEach(location => {
      if (location.mapX != null && location.mapY != null) {
        this.locations.set(location.name, location);
      }
    });
  }
  
  /**
   * 获取地图状态
   */
  getState(): MapState {
    return { ...this.state };
  }
  
  /**
   * 获取地点数据
   */
  getLocationData(locationId: string): LocationData | null {
    return this.locations.get(locationId) || null;
  }
  
  /**
   * 获取大陆下的地点
   */
  getLocationsByContinent(continentId: string): LocationData[] {
    return Array.from(this.locations.values()).filter(
      location => location.continent === continentId
    );
  }
  
  /**
   * 获取已解锁的地点
   */
  getUnlockedLocations(playerLevel: number): string[] {
    const unlocked: string[] = [];
    this.locations.forEach((_location, locationId) => {
      if (this.isLocationUnlocked(locationId, playerLevel)) {
        unlocked.push(locationId);
      }
    });
    return unlocked;
  }
  
  /**
   * 检查地点是否解锁
   */
  isLocationUnlocked(locationId: string, playerLevel: number): boolean {
    const location = this.locations.get(locationId);
    if (!location) return false;
    const [minLevel] = location.levelRange;
    return playerLevel >= minLevel;
  }
  
  /**
   * 进入地点
   */
  enterLocation(locationId: string): boolean {
    const location = this.locations.get(locationId);
    if (!location) return false;
    eventBus.emit(GameEvents.ZONE_ENTERED, { locationId, location });

    // 记录冒险日志
    logService.addLog({
      id: logService.generateLogId(),
      timestamp: Date.now(),
      type: 'zone',
      message: `进入了：${location.name}`,
      icon: '📍'
    });

    // 持久化当前区域ID（按角色隔离）
    this.saveCurrentLocationId(locationId);
    return true;
  }
  
  /**
   * 缩放到指定级别
   */
  zoomTo(level: number): void {
    const clampedLevel = Math.max(1, Math.min(5, level));
    this.state.view.zoomLevel = clampedLevel;
    this.saveState();
  }
  
  /**
   * 平移到指定位置
   */
  panTo(x: number, y: number): void {
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
   * 重置地图内存状态（不删除数据库数据，保留各角色的地图状态）
   */
  reset(): void {
    this.state = { view: { ...DEFAULT_MAP_VIEW } };
    this.locations.clear();
    this.currentCharacterId = null;
  }
  
  /**
   * 持久化当前选中的区域ID（按角色隔离）
   */
  async saveCurrentLocationId(locationId: string): Promise<void> {
    if (this.currentCharacterId) {
      await mapDbService.saveCurrentLocationId(this.currentCharacterId, locationId);
    }
  }

  /**
   * 获取当前角色的上次选中区域ID
   */
  async getCurrentLocationId(): Promise<string | null> {
    if (this.currentCharacterId) {
      return mapDbService.getCurrentLocationId(this.currentCharacterId);
    }
    return null;
  }

  /**
   * 保存地图状态（按角色隔离）
   */
  private saveState(): void {
    if (this.currentCharacterId) {
      mapDbService.saveMapState(this.currentCharacterId, this.state);
    }
  }
  
  /**
   * 设置当前大陆
   */
  setCurrentContinent(continentId: string): void {
    this.state.view.currentContinentId = continentId;
    this.saveState();
  }
  
  /**
   * 获取所有区域（用于大地图显示）
   * 从数据库读取的地点数据转换为 MapZone
   */
  getZones(playerLevel: number = 1): MapZone[] {
    const zoneList: MapZone[] = [];
    
    this.locations.forEach((location, locationId) => {
      const requiredLevel = location.levelRange[0];
      zoneList.push({
        id: locationId,
        name: location.name,
        icon: location.icon,
        description: location.description,
        coordinates: {
          x: location.mapX,
          y: location.mapY
        },
        requiredLevel,
        requiredGold: 100 * requiredLevel,
        status: this.isLocationUnlocked(locationId, playerLevel) ? 'unlocked' : 'locked',
        rewards: {
          gold: 50 * requiredLevel,
          exp: 100 * requiredLevel
        }
      });
    });
    
    return zoneList;
  }
  
  /**
   * 进入区域
   */
  enterZone(zoneId: string): boolean {
    return this.enterLocation(zoneId);
  }
}

/**
 * 地图服务实例
 */
export const mapService = new MapService();
