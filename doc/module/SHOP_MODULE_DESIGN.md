# 商店模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 商店模块设计文档 |
| 版本 | v5.0 |
| 生成日期 | 2026年7月10日 |
| 所属模块 | `modules/shop` |
| 更新说明 | 严格依据源码重写：移除不存在的类型（`PriceVariation`/`ItemCategory`/`ItemQuality`/`IShopService`/`ShopConfigStorage`）；修正 `ShopConfig` 字段（移除 `priceVariation`，实际为 `id/name/type/icon/refreshInterval`）；补充 `ShopType` 联合类型；补充 `ShopItem` 的 `maxPurchaseCount`/`purchasedCount` 字段（BIZ-21）；修正 `SoldItemEntry` 字段名（`quantity` 而非 `count`）；修正 `ShopDisplayItem` 字段（`type/quality/effect`，移除 `category`）；补充 `ShopSoldItemsStorage` 类型；补充 `runtime_shopSoldItems` 表（BIZ-16 回购持久化）；重写 Store Action 接口（移除不存在的 `selectShop`/`refreshItems` 别名，补充 `init`/`closeShop` 实际签名）；重写 service 层函数签名（`calculatePrice`/`computeSellPrice`/`canAffordItem`/`generateShopItems`，移除不存在的 `getAvailableShops`）；补充 BIZ-20（lastRefresh 持久化）、BIZ-21（购买次数上限）、ARCH-14（soldItems 响应式替换）、P2-1（背包满返还金币）等机制说明；补充 SHOP_OPENED/SHOP_CLOSED/SHOP_TRANSACTION 事件定义 |

---

## 模块概述与定位

### 模块定位

商店模块是游戏经济系统的核心组件，负责管理商品的随机刷新、购买和出售功能。采用"当前商店"模式（同一时间只打开一个商店），商品列表按 shopId 隔离存储。回购列表持久化到 IndexedDB，支持页面刷新后恢复。

### 核心职责

| 职责 | 描述 |
|------|------|
| 商店配置管理 | 管理不同类型商店的配置参数（从 `config_shops` 加载，DB 为空时回退到 `SHOPS` 种子数据） |
| 商品随机刷新 | 根据商店类型从物品模板池中随机生成商品列表（6-12 件，库存 1-5） |
| 商品购买 | 处理购买流程，包括金币验证、购买次数上限校验、背包添加、库存扣减 |
| 商品出售 | 处理出售流程，包括物品移除、金币增加、回购列表追踪 |
| 回购机制 | 玩家出售的物品进入回购列表，可按原出售价回购（BIZ-16 持久化） |
| 购买次数限制 | 稀有及以上商品限制购买次数（BIZ-21，rare=5/epic=3/legendary=1） |
| 商店刷新定时 | 支持按 `refreshInterval` 定时刷新商品（BIZ-20 lastRefresh 持久化） |
| 数据持久化 | 商店配置、商品、回购列表、当前商店 ID 的本地存储与加载 |

### 模块边界

**商店模块**与以下模块直接交互（全部通过 Store Action 调用）:
- 角色模块: 金币管理（`characterStore.spendGold/gainGold/getCharacterData/getCharacterId`）
- 背包模块: 物品管理（`inventoryStore.addItem/removeItem/getItemInfo/getAllItems`）
- 探索模块: 探索中的【商店】买卖货品（探索调用 `shopStore.openShop`）
- 冒险日志模块: 记录交易事件日志
- 事件总线: 发布 `SHOP_OPENED`、`SHOP_CLOSED`、`SHOP_TRANSACTION` 事件
- Toast 通知: 购买次数上限、背包空间不足时提示

### 跨模块通信机制

商店模块采用"直接 Store Action 调用 + EventBus 事件"双模式：

