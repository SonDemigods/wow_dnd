# 事件总线设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 事件总线设计文档 |
| 版本 | v2.0 |
| 生成日期 | 2026年5月19日 |
| 所属模块 | `modules/eventBus` |

---

## 概述

事件总线是游戏模块间通信的核心基础设施，负责实现模块间的解耦和异步通信。所有模块通过事件总线发布事件和订阅事件，实现松耦合的架构设计。

### 核心特性

| 特性 | 描述 |
|------|------|
| **事件优先级** | 支持为不同事件监听器设置优先级级别，确保高优先级监听器优先执行 |
| **防抖机制** | 支持为指定事件设置防抖延迟时间，防止短时间内重复触发 |
| **节流机制** | 支持为指定事件设置固定时间间隔，确保事件在该时间间隔内最多触发一次 |
| **统一事件格式** | 所有事件必须包含角色上下文，便于多角色系统支持 |

---

## 事件命名规范

### 统一命名规则

1. **大写加下划线格式**: 所有事件名称统一使用大写字母，单词之间用下划线分隔
   - 示例: `CHARACTER_LEVEL_UP`、`COMBAT_START`、`EQUIPMENT_EQUIPPED`

2. **模块前缀**: 事件名以模块缩写开头（大写），确保命名空间隔离
   - 角色模块: `CHARACTER_*`
   - 战斗模块: `COMBAT_*`
   - 任务模块: `QUEST_*`
   - 背包模块: `INVENTORY_*`
   - 装备模块: `EQUIPMENT_*`
   - 商店模块: `SHOP_*`
   - 技能模块: `SKILL_*`
   - 探索模块: `EXPLORATION_*`
   - 地图模块: `MAP_*`

3. **动词后缀**: 事件名使用动词过去式表示已完成动作
   - `_UPDATED`: 状态更新
   - `_CHANGED`: 属性变化
   - `_START`: 开始事件
   - `_END`: 结束事件
   - `_ACCEPTED`: 接受事件
   - `_COMPLETED`: 完成事件

---

## 事件分类总览

### 角色模块事件

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `CHARACTER_LEVEL_UP` | 角色升级时 | `{ characterId: string, oldLevel: number, newLevel: number }` |
| `CHARACTER_CORE_STATS_CHANGE` | 核心属性发生变化时 | `{ characterId: string, oldStats: CoreStats, newStats: CoreStats }` |
| `CHARACTER_HP_CHANGE` | 生命值变化时 | `{ characterId: string, oldHp: number, newHp: number, maxHp: number }` |
| `CHARACTER_MP_CHANGE` | 魔法值变化时 | `{ characterId: string, oldMp: number, newMp: number, maxMp: number }` |
| `CHARACTER_DEATH` | 角色死亡时 | `{ characterId: string, cause: string }` |
| `CHARACTER_RESURRECTED` | 角色复活时 | `{ characterId: string, newHp: number, newMp: number }` |
| `CHARACTER_CREATED` | 角色创建成功时 | `{ characterId: string, name: string }` |
| `CHARACTER_SELECTED` | 角色选择成功时 | `{ characterId: string }` |
| `CHARACTER_DELETED` | 角色删除成功时 | `{ characterId: string }` |
| `CHARACTER_LOGOUT` | 角色退出时 | `{ characterId: string }` |

### 战斗模块事件

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `COMBAT_START` | 战斗开始时 | `{ characterId: string, enemy: Enemy }` |
| `COMBAT_END` | 战斗结束时 | `{ characterId: string, result, enemy, expGained }` |
| `COMBAT_PLAYER_ACTION` | 玩家行动时 | `{ characterId: string, action, result }` |
| `COMBAT_ENEMY_ACTION` | 敌人行动时 | `{ characterId: string, action, result }` |
| `COMBAT_DAMAGE` | 造成伤害时 | `{ characterId: string, target, amount, isCrit, isDodge }` |
| `COMBAT_HEAL` | 治疗时 | `{ characterId: string, target, amount }` |
| `COMBAT_SKILL_CAST` | 技能释放时 | `{ characterId: string, skillId, skillName, actor, target, damage, heal }` |

