# 装备模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 装备模块设计文档 |
| 版本 | v3.0 |
| 生成日期 | 2026年6月16日 |
| 所属模块 | `modules/equipment` |

---

## 模块概述与定位

### 模块定位

装备模块负责管理玩家装备的穿戴和属性计算。它提供装备槽位管理、装备类型校验、属性加成计算等核心功能。

### 核心职责

| 职责 | 描述 |
|------|------|
| 装备穿戴 | 装备物品到指定槽位，验证装备类型匹配 |
| 装备卸下 | 从槽位卸下装备，自动放回背包 |
| 属性计算 | 通过 `computed` 计算装备总属性加成 |
| 属性同步 | 装备变更时调用 `characterStore.applyBonus()/removeBonus()` 同步至角色模块 |
| 稀有度管理 | 管理装备稀有度，提供稀有度查询和颜色显示 |
| 数据持久化 | 装备数据的本地存储 |

### 装备槽位配置

| 槽位编号 | 槽位名称 | 类型 | 说明 |
|----------|----------|------|------|
| 1 | `weapon1` | 武器 | 主手武器槽 |
| 2 | `weapon2` | 武器 | 副手武器槽 |
| 3 | `armor1` | 护甲 | 头部 |
| 4 | `armor2` | 护甲 | 胸部 |
| 5 | `armor3` | 护甲 | 腿部 |
| 6 | `armor4` | 护甲 | 鞋子 |

**说明**：武器可适配 `weapon1` 和 `weapon2`，护甲可适配 `armor1`-`armor4`。具体由 `EquipmentItem.slots` 数组决定每个装备可装备到哪些槽位。

### 跨模块通信机制

装备模块遵循"直接 Store Action 调用"模式：

- **装备模块 → 角色模块**：`equipItem()` 和 `unequipItem()` 中直接调用 `characterStore.applyBonus(newBonus)` / `characterStore.removeBonus(oldBonus)` 同步属性
- **装备模块 → 背包模块**：`equipItem()` 和 `unequipItem()` 中直接调用 `inventoryStore.addItem()` 放回旧装备/卸下装备
- **事件总线**：装备模块不再通过 EventBus 发布数据变更事件

### 模块边界

**装备模块**与以下模块交互:
- 角色模块：应用/移除装备属性加成
- 背包模块：装备来源和卸下后放回

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-EQUIP-001 | 支持装备穿戴 | 核心功能 |
| FR-EQUIP-002 | 支持装备卸下 | 核心功能 |
| FR-EQUIP-003 | 支持属性加成计算 | 核心功能 |
| FR-EQUIP-004 | 支持6个装备栏位(2武器+4护甲) | 槽位管理 |
| FR-EQUIP-005 | 装备类型与槽位匹配（items.slots 决定可装备槽位） | 类型校验 |
| FR-EQUIP-006 | 装备属性需计算至角色模块（直接调用 characterStore Action） | 属性同步 |
| FR-EQUIP-007 | 数据持久化存储 | 存档系统 |
| FR-EQUIP-008 | 支持装备稀有度定义（普通、优秀、稀有、史诗、传说） | 稀有度系统 |
| FR-EQUIP-008-1 | 不同稀有度装备显示不同颜色 | 稀有度系统 |
| FR-EQUIP-009 | 装备等级要求检查 | 等级限制 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-EQUIP-001 | 属性计算性能 | 高 |

---

## 接口定义

### 服务接口 IEquipmentService

```typescript
export interface IEquipmentService {
  equipItem(slot: EquipmentSlot, item: EquipmentItem): Promise<boolean>;
  unequipItem(slot: EquipmentSlot): Promise<EquippedItem | null>;
  getEquipment(): Record<EquipmentSlot, EquippedItem | null>;
  getEquippedItem(slot: EquipmentSlot): EquippedItem | null;
  getTotalStats(): Stats;
  canEquip(item: EquipmentItem, slot?: EquipmentSlot): boolean;
  getSlotType(slot: EquipmentSlot): 'weapon' | 'armor';
  syncStatsToCharacter(): void;
  reset(): void;
  
  // 稀有度相关
  getRarityConfig(rarity: ItemRarity): RarityConfig;
  getRarityColor(rarity: ItemRarity): string;
}
```

### 数据类型定义

