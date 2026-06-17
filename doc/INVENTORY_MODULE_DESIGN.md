# 背包模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 背包模块设计文档 |
| 版本 | v3.0 |
| 生成日期 | 2026年6月16日 |
| 所属模块 | `modules/inventory` |

---

## 模块概述与定位

### 模块定位

背包模块负责管理玩家的物品存储和使用。它提供物品的添加、移除、使用等核心功能，是游戏中物品系统的基础模块。

### 核心职责

| 职责 | 描述 |
|------|------|
| 物品管理 | 添加、移除、查找物品 |
| 物品使用 | 消耗品使用、效果触发（直接调用 characterStore Action） |
| 物品堆叠管理 | 支持可堆叠物品叠加，最大堆叠数由各类型的 `ITEM_TYPES` 配置决定（通用 MAX_STACK=10） |
| 物品丢弃 | 支持单次和批量丢弃 |
| 物品排序 | 支持多维度排序（类型、品质、等级、获取时间、名称） |
| 背包整理 | 一键整理，合并同类物品，按品质降序分类排序 |
| 物品搜索 | 支持关键词快速查找 |
| 物品筛选 | 支持多条件组合筛选（类型、品质、可堆叠） |
| 容量管理 | 背包大小控制（INVENTORY_SIZE=50），空槽位管理 |
| 数据持久化 | 背包数据的本地存储与加载 |

### 模块边界

**背包模块**与以下模块交互:
- 战斗模块：战利品掉落（通过直接调用 `addItem()`）
- 商店模块：购买物品、出售物品（通过直接调用 `addItem()`/`removeItem()`）
- 任务模块：任务奖励物品（通过直接调用 `addItem()`）
- 角色模块：物品效果触发（通过直接调用 `characterStore.applyBonus()`、`receiveHeal()`、`changeMp()`）
- 装备模块：装备物品来源

### 跨模块通信机制

背包模块遵循"直接 Store Action 调用"模式：

