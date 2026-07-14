# 背包模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 背包模块设计文档 |
| 版本 | v5.0 |
| 生成日期 | 2026年7月10日 |
| 所属模块 | `modules/inventory` |
| 更新说明 | 严格依据源码重写：修正 `SortField` 类型（移除不存在的 `acquiredAt`，实际为 `type/rarity/level/name`）；重写 Store Action 接口（`addItem/removeItem` 参数为 `itemId+quantity` 并返回实际数量，补充 `removeItemByIndex/useItemByIndex/dropItemByIndex/dropItemsByIndices/organizeInventory/addItemTemplate/removeItemTemplate/resetInventory/loadInventory/updateSort/setFilters/setSearchKeyword/resetFilters/searchItems/filterInventory`）；移除不存在的 `isUsableInCombat` 函数；补充存储类型定义（`InventoryDataStorage/ItemDataStorage/ItemStorage/InventoryStorage`）；修正物品模板加载为 `unifiedItemTemplateCache` 聚合层（非 equipmentDbService）；补充 `addItem` 中调用 `questStore.onItemCollected` 的跨模块通知；补充 Store 完整 state/computed 清单；说明 `useItem` 中 `physical_damage/magic_damage` 为 TODO 未实现 |

---

## 模块概述与定位

### 模块定位

背包模块负责管理玩家的物品存储和使用。它提供物品的添加、移除、使用等核心功能，是游戏中物品系统的基础模块。

### 核心职责

| 职责 | 描述 |
|------|------|
| 物品管理 | 添加、移除、查找物品 |
| 物品使用 | 消耗品使用、效果触发（直接调用 characterStore Action） |
| 物品堆叠管理 | 支持可堆叠物品叠加，最大堆叠数由 `MAX_STACK=10` 控制 |
| 物品丢弃 | 支持单次和批量丢弃（按索引操作） |
| 物品排序 | 支持多维度排序（类型、品质、等级、名称） |
| 背包整理 | 一键整理，合并同类物品，按品质降序 + 类型升序排序 |
| 物品搜索 | 支持关键词快速查找（匹配名称和描述） |
| 物品筛选 | 支持多条件组合筛选（类型、品质、可堆叠） |
| 容量管理 | 背包大小控制（`INVENTORY_SIZE=50`），空槽位管理 |
| 模板管理 | 运行时动态注册/删除物品模板 |
| 数据持久化 | 背包数据的本地存储与加载 |

### 模块边界

**背包模块**与以下模块交互:
- 战斗模块：战利品掉落（通过直接调用 `addItem()`）
- 商店模块：购买物品、出售物品（通过直接调用 `addItem()`/`removeItem()`）
- 任务模块：任务奖励物品（通过直接调用 `addItem()`）；物品收集进度通知（`addItem` 中调用 `questStore.onItemCollected()`）
- 角色模块：物品效果触发（通过直接调用 `characterStore.applyBonus()`、`receiveHeal()`、`changeMp()`）
- 物品模板聚合层：通过 `unifiedItemTemplateCache` 加载合并后的物品模板（普通物品 + 装备物品）
- 日志模块：记录物品获得/使用/丢弃的冒险日志

### 跨模块通信机制

背包模块遵循"直接 Store Action 调用"模式：

