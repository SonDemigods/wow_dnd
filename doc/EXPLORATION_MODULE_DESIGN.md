# 探索模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 探索模块设计文档 |
| 版本 | v3.0 |
| 生成日期 | 2026年6月16日 |
| 所属模块 | `modules/exploration` |

---

## 模块概述与定位

### 模块定位

探索模块负责管理玩家在探索区域中的探索过程，包括 10×10 网格生成、格子翻开、事件触发、营地恢复、商店/任务板交互、战斗触发等功能。该模块通过 Store 中心化架构直接调用其他模块的 Action，替代了早期的事件总线跨模块通信。

### 核心职责

| 职责 | 描述 |
|------|------|
| 网格管理 | 10×10 探索格子的状态管理（ExplorationCell 二维数组） |
| 网格生成 | 使用随机算法生成网格事件分布，优先放置任务所需怪物 |
| 探索内容管理 | 进入区域时重置探索状态，支持从数据库恢复 |
| 格子事件触发 | 怪物/Boss（触发战斗）、宝物（发放物品）、陷阱（伤害）、事件（随机效果）、营地（恢复） |
| 商店/任务板 | 探索格子中集成的商店和任务板交互 |
| 数据持久化 | 实现探索数据的本地存储与加载（`char_exploration` 表） |
| UI 回调 | 通过 `registerUICallbacks` 注册 UI 回调，替代 EventBus 跨模块数据事件 |

### 模块边界

**探索模块**与以下模块交互（直接 Store Action 调用）:
- 地图模块: 从地图模块进入探索区域（`mapStore.enterZone` → `explorationStore.enterArea`）
- 角色模块: 角色状态管理（`characterStore.takeDamage/receiveHeal/gainGold/gainExp`）
- 战斗模块: 怪物战斗（发射 `EXPLORATION_BATTLE_TRIGGERED` 事件，监听 `COMBAT_END`）
- 商店模块: 探索区域内的商店（`shopStore.openShop`）
- 任务模块: 任务看板交互（通过 `questDbService.getQuestDefinitionsByBoard` 获取任务怪物）
- 背包模块: 物品获取（`inventoryStore.addItem/getItemInfo`）
- 冒险日志模块: 记录探索事件

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-EXP-001 | 每次进入探索区域时重新生成网格 | 探索机制 |
| FR-EXP-002 | 探索界面由 10×10 格子组成 | 界面设计 |
| FR-EXP-003 | 格子默认状态为未探索 | 初始状态 |
| FR-EXP-004 | 默认放置起点、商店、任务板、营地、Boss 五个固定类型 | 核心功能 |
| FR-EXP-005 | 营地可恢复全部生命值和法力值（每个区域限一次） | 营地功能 |
| FR-EXP-006 | 商店支持交易，可多次交易 | 商店功能 |
| FR-EXP-007 | 任务看板支持任务交接 | 任务功能 |
| FR-EXP-008 | 每个格子翻开后触发对应事件（怪物/Boss/宝物/陷阱/事件/营地） | 事件系统 |
| FR-EXP-009 | 怪物/Boss 格子战斗胜利后标记为已完成（褪色），失败可再次挑战 | 格子状态 |
| FR-EXP-010 | 击败 Boss 或探索所有格子后探索完成 | 完成条件 |
| FR-EXP-011 | 数据持久化存储（支持中断恢复） | 存档系统 |
| FR-EXP-012 | 网格生成时优先放置任务所需的普通怪物 | 任务系统 |
| FR-EXP-013 | 支持剩余移动步数系统（初始20步） | 探索限制 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-EXP-001 | 操作失败时回滚数据 | 高 |
| NFR-EXP-002 | 单次操作响应时间 < 10ms | 高 |

---

## 接口定义

### 服务接口 IExplorationService

```typescript
export interface IExplorationService {
  getState(): ExplorationState;
  enterArea(areaId: string): Promise<void>;
  generateGrid(): void;
  movePlayer(direction: 'up' | 'down' | 'left' | 'right'): MoveResult;
  canMove(direction: 'up' | 'down' | 'left' | 'right'): boolean;
  handleEventChoice(choiceId: string): EventChoiceResult;
  getGrid(x: number, y: number): GridCell | null;
  revealGrid(x: number, y: number): Promise<boolean>;
  useCamp(): boolean;
  triggerBattle(monsterId: string): void;
  onBattleResult(victory: boolean): void;
  getCurrentAreaId(): string | null;
  reset(): void;
}
```

