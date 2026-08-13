# 探索模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 探索模块设计文档 |
| 版本 | v6.0 |
| 生成日期 | 2026年8月3日 |
| 所属模块 | `modules/exploration` |
| 更新说明 | 对齐 P3-153：`currentCharacterId` 由本地 ref 改为只读 computed 代理 `gameStore.currentCharacterId`（引入 `useGameStore`），`init` 移除该值赋值（保留 `characterId` 参数仅用于 DB 加载）；新增 `modules/game` 模块（P3-116，`useGameStore` 收敛全局游戏状态）及探索 Store 对其的依赖说明；`persistState` 补齐 try-catch + `errorReporter.report`（P3-151，参考 inventory/store.ts）；修正营地恢复量为 `Number.MAX_SAFE_INTEGER`（P3-132）、空事件概率基础值为 28（P3-133）；补充 `ExplorationContext.rng` 可选字段 |

---

## 模块概述与定位

### 模块定位

探索模块负责管理玩家在探索区域中的探索过程，包括 10×10 网格生成、格子翻开、事件触发、营地恢复、商店/任务板交互、战斗触发等功能。该模块通过 Store 中心化架构直接调用其他模块的 Action，跨模块数据通信采用 UI 回调机制替代 EventBus 监听。格子事件结算逻辑通过 `events.ts` 的注册表模式（`effectHandlers` / `cellEventHandlers`）解耦，新增事件类型只需注册处理器而无需修改 store。角色归属标识 `currentCharacterId` 收敛至 game 模块（`useGameStore`）统一管理，探索 Store 通过只读 computed 代理访问（P3-116/P3-153）。

### 核心职责

| 职责 | 描述 |
|------|------|
| 网格管理 | 10×10 探索格子的状态管理（ExplorationCell 二维数组） |
| 网格生成 | 使用随机算法生成网格事件分布，优先放置任务所需怪物，标记隐藏房间 |
| 探索内容管理 | 进入区域时重置探索状态，支持从数据库恢复 |
| 格子事件触发 | 怪物/Boss（触发战斗）、宝物（发放物品）、陷阱（伤害）、事件（随机效果/多选项）、营地（恢复） |
| 商店/任务板 | 探索格子中集成的商店和任务板交互（通过事件通知 UI 打开面板） |
| 数据持久化 | 实现探索数据的本地存储与加载（`char_exploration` 表） |
| UI 回调 | 通过 `registerUICallbacks` 注册 UI 回调，替代 EventBus 跨模块数据事件 |
| 事件处理器注册表 | `events.ts` 集中管理效果处理器与格子事件处理器，解耦 store 业务逻辑 |

### 模块边界

**探索模块**与以下模块交互:
- 地图模块: 进入探索区域时通过 `crossModuleQuery.getLocationData` 获取地点数据
- 游戏模块: 全局游戏状态收敛（`useGameStore`，P3-116），`currentCharacterId` 通过只读 computed 代理（P3-153），写入须经 `gameStore.setCurrentCharacterId`
- 角色模块: 角色状态管理（`characterStore.takeDamage/receiveHeal/changeMp/gainGold/gainExp/handleDeath`）
- 战斗模块: 怪物战斗（发射 `EXPLORATION_BATTLE_TRIGGERED` 事件，监听 `COMBAT_END`）
- 商店模块: 通过 `crossModuleQuery.getAllShopConfigs` 随机选取商店，交互经事件通知 UI
- 任务模块: 通过 `crossModuleQuery.getQuestDefinitionsByBoard` 获取任务怪物目标
- 背包模块: 物品获取（`inventoryStore.addItem/getItemInfo`）
- 冒险日志模块: 记录探索事件（`logStore.addLogEntry`）
- 物品模板: 通过 `crossModuleQuery.getAllItemTemplates` 获取物品池

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
| FR-EXP-006 | 商店支持多次交互（通过事件通知 UI 打开） | 商店功能 |
| FR-EXP-007 | 任务看板支持多次交互（通过事件通知 UI 打开） | 任务功能 |
| FR-EXP-008 | 每个格子翻开后触发对应事件（怪物/Boss/宝物/陷阱/事件/营地） | 事件系统 |
| FR-EXP-009 | 怪物/Boss 格子战斗胜利后标记为已完成（褪色），失败可再次挑战 | 格子状态 |
| FR-EXP-010 | 击败 Boss 或探索所有格子后探索完成 | 完成条件 |
| FR-EXP-011 | 数据持久化存储（支持中断恢复） | 存档系统 |
| FR-EXP-012 | 网格生成时优先放置任务所需的普通怪物 | 任务系统 |
| FR-EXP-013 | 随机生成 2~3 个隐藏房间（宝箱格），相邻格被探索后自动揭示 | 隐藏房间 |
| FR-EXP-014 | 随机事件 30% 概率为多选项事件（玩家选择后应用效果） | 多选项事件 |
| FR-EXP-015 | 探索中死亡需手动触发 `characterStore.handleDeath` | 死亡处理 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-EXP-001 | 操作失败时回滚数据 | 高 |
| NFR-EXP-002 | 单次操作响应时间 < 10ms | 高 |