- **其他模块 → 背包模块**：直接调用 `useInventoryStore().addItem(itemId, quantity)` / `removeItem(itemId, quantity)`
- **背包模块 → 角色模块**：`useItem()` 中直接调用 `characterStore.receiveHeal()`、`characterStore.changeMp()`、`characterStore.applyBonus()`
- **背包模块 → 任务模块**：`addItem()` 中调用 `questStore.onItemCollected(itemId, added)` 通知收集进度
- **背包模块 → 日志模块**：各 Action 中调用 `logStore.addLogEntry()` 记录冒险日志
- **事件总线**：不通过 EventBus 发布数据变更事件，UI 更新通过 Vue 响应式系统驱动

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-INV-001 | 支持物品添加（`addItem(itemId, quantity)`），返回实际添加数量 | 核心功能 |
| FR-INV-002 | 支持物品移除（`removeItem(itemId, quantity)`），返回实际移除数量 | 核心功能 |
| FR-INV-003 | 支持物品使用（`useItem(itemId)`），消耗品效果直接调用 characterStore | 消耗品系统 |
| FR-INV-004 | 支持物品查找（`getItemInfo(itemId)`） | 查询功能 |
| FR-INV-005 | 支持背包容量管理（容量50，`INVENTORY_SIZE=50`） | 背包系统 |
| FR-INV-006 | 支持物品叠加 | 物品管理 |
| FR-INV-006-1 | 可堆叠物品判断：检查物品的 `stackable` 属性是否为 `true` | 堆叠系统 |
| FR-INV-006-2 | 可堆叠物品最大堆叠数：由 `MAX_STACK=10` 服务常量控制 | 堆叠系统 |
| FR-INV-006-3 | 不可堆叠物品始终独占一个槽位（count=1） | 堆叠系统 |
| FR-INV-007 | 数据持久化存储 | 存档系统 |
| FR-INV-008 | 支持物品丢弃（按索引单次/批量，`dropItemByIndex`/`dropItemsByIndices`） | 物品管理 |
| FR-INV-009 | 支持物品排序（按类型、品质、等级、名称） | 物品管理 |
| FR-INV-010 | 支持背包一键整理功能（`organizeInventory`） | 物品管理 |
| FR-INV-011 | 支持物品搜索（按名称和描述关键词模糊匹配，不区分大小写） | 查询功能 |
| FR-INV-012 | 支持物品筛选（按类型、品质、可堆叠） | 查询功能 |
| FR-INV-013 | 支持运行时动态注册/删除物品模板（`addItemTemplate`/`removeItemTemplate`） | 模板管理 |
| FR-INV-014 | 添加物品时通知任务系统收集进度（`questStore.onItemCollected`） | 跨模块协作 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-INV-001 | 操作失败时回滚数据 | 高 |
| NFR-INV-002 | 单次操作响应时间 < 10ms | 高 |
| NFR-INV-003 | 支持移动端适配 | 高 |
| NFR-INV-004 | 排序/筛选操作流畅性 < 50ms | 中 |

---

## 接口定义

### Store Action 方法（对外暴露接口）

| 方法 | 签名 | 说明 |
|------|------|------|
| `initialize` | `(characterId: string) => Promise<void>` | 初始化背包（加载角色背包数据和物品模板） |
| `loadInventory` | `() => Promise<void>` | 兼容旧接口，当 characterId 已设置时重新初始化 |
| `addItem` | `(itemId: string, quantity: number) => number` | 添加物品，返回实际添加数量 |
| `removeItem` | `(itemId: string, quantity: number) => number` | 移除物品，返回实际移除数量 |
| `useItem` | `(itemId: string) => Promise<boolean>` | 使用消耗品，应用效果并消耗 |
| `getItemInfo` | `(itemId: string) => Item \| null` | 查询物品模板（内存缓存） |
| `getAllItems` | `() => Item[]` | 获取所有物品模板 |
| `searchItems` | `(keyword: string) => InventoryItem[]` | 按关键词搜索物品 |
| `filterInventory` | `(filtersParam: ItemFilters) => InventoryItem[]` | 按条件筛选物品 |
| `removeItemByIndex` | `(index: number) => number` | 兼容旧接口，按索引移除槽位 |
| `useItemByIndex` | `(index: number) => Promise<boolean>` | 兼容旧接口，按索引使用物品 |
| `dropItemByIndex` | `(index: number, count?: number) => boolean` | 按索引丢弃物品 |
| `dropItemsByIndices` | `(indices: number[]) => boolean` | 批量丢弃多个槽位物品 |
| `organizeInventory` | `() => void` | 一键整理背包 |
| `addItemTemplate` | `(item: Item) => void` | 动态注册物品模板 |
| `removeItemTemplate` | `(itemId: string) => void` | 删除物品模板 |
| `resetInventory` | `() => void` | 重置背包（清空物品，不重置模板和筛选） |
| `updateSort` | `(sortField: SortField, order: SortOrder) => void` | 更新排序方式 |
| `setFilters` | `(newFilters: ItemFilters) => void` | 设置筛选条件 |
| `setSearchKeyword` | `(keyword: string) => void` | 设置搜索关键词 |
| `resetFilters` | `() => void` | 重置筛选条件和搜索关键词 |