- **探索模块 → 商店模块**：直接调用 `shopStore.openShop(shopId)`
- **商店模块 → 角色模块**：购买时 `spendGold`、出售时 `gainGold`、查询 `getCharacterData/getCharacterId`
- **商店模块 → 背包模块**：购买时 `addItem`、出售时 `removeItem`、查询 `getItemInfo/getAllItems`
- **商店模块 → 日志模块**：`logStore.addLogEntry` 记录交易日志
- **商店模块 → 事件总线**：`eventBus.emit(GameEvents.SHOP_OPENED/SHOP_CLOSED/SHOP_TRANSACTION)`
- **商店模块 → Toast 通知**：`useToast().show()` 提示购买限制和背包满

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-SHOP-001 | 支持多种商店类型（`ShopType`: general, potion, scroll, food, material） | 游戏设计 |
| FR-SHOP-002 | 商品按需加载/生成，支持按 `refreshInterval` 定时刷新（BIZ-20） | 游戏机制 |
| FR-SHOP-003 | 商品价格基于物品基础价值和稀有度倍数计算（`calculatePrice`） | 经济平衡 |
| FR-SHOP-004 | 商品库存管理，购买后减少对应库存 | 交易逻辑 |
| FR-SHOP-005 | 购买时验证金币是否充足（`canAffordItem`） | 交易安全 |
| FR-SHOP-006 | 购买时检查背包容量，不足时按比例返还金币（P2-1） | 背包管理 |
| FR-SHOP-007 | 出售时计算物品回收价（买入价 × 0.5，`computeSellPrice`） | 经济平衡 |
| FR-SHOP-008 | 出售时从背包移除物品 | 背包管理 |
| FR-SHOP-009 | 支持回购机制（玩家出售的物品可回购，BIZ-16 持久化） | 游戏体验 |
| FR-SHOP-010 | 稀有及以上商品限制购买次数（BIZ-21，rare=5/epic=3/legendary=1） | 经济平衡 |
| FR-SHOP-011 | 数据持久化存储（配置、商品、回购列表、当前商店 ID） | 存档系统 |
| FR-SHOP-012 | 页面刷新后恢复上次打开的商店 ID 和回购列表 | 用户体验 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-SHOP-001 | 交易操作失败时回滚数据（金币返还） | 高 |
| NFR-SHOP-002 | 单次交易响应时间 < 50ms | 高 |

---

## 接口定义

### Store Action 方法（对外暴露接口）

| 方法 | 签名 | 说明 |
|------|------|------|
| `init` | `() => Promise<void>` | 初始化商店模块（加载配置、恢复商店 ID、恢复回购列表和 lastRefresh） |
| `openShop` | `(shopId: string) => Promise<void>` | 打开指定商店（加载/生成商品、检查刷新、持久化商店 ID） |
| `buyItem` | `(itemId: string, quantity?: number) => Promise<boolean>` | 购买当前商店中的物品（默认 quantity=1） |
| `sellItem` | `(itemId: string, quantity?: number) => Promise<boolean>` | 向当前商店出售物品（默认 quantity=1） |
| `closeShop` | `() => Promise<void>` | 关闭当前商店（持久化空 ID、清空状态） |
| `refreshShop` | `() => Promise<void>` | 刷新当前商店商品（重新生成） |
| `getShopConfig` | `(shopId: string) => ShopConfig \| null` | 获取指定商店配置 |
| `calculateSellPrice` | `(itemId: string) => number` | 计算物品卖出价格（供 UI 预览） |
| `getSoldItemCount` | `(itemId: string) => number` | 获取物品在当前商店的回购数量 |
| `reset` | `() => Promise<void>` | 重置所有商店数据（清空 DB 和内存） |

### Store 响应式状态

