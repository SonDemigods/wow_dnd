# 装备模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 装备模块设计文档 |
| 版本 | v4.3 |
| 生成日期 | 2026年8月3日 |
| 所属模块 | `modules/equipment` |
| 更新说明 | 严格对齐源码：更新回调注入接口（`setInventoryCallbacks` 新增 `flushPersistCallback` 第三参数，DB-1/DB-2 修复）；新增 item-template 聚合层章节（`UnifiedItemTemplateCache` 合并 `config_items` 与 `config_equipmentItems`，消除 inventory↔equipment 双向依赖 A1/G1/ARCH-1）；修正 `char_equipment` 表类型标注（`Table<EquipmentStorage, string>`）；补充 Store 新增状态 `persistError`；标注 `equipmentTemplates` 改 `shallowRef`（P3-144）与 store.ts 约 871 行未拆分待办（P3-155）；修正 `doUnequip`/`equipItem`/`unequipItem` 失败回滚流程（P2-55/DB-1/DB-2）；修正数据安全表中 `toRawData` 描述（装备模块未使用，改用可选字段默认值）；补充职业专属装备（`CLASS_EQUIPMENT`）与套装配置持久化表（`config_class_equipment`/`config_set_definitions`，DATA-4）；`SLOT_CONFIG` 移入 service.ts（P3-101） |

---

## 模块概述与定位

### 模块定位

装备模块负责管理玩家装备的穿戴和属性计算。它提供装备槽位管理、装备类型校验、属性加成计算、套装系统等核心功能，并通过回调注入机制与背包模块解耦。

### 核心职责

| 职责 | 描述 |
|------|------|
| 装备穿戴 | 装备物品到指定槽位，验证装备类型、等级、职业限制匹配 |
| 装备卸下 | 从槽位卸下装备，通过回调放回背包 |
| 属性计算 | 通过 `computed` 计算装备总属性加成（`totalStats`） |
| 属性同步 | 装备变更时调用 `characterStore.applyBonus()/removeBonus()` 同步至角色模块 |
| 套装系统 | 统计套装件数，计算激活的套装奖励并同步到角色属性（Phase 5.3 / BIZ-13） |
| 职业限制 | 校验装备的 `classRestriction` 是否允许当前职业装备（Phase 5.3） |
| 模板管理 | 装备模板的内存缓存与 DB 增删（`addEquipmentTemplate`/`removeEquipmentTemplate`） |
| 数据持久化 | 装备数据的本地存储（仅存 ID 映射 + 模板分离） |
| 回调解耦 | 通过 `setInventoryCallbacks` 注入背包操作回调，消除 equipment → inventory 静态依赖（A1/G1） |

### 装备槽位配置

| 槽位 | 槽位名称 | 类型 | 图标 | 说明 |
|------|----------|------|------|------|
| `weapon1` | 主手 | weapon | `game-icons:broadsword` | 主手武器槽 |
| `weapon2` | 副手 | weapon | `game-icons:checked-shield` | 副手武器槽（盾牌等副手装备也可放入） |
| `armor1` | 头部 | armor | `game-icons:visored-helm` | 护甲槽1 |
| `armor2` | 胸部 | armor | `game-icons:chest-armor` | 护甲槽2 |
| `armor3` | 腿部 | armor | `game-icons:leg-armor` | 护甲槽3 |
| `armor4` | 鞋子 | armor | `game-icons:leather-boot` | 护甲槽4 |

**说明**：武器可适配 `weapon1` 和 `weapon2`，护甲可适配 `armor1`-`armor4`。具体由 `EquipmentItem.slots` 数组决定每个装备可装备到哪些槽位。槽位类型通过命名前缀 `weapon*` / `armor*` 推导（`getSlotType`）。

### 跨模块通信机制

装备模块遵循"直接 Store Action 调用 + 回调注入"模式：

- **装备模块 → 角色模块**：`equipItem()` / `unequipItem()` / `reapplySetBonuses()` 中直接调用 `characterStore.applyBonus()` / `characterStore.removeBonus()` 同步属性
- **装备模块 → 背包模块**：通过 `setInventoryCallbacks` 注入的回调操作背包（A1/G1 修复，消除 equipment → inventory 静态依赖）
  - `inventoryAddItemCallback`：卸下装备时放回背包
  - `inventoryRemoveItemCallback`：装备物品时从背包移除
  - `inventoryFlushPersistCallback`（DB-1/DB-2 修复）：装备持久化失败回滚时等待背包持久化完成，避免 `addItem`/`removeItem` 内部 fire-and-forget 的 `persistInventory` 并发竞态
- **装备模块 → 日志模块**：直接调用 `useLogStore().addLogEntry()` 记录装备/卸下操作的冒险日志
- **装备模块 → item-template 聚合层**：装备模板查询被 `itemTemplateDbService.getAllEquipmentTemplates()` 委托复用，聚合层将装备模板与普通物品模板合并为统一 `Item` 格式（A1/G1/ARCH-1）
- **事件总线**：装备模块不通过 EventBus 发布任何事件（属性同步通过直接调用 characterStore 完成，UI 更新通过 Vue 响应式系统驱动）

### 模块边界

**装备模块**与以下模块交互：

