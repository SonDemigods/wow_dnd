# 技能模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 技能模块设计文档 |
| 版本 | v4.2 |
| 生成日期 | 2026年7月10日 |
| 所属模块 | `modules/skill` |
| 更新说明 | 严格对齐源码：移除不存在的 `ISkillsService` 接口（Store 即对外接口）；修正 `SkillsData.skills` 类型为 `string[]`（仅存 ID，运行时从模板缓存还原）；移除不存在的 `SkillQuery` 与 `SkillValidationResult` 接口；新增 `SkillTemplateStorage` 存储类型定义；补全 `Skill` 接口的 `resourceType`/`resourceCost` 字段（BIZ-11）；新增 `CanCastSkillOptions` 接口，修正 `canCastSkill` 签名（支持 `CanCastSkillOptions \| number`）；修正 `getSkillCoefficient` 第三参数类型包含 `'buff'`；修正 `unequipSkill` 入参为 `skillId: string`（按 ID 查找槽位，非按 slotIndex）；补全 Store 导出（`monsterSkillTemplates`、`skillCountByType`、`getSkillTemplatesByClass`、`addSkillTemplate`、`removeSkillTemplate`、`getCooldownRemaining`、`resetCooldowns`、`SKILL_TYPE_NAMES`）；移除不存在的 `checkManaCost` 纯函数；修正文件结构树为标准树形格式 |

---

## 模块概述与定位

### 模块定位

技能模块负责管理玩家的技能学习、技能栏配置和技能使用。它提供技能的学习、遗忘、技能栏配置和技能使用等核心功能，并支持怪物/首领技能模板供敌人 AI 使用。

### 核心职责

| 职责 | 描述 |
|------|------|
| 技能学习 | 根据等级解锁新技能（含手动学习与等级自动解锁） |
| 技能遗忘 | 通过卸下技能栏间接实现（不删除已学技能） |
| 技能使用 | 使用技能并消耗 MP（含伤害/恢复/Buff/Debuff 多种效果） |
| 技能栏管理 | 管理当前可使用的 4 个技能槽位（装备/卸下/交换） |
| 职业技能初始化 | 根据职业加载技能模板到内存缓存 |
| 怪物技能模板 | 加载 `usableBy = 'enemy' | 'both'` 的技能供敌人 AI 使用 |
| 冷却管理 | 管理技能的冷却回合数（tick/reset/query） |
| 模板管理 | 管理后台新增/删除技能模板（同时更新缓存与 DB） |

### 模块边界

**技能模块**与以下模块交互：

- **角色模块**：消耗 MP、获取等级和职业、恢复 HP（通过直接调用 `useCharacterStore()` Action）
- **战斗模块**：技能伤害/效果计算、冷却推进与重置（战斗模块直接调用 `useSkillStore()` Action）
- **日志模块**：记录技能学习与使用的冒险日志
- **事件总线**：仅发布 `SKILL_CAST`、`SKILL_LEARNED` 用于 UI 动画/音效通知

### 跨模块通信机制

技能模块遵循"直接 Store Action 调用"模式：

- **技能模块 → 角色模块**：`castSkill()` 中直接调用 `characterStore.changeMp(-skill.mpCost)`、`characterStore.receiveHeal()`
- **其他模块 → 技能模块**：战斗模块通过 `useSkillStore().castSkill()`、`tickCooldowns()`、`resetCooldowns()`、`getSkill()` 等操作技能
- **事件总线**：仅保留 `SKILL_CAST`、`SKILL_LEARNED` 用于 UI 动画/音效通知

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-SKILL-001 | 支持技能学习与等级解锁，只能查看解锁本职业的技能 | 核心功能 |
| FR-SKILL-002 | 支持技能遗忘（通过卸下技能栏间接实现，不删除已学技能） | 核心功能 |
| FR-SKILL-003 | 支持技能使用（最大 4 个可使用技能） | 核心功能 |
| FR-SKILL-004 | 支持技能栏配置（4 个槽位，可装备/卸下/交换） | 核心功能 |
| FR-SKILL-005 | 支持职业技能模板加载（按 classRestriction 索引查询） | 职业系统 |
| FR-SKILL-006 | 数据持久化存储（`char_skills` + `config_skills` 双表） | 存档系统 |
| FR-SKILL-007 | 支持 6 种技能类型区分（物理伤害、魔法伤害、生命恢复、法力恢复、增益、减益） | 技能系统 |
| FR-SKILL-008 | 支持技能冷却机制（按回合 tick） | 战斗限制 |
| FR-SKILL-009 | 支持技能目标类型（单体/全体敌人/自身/友方） | 目标系统 |
| FR-SKILL-010 | 支持怪物/首领技能模板（`usableBy = 'enemy' | 'both'`） | AI 系统 |
| FR-SKILL-011 | 支持 Buff/Debuff 效果（attack_up、poison、shield、stun 等） | 效果系统 |
| FR-SKILL-012 | 支持资源系统消耗（BIZ-11：`resourceType` + `resourceCost` 扩展 MP 之外消耗） | 资源系统 |
| FR-SKILL-013 | 支持技能模板管理（新增/删除，同步缓存与 DB） | 管理后台 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-SKILL-001 | MP 消耗验证（`canCastSkill`） | 高 |
| NFR-SKILL-002 | 技能栏容量限制（最大 4 个，`SkillSlotIndex = 0|1|2|3`） | 高 |
| NFR-SKILL-003 | 冷却状态校验（`isOnCooldown` / `getCooldownRemaining`） | 高 |
| NFR-SKILL-004 | 数据规范化（`skills` 仅存 ID，避免冗余） | 中 |

