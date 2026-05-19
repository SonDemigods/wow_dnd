# 地图模块设计文档

## 文档信息

| 项目   | 内容            |
| ---- | ------------- |
| 标题   | 地图模块设计文档      |
| 版本   | v2.0          |
| 生成日期 | 2026年5月19日    |
| 所属模块 | `modules/map` |

***

## 模块概述与定位

### 模块定位

地图模块是游戏世界的探索核心，负责管理地图显示、区域标记、等级解锁和探索入口。该模块为玩家提供探索游戏世界的基础功能。

### 核心职责

| 职责     | 描述                              |
| ------ | ------------------------------- |
| 地图视图管理 | 管理地图的缩放、平移等视图状态                 |
| 区域标记   | 在地图上显示各个区域的标记                   |
| 等级解锁   | 根据玩家等级解锁可进入的地点                  |
| 探索入口   | 点击区域标记显示区域信息弹窗，点击探索按钮进入该区域的探索界面 |
| 数据持久化  | 实现地图数据的本地存储与加载                  |

### 模块边界

**地图模块**与以下模块交互:

- 探索模块:进入探索区域
- 角色模块:获取玩家等级
- 游戏数据:大陆/地点数据

***

## 功能需求

### 功能需求列表

| 需求编号       | 需求描述                   | 来源   |
| ---------- | ---------------------- | ---- |
| FR-MAP-001 | 支持世界地图模式(背景图上显示区域标记) | 游戏设计 |
| FR-MAP-002 | 支持地图缩放                 | 用户体验 |
| FR-MAP-003 | 支持地图平移                 | 用户体验 |
| FR-MAP-004 | 在地图上标记各个区域的标记           | 探索功能 |
| FR-MAP-005 | 随等级解锁地点显示               | 等级系统 |
| FR-MAP-006 | 点击区域标记进入探索区域           | 探索功能 |
| FR-MAP-007 | 数据持久化存储                | 存档系统 |

### 非功能需求

| 需求编号        | 需求描述            | 优先级 |
| ----------- | --------------- | --- |
| NFR-MAP-001 | 操作失败时回滚数据       | 高   |
| NFR-MAP-002 | 单次操作响应时间 < 10ms | 高   |

***

## 接口定义

### 服务接口 IMapService

```typescript
export interface IMapService {
  getState(): MapState;
  getContinentData(continentId: string): ContinentData | null;
  getLocationData(locationId: string): LocationData | null;
  getAllContinents(): ContinentData[];
  getLocationsByContinent(continentId: string): LocationData[];
  getLocationMarkers(continentId: string): LocationMarker[];
  getUnlockedLocations(playerLevel: number): string[];
  isLocationUnlocked(locationId: string, playerLevel: number): boolean;
  enterLocation(locationId: string): boolean;
  setMapMode(mode: MapMode): void;
  zoomTo(level: number): void;
  panTo(x: number, y: number): void;
  resetView(): void;
  reset(): void;
}
```

### 数据类型定义

```typescript
export type MapMode = 'world';

export type LocationMarkerType = 
  | 'dungeon' | 'raid' | 'city' | 'town' 
  | 'village' | 'poi' | 'special';

export interface LocationMarker {
  id: string;
  type: LocationMarkerType;
  x: number;
  y: number;
  icon: string;
  name: string;
  locationId: string;
  requiredLevel: number;
  difficulty?: 'normal' | 'heroic' | 'mythic';
  parentMarkerId?: string;
}

export interface MapView {
  mode: MapMode;
  zoomLevel: number;
  panX: number;
  panY: number;
  currentContinentId?: string;
  showMarkers: boolean;
  activeMarkerId?: string;
}

export interface MapState {
  view: MapView;
}
```

### 事件定义

| 事件名称                       | 触发时机      | 事件数据                       |
| -------------------------- | --------- | -------------------------- |
| `MAP_LOCATION_ENTERED`      | 进入探索区域时    | `{ locationId, location }` |
| `MAP_MARKERS_UPDATED`       | 标记列表变化时    | `{ markers }`              |
| `MAP_MODE_CHANGED`          | 地图模式变化时    | `{ mode }`                 |
| `MAP_UNLOCKED_LOCATIONS_CHANGED` | 解锁地点变化时 | `{ locations }`            |

***

## 业务逻辑流程

### 进入探索区域流程

1. 调用 `enterLocation(locationId)` 方法
2. 检查地点是否存在
3. 获取玩家等级，检查是否满足等级要求
4. 如果满足，触发 `MAP_LOCATION_ENTERED` 事件
5. 跳转到探索界面

### 地点解锁检查流程

