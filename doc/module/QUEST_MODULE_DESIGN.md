# 任务模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 任务模块设计文档 |
| 版本 | v5.0 |
| 生成日期 | 2026年7月10日 |
| 所属模块 | `modules/quest` |
| 更新说明 | 严格依据源码重写：补充 `QuestDefinition.prerequisiteQuests` 字段（BIZ-19 前置任务机制）及 `checkPrerequisiteQuests` 纯函数；补充存储类型定义（`QuestInstanceStorage`/`QuestDefinitionStorage`/`CharQuestStorage`）；补充 `completeQuest` 方法（手动完成）；修正提交方法为 `claimReward`（无 `turnInQuest` 别名）；补充 `acceptQuest` 中 P1-1 扫描背包设置 collect 目标初始进度的逻辑；补充 `_grantQuestRewards` 中 `useToast` 背包满提示；修正 `objective_utils` 数据源为 `@/data/config_mobs` 和 `@/data/config_bosses`（非 DB 表）；补全 DB 层方法清单（`deleteQuestInstance`/`deleteCharacterQuests`/`deleteQuestDefinition`/`clearAllQuestDefinitions`/`getQuestDefinitionsByBoard`）；补充默认任务模板的任务 ID |

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
| 前置任务校验 | 支持前置任务完成状态校验（BIZ-19，`prerequisiteQuests`） |
| 任务看板交互 | 支持从任务看板接受任务、提交任务（领取奖励） |
| 数据持久化 | 实现任务数据的本地存储与加载 |

### 模块边界

**任务模块**与以下模块直接交互（全部通过 Store Action 调用）:
- 战斗模块: 战斗结束时调用 `questStore.onEnemyKilled(enemyId)` 更新击杀进度
- 背包模块: 物品收集时调用 `questStore.onItemCollected(itemId, amount)` 更新收集进度；接取 collect 任务时扫描背包设置初始进度
- 角色模块: 发放奖励时调用 `characterStore.gainExp/gainGold`
- 探索模块: 探索中的【任务看板】负责交接任务
- 冒险日志模块: 记录任务相关事件日志
- 事件总线: 发布 `QUEST_ACCEPTED`、`QUEST_COMPLETED`、`QUEST_REWARDED` 事件
- Toast 通知: 奖励物品背包满时通过 `useToast` 提示

### 跨模块通信机制

任务模块采用"直接 Store Action 调用 + EventBus 事件"双模式：

- **其他模块 → 任务模块**：直接调用 `questStore.onEnemyKilled(enemyId)` / `onItemCollected(itemId, amount)`
- **任务模块 → 角色模块**：`_grantQuestRewards` 中调用 `characterStore.gainExp/gainGold`
- **任务模块 → 背包模块**：`_grantQuestRewards` 中调用 `inventoryStore.addItem`；`acceptQuest` 中读取 `inventoryStore.inventory` 设置初始进度
- **任务模块 → 日志模块**：各 Action 中调用 `logStore.addLogEntry()`
- **任务模块 → 事件总线**：`eventBus.emit(GameEvents.QUEST_ACCEPTED/QUEST_COMPLETED/QUEST_REWARDED)`

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-QUEST-001 | 支持任务接受（`acceptQuest`），含 P1-1 扫描背包设置 collect 初始进度 | 任务系统核心 |
| FR-QUEST-002 | 支持任务进度追踪（击杀型和收集型） | 任务系统核心 |
| FR-QUEST-003 | 支持任务完成时自动发放奖励（`_handleQuestCompletion`） | 任务系统核心 |
| FR-QUEST-004 | 支持任务提交（`claimReward`，标记为 turned_in） | 任务系统核心 |
| FR-QUEST-005 | 支持任务奖励发放（经验、金币、物品） | 成长系统 |
| FR-QUEST-006 | 支持击杀型任务目标（enemyId 匹配） | 战斗系统 |
| FR-QUEST-007 | 支持收集型任务目标（itemId 匹配） | 任务系统 |
| FR-QUEST-008 | 支持任务放弃功能（`abandonQuest`） | 任务系统 |
| FR-QUEST-009 | 支持任务看板发布和提交任务 | 任务看板 |
| FR-QUEST-010 | 数据持久化存储 | 存档系统 |
| FR-QUEST-011 | 支持手动完成任务（`completeQuest`，校验所有目标达成） | 任务系统 |
| FR-QUEST-012 | 支持前置任务校验（BIZ-19，`prerequisiteQuests`） | 任务链系统 |
| FR-QUEST-013 | 奖励物品背包满时通过 Toast 提示玩家 | 用户体验 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-QUEST-001 | 操作失败时回滚数据 | 高 |
| NFR-QUEST-002 | 单次操作响应时间 < 10ms | 高 |

