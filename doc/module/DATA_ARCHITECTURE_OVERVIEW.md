# 数据持久化架构概述

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 数据持久化架构设计文档 |
| 版本 | v5.0 |
| 生成日期 | 2026年8月3日 |
| 更新说明 | P3-116 全局状态收敛与持久化重构：新增 src/modules/game/ 模块（useGameStore 成为 currentCharacterId/currentShopId/gameSettings/lastPlayedAt/initializedAt 唯一持有者，经 gameStateHelper 持久化到 runtime_gameState 表）；GameStateStorage 新增 gameSettings 字段，settings/maxLevel 标记 @deprecated；audioDbService 移除，音频设置收敛到 GameStore（audio/store.ts 去除去抖定时器改异步持久化）；character/shop 的 currentCharacterId/currentShopId 改为 computed 代理 GameStore；删除旧版 services/ItemTemplateCache.ts（统一使用 UnifiedItemTemplateCache）；src/modules/index.ts 改为显式命名导出（ARCH-6） |

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
| fake-indexeddb | 测试环境 IndexedDB 内存实现 | ^6.2.5 |

### 1.2 设计目标

1. **统一的数据管理**：所有核心业务数据通过 Pinia 进行状态管理与操作
2. **持久化存储**：使用 Dexie.js 封装的 IndexedDB 作为本地持久化方案
3. **高性能**：异步 IO，不阻塞主线程，支持批量操作（bulkPut）与并行读取（Promise.all）
4. **可靠性**：内置重试机制（指数退避）和数据校验（简单哈希校验和）
5. **一致性**：每个模块独立管理自身的 Pinia Store 和数据库表
6. **类型安全**：getTable<T> 收敛类型断言，Storage 类型定义在各模块 types.ts 中

---

## 2. 架构设计

### 2.1 核心组件

| 组件 | 文件位置 | 职责 |
|------|----------|------|
| GameDatabase | `src/modules/data/core.ts` | 数据库初始化、表结构定义、版本管理（继承 Dexie，3 个 schema 版本） |
| DBService | `src/modules/data/core.ts` | 带重试机制的数据库操作封装（withRetry 泛型方法） |
| getTable\<T\> | `src/modules/data/core.ts` | 类型安全的表引用获取函数，收敛类型断言（CODE-5） |
| dataInitializer | `src/modules/data/initializer.ts` | 游戏初始数据加载到 IndexedDB（DataInitializer 单例，经 service.ts re-export） |
| backupService | `src/modules/data/backup.ts` | 数据备份服务（BackupService 单例，含手动/自动备份，经 service.ts re-export） |
| importService | `src/modules/data/service.ts` | 数据导入服务（ImportService 单例，实现拆分于 `importer.ts`，含验证/导入/兼容性检查） |
| gameStateHelper | `src/modules/data/gameStateHelper.ts` | 全局游戏状态读写辅助（getGameState/saveGameState，事务保证原子性，由 useGameStore 统一调用） |
| useGameStore | `src/modules/game/store.ts` | 全局游戏状态唯一持有者（P3-116）：currentCharacterId/currentShopId/gameSettings/lastPlayedAt/initializedAt，经 gameStateHelper 持久化到 runtime_gameState 表（id='gameState'） |
| toRawData / generateId | `src/utils/db-helpers.ts` | Vue Proxy 剥离与唯一 ID 生成工具函数 |
| BaseDbService | `src/utils/db-helpers.ts` | 通用数据层抽象基类，封装 CRUD + 重试模式（CODE-31） |
| baseDbService | `src/modules/base/db.ts` | 阵营/种族/职业基础数据 CRUD 服务 |
| itemTemplateDbService | `src/modules/item-template/db.ts` | 统一物品模板聚合层 DB 服务（消除 inventory ↔ equipment 循环依赖） |
| unifiedItemTemplateCache | `src/modules/item-template/cache.ts` | 合并物品模板缓存（普通物品 + 装备，懒加载 + Promise 去重，原 services/ItemTemplateCache 已删除） |
| 各模块 Store | `src/modules/*/store.ts` | Pinia Store，各模块独立管理自身状态（character/shop/audio 的全局状态字段以只读 computed 代理 GameStore） |
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
│   src/services/ （跨模块服务）                   │
├─────────────────────────────────────────────────┤
│                    状态管理层                     │
│   src/modules/*/store.ts （Pinia Store）         │
│   src/modules/game/store.ts （全局状态，P3-116） │
├─────────────────────────────────────────────────┤
│                    数据持久层                     │
│   src/modules/*/db.ts （IndexedDB CRUD 操作）    │
│   src/modules/item-template/ （聚合层）          │
├─────────────────────────────────────────────────┤
│                    数据库核心                     │
│   src/modules/data/core.ts （GameDatabase）      │
│   src/modules/data/gameStateHelper.ts            │
│   src/config/database.ts （数据库配置）           │
│   src/utils/db-helpers.ts （工具函数）            │
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

### 2.4 模块间依赖方向

```
data (数据库核心) ──── 被所有模块依赖（通过 db/dbService 单例）
bus (事件总线) ────── 被所有模块依赖（通过 eventBus 单例）
base (基础数据) ───── 依赖 data + bus；被 character 依赖
character ────────── 依赖 base + data + bus + game；被 combat/quest/shop/skill/equipment 依赖
game (全局游戏状态) ─ 依赖 data（经 gameStateHelper 读写 runtime_gameState）；被 character/shop/audio/exploration 依赖
inventory ────────── 依赖 data + bus + item-template
equipment ────────── 依赖 data + bus + item-template
item-template ────── 依赖 inventory.db + equipment.db（单向，无循环，A1/G1 修复）
enemy ────────────── 依赖 data + bus；被 combat 依赖
boss ─────────────── 依赖 data + bus + enemy；被 combat、exploration 依赖
exploration ──────── 依赖 data + bus + combat + shop + quest + item-template + game
combat ───────────── 依赖 data + bus + character + enemy + boss + skill
skill ────────────── 依赖 data + bus + character
quest ────────────── 依赖 data + bus + character
shop ─────────────── 依赖 data + bus + character + game
map ──────────────── 依赖 data + bus
log ──────────────── 依赖 data + bus
audio ────────────── 依赖 bus + game（P3-116 起不再直接依赖 data，音频设置由 GameStore 持久化）
animation ────────── 依赖 bus
admin ────────────── 依赖 data + bus + 各配置表
```

