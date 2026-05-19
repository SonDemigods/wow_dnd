# 技能模块设计文档

## 文档信息

| 项目   | 内容               |
| ---- | ---------------- |
| 标题   | 技能模块设计文档         |
| 版本   | v2.0             |
| 生成日期 | 2026年5月19日       |
| 所属模块 | `modules/skills` |

***

## 模块概述与定位

### 模块定位

技能模块负责管理玩家的技能学习、技能栏配置和技能使用。它提供技能的学习、遗忘、技能栏配置和技能使用等核心功能。

### 核心职责

| 职责      | 描述             |
| ------- | -------------- |
| 技能学习    | 根据等级解锁新技能      |
| 技能遗忘    | 遗忘已学技能         |
| 技能使用    | 使用技能并消耗MP      |
| 技能栏管理   | 管理当前可使用的4个技能槽位 |
| 职业技能初始化 | 根据职业加载技能树      |

### 模块边界

**技能模块**与以下模块交互:

- 角色模块:消耗MP、获取等级和职业
- 战斗模块:技能伤害计算、战斗状态判断
- 事件总线:发布技能事件

***

## 功能需求

### 功能需求列表

| 需求编号         | 需求描述              | 来源   |
| ------------ | ----------------- | ---- |
| FR-SKILL-001 | 支持技能学习与等级解锁       | 核心功能 |
| FR-SKILL-002 | 支持技能遗忘            | 核心功能 |
| FR-SKILL-003 | 支持技能使用（最大4个可使用技能） | 核心功能 |
| FR-SKILL-004 | 支持技能栏配置（非战斗时可调）   | 核心功能 |
| FR-SKILL-005 | 支持职业技能初始化         | 职业系统 |
| FR-SKILL-006 | 数据持久化存储           | 存档系统 |
| FR-SKILL-007 | 支持技能类型区分（物理伤害、魔法伤害、治疗） | 技能系统 |
| FR-SKILL-008 | 非战斗期间不能使用技能 | 战斗限制 |

### 非功能需求

| 需求编号          | 需求描述          | 优先级 |
| ------------- | ------------- | --- |
| NFR-SKILL-001 | MP消耗验证        | 高   |
| NFR-SKILL-002 | 技能栏容量限制（最大4个） | 高   |
| NFR-SKILL-003 | 战斗状态校验        | 高   |

***

## 接口定义

### 服务接口 ISkillsService

```typescript
export interface ISkillsService {
  // === 技能查询 ===
  getSkills(): Skill[];
  getSkill(id: string): Skill | null;
  getEquippedSkills(): Skill[];
  getUnlockedSkills(): Skill[];
  getLockedSkills(): Skill[];
  
  // === 技能操作 ===
  canUseSkill(skillId: string): boolean;
  useSkill(skillId: string): SkillUseResult;
  equipSkill(skillId: string, slotIndex: number): boolean;
  unequipSkill(slotIndex: number): boolean;
  swapSkills(slotIndex1: number, slotIndex2: number): boolean;
  
  // === 技能类型查询 ===
  getSkillsByType(type: SkillType): Skill[];
  calculateSkillEffect(skillId: string): SkillEffect;
  
  // === 系统操作 ===
  checkLevelUnlocks(): void;
  reset(): void;
}
```

### 数据类型定义

```typescript
export type SkillType = 'physical_damage' | 'magic_damage' | 'heal';

export interface SkillEffect {
  type: SkillType;
  value: number;
  coefficient?: number;
}

export interface Skill {
  id: string;
  name: string;
  icon: string;
  description: string;
  mpCost: number;
  type: SkillType;
  effect: SkillEffect;
  unlockLevel: number;
  isUnlocked: boolean;
}

export interface SkillUseResult {
  success: boolean;
  skillId: string;
  type: SkillType;
  damage?: number;
  heal?: number;
  defense?: number;
  message: string;
}

export interface SkillBar {
  slots: (string | null)[];  // 4个技能槽位，存储技能ID或null
}
```

### 事件定义

| 事件名称                | 触发时机      | 事件数据                     |
| ------------------- | --------- | ------------------------ |
| `SKILL_CAST`        | 技能使用时     | `{ skill, success }`     |
| `SKILL_EQUIPPED`    | 技能装备到技能栏时 | `{ skillId, slotIndex }` |
| `SKILL_UNLOCKED`    | 技能解锁时     | `{ skill }`              |
| `SKILL_BAR_CHANGED` | 技能栏变化时    | `{ slots }`              |

***

## 业务逻辑流程

### 技能使用流程

1. 检查是否处于战斗状态，如果非战斗则返回失败
2. 检查技能是否在技能栏中
3. 检查MP是否充足
4. 如果满足条件:
   - 消耗MP
   - 执行技能效果（根据技能类型计算伤害/治疗/防御）
   - 触发 `SKILL_CAST` 事件
5. 如果不满足条件,返回失败

### 技能栏配置流程

1. 检查是否处于战斗状态
2. 如果非战斗:
   - 验证技能是否已解锁
   - 验证槽位索引有效(0-3)
   - 将技能装备到指定槽位
   - 触发 `SKILL_EQUIPPED` 事件
