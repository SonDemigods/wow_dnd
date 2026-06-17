# 数据持久化架构概述

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 数据持久化架构设计文档 |
| 版本 | v3.0 |
| 生成日期 | 2026年6月17日 |
| 更新说明 | 逐文件比对代码修正：运行时表索引、备份命名格式、自动备份存储方式、校验和算法 |

---

## 1. 技术栈概述

### 1.1 核心技术

| 技术 | 用途 | 版本 |
|------|------|------|
| Vue 3 | 前端框架，Composition API + `<script setup>` 语法 | ^3.4.0 |
| TypeScript | 类型安全开发语言 | ^5.3.0 |
| Vite | 构建工具 | ^5.0.0 |
| Pinia | 状态管理 | ^2.1.7 |
| Dexie.js | IndexedDB 封装库，游戏数据持久化存储 | ^4.4.2 |
| Less | CSS 预处理器 | ^4.2.0 |
| anime.js | 动画引擎 | ^4.4.1 |
| Tone.js | Web Audio 音频引擎 | ^15.1.22 |

### 1.2 设计目标

1. **统一的数据管理**：所有核心业务数据通过 Pinia 进行状态管理与操作
2. **持久化存储**：使用 Dexie.js 封装的 IndexedDB 作为本地持久化方案
3. **高性能**：异步 IO，不阻塞主线程，支持批量操作
4. **可靠性**：内置重试机制和数据校验
5. **一致性**：每个模块独立管理自身的 Pinia Store 和数据库表

---

## 2. 架构设计

### 2.1 核心组件

| 组件 | 文件位置 | 职责 |
|------|----------|------|
| GameDatabase | `src/modules/data/core.ts` | 数据库初始化、表结构定义、版本管理（继承 Dexie） |
| DBService | `src/modules/data/core.ts` | 带重试机制的数据库操作封装 |
| dataInitializer | `src/modules/data/service.ts` | 游戏初始数据加载到 IndexedDB |
| gameStateHelper | `src/modules/data/gameStateHelper.ts` | 全局游戏状态读写辅助 |
| 各模块 Store | `src/modules/*/store.ts` | Pinia Store，各模块独立管理自身状态 |
| 各模块 DB | `src/modules/*/db.ts` | 各模块独立的数据库 CRUD 操作 |
| 各模块 Service | `src/modules/*/service.ts` | 各模块业务逻辑层 |

### 2.2 分层架构

```
┌─────────────────────────────────────────────────┐
│                   Vue 组件层                     │
│        src/components/ （视图组件）               │
├─────────────────────────────────────────────────┤
│                    业务逻辑层                     │
│   src/modules/*/service.ts （业务服务）          │
├─────────────────────────────────────────────────┤
│                    状态管理层                     │
│   src/modules/*/store.ts （Pinia Store）         │
├─────────────────────────────────────────────────┤
│                    数据持久层                     │
│   src/modules/*/db.ts （IndexedDB CRUD 操作）    │
├─────────────────────────────────────────────────┤
│                    数据库核心                     │
│   src/modules/data/core.ts （GameDatabase）      │
│   src/config/database.ts （数据库配置）           │
└─────────────────────────────────────────────────┘
```

### 2.3 数据流向

```
用户操作 → Vue 组件 → Service → Pinia Store → DB 层 → IndexedDB
                         ↓
                  自动触发响应式更新
                         ↓
                    Vue 组件重渲染
```

---

## 3. 数据库设计

### 3.1 数据库配置

```typescript
// src/config/database.ts
DATABASE_CONFIG = {
  name: 'wow_dnd_game',
  version: 1
}
```

### 3.2 数据表分类

数据库表按类型分为三类，使用统一的命名前缀：

#### 3.2.1 配置表（config_*）— 游戏定义数据，所有角色共享

| 表名 | 索引字段 | 说明 |
|------|----------|------|
| `config_factions` | `id, name` | 阵营配置数据 |
| `config_races` | `id, name, factionId` | 种族配置数据 |
| `config_classes` | `id, name, primaryStat` | 职业配置数据 |
| `config_items` | `id, name, type, rarity` | 物品模板数据 |
| `config_equipmentItems` | `id, name, type, rarity` | 装备物品模板数据 |
| `config_mobs` | `id, name, dangerLevel` | 普通怪物数据 |
| `config_bosses` | `id, name, dangerLevel` | Boss 怪物数据 |
| `config_quests` | `id, boardId, type` | 任务定义数据 |
| `config_skills` | `id, classRestriction, type, usableBy` | 技能定义数据 |
| `config_locations` | `id, type, continent` | 地图地点配置数据 |
| `config_shops` | `id` | 商店配置数据 |

#### 3.2.2 角色表（char_*）— 绑定角色ID，每个角色独立

