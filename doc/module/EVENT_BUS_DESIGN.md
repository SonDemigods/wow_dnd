# 事件总线设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 事件总线设计文档 |
| 版本 | v5.0 |
| 生成日期 | 2026年7月10日 |
| 所属模块 | `modules/bus` |
| 更新说明 | 严格对齐源码：修正 `EventCallback` 类型为 `(...args: unknown[]) => void`；修正 API 签名均使用泛型 `K extends keyof GameEventPayloadMap`；修正 `COMBAT_START`/`COMBAT_END` 载荷类型为 `EnemyInstance`；补充完整 `IEventBus` 接口与完整 `GameEventPayloadMap`（含全部 39 个事件映射）；补充 `emit` 快照遍历防监听器修改（P3-10）、`clearGroup` 使用 indexOf+splice 精确移除、`removeEvent` 同步清理 groups 等实现细节；补充枚举字符串值 |

---

## 概述

事件总线是游戏模块间通信的核心基础设施，负责实现模块间的解耦通信。采用**发布/订阅模式**，通过单例 `eventBus` 实例对外提供服务。

事件总线仅用于 **UI/音效/通知类事件**的发布与订阅。模块间的**数据变更通信**通过直接调用 Store Action 实现，不经过事件总线。

### 核心特性

| 特性 | 描述 |
|------|------|
| 发布/订阅模式 | 解耦模块间通信 |
| 一次性监听 | `once` 方法，事件触发后自动取消 |
| 分组管理 | `onGroup`/`clearGroup`，支持模块级批量注册与清理 |
| 类型安全 | `GameEventPayloadMap` 与泛型 `K extends keyof GameEventPayloadMap` 确保 emit/on 的 payload 类型正确 |
| 错误容错 | 监听器异常通过 try-catch 捕获并 `console.error`，不中断其他监听器执行 |
| 快照遍历 | `emit` 对回调数组切片快照后遍历，防止监听器执行中 off/clearGroup 修改原数组（P3-10） |

---

## 模块文件结构

```
src/modules/bus/
  ├── index.ts          # 模块统一导出入口
  ├── core.ts           # 事件总线核心实现（EventBus 类 + eventBus 单例）
  └── types.ts          # GameEvents 枚举、GameEventPayloadMap、IEventBus、类型定义
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | 模块统一导出入口，导出类型（`EventCallback`、`GameEventPayloadMap`、`IEventBus`、`EventListeners`、`GroupListeners`）、`GameEvents` 枚举、`EventBus` 类与 `eventBus` 单例 |
| `core.ts` | `EventBus` 类实现（`on`/`off`/`emit`/`once`/`onGroup`/`clearGroup`/`clearAll`/`removeEvent`），导出 `eventBus: IEventBus` 单例 |
| `types.ts` | `GameEvents` 枚举定义、`GameEventPayloadMap` 类型映射、`EventCallback` 类型、`IEventBus` 接口、`EventListeners`/`GroupListeners` 内部存储接口 |

---

## EventBus 类 API

```typescript
export class EventBus implements IEventBus {
  /** 事件监听器映射表（内部存储） */
  private listeners: EventListeners = {};

  /** 分组监听器记录（内部存储） */
  private groups: GroupListeners = {};

  /** 注册事件监听器 */
  on<K extends keyof GameEventPayloadMap>(event: K, callback: (data: GameEventPayloadMap[K]) => void): void;

  /** 取消事件监听器 */
  off<K extends keyof GameEventPayloadMap>(event: K, callback: (data: GameEventPayloadMap[K]) => void): void;

  /** 触发事件（类型安全，快照遍历） */
  emit<K extends keyof GameEventPayloadMap>(event: K, data: GameEventPayloadMap[K]): void;

  /** 注册一次性事件监听器（触发一次后自动取消） */
  once<K extends keyof GameEventPayloadMap>(event: K, callback: (data: GameEventPayloadMap[K]) => void): void;

  /** 按分组注册事件监听器（便于模块级批量管理） */
  onGroup<K extends keyof GameEventPayloadMap>(groupName: string, event: K, callback: (data: GameEventPayloadMap[K]) => void): void;