### 装备模块事件

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `EQUIPMENT_EQUIPPED` | 装备穿戴成功时 | `{ characterId: string, slot, item }` |
| `EQUIPMENT_UNEQUIPPED` | 装备卸下时 | `{ characterId: string, slot, item }` |
| `EQUIPMENT_STATS_UPDATED` | 属性更新时 | `{ characterId: string, stats }` |

### 背包模块事件

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `INVENTORY_ITEM_ADDED` | 物品添加时 | `{ characterId: string, item }` |
| `INVENTORY_ITEM_REMOVED` | 物品移除时 | `{ characterId: string, item, index }` |
| `INVENTORY_ITEM_USED` | 物品使用时 | `{ characterId: string, item, index }` |
| `INVENTORY_UPDATED` | 背包更新时 | `{ characterId: string }` |
| `INVENTORY_ITEM_DROPPED` | 物品丢弃时 | `{ characterId: string, item, index, count }` |
| `INVENTORY_SEARCH_RESULT` | 搜索完成时 | `{ characterId: string, results: InventoryItem[], keyword: string }` |
| `INVENTORY_FILTER_RESULT` | 筛选完成时 | `{ characterId: string, results: InventoryItem[], filters: ItemFilters }` |

### 任务模块事件

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `QUEST_ACCEPTED` | 接受任务时 | `{ characterId: string, questKey, questName }` |
| `QUEST_PROGRESS_UPDATED` | 任务进度更新时 | `{ characterId: string, questKey, objectiveKey, current, target }` |
| `QUEST_COMPLETED` | 任务完成并交付时 | `{ characterId: string, questKey, questName, xpReward, goldReward }` |
| `QUEST_ABANDONED` | 放弃任务时 | `{ characterId: string, questKey, questName }` |
| `QUEST_ACCEPTED_FROM_BOARD` | 从任务看板接受任务时 | `{ characterId: string, questKey, questName, boardId }` |
| `QUEST_TURNED_IN_TO_BOARD` | 向任务看板交付任务时 | `{ characterId: string, questKey, questName, boardId, xpReward, goldReward }` |

### 商店模块事件

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `SHOP_PURCHASED` | 购买商品成功时 | `{ characterId: string, ...ShopItemPurchasedEvent }` |
| `SHOP_SOLD` | 出售商品成功时 | `{ characterId: string, ...ShopItemSoldEvent }` |
| `SHOP_REFRESHED` | 商店刷新完成时 | `{ characterId: string, ...ShopRefreshedEvent }` |
| `SHOP_NOTIFICATION` | 交易状态变化时 | `{ characterId: string, message: string }` |

### 技能模块事件

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `SKILL_CAST` | 技能使用时 | `{ characterId: string, skill, success }` |
| `SKILL_EQUIPPED` | 技能装备到技能栏时 | `{ characterId: string, skillId, slotIndex }` |
| `SKILL_UNLOCKED` | 技能解锁时 | `{ characterId: string, skill }` |
| `SKILL_BAR_CHANGED` | 技能栏变化时 | `{ characterId: string, slots }` |

### 探索模块事件

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `EXPLORATION_AREA_ENTERED` | 进入探索区域时 | `{ characterId: string, areaId }` |
| `EXPLORATION_GRID_REVEALED` | 格子翻开时 | `{ characterId: string, x, y, eventType, eventData }` |
| `EXPLORATION_CAMP_USED` | 营地使用时 | `{ characterId: string }` |
| `EXPLORATION_SHOP_ITEM_BOUGHT` | 购买商店物品时 | `{ characterId: string, itemId, count, price }` |
| `EXPLORATION_SHOP_ITEM_SOLD` | 出售物品给商店时 | `{ characterId: string, itemId, count, price }` |
| `EXPLORATION_SHOP_TRIGGERED` | 触发商店交互时 | `{ characterId: string, shopId }` |
| `EXPLORATION_BOARD_TRIGGERED` | 触发任务看板交互时 | `{ characterId: string, boardId }` |
| `EXPLORATION_BATTLE_TRIGGERED` | 触发战斗时 | `{ characterId: string, monsterId }` |
| `EXPLORATION_MONSTER_DEFEATED` | 怪物被击败时 | `{ characterId: string, monsterId, rewards }` |
| `EXPLORATION_ITEM_FOUND` | 发现物品时 | `{ characterId: string, itemId, count }` |
| `EXPLORATION_TRAP_TRIGGERED` | 触发陷阱时 | `{ characterId: string, trapId, damage }` |
| `EXPLORATION_PLAYER_DIED` | 玩家死亡时 | `{ characterId: string }` |