---

## 3. 数据库设计

### 3.1 数据库配置

```typescript
// src/config/database.ts
export const DATABASE_CONFIG: DatabaseConfig = {
  name: 'wow_dnd_game',
  version: 1
}

export const DB_SERVICE_CONFIG: DBServiceConfig = {
  maxRetries: 3,
  delay: 1000,
  backoff: 'exponential'
}

export const BACKUP_CONFIG: BackupConfig = {
  autoBackupKey: 'wow_dnd_auto_backups',
  maxAutoBackups: 5,
  backupVersion: 'v1.1',
  supportedVersions: ['v1.0', 'v1.1']
}
```

**注意**：`DATABASE_CONFIG.version` 字段声明为 `1`，但 `GameDatabase` 构造函数仅使用 `name` 参数（`super(DATABASE_CONFIG.name)`），实际 Dexie schema 版本通过 `this.version(1/2/3)` 声明，当前共 3 个版本。

### 3.2 数据库版本演进

| 版本 | 变更内容 | 关联任务 |
|------|----------|----------|
| v1 | 基础表结构：11 配置表 + 6 角色表 + 5 运行时表 | 初始版本 |
| v2 | 新增 `runtime_shopSoldItems` 表（商店回购列表持久化） | BIZ-16 |
| v3 | 新增 4 张职业专属配置表（`config_class_items`/`config_class_passives`/`config_class_talents`/`config_item_sets`） | DATA-4 |

### 3.3 数据表分类

数据库表按类型分为三类，使用统一的命名前缀，共 **27 张表**（15 配置表 + 6 角色表 + 6 运行时表）：

#### 3.3.1 配置表（config_*）— 游戏定义数据，所有角色共享

| 表名 | 索引字段 | 版本 | 说明 |
|------|----------|------|------|
| `config_factions` | `id, name` | v1 | 阵营配置数据 |
| `config_races` | `id, name, factionId` | v1 | 种族配置数据 |
| `config_classes` | `id, name, primaryStat` | v1 | 职业配置数据 |
| `config_items` | `id, name, type, rarity` | v1 | 物品模板数据 |
| `config_equipmentItems` | `id, name, type, rarity` | v1 | 装备物品模板数据 |
| `config_mobs` | `id, name, dangerLevel` | v1 | 普通怪物数据 |
| `config_bosses` | `id, name, dangerLevel` | v1 | Boss 怪物数据 |
| `config_quests` | `id, boardId, type` | v1 | 任务定义数据 |
| `config_skills` | `id, classRestriction, type, usableBy` | v1 | 技能定义数据 |
| `config_locations` | `id, type, continent` | v1 | 地图地点配置数据（通过 `type` 字段区分 `'location'` 与 `'continent'`） |
| `config_shops` | `id` | v1 | 商店配置数据 |
| `config_class_items` | `id, name, type, rarity` | v3 | 职业专属装备数据（DATA-4） |
| `config_class_passives` | `id, classId, trigger` | v3 | 职业专属被动技能数据（DATA-4） |
| `config_class_talents` | `id, classId` | v3 | 职业天赋树数据（DATA-4） |
| `config_item_sets` | `id, classRestriction` | v3 | 套装配置数据（DATA-4） |

#### 3.3.2 角色表（char_*）— 绑定角色ID，每个角色独立

| 表名 | 主键 | 索引 | 说明 |
|------|------|------|------|
| `char_data` | `characterId` | — | 角色属性和状态 |
| `char_inventory` | `characterId` | — | 背包物品 |
| `char_equipment` | `characterId` | — | 装备数据 |
| `char_skills` | `characterId` | — | 技能数据 |
| `char_quests` | `[characterId+questId]` | `characterId, status` | 任务进度（复合主键） |
| `char_exploration` | `characterId` | `characterId, currentAreaId` | 探索进度 |

#### 3.3.3 运行时表（runtime_*）— 日志和临时状态

| 表名 | 索引字段 | 版本 | 说明 |
|------|----------|------|------|
| `runtime_gameState` | `id` | v1 | 全局游戏状态表，通过不同 `id` 值承载多类数据（`gameState` / `data_initialized` / `game_constants`），读写操作使用事务保证原子性。P3-116 起 `gameState` 记录由 useGameStore 管理，字段含 `gameSettings`（合并原 audio_settings 键），原 `settings`/`maxLevel` 字段标记 @deprecated 保留向后兼容 |
| `runtime_combatLogs` | `combatId, timestamp` | v1 | 战斗日志（无显式主键，`battleLogId` 作为逻辑主键通过 `put` 写入） |
| `runtime_adventureLogs` | `characterId, timestamp` | v1 | 冒险日志（以 `characterId` 为主键） |
| `runtime_mapState` | `id` | v1 | 地图视图状态（以 `map_{characterId}` 为键） |
| `runtime_shopItems` | `shopId` | v1 | 商店商品数据 |
| `runtime_shopSoldItems` | `shopId` | v2 | 商店回购列表数据（BIZ-16） |

### 3.4 多角色数据隔离机制

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

### 3.5 数据库初始化钩子

`GameDatabase` 构造函数中注册 `populate` 钩子，在数据库首次创建时自动写入初始游戏状态（P3-116 起使用 `gameSettings` 字段替代原 `settings` 字段，合并音频设置默认值）：

```typescript
// src/modules/data/core.ts
this.on('populate', () => this.populateInitialData());

private async populateInitialData(): Promise<void> {
  await this.runtime_gameState.put({
    id: 'gameState',
    currentCharacterId: null,
    currentShopId: null,
    lastPlayedAt: new Date().toISOString(),
    initializedAt: new Date().toISOString(),
    gameSettings: {
      masterVolume: 0.7,
      sfxVolume: 0.8,
      bgmVolume: 0.5,
      muted: false,
      sfxEnabled: true,
      bgmEnabled: true,
      autoSave: true,
      difficulty: 'normal'
    }
  });
}
```

