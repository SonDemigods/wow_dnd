# 商店模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 商店模块设计文档 |
| 版本 | v3.0 |
| 生成日期 | 2026年6月16日 |
| 所属模块 | `modules/shop` |

---

## 模块概述与定位

### 模块定位

商店模块是游戏经济系统的核心组件，负责管理商品的随机刷新、购买和出售功能。采用"当前商店"模式（同一时间只打开一个商店），商品列表按 shopId 隔离存储。

### 核心职责

| 职责 | 描述 |
|------|------|
| 商店配置管理 | 管理不同类型商店的配置参数（从 `config_shops` 加载） |
| 商品随机刷新 | 根据商店类型从物品模板池中随机生成商品列表 |
| 商品购买 | 处理购买流程，包括金币验证、背包添加、库存扣减 |
| 商品出售 | 处理出售流程，包括物品移除、金币增加、回购列表追踪 |
| 商店刷新定时 | 支持按 refreshInterval 定时刷新商品 |
| 数据持久化 | 实现商店数据的本地存储与加载（`runtime_shopItems`） |

### 模块边界

**商店模块**与以下模块直接交互（全部通过 Store Action 调用）:
- 角色模块: 金币管理（`characterStore.spendGold/gainGold`）
- 背包模块: 物品管理（`inventoryStore.addItem/removeItem/getItemInfo`）
- 探索模块: 探索中的【商店】买卖货品（探索调用 `shopStore.openShop`）
- 冒险日志模块: 记录交易事件日志

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-SHOP-001 | 支持多种商店类型(general, potion, scroll, food, material) | 游戏设计 |
| FR-SHOP-002 | 商品每次打开商店时加载已保存商品，支持定时刷新 | 游戏机制 |
| FR-SHOP-003 | 商品价格基于物品基础价值和稀有度倍数计算 | 经济平衡 |
| FR-SHOP-004 | 商品库存管理，购买后减少对应库存 | 交易逻辑 |
| FR-SHOP-005 | 购买时验证金币是否充足 | 交易安全 |
| FR-SHOP-006 | 购买时检查背包容量 | 背包管理 |
| FR-SHOP-007 | 出售时计算物品回收价（买入价 × 稀有度折扣率） | 经济平衡 |
| FR-SHOP-008 | 出售时从背包移除物品 | 背包管理 |
| FR-SHOP-009 | 支持回购机制（玩家出售的物品可回购） | 游戏体验 |
| FR-SHOP-010 | 数据持久化存储 | 存档系统 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-SHOP-001 | 交易操作失败时回滚数据 | 高 |
| NFR-SHOP-002 | 单次交易响应时间 < 50ms | 高 |

---

## 接口定义

### Store Action 方法（对外暴露接口）

| 方法 | 说明 |
|------|------|
| `init()` | 初始化商店模块，加载商店配置 |
| `openShop(shopId)` | 打开指定商店（加载商品、检查刷新） |
| `buyItem(itemId, quantity?)` | 购买当前商店中的物品 |
| `sellItem(itemId, quantity?)` | 向当前商店出售物品 |
| `closeShop()` | 关闭当前商店 |
| `refreshShop()` | 刷新当前商店商品 |
| `getShopConfig(shopId)` | 获取商店配置 |
| `calculateSellPrice(itemId)` | 计算物品卖出价格（供 UI 预览） |
| `getSoldItemCount(itemId)` | 获取回购数量 |
| `reset()` | 重置所有商店数据 |

### 兼容旧接口别名

| 别名 | 实际方法 |
|------|----------|
| `selectShop(shopId)` | → `openShop(shopId)` |
| `refreshItems()` | → `refreshShop()` |

### 数据类型定义

