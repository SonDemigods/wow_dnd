# 技能模块设计文档

## 文档信息

| 项目   | 内容               |
| ---- | ---------------- |
| 标题   | 技能模块设计文档         |
| 版本   | v3.0             |
| 生成日期 | 2026年6月16日       |
| 所属模块 | `modules/skill` |

***

## 模块概述与定位

### 模块定位

技能模块负责管理玩家的技能学习、技能栏配置和技能使用。它提供技能的学习、遗忘、技能栏配置和技能使用等核心功能。

### 核心职责

| 职责      | 描述             |
| ------- | -------------- |
| 技能学习    | 根据等级解锁新技能      |
| 技能遗忘    | 遗忘已学技能（通过卸下技能栏间接实现）      |
| 技能使用    | 使用技能并消耗MP      |
| 技能栏管理   | 管理当前可使用的4个技能槽位 |
| 职业技能初始化 | 根据职业加载技能模板      |
| 冷却管理    | 管理技能的冷却回合数     |

### 模块边界

**技能模块**与以下模块交互:

- 角色模块：消耗MP、获取等级和职业（通过直接调用 `useCharacterStore()` Action）
- 战斗模块：技能伤害/效果计算、冷却推进（通过直接调 `useCombatStore() Action`）
- 背包模块：技能物品掉落
- 事件总线：仅发布 UI 动画/音效事件（`SKILL_CAST`、`SKILL_LEARNED`）

### 跨模块通信机制

技能模块遵循"直接 Store Action 调用"模式：

- **技能模块 → 角色模块**：`castSkill()` 中直接调用 `characterStore.changeMp(-skill.mpCost)`、`characterStore.receiveHeal()`
- **其他模块 → 技能模块**：战斗模块通过 `useSkillsStore().tickCooldowns()` 推进冷却
- **事件总线**：仅保留 `SKILL_CAST`、`SKILL_LEARNED` 用于 UI 动画/音效通知

***

## 功能需求

### 功能需求列表

| 需求编号         | 需求描述                     | 来源   |
| ------------ | ------------------------ | ---- |
| FR-SKILL-001 | 支持技能学习与等级解锁，只能查看解锁本职业的技能 | 核心功能 |
| FR-SKILL-002 | 支持技能遗忘                   | 核心功能 |
| FR-SKILL-003 | 支持技能使用（最大4个可使用技能）        | 核心功能 |
| FR-SKILL-004 | 支持技能栏配置（4个槽位，可装备/卸下/交换）          | 核心功能 |
| FR-SKILL-005 | 支持职业技能模板加载                | 职业系统 |
| FR-SKILL-006 | 数据持久化存储                  | 存档系统 |
| FR-SKILL-007 | 支持6种技能类型区分（物理伤害、魔法伤害、生命恢复、法力恢复、增益、减益）   | 技能系统 |
| FR-SKILL-008 | 支持技能冷却机制                  | 战斗限制 |
| FR-SKILL-009 | 支持技能目标类型（单体/全体敌人/自身/友方）    | 目标系统 |
| FR-SKILL-010 | 支持怪物/首领技能模板（usableBy = 'enemy' | 'both'） | AI 系统 |
| FR-SKILL-011 | 支持 Buff/Debuff 效果（attack_up、poison、shield 等） | 效果系统 |

### 非功能需求

| 需求编号          | 需求描述          | 优先级 |
| ------------- | ------------- | --- |
| NFR-SKILL-001 | MP消耗验证        | 高   |
| NFR-SKILL-002 | 技能栏容量限制（最大4个） | 高   |
| NFR-SKILL-003 | 冷却状态校验        | 高   |

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
  equipSkill(skillId: string, slotIndex: SkillSlotIndex): boolean;
  unequipSkill(slotIndex: SkillSlotIndex): boolean;
  swapSkills(slotIndex1: SkillSlotIndex, slotIndex2: SkillSlotIndex): boolean;
  
  // === 技能类型查询 ===
  getSkillsByType(type: SkillType): Skill[];
  calculateSkillEffect(skillId: string): SkillEffect;
  
  // === 系统操作 ===
  checkLevelUnlocks(shouldAutoEquip?: boolean): void;
  reset(): void;
}
```

### 数据类型定义

```typescript
/** 技能类型（6种） */
export type SkillType =
  | 'physical_damage'   // 物理伤害
  | 'magic_damage'      // 魔法伤害
  | 'health_restore'    // 生命恢复
  | 'mana_restore'      // 法力恢复
  | 'buff'              // 增益
  | 'debuff';           // 减益