---

## 接口定义

### Store Action 方法（对外暴露接口）

| 方法 | 签名 | 说明 |
|------|------|------|
| `initialize` | `(characterId: string) => Promise<void>` | 初始化任务模块（加载定义和实例） |
| `init` | `() => Promise<void>` | 兼容旧接口，自动从 characterStore 获取角色ID |
| `acceptQuest` | `(questId: string) => Promise<boolean>` | 接受任务（含扫描背包初始进度） |
| `onEnemyKilled` | `(enemyId: string) => Promise<void>` | 处理敌人击杀事件 |
| `onItemCollected` | `(itemId: string, amount?: number) => Promise<void>` | 处理物品收集事件（默认 amount=1） |
| `completeQuest` | `(questId: string) => Promise<boolean>` | 手动完成任务（校验所有目标达成） |
| `claimReward` | `(questId: string) => Promise<boolean>` | 领取奖励（completed → turned_in） |
| `abandonQuest` | `(questId: string) => Promise<boolean>` | 放弃任务（in_progress → abandoned） |
| `getQuestDefinition` | `(questId: string) => QuestDefinition \| null` | 获取任务定义（O(1)） |
| `getQuestInstance` | `(questId: string) => QuestInstance \| null` | 获取任务实例（O(1)） |
| `isQuestAvailable` | `(questId: string) => boolean` | 检查任务是否可接取 |
| `getQuestsFromBoard` | `(boardId: string) => QuestDefinition[]` | 获取指定任务板上的任务定义 |
| `getQuestsToTurnIn` | `(boardId: string) => QuestDefinition[]` | 获取指定任务板上可提交的任务 |
| `acceptQuestFromBoard` | `(boardId: string, questId: string) => Promise<boolean>` | 从指定任务板接受任务（带 boardId 校验） |
| `turnInQuestToBoard` | `(boardId: string, questId: string) => Promise<boolean>` | 在指定任务板提交任务 |
| `reset` | `() => Promise<void>` | 重置任务实例数据（不清除定义） |

### Store 响应式状态

| 状态 | 类型 | 说明 |
|------|------|------|
| `questDefinitions` | `Ref<Map<string, QuestDefinition>>` | 任务定义缓存（全局共享） |
| `questInstances` | `Ref<Map<string, QuestInstance>>` | 任务实例缓存（按角色隔离） |
| `currentCharacterId` | `Ref<string \| null>` | 当前角色 ID |

### Store 计算属性

| 计算属性 | 类型 | 说明 |
|----------|------|------|
| `definitionList` | `ComputedRef<QuestDefinition[]>` | 所有任务定义的数组视图 |
| `instanceList` | `ComputedRef<QuestInstance[]>` | 所有任务实例的数组视图 |
| `activeQuests` | `ComputedRef<QuestInstance[]>` | 进行中的任务（status = 'in_progress'） |
| `completedQuests` | `ComputedRef<QuestInstance[]>` | 已完成待提交的任务（status = 'completed'） |
| `turnedInQuests` | `ComputedRef<QuestInstance[]>` | 已提交终态的任务（status = 'turned_in'） |
| `availableQuests` | `ComputedRef<QuestDefinition[]>` | 可接取任务（等级满足 + 无活跃实例 + 前置完成） |
| `inProgressQuests` | `ComputedRef<(QuestDefinition & { progress })[]>` | 进行中任务的组合视图（定义 + 进度） |

### 数据类型定义

```typescript
import type { InventoryItem } from '../inventory/types';

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

/** 任务目标定义（无 description 字段，UI 层通过 getObjectiveText 自动生成） */
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
  /** 前置任务 ID 列表（BIZ-19） */
  prerequisiteQuests?: string[];
}

/** 任务实例（每个角色独立） */
export interface QuestInstance {
  questId: string;
  status: QuestStatus;
  progress: QuestObjectiveProgress[];
  acceptedAt: number;
  completedAt?: number;
}

// ==================== 存储/持久化接口 ====================

/** 任务实例存储格式（char_quests 表行结构，不含 characterId） */
export interface QuestInstanceStorage {
  questId: string;
  status: QuestStatus;
  progress: { objectiveKey: string; current: number; target: number }[];
  acceptedAt: number;
  completedAt?: number;
}

/** 任务定义存储格式（config_quests 表结构） */
export interface QuestDefinitionStorage {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  objectives: {
    key: string;
    type: QuestType;
    target: number;
    itemId?: string;
    enemyId?: string;
    locationId?: string;
  }[];
  levelRequirement: number;
  xpReward: number;
  goldReward: number;
  itemRewards?: { itemId: string; count: number }[];
  boardId: string;
  prerequisiteQuests?: string[];
}

/** 角色任务存储格式（char_quests 表完整行，含 characterId） */
export interface CharQuestStorage {
  characterId: string;
  questId: string;
  status: QuestStatus;
  progress: Array<{ objectiveKey: string; current: number; target: number }>;
  acceptedAt: number;
  completedAt?: number;
}
```