### Store Action 方法（实际对外接口）

| 方法 | 说明 |
|------|------|
| `init(characterId)` | 初始化探索模块，从数据库恢复状态 |
| `enterArea(areaId)` | 进入区域开始探索（加载配置→生成网格→持久化） |
| `revealGrid(x, y)` | 揭示指定坐标的格子并触发对应事件 |
| `revealAllCells()` | 揭示所有格子（调试命令专用） |
| `onBattleResult(victory)` | 处理战斗结果 |
| `triggerBattle(monsterId)` | 触发战斗事件 |
| `reset()` / `exitExploration()` | 退出探索 |
| `useCamp()` | 使用营地恢复 |
| `registerUICallbacks(callbacks)` | 注册 UI 回调 |
| `unregisterUICallbacks()` | 取消注册 UI 回调 |

### Store 状态属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `currentAreaId` | string \| null | 当前探索区域ID |
| `grid` | ExplorationCell[][] | 10×10 探索网格 |
| `campUsed` | boolean | 营地是否已使用 |
| `isExploring` | boolean | 是否正在探索中 |
| `playerPosition` | { x, y } | 玩家当前位置 |
| `visitedCells` | number | 已访问格子数（初始为3） |
| `remainingMoves` | number | 剩余移动步数（初始20） |
| `bossDefeated` | boolean | Boss 是否被击败 |
| `explorationComplete` | boolean | 探索是否完成 |

### 数据类型定义

```typescript
/** 网格状态枚举（7种） */
export type GridStatus = 'unexplored' | 'revealed' | 'used' | 'camp' | 'shop' | 'board' | 'boss';

/** 网格事件类型枚举（9种） */
export type GridEventType = 'monster' | 'item' | 'trap' | 'event' | 'empty' | 'camp' | 'shop' | 'board' | 'boss';

/** 网格单元格（用于 GridCell 接口定义） */
export interface GridCell {
  x: number;
  y: number;
  status: GridStatus;
  eventType?: GridEventType;
  eventData?: {
    shopId?: string;
    boardId?: string;
    monsterId?: string;
    itemId?: string;
    trapId?: string;
  };
}

/** 探索单元格（实际网格数据使用的类型） */
export interface ExplorationCell {
  x: number;
  y: number;
  type: string;
  explored: boolean;
  accessible: boolean;
  visited: boolean;
  completed?: boolean;
  monsterId?: string;
}

/** 探索状态 */
export interface ExplorationState {
  currentAreaId: string | null;
  grid: ExplorationCell[][];
  campUsed: boolean;
  playerPosition: { x: number; y: number };
  visitedCells: number;
  remainingMoves: number;
  bossDefeated: boolean;
  explorationComplete: boolean;
}

/** 网格事件概率 */
export interface GridEventProbability {
  monster: number;
  item: number;
  trap: number;
  event: number;
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

/** 网格生成配置 */
export interface GridGenerationConfig {
  size?: number;
  eventProbability: GridEventProbability;
  monsterPool: string[];
  bossPool: string[];
  questNormalMonsters: string[];
}

/** 随机事件效果类型（6种） */
export type RandomEventEffectType = 'heal' | 'mana' | 'exp' | 'damage' | 'mpLoss' | 'gold';
```

### 格子类型与处理方式

| 格子类型 | 事件处理 | 完成后行为 |
|----------|----------|------------|
| `start` | 起点（初始已探索） | - |
| `shop` | 打开商店（`shopStore.openShop`） | 可多次交互 |
| `board` | 打开任务板（发射事件） | 可多次交互 |
| `rest` | 营地休息（恢复全部 HP/MP） | 标记为 campUsed |
| `boss` | 触发 Boss 战斗 | 胜利后 bossDefeated=true |
| `monster` | 触发普通怪物战斗 | 胜利后 completed=true |
| `treasure` | 发放物品奖励 | completed=true |
| `trap` | 造成伤害 | completed=true |
| `event` | 随机事件效果 | completed=true |
| `empty` | 无事件 | completed=true |

---

## 业务逻辑流程

