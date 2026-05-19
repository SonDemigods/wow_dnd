# 数据持久化架构概述

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 数据持久化架构设计文档 |
| 版本 | v1.0 |
| 生成日期 | 2026年5月19日 |

---

## 架构概述

### 1.1 设计目标

本架构采用 **Pinia** 作为首要数据存储方案，实现以下核心目标：

1. **统一的数据管理**：所有核心业务数据通过 Pinia 进行状态管理与操作
2. **自动持久化**：Pinia 状态变更时自动同步到 IndexedDB
3. **高性能**：使用 IndexedDB 替代 localStorage，提升存储容量和性能
4. **可靠性**：实现错误处理、重试机制和数据校验
5. **一致性**：确保内存状态与持久化状态的一致性

### 1.2 核心组件

| 组件 | 职责 | 优先级 |
|------|------|----------|
| DatabaseManager | 数据库初始化、版本管理 | P0 |
| IndexedDBService | CRUD 操作封装 | P0 |
| SyncEngine | 状态变更监听与自动同步 | P0 |
| ErrorHandler | 异常处理与重试机制 | P1 |
| StorePlugin | Pinia 插件，自动注入持久化能力 | P0 |

### 1.3 数据流向

```
用户操作 → Vue 组件 → Pinia Store → SyncEngine → IndexedDB
                                    ↓
                              自动同步（防抖 500ms）
                                    ↓
                              批量写入数据库
```

---

## 核心机制

### 2.1 自动同步机制

**触发条件**：
- Pinia store 状态发生变更时
- 使用防抖机制，500ms 内的多次变更合并为一次同步
- 页面卸载前（beforeunload 事件）强制同步

**同步策略**：
- 自动同步：状态变更后自动写入 IndexedDB
- 批量写入：合并 500ms 内的所有变更
- 重试机制：失败时自动重试 3 次，指数退避

### 2.2 错误处理机制

**异常类型**：
- 数据库连接失败
- 写入失败
- 数据校验失败
- 版本冲突

**处理策略**：
- 立即重试：最多 3 次，指数退避
- 队列重试：失败的操作进入重试队列
- 日志记录：所有错误记录到控制台
- 数据校验：写入前验证数据结构

### 2.3 数据加载机制

**加载时机**：
- Store 初始化时异步加载
- 页面刷新后自动恢复

**加载流程**：
1. 创建 Store 实例
2. 异步从 IndexedDB 读取数据
3. 使用 $patch 更新 Store 状态
4. 触发响应式更新

---

## 存储结构

### 3.1 数据库配置

```typescript
DB_CONFIG = {
  name: 'wow_dnd_game',
  version: 1,
  stores: {
    character: { keyPath: 'id' },
    inventory: { keyPath: 'id' },
    quests: { keyPath: 'questKey' },
    equipment: { keyPath: 'id' },
    map: { keyPath: 'id' },
    skills: { keyPath: 'id' },
    exploration: { keyPath: 'id' },
    npc: { keyPath: 'id' },
    combat: { keyPath: 'id' },
    adventureLog: { keyPath: 'id' },
    shop: { keyPath: 'id' },
    gameState: { keyPath: 'id' }
  }
}
```

### 3.2 Store 到数据库的映射

| Store | 数据库 Store | Key | 说明 |
|-------|--------------|-----|------|
| useCharacterStore | character | 'character' | 角色属性和状态 |
| useInventoryStore | inventory | 'inventory' | 背包物品 |
| useQuestStore | quests | 'quests' | 任务进度 |
| useEquipmentStore | equipment | 'equipment' | 装备数据 |
| useMapStore | map | 'map' | 地图数据 |
| useSkillsStore | skills | 'skills' | 技能数据 |
| useExplorationStore | exploration | 'exploration' | 探索数据 |
| useNPCStore | npc | 'npc' | NPC 数据 |
| useCombatStore | combat | 'combat' | 战斗数据 |
| useAdventureLogStore | adventureLog | 'adventureLog' | 冒险日志 |
| useShopStore | shop | 'shop' | 商店数据 |
| useGameStore | gameState | 'gameState' | 游戏状态 |

---

## 使用指南

### 4.1 基本使用

```typescript
import { useCharacterStore } from '@/modules/character';

// 直接使用 Store，数据变更会自动同步
const characterStore = useCharacterStore();
characterStore.addGold(100); // 自动同步到 IndexedDB
```