- **角色模块**：应用/移除装备属性加成和套装奖励
- **背包模块**：装备来源和卸下后放回（通过回调注入，非直接 import）
- **日志模块**：记录装备/卸下操作的冒险日志
- **套装配置**：从 `@/data/config_set_definitions` 的 `SET_DEFINITIONS` 获取套装定义
- **职业专属装备配置**：从 `@/data/config_class_equipment` 的 `CLASS_EQUIPMENT` 获取职业专属装备（含 `classRestriction`/`setId`）
- **item-template 聚合层**：聚合 `config_items` 与 `config_equipmentItems` 两表查询，装备模板经 `UnifiedItemTemplateCache` 以统一 `Item` 格式供背包等模块访问，消除 inventory↔equipment 双向循环依赖（A1/G1/ARCH-1）

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-EQUIP-001 | 支持装备穿戴（含槽位/等级/职业校验） | 核心功能 |
| FR-EQUIP-002 | 支持装备卸下（通过回调放回背包） | 核心功能 |
| FR-EQUIP-003 | 支持属性加成计算（`totalStats` computed） | 核心功能 |
| FR-EQUIP-004 | 支持 7 个装备栏位（2 武器 + 5 护甲） | 槽位管理 |
| FR-EQUIP-005 | 装备类型与槽位匹配（`validateSlot` 双重校验：类型 + slots 列表） | 类型校验 |
| FR-EQUIP-006 | 装备属性需计算至角色模块（直接调用 `characterStore` Action） | 属性同步 |
| FR-EQUIP-007 | 数据持久化存储（`char_equipment` + `config_equipmentItems` 双表） | 存档系统 |
| FR-EQUIP-008 | 支持装备稀有度（继承自 `Item.rarity`，5 种等级） | 稀有度系统 |
| FR-EQUIP-009 | 装备等级要求检查（`levelRequirement`） | 等级限制 |
| FR-EQUIP-010 | 支持职业限制校验（`classRestriction`，Phase 5.3） | 职业系统 |
| FR-EQUIP-011 | 支持套装系统（`setId` + `ItemSet` + `SetBonus`，Phase 5.3） | 套装系统 |
| FR-EQUIP-012 | 套装奖励自动应用/移除（BIZ-13：`reapplySetBonuses`） | 套装系统 |
| FR-EQUIP-013 | 支持装备模板管理（新增/删除，同步缓存与 DB） | 管理后台 |
| FR-EQUIP-014 | 装备/卸下操作通过回调注入与背包解耦（A1/G1） | 架构解耦 |
| FR-EQUIP-015 | 装备持久化失败回滚（DB-1/DB-2：persist 失败回滚装备与背包状态并等待 `flushPersist`） | 数据一致性 |
| FR-EQUIP-016 | 装备模板经 item-template 聚合层统一查询（A1/G1/ARCH-1：`UnifiedItemTemplateCache` 合并 `config_items` 与 `config_equipmentItems`） | 架构解耦 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-EQUIP-001 | 属性计算性能（`computed` 缓存 `totalStats`） | 高 |
| NFR-EQUIP-002 | 数据规范化（`char_equipment` 仅存 ID 映射） | 中 |
| NFR-EQUIP-003 | 装备失败回滚（`equipItem` 异常时放回背包） | 高 |

---

## 模块文件结构

```
src/modules/equipment/
  ├── index.ts          # 模块统一导出入口（类型、DbService、Store、回调注入函数）
  ├── types.ts          # TypeScript 类型定义（EquipmentSlot、EquipmentItem、ItemSet 等）
  ├── db.ts             # 数据库操作层（EquipmentDbService 类）
  ├── store.ts          # Pinia Store 状态管理（useEquipmentStore + 回调注入）
  └── service.ts        # 纯函数服务层（槽位校验、属性计算、套装统计等）
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | 模块入口，统一导出 types（11 项）、`EquipmentDbService` 类与 `equipmentDbService` 实例、`useEquipmentStore`、`setInventoryCallbacks`、`clearInventoryCallbacks` |
| `types.ts` | TypeScript 类型定义（`EquipmentSlot`、`EquipmentType`、`EquipmentItem`、`SetBonus`、`SetBonusEffect`、`ItemSet`、`EquippedItem`、`EquipmentState`、`EquipmentDataStorage`、`EquipmentTemplateStorage`、`EquipmentStorage`） |
| `db.ts` | IndexedDB 数据库操作层，封装 `char_equipment` 和 `config_equipmentItems` 两表读写（`EquipmentDbService` 类，全局单例 `equipmentDbService`） |
| `store.ts` | Pinia Store（`defineStore('equipment')`），装备状态唯一持有者，编排 Service 纯函数 → 更新状态 → 同步角色属性 → 持久化 → 记录日志；含回调注入机制（A1/G1）和套装奖励重新应用逻辑（BIZ-13）。约 871 行，P3-155 待办项：大型 Store 未拆分 composable（参考 combat 模块拆分模式） |
| `service.ts` | 纯函数服务层（无状态、无副作用），负责槽位校验、属性计算、可装备性检查、套装统计等核心业务逻辑；同时定义 `SLOT_CONFIG` 槽位 UI 配置（P3-101 修复：与 `ALL_EQUIPMENT_SLOTS` 统一收口到此文件） |

### 装备模板聚合层（item-template）

装备模块与背包模块之间由 `src/modules/item-template/` 聚合层解耦（A1/G1/ARCH-1 修复）：

```
src/modules/item-template/
  ├── index.ts          # 聚合层统一导出入口
  ├── types.ts          # 类型定义（从 ../inventory/types re-export，避免重复定义）
  ├── db.ts             # ItemTemplateDbService：聚合 config_items 与 config_equipmentItems 查询
  ├── service.ts        # 纯函数：convertEquipmentToItem / mergeItemTemplates
  └── cache.ts          # UnifiedItemTemplateCache：统一物品模板缓存（懒加载 + Promise 去重）
```

- **依赖方向**：item-template → inventory.db + equipment.db（单向，无运行时循环），直接引用子模块 `db.ts` 而非公共入口，避免 `inventory/store → item-template → inventory/index → inventory/store` 循环
- **`ItemTemplateDbService`**：`getAllItemTemplates()` 委托 `inventoryDbService` 查询 `config_items` 表；`getAllEquipmentTemplates()` 委托 `equipmentDbService` 查询 `config_equipmentItems` 表（保留原始 `EquipmentItem` 格式）
- **`UnifiedItemTemplateCache`**：首次查询时并行加载两表并通过 `mergeItemTemplates` 合并为统一 `Map<string, Item>`（普通物品优先，装备仅在 ID 不冲突时插入）；提供 `getAll`/`getById`/`invalidate`，加载失败降级返回安全默认值；ARCH-1 后为系统内唯一物品模板缓存（原 `services/ItemTemplateCache` 已删除）

---

## 接口定义

### 装备模块入口导出（index.ts）

```typescript
// 类型导出
export type {
  EquipmentSlot,
  EquipmentType,
  EquipmentItem,
  SetBonus,
  SetBonusEffect,
  ItemSet,
  EquippedItem,
  EquipmentState,
  EquipmentDataStorage,
  EquipmentTemplateStorage,
  EquipmentStorage
} from './types';