该记录的后续读写由 `useGameStore.initialize()` 接管（App.vue 启动时调用）：先通过 `migrateAudioSettings()` 将旧 `audio_settings` 键数据合并迁移到 `gameSettings` 字段并删除旧键，再恢复状态到内存。

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

部分模块含子目录（如 `combat/` 含 `ai/`、`composables/`、`effects/`、`forms/`、`pets/`、`resources/`；`character/` 含 `talents/`）。

### 4.2 模块列表

| 模块目录 | 模块名称 | 说明 |
|----------|----------|------|
| `modules/data/` | 数据核心 | 数据库初始化、游戏状态管理、备份导入（core.ts/types.ts/gameStateHelper.ts/backup.ts/importer.ts/initializer.ts/service.ts，service.ts 为 re-export 入口） |
| `modules/bus/` | 事件总线 | 模块间解耦通信（core.ts/types.ts） |
| `modules/base/` | 基础数据 | 阵营、种族、职业等基础数据管理（BaseDbService + useBaseStore） |
| `modules/character/` | 角色 | 角色创建、属性管理、成长系统（含 `talents/` 子模块；currentCharacterId 以只读 computed 代理 GameStore，P3-116） |
| `modules/inventory/` | 背包 | 物品存储、使用、堆叠、排序 |
| `modules/equipment/` | 装备 | 装备穿戴、属性加成、稀有度系统 |
| `modules/item-template/` | 物品模板聚合层 | 聚合 config_items 与 config_equipmentItems 查询，消除循环依赖（A1/G1 修复） |
| `modules/skill/` | 技能 | 技能学习、技能栏配置、技能使用 |
| `modules/combat/` | 战斗 | 回合制战斗、AI、效果系统（含 `ai/`、`composables/`、`effects/`、`forms/`、`pets/`、`resources/` 子模块） |
| `modules/quest/` | 任务 | 任务接受、进度追踪、交付奖励 |
| `modules/shop/` | 商店 | 商品刷新、购买/出售、交易记录 |
| `modules/map/` | 地图 | 地图视图、地点解锁、探索入口 |
| `modules/exploration/` | 探索 | 探索网格、营地、事件触发（events.ts 含 registry 模式；依赖 game 读取全局状态） |
| `modules/log/` | 冒险日志 | 游戏事件记录、日志查询（含分页与容量限制） |
| `modules/enemy/` | 敌人 | 敌人实例管理和数据 |
| `modules/boss/` | Boss | Boss 战斗引擎和入场逻辑（含 engine.ts/intro.ts/phaseManager.ts） |
| `modules/game/` | 全局游戏状态 | P3-116 新增：useGameStore 唯一持有 currentCharacterId/currentShopId/gameSettings/lastPlayedAt/initializedAt，经 gameStateHelper 持久化到 runtime_gameState 表（types.ts/store.ts/index.ts） |
| `modules/audio/` | 音频 | 基于 Tone.js 的音频管理（P3-116 起音频设置收敛到 GameStore，不再直接读写 IndexedDB） |
| `modules/animation/` | 动画 | 战斗效果动画 |
| `modules/admin/` | 后台管理 | 配置管理和数据管理 |

### 4.3 跨模块服务层（src/services/）

| 文件 | 说明 |
|------|------|
| `services/ErrorHandler.ts` | 全局错误处理服务 |
| `services/GameBootstrap.ts` | 游戏启动流程编排 |
| `services/CharacterLifecycleService.ts` | 角色生命周期管理（创建/删除/切换） |
| `services/CrossModuleQuery.ts` | 跨模块查询服务（物品模板查询统一走 unifiedItemTemplateCache，原 services/ItemTemplateCache 已删除） |
| `services/AdminQueryService.ts` | 后台查询服务 |

---

## 5. 数据库操作模式

### 5.1 标准 CRUD 操作

每个模块的 `db.ts` 提供标准化的数据库操作，统一通过 `dbService.withRetry()` 包裹以获得重试能力：

```typescript
// 示例：modules/base/db.ts
export class BaseDbService {
  async getAllFactions(): Promise<FactionData[]> {
    return dbService.withRetry(async () => {
      const result = await gameDb.config_factions.toArray();
      return cast<FactionData[]>(result);
    });
  }

  async createFaction(data: FactionCreateUpdateData): Promise<string> {
    const id = generateId('base');
    await dbService.withRetry(async () => {
      await gameDb.config_factions.add({ id, ...data });
    });
    return id;
  }
}
```

### 5.2 通用数据层基类（BaseDbService 抽象类）

`src/utils/db-helpers.ts` 提供 `BaseDbService<T, S>` 抽象基类，封装各模块 db.ts 中高度重复的 CRUD + 重试模式（CODE-31）。子类只需提供表引用和主键字段名，即可获得带重试的标准增删改查能力：

```typescript
// src/utils/db-helpers.ts
export abstract class BaseDbService<T, S = T> {
  constructor(
    protected readonly table: { put; get; delete; toArray; bulkPut },
    protected readonly keyField: string = 'id'
  ) {}

  protected toStorage(data: T): S { return data as unknown as S; }
  protected toRuntime(data: S): T { return data as unknown as T; }
  protected getKey(data: T): string { ... }

  async save(data: T): Promise<void> { ... }       // 单条保存
  async saveAll(items: T[]): Promise<void> { ... } // 批量保存
  async getById(id: string): Promise<T | null> { ... }
  async getAll(): Promise<T[]> { ... }
  async deleteById(id: string): Promise<void> { ... }
}
```

### 5.3 重试机制

通过 `DBService` 类提供带指数退避的重试机制：