### 4.2 手动同步

```typescript
import { syncEngine } from '@/services/database';

// 立即同步（用于关键操作）
await syncEngine.immediateSync('character', 'character', data);

// 刷新所有待处理的同步
await syncEngine.flush();
```

### 4.3 数据加载

```typescript
import { syncEngine } from '@/services/database';

// 加载特定 Store 的数据
const data = await syncEngine.loadFromStore('character', 'character');
```

### 4.4 清空数据

```typescript
import { syncEngine } from '@/services/database';

// 清空特定 Store
await syncEngine.clearStore('character');

// 清空所有数据（游戏重置）
for (const storeName of Object.values(STORE_NAMES)) {
  await syncEngine.clearStore(storeName);
}
```

---

## 性能优化

### 5.1 防抖策略

- 默认防抖时间：500ms
- 可通过 SyncEngine.setOptions 调整
- 适用于频繁变更的场景（如战斗中的 HP 变化）

### 5.2 批量写入

- 合并 500ms 内的所有变更
- 减少数据库写入次数
- 提升整体性能

### 5.3 索引优化

- 常用查询字段建立索引
- character: name 索引
- quests: status 索引
- adventureLog: timestamp 索引

---

## 错误处理

### 6.1 重试策略

```typescript
{
  maxRetries: 3,      // 最大重试次数
  delay: 1000,         // 初始延迟（ms）
  backoff: 'exponential' // 指数退避
}
```

### 6.2 数据校验

写入前验证：
- 必填字段检查
- 类型检查
- 数据完整性检查

### 6.3 日志记录

- 所有错误记录到控制台
- 包含上下文信息
- 便于调试和监控

---

## 版本管理

### 7.1 数据库版本升级

当需要升级数据库结构时：

1. 增加 DB_CONFIG.version
2. 在 DatabaseManager.onupgradeneeded 中处理迁移逻辑
3. 保持向后兼容

### 7.2 数据迁移

```typescript
// 在 DatabaseManager 中处理
request.onupgradeneeded = (event) => {
  const db = (event.target as IDBOpenDBRequest).result;
  const oldVersion = event.oldVersion;

  if (oldVersion < 2) {
    // 迁移到版本 2
    migrateV1toV2(db);
  }
};
```

---

## 最佳实践

### 8.1 Store 设计原则

1. **单一职责**：每个 Store 管理一个领域的数据
2. **响应式**：使用 ref 和 computed 管理状态
3. **不可变性**：通过方法修改状态，避免直接赋值
4. **自动同步**：不手动调用保存方法，依赖 SyncEngine

### 8.2 数据结构设计

1. **版本字段**：每个记录包含 updatedAt 字段
2. **唯一标识**：使用有意义的 ID 作为 keyPath
3. **规范化**：避免冗余数据，使用引用

### 8.3 错误处理

1. **防御性编程**：所有 IO 操作包裹 try-catch
2. **降级处理**：IndexedDB 不可用时降级到内存
3. **用户反馈**：关键错误显示通知

---

## 与 localStorage 架构的对比

| 特性 | localStorage（旧架构） | IndexedDB（新架构） |
|------|------------------------|---------------------|
| 存储容量 | 约 5MB | 无硬性限制（由浏览器配置） |
| 性能 | 同步 IO，阻塞主线程 | 异步 IO，不阻塞 |
| 查询能力 | 仅支持键值对 | 支持索引、范围查询 |
| 数据类型 | 仅支持字符串 | 支持任意可序列化数据 |
| 事务支持 | 无 | 完整事务支持 |
| 存储方式 | 各 Store 独立键 | 统一数据库，多对象存储 |

---

## 迁移指南

### 旧 localStorage 键到新 IndexedDB 存储的映射

| 旧 localStorage 键 | 新 IndexedDB Store | 新 Key |
|-------------------|---------------------|--------|
| wow_character | character | character |
| wow_character_info | character | character |
| wow_inventory | inventory | inventory |
| wow_quests_* | quests | quests |
| wow_equipment | equipment | equipment |
| wow_map | map | map |
| wow_skills | skills | skills |
| wow_exploration | exploration | exploration |
| wow_npc | npc | npc |
| wow_combat | combat | combat |
| wow_adventureLog | adventureLog | adventureLog |
| wow_shop | shop | shop |

---

**文档结束**