// 数据层
export { EquipmentDbService, equipmentDbService } from './db';

// Store 与回调注入
export { useEquipmentStore, setInventoryCallbacks, clearInventoryCallbacks } from './store';
```

顶层导出（src/modules/index.ts）equipment 段与上述一致，另由 `useInventoryStore` 等统一入口按需引用。

### 数据类型定义（types.ts）

```typescript
import type { Item } from '../inventory/types';
import type { Stats } from '../character/types';

/** 装备槽位联合类型（6 个槽位） */
export type EquipmentSlot =
  | 'weapon1'   // 主手武器槽
  | 'weapon2'   // 副手武器槽
  | 'armor1'    // 护甲槽1（头部）
  | 'armor2'    // 护甲槽2（胸部）
  | 'armor3'    // 护甲槽3（腿部）
  | 'armor4';   // 护甲槽4（鞋子）

/** 装备类型枚举 */
export type EquipmentType = 'weapon' | 'armor';

/** 装备物品接口（继承 Item 基础类型，扩展装备特有字段） */
export interface EquipmentItem extends Item {
  type: EquipmentType;
  /** 可装配的槽位列表 */
  slots: EquipmentSlot[];
  bonus?: Partial<Stats>;
  levelRequirement?: number;
  /** 可装备的职业 ID 列表，未定义或空数组表示无职业限制（Phase 5.3） */
  classRestriction?: string[];
  /** 所属套装 ID，未定义表示不属于任何套装（Phase 5.3） */
  setId?: string;
}

// ===== 套装系统类型（Phase 5.3） =====

/** 套装奖励接口 */
export interface SetBonus {
  requiredPieces: number;
  bonus: SetBonusEffect;
}

/** 套装奖励效果接口 */
export interface SetBonusEffect {
  stat?: string;
  value?: number;
  effect?: string;
  description?: string;
}

/** 套装定义接口 */
export interface ItemSet {
  id: string;
  name: string;
  pieces: number;
  classRestriction?: string;
  setBonuses: SetBonus[];
}

/** 已装备物品接口（含装备时间戳） */
export interface EquippedItem {
  item: EquipmentItem;
  equippedAt: number;
}

/** 装备状态接口（存档用，存储完整 EquippedItem 对象） */
export interface EquipmentState {
  equipment: Record<EquipmentSlot, EquippedItem | null>;
}

/** 装备数据行存储接口（char_equipment 表实际写入形状，仅存装备 ID 映射） */
export interface EquipmentDataStorage {
  characterId: string;
  equipment: Record<EquipmentSlot, string | null>;
  updatedAt: number;
}

/** 装备模板存储接口（config_equipmentItems 表） */
export interface EquipmentTemplateStorage {
  id: string;
  name: string;
  type: string;
  rarity: string;
  icon: string;
  description: string;
  bonus: Record<string, number>;
  value: number;
  slots: EquipmentSlot[];
  levelRequirement: number | null;
  stackable: boolean;
  template: string;
  effect?: { type: string; value: number | Partial<Record<string, number>> } | null;
  consumable?: boolean;
}

/** 装备数据导出/导入格式（JSON 序列化友好，Dexie 表类型标注为 EquipmentStorage） */
export interface EquipmentStorage {
  characterId: string;
  equipment: Record<EquipmentSlot, string | null>;
  updatedAt?: number;
}
```

### 服务层纯函数（service.ts）

```typescript
/** 所有装备槽位列表（定义顺序即 UI 展示顺序） */
export const ALL_EQUIPMENT_SLOTS: EquipmentSlot[];

/** 槽位 UI 展示配置（名称和图标，P3-101 修复：统一收口到 service.ts 维护） */
export const SLOT_CONFIG: Record<EquipmentSlot, { name: string; icon: string }>;

/** 创建空槽位映射（泛型工厂函数） */
export function createEmptySlotMap<T>(defaultValue: T): Record<EquipmentSlot, T>;

/** 校验装备是否适配指定槽位（类型匹配 + 槽位在 slots 列表中） */
export function validateSlot(itemTemplate: EquipmentItem, slot: EquipmentSlot): boolean;

/** 计算装备提供的属性加成（返回 bonus 副本） */
export function computeEquipBonus(itemTemplate: EquipmentItem): Partial<Stats>;

/** 检查物品是否可以装备到当前装备状态中 */
export function canEquipItem(
  itemTemplate: EquipmentItem,
  equipment: Record<EquipmentSlot, EquippedItem | null>
): { canEquip: boolean; reason: string };

/** 获取指定槽位的装备 */
export function getEquipmentBySlot(
  equipment: Record<EquipmentSlot, EquippedItem | null>,
  slot: EquipmentSlot
): EquippedItem | null;

/** 检查装备的职业限制是否允许指定职业装备（Phase 5.3） */
export function checkClassRestriction(item: EquipmentItem, classId: string): boolean;

/** 统计当前装备状态中各套装的穿戴件数（Phase 5.3） */
export function countSetPieces(
  equipment: Record<EquipmentSlot, EquippedItem | null>
): Map<string, number>;

/** 计算当前装备状态激活的所有套装奖励（Phase 5.3） */
export function getActiveSetBonuses(
  equipment: Record<EquipmentSlot, EquippedItem | null>
): Array<{ setId: string; setName: string; piecesEquipped: number; bonus: SetBonus }>;

