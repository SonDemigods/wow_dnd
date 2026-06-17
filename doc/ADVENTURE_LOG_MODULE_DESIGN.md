# 冒险日志模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 冒险日志模块设计文档 |
| 版本 | v4.0 |
| 生成日期 | 2026年6月17日 |
| 所属模块 | `modules/log` |

---

## 模块概述与定位

### 模块定位

冒险日志模块负责记录玩家在游戏中的重要事件和经历，包括战斗、任务、物品获取、等级提升、死亡/复活、商店交易、技能、探索、区域进入等。该模块为玩家提供游戏历程的回顾功能，日志按角色 ID 隔离存储。

### 核心职责

| 职责 | 描述 |
|------|------|
| 日志记录 | 记录游戏中 11 种类型的日志事件 |
| 日志查询 | 提供全量查询和按类型筛选查询 |
| 日志管理 | 管理日志的添加（插入头部）和清除 |
| 通知订阅 | 支持 watch/subscribe 模式通知日志变更 |
| 数据持久化 | 实现日志数据的本地存储与加载（`runtime_adventureLogs` 表） |

### 模块边界

**冒险日志模块**被其他模块通过 Store Action 直接调用：
- 战斗模块: 调用 `logStore.addLogEntry()` 记录战斗事件
- 任务模块: 调用 `logStore.addLogEntry()` 记录任务事件
- 角色模块: 调用 `logStore.addLogEntry()` 记录升级/死亡/复活事件
- 背包模块: 调用 `logStore.addLogEntry()` 记录物品事件
- 商店模块: 调用 `logStore.addLogEntry()` 记录交易事件
- 探索模块: 调用 `logStore.addLogEntry()` 记录探索事件
- 技能模块: 调用 `logStore.addLogEntry()` 记录技能事件

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-LOG-001 | 支持添加日志条目（插入到列表头部，时间倒序） | 核心功能 |
| FR-LOG-002 | 支持 11 种日志类型分类 | 日志管理 |
| FR-LOG-003 | 支持按类型筛选日志 | 查询功能 |
| FR-LOG-004 | 支持清除日志并持久化 | 日志管理 |
| FR-LOG-005 | 支持日志数量查询 | 查询功能 |
| FR-LOG-006 | 支持日志变更通知（watch/subscribe） | UI 联动 |
| FR-LOG-007 | 数据持久化存储（按角色隔离） | 存档系统 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-LOG-001 | 操作失败时回滚数据 | 高 |
| NFR-LOG-002 | 单次操作响应时间 < 5ms | 高 |

---

## 接口定义

### Store Action 方法（useLogStore）

| 方法 | 说明 |
|------|------|
| `initialize(characterId)` | 初始化日志模块，从数据库加载指定角色的日志 |
| `addLogEntry(entry: LogEntry)` | 添加日志条目（自动格式化 → 插入头部 → 持久化 → emit 事件） |
| `addLogByType(message, type)` | 便捷方法：按类型和消息快速添加日志 |
| `getLogs()` | 获取所有日志 |
| `getLogsByType(type: LogType)` | 按类型筛选日志 |
| `getLogCount()` | 获取日志数量 |
| `clearLogs()` | 清空所有日志并持久化 |
| `subscribe(callback)` | 订阅日志变更通知（向后兼容旧 API） |

### 服务接口 ILogService

```typescript
export interface ILogService {
  addLog(entry: LogEntry): void;
  getLogs(): LogEntry[];
  getLogsByType(type: LogType): LogEntry[];
  clearLogs(): void;
  getLogCount(): number;
  generateLogId(): string;
}
```

### 数据类型定义