```typescript
// src/modules/data/core.ts
export class DBService {
  private options: DBServiceConfig;

  constructor(options?: Partial<DBServiceConfig>) {
    this.options = { ...DB_SERVICE_CONFIG, ...options };
  }

  async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let delay = this.options.delay;
    for (let retries = 0; retries < this.options.maxRetries; retries++) {
      try {
        return await fn();
      } catch (error) {
        if (retries >= this.options.maxRetries - 1) throw error;
        await this.sleep(delay);
        if (this.options.backoff === 'exponential') delay *= 2;
      }
    }
    throw new Error('所有重试均已耗尽');
  }

  private sleep(ms: number): Promise<void> { ... }
  setOptions(options: Partial<DBServiceConfig>): void { ... }
}
```

### 5.4 类型安全的表引用获取（getTable\<T\>）

```typescript
// src/modules/data/core.ts
export function getTable<T>(
  dbInstance: GameDatabase,
  name: keyof GameDatabaseSchema
): Table<T, string> {
  return dbInstance[name] as unknown as Table<T, string>;
}
```

收敛类型断言，避免调用方散落 `as unknown as XXX` 双重断言（CODE-5）。主要用于 BackupService.collectAllData 与 ImportService.importData 中配置驱动遍历。

### 5.5 游戏状态读写辅助（gameStateHelper）

```typescript
// src/modules/data/gameStateHelper.ts
export async function getGameState(key: string = 'gameState'): Promise<GameStateStorage | null> {
  const state = await db.runtime_gameState.get(key);
  return state ?? null;
}

export async function saveGameState(
  patch: Partial<GameStateStorage>,
  key: string = 'gameState'
): Promise<void> {
  await db.transaction('rw', db.runtime_gameState, async () => {
    const existing = await db.runtime_gameState.get(key);
    await db.runtime_gameState.put({
      ...(existing ?? {}),
      id: key,
      ...patch,
    } as GameStateStorage);
  });
}
```

使用事务确保读-改-写的原子性。P3-116 起 `runtime_gameState` 的 `gameState` 记录读写统一收敛到 `useGameStore`（`persist()` 内部调用 `saveGameState`），character/shop/audio 等模块不再直接调用本辅助模块，避免并发写入时丢失数据。

### 5.6 Vue Proxy 剥离与 ID 生成

```typescript
// src/utils/db-helpers.ts
export function toRawData<T>(data: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(data);
    } catch {
      // Vue Proxy 嵌套响应式或不可克隆类型，回退到 JSON 序列化
    }
  }
  return JSON.parse(JSON.stringify(data));
}

export function generateId(prefix: string, rng: Rng = defaultRng): string {
  return `${prefix}_${Date.now()}_${rng.next().toString(36).substring(2, 11)}`;
}
```

`toRawData` 优先使用 `structuredClone`（保留 Date/Map/Set 等特殊类型），不可用时回退到 JSON 序列化往返，剥离 Vue/Pinia 的 Proxy 包装，避免 IndexedDB 结构化克隆算法触发 `DataCloneError`。`generateId` 支持注入随机数生成器（`createSeededRng(seed)`），用于测试复现与战斗回放。

### 5.7 数据初始化

`DataInitializer` 类的 `initializeData()` 方法在首次运行时检查 `data_initialized` 标志（存储于 `runtime_gameState` 表），若未初始化则在事务中将静态配置文件（`src/data/` 目录）中的数据导入到 IndexedDB 对应表中。

**初始化流程**：
1. `isDataInitialized()` 检查 `runtime_gameState.get('data_initialized')`
2. 在事务中执行：地点/大陆数据每次更新；未初始化时写入阵营/种族/职业/物品/装备/怪物/Boss/商店/任务/技能模板/游戏常量/职业专属数据
3. 使用 `initTable()` 内部方法通过 `bulkPut` 批量写入（INIT-1，加速冷启动）
4. `initSkillTemplates()` 分别写入职业技能（`usableBy: 'player'`）与怪物技能（`usableBy: 'enemy'`）
5. `initBosses()` 内联字段转换逻辑（`undefined → null` 确保索引字段存在），使用 `bulkPut` 批量写入
6. 初始化完成后写入 `data_initialized` 标志
7. 通过 `eventBus.emit(GameEvents.GAME_DATA_UPDATED, { type: 'init', action: 'bulk', id: '*' })` 通知相关 Store 重新加载数据

**修复基础数据**：`reinitializeData()` 清空所有 config_* 表后重新导入，不影响角色数据（char_* 表），完成后 emit `{ type: 'repair', action: 'bulk', id: '*' }`。

---

## 6. 数据备份与导入

### 6.1 功能概述

数据备份与导入模块（`modules/data/`，实现拆分于 `backup.ts`/`importer.ts`/`initializer.ts`，`service.ts` 为 re-export 入口）允许用户在更换设备或重新安装应用时进行存档迁移。由三个服务类组成：
- `DataInitializer`：数据初始化
- `BackupService`：数据备份（实现 `IBackupService` 接口）
- `ImportService`：数据导入（实现 `IImportService` 接口）

### 6.2 备份机制（BackupService）

```typescript
export class BackupService implements IBackupService {
  async createBackup(): Promise<BackupFile>
  async exportBackup(): Promise<void>
  async getAutoBackups(): Promise<BackupFile[]>
  async deleteBackup(timestamp: number): Promise<void>
  async clearAutoBackups(): Promise<void>
  async createAutoBackup(): Promise<void>
  private async collectAllData(): Promise<BackupData>
  private toCharacterRecord<T extends { characterId: string }>(items: T[]): Record<string, T>
}
```

- **手动触发**：`exportBackup()` 调用 `createBackup()` 收集数据后，通过 `downloadBlob()` 下载 JSON 文件
- **自动备份**：`createAutoBackup()` 将备份存入 `localStorage`（键名 `wow_dnd_auto_backups`），保留最近 5 份（超出时 `pop()` 移除最旧）
- **文件格式**：`.json` 格式，UTF-8 编码
- **文件命名**：`wow_dnd_backup_${dateStr}.json`，其中 `dateStr = new Date().toISOString().replace(/[:.]/g, '-')`（如 `wow_dnd_backup_2026-07-10T08-30-00-000Z.json`）
- **并行读取**：`collectAllData()` 通过 `Promise.all` 并行读取 21 个表（PERF-2），避免串行阻塞主线程
- **配置表读取**：通过 `getTable<T>(db, tableName)` 收敛类型断言（CODE-5）