/** 获取指定套装的当前穿戴件数（Phase 5.3） */
export function getSetPieceCount(
  equipment: Record<EquipmentSlot, EquippedItem | null>,
  setId: string
): number;
```

> 内部函数（不对外导出）：`getSlotType(slot)` 根据 `weapon*` / `armor*` 前缀推导槽位类型；`isSlotOccupied(equipment, slot)` 检查槽位是否已被占用。

### 数据层接口（db.ts）

```typescript
export class EquipmentDbService {
  // === char_equipment 表操作 ===
  async saveEquipment(
    characterId: string,
    equipment: Record<EquipmentSlot, string | null>
  ): Promise<void>;
  async getEquipment(
    characterId: string
  ): Promise<Record<EquipmentSlot, string | null>>;
  async deleteEquipment(characterId: string): Promise<void>;

  // === config_equipmentItems 表操作 ===
  async saveEquipmentTemplate(item: EquipmentItem): Promise<void>;
  async getEquipmentTemplate(itemId: string): Promise<EquipmentItem | null>;
  async getAllEquipmentTemplates(): Promise<EquipmentItem[]>;
  async deleteEquipmentTemplate(itemId: string): Promise<void>;
}

export const equipmentDbService: EquipmentDbService;
```

> 内部方法（private，不对外导出）：`mapTemplateToEquipmentItem(data)` 将 `EquipmentTemplateStorage` 转换为运行时 `EquipmentItem`（P3 TS-10 审计：type/rarity/bonus 的 `as` 断言保留，属于"边界层信任 DB 数据"策略）；`getDefaultEquipment()` 复用 `createEmptySlotMap<string | null>(null)` 生成全空映射。所有 DB 操作均包裹 `dbService.withRetry`，并发写入健壮性由 DB 层保证。

### 回调注入接口（store.ts 模块级导出）

```typescript
/** 物品入背包回调类型 */
type AddItemToInventoryCallback = (itemId: string, quantity: number) => number;

/** 物品出背包回调类型 */
type RemoveItemFromInventoryCallback = (itemId: string, quantity: number) => number;

/** 设置物品入/出背包回调（供 GameBootstrap 在初始化时调用；第三个参数为等待背包持久化完成的回调，DB-1/DB-2 修复） */
export function setInventoryCallbacks(
  addCallback: AddItemToInventoryCallback | null,
  removeCallback: RemoveItemFromInventoryCallback | null,
  flushPersistCallback: (() => Promise<void>) | null = null
): void;