- **其他模块 → 背包模块**：直接调用 `useInventoryStore().addItem(itemId, quantity)` / `removeItem(itemId, quantity)`
- **背包模块 → 角色模块**：`useItem()` 中直接调用 `characterStore.receiveHeal()`、`characterStore.changeMp()`、`characterStore.applyBonus()`
- **事件总线**：不再通过 EventBus 发布数据变更事件

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-INV-001 | 支持物品添加（`addItem(itemId, quantity)`） | 核心功能 |
| FR-INV-002 | 支持物品移除（`removeItem(itemId, quantity)`） | 核心功能 |
| FR-INV-003 | 支持物品使用（`useItem(itemId)`），消耗品效果直接调用 characterStore | 消耗品系统 |
| FR-INV-004 | 支持物品查找（`getItemInfo(itemId)`） | 查询功能 |
| FR-INV-005 | 支持背包容量管理（容量50，`INVENTORY_SIZE=50`） | 背包系统 |
| FR-INV-006 | 支持物品叠加 | 物品管理 |
| FR-INV-006-1 | 可堆叠物品判断：检查物品的 `stackable` 属性是否为 `true` | 堆叠系统 |
| FR-INV-006-2 | 可堆叠物品最大堆叠数：由 `MAX_STACK=10` 服务常量控制，各类型具体上限由 `@/config/inventory` 的 `ITEM_TYPES` 配置 | 堆叠系统 |
| FR-INV-006-3 | 不可堆叠物品始终独占一个槽位（count=1） | 堆叠系统 |
| FR-INV-007 | 数据持久化存储 | 存档系统 |
| FR-INV-008 | 支持物品丢弃（单次/批量） | 物品管理 |
| FR-INV-009 | 支持物品排序（按类型、品质、等级、获取时间、名称） | 物品管理 |
| FR-INV-010 | 支持背包一键整理功能 | 物品管理 |
| FR-INV-011 | 支持物品搜索（按名称关键词模糊匹配） | 查询功能 |
| FR-INV-012 | 支持物品筛选（按类型、品质、可堆叠） | 查询功能 |

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
export interface IInventoryService {
  getInventory(): InventoryItem[];
  getItem(index: number): InventoryItem | null;
  getItemInfo(itemId: string): Item | null;
  getAllItems(): Item[];
  addItem(item: Item): boolean;
  removeItem(index: number): boolean;
  useItem(index: number): Promise<boolean>;
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
import type { Stats } from '../character/types';
import type { SkillType } from '../skill/types';

/** 物品类型枚举（9种） */
export type ItemType =
  | 'gold'      // 货币
  | 'potion'    // 药水
  | 'scroll'    // 卷轴
  | 'food'      // 食物
  | 'material'  // 材料
  | 'quest'     // 任务物品
  | 'weapon'    // 武器
  | 'armor'     // 护甲
  | 'misc';     // 杂项

/** 物品稀有度枚举（5种） */
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** 稀有度配置 */
export interface RarityConfig {
  name: string;
  color: string;
}

/** 物品类型配置 */
export interface ItemTypeData {
  id: ItemType;
  name: string;
  stackable: boolean;
  maxStack: number;
  usable?: boolean;
}

/** 物品效果类型：技能类型 | 'stat'（属性加成） */
export type ItemEffectType = SkillType | 'stat';

/** 物品效果 */
export interface ItemEffect {
  type: ItemEffectType;
  value: number | Partial<Stats>;
}

/** 物品基础类型 */
export interface Item {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  icon: string;
  description: string;
  /** 物品效果（伤害/生命恢复/法力恢复/属性加成） */
  effect?: ItemEffect;
  /** 属性加成（如 +5 str） */
  bonus?: Partial<Stats>;
  value: number;
  stackable: boolean;
  /** 是否为消耗品（可使用的物品） */
  consumable?: boolean;
  /** 物品模板ID */
  template?: string;
  /** 等级要求 */
  levelRequirement?: number;
  /** 物品等级 */
  level?: number;
}

/** 背包物品（仅存储物品ID和数量，详情通过 getItemInfo 查询） */
export interface InventoryItem {
  itemId: string;
  count: number;
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
```

### 事件定义

背包模块在新架构中不再通过 EventBus 发布数据变更事件。UI 更新通过 Vue 响应式系统（`inventory`、`filteredInventory` 等 computed 属性）驱动。

---

## 业务逻辑流程

### 物品添加流程

1. 检查 `itemId` 对应的物品模板是否存在
2. 如果物品可堆叠（`itemTemplate.stackable === true`）：
   - 遍历背包查找相同 `itemId` 且未满（`count < MAX_STACK`）的槽位
   - 调用 `computeStackResult()` 计算堆叠结果和溢出量
   - 将溢出量继续尝试添加到下一个槽位
3. 如果物品不可堆叠（`stackable === false`），每个放入新槽位（`count=1`）
4. 如果背包已满且无法堆叠，返回 0
5. 更新背包数组，异步持久化
6. 记录冒险日志

### 物品使用流程

1. 获取物品模板（`itemTemplates.get(itemId)`）
2. 检查物品是否存在且为消耗品（`consumable === true`）
3. 计算物品效果（`computeUseEffect(itemTemplate)`）：
   - `health_restore`：直接调用 `characterStore.receiveHeal(value)`
   - `mana_restore`：直接调用 `characterStore.changeMp(value)`
   - `stat`：直接调用 `characterStore.applyBonus(value)`
4. 如果 `itemTemplate.bonus` 存在，调用 `characterStore.applyBonus(bonus)`
5. 减少物品数量（count-1），数量为0时移除槽位
6. 持久化，记录冒险日志

### 物品丢弃流程

**单次丢弃：**
1. 检查索引有效性
2. 如果丢弃数量 >= 当前数量，移除整个槽位
3. 否则减少数量
4. 异步持久化
5. 记录冒险日志

**批量丢弃：**
1. 按索引降序排列（避免删除时索引偏移）
2. 依次移除各索引对应的物品
3. 异步持久化

### 物品排序和筛选

- **排序**：`sortItems()` 纯函数，支持按 type/rarity/level/acquiredAt/name 排序，可指定 asc/desc
- **筛选**：`filterItems()` 纯函数，支持按 types/rarities/stackable 组合筛选，同时可传入关键词模糊搜索
- **组合**：`sortAndFilterInventory()` 纯函数，先筛选再排序
- Store 中的 `filteredInventory` computed 属性自动调用 `sortAndFilterInventory` 实时返回结果

### 背包整理流程

1. 合并所有相同 `itemId` 的物品到 Map 中累计数量
2. 不可堆叠物品每个独占一个槽位（count=1）
3. 可堆叠物品按 `MAX_STACK` 拆分到多个槽位
4. 按品质降序再按分类升序排列
5. 异步持久化

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| char_inventory | `characterId` | InventoryItem[] | 背包物品列表（按角色隔离） |
| config_items | `id` | ItemDataStorage | 物品模板数据 |

### InventoryItem 存储内容

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `itemId` | string | - | 物品ID（关联物品模板） |
| `count` | number | 1 | 物品数量 |

### 多角色支持说明

背包数据通过 `characterId` 字段实现角色隔离，每个角色拥有独立的背包物品。切换角色时，系统自动加载对应角色的背包数据。删除角色时，级联删除该角色的背包数据。

### 物品堆叠机制

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `INVENTORY_SIZE` | 50 | 背包容量（最大槽位数） |
| `MAX_STACK` | 10 | 通用最大堆叠数（service.ts 常量） |
| `ITEM_TYPES[type].maxStack` | 按类型配置 | 各物品类型的最大堆叠数（来自 `@/config/inventory`） |

**堆叠逻辑：**
- `stackable === true` 的物品按 `MAX_STACK` 堆叠，相同 `itemId` 优先填满已有槽位
- `stackable === false` 的物品每个独占一个槽位（count=1）
- `gold` 类型 `maxStack=999999`，支持巨额堆叠

### 同步机制

| 同步类型 | 触发条件 | 延迟 |
|----------|----------|------|
| 自动同步 | Action 完成后 | 即时异步持久化 |
| 页面卸载 | beforeunload | 即时 |

### Service 层纯函数

| 函数名 | 功能 |
|--------|------|
| `canStackItem()` | 判断物品是否可堆叠到已有物品槽位 |
| `computeStackResult()` | 计算堆叠结果（堆叠后数量和溢出量） |
| `findItemIndex()` | 在背包中查找物品索引 |
| `sortItems()` | 排序物品列表（返回新数组） |
| `filterItems()` | 筛选物品列表 |
| `sortAndFilterInventory()` | 组合筛选与排序（纯函数，供 Store computed 使用） |
| `computeUseEffect()` | 计算使用物品的效果 |
| `isUsableInCombat()` | 判断物品是否可在战斗中使用 |

---

## 与其他模块的交互关系

### 依赖关系

- **角色模块**：物品使用时直接调用 `useCharacterStore()` 的 `receiveHeal()`、`changeMp()`、`applyBonus()`
- **装备数据层**：模板加载时从 `equipmentDbService` 获取装备模板

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 角色模块 | 直接 Action 调用 | `useItem()` 中调用 `receiveHeal()`、`changeMp()`、`applyBonus()` 应用物品效果 |
| 战斗模块 | 直接 Action 调用 | 调用 `addItem(itemId, quantity)` 添加战利品 |
| 商店模块 | 直接 Action 调用 | 购买时调用 `addItem()`，出售时调用 `removeItem()` |
| 任务模块 | 直接 Action 调用 | 任务奖励时调用 `addItem()` |
| 日志模块 | 直接 Action 调用 | 记录物品获得/使用/丢弃的冒险日志 |

---

## 异常处理机制

### 异常类型与处理策略

| 异常类型 | 触发条件 | 处理策略 |
|----------|----------|----------|
| 背包已满 | 添加物品时背包已满且无法堆叠 | 返回 0（未添加） |
| 物品不存在 | 模板缓存中找不到物品ID | 返回 0/false |
| 物品不可使用 | `consumable !== true` | 返回 false |
| 堆叠超出限制 | 尝试将物品堆叠超过 MAX_STACK | 自动拆分到新槽位（`computeStackResult`） |
| 存储读取失败 | IndexedDB 解析错误 | 使用空数组初始化 |
| 存储写入失败 | IndexedDB 写入异常 | `dbService.withRetry` 自动重试 |

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 物品模板缓存 | 内存 Map<string, Item> 缓存 | O(1) 查找 |
| 筛选排序 | `sortAndFilterInventory` 纯函数，Store computed 自动响应 | 实时响应 |
| 即时持久化 | Action 完成后异步写 DB | 数据安全 |
| 异步加载 | Store `initialize` 时异步从 IndexedDB 读取 | 不阻塞主线程 |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 输入验证 | 检查 itemId 有效性、quantity > 0 |
| 边界检查 | `removeItemByIndex` 检查索引范围 |
| 数据隔离 | 按 `characterId` 隔离存储 |
| 异常捕获 | `dbService.withRetry` 含重试机制 |
| 数据校验 | 写入前通过 `toRawData()` 处理数据 |

---

## 模块文件结构

```
src/modules/inventory/
  - index.ts          # 模块入口，统一导出接口
  - types.ts          # 类型定义
  - db.ts             # 数据库操作层（InventoryDbService）
  - store.ts          # Pinia Store 状态管理（useInventoryStore）
  - service.ts        # 纯函数服务层 + 向后兼容代理对象
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | 模块入口，统一导出 types、db、service 和 useInventoryStore |
| `types.ts` | TypeScript 类型定义（Item、InventoryItem、ItemType、ItemRarity、ItemEffect 等） |
| `db.ts` | IndexedDB 数据库操作层，封装 `char_inventory` 和 `config_items` 表读写（InventoryDbService 类） |
| `store.ts` | Pinia Store 状态管理，响应式数据维护。提供 `addItem(itemId, quantity)`、`removeItem(itemId, quantity)`、`useItem(itemId)` 等完整背包操作 |
| `service.ts` | 纯函数服务层 + `inventoryService` 兼容代理对象（供未迁移的外部模块调用） |

---

## 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-15 | 初始版本，包含基础背包功能 | System |
| v2.0 | 2026-05-19 | 迁移到 Pinia + IndexedDB 架构，实现自动同步持久化 | System |
| v2.1 | 2026-05-19 | 添加物品丢弃、排序、整理、搜索、筛选功能 | System |
| v2.2 | 2026-05-19 | 添加物品堆叠机制：最大堆叠数量固定为10，支持堆叠判断和计算 | System |
| v2.3 | 2026-06-16 | 文件结构拆分为db/store/service三层架构 | System |
| v3.0 | 2026-06-16 | 全面更新与代码对齐：背包容量更新为50（INVENTORY_SIZE=50）；Item 新增 effect/levelRequirement/level 字段，移除 hpRestore/mpRestore；ItemEffect 类型更新为 ItemEffectType（SkillType: 'stat'）；跨模块通信改为直接 Store Action 调用；物品使用直接调用 characterStore.receiveHeal/changeMp/applyBonus；新增 service 层纯函数（canStackItem/computeStackResult/findItemIndex/sortItems/filterItems/sortAndFilterInventory/computeUseEffect）；稀有度配置从 @/config/inventory 引用 | System |

---

**文档结束**
