# 商店模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 商店模块设计文档 |
| 版本 | v2.0 |
| 生成日期 | 2026年5月19日 |
| 所属模块 | `modules/shop` |

---

## 模块概述与定位

### 模块定位

商店模块是游戏经济系统的核心组件,负责管理商品的随机刷新、购买和出售功能。该模块模仿《魔兽世界》的商店机制,为玩家提供与NPC商人交互的完整交易体验。

### 核心职责

| 职责 | 描述 |
|------|------|
| 商店配置管理 | 管理不同类型商店的配置参数 |
| 商品随机刷新 | 根据配置随机生成商品列表 |
| 商品购买 | 处理购买流程,包括货币验证、库存检查、背包添加 |
| 商品出售 | 处理出售流程,包括物品识别、价值评估、货币增加 |
| 交易记录 | 记录购买和出售历史 |
| 数据持久化 | 实现商店数据的本地存储与加载 |

### 模块边界

**商店模块**与以下模块交互:
- 角色模块:金币管理
- 背包模块:物品管理
- NPC模块:商店入口

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-SHOP-001 | 支持多种商店类型(武器、护甲、药水、材料等) | 游戏设计 |
| FR-SHOP-002 | 商品每次访问随机刷新可购买物品列表 | 魔兽世界机制 |
| FR-SHOP-003 | 商品价格固定,来源于物品数据 | 经济平衡 |
| FR-SHOP-004 | 商品库存管理,购买后减少库存 | 交易逻辑 |
| FR-SHOP-005 | 购买时验证金币是否充足 | 交易安全 |
| FR-SHOP-006 | 购买时检查背包容量 | 背包管理 |
| FR-SHOP-007 | 出售时计算物品价值(低于购买价) | 经济平衡 |
| FR-SHOP-008 | 出售时从背包移除物品 | 背包管理 |
| FR-SHOP-009 | 商店每次访问自动刷新商品 | 游戏体验 |
| FR-SHOP-010 | 交易记录保存 | 审计追踪 |
| FR-SHOP-011 | 数据持久化存储 | 存档系统 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-SHOP-001 | 交易操作失败时回滚数据 | 高 |
| NFR-SHOP-002 | 单次交易响应时间 < 50ms | 高 |
| NFR-SHOP-003 | 支持并发交易操作 | 中 |

---

## 接口定义

### 服务接口 IShopService

```typescript
export interface IShopService {
  // === 商店操作 ===
  openShop(shopId: string, npcId: string): boolean;
  closeShop(): void;
  refreshShop(shopId: string): boolean;
  
  // === 交易操作 ===
  purchaseItem(request: PurchaseRequest): boolean;
  sellItem(request: SellRequest): boolean;
  
  // === 查询操作 ===
  getShopItems(shopId: string): ShopItem[];
  getAvailableShops(locationId: string): ShopConfig[];
  getPurchaseHistory(shopId: string): ShopTransaction[];
  isShopOpen(): boolean;
  getCurrentShopId(): string | null;
  getShopConfig(shopId: string): ShopConfig | null;
  canAfford(price: number, quantity: number): boolean;
  canSell(itemId: string): boolean;
  
  // === 系统操作 ===
  reset(): void;
}
```

### 数据类型定义

```typescript
export type ShopItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type ShopType = 'general' | 'weapons' | 'armor' | 'potions' | 'scrolls' | 'materials' | 'faction';
export type ShopItemStatus = 'available' | 'limited' | 'out_of_stock';

export interface ShopItem {
  id: string;
  itemTemplate: string;
  name: string;
  icon: string;
  type: string;
  rarity: ShopItemRarity;
  description: string;
  basePrice: number;
  currentPrice: number;
  stock: number;
  maxStock: number;
  status: ShopItemStatus;
  canSell: boolean;
  sellPrice: number;
  levelRequirement?: number;
  factionRequirement?: string;
}

export interface ShopConfig {
  id: string;
  name: string;
  type: ShopType;
  icon: string;
  locationId: string;
  npcId: string;
  refreshInterval: number;
  minItems: number;
  maxItems: number;
  priceVariation: { min: number; max: number };
  stockVariation: { min: number; max: number };
}

export interface ShopTransaction {
  id: string;
  type: 'buy' | 'sell';
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
  total: number;
  timestamp: number;
  shopId: string;
}
```

### 事件定义

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `SHOP_PURCHASED` | 购买商品成功时 | `ShopItemPurchasedEvent` |
| `SHOP_SOLD` | 出售商品成功时 | `ShopItemSoldEvent` |
| `SHOP_REFRESHED` | 商店刷新完成时 | `ShopRefreshedEvent` |
| `SHOP_NOTIFICATION` | 交易状态变化时 | 提示消息 |

