# 探索模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 探索模块设计文档 |
| 版本 | v2.0 |
| 生成日期 | 2026年5月19日 |
| 所属模块 | `modules/exploration` |

***

## 模块概述与定位

### 模块定位

探索模块负责管理玩家在探索区域中的探索过程，包括格子翻开、事件触发、营地恢复、商店交易、任务NPC交互等功能。该模块为玩家提供游戏的探索体验。

### 核心职责

| 职责 | 描述 |
|------|------|
| 格子管理 | 10*10探索格子的状态管理 |
| 探索内容重置 | 切换区域时重置探索内容和冒险日志 |
| 营地功能 | 角色状态恢复 |
| 商店交互 | 探索区域内的商店交易 |
| 任务NPC交互 | 任务交接 |
| 格子事件触发 | 怪物战斗、物品获取、陷阱触发等 |
| 数据持久化 | 实现探索数据的本地存储与加载 |

### 模块边界

**探索模块**与以下模块交互:
- 地图模块: 从地图模块进入探索区域
- 角色模块: 角色状态管理
- 战斗模块: 怪物战斗
- 商店模块: 探索区域内的商店
- 任务模块: 任务交接
- 背包模块: 物品获取

***

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-EXP-001 | 每次切换探索区域重置已探索内容 | 探索机制 |
| FR-EXP-001-1 | 每次切换探索区域重置冒险日志 | 探索机制 |
| FR-EXP-002 | 探索界面由10*10格子组成 | 界面设计 |
| FR-EXP-003 | 格子默认状态为未探索 | 初始状态 |
| FR-EXP-004 | 默认显示营地、商店、任务NPC三个固定格子 | 核心功能 |
| FR-EXP-005 | 点击营地并确认后，角色回满状态，使用后营地失效 | 营地功能 |
| FR-EXP-006 | 商店支持交易，可多次交易 | 商店功能 |
| FR-EXP-007 | 任务NPC支持任务交接 | 任务功能 |
| FR-EXP-008 | 每个格子翻开后触发事件（怪物、物品、陷阱等） | 事件系统 |
| FR-EXP-009 | 翻开后的格子触发事件后失效（怪物存活可再次挑战 | 格子状态 |
| FR-EXP-010 | 数据持久化存储 | 存档系统 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-EXP-001 | 操作失败时回滚数据 | 高 |
| NFR-EXP-002 | 单次操作响应时间 < 10ms | 高 |

***

## 接口定义

### 服务接口 IExplorationService

```typescript
export interface IExplorationService {
  getState(): ExplorationState;
  enterArea(areaId: string): void;
  getGrid(x: number, y: number): GridCell | null;
  revealGrid(x: number, y: number): boolean;
  useCamp(): boolean;
  getShopItems(): ShopItem[];
  buyFromShop(itemId: string, count: number): boolean;
  sellToShop(itemId: string, count: number): boolean;
  interactWithNPC(): NpcInteractionResult;
  startBattle(monsterId: string): boolean;
  getCurrentAreaId(): string | null;
  reset(): void;
}
```

### 数据类型定义

```typescript
export type GridStatus = 'unexplored' | 'revealed' | 'used' | 'camp' | 'shop' | 'npc';

export type GridEventType = 'monster' | 'item' | 'trap' | 'empty' | 'camp' | 'shop' | 'npc';

export interface GridCell {
  x: number;
  y: number;
  status: GridStatus;
  eventType?: GridEventType;
  eventData?: any;
}

export interface ShopItem {
  id: string;
  name: string;
  icon: string;
  price: number;
  count: number;
}

export interface NpcQuest {
  questId: string;
  questName: string;
  questType: 'available' | 'in_progress' | 'completed';
}

export interface NpcInteractionResult {
  availableQuests: NpcQuest[];
  completableQuests: NpcQuest[];
}

export interface ExplorationState {
  currentAreaId: string | null;
  grid: GridCell[][];
  campUsed: boolean;
}
```

### 事件定义

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `EXPLORATION_AREA_ENTERED` | 进入探索区域时 | `{ areaId }` |
| `EXPLORATION_GRID_REVEALED` | 格子翻开时 | `{ x, y, eventType, eventData }` |
| `EXPLORATION_CAMP_USED` | 营地使用时 | - |
| `EXPLORATION_SHOP_ITEM_BOUGHT` | 购买商店物品时 | `{ itemId, count, price }` |
| `EXPLORATION_SHOP_ITEM_SOLD` | 出售物品给商店时 | `{ itemId, count, price }` |
| `EXPLORATION_NPC_INTERACTED` | 与任务NPC交互时 | `{ availableQuests, completableQuests }` |
| `EXPLORATION_MONSTER_DEFEATED` | 怪物被击败时 | `{ monsterId, rewards }` |
| `EXPLORATION_ITEM_FOUND` | 发现物品时 | `{ itemId, count }` |
| `EXPLORATION_TRAP_TRIGGERED` | 触发陷阱时 | `{ trapId, damage }` |
| `EXPLORATION_PLAYER_DIED` | 玩家死亡时 | - |