```typescript
/** 日志类型枚举（11种） */
export type LogType =
  | 'info'          // 普通信息
  | 'combat'        // 战斗日志（战斗开始、胜利、失败、逃跑）
  | 'quest'         // 任务日志（接取、完成、提交、放弃）
  | 'item'          // 物品日志（获得、使用、丢弃、装备、卸下）
  | 'level'         // 升级日志
  | 'death'         // 死亡日志
  | 'resurrect'     // 复活日志
  | 'shop'          // 商店交易日志（购买、出售）
  | 'skill'         // 技能日志（学习、施放）
  | 'exploration'   // 探索日志（开始、结束、营地使用）
  | 'zone';         // 区域进入日志

/** 日志条目接口 */
export interface LogEntry {
  id: string;
  timestamp: number;
  type: LogType;
  message: string;
  icon?: string;
}

/** 冒险日志数据接口 */
export interface AdventureLogData {
  characterId: string;
  entries: LogEntry[];
  updatedAt?: number;
}
```

### 日志类型默认图标映射

| 类型 | 图标 | 类型 | 图标 |
|------|------|------|------|
| `info` | 📜 | `death` | 💀 |
| `combat` | ⚔️ | `resurrect` | ✨ |
| `quest` | 📋 | `shop` | 🛒 |
| `item` | 📦 | `skill` | ✨ |
| `level` | ⬆️ | `exploration` | 🗺️ |
| `zone` | 📍 | | |

---

## 业务逻辑流程

### 初始化流程

1. 调用 `logStore.initialize(characterId)`
2. 传入的 `characterId` 保存到 `currentCharacterId`
3. 从 `runtime_adventureLogs` 表加载该角色的日志数据
4. 如果存在数据，设置 `logs = stored.entries`
5. 如果不存在，设置 `logs = []`

### 添加日志流程

1. 调用 `logStore.addLogEntry(entry)`
2. 调用纯函数 `formatLogMessage(entry)` 自动补全图标
3. 将格式化后的条目插入到 `logs` 数组头部（时间倒序）
4. 调用 `saveToDb()` 持久化到 `runtime_adventureLogs` 表
5. 发射 `LOG_ENTRY_ADDED` 事件（携带 type、message、icon）
6. watch 机制自动通知所有订阅者

### 便捷添加日志

调用 `logStore.addLogByType(message, type)` 方法，内部自动生成 ID 和时间戳，然后调用 `addLogEntry`。

### 清除日志流程

1. 调用 `logStore.clearLogs()`
2. 清空 `logs` 数组
3. 调用 `saveToDb()` 持久化（写入空数组覆盖旧数据）

### 日志查询

- `getLogs()`: 直接返回 `logs.value`（时间倒序）
- `getLogsByType(type)`: 使用 `filter` 按类型筛选
- `getLogCount()`: 返回 `logs.value.length`

---

## 纯函数层 (service.ts)

| 函数 | 说明 |
|------|------|
| `generateLogId()` | 生成唯一的日志ID：`${Date.now()}-${Math.random().toString(36).substr(2, 9)}` |
| `formatLogMessage(entry)` | 格式化日志条目（自动补全图标），返回新对象不修改原对象 |

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| `runtime_adventureLogs` | `characterId` | AdventureLogData | 冒险日志完整数据（按角色隔离） |

### AdventureLogData 存储内容

| 字段 | 类型 | 说明 |
|------|------|------|
| `characterId` | string | 角色唯一标识 |
| `entries` | LogEntry[] | 日志条目列表（时间倒序） |
| `updatedAt` | number | 最后更新时间 |

### 多角色支持说明

冒险日志数据通过 `characterId` 实现角色隔离，每个角色拥有独立的日志记录。切换角色时，调用 `initialize(newCharacterId)` 加载对应角色的日志。删除角色时调用 `deleteAdventureLog(characterId)`。

### 日志条目结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识（基于时间戳+随机字符串） |
| `timestamp` | number | 创建时间戳 |
| `type` | LogType | 日志类型 |
| `message` | string | 日志内容文本 |
| `icon` | string | 类型对应的图标（自动生成） |

---

