# 角色模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 角色模块设计文档 |
| 版本 | v2.0 |
| 生成日期 | 2026年5月19日 |
| 所属模块 | `modules/character` |

---

## 模块概述与定位

### 模块定位

角色模块是游戏的核心数据模块，负责管理玩家角色的所有属性、状态和成长数据。作为游戏的基础模块，它为战斗、任务、商店等其他模块提供角色数据支撑。

### 核心职责

| 职责 | 描述 |
|------|------|
| 角色创建 | 管理角色名称、阵营、种族、职业的选择与存储 |
| 核心属性管理 | 维护六大核心属性（力量、敏捷、体质、智力、感知、魅力），仅允许修改核心属性 |
| 次级属性计算 | 根据核心属性自动计算次级属性（物理攻击、物理防御、魔法攻击、魔法防御、暴击、闪避） |
| 成长系统 | 处理等级提升、经验积累、属性增长 |
| 状态管理 | 管理生命值、魔法值的恢复与消耗 |
| 金币管理 | 处理金币的获取与消耗 |
| 属性加成 | 处理装备、BUFF等临时属性加成 |
| 数据持久化 | 实现角色数据的本地存储与加载 |

### 模块边界

**角色模块**与以下模块交互：
- 装备模块：提供属性加成
- 战斗模块：消耗HP/MP
- 商店模块：消耗金币
- 技能模块：消耗MP
- 任务模块：获取经验和金币奖励

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-CHAR-001 | 支持角色名称设置 | 角色创建流程 |
| FR-CHAR-002 | 支持阵营选择（联盟/部落） | 角色创建流程 |
| FR-CHAR-003 | 支持种族选择（根据阵营） | 角色创建流程 |
| FR-CHAR-004 | 支持职业选择 | 角色创建流程 |
| FR-CHAR-005 | 经验值累加与升级检测 | 战斗/任务奖励 |
| FR-CHAR-006 | 等级提升时自动增加属性 | 成长系统 |
| FR-CHAR-007 | 生命值增减与边界控制 | 战斗/药水 |
| FR-CHAR-008 | 魔法值增减与边界控制 | 战斗/技能 |
| FR-CHAR-009 | 金币增减与边界控制 | 任务奖励/商店 |
| FR-CHAR-010 | 属性加成的应用与移除 | 装备系统 |
| FR-CHAR-011 | 数据持久化存储 | 存档系统 |
| FR-CHAR-012 | 数据加载恢复 | 读档系统 |
| FR-CHAR-013 | 玩家死亡后损失本级所有经验值 | 死亡惩罚 |
| FR-CHAR-014 | 玩家死亡后复活，生命法力恢复至最大值的一半 | 复活机制 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-CHAR-001 | 操作失败时回滚数据 | 高 |
| NFR-CHAR-002 | 单次操作响应时间 < 10ms | 高 |
| NFR-CHAR-003 | 支持并发操作 | 中 |
| NFR-CHAR-004 | 数据存储占用 < 1KB | 中 |

---

## 接口定义

### 服务接口 ICharacterService

```typescript
export interface ICharacterService {
  // === 状态查询 ===
  getStats(): Stats;
  getAttributes(): Attributes;
  getLevel(): number;
  getExp(): number;
  getExpToNextLevel(): number;
  getName(): string;
  getFaction(): 'alliance' | 'horde' | null;
  getRace(): string | null;
  getClass(): string | null;
  getGold(): number;
  getCharacterInfo(): CharacterInfo;
  
  // === 数据修改 ===
  addExp(amount: number): void;
  addHp(amount: number): void;
  addMp(amount: number): void;
  setHp(value: number): void;
  setMp(value: number): void;
  applyBonus(bonus: Partial<Stats>): void;
  removeBonus(bonus: Partial<Stats>): void;
  addGold(amount: number): void;
  spendGold(amount: number): boolean;
  
  // === 角色信息设置 ===
  setName(name: string): void;
  setFaction(faction: 'alliance' | 'horde'): void;
  setRace(race: string): void;
  setClass(charClass: string): void;
  
  // === 系统操作 ===
  reset(): void;
  
  // === 死亡处理 ===
  handleDeath(): void;
  resurrect(): void;
}
```

### 数据类型定义