### 事件定义

| 事件名 | 载荷 | 发射时机 |
|--------|------|----------|
| `GameEvents.QUEST_ACCEPTED` | `{ questId, definition }` | `acceptQuest` 成功后 |
| `GameEvents.QUEST_COMPLETED` | `{ questId, definition }` | `_handleQuestCompletion` 完成发奖后 |
| `GameEvents.QUEST_REWARDED` | `{ questId, definition }` | `claimReward` 状态转为 turned_in 后 |

---

## 业务逻辑流程

### 初始化流程

1. 调用 `questStore.initialize(characterId)` 或 `questStore.init()`
2. 设置 `currentCharacterId`
3. 调用 `_initDefaultQuestDefinitions()`：
   - 从 `config_quests` 表加载所有任务定义 → 写入 `questDefinitions` Map
   - 如果数据库为空，回退写入 `getDefaultQuests()` 默认任务模板
4. 从 `char_quests` 表按 `characterId` 加载当前角色的任务实例 → 写入 `questInstances` Map

### 任务接受流程

1. 调用 `questStore.acceptQuest(questId)`
2. 校验任务定义存在、角色 ID 有效
3. 调用纯函数 `canAcceptQuest()` 检查：
   - 等级要求（`characterLevel >= definition.levelRequirement`）
   - 活跃实例检查（已存在非 abandoned 状态的实例则拒绝）
   - 前置任务校验（`checkPrerequisiteQuests`，BIZ-19）
4. 调用纯函数 `generateQuestInstance()` 生成新实例（status = 'in_progress'，所有 progress.current = 0）
5. **P1-1 逻辑**：对 collect 类型目标，扫描 `inventoryStore.inventory` 设置初始进度（`Math.min(owned, target)`）
6. 更新 `questInstances` Map → 持久化到 `char_quests` 表
7. 发射 `QUEST_ACCEPTED` 事件 → 记录冒险日志

### 敌人击杀进度更新流程

1. 战斗模块调用 `questStore.onEnemyKilled(enemyId)`
2. 遍历所有进行中的任务实例（status = 'in_progress'）
3. 对每个任务，调用 `_processQuestProgress` → 纯函数 `checkQuestProgress()` 检查匹配的击杀目标
4. 如果匹配，更新进度（`Math.min(current + amount, target)` 防止超过 target）
5. 如果所有目标完成，调用 `_handleQuestCompletion()`：
   - 状态改为 'completed'，记录 `completedAt`
   - 调用 `_grantQuestRewards()` 发放经验、金币、物品奖励
   - 发射 `QUEST_COMPLETED` 事件 → 记录冒险日志
6. 持久化到 `char_quests` 表

### 物品收集进度更新流程

1. 背包模块调用 `questStore.onItemCollected(itemId, amount)`（默认 amount=1）
2. 遍历所有进行中的任务实例
3. 对每个任务，调用 `_processQuestProgress` → 纯函数 `checkQuestProgress()` 检查匹配的收集目标
4. 后续流程同击杀进度更新

### 手动完成任务流程

1. 调用 `questStore.completeQuest(questId)`
2. 检查实例存在且状态为 'in_progress'
3. 校验所有 `progress.current >= target`
4. 调用 `_handleQuestCompletion()` 完成任务（发奖 + 事件 + 日志）

### 任务放弃流程

1. 调用 `questStore.abandonQuest(questId)`
2. 检查任务状态是否为 'in_progress'
3. 状态改为 'abandoned' → 持久化 → 记录冒险日志
4. 已放弃的任务可通过 `acceptQuest` 重新接取（仍需满足前置任务）

### 提交任务（领取奖励）