/** 技能槽位索引 */
export type SkillSlotIndex = 0 | 1 | 2 | 3;

/** 技能效果 */
export interface SkillEffect {
  type: SkillType;
  value: number;
  /** 系数（用于计算实际效果，优先级高于等级推算系数） */
  coefficient?: number;
}

/** Buff/Debuff 效果配置（type 引用 combat/effects 的 EffectType） */
export interface SkillBuffEffect {
  /** 效果类型（如 attack_up、poison、shield、stun、freeze 等） */
  type: EffectType;
  /** 效果基础值 */
  value: number;
  /** 持续回合数 */
  turns: number;
}

/** 技能数据 */
export interface Skill {
  id: string;
  name: string;
  icon: string;
  description: string;
  mpCost: number;
  type: SkillType;
  effect: SkillEffect;
  unlockLevel: number;
  /** 冷却回合数，0 = 无冷却 */
  cooldown?: number;
  /** 可使用此技能的角色类型 */
  usableBy?: 'player' | 'enemy' | 'both';
  /** 技能目标类型 */
  targetType?: 'single' | 'all_enemies' | 'self' | 'ally';
  /** Buff/Debuff 效果列表（仅 buff/debuff 类型技能使用） */
  buffs?: SkillBuffEffect[];
}

/** 技能施放应用的效果记录 */
export interface AppliedEffectInfo {
  type: EffectType;
  value: number;
  turns: number;
}

/** 技能使用结果 */
export interface SkillUseResult {
  success: boolean;
  skillId: string;
  type: SkillType;
  damage?: number;
  heal?: number;
  message: string;
  /** 施加的效果列表（buff/debuff 技能时返回） */
  appliedEffects?: AppliedEffectInfo[];
}

/** 技能栏配置（固定4槽位） */
export interface SkillBar {
  slots: [string | null, string | null, string | null, string | null];
}

/** 技能模块存储数据 */
export interface SkillsData {
  characterId: string;
  skills: Skill[];
  skillBar: SkillBar;
  currentClass: string | null;
  updatedAt: number;
}

/** 技能查询条件 */
export interface SkillQuery {
  type?: SkillType;
  isUnlocked?: boolean;
  minUnlockLevel?: number;
  maxUnlockLevel?: number;
}