| 状态 | 类型 | 说明 |
|------|------|------|
| `shops` | `Ref<ShopConfig[]>` | 全部商店配置列表 |
| `currentShopId` | `Ref<string \| null>` | 当前打开的商店 ID（null 表示未打开） |
| `currentItems` | `Ref<ShopItem[]>` | 当前商店商品列表（生成商品 + 回购物品合并） |
| `isLoading` | `Ref<boolean>` | 初始化加载标志 |
| `soldItems` | `Ref<Map<string, Map<string, SoldItemEntry>>>` | 回购跟踪（`shopId → itemId → entry` 二级 Map） |
| `lastRefresh` | `Ref<Map<string, number>>` | 各商店上次商品生成时间戳 |

### Store 计算属性

| 计算属性 | 类型 | 说明 |
|----------|------|------|
| `currentShopConfig` | `ComputedRef<ShopConfig \| null>` | 当前商店配置对象（未打开返回 null） |

### 数据类型定义

```typescript
import type { ItemRarity, ItemType, ItemEffect } from '../inventory/types';

/** 商店类型（5种） */
export type ShopType = 'general' | 'potion' | 'scroll' | 'food' | 'material';

/** 商店配置 */
export interface ShopConfig {
  id: string;
  name: string;
  type: ShopType;
  icon: string;
  /** 商品自动刷新间隔（毫秒），0 表示不自动刷新 */
  refreshInterval: number;
}

/** 商店商品（运行时库存条目） */
export interface ShopItem {
  itemId: string;
  price: number;
  quantity: number;
  /** 购买次数上限（可选，BIZ-21），未定义表示不限制 */
  maxPurchaseCount?: number;
  /** 已购买次数（运行时维护，BIZ-21），达到 maxPurchaseCount 时阻止购买 */
  purchasedCount?: number;
}

/** 商店展示商品（UI 渲染用，合并 ShopItem 和物品详情） */
export interface ShopDisplayItem {
  id: string;
  itemId: string;
  name: string;
  type: ItemType;
  quality: ItemRarity;
  icon: string;
  description: string;
  price: number;
  quantity: number;
  effect?: ItemEffect;
}

/** 回购条目 */
export interface SoldItemEntry {
  itemId: string;
  price: number;
  quantity: number;
}

// ==================== 存储/持久化接口 ====================

/** 商店商品持久化格式（runtime_shopItems 表） */
export interface ShopItemsStorage {
  shopId: string;
  items: ShopItem[];
  lastRefresh: number;
}

/** 商店回购列表持久化格式（runtime_shopSoldItems 表，BIZ-16） */
export interface ShopSoldItemsStorage {
  shopId: string;
  soldItems: SoldItemEntry[];
}
```

### 商店类型与可售物品映射（SHOP_TYPE_ITEM_TYPE_MAP）

| 商店类型 | 可售物品类型 |
|----------|-------------|
| `general` | potion, scroll, food, material |
| `potion` | potion |
| `scroll` | scroll |
| `food` | food |
| `material` | material |

### 事件定义

| 事件名 | 载荷 | 发射时机 |
|--------|------|----------|
| `GameEvents.SHOP_OPENED` | `{ shopId, characterId? }` | `openShop` 成功后 |
| `GameEvents.SHOP_CLOSED` | `{ shopId? }` | `closeShop` 关闭商店后 |
| `GameEvents.SHOP_TRANSACTION` | `{ shopId?, itemId, quantity?, totalPrice?, sellPrice? }` | 买卖操作完成时 |

---

## 业务逻辑流程

### 初始化流程

1. 调用 `shopStore.init()`
2. 调用 `loadShopConfigs()`：从 `config_shops` 加载配置，DB 为空时回退到 `SHOPS` 种子数据并写回
3. 恢复上次保存的商店 ID（`shopDbService.getCurrentShopId`），若商店存在则设置 `currentShopId`
4. **BIZ-16**：从 `runtime_shopSoldItems` 表恢复全部商店的回购列表到 `soldItems` Map（通过 `_replaceSoldItems` 触发响应式）
5. **BIZ-20**：从 `runtime_shopItems` 表恢复各商店的 `lastRefresh` 时间戳到 `lastRefresh` Map