```typescript
/** 价格变化范围 */
export interface PriceVariation {
  min: number;
  max: number;
}

/** 商店配置 */
export interface ShopConfig {
  id: string;
  name: string;
  type: string;
  icon: string;
  refreshInterval: number;
  priceVariation: PriceVariation;
}

/** 商店商品 */
export interface ShopItem {
  itemId: string;
  price: number;
  quantity: number;
}

/** 出售物品的回购跟踪条目 */
export interface SoldItemEntry {
  itemId: string;
  price: number;
  count: number;
}

/** 物品分类类型 */
export type ItemCategory = 'consumable' | 'weapon' | 'armor' | 'accessory' | 'material' | 'misc';

/** 物品品质类型（复用 ItemRarity） */
export type ItemQuality = ItemRarity;

/** 商店展示商品（合并 ShopItem 和物品详情） */
export interface ShopDisplayItem {
  id: string;
  itemId: string;
  name: string;
  type: ItemCategory;
  quality: ItemQuality;
  icon: string;
  description: string;
  price: number;
  quantity: number;
  category: ItemCategory;
  effect?: { type: string; value: number | Partial<Record<string, number>> };
}
```

### 商店类型与可售物品映射

| 商店类型 | 可售物品类型 |
|----------|-------------|
| `general` | potion, scroll, food, material |
| `potion` | potion |
| `scroll` | scroll |
| `food` | food |
| `material` | material |

---

## 业务逻辑流程

### 打开商店流程

1. 调用 `shopStore.openShop(shopId)`
2. 如果切换商店，清空旧商品列表
3. 确保商店配置已加载（DB 为空时回退到硬编码 `SHOPS` 种子数据）
4. 查找商店配置，不存在则返回
5. 调用 `loadOrGenerateItems()` 从 DB 加载已保存商品
6. 检查上次刷新时间，若超过 `refreshInterval` 则重新生成
7. 持久化当前商店ID到 `gameState`
8. 合并生成商品和回购物品列表 → 设置 `currentItems`
9. 发射 `SHOP_OPENED` 事件

### 购买物品流程

1. 调用 `shopStore.buyItem(itemId, quantity)`
2. 验证当前商店已打开、商品存在、库存充足
3. 计算总价 = 单价 × 数量
4. 检查角色金币是否充足（纯函数 `canAffordItem`）
5. 调用 `characterStore.spendGold(totalPrice)` 扣除金币
6. 调用 `inventoryStore.addItem(itemId, quantity)` 添加物品
7. 如果背包空间不足，返还金币并返回 false
8. 更新库存（回购列表或生成商品中扣减）
9. 发射 `SHOP_TRANSACTION` 事件 → 记录冒险日志

### 出售物品流程

1. 调用 `shopStore.sellItem(itemId, quantity)`
2. 验证当前商店已打开、物品模板存在
3. 调用纯函数 `calculatePrice(item, config, false)` 计算回收价
4. 调用 `inventoryStore.removeItem(itemId, quantity)` 从背包移除
5. 调用 `characterStore.gainGold(actualSellPrice)` 增加金币
6. 将出售物品加入回购列表 `soldItems`（按 shopId → itemId 组织）
7. 发射 `SHOP_TRANSACTION` 事件 → 记录冒险日志

### 商品刷新流程

1. 调用 `shopStore.refreshShop()` 或定时刷新
2. 调用纯函数 `generateShopItems(config, allTemplates)`：
   - 按商店类型过滤物品池
   - 随机选取最多 10 种物品
   - 计算购买价（`baseValue × rarityMultiplier`）
   - 生成随机库存（1-10）
3. 持久化到 `runtime_shopItems` 表
4. 合并回购列表，更新 `currentItems`

### 回购机制

玩家出售的物品存放在 `soldItems` Map 中（按 `shopId → itemId → SoldItemEntry` 组织），下次打开同一商店时合并到商品列表最前面。购买回购物品时从该 Map 中扣减，扣完自动移除。

### 价格体系

| 价格类型 | 计算公式 |
|----------|----------|
| 买入价 | `Math.floor(item.value × RARITY_PRICE_MULTIPLIER[rarity])` |
| 卖出价 | `Math.floor(买入价 × RARITY_SELL_DISCOUNT[rarity])` |

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| `config_shops` | `shopId` | ShopConfigStorage | 商店配置（全局共享） |
| `runtime_shopItems` | `shopId` | ShopItemsStorage | 商店商品（全局共享） |
| `gameState` | - | `{ currentShopId }` | 当前打开的商店ID |