```typescript
/** 六大核心属性 - 仅这些属性可直接修改 */
export interface CoreStats {
  str: number;  // 力量 - 影响物理攻击
  dex: number;  // 敏捷 - 影响闪避和暴击
  con: number;  // 体质 - 影响生命值上限
  int: number;  // 智力 - 影响魔法攻击
  wis: number;  // 感知 - 影响治疗效果
  cha: number;  // 魅力 - 影响对话和交易
}

/** 次级属性 - 根据核心属性自动计算，不可直接修改 */
export interface DerivedAttributes {
  maxHp: number;           // 最大生命值 = 100 + con * 10
  maxMana: number;         // 最大魔法值 = 50 + int * 5 + wis * 3
  physicalAttack: number;  // 物理攻击力 = str * 2 + dex * 0.5
  physicalDefense: number; // 物理防御力 = con * 1.5 + dex * 0.3
  magicAttack: number;     // 魔法攻击力 = int * 2 + wis * 0.5
  magicDefense: number;    // 魔法防御力 = wis * 1.5 + int * 0.5
  critChance: number;      // 暴击率 (%) = dex * 0.5
  dodgeChance: number;     // 闪避率 (%) = dex * 0.3
  hpBonus: number;         // 每级HP加成 = con * 2
  mpBonus: number;         // 每级MP加成 = int + wis
  healBonus: number;       // 治疗加成 = wis * 0.1
}

/** 角色信息 */
export interface CharacterInfo {
  name: string;
  race: string | null;
  class: string | null;
  faction: 'alliance' | 'horde' | null;
}
```

### 次级属性计算公式

| 次级属性 | 计算公式 | 依赖核心属性 |
|----------|----------|--------------|
| 最大生命值 | maxHp = 100 + con × 10 | 体质 |
| 最大魔法值 | maxMana = 50 + int × 5 + wis × 3 | 智力、感知 |
| 物理攻击力 | physicalAttack = str × 2 + dex × 0.5 | 力量、敏捷 |
| 物理防御力 | physicalDefense = con × 1.5 + dex × 0.3 | 体质、敏捷 |
| 魔法攻击力 | magicAttack = int × 2 + wis × 0.5 | 智力、感知 |
| 魔法防御力 | magicDefense = wis × 1.5 + int × 0.5 | 感知、智力 |
| 暴击率 (%) | critChance = dex × 0.5 | 敏捷 |
| 闪避率 (%) | dodgeChance = dex × 0.3 | 敏捷 |
| 每级HP加成 | hpBonus = con × 2 | 体质 |
| 每级MP加成 | mpBonus = int + wis | 智力、感知 |
| 治疗加成 | healBonus = wis × 0.1 | 感知 |

### 事件定义

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `CHARACTER_LEVEL_UP` | 角色升级时 | `{ oldLevel: number, newLevel: number }` |
| `CHARACTER_CORE_STATS_CHANGE` | 核心属性发生变化时 | `{ oldStats: CoreStats, newStats: CoreStats }` |
| `CHARACTER_HP_CHANGE` | 生命值变化时 | `{ oldHp: number, newHp: number, maxHp: number }` |
| `CHARACTER_MP_CHANGE` | 魔法值变化时 | `{ oldMp: number, newMp: number, maxMp: number }` |
| `CHARACTER_DEATH` | 角色死亡时 | `{ cause: string }` |
| `CHARACTER_RESURRECTED` | 角色复活时 | `{ newHp: number, newMp: number }` |

---

## 业务逻辑流程

### 经验值添加与升级流程

1. 调用 `addExp(amount)` 方法添加经验值
2. 检查当前经验值是否达到升级所需经验
3. 如果达到升级条件：
   - 增加等级
   - 扣除升级所需经验
   - 提升基础属性
   - 计算新的HP/MP上限
   - 恢复满HP/MP
   - 触发 `CHARACTER_LEVEL_UP` 事件
4. 如果经验值仍然达到升级条件，循环处理
5. 保存数据到本地存储

### 属性加成应用流程

1. 调用 `applyBonus(bonus)` 方法应用属性加成
2. 记录当前属性状态
3. 遍历bonus的所有键，累加到bonusStats
4. 触发 `CHARACTER_STATS_CHANGE` 事件
5. 保存数据到本地存储

### 金币消费流程

1. 调用 `spendGold(amount)` 方法消费金币
2. 检查当前金币是否充足
3. 如果充足，扣除金币并保存数据，返回 true
4. 如果不足，返回 false

### 死亡处理流程

1. 调用 `handleDeath()` 方法
2. 计算当前等级已获得的经验值
3. 扣除本级所有经验值（将exp设为0）
4. 触发 `CHARACTER_DEATH` 事件
5. 自动调用 `resurrect()` 方法

### 复活流程

1. 调用 `resurrect()` 方法
2. 将生命值恢复至最大值的50%
3. 将魔法值恢复至最大值的50%
4. 触发 `CHARACTER_RESURRECTED` 事件
5. 保存数据到本地存储

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| character | 'character' | CharacterData | 角色完整数据 |

### CharacterData 存储内容

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | string | 'character' | 唯一标识 |
| `name` | string | '冒险者' | 角色名称 |
| `faction` | 'alliance' \| 'horde' \| null | null | 阵营 |
| `race` | string \| null | null | 种族 |
| `class` | string \| null | null | 职业 |
| `level` | number | 1 | 当前等级 |
| `exp` | number | 0 | 当前经验值 |
| `gold` | number | 50 | 金币数量 |
| `baseStats` | Stats | 见下方 | 基础属性 |
| `currentHp` | number | 100 | 当前生命值 |
| `maxHp` | number | 100 | 最大生命值 |
| `currentMp` | number | 50 | 当前魔法值 |
| `maxMp` | number | 50 | 最大魔法值 |
| `bonusStats` | Partial<Stats> | {} | 属性加成 |
| `updatedAt` | number | Date.now() | 最后更新时间 |

