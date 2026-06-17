# 地图模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 地图模块设计文档 |
| 版本 | v4.0 |
| 生成日期 | 2026年6月17日 |
| 所属模块 | `modules/map` |

---

## 模块概述与定位

### 模块定位

地图模块是游戏世界的探索核心，负责管理地图视图状态、区域标记、等级解锁和探索入口。该模块为玩家提供探索游戏世界的基础功能。

### 核心职责

| 职责 | 描述 |
|------|------|
| 地图视图管理 | 管理地图的缩放、平移、当前大陆等视图状态 |
| 地点数据管理 | 从 `config_locations` 表加载和维护地点数据 |
| 区域状态判定 | 根据玩家等级判断区域解锁状态（locked/unlocked/completed） |
| 探索入口 | 进入区域时发射 `ZONE_ENTERED` 事件，通知探索模块 |
| 标签页持久化 | 按角色隔离保存当前标签页（地图/探索） |
| 数据持久化 | 实现地图视图状态的本地存储与加载 |

### 模块边界

**地图模块**与以下模块交互:
- 探索模块: 进入区域时发射 `ZONE_ENTERED` 事件
- 角色模块: 获取玩家等级用于解锁判断
- 事件总线: 发布 `ZONE_ENTERED` 事件

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-MAP-001 | 支持世界地图模式，按大陆分组显示区域标记 | 游戏设计 |
| FR-MAP-002 | 支持地图缩放（1-5级） | 用户体验 |
| FR-MAP-003 | 支持地图平移（-50 到 50） | 用户体验 |
| FR-MAP-004 | 根据玩家等级判定区域解锁状态 | 等级系统 |
| FR-MAP-005 | 进入区域时通知探索模块 | 探索功能 |
| FR-MAP-006 | 支持按大陆筛选地点 | 地图导航 |
| FR-MAP-007 | 数据持久化存储（地图视图按角色隔离） | 存档系统 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-MAP-001 | 操作失败时回滚数据 | 高 |
| NFR-MAP-002 | 单次操作响应时间 < 10ms | 高 |

---

## 接口定义

### Store Action 方法（对外暴露接口）

| 方法 | 说明 |
|------|------|
| `initialize(characterId)` | 初始化地图模块（加载状态和地点数据） |
| `getState()` | 获取当前地图状态 |
| `getLocationData(locationId)` | 获取指定地点数据 |
| `getLocationsByContinent(continentId)` | 获取指定大陆下的所有地点 |
| `getZones(playerLevel)` | 获取所有区域（含解锁状态），返回 MapZone[] |
| `isLocationUnlocked(locationId, playerLevel)` | 检查地点是否解锁 |
| `enterZone(zoneId)` | 进入区域（持久化当前区域ID → 发射 ZONE_ENTERED 事件） |
| `zoomTo(level)` | 缩放到指定级别（1-5） |
| `panTo(x, y)` | 平移到指定位置 |
| `resetView()` | 重置视图到默认状态 |
| `setCurrentContinent(continentId)` | 设置当前大陆 |
| `saveCurrentTab(tab)` | 保存当前标签页（按角色隔离） |
| `getCurrentTab()` | 获取当前标签页 |
| `clearUIState()` | 清除 UI 状态（不删除数据库数据） |

### 数据类型定义

```typescript
/** 大陆数据接口 */
export interface ContinentData {
  id: string;
  name: string;
  icon: string;
  description: string;
  position: string;
  color: string;
  type: 'continent';
}

/** 地图视图接口 */
export interface MapView {
  zoomLevel: number;
  panX: number;
  panY: number;
  currentContinentId?: string;
}

/** 地图状态接口 */
export interface MapState {
  view: MapView;
}

/** 地点数据接口 */
export interface LocationData {
  id: string;
  name: string;
  icon: string;
  description: string;
  continent: string;
  enemies?: string[];
  bosses?: string[];
  quests?: string[];
  levelRange: [number, number];
  color: string;
  mapX: number;
  mapY: number;
  type: 'location';
}

/** 区域状态类型 */
export type ZoneStatus = 'locked' | 'unlocked' | 'completed';

/** 区域奖励接口 */
export interface ZoneRewards {
  gold: number;
  exp: number;
}

/** 地图区域接口（用于大地图 UI 展示） */
export interface MapZone {
  id: string;
  name: string;
  icon: string;
  description: string;
  coordinates: { x: number; y: number };
  requiredLevel: number;
  requiredGold: number;
  status: ZoneStatus;
  rewards: ZoneRewards;
}
```