---

## 接口定义

### Store Action 方法（对外接口）

探索模块对外接口由 `useExplorationStore`（Pinia Store）提供，无独立 Service 接口。

| 方法 | 签名 | 说明 |
|------|------|------|
| `init` | `(characterId: string) => Promise<void>` | 初始化探索模块，从数据库恢复状态，设置 `COMBAT_END` 监听（P3-153：不再赋值 `currentCharacterId`，`characterId` 参数仅用于 DB 加载） |
| `enterArea` | `(areaId: string) => Promise<void>` | 进入区域开始探索（加载配置→选商店→生成网格→持久化） |
| `revealGrid` | `(x: number, y: number) => Promise<boolean>` | 揭示指定坐标格子并触发对应事件 |
| `revealAllCells` | `() => Promise<void>` | 揭示所有格子（调试命令专用） |
| `onBattleResult` | `(victory: boolean) => Promise<void>` | 处理战斗结果（供 `COMBAT_END` 监听调用） |
| `triggerBattle` | `(monsterId: string) => void` | 触发战斗事件 |
| `useCamp` | `() => Promise<void>` | 使用营地恢复（通过 `dispatchCellEvent('rest')` 分发） |
| `applyEventChoice` | `(choice: { label; icon?; effect: { type; amount } }) => Promise<void>` | 应用多选项事件中玩家选择的选项效果 |
| `reset` | `() => void` | 重置探索内存状态 |
| `exitExploration` | `() => void` | 退出探索（`reset` 别名） |
| `dispose` | `() => void` | 清理 EventBus 监听器与 UI 回调，重置挂起状态 |
| `registerUICallbacks` | `(callbacks: ExplorationUICallbacks) => void` | 注册 UI 回调 |
| `unregisterUICallbacks` | `() => void` | 取消注册 UI 回调 |
| `getGridCell` | `(x: number, y: number) => ExplorationCell \| null` | 获取指定坐标格子数据 |

### Store 状态属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `currentAreaId` | `Ref<string \| null>` | 当前探索区域ID |
| `currentCharacterId` | `Computed<string \| null>` | 当前角色 ID（只读 computed，代理 `gameStore.currentCharacterId`，P3-153；修改须经 `gameStore.setCurrentCharacterId`，用于持久化与事件载荷） |
| `grid` | `Ref<ExplorationCell[][]>` | 10×10 探索网格 |
| `campUsed` | `Ref<boolean>` | 营地是否已使用 |
| `isExploring` | `Ref<boolean>` | 是否正在探索中 |
| `playerPosition` | `Ref<{ x: number; y: number }>` | 玩家当前位置 |
| `visitedCells` | `Ref<number>` | 已访问格子数 |
| `bossDefeated` | `Ref<boolean>` | Boss 是否被击败 |
| `explorationComplete` | `Ref<boolean>` | 探索是否完成 |
| `state` | `Computed<ExplorationState>` | 探索状态对象（兼容旧 API） |
| `hasStartedExploration` | `Computed<boolean>` | 是否已开始探索 |

### 数据类型定义

```typescript
/** 格子类型联合类型（运行时 Cell 对象使用，10种） */
export type CellType = 'monster' | 'treasure' | 'trap' | 'event' | 'rest' | 'shop' | 'board' | 'boss' | 'start' | 'empty';

/** 网格事件类型枚举（概率计算和事件判定阶段使用，9种） */
export type GridEventType = 'monster' | 'item' | 'trap' | 'event' | 'empty' | 'camp' | 'shop' | 'board' | 'boss';

/** 随机事件效果类型（6种） */
export type RandomEventEffectType = 'heal' | 'mana' | 'exp' | 'damage' | 'mpLoss' | 'gold';

/** 探索单元格 */
export interface ExplorationCell {
  x: number;
  y: number;
  type: CellType;
  explored: boolean;
  accessible: boolean;
  visited: boolean;
  completed?: boolean;
  monsterId?: string;
  /** 是否为隐藏房间（相邻格被探索后自动揭示，含更丰厚奖励） */
  hidden?: boolean;
}

/** 探索状态（Store 核心运行时状态对象） */
export interface ExplorationState {
  currentAreaId: string | null;
  grid: ExplorationCell[][];
  campUsed: boolean;
  playerPosition: { x: number; y: number };
  visitedCells: number;
  bossDefeated: boolean;
  explorationComplete: boolean;
}

/** 网格事件概率（五项之和恒为 100） */
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

/** 随机事件结果 */
export interface RandomEventResult {
  message: string;
  icon: string;
  effect: { type: RandomEventEffectType; amount: number };
}

/** 事件选项（多选项事件中的单个选项） */
export interface EventChoice {
  label: string;
  icon?: string;
  effect: { type: RandomEventEffectType; amount: number };
}

/** 多选项事件结果 */
export interface MultiOptionEventResult {
  message: string;
  icon: string;
  choices: EventChoice[];
}

/** 探索 UI 回调接口 */
export interface ExplorationUICallbacks {
  onCellExplored?: (data: { cellType?: string; interactionId?: string }) => void;
  onBattleTriggered?: (data: { eventData: { monsterId: string; areaLevel: number } }) => void;
  onItemFound?: (data: { itemId: string; count: number; itemName: string }) => void;
  onTrapTriggered?: (data: { damage: number; trapType: string }) => void;
  onRandomEvent?: (data: { message: string; icon: string }) => void;
  onMultiOptionEvent?: (data: MultiOptionEventResult) => void;
}

/** 探索进度存储（IndexedDB 持久化格式） */
export interface ExplorationStorage {
  characterId: string;
  currentAreaId: string | null;
  assignedShopId?: string;
  currentShopId?: string;
  grid: ExplorationCell[][];
  playerPosition: { x: number; y: number };
  visitedCells: number;
  bossDefeated: boolean;
  explorationComplete: boolean;
  campUsed: boolean;
  updatedAt?: number;
}
```