**基础属性默认值：**

```typescript
baseStats: {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10
}
```

### 同步机制

| 同步类型 | 触发条件 | 延迟 |
|----------|----------|------|
| 自动同步 | 状态变更 | 500ms 防抖 |
| 立即同步 | 关键操作 | 即时 |
| 页面卸载 | beforeunload | 即时 |

---

## 与其他模块的交互关系

### 依赖关系

- **事件总线 (eventBus)**：发布属性变化事件，供UI组件监听
- **常量配置 (constants)**：获取经验曲线等配置

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 装备模块 | 事件订阅/调用 | 装备穿戴时调用 `applyBonus`，卸下时调用 `removeBonus` |
| 战斗模块 | 事件订阅/调用 | 战斗中调用 `addHp`、`addMp`、`setHp`、`setMp`、`addExp` |
| 技能模块 | 事件订阅 | 技能使用时消耗MP，通过事件通知 |
| 任务模块 | 调用 | 任务完成时调用 `addGold`、`addExp` |
| 商店模块 | 调用 | 购买时调用 `spendGold`，出售时调用 `addGold` |
| 探索模块 | 事件订阅 | 订阅 `exploration:playerDied` 事件，调用 `handleDeath()` |

### 事件订阅清单

| 事件 | 订阅模块 | 处理动作 |
|------|----------|----------|
| `CHARACTER_LEVEL_UP` | UI组件 | 更新等级显示 |
| `CHARACTER_HP_CHANGE` | UI组件 | 更新HP条显示 |
| `CHARACTER_MP_CHANGE` | UI组件 | 更新MP条显示 |
| `CHARACTER_STATS_CHANGE` | 装备模块 | 重新计算装备加成 |
| `CHARACTER_DEATH` | UI组件 | 显示死亡提示 |
| `CHARACTER_RESURRECTED` | UI组件 | 显示复活提示，更新HP/MP显示 |

---

## 异常处理机制

### 异常类型与处理策略

| 异常类型 | 触发条件 | 处理策略 | 错误提示 |
|----------|----------|----------|----------|
| 存储读取失败 | localStorage 解析错误 | 使用默认值初始化 | 控制台输出错误日志 |
| 存储写入失败 | localStorage 写入异常 | 静默失败，保留内存数据 | 控制台输出错误日志 |
| 负数值输入 | `addExp` 传入负数 | 忽略操作 | 无提示 |
| 金币不足 | `spendGold` 金额超过余额 | 返回 false | UI提示"金币不足" |
| HP溢出 | 超出最大HP | 自动截断到最大值 | 无提示 |
| MP溢出 | 超出最大MP | 自动截断到最大值 | 无提示 |

### 错误处理代码示例

```typescript
// 存储加载错误处理
function loadFromStorage() {
  try {
    const data = localStorage.getItem(CHARACTER_STORAGE_KEY);
    if (data) {
      const saved = JSON.parse(data);
      // 恢复数据...
    }
  } catch (e) {
    console.error('Failed to load character:', e);
    // 使用默认值，不中断程序
  }
}

// 金币消费验证
function spendGold(amount: number): boolean {
  if (gold.value >= amount) {
    gold.value -= amount;
    saveToStorage();
    return true;
  }
  return false; // 返回false让调用方处理
}
```

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 计算属性缓存 | 使用 `computed` 缓存 `stats` 和 `attributes` | 避免重复计算 |
| 批量存储 | 仅在数据变更时保存 | 减少IO操作 |
| 懒加载 | 初始化时才读取存储 | 加快启动速度 |

### 数据安全

| 安全措施 | 实现方式 | 说明 |
|----------|----------|------|
| 输入验证 | 所有数值操作进行边界检查 | 防止非法数据 |
| 数据隔离 | 使用独立存储键 | 避免数据污染 |
| 异常捕获 | 所有IO操作包裹 try-catch | 防止程序崩溃 |
| 数据备份 | 保留旧数据直到新数据写入成功 | 防止数据丢失 |

### 边界情况处理

| 边界情况 | 处理方式 |
|----------|----------|
| HP降到0 | 战斗模块处理死亡逻辑 |
| 等级达到上限 | 经验值不再累加（由常量控制） |
| 金币数量过大 | 使用 number 类型（支持极大值） |
| 存储被清空 | 使用默认值初始化 |

---

## 模块文件结构

```
src/modules/character/
  - index.ts          # 核心实现（Store + Service）
  - types.ts          # 类型定义
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | Pinia Store 实现、服务接口实现、数据持久化逻辑 |
| `types.ts` | TypeScript 类型定义、接口定义、事件类型定义 |

---

## 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-15 | 初始版本，包含基础功能 | System |
| v1.1 | 2026-05-18 | 添加死亡处理功能：损失本级经验值，复活后生命法力恢复至50% | System |

---

**文档结束**