1. 调用 `questStore.claimReward(questId)`
2. 检查任务状态是否为 'completed'
3. 状态改为 'turned_in' → 持久化
4. 发射 `QUEST_REWARDED` 事件 → 记录冒险日志（含奖励详情）

### 任务奖励发放

任务完成时通过 `_grantQuestRewards()` 自动发放，无需玩家手动操作：

| 奖励类型 | 发放方式 |
|----------|----------|
| 经验值 | `await characterStore.gainExp(rewards.exp)` |
| 金币 | `await characterStore.gainGold(rewards.gold)` |
| 物品 | `inventoryStore.addItem(item.itemId, item.count)`（同步调用） |

**背包满处理（P2-2）**：物品奖励发放时检查 `addItem` 返回值，若 `added < item.count`，通过 `useToast().show()` 提示玩家"背包已满，任务奖励物品仅获得 X/Y"。

### 任务看板交互

- `getQuestsFromBoard(boardId)`: 返回指定任务板上的任务定义（按 `boardId` 筛选）
- `getQuestsToTurnIn(boardId)`: 返回该任务板上已完成待提交的任务（status = 'completed'）
- `acceptQuestFromBoard(boardId, questId)`: 验证任务所属看板后调用 `acceptQuest`
- `turnInQuestToBoard(boardId, questId)`: 验证任务所属看板后调用 `claimReward`

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| `config_quests` | `questId` | `QuestDefinitionStorage` | 任务定义（全局共享，`boardId` 建有索引） |
| `char_quests` | `[characterId, questId]` | `CharQuestStorage` | 任务实例（按角色隔离，复合主键，`characterId` 建有索引） |

### 任务定义存储格式 (config_quests)

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 任务唯一标识 |
| `title` | string | 任务标题 |
| `description` | string | 任务描述 |
| `type` | QuestType | 任务类型（kill/collect） |
| `objectives` | object[] | 目标列表（key, type, target, itemId?, enemyId?, locationId?） |
| `levelRequirement` | number | 等级要求 |
| `xpReward` | number | 经验奖励 |
| `goldReward` | number | 金币奖励 |
| `itemRewards?` | { itemId, count }[] | 物品奖励列表 |
| `boardId` | string | 所属任务板 ID |
| `prerequisiteQuests?` | string[] | 前置任务 ID 列表（BIZ-19） |

### 任务实例存储格式 (char_quests)

| 字段 | 类型 | 说明 |
|------|------|------|
| `characterId` | string | 角色 ID（复合主键第一部分） |
| `questId` | string | 任务 ID（复合主键第二部分） |
| `status` | QuestStatus | 任务状态 |
| `progress` | { objectiveKey, current, target }[] | 目标进度列表 |
| `acceptedAt` | number | 接受时间戳 |
| `completedAt?` | number | 完成时间戳 |

### 多角色支持说明

任务定义（`config_quests`）为全局共享数据。任务实例（`char_quests`）通过 `characterId` 实现角色隔离。切换角色时，系统通过 `initialize(characterId)` 自动加载对应角色的任务实例。

### 默认任务模板

当 `config_quests` 表为空时，系统回退使用 `getDefaultQuests()` 提供的 4 个默认任务：

| 任务 ID | 标题 | 类型 | 目标 | 等级要求 | 经验 | 金币 | 任务板 |
|---------|------|------|------|----------|------|------|--------|
| `quest_kill_gnoll` | 消灭豺狼人 | kill | gnoll × 10 | 1 | 100 | 50 | village |
| `quest_collect_herbs` | 采集草药 | collect | item_herb × 15 | 1 | 80 | 30 | village |
| `quest_kill_wolf` | 狼群威胁 | kill | wolf × 5 | 2 | 150 | 80 | village |
| `quest_kill_boss_orc` | 兽人首领 | kill（复合） | orc × 3 + ogre × 1 | 5 | 500 | 300 | village |

---

## 目标显示文本工具 (objective_utils.ts)

`objective_utils.ts` 提供自动生成任务目标描述文本的纯函数：

| 函数 | 说明 |
|------|------|
| `getObjectiveText(objective, itemNameProvider?)` | 根据目标类型生成显示文本：kill → "消灭{敌人名称}"，collect → "收集{物品名称}" |
| `getEnemyName(enemyId)` | 根据敌人 ID 查询名称（从 `ENEMY_NAME_MAP` 查找，找不到返回 enemyId 本身） |

### 数据来源