### 事件处理器注册表接口（events.ts）

```typescript
/** 事件处理器共享上下文 */
export interface ExplorationContext {
  characterStore: ReturnType<typeof useCharacterStore>;
  inventoryStore: ReturnType<typeof useInventoryStore>;
  areaConfig: AreaConfig;
  uiCallbacks: ExplorationUICallbacks | null;
  characterId: string | null;
  /** 可选的随机数生成器（用于确定性回放与测试注入，未提供时使用 defaultRng） */
  rng?: Rng;
}

/** 格子事件处理器扩展上下文 */
export interface CellEventContext extends ExplorationContext {
  cell: ExplorationCell;
  campUsed?: boolean;
}

/** 格子事件处理结果 */
export interface CellEventResult {
  completed: boolean;
  campUsed?: boolean;
  shouldHandleDeath?: boolean;
}

/** 效果处理器类型 */
export type EffectHandler = (ctx: ExplorationContext, amount: number) => Promise<boolean>;

/** 格子事件处理器类型 */
export type CellEventHandler = (ctx: CellEventContext) => Promise<CellEventResult>;

/** 效果处理器注册表（RandomEventEffectType → 处理函数） */
export const effectHandlers: Record<RandomEventEffectType, EffectHandler>;

/** 格子事件处理器注册表（CellType → 处理函数，仅注册 treasure/trap/event/rest） */
export const cellEventHandlers: Partial<Record<CellType, CellEventHandler>>;

/** 通过注册表分发应用事件效果 */
export function applyEventEffect(effectType: RandomEventEffectType, ctx: ExplorationContext, amount: number): Promise<boolean>;

/** 通过注册表分发格子事件 */
export function dispatchCellEvent(cellType: CellType, ctx: CellEventContext): Promise<CellEventResult>;
```

### 格子类型与处理方式

| 格子类型 | 处理路径 | 事件处理 | 完成后行为 |
|----------|----------|----------|------------|
| `start` | - | 起点（初始已探索） | - |
| `shop` | revealGrid 路径2 | 发射 `EXPLORATION_CELL_EXPLORED`，通知 UI 回调 | 可多次交互 |
| `board` | revealGrid 路径2 | 发射 `EXPLORATION_CELL_EXPLORED`，通知 UI 回调 | 可多次交互 |
| `rest` | dispatchCellEvent | 营地休息（恢复全部 HP/MP） | 标记 campUsed=true |
| `boss` | revealGrid 路径1 | 触发 Boss 战斗 | 胜利后 bossDefeated=true |
| `monster` | revealGrid 路径1 | 触发普通怪物战斗 | 胜利后 completed=true |
| `treasure` | dispatchCellEvent | 发放物品奖励（背包满/模板缺失走兜底） | completed=true |
| `trap` | dispatchCellEvent | 造成伤害 | completed=true |
| `event` | dispatchCellEvent | 随机事件/多选项事件效果 | completed=true |
| `empty` | - | 无事件 | completed=true |

---

## 业务逻辑流程

### 初始化流程