---

## 模块文件结构

```
src/modules/skill/
  ├── index.ts          # 模块统一导出入口（类型、DbService、纯函数、Store）
  ├── types.ts          # TypeScript 类型定义（Skill、SkillBar、SkillsData 等）
  ├── db.ts             # 数据库操作层（SkillsDbService 类）
  ├── store.ts          # Pinia Store 状态管理（useSkillStore）
  └── service.ts        # 纯函数服务层（无状态、无副作用）
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | 模块入口，统一导出 types（10 项）、`skillsDbService` 实例、7 个纯函数、`useSkillStore` |
| `types.ts` | TypeScript 类型定义（`SkillType`、`SkillSlotIndex`、`SkillEffect`、`SkillBuffEffect`、`Skill`、`AppliedEffectInfo`、`SkillUseResult`、`SkillBar`、`SkillsData`、`SkillTemplateStorage`） |
| `db.ts` | IndexedDB 数据库操作层，封装 `char_skills` 和 `config_skills` 两表的读写（`SkillsDbService` 类，全局单例 `skillsDbService`） |
| `store.ts` | Pinia Store（`defineStore('skills')`），技能状态唯一持有者，编排 Service 纯函数 → 更新状态 → 持久化 → 通知 UI |
| `service.ts` | 纯函数服务层（无状态、无副作用、无异步），负责伤害计算、Buff 效果计算、施放校验、槽位校验等核心业务逻辑 |

---

## 接口定义

### 技能模块入口导出（index.ts）

```typescript
// 类型导出
export type {
  SkillType,
  SkillSlotIndex,
  SkillEffect,
  SkillBuffEffect,
  Skill,
  AppliedEffectInfo,
  SkillUseResult,
  SkillBar,
  SkillsData,
  SkillTemplateStorage
} from './types';

// 数据层
export { skillsDbService } from './db';

// 服务层纯函数
export {
  calculateSkillDamage,
  getSkillCoefficient,
  calculateBuffValue,
  canLearnSkill,
  validateSkillBarSlot,
  isSkillEquipped,
  canCastSkill
} from './service';

// Store
export { useSkillStore } from './store';
```

### 数据类型定义（types.ts）

```typescript
/** 技能类型（6 种） */
export type SkillType =
  | 'physical_damage'   // 物理伤害（受 STR 加成）
  | 'magic_damage'      // 魔法伤害（受 INT 加成）
  | 'health_restore'    // 生命恢复（受 WIS 加成）
  | 'mana_restore'      // 法力恢复（受 INT 加成）
  | 'buff'              // 增益
  | 'debuff';           // 减益

/** 技能槽位索引（字面量联合类型，编译时越界检查） */
export type SkillSlotIndex = 0 | 1 | 2 | 3;

/** 技能直接效果配置（伤害/恢复值，与 buffs 互补） */
export interface SkillEffect {
  type: SkillType;
  value: number;
  /** 自定义属性加成系数（优先级高于 getSkillCoefficient 自动计算） */
  coefficient?: number;
}

