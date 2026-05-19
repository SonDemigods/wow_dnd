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
   - NPC模块: `NPC_*`

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
| `EXPLORATION_NPC_INTERACTED` | 与任务NPC交互时 | `{ characterId: string, availableQuests, completableQuests }` |
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

---

**文档结束**