1. 调用 `explorationStore.init(characterId)`
2. `currentCharacterId` 由 GameStore 统一管理（P3-153）：store 内为只读 computed（`computed(() => gameStore.currentCharacterId)`），调用方（GameBootstrap/ExplorationView）在调用 init 前已通过 character 模块设置好 `gameStore.currentCharacterId`；init 不再对该值赋值（只读 computed 不可赋值），保留 `characterId` 参数仅用于从 DB 加载该角色探索数据
3. 从 `char_exploration` 表加载角色探索数据
4. 如果存在有效探索数据（含 `currentAreaId` 且 `grid` 非空），恢复全部状态（`currentAreaId`、`grid`、`campUsed`、`playerPosition`、`visitedCells`、`bossDefeated`、`explorationComplete`、`assignedShopId`），设置 `isExploring=true`，并调用 `loadAreaConfig` 恢复区域配置（网格经 `migrateExplorationGrid` 迁移旧怪物 ID）
5. 如果不存在，重置为空状态（`visitedCells=1`）
6. 调用 `setupCombatListener()` 设置 `COMBAT_END` 事件监听器（先 `clearGroup('exploration')` 清理旧监听，再 `onGroup` 订阅）

### 进入区域流程

1. 调用 `explorationStore.enterArea(areaId)`
2. 设置 `currentAreaId`，调用 `loadAreaConfig(areaId)` 加载区域配置（含怪物池、Boss池、物品池）
3. 调用 `pickRandomShop()` 从所有商店配置中随机选取一个商店ID
4. 调用 `getQuestRequiredMonsters(areaId)` 获取任务所需的怪物列表，过滤掉 Boss 池中的怪物
5. 调用纯函数 `generateGrid()` 生成网格：
   - 初始化 10×10 空网格
   - 放置固定事件：起点（边缘）、商店（角落）、任务板（角落）、营地（非相邻）、Boss（中心）
   - 优先放置任务所需怪物
   - 剩余格按概率分配：怪物(monster)、宝物(treasure)、陷阱(trap)、事件(event)、空地(empty)
   - 调用 `markHiddenRooms()` 随机标记 2~3 个宝箱格为隐藏房间
6. 调用 `findStartPosition()` 设置起点位置，初始化状态（`visitedCells=3`, `campUsed=false`, `bossDefeated=false`, `explorationComplete=false`, `isExploring=true`）
7. 调用 `updateAccessibleCells()` 更新可访问格子
8. 调用 `persistState()` 持久化
9. 发射 `EXPLORATION_START` 事件；获取地点数据后发射 `ZONE_ENTERED` 事件
10. 记录冒险日志

### 揭示格子流程

1. 调用 `explorationStore.revealGrid(x, y)`
2. 检查格子是否存在且（`accessible` 或 `explored`）且未 `completed`，否则返回 false
3. 根据格子类型走三条路径：

| 路径 | 类型 | 处理逻辑 |
|------|------|----------|
| 路径1 | `monster` / `boss` | 调用 `triggerBattle(monsterId)`（monsterId 缺失时优先取区域怪物池/Boss 池首个 ID，再兜底 boss 用 `'boss_dragon_whelp'`、monster 用 `'mob_gnoll'`），记录 `pendingBattleCell`，返回 true 等待 `COMBAT_END` |
| 路径2 | `shop` / `board` | 标记 explored/visited，更新可访问格子，发射 `EXPLORATION_CELL_EXPLORED`（含 `interactionId`：shop 为 `assignedShopId`、board 为 `'board_main'`），通知 UI 回调 `onCellExplored` |
| 路径3 | `treasure` / `trap` / `event` / `rest` | 标记 explored/visited，通过 `dispatchCellEvent` 分发到 `cellEventHandlers` 处理，根据返回结果设置 `completed`/`campUsed`/`shouldHandleDeath` |

4. 路径3中若 `shouldHandleDeath` 为 true，先更新网格与持久化，再调用 `characterStore.handleDeath()` 后返回
5. 否则更新可访问格子、发射 `EXPLORATION_CELL_EXPLORED`、通知 UI 回调、检查完成条件、持久化

### 营地恢复

营地格子通过 `dispatchCellEvent('rest', ctx)` 分发到 `cellEventHandlers.rest`：
- 检查 `ctx.campUsed`，已使用则仅返回 `{ completed: true }`
- 调用 `generateCampHeal(areaLevel)` 返回 `{ hp: Number.MAX_SAFE_INTEGER, mana: Number.MAX_SAFE_INTEGER }`（P3-132：完全恢复标记，由角色模块按上限裁剪）
- 调用 `characterStore.receiveHeal` 和 `characterStore.changeMp`（完全恢复量由角色模块根据上限裁剪）
- 发射 `EXPLORATION_CAMP_USED` 事件，记录日志
- 返回 `{ completed: true, campUsed: true }`，由 store 设置 `campUsed=true`
- `useCamp()` Action 复用同一注册表处理器

### 多选项事件处理

随机事件触发时（`cellEventHandlers.event`）：
- 30% 概率（`MULTI_OPTION_EVENT_PROBABILITY`）生成多选项事件：调用 `generateMultiOptionEvent(areaLevel)`，通知 UI 回调 `onMultiOptionEvent`，记录日志，标记 completed
- 70% 概率生成普通随机事件：调用 `generateRandomEvent(areaLevel)`，通过 `applyEventEffect` 分发到 `effectHandlers` 应用效果

