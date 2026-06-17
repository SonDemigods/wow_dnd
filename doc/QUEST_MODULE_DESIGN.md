# 任务模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 任务模块设计文档 |
| 版本 | v4.0 |
| 生成日期 | 2026年6月17日 |
| 所属模块 | `modules/quest` |

---

## 模块概述与定位

### 模块定位

任务模块是游戏核心玩法的重要组成部分，负责管理任务的发布、接受、进度追踪、完成和奖励发放。探索中的【任务看板】负责交接任务，为玩家提供游戏目标和成长动力。

### 核心职责

| 职责 | 描述 |
|------|------|
| 任务定义管理 | 从 `config_quests` 表加载和维护全局任务定义（所有角色共享） |
| 任务实例管理 | 从 `char_quests` 表加载每个角色的任务实例（按角色隔离） |
| 任务进度追踪 | 追踪任务目标的完成进度，支持击杀和收集两种类型 |
| 任务奖励发放 | 任务完成时自动发放经验、金币和物品奖励 |
| 任务看板交互 | 支持从任务看板接受任务、提交任务（领取奖励） |
| 数据持久化 | 实现任务数据的本地存储与加载 |

### 模块边界

**任务模块**与以下模块直接交互（全部通过 Store Action 调用）:
- 战斗模块: 战斗结束时调用 `questStore.onEnemyKilled(enemyId)` 更新击杀进度
- 背包模块: 物品收集时调用 `questStore.onItemCollected(itemId, amount)` 更新收集进度
- 角色模块: 发放奖励时调用 `characterStore.gainExp/gainGold`
- 探索模块: 探索中的【任务看板】负责交接任务
- 冒险日志模块: 记录任务相关事件日志

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-QUEST-001 | 支持任务接受 | 任务系统核心 |
| FR-QUEST-002 | 支持任务进度追踪（击杀型和收集型） | 任务系统核心 |
| FR-QUEST-003 | 支持任务完成时自动发放奖励 | 任务系统核心 |
| FR-QUEST-004 | 支持任务提交（领取奖励，标记为 turned_in） | 任务系统核心 |
| FR-QUEST-005 | 支持任务奖励发放(经验、金币、物品) | 成长系统 |
| FR-QUEST-006 | 支持击杀型任务目标（enemyId 匹配） | 战斗系统 |
| FR-QUEST-007 | 支持收集型任务目标（itemId 匹配） | 任务系统 |
| FR-QUEST-008 | 支持任务放弃功能 | 任务系统 |
| FR-QUEST-009 | 支持任务看板发布和提交任务 | 任务看板 |
| FR-QUEST-010 | 数据持久化存储 | 存档系统 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-QUEST-001 | 操作失败时回滚数据 | 高 |
| NFR-QUEST-002 | 单次操作响应时间 < 10ms | 高 |

---

## 接口定义

### 服务接口 IQuestService

```typescript
export interface IQuestService {
  acceptQuest(questId: string): boolean;
  updateQuestProgress(questId: string, objectiveKey: string, amount?: number): void;
  turnInQuest(questId: string): boolean;
  abandonQuest(questId: string): boolean;
  isQuestAvailable(questId: string): boolean;
  isQuestInProgress(questId: string): boolean;
  isQuestCompleted(questId: string): boolean;
  getQuestInstance(questId: string): QuestInstance | null;
  getQuestDefinition(questId: string): QuestDefinition | null;
  getAvailableQuests(): string[];
  getInProgressQuests(): string[];
  getCompletedQuests(): string[];

  // 任务看板相关方法
  getQuestsFromBoard(boardId: string): QuestDefinition[];
  getQuestsToTurnIn(boardId: string): QuestDefinition[];
  acceptQuestFromBoard(boardId: string, questId: string): boolean;
  turnInQuestToBoard(boardId: string, questId: string): boolean;

  reset(): void;
}
```

### 数据类型定义