  /** 清除指定分组的所有事件监听器（indexOf+splice 精确移除） */
  clearGroup(groupName: string): void;

  /** 清除所有事件监听器 */
  clearAll(): void;

  /** 移除指定事件的所有监听器（同步清理 groups 中涉及该事件的记录） */
  removeEvent(event: string): void;
}

/** 事件总线全局单例（以 IEventBus 接口类型对外暴露） */
export const eventBus: IEventBus = new EventBus();
```

### 实现细节

| 方法 | 实现要点 |
|------|----------|
| `on` | 回调以 `as EventCallback` 断言后 push 到 `listeners[event]` 数组 |
| `off` | 使用 `filter` 过滤掉指定回调引用 |
| `emit` | 对 `listeners[event]` 调用 `slice()` 快照后遍历（P3-10），每个回调 try-catch 包裹，异常 `console.error` 不中断后续 |
| `once` | 包装为 `onceCallback`：先执行原回调，再调用 `this.off` 取消自身 |
| `onGroup` | 同时向 `groups[groupName]` 推入 `{ event, callback }` 记录并调用 `on` 注册 |
| `clearGroup` | 遍历分组记录，对每个 `{ event, callback }` 使用 `indexOf`+`splice` 精确移除（避免 filter 误删 on() 另行注册的同引用回调），数组清空时 `delete` 键，最后 `delete groups[groupName]` |
| `removeEvent` | `delete listeners[event]`，并遍历 `groups` 过滤掉涉及该事件的记录，空分组自动 `delete` |
| `clearAll` | 重置 `listeners = {}` 与 `groups = {}` |

### 使用示例

```typescript
// 注册监听器（payload 类型自动推导）
eventBus.on(GameEvents.COMBAT_START, (data) => {
  console.log('战斗开始', data.enemy);
});

// 一次性监听
eventBus.once(GameEvents.COMBAT_END, (data) => {
  console.log('战斗结束', data.result);
});

// 分组注册（模块级批量管理）
eventBus.onGroup('myModule', GameEvents.CHARACTER_LEVEL_UP, handleLevelUp);
eventBus.onGroup('myModule', GameEvents.QUEST_COMPLETED, handleQuestDone);

// 批量清除分组
eventBus.clearGroup('myModule');

