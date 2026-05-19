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
| 格子生成 | 使用随机算法生成格子事件分布 |
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
| FR-EXP-004 | 默认显示营地、商店、任务NPC、BOSS四个固定格子 | 核心功能 |
| FR-EXP-005 | 点击营地并确认后，角色回满状态，使用后营地失效 | 营地功能 |
| FR-EXP-006 | 商店支持交易，可多次交易 | 商店功能 |
| FR-EXP-007 | 任务NPC支持任务交接 | 任务功能 |
| FR-EXP-008 | 每个格子翻开后触发事件（怪物、物品、陷阱等） | 事件系统 |
| FR-EXP-009 | 翻开后的格子触发事件后失效（怪物存活可再次挑战 | 格子状态 |
| FR-EXP-010 | 数据持久化存储 | 存档系统 |
| FR-EXP-011 | 使用随机算法生成格子事件分布 | 算法设计 |
| FR-EXP-011-1 | 事件类型概率配置可配置，支持动态调整 | 算法设计 |
| FR-EXP-011-2 | 怪物等级与探索区域等级匹配 | 算法设计 |
| FR-EXP-011-3 | 物品掉落品质与探索区域等级相关 | 算法设计 |

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
  getBoardQuests(boardId: string): QuestDetails[];
  acceptQuestFromBoard(boardId: string, questKey: string): boolean;
  turnInQuestToBoard(boardId: string, questKey: string): boolean;
  startBattle(monsterId: string): boolean;
  getCurrentAreaId(): string | null;
  reset(): void;
}
```

### 数据类型定义

```typescript
export type GridStatus = 'unexplored' | 'revealed' | 'used' | 'camp' | 'shop' | 'board' | 'boss';

export type GridEventType = 'monster' | 'item' | 'trap' | 'empty' | 'camp' | 'shop' | 'board' | 'boss';

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

/** 格子事件概率配置 */
export interface GridEventProbability {
  monster: number;
  item: number;
  trap: number;
  empty: number;
}