### 服务接口 IMapService

```typescript
export interface IMapService {
  getState(): MapState;
  getLocationData(locationId: string): LocationData | null;
  getLocationsByContinent(continentId: string): LocationData[];
  getUnlockedLocations(playerLevel: number): string[];
  isLocationUnlocked(locationId: string, playerLevel: number): boolean;
  enterLocation(locationId: string): boolean;
  zoomTo(level: number): void;
  panTo(x: number, y: number): void;
  resetView(): void;
  reset(): void;
}
```

---

## 业务逻辑流程

### 初始化流程

1. 调用 `mapStore.initialize(characterId)`
2. 从 `runtime_mapState` 表加载该角色的地图视图状态
3. 从 `config_locations` 表加载所有地点数据（仅 type='location'），写入 `locations` Map
4. 恢复上次选中的区域ID（若存在）
5. 标记 `initialized = true`

### 进入区域流程

1. 调用 `mapStore.enterZone(zoneId)`
2. 从 `locations` Map 查找地点数据
3. 设置 `currentLocation`
4. 持久化当前区域ID到 `runtime_mapState`（按角色隔离）
5. 发射 `ZONE_ENTERED` 事件（携带 locationId 和 location 数据）
6. 探索模块监听此事件后调用 `enterArea`

### 区域状态判定流程

`getZones(playerLevel)` 遍历所有地点，调用纯函数 `getZoneStatus()` 判定状态：

| 状态 | 条件 |
|------|------|
| `completed` | 区域在 `completedZones` 列表中 |
| `unlocked` | 角色等级 >= 最低要求等级 |
| `locked` | 以上都不满足 |

### 地点解锁检查流程

1. 调用 `isLocationUnlocked(locationId, playerLevel)`
2. 从 `locations` Map 查找地点数据
3. 调用纯函数 `isLocationAccessible(location, playerLevel)`
4. 比较 `characterLevel >= levelRange[0]`

---

## 纯函数层 (service.ts)

| 函数 | 说明 |
|------|------|
| `getLocationById(locations, id)` | 根据 ID 从 Map 中查找地点 |
| `getCurrentLocation(locations, currentLocationId)` | 获取当前选中地点 |
| `isLocationAccessible(location, characterLevel)` | 检查等级是否满足最低要求 |
| `isZoneExplored(state, zoneId)` | 检查区域是否已探索 |
| `getZoneStatus(state, zoneId, location, characterLevel)` | 获取区域锁定/解锁/完成状态 |
| `getLocationsByContinent(locations, continentId)` | 筛选指定大陆的地点列表 |

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| `config_locations` | `locationId` | LocationDataStorage | 地点数据（全局共享，通过 type='location' 筛选） |
| `runtime_mapState` | `map_${characterId}` | MapStateStorage | 地图视图状态（按角色隔离） |

### LocationDataStorage 存储内容 (config_locations)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 地点唯一标识 |
| `name` | string | 地点名称 |
| `icon` | string | 地点图标 |
| `description` | string | 地点描述 |
| `continent` | string | 所属大陆ID |
| `enemies?` | string[] | 敌人列表 |
| `bosses?` | string[] | Boss列表 |
| `quests?` | string[] | 任务列表 |
| `levelRange` | [number, number] | 等级范围 |
| `color` | string | 主色调 |
| `mapX` | number | 地图X坐标 |
| `mapY` | number | 地图Y坐标 |
| `type` | 'location' \| 'continent' | 类型标识 |

### MapStateStorage 存储内容 (runtime_mapState)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | `map_${characterId}` |
| `view?` | MapView | 地图视图（zoomLevel, panX, panY, currentContinentId） |
| `currentLocationId?` | string | 当前选中的区域ID |
| `currentTab?` | string | 当前标签页（'map' \| 'explore'） |