### 打开商店流程

1. 调用 `shopStore.openShop(shopId)`
2. 校验 shopId 有效，切换商店时清空旧商品列表
3. 确保商店配置已加载（首次调用时触发 `loadShopConfigs`）
4. 查找商店配置，不存在则返回
5. 调用 `loadOrGenerateItems(shopId)`：
   - 优先从 DB 读取已保存商品（同步恢复 `lastRefresh`）
   - DB 为空时调用 `regenerateItems` 重新生成
6. 检查刷新：若 `Date.now() - lastRefresh >= refreshInterval` 则调用 `regenerateItems` 重新生成
7. 持久化当前商店 ID（`saveCurrentShopId`）
8. 调用 `mergeItems` 合并生成商品和回购物品 → 设置 `currentItems`
9. 发射 `SHOP_OPENED` 事件（携带 shopId 和 characterId）

### 购买物品流程

1. 调用 `shopStore.buyItem(itemId, quantity)`（默认 quantity=1）
2. 验证当前商店已打开、商品存在、库存充足
3. 判断是否为回购物品（`soldItems` Map 中是否存在）
4. **BIZ-21**：若为生成商品且携带 `maxPurchaseCount`，校验 `purchasedCount + quantity` 不超过上限，超出则 Toast 提示并返回 false
5. 计算总价 = 单价 × 数量
6. 调用纯函数 `canAffordItem(character, totalPrice)` 检查金币
7. 调用 `characterStore.spendGold(totalPrice)` 扣除金币
8. 调用 `inventoryStore.addItem(itemId, quantity)` 添加物品
9. **P2-1**：若 `added < quantity`（背包空间不足），按未添加比例返还金币（`gainGold(refundAmount)`），Toast 提示，`added=0` 时返回 false
10. 更新商店库存：
    - **回购路径**：从 `soldItems` Map 中扣减（`_replaceSoldItems` 整体替换，BIZ-16 持久化）
    - **生成商品路径**：从 DB 读取完整 storage，扣减 quantity，累计 `purchasedCount`（BIZ-21），保留原 `lastRefresh`（BIZ-20）后写回
11. 调用 `mergeItems` 刷新 `currentItems`
12. 发射 `SHOP_TRANSACTION` 事件（携带 shopId, itemId, quantity, totalPrice）
13. 记录冒险日志

### 出售物品流程

1. 调用 `shopStore.sellItem(itemId, quantity)`（默认 quantity=1）
2. 验证当前商店已打开
3. 获取物品模板（`inventoryStore.getItemInfo`），不存在返回 false
4. 调用纯函数 `computeSellPrice(itemTemplate)` 计算回收单价
5. 调用 `inventoryStore.removeItem(itemId, quantity)` 从背包移除（返回实际移除数量）
6. 计算实际售价 = 单价 × 实际移除数量
7. 调用 `characterStore.gainGold(actualSellPrice)` 增加金币
8. 加入回购列表（`_replaceSoldItems` 整体替换，同物品多次出售合并数量）
9. **BIZ-16**：持久化回购列表到 `runtime_shopSoldItems` 表
10. 调用 `mergeItems` 刷新 `currentItems`（回购物品出现在商店顶部）
11. 发射 `SHOP_TRANSACTION` 事件（携带 shopId, itemId, quantity, sellPrice）
12. 记录冒险日志

### 商品刷新流程

1. 调用 `shopStore.refreshShop()` 或定时刷新触发
2. 调用 `regenerateItems(shopId)`：
   - 调用纯函数 `generateShopItems(config, allTemplates)`：
     - 按 `SHOP_TYPE_ITEM_TYPE_MAP` 过滤物品池
     - Fisher-Yates 洗牌后随机选取 6-12 件物品
     - 计算购买价（`calculatePrice(item, true)`）
     - 生成随机库存（1-5）
     - **BIZ-21**：稀有及以上商品携带 `maxPurchaseCount`（rare=5/epic=3/legendary=1），`purchasedCount` 初始化为 0
   - 统一内存与 DB 的 `lastRefresh` 时间戳（BIZ-20）
   - 持久化到 `runtime_shopItems` 表