/** Buff/Debuff 效果配置（type 引用 combat/effects 的 EffectType） */
export interface SkillBuffEffect {
  /** 效果类型（attack_up / poison / shield / stun / freeze / silence 等） */
  type: EffectType;
  /** 效果基础值（含义因 type 而异） */
  value: number;
  /** 持续回合数 */
  turns: number;
}

/** 技能数据接口（运行时完整对象） */
export interface Skill {
  id: string;
  name: string;
  icon: string;
  description: string;
  mpCost: number;
  type: SkillType;
  effect: SkillEffect;
  unlockLevel: number;
  /** 冷却回合数（0 = 无冷却） */
  cooldown?: number;
  /** 可使用此技能的角色类型（默认 'player'） */
  usableBy?: 'player' | 'enemy' | 'both';
  /** 技能目标类型 */
  targetType?: 'single' | 'all_enemies' | 'self' | 'ally';
  /** Buff/Debuff 效果列表（仅 buff/debuff 类型技能使用） */
  buffs?: SkillBuffEffect[];
  /** 资源系统类型（BIZ-11：'rage'/'energy'/'combo_point' 等） */
  resourceType?: string;
  /** 资源消耗量（与 resourceType 配合使用） */
  resourceCost?: number;
}

/** 技能施放应用的效果记录（含属性加成后的最终数值） */
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

/** 技能栏配置（固定 4 槽位） */
export interface SkillBar {
  slots: [string | null, string | null, string | null, string | null];
}

/** 技能模块存储数据（角色技能运行时状态） */
export interface SkillsData {
  characterId: string;
  /** 已学技能 ID 列表（仅存 ID，完整 Skill 对象从 config_skills 模板按 ID 还原） */
  skills: string[];
  skillBar: SkillBar;
  currentClass: string | null;
  updatedAt: number;
}

/** 技能模板存储接口（config_skills 表的存储格式） */
export interface SkillTemplateStorage {
  id: string;
  name: string;
  icon: string;
  description: string;
  mpCost: number;
  type: SkillType;
  effect: { type: SkillType; value: number; coefficient?: number };
  unlockLevel: number;
  /** 职业限制（null = 所有职业可用） */
  classRestriction: string | null;
  /** 目标类型（存储为 string，运行时通过 toSkill 收窄为字面量联合类型） */
  targetType?: string;
  usableBy?: 'player' | 'enemy' | 'both';
  cooldown?: number;
  buffs?: SkillBuffEffect[];
  resourceType?: string;
  resourceCost?: number;
}
```

### 服务层纯函数（service.ts）

```typescript
/**
 * canCastSkill 的扩展选项接口（BIZ-11）
 *
 * 封装除技能本身和法力值之外的所有施放前校验输入。
 */
export interface CanCastSkillOptions {
  /** 角色当前法力值（必填，对应旧签名第二个参数） */
  currentMana: number;
  /** 是否处于沉默状态（true 时禁止施放任何技能） */
  isSilenced?: boolean;
  /** 当前剩余冷却回合数（>0 表示冷却中；未传入则跳过冷却校验） */
  currentCooldown?: number;
  /** 资源充足判定回调，由调用方根据角色实际资源状态实现 */
  hasEnoughResource?: (resourceType: string, cost: number) => boolean;
}

/**
 * 计算技能伤害/效果值（综合核心算法）
 *
 * 公式：基础值 + 属性 × 系数
 * - physical_damage：STR 加成
 * - magic_damage：INT 加成
 * - health_restore：WIS 加成
 * - mana_restore：INT 加成
 * - buff/debuff：固定返回 0（实际效果通过 calculateBuffValue 计算）
 *
 * 系数优先级：`skill.effect.coefficient`（手动指定） > `getSkillCoefficient(unlockLevel, type)`（自动计算）
 */
export function calculateSkillDamage(skill: Skill, stats: Stats): number;

/**
 * 按解锁等级获取技能属性加成系数（分层缩放算法）
 *
 * 分层规则：
 * | 等级区间 | Tier | damage 系数 | heal 系数 |
 * |----------|------|-------------|-----------|
 * | 1-2      | 0    | 0.50        | 0.30      |
 * | 3-5      | 1    | 0.54        | 0.335     |
 * | 6-8      | 2    | 0.58        | 0.37      |
 * | 9-10     | 3    | 0.62        | 0.405     |
 *
 * @param type - 'damage'（伤害/法力恢复）| 'heal'（生命恢复）| 'buff'（固定返回 0）
 */