玩家在多选项事件弹窗中选择后，UI 调用 `applyEventChoice(choice)`：
- 通过 `applyEventEffect` 分发到 `effectHandlers` 应用效果
- 若返回 `shouldHandleDeath` 则调用 `characterStore.handleDeath()`
- 记录选择日志

### 战斗结果处理

1. 监听 `COMBAT_END` 事件（分组 `'exploration'`），调用 `onBattleResult(victory)`（`data.result === 'victory'` 判定胜利）
2. **胜利**: 标记格子 `completed=true`、`accessible=false`，Boss 类型额外设置 `bossDefeated=true`，更新可访问格子、检查完成条件、持久化
3. **失败/逃跑**: 仅标记已探索，保留 `monsterId` 允许再次挑战，更新可访问格子、持久化
4. 清空 `pendingBattleCell`

### 探索完成条件

`checkCompletion()` 判定：满足以下任一条件即设置 `explorationComplete=true`：
- 击败 Boss（`bossDefeated === true`）
- 探索所有格子（`visitedCells >= GRID_SIZE * GRID_SIZE`，即 100）

---

## 网格生成算法

### 算法步骤

1. **初始化**: 创建 10×10 全空网格（所有格子 type='empty'，explored/accessbile/visited/completed 均为 false）
2. **放置固定事件**（`placeFixedEvents`）:
   - **起点**: 随机边缘位置（`getEdgePositions`），explored=true、accessible=true、visited=true
   - **商店**: 随机角落（与起点不同角落），explored=true、accessible=true、visited=true
   - **任务板**: 另一随机角落，explored=true、accessible=true、visited=true
   - **营地(rest)**: 通过 `findNonAdjacentPosition` 查找与所有已占用位置非相邻的位置
   - **Boss**: 通过 `findBossPosition` 在中心区域（1/4 到 3/4）查找与其他占用位置保持 ≥2 格切比雪夫距离的位置，从 bossPool 随机选 monsterId
3. **收集空格子**: 除去固定事件外的所有空格子
4. **Fisher-Yates 洗牌**: 打乱空格子顺序
5. **优先放置任务怪物**: 将任务需要的怪物按顺序放入前 N 个空格子（type='monster'，含 monsterId）
6. **概率分配**: 对剩余格子调用 `determineCellEvent()` 按加权随机分配 GridEventType，经 `EVENT_TO_CELL_TYPE` 映射为 CellType；monster 类型从 monsterPool 随机选 monsterId
7. **标记隐藏房间**（`markHiddenRooms`）: 收集所有 treasure 格，Fisher-Yates 洗牌后随机标记 2~3 个（`HIDDEN_ROOM_MIN_COUNT`~`HIDDEN_ROOM_MAX_COUNT`）为 hidden，设置 explored=false、accessible=false

### 事件概率计算

调用 `computeEventProbability(avgLevel)` 根据区域等级动态计算（原始值经归一化确保总和为 100）：

| 事件类型 | 计算公式（原始值） |
|----------|-------------------|
| monster | `min(30, 20 + 1 × avgLevel)` |
| item | `max(15, 25 - 1 × avgLevel)` |
| trap | `min(22, 12 + 1 × avgLevel)` |
| event | `15`（固定） |
| empty | `max(15, 28 - 1 × avgLevel)`（P3-133：基础值 28，五项基础值之和恰为归一化基数 100） |

归一化：各项 `round(原始值 / total × 100)`，最后一项 empty 用减法消除舍入误差。

### 纯函数列表 (service.ts)

| 函数 | 签名 | 说明 |
|------|------|------|
| `computeEventProbability` | `(avgLevel: number) => GridEventProbability` | 根据等级动态计算事件概率分布 |
| `buildItemPool` | `(allItems, minLevel, maxLevel, maxPoolSize?) => string[]` | 筛选等级匹配的物品池（Fisher-Yates 洗牌，空池兜底 `small_health_potion`） |
| `determineCellEvent` | `(probability: GridEventProbability) => GridEventType` | 累积概率区间法选择事件类型 |
| `generateTrapDamage` | `(areaLevel: number) => number` | 计算陷阱伤害（`areaLevel × 5 ± 5`，最小 1） |
| `generateCampHeal` | `(_areaLevel: number) => { hp: Number.MAX_SAFE_INTEGER; mana: Number.MAX_SAFE_INTEGER }` | 返回营地恢复量（完全恢复标记，由角色上限裁剪，P3-132） |
| `generateItemForCell` | `(itemPool: string[]) => string` | 从物品池随机选物品（空池返回空字符串） |
| `generateEnemyForCell` | `(monsterPool: string[]) => string` | 从怪物池随机选怪物（空池返回空字符串） |
| `generateRandomEvent` | `(areaLevel: number) => RandomEventResult` | 生成随机事件（累进概率区间） |
| `generateMultiOptionEvent` | `(areaLevel: number) => MultiOptionEventResult` | 从模板池随机选取并生成多选项事件 |
| `generateGrid` | `(config: GridGenerationConfig) => ExplorationCell[][]` | 生成完整的 10×10 探索网格 |
| `findStartPosition` | `(grid: ExplorationCell[][]) => { x: number; y: number }` | 从网格中找到起点位置（未找到返回 {0,0}） |
| `updateAccessibleCells` | `(grid: ExplorationCell[][]) => ExplorationCell[][]` | 更新格子可访问状态（返回新数组，含隐藏房间揭示逻辑） |
| `pickRandomFromArray` | `<T>(arr: T[]) => T \| undefined` | 从数组随机选取一个元素 |