| 表名 | Key | 索引 | 说明 |
|------|-----|------|------|
| `char_data` | `characterId` | `characterId` | 角色属性和状态 |
| `char_inventory` | `characterId` | `characterId` | 背包物品 |
| `char_equipment` | `characterId` | `characterId` | 装备数据 |
| `char_skills` | `characterId` | `characterId` | 技能数据 |
| `char_quests` | `[characterId+questId]` | `characterId, status` | 任务进度 |
| `char_exploration` | `characterId` | `characterId, currentAreaId` | 探索进度 |

#### 3.2.3 运行时表（runtime_*）— 日志和临时状态

| 表名 | 索引字段 | 说明 |
|------|----------|------|
| `runtime_gameState` | `id` | 全局游戏状态表，通过不同 `id` 值承载多类数据（`gameState` / `data_initialized` / `shop_config` / `game_constants`），读写操作使用事务保证原子性 |
| `runtime_combatLogs` | `combatId, timestamp` | 战斗日志 |
| `runtime_adventureLogs` | `characterId, timestamp` | 冒险日志 |
| `runtime_mapState` | `id` | 地图视图状态 |
| `runtime_shopItems` | `shopId` | 商店商品数据 |

### 3.3 多角色数据隔离机制

**核心原则**：除全局游戏状态外，所有角色相关数据均以 `characterId` 作为唯一标识，实现角色间数据完全隔离。

**存储模式说明**：

| 存储类型 | Key 策略 | 说明 |
|----------|----------|------|
| 配置表（config_*） | `id` | 游戏定义数据，全局共享 |
| 角色表（char_*） | `characterId` | 角色专属数据，完全隔离 |
| 运行时表（runtime_*） | 按需 | 全局状态或按角色隔离 |

**数据加载流程**：
1. 选择角色时，通过 `characterId` 加载该角色的所有关联数据（char_* 表）
2. 切换角色时，卸载当前角色数据，加载新角色数据
3. 删除角色时，级联删除该角色的所有关联数据

---

## 4. 模块架构

### 4.1 模块目录结构

每个模块遵循统一的标准结构：

```
src/modules/{moduleName}/
  ├── index.ts          # 模块统一导出入口
  ├── types.ts          # TypeScript 类型定义和接口
  ├── db.ts             # IndexedDB CRUD 操作封装
  ├── store.ts          # Pinia 状态管理
  └── service.ts        # 业务逻辑服务
```

### 4.2 模块列表

| 模块目录 | 模块名称 | 说明 |
|----------|----------|------|
| `modules/data/` | 数据核心 | 数据库初始化、游戏状态管理、备份导入 |
| `modules/bus/` | 事件总线 | 模块间解耦通信 |
| `modules/character/` | 角色 | 角色创建、属性管理、成长系统 |
| `modules/inventory/` | 背包 | 物品存储、使用、堆叠、排序 |
| `modules/equipment/` | 装备 | 装备穿戴、属性加成、稀有度系统 |
| `modules/skill/` | 技能 | 技能学习、技能栏配置、技能使用 |
| `modules/combat/` | 战斗 | 回合制战斗、AI、效果系统 |
| `modules/quest/` | 任务 | 任务接受、进度追踪、交付奖励 |
| `modules/shop/` | 商店 | 商品刷新、购买/出售、交易记录 |
| `modules/map/` | 地图 | 地图视图、地点解锁、探索入口 |
| `modules/exploration/` | 探索 | 10x10 探索网格、营地、事件触发 |
| `modules/log/` | 冒险日志 | 游戏事件记录、日志查询 |
| `modules/enemy/` | 敌人 | 敌人实例管理和数据 |
| `modules/boss/` | Boss | Boss 战斗引擎和入场逻辑 |
| `modules/base/` | 基础数据 | 阵营、种族、职业等基础数据管理 |
| `modules/audio/` | 音频 | 基于 Tone.js 的音频管理 |
| `modules/animation/` | 动画 | 战斗效果动画 |
| `modules/admin/` | 后台管理 | 配置管理和数据管理 |

### 4.3 模块间依赖

```
data (数据库核心) ──── 被所有模块依赖
bus (事件总线) ────── 被所有模块依赖
base (基础数据) ───── 被 character 依赖
character ────────── 被 combat、quest、shop、skill、equipment 等依赖
enemy ────────────── 被 combat 依赖
boss ─────────────── 被 combat、exploration 依赖
exploration ──────── 触发 combat、shop、quest 模块交互
```

---

## 5. 数据库操作模式

### 5.1 标准 CRUD 操作

每个模块的 `db.ts` 提供标准化的数据库操作：

```typescript
// 示例：modules/character/db.ts
export function loadCharacterData(characterId: string): Promise<CharacterStorage | undefined>
export function saveCharacterData(data: CharacterStorage): Promise<void>
export function deleteCharacterData(characterId: string): Promise<void>
```