### 6.3 导入校验（ImportService）

```typescript
export class ImportService implements IImportService {
  async validateBackup(file: File): Promise<ValidationResult>
  async importBackup(file: File): Promise<ImportResult>
  checkVersionCompatibility(backupVersion: string): CompatibilityResult
  private async importData(data: BackupData): Promise<ImportResult>
}
```

**验证流程**（`validateBackup`）：
1. `FileReader` 读取文件内容
2. JSON 解析，检查 `backup.version` 是否存在（格式校验）
3. `calculateChecksum(backup.data)` 与 `backup.checksum` 比对（完整性校验）
4. `checkVersionCompatibility(backup.version)` 检查版本兼容性（兼容性校验）

**导入流程**（`importBackup` → `importData`）：
1. 调用 `validateBackup()` 验证文件
2. 验证通过后 `FileReader` 重新读取文件内容
3. 在事务中调用 `importData()` 逐表写入
4. Record 形状数据通过 `bulkPutIfNotEmpty` 辅助函数写入（空数据计入 `skippedStores`）
5. 数组形状数据通过 `bulkPutArrayIfNotEmpty` 辅助函数写入
6. 数组形状配置表通过 `TABLES_TO_BACKUP` 配置驱动遍历（CODE-34/CODE-38），消除重复 if/else

### 6.4 TABLES_TO_BACKUP 配置驱动

```typescript
const TABLES_TO_BACKUP: ReadonlyArray<{
  field: ArrayBackupField;
  table: keyof GameDatabaseSchema;
  storeName: string;
}> = [
  { field: 'map', table: 'config_locations', storeName: 'config_locations' },
  { field: 'shop', table: 'config_shops', storeName: 'config_shops' },
  { field: 'factions', table: 'config_factions', storeName: 'config_factions' },
  { field: 'races', table: 'config_races', storeName: 'config_races' },
  { field: 'classes', table: 'config_classes', storeName: 'config_classes' },
  { field: 'items', table: 'config_items', storeName: 'config_items' },
  { field: 'equipmentItems', table: 'config_equipmentItems', storeName: 'config_equipmentItems' },
  { field: 'mobs', table: 'config_mobs', storeName: 'config_mobs' },
  { field: 'bosses', table: 'config_bosses', storeName: 'config_bosses' },
  { field: 'skillTemplates', table: 'config_skills', storeName: 'config_skills' },
];
```

`collectAllData` 读取与 `importData` 写入均基于此配置驱动，避免散落的类型断言和重复的 if/else（CODE-34/CODE-38）。

### 6.5 校验和算法

```typescript
function calculateChecksum(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
  }
  return Math.abs(hash).toString(16);
}
```

使用简单哈希算法（非 SHA-256），返回十六进制字符串。用于验证备份文件完整性。

### 6.6 备份文件结构

```typescript
interface BackupFile {
  version: string;           // 备份格式版本（当前 'v1.1'）
  timestamp: number;         // 备份时间戳（毫秒，Date.now()）
  checksum: string;          // 简单哈希校验和
  gameVersion: string;       // 游戏版本号（当前 '1.0.0'）
  data: BackupData;          // 完整游戏数据
}

interface BackupData {
  // 角色数据（以 characterId 为键的 Record）
  characters: Record<string, CharacterDataStorage>;
  inventory: Record<string, InventoryStorage>;
  quests: Record<string, CharQuestStorage>;
  equipment: Record<string, EquipmentStorage>;
  skills: Record<string, SkillsData>;
  exploration: Record<string, ExplorationStorage>;
  // 运行时数据
  combat: Record<string, CombatLogStorage>;           // 以 battleLogId 为键，缺失时降级为 ${combatId}_${timestamp}
  adventureLog: Record<string, LogEntry[]>;           // 以 characterId 为键
  gameState: Record<string, GameStateStorage>;        // 以 id 为键
  shopItems: Record<string, ShopItemsStorage>;        // 以 shopId 为键
  mapState?: Record<string, MapStateStorage>;         // 以 map_{characterId} 为键
  // 配置表（数组形状，v1.1+ 可选，兼容旧备份）
  map: LocationData[];
  shop: ShopConfig[];
  factions?: FactionStorage[];
  races?: RaceStorage[];
  classes?: ClassStorage[];
  items?: ItemStorage[];
  equipmentItems?: EquipmentTemplateStorage[];
  mobs?: EnemyStorage[];
  bosses?: BossStorage[];
  skillTemplates?: SkillTemplateStorage[];
}
```

---

## 7. 物品模板聚合层

### 7.1 设计背景

inventory 与 equipment 模块原先存在双向依赖（inventory 需要查询装备模板，equipment 需要查询物品定义）。通过引入 `item-template` 聚合层（A1/G1 修复），将依赖方向改为单向：`item-template → inventory.db + equipment.db`。

### 7.2 模块结构

```
src/modules/item-template/
  ├── index.ts          # 统一导出入口
  ├── types.ts          # 类型 re-export（从 inventory/types 导入）
  ├── db.ts             # ItemTemplateDbService 聚合查询
  ├── service.ts        # convertEquipmentToItem / mergeItemTemplates 纯函数
  └── cache.ts          # UnifiedItemTemplateCache 合并缓存
```

### 7.3 ItemTemplateDbService

```typescript
export class ItemTemplateDbService {
  async getAllItemTemplates(): Promise<Item[]>         // 委托 inventoryDbService
  async getAllEquipmentTemplates(): Promise<EquipmentItem[]>  // 委托 equipmentDbService
}
```

仅提供原始数据查询，类型转换与合并逻辑由 `service.ts` 提供，保持数据层与服务层的职责分离。

### 7.4 纯函数服务（service.ts）