## 与其他模块的交互关系

### 被调用关系

冒险日志模块被所有其他模块通过 `useLogStore()` 直接调用，是游戏中最广泛使用的模块之一：

| 调用模块 | 调用场景 |
|----------|----------|
| 任务模块 | 接受任务、完成任务、提交任务、放弃任务 |
| 战斗模块 | 战斗开始、战斗胜利、战斗失败 |
| 角色模块 | 升级、死亡、复活 |
| 背包模块 | 获得物品、使用物品 |
| 商店模块 | 购买物品、出售物品 |
| 探索模块 | 开始探索、结束探索、营地休息 |
| 技能模块 | 学习技能、施放技能 |
| 地图模块 | 进入区域 |

### 依赖关系

- **事件总线**: 发射 `LOG_ENTRY_ADDED` 事件供 UI 组件监听
- **数据表**: `runtime_adventureLogs`

---

## 异常处理机制

### 异常类型与处理策略

| 异常类型 | 触发条件 | 处理策略 |
|----------|----------|----------|
| 存储读取失败 | IndexedDB 解析错误 | 使用空数组初始化 |
| 存储写入失败 | IndexedDB 写入异常 | 进入重试队列，指数退避重试 3 次 |

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 内存缓存 | 内存存储日志列表 | 快速访问 |
| watch 通知 | 基于 Vue watch 的订阅机制 | 细粒度 UI 更新 |
| 异步加载 | Store 初始化时异步从 IndexedDB 读取 | 不阻塞主线程 |
| 数据序列化 | `toRawData()` 去除 Vue/Proxy 包装 | 避免 DataCloneError |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 数据隔离 | 使用 `characterId` 隔离角色数据 |
| 异常捕获 | 防止程序崩溃 |
| 重试机制 | 失败时自动重试 3 次 |

---

## 模块文件结构

```
src/modules/log/
  - index.ts          # 模块入口，统一导出
  - types.ts          # 类型定义（LogType、LogEntry、ILogService、AdventureLogData 等）
  - db.ts             # IndexedDB 数据库操作层（runtime_adventureLogs）
  - store.ts          # Pinia Store 状态管理（useLogStore）
  - service.ts        # 纯函数层（generateLogId、formatLogMessage）
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | 模块入口、统一导出 |
| `types.ts` | TypeScript 类型定义：`LogType`（11种）、`LogEntry`、`ILogService`、`AdventureLogData`、`LogChangeCallback` |
| `db.ts` | IndexedDB 数据库操作：`saveAdventureLog`、`getAdventureLog`、`deleteAdventureLog`、`clearAllAdventureLogs` |
| `store.ts` | Pinia Store 状态管理（useLogStore）：管理 `logs` 数组、提供 `addLogEntry`/`getLogs`/`getLogsByType`/`clearLogs` 等操作 |
| `service.ts` | 纯函数层：`generateLogId`（唯一ID生成）、`formatLogMessage`（日志格式化/图标补全） |

---

## 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-15 | 初始版本,包含基础日志功能 | System |
| v2.0 | 2026-05-19 | 迁移到 Pinia + IndexedDB 架构，实现自动同步持久化 | System |
| v2.1 | 2026-06-16 | 模块路径从 adventureLog 改为 log，文件结构拆分为 db/store/service 三层架构 | System |
| v3.0 | 2026-06-16 | 全面对齐实际代码：LogType 从 5 种扩展为 11 种（添加 death/resurrect/shop/skill/exploration/zone）、更新为 useLogStore 架构（addLogEntry/addLogByType）、添加 watch/subscribe 通知机制、添加 formatLogMessage 纯函数、更新图标映射表、存储表从 adventureLog 改为 runtime_adventureLogs、DB 层更新为 AdventureLogDbService 类 | System |
| v4.0 | 2026-06-17 | 逐文件比对验证：核心类型与代码一致 | System |

---

**文档结束**
