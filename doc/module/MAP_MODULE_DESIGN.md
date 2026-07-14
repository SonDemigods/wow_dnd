# 地图模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 地图模块设计文档 |
| 版本 | v5.0 |
| 生成日期 | 2026年7月10日 |
| 所属模块 | `modules/map` |
| 更新说明 | 严格依据源码重写：补充 `MapState.unlockedZones?`/`completedZones?` 字段及 `MapStateStorage` 对应字段；修正 `MapZone.requiredGold`/`rewards` 为可选字段（旧文档写为必填）；补充 `LocationStorage` 统一存储类型定义（旧文档误称为 LocationDataStorage）；移除不存在的 `IMapService` 接口；移除不存在的 `isZoneExplored`/`getCurrentLocation` service 函数；补充 `clearMapState` DB 方法；补充 store 常量（`ZOOM_MIN/MAX`、`PAN_MIN/MAX`、`DEFAULT_MAP_VIEW`）、`clamp` 辅助函数、`safeSaveState`/`loadLocations` 内部函数；补充 state/locations/currentLocation/currentCharacterId/initialized 状态清单及 `getView`/`getCurrentLocation` 计算属性；补充 `getContinentLocations` 内部函数（导出别名为 `getLocationsByContinent`）；修正 `getZoneStatus` 优先级（completed > 手动 unlocked > 等级 unlocked > locked）；修正 `saveMapState` 使用事务确保读-改-写原子性；修正 `enterZone` 使用 `eventBus.emit(GameEvents.ZONE_ENTERED, { locationId, location })` |

---

## 模块概述与定位

### 模块定位

地图模块是游戏世界的探索核心，负责管理地图视图状态、区域标记、等级解锁和探索入口。该模块为玩家提供探索游戏世界的基础功能。

### 核心职责

| 职责 | 描述 |
|------|------|
| 地图视图管理 | 管理地图的缩放、平移、当前大陆等视图状态 |
| 地点数据管理 | 从 `config_locations` 表加载和维护地点数据（全局共享） |
| 区域状态判定 | 根据玩家等级和手动解锁/完成记录判定区域状态（locked/unlocked/completed） |
| 探索入口 | 进入区域时发射 `ZONE_ENTERED` 事件，通知探索模块 |
| 标签页持久化 | 按角色隔离保存当前标签页（地图/探索） |
| 数据持久化 | 实现地图视图状态的本地存储与加载（按角色隔离） |

### 模块边界

**地图模块**与以下模块交互:
- 探索模块: 进入区域时发射 `ZONE_ENTERED` 事件，探索模块监听后进入区域
- 角色模块: 获取玩家等级用于解锁判断（由调用方传入 `playerLevel`）
- 事件总线: 发布 `ZONE_ENTERED` 事件

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-MAP-001 | 支持世界地图模式，按大陆分组显示区域标记 | 游戏设计 |
| FR-MAP-002 | 支持地图缩放（`ZOOM_MIN=1` ~ `ZOOM_MAX=5`，通过 `clamp` 钳制） | 用户体验 |
| FR-MAP-003 | 支持地图平移（`PAN_MIN=-50` ~ `PAN_MAX=50`，通过 `clamp` 钳制） | 用户体验 |
| FR-MAP-004 | 根据玩家等级和手动解锁/完成记录判定区域解锁状态 | 等级系统 |
| FR-MAP-005 | 进入区域时通知探索模块（发射 `ZONE_ENTERED` 事件） | 探索功能 |
| FR-MAP-006 | 支持按大陆筛选地点（`getLocationsByContinent`） | 地图导航 |
| FR-MAP-007 | 数据持久化存储（地图视图按角色隔离，使用 `map_${characterId}` 键） | 存档系统 |
| FR-MAP-008 | 支持标签页按角色隔离持久化（`saveCurrentTab`/`getCurrentTab`） | 用户体验 |
| FR-MAP-009 | 支持清除 UI 状态（`clearUIState`，不删除数据库数据） | 状态管理 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-MAP-001 | 存储写入失败时自动重试（`dbService.withRetry`） | 高 |
| NFR-MAP-002 | `saveMapState` 使用事务确保读-改-写原子性 | 高 |

---

## 接口定义

### Store Action 方法（对外暴露接口）