### 地图模块事件

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `MAP_LOCATION_ENTERED` | 进入探索区域时 | `{ characterId: string, locationId, location }` |
| `MAP_MARKERS_UPDATED` | 标记列表变化时 | `{ characterId: string, markers }` |
| `MAP_MODE_CHANGED` | 地图模式变化时 | `{ characterId: string, mode }` |
| `MAP_UNLOCKED_LOCATIONS_CHANGED` | 解锁地点变化时 | `{ characterId: string, locations }` |

---

## 事件处理优先级机制

### 功能需求

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-EVENT-001 | 支持为事件监听器设置优先级级别 | 事件系统 |
| FR-EVENT-002 | 优先级分为高、中、低三级 | 事件系统 |
| FR-EVENT-003 | 支持自定义数值优先级（1-100） | 事件系统 |
| FR-EVENT-004 | 高优先级监听器优先执行 | 事件系统 |
| FR-EVENT-005 | 同优先级监听器按注册顺序执行 | 事件系统 |

### 优先级级别定义

| 优先级级别 | 数值范围 | 说明 | 使用场景 |
|----------|----------|------|----------|
| **HIGH** | 71-100 | 高优先级 | 核心逻辑、状态更新、关键数据处理 |
| **MEDIUM** | 31-70 | 中优先级 | UI更新、常规业务逻辑 |
| **LOW** | 1-30 | 低优先级 | 日志记录、统计分析、非关键UI更新 |

### 实现原理

```typescript
export type PriorityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | number;

export interface ListenerConfig {
  priority?: PriorityLevel;
  debounceMs?: number;
  throttleMs?: number;
}

export interface RegisteredListener {
  listener: EventListener;
  priority: number;
  debounceTimer?: number;
  throttleTimer?: number;
  lastTriggerTime?: number;
}

function getPriorityValue(priority: PriorityLevel): number {
  switch (priority) {
    case 'HIGH': return 80;
    case 'MEDIUM': return 50;
    case 'LOW': return 20;
    default: return Math.max(1, Math.min(100, priority));
  }
}
```

### API设计

```typescript
export interface IEventBus {
  on(event: string, listener: EventListener, config?: ListenerConfig): void;
  off(event: string, listener: EventListener): void;
  emit(event: string, data: GameEventData): void;
  once(event: string, listener: EventListener, config?: ListenerConfig): void;
}
```

### 使用示例

```typescript
// 注册高优先级监听器
eventBus.on('CHARACTER_HP_CHANGE', handleCriticalHpChange, { priority: 'HIGH' });

// 注册数值优先级监听器（90表示非常高的优先级）
eventBus.on('CHARACTER_HP_CHANGE', updateHpBar, { priority: 90 });

// 注册中优先级监听器
eventBus.on('CHARACTER_HP_CHANGE', logHpChange, { priority: 'MEDIUM' });

// 注册低优先级监听器
eventBus.on('CHARACTER_HP_CHANGE', trackHpStats, { priority: 'LOW' });
```

### 执行顺序说明

当 `CHARACTER_HP_CHANGE` 事件触发时，监听器按以下顺序执行：
1. `handleCriticalHpChange`（HIGH = 80）
2. `updateHpBar`（数值优先级 = 90）→ 优先级更高，先执行
3. `logHpChange`（MEDIUM = 50）
4. `trackHpStats`（LOW = 20）

### 边界条件处理

| 边界情况 | 处理方式 |
|----------|----------|
| 优先级数值 < 1 | 自动修正为 1 |
| 优先级数值 > 100 | 自动修正为 100 |
| 未指定优先级 | 默认使用 MEDIUM（50） |
| 相同优先级 | 按注册顺序执行 |

---

## 防抖（Debounce）功能