1. 调用 `getUnlockedLocations(playerLevel)` 方法
2. 获取所有地点列表
3. 筛选出 requiredLevel <= playerLevel 的地点
4. 返回已解锁的地点列表
5. 触发 `MAP_UNLOCKED_LOCATIONS_CHANGED` 事件

***

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| gameState | 'gameState' | MapConfigData | 地图配置（全局共享） |
| characterData | `characterId` | MapViewData | 地图视图状态（按角色隔离） |

### MapConfigData 存储内容（全局共享）

| 字段   | 类型     | 默认值 | 说明       |
| ---- | ------ | --- | -------- |
| `id` | string | 'gameState' | 唯一标识 |
| `updatedAt` | number | Date.now() | 最后更新时间 |

### MapViewData 存储内容（按角色隔离）

| 字段   | 类型     | 默认值 | 说明       |
| ---- | ------ | --- | -------- |
| `characterId` | string | - | 角色唯一标识 |
| `view` | MapView | 见下方 | 当前视图状态   |
| `updatedAt` | number | Date.now() | 最后更新时间 |

### 多角色支持说明

地图配置数据为全局共享数据，不随角色变化。地图视图状态（缩放、平移等）通过 `characterId` 字段实现角色隔离，每个角色拥有独立的视图设置。切换角色时，系统自动加载对应角色的视图状态。删除角色时，级联删除该角色的视图数据。

### MapView 默认值

```typescript
{
  mode: 'world',
  zoomLevel: 1,
  panX: 0,
  panY: 0,
  currentContinentId: undefined,
  showMarkers: true,
  activeMarkerId: undefined
}
```

### 同步机制

| 同步类型 | 触发条件 | 延迟 |
|----------|----------|------|
| 自动同步 | 状态变更 | 500ms 防抖 |
| 立即同步 | 关键操作 | 即时 |
| 页面卸载 | beforeunload | 即时 |

***

## 与其他模块的交互关系

### 依赖关系

- **事件总线**:发布地图事件
- **配置管理**:configManager
- **游戏数据**:CONTINENTS/WORLD_LOCATIONS

### 交互模块

| 模块    | 交互方式  | 说明             |
| ----- | ----- | -------------- |
| 探索模块  | 事件发布  | 触发进入探索区域事件     |
| 角色模块  | 数据获取  | 获取玩家等级用于解锁判断   |
| 事件总线  | 发布/订阅 | 发布地图事件,供UI组件监听 |

***

## 异常处理机制

### 异常类型与处理策略

| 异常类型   | 触发条件              | 处理策略          |
| ------ | ----------------- | ----------- |
| 存储读取失败 | IndexedDB 解析错误 | 使用默认值初始化    |
| 存储写入失败 | IndexedDB 写入异常 | 进入重试队列，指数退避重试 3 次 |
| 地点不存在  | 进入不存在的地点         | 返回 false      |
| 等级不足   | 进入等级要求未满足的地点    | 返回 false,提示等级要求 |

***

## 性能与安全考量

### 性能优化

| 优化点   | 实现方式           | 预期效果     |
| ---- | -------------- | -------- |
| 懒加载   | 仅在需要时加载数据    | 加快启动速度    |
| 标记聚合  | 大缩放级别聚合显示标记  | 减少渲染数量    |
| 防抖同步 | 500ms 延迟合并写入 | 减少 IO 操作 |
| 批量写入 | SyncEngine 批量处理 | 提升性能 |
| 异步加载 | Store 初始化时异步从 IndexedDB 读取 | 不阻塞主线程 |

### 数据安全

| 安全措施 | 实现方式               |
| ---- | ------------------ |
| 输入验证 | 所有操作进行参数检查         |
| 数据隔离 | 使用独立对象存储            |
| 异常捕获 | 防止程序崩溃             |
| 重试机制 | 失败时自动重试 3 次       |
| 数据校验 | 写入前验证数据结构           |

***

## 模块文件结构

```
src/modules/map/
  - index.ts          # 核心实现（Store + Service）
  - types.ts          # 类型定义
```

### 文件职责说明

| 文件         | 职责                            |
| ---------- | ----------------------------- |
| `index.ts` | Pinia Store 实现、服务接口实现、数据持久化逻辑 |
| `types.ts` | TypeScript 类型定义、接口定义          |

***

## 版本历史

| 版本   | 日期         | 修改内容                              | 作者     |
| ---- | ---------- | --------------------------------- | ------ |
| v1.0 | 2026-05-15 | 初始版本,包含基础地图功能                   | System |
| v1.1 | 2026-05-18 | 精简功能:移除导航、收藏、自定义标记；添加等级解锁和探索入口 | System |
| v2.0 | 2026-05-19 | 迁移到 Pinia + IndexedDB 架构，实现自动同步持久化 | System |

***

**文档结束**