| 方法 | 签名 | 说明 |
|------|------|------|
| `initialize` | `(characterId: string) => Promise<void>` | 初始化地图模块（加载状态和地点数据，恢复上次选中区域） |
| `getState` | `() => MapState` | 获取当前地图状态（深拷贝，防止外部修改污染 Store） |
| `getLocationData` | `(locationId: string) => LocationData \| undefined` | 获取指定地点数据 |
| `getLocationsByContinent` | `(continentId: string) => LocationData[]` | 获取指定大陆下的所有地点（内部函数 `getContinentLocations` 的导出别名） |
| `getZones` | `(playerLevel: number) => MapZone[]` | 获取所有区域（含解锁状态，转换为 MapZone 格式） |
| `isLocationUnlocked` | `(locationId: string, playerLevel: number) => boolean` | 检查地点是否解锁（基于等级判定） |
| `enterZone` | `(zoneId: string) => boolean` | 进入区域（设置 currentLocation → 持久化 currentLocationId → 发射 ZONE_ENTERED 事件） |
| `zoomTo` | `(level: number) => void` | 缩放到指定级别（钳制到 `[ZOOM_MIN, ZOOM_MAX]`） |
| `panTo` | `(x: number, y: number) => void` | 平移到指定位置（钳制到 `[PAN_MIN, PAN_MAX]`） |
| `resetView` | `() => void` | 重置视图到 `DEFAULT_MAP_VIEW` |
| `setCurrentContinent` | `(continentId: string) => void` | 设置当前大陆（更新 `view.currentContinentId`） |
| `saveCurrentTab` | `(tab: string) => Promise<void>` | 保存当前标签页（按角色隔离持久化） |
| `getCurrentTab` | `() => Promise<string \| null>` | 获取当前标签页（按角色隔离读取） |
| `clearUIState` | `() => void` | 清除 UI 状态（重置 state、currentLocation、locations、initialized，不删除数据库数据） |

### Store 响应式状态

| 状态 | 类型 | 说明 |
|------|------|------|
| `state` | `Ref<MapState>` | 当前地图状态（含 view、unlockedZones?、completedZones?） |
| `locations` | `Ref<Map<string, LocationData>>` | 地点数据缓存（全局共享，所有角色共用） |
| `currentCharacterId` | `Ref<string \| null>` | 当前角色 ID |
| `currentLocation` | `Ref<LocationData \| null>` | 当前选中的地点 |
| `initialized` | `Ref<boolean>` | 模块是否已完成初始化 |

### Store 计算属性

| 计算属性 | 类型 | 说明 |
|----------|------|------|
| `getView` | `ComputedRef<MapView>` | 当前地图视图（`state.view`） |
| `getCurrentLocation` | `ComputedRef<LocationData \| null>` | 当前选中的地点（`currentLocation`） |

### Store 内部函数

| 函数 | 说明 |
|------|------|
| `safeSaveState()` | 安全保存地图状态，捕获并记录错误避免影响调用方；`currentCharacterId` 为空时直接返回 |
| `loadLocations()` | 从数据库加载地点数据；跳过缺少 `mapX`/`mapY` 坐标的地点并打印警告 |

### Store 常量

| 常量 | 值 | 说明 |
|------|----|------|
| `ZOOM_MIN` | `1` | 缩放下限 |
| `ZOOM_MAX` | `5` | 缩放上限 |
| `PAN_MIN` | `-50` | 平移下限 |
| `PAN_MAX` | `50` | 平移上限 |
| `DEFAULT_MAP_VIEW` | `{ zoomLevel: 1, panX: 0, panY: 0 }` | 默认地图视图 |

### Store 辅助函数

```typescript
/** 数值钳制到 [min, max] 区间 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
```

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
  unlockedZones?: string[];
  completedZones?: string[];
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

/** 区域奖励接口（预留，待后续从配置数据填充真实值） */
export interface ZoneRewards {
  gold: number;
  exp: number;
}

/** 地图区域接口（用于大地图显示） */
export interface MapZone {
  id: string;
  name: string;
  icon: string;
  description: string;
  coordinates: { x: number; y: number };
  requiredLevel: number;
  requiredGold?: number;
  status: ZoneStatus;
  rewards?: ZoneRewards;
}

// ==================== 存储/持久化接口 ====================

/** 地图状态存储格式 */
export interface MapStateStorage {
  id: string;
  view?: MapView;
  currentLocationId?: string;
  currentTab?: string;
  unlockedZones?: string[];
  completedZones?: string[];
}

/**
 * 地点/大陆存储格式（通过 type 字段区分）
 * 统一的地点与大陆持久化存储类型，同时供 map/db.ts 和 data/service.ts 使用
 */