### 网格类型映射

`EVENT_TO_CELL_TYPE` 常量：GridEventType → CellType 映射表

| GridEventType | CellType | 说明 |
|----------|----------|------|
| `monster` | `monster` | 普通怪物战 |
| `item` | `treasure` | 宝箱/物品 |
| `trap` | `trap` | 陷阱 |
| `event` | `event` | 随机事件 |
| `empty` | `empty` | 空地 |
| `camp` | `rest` | 营地 |
| `shop` | `shop` | 商店 |
| `board` | `board` | 任务板 |
| `boss` | `boss` | Boss |

### 随机事件概率分布

`generateRandomEvent` 采用累进概率区间：

| 区间 | 效果类型 | 概率 | 数值公式 |
|------|----------|------|----------|
| [0, 0.3) | heal | 30% | `areaLevel × 3 + random(0,10)` |
| [0.3, 0.5) | mana | 20% | `areaLevel × 2 + random(0,8)` |
| [0.5, 0.65) | exp | 15% | `areaLevel × 10 + random(0,20)` |
| [0.65, 0.8) | damage | 15% | `areaLevel × 2 + random(0,5)` |
| [0.8, 0.9) | mpLoss | 10% | `areaLevel × 1.5 + random(0,5)` |
| [0.9, 1.0) | gold | 10% | `areaLevel × 5 + random(0,15)` |

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| `char_exploration` | `characterId` | ExplorationStorage | 探索完整数据（按角色隔离） |

### ExplorationStorage 存储内容

| 字段 | 类型 | 说明 |
|------|------|------|
| `characterId` | string | 角色唯一标识（主键） |
| `currentAreaId` | string \| null | 当前探索区域ID |
| `assignedShopId` | string? | 本次探索分配的商店ID（新字段，可选） |
| `currentShopId` | string? | 旧版本兼容字段（读取时自动迁移到 assignedShopId） |
| `grid` | ExplorationCell[][] | 10×10 探索网格 |
| `playerPosition` | { x, y } | 玩家位置 |
| `visitedCells` | number | 已访问格子数 |
| `bossDefeated` | boolean | Boss 是否被击败 |
| `explorationComplete` | boolean | 探索是否完成 |
| `campUsed` | boolean | 营地是否已使用 |
| `updatedAt` | number? | 最后更新时间戳（毫秒，可选） |

### ExplorationDbService 方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `saveExplorationData` | `(characterId, state, assignedShopId?) => Promise<void>` | 保存探索数据（`toRawData` 剥离 Proxy） |
| `getExplorationData` | `(characterId) => Promise<ExplorationStorage \| null>` | 读取探索数据（兼容旧字段迁移） |
| `deleteExplorationData` | `(characterId) => Promise<void>` | 删除指定角色探索数据 |
| `clearAllExplorationData` | `() => Promise<void>` | 清除所有角色探索数据 |
| `getAllExplorationData` | `() => Promise<ExplorationStorage[]>` | 获取所有角色探索数据 |

### 多角色支持说明

探索数据通过 `characterId` 实现角色隔离，每个角色拥有独立的探索进度。兼容旧版本数据，缺失字段使用默认值，旧版 `currentShopId` 自动迁移到 `assignedShopId`。

---

## 与其他模块的交互关系

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 地图模块 | crossModuleQuery | `getLocationData(areaId)` 获取地点数据（含 enemies/bosses/levelRange） |
| 游戏模块 | 直接调用 | `useGameStore` 只读代理 `currentCharacterId`（P3-116/P3-153），写入须经 `gameStore.setCurrentCharacterId` |
| 角色模块 | 直接调用 | `takeDamage/receiveHeal/changeMp/gainGold/gainExp/handleDeath`（经 events.ts effectHandlers 与 store） |
| 战斗模块 | 事件 | 发射 `EXPLORATION_BATTLE_TRIGGERED`，监听 `COMBAT_END`（分组 `'exploration'`） |
| 商店模块 | crossModuleQuery + 事件 | `getAllShopConfigs()` 随机选商店，交互经 `EXPLORATION_CELL_EXPLORED` 事件通知 UI |
| 任务模块 | crossModuleQuery | `getQuestDefinitionsByBoard(areaId)` 获取任务怪物目标 |
| 背包模块 | 直接调用 | `addItem/getItemInfo`（经 events.ts treasure 处理器） |
| 冒险日志模块 | 直接调用 | `addLogEntry` 记录探索事件 |
| 物品模板 | crossModuleQuery | `getAllItemTemplates()` 获取物品池 |

