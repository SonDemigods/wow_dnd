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
| 物品堆叠管理 | 支持可堆叠物品叠加，最大堆叠数量固定为10 |
| 物品丢弃 | 支持单次和批量丢弃，含确认提示 |
| 物品排序 | 支持多维度排序（类型、品质、等级、时间） |
| 背包整理 | 一键整理，优化空间利用率 |
| 物品搜索 | 支持关键词快速查找 |
| 物品筛选 | 支持多条件组合筛选 |
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
| FR-INV-006-1 | 可堆叠物品判断：检查物品的 `stackable` 属性是否为 `true` | 堆叠系统 |
| FR-INV-006-2 | 最大堆叠数量固定为10，超过则放入新槽位 | 堆叠系统 |
| FR-INV-006-3 | 不可堆叠物品始终独占一个槽位 | 堆叠系统 |
| FR-INV-007 | 数据持久化存储 | 存档系统 |
| FR-INV-008 | 支持物品丢弃（单次/批量），含确认提示 | 物品管理 |
| FR-INV-009 | 支持物品排序（按类型、品质、等级、获取时间） | 物品管理 |
| FR-INV-010 | 支持背包一键整理功能 | 物品管理 |
| FR-INV-011 | 支持物品搜索（按名称关键词） | 查询功能 |
| FR-INV-012 | 支持物品筛选（按类型、品质、可堆叠、绑定） | 查询功能 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-INV-001 | 操作失败时回滚数据 | 高 |
| NFR-INV-002 | 单次操作响应时间 < 10ms | 高 |
| NFR-INV-003 | 支持移动端适配 | 高 |
| NFR-INV-004 | 排序/筛选操作流畅性 < 50ms | 中 |

---

## 接口定义

### 服务接口 IInventoryService

```typescript
/** 物品最大堆叠数量 */
export const MAX_STACK_SIZE = 10;

export interface IInventoryService {
  getInventory(): InventoryItem[];
  getItem(index: number): InventoryItem | null;
  addItem(item: Item): boolean;
  removeItem(index: number): boolean;
  useItem(index: number): boolean;
  getEmptySlots(): number;
  isFull(): boolean;
  reset(): void;
  
  // 物品堆叠判断
  canStack(item: InventoryItem): boolean;
  getStackableCount(item: InventoryItem): number;
  
  // 物品丢弃
  dropItem(index: number, count?: number): boolean;
  dropItems(indices: number[]): boolean;
  
  // 物品排序
  sortItems(sortBy: SortField, order: SortOrder): void;
  
  // 背包整理
  organizeInventory(): void;
  
  // 物品搜索
  searchItems(keyword: string): InventoryItem[];
  
  // 物品筛选
  filterItems(filters: ItemFilters): InventoryItem[];
}
```

### 数据类型定义

```typescript
export interface InventoryItem {
  itemId: string;
  count: number;
}

export type ItemType = 
  | 'gold' | 'potion' | 'scroll' | 'food' | 'material' 
  | 'quest' | 'weapon' | 'armor' | 'misc';

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type ItemEffectType = SkillType | 'stat';

export interface ItemEffect {
  type: ItemEffectType;
  value: number | Partial<Stats>;
}

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  icon: string;
  description: string;
  bonus?: Partial<Stats>;
  value: number;
  stackable: boolean;
  hpRestore?: number;
  mpRestore?: number;
  consumable?: boolean;
  template?: string;
}

// 排序相关类型
export type SortField = 'type' | 'rarity' | 'level' | 'acquiredAt' | 'name';
export type SortOrder = 'asc' | 'desc';

// 筛选相关类型
export interface ItemFilters {
  types?: ItemType[];
  rarities?: ItemRarity[];
  stackable?: boolean;
}

/** 技能类型 */
export type SkillType = 'physical_damage' | 'magic_damage' | 'heal';

/** 六大核心属性 */
export interface Stats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

/**
 * 物品堆叠机制说明
 * 
 * 1. 堆叠判断：
 *    - 检查物品的 `stackable` 属性
 *    - `stackable === true`：可堆叠
 *    - `stackable === false`：不可堆叠
 * 
 * 2. 堆叠限制：
 *    - 最大堆叠数量固定为 10
 *    - 不可堆叠物品始终独占一个槽位
 * 
 * 3. 堆叠逻辑：
 *    - 添加物品时，先查找可堆叠的相同物品槽位
 *    - 如果槽位未满，叠加到该槽位
 *    - 如果槽位已满，放入新的空槽位
 *    - 如果没有空槽位，返回添加失败
 * 
 * 4. 示例：
 *    - 假设背包中有 5 个生命药水（stackable=true, count=8）
 *    - 添加 3 个生命药水：8 + 3 = 11 > 10，所以 8 + 2 = 10（满），剩余 1 个放入新槽位
 *    - 最终：1个槽位有10个药水，1个槽位有1个药水
 */
```