- **敌人名称**：`ENEMY_NAME_MAP` 通过 IIFE 在模块加载时构建，合并 `MOBS`（来自 `@/data/config_mobs`）和 `BOSSES`（来自 `@/data/config_bosses`）。普通怪物优先，Boss 仅在 MOBS 中不存在同 ID 时才覆盖。
- **物品名称**：由调用方通过 `itemNameProvider` 回调提供，失败时回退到原始 itemId。

`QuestObjective` 不包含 `description` 字段，UI 层通过调用 `getObjectiveText()` 自动从 `enemyId`/`itemId` 生成目标描述。

---

## 纯函数层 (service.ts)

| 函数 | 说明 |
|------|------|
| `checkQuestProgress(quest, definition, relevantData)` | 检查任务进度，返回 `{ isComplete, progress }` 或 null（无匹配目标） |
| `calculateQuestRewards(definition)` | 计算任务奖励（exp/gold/items） |
| `checkPrerequisiteQuests(definition, activeQuests)` | 检查前置任务是否全部完成（BIZ-19，abandoned 视为未完成） |
| `canAcceptQuest(definition, characterLevel, activeQuests)` | 检查是否可接取（等级 + 活跃实例 + 前置任务） |
| `generateQuestInstance(definition)` | 生成新任务实例（status = in_progress，所有 progress.current = 0） |
| `getDefaultQuests()` | 获取默认任务模板（4 个，仅 DB 为空时回退使用） |

---

## DB 层方法 (QuestDbService)

| 方法 | 表 | 说明 |
|------|-----|------|
| `saveQuestInstance(instance, characterId)` | `char_quests` | 保存任务实例（`toRawData` 剥离 Proxy） |
| `getQuestInstance(characterId, questId)` | `char_quests` | 获取单个任务实例（复合主键查询） |
| `getAllQuestInstances(characterId)` | `char_quests` | 获取角色全部任务实例（`where('characterId').equals()`） |
| `deleteQuestInstance(characterId, questId)` | `char_quests` | 删除单个任务实例 |
| `clearAllQuestInstances()` | `char_quests` | 清空所有任务实例 |
| `deleteCharacterQuests(characterId)` | `char_quests` | 删除指定角色的全部任务实例 |
| `saveQuestDefinition(definition)` | `config_quests` | 保存任务定义 |
| `getQuestDefinition(questId)` | `config_quests` | 获取单个任务定义（经 `_mapToDefinition` 转换） |
| `getAllQuestDefinitions()` | `config_quests` | 获取所有任务定义 |
| `getQuestDefinitionsByBoard(boardId)` | `config_quests` | 获取指定任务板的任务定义（`where('boardId').equals()`） |
| `deleteQuestDefinition(questId)` | `config_quests` | 删除单个任务定义 |
| `clearAllQuestDefinitions()` | `config_quests` | 清空所有任务定义 |

私有方法：`_mapToDefinition(storage)`（存储格式 → 领域模型）、`_mapStorageObjectives(objectives)`（objectives 内联格式转换）。

---

## 与其他模块的交互关系

### 依赖关系

- **事件总线**: `eventBus` + `GameEvents`（来自 `../bus`），发布 `QUEST_ACCEPTED`、`QUEST_COMPLETED`、`QUEST_REWARDED` 事件
- **角色模块**: `useCharacterStore()` 的 `gainExp`、`gainGold`、`level`、`getCharacterId()`
- **背包模块**: `useInventoryStore()` 的 `addItem`、`inventory`
- **日志模块**: `useLogStore()` 的 `addLogEntry`、`generateLogId()`
- **Toast 通知**: `useToast`（来自 `@/composables/useToast`）
- **数据配置**: `MOBS`（`@/data/config_mobs`）、`BOSSES`（`@/data/config_bosses`）
- **数据层**: `dbService.withRetry`（来自 `../data/core`）

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 战斗模块 | 调用 | 战斗结束时调用 `questStore.onEnemyKilled(enemyId)` |
| 背包模块 | 双向 | 背包调用 `onItemCollected`；任务读取 `inventory` 设置初始进度；发奖调用 `addItem` |
| 角色模块 | 调用 | 发放奖励时调用 `gainExp/gainGold`；读取 `level/getCharacterId` |
| 探索模块 | 调用 | 任务看板交互（接受/提交） |
| 冒险日志模块 | 调用 | 记录任务事件日志 |
| 事件总线 | 发布 | 发布 `QUEST_ACCEPTED/QUEST_COMPLETED/QUEST_REWARDED` 事件 |
| Toast 通知 | 调用 | 奖励物品背包满时提示 |