### 事件发布清单

| 事件 | 发射位置 | 载荷 |
|------|----------|------|
| `EXPLORATION_START` | `enterArea` | `{ characterId, areaId }` |
| `ZONE_ENTERED` | `enterArea` | `{ locationId, location }` |
| `EXPLORATION_CELL_EXPLORED` | `revealGrid` 路径2/路径3 | `{ characterId, x, y, cellType?, interactionId? }` |
| `EXPLORATION_BATTLE_TRIGGERED` | `triggerBattle` | `{ characterId, eventData: { monsterId, areaLevel } }` |
| `EXPLORATION_ITEM_FOUND` | events.ts treasure 处理器 | `{ characterId, itemId, count, itemName }` |
| `EXPLORATION_TRAP_TRIGGERED` | events.ts trap 处理器 | `{ characterId, damage, trapType }` |
| `EXPLORATION_RANDOM_EVENT` | events.ts event 处理器 | `{ characterId, message, icon }` |
| `EXPLORATION_CAMP_USED` | events.ts rest 处理器 | `{ characterId }` |
| `EXPLORATION_END` | `reset` | `{ characterId }` |

### 事件订阅清单

| 事件 | 订阅位置 | 处理 |
|------|----------|------|
| `COMBAT_END` | `setupCombatListener`（分组 `'exploration'`） | `data.result === 'victory'` → `onBattleResult(isVictory)` |

### UI 回调机制

通过 `registerUICallbacks(callbacks)` 注册的 UI 回调（`shallowRef` 存储）替代跨模块 EventBus 数据事件：

| 回调 | 触发时机 |
|------|----------|
| `onCellExplored` | 格子被探索（商店/任务板/普通格子） |
| `onBattleTriggered` | 战斗被触发 |
| `onItemFound` | 物品被发现（含兜底转换） |
| `onTrapTriggered` | 陷阱被触发 |
| `onRandomEvent` | 随机事件触发 |
| `onMultiOptionEvent` | 多选项事件触发 |

---

## 异常处理机制

### 异常类型与处理策略

| 异常类型 | 触发条件 | 处理策略 |
|----------|----------|----------|
| 格子不存在/不可访问 | 访问越界或不可访问且未探索的格子 | 返回 false |
| 格子已完成 | 翻开已 completed 的格子 | 返回 false |
| 营地已使用 | 重复使用营地 | 直接返回（rest 处理器仅返回 completed） |
| 物品模板不存在 | 宝箱物品无对应模板 | 调用 `grantFallbackReward` 发放金币+经验兜底 |
| 背包已满 | `addItem` 返回 0 | 调用 `grantFallbackReward` 转换为金币+经验（BIZ-10） |
| 探索中死亡 | 陷阱/随机事件导致 HP 归零 | 返回 `shouldHandleDeath`，由 store 调用 `handleDeath`（BIZ-9） |
| 未注册的效果类型 | `applyEventEffect` 找不到 handler | `console.warn` 并返回 false |
| 未注册的格子类型 | `dispatchCellEvent` 找不到 handler | 返回空结果 `{ completed: false }` |
| 存储读取失败 | IndexedDB 解析错误 | 使用空状态初始化 |
| 存储写入失败 | IndexedDB 写入异常 | `dbService.withRetry` 指数退避重试 |
| 持久化失败 | IndexedDB 写入异常/序列化错误 | `persistState` try-catch 捕获并经 `errorReporter.report` 上报（P3-151，UI 与 DB 状态可能不一致） |

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 二维数组 | 使用二维数组存储格子 | O(1) 坐标访问 |
| 纯函数层 | 网格生成/概率计算均为纯函数 | 可测试、可复用 |
| 异步加载 | Store 初始化时异步从 IndexedDB 读取 | 不阻塞主线程 |
| 数据序列化 | `toRawData()` 去除 Vue/Proxy 包装 | 避免 DataCloneError |
| shallowRef | UI 回调使用 `shallowRef` 存储 | 确保响应式追踪（EXP-3/7） |
| 分组订阅 | EventBus 监听使用 `onGroup('exploration')` | 便于一次性清理，避免监听器累积（EXP-1） |
| 注册表模式 | 事件处理器集中注册 | 新增类型无需修改 store |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 输入验证 | 所有操作进行坐标边界检查 |
| 数据隔离 | 使用 `characterId` 隔离角色数据 |
| 异常捕获 | 防止程序崩溃 |
| 重试机制 | `dbService.withRetry` 失败时自动重试 |
| 资源清理 | `dispose()` 清理监听器与 UI 回调（EXP-2） |
| 死亡处理 | 探索中死亡先更新网格状态再触发 `handleDeath`（BIZ-9） |