### ShopConfigStorage 存储内容

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 商店唯一标识 |
| `name` | string | 商店名称 |
| `type` | string | 商店类型 |
| `icon` | string | 商店图标 |
| `refreshInterval` | number | 商品刷新间隔（毫秒） |
| `priceVariation` | { min, max } | 价格变化范围 |

### ShopItemsStorage 存储内容

| 字段 | 类型 | 说明 |
|------|------|------|
| `shopId` | string | 商店ID |
| `items` | { itemId, price, quantity }[] | 商品列表 |
| `lastRefresh` | number | 最后刷新时间戳 |

### 多角色支持说明

商店配置（`config_shops`）和商品数据（`runtime_shopItems`）为全局共享数据。回购列表 `soldItems` 在内存中维护，按商店ID组织。

---

## 与其他模块的交互关系

### 依赖关系

- **配置数据**: `SHOPS` 常量（硬编码回退）、`RARITY_PRICE_MULTIPLIER`、`RARITY_SELL_DISCOUNT`
- **物品模板**: 从 `inventoryStore.getAllItems()` 获取物品池

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 角色模块 | 调用 | 购买时 `spendGold`、出售时 `gainGold` |
| 背包模块 | 调用 | 购买时 `addItem`、出售时 `removeItem`、查询物品信息 `getItemInfo/getAllItems` |
| 探索模块 | 调用 | 探索中的【商店】打开商店（`openShop`） |
| 冒险日志模块 | 调用 | 记录交易事件 |

---

## 异常处理机制

### 异常类型与处理策略

| 异常类型 | 触发条件 | 处理策略 | 提示 |
|----------|----------|----------|------|
| 存储读取失败 | IndexedDB 解析错误 | 使用默认值初始化 | 控制台输出错误日志 |
| 商品不存在 | 购买不存在的商品 | 返回 false | - |
| 库存不足 | 购买数量超过库存 | 返回 false | - |
| 金币不足 | 购买金额超过余额 | 返回 false，金币不被扣除 | - |
| 背包已满 | 背包空间不足 | 返回 false，金币返还 | - |
| 物品无法出售 | 物品模板不存在 | 返回 false | - |
| 存储写入失败 | IndexedDB 写入异常 | 进入重试队列，指数退避重试 3 次 | - |

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 商品缓存 | 商品数据持久化到 DB，打开时加载 | 减少重复生成 |
| 纯函数计算 | 价格计算、商品生成均为无副作用纯函数 | 可测试、可复用 |
| 异步加载 | Store 初始化时异步从 IndexedDB 读取 | 不阻塞主线程 |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 输入验证 | 所有操作进行边界检查和类型验证 |
| 交易原子性 | 先验证再扣金币，失败时回滚金币 |
| 数据序列化 | `toRawData()` 去除 Vue/Proxy 包装 |
| 异常捕获 | 所有 IO 操作包裹 try-catch |
| 重试机制 | 失败时自动重试 3 次 |

---

## 模块文件结构

```
src/modules/shop/
  - index.ts          # 模块入口，统一导出
  - types.ts          # 类型定义（ShopConfig、ShopItem、SoldItemEntry 等）
  - db.ts             # IndexedDB 数据库操作层（config_shops、runtime_shopItems）
  - store.ts          # Pinia Store 状态管理（useShopStore）
  - service.ts        # 纯函数层（calculatePrice、canAffordItem、generateShopItems、getAvailableShops）
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | 模块入口、统一导出 |
| `types.ts` | TypeScript 类型定义：`ShopConfig`、`ShopItem`、`ShopDisplayItem`、`SoldItemEntry` 等 |
| `db.ts` | IndexedDB 数据库操作，封装 `config_shops` 和 `runtime_shopItems` 的读写 |
| `store.ts` | Pinia Store 状态管理（useShopStore），编排业务逻辑 |
| `service.ts` | 纯函数层：`calculatePrice`、`canAffordItem`、`generateShopItems`、`getAvailableShops` |

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

---

**文档结束**