### 多角色支持说明

地点数据（`config_locations`）为全局共享。地图视图状态通过 `map_${characterId}` 键实现角色隔离，每个角色拥有独立的缩放、平移、当前大陆和标签页设置。

### 默认视图状态

```typescript
{
  zoomLevel: 1,
  panX: 0,
  panY: 0
}
```

---

## 与其他模块的交互关系

### 依赖关系

- **事件总线**: 发布 `ZONE_ENTERED` 事件
- **数据表**: `config_locations`、`runtime_mapState`

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 探索模块 | 事件 | 发射 `ZONE_ENTERED` 事件，探索模块监听后进入区域 |
| 角色模块 | 调用 | 获取玩家等级用于解锁判断 |
| 事件总线 | 发布 | 发布 `ZONE_ENTERED` 事件 |

---

## 异常处理机制

### 异常类型与处理策略

| 异常类型 | 触发条件 | 处理策略 |
|----------|----------|----------|
| 存储读取失败 | IndexedDB 解析错误 | 使用默认值初始化 |
| 存储写入失败 | IndexedDB 写入异常 | 进入重试队列，指数退避重试 3 次 |
| 地点不存在 | 操作不存在的地点 | 返回 null / false |
| 等级不足 | 进入等级要求未满足的地点 | 不阻止，由调用方判断 |

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 内存缓存 | Map 结构缓存地点数据 | 快速查找 |
| 纯函数计算 | 状态判定均为无副作用纯函数 | 可测试、可复用 |
| 异步加载 | Store 初始化时异步从 IndexedDB 读取 | 不阻塞主线程 |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 输入验证 | 缩放和平移操作进行边界限制 |
| 数据隔离 | 使用 `map_${characterId}` 前缀隔离角色数据 |
| 异常捕获 | 所有 IO 操作包裹 try-catch |
| 重试机制 | 失败时自动重试 3 次 |

---

## 模块文件结构

```
src/modules/map/
  - index.ts          # 模块入口，统一导出
  - types.ts          # 类型定义（ContinentData、LocationData、MapView 等）
  - db.ts             # IndexedDB 数据库操作层（config_locations、runtime_mapState）
  - store.ts          # Pinia Store 状态管理（useMapStore）
  - service.ts        # 纯函数层（getLocationById、isLocationAccessible、getZoneStatus 等）
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | 模块入口、统一导出 |
| `types.ts` | TypeScript 类型定义：`ContinentData`、`LocationData`、`MapView`、`MapState`、`MapZone`、`ZoneStatus` 等 |
| `db.ts` | IndexedDB 数据库操作：`saveMapState`、`getMapState`、`saveLocationData`、`getAllLocationData`、`saveCurrentTab` 等 |
| `store.ts` | Pinia Store 状态管理（useMapStore），编排业务逻辑 |
| `service.ts` | 纯函数层：`getLocationById`、`isLocationAccessible`、`getZoneStatus`、`getLocationsByContinent` |

---

## 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-15 | 初始版本,包含基础地图功能 | System |
| v1.1 | 2026-05-18 | 精简功能:移除导航、收藏、自定义标记；添加等级解锁和探索入口 | System |
| v2.0 | 2026-05-19 | 迁移到 Pinia + IndexedDB 架构，实现自动同步持久化 | System |
| v2.1 | 2026-05-20 | 拆分地图配置到独立存储（map），数据库版本升级至3 | System |
| v2.2 | 2026-06-16 | 文件结构拆分为 db/store/service 三层架构 | System |
| v3.0 | 2026-06-16 | 全面对齐实际代码：ContinentData 添加 id/type 字段、LocationData 添加 id/bosses/type 字段（移除 displayName/region）、MapView 移除 showMarkers/activeMarkerId 字段、移除 LocationMarker 类型、添加 getZones/setCurrentContinent/saveCurrentTab/getCurrentTab/clearUIState 方法、enterLocation 改为 enterZone、数据表从 characterData 改为 runtime_mapState | System |
| v4.0 | 2026-06-17 | 逐文件比对验证：类型定义与代码完全一致 | System |

---

**文档结束**
