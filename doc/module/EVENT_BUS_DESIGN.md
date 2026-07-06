# 事件总线设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 事件总线设计文档 |
| 版本 | v4.1 |
| 生成日期 | 2026年6月17日 |
| 所属模块 | `modules/bus` |
| 更新说明 | 逐文件比对修正：探索事件 characterId 类型标注为 `string \| null` |

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
| 类型安全 | `GameEventPayloadMap` 确保 emit/on 的 payload 类型正确 |
| 错误容错 | 监听器异常不中断其他监听器执行 |

---

## 模块文件结构

```
src/modules/bus/
  ├── index.ts          # 模块统一导出入口
  ├── core.ts           # 事件总线核心实现（EventBus 类 + eventBus 单例）
  └── types.ts          # GameEvents 枚举、GameEventPayloadMap、类型定义
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | 模块统一导出入口，导出 types 和 core |
| `core.ts` | EventBus 类实现（on/off/emit/once/onGroup/clearGroup/clearAll/removeEvent） |
| `types.ts` | GameEvents 枚举定义、GameEventPayloadMap 类型映射、EventCallback 类型 |

---

## EventBus 类 API

```typescript
export class EventBus {
  /** 注册事件监听器 */
  on(event: string, callback: EventCallback): void;

  /** 取消事件监听器 */
  off(event: string, callback: EventCallback): void;

  /** 触发事件（类型安全） */
  emit<K extends keyof GameEventPayloadMap>(event: K, data: GameEventPayloadMap[K]): void;

  /** 注册一次性事件监听器（触发一次后自动取消） */
  once(event: string, callback: EventCallback): void;

  /** 按分组注册事件监听器（便于模块级批量管理） */
  onGroup(groupName: string, event: string, callback: EventCallback): void;

  /** 清除指定分组的所有事件监听器 */
  clearGroup(groupName: string): void;

  /** 清除所有事件监听器 */
  clearAll(): void;

  /** 移除指定事件的所有监听器 */
  removeEvent(event: string): void;
}
```

### 使用示例

```typescript
// 注册监听器
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

1. **大写加下划线格式**：所有事件名称统一使用大写字母，单词之间用下划线分隔
2. **模块前缀**：事件名以模块缩写开头，确保命名空间隔离
3. **动词后缀**：事件名使用动词过去式表示已完成动作（`_START`、`_END`、`_CREATED`、`_COMPLETED` 等）

---

## 完整事件列表

### 角色模块事件

| 事件名称 | 触发时机 | Payload |
|----------|----------|---------|
| `CHARACTER_CREATED` | 角色创建成功 | `{ characterId, name }` |
| `CHARACTER_DELETED` | 角色删除成功 | `{ characterId }` |
| `CHARACTER_LOGOUT` | 角色退出登录 | `null` |
| `CHARACTER_LEVEL_UP` | 角色升级 | `{ oldLevel, newLevel }` |
| `CHARACTER_DEATH` | 角色死亡 | `{ cause }` |
| `CHARACTER_RESURRECTED` | 角色复活 | `{ newHp, newMp }` |

### 战斗模块事件

| 事件名称 | 触发时机 | Payload |
|----------|----------|---------|
| `COMBAT_START` | 战斗开始 | `{ enemy: Enemy }` |
| `COMBAT_END` | 战斗结束 | `{ result, enemy, expGained, goldGained? }` |
| `COMBAT_PLAYER_TURN` | 玩家回合开始 | `null` |
| `COMBAT_ENEMY_TURN` | 敌人回合开始 | `null` |
| `COMBAT_DEAL_DAMAGE` | 造成伤害（音效/特效） | `{ amount, damageType, targetName, actorType? }` |
| `COMBAT_CAST_HEAL` | 治疗（音效/特效） | `{ amount, healType, targetName }` |
| `COMBAT_CRITICAL_HIT` | 暴击（视觉特效） | `{ amount, damageType, targetName, actorType }` |
| `COMBAT_DODGE` | 闪避（音效/特效） | `{ attackerName, dodgerName, dodgerType }` |
| `COMBAT_SKIP_TURN` | 跳过回合 | `null` |
| `COMBAT_BOSS_INTRO` | Boss 出场演出 | `{ enemyId, enemyName, icon, effect, lines, duration }` |
| `COMBAT_BOSS_PHASE` | Boss 阶段转换 | `{ enemyId, enemyName, phaseName, effect }` |

### 探索模块事件

| 事件名称 | 触发时机 | Payload |
|----------|----------|---------|
| `EXPLORATION_START` | 探索开始 | `{ characterId: string \| null, areaId? }` |
| `EXPLORATION_END` | 探索结束 | `{ characterId: string \| null }` |
| `EXPLORATION_CELL_EXPLORED` | 格子翻开 | `{ characterId: string \| null, x, y, cellType?, interactionId? }` |
| `EXPLORATION_BATTLE_TRIGGERED` | 触发战斗 | `{ characterId: string \| null, eventData: { monsterId, areaLevel } }` |
| `EXPLORATION_CAMP_USED` | 营地使用 | `{ characterId: string \| null }` |
| `EXPLORATION_ITEM_FOUND` | 发现物品 | `{ characterId: string \| null, itemId, count, itemName? }` |
| `EXPLORATION_TRAP_TRIGGERED` | 触发陷阱 | `{ characterId: string \| null, damage, trapType? }` |
| `EXPLORATION_RANDOM_EVENT` | 随机事件 | `{ characterId: string \| null, message, icon }` |

