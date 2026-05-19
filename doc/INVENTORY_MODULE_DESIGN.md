# 背包模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 背包模块设计文档 |
| 版本 | v2.0 |
| 生成日期 | 2026年5月19日 |
| 所属模块 | `modules/inventory` |

---

## 模块概述与定位

### 模块定位

背包模块负责管理玩家的物品存储和使用。它提供物品的添加、移除、使用等核心功能,是游戏中物品系统的基础模块。

### 核心职责

| 职责 | 描述 |
|------|------|
| 物品管理 | 添加、移除、查找物品 |
| 物品使用 | 消耗品使用、效果触发 |
| 容量管理 | 背包大小控制,空槽位管理 |
| 数据持久化 | 背包数据的本地存储与加载 |

### 模块边界

**背包模块**与以下模块交互:
- 战斗模块:战利品掉落
- 商店模块:购买物品、出售物品
- 任务模块:任务奖励物品

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-INV-001 | 支持物品添加 | 核心功能 |
| FR-INV-002 | 支持物品移除 | 核心功能 |
| FR-INV-003 | 支持物品使用 | 消耗品系统 |
| FR-INV-004 | 支持物品查找 | 查询功能 |
| FR-INV-005 | 支持背包容量管理 | 背包系统 |
| FR-INV-006 | 支持物品叠加 | 物品管理 |
| FR-INV-007 | 数据持久化存储 | 存档系统 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-INV-001 | 操作失败时回滚数据 | 高 |
| NFR-INV-002 | 单次操作响应时间 < 10ms | 高 |

---

## 接口定义

### 服务接口 IInventoryService

```typescript
export interface IInventoryService {
  getInventory(): InventoryItem[];
  getItem(index: number): InventoryItem | null;
  addItem(item: Item): boolean;
  removeItem(index: number): boolean;
  useItem(index: number): boolean;
  getEmptySlots(): number;
  isFull(): boolean;
  reset(): void;
}
```

### 数据类型定义

```typescript
export interface InventoryItem {
  id: string;
  name: string;
  icon: string;
  type: ItemType;
  rarity: ItemRarity;
  description?: string;
  value: number;
  stackable: boolean;
  count: number;
  effect?: ItemEffect;
}

export type ItemType = 'weapon' | 'armor' | 'consumable' | 'quest' | 'misc';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface ItemEffect {
  type: 'heal' | 'buff' | 'debuff';
  value: number;
  duration?: number;
}
```

### 事件定义

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `INVENTORY_ITEM_ADDED` | 物品添加时 | `{ item }` |
| `INVENTORY_ITEM_REMOVED` | 物品移除时 | `{ item, index }` |
| `INVENTORY_ITEM_USED` | 物品使用时 | `{ item, index }` |
| `INVENTORY_UPDATED` | 背包更新时 | - |

---

## 业务逻辑流程

### 物品添加流程

1. 检查背包是否已满
2. 如果物品可叠加,查找相同物品的槽位
3. 如果找到,增加数量
4. 如果未找到,查找空槽位
5. 如果有空槽位,添加到空槽位
6. 如果无空槽位,返回失败
7. 触发 `INVENTORY_ITEM_ADDED` 事件

### 物品使用流程

1. 获取指定槽位的物品
2. 检查物品是否存在
3. 检查物品是否可使用
4. 应用物品效果
5. 减少物品数量
6. 如果数量为0,清空该槽位
7. 触发 `INVENTORY_ITEM_USED` 事件

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| inventory | 'inventory' | InventoryData | 背包完整数据 |

### InventoryData 存储内容

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | string | 'inventory' | 唯一标识 |
| `inventorySize` | number | 8 | 背包容量 |
| `items` | (Item \| null)[] | [] | 物品列表 |
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

- **事件总线**:发布背包变化事件

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 战斗模块 | 调用 | 添加战利品 |
| 商店模块 | 调用 | 购买物品、出售物品 |
| 任务模块 | 调用 | 任务奖励物品 |
| 角色模块 | 事件订阅 | 物品效果影响角色属性 |

---

## 异常处理机制

### 异常类型与处理策略

| 异常类型 | 触发条件 | 处理策略 |
|----------|----------|----------|
| 背包已满 | 添加物品时背包已满 | 返回 false |
| 物品不存在 | 使用不存在的物品 | 返回 false |
| 物品不可使用 | 使用不可消耗的物品 | 返回 false |
| 存储读取失败 | IndexedDB 解析错误 | 使用默认值初始化 |
| 存储写入失败 | IndexedDB 写入异常 | 进入重试队列，指数退避重试 3 次 |

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 物品查找优化 | 索引访问 | O(1) 时间复杂度 |
| 防抖同步 | 500ms 延迟合并写入 | 减少 IO 操作 |
| 批量写入 | SyncEngine 批量处理 | 提升性能 |
| 异步加载 | Store 初始化时异步从 IndexedDB 读取 | 不阻塞主线程 |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 输入验证 | 检查物品数据有效性 |
| 边界检查 | 防止越界访问 |
| 数据隔离 | 使用独立对象存储 |
| 异常捕获 | 防止程序崩溃 |
| 重试机制 | 失败时自动重试 3 次 |
| 数据校验 | 写入前验证数据结构 |

---

## 模块文件结构

```
src/modules/inventory/
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
| v1.0 | 2026-05-15 | 初始版本,包含基础背包功能 | System |
| v2.0 | 2026-05-19 | 迁移到 Pinia + IndexedDB 架构，实现自动同步持久化 | System |

---

**文档结束**