### 初始化流程

1. 调用 `explorationStore.init(characterId)`
2. 确保日志和背包 Store 已初始化
3. 从 `char_exploration` 表加载角色探索数据
4. 如果存在有效探索数据（含 grid），恢复全部状态
5. 如果不存在，重置为空状态
6. 设置 `COMBAT_END` 事件监听器

### 进入区域流程

1. 调用 `explorationStore.enterArea(areaId)`
2. 加载区域配置（从地图数据获取怪物池、Boss池、物品池）
3. 随机选取一个商店（`pickRandomShop()`）
4. 获取任务所需的怪物列表（从任务定义中提取击杀目标）
5. 调用纯函数 `generateGrid()` 生成网格：
   - 初始化 10×10 空网格
   - 放置固定事件：起点（边缘）、商店（角落）、任务板（角落）、营地（非相邻）、Boss（中心）
   - 优先放置任务所需怪物
   - 剩余格按概率分配：怪物(monster)、宝物(treasure)、陷阱(trap)、事件(event)、空地(empty)
6. 设置起点位置，初始化状态（visitedCells=3, remainingMoves=20）
7. 调用 `updateAccessibleCells()` 更新可访问格子
8. 持久化 → 发射事件 → 记录日志

### 揭示格子流程

1. 调用 `explorationStore.revealGrid(x, y)`
2. 检查格子是否可访问（accessible=true）或已探索但未完成
3. 根据格子类型处理：

| 类型 | 处理逻辑 |
|------|----------|
| `monster` / `boss` | 调用 `triggerBattle(monsterId)`，记录 `pendingBattleCell` |
| `shop` / `board` | 标记已探索，发射 `EXPLORATION_CELL_EXPLORED` 事件，通知 UI 回调 |
| `treasure` | 随机选物品 → `inventoryStore.addItem` → 标记 completed |
| `trap` | 计算伤害 → `characterStore.takeDamage` → 标记 completed |
| `event` | 生成随机事件 → 执行对应效果（heal/mana/exp/damage/mpLoss/gold）→ 标记 completed |
| `rest` | 营地恢复 → 恢复全部 HP/MP → 标记 completed |
| `empty` | 直接标记 completed |

4. 更新可访问格子、检查完成条件、持久化

### 营地恢复

营地格子被翻开时调用 `useCampInternal()`：
- 检查 `campUsed`，已使用则跳过
- 调用 `generateCampHeal()` 返回 { hp: 9999, mana: 9999 }
- 调用 `characterStore.receiveHeal(9999)` 和 `characterStore.changeMp(9999)`（由角色模块根据上限裁剪）
- 标记 `campUsed = true`
- 每个探索区域只能使用一次营地

### 战斗结果处理

1. 监听 `COMBAT_END` 事件，调用 `onBattleResult(victory)`
2. **胜利**: 标记格子为已探索、已完成（褪色），Boss 类型额外设置 `bossDefeated=true`
3. **失败/逃跑**: 仅标记已探索，保留怪物允许再次挑战
4. 检查完成条件、持久化

### 探索完成条件

满足以下任一条件即判定完成：
- 击败 Boss（`bossDefeated = true`）
- 探索所有格子（`visitedCells >= 100`）

---

## 网格生成算法

### 算法步骤

1. **初始化**: 创建 10×10 全空网格
2. **放置固定事件**:
   - **起点**: 随机边缘位置，已探索、已访问、可访问
   - **商店**: 随机角落（与起点不同角落），已探索、已访问、可访问
   - **任务板**: 另一角落，已探索、已访问、可访问
   - **营地(rest)**: 与所有已占用位置非相邻的位置
   - **Boss**: 中心区域（1/4 到 3/4），与其他占用位置保持 ≥2 格切比雪夫距离
3. **收集空格子**: 除去固定事件外的所有空格子
4. **Fisher-Yates 洗牌**: 打乱空格子顺序
5. **优先放置任务怪物**: 将任务需要的怪物按顺序放入前 N 个空格子
6. **概率分配**: 对剩余格子调用 `determineCellEvent()` 按加权随机分配类型
7. 怪物格随机从 monsterPool 中选取具体怪物ID

### 事件概率计算

调用 `computeEventProbability(avgLevel)` 根据区域等级动态计算：