### Store 响应式状态

| 状态 | 类型 | 说明 |
|------|------|------|
| `inventory` | `Ref<InventoryItem[]>` | 背包物品列表（索引即 UI 位置） |
| `itemTemplates` | `Ref<Map<string, Item>>` | 物品模板缓存（含普通物品和装备物品） |
| `filters` | `Ref<ItemFilters>` | 当前筛选条件 |
| `sortBy` | `Ref<SortField>` | 当前排序字段（默认 `'type'`） |
| `sortOrder` | `Ref<SortOrder>` | 当前排序顺序（默认 `'asc'`） |
| `searchKeyword` | `Ref<string>` | 搜索关键词 |
| `currentCharacterId` | `Ref<string \| null>` | 当前角色 ID |
| `isLoading` | `Ref<boolean>` | 加载状态标识 |

### Store 计算属性

| 计算属性 | 类型 | 说明 |
|----------|------|------|
| `filteredInventory` | `ComputedRef<InventoryItem[]>` | 筛选并排序后的背包物品 |
| `emptySlots` | `ComputedRef<number>` | 剩余空槽位数（`INVENTORY_SIZE - inventory.length`） |
| `isFull` | `ComputedRef<boolean>` | 背包是否已满 |
| `totalValue` | `ComputedRef<number>` | 背包物品总价值 |
| `itemCountByType` | `ComputedRef<Record<ItemType, number>>` | 按类型统计物品数量 |
| `allItemTypes` | `ComputedRef<{id, name}[]>` | 所有物品类型列表 |
| `allRarities` | `ComputedRef<{id, name, color}[]>` | 所有稀有度列表（含颜色） |

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

/** 物品类型元数据 */
export interface ItemTypeData {
  id: ItemType;
  name: string;
  stackable: boolean;
  maxStack: number;
  usable?: boolean;
}

/** 稀有度配置（UI 展示用） */
export interface RarityConfig {
  name: string;
  color: string;
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
  bonus?: Partial<Stats>;
  effect?: ItemEffect;
  value: number;
  stackable: boolean;
  consumable?: boolean;
  template?: string;
  levelRequirement?: number;
  level?: number;
}

/** 背包槽位物品（仅存储 itemId 和 count） */
export interface InventoryItem {
  itemId: string;
  count: number;
}

/** 排序字段（4种，不含 acquiredAt） */
export type SortField = 'type' | 'rarity' | 'level' | 'name';

/** 排序顺序 */
export type SortOrder = 'asc' | 'desc';

/** 物品筛选条件（所有字段可选，AND 关系） */
export interface ItemFilters {
  types?: ItemType[];
  rarities?: ItemRarity[];
  stackable?: boolean;
}

// ==================== 存储格式定义 ====================

/** 背包数据存储结构（char_inventory 表） */
export interface InventoryDataStorage {
  characterId: string;
  items: InventoryItem[];
  updatedAt: number;
}

/** 物品模板 DB 读取格式（config_items 表读取形状，字段类型宽松） */
export interface ItemDataStorage {
  id: string;
  name: string;
  type: string;
  rarity: string;
  level?: number;
  icon: string;
  description: string;
  bonus: Record<string, number>;
  effect: Record<string, unknown> | null;
  value: number;
  stackable: boolean;
  consumable: boolean;
  template: string | null;
  levelRequirement?: number | null;
}