/** 清除物品入/出背包回调（供 GameBootstrap.dispose 调用，避免回调泄漏） */
export function clearInventoryCallbacks(): void;
```

> 回调由 `GameBootstrap.initialize` 在 inventory 初始化后注入：`setInventoryCallbacks(inventoryStore.addItem, inventoryStore.removeItem, inventoryStore.flushPersist)`，`dispose` 时调用 `clearInventoryCallbacks` 清除（含 `flushPersistCallback`）。
> - `flushPersistCallback`（DB-1/DB-2 修复）：inventory 的 `addItem`/`removeItem` 内部以 fire-and-forget 调用 `persistInventory`，当装备 `persist` 失败回滚时，回滚的背包操作也会触发 fire-and-forget 持久化；若两个持久化并发且顺序颠倒，DB 中可能残留错误状态。通过 `flushPersist` 等待前一个持久化完成后再触发回滚持久化，确保 DB 与内存最终一致。
> - 回调未注入时 `doUnequip` 抛出 `Error` 阻止卸下（避免装备丢失），`equipItem` 输出 `console.warn` 并返回 false。

---

## 通过 EventBus 发布的事件

装备模块不通过 EventBus 发布任何事件。属性同步通过直接调用 `characterStore.applyBonus()` / `characterStore.removeBonus()` 完成，UI 更新通过 Vue 响应式系统驱动。

---

## 业务逻辑流程

### 装备穿戴流程（equipItem）

1. 校验 `currentCharacterId` 已设置
2. **槽位校验**：`validateSlot(item, slot)` 检查类型匹配 + 槽位在 `item.slots` 列表中
3. **等级校验**：`characterStore.level < item.levelRequirement` → 返回 false
4. **职业限制校验**（Phase 5.3）：`checkClassRestriction(item, characterStore.classId)` → 返回 false
5. **从背包移除**（A1/G1 回调）：`inventoryRemoveItemCallback(item.id, 1)`；回调未注入时 `console.warn` 并返回 false，移除数量 ≤ 0 → 返回 false
6. **卸下旧装备**：`doUnequip(slot)`（try/catch 含回滚，P2-55 记录 `previousEquipped`；卸下失败时通过 `inventoryAddItemCallback` 将已移除的装备放回背包，返回 false）
7. **装备新物品**：写入 `equipment.value[slot] = { item, equippedAt: Date.now() }`
8. **应用属性加成**：`characterStore.applyBonus(computeEquipBonus(item))`（try/catch 含回滚，P2-55：`applyBonus` 失败时移除新装备、放回背包、恢复旧装备并重新应用其 bonus）
9. **重新应用套装效果**（BIZ-13）：`reapplySetBonuses()` 计算套装奖励 diff 并同步
10. **持久化**：`persist()` 写入 `char_equipment` 表（try/catch 含回滚，DB-1/DB-2：`persist` 失败时移除新装备 bonus、移除新装备、放回背包、恢复旧装备、重新应用套装效果，最后 `await flushPersist()` 等待背包持久化完成）
11. **记录冒险日志**：`useLogStore().addLogEntry()`（图标 `game-icons:crossed-swords`）

### 装备卸下流程（unequipItem）

1. 校验 `currentCharacterId` 已设置
2. 调用 `doUnequip(slot)`：
   - 移除装备属性加成：`removeBonusesFromSlot(slot)` → `characterStore.removeBonus(bonus)`
   - 清空槽位：`equipment.value[slot] = null`
   - 放回背包：`inventoryAddItemCallback(equippedItem.item.id, 1)`（A1/G1 回调）
3. **重新应用套装效果**（BIZ-13）：`reapplySetBonuses()`
4. **持久化**：`persist()`（try/catch 含回滚，DB-1/DB-2：`persist` 失败时从背包移除已放回的装备、恢复槽位、重新应用 bonus 与套装效果，最后 `await flushPersist()`）
5. **记录冒险日志**：`useLogStore().addLogEntry()`（图标 `game-icons:armor-downgrade`）

### doUnequip 内部流程（被 equipItem 和 unequipItem 复用）

1. 获取槽位装备，空槽位返回 null
2. 回调未注入检查：`inventoryAddItemCallback === null` 时抛出 `Error`，阻止卸下操作（避免装备被卸下后无处可去导致丢失）
3. `removeBonusesFromSlot(slot)`：计算并移除装备 bonus
4. `equipment.value[slot] = null`
5. `inventoryAddItemCallback(equippedItem.item.id, 1)`：放回背包
6. 放回失败检查：回调返回 ≤ 0（如背包已满）时回滚槽位与属性加成（`applyBonusForSlot`），抛出 `Error`，由调用方提示用户清理背包
7. 返回卸下的 `EquippedItem`

### 属性计算与同步流程

1. `totalStats`（computed）：遍历所有槽位的 `equippedItem.item.bonus`，仅累加白名单内属性键（`str`/`dex`/`con`/`int`/`wis`/`cha`，P2-49 修复防止无效 key 产生 NaN），返回完整 `Stats` 对象
2. 属性同步通过 `characterStore.applyBonus()` / `characterStore.removeBonus()` 实时完成
3. 角色模块的 `effectiveStats` 汇总所有加成

### 套装奖励重新应用流程（BIZ-13：reapplySetBonuses）

1. 调用 `getActiveSetBonuses(equipment.value)` 获取当前激活的套装奖励列表
2. 构建唯一键：`setId:requiredPieces:stat:value`
3. 对比 `appliedSetBonuses`（已应用列表）与当前激活列表：
   - 移除不再激活的加成：`characterStore.removeBonus({ [stat]: value })`
   - 应用新激活的加成：`characterStore.applyBonus({ [stat]: value })`
4. 更新 `appliedSetBonuses` 列表

> 在 `equipItem`、`unequipItem`、`initialize`、`reset` 中调用，确保装备变化后套装奖励正确同步。P2-48 修复：使用 `!= null` 显式检查，避免 `value=0` 的套装奖励被吞掉；P3 TS-15 修复：使用类型守卫 predicate 收窄类型。

### 初始化流程（initialize）

1. 设置 `isLoading = true`，记录 `currentCharacterId`
2. 加载所有装备模板到 `equipmentTemplates` Map（`getAllEquipmentTemplates()`，来自 `config_equipmentItems` 表）
3. 从 DB 加载装备 ID 映射（`getEquipment(characterId)`）
4. 用模板缓存将 ID 映射解析为完整 `EquippedItem` 对象（含 `equippedAt` 时间戳）
5. 填充 `equipment` 响应式状态
6. **BIZ-13**：调用 `reapplySetBonuses()` 应用初始套装效果
7. 设置 `isLoading = false`

### 重置流程（reset）

1. 移除所有装备属性加成：遍历所有槽位调用 `removeBonusesFromSlot(slot)`
2. 清空 `equipment` 为默认全空状态
3. **BIZ-13**：调用 `reapplySetBonuses()` 移除所有套装效果（装备已清空，所有套装不再激活）
4. 持久化全空的 ID 映射到 `char_equipment` 表
5. 清空 `currentCharacterId` 和 `equipmentTemplates`

> 退出角色时装备直接清空，不调用 `doUnequip`（不放回背包），因为背包数据由 inventory 模块独立管理。

---

## 套装系统设计（Phase 5.3）

### 概述

套装系统通过 `setId` 字段将装备归组，穿戴达到指定件数时激活对应奖励。套装定义存储在 `src/data/config_set_definitions.ts` 的 `SET_DEFINITIONS` 中（DATA-4：同时持久化到 `config_set_definitions` 表供 admin 后台编辑，业务模块仍直接 import 静态常量保持同步访问）。

### 套装奖励触发条件

- 装备的 `setId` 字段标识所属套装
- `countSetPieces(equipment)` 统计各套装的穿戴件数
- `getActiveSetBonuses(equipment)` 按 `SET_DEFINITIONS` 中的定义筛选 `requiredPieces <= 当前穿戴件数` 的奖励
- 套装奖励的 `stat` + `value` 通过 `characterStore.applyBonus/removeBonus` 同步到角色属性

### 套装奖励效果类型

| 效果字段 | 类型 | 说明 |
|----------|------|------|
| `stat` | string | 受影响的属性键（如 'str'、'rage_max'） |
| `value` | number | 数值加成（基础属性为整数，百分比效果为小数） |
| `effect` | string | 特殊效果标识（如 'rage_on_crit_10'） |
| `description` | string | 效果描述（UI 展示用） |

### 套装奖励同步机制（BIZ-13）

`reapplySetBonuses()` 通过 diff 计算确保装备变化时套装奖励正确同步：

- **装备新物品**：可能激活新的套装奖励 → 调用 `applyBonus`
- **卸下装备**：可能导致套装奖励失效 → 调用 `removeBonus`
- **唯一键**：`setId:requiredPieces:stat:value`，确保同一奖励不重复应用

### 职业专属装备（config_class_equipment）

`src/data/config_class_equipment.ts` 定义 6 个核心职业的专属装备 `CLASS_EQUIPMENT`（Phase 5.3）：

- 每个职业 3 件专属装备（武器 + 头部 + 胸部），覆盖核心槽位
- 其中 2 件带 `setId` 归属对应职业套装，1 件为独立装备
- `classRestriction` 字段强制职业限制，装备时由 `checkClassRestriction` 校验
- DATA-4：初始化时写入 `config_class_equipment` 表（`Table<EquipmentItem, string>`）供 admin 后台编辑，业务模块直接 import 静态常量

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库表 | Key | 数据结构 | 说明 |
|----------|-----|----------|------|
| `char_equipment` | `characterId` | `EquipmentStorage` | 角色装备 ID 映射（仅存 ID，按角色隔离；Dexie 表类型标注为 `Table<EquipmentStorage, string>`，实际写入形状为 `EquipmentDataStorage`） |
| `config_equipmentItems` | `id` | `EquipmentTemplateStorage` | 装备模板完整定义（装备模块 DbService 操作的表） |
| `config_class_equipment` | `id` | `EquipmentItem` | 职业专属装备（DATA-4，供 admin 后台编辑；业务模块直接 import 静态常量） |
| `config_set_definitions` | `id` | `ItemSet` | 套装定义（DATA-4，供 admin 后台编辑；业务模块直接 import `SET_DEFINITIONS`） |

### EquipmentDataStorage 存储内容

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `characterId` | string | - | 角色唯一标识（主键） |
| `equipment` | Record<EquipmentSlot, string \| null> | 7 个 null 槽位 | 装备槽位 → 装备 ID 映射 |
| `updatedAt` | number | `Date.now()` | 最后更新时间戳 |

> 与 `EquipmentStorage`（导入/导出格式）字段一致，区别仅在于 `updatedAt` 必选/可选；Dexie schema 中 `char_equipment` 表类型标注为 `EquipmentStorage`，`db.ts` 写入时构造含必选 `updatedAt` 的完整对象。

### EquipmentTemplateStorage 存储内容

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 装备唯一标识（主键） |
| `name` | string | 装备名称 |
| `type` | string | 装备类型（'weapon' \| 'armor'，存储为 string） |
| `rarity` | string | 稀有度（继承自 Item） |
| `icon` | string | 装备图标（Iconify 格式） |
| `description` | string | 装备描述 |
| `bonus` | Record<string, number> | 属性加成（存储为通用 Record，运行时映射为 Partial<Stats>） |
| `value` | number | 装备价值（金币） |
| `slots` | EquipmentSlot[] | 可装备的槽位列表 |
| `levelRequirement` | number \| null | 最低装备等级（null = 无限制） |
| `stackable` | boolean | 是否可堆叠 |
| `template` | string | 模板标识 |
| `effect` | { type; value } \| null | 装备使用效果（仅部分装备包含） |
| `consumable` | boolean | 是否为消耗品（仅部分装备包含） |

### 数据规范化设计

装备数据采用"存 ID + 模板分离"模式：

- `char_equipment.equipment` 仅存储装备 ID 映射（6 个字符串键值对），不存储完整装备对象
- 完整装备数据仅在 `config_equipmentItems` 表中存储一份
- 优势：避免数据冗余、装备属性变更只需更新模板表、减少存储空间
- 转换流程：IndexedDB 原始数据 → `EquipmentTemplateStorage`（类型断言）→ `mapTemplateToEquipmentItem()` 转换 → `EquipmentItem`（运行时对象）
- 模板缓存：`equipmentTemplates` 以 `shallowRef<Map<string, EquipmentItem>>` 持有（P3-144），`initialize` 时整体赋值，`addEquipmentTemplate`/`removeEquipmentTemplate` 原地修改后通过 `triggerRef` 显式触发响应式更新

### 多角色支持说明

装备数据通过 `characterId` 字段实现角色隔离，每个角色拥有独立的装备配置。切换角色时，系统自动加载对应角色的装备数据。删除角色时，级联删除该角色的装备数据（`deleteEquipment`）。

### 同步机制

| 同步类型 | 触发条件 | 延迟 |
|----------|----------|------|
| 自动同步 | Action 完成后调用 `persist()` | 即时持久化（异步） |
| 防御性读取 | `getEquipment` 校验 `equipment` 字段类型 | 数据损坏时回退默认全空映射 |
| 失败回滚（DB-1/DB-2） | `persist()` 抛错 | 回滚装备与背包状态后 `await flushPersist()` 等待背包持久化完成 |

---

## 装备状态 Store 导出的公共接口

### 响应式状态

| 名称 | 类型 | 说明 |
|------|------|------|
| `equipment` | ref<Record<EquipmentSlot, EquippedItem \| null\>\> | 当前角色装备状态（6 个槽位） |
| `equipmentTemplates` | shallowRef<Map<string, EquipmentItem\>\> | 装备模板缓存（从 `config_equipmentItems` 加载；P3-144 改 shallowRef，原地修改配合 `triggerRef`） |
| `persistError` | ref<string \| null\> | 装备持久化错误信息（DB-1/DB-2：persist 失败时设置，供 UI 监听并提示重试；null 表示无错误） |
| `currentCharacterId` | ref<string \| null\> | 当前活跃角色 ID（null 表示未进入角色） |
| `isLoading` | ref<boolean\> | 数据加载状态标识 |

### 计算属性

| 名称 | 类型 | 说明 |
|------|------|------|
| `totalStats` | computed<Stats\> | 当前装备提供的总属性加成（遍历所有槽位 bonus，白名单键累加） |
| `equippedCount` | computed<number\> | 已装备的槽位数（0-6） |
| `slotList` | computed<Array<{id, name, icon, equippedItem, isWeapon}\>\> | 完整槽位列表（含 UI 展示信息，合并 `SLOT_CONFIG` 与 `equipment` 状态） |
| `weaponSlots` | computed<Slot[]\> | 武器槽位列表（主手 + 副手） |
| `armorSlots` | computed<Slot[]\> | 护甲槽位列表（头部 + 胸部 + 腿部 + 鞋子） |
| `activeSetBonuses` | computed<Array<{setId, setName, piecesEquipped, bonus}\>\> | 当前已激活的套装奖励列表（Phase 5.3） |

### Action

| 名称 | 签名 | 说明 |
|------|------|------|
| `initialize` | `(characterId: string) => Promise<void>` | 初始化装备模块（加载模板 + 解析 ID + 应用套装效果） |
| `reset` | `() => Promise<void>` | 重置装备模块状态（退出角色时调用） |
| `equipItem` | `(slot: EquipmentSlot, item: EquipmentItem) => Promise<boolean>` | 装备物品到指定槽位（含槽位/等级/职业校验与失败回滚） |
| `unequipItem` | `(slot: EquipmentSlot) => Promise<EquippedItem \| null>` | 卸下指定槽位的装备（含持久化和日志） |
| `getEquipment` | `() => Record<EquipmentSlot, EquippedItem \| null\>` | 获取当前装备状态（返回浅拷贝） |
| `getEquippedItem` | `(slot: EquipmentSlot) => EquippedItem \| null` | 获取指定槽位的装备（返回浅拷贝） |
| `canEquip` | `(item: EquipmentItem, slot?: EquipmentSlot) => boolean` | 检查物品是否可以装备（等级 + 职业 + 槽位校验） |
| `getEquipmentTemplate` | `(itemId: string) => EquipmentItem \| null` | 按 ID 从内存缓存查询装备模板 |
| `addEquipmentTemplate` | `(item: EquipmentItem) => void` | 添加装备模板（同步缓存与 DB，失败回滚缓存并 `triggerRef`） |
| `removeEquipmentTemplate` | `(itemId: string) => void` | 删除装备模板（同步缓存与 DB） |

### 内部状态与内部函数（不对外导出）

| 名称 | 类型 | 说明 |
|------|------|------|
| `appliedSetBonuses` | ref<Array<{setId, requiredPieces, stat, value}\>\> | 已应用的套装奖励标记列表（BIZ-13 diff 计算） |
| `persist` | function | 将当前装备状态提取为 ID 映射写入 `char_equipment` 表（由 equipItem/unequipItem/reset 内部调用） |
| `reapplySetBonuses` | function | 套装奖励 diff 重应用（BIZ-13） |
| `removeBonusesFromSlot` | function | 移除指定槽位装备的属性加成（doUnequip/reset 复用） |
| `applyBonusForSlot` | function | 重新应用指定槽位装备的属性加成（回滚场景恢复用，不包含套装奖励） |
| `doUnequip` | function | 卸装核心逻辑（不含持久化与日志，回调未注入/背包满时抛出 Error） |
| `getDefaultEquipment` | function | 创建全空装备状态（复用 `createEmptySlotMap`） |

### 模块级常量与函数

| 名称 | 类型 | 说明 |
|------|------|------|
| `SLOT_CONFIG` | Record<EquipmentSlot, {name, icon}\> | 槽位 UI 展示配置（名称和图标；P3-101 修复：定义于 service.ts，store.ts 通过 import 引用） |
| `setInventoryCallbacks` | function | 设置背包操作回调（A1/G1 + DB-1/DB-2，含 `flushPersistCallback` 第三参数） |
| `clearInventoryCallbacks` | function | 清除背包操作回调（含 `flushPersistCallback`） |

---

## 与其他模块的交互关系

### 依赖关系

- **角色模块**：通过 `useCharacterStore()` 直接调用 `applyBonus()` / `removeBonus()` 同步属性和套装奖励
- **背包模块**：通过 `setInventoryCallbacks` 注入的回调操作背包（A1/G1，不直接 import inventory/store）
- **日志模块**：通过 `useLogStore().addLogEntry()` 记录装备/卸下操作的冒险日志
- **套装配置**：从 `@/data/config_set_definitions` 的 `SET_DEFINITIONS` 获取套装定义（service.ts 引用）
- **职业专属装备配置**：从 `@/data/config_class_equipment` 的 `CLASS_EQUIPMENT` 获取职业专属装备（data 层静态常量，业务模块直接 import）
- **item-template 聚合层**：装备模板查询经 `itemTemplateDbService` 委托 `equipmentDbService.getAllEquipmentTemplates()`；`UnifiedItemTemplateCache` 为系统内唯一物品模板缓存（ARCH-1，原 `services/ItemTemplateCache` 已删除）

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 角色模块 | 直接 Action 调用 | `applyBonus(stats)` 应用属性，`removeBonus(stats)` 移除属性；`level` 获取等级，`classId` 获取职业 |
| 背包模块 | 回调注入（A1/G1） | `inventoryAddItemCallback(itemId, quantity)` 放回装备，`inventoryRemoveItemCallback(itemId, quantity)` 移除装备，`flushPersistCallback()` 等待背包持久化完成（DB-1/DB-2） |
| 日志模块 | 直接 Action 调用 | `addLogEntry()` 记录装备/卸下操作的冒险日志 |
| 套装配置 | 静态 import | `SET_DEFINITIONS` 套装定义数据（service.ts 引用） |
| item-template 聚合层 | 只读委托查询（A1/G1/ARCH-1） | `ItemTemplateDbService` 委托 equipment DbService 查询装备模板；`UnifiedItemTemplateCache` 合并 `config_items` 与 `config_equipmentItems` 为统一 `Item` 格式，消除 inventory↔equipment 双向依赖 |

---

## 异常处理机制

| 异常类型 | 触发条件 | 处理策略 |
|----------|----------|----------|
| 槽位类型不匹配 | `getSlotType(slot) !== item.type` | `validateSlot` 返回 false，`equipItem` 返回 false |
| 槽位不在 slots 列表中 | `!itemTemplate.slots.includes(slot)` | `validateSlot` 返回 false，`equipItem` 返回 false |
| 等级不足 | `characterStore.level < item.levelRequirement` | `equipItem` 返回 false，`canEquip` 返回 false |
| 职业不符 | `!checkClassRestriction(item, classId)` | `equipItem` 返回 false，`canEquip` 返回 false |
| 回调未注入（装备） | `inventoryRemoveItemCallback === null` | `console.warn` 提示检查 GameBootstrap，`equipItem` 返回 false |
| 背包移除失败 | `inventoryRemoveItemCallback` 返回 ≤ 0 | `equipItem` 返回 false |
| 回调未注入（卸下） | `inventoryAddItemCallback === null` | `doUnequip` 抛出 `Error` 阻止卸下，避免装备丢失；`equipItem` catch 后回滚放回已移除的装备 |
| 背包已满无法放回 | `inventoryAddItemCallback` 返回 ≤ 0 | `doUnequip` 回滚槽位与属性加成（`applyBonusForSlot`）并抛出 `Error`，由调用方提示清理背包 |
| 属性加成应用失败 | `characterStore.applyBonus` 抛错 | `equipItem` 回滚装备状态（P2-55）：移除新装备、放回背包、恢复旧装备并重新应用其 bonus |
| 持久化失败 | `persist()` 抛错 | `equipItem`/`unequipItem` 回滚装备与背包状态（DB-1/DB-2），设置 `persistError` 供 UI 提示，`await flushPersist()` 等待背包持久化完成避免竞态 |
| 所有兼容槽位已占用 | `canEquipItem` 检测 | 返回 `{ canEquip: false, reason: '所有可用槽位已被占用' }` |
| 存储读取失败 | IndexedDB 数据损坏 | `getEquipment` 校验 `equipment` 字段类型，损坏时回退默认全空映射 |
| 存储写入失败 | IndexedDB 写入异常 | `dbService.withRetry` 自动重试 |

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 属性计算缓存 | `computed` 缓存 `totalStats`、`equippedCount`、`slotList`、`activeSetBonuses` | 避免重复计算 |
| 模板内存缓存 | `equipmentTemplates` 以 `shallowRef` 持有所有装备模板（P3-144：避免深度追踪 Map 内部，原地修改配合 `triggerRef`） | 快速访问，避免重复 DB 查询 |
| 数据规范化 | `char_equipment` 仅存 ID 映射，完整数据从模板表获取 | 减少 IndexedDB 存储空间，避免数据冗余 |
| 即时持久化 | Action 完成后异步调用 `persist()` 写 DB | 不阻塞 UI 主线程 |
| 回调注入 | `setInventoryCallbacks` 注入背包操作回调 | 消除 equipment → inventory 静态依赖，保持同步语义 |
| 套装奖励 diff | `reapplySetBonuses` 仅应用/移除变化的奖励 | 避免重复应用全部套装奖励 |
| 回滚竞态防护 | persist 失败回滚时 `await flushPersist()` 等待背包持久化完成（DB-1/DB-2） | 避免 fire-and-forget 持久化并发导致的 DB 状态错误 |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 输入验证 | `validateSlot` 检查槽位类型匹配，`checkClassRestriction` 检查职业限制 |
| 类型校验 | 装备类型使用 TypeScript 字面量联合类型确保编译期安全 |
| 类型收窄 | `mapTemplateToEquipmentItem` 集中处理 DB string → 运行时字面量联合类型的转换（P3 TS-10：`as` 断言属"边界层信任 DB 数据"策略，数据合法性由写入路径保证） |
| 异常捕获 | `dbService.withRetry` 含重试机制 |
| 数据净化 | `saveEquipmentTemplate` 为可选字段提供默认值（`bonus={}`、`levelRequirement=null`、`stackable=false`、`template=''`），避免写入 undefined |
| 浅拷贝返回 | `getEquipment` / `getEquippedItem` 返回浅拷贝，避免外部修改内部状态 |
| 装备失败回滚 | `equipItem` 卸下旧装备/应用加成/持久化异常时，通过回调恢复装备与背包状态（P2-55/DB-1/DB-2） |
| 回调泄漏防护 | `clearInventoryCallbacks` 在 dispose 时清除回调引用（含 `flushPersistCallback`） |

---

## 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-15 | 初始版本，包含基础装备功能 | System |
| v1.1 | 2026-05-18 | 调整为6个装备栏(2武器+4防具)，添加装备类型校验，移除加密需求 | System |
| v2.0 | 2026-05-19 | 迁移到 Pinia + IndexedDB 架构，实现自动同步持久化 | System |
| v2.1 | 2026-05-19 | 添加装备稀有度系统：5个稀有度等级、颜色显示、属性加成倍率 | System |
| v2.2 | 2026-06-16 | 文件结构拆分为db/store/service三层架构 | System |
| v3.0 | 2026-06-16 | 全面更新与代码对齐：移除 RARITY_CONFIG 中的 multiplier；跨模块通信改为直接 Store Action 调用；新增 service 层纯函数；稀有度配置统一从 @/config/inventory 引用 | System |
| v4.0 | 2026-06-17 | 逐文件比对修正：移除错误重新定义的 ItemRarity 和无关 RARITY_CONFIG 常量；修正导入语句以匹配实际代码 | System |
| v4.2 | 2026-07-10 | 严格对齐源码：移除不存在的 IEquipmentService 接口与 getRarityConfig/getRarityColor/syncStatsToCharacter 方法；移除错误的 RARITY_CONFIG 引用说明；新增 Phase 5.3 套装系统类型（SetBonus/SetBonusEffect/ItemSet）；补全 EquipmentItem 的 classRestriction/setId 字段；新增 EquipmentStorage/EquipmentTemplateStorage 类型；补全 Service 纯函数（ALL_EQUIPMENT_SLOTS/createEmptySlotMap/checkClassRestriction/countSetPieces/getActiveSetBonuses/getSetPieceCount）；补全 Store 导出（equipmentTemplates/activeSetBonuses/slotList/weaponSlots/armorSlots/addEquipmentTemplate/removeEquipmentTemplate/getEquipmentTemplate）；新增 A1/G1 回调注入机制；新增 BIZ-13 套装奖励重新应用逻辑；修正文件结构树格式 | System |
| v4.3 | 2026-08-03 | 严格对齐源码：setInventoryCallbacks 新增 flushPersistCallback 第三参数（DB-1/DB-2）；新增 item-template 聚合层章节（UnifiedItemTemplateCache 合并 config_items 与 config_equipmentItems，A1/G1/ARCH-1）；修正 char_equipment 表类型标注为 EquipmentStorage；补充 persistError 状态与 equipmentTemplates 的 shallowRef（P3-144）；标注 store.ts 约 871 行未拆分待办（P3-155）；修正 doUnequip/equipItem/unequipItem 失败回滚流程（P2-55/DB-1/DB-2）；修正数据安全 toRawData 描述；补充职业专属装备与套装持久化表（DATA-4）；SLOT_CONFIG 移至 service.ts（P3-101） | System |

---

**文档结束**
