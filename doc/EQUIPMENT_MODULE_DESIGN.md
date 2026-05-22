# 装备模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 装备模块设计文档 |
| 版本 | v2.0 |
| 生成日期 | 2026年5月19日 |
| 所属模块 | `modules/equipment` |

---

## 模块概述与定位

### 模块定位

装备模块负责管理玩家装备的穿戴和属性计算。它提供装备槽位管理、装备类型校验、属性加成计算等核心功能。

### 核心职责

| 职责 | 描述 |
|------|------|
| 装备穿戴 | 装备物品到指定槽位，验证装备类型匹配 |
| 装备卸下 | 从槽位卸下装备 |
| 属性计算 | 计算装备总属性加成并同步至角色模块 |
| 稀有度管理 | 管理装备稀有度，提供稀有度查询和颜色显示 |
| 数据持久化 | 装备数据的本地存储 |

### 装备槽位配置

| 槽位编号 | 槽位名称 | 类型 | 说明 |
|----------|----------|------|------|
| 1 | `weapon1` | 武器 | 主手武器槽 |
| 2 | `weapon2` | 武器 | 副手武器槽 |
| 3 | `armor1` | 防具 | 防具槽1 |
| 4 | `armor2` | 防具 | 防具槽2 |
| 5 | `armor3` | 防具 | 防具槽3 |
| 6 | `armor4` | 防具 | 防具槽4 |

**说明**：防具槽位不区分具体类型，任意防具均可装备到任意防具槽位。

### 模块边界

**装备模块**与以下模块交互:
- 角色模块:提供属性加成计算
- 背包模块:装备物品来源

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-EQUIP-001 | 支持装备穿戴 | 核心功能 |
| FR-EQUIP-002 | 支持装备卸下 | 核心功能 |
| FR-EQUIP-003 | 支持属性加成计算 | 核心功能 |
| FR-EQUIP-004 | 支持6个装备栏位(2武器+4防具) | 槽位管理 |
| FR-EQUIP-005 | 不同类型装备只能放在对应栏位 | 类型校验 |
| FR-EQUIP-006 | 装备属性需计算至角色模块 | 属性同步 |
| FR-EQUIP-007 | 数据持久化存储 | 存档系统 |
| FR-EQUIP-008 | 支持装备稀有度定义（普通、优秀、稀有、史诗、传说） | 稀有度系统 |
| FR-EQUIP-008-1 | 不同稀有度装备显示不同颜色 | 稀有度系统 |
| FR-EQUIP-008-2 | 稀有度影响装备属性加成倍率 | 稀有度系统 |
| FR-EQUIP-008-3 | 稀有度越高，装备属性加成越高 | 稀有度系统 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-EQUIP-001 | 属性计算性能 | 高 |

---

## 接口定义

### 服务接口 IEquipmentService

```typescript
export interface IEquipmentService {
  equipItem(slot: EquipmentSlot, item: EquipmentItem): boolean;
  unequipItem(slot: EquipmentSlot): EquippedItem | null;
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
  getRarityMultiplier(rarity: ItemRarity): number;
  calculateRarityBonus(baseBonus: Partial<Stats>, rarity: ItemRarity): Partial<Stats>;
}
```

### 数据类型定义

```typescript
/** 物品稀有度类型 */
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** 稀有度配置 */
export interface RarityConfig {
  name: string;
  color: string;
  multiplier: number;
}

/** 稀有度配置表 */
export const RARITY_CONFIG: Record<ItemRarity, RarityConfig> = {
  common: { name: '普通', color: '#ffffff', multiplier: 1.0 },
  uncommon: { name: '优秀', color: '#1eff00', multiplier: 1.2 },
  rare: { name: '稀有', color: '#0070dd', multiplier: 1.5 },
  epic: { name: '史诗', color: '#a335ee', multiplier: 2.0 },
  legendary: { name: '传说', color: '#ff8000', multiplier: 3.0 }
};

export type EquipmentSlot = 'weapon1' | 'weapon2' | 'armor1' | 'armor2' | 'armor3' | 'armor4';

export type EquipmentType = 'weapon' | 'armor';

export interface EquipmentItem extends Item {
  type: EquipmentType;
  slots: EquipmentSlot[];
  bonus?: Partial<Stats>;
  rarity: ItemRarity;
  levelRequirement?: number;
}

export interface EquippedItem {
  item: EquipmentItem;
  equippedAt: number;
}

export interface EquipmentState {
  equipment: Record<EquipmentSlot, EquippedItem | null>;
}
```

### 事件定义

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `EQUIPMENT_EQUIPPED` | 装备穿戴成功时 | `{ slot, item }` |
| `EQUIPMENT_UNEQUIPPED` | 装备卸下时 | `{ slot, item }` |
| `EQUIPMENT_STATS_UPDATED` | 属性更新时 | `{ stats }` |

---

## 业务逻辑流程

### 装备穿戴流程

1. 检查物品是否为装备类型
2. 检查等级要求是否满足
3. 检查装备类型与槽位是否匹配
4. 获取当前槽位装备(如果有)
5. 替换当前装备
6. 计算装备属性加成并同步至角色模块
7. 如果有旧装备,移除其属性加成
8. 返回旧装备(如果有)

### 装备卸下流程

1. 检查槽位是否有装备
2. 移除该装备的属性加成
3. 清空槽位
4. 更新角色模块属性
5. 返回卸下的装备

### 属性计算与同步流程

1. 遍历所有已装备物品
2. 对每个装备，获取其基础属性
3. 根据装备稀有度获取属性加成倍率
4. 计算实际属性加成 = 基础属性 × 稀有度倍率
5. 累加所有装备的实际属性值
6. 将总属性同步至角色模块
7. 触发属性更新事件