---

## 业务逻辑流程

### 商品购买流程

1. 调用 `purchaseItem(itemId, quantity)` 方法
2. 检查商店是否已打开
3. 检查商品是否存在
4. 检查库存是否充足
5. 检查金币是否充足
6. 检查背包是否有空间
7. 添加物品到背包
8. 扣除金币
9. 减少商品库存
10. 记录交易
11. 触发购买事件

### 商品出售流程

1. 调用 `sellItem(itemId, slot, quantity)` 方法
2. 检查商店是否已打开
3. 检查物品是否存在
4. 检查物品是否可出售
5. 计算出售价格
6. 从背包移除物品
7. 增加金币
8. 记录交易
9. 触发出售事件

### 商店刷新流程

1. 调用 `refreshShop(shopId)` 方法
2. 获取商店配置
3. 从商品池随机选择商品
4. 从物品数据获取固定价格
5. 计算随机库存
6. 保存商品列表
7. 记录刷新时间
8. 触发刷新事件

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| shop | 'shop' | ShopData | 商店完整数据 |

### ShopData 存储内容

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | string | 'shop' | 唯一标识 |
| `shopItems` | Record<string, ShopItem[]> | {} | 各商店的商品列表 |
| `lastRefresh` | Record<string, number> | {} | 各商店最后刷新时间戳 |
| `purchaseHistory` | ShopTransaction[] | [] | 交易历史记录(最多50条) |
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

- **事件总线**:发布交易事件
- **角色模块**:金币管理
- **背包模块**:物品管理

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 角色模块 | 调用 | 购买时调用 `spendGold`,出售时调用 `addGold` |
| 背包模块 | 调用 | 购买时调用 `addItem`,出售时调用 `removeItem` |
| NPC模块 | 事件订阅 | 通过NPC打开商店 |
| 事件总线 | 发布/订阅 | 发布交易事件,供UI组件监听 |

---

## 异常处理机制

### 异常类型与处理策略

| 异常类型 | 触发条件 | 处理策略 | 错误提示 |
|----------|----------|----------|----------|
| 存储读取失败 | IndexedDB 解析错误 | 使用默认值初始化 | 控制台输出错误日志 |
| 商店未打开 | 交易时商店未打开 | 返回 false | "商店未打开" |
| 商品不存在 | 购买不存在的商品 | 返回 false | "商品不存在" |
| 库存不足 | 购买数量超过库存 | 返回 false | "库存不足" |
| 金币不足 | 购买金额超过余额 | 返回 false | "金币不足" |
| 背包已满 | 背包空间不足 | 返回 false | "背包已满" |
| 物品无法出售 | 出售不可交易物品 | 返回 false | "该物品无法出售" |
| 存储写入失败 | IndexedDB 写入异常 | 进入重试队列，指数退避重试 3 次 | "数据同步失败" |

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 商品数据缓存 | 内存缓存商品列表 | 减少重复计算 |
| 防抖同步 | 500ms 延迟合并写入 | 减少 IO 操作 |
| 批量写入 | SyncEngine 批量处理 | 提升性能 |
| 历史记录限制 | 交易记录最多保存50条 | 控制存储大小 |
| 定时刷新检查 | 每分钟检查一次是否需要刷新 | 避免频繁刷新 |
| 异步加载 | Store 初始化时异步从 IndexedDB 读取 | 不阻塞主线程 |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 输入验证 | 所有数值操作进行边界检查 |
| 数据隔离 | 使用独立对象存储 |
| 异常捕获 | 所有IO操作包裹 try-catch |
| 原子操作 | 交易过程中先验证后执行 |
| 防重复购买 | 每次购买前重新验证库存和金币 |
| 重试机制 | 失败时自动重试 3 次 |
| 数据校验 | 写入前验证数据结构 |

---

## 模块文件结构

```
src/modules/shop/
  - index.ts          # 核心实现（Store + Service）
  - types.ts          # 类型定义
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | Pinia Store 实现、服务接口实现、数据持久化逻辑、随机算法 |
| `types.ts` | TypeScript 类型定义、接口定义、事件类型定义 |

---

## 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-15 | 初始版本,包含基础商店功能 | System |
| v1.1 | 2026-05-15 | 移除加密处理相关需求 | System |
| v1.2 | 2026-05-15 | 调整业务逻辑:商品每次访问随机刷新,价格固定来源于物品数据 | System |
| v2.0 | 2026-05-19 | 迁移到 Pinia + IndexedDB 架构，实现自动同步持久化 | System |

---

**文档结束**