### 事件发布清单

| 事件 | 发射位置 | 载荷 |
|------|----------|------|
| `QUEST_ACCEPTED` | `acceptQuest` 成功后 | `{ questId, definition }` |
| `QUEST_COMPLETED` | `_handleQuestCompletion` 发奖后 | `{ questId, definition }` |
| `QUEST_REWARDED` | `claimReward` 状态转换后 | `{ questId, definition }` |

---

## 异常处理机制

### 异常类型与处理策略

| 异常类型 | 触发条件 | 处理策略 |
|----------|----------|----------|
| 任务不存在 | 操作不存在的任务 | 返回 false / null |
| 任务不可接受 | 等级不足、已有活跃实例、前置任务未完成 | 返回 false |
| 任务未完成 | 提交状态不是 completed 的任务 | 返回 false |
| 任务无法放弃 | 放弃状态不是 in_progress 的任务 | 返回 false |
| 手动完成失败 | 实例不存在、状态非 in_progress、目标未全部达成 | 返回 false |
| 背包已满 | 奖励物品 `addItem` 返回值 < 期望数量 | 通过 `useToast` 提示玩家 |
| 存储读取失败 | IndexedDB 解析错误 | 使用默认值初始化 |
| 存储写入失败 | IndexedDB 写入异常 | `dbService.withRetry` 自动重试 |

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 内存缓存 | `Map<string, T>` 结构缓存定义和实例 | O(1) 查询 |
| 纯函数层 | service.ts 纯计算不持有状态 | 可测试、可复用 |
| 响应式优化 | 每次更新创建新 Map 实例触发 ref 替换 | 确保 Vue 响应式更新 |
| 异步加载 | Store 初始化时异步从 IndexedDB 读取 | 不阻塞主线程 |
| 敌人名称缓存 | `ENEMY_NAME_MAP` 通过 IIFE 一次性构建 | 模块加载后 O(1) 查询 |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 输入验证 | 所有操作进行状态检查和等级校验 |
| 数据序列化 | `toRawData()` 去除 Vue/Proxy 包装（`saveQuestInstance`） |
| 异常捕获 | 所有 IO 操作通过 `dbService.withRetry` 包裹 |
| 复合主键 | `char_quests` 使用 `[characterId, questId]` 复合主键确保数据隔离 |
| 前置任务校验 | `checkPrerequisiteQuests` 确保任务链顺序 |

---

## 模块文件结构

```
src/modules/quest/
  - index.ts          # 模块入口，统一导出
  - types.ts          # 类型定义（含存储类型）
  - db.ts             # IndexedDB 数据库操作层（QuestDbService）
  - store.ts          # Pinia Store 状态管理（useQuestStore）
  - service.ts        # 纯函数层
  - objective_utils.ts # 目标显示文本工具
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | 模块入口，统一导出 types、db（`QuestDbService`/`questDbService`）、service（纯函数）、`getObjectiveText`/`getEnemyName` 和 `useQuestStore` |
| `types.ts` | TypeScript 类型定义：`QuestStatus`、`QuestType`、`QuestObjective`、`QuestDefinition`、`QuestInstance`，以及存储类型 `QuestInstanceStorage`、`QuestDefinitionStorage`、`CharQuestStorage` |
| `db.ts` | IndexedDB 数据库操作层（`QuestDbService` 类），封装 `config_quests` 和 `char_quests` 表的 CRUD，含私有 `_mapToDefinition`/`_mapStorageObjectives` 转换方法 |
| `store.ts` | Pinia Store 状态管理（`useQuestStore`），编排业务逻辑，跨模块调用 character/inventory/log Store 和 eventBus |
| `service.ts` | 纯函数层：`checkQuestProgress`、`calculateQuestRewards`、`checkPrerequisiteQuests`、`canAcceptQuest`、`generateQuestInstance`、`getDefaultQuests` |
| `objective_utils.ts` | 任务目标显示文本工具：`getObjectiveText`、`getEnemyName`，数据源为 `@/data/config_mobs` 和 `@/data/config_bosses` |

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
| v5.0 | 2026-07-10 | 严格依据源码重写：补充 prerequisiteQuests 字段及 checkPrerequisiteQuests 函数；补充存储类型定义；补充 completeQuest 方法；修正 claimReward 为实际方法名；补充 acceptQuest 扫描背包初始进度逻辑；补充 useToast 背包满提示；修正 objective_utils 数据源；补全 DB 层方法清单；补充默认任务模板 ID | System |

---

**文档结束**