### 事件定义

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `INVENTORY_ITEM_ADDED` | 物品添加时 | `{ item }` |
| `INVENTORY_ITEM_REMOVED` | 物品移除时 | `{ item, index }` |
| `INVENTORY_ITEM_USED` | 物品使用时 | `{ item, index }` |
| `INVENTORY_UPDATED` | 背包更新时 | - |
| `INVENTORY_ITEM_DROPPED` | 物品丢弃时 | `{ item, index, count }` |
| `INVENTORY_SEARCH_RESULT` | 搜索完成时 | `{ results: InventoryItem[], keyword: string }` |
| `INVENTORY_FILTER_RESULT` | 筛选完成时 | `{ results: InventoryItem[], filters: ItemFilters }` |

---

## 业务逻辑流程

### 物品添加流程

1. 检查背包是否已满
2. 如果物品可叠加（`stackable === true`）：
   - 查找背包中相同物品ID且未达到最大堆叠数量（10）的槽位
   - 计算该槽位可叠加数量：`MAX_STACK_SIZE - currentCount`
   - 如果待添加数量 <= 可叠加数量，增加该槽位数量，返回成功
   - 如果待添加数量 > 可叠加数量，先叠加到该槽位满，剩余数量继续查找下一个可叠加槽位
   - 如果所有可叠加槽位都已满，查找空槽位
3. 如果物品不可叠加（`stackable === false`），查找空槽位
4. 如果有空槽位，将物品添加到空槽位
5. 如果无空槽位且还有剩余物品，返回失败
6. 触发 `INVENTORY_ITEM_ADDED` 事件

### 物品使用流程

1. 获取指定槽位的物品
2. 检查物品是否存在
3. 检查物品是否可使用
4. 应用物品效果
5. 减少物品数量
6. 如果数量为0,清空该槽位
7. 触发 `INVENTORY_ITEM_USED` 事件

### 物品丢弃流程

**单次丢弃：**
1. 获取指定槽位的物品
2. 检查物品是否存在
3. 检查物品是否绑定（绑定物品不可丢弃）
4. 弹出确认提示框
5. 用户确认后，减少物品数量或清空槽位
6. 触发 `INVENTORY_ITEM_REMOVED` 事件
7. 同步数据到本地存储

**批量丢弃：**
1. 获取选中的物品索引列表
2. 过滤掉绑定物品
3. 弹出确认提示框（显示将丢弃的物品数量）
4. 用户确认后，依次移除选中的物品
5. 触发 `INVENTORY_UPDATED` 事件
6. 同步数据到本地存储

### 物品排序流程

1. 接收排序字段和排序顺序参数
2. 创建排序比较函数
3. 根据排序字段进行比较：
   - type: 按物品类型排序（武器 > 护甲 > 消耗品 > 任务物品 > 杂物）
   - rarity: 按品质排序（传说 > 史诗 > 稀有 > 优秀 > 普通）
   - level: 按物品等级排序
   - acquiredAt: 按获取时间排序
   - name: 按名称字母顺序排序
4. 执行排序
5. 触发 `INVENTORY_UPDATED` 事件

### 背包整理流程

1. 将所有物品按类型分组
2. 每组内按品质排序
3. 合并空槽位到背包末尾
4. 可堆叠物品合并到同一槽位：
   - 遍历可堆叠物品
   - 将相同物品ID的物品合并到同一槽位
   - 每个槽位最大堆叠数量为10
   - 超出10的物品放入新的槽位
5. 不可堆叠物品独占一个槽位
6. 触发 `INVENTORY_UPDATED` 事件
7. 同步数据到本地存储

### 物品搜索流程

1. 接收搜索关键词
2. 遍历背包物品
3. 模糊匹配物品名称（不区分大小写）
4. 返回匹配的物品列表
5. 触发 `INVENTORY_SEARCH_RESULT` 事件

### 物品筛选流程

1. 接收筛选条件对象
2. 遍历背包物品
3. 按条件过滤：
   - types: 匹配物品类型
   - rarities: 匹配物品品质
   - stackable: 是否可堆叠
   - bindOnPickup: 是否绑定
   - minLevel/maxLevel: 等级范围
4. 返回符合条件的物品列表
5. 触发 `INVENTORY_FILTER_RESULT` 事件

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| inventory | `characterId` | InventoryData | 背包完整数据（按角色隔离） |

### InventoryData 存储内容

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `characterId` | string | - | 角色唯一标识 |
| `inventorySize` | number | 8 | 背包容量 |
| `items` | (Item \| null)[] | [] | 物品列表 |
| `updatedAt` | number | Date.now() | 最后更新时间 |

### 多角色支持说明

背包数据通过 `characterId` 字段实现角色隔离，每个角色拥有独立的背包物品。切换角色时，系统自动加载对应角色的背包数据。删除角色时，级联删除该角色的背包数据。

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
| 背包已满 | 添加物品时背包已满且无法堆叠 | 返回 false |
| 物品不存在 | 使用不存在的物品 | 返回 false |
| 物品不可使用 | 使用不可消耗的物品 | 返回 false |
| 堆叠超出限制 | 尝试将物品堆叠超过10个 | 自动拆分到新槽位 |
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
| v2.1 | 2026-05-19 | 添加物品丢弃、排序、整理、搜索、筛选功能 | System |
| v2.2 | 2026-05-19 | 添加物品堆叠机制：最大堆叠数量固定为10，支持堆叠判断和计算 | System |

---

**文档结束**