export interface LocationStorage {
  id: string;
  name: string;
  icon: string;
  description: string;
  type: 'location' | 'continent';
  continent?: string;
  enemies?: string[];
  bosses?: string[];
  quests?: string[];
  levelRange?: [number, number];
  mapX?: number;
  mapY?: number;
  color?: string;
  position?: string;
}
```

### 事件定义

| 事件名 | 载荷 | 发射时机 |
|--------|------|----------|
| `GameEvents.ZONE_ENTERED` | `{ locationId: string, location: LocationData }` | `enterZone` 成功设置 currentLocation 后 |

---

## 业务逻辑流程

### 初始化流程

1. 调用 `mapStore.initialize(characterId)`
2. 设置 `currentCharacterId`
3. 从 `runtime_mapState` 表加载该角色的地图状态（键 `map_${characterId}`）：
   - 若存在 `savedState.view`，恢复 `view`、`unlockedZones`（默认 `[]`）、`completedZones`（默认 `[]`）
   - 否则使用 `DEFAULT_MAP_VIEW` 初始化
4. 调用 `loadLocations()` 从 `config_locations` 表加载所有地点数据（仅 `type='location'`），写入 `locations` Map；跳过缺少 `mapX`/`mapY` 坐标的地点并打印警告
5. 从数据库恢复上次选中的区域 ID（`getCurrentLocationId`），若存在则通过 `getLocationById` 查找并设置 `currentLocation`
6. 标记 `initialized = true`

### 进入区域流程

1. 调用 `mapStore.enterZone(zoneId)`
2. 从 `locations` Map 查找地点数据（`getLocationById`），不存在则返回 `false`
3. 设置 `currentLocation = location`
4. 持久化当前区域 ID 到 `runtime_mapState`（按角色隔离，fire and forget，捕获错误避免影响调用方）
5. 发射 `ZONE_ENTERED` 事件（载荷 `{ locationId: zoneId, location }`）
6. 返回 `true`
7. 探索模块监听此事件后进入对应区域

### 区域状态判定流程

`getZones(playerLevel)` 遍历 `locations` Map 中所有地点，调用纯函数 `getZoneStatus(state, location.id, location, playerLevel)` 判定状态，并组装为 `MapZone` 格式（不含 `requiredGold` 和 `rewards` 字段）：

| 状态 | 条件 | 优先级 |
|------|------|--------|
| `completed` | 区域在 `state.completedZones` 列表中 | 1（最高） |
| `unlocked` | 区域在 `state.unlockedZones` 列表中（手动解锁） | 2 |
| `unlocked` | 角色等级 >= `location.levelRange[0]`（等级满足自动解锁） | 3 |
| `locked` | 以上都不满足 | 4（最低） |

### 地点解锁检查流程

1. 调用 `isLocationUnlocked(locationId, playerLevel)`
2. 从 `locations` Map 查找地点数据（`getLocationById`），不存在则返回 `false`
3. 调用纯函数 `isLocationAccessible(location, playerLevel)`
4. 比较 `characterLevel >= location.levelRange[0]`

### 视图操作流程

- `zoomTo(level)`：将 `level` 钳制到 `[ZOOM_MIN, ZOOM_MAX]` 后写入 `state.view.zoomLevel`，调用 `safeSaveState()` 持久化
- `panTo(x, y)`：将 `x`/`y` 分别钳制到 `[PAN_MIN, PAN_MAX]` 后写入 `state.view.panX`/`panY`，调用 `safeSaveState()` 持久化
- `resetView()`：重置 `state.view` 为 `DEFAULT_MAP_VIEW`，调用 `safeSaveState()` 持久化
- `setCurrentContinent(continentId)`：写入 `state.view.currentContinentId`，调用 `safeSaveState()` 持久化

### 清除 UI 状态流程

1. 调用 `mapStore.clearUIState()`
2. 重置 `state` 为 `{ view: { ...DEFAULT_MAP_VIEW } }`
3. 清空 `currentLocation` 为 `null`
4. 清空 `locations` 为新 `Map()`
5. 设置 `initialized = false`
6. **不删除数据库数据**

---

## 纯函数层 (service.ts)

| 函数 | 签名 | 说明 |
|------|------|------|
| `getLocationById` | `(locations: Map<string, LocationData>, id: string) => LocationData \| undefined` | 根据 ID 从 Map 中查找地点 |
| `isLocationAccessible` | `(location: LocationData, characterLevel: number) => boolean` | 检查等级是否满足最低要求（`characterLevel >= location.levelRange[0]`） |
| `getZoneStatus` | `(state: MapState, zoneId: string, location: LocationData, characterLevel: number) => ZoneStatus` | 获取区域状态，优先级：completed > 手动 unlocked > 等级 unlocked > locked |
| `getLocationsByContinent` | `(locations: Map<string, LocationData>, continentId: string) => LocationData[]` | 筛选指定大陆的地点列表（遍历 Map 匹配 `location.continent`） |

---

## DB 层方法 (MapDbService)

| 方法 | 表 | 说明 |
|------|-----|------|
| `saveMapState(characterId, state)` | `runtime_mapState` | 保存地图视图状态（合并写入，使用事务确保读-改-写原子性） |
| `getMapState(characterId)` | `runtime_mapState` | 获取指定角色的地图状态（返回 `MapStateStorage \| null`） |
| `getLocationData(locationId)` | `config_locations` | 获取单个地点数据（经 `mapToLocationData` 转换） |
| `getAllLocationData()` | `config_locations` | 获取所有地点数据（`where('type').equals('location')` 筛选，经 `mapToLocationData` 转换） |
| `clearMapState(characterId)` | `runtime_mapState` | 清空指定角色的地图状态（`delete` 操作） |
| `saveCurrentLocationId(characterId, locationId)` | `runtime_mapState` | 保存当前选中的区域 ID（合并写入，使用事务确保原子性） |
| `getCurrentLocationId(characterId)` | `runtime_mapState` | 获取指定角色的当前选中区域 ID |
| `saveCurrentTab(characterId, tab)` | `runtime_mapState` | 保存当前标签页（合并写入，使用事务确保原子性） |
| `getCurrentTab(characterId)` | `runtime_mapState` | 获取指定角色的当前标签页 |

### 私有辅助函数

| 函数 | 说明 |
|------|------|
| `getMapStateKey(characterId)` | 根据角色 ID 生成存储键 `map_${characterId}` |
| `mapToLocationData(storage)` | 将 `LocationStorage` 转换为 `LocationData` 业务类型（缺省字段使用默认值：`continent=''`、`levelRange=[1,1]`、`color='#000000'`、`mapX=0`、`mapY=0`） |

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| `config_locations` | `locationId` | `LocationStorage` | 地点/大陆数据（全局共享，通过 `type='location'` 筛选地点） |
| `runtime_mapState` | `map_${characterId}` | `MapStateStorage` | 地图视图状态（按角色隔离） |

### LocationStorage 存储内容 (config_locations)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 地点/大陆唯一标识 |
| `name` | string | 名称 |
| `icon` | string | 图标 |
| `description` | string | 描述 |
| `type` | `'location' \| 'continent'` | 类型标识（统一存储，通过此字段区分） |
| `continent?` | string | 所属大陆 ID（地点类型使用） |
| `enemies?` | string[] | 敌人列表 |
| `bosses?` | string[] | Boss 列表 |
| `quests?` | string[] | 任务列表 |
| `levelRange?` | [number, number] | 等级范围 |
| `mapX?` | number | 地图 X 坐标 |
| `mapY?` | number | 地图 Y 坐标 |
| `color?` | string | 主色调 |
| `position?` | string | 位置描述（大陆类型使用） |

### MapStateStorage 存储内容 (runtime_mapState)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | `map_${characterId}` |
| `view?` | MapView | 地图视图（zoomLevel, panX, panY, currentContinentId?） |
| `currentLocationId?` | string | 当前选中的区域 ID |
| `currentTab?` | string | 当前标签页 |
| `unlockedZones?` | string[] | 手动解锁的区域 ID 列表 |
| `completedZones?` | string[] | 已完成的区域 ID 列表 |

### 多角色支持说明

地点数据（`config_locations`）为全局共享。地图视图状态通过 `map_${characterId}` 键实现角色隔离，每个角色拥有独立的缩放、平移、当前大陆、当前选中区域和标签页设置。

### 默认视图状态

```typescript
const DEFAULT_MAP_VIEW = {
  zoomLevel: 1,
  panX: 0,
  panY: 0
};
```

---

## 与其他模块的交互关系

### 依赖关系

- **事件总线**: `eventBus` + `GameEvents`（来自 `../bus`），发布 `ZONE_ENTERED` 事件
- **数据层**: `dbService.withRetry`（来自 `../data/core`），`gameDb.runtime_mapState` 和 `gameDb.config_locations` 表

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 探索模块 | 事件 | 发射 `ZONE_ENTERED` 事件，探索模块监听后进入区域 |
| 角色模块 | 调用方传参 | 调用方（如 UI 组件）传入 `playerLevel` 用于解锁判断 |
| 事件总线 | 发布 | 发布 `ZONE_ENTERED` 事件 |

### 事件发布清单

| 事件 | 发射位置 | 载荷 |
|------|----------|------|
| `ZONE_ENTERED` | `enterZone` 设置 currentLocation 并持久化后 | `{ locationId: string, location: LocationData }` |

---

## 异常处理机制

### 异常类型与处理策略

| 异常类型 | 触发条件 | 处理策略 |
|----------|----------|----------|
| 存储读取失败 | IndexedDB 解析错误 | `dbService.withRetry` 自动重试；`getMapState` 返回 null 时使用默认值初始化 |
| 存储写入失败 | IndexedDB 写入异常 | `dbService.withRetry` 自动重试；`safeSaveState` 捕获并记录错误，不影响调用方 |
| 当前区域保存失败 | `saveCurrentLocationId` 异常 | fire and forget，捕获并记录错误，不影响 `enterZone` 返回值 |
| 地点不存在 | 操作不存在的地点 | `getLocationById` 返回 `undefined`；`enterZone` 返回 `false`；`isLocationUnlocked` 返回 `false` |
| 地点缺少坐标 | `loadLocations` 时 `mapX`/`mapY` 为 null | 跳过该地点并打印警告 |
| 等级不足 | 进入等级要求未满足的地点 | 不阻止，由调用方判断 |

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 内存缓存 | `Map<string, LocationData>` 结构缓存地点数据 | O(1) 查找 |
| 纯函数计算 | service.ts 状态判定均为无副作用纯函数 | 可测试、可复用 |
| 异步加载 | Store 初始化时异步从 IndexedDB 读取 | 不阻塞主线程 |
| 深拷贝返回 | `getState()` 返回深拷贝防止外部修改污染 Store | 状态隔离 |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 输入验证 | 缩放和平移操作通过 `clamp` 进行边界限制 |
| 数据隔离 | 使用 `map_${characterId}` 前缀隔离角色数据 |
| 事务原子性 | `saveMapState`/`saveCurrentLocationId`/`saveCurrentTab` 使用 `gameDb.transaction('rw', ...)` 确保读-改-写原子性 |
| 异常捕获 | 所有 IO 操作通过 `dbService.withRetry` 包裹；`safeSaveState` 捕获错误避免影响调用方 |
| 重试机制 | `dbService.withRetry` 失败时自动重试 |

---

## 模块文件结构

```
src/modules/map/
  - index.ts          # 模块入口，统一导出
  - types.ts          # 类型定义（含存储类型）
  - db.ts             # IndexedDB 数据库操作层（MapDbService）
  - store.ts          # Pinia Store 状态管理（useMapStore）
  - service.ts        # 纯函数层
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | 模块入口，统一导出 types（`ContinentData`/`MapView`/`MapState`/`LocationData`/`ZoneStatus`/`ZoneRewards`/`MapZone`/`MapStateStorage`/`LocationStorage`）、`mapDbService`、`useMapStore` |
| `types.ts` | TypeScript 类型定义：`ContinentData`、`MapView`、`MapState`、`LocationData`、`ZoneStatus`、`ZoneRewards`、`MapZone`，以及存储类型 `MapStateStorage`、`LocationStorage` |
| `db.ts` | IndexedDB 数据库操作层（`MapDbService` 类），封装 `runtime_mapState` 和 `config_locations` 表的 CRUD，含私有 `getMapStateKey`/`mapToLocationData` 转换函数 |
| `store.ts` | Pinia Store 状态管理（`useMapStore`），编排业务逻辑，定义常量（`ZOOM_MIN/MAX`、`PAN_MIN/MAX`、`DEFAULT_MAP_VIEW`）、辅助函数 `clamp`、内部函数 `safeSaveState`/`loadLocations`，跨模块调用 eventBus |
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
| v5.0 | 2026-07-10 | 严格依据源码重写：补充 MapState.unlockedZones?/completedZones? 字段及 MapStateStorage 对应字段；修正 MapZone.requiredGold/rewards 为可选字段；补充 LocationStorage 统一存储类型定义；移除不存在的 IMapService 接口；移除不存在的 isZoneExplored/getCurrentLocation service 函数；补充 clearMapState DB 方法；补充 store 常量、clamp 辅助函数、safeSaveState/loadLocations 内部函数；补充状态清单及计算属性；补充 getContinentLocations 内部函数（导出别名 getLocationsByContinent）；修正 getZoneStatus 优先级；修正 saveMapState 使用事务确保原子性；修正 enterZone 事件载荷 | System |

---

**文档结束**