***

## 业务逻辑流程

### 进入探索区域流程

1. 调用 `enterArea(areaId)` 方法
2. 重置探索状态，所有格子设为未探索
3. 重置冒险日志
4. 初始化营地、商店、任务NPC三个固定格子
5. 随机生成其余格子的事件
6. 保存探索状态
7. 触发 `EXPLORATION_AREA_ENTERED` 事件

### 翻开格子流程

1. 调用 `revealGrid(x, y)` 方法
2. 检查格子是否已翻开或已使用
3. 如果未翻开，设置为已揭示状态
4. 根据事件类型触发对应事件
5. 除怪物类型事件后，格子设为已使用状态
6. 触发 `EXPLORATION_GRID_REVEALED` 事件

### 使用营地流程

1. 调用 `useCamp()` 方法
2. 检查营地是否已使用
3. 如果未使用，恢复角色状态
4. 标记营地为已使用
5. 触发 `EXPLORATION_CAMP_USED` 事件

### 商店交易流程

1. 购买时检查金币是否充足，背包是否有空间
2. 出售时检查物品是否存在
3. 更新物品和金币
4. 触发相应事件

***

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| exploration | 'exploration' | ExplorationData | 探索完整数据 |

### ExplorationData 存储内容

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | string | 'exploration' | 唯一标识 |
| `currentAreaId` | string \| null | null | 当前探索区域ID |
| `grid` | GridCell[][] | 10*10未探索格子 | 10*10探索格子 |
| `campUsed` | boolean | false | 营地是否已使用 |
| `updatedAt` | number | Date.now() | 最后更新时间 |

### 同步机制

| 同步类型 | 触发条件 | 延迟 |
|----------|----------|------|
| 自动同步 | 状态变更 | 500ms 防抖 |
| 立即同步 | 关键操作 | 即时 |
| 页面卸载 | beforeunload | 即时 |

***

## 与其他模块的交互关系

### 依赖关系

- **事件总线**: 发布探索事件
- **游戏数据**: AREAS/GRID_EVENTS

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 地图模块 | 调用 | 从地图进入探索区域 |
| 角色模块 | 调用 | 恢复角色状态 |
| 战斗模块 | 调用 | 怪物战斗 |
| 商店模块 | 调用 | 探索区域商店 |
| 任务模块 | 调用 | 任务交接 |
| 背包模块 | 调用 | 物品获取和交易 |
| 事件总线 | 发布/订阅 | 发布探索事件 |

***

## 异常处理机制

### 异常类型与处理策略

| 异常类型 | 触发条件 | 处理策略 |
|----------|----------|----------|
| 格子不存在 | 访问不存在的格子 | 返回 null |
| 格子已翻开 | 重复翻开格子 | 返回 false |
| 营地已使用 | 重复使用营地 | 返回 false |
| 金币不足 | 购买商店物品 | 返回 false |
| 物品不存在 | 交易不存在的物品 | 返回 false |
| 存储读取失败 | IndexedDB 解析错误 | 使用默认值初始化 |
| 存储写入失败 | IndexedDB 写入异常 | 进入重试队列，指数退避重试 3 次 |

***

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 二维数组 | 使用二维数组存储格子 | 快速访问 |
| 防抖同步 | 500ms 延迟合并写入 | 减少 IO 操作 |
| 批量写入 | SyncEngine 批量处理 | 提升性能 |
| 异步加载 | Store 初始化时异步从 IndexedDB 读取 | 不阻塞主线程 |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 输入验证 | 所有操作进行参数检查 |
| 边界检查 | 防止越界访问 |
| 异常捕获 | 防止程序崩溃 |
| 重试机制 | 失败时自动重试 3 次 |
| 数据校验 | 写入前验证数据结构 |

***

## 模块文件结构

```
src/modules/exploration/
  - index.ts          # 核心实现（Store + Service）
  - types.ts          # 类型定义
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | Pinia Store 实现、服务接口实现、数据持久化逻辑 |
| `types.ts` | TypeScript 类型定义、接口定义 |

***

## 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-15 | 初始版本,包含基础探索功能 | System |
| v1.1 | 2026-05-18 | 重新设计探索模块，支持10*10格子、营地、商店、任务NPC、格子事件 | System |
| v1.3 | 2026-05-18 | 移除死亡处理逻辑，只发送 `exploration:playerDied` 事件，由角色模块处理 | System |
| v2.0 | 2026-05-19 | 迁移到 Pinia + IndexedDB 架构，实现自动同步持久化 | System |

***

**文档结束**