```typescript
/** 任务状态枚举（6种） */
export type QuestStatus =
  | 'not_available'
  | 'available'
  | 'in_progress'
  | 'completed'
  | 'turned_in'
  | 'abandoned';

/** 任务类型枚举（2种） */
export type QuestType = 'kill' | 'collect';

/** 任务目标定义（无 description 字段，UI 层通过 enemyId/itemId 自动生成描述文本） */
export interface QuestObjective {
  key: string;
  type: QuestType;
  target: number;
  itemId?: string;
  enemyId?: string;
  locationId?: string;
}

/** 任务目标进度 */
export interface QuestObjectiveProgress {
  objectiveKey: string;
  current: number;
  target: number;
}

/** 任务定义（静态配置，所有角色共享） */
export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  objectives: QuestObjective[];
  levelRequirement: number;
  xpReward: number;
  goldReward: number;
  itemRewards?: InventoryItem[];
  boardId: string;
}

/** 任务实例（每个角色独立） */
export interface QuestInstance {
  questId: string;
  status: QuestStatus;
  progress: QuestObjectiveProgress[];
  acceptedAt: number;
  completedAt?: number;
}
```

### Store 计算属性

| 计算属性 | 类型 | 说明 |
|----------|------|------|
| `definitionList` | `QuestDefinition[]` | 所有任务定义列表 |
| `instanceList` | `QuestInstance[]` | 所有任务实例列表 |
| `activeQuests` | `QuestInstance[]` | 进行中的任务（status = 'in_progress'） |
| `completedQuests` | `QuestInstance[]` | 已完成待提交的任务（status = 'completed'） |
| `turnedInQuests` | `QuestInstance[]` | 已提交的任务（status = 'turned_in'） |
| `availableQuests` | `QuestDefinition[]` | 可用任务定义（符合等级要求且未被接取） |
| `inProgressQuests` | 组合视图 | 进行中的任务（定义 + 进度） |

---

## 业务逻辑流程

### 初始化流程

1. 调用 `questStore.initialize(characterId)` 或 `questStore.init()`
2. 从 `config_quests` 表加载所有任务定义 → 写入 `questDefinitions` Map
3. 如果数据库为空，回退写入 `getDefaultQuests()` 默认任务模板
4. 从 `char_quests` 表加载当前角色的任务实例 → 写入 `questInstances` Map

### 任务接受流程

1. 调用 `questStore.acceptQuest(questId)`
2. 检查任务定义是否存在，角色ID是否有效
3. 调用纯函数 `canAcceptQuest()` 检查等级要求和是否有活跃实例
4. 调用纯函数 `generateQuestInstance()` 生成新的任务实例（status = 'in_progress'）
5. 写入 `questInstances` Map → 持久化到 `char_quests` 表
6. 发射 `QUEST_ACCEPTED` 事件 → 记录冒险日志

### 敌人击杀进度更新流程

1. 战斗模块调用 `questStore.onEnemyKilled(enemyId)`
2. 遍历所有进行中的任务实例（status = 'in_progress'）
3. 对每个任务，调用纯函数 `checkQuestProgress()` 检查是否有匹配的击杀目标
4. 如果匹配，更新进度（Math.min 防止超过 target）
5. 如果所有目标完成：
   - 状态改为 'completed'，记录 completedAt
   - 自动调用 `_grantQuestRewards()` 发放经验、金币、物品奖励
   - 发射 `QUEST_COMPLETED` 事件 → 记录冒险日志
6. 持久化到 `char_quests` 表

### 物品收集进度更新流程

1. 背包模块调用 `questStore.onItemCollected(itemId, amount)`
2. 遍历所有进行中的任务实例
3. 对每个任务，调用纯函数 `checkQuestProgress()` 检查是否有匹配的收集目标
4. 后续流程同击杀进度更新

### 任务放弃流程

1. 调用 `questStore.abandonQuest(questId)`
2. 检查任务状态是否为 'in_progress'
3. 如果是，状态改为 'abandoned'
4. 持久化到数据库 → 记录冒险日志