```typescript
// 装备模板 → 统一 Item 格式（丢弃 slots/classRestriction/setId 装备专有字段）
export function convertEquipmentToItem(equip: EquipmentItem): Item

// 合并普通物品与装备模板为 Map（普通物品优先，装备仅在 ID 不冲突时插入）
export function mergeItemTemplates(items: Item[], equipment: EquipmentItem[]): Map<string, Item>
```

### 7.5 UnifiedItemTemplateCache（cache.ts）

```typescript
class UnifiedItemTemplateCacheService {
  async load(): Promise<Item[]>        // 懒加载 + Promise 去重（in-flight dedup）
  async getById(itemId: string): Promise<Item | null>
  async getAll(): Promise<Item[]>      // load 失败时返回空数组兜底
  invalidate(): void                   // 缓存失效，下次查询重新加载
}
export const unifiedItemTemplateCache = new UnifiedItemTemplateCacheService();
```

**缓存策略**：
- 懒加载：首次调用 `load()` 时从 DB 加载并合并
- Promise 去重：并发调用复用同一个 `loadingPromise`，确保只触发一次 DB 查询
- 加载失败后 `loaded` 保持 `false`、`loadingPromise` 重置为 `null`，下次调用自动重试
- 并行加载普通物品与装备模板（`Promise.all`）减少总加载时间

**使用方**：inventory/store、services/CrossModuleQuery。原 `services/ItemTemplateCache.ts` 已删除（ARCH-1，避免双重缓存数据不一致），统一使用本缓存。

---

## 8. 基础数据模块

### 8.1 模块结构

```
src/modules/base/
  ├── index.ts          # 统一导出入口
  ├── types.ts          # FactionCreateUpdateData / RaceCreateUpdateData / ClassCreateUpdateData
  ├── db.ts             # BaseDbService 阵营/种族/职业 CRUD
  ├── service.ts        # 纯函数（generateId / arrayToRecord / filterClassesByRace 等）
  └── store.ts          # useBaseStore Pinia Store
```

### 8.2 BaseDbService（db.ts）

提供阵营、种族、职业的完整 CRUD 操作，所有方法通过 `dbService.withRetry()` 包裹：

```typescript
export class BaseDbService {
  // 阵营操作
  async getAllFactions(): Promise<FactionData[]>
  async getFactionById(id: string): Promise<FactionData | null>
  async createFaction(data: FactionCreateUpdateData): Promise<string>
  async updateFaction(id: string, data: FactionCreateUpdateData): Promise<void>
  async deleteFaction(id: string): Promise<void>

  // 种族操作
  async getAllRaces(): Promise<RaceData[]>
  async getRaceById(id: string): Promise<RaceData | null>
  async getRacesByFaction(factionId: FactionType): Promise<RaceData[]>  // Dexie 索引查询
  async createRace(data: RaceCreateUpdateData): Promise<string>
  async updateRace(id: string, data: RaceCreateUpdateData): Promise<void>
  async deleteRace(id: string): Promise<void>

  // 职业操作
  async getAllClasses(): Promise<ClassData[]>
  async getClassById(id: string): Promise<ClassData | null>
  async getClassesByRace(raceId: RaceType): Promise<ClassData[]>        // 内存过滤
  async getClassesByFaction(factionId: FactionType): Promise<ClassData[]>  // 内存过滤
  async createClass(data: ClassCreateUpdateData): Promise<string>
  async updateClass(id: string, data: ClassCreateUpdateData): Promise<void>
  async deleteClass(id: string): Promise<void>
}
export const baseDbService = new BaseDbService();
```

### 8.3 纯函数服务（service.ts）

```typescript
export { generateId } from '../../utils/db-helpers';

export function arrayToRecord<T extends { id: string }>(items: T[]): Record<string, T>
export function filterRacesByFaction(races: RaceData[], factionId: FactionType): RaceData[]
export function filterClassesByRace(classes: ClassData[], raceId: RaceType): ClassData[]
export function filterClassesByFaction(classes: ClassData[], factionId: FactionType): ClassData[]
```

### 8.4 useBaseStore（store.ts）

采用工厂函数模式（`createCrudActions` / `createQuickGetter`）消除阵营、种族、职业的重复 CRUD 模式：

- **状态**：`factions` / `races` / `classes` 列表，`isLoading`，`selectedFactionId` / `selectedRaceId` / `selectedClassId`
- **计算属性**：`getFactionById` / `getRaceById` / `getClassById` / `getRacesByFaction` / `getClassesByRace` / `getClassesByFaction` / `selectedFaction` / `selectedRace` / `selectedClass`
- **快捷取值**（工厂生成）：`getRaceIcon` / `getRaceName` / `getFactionIcon` / `getFactionName` / `getFactionColor` / `getClassIcon` / `getClassName` / `getClassColor`
- **方法**：`loadAllData` / `loadFactions` / `loadRaces` / `loadClasses` / `createFaction` / `updateFaction` / `deleteFaction` / `createRace` / `updateRace` / `deleteRace` / `createClass` / `updateClass` / `deleteClass` / `selectFaction` / `selectRace` / `selectClass` / `resetSelection` / `initialize`
- **事件通知**：CRUD 操作后通过 `eventBus.emit(GameEvents.GAME_DATA_UPDATED, { type, action, id })` 通知其他模块，`type` 为 `'faction' | 'race' | 'class'`，`action` 为 `'create' | 'update' | 'delete' | 'bulk'`
- **错误处理**：通过 `errorHandler.report(error, message)` 上报错误，CRUD 操作返回 `boolean` 表示成功/失败

---

## 9. 性能优化

### 9.1 异步加载

- Store 初始化时异步从 IndexedDB 读取数据
- 不阻塞主线程
- 使用 await/async 模式

### 9.2 批量写入

- `DataInitializer.initTable()` 使用 `bulkPut` 替代逐条 `await put`（INIT-1，加速冷启动）
- `ImportService.importData()` 通过 `bulkPutIfNotEmpty` / `bulkPutArrayIfNotEmpty` 批量写入

### 9.3 并行读取

