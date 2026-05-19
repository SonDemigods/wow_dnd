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
}
```

### 数据类型定义

```typescript
export type EquipmentSlot = 'weapon1' | 'weapon2' | 'armor' | 'helmet' | 'boots' | 'accessory';

export type EquipmentType = 'weapon' | 'armor';

export interface EquipmentItem extends Item {
  type: EquipmentType;
  slot: EquipmentSlot;
  stats: Partial<Stats>;
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
| `equipment:equipped` | 装备穿戴成功时 | `{ slot, item }` |
| `equipment:unequipped` | 装备卸下时 | `{ slot, item }` |
| `equipment:statsUpdated` | 属性更新时 | `{ stats }` |

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
2. 累加所有装备的属性值
3. 将总属性同步至角色模块
4. 触发属性更新事件

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| equipment | 'equipment' | EquipmentData | 装备完整数据 |

### EquipmentData 存储内容

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | string | 'equipment' | 唯一标识 |
| `equipment` | Record<EquipmentSlot, EquippedItem \| null> | 空对象 | 各槽位装备数据 |
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

---

**文档结束**