### 5.2 重试机制

通过 `DBService` 类提供带指数退避的重试机制：

```typescript
// src/config/database.ts
DB_SERVICE_CONFIG = {
  maxRetries: 3,
  delay: 1000,           // 初始延迟 1 秒
  backoff: 'exponential' // 指数退避
}
```

### 5.3 数据初始化

[DataInitializer](file:///d:/workspace/HTML/wow_dnd/src/modules/data/service.ts) 类的 `initializeData()` 方法在首次运行时检查 `data_initialized` 标志，若未初始化则在事务中将静态配置文件（`src/data/` 目录）中的数据导入到 IndexedDB 对应表中。初始化完成后通过 `GameEvents.GAME_DATA_UPDATED` 事件通知相关 Store 重新加载数据。

---

## 6. 数据备份与导入

### 6.1 功能概述

数据备份与导入模块（`modules/data/`）允许用户在更换设备或重新安装应用时进行存档迁移。

### 6.2 备份机制

- **手动触发**：用户主动点击备份按钮，导出 JSON 文件下载
- **自动备份**：游戏存档变更后自动备份，存储在 `localStorage` 中（键名 `wow_dnd_auto_backups`），保留最近 5 份
- **文件格式**：`.json` 格式，UTF-8 编码
- **文件命名**：`wow_dnd_backup_{ISO时间戳}.json`（如 `wow_dnd_backup_2026-06-17T08-30-00-000Z.json`）

### 6.3 导入校验

导入时依次进行：文件格式校验 → 版本兼容性校验 → checksum 校验 → 数据结构完整性校验 → 数据类型校验

### 6.4 备份文件结构

```typescript
interface BackupFile {
  version: string;           // 备份格式版本
  timestamp: number;         // 备份时间戳
  checksum: string;          // 简单哈希校验和
  gameVersion: string;       // 游戏版本号
  data: BackupData;          // 完整游戏数据
}
```

---

## 7. 性能优化

### 7.1 异步加载

- Store 初始化时异步从 IndexedDB 读取数据
- 不阻塞主线程
- 使用 await/async 模式

### 7.2 计算缓存

- 角色属性通过 `computed` 缓存次级属性计算结果
- 装备总属性通过 computed 避免重复计算
- 技能栏预缓存已装备技能列表

### 7.3 索引优化

- 常用查询字段建立索引（`name`, `characterId`, `status`, `type`）
- 多键索引支持复杂查询（如 `[characterId+questId]`）

---

## 8. 错误处理

### 8.1 重试策略

| 参数 | 值 | 说明 |
|------|-----|------|
| maxRetries | 3 | 最大重试次数 |
| delay | 1000ms | 初始延迟 |
| backoff | exponential | 指数退避（1s → 2s → 4s） |

### 8.2 异常处理

- 所有数据库 IO 操作包裹 try-catch
- 读取失败时使用默认值初始化（不中断程序）
- 写入失败时进入重试队列
- 关键错误记录到控制台

---

## 9. 配置与数据文件

### 9.1 运行时配置（src/config/）

| 文件 | 内容 |
|------|------|
| `config/character.ts` | 最大等级(20)、属性名映射、升级经验表 |
| `config/database.ts` | 数据库连接、重试策略、备份配置 |
| `config/inventory.ts` | 物品类型表、稀有度配置、价格倍率 |

### 9.2 静态游戏数据（src/data/）

| 文件 | 内容 |
|------|------|
| `data/config_factions.ts` | 阵营数据（光辉盟约/铁血盟约/中立） |
| `data/config_races.ts` | 种族数据 |
| `data/config_classes.ts` | 职业数据 |
| `data/config_skills.ts` | 技能数据（职业技能 + 怪物技能） |
| `data/config_items.ts` | 物品/战利品数据 |
| `data/config_equipmentItems.ts` | 装备物品数据 |
| `data/config_mobs.ts` | 普通怪物数据 |
| `data/config_bosses.ts` | Boss 怪物数据 |
| `data/config_locations.ts` | 世界地图数据（大陆 + 地点） |
| `data/config_quests.ts` | 任务数据 |
| `data/config_shops.ts` | 商店数据 |
| `data/index.ts` | 统一导出入口 |

---

## 10. 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-19 | 初始版本，支持基础备份导入功能 | System |
| v1.1 | 2026-05-20 | 拆分地图和商店配置到独立存储 | System |
| v2.0 | 2026-06-16 | 根据项目实际代码全面修订：修正技术栈、数据库结构、模块列表、文件结构 | System |
| v3.0 | 2026-06-17 | 逐文件比对代码修正：运行时表索引字段、备份文件ISO命名格式、自动备份localStorage存储、校验和算法(简单哈希非SHA-256)、数据初始化流程描述 | System |

---

**文档结束**