- `BackupService.collectAllData()` 通过 `Promise.all` 并行读取 21 个表（PERF-2）
- `UnifiedItemTemplateCache.doLoad()` 并行加载普通物品与装备模板
- `useBaseStore.loadAllData()` 通过 `Promise.all` 并行加载阵营/种族/职业数据

### 9.4 计算缓存

- 角色属性通过 `computed` 缓存次级属性计算结果
- 装备总属性通过 computed 避免重复计算
- 技能栏预缓存已装备技能列表

### 9.5 内存缓存

- `UnifiedItemTemplateCache`：合并物品模板内存缓存（懒加载 + Promise 去重，原 `ItemTemplateCache` 已删除）

### 9.6 索引优化

- 常用查询字段建立索引（`name`, `characterId`, `status`, `type`）
- 多键索引支持复杂查询（如 `[characterId+questId]`）

### 9.7 索引策略审计

**审计范围**：27 张表（15 配置表 + 6 角色表 + 6 运行时表），覆盖 `src/modules/*/db.ts` 中全部 `.where()` / `.get()` / `.filter()` 查询。

#### 9.7.1 完整索引清单

| 表名 | 主键 | 索引字段 | 版本 |
|------|------|----------|------|
| `config_factions` | `id` | `name` | v1 |
| `config_races` | `id` | `name, factionId` | v1 |
| `config_classes` | `id` | `name, primaryStat` | v1 |
| `config_items` | `id` | `name, type, rarity` | v1 |
| `config_equipmentItems` | `id` | `name, type, rarity` | v1 |
| `config_mobs` | `id` | `name, dangerLevel` | v1 |
| `config_bosses` | `id` | `name, dangerLevel` | v1 |
| `config_quests` | `id` | `boardId, type` | v1 |
| `config_skills` | `id` | `classRestriction, type, usableBy` | v1 |
| `config_locations` | `id` | `type, continent` | v1 |
| `config_shops` | `id` | — | v1 |
| `config_class_items` | `id` | `name, type, rarity` | v3 |
| `config_class_passives` | `id` | `classId, trigger` | v3 |
| `config_class_talents` | `id` | `classId` | v3 |
| `config_item_sets` | `id` | `classRestriction` | v3 |
| `char_data` | `characterId` | — | v1 |
| `char_inventory` | `characterId` | — | v1 |
| `char_equipment` | `characterId` | — | v1 |
| `char_skills` | `characterId` | — | v1 |
| `char_quests` | `[characterId+questId]` | `characterId, status` | v1 |
| `char_exploration` | `characterId` | `currentAreaId` | v1 |
| `runtime_gameState` | `id` | — | v1 |
| `runtime_combatLogs` | — | `combatId, timestamp` | v1 |
| `runtime_adventureLogs` | `characterId` | `timestamp` | v1 |
| `runtime_mapState` | `id` | — | v1 |
| `runtime_shopItems` | — | `shopId` | v1 |
| `runtime_shopSoldItems` | — | `shopId` | v2 |

#### 9.7.2 高频查询模式与索引匹配

| 查询位置 | 查询模式 | 使用索引 | 命中 |
|----------|----------|----------|------|
| `skill/db.ts` | `config_skills.where('classRestriction').equals(classId)` | `classRestriction` | ✅ |
| `skill/db.ts` | `config_skills.where('usableBy').anyOf('enemy', 'both')` | `usableBy` | ✅ |
| `quest/db.ts` | `config_quests.where('boardId').equals(boardId)` | `boardId` | ✅ |
| `quest/db.ts` | `char_quests.get([characterId, questId])` | `[characterId+questId]` 复合主键 | ✅ |
| `quest/db.ts` | `char_quests.where('characterId').equals(characterId)` | `characterId` | ✅ |
| `base/db.ts` | `config_races.where('factionId').equals(factionId)` | `factionId` | ✅ |
| `combat/db.ts` | `runtime_combatLogs.where('combatId').equals(combatId).sortBy('timestamp')` | `combatId` + `timestamp` | ✅ |
| `log/db.ts` | `runtime_adventureLogs.get(characterId)` | 主键 `characterId` | ✅ |
| `admin/db.ts` | `table.where('name').startsWithIgnoreCase(keyword)` | `name` | ✅ |
| `admin/db.ts` | `table.where('id').startsWithIgnoreCase(keyword)` | `id`（主键） | ✅ |

#### 9.7.3 审计结论

- **27 张表的所有 `.where()` 查询均命中已索引字段**，无全表扫描风险
- `char_quests` 的 `status` 索引当前未被 `.where()` 直接使用（quest store 在内存中过滤），但数据规模小（10-50 条/角色），无需优化
- `runtime_adventureLogs` 的 `timestamp` 索引当前未使用（通过主键 `.get(characterId)` 访问），保留以备未来时间范围查询
- `runtime_combatLogs` 无显式主键（`battleLogId` 作为逻辑主键通过 `put` 写入），`combatId` + `timestamp` 索引覆盖了按战斗 ID 查询并按时间排序的核心场景
- **结论：当前索引策略完善，无需补充索引**

### 9.8 查询性能基准

**基准文件**：`benchmarks/db.bench.ts`
**运行方式**：`npm run bench`（使用 `vitest.bench.config.ts`，不接入 CI）
**环境**：Node.js + fake-indexeddb（内存实现），绝对耗时低于真实 IndexedDB，相对趋势具有参考价值

测试覆盖 3 种数据规模（1k / 10k / 100k）下的 12 种查询模式：

| 查询类型 | 索引类型 | 预期复杂度 |
|----------|----------|-----------|
| `items.get(id)` | 主键 | O(log n) |
| `items.where('type').equals()` | 单字段索引 | O(log n + m) |
| `items.where('name').startsWithIgnoreCase()` | 索引前缀 | O(log n + m) |
| `items.toArray()` | 全表扫描 | O(n) |
| `charQuests.get([charId, questId])` | 复合主键 | O(log n) |
| `combatLogs.where().sortBy()` | 索引+排序 | O(log n + m log m) |
| `combatLogs.where('timestamp').above()` | 范围索引 | O(log n + m) |
| `combatLogs.filter(predicate)` | 无索引过滤 | O(n) |