3. 调用 `mergeItems` 合并回购列表，更新 `currentItems`

### 关闭商店流程

1. 调用 `shopStore.closeShop()`
2. 持久化空商店 ID（`saveCurrentShopId(null)`）
3. 清空 `currentShopId` 和 `currentItems`
4. 发射 `SHOP_CLOSED` 事件

### 商品合并规则（mergeItems）

1. 回购物品排在最前面
2. 生成商品中排除已在回购列表的物品（避免重复）
3. 过滤掉库存为 0 的商品

### 回购机制

玩家出售的物品存放在 `soldItems` Map 中（`shopId → itemId → SoldItemEntry` 二级结构）：
- 同物品多次出售会合并数量
- 下次打开同一商店时合并到商品列表最前面
- 购买回购物品时从 Map 中扣减，扣完自动移除
- **BIZ-16**：回购列表持久化到 `runtime_shopSoldItems` 表，页面刷新后恢复
- **ARCH-14**：修改 `soldItems` 时通过 `_replaceSoldItems` 创建新 Map 实例整体替换，触发 Vue 响应式更新

### 价格体系

| 价格类型 | 计算公式 |
|----------|----------|
| 买入价 | `Math.round(item.value × RARITY_MULTIPLIER[rarity])` |
| 卖出价 | `Math.round(买入价 × 0.5)` |

稀有度倍率：common=1.0, uncommon=2.0, rare=5.0, epic=10.0, legendary=20.0

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| `config_shops` | `shopId` | `ShopConfig` | 商店配置（全局共享） |
| `runtime_shopItems` | `shopId` | `ShopItemsStorage` | 商店商品 + lastRefresh（BIZ-20） |
| `runtime_shopSoldItems` | `shopId` | `ShopSoldItemsStorage` | 商店回购列表（BIZ-16） |
| `gameState` | - | `{ currentShopId, lastPlayedAt }` | 当前打开的商店 ID（通过 `gameStateHelper`） |

### ShopConfig 存储内容（config_shops）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 商店唯一标识 |
| `name` | string | 商店名称 |
| `type` | ShopType | 商店类型 |
| `icon` | string | 商店图标 |
| `refreshInterval` | number | 商品刷新间隔（毫秒），0 表示不自动刷新 |

### ShopItemsStorage 存储内容（runtime_shopItems）

| 字段 | 类型 | 说明 |
|------|------|------|
| `shopId` | string | 商店 ID（主键） |
| `items` | ShopItem[] | 商品列表 |
| `lastRefresh` | number | 最后刷新时间戳（BIZ-20） |

### ShopSoldItemsStorage 存储内容（runtime_shopSoldItems）

| 字段 | 类型 | 说明 |
|------|------|------|
| `shopId` | string | 商店 ID（主键） |
| `soldItems` | SoldItemEntry[] | 回购物品列表（BIZ-16） |

### 多角色支持说明

商店配置（`config_shops`）、商品数据（`runtime_shopItems`）和回购列表（`runtime_shopSoldItems`）均为全局共享数据，不按角色隔离。当前打开的商店 ID 通过 `gameState` 持久化。

---

## 纯函数层 (service.ts)