**稀有度属性加成计算示例：**
```
假设一把稀有（rare）武器基础属性为：
  str: 10, dex: 5

稀有度倍率 = 1.5（RARE配置）

实际属性加成：
  str: 10 × 1.5 = 15
  dex: 5 × 1.5 = 7.5
```

---

## 稀有度系统设计

### 稀有度等级定义

| 稀有度 | 英文名 | 中文名 | 颜色代码 | 属性倍率 | 说明 |
|--------|--------|--------|----------|----------|------|
| 普通 | common | 普通 | #ffffff | 1.0 | 基础装备，无额外加成 |
| 优秀 | uncommon | 优秀 | #1eff00 | 1.2 | 绿色装备，属性提升20% |
| 稀有 | rare | 稀有 | #0070dd | 1.5 | 蓝色装备，属性提升50% |
| 史诗 | epic | 史诗 | #a335ee | 2.0 | 紫色装备，属性翻倍 |
| 传说 | legendary | 传说 | #ff8000 | 3.0 | 橙色装备，属性三倍 |

### 稀有度颜色显示规则

1. **装备名称颜色**：根据稀有度显示对应颜色
2. **装备槽位边框**：已装备槽位显示装备稀有度对应的边框颜色
3. **属性数值颜色**：属性加成数值使用稀有度颜色显示
4. **提示框边框**：装备详情提示框边框使用稀有度颜色

### 稀有度属性加成机制

**计算公式：**
```
实际属性加成 = 装备基础属性 × 稀有度倍率
```

**示例计算：**
| 装备 | 基础属性 | 稀有度 | 倍率 | 实际加成 |
|------|----------|--------|------|----------|
| 铁剑 | str: 10 | 普通 | 1.0 | str: 10 |
| 精钢剑 | str: 10 | 优秀 | 1.2 | str: 12 |
| 秘银剑 | str: 10 | 稀有 | 1.5 | str: 15 |
| 暗影剑 | str: 10 | 史诗 | 2.0 | str: 20 |
| 龙牙剑 | str: 10 | 传说 | 3.0 | str: 30 |

### 稀有度获取规则

| 来源 | 稀有度范围 | 说明 |
|------|------------|------|
| 普通怪物掉落 | 普通~优秀 | 低级怪物主要掉落普通装备 |
| 精英怪物掉落 | 优秀~稀有 | 精英怪物有更高概率掉落稀有装备 |
| Boss掉落 | 稀有~传说 | Boss必定掉落稀有以上装备 |
| 任务奖励 | 优秀~史诗 | 任务奖励装备品质较高 |
| 商店购买 | 普通~稀有 | 商店出售装备品质有限 |

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| equipment | `characterId` | EquipmentData | 装备完整数据（按角色隔离） |

### EquipmentData 存储内容

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `characterId` | string | - | 角色唯一标识 |
| `equipment` | Record<EquipmentSlot, EquippedItem \| null> | 空对象 | 各槽位装备数据 |
| `updatedAt` | number | Date.now() | 最后更新时间 |

### 多角色支持说明

装备数据通过 `characterId` 字段实现角色隔离，每个角色拥有独立的装备配置。切换角色时，系统自动加载对应角色的装备数据，并通过角色模块重新计算属性加成。删除角色时，级联删除该角色的装备数据。

### 同步机制

| 同步类型 | 触发条件 | 延迟 |
|----------|----------|------|
| 自动同步 | 状态变更 | 500ms 防抖 |
| 立即同步 | 关键操作 | 即时 |
| 页面卸载 | beforeunload | 即时 |

---

## 与其他模块的交互关系

### 依赖关系

- **角色模块**:应用/移除属性加成，同步装备属性
- **背包模块**:装备物品来源

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 角色模块 | 调用 | `applyEquipmentBonus(stats)`, `removeEquipmentBonus(stats)` |
| 背包模块 | 调用 | `addItem()` 返回卸下的装备 |

---

## 异常处理机制

### 异常类型与处理策略

| 异常类型 | 触发条件 | 处理策略 |
|----------|----------|----------|
| 物品不可装备 | 物品类型不是装备 | 返回 false |
| 等级不足 | 玩家等级低于要求 | 返回 false |
| 槽位类型不匹配 | 装备类型与槽位类型不一致 | 返回 false |
| 槽位冲突 | 槽位已有装备 | 自动卸下旧装备 |

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 属性计算缓存 | 使用 computed | 避免重复计算 |
| 增量更新 | 只更新变化的属性 | 减少计算量 |
| 防抖同步 | 500ms 延迟合并写入 | 减少 IO 操作 |
| 批量写入 | SyncEngine 批量处理 | 提升性能 |
| 异步加载 | Store 初始化时异步从 IndexedDB 读取 | 不阻塞主线程 |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 输入验证 | 检查物品数据有效性和槽位类型匹配 |
| 数据隔离 | 使用独立对象存储 |
| 异常捕获 | 防止程序崩溃 |
| 重试机制 | 失败时自动重试 3 次 |
| 数据校验 | 写入前验证数据结构 |

---

## 模块文件结构

```
src/modules/equipment/
  - index.ts          # 核心实现（Store + Service）
  - types.ts          # 类型定义
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | Pinia Store 实现、服务接口实现、装备逻辑 |
| `types.ts` | TypeScript 类型定义、接口定义 |

---

## 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-15 | 初始版本,包含基础装备功能 | System |
| v1.1 | 2026-05-18 | 调整为6个装备栏(2武器+4防具),添加装备类型校验,移除加密需求 | System |
| v2.0 | 2026-05-19 | 迁移到 Pinia + IndexedDB 架构，实现自动同步持久化 | System |
| v2.1 | 2026-05-19 | 添加装备稀有度系统：5个稀有度等级、颜色显示、属性加成倍率 | System |

---

**文档结束**