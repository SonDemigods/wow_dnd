# 任务模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 任务模块设计文档 |
| 版本 | v2.0 |
| 生成日期 | 2026年5月19日 |
| 所属模块 | `modules/quests` |

---

## 模块概述与定位

### 模块定位

任务模块是游戏核心玩法的重要组成部分，负责管理任务的发布、接受、进度追踪、完成和奖励发放。探索中的【任务看板】负责交接任务，为玩家提供游戏目标和成长动力。

### 核心职责

| 职责 | 描述 |
|------|------|
| 任务状态管理 | 维护任务的可用、进行中、完成、已交付等状态 |
| 任务进度追踪 | 追踪任务目标的完成进度 |
| 任务发布 | 管理任务看板发布任务 |
| 任务接受 | 处理任务接受逻辑 |
| 任务交付 | 处理任务交付和奖励发放 |
| 数据持久化 | 实现任务数据的本地存储与加载 |

### 模块边界

**任务模块**与以下模块交互:
- 探索模块:探索中的【任务看板】负责交接任务
- 战斗模块:击杀目标追踪
- 角色模块:奖励发放

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-QUEST-001 | 支持任务接受 | 任务系统核心 |
| FR-QUEST-002 | 支持任务进度追踪 | 任务系统核心 |
| FR-QUEST-003 | 支持任务完成检测 | 任务系统核心 |
| FR-QUEST-004 | 支持任务交付 | 任务系统核心 |
| FR-QUEST-005 | 支持任务奖励发放(经验、金币) | 成长系统 |
| FR-QUEST-006 | 支持击杀型任务目标 | 战斗系统 |
| FR-QUEST-007 | 支持收集型任务目标 | 任务系统 |
| FR-QUEST-008 | 支持任务放弃功能 | 任务系统 |
| FR-QUEST-009 | 支持任务标题和详情展示 | UI展示 |
| FR-QUEST-010 | 支持多种任务状态查询 | UI展示 |
| FR-QUEST-011 | 数据持久化存储 | 存档系统 |
| FR-QUEST-012 | 支持任务看板发布任务 | 任务看板 |
| FR-QUEST-013 | 支持任务看板交付任务 | 任务看板 |
| FR-QUEST-014 | 支持查询任务看板可用任务列表 | 任务看板 |
| FR-QUEST-015 | 支持查询任务看板可交付任务列表 | 任务看板 |

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
  acceptQuest(questKey: string): boolean;
  updateQuestProgress(questKey: string, objectiveKey: string, amount?: number): void;
  turnInQuest(questKey: string): boolean;
  abandonQuest(questKey: string): boolean;
  isQuestAvailable(questKey: string): boolean;
  isQuestInProgress(questKey: string): boolean;
  isQuestCompleted(questKey: string): boolean;
  getQuestState(questKey: string): QuestState | null;
  getQuestDetails(questKey: string): QuestDetails | null;
  getAvailableQuests(): string[];
  getInProgressQuests(): string[];
  getCompletedQuests(): string[];
  
  // 任务看板相关方法
  getQuestsFromBoard(boardId: string): QuestDetails[];
  getQuestsToTurnIn(boardId: string): QuestDetails[];
  acceptQuestFromBoard(boardId: string, questKey: string): boolean;
  turnInQuestToBoard(boardId: string, questKey: string): boolean;
  
  reset(): void;
}
```

### 数据类型定义

```typescript
export enum QuestStatus {
  NOT_AVAILABLE = 'not_available',
  AVAILABLE = 'available',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  TURNED_IN = 'turned_in',
  ABANDONED = 'abandoned',
}

export enum QuestType {
  KILL = 'kill',
  COLLECT = 'collect',
  INTERACT = 'interact',
  ESCORT = 'escort',
}

export interface QuestObjective {
  key: string;
  type: QuestType;
  description: string;
  target: number;
  itemId?: string;
  enemyId?: string;
  locationId?: string;
}

export interface QuestObjectiveProgress {
  current: number;
  target: number;
}

export interface QuestProgress {
  [objectiveKey: string]: QuestObjectiveProgress;
}

export interface QuestState {
  questKey: string;
  status: QuestStatus;
  progress: QuestProgress;
  acceptedAt: number;
  completedAt?: number;
}

export interface QuestDetails {
  questKey: string;
  title: string;
  description: string;
  type: QuestType;
  objectives: QuestObjective[];
  levelRequirement: number;
  xpReward: number;
  goldReward: number;
  itemRewards?: ItemReward[];
  boardId: string;         // 任务看板ID
}