### 商店模块事件

| 事件名称 | 触发时机 | Payload |
|----------|----------|---------|
| `SHOP_OPENED` | 商店打开 | `{ characterId?, shopId }` |
| `SHOP_CLOSED` | 商店关闭 | `{ shopId? }` |
| `SHOP_TRANSACTION` | 交易完成 | `{ shopId?, itemId, quantity?, totalPrice?, sellPrice? }` |

### 任务模块事件

| 事件名称 | 触发时机 | Payload |
|----------|----------|---------|
| `QUEST_BOARD_OPENED` | 任务看板打开 | `{ characterId?, boardId }` |
| `QUEST_ACCEPTED` | 接受任务 | `{ questId, definition: QuestDefinition }` |
| `QUEST_COMPLETED` | 完成任务 | `{ questId, definition: QuestDefinition }` |
| `QUEST_REWARDED` | 任务交付 | `{ questId, definition: QuestDefinition }` |

### 技能模块事件

| 事件名称 | 触发时机 | Payload |
|----------|----------|---------|
| `SKILL_LEARNED` | 技能学习 | `{ skill: Skill }` |
| `SKILL_CAST` | 技能施放 | `{ skill: Skill, success }` |

### 通用事件

| 事件名称 | 触发时机 | Payload |
|----------|----------|---------|
| `ZONE_ENTERED` | 进入区域 | `{ locationId, location: LocationData }` |
| `GAME_DATA_UPDATED` | 游戏数据更新 | `{ type, action, id }` |
| `LOG_ENTRY_ADDED` | 冒险日志新增 | `{ type, message, icon? }` |
| `UI_PANEL_OPENED` | 面板打开 | `{ panel }` |
| `UI_PANEL_CLOSED` | 面板关闭 | `{ panel }` |
| `UI_CLICK` | UI点击 | `{ source }` |
| `CONFIRM_CONFIRMED` | 确认对话框确认 | `{ action }` |
| `CONFIRM_CANCELED` | 确认对话框取消 | `{ action }` |
| `ITEM_DROPPED` | 物品丢弃 | `{ itemId }` |
| `DATA_EXPORTED` | 数据导出 | `null` |
| `DATA_IMPORTED` | 数据导入 | `null` |

---

## 事件发布方 → 订阅方交互矩阵

| 发布方 | 事件 | 订阅方 | 处理动作 |
|--------|------|--------|----------|
| 战斗模块 | `COMBAT_START` | UI组件 | 显示战斗界面 + 播放音效 |
| 战斗模块 | `COMBAT_END` | UI组件 | 显示战斗结果弹窗 |
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
/** 事件回调函数类型 */
export type EventCallback = (...args: any[]) => void;

/** 事件监听器映射 */
export interface EventListeners {
  [event: string]: EventCallback[];
}

/** 分组监听器记录 */
export interface GroupListeners {
  [groupName: string]: Array<{ event: string; callback: EventCallback }>;
}

/** 事件参数类型映射（确保类型安全） */
export interface GameEventPayloadMap {
  [GameEvents.CHARACTER_CREATED]: { characterId: string; name: string };
  [GameEvents.CHARACTER_DELETED]: { characterId: string };
  [GameEvents.CHARACTER_LOGOUT]: null;
  [GameEvents.CHARACTER_LEVEL_UP]: { oldLevel: number; newLevel: number };
  [GameEvents.CHARACTER_DEATH]: { cause: string };
  [GameEvents.CHARACTER_RESURRECTED]: { newHp: number; newMp: number };
  [GameEvents.COMBAT_START]: { enemy: Enemy };
  [GameEvents.COMBAT_END]: { result: string; enemy: Enemy | null; expGained: number; goldGained?: number };
  [GameEvents.COMBAT_PLAYER_TURN]: null;
  [GameEvents.COMBAT_ENEMY_TURN]: null;
  [GameEvents.COMBAT_DEAL_DAMAGE]: { amount: number; damageType: 'physical' | 'magic'; targetName: string; actorType?: 'player' | 'enemy' };
  [GameEvents.COMBAT_CAST_HEAL]: { amount: number; healType: 'health' | 'mana' | 'buff' | 'debuff'; targetName: string };
  [GameEvents.COMBAT_CRITICAL_HIT]: { amount: number; damageType: 'physical' | 'magic'; targetName: string; actorType: 'player' | 'enemy' };
  [GameEvents.COMBAT_DODGE]: { attackerName: string; dodgerName: string; dodgerType: 'player' | 'enemy' };
  // ... (其余映射见完整 GameEventPayloadMap)
}
```

---

## 设计原则

1. **UI/音效事件优先**：EventBus 仅发布 UI 渲染和音效播放类事件，不传递数据变更通知
2. **数据变更走 Store**：模块间的数据变更通信通过直接调用 Store Action 实现
3. **事件命名统一**：使用 GameEvents 枚举确保事件名不重复、可追溯
4. **类型安全**：emit 通过 GameEventPayloadMap 泛型约束确保 payload 类型正确
5. **错误容错**：监听器内部异常通过 try-catch 捕获并 console.error，不中断其他监听器

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

---

**文档结束**