| 名称 | 类型 | 功能 |
|------|------|------|
| `SHOP_TYPE_ITEM_TYPE_MAP` | 常量 | 商店类型 → 可售物品类型映射（`Record<ShopType, ItemType[]>`） |
| `calculatePrice(itemTemplate, isBuyPrice?)` | 纯函数 | 计算物品标准价格（买入价默认，`isBuyPrice=false` 返回卖出价 = 买入价 × 0.5） |
| `computeSellPrice(itemTemplate)` | 纯函数 | 计算物品出售价格（`calculatePrice(item, false)` 的语义化包装） |
| `canAffordItem(character, price)` | 纯函数 | 检查角色金币是否足够（`character.gold >= price`） |
| `generateShopItems(shopConfig, allItems)` | 纯函数 | 根据商店配置生成商品列表（6-12 件，库存 1-5，BIZ-21 限购） |

私有函数：`getRarityMultiplier(rarity)`（稀有度倍率）、`getMaxPurchaseCount(rarity)`（BIZ-21 购买次数上限）。

---

## DB 层方法 (ShopDbService)

### config_shops 表方法

| 方法 | 说明 |
|------|------|
| `saveShopConfig(config)` | 保存商店配置（`cloneShopConfig` 浅拷贝） |
| `getShopConfig(shopId)` | 获取单个商店配置 |
| `getAllShopConfigs()` | 获取全部商店配置 |
| `deleteShopConfig(shopId)` | 删除指定商店配置 |
| `clearAllShopConfigs()` | 清空全部商店配置 |

### runtime_shopItems 表方法

| 方法 | 说明 |
|------|------|
| `saveShopItems(shopId, items, lastRefresh?)` | 保存商品列表（`toRawData` 剥离 Proxy，BIZ-20 可选 lastRefresh） |
| `getShopItems(shopId)` | 获取商品列表（仅 items，不返回 null 时返回 null） |
| `getShopItemsStorage(shopId)` | 获取完整存储记录（含 lastRefresh，BIZ-20） |
| `getAllShopItemsStorage()` | 获取全部存储记录（init 恢复用，BIZ-20） |
| `deleteShopItems(shopId)` | 删除指定商店商品数据 |
| `clearAllShopItems()` | 清空全部商店商品数据 |

### runtime_shopSoldItems 表方法（BIZ-16）

| 方法 | 说明 |
|------|------|
| `saveSoldItems(shopId, soldItems)` | 保存回购列表 |
| `getSoldItems(shopId)` | 获取指定商店回购列表（不存在返回空数组） |
| `getAllSoldItems()` | 获取全部商店回购列表（init 恢复用） |
| `clearAllSoldItems()` | 清空全部商店回购列表 |

### gameState 方法

| 方法 | 说明 |
|------|------|
| `saveCurrentShopId(shopId)` | 持久化当前商店 ID（null 表示关闭，通过 `gameStateHelper`） |
| `getCurrentShopId()` | 获取上次保存的商店 ID（页面恢复用） |

私有辅助：`cloneShopConfig(config)`（浅拷贝商店配置）。

---

## 与其他模块的交互关系

### 依赖关系

- **事件总线**: `eventBus` + `GameEvents`（来自 `../bus`），发布 `SHOP_OPENED`、`SHOP_CLOSED`、`SHOP_TRANSACTION` 事件
- **角色模块**: `useCharacterStore()` 的 `spendGold`、`gainGold`、`getCharacterData`、`getCharacterId`
- **背包模块**: `useInventoryStore()` 的 `addItem`、`removeItem`、`getItemInfo`、`getAllItems`
- **日志模块**: `useLogStore()` 的 `addLogEntry`、`generateLogId()`
- **Toast 通知**: `useToast`（来自 `@/composables/useToast`）
- **配置数据**: `SHOPS` 常量（来自 `@/data/config_shops`，硬编码种子回退）
- **数据层**: `dbService.withRetry`（来自 `../data/core`）、`getGameState`/`saveGameState`（来自 `../data/gameStateHelper`）

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 角色模块 | 调用 | 购买时 `spendGold`、出售时 `gainGold`、查询 `getCharacterData/getCharacterId` |
| 背包模块 | 调用 | 购买时 `addItem`、出售时 `removeItem`、查询 `getItemInfo/getAllItems` |
| 探索模块 | 调用 | 探索中的【商店】打开商店（`openShop`） |
| 冒险日志模块 | 调用 | 记录交易事件 |
| 事件总线 | 发布 | 发布 `SHOP_OPENED/SHOP_CLOSED/SHOP_TRANSACTION` 事件 |
| Toast 通知 | 调用 | 购买次数上限、背包空间不足时提示 |

