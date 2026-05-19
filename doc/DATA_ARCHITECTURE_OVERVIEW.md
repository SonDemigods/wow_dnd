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

## 数据备份与导入模块

### 9.1 功能概述

数据备份与导入模块允许用户在更换设备或重新安装应用时进行存档迁移。该模块提供完整的备份导出、数据导入和存档迁移功能，确保用户数据的安全性和可移植性。

### 9.2 数据备份功能

#### 9.2.1 实现机制

**备份触发方式：**
- 手动触发：用户主动点击备份按钮
- 自动触发：游戏存档变更后定期自动备份（每日一次）
- 关键节点触发：角色升级、任务完成等重要事件后

**备份流程：**
```
用户触发备份 → 遍历所有 Store → 收集数据 → 序列化 → 加密 → 生成备份文件 → 触发下载
```

#### 9.2.2 文件格式规范

**文件格式：** `.json` 格式，UTF-8 编码

**文件命名规则：**
```
wow_dnd_backup_{yyyyMMdd}_{HHmmss}.json
示例：wow_dnd_backup_20260519_143022.json
```

**文件结构：**
```typescript
interface BackupFile {
  version: string;           // 备份格式版本
  timestamp: number;         // 备份时间戳
  checksum: string;          // 数据校验和
  gameVersion: string;       // 游戏版本号
  data: {
    character: CharacterData;
    inventory: InventoryData;
    quests: QuestData[];
    equipment: EquipmentData;
    map: MapData;
    skills: SkillsData;
    exploration: ExplorationData;
    npc: NPCData;
    combat: CombatData;
    adventureLog: AdventureLogData;
    shop: ShopData;
    gameState: GameStateData;
  };
}
```

#### 9.2.3 存储位置设计

**本地存储：**
- 浏览器下载目录（用户手动备份）
- 浏览器 IndexedDB（自动备份，保留最近5份）

**备份保留策略：**
| 备份类型 | 保留数量 | 说明 |
|----------|----------|------|
| 自动备份 | 最近5份 | 超过自动删除最旧的 |
| 手动备份 | 无限制 | 用户自行管理 |

### 9.3 数据导入功能

#### 9.3.1 兼容性要求

**版本兼容策略：**
- 向后兼容：新版本可以导入旧版本备份
- 版本转换：自动处理数据结构差异
- 版本提示：导入不兼容版本时给出明确提示

**兼容版本范围：**
- 当前版本：完全兼容
- 前1个大版本：自动迁移
- 更早版本：提示用户更新游戏

#### 9.3.2 校验机制

**校验流程：**
1. **文件格式校验**：验证 JSON 格式是否正确
2. **版本兼容性校验**：检查备份文件版本
3. **数据完整性校验**：验证 checksum 是否匹配
4. **结构完整性校验**：验证必需字段是否存在
5. **数据类型校验**：验证数据类型是否正确

**校验失败处理：**
| 校验类型 | 失败处理 | 用户提示 |
|----------|----------|----------|
| 文件格式错误 | 拒绝导入 | "备份文件格式错误" |
| 版本不兼容 | 拒绝导入 | "备份文件版本过旧，请更新游戏" |
| 数据损坏 | 拒绝导入 | "备份文件已损坏" |
| 结构不完整 | 尝试部分导入 | "部分数据缺失，是否继续导入" |

#### 9.3.3 异常处理流程

```
选择文件 → 文件格式校验 → 版本校验 → checksum校验 → 数据结构校验 → 数据导入 → 同步到IndexedDB → 完成提示
              ↓                ↓              ↓               ↓
           [格式错误]      [版本不兼容]    [数据损坏]      [结构不完整]
              ↓                ↓              ↓               ↓
           提示错误         提示错误         提示错误      提示确认继续
```

### 9.4 存档迁移操作步骤

#### 9.4.1 导出存档（旧设备）

1. 打开游戏设置界面
2. 点击"导出存档"按钮
3. 确认导出操作
4. 浏览器自动下载备份文件
5. 通过邮件、云盘等方式传输到新设备

#### 9.4.2 导入存档（新设备）

1. 打开游戏设置界面
2. 点击"导入存档"按钮
3. 选择备份文件
4. 系统自动校验文件
5. 确认覆盖现有存档（如有）
6. 等待导入完成
7. 重新加载游戏

#### 9.4.3 迁移注意事项

| 注意事项 | 说明 |
|----------|------|
| 数据覆盖 | 导入会覆盖当前所有游戏数据 |
| 网络要求 | 无需网络，纯本地操作 |
| 文件大小 | 备份文件通常 < 100KB |
| 兼容性 | 确保新旧设备游戏版本一致 |

### 9.5 安全保障措施

#### 9.5.1 数据加密

**加密方式：** AES-256-GCM

**加密内容：**
- 用户角色名称
- 角色属性数据
- 游戏进度数据

**加密密钥：**
- 使用用户设备唯一标识生成
- 不存储在服务器端
- 用户自行负责备份文件安全

#### 9.5.2 数据校验

**校验和算法：** SHA-256

**校验时机：**
- 导出时生成校验和
- 导入时验证校验和
- 确保数据完整性

#### 9.5.3 权限控制

**访问限制：**
- 仅游戏内部可访问备份文件
- 不向第三方分享数据
- 用户完全控制数据

**隐私保护：**
- 不收集用户个人信息
- 不上传备份文件到服务器
- 所有操作均在本地完成

### 9.6 API 接口设计

#### 9.6.1 备份服务接口

```typescript
export interface IBackupService {
  // 创建备份
  createBackup(): Promise<BackupFile>;
  
  // 导出备份文件（触发下载）
  exportBackup(): Promise<void>;
  
  // 获取自动备份列表
  getAutoBackups(): Promise<BackupFile[]>;
  
  // 删除指定备份
  deleteBackup(timestamp: number): Promise<void>;
  
  // 清空所有自动备份
  clearAutoBackups(): Promise<void>;
}
```

#### 9.6.2 导入服务接口

```typescript
export interface IImportService {
  // 校验备份文件
  validateBackup(file: File): Promise<ValidationResult>;
  
  // 导入备份文件
  importBackup(file: File): Promise<ImportResult>;
  
  // 检查版本兼容性
  checkVersionCompatibility(backupVersion: string): CompatibilityResult;
}
```

#### 9.6.3 类型定义

```typescript
interface ValidationResult {
  success: boolean;
  error?: string;
  version?: string;
  timestamp?: number;
  gameVersion?: string;
}

interface ImportResult {
  success: boolean;
  error?: string;
  importedStores: string[];
  skippedStores: string[];
}

interface CompatibilityResult {
  compatible: boolean;
  message: string;
  requiresMigration: boolean;
}
```

### 9.7 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-19 | 初始版本，支持基础备份导入功能 | System |

---

**文档结束**