/** 技能施放验证结果 */
export interface SkillValidationResult {
  canUse: boolean;
  failureReason?:
    | 'not_in_combat'
    | 'not_equipped'
    | 'insufficient_mp'
    | 'not_unlocked';
  currentMp?: number;
  requiredMp?: number;
}
```

### 事件定义

| 事件名称                | 触发时机      | 事件数据                     |
| ------------------- | --------- | ------------------------ |
| `SKILL_CAST`        | 技能使用时     | `{ skill, success }`     |
| `SKILL_LEARNED`    | 技能学会时 | `{ skill }` |

> 注意：`SKILL_EQUIPPED`、`SKILL_UNLOCKED`、`SKILL_BAR_CHANGED` 在新架构中不再作为独立的 EventBus 事件发出，而是由 Store 的 computed 属性（如 `equippedSkills`、`unlockedSkills`）通过 Vue 响应式系统驱动 UI 更新。

***

## 业务逻辑流程

### 技能使用流程

1. 校验技能是否可施放：调用 `canCastSkill(skill, currentMana)` 检查法力是否充足
2. 消耗法力值：直接调用 `characterStore.changeMp(-skill.mpCost)`
3. 根据技能类型计算效果值：
   - `physical_damage`：`calculateSkillDamage(skill, stats)` → 基础值 + str × 系数
   - `magic_damage`：基础值 + int × 系数
   - `health_restore`：基础值 + wis × 系数 → 调用 `characterStore.receiveHeal()`
   - `mana_restore`：基础值 + int × 系数 → 调用 `characterStore.changeMp()`
   - `buff` / `debuff`：调用 `calculateBuffValue()` 计算效果值，通过 `appliedEffects` 返回
4. 如果技能有冷却，记录冷却回合数：`cooldowns[skillId] = skill.cooldown`
5. 触发 `SKILL_CAST` 事件（UI 动画/音效）
6. 记录冒险日志

### 技能栏配置流程

1. 验证槽位索引有效（0-3）：`validateSkillBarSlot()`
2. 验证技能已解锁（`skill.unlockLevel <= characterLevel`）
3. 如果技能不在已学列表中，自动添加
4. 如果槽位已有技能，先卸下
5. 装备新技能到指定槽位
6. 持久化到 IndexedDB

### 技能解锁流程

1. 遍历技能模板缓存中的技能
2. 对于未存在于 `skills` 列表且 `unlockLevel <= characterLevel` 的技能：
   - 添加到已学技能列表
   - 如果 `shouldAutoEquip === true`，自动装备到空槽位
   - 触发 `SKILL_LEARNED` 事件
   - 记录冒险日志
3. 初始化时 `shouldAutoEquip = false`，避免覆盖用户手动卸下的技能

### 冷却管理流程

1. 每回合结束时，战斗模块调用 `tickCooldowns()` 减少所有冷却回合数
2. 冷却为 0 时自动清除
3. 通过 `isOnCooldown(skillId)` 检查技能是否在冷却中

***

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store    | Key           | 数据结构       | 说明            |
| ----------- | ------------- | ---------- | ------------- |
| char_skills | `characterId` | SkillsData | 技能完整数据（按角色隔离） |
| config_skills | `id`        | SkillTemplateStorage | 技能模板（按职业隔离） |

### SkillsData 存储内容

| 字段             | 类型       | 默认值                                  | 说明             |
| -------------- | -------- | ------------------------------------ | -------------- |
| `characterId`  | string   | -                                    | 角色唯一标识         |
| `skills`       | Skill\[] | \[]                                  | 已学技能列表（包含锁定/解锁状态） |
| `skillBar`     | SkillBar | { slots: \[null, null, null, null] } | 技能栏配置（4个槽位）    |
| `currentClass` | string   | null                                 | 当前职业           |
| `updatedAt`    | number   | Date.now()                           | 最后更新时间         |

### 多角色支持说明

技能数据通过 `characterId` 字段实现角色隔离，每个角色拥有独立的技能解锁状态和技能栏配置。切换角色时，系统自动加载对应角色的技能数据，并根据角色职业重新初始化技能模板。删除角色时，级联删除该角色的技能数据。

### 技能栏槽位说明

| 槽位索引 | 说明   |
| ---- | ---- |
| 0    | 技能槽1 |
| 1    | 技能槽2 |
| 2    | 技能槽3 |
| 3    | 技能槽4 |

### 同步机制

| 同步类型 | 触发条件         | 延迟       |
| ---- | ------------ | -------- |
| 自动同步 | Action 完成后     | 即时持久化 |
| 页面卸载 | beforeunload | 即时       |

### Service 层纯函数

| 函数名                    | 功能                         |
| ------------------------ | ---------------------------- |
| `calculateSkillDamage()` | 计算技能伤害/效果值（按技能类型和属性系数） |
| `getSkillCoefficient()`  | 按解锁等级获取技能系数（分层缩放） |
| `calculateBuffValue()`   | 计算 Buff/Debuff 效果值（按效果类型和属性加成） |
| `checkManaCost()`        | 检查法力值是否足够施放技能   |
| `canLearnSkill()`        | 判断角色是否可以学习某个技能模板 |
| `validateSkillBarSlot()` | 验证技能栏槽位索引是否有效   |
| `isSkillEquipped()`      | 检查技能是否已装备在技能栏中 |
| `canCastSkill()`         | 校验技能是否可施放           |

***

## 与其他模块的交互关系

### 依赖关系

- **角色模块**：通过 `useCharacterStore()` 直接调用消耗 MP、获取等级和职业属性
- **战斗模块**：通过 Store 获取技能数据用于伤害计算，调用 `tickCooldowns()` 推进冷却
- **事件总线**：仅发布 `SKILL_CAST`、`SKILL_LEARNED` UI 事件

### 交互模块

| 模块   | 交互方式 | 说明                                     |
| ---- | ---- | -------------------------------------- |
| 角色模块 | 直接 Action 调用 | `changeMp(-cost)` 消耗法力，`receiveHeal()` 恢复生命，`getCharacterData()` 获取角色数据 |
| 战斗模块 | 直接 Action 调用 | `castSkill()` 返回伤害值供战斗计算，`tickCooldowns()` 推进冷却 |
| 日志模块 | 直接 Action 调用 | 记录技能学习/使用的冒险日志 |

***

## 异常处理机制

### 异常类型与处理策略

| 异常类型    | 触发条件           | 处理策略              |
| ------- | -------------- | ----------------- |
| 技能不存在   | 使用未解锁或未知的技能       | 返回 `{ success: false }`          |
| 法力不足    | MP < 技能消耗      | 返回 `{ success: false }`          |
| 存储读取失败  | IndexedDB 解析错误 | 使用默认值初始化（空技能列表、空技能栏）          |
| 存储写入失败  | IndexedDB 写入异常 | `dbService.withRetry` 自动重试 |

***

## 性能与安全考量

### 性能优化

| 优化点    | 实现方式                       | 预期效果     |
| ------ | -------------------------- | -------- |
| 技能缓存   | 内存缓存技能列表、技能模板（`skillTemplates`、`monsterSkillTemplates`）   | 快速访问     |
| 技能栏预计算 | `computed` 缓存 `equippedSkills`、`skillBarSlots`                  | 减少查找时间   |
| 即时持久化 | Action 完成后异步写 DB                            | 减少 IO 操作 |
| 异步加载   | Store `initialize` 时异步从 IndexedDB 读取 | 不阻塞主线程   |

### 数据安全

| 安全措施 | 实现方式             |
| ---- | ---------------- |
| 输入验证 | `validateSkillBarSlot` 检查槽位索引范围，`canCastSkill` 检查法力值 |
| 类型校验 | 技能类型使用 TypeScript 联合类型确保编译期安全        |
| 异常捕获 | `dbService.withRetry` 含重试机制           |
| 数据校验 | 写入前通过 `toRawData()` 处理数据       |

***

## 模块文件结构

```
src/modules/skill/
  - index.ts          # 模块入口，统一导出接口
  - types.ts          # 类型定义
  - db.ts             # 数据库操作层（SkillsDbService 类）
  - store.ts          # Pinia Store 状态管理（useSkillsStore）
  - service.ts        # 纯函数服务层（无状态、无副作用）