| 事件类型 | 计算公式（原始值） |
|----------|-------------------|
| monster | Math.min(30, 20 + avgLevel) |
| item | Math.max(15, 25 - avgLevel) |
| trap | Math.min(22, 12 + avgLevel) |
| event | 15 |
| empty | Math.max(15, 30 - avgLevel) |

原始值经归一化确保总和为 100。

### 纯函数列表 (service.ts)

| 函数 | 说明 |
|------|------|
| `generateGrid(config)` | 生成完整的 10×10 探索网格 |
| `findStartPosition(grid)` | 从网格中找到起点位置 |
| `updateAccessibleCells(grid)` | 更新格子可访问状态（已探索格子周围标记为可访问） |
| `determineCellEvent(probability)` | 加权随机选择事件类型 |
| `generateTrapDamage(areaLevel)` | 计算陷阱伤害（baseDamage ± 5） |
| `generateCampHeal(areaLevel)` | 返回营地恢复量（9999 HP / 9999 MP） |
| `generateItemForCell(itemPool)` | 从物品池随机选物品 |
| `generateEnemyForCell(monsterPool)` | 从怪物池随机选怪物 |
| `generateRandomEvent(areaLevel)` | 生成随机事件（heal/mana/exp/damage/mpLoss/gold） |
| `computeEventProbability(avgLevel)` | 根据等级动态计算事件概率分布 |
| `buildItemPool(allItems, minLevel, maxLevel)` | 筛选等级匹配的物品池 |

### 网格类型映射

概率事件类型 → 实际格子类型：

| 概率事件 | 格子类型 | 说明 |
|----------|----------|------|
| `monster` | `monster` | 普通怪物战 |
| `item` | `treasure` | 宝箱/物品 |
| `trap` | `trap` | 陷阱 |
| `event` | `event` | 随机事件 |
| `empty` | `empty` | 空地 |

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| `char_exploration` | `characterId` | ExplorationStorage | 探索完整数据（按角色隔离） |

### ExplorationStorage 存储内容

| 字段 | 类型 | 说明 |
|------|------|------|
| `characterId` | string | 角色唯一标识 |
| `currentAreaId` | string \| null | 当前探索区域ID |
| `assignedShopId` | string | 本次探索分配的商店ID |
| `grid` | ExplorationCell[][] | 10×10 探索网格 |
| `playerPosition` | { x, y } | 玩家位置 |
| `visitedCells` | number | 已访问格子数 |
| `remainingMoves` | number | 剩余移动步数 |
| `bossDefeated` | boolean | Boss 是否被击败 |
| `explorationComplete` | boolean | 探索是否完成 |
| `campUsed` | boolean | 营地是否已使用 |
| `updatedAt` | number | 最后更新时间 |

### 多角色支持说明

探索数据通过 `characterId` 实现角色隔离，每个角色拥有独立的探索进度。兼容旧版本数据，缺失字段使用默认值。

---

## 与其他模块的交互关系

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 地图模块 | 调用 | 从地图进入探索区域（listen `ZONE_ENTERED` → `enterArea`） |
| 角色模块 | 直接调用 | 伤害/恢复/金币/经验操作（`characterStore.takeDamage/receiveHeal/gainGold/gainExp`） |
| 战斗模块 | 事件 | 发射 `EXPLORATION_BATTLE_TRIGGERED`，监听 `COMBAT_END` |
| 商店模块 | 直接调用 | 打开商店（`shopStore.openShop`）、获取商店配置 |
| 任务模块 | 调用 DbService | 获取任务怪物列表（`questDbService.getQuestDefinitionsByBoard`） |
| 背包模块 | 直接调用 | 物品添加/查询（`inventoryStore.addItem/getItemInfo`） |
| 冒险日志模块 | 直接调用 | 记录探索事件（`logStore.addLogEntry`） |

### UI 回调机制

通过 `registerUICallbacks(callbacks)` 注册的 UI 回调替代了跨模块的 EventBus 数据事件：

| 回调 | 触发时机 |
|------|----------|
| `onCellExplored` | 格子被探索（商店/任务板） |
| `onBattleTriggered` | 战斗被触发 |
| `onItemFound` | 物品被发现 |
| `onTrapTriggered` | 陷阱被触发 |
| `onRandomEvent` | 随机事件触发 |