/** 物品模板 DB 写入格式（config_items 表写入契约） */
export interface ItemStorage {
  id: string;
  name: string;
  type: string;
  rarity: string;
  icon: string;
  description: string;
  bonus?: Partial<Record<string, number>>;
  effect?: { type: string; value: number | Partial<Record<string, number>> } | null;
  value: number;
  stackable: boolean;
  consumable?: boolean;
  template?: string | null;
  levelRequirement?: number | null;
  level?: number;
}

/** 背包存档导入/导出格式 */
export interface InventoryStorage {
  characterId: string;
  items: Array<{ itemId: string; count: number }>;
  updatedAt?: number;
}
```

### 事件定义

背包模块不通过 EventBus 发布数据变更事件。UI 更新通过 Vue 响应式系统（`inventory`、`filteredInventory` 等 computed 属性）驱动。

---

## 业务逻辑流程

### 初始化流程

1. 调用 `initialize(characterId)`，设置 `isLoading = true`
2. 设定 `currentCharacterId`
3. 从 `char_inventory` 表加载该角色的背包数据 → 写入 `inventory`
4. 调用 `loadItemTemplates()` 通过 `unifiedItemTemplateCache.getAll()` 加载合并后的物品模板（普通物品 + 装备物品）→ 写入 `itemTemplates` Map
5. 设置 `isLoading = false`

### 物品添加流程

1. 检查 `currentCharacterId` 有效且 `quantity > 0`
2. 从 `itemTemplates` 获取物品模板，不存在返回 0
3. 浅拷贝整个背包以确保 Vue 响应式更新
4. 第一步：若物品可堆叠（`itemTemplate.stackable === true`）：
   - 遍历背包查找相同 `itemId` 的槽位
   - 调用 `computeStackResult()` 计算堆叠结果和溢出量
   - 将溢出量继续尝试添加到下一个槽位
5. 第二步：剩余数量创建新槽位
   - 可堆叠物品每槽位最多 `MAX_STACK` 个
   - 不可堆叠物品每槽位 1 个（`perSlot = 1`）
   - 背包满时（`INVENTORY_SIZE`）停止添加，溢出部分静默丢弃
6. 更新 `inventory`，异步触发 `persistInventory()`（fire-and-forget）
7. 记录冒险日志（`logStore.addLogEntry`）
8. 通知任务系统收集进度（`questStore.onItemCollected(itemId, added)`）
9. 返回实际添加数量 `added`

### 物品移除流程

1. 检查 `currentCharacterId` 有效且 `quantity > 0`
2. 从前往后遍历背包，逐个扣减直到满足数量要求
3. 槽位中物品数量用尽后整个槽位被移除（不 push 到新数组）
4. 部分移除时保留剩余数量
5. 更新 `inventory`，异步持久化
6. 返回实际移除数量 `removed`

### 物品使用流程

1. 检查 `currentCharacterId` 有效
2. 调用 `findItemIndex()` 查找物品索引，未找到返回 false
3. 获取物品模板，检查 `consumable === true`，否则返回 false
4. 获取 `characterStore`
5. 调用 `computeUseEffect(itemTemplate)` 计算即时效果：
   - `health_restore`：调用 `characterStore.receiveHeal(value)`
   - `mana_restore`：调用 `characterStore.changeMp(value)`
   - `physical_damage`：TODO（需在战斗上下文中调用）
   - `magic_damage`：TODO（需在战斗上下文中调用）
   - `stat`：通过 bonus 字段处理
6. 如果 `itemTemplate.bonus` 存在，调用 `characterStore.applyBonus(bonus)`
7. 消耗物品：堆叠物品 `count-1`，单件物品从槽位移除
8. `await persistInventory()`（事务性持久化，确保效果与消耗同步落盘）
9. 记录冒险日志，返回 true

### 物品丢弃流程

**单次丢弃（`dropItemByIndex`）：**
1. 检查索引有效性
2. `dropCount = count ?? invItem.count`（使用 ?? 以支持 count=0）
3. 如果 `dropCount >= invItem.count`，移除整个槽位
4. 否则减少 count
5. 异步持久化
6. 记录冒险日志

**批量丢弃（`dropItemsByIndices`）：**
1. 检查索引列表非空
2. 按索引降序排列（从大到小），避免 splice 导致的索引偏移问题
3. 依次 splice 移除各索引对应的槽位
4. 异步持久化

### 物品排序和筛选

- **排序（`sortItems`）**：纯函数，支持按 `type`/`rarity`/`level`/`name` 排序，可指定 `asc`/`desc`
  - `type`：按中文类型名称拼音排序（`ITEM_TYPE_NAMES` 映射）
  - `rarity`：按稀有度权重排序（`RARITY_ORDER` 映射，common=0 → legendary=4）
  - `name`：按物品名称拼音排序
  - `level`：按物品等级数值排序
  - 模板缺失时使用安全回退值（misc/common/''/0）
- **筛选（`filterItems`）**：纯函数，按顺序链式过滤
  1. 关键词搜索（匹配名称或描述，不区分大小写）
  2. 类型筛选（`filters.types`）
  3. 稀有度筛选（`filters.rarities`）
  4. 可堆叠筛选（`filters.stackable`）
- **组合（`sortAndFilterInventory`）**：纯函数，先筛选再排序，供 Store `filteredInventory` computed 属性使用

### 背包整理流程

1. 汇总每个 `itemId` 的总数量到 Map
2. 按堆叠规则重新分配槽位：
   - 不可堆叠物品每件占用一个独立槽位（count=1）
   - 可堆叠物品按 `MAX_STACK` 分拆到多个槽位
3. 排序：先按稀有度降序（`RARITY_ORDER` 权重大者在前），同稀有度按类型升序（`ITEM_TYPE_NAMES` 中文名拼音）
4. 更新 `inventory`，异步持久化

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| `char_inventory` | `characterId` | `InventoryDataStorage` | 背包物品列表（按角色隔离，items 以原生数组存储） |
| `config_items` | `id` | `ItemStorage` | 物品模板数据（全局共享） |

### InventoryDataStorage 存储内容（char_inventory）

| 字段 | 类型 | 说明 |
|------|------|------|
| `characterId` | string | 角色 ID（主键） |
| `items` | InventoryItem[] | 背包物品列表（原生数组，非 JSON 字符串） |
| `updatedAt` | number | 最后更新时间戳 |

### InventoryItem 存储内容

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `itemId` | string | - | 物品 ID（关联物品模板） |
| `count` | number | 1 | 物品数量 |

### 多角色支持说明

背包数据通过 `characterId` 字段实现角色隔离，每个角色拥有独立的背包物品。切换角色时，系统通过 `initialize(characterId)` 自动加载对应角色的背包数据。

### 物品堆叠机制

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `INVENTORY_SIZE` | 50 | 背包容量（最大槽位数） |
| `MAX_STACK` | 10 | 通用最大堆叠数（service.ts 常量） |

**堆叠逻辑：**
- `stackable === true` 的物品按 `MAX_STACK` 堆叠，相同 `itemId` 优先填满已有槽位
- `stackable === false` 的物品每个独占一个槽位（count=1）
- `canStackItem()` 判断三条件：模板可堆叠、itemId 相同、槽位未满

### 同步机制

| 同步类型 | 触发条件 | 延迟 |
|----------|----------|------|
| 自动同步 | Action 完成后 | fire-and-forget 异步持久化 |
| 事务性同步 | `useItem` 完成后 | `await` 持久化（确保效果与消耗同步） |

### Service 层纯函数与常量

| 名称 | 类型 | 功能 |
|------|------|------|
| `INVENTORY_SIZE` | 常量 | 背包容量（50） |
| `MAX_STACK` | 常量 | 最大堆叠数（10） |
| `ITEM_TYPE_NAMES` | 常量 | 物品类型中文名映射（`Record<ItemType, string>`） |
| `RARITY_ORDER` | 常量 | 稀有度权重映射（`Record<ItemRarity, number>`，common=0 → legendary=4） |
| `canStackItem(item, existingItem)` | 纯函数 | 判断物品是否可堆叠到已有槽位 |
| `computeStackResult(existing, addQuantity, maxStack)` | 纯函数 | 计算堆叠结果（quantity 和 overflow） |
| `findItemIndex(inventory, itemId)` | 纯函数 | 在背包中查找物品索引 |
| `sortItems(items, itemTemplates, sortBy, sortOrder)` | 纯函数 | 排序物品列表（返回新数组） |
| `filterItems(items, itemTemplates, filters, keyword)` | 纯函数 | 筛选物品列表 |
| `sortAndFilterInventory(items, itemTemplates, filters, sortBy, sortOrder, keyword)` | 纯函数 | 组合筛选与排序 |
| `computeUseEffect(itemTemplate)` | 纯函数 | 获取物品的使用效果（返回 effect 或 null） |

### DB 层方法（InventoryDbService）

| 方法 | 说明 |
|------|------|
| `saveInventory(characterId, items)` | 保存背包数据（通过 `toRawData` 去除 undefined） |
| `getInventory(characterId)` | 获取背包数据，无数据返回空数组 |
| `deleteInventory(characterId)` | 删除背包数据 |
| `saveItemTemplate(item)` | 保存物品模板（Item → ItemStorage 格式转换） |
| `getItemTemplate(itemId)` | 获取单个物品模板（经 `mapToItem` 类型转换） |
| `getAllItemTemplates()` | 获取所有物品模板 |
| `deleteItemTemplate(itemId)` | 删除物品模板 |
| `mapToItem(data)`（私有） | 将 `ItemDataStorage` 转换为 `Item` 类型 |

---

## 与其他模块的交互关系

### 依赖关系

- **物品模板聚合层**：`unifiedItemTemplateCache`（`../item-template`），初始化时加载合并后的物品模板（普通物品 + 装备物品），消除对 equipment 模块的直接依赖
- **角色模块**：`useCharacterStore()` 的 `receiveHeal()`、`changeMp()`、`applyBonus()`
- **任务模块**：`useQuestStore()` 的 `onItemCollected()`
- **日志模块**：`useLogStore()` 的 `addLogEntry()`、`generateLogId()`
- **配置层**：`RARITY_CONFIG`（来自 `@/config/inventory`）
- **数据层**：`dbService.withRetry`（来自 `../data/core`）

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 角色模块 | 直接 Action 调用 | `useItem()` 中调用 `receiveHeal()`、`changeMp()`、`applyBonus()` 应用物品效果 |
| 任务模块 | 直接 Action 调用 | `addItem()` 中调用 `onItemCollected(itemId, added)` 通知收集进度 |
| 战斗模块 | 直接 Action 调用 | 调用 `addItem(itemId, quantity)` 添加战利品 |
| 商店模块 | 直接 Action 调用 | 购买时调用 `addItem()`，出售时调用 `removeItem()` |
| 日志模块 | 直接 Action 调用 | 记录物品获得/使用/丢弃的冒险日志 |
| 物品模板聚合层 | 模块导入 | `loadItemTemplates()` 通过 `unifiedItemTemplateCache.getAll()` 加载模板 |

### 事件发布清单

背包模块不通过 EventBus 发布任何事件。

---

## 异常处理机制

### 异常类型与处理策略

| 异常类型 | 触发条件 | 处理策略 |
|----------|----------|----------|
| 背包已满 | 添加物品时背包已满且无法堆叠 | 静默丢弃溢出部分，返回实际添加数量 |
| 物品不存在 | 模板缓存中找不到物品 ID | 返回 0/false/null |
| 物品不可使用 | `consumable !== true` | 返回 false |
| 堆叠超出限制 | 尝试将物品堆叠超过 MAX_STACK | 自动拆分到新槽位（`computeStackResult`） |
| 存储读取失败 | IndexedDB 解析错误 | 使用空数组初始化 |
| 存储写入失败 | IndexedDB 写入异常 | `dbService.withRetry` 自动重试；`persistInventory` 内部 try/catch 输出 console.error 不影响 UI |
| 模板保存失败 | `saveItemTemplate` 异常 | `.catch()` 记录错误，不影响内存状态 |
| 索引越界 | `removeItemByIndex`/`dropItemByIndex` 索引无效 | 返回 0/false |

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 物品模板缓存 | 内存 `Map<string, Item>` 缓存 | O(1) 查找 |
| 筛选排序 | `sortAndFilterInventory` 纯函数，Store computed 自动响应 | 实时响应 |
| 即时持久化 | Action 完成后异步写 DB（fire-and-forget） | 数据安全且不阻塞 UI |
| 事务性持久化 | `useItem` 使用 `await` 持久化 | 效果与消耗同步落盘 |
| 异步加载 | Store `initialize` 时异步从 IndexedDB 读取 | 不阻塞主线程 |
| 响应式优化 | 添加物品时浅拷贝整个背包数组 | 确保 Vue 响应式更新 |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 输入验证 | 检查 `currentCharacterId` 有效性、`quantity > 0` |
| 边界检查 | 索引操作检查范围（`index < 0 || index >= inventory.length`） |
| 数据隔离 | 按 `characterId` 隔离存储 |
| 异常捕获 | `dbService.withRetry` 含重试机制；`persistInventory` 内部 try/catch |
| 数据清洗 | 写入前通过 `toRawData()` 去除 undefined 值 |
| 默认值策略 | `bonus`/`effect`/`consumable`/`template`/`levelRequirement` 写入 DB 时有默认值转换 |

### 边界情况处理

| 边界情况 | 处理方式 |
|----------|----------|
| `levelRequirement = 0` | 写入/读取使用 `??` 而非 `||`，0 是合法等级要求 |
| `count = 0` 丢弃 | `dropCount = count ?? invItem.count` 使用 `??` 支持 count=0 |
| 模板缺失排序 | `sortItems` 使用安全回退值（misc/common/''/0） |
| 批量丢弃索引偏移 | 按降序排序后 splice，避免索引偏移 |

---

## 模块文件结构

```
src/modules/inventory/
  - index.ts          # 模块入口，统一导出接口
  - types.ts          # 类型定义（含存储类型）
  - db.ts             # 数据库操作层（InventoryDbService）
  - store.ts          # Pinia Store 状态管理（useInventoryStore）
  - service.ts        # 纯函数服务层 + 常量
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | 模块入口，统一导出 types、db（`InventoryDbService`/`inventoryDbService`）、service（常量和纯函数）和 `useInventoryStore` |
| `types.ts` | TypeScript 类型定义：`Item`、`InventoryItem`、`ItemType`、`ItemRarity`、`ItemEffect`、`SortField`、`SortOrder`、`ItemFilters`，以及存储类型 `InventoryDataStorage`、`ItemDataStorage`、`ItemStorage`、`InventoryStorage` |
| `db.ts` | IndexedDB 数据库操作层，封装 `char_inventory` 和 `config_items` 表读写（`InventoryDbService` 类），含私有 `mapToItem` 类型转换方法 |
| `store.ts` | Pinia Store 状态管理（`useInventoryStore`），持有响应式状态并编排 Action 流程，通过 `unifiedItemTemplateCache` 加载模板，跨模块调用 character/quest/log Store |
| `service.ts` | 纯函数服务层 + 常量：`INVENTORY_SIZE`、`MAX_STACK`、`ITEM_TYPE_NAMES`、`RARITY_ORDER`；纯函数 `canStackItem`、`computeStackResult`、`findItemIndex`、`sortItems`、`filterItems`、`sortAndFilterInventory`、`computeUseEffect` |

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
| v4.0 | 2026-06-17 | 逐文件比对验证：核心类型与代码一致 | System |
| v5.0 | 2026-07-10 | 严格依据源码重写：修正 SortField 类型（移除 acquiredAt）；重写 Store Action 接口签名；移除不存在的 isUsableInCombat；补充存储类型定义；修正模板加载为 unifiedItemTemplateCache；补充 questStore.onItemCollected 通知；补充完整 state/computed 清单；说明 useItem 中 physical/magic_damage 为 TODO | System |

---

**文档结束**