```

### 文件职责说明

| 文件           | 职责                                  |
| ------------- | ----------------------------------- |
| `index.ts`    | 模块入口，统一导出 types、db、service 和 useSkillsStore |
| `types.ts`    | TypeScript 类型定义、接口定义（Skill、SkillBar、SkillType 等）                 |
| `db.ts`       | IndexedDB 数据库操作层，封装 `char_skills` 和 `config_skills` 表读写（SkillsDbService 类）             |
| `store.ts`    | Pinia Store 状态管理，响应式数据维护。管理技能学习、技能栏装备、技能施放、等级解锁检测、冷却管理            |
| `service.ts`  | 纯函数服务层，包含伤害计算、Buff 效果计算、成本校验、学习判定等无状态逻辑                     |

***

## 版本历史

| 版本   | 日期         | 修改内容                                 | 作者     |
| ---- | ---------- | ------------------------------------ | ------ |
| v1.0 | 2026-05-15 | 初始版本，包含基础技能功能                        | System |
| v1.1 | 2026-05-15 | 移除冷却时间设定                             | System |
| v1.2 | 2026-05-15 | 添加技能栏系统(4槽位)和等级解锁机制                  | System |
| v2.0 | 2026-05-19 | 迁移到 Pinia + IndexedDB 架构，实现自动同步持久化   | System |
| v2.1 | 2026-05-20 | 简化技能类型，仅保留伤害和治疗两种类型，移除物理/魔法伤害区分及防御类型 | System |
| v2.2 | 2026-05-20 | 伤害类技能区分物理伤害和魔法伤害两种类型                 | System |
| v2.3 | 2026-06-16 | 模块路径重命名为 modules/skill，重构文件结构为 index.ts + types.ts + db.ts + store.ts + service.ts | System |
| v3.0 | 2026-06-16 | 全面更新与代码对齐：技能类型扩展为 6 种（+health_restore/mana_restore/buff/debuff）；新增 SkillBuffEffect 定义；Skill 新增 cooldown/usableBy/targetType/buffs 字段；SkillUseResult 新增 appliedEffects；跨模块通信改为直接 Store Action 调用；新增冷却管理（tickCooldowns/isOnCooldown）；新增怪物技能模板支持（loadMonsterSkillTemplates） | System |

***

**文档结束**
