# NPC模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | NPC模块设计文档 |
| 版本 | v2.0 |
| 生成日期 | 2026年5月19日 |
| 所属模块 | `modules/npc` |

---

## 模块概述与定位

### 模块定位

NPC模块负责管理游戏中非玩家角色的交互逻辑,包括对话系统、任务交互等功能。该模块是玩家与游戏世界互动的重要桥梁。

### 核心职责

| 职责 | 描述 |
|------|------|
| NPC数据管理 | 管理NPC的基础数据和配置 |
| 对话系统 | 处理NPC对话流程 |
| 任务交互 | 处理任务的接受和交付 |
| 交互状态管理 | 管理当前交互状态 |
| 数据持久化 | 实现NPC交互数据的本地存储与加载 |

### 模块边界

**NPC模块**与以下模块交互:
- 任务模块:任务数据
- 商店模块:商人NPC
- 地图模块:位置数据

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-NPC-001 | 支持NPC数据查询 | 核心功能 |
| FR-NPC-002 | 支持按地点查询NPC | 地图交互 |
| FR-NPC-003 | 支持NPC对话流程 | 核心功能 |
| FR-NPC-004 | 支持从NPC接受任务 | 任务系统 |
| FR-NPC-005 | 支持向NPC交付任务 | 任务系统 |
| FR-NPC-006 | 数据持久化存储 | 存档系统 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-NPC-001 | 存储数据加密处理 | 高 |
| NFR-NPC-002 | 操作失败时回滚数据 | 高 |
| NFR-NPC-003 | 单次操作响应时间 < 10ms | 高 |

---

## 接口定义

### 服务接口 INPCService

```typescript
export interface INPCService {
  interactWithNPC(npcId: string): boolean;
  endInteraction(): void;
  getNPC(npcId: string): NPCData | null;
  getNPCsAtLocation(locationKey: string): NPCData[];
  getCurrentInteraction(): NPCInteractionState;
  talkToNPC(): void;
  acceptQuestFromNPC(questKey: string): boolean;
  turnInQuestToNPC(questKey: string): boolean;
  reset(): void;
}
```

### 数据类型定义

```typescript
export enum NPCType {
  QUEST_GIVER = 'quest_giver',
  VENDOR = 'vendor',
  TRAINER = 'trainer',
  REPAIR = 'repair',
  MISCELLANEOUS = 'miscellaneous',
}

export interface NPCData {
  id: string;
  name: string;
  icon: string;
  type: NPCType;
  locationKey: string;
  questKeys?: string[];
  vendorItems?: string[];
  dialogue?: string[];
}

export interface NPCInteractionState {
  currentNPCId: string | null;
  interactionStep: number;
  availableQuests: string[];
}

export interface NPCDialogueEvent {
  npcId: string;
  npcName: string;
  message: string;
}
```

### 事件定义

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `NPC_DIALOGUE` | NPC对话时 | `{ npcId, npcName, message }` |
| `NPC_QUEST_ACCEPTED` | 从NPC接受任务时 | `{ questKey, npcId }` |
| `NPC_QUEST_TURNED_IN` | 向NPC交付任务时 | `{ questKey, npcId }` |

---

## 业务逻辑流程

### NPC交互流程

1. 调用 `interactWithNPC(npcId)` 方法
2. 检查NPC是否存在
3. 初始化交互状态
4. 保存交互状态
5. 如果有对话,触发 `NPC_DIALOGUE` 事件

### 对话流程

1. 调用 `talkToNPC()` 方法
2. 检查是否有当前NPC
3. 检查是否有对话内容
4. 如果有更多对话:
   - 增加对话步骤
   - 保存状态
   - 触发 `NPC_DIALOGUE` 事件

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| npc | 'npc' | NpcData | NPC完整数据 |

### NpcData 存储内容

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | string | 'npc' | 唯一标识 |
| `currentNPCId` | string \| null | null | 当前交互的NPC ID |
| `interactionStep` | number | 0 | 对话步骤 |
| `availableQuests` | string[] | [] | 可用任务列表 |
| `updatedAt` | number | Date.now() | 最后更新时间 |

### 同步机制

| 同步类型 | 触发条件 | 延迟 |
|----------|----------|------|
| 自动同步 | 状态变更 | 500ms 防抖 |
| 立即同步 | 关键操作 | 即时 |
| 页面卸载 | beforeunload | 即时 |

---

## 与其他模块的交互关系

### 依赖关系

- **事件总线**:发布NPC事件
- **游戏数据**:WORLD_LOCATIONS

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 任务模块 | 事件发布 | 通过事件触发任务接受和交付 |
| 商店模块 | 事件发布 | 通过商人NPC打开商店 |
| 地图模块 | 数据共享 | 获取地点对应的NPC |
| 事件总线 | 发布/订阅 | 发布NPC事件,供UI组件监听 |

---

## 异常处理机制

### 异常类型与处理策略

| 异常类型 | 触发条件 | 处理策略 |
|----------|----------|----------|
| NPC不存在 | 交互不存在的NPC | 返回 false |
| 存储读取失败 | IndexedDB 解析错误 | 使用默认值初始化 |
| 存储写入失败 | IndexedDB 写入异常 | 进入重试队列，指数退避重试 3 次 |

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 数据缓存 | 内存缓存NPC数据 | 减少重复查询 |
| 即时清理 | 结束交互时清除存储 | 减少存储占用 |
| 防抖同步 | 500ms 延迟合并写入 | 减少 IO 操作 |
| 批量写入 | SyncEngine 批量处理 | 提升性能 |
| 异步加载 | Store 初始化时异步从 IndexedDB 读取 | 不阻塞主线程 |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 输入验证 | 所有操作进行参数检查 |
| 数据隔离 | 使用独立对象存储 |
| 异常捕获 | 防止程序崩溃 |
| 重试机制 | 失败时自动重试 3 次 |
| 数据校验 | 写入前验证数据结构 |

---

## 模块文件结构

```
src/modules/npc/
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
| v1.0 | 2026-05-15 | 初始版本,包含基础NPC功能 | System |
| v2.0 | 2026-05-19 | 迁移到 Pinia + IndexedDB 架构，实现自动同步持久化 | System |

---

**文档结束**