### 事件发布清单

| 事件 | 发射位置 | 载荷 |
|------|----------|------|
| `SHOP_OPENED` | `openShop` 成功后 | `{ shopId, characterId? }` |
| `SHOP_CLOSED` | `closeShop` 关闭后 | `{ shopId? }` |
| `SHOP_TRANSACTION` | `buyItem`/`sellItem` 完成后 | `{ shopId?, itemId, quantity?, totalPrice?, sellPrice? }` |

---

## 异常处理机制

### 异常类型与处理策略

| 异常类型 | 触发条件 | 处理策略 |
|----------|----------|----------|
| 存储读取失败 | IndexedDB 解析错误 | 使用默认值初始化，控制台输出错误日志 |
| 商店不存在 | 打开不存在的商店 | 控制台 warn，直接返回 |
| 商品不存在 | 购买不存在的商品 | 返回 false |
| 库存不足 | 购买数量超过库存 | 返回 false |
| 购买次数超限 | BIZ-21 超过 `maxPurchaseCount` | Toast 提示剩余次数，返回 false |
| 金币不足 | 购买金额超过余额 | 返回 false，金币不被扣除 |
| 背包已满 | `addItem` 返回值 < 期望数量 | 按比例返还金币（P2-1），Toast 提示，`added=0` 时返回 false |
| 物品无法出售 | 物品模板不存在或售价 ≤ 0 | 返回 false |
| 存储写入失败 | IndexedDB 写入异常 | `dbService.withRetry` 自动重试 |
| 种子配置写入失败 | `saveShopConfig` 异常 | `.catch()` 记录错误，不影响内存状态 |

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 商品缓存 | 商品数据持久化到 DB，打开时加载 | 减少重复生成 |
| 按需加载 | `loadOrGenerateItems` 懒加载商品，避免 init 阶段一次性加载 | 加快启动 |
| 纯函数计算 | 价格计算、商品生成均为无副作用纯函数 | 可测试、可复用 |
| 异步加载 | Store 初始化时异步从 IndexedDB 读取 | 不阻塞主线程 |
| Fisher-Yates 洗牌 | 商品随机选取使用均匀分布算法 | 避免分布偏差 |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 输入验证 | 所有操作进行边界检查和类型验证 |
| 交易原子性 | 先验证再扣金币，背包满时按比例返还金币（P2-1） |
| 数据序列化 | `toRawData()` 去除 Vue/Proxy 包装（`saveShopItems`/`saveSoldItems`） |
| 配置浅拷贝 | `cloneShopConfig` 防止共享引用（`saveShopConfig`） |
| 响应式替换 | `_replaceSoldItems` 整体替换 Map 触发响应式（ARCH-14） |
| 异常捕获 | 所有 IO 操作通过 `dbService.withRetry` 包裹 |
| 时间戳一致性 | 内存与 DB 的 `lastRefresh` 使用同一时间戳（BIZ-20） |

### 边界情况处理

| 边界情况 | 处理方式 |
|----------|----------|
| 购买时背包满 | 按未添加比例返还金币，部分成功继续流程 |
| 生成商品与回购物品 ID 冲突 | `mergeItems` 排除回购列表中已有的生成商品 |
| 页面刷新后刷新检查 | BIZ-20 从 DB 恢复 `lastRefresh`，避免刷新检查被跳过 |
| 页面刷新后回购列表丢失 | BIZ-16 持久化到 `runtime_shopSoldItems`，init 时恢复 |
| 购买时保留刷新计时器 | BIZ-20 购买操作保留原 `lastRefresh`，不重置计时器 |