// 触发事件（payload 类型由映射自动推导）
eventBus.emit(GameEvents.CHARACTER_LEVEL_UP, { oldLevel: 5, newLevel: 6 });
```

---

## 事件命名规范

1. **枚举键大写加下划线格式**：枚举键名统一使用大写字母，单词之间用下划线分隔（如 `CHARACTER_CREATED`）
2. **枚举值为小写蛇形**：枚举字符串值统一使用小写字母加下划线（如 `'character_created'`）
3. **模块前缀**：事件名以模块缩写开头，确保命名空间隔离
4. **动词后缀**：事件名使用动词过去式表示已完成动作（`_START`、`_END`、`_CREATED`、`_COMPLETED` 等）

---

## 完整事件列表

### 角色模块事件

| 事件名称 | 枚举值 | 触发时机 | Payload |
|----------|--------|----------|---------|
| `CHARACTER_CREATED` | `'character_created'` | 角色创建成功 | `{ characterId: string; name: string }` |
| `CHARACTER_DELETED` | `'character_deleted'` | 角色删除成功 | `{ characterId: string }` |
| `CHARACTER_LOGOUT` | `'character_logout'` | 角色退出登录 | `null` |
| `CHARACTER_LEVEL_UP` | `'character_level_up'` | 角色升级 | `{ oldLevel: number; newLevel: number }` |
| `CHARACTER_DEATH` | `'character_death'` | 角色死亡 | `{ cause: string }` |
| `CHARACTER_RESURRECTED` | `'character_resurrected'` | 角色复活 | `{ newHp: number; newMp: number }` |

### 战斗模块事件

| 事件名称 | 枚举值 | 触发时机 | Payload |
|----------|--------|----------|---------|
| `COMBAT_START` | `'combat_start'` | 战斗开始 | `{ enemy: EnemyInstance }` |
| `COMBAT_END` | `'combat_end'` | 战斗结束 | `{ result: string; enemy: EnemyInstance \| null; expGained: number; goldGained?: number }` |
| `COMBAT_PLAYER_TURN` | `'combat_player_turn'` | 玩家回合开始 | `null` |
| `COMBAT_ENEMY_TURN` | `'combat_enemy_turn'` | 敌人回合开始 | `null` |
| `COMBAT_DEAL_DAMAGE` | `'combat_deal_damage'` | 造成伤害（音效/特效） | `{ amount: number; damageType: 'physical' \| 'magic'; targetName: string; actorType?: 'player' \| 'enemy' }` |
| `COMBAT_CAST_HEAL` | `'combat_cast_heal'` | 治疗（音效/特效） | `{ amount: number; healType: 'health' \| 'mana' \| 'buff' \| 'debuff'; targetName: string }` |
| `COMBAT_CRITICAL_HIT` | `'combat_critical_hit'` | 暴击（视觉特效） | `{ amount: number; damageType: 'physical' \| 'magic'; targetName: string; actorType: 'player' \| 'enemy' }` |
| `COMBAT_DODGE` | `'combat_dodge'` | 闪避（音效/特效） | `{ attackerName: string; dodgerName: string; dodgerType: 'player' \| 'enemy' }` |
| `COMBAT_SKIP_TURN` | `'combat_skip_turn'` | 跳过回合 | `null` |
| `COMBAT_BOSS_INTRO` | `'combat_boss_intro'` | Boss 出场演出 | `{ enemyId: string; enemyName: string; icon: string; effect: string; lines: string[]; duration: number }` |
| `COMBAT_BOSS_PHASE` | `'combat_boss_phase'` | Boss 阶段转换 | `{ enemyId: string; enemyName: string; phaseName: string; effect: string }` |

### 探索模块事件

| 事件名称 | 枚举值 | 触发时机 | Payload |
|----------|--------|----------|---------|
| `EXPLORATION_START` | `'exploration_start'` | 探索开始 | `{ characterId: string \| null; areaId?: string }` |
| `EXPLORATION_END` | `'exploration_end'` | 探索结束 | `{ characterId: string \| null }` |
| `EXPLORATION_CELL_EXPLORED` | `'exploration_cell_explored'` | 格子翻开 | `{ characterId: string \| null; x: number; y: number; cellType?: string; interactionId?: string }` |
| `EXPLORATION_BATTLE_TRIGGERED` | `'exploration_battle_triggered'` | 触发战斗 | `{ characterId: string \| null; eventData: { monsterId: string; areaLevel: number } }` |
| `EXPLORATION_CAMP_USED` | `'exploration_camp_used'` | 营地使用 | `{ characterId: string \| null }` |
| `EXPLORATION_ITEM_FOUND` | `'exploration_item_found'` | 发现物品 | `{ characterId: string \| null; itemId: string; count: number; itemName?: string }` |
| `EXPLORATION_TRAP_TRIGGERED` | `'exploration_trap_triggered'` | 触发陷阱 | `{ characterId: string \| null; damage: number; trapType?: string }` |
| `EXPLORATION_RANDOM_EVENT` | `'exploration_random_event'` | 随机事件 | `{ characterId: string \| null; message: string; icon: string }` |

### 区域事件

| 事件名称 | 枚举值 | 触发时机 | Payload |
|----------|--------|----------|---------|
| `ZONE_ENTERED` | `'zone_entered'` | 进入区域 | `{ locationId: string; location: LocationData }` |

### 商店模块事件

| 事件名称 | 枚举值 | 触发时机 | Payload |
|----------|--------|----------|---------|
| `SHOP_OPENED` | `'shop_opened'` | 商店打开 | `{ characterId?: string; shopId: string }` |
| `SHOP_CLOSED` | `'shop_closed'` | 商店关闭 | `{ shopId?: string }` |
| `SHOP_TRANSACTION` | `'shop_transaction'` | 交易完成 | `{ shopId?: string; itemId: string; quantity?: number; totalPrice?: number; sellPrice?: number }` |

### 任务模块事件

| 事件名称 | 枚举值 | 触发时机 | Payload |
|----------|--------|----------|---------|
| `QUEST_BOARD_OPENED` | `'quest_board_opened'` | 任务看板打开 | `{ characterId?: string; boardId: string }` |
| `QUEST_ACCEPTED` | `'quest_accepted'` | 接受任务 | `{ questId: string; definition: QuestDefinition }` |
| `QUEST_COMPLETED` | `'quest_completed'` | 完成任务 | `{ questId: string; definition: QuestDefinition }` |
| `QUEST_REWARDED` | `'quest_rewarded'` | 任务交付 | `{ questId: string; definition: QuestDefinition }` |

### 技能模块事件

| 事件名称 | 枚举值 | 触发时机 | Payload |
|----------|--------|----------|---------|
| `SKILL_LEARNED` | `'skill_learned'` | 技能学习 | `{ skill: Skill }` |
| `SKILL_CAST` | `'skill_cast'` | 技能施放 | `{ skill: Skill; success: boolean }` |

### 游戏数据事件

| 事件名称 | 枚举值 | 触发时机 | Payload |
|----------|--------|----------|---------|
| `GAME_DATA_UPDATED` | `'game_data_updated'` | 游戏数据更新 | `{ type: string; action: string; id: string }` |

### 日志事件

| 事件名称 | 枚举值 | 触发时机 | Payload |
|----------|--------|----------|---------|
| `LOG_ENTRY_ADDED` | `'log_entry_added'` | 冒险日志新增 | `{ type: string; message: string; icon?: string }` |

### UI 事件

| 事件名称 | 枚举值 | 触发时机 | Payload |
|----------|--------|----------|---------|
| `UI_PANEL_OPENED` | `'ui_panel_opened'` | 面板打开 | `{ panel: string }` |
| `UI_PANEL_CLOSED` | `'ui_panel_closed'` | 面板关闭 | `{ panel: string }` |
| `UI_CLICK` | `'ui_click'` | UI点击 | `{ source: string }` |
| `CONFIRM_CONFIRMED` | `'confirm_confirmed'` | 确认对话框确认 | `{ action: string }` |
| `CONFIRM_CANCELED` | `'confirm_canceled'` | 确认对话框取消 | `{ action: string }` |

### 物品事件

| 事件名称 | 枚举值 | 触发时机 | Payload |
|----------|--------|----------|---------|
| `ITEM_DROPPED` | `'item_dropped'` | 物品丢弃 | `{ itemId: string }` |

### 存档事件

| 事件名称 | 枚举值 | 触发时机 | Payload |
|----------|--------|----------|---------|
| `DATA_EXPORTED` | `'data_exported'` | 数据导出 | `null` |
| `DATA_IMPORTED` | `'data_imported'` | 数据导入 | `null` |

---

## 事件发布方 → 订阅方交互矩阵

| 发布方 | 事件 | 订阅方 | 处理动作 |
|--------|------|--------|----------|
| 战斗模块 | `COMBAT_START` | UI组件 | 显示战斗界面 + 播放音效 |
| 战斗模块 | `COMBAT_END` | UI组件 / 探索模块 | 显示战斗结果弹窗 / 探索战斗结果处理 |
| 战斗模块 | `COMBAT_DEAL_DAMAGE` | UI组件 | 显示伤害数字 + 音效 |
| 战斗模块 | `COMBAT_CAST_HEAL` | UI组件 | 显示治疗数字 + 音效 |
| 战斗模块 | `COMBAT_CRITICAL_HIT` | UI组件 | 暴击视觉特效 |
| 战斗模块 | `COMBAT_DODGE` | UI组件 | 闪避视觉特效 + 音效 |
| 战斗模块 | `COMBAT_BOSS_INTRO` | UI组件 | Boss 出场动画 |
| 战斗模块 | `COMBAT_BOSS_PHASE` | UI组件 | Boss 阶段转换特效 |
| 探索模块 | `EXPLORATION_BATTLE_TRIGGERED` | 战斗模块 | 启动战斗 |
| 探索模块 | `EXPLORATION_ITEM_FOUND` | UI组件 | 物品发现提示 |
| 探索模块 | `EXPLORATION_CELL_EXPLORED` | UI组件 | 格子翻开动画 |
| 角色模块 | `CHARACTER_LEVEL_UP` | UI组件 | 升级特效/通知 |
| 角色模块 | `CHARACTER_DEATH` | UI组件 | 死亡界面 |
| 任务模块 | `QUEST_COMPLETED` | UI组件 | 任务完成通知 |
| 商店模块 | `SHOP_TRANSACTION` | UI组件 | 交易完成提示 + 音效 |

---

## 类型定义

```typescript
/** 事件回调函数类型（内部存储使用 unknown[] 保证异构回调兼容） */
export type EventCallback = (...args: unknown[]) => void;