### 功能需求

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-EVENT-006 | 支持为指定事件设置防抖延迟时间 | 性能优化 |
| FR-EVENT-007 | 事件在延迟时间内再次触发时重置计时器 | 性能优化 |
| FR-EVENT-008 | 支持全局默认防抖时间配置 | 性能优化 |
| FR-EVENT-009 | 支持为单个监听器设置独立防抖时间 | 性能优化 |

### 实现原理

防抖机制确保事件在指定时间内只执行一次，如果在该时间内事件再次触发，则重新计时。

```typescript
function debounceExecute(listener: RegisteredListener, data: GameEventData): void {
  if (listener.debounceMs === undefined) {
    listener.listener(data);
    return;
  }
  
  // 清除之前的计时器
  if (listener.debounceTimer) {
    clearTimeout(listener.debounceTimer);
  }
  
  // 设置新的计时器
  listener.debounceTimer = window.setTimeout(() => {
    listener.listener(data);
    listener.debounceTimer = undefined;
  }, listener.debounceMs);
}
```

### API设计

```typescript
export interface ListenerConfig {
  priority?: PriorityLevel;
  debounceMs?: number;  // 防抖延迟时间（毫秒）
  throttleMs?: number;
}

export interface EventBusConfig {
  maxListeners?: number;
  enableLogging?: boolean;
  defaultDebounceMs?: number;  // 全局默认防抖时间
  defaultThrottleMs?: number;  // 全局默认节流时间
}
```

### 使用示例

```typescript
// 搜索输入框防抖 - 停止输入500ms后才执行搜索
eventBus.on('SEARCH_INPUT_CHANGED', performSearch, { debounceMs: 500 });

// 窗口大小变化防抖 - 停止调整200ms后才更新布局
eventBus.on('WINDOW_RESIZE', updateLayout, { debounceMs: 200 });

// 结合优先级使用
eventBus.on('CHARACTER_STATS_CHANGED', recalculateAttributes, { 
  priority: 'HIGH', 
  debounceMs: 100 
});
```

### 适用场景

| 场景 | 推荐防抖时间 | 说明 |
|------|----------|------|
| 搜索输入 | 300-500ms | 等待用户停止输入 |
| 窗口 resize | 150-200ms | 等待窗口调整完成 |
| 滚动事件 | 100-150ms | 减少滚动期间的回调 |
| 输入框实时验证 | 200-300ms | 避免频繁验证 |

### 边界条件处理

| 边界情况 | 处理方式 |
|----------|----------|
| 防抖时间 ≤ 0 | 不启用防抖，立即执行 |
| 防抖时间 > 10000ms | 自动修正为 10000ms |
| 未指定防抖时间 | 使用全局默认值或不启用 |

---

## 节流（Throttle）功能

### 功能需求

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-EVENT-010 | 支持为指定事件设置节流时间间隔 | 性能优化 |
| FR-EVENT-011 | 事件在时间间隔内最多触发一次 | 性能优化 |
| FR-EVENT-012 | 支持全局默认节流时间配置 | 性能优化 |
| FR-EVENT-013 | 支持为单个监听器设置独立节流时间 | 性能优化 |

### 实现原理

节流机制确保事件在指定时间间隔内最多执行一次，超过间隔后再次触发才会执行。

```typescript
function throttleExecute(listener: RegisteredListener, data: GameEventData): void {
  if (listener.throttleMs === undefined) {
    listener.listener(data);
    return;
  }
  
  const now = Date.now();
  
  // 如果距离上次执行时间小于节流间隔，忽略本次触发
  if (listener.lastTriggerTime !== undefined && 
      now - listener.lastTriggerTime < listener.throttleMs) {
    return;
  }
  
  // 执行监听器并记录时间
  listener.listener(data);
  listener.lastTriggerTime = now;
}
```

### API设计

```typescript
export interface ListenerConfig {
  priority?: PriorityLevel;
  debounceMs?: number;
  throttleMs?: number;  // 节流时间间隔（毫秒）
}
```

### 使用示例

```typescript
// 鼠标移动事件节流 - 每100ms最多执行一次
eventBus.on('MOUSE_MOVE', updateMousePosition, { throttleMs: 100 });

// 游戏循环更新节流 - 每16ms（约60fps）执行一次
eventBus.on('GAME_TICK', updateGameState, { throttleMs: 16 });

// 结合防抖和优先级使用
eventBus.on('SCROLL', updateScrollPosition, { 
  priority: 'LOW', 
  throttleMs: 50 
});
```