export function getSkillCoefficient(
  unlockLevel: number,
  type: 'damage' | 'heal' | 'buff'
): number;

/**
 * 计算 Buff/Debuff 技能的实际效果值（受属性加成）
 *
 * 加成规则：
 * - 百分比类（attack_up/down、defense_up/down、vulnerable）：WIS × 系数
 * - 固定值类（poison/burn/regen/shield）：WIS × 系数
 * - 倍率类（thorn）：`min(0.60, value + WIS × 0.005)`
 * - 控制类（stun/freeze/silence）：直接返回 value（不缩放）
 * - 速度类（speed_up/down）：DEX × 0.30
 */
export function calculateBuffValue(buffEffect: SkillBuffEffect, stats: Stats): number;

/** 判断角色是否可以学习某个技能模板（等级 + 防重复学习） */
export function canLearnSkill(
  skillTemplate: Skill,
  characterLevel: number,
  currentSkills: Skill[]
): boolean;

/** 验证技能栏槽位索引是否有效（0-3） */
export function validateSkillBarSlot(slotIndex: number): boolean;

/** 检查技能是否已装备在技能栏中 */
export function isSkillEquipped(skillBar: SkillBar, skillId: string): boolean;

/**
 * 校验技能是否可施放（BIZ-11 四维校验）
 *
 * 校验顺序（短路求值）：
 * 1. 沉默状态：isSilenced === true → 禁止施放
 * 2. 冷却时间：currentCooldown > 0 → 冷却中
 * 3. 法力值：currentMana < skill.mpCost → 法力不足
 * 4. 资源系统：skill 配置 resourceType + resourceCost 且 hasEnoughResource 返回 false → 资源不足
 *
 * 向后兼容：第二个参数为 number 时视为 currentMana，等价于 `{ currentMana }`。
 */
export function canCastSkill(
  skill: Skill,
  options: CanCastSkillOptions | number
): { canCast: boolean; reason: string };
```

### 数据层接口（db.ts）

```typescript
export class SkillsDbService {
  // === 角色技能数据（char_skills 表） ===
  async saveSkillsData(data: SkillsData): Promise<void>;
  async getSkillsData(characterId: string): Promise<SkillsData>;
  async deleteSkillsData(characterId: string): Promise<void>;

  // === 技能模板（config_skills 表） ===
  async saveSkillTemplate(skill: Skill, classRestriction?: string): Promise<void>;
  async getSkillTemplate(skillId: string): Promise<Skill | null>;
  async getAllSkillTemplates(): Promise<Skill[]>;
  async getSkillTemplatesByClass(classId: string): Promise<Skill[]>;
  async getMonsterSkillTemplates(): Promise<Skill[]>;
  async deleteSkillTemplate(skillId: string): Promise<void>;
}