完整报告由 benchmark 运行后自动生成至 `benchmarks/db.bench.report.md`。

---

## 10. 错误处理

### 10.1 重试策略

| 参数 | 值 | 说明 |
|------|-----|------|
| maxRetries | 3 | 最大重试次数（含首次尝试） |
| delay | 1000ms | 初始延迟 |
| backoff | exponential | 指数退避（1s → 2s → 4s） |

### 10.2 异常处理

- 所有数据库 IO 操作包裹 try-catch
- 读取失败时使用默认值初始化（不中断程序）
- 写入失败时进入重试队列
- 关键错误记录到控制台（生产环境仅输出简短信息，避免泄露完整堆栈，DBG-3）
- `useBaseStore` 的 CRUD 操作通过 `errorHandler.report()` 上报错误，返回 `boolean` 表示成功/失败

---

## 11. 配置与数据文件

### 11.1 运行时配置（src/config/）

| 文件 | 内容 |
|------|------|
| `config/character.ts` | 最大等级、属性名映射、升级经验表 |
| `config/combat.ts` | 战斗相关配置 |
| `config/combat-colors.ts` | 战斗颜色配置 |
| `config/console-style.ts` | 控制台样式配置 |
| `config/database.ts` | 数据库连接（DATABASE_CONFIG）、重试策略（DB_SERVICE_CONFIG）、备份配置（BACKUP_CONFIG） |
| `config/exploration.ts` | 探索概率常量 |
| `config/inventory.ts` | 物品类型表（ITEM_TYPES）、稀有度配置（RARITY_CONFIG）、价格倍率（RARITY_PRICE_MULTIPLIER）、出售折扣（RARITY_SELL_DISCOUNT） |
| `config/log.ts` | 日志分页配置（PAGE_SIZE=50、MAX_LOG_ENTRIES=1000） |

### 11.2 静态游戏数据（src/data/）

| 文件 | 内容 |
|------|------|
| `data/config_factions.ts` | 阵营数据（FACTIONS） |
| `data/config_races.ts` | 种族数据（RACES） |
| `data/config_classes.ts` | 职业数据（CLASSES） |
| `data/config_skills.ts` | 技能数据（CLASS_ABILITIES + MONSTER_ABILITIES） |
| `data/config_items.ts` | 物品/战利品数据（LOOT_ITEMS） |
| `data/config_equipmentItems.ts` | 装备物品数据（EQUIPMENT_ITEMS） |
| `data/config_mobs.ts` | 普通怪物数据（MOBS） |
| `data/config_bosses.ts` | Boss 怪物数据（BOSSES） |
| `data/config_locations.ts` | 世界地图数据（CONTINENTS + LOCATIONS） |
| `data/config_quests.ts` | 任务数据（QUESTS） |
| `data/config_shops.ts` | 商店数据（SHOPS） |
| `data/config_class_items.ts` | 职业专属装备数据（CLASS_SPECIFIC_ITEMS，DATA-4） |
| `data/config_class_passives.ts` | 职业被动技能数据（CLASS_PASSIVES，DATA-4） |
| `data/config_class_talents.ts` | 职业天赋树数据（CLASS_TALENT_TREES，DATA-4） |
| `data/config_item_sets.ts` | 套装定义数据（ITEM_SETS，DATA-4） |
| `data/validate.ts` | 数据验证函数 |
| `data/index.ts` | 统一导出入口 |

### 11.3 工具函数（src/utils/）

| 文件 | 内容 |
|------|------|
| `utils/db-helpers.ts` | `toRawData`（Vue Proxy 剥离）、`generateId`（唯一 ID 生成）、`BaseDbService`（通用数据层抽象基类，CODE-31） |
| `utils/fileDownload.ts` | `downloadBlob`（浏览器文件下载辅助） |

---

## 12. 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-19 | 初始版本，支持基础备份导入功能 | System |
| v1.1 | 2026-05-20 | 拆分地图和商店配置到独立存储 | System |
| v2.0 | 2026-06-16 | 根据项目实际代码全面修订：修正技术栈、数据库结构、模块列表、文件结构 | System |
| v3.0 | 2026-06-17 | 逐文件比对代码修正：运行时表索引字段、备份文件ISO命名格式、自动备份localStorage存储、校验和算法(简单哈希非SHA-256)、数据初始化流程描述 | System |
| v3.1 | 2026-07-09 | 补充版本 2/3 新增表（runtime_shopSoldItems、config_class_*、config_item_sets）；新增 7.4 索引策略审计（完整索引清单 + 高频查询匹配 + 审计结论）和 7.5 查询性能基准章节 | System |
| v4.0 | 2026-07-10 | 逐文件比对源码修正：表数量更正（27张表=15配置+6角色+6运行时，原文档误为25张=11+6+8）；新增 item-template 聚合层与 base 模块完整描述；补充 DBService/getTable/gameStateHelper/BaseDbService 工具层 API；补充 BackupService/ImportService 完整方法签名与 TABLES_TO_BACKUP 配置驱动机制；补充两套物品模板缓存（ItemTemplateCache 旧版 vs UnifiedItemTemplateCache 新版）的区别；更新模块目录结构与配置文件清单 | System |
| v5.0 | 2026-08-03 | P3-116 全局状态收敛与持久化重构：新增 src/modules/game/ 模块（useGameStore 成为 currentCharacterId/currentShopId/gameSettings/lastPlayedAt/initializedAt 唯一持有者，经 gameStateHelper 持久化到 runtime_gameState 表）；GameStateStorage 新增 gameSettings 字段，settings/maxLevel 标记 @deprecated；audioDbService 移除，音频设置收敛到 GameStore（audio/store.ts 去除去抖定时器改异步持久化）；character/shop 的 currentCharacterId/currentShopId 改为 computed 代理 GameStore；删除旧版 services/ItemTemplateCache.ts（统一使用 UnifiedItemTemplateCache）；src/modules/index.ts 改为显式命名导出（ARCH-6） | System |

---

**文档结束**