### 适用场景

| 场景 | 推荐节流时间 | 说明 |
|------|----------|------|
| 鼠标/触摸移动 | 50-100ms | 限制位置更新频率 |
| 游戏循环 | 16-33ms | 控制帧率 |
| 滚动事件 | 50-100ms | 减少滚动回调 |
| 键盘输入 | 30-50ms | 限制输入处理频率 |

### 边界条件处理

| 边界情况 | 处理方式 |
|----------|----------|
| 节流时间 ≤ 0 | 不启用节流，每次都执行 |
| 节流时间 > 10000ms | 自动修正为 10000ms |
| 未指定节流时间 | 使用全局默认值或不启用 |
| 防抖和节流同时设置 | 先应用节流，再应用防抖 |

---

## 性能测试指标

### 基准测试要求

| 测试项 | 目标指标 | 说明 |
|--------|----------|------|
| 单事件发布耗时 | < 1ms | 单次 emit 调用的执行时间 |
| 100个监听器触发 | < 10ms | 同一事件100个监听器的总执行时间 |
| 优先级排序耗时 | < 0.5ms | 100个监听器的排序时间 |
| 防抖计时器精度 | ±5ms | 防抖延迟的时间精度 |
| 节流计时器精度 | ±5ms | 节流间隔的时间精度 |
| 内存泄漏 | 无 | 长时间运行后内存稳定 |

### 性能优化策略

| 优化项 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 监听器缓存 | 使用 Map 存储监听器，按优先级排序 | O(log n) 查询和排序 |
| 批量发布 | 支持批量事件发布，减少重复操作 | 提升大量事件发布性能 |
| 惰性排序 | 仅在监听器增减时重新排序 | 减少不必要的排序操作 |
| WeakRef清理 | 使用 WeakRef 自动清理过期监听器 | 防止内存泄漏 |

---

## 兼容性要求

### 浏览器兼容性

| 浏览器 | 最低版本 | 说明 |
|--------|----------|------|
| Chrome | 90+ | 支持 WeakRef、Promise.allSettled |
| Firefox | 89+ | 支持 WeakRef |
| Safari | 15+ | 支持 WeakRef |
| Edge | 90+ | 与Chrome兼容 |

### 环境兼容性

| 环境 | 支持状态 | 说明 |
|------|----------|------|
| 浏览器 | ✅ 支持 | 原生 JavaScript 实现 |
| Node.js | ✅ 支持 | 替换 `setTimeout` 为 Node.js 版本 |
| Web Worker | ✅ 支持 | 无需 DOM 依赖 |
| SSR | ⚠️ 有限支持 | 定时器在服务端需要特殊处理 |

---

## 模块间事件交互矩阵

### 事件发布方 -> 订阅方关系