export interface ItemReward {
  itemId: string;
  itemName: string;
  quantity: number;
  chance?: number;
}
```

### 事件定义

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `QUEST_ACCEPTED` | 接受任务时 | `{ questKey, questName }` |
| `QUEST_PROGRESS_UPDATED` | 任务进度更新时 | `{ questKey, objectiveKey, current, target }` |
| `QUEST_COMPLETED` | 任务完成并交付时 | `{ questKey, questName, xpReward, goldReward }` |
| `QUEST_ABANDONED` | 放弃任务时 | `{ questKey, questName }` |
| `QUEST_ACCEPTED_FROM_BOARD` | 从任务看板接受任务时 | `{ questKey, questName, boardId }` |
| `QUEST_TURNED_IN_TO_BOARD` | 向任务看板交付任务时 | `{ questKey, questName, boardId, xpReward, goldReward }` |

---

## 业务逻辑流程

### 任务接受流程

1. 调用 `acceptQuest(questKey)` 方法接受任务
2. 检查任务是否存在
3. 初始化任务状态
4. 检查任务状态是否为 AVAILABLE
5. 如果是,设置状态为 IN_PROGRESS
6. 保存任务状态
7. 触发 `QUEST_ACCEPTED` 事件

### 任务进度更新流程

1. 调用 `updateQuestProgress()` 方法更新进度
2. 检查任务状态是否为 IN_PROGRESS
3. 检查目标是否存在
4. 更新进度值(使用 Math.min 防止超过目标)
5. 保存任务状态
6. 检查所有目标是否完成
7. 如果全部完成,设置状态为 COMPLETED
8. 触发 `QUEST_PROGRESS_UPDATED` 事件

### 任务交付流程

1. 调用 `turnInQuest(questKey)` 方法交付任务
2. 检查任务状态是否为 COMPLETED
3. 如果是,设置状态为 TURNED_IN
4. 保存任务状态
5. 触发 `QUEST_COMPLETED` 事件

### 任务放弃流程

1. 调用 `abandonQuest(questKey)` 方法放弃任务
2. 检查任务状态是否为 IN_PROGRESS
3. 如果是,设置状态为 ABANDONED
4. 重置任务进度
5. 保存任务状态
6. 触发 `QUEST_ABANDONED` 事件

### 任务看板交互流程

#### 从任务看板接受任务

1. 调用 `acceptQuestFromBoard(boardId, questKey)` 方法
2. 获取任务详情，验证任务所属看板
3. 检查任务是否可接受（状态为AVAILABLE）
4. 如果可接受，初始化任务状态为IN_PROGRESS
5. 保存任务状态
6. 触发 `QUEST_ACCEPTED_FROM_BOARD` 事件

#### 向任务看板交付任务

1. 调用 `turnInQuestToBoard(boardId, questKey)` 方法
2. 获取任务详情，验证任务所属看板
3. 检查任务状态是否为COMPLETED
4. 如果已完成，设置状态为TURNED_IN
5. 发放任务奖励（经验、金币、物品）
6. 保存任务状态
7. 触发 `QUEST_TURNED_IN_TO_BOARD` 事件

#### 查询任务看板可用任务

1. 调用 `getQuestsFromBoard(boardId)` 方法
2. 遍历所有任务配置
3. 筛选出任务看板为指定看板的任务
4. 检查任务状态，只返回AVAILABLE状态的任务
5. 返回任务详情列表

#### 查询任务看板可交付任务

1. 调用 `getQuestsToTurnIn(boardId)` 方法
2. 遍历所有进行中的任务
3. 筛选出任务看板为指定看板且状态为COMPLETED的任务
4. 返回任务详情列表

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| quests | `characterId` | QuestData | 任务完整数据（按角色隔离） |

### QuestData 存储内容

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `characterId` | string | - | 角色唯一标识 |
| `questStates` | Record<string, QuestState> | {} | 所有任务状态 |
| `updatedAt` | number | Date.now() | 最后更新时间 |

### 多角色支持说明

任务数据通过 `characterId` 字段实现角色隔离，每个角色拥有独立的任务进度。切换角色时，系统自动加载对应角色的任务状态。删除角色时，级联删除该角色的任务数据。任务配置数据（任务定义）为全局共享，不随角色变化。

### 同步机制

| 同步类型 | 触发条件 | 延迟 |
|----------|----------|------|
| 自动同步 | 状态变更 | 500ms 防抖 |
| 立即同步 | 关键操作 | 即时 |
| 页面卸载 | beforeunload | 即时 |

---

## 与其他模块的交互关系

### 依赖关系

- **事件总线**:发布任务事件
- **任务配置**:QUESTS 常量
- **任务看板配置**:BOARD_CONFIG 常量

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 探索模块 | 调用 | 探索中的【任务看板】负责交接任务 |
| 战斗模块 | 事件订阅 | 击杀敌人时更新任务进度 |
| 角色模块 | 事件发布 | 任务完成时发放奖励 |
| 背包模块 | 调用 | 发放物品奖励时添加到背包 |

---

## 异常处理机制

### 异常类型与处理策略

| 异常类型 | 触发条件 | 处理策略 |
|----------|----------|----------|
| 任务不存在 | 接受不存在的任务 | 返回 false |
| 任务不可接受 | 状态不为AVAILABLE时接受 | 返回 false |
| 任务未完成 | 状态不为COMPLETED时交付 | 返回 false |
| 任务无法放弃 | 状态不为IN_PROGRESS时放弃 | 返回 false |
| 存储读取失败 | IndexedDB 解析错误 | 使用默认值初始化 |
| 存储写入失败 | IndexedDB 写入异常 | 进入重试队列，指数退避重试 3 次 |

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 懒加载 | 仅在访问时初始化任务状态 | 加快启动速度 |
| 独立存储 | 每个任务独立存储键 | 减少读取量 |
| 批量存储 | 仅在数据变更时保存 | 减少IO操作 |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 输入验证 | 所有操作进行状态检查 |
| 数据隔离 | 使用独立存储键前缀 |
| 异常捕获 | 所有IO操作包裹 try-catch |

---

## 模块文件结构

```
src/modules/quests/
  - index.ts          # 核心实现（Store + Service）
  - types.ts          # 类型定义
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | Pinia Store 实现、服务接口实现、数据持久化逻辑 |
| `types.ts` | TypeScript 类型定义、接口定义 |

---

## 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-15 | 初始版本,包含基础任务功能 | System |
| v1.1 | 2026-05-15 | 添加任务放弃功能、收集类任务支持、任务标题和详情展示 | System |
| v2.0 | 2026-05-19 | 迁移到 Pinia + IndexedDB 架构，实现自动同步持久化 | System |
| v2.1 | 2026-05-19 | 整合NPC模块任务相关功能：添加任务看板字段、任务看板交互方法、任务看板查询方法 | System |

---

**文档结束**