/** 事件监听器映射（内部存储，key 为 string） */
export interface EventListeners {
  [event: string]: EventCallback[];
}

/** 分组监听器记录（内部存储） */
export interface GroupListeners {
  [groupName: string]: Array<{ event: string; callback: EventCallback }>;
}

/** 事件总线接口（公共契约，所有方法使用泛型约束） */
export interface IEventBus {
  on<K extends keyof GameEventPayloadMap>(event: K, callback: (data: GameEventPayloadMap[K]) => void): void;
  off<K extends keyof GameEventPayloadMap>(event: K, callback: (data: GameEventPayloadMap[K]) => void): void;
  emit<K extends keyof GameEventPayloadMap>(event: K, data: GameEventPayloadMap[K]): void;
  once<K extends keyof GameEventPayloadMap>(event: K, callback: (data: GameEventPayloadMap[K]) => void): void;
  onGroup<K extends keyof GameEventPayloadMap>(groupName: string, event: K, callback: (data: GameEventPayloadMap[K]) => void): void;
  clearGroup(groupName: string): void;
  clearAll(): void;
  removeEvent(event: string): void;
}
```

### 完整 GameEvents 枚举

```typescript
export enum GameEvents {
  // ==================== 角色 ====================
  CHARACTER_CREATED = 'character_created',
  CHARACTER_DELETED = 'character_deleted',
  CHARACTER_LOGOUT = 'character_logout',
  CHARACTER_LEVEL_UP = 'character_level_up',
  CHARACTER_DEATH = 'character_death',
  CHARACTER_RESURRECTED = 'character_resurrected',