---

## 模块文件结构

```
src/modules/exploration/
  - index.ts          # 模块入口，统一导出类型/DbService/纯函数/Store
  - types.ts          # 类型定义（CellType、ExplorationCell、ExplorationState 等）
  - db.ts             # IndexedDB 数据库操作层（char_exploration）
  - service.ts        # 纯函数层（generateGrid、updateAccessibleCells、generateRandomEvent 等）
  - events.ts         # 事件处理器注册表（effectHandlers/cellEventHandlers/dispatchCellEvent）
  - store.ts          # Pinia Store 状态管理（useExplorationStore）
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | 模块入口、统一导出类型（`CellType`、`ExplorationCell`、`ExplorationState`、`AreaConfig`、`GridGenerationConfig`、`ExplorationUICallbacks`、`ExplorationStorage` 等）、`ExplorationDbService`、纯函数（`generateGrid`、`computeEventProbability`、`generateRandomEvent`、`generateMultiOptionEvent`、`updateAccessibleCells`、`EVENT_TO_CELL_TYPE`、`GRID_SIZE` 等）、`useExplorationStore` |
| `types.ts` | TypeScript 类型定义：`CellType`、`GridEventType`、`RandomEventEffectType`、`ExplorationCell`、`ExplorationState`、`GridEventProbability`、`AreaConfig`、`RandomEventResult`、`EventChoice`、`MultiOptionEventResult`、`GridGenerationConfig`、`ExplorationUICallbacks`、`ExplorationStorage` |
| `db.ts` | IndexedDB 数据库操作：`ExplorationDbService` 类（`saveExplorationData`、`getExplorationData`、`deleteExplorationData`、`clearAllExplorationData`、`getAllExplorationData`），`toRawData` 剥离 Proxy，兼容旧数据迁移 |
| `service.ts` | 纯函数层：`EVENT_TO_CELL_TYPE` 映射表、`computeEventProbability`、`buildItemPool`、`determineCellEvent`、`generateTrapDamage`、`generateCampHeal`、`generateItemForCell`、`generateEnemyForCell`、`generateRandomEvent`、`generateMultiOptionEvent`、`generateGrid`、`findStartPosition`、`updateAccessibleCells`、`markHiddenRooms`、`placeFixedEvents` 等 |
| `events.ts` | 事件处理器注册表：`ExplorationContext`、`CellEventContext`、`CellEventResult` 接口；`effectHandlers`（heal/mana/exp/damage/mpLoss/gold 效果处理器）、`cellEventHandlers`（treasure/trap/event/rest 格子处理器）；`applyEventEffect`、`dispatchCellEvent` 分发函数；`grantFallbackReward` 兜底奖励 |
| `store.ts` | Pinia Store 状态管理（`useExplorationStore`），编排业务逻辑：响应式状态、UI 回调注册、计算属性（含 `currentCharacterId` 只读代理 `gameStore`，P3-153）、`init`/`enterArea`/`revealGrid`/`onBattleResult`/`triggerBattle`/`useCamp`/`applyEventChoice`/`reset`/`dispose` 等 Action，`buildAreaConfig`/`loadAreaConfig`/`pickRandomShop`/`getQuestRequiredMonsters` 等内部方法 |

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
| v4.0 | 2026-06-17 | 补充 ExplorationEventChoice/ExplorationEvent/MoveResult/EventChoiceResult/RandomEventResult/ExplorationUICallbacks 类型定义，修正 ExplorationStorage 字段可选性（assignedShopId/updatedAt 标记为可选）、添加 currentShopId 旧版本兼容字段 | System |
| v5.0 | 2026-07-10 | 严格对齐源码重写：移除不存在的 remainingMoves 移动步数系统与 IExplorationService/movePlayer/canMove/handleEventChoice 等旧接口；新增 events.ts 事件处理器注册表（effectHandlers/cellEventHandlers/dispatchCellEvent/applyEventEffect）；补充隐藏房间机制、多选项事件、dispose/applyEventChoice Action；修正类型为 CellType/EventChoice/MultiOptionEventResult；修正商店交互为事件通知；补充完整事件发布与订阅清单 | System |
| v6.0 | 2026-08-03 | 对齐 P3-116/P3-153：`currentCharacterId` 由本地 ref 改为只读 computed 代理 `gameStore.currentCharacterId`（引入 `useGameStore`），`init` 移除该值赋值（保留 `characterId` 参数仅用于 DB 加载）；新增 `modules/game` 模块依赖说明；`persistState` 补齐 try-catch + `errorReporter.report`（P3-151）；营地恢复量修正为 `Number.MAX_SAFE_INTEGER`（P3-132）；空事件概率基础值修正为 28（P3-133）；补充 `ExplorationContext.rng` 可选字段 | System |

---

**文档结束**