| 发布模块 | 事件 | 订阅模块 | 处理动作 |
|----------|------|----------|----------|
| 角色模块 | `CHARACTER_LEVEL_UP` | UI组件 | 更新等级显示 |
| 角色模块 | `CHARACTER_HP_CHANGE` | UI组件 | 更新HP条显示 |
| 角色模块 | `CHARACTER_MP_CHANGE` | UI组件 | 更新MP条显示 |
| 角色模块 | `CHARACTER_CORE_STATS_CHANGE` | 装备模块 | 重新计算装备加成 |
| 角色模块 | `CHARACTER_DEATH` | UI组件 | 显示死亡提示 |
| 角色模块 | `CHARACTER_RESURRECTED` | UI组件 | 显示复活提示 |
| 战斗模块 | `COMBAT_START` | UI组件 | 显示战斗界面 |
| 战斗模块 | `COMBAT_END` | UI组件 | 显示战斗结果 |
| 战斗模块 | `COMBAT_DAMAGE` | UI组件 | 显示伤害数字 |
| 战斗模块 | `COMBAT_HEAL` | UI组件 | 显示治疗数字 |
| 战斗模块 | `EXPLORATION_PLAYER_DIED` | 角色模块 | 处理死亡惩罚 |
| 装备模块 | `EQUIPMENT_EQUIPPED` | 角色模块 | 应用属性加成 |
| 装备模块 | `EQUIPMENT_UNEQUIPPED` | 角色模块 | 移除属性加成 |
| 背包模块 | `INVENTORY_ITEM_USED` | 角色模块 | 应用物品效果 |
| 背包模块 | `INVENTORY_ITEM_DROPPED` | UI组件 | 显示丢弃提示 |
| 背包模块 | `INVENTORY_SEARCH_RESULT` | UI组件 | 显示搜索结果 |
| 背包模块 | `INVENTORY_FILTER_RESULT` | UI组件 | 显示筛选结果 |
| 任务模块 | `QUEST_COMPLETED` | 角色模块 | 发放奖励 |
| 任务模块 | `QUEST_ACCEPTED` | UI组件 | 更新任务列表 |
| 任务模块 | `QUEST_PROGRESS_UPDATED` | UI组件 | 更新任务进度 |
| 商店模块 | `SHOP_PURCHASED` | UI组件 | 显示购买成功提示 |
| 商店模块 | `SHOP_SOLD` | UI组件 | 显示出售成功提示 |
| 技能模块 | `SKILL_CAST` | 战斗模块 | 计算技能伤害 |
| 技能模块 | `SKILL_CAST` | 角色模块 | 消耗MP |
| 探索模块 | `EXPLORATION_AREA_ENTERED` | UI组件 | 切换探索界面 |
| 探索模块 | `EXPLORATION_GRID_REVEALED` | UI组件 | 显示格子内容 |
| 探索模块 | `EXPLORATION_SHOP_TRIGGERED` | 商店模块 | 打开商店界面 |
| 探索模块 | `EXPLORATION_BOARD_TRIGGERED` | 任务模块 | 打开任务看板界面 |
| 探索模块 | `EXPLORATION_BATTLE_TRIGGERED` | 战斗模块 | 开始战斗 |
| 探索模块 | `EXPLORATION_MONSTER_DEFEATED` | 任务模块 | 更新击杀任务进度 |
| 探索模块 | `EXPLORATION_ITEM_FOUND` | 背包模块 | 添加物品到背包 |
| 地图模块 | `MAP_LOCATION_ENTERED` | 探索模块 | 进入探索区域 |
| 任务模块 | `QUEST_ACCEPTED_FROM_BOARD` | UI组件 | 显示接受任务提示 |
| 任务模块 | `QUEST_TURNED_IN_TO_BOARD` | UI组件 | 显示任务完成提示 |

---

## 事件总线接口定义

```typescript
export interface IEventBus {
  on(event: string, listener: EventListener): void;
  off(event: string, listener: EventListener): void;
  emit(event: string, data: GameEventData): void;
  once(event: string, listener: EventListener): void;
}

export type EventListener = (data: GameEventData) => void;

export interface EventBusConfig {
  maxListeners?: number;
  enableLogging?: boolean;
}

/** 统一事件数据格式 - 所有事件必须包含角色上下文 */
export interface GameEventData<T = any> {
  characterId: string | null;
  type: string;
  payload: T;
  timestamp: number;
}
```

---

## 模块文件结构

```
src/modules/eventBus/
  - index.ts          # 事件总线核心实现
  - types.ts          # 事件类型定义
  - constants.ts      # 事件名称常量定义
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | 事件总线核心实现，包含发布/订阅/取消订阅方法 |
| `types.ts` | 事件数据类型定义 |
| `constants.ts` | 所有事件名称常量定义 |

---

## 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-19 | 初始版本，汇总所有模块事件定义 | System |
| v1.1 | 2026-05-19 | 统一事件命名规范为大写加下划线格式 | System |
| v1.2 | 2026-05-19 | 添加背包模块新事件（丢弃、搜索、筛选） | System |
| v2.0 | 2026-05-19 | 重新整理所有模块事件，更新交互矩阵 | System |
| v2.1 | 2026-05-19 | 添加事件处理优先级机制，支持高/中/低三级及自定义数值优先级 | System |
| v2.2 | 2026-05-19 | 添加防抖（Debounce）功能，支持为指定事件设置防抖延迟时间 | System |
| v2.3 | 2026-05-19 | 添加节流（Throttle）功能，支持为指定事件设置固定时间间隔 | System |

---

**文档结束**