### 提交任务（领取奖励）

1. 调用 `questStore.claimReward(questId)`（也支持 `turnInQuest` 别名）
2. 检查任务状态是否为 'completed'
3. 状态改为 'turned_in' → 持久化
4. 发射 `QUEST_REWARDED` 事件 → 记录冒险日志

### 任务奖励发放

任务完成时自动发放，无需玩家手动操作：

| 奖励类型 | 发放方式 |
|----------|----------|
| 经验值 | `characterStore.gainExp(rewards.exp)` |
| 金币 | `characterStore.gainGold(rewards.gold)` |
| 物品 | `inventoryStore.addItem(item.itemId, item.count)` |

### 任务看板交互

- `getQuestsFromBoard(boardId)`: 返回指定任务板上的任务定义
- `getQuestsToTurnIn(boardId)`: 返回该任务板上已完成待提交的任务
- `acceptQuestFromBoard(boardId, questId)`: 验证任务所属看板后调用 `acceptQuest`
- `turnInQuestToBoard(boardId, questId)`: 验证任务所属看板后调用 `claimReward`

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| `config_quests` | `questId` | 任务定义存储 | 所有任务定义（全局共享） |
| `char_quests` | `[characterId, questId]` | 任务实例存储 | 每个角色的任务实例（按角色隔离） |

### 任务定义存储格式 (config_quests)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 任务唯一标识 |
| `title` | string | 任务标题 |
| `description` | string | 任务描述 |
| `type` | string | 任务类型（kill/collect） |
| `objectives` | object[] | 目标列表（key, type, target, itemId?, enemyId?, locationId?） |
| `levelRequirement` | number | 等级要求 |
| `xpReward` | number | 经验奖励 |
| `goldReward` | number | 金币奖励 |
| `itemRewards?` | {itemId, count}[] | 物品奖励列表 |
| `boardId` | string | 所属任务板ID |

### 任务实例存储格式 (char_quests)

| 字段 | 类型 | 说明 |
|------|------|------|
| `questId` | string | 任务ID |
| `characterId` | string | 角色ID |
| `status` | string | 任务状态 |
| `progress` | {objectiveKey, current, target}[] | 目标进度列表 |
| `acceptedAt` | number | 接受时间戳 |
| `completedAt?` | number | 完成时间戳 |

### 多角色支持说明

任务定义（`config_quests`）为全局共享数据。任务实例（`char_quests`）通过 `characterId` 实现角色隔离。切换角色时，系统自动加载对应角色的任务实例。

### 默认任务模板

当 `config_quests` 表为空时，系统回退使用 `getDefaultQuests()` 提供的4个默认任务：
1. "消灭豺狼人"（击杀型，目标：gnoll × 10，boardId: village）
2. "采集草药"（收集型，目标：item_herb × 15，boardId: village）
3. "狼群威胁"（击杀型，目标：wolf × 5，boardId: village）
4. "兽人首领"（复合击杀型，目标：orc × 3 + ogre × 1，boardId: village）

---

## 目标显示文本工具 (objective_utils.ts)

`objective_utils.ts` 提供自动生成任务目标描述文本的纯函数：

| 函数 | 说明 |
|------|------|
| `getObjectiveText(objective, itemNameProvider?)` | 根据目标类型生成显示文本，如"消灭剧毒蜘蛛"、"收集草药" |
| `getEnemyName(enemyId)` | 根据敌人ID查询名称（从 MOBS 和 BOSSES 配置合并） |

`QuestObjective` 不包含 `description` 字段，UI 层通过调用 `getObjectiveText()` 自动从 `enemyId`/`itemId` 生成目标描述。

---

## 与其他模块的交互关系

### 依赖关系

- **事件总线**: 发布 `QUEST_ACCEPTED`、`QUEST_COMPLETED`、`QUEST_REWARDED` 事件
- **配置数据**: `config_quests`、`config_mobs`、`config_bosses`

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 战斗模块 | 调用 | 战斗结束时调用 `questStore.onEnemyKilled(enemyId)` |
| 背包模块 | 调用 | 物品收集时调用 `questStore.onItemCollected(itemId, amount)` |
| 角色模块 | 调用 | 发放奖励时调用 `characterStore.gainExp/gainGold` |
| 探索模块 | 调用 | 任务看板交互（接受/提交） |
| 冒险日志模块 | 调用 | 记录任务事件日志 |

---

## 异常处理机制

### 异常类型与处理策略

| 异常类型 | 触发条件 | 处理策略 |
|----------|----------|----------|
| 任务不存在 | 操作不存在的任务 | 返回 false / null |
| 任务不可接受 | 等级不足或已有活跃实例 | 返回 false |
| 任务未完成 | 提交状态不是 completed 的任务 | 返回 false |
| 任务无法放弃 | 放弃状态不是 in_progress 的任务 | 返回 false |
| 存储读取失败 | IndexedDB 解析错误 | 使用默认值初始化 |
| 存储写入失败 | IndexedDB 写入异常 | 进入重试队列，指数退避重试 3 次 |

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 内存缓存 | Map 结构缓存定义和实例 | 快速访问 |
| 纯函数层 | service.ts 纯计算不持有状态 | 可测试、可复用 |
| 批处理持久化 | 仅数据变更时保存 | 减少 IO 操作 |
| 异步加载 | Store 初始化时异步从 IndexedDB 读取 | 不阻塞主线程 |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 输入验证 | 所有操作进行状态检查 |
| 数据序列化 | `toRawData()` 去除 Vue/Proxy 包装 |
| 异常捕获 | 所有 IO 操作包裹 try-catch |
| 重试机制 | 失败时自动重试 3 次 |

---

## 模块文件结构

```
src/modules/quest/
  - index.ts          # 模块入口，统一导出
  - types.ts          # 类型定义（QuestStatus、QuestType、QuestObjective 等）
  - db.ts             # IndexedDB 数据库操作层（config_quests、char_quests）
  - store.ts          # Pinia Store 状态管理（useQuestStore）
  - service.ts        # 纯函数层（checkQuestProgress、canAcceptQuest 等）
  - objective_utils.ts # 目标显示文本工具（getObjectiveText、getEnemyName）
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | 模块入口，统一导出公共接口 |
| `types.ts` | TypeScript 类型定义、接口定义 |
| `db.ts` | IndexedDB 数据库操作层，封装 `config_quests` 和 `char_quests` 的读写 |
| `store.ts` | Pinia Store 状态管理，响应式数据维护（useQuestStore） |
| `service.ts` | 纯函数层：`checkQuestProgress`、`calculateQuestRewards`、`canAcceptQuest`、`generateQuestInstance`、`getDefaultQuests` |
| `objective_utils.ts` | 任务目标显示文本工具函数：`getObjectiveText`、`getEnemyName` |

---

## 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-15 | 初始版本,包含基础任务功能 | System |
| v1.1 | 2026-05-15 | 添加任务放弃功能、收集类任务支持、任务标题和详情展示 | System |
| v2.0 | 2026-05-19 | 迁移到 Pinia + IndexedDB 架构，实现自动同步持久化 | System |
| v2.1 | 2026-05-19 | 整合NPC模块任务相关功能：添加任务看板字段、任务看板交互方法、任务看板查询方法 | System |
| v2.2 | 2026-06-16 | 模块路径重命名为 modules/quest，重构文件结构为 index.ts + types.ts + db.ts + store.ts + service.ts + objective_utils.ts | System |
| v3.0 | 2026-06-16 | 第四次全面修订：对齐实际代码，更新 Store 架构（纯函数层分离）、奖励自动发放机制、objective_utils 工具说明、默认任务模板详情 | System |
| v4.0 | 2026-06-17 | 逐文件比对验证：类型定义与代码完全一致 | System |

---

**文档结束**