/** 区域配置 */
export interface AreaConfig {
  areaId: string;
  name: string;
  level: number;
  eventProbability: GridEventProbability;
  monsterPool: string[];
  bossPool: string[];
  itemPool: string[];
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

### 格子生成算法流程

1. **初始化阶段**
   - 创建 10x10 的二维数组
   - 所有格子初始化为未探索状态

2. **固定格子放置**
   - 放置营地：随机选择一个边缘格子（第0行、第9行、第0列、第9列）
   - 放置商店：随机选择一个角落格子（确保与营地不同角落）
   - 放置任务NPC：随机选择与营地、商店不相邻的格子
   - 放置BOSS：随机选择地图中心区域的格子（3-6行，3-6列），确保与其他固定格子保持安全距离

3. **随机事件生成**
   - 获取当前区域的事件概率配置
   - 遍历剩余空白格子（共 100 - 4 = 96 个）
   - 对每个格子，使用加权随机算法选择事件类型

4. **怪物等级匹配**
   - 根据区域等级从怪物池中选择合适的怪物
   - 怪物等级 = 区域等级 ± 2

5. **物品品质匹配**
   - 根据区域等级确定物品稀有度权重
   - 区域等级越高，稀有物品概率越高

6. **陷阱难度调整**
   - 陷阱伤害 = 区域等级 × 5 ± 5

7. **算法优化**
   - 使用 Fisher-Yates 洗牌算法确保随机性
   - 限制相同事件类型连续出现的最大次数（最多3次）

***

## 格子生成算法设计

### 算法概述

探索格子生成算法采用**加权随机分配**策略，根据区域配置动态生成事件分布，确保每次探索体验既有随机性又有平衡性。

### 核心算法：加权随机选择

```typescript
function selectEventType(probability: GridEventProbability): GridEventType {
  const total = probability.monster + probability.item + probability.trap + probability.empty;
  let random = Math.random() * total;
  
  if (random < probability.monster) return 'monster';
  random -= probability.monster;
  
  if (random < probability.item) return 'item';
  random -= probability.item;
  
  if (random < probability.trap) return 'trap';
  return 'empty';
}
```

### 事件概率配置

| 区域等级 | 怪物概率 | 物品概率 | 陷阱概率 | 空地概率 | 说明 |
|----------|----------|----------|----------|----------|------|
| 1-5 | 30% | 25% | 15% | 30% | 新手区域，怪物少，物品多 |
| 6-10 | 35% | 20% | 20% | 25% | 普通区域，难度适中 |
| 11-15 | 40% | 18% | 22% | 20% | 困难区域，怪物较多 |
| 16-20 | 45% | 15% | 25% | 15% | 精英区域，高风险高回报 |

### 固定格子放置规则

```typescript
function placeFixedEvents(grid: GridCell[][], areaConfig: AreaConfig): void {
  // 营地：边缘格子（第0行、第9行、第0列、第9列）
  const edgePositions = getEdgePositions();
  const campPos = edgePositions[Math.floor(Math.random() * edgePositions.length)];
  grid[campPos.y][campPos.x] = createCampCell(campPos.x, campPos.y);
  
  // 商店：角落格子（确保与营地不同角落）
  const corners = [[0,0], [0,9], [9,0], [9,9]];
  const availableCorners = corners.filter(c => !isOccupied(grid, c[0], c[1]));
  const shopPos = availableCorners[Math.floor(Math.random() * availableCorners.length)];
  grid[shopPos[1]][shopPos[0]] = createShopCell(shopPos[0], shopPos[1]);
  
  // 任务看板：与营地、商店不相邻的格子
  const boardPos = findNonAdjacentPosition(grid, [campPos, {x: shopPos[0], y: shopPos[1]}]);
  grid[boardPos.y][boardPos.x] = createBoardCell(boardPos.x, boardPos.y);
  
  // BOSS：地图中心区域（3-6行，3-6列），与其他固定格子保持至少2格距离
  const bossPos = findBossPosition(grid, [campPos, {x: shopPos[0], y: shopPos[1]}, boardPos]);
  const bossId = selectBoss(areaConfig);
  grid[bossPos.y][bossPos.x] = createBossCell(bossPos.x, bossPos.y, bossId);
}

function getEdgePositions(): {x: number, y: number}[] {
  const positions: {x: number, y: number}[] = [];
  // 上边缘（第0行）
  for (let x = 0; x < 10; x++) positions.push({x, y: 0});
  // 下边缘（第9行）
  for (let x = 0; x < 10; x++) positions.push({x, y: 9});
  // 左边缘（第0列，排除角落）
  for (let y = 1; y < 9; y++) positions.push({x: 0, y});
  // 右边缘（第9列，排除角落）
  for (let y = 1; y < 9; y++) positions.push({x: 9, y});
  return positions;
}

function findBossPosition(grid: GridCell[][], occupiedPositions: {x: number, y: number}[]): {x: number, y: number} {
  const centerPositions: {x: number, y: number}[] = [];
  // 中心区域：3-6行，3-6列（共16个格子）
  for (let y = 3; y <= 6; y++) {
    for (let x = 3; x <= 6; x++) {
      if (!isOccupied(grid, x, y)) {
        // 检查与已占用格子的距离（至少2格）
        const isFarEnough = occupiedPositions.every(pos => 
          Math.abs(pos.x - x) >= 2 && Math.abs(pos.y - y) >= 2
        );
        if (isFarEnough) {
          centerPositions.push({x, y});
        }
      }
    }
  }
  
  if (centerPositions.length === 0) {
    // 如果中心区域没有合适位置，返回任意空位
    return findAnyEmptyPosition(grid);
  }
  
  return centerPositions[Math.floor(Math.random() * centerPositions.length)];
}
```

### 怪物等级匹配算法

```typescript
function selectMonster(areaLevel: number, monsterPool: string[]): string {
  // 筛选等级匹配的怪物
  const matchedMonsters = monsterPool.filter(monster => {
    const monsterLevel = getMonsterLevel(monster);
    return Math.abs(monsterLevel - areaLevel) <= 2;
  });
  
  // 如果没有匹配的怪物，使用整个怪物池
  const pool = matchedMonsters.length > 0 ? matchedMonsters : monsterPool;
  
  return pool[Math.floor(Math.random() * pool.length)];
}
```

### BOSS选择算法

```typescript
function selectBoss(areaConfig: AreaConfig): string {
  const { bossPool, level } = areaConfig;
  
  if (bossPool.length === 0) {
    // 如果没有配置BOSS池，从怪物池中选择一个强力怪物作为BOSS
    const strongMonsters = areaConfig.monsterPool.filter(monster => {
      const monsterLevel = getMonsterLevel(monster);
      return monsterLevel >= level + 2;
    });
    
    if (strongMonsters.length > 0) {
      return strongMonsters[Math.floor(Math.random() * strongMonsters.length)];
    }
    
    // 如果没有强力怪物，返回任意怪物
    return areaConfig.monsterPool[Math.floor(Math.random() * areaConfig.monsterPool.length)];
  }
  
  // 从BOSS池中随机选择一个BOSS
  return bossPool[Math.floor(Math.random() * bossPool.length)];
}
```

### 物品稀有度分配算法

```typescript
function selectItemRarity(areaLevel: number): EquipmentRarity {
  const weights: Record<EquipmentRarity, number> = {
    common: 50 - areaLevel * 2,
    uncommon: 30,
    rare: 15 + areaLevel,
    epic: 4 + areaLevel * 0.5,
    legendary: 1 + areaLevel * 0.1
  };
  
  // 归一化权重
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let random = Math.random() * total;
  
  for (const [rarity, weight] of Object.entries(weights)) {
    if (random < weight) return rarity as EquipmentRarity;
    random -= weight;
  }
  
  return 'common';
}
```

### 陷阱伤害计算

```typescript
function calculateTrapDamage(areaLevel: number): number {
  const baseDamage = areaLevel * 5;
  const variance = (Math.random() - 0.5) * 10; // -5 到 +5 的随机值
  return Math.max(1, Math.floor(baseDamage + variance));
}
```

### 算法约束条件

| 约束条件 | 规则 | 目的 |
|----------|------|------|
| 连续相同事件 | 最多连续3个相同事件类型 | 避免单调体验 |
| 营地保护 | 营地周围3x3范围内不放置陷阱 | 保证安全区域 |
| 商店保护 | 商店周围2x2范围内不放置怪物 | 保证交易安全 |
| NPC保护 | NPC周围2x2范围内不放置陷阱 | 保证任务交接安全 |
| BOSS保护 | BOSS周围2x2范围内不放置其他怪物和陷阱 | 保证BOSS战斗空间 |
| BOSS位置 | BOSS必须放置在地图中心区域（3-6行，3-6列） | 确保BOSS处于核心位置 |
| 固定格子间距 | 固定格子之间保持至少2格距离 | 避免拥挤 |
| 事件分布均匀 | 每种事件类型数量在预期范围内 ±10% | 保证平衡性 |

### 算法流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    进入探索区域                              │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              初始化 10x10 格子数组（未探索状态）             │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    放置固定格子                             │
│  ├─ 营地（边缘格子）                                        │
│  ├─ 商店（角落格子）                                        │
│  ├─ 任务看板（与前两者不相邻）                               │
│  └─ BOSS（中心区域，与其他固定格子保持2格距离）              │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    遍历剩余96个格子                          │
│  ├─ 获取区域事件概率配置                                    │
│  ├─ 使用加权随机选择事件类型                                │
│  ├─ 怪物：根据区域等级匹配怪物                              │
│  ├─ 物品：根据区域等级确定稀有度                            │
│  ├─ 陷阱：根据区域等级计算伤害                              │
│  └─ 空地：无事件                                           │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    应用约束条件                             │
│  ├─ 检查连续相同事件数量                                    │
│  ├─ 检查保护区域约束（营地、商店、NPC、BOSS）                │
│  ├─ 检查BOSS位置约束（中心区域）                            │
│  ├─ 检查事件分布均匀性                                      │
│  └─ 必要时重新生成                                          │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    保存探索状态                              │
└─────────────────────────────────────────────────────────────┘
```

***

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| exploration | `characterId` | ExplorationData | 探索完整数据（按角色隔离） |

### ExplorationData 存储内容

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `characterId` | string | - | 角色唯一标识 |
| `currentAreaId` | string \| null | null | 当前探索区域ID |
| `grid` | GridCell[][] | 10*10未探索格子 | 10*10探索格子 |
| `campUsed` | boolean | false | 营地是否已使用 |
| `updatedAt` | number | Date.now() | 最后更新时间 |

### 多角色支持说明

探索数据通过 `characterId` 字段实现角色隔离，每个角色拥有独立的探索进度。切换角色时，系统自动加载对应角色的探索数据。删除角色时，级联删除该角色的探索数据。探索区域配置数据为全局共享，不随角色变化。

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
| v2.1 | 2026-05-19 | 添加探索格子生成算法设计：加权随机选择、怪物等级匹配、物品稀有度分配、陷阱伤害计算 | System |
| v2.2 | 2026-05-19 | 更新格子生成算法：添加BOSS固定格子，确保每个探索区域包含营地、商店、NPC、BOSS各一个 | System |

***

**文档结束**