---

## 异常处理机制

### 异常类型与处理策略

| 异常类型 | 触发条件 | 处理策略 |
|----------|----------|----------|
| 格子不存在 | 访问越界格子 | 返回 false |
| 格子不可访问 | 翻开不可访问的格子 | 返回 false |
| 营地已使用 | 重复使用营地 | 返回 false |
| 物品模板不存在 | 宝箱物品无对应模板 | 发放金币+经验作为兜底 |
| 存储读取失败 | IndexedDB 解析错误 | 使用空状态初始化 |
| 存储写入失败 | IndexedDB 写入异常 | 进入重试队列，指数退避重试 3 次 |

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 二维数组 | 使用二维数组存储格子 | O(1) 坐标访问 |
| 纯函数层 | 网格生成/概率计算均为纯函数 | 可测试、可复用 |
| 异步加载 | Store 初始化时异步从 IndexedDB 读取 | 不阻塞主线程 |
| 数据序列化 | `toRawData()` 去除 Vue/Proxy 包装 | 避免 DataCloneError |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 输入验证 | 所有操作进行坐标边界检查 |
| 数据隔离 | 使用 `characterId` 隔离角色数据 |
| 异常捕获 | 防止程序崩溃 |
| 重试机制 | 失败时自动重试 3 次 |
| 数据校验 | 写入前序列化验证数据结构 |

---

## 模块文件结构

```
src/modules/exploration/
  - index.ts          # 模块入口，统一导出
  - types.ts          # 类型定义（GridStatus、ExplorationCell、ExplorationState 等）
  - db.ts             # IndexedDB 数据库操作层（char_exploration）
  - store.ts          # Pinia Store 状态管理（useExplorationStore）
  - service.ts        # 纯函数层（generateGrid、updateAccessibleCells、generateRandomEvent 等）
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | 模块入口、统一导出 |
| `types.ts` | TypeScript 类型定义：`GridStatus`、`GridEventType`、`ExplorationCell`、`ExplorationState`、`AreaConfig`、`GridGenerationConfig` 等 |
| `db.ts` | IndexedDB 数据库操作：`saveExplorationData`、`getExplorationData`、兼容旧数据迁移 |
| `store.ts` | Pinia Store 状态管理（useExplorationStore），编排业务逻辑 |
| `service.ts` | 纯函数层：`generateGrid`、`findStartPosition`、`updateAccessibleCells`、`determineCellEvent`、`generateTrapDamage`、`generateRandomEvent`、`computeEventProbability`、`buildItemPool` 等 |

---

## 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-15 | 初始版本,包含基础探索功能 | System |
| v1.1 | 2026-05-18 | 重新设计探索模块，支持10*10格子、营地、商店、任务看板、格子事件 | System |
| v1.3 | 2026-05-18 | 移除死亡处理逻辑，只发送 `exploration:playerDied` 事件，由角色模块处理 | System |
| v2.0 | 2026-05-19 | 迁移到 Pinia + IndexedDB 架构，实现自动同步持久化 | System |
| v2.1 | 2026-05-19 | 添加探索格子生成算法设计：加权随机选择、怪物等级匹配、物品稀有度分配、陷阱伤害计算 | System |
| v2.2 | 2026-05-19 | 更新格子生成算法：添加BOSS固定格子，确保每个探索区域包含营地、商店、任务看板、BOSS各一个 | System |
| v2.3 | 2026-05-19 | 重构模块交互方式：商店和任务模块调用改为事件驱动方式，通过事件总线触发交互 | System |
| v2.4 | 2026-06-16 | 文件结构拆分为 db/store/service 三层架构 | System |
| v3.0 | 2026-06-16 | 全面对齐实际代码：更新网格类型为 ExplorationCell 体系、添加起点/营地(rest)/宝物(treasure)等格子类型、更新 IExplorationService 接口（添加 generateGrid/movePlayer/canMove/handleEventChoice/onBattleResult）、添加 GridGenerationConfig（含 questNormalMonsters）、添加 UI 回调机制（registerUICallbacks）、更新存储结构（char_exploration）、更新固定事件放置规则（起点+商店+任务板+营地+Boss）、添加 completeQuest/remainingMoves 功能、更新纯函数列表 | System |

---

**文档结束**