```typescript
import type { Item, ItemRarity, RarityConfig } from '../inventory/types';
import type { Stats } from '../character/types';

/** 物品稀有度类型（从 inventory 模块导入） */
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** 稀有度配置（从 @/config/inventory 的 RARITY_CONFIG 获取） */
export interface RarityConfig {
  name: string;
  color: string;
}

/** 稀有度配置表 */
export const RARITY_CONFIG: Record<ItemRarity, RarityConfig> = {
  common: { name: '普通', color: '#ffffff' },
  uncommon: { name: '优秀', color: '#1eff00' },
  rare: { name: '稀有', color: '#0070dd' },
  epic: { name: '史诗', color: '#a335ee' },
  legendary: { name: '传说', color: '#ff8000' }
};

export type EquipmentSlot = 'weapon1' | 'weapon2' | 'armor1' | 'armor2' | 'armor3' | 'armor4';

export type EquipmentType = 'weapon' | 'armor';

/** 装备物品（继承 Item 基础类型，扩展装备特有字段） */
export interface EquipmentItem extends Item {
  type: EquipmentType;
  /** 可装配的槽位列表（武器可适配 weapon1+weapon2，护甲可适配 armor1-armor4） */
  slots: EquipmentSlot[];
  bonus?: Partial<Stats>;
  rarity: ItemRarity;
  levelRequirement?: number;
}

/** 已装备物品（含装备时间） */
export interface EquippedItem {
  item: EquipmentItem;
  equippedAt: number;
}

/** 装备状态 */
export interface EquipmentState {
  equipment: Record<EquipmentSlot, EquippedItem | null>;
}
```

### 事件定义

装备模块在新架构中不再通过 EventBus 发布数据变更事件。属性同步通过直接调用 `characterStore.applyBonus()/removeBonus()` 完成，UI 更新通过 Vue 响应式系统驱动。

---

## 业务逻辑流程

### 装备穿戴流程

1. 调用 `validateSlot(item, slot)` 校验装备类型与槽位是否匹配（槽位类型一致且槽位在 `item.slots` 列表中）
2. 检查等级要求（`item.levelRequirement`）是否满足
3. 获取当前槽位旧装备，如果有：
   - 调用 `computeEquipBonus(oldItem)` 计算旧装备属性加成
   - 调用 `characterStore.removeBonus(oldBonus)` 移除旧属性
   - 调用 `inventoryStore.addItem()` 将旧装备放回背包
4. 装备新物品到槽位
5. 调用 `computeEquipBonus(item)` 计算新装备属性加成
6. 调用 `characterStore.applyBonus(newBonus)` 应用新属性
7. 持久化到 IndexedDB
8. 记录冒险日志

### 装备卸下流程

1. 检查槽位是否有装备
2. 调用 `computeEquipBonus(item)` 计算装备属性加成
3. 调用 `characterStore.removeBonus(bonus)` 移除属性
4. 清空槽位
5. 持久化到 IndexedDB
6. 调用 `inventoryStore.addItem()` 将卸下装备放回背包
7. 记录冒险日志

### 属性计算与同步流程

1. `totalStats` 通过 `computed` 缓存，遍历所有已装备物品累加 `item.bonus`
2. 属性同步通过直接调用 `characterStore.applyBonus()` / `characterStore.removeBonus()` 实时完成
3. 角色模块的 `effectiveStats = computeEffectiveStats(baseStats, bonusStats)` 汇总所有加成

---

## 稀有度系统设计

### 稀有度等级定义

| 稀有度 | 英文名 | 中文名 | 颜色代码 | 说明 |
|--------|--------|--------|----------|------|
| 普通 | common | 普通 | #ffffff | 基础装备 |
| 优秀 | uncommon | 优秀 | #1eff00 | 绿色装备 |
| 稀有 | rare | 稀有 | #0070dd | 蓝色装备 |
| 史诗 | epic | 史诗 | #a335ee | 紫色装备 |
| 传说 | legendary | 传说 | #ff8000 | 橙色装备 |

> 注：稀有度配置定义在 `src/config/inventory.ts` 的 `RARITY_CONFIG` 中，装备模块通过 `import { RARITY_CONFIG } from '../../config/inventory'` 引用。旧版 `RARITY_CONFIG` 中的 `multiplier` 字段已移除（属性倍率不再通过稀有度放大），稀有度仅影响颜色显示。

### 稀有度颜色显示规则

1. **装备名称颜色**：根据稀有度显示对应颜色
2. **装备槽位边框**：已装备槽位显示装备稀有度对应的边框颜色
3. **属性数值颜色**：属性加成数值使用稀有度颜色显示
4. **提示框边框**：装备详情提示框边框使用稀有度颜色

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| char_equipment | `characterId` | EquipmentDataStorage | 装备完整数据（按角色隔离） |
| config_equipmentItems | `id` | EquipmentTemplateStorage | 装备模板数据 |

### EquipmentDataStorage 存储内容

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `characterId` | string | - | 角色唯一标识 |
| `equipment` | Record<EquipmentSlot, EquippedItem \| null> | 6个null槽位 | 各槽位装备数据 |
| `updatedAt` | number | Date.now() | 最后更新时间 |

### 多角色支持说明

装备数据通过 `characterId` 字段实现角色隔离，每个角色拥有独立的装备配置。切换角色时，系统自动加载对应角色的装备数据。删除角色时，级联删除该角色的装备数据。

### 同步机制

| 同步类型 | 触发条件 | 延迟 |
|----------|----------|------|
| 自动同步 | Action 完成后 | 即时持久化 |
| 页面卸载 | beforeunload | 即时 |