export const skillsDbService: SkillsDbService;
```

---

## 通过 EventBus 发布的事件

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `SKILL_CAST` | 技能施放成功时 | `{ skill: Skill; success: boolean }` |
| `SKILL_LEARNED` | 学习新技能时（手动学习或等级解锁） | `{ skill: Skill }` |

> 注意：技能栏装备/卸下/交换、冷却推进等操作不再作为独立的 EventBus 事件发出，而是由 Store 的 computed 属性（如 `equippedSkills`、`unlockedSkills`、`skillBarSlots`）通过 Vue 响应式系统驱动 UI 更新。

---

## 业务逻辑流程

### 技能施放流程（castSkill）

1. 查找技能：优先 `skills` 列表，其次 `skillTemplates` 缓存（支持模板技能施放）
2. 校验法力值：调用 `canCastSkill(skill, currentMana)` 检查法力是否充足
3. 校验冷却：调用 `isOnCooldown(skillId)` 检查冷却中（返回失败原因含剩余回合数）
4. 消耗法力值：`characterStore.changeMp(-skill.mpCost)`
5. 计算效果值：`calculateSkillDamage(skill, characterStore.effectiveStats)`
6. 按技能类型执行效果：
   - `physical_damage` / `magic_damage`：返回 `damage` 值，由调用方（combatStore）应用到目标
   - `health_restore`：返回 `heal` 并调用 `characterStore.receiveHeal(damageValue)`
   - `mana_restore`：调用 `characterStore.changeMp(damageValue)`
   - `buff` / `debuff`：调用 `calculateBuffValue()` 计算每个效果值，通过 `appliedEffects` 传回调用方
7. 触发 `SKILL_CAST` 事件（UI 动画/音效）
8. 记录冒险日志（非战斗场景，由 `skipAdventureLog` 参数控制）
9. 记录冷却：`cooldowns[skillId] = skill.cooldown`（仅当 `skill.cooldown > 0`）
10. 返回 `SkillUseResult`

### 技能栏装备流程（equipSkill）

1. 校验槽位索引有效（0-3）：`validateSkillBarSlot(slotIndex)`
2. 查找技能：优先 `skills` 列表，其次 `skillTemplates` 缓存
3. 校验等级：`skill.unlockLevel <= characterStore.level`
4. 如果技能不在 `skills` 列表中，自动添加（支持从模板直接装备）
5. 直接覆盖目标槽位（无需先设为 null）
6. 持久化到 IndexedDB

### 技能栏卸下流程（unequipSkill）

1. 遍历 4 个槽位查找 `skillId`
2. 找到后将其设为 `null`（不删除已学技能，仅从技能栏移除）
3. 持久化到 IndexedDB
4. 返回 `true`（未找到返回 `false`）

### 技能栏交换流程（swapSkills）

1. 校验两槽位不同（相同返回 `false`）
2. 经典三变量交换
3. 持久化到 IndexedDB

### 技能学习流程（learnSkill）

1. 从 `skillTemplates` 缓存获取技能模板
2. 调用 `canLearnSkill(template, characterLevel, skills)` 校验（等级 + 防重复）
3. 添加技能副本到 `skills` 列表（展开运算符防止引用共享）
4. 自动装备到第一个空槽位（如果有）
5. 持久化到 IndexedDB
6. 调用 `logSkillLearned(template)`：触发 `SKILL_LEARNED` 事件 + 写入冒险日志

### 等级解锁流程（checkLevelUnlocks）

1. 遍历 `skillTemplates` 中的所有技能
2. 对于未存在于 `skills` 列表且 `unlockLevel <= characterLevel` 的技能：
   - 添加到 `skills` 列表（副本）
   - 如果 `shouldAutoEquip === true`，自动装备到第一个空槽位
   - 调用 `logSkillLearned(template)` 触发事件和日志
3. 有新技能解锁时才调用 `persist()` 持久化（避免无效写入）

> 初始化时传入 `shouldAutoEquip = false`，避免覆盖用户手动卸下的技能；升级时传入 `true`，正常自动装备。

### 冷却管理流程

1. **推进冷却**：每回合结束时调用 `tickCooldowns()`，遍历 `cooldowns` 中所有条目减 1，减到 0 自动删除
2. **重置冷却**：战斗开始时调用 `resetCooldowns()`，清空所有冷却状态（防止跨战斗冷却残留）
3. **查询冷却**：`isOnCooldown(skillId)` 返回是否冷却中，`getCooldownRemaining(skillId)` 返回剩余回合数

### 初始化流程（initialize）

1. 加载职业技能模板到 `skillTemplates` 缓存（`loadTemplatesForClass(classId)`）
2. 加载怪物/首领技能模板到 `monsterSkillTemplates` 缓存（`loadMonsterSkillTemplates()`）
3. 从 DB 读取角色技能数据（仅 ID 数组 + 技能栏）
4. 用 `skillTemplates` 缓存将 ID 数组还原为完整 `Skill` 对象
5. 调用 `checkLevelUnlocks(false)` 检查等级解锁（不自动装备）

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库表 | Key | 数据结构 | 说明 |
|----------|-----|----------|------|
| `char_skills` | `characterId` | `SkillsData` | 角色技能数据（skills 仅存 ID 数组，按角色隔离） |
| `config_skills` | `id` | `SkillTemplateStorage` | 技能模板（按 `classRestriction` 和 `usableBy` 索引查询） |

### SkillsData 存储内容

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `characterId` | string | - | 角色唯一标识（主键） |
| `skills` | string[] | `[]` | 已学技能 ID 列表（仅存 ID，运行时从模板缓存还原） |
| `skillBar` | SkillBar | `{ slots: [null, null, null, null] }` | 技能栏配置（4 个槽位） |
| `currentClass` | string \| null | null | 当前职业 ID |
| `updatedAt` | number | `Date.now()` | 最后更新时间戳 |

### SkillTemplateStorage 存储内容

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 技能唯一标识（主键） |
| `name` | string | 技能名称 |
| `icon` | string | 技能图标（Iconify 格式） |
| `description` | string | 技能描述 |
| `mpCost` | number | 法力消耗 |
| `type` | SkillType | 技能类型 |
| `effect` | `{ type; value; coefficient? }` | 技能效果 |
| `unlockLevel` | number | 解锁等级 |
| `classRestriction` | string \| null | 职业限制（null = 所有职业可用） |
| `targetType` | string | 目标类型（存储为 string，运行时收窄为字面量联合） |
| `usableBy` | 'player' \| 'enemy' \| 'both' | 可用角色类型 |
| `cooldown` | number | 冷却回合数 |
| `buffs` | SkillBuffEffect[] | Buff/Debuff 效果列表 |
| `resourceType` | string | 资源系统类型（BIZ-11） |
| `resourceCost` | number | 资源消耗量（BIZ-11） |

### 数据规范化设计

技能数据采用"存 ID + 运行时查模板"模式：

- `char_skills.skills` 仅存储技能 ID 数组，不存储完整 `Skill` 对象
- 完整技能数据仅在 `config_skills` 表中存储一份
- 优势：避免数据冗余、模板更新后所有玩家技能效果自动同步、减少存储空间
- 转换流程：IndexedDB 原始数据 → `SkillTemplateStorage`（类型断言）→ `toSkill()` 转换 → `Skill`（运行时对象）

### 多角色支持说明

技能数据通过 `characterId` 字段实现角色隔离，每个角色拥有独立的技能解锁状态和技能栏配置。切换角色时，系统自动加载对应角色的技能数据，并根据角色职业重新初始化技能模板。删除角色时，级联删除该角色的技能数据（`deleteSkillsData`）。

### 技能栏槽位说明

| 槽位索引 | 说明 |
|----------|------|
| 0 | 技能槽 1 |
| 1 | 技能槽 2 |
| 2 | 技能槽 3 |
| 3 | 技能槽 4 |

### 同步机制

| 同步类型 | 触发条件 | 延迟 |
|----------|----------|------|
| 自动同步 | Action 完成后调用 `persist()` | 即时持久化（异步） |
| 防御性读取 | `getSkillsData` 校验 `skills`/`skillBar.slots` 类型 | 数据损坏时回退默认值 |

---

## 技能状态 Store 导出的公共接口

### 响应式状态

| 名称 | 类型 | 说明 |
|------|------|------|
| `skills` | ref\<Skill[]\> | 已学技能列表（运行时完整对象，从 DB 加载时由模板 ID 解析） |
| `skillBar` | ref\<SkillBar\> | 技能栏配置（4 个槽位，存储技能 ID 或 null） |
| `skillTemplates` | ref\<Map\<string, Skill\>\> | 职业技能模板缓存（按职业加载） |
| `monsterSkillTemplates` | ref\<Map\<string, Skill\>\> | 怪物/首领技能模板缓存（敌人 AI 专用） |
| `currentCharacterId` | ref\<string \| null\> | 当前操作的角色 ID |
| `isLoading` | ref\<boolean\> | 加载状态 |
| `cooldowns` | ref\<Record\<string, number\>\> | 冷却状态（key = skillId，value = 剩余回合数） |

### 计算属性

| 名称 | 类型 | 说明 |
|------|------|------|
| `unlockedSkills` | computed\<Skill[]\> | 已解锁技能（`unlockLevel <= characterLevel`） |
| `lockedSkills` | computed\<Skill[]\> | 未解锁技能（`unlockLevel > characterLevel`） |
| `equippedSkills` | computed\<(Skill \| null)[]\> | 技能栏中的完整 Skill 对象数组（空槽位为 null） |
| `skillBarSlots` | computed\<Array\<{index, skillId, skill, isEmpty}\>\> | 技能栏槽位详细信息（含索引和空状态） |
| `skillCountByType` | computed\<Record\<SkillType, number\>\> | 按类型统计技能数量 |

### Action

| 名称 | 签名 | 说明 |
|------|------|------|
| `initialize` | `(characterId?: string) => Promise<void>` | 初始化技能模块（加载模板 + 还原数据 + 等级解锁检查） |
| `learnSkill` | `(skillId: string) => Promise<boolean>` | 学习新技能（含自动装备到空槽位） |
| `castSkill` | `(skillId: string, skipAdventureLog?: boolean) => Promise<SkillUseResult>` | 施放技能（核心战斗操作） |
| `equipSkill` | `(skillId: string, slotIndex: SkillSlotIndex) => Promise<boolean>` | 装备技能到指定槽位 |
| `unequipSkill` | `(skillId: string) => Promise<boolean>` | 卸下指定技能（按 ID 查找槽位） |
| `swapSkills` | `(slotIndex1: SkillSlotIndex, slotIndex2: SkillSlotIndex) => Promise<boolean>` | 交换两个槽位的技能 |
| `getSkill` | `(skillId: string) => Skill \| null` | 查询技能（已学 → 玩家模板 → 怪物模板） |
| `getAvailableSkills` | `() => Skill[]` | 获取已解锁技能列表（代理到 `unlockedSkills`） |
| `getSkillsByType` | `(type: SkillType) => Skill[]` | 按类型获取技能 |
| `canUseSkill` | `(skillId: string) => boolean` | 综合校验（存在 + 等级 + MP + 冷却） |
| `loadTemplatesForClass` | `(classId: string) => Promise<void>` | 加载指定职业的技能模板到缓存 |
| `loadMonsterSkillTemplates` | `() => Promise<void>` | 加载怪物/首领技能模板到缓存 |
| `getSkillTemplatesByClass` | `(classId: string) => Promise<Skill[]>` | 直接查询 DB 获取职业模板（不修改 Store 状态） |
| `checkLevelUnlocks` | `(shouldAutoEquip?: boolean) => Promise<void>` | 等级解锁检查（默认 true 自动装备） |
| `addSkillTemplate` | `(skill: Skill) => Promise<void>` | 添加技能模板（同步缓存与 DB） |
| `removeSkillTemplate` | `(skillId: string) => Promise<void>` | 删除技能模板（同步缓存与 DB） |
| `reset` | `() => Promise<void>` | 重置技能数据到初始状态 |
| `tickCooldowns` | `() => void` | 减少所有冷却回合数（每回合结束调用） |
| `resetCooldowns` | `() => void` | 重置所有冷却（战斗开始时调用） |
| `isOnCooldown` | `(skillId: string) => boolean` | 检查技能是否冷却中 |
| `getCooldownRemaining` | `(skillId: string) => number` | 获取冷却剩余回合数 |

### 常量

| 名称 | 类型 | 说明 |
|------|------|------|
| `SKILL_TYPE_NAMES` | `Record<SkillType, string>` | 技能类型 → 中文名称映射表（UI 展示用） |

`SKILL_TYPE_NAMES` 内容：

```typescript
{
  physical_damage: '物理伤害',
  magic_damage: '魔法伤害',
  health_restore: '生命恢复',
  mana_restore: '法力恢复',
  buff: '增益',
  debuff: '减益'
}
```

---

## 与其他模块的交互关系

### 依赖关系

- **角色模块**：通过 `useCharacterStore()` 直接调用消耗 MP、获取等级和职业属性、恢复 HP
- **战斗模块**：通过 `useSkillStore()` 直接调用 `castSkill()`、`tickCooldowns()`、`resetCooldowns()`、`getSkill()`
- **日志模块**：通过 `useLogStore().addLogEntry()` 记录技能学习/使用的冒险日志
- **事件总线**：仅发布 `SKILL_CAST`、`SKILL_LEARNED` UI 事件

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 角色模块 | 直接 Action 调用 | `changeMp(-cost)` 消耗法力，`receiveHeal()` 恢复生命，`getCharacterData()` 获取角色数据，`effectiveStats` 获取属性，`level` 获取等级，`classId` 获取职业 |
| 战斗模块 | 直接 Action 调用 | `castSkill()` 返回 `SkillUseResult` 供战斗计算，`tickCooldowns()` 推进冷却，`resetCooldowns()` 重置冷却，`getSkill()` 查询技能数据 |
| 日志模块 | 直接 Action 调用 | `addLogEntry()` 记录技能学习/使用的冒险日志 |
| 事件总线 | `eventBus.emit` | `SKILL_CAST`、`SKILL_LEARNED` 用于 UI 动画/音效 |

---

## 异常处理机制

| 异常类型 | 触发条件 | 处理策略 |
|----------|----------|----------|
| 技能不存在 | 使用未解锁或未知的技能 ID | 返回 `{ success: false, message: '技能不存在' }` |
| 法力不足 | MP < 技能消耗 | 返回 `{ success: false, message: '法力不足' }` |
| 技能冷却中 | `isOnCooldown` 返回 true | 返回 `{ success: false, message: '技能冷却中（剩余 X 回合）' }` |
| 等级不足 | `skill.unlockLevel > characterLevel` | `equipSkill` 返回 false；`canUseSkill` 返回 false |
| 槽位无效 | `slotIndex` 不在 0-3 范围 | `equipSkill` 返回 false |
| 存储读取失败 | IndexedDB 解析错误或数据损坏 | 防御性校验：`skills` 不是数组回退为 `[]`，`skillBar.slots` 不是数组回退为全空槽位 |
| 存储写入失败 | IndexedDB 写入异常 | `dbService.withRetry` 自动重试 |

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 双模板缓存 | `skillTemplates`（玩家职业）+ `monsterSkillTemplates`（怪物）内存 Map 缓存 | 快速访问，避免重复 DB 查询 |
| 计算属性缓存 | `computed` 缓存 `unlockedSkills`、`lockedSkills`、`equippedSkills`、`skillBarSlots`、`skillCountByType` | 减少重复计算 |
| 数据规范化 | `char_skills.skills` 仅存 ID，运行时从模板缓存还原 | 减少 IndexedDB 存储空间，避免数据冗余 |
| 即时持久化 | Action 完成后异步调用 `persist()` 写 DB | 不阻塞 UI 主线程 |
| 条件持久化 | `checkLevelUnlocks` 仅在有新技能解锁时才 `persist()` | 避免无效写入 |
| 通用模板加载器 | `loadTemplatesTo` 封装"清空 → 查询 → 填充 Map"模式 | 避免代码重复 |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 输入验证 | `validateSkillBarSlot` 检查槽位索引范围，`canCastSkill` 检查法力值/冷却/资源 |
| 类型校验 | 技能类型使用 TypeScript 字面量联合类型确保编译期安全 |
| 类型收窄 | `toSkill()` 集中处理 DB string → 运行时字面量联合类型的转换 |
| 异常捕获 | `dbService.withRetry` 含重试机制 |
| 数据净化 | 写入前通过 `toRawData()` 去除 undefined 值，确保可被结构化克隆 |
| 引用隔离 | 学习/装备技能时使用展开运算符 `{ ...template }` 防止引用共享 |
| 防御性回退 | `effect` 缺失时默认为物理伤害；`cooldown` 缺失时默认 0；`buffs` 为 null 时转为 undefined |

---

## 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-15 | 初始版本，包含基础技能功能 | System |
| v1.1 | 2026-05-15 | 移除冷却时间设定 | System |
| v1.2 | 2026-05-15 | 添加技能栏系统(4槽位)和等级解锁机制 | System |
| v2.0 | 2026-05-19 | 迁移到 Pinia + IndexedDB 架构，实现自动同步持久化 | System |
| v2.1 | 2026-05-20 | 简化技能类型，仅保留伤害和治疗两种类型，移除物理/魔法伤害区分及防御类型 | System |
| v2.2 | 2026-05-20 | 伤害类技能区分物理伤害和魔法伤害两种类型 | System |
| v2.3 | 2026-06-16 | 模块路径重命名为 modules/skill，重构文件结构为 index.ts + types.ts + db.ts + store.ts + service.ts | System |
| v3.0 | 2026-06-16 | 全面更新与代码对齐：技能类型扩展为 6 种；新增 SkillBuffEffect 定义；Skill 新增 cooldown/usableBy/targetType/buffs 字段；跨模块通信改为直接 Store Action 调用；新增冷却管理；新增怪物技能模板支持 | System |
| v4.0 | 2026-06-17 | 逐文件比对验证：核心类型与代码一致 | System |
| v4.2 | 2026-07-10 | 严格对齐源码：移除不存在的 ISkillsService/SkillQuery/SkillValidationResult 接口；修正 SkillsData.skills 为 string[]；新增 SkillTemplateStorage 类型；补全 Skill 的 resourceType/resourceCost 字段（BIZ-11）；新增 CanCastSkillOptions 接口，修正 canCastSkill 签名；修正 getSkillCoefficient 第三参数类型；修正 unequipSkill 入参为 skillId；补全 Store 导出（monsterSkillTemplates/skillCountByType/getSkillTemplatesByClass/addSkillTemplate/removeSkillTemplate/getCooldownRemaining/resetCooldowns/SKILL_TYPE_NAMES）；移除不存在的 checkManaCost 纯函数；修正文件结构树格式 | System |

---

**文档结束**