  // ==================== 战斗 ====================
  COMBAT_START = 'combat_start',
  COMBAT_END = 'combat_end',
  COMBAT_PLAYER_TURN = 'combat_player_turn',
  COMBAT_ENEMY_TURN = 'combat_enemy_turn',
  COMBAT_DEAL_DAMAGE = 'combat_deal_damage',
  COMBAT_CAST_HEAL = 'combat_cast_heal',
  COMBAT_CRITICAL_HIT = 'combat_critical_hit',
  COMBAT_DODGE = 'combat_dodge',

  // ==================== 探索 ====================
  EXPLORATION_START = 'exploration_start',
  EXPLORATION_END = 'exploration_end',
  EXPLORATION_CELL_EXPLORED = 'exploration_cell_explored',
  EXPLORATION_BATTLE_TRIGGERED = 'exploration_battle_triggered',
  EXPLORATION_CAMP_USED = 'exploration_camp_used',
  EXPLORATION_ITEM_FOUND = 'exploration_item_found',
  EXPLORATION_TRAP_TRIGGERED = 'exploration_trap_triggered',
  EXPLORATION_RANDOM_EVENT = 'exploration_random_event',

  // ==================== 区域 ====================
  ZONE_ENTERED = 'zone_entered',

  // ==================== 商店 ====================
  SHOP_OPENED = 'shop_opened',
  SHOP_TRANSACTION = 'shop_transaction',
  SHOP_CLOSED = 'shop_closed',

  // ==================== 任务 ====================
  QUEST_BOARD_OPENED = 'quest_board_opened',
  QUEST_ACCEPTED = 'quest_accepted',
  QUEST_COMPLETED = 'quest_completed',
  QUEST_REWARDED = 'quest_rewarded',

  // ==================== 技能 ====================
  SKILL_LEARNED = 'skill_learned',
  SKILL_CAST = 'skill_cast',

  // ==================== 游戏数据 ====================
  GAME_DATA_UPDATED = 'game_data_updated',

  // ==================== 日志 ====================
  LOG_ENTRY_ADDED = 'log_entry_added',