---

## 模块文件结构

```
src/modules/shop/
  - index.ts          # 模块入口，统一导出
  - types.ts          # 类型定义（ShopConfig、ShopItem、ShopDisplayItem 等）
  - db.ts             # IndexedDB 数据库操作层（ShopDbService）
  - store.ts          # Pinia Store 状态管理（useShopStore）
  - service.ts        # 纯函数层（calculatePrice、computeSellPrice、canAffordItem、generateShopItems）
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | 模块入口，统一导出 types（`ShopConfig`/`ShopItem`/`ShopDisplayItem`/`SoldItemEntry`/`ShopItemsStorage`/`ShopSoldItemsStorage`）、`shopDbService` 和 `useShopStore` |
| `types.ts` | TypeScript 类型定义：`ShopType`、`ShopConfig`、`ShopItem`、`ShopDisplayItem`、`SoldItemEntry`，以及存储类型 `ShopItemsStorage`、`ShopSoldItemsStorage` |
| `db.ts` | IndexedDB 数据库操作层（`ShopDbService` 类 + `shopDbService` 单例），封装 `config_shops`、`runtime_shopItems`、`runtime_shopSoldItems` 表和 `gameState` 的读写，含私有 `cloneShopConfig` 辅助 |
| `store.ts` | Pinia Store 状态管理（`useShopStore`），编排业务逻辑，跨模块调用 character/inventory/log Store 和 eventBus，含内部 `_replaceSoldItems`/`mergeItems`/`loadShopConfigs`/`loadOrGenerateItems`/`regenerateItems` 辅助函数 |
| `service.ts` | 纯函数层 + 常量：`SHOP_TYPE_ITEM_TYPE_MAP`；纯函数 `calculatePrice`、`computeSellPrice`、`canAffordItem`、`generateShopItems`；私有 `getRarityMultiplier`、`getMaxPurchaseCount` |

---

## 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-15 | 初始版本,包含基础商店功能 | System |
| v1.1 | 2026-05-15 | 移除加密处理相关需求 | System |
| v1.2 | 2026-05-15 | 调整业务逻辑:商品每次访问随机刷新,价格固定来源于物品数据 | System |
| v2.0 | 2026-05-19 | 迁移到 Pinia + IndexedDB 架构，实现自动同步持久化 | System |
| v2.1 | 2026-05-20 | 拆分商店配置到独立存储（config_shops），数据库版本升级至3 | System |
| v2.2 | 2026-06-16 | 文件结构拆分为 db/store/service 三层架构 | System |
| v3.0 | 2026-06-16 | 全面对齐实际代码：更新 ShopConfig 字段（移除 locationId/npcId 等未实现字段）、添加 SoldItemEntry/ShopDisplayItem 定义、回购机制说明、ShopConfig 存储格式修正、纯函数层架构说明 | System |
| v4.0 | 2026-06-17 | 补充 IShopService 接口定义、ShopItemsStorage/ShopConfigStorage 存储类型，确保文档类型定义与代码 types.ts 完全一致 | System |
| v5.0 | 2026-07-10 | 严格依据源码重写：移除不存在的类型（PriceVariation/ItemCategory/ItemQuality/IShopService/ShopConfigStorage）；修正 ShopConfig 字段（移除 priceVariation）；补充 ShopType 联合类型；补充 ShopItem 的 maxPurchaseCount/purchasedCount（BIZ-21）；修正 SoldItemEntry/ShopDisplayItem 字段；补充 ShopSoldItemsStorage 类型和 runtime_shopSoldItems 表（BIZ-16）；重写 Store Action 接口（移除 selectShop/refreshItems 别名）；重写 service 函数签名；补充 BIZ-20/BIZ-21/ARCH-14/P2-1 机制说明；补充事件定义 | System |

---

**文档结束**