### Service 层纯函数

| 函数名 | 功能 |
|--------|------|
| `validateSlot()` | 校验装备是否适配指定槽位（类型匹配 + 槽位在 slots 列表中） |
| `isSlotOccupied()` | 检查指定槽位是否已被占用 |
| `computeEquipBonus()` | 计算装备提供的属性加成（返回 bonus 副本） |
| `canEquipItem()` | 检查物品是否可以装备到当前装备状态中 |
| `getEquipmentBySlot()` | 获取指定槽位的装备 |

---

## 与其他模块的交互关系

### 依赖关系

- **角色模块**：通过 `useCharacterStore()` 直接调用 `applyBonus()` / `removeBonus()` 同步属性
- **背包模块**：通过 `useInventoryStore()` 直接调用 `addItem()` 放回旧装备
- **稀有度配置**：从 `@/config/inventory` 的 `RARITY_CONFIG` 获取

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 角色模块 | 直接 Action 调用 | `applyBonus(stats)` 应用属性，`removeBonus(stats)` 移除属性 |
| 背包模块 | 直接 Action 调用 | `addItem()` 将卸下/替换的装备放回背包 |
| 日志模块 | 直接 Action 调用 | 记录装备/卸下操作的冒险日志 |

---

## 异常处理机制

### 异常类型与处理策略

| 异常类型 | 触发条件 | 处理策略 |
|----------|----------|----------|
| 物品不可装备 | 物品类型不是装备 | 返回 false |
| 等级不足 | 玩家等级低于要求 | 返回 false |
| 槽位类型不匹配 | 装备类型与槽位类型不一致（`SLOT_TYPES[slot] !== item.type`） | 返回 false |
| 槽位不在 slots 列表中 | 装备的 `slots` 不包含目标槽位 | 返回 false |
| 槽位冲突 | 槽位已有装备 | 自动卸下旧装备并放回背包 |
| 所有兼容槽位已占用 | `canEquipItem()` 检测 | 返回 `{ canEquip: false }` |

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 属性计算缓存 | 使用 `computed` 缓存 `totalStats` | 避免重复计算 |
| 即时持久化 | Action 完成后异步写 DB | 数据安全 |
| 异步加载 | Store `initialize` 时异步从 IndexedDB 读取 | 不阻塞主线程 |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 输入验证 | `validateSlot` 检查物品数据有效性和槽位类型匹配 |
| 数据隔离 | 按 `characterId` 隔离存储 |
| 异常捕获 | `dbService.withRetry` 含重试机制 |
| 数据校验 | 写入前通过 `toRawData()` 处理数据 |

---

## 模块文件结构

```
src/modules/equipment/
  - index.ts          # 模块入口，统一导出接口
  - types.ts          # 类型定义
  - db.ts             # 数据库操作层（EquipmentDbService）
  - store.ts          # Pinia Store 状态管理（useEquipmentStore）
  - service.ts        # 纯函数服务层（validateSlot, computeEquipBonus, canEquipItem 等）
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | 模块入口，统一导出 types、db、service 纯函数和 useEquipmentStore |
| `types.ts` | TypeScript 类型定义（EquipmentSlot、EquipmentItem、EquippedItem 等） |
| `db.ts` | IndexedDB 数据库操作层，封装 `char_equipment` 和 `config_equipmentItems` 表读写（EquipmentDbService 类） |
| `store.ts` | Pinia Store 状态管理，响应式数据维护。装备变更时通过 `computed` 计算 `totalStats`，并通过直接调用 `characterStore.applyBonus()/removeBonus()` 同步属性 |
| `service.ts` | 纯函数服务层，提供 `validateSlot`、`isSlotOccupied`、`computeEquipBonus`、`canEquipItem`、`getEquipmentBySlot` |

---

## 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-15 | 初始版本，包含基础装备功能 | System |
| v1.1 | 2026-05-18 | 调整为6个装备栏(2武器+4防具)，添加装备类型校验，移除加密需求 | System |
| v2.0 | 2026-05-19 | 迁移到 Pinia + IndexedDB 架构，实现自动同步持久化 | System |
| v2.1 | 2026-05-19 | 添加装备稀有度系统：5个稀有度等级、颜色显示、属性加成倍率 | System |
| v2.2 | 2026-06-16 | 文件结构拆分为db/store/service三层架构 | System |
| v3.0 | 2026-06-16 | 全面更新与代码对齐：移除 RARITY_CONFIG 中的 multiplier（稀有度不再影响属性倍率）；跨模块通信改为直接 Store Action 调用（装备变更直接调用 characterStore.applyBonus/removeBonus 同步属性，卸下装备直接调用 inventoryStore.addItem 放回背包）；新增 service 层纯函数（validateSlot, computeEquipBonus, canEquipItem, getEquipmentBySlot）；稀有度配置统一从 @/config/inventory 引用 | System |

---

**文档结束**