  // ==================== UI ====================
  UI_PANEL_OPENED = 'ui_panel_opened',
  UI_PANEL_CLOSED = 'ui_panel_closed',
  UI_CLICK = 'ui_click',
  CONFIRM_CONFIRMED = 'confirm_confirmed',
  CONFIRM_CANCELED = 'confirm_canceled',

  // ==================== 物品 ====================
  ITEM_DROPPED = 'item_dropped',

  // ==================== 战斗补充 ====================
  COMBAT_SKIP_TURN = 'combat_skip_turn',
  COMBAT_BOSS_INTRO = 'combat_boss_intro',
  COMBAT_BOSS_PHASE = 'combat_boss_phase',

  // ==================== 存档 ====================
  DATA_EXPORTED = 'data_exported',
  DATA_IMPORTED = 'data_imported'
}
```

### 完整 GameEventPayloadMap 接口

```typescript
export interface GameEventPayloadMap {
  [GameEvents.CHARACTER_CREATED]: { characterId: string; name: string };
  [GameEvents.CHARACTER_DELETED]: { characterId: string };
  [GameEvents.CHARACTER_LOGOUT]: null;
  [GameEvents.CHARACTER_LEVEL_UP]: { oldLevel: number; newLevel: number };
  [GameEvents.CHARACTER_DEATH]: { cause: string };
  [GameEvents.CHARACTER_RESURRECTED]: { newHp: number; newMp: number };
  [GameEvents.COMBAT_START]: { enemy: EnemyInstance };
  [GameEvents.COMBAT_END]: { result: string; enemy: EnemyInstance | null; expGained: number; goldGained?: number };
  [GameEvents.COMBAT_PLAYER_TURN]: null;
  [GameEvents.COMBAT_ENEMY_TURN]: null;
  [GameEvents.COMBAT_DEAL_DAMAGE]: { amount: number; damageType: 'physical' | 'magic'; targetName: string; actorType?: 'player' | 'enemy' };
  [GameEvents.COMBAT_CAST_HEAL]: { amount: number; healType: 'health' | 'mana' | 'buff' | 'debuff'; targetName: string };
  [GameEvents.COMBAT_CRITICAL_HIT]: { amount: number; damageType: 'physical' | 'magic'; targetName: string; actorType: 'player' | 'enemy' };
  [GameEvents.COMBAT_DODGE]: { attackerName: string; dodgerName: string; dodgerType: 'player' | 'enemy' };
  [GameEvents.EXPLORATION_START]: { characterId: string | null; areaId?: string };
  [GameEvents.EXPLORATION_END]: { characterId: string | null };
  [GameEvents.EXPLORATION_CELL_EXPLORED]: { characterId: string | null; x: number; y: number; cellType?: string; interactionId?: string };
  [GameEvents.EXPLORATION_BATTLE_TRIGGERED]: { characterId: string | null; eventData: { monsterId: string; areaLevel: number } };
  [GameEvents.EXPLORATION_CAMP_USED]: { characterId: string | null };
  [GameEvents.EXPLORATION_ITEM_FOUND]: { characterId: string | null; itemId: string; count: number; itemName?: string };
  [GameEvents.EXPLORATION_TRAP_TRIGGERED]: { characterId: string | null; damage: number; trapType?: string };
  [GameEvents.EXPLORATION_RANDOM_EVENT]: { characterId: string | null; message: string; icon: string };
  [GameEvents.ZONE_ENTERED]: { locationId: string; location: LocationData };
  [GameEvents.SHOP_OPENED]: { characterId?: string; shopId: string };
  [GameEvents.SHOP_CLOSED]: { shopId?: string };
  [GameEvents.SHOP_TRANSACTION]: { shopId?: string; itemId: string; quantity?: number; totalPrice?: number; sellPrice?: number };
  [GameEvents.QUEST_BOARD_OPENED]: { characterId?: string; boardId: string };
  [GameEvents.QUEST_ACCEPTED]: { questId: string; definition: QuestDefinition };
  [GameEvents.QUEST_COMPLETED]: { questId: string; definition: QuestDefinition };
  [GameEvents.QUEST_REWARDED]: { questId: string; definition: QuestDefinition };
  [GameEvents.SKILL_LEARNED]: { skill: Skill };
  [GameEvents.SKILL_CAST]: { skill: Skill; success: boolean };
  [GameEvents.GAME_DATA_UPDATED]: { type: string; action: string; id: string };
  [GameEvents.LOG_ENTRY_ADDED]: { type: string; message: string; icon?: string };
  [GameEvents.UI_PANEL_OPENED]: { panel: string };
  [GameEvents.UI_PANEL_CLOSED]: { panel: string };
  [GameEvents.CONFIRM_CONFIRMED]: { action: string };
  [GameEvents.CONFIRM_CANCELED]: { action: string };
  [GameEvents.ITEM_DROPPED]: { itemId: string };
  [GameEvents.COMBAT_SKIP_TURN]: null;
  [GameEvents.COMBAT_BOSS_INTRO]: { enemyId: string; enemyName: string; icon: string; effect: string; lines: string[]; duration: number };
  [GameEvents.COMBAT_BOSS_PHASE]: { enemyId: string; enemyName: string; phaseName: string; effect: string };
  [GameEvents.DATA_EXPORTED]: null;
  [GameEvents.DATA_IMPORTED]: null;
  [GameEvents.UI_CLICK]: { source: string };
}
```

**外部类型依赖**（来自其他模块）：
- `EnemyInstance`（来自 `modules/enemy/types`）
- `LocationData`（来自 `modules/map/types`）
- `QuestDefinition`（来自 `modules/quest/types`）
- `Skill`（来自 `modules/skill/types`）

---

## 设计原则

1. **UI/音效事件优先**：EventBus 仅发布 UI 渲染和音效播放类事件，不传递数据变更通知
2. **数据变更走 Store**：模块间的数据变更通信通过直接调用 Store Action 实现
3. **事件命名统一**：使用 `GameEvents` 枚举确保事件名不重复、可追溯
4. **类型安全**：`emit`/`on`/`off`/`once`/`onGroup` 通过 `K extends keyof GameEventPayloadMap` 泛型约束确保 payload 类型正确
5. **错误容错**：监听器内部异常通过 try-catch 捕获并 `console.error`，不中断其他监听器
6. **快照遍历**：`emit` 对回调数组 `slice()` 快照后遍历，防止监听器执行中 `off`/`clearGroup` 修改原数组导致跳过或重复触发（P3-10）
7. **精确移除**：`clearGroup` 使用 `indexOf`+`splice` 精确移除，避免 `filter` 误删通过 `on()` 另行注册的同引用回调
8. **分组清理**：`removeEvent` 同步清理 `groups` 中涉及该事件的记录，防止分组数据残留

---

## 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-19 | 初始版本，汇总所有模块事件定义 | System |
| v2.0 | 2026-05-19 | 重新整理所有模块事件，更新交互矩阵 | System |
| v2.1 | 2026-05-19 | 添加事件处理优先级机制文档 | System |
| v2.2 | 2026-05-19 | 添加防抖（Debounce）功能文档 | System |
| v2.3 | 2026-05-19 | 添加节流（Throttle）功能文档 | System |
| v3.0 | 2026-06-16 | 修正模块路径为 `modules/bus`，更新文件结构为 `index.ts`/`core.ts`/`types.ts` | System |
| v4.0 | 2026-06-16 | 全面重写：移除不存在的优先级/防抖/节流功能；修正事件列表为实际 GameEvents 枚举；修正 API 签名；新增 onGroup/clearGroup/removeEvent；修正交互矩阵 | System |
| v4.1 | 2026-06-17 | 逐文件比对修正：探索事件 characterId 类型标注为 `string \| null` | System |
| v5.0 | 2026-07-10 | 严格对齐源码重写：修正 EventCallback 类型为 unknown[]；修正 API 签名均使用泛型 K extends keyof GameEventPayloadMap；修正 COMBAT_START/COMBAT_END 载荷类型为 EnemyInstance；补充完整 IEventBus 接口与完整 GameEventPayloadMap（含全部 39 个事件映射）；补充 emit 快照遍历（P3-10）、clearGroup 精确移除、removeEvent 同步清理 groups 等实现细节；补充枚举字符串值 | System |

---

**文档结束**