3. 如果战斗中,返回失败

### 技能解锁流程

1. 检查玩家当前等级
2. 遍历所有技能,检查解锁等级条件
3. 如果技能未解锁且等级满足:
   - 标记技能为已解锁
   - 触发 `SKILL_UNLOCKED` 事件

***

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| skills | 'skills' | SkillsData | 技能完整数据 |

### SkillsData 存储内容

| 字段             | 类型       | 默认值                                  | 说明             |
| -------------- | -------- | ------------------------------------ | -------------- |
| `id`           | string   | 'skills'                              | 唯一标识         |
| `skills`       | Skill\[] | \[]                                  | 职业技能列表（包含解锁状态） |
| `skillBar`     | SkillBar | { slots: \[null, null, null, null] } | 技能栏配置（4个槽位）    |
| `currentClass` | string   | null                                 | 当前职业           |
| `updatedAt`    | number   | Date.now()                           | 最后更新时间      |

### 技能栏槽位说明

| 槽位索引 | 说明   |
| ---- | ---- |
| 0    | 技能槽1 |
| 1    | 技能槽2 |
| 2    | 技能槽3 |
| 3    | 技能槽4 |

### 等级解锁规则

| 等级 | 解锁技能数   |
| -- | ------- |
| 1  | 2个基础技能  |
| 5  | 解锁第3个技能 |
| 10 | 解锁第4个技能 |
| 15 | 解锁所有技能  |

### 同步机制

| 同步类型 | 触发条件 | 延迟 |
|----------|----------|------|
| 自动同步 | 状态变更 | 500ms 防抖 |
| 立即同步 | 关键操作 | 即时 |
| 页面卸载 | beforeunload | 即时 |

***

## 与其他模块的交互关系

### 依赖关系

- **角色模块**:消耗MP、获取等级和职业属性
- **战斗模块**:技能伤害计算、战斗状态判断
- **事件总线**:发布技能事件

### 交互模块

| 模块   | 交互方式 | 说明                                     |
| ---- | ---- | -------------------------------------- |
| 角色模块 | 调用   | `addMp(-cost)` 消耗MP, `getLevel()` 获取等级 |
| 战斗模块 | 调用   | `isInCombat()` 判断战斗状态                  |
| 战斗模块 | 事件订阅 | 技能效果影响战斗                               |
| 角色模块 | 事件订阅 | 技能事件影响角色状态                             |

***

## 异常处理机制

### 异常类型与处理策略

| 异常类型    | 触发条件         | 处理策略     |
| ------- | ------------ | -------- |
| 技能不存在   | 使用未解锁的技能     | 返回 false |
| MP不足    | MP < 技能消耗    | 返回 false |
| 技能不在技能栏 | 技能未装备到技能栏    | 返回 false |
| 战斗中不可调整 | 战斗状态下尝试调整技能栏 | 返回 false |
| 技能栏已满   | 尝试装备超过4个技能   | 返回 false |
| 槽位索引无效  | 索引不在0-3范围内   | 返回 false |
| 存储读取失败 | IndexedDB 解析错误 | 使用默认值初始化    |
| 存储写入失败 | IndexedDB 写入异常 | 进入重试队列，指数退避重试 3 次 |

***

## 性能与安全考量

### 性能优化

| 优化点    | 实现方式      | 预期效果   |
| ------ | --------- | ------ |
| 技能缓存   | 内存缓存技能列表  | 快速访问   |
| 技能栏预计算 | 缓存已装备技能列表 | 减少查找时间 |
| 防抖同步 | 500ms 延迟合并写入 | 减少 IO 操作 |
| 批量写入 | SyncEngine 批量处理 | 提升性能 |
| 异步加载 | Store 初始化时异步从 IndexedDB 读取 | 不阻塞主线程 |

### 数据安全

| 安全措施 | 实现方式             |
| ---- | ---------------- |
| 输入验证 | 检查技能ID有效性和槽位索引范围 |
| 状态检查 | 操作前验证战斗状态        |
| 异常捕获 | 防止程序崩溃           |
| 重试机制 | 失败时自动重试 3 次       |
| 数据校验 | 写入前验证数据结构           |

***

## 模块文件结构

```
src/modules/skills/
  - index.ts          # 核心实现（Store + Service）
  - types.ts          # 类型定义
```

### 文件职责说明

| 文件         | 职责                         |
| ---------- | -------------------------- |
| `index.ts` | Pinia Store 实现、服务接口实现、技能逻辑 |
| `types.ts` | TypeScript 类型定义、接口定义       |

***

## 版本历史

| 版本   | 日期         | 修改内容                | 作者     |
| ---- | ---------- | ------------------- | ------ |
| v1.0 | 2026-05-15 | 初始版本,包含基础技能功能       | System |
| v1.1 | 2026-05-15 | 移除冷却时间设定            | System |
| v1.2 | 2026-05-15 | 添加技能栏系统(4槽位)和等级解锁机制 | System |
| v2.0 | 2026-05-19 | 迁移到 Pinia + IndexedDB 架构，实现自动同步持久化 | System |

***

**文档结束**
