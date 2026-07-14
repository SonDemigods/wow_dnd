# 战斗模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 战斗模块设计文档 |
| 版本 | v4.3 |
| 生成日期 | 2026年7月10日 |
| 所属模块 | `modules/combat` |
| 更新说明 | 严格对齐源码：修正 bossIntros 分类（ref 状态，非 computed）；补全 15 种效果处理器的具体实现公式（attackUp/attackDown/defenseUp/defenseDown/vulnerable/speedUp/speedDown/regen/thorn/poison/burn/stun/freeze/silence/shield）；补全 Boss 机制 applyMechanicEffect 的 6 种机制类型处理逻辑（stun_player/silence_player/debuff_aura/aoe_attack/summon_minions/healing_zone）；补全 useEnemyAction 的 mapSkillTypeToDamageType 与 applyEnemyDamageToPlayer 流程；补全 usePlayerAction 的 Boss 防御/反击/复活机制（invulnerable/shield/reflectDamage/counterStance/canRevive）；补全 PetBaseAttributes/Combatant/ResourceSystemFactoryMap 类型与 PET_AI_TARGET_PRIORITY 常量；补全 useFormStore/usePetStore 完整导出接口；补全敌人速度 fallback 值（stats?.dex ?? 5）与 evaluateCondition 方法；补全 handleLoot 背包满检查与掉落数量校验 |

---

## 模块概述与定位

### 模块定位

战斗模块是游戏的核心玩法模块，负责管理玩家与敌人之间的回合制战斗流程。它处理战斗状态管理、伤害计算、战斗行动、AI 策略、效果系统、Boss 机制、资源系统、被动技能、德鲁伊形态、术士召唤和战利品分配等核心战斗逻辑。

### 核心职责

| 职责 | 描述 |
|------|------|
| 回合制战斗 | 基于速度制先攻排序管理单位行动顺序 |
| 多敌人战斗 | 支持同时与多个敌人战斗，3×2 网格布局 |
| 玩家动作限制 | 玩家回合只允许执行一个动作 |
| 伤害管线 | 4 阶段效果管线计算伤害（基础→攻击修正→防御修正→护盾吸收→荆棘反伤） |
| 战斗行动 | 支持攻击、使用技能、使用物品、逃跑、跳过回合 |
| 战斗AI | 4 种策略模式（激进/防御/均衡/Boss 阶段）控制敌人行为 |
| 效果系统 | 15 种效果类型，可扩展的处理器架构（管线+容器+Handler） |
| Boss 系统 | 多阶段 Boss 战斗、阶段转换、专属机制（眩晕/沉默/召唤/范围攻击等） |
| 资源系统 | 5 种职业专属资源（怒气/能量/连击点/灵魂碎片/真气）+ 默认 MP |
| 被动技能 | 按触发时机执行职业被动效果（Phase 5.2） |
| 德鲁伊形态 | 4 种形态切换，含属性修正与技能集互斥（Phase 6.3） |
| 术士召唤 | 5 种恶魔召唤，含 AI 行为与灵魂碎片消耗（Phase 6.4） |
| 战利品分配 | 战斗胜利后分配经验、金币和 Boss 掉落物品 |
| 战斗日志 | 记录完整战斗过程，持久化到 IndexedDB |

### 模块边界

**战斗模块**通过 `ICombatContext` 接口（`combatContext.ts`）聚合对六个外部 Store 的依赖，combat 内部所有 composable 仅依赖此接口，不再直接 import 具体 Store，实现模块间静态解耦与可独立测试。

`ICombatContext` 进一步拆分为 `ICombatQuery`（只读）与 `ICombatCommand`（写入），composable 可按需声明读/写意图。

**直接调用的外部 Store Action**（通过 ICombatCommand）：

- **角色模块**：`takeDamage`、`gainExp`、`gainGold`、`handleDeath`、`receiveHeal`、`changeMp`
- **敌人模块**：`createEnemy`、`getEnemyById`、`calculateDamage`、`takeDamage`、`deleteEnemy`、`getAvailableSkills`、`useSkill`、`tickCooldowns`
- **技能模块**：`castSkill`、`getSkill`、`tickCooldowns`、`resetCooldowns`
- **背包模块**：`useItem`、`addItem`、`getItemInfo`
- **任务模块**：`onEnemyKilled`
- **日志模块**：`addLogEntry`（冒险日志）

EventBus 仅保留 UI/音效事件（见下方事件列表）。

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-COMBAT-001 | 速度制先攻回合系统 | 核心功能 |
| FR-COMBAT-002 | 玩家回合单动作限制 | 回合机制 |
| FR-COMBAT-003 | 玩家攻击动作 | 战斗行动 |
| FR-COMBAT-004 | 使用消耗品动作 | 战斗行动 |
| FR-COMBAT-005 | 逃跑动作（Boss 战不可逃跑） | 战斗行动 |
| FR-COMBAT-006 | 4 阶段伤害计算管线 | 伤害系统 |
| FR-COMBAT-007 | 伤害减免（物理/魔法防御） | 伤害系统 |
| FR-COMBAT-008 | 暴击判定 | 战斗系统 |
| FR-COMBAT-009 | 闪避判定 | 战斗系统 |
| FR-COMBAT-010 | 战利品掉落（仅 Boss） | 战斗奖励 |
| FR-COMBAT-011 | 经验获取 | 成长系统 |
| FR-COMBAT-012 | 完整战斗日志持久化 | 用户体验 |
| FR-COMBAT-013 | 多敌人战斗（3×2 网格） | 战斗系统 |
| FR-COMBAT-014 | 15 种效果类型处理 | 效果系统 |
| FR-COMBAT-015 | AI 策略模式 | 敌人行为 |
| FR-COMBAT-016 | Boss 多阶段机制 | Boss 系统 |
| FR-COMBAT-017 | 技能冷却系统 | 技能系统 |
| FR-COMBAT-018 | 战斗速度 1x/2x 切换 | 用户体验 |
| FR-COMBAT-019 | 控制效果（眩晕/冰冻/沉默） | 效果系统 |
| FR-COMBAT-020 | 职业专属资源系统 | 资源系统 |
| FR-COMBAT-021 | 职业被动技能触发 | 被动技能 |
| FR-COMBAT-022 | 德鲁伊形态切换 | 形态系统 |
| FR-COMBAT-023 | 术士恶魔召唤 | 召唤系统 |
| FR-COMBAT-024 | AOE 技能多目标伤害（每目标 70% 基础伤害） | 伤害系统 |
| FR-COMBAT-025 | Boss 防御/反击/复活机制 | Boss 系统 |

---

## 模块文件结构

```
src/modules/combat/
  ├── index.ts              # 模块统一导出入口
  ├── types.ts              # TypeScript 类型定义（CombatState、CombatLog 等）
  ├── db.ts                 # IndexedDB CRUD（战斗日志持久化）
  ├── store.ts              # Pinia Store 状态管理（组合入口，~455 行）
  ├── service.ts            # 纯函数计算（暴击/闪避/逃跑/ID 生成）
  ├── combatContext.ts      # 战斗上下文接口与工厂（ICombatQuery/ICombatCommand/ICombatContext）
  ├── ai/                   # 战斗 AI 子系统
  │   ├── index.ts          # AI 子模块导出
  │   ├── strategies.ts     # AI 策略实现（Aggressive/Defensive/Balanced/BossPhase）
  │   ├── targetSelection.ts # 目标选择器（ThreatBased/Random/LowestHp）
  │   └── types.ts          # AI 类型定义（BattleContext、IAiStrategy、AiDecision）
  ├── composables/          # Store 逻辑拆分 Composable
  │   ├── useCombatState.ts  # 响应式状态、计算属性、重置/清理
  │   ├── useCombatLog.ts    # 战斗日志记录、效果上下文工厂
  │   ├── useInitiative.ts   # 先攻排序、回合推进、敌人回合调度
  │   ├── useBossMechanics.ts # Boss 阶段机制应用
  │   ├── usePlayerAction.ts # 玩家攻击/技能/物品/逃跑/掉落
  │   ├── useEnemyAction.ts  # 敌人 AI 策略执行、伤害施加
  │   └── usePassiveSkills.ts # 职业被动技能触发与战斗计算接入
  ├── effects/              # 战斗效果子系统（管线+容器+Handler）
  │   ├── index.ts          # 效果子模块统一导出
  │   ├── types.ts          # 效果类型定义（EffectType 15 种、Effect、EffectContext 等）
  │   ├── container.ts      # EffectContainer 容器操作（增删查改）
  │   ├── handler.ts        # EffectHandler 接口与 EffectHandlerRegistry 注册表
  │   ├── pipeline.ts       # 伤害计算管线（processDamagePipeline）
  │   └── handlers/         # 15 个具体效果处理器
  │       ├── index.ts      # 处理器聚合导出与 createDefaultRegistry
  │       ├── attackMod.ts  # 攻击力修正（attackUp/attackDown）
  │       ├── defenseMod.ts # 防御力修正（defenseUp/defenseDown/vulnerable）
  │       ├── speedMod.ts   # 速度修正（speedUp/speedDown）
  │       ├── dot.ts        # 持续伤害（poison/burn）
  │       ├── control.ts    # 控制效果（stun/freeze/silence）
  │       ├── shield.ts     # 护盾效果
  │       ├── regen.ts      # 持续恢复
  │       └── thorn.ts      # 荆棘反伤
  ├── forms/                # 德鲁伊形态子系统（Phase 6.3）
  │   ├── index.ts          # 形态子模块导出
  │   ├── types.ts          # 形态类型定义（DruidFormType、DruidForm、FormState）
  │   ├── druidForms.ts     # 4 种形态数据定义
  │   ├── service.ts        # 形态切换纯函数（校验/属性计算/技能过滤）
  │   └── store.ts          # useFormStore（形态状态管理）
  ├── pets/                 # 术士召唤子系统（Phase 6.4）
  │   ├── index.ts          # 召唤子模块导出
  │   ├── types.ts          # 召唤类型定义（WarlockPetType、WarlockPet、PetInstance）
  │   ├── warlockPets.ts    # 5 种召唤物数据定义
  │   ├── service.ts        # 召唤纯函数（属性计算/召唤校验/AI 行动）
  │   └── store.ts          # usePetStore（召唤状态管理）
  └── resources/            # 战斗资源子系统
      ├── index.ts          # 资源子模块导出
      ├── types.ts          # 资源类型定义（ResourceType、ResourceSystem 接口）
      ├── BaseResourceSystem.ts # 资源系统抽象基类
      ├── RageSystem.ts     # 战士怒气系统
      ├── EnergySystem.ts   # 潜行者能量系统
      ├── ComboPointSystem.ts # 潜行者连击点系统
      ├── SoulShardSystem.ts # 术士灵魂碎片系统
      ├── ChiSystem.ts      # 武僧真气系统
      └── ResourceSystemFactory.ts # 资源系统工厂（按职业创建）
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | 模块统一导出入口（类型、DbService、纯函数、Store、Context） |
| `types.ts` | 所有接口、类型定义（CombatState、CombatAction、CombatLog、CombatLogStorage 等） |
| `db.ts` | 战斗日志持久化 CRUD（CombatDbService） |
| `store.ts` | Pinia Store，战斗状态唯一持有者，组合所有 composable |
| `service.ts` | 纯函数集合（rollCritical、rollDodge、calculateFleeChance、rollFleeSuccess、generateCombatId、generateBattleLogId、isBossCombat） |
| `combatContext.ts` | 战斗上下文接口与工厂（ICombatQuery/ICombatCommand/ICombatContext + createCombatContext） |
| `composables/*.ts` | Store 逻辑按职责拆分的 7 个 Composable |
| `ai/types.ts` | AI 类型定义（BattleContext、IAiStrategy、AiDecision） |
| `ai/strategies.ts` | 4 种 AI 策略实现 |
| `ai/targetSelection.ts` | 3 种目标选择器（为多角色队伍预留） |
| `effects/pipeline.ts` | 4 阶段伤害计算管线 |
| `effects/container.ts` | 效果容器操作（addEffectToContainer、createEmptyContainer 等） |
| `effects/handler.ts` | EffectHandler 接口与 EffectHandlerRegistry 注册表 |
| `effects/handlers/*.ts` | 15 种效果的具体处理逻辑 |
| `forms/*.ts` | 德鲁伊形态系统（类型、数据、服务、Store） |
| `pets/*.ts` | 术士召唤系统（类型、数据、服务、Store） |
| `resources/*.ts` | 职业资源系统（接口、基类、5 种实现、工厂） |

---

## 接口定义

### 战斗模块入口导出（index.ts）

```typescript
// 类型导出
export type {
  CombatState,
  CombatResult,
  CombatActionType,
  CombatEventType,
  CombatAction,
  AoeHitInfo,
  CombatActionResult,
  CombatLog,
  CombatLogStorage
} from './types';

// 数据层
export { CombatDbService, combatDbService } from './db';

// 服务层纯函数
export {
  rollCritical,
  rollDodge,
  calculateFleeChance,
  rollFleeSuccess,
  generateCombatId,
  generateBattleLogId,
  isBossCombat
} from './service';

// Store
export { useCombatStore } from './store';

// 战斗上下文
export type { ICombatContext, ICombatQuery, ICombatCommand } from './combatContext';
export { createCombatContext } from './combatContext';
```

### 数据类型定义（types.ts）

```typescript
/** 战斗状态 */
export type CombatState = 'idle' | 'fighting' | 'ended';

/** 战斗结果 */
export type CombatResult = 'victory' | 'defeat' | 'fled';

/** 战斗行动类型 */
export type CombatActionType = 'attack' | 'item' | 'flee' | 'skill';

/** 战斗事件类型（战斗日志用） */
export type CombatEventType =
  | 'combat_start'
  | 'combat_end'
  | 'combat_turn_start'
  | 'combat_turn_end'
  | 'combat_damage'
  | 'combat_heal'
  | 'combat_skill_cast'
  | 'combat_item'
  | 'combat_flee'
  | 'combat_miss'
  | 'combat_critical'
  | 'combat_event'
  | 'passive_trigger'
  | 'passive_effect';

/** 战斗行动 */
export interface CombatAction {
  type: CombatActionType;
  itemId?: string;
  skillId?: string;
  target?: 'player' | 'enemy';
}

/** 多目标技能命中信息 */
export interface AoeHitInfo {
  enemyId: string;
  enemyName: string;
  damage: number;
  isCrit?: boolean;
  isDodge?: boolean;
}

/** 战斗行动结果 */
export interface CombatActionResult {
  success: boolean;
  type: CombatActionType;
  damage?: number;
  heal?: number;
  isCrit?: boolean;
  isDodge?: boolean;
  /** 是否因眩晕/冰冻/沉默等控制效果导致回合被跳过 */
  isControlled?: boolean;
  message: string;
  /** 多目标技能命中列表（仅技能 targetType='all_enemies' 时返回） */
  aoeHits?: AoeHitInfo[];
}

/** 战斗日志 */
export interface CombatLog {
  combatId: string;
  battleLogId: string;
  timestamp: number;
  turn: number;
  actorType: 'player' | 'enemy' | 'system';
  actorId: string;
  actorName: string;
  eventType: CombatEventType;
  targetType?: 'player' | 'enemy';
  targetId?: string;
  targetName?: string;
  skillId?: string;
  skillName?: string;
  damage?: number;
  heal?: number;
  isCrit?: boolean;
  isDodge?: boolean;
  message: string;
}

/** 战斗日志存储格式（IndexedDB 兼容版本，字面量联合类型放宽为 string） */
export type CombatLogStorage = Omit<CombatLog, 'actorType' | 'eventType' | 'targetType'> & {
  actorType: string;
  eventType: string;
  targetType?: string;
};
```

### 战斗上下文接口（combatContext.ts）

```typescript
/** 战斗只读查询接口（A2 拆分） */
export interface ICombatQuery {
  character: {
    readonly name: string;
    readonly classId: string;
    readonly hp: number;
    readonly maxHp: number;
    readonly attributes: Attributes;
    readonly effectiveStats: Stats;
  };
  skill: {
    getSkill(skillId: string): Skill | null;
  };
  enemy: {
    getEnemyById(id: string): EnemyInstance | null;
    getAvailableSkills(id: string): { id: string; name: string; isHeal?: boolean; isBuff?: boolean }[];
    calculateDamage(enemy: EnemyInstance, defense: number): number;
  };
  inventory: {
    getItemInfo(itemId: string): Item | null;
  };
}

/** 战斗写入命令接口（A2 拆分） */
export interface ICombatCommand {
  character: {
    takeDamage(amount: number): Promise<void>;
    gainExp(amount: number): Promise<void>;
    gainGold(amount: number): Promise<void>;
    handleDeath(): Promise<void>;
    receiveHeal(amount: number): Promise<void>;
    changeMp(amount: number): Promise<void>;
  };
  skill: {
    castSkill(skillId: string, skipAdventureLog?: boolean): Promise<SkillUseResult>;
    tickCooldowns(): void;
    resetCooldowns(): void;
  };
  enemy: {
    deleteEnemy(id: string): void;
    takeDamage(id: string, damage: number): boolean;
    createEnemy(dataId: string, level: number): Promise<EnemyInstance | null>;
    useSkill(id: string, skillId: string): {
      success: boolean;
      damage: number;
      isHeal: boolean;
      isBuff?: boolean;
      buffs?: Array<{ type: string; value: number; turns: number }>;
    };
    tickCooldowns(enemyId?: string): void;
  };
  quest: {
    onEnemyKilled(enemyId: string): Promise<void>;
  };
  log: {
    addLogEntry(entry: LogEntry): Promise<void>;
  };
  inventory: {
    useItem(itemId: string): Promise<boolean>;
    addItem(itemId: string, quantity: number): number;
  };
}

/** 战斗上下文接口（完整 = 只读 + 写入） */
export type ICombatContext = ICombatQuery & ICombatCommand;

/** 创建战斗上下文（combat 模块内唯一引用外部 Store 的位置） */
export function createCombatContext(): ICombatContext;
```

### Boss 机制上下文接口（composables/useBossMechanics.ts）

```typescript
/** Boss 机制上下文接口（S3 解耦：消除 Boss 机制对 combat Store 的直接依赖） */
export interface IBossContext {
  getPlayerName(): string;
  createMinion(dataId: string, level: number): Promise<EnemyInstance | null>;
  rebuildInitiativeOrder(): void;
}
```

### 服务层纯函数（service.ts）

```typescript
/** 暴击判定 */
export function rollCritical(critChance: number): boolean;
/** 闪避判定 */
export function rollDodge(dodgeChance: number): boolean;
/** 计算逃跑成功率（0.5 + dex × 0.01） */
export function calculateFleeChance(dex: number): number;
/** 逃跑成功判定 */
export function rollFleeSuccess(fleeChance: number): boolean;
/** 生成战斗 ID */
export function generateCombatId(): string;
/** 生成战斗日志 ID */
export function generateBattleLogId(): string;
/** 判断是否为 Boss 战 */
export function isBossCombat(enemy: EnemyInstance): boolean;
```

---

## 通过 EventBus 发布的事件

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `COMBAT_START` | 战斗开始时 | `{ enemy: EnemyInstance }` |
| `COMBAT_END` | 战斗结束时 | `{ result: string; enemy: EnemyInstance | null; expGained: number; goldGained?: number }` |
| `COMBAT_PLAYER_TURN` | 玩家回合开始时 | `null` |
| `COMBAT_ENEMY_TURN` | 敌人回合开始时 | `null` |
| `COMBAT_DEAL_DAMAGE` | 造成伤害时 | `{ amount: number; damageType: 'physical' \| 'magic'; targetName: string; actorType?: 'player' \| 'enemy' }` |
| `COMBAT_CAST_HEAL` | 治疗时 | `{ amount: number; healType: 'health' \| 'mana' \| 'buff' \| 'debuff'; targetName: string }` |
| `COMBAT_CRITICAL_HIT` | 暴击时 | `{ amount: number; damageType: 'physical' \| 'magic'; targetName: string; actorType: 'player' \| 'enemy' }` |
| `COMBAT_DODGE` | 闪避时 | `{ attackerName: string; dodgerName: string; dodgerType: 'player' \| 'enemy' }` |
| `COMBAT_SKIP_TURN` | 跳过回合时 | `null` |
| `COMBAT_BOSS_INTRO` | Boss 出场演出时（延迟 300ms） | `{ enemyId: string; enemyName: string; icon: string; effect: string; lines: string[]; duration: number }` |
| `COMBAT_BOSS_PHASE` | Boss 阶段转换时 | `{ enemyId: string; enemyName: string; phaseName: string; effect: string }` |

---

## 战斗日志数据结构

### CombatLog 字段说明

| 字段名 | 数据类型 | 必填 | 说明 |
|--------|----------|------|------|
| combatId | string | 是 | 战斗唯一标识 |
| battleLogId | string | 是 | 日志条目唯一标识 |
| timestamp | number | 是 | 毫秒级时间戳 |
| turn | number | 是 | 当前战斗回合数 |
| actorType | 'player' \| 'enemy' \| 'system' | 是 | 行动者类型 |
| actorId | string | 是 | 行动者唯一 ID |
| actorName | string | 是 | 行动者显示名称 |
| eventType | CombatEventType | 是 | 战斗事件类型 |
| targetType | 'player' \| 'enemy' | 否 | 目标类型 |
| targetId | string | 否 | 目标 ID |
| targetName | string | 否 | 目标显示名称 |
| skillId | string | 否 | 技能 ID |
| skillName | string | 否 | 技能名称 |
| damage | number | 否 | 伤害数值 |
| heal | number | 否 | 治疗数值 |
| isCrit | boolean | 否 | 是否暴击 |
| isDodge | boolean | 否 | 是否闪避 |
| message | string | 是 | 日志描述消息 |

---

## 业务逻辑流程

### 战斗开始流程

1. 调用 `startCombat(enemiesData: EnemyInstance[])` 开始战斗
2. 防御性重置（`state.reset()`），防止上一场战斗定时器残留
3. 生成战斗 ID（`generateCombatId()`），状态设为 `fighting`
4. 重置技能冷却（`ctx.skill.resetCooldowns()`）
5. 初始化玩家资源系统（`ResourceSystemFactory.create(classId)`），并调用 `reset()` 重置到初始值
6. 加载当前职业被动技能（`passive.loadPassives()`），触发 `onCombatStart` 钩子
7. 初始化 Boss 功能（阶段管理器 + 出场演出数据）
8. 分配敌人位置到 3×2 网格（Boss 后排中间优先，普通敌人前排优先）
9. 构建先攻顺序（玩家 + 所有敌人按速度降序，速度含 getSpeedMod 效果修正）
10. 记录战斗开始到战斗日志和冒险日志
11. 触发 `COMBAT_START` 事件
12. 如有 Boss，延迟 300ms 触发 `COMBAT_BOSS_INTRO` 事件（保存定时器 ID 供清理）
13. 触发 `COMBAT_PLAYER_TURN` 事件

### 玩家回合流程

1. 检查战斗状态和当前回合（必须 `fighting` + `player`）
2. 检查控制效果：
   - `skipTurn`（眩晕/冰冻）→ 跳过回合，返回 `isControlled: true`
   - `types.includes('skill')`（沉默）→ 禁止技能，返回 `isControlled: true`
3. 等待玩家选择动作（攻击/技能/物品/逃跑/跳过）
4. 执行玩家动作（通过 `playerAction(action)` 分发）
5. 攻击/技能命中后触发资源系统 `onAttack` 钩子和被动 `onAttack` 钩子
6. 记录行动到战斗日志
7. 通过 `endPlayerTurn()` 推进到下一个行动者（速度制先攻）

### 敌人回合（速度制先攻调度）

1. `advanceToNextUnit()` 推进到下一个行动者
2. 新一轮开始时（索引回绕到 0）执行 `tickAllEffects()`（玩家 + 所有敌人效果 tick）
3. 检查玩家/敌人是否因持续伤害死亡
4. 敌人回合：延迟 `500 / combatSpeed` ms 后执行 `singleEnemyTurn(enemyId)`
5. 处理 Boss 阶段转换和机制触发
6. 推进该敌人技能冷却
7. 通过 AI 策略决定行动（`enemyAction`）
8. 检查玩家是否死亡
9. 推进到下一个行动者（可能仍是敌人，链式调用）

### 4 阶段伤害计算管线

```
阶段 0: 基础伤害（按 damageType 选择物攻/魔攻 vs 物防/魔防）
       calcBaseDamage = floor(attack × 0.4) + random(0-9)
       defenseReduction = min(baseDamage × 0.3, defense)
       baseDamage = max(1, baseDamage - defenseReduction)
       ↓
阶段 1: 攻击方效果修正 → 预期伤害
       expectedDamage = floor(baseDamage × attackerMod)
       （attackerMod 通过 reduceMultiplier 累乘 getAttackerDamageMod）
       ↓
阶段 2: 防御方效果修正 → 实际伤害
       actualDamage = floor(expectedDamage × defenderMod)
       （defenderMod 通过 reduceMultiplier 累乘 getDefenderDamageMod）
       ↓
阶段 3: 护盾吸收 → 最终伤害
       absorbed = reduceSum(getDamageAbsorb)
       finalDamage = max(0, actualDamage - absorbed)
       ↓
阶段 4: 荆棘反伤
       thorns = reduceSum(getThornDamage)
```

### Boss 防御/反击/复活机制（usePlayerAction.ts）

玩家对敌人造成伤害时，依次应用以下 Boss 运行时机制（通过类型断言访问 EnemyInstance 上的运行时字段）：

1. **applyBossDefenseMechanics**（伤害前）：
   - `invulnerable`：无敌状态，伤害为 0，完全挡住
   - `shield`：护盾吸收伤害，先扣护盾剩余再扣 HP；护盾被击破时记录日志
2. **applyBossCounterMechanics**（伤害后）：
   - `reflectDamage`：按比例反弹伤害（`floor(actualDamage × reflectDamage)`）
   - `counterStance`：反击姿态，造成 50% 伤害反击（一次性，触发后清除标记）
3. **checkBossRevive**（敌人死亡时）：
   - `canRevive`：复活标记，恢复 50% HP 并清除标记

### 荆棘反伤处理

荆棘反伤（`thorn` 效果）由伤害管线统一计算，在玩家攻击/技能/物品和敌人攻击中均适用：
- 玩家攻击敌人时：管线计算 `thorns` 值，对玩家自身造成反弹伤害（`ctx.character.takeDamage`），乘以暴击倍率
- 敌人攻击玩家时：管线计算 `thorns` 值，对敌人造成反弹伤害（`ctx.enemy.takeDamage`）

### 战利品掉落流程（handleLoot）

1. 遍历 Boss 的 `drops` 配置
2. 对每个掉落项执行随机判定（`Math.random() < drop.dropRate`）
3. 校验 `maxAmount >= minAmount`（防止配置错误产生负数掉落数量）
4. 计算掉落数量：`floor(random × (span + 1)) + minAmount`
5. 调用 `ctx.inventory.addItem(drop.itemId, amount)` 添加物品
6. 检查 `addItem` 返回值，背包满时通过 `useToast` 提示玩家（`actualAmount < amount`）
7. 使用物品名称（非 itemId）记录战斗日志和冒险日志

### 战斗结束流程

1. 防止重入：`ended` 或 `idle` 状态直接返回
2. 清空效果容器（playerEffects / enemyEffects）
3. 根据结果分支：
   - **victory**：计算总经验/金币 → 设置 `combatResult/expGained/goldGained` → 记录冒险日志和战斗日志 → 调用 `gainExp`/`gainGold` → 触发资源系统 `onKill` 钩子 → 触发被动 `onKill` 钩子 → 处理 Boss 掉落（`handleLoot`）→ 更新任务击杀进度（`onEnemyKilled`）
   - **defeat**：记录战斗日志和冒险日志 → 调用 `handleDeath`
   - **fled**：记录战斗日志和冒险日志
4. 持久化战斗日志（`saveLogs`）
5. 触发 `COMBAT_END` 事件
6. 调用 `state.cleanup()` 清理战斗状态（含删除已死亡敌人数据、清理定时器）

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库表 | Key | 数据结构 | 说明 |
|----------|-----|----------|------|
| `runtime_combatLogs` | `battleLogId` | CombatLogStorage | 战斗日志（按 combatId 索引可查询整场战斗） |

### 数据层接口（db.ts）

```typescript
export class CombatDbService {
  async saveCombatLog(log: CombatLog): Promise<void>;
  async getCombatLogs(combatId: string): Promise<CombatLog[]>;
  async getAllCombatLogs(): Promise<CombatLog[]>;
  async deleteCombatLog(battleLogId: string): Promise<void>;
  async deleteCombatLogs(combatId: string): Promise<void>;
  async clearAllCombatLogs(): Promise<void>;
}

export const combatDbService: CombatDbService;
```

---

## 战斗 AI 子系统

### 概述

战斗 AI 子系统（`modules/combat/ai/`）基于策略模式实现，负责控制敌人的战斗行为决策。另含目标选择器模块，为未来多角色队伍系统预留扩展点。

### 类型定义（ai/types.ts）

```typescript
/** 战斗上下文（AI 做决策需要感知的信息） */
export interface BattleContext {
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  availableSkills: { id: string; name: string; isHeal?: boolean; isBuff?: boolean }[];
  turnCount: number;
}

/** AI 策略接口 */
export interface IAiStrategy {
  readonly name: string;
  decideAction(enemy: EnemyInstance, context: BattleContext): AiDecision;
}

/** AI 决策结果 */
export type AiDecision =
  | { type: 'basic_attack' }
  | { type: 'skill'; skillId: string }
  | { type: 'heal'; skillId: string };
```

### 策略类型（ai/strategies.ts）

| 策略名 | 类名 | 行为描述 |
|--------|------|----------|
| `aggressive` | AggressiveStrategy | 激进型：50% 概率使用攻击技能，HP 低时不治疗 |
| `defensive` | DefensiveStrategy | 防御型：HP 低于 40% 时优先治疗，20% 概率使用攻击技能 |
| `balanced` | BalancedStrategy | 均衡型：HP 低于 50% 时 60% 概率治疗，30% 概率使用攻击技能 |
| `boss_phase` | BossPhaseStrategy | Boss 阶段型：HP 低于 20% 狂暴（必定用技能），HP 低于 50% 高概率用技能（60%），20% 概率治疗 |

### 目标选择器（ai/targetSelection.ts）

| 选择器名 | 类名 | 行为描述 |
|----------|------|----------|
| `threat_based` | ThreatBasedTargetSelector | 仇恨优先，仇恨相同时选 HP 最低 |
| `random` | RandomTargetSelector | 随机选择 |
| `lowest_hp` | LowestHpTargetSelector | 选 HP 最低（斩杀优先） |

```typescript
/** 战斗参与者（目标的抽象表示） */
export interface Combatant {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  threat?: number;
  isPlayer?: boolean;
}

/** 目标选择器接口 */
export interface ITargetSelector {
  readonly name: string;
  select(candidates: Combatant[]): Combatant | null;
}

export function getTargetSelector(name: string): ITargetSelector;
```

### AI 子模块导出（ai/index.ts）

```typescript
export type { BattleContext, IAiStrategy, AiDecision } from './types';
export { AggressiveStrategy, DefensiveStrategy, BalancedStrategy, BossPhaseStrategy } from './strategies';
```

> 注意：`targetSelection.ts` 中的 `Combatant`、`ITargetSelector`、`getTargetSelector` 未通过 `ai/index.ts` 导出，为预留扩展模块，仅在 `targetSelection.ts` 内部使用。

---

## 战斗效果子系统

### 概述

战斗效果子系统（`modules/combat/effects/`）采用 **管线 + 容器 + Handler 处理器** 架构，支持 15 种效果类型的可扩展处理。

### 核心架构

```
效果触发 → addEffectToContainer（容器，按叠加策略合并）
                ↓
         Pipeline（4 阶段伤害管线）
                ↓
         EffectHandlerRegistry（注册表分发）
                ↓
         Handler（具体处理器：onApply/onTick/getAttackerDamageMod 等）
```

### 效果类型（15 种）

| 类型 | 分类 | 说明 |
|------|------|------|
| `poison` | DoT | 每回合扣血 |
| `burn` | DoT | 每回合扣血（比毒强） |
| `stun` | 控制 | 跳过回合 |
| `freeze` | 控制 | 跳过回合 + 减速 |
| `silence` | 控制 | 无法使用技能 |
| `shield` | 护盾 | 吸收伤害 |
| `attack_up` | 攻击修正 | 攻击力上升 |
| `attack_down` | 攻击修正 | 攻击力下降 |
| `defense_up` | 防御修正 | 防御力上升 |
| `defense_down` | 防御修正 | 防御力下降 |
| `speed_up` | 速度修正 | 速度上升 |
| `speed_down` | 速度修正 | 速度下降 |
| `regen` | 恢复 | 每回合回血 |
| `thorn` | 荆棘 | 反弹伤害 |
| `vulnerable` | 易伤 | 受到的伤害增加 |

### 核心类型（effects/types.ts）

```typescript
/** 叠加策略 */
export type StackStrategy = 'replace' | 'max' | 'additive' | 'independent';

/** 效果实例 */
export interface Effect {
  id: string;
  type: EffectType;
  remainingTurns: number;
  value: number;
  source: 'skill' | 'item' | 'enemy' | 'passive';
  sourceName: string;
  stackStrategy?: StackStrategy;
}

/** 效果容器 */
export interface EffectContainer {
  effects: Effect[];
}

/** 效果上下文 */
export interface EffectContext {
  ownerId: string;
  ownerType: 'player' | 'enemy';
  baseStats: {
    physicalAttack: number;
    physicalDefense: number;
    magicAttack: number;
    magicDefense: number;
    speed: number;
  };
  currentHp: number;
  maxHp: number;
}

/** 效果每回合推进的返回值 */
export interface TickResult {
  dotDamage: number;
  regenAmount: number;
}

/** 伤害计算管线的输出 */
export interface DamagePipelineResult {
  expectedDamage: number;
  actualDamage: number;
  absorbed: number;
  finalDamage: number;
  thorns: number;
}

/** 伤害类型 */
export type DamageType = 'physical' | 'magical';
```

### EffectHandler 接口（effects/handler.ts）

```typescript
/** 被禁用的行动类型 */
export type ActionType = 'attack' | 'skill' | 'flee';

/** 效果处理器接口 */
export interface EffectHandler {
  type: EffectType;
  // 生命周期钩子
  onApply?(effect: Effect, ctx: EffectContext): void;
  onTick?(effect: Effect, ctx: EffectContext): TickResult;
  onRemove?(effect: Effect, ctx: EffectContext): void;
  // 伤害计算管线
  getAttackerDamageMod?(effect: Effect, ctx: EffectContext): number;
  getDefenderDamageMod?(effect: Effect, ctx: EffectContext): number;
  getDamageAbsorb?(effect: Effect, incomingDamage: number): number;
  getThornDamage?(effect: Effect, incomingDamage: number): number;
  // 控制效果
  getDisabledActions?(effect: Effect): ActionType[];
  // 回合速度
  getSpeedMod?(effect: Effect): number;
}

/** 效果处理器注册表 */
export class EffectHandlerRegistry {
  register(handler: EffectHandler): void;
  registerAll(handlers: EffectHandler[]): void;
  get(type: EffectType): EffectHandler | undefined;
  reduceMultiplier(container: EffectContainer, method: 'getAttackerDamageMod' | 'getDefenderDamageMod', ctx: EffectContext): number;
  reduceSum(container: EffectContainer, method: 'getDamageAbsorb' | 'getThornDamage', ctx: EffectContext, extra: number): number;
  reduceSum(container: EffectContainer, method: 'getSpeedMod', ctx: EffectContext): number;
  tickAll(container: EffectContainer, ctx: EffectContext): { expiredIds: string[]; dotDamage: number; regenAmount: number };
  getDisabledActions(container: EffectContainer): { skipTurn: boolean; types: ActionType[] };
  get registeredCount: number;
}
```

### 容器操作（effects/container.ts）

```typescript
export function generateEffectId(): string;
export function addEffectToContainer(container: EffectContainer, effect: Effect): void;
export function removeEffectFromContainer(container: EffectContainer, type: EffectType): number;
export function hasEffect(container: EffectContainer, type: EffectType): boolean;
export function createEmptyContainer(): EffectContainer;
export function clearContainer(container: EffectContainer): void;
```

### 叠加策略说明（addEffectToContainer）

| 策略 | 行为 |
|------|------|
| `replace` | 直接替换旧效果（移除同类型后 push 新效果） |
| `max` | 取最大值并刷新持续时间（默认策略） |
| `additive` | 累加但独立衰减（不合并，直接 push 独立实例） |
| `independent` | 独立存在，不参与同类型合并 |

### 伤害管线（effects/pipeline.ts）

```typescript
export function processDamagePipeline(
  registry: EffectHandlerRegistry,
  attackerEffects: EffectContainer,
  defenderEffects: EffectContainer,
  attackerCtx: EffectContext,
  defenderCtx: EffectContext,
  damageType: DamageType,
  baseDamageOverride?: number
): DamagePipelineResult;

export function applyEffect(
  registry: EffectHandlerRegistry,
  container: EffectContainer,
  effect: Effect,
  ctx: EffectContext
): void;
```

### 处理器实现详情（effects/handlers/）

| 处理器文件 | 效果类型 | 实现公式/行为 |
|-----------|----------|--------------|
| `attackMod.ts` | `attack_up` | `getAttackerDamageMod = 1 + effect.value / 100` |
| `attackMod.ts` | `attack_down` | `getAttackerDamageMod = Math.max(0.1, 1 - effect.value / 100)`（保底 10%） |
| `defenseMod.ts` | `defense_up` | `getDefenderDamageMod = Math.max(0.05, 1 - effect.value / 100)`（保底 5%） |
| `defenseMod.ts` | `defense_down` | `getDefenderDamageMod = 1 + effect.value / 100` |
| `defenseMod.ts` | `vulnerable` | `getDefenderDamageMod = 1 + effect.value * 1.5 / 100`（含 1.5 倍易伤系数） |
| `speedMod.ts` | `speed_up` | `getSpeedMod = effect.value`（正值加速） |
| `speedMod.ts` | `speed_down` | `getSpeedMod = -effect.value`（负值减速） |
| `dot.ts` | `poison` | `onTick` 返回 `{ dotDamage: effect.value, regenAmount: 0 }` |
| `dot.ts` | `burn` | `onTick` 返回 `{ dotDamage: Math.round(effect.value * 1.5), regenAmount: 0 }`（比毒强 1.5 倍） |
| `control.ts` | `stun` | `getDisabledActions = ['attack', 'skill', 'flee']`（跳过回合） |
| `control.ts` | `freeze` | `getDisabledActions = ['attack', 'skill', 'flee']` + `getSpeedMod = -10` |
| `control.ts` | `silence` | `getDisabledActions = ['skill']`（仅禁止技能） |
| `shield.ts` | `shield` | `getDamageAbsorb = Math.min(incomingDamage, effect.value)`，吸收后扣减 `effect.value` |
| `regen.ts` | `regen` | `onTick` 返回 `{ dotDamage: 0, regenAmount: effect.value }` |
| `thorn.ts` | `thorn` | `getThornDamage = Math.round(incomingDamage * effect.value)` |

### 处理器注册（effects/handlers/index.ts）

```typescript
export function createDefaultRegistry(registry: EffectHandlerRegistry): void;
// 预注册全部 15 种内置效果处理器
```

---

## 战斗资源子系统

### 概述

战斗资源子系统（`modules/combat/resources/`）为不同职业提供专属的战斗能量管理。通过统一的 `ResourceSystem` 接口契约，战斗系统可以透明地处理各类资源（怒气、能量、连击点、灵魂碎片、真气），未实现专属资源系统的职业回退到默认 MP 系统。

### 类型定义（resources/types.ts）

```typescript
/** 资源类型枚举 */
export type ResourceType =
  | 'rage'          // 战士怒气
  | 'energy'        // 潜行者能量
  | 'combo_point'   // 潜行者连击点
  | 'soul_shard'    // 术士灵魂碎片
  | 'chi'           // 武僧真气
  | 'mana';         // 法师/牧师等施法职业的法力（默认回退）

/** 资源获取来源 */
export type ResourceSource = 'attack' | 'damaged' | 'turn' | 'skill' | 'kill';

/** 资源系统抽象接口 */
export interface ResourceSystem {
  readonly type: ResourceType;
  readonly currentValue: number;
  readonly maxValue: number;
  readonly isInteger: boolean;
  generate(amount: number, source: ResourceSource): void;
  consume(amount: number): boolean;
  hasEnough(amount: number): boolean;
  reset(): void;
  // 战斗事件钩子（可选）
  onTurnStart?(): void;
  onTurnEnd?(): void;
  onAttack?(): void;
  onDamaged?(amount: number): void;
  onKill?(): void;
  readonly valueRef: Ref<number>;
  readonly maxValueRef: Readonly<Ref<number>>;
}

/** 资源系统工厂映射表类型 */
export type ResourceSystemFactoryMap = Record<string, ResourceType | ResourceType[]>;
```

### 抽象基类（resources/BaseResourceSystem.ts）

`BaseResourceSystem` 封装通用的资源值管理逻辑：
- 维护响应式 `_value` 和 `_maxValue`（protected Ref）
- `consume`：检查 `hasEnough` 后扣减，整数化与下限 0 保护
- `hasEnough`：`_value.value >= amount`
- `reset`：重置为 `initialValue`
- `applyGeneration`（protected）：子类调用此方法实际增加值，内置整数化和上限裁剪

子类需实现：
- `generate(amount, source)`：按来源差异化生成资源（通过 `applyGeneration` 应用）
- 可选重写事件钩子（`onTurnStart` / `onAttack` / `onDamaged` 等）

### 具体资源系统

| 资源系统 | 职业 | 上限 | 初始值 | isInteger | 获取规则 |
|----------|------|------|--------|-----------|----------|
| `RageSystem` | 战士 | 100 | 0 | true | 攻击+5（cap 5）、受伤+伤害×10%（cap 10）、回合+1（cap 1）、技能+1（cap 20）、击杀+10（cap 10） |
| `EnergySystem` | 潜行者 | 100 | 50 | true | 每回合+10（无来源差异） |
| `ComboPointSystem` | 潜行者 | 5 | 0 | true | 攻击+1、击杀+2、技能+3（其他来源不生成） |
| `SoulShardSystem` | 术士 | 5 | 1 | true | 技能+1、击杀+1（其他来源不生成） |
| `ChiSystem` | 武僧 | 5 | 1 | true | 攻击+1、回合+1、技能+2（受伤/击杀不生成） |

### RageSystem 获取上限配置（RAGE_CAPS）

```typescript
const RAGE_CAPS: Record<ResourceSource, number> = {
  attack: 5,
  damaged: 10,
  turn: 1,
  skill: 20,
  kill: 10,
};
```

### 资源系统工厂（resources/ResourceSystemFactory.ts）

```typescript
export class ResourceSystemFactory {
  static create(classId: string): ResourceSystem[];
}
```

| 职业 ID | 返回资源系统 |
|---------|-------------|
| `warrior` | `[new RageSystem(0)]` |
| `rogue` | `[new EnergySystem(50), new ComboPointSystem(0)]` |
| `warlock` | `[new SoulShardSystem(1)]` |
| `monk` | `[new ChiSystem(1)]` |
| 其他（mage/priest/paladin/shaman/druid/hunter/evoker/death_knight/demon_hunter 等） | `[]`（使用默认 MP 系统） |

---

## 德鲁伊形态子系统

### 概述

德鲁伊形态子系统（`modules/combat/forms/`，Phase 6.3）管理德鲁伊的 4 种形态切换，不同形态提供不同的属性加成和技能集，形态切换消耗回合并恢复生命。

### 类型定义（forms/types.ts）

```typescript
/** 德鲁伊形态类型 */
export type DruidFormType = 'humanoid' | 'bear' | 'cat' | 'moonkin';

/** 形态属性加成接口 */
export interface FormStatModifiers {
  statModifiers: Partial<Stats>;
  hpMultiplier: number;
  damageMultiplier: number;
  defenseMultiplier: number;
  speedMultiplier: number;
}

/** 德鲁伊形态定义接口 */
export interface DruidForm {
  id: DruidFormType;
  name: string;
  icon: string;
  description: string;
  modifiers: FormStatModifiers;
  availableSkills: string[];
  healPercent: number;
}

/** 形态切换配置常量 */
export const FORM_SWITCH_CONFIG = {
  actionPointCost: 1,
  defaultHealPercent: 0.10,
  cooldownTurns: 0,
} as const;

/** 形态系统状态接口 */
export interface FormState {
  currentForm: DruidFormType;
  availableForms: DruidFormType[];
  cooldownRemaining: number;
}
```

### 形态定义（forms/druidForms.ts）

| 形态 | 定位 | HP 倍率 | 伤害倍率 | 防御倍率 | 速度倍率 | 治疗百分比 | 可用技能 |
|------|------|---------|----------|----------|----------|------------|----------|
| `humanoid` | 平衡施法 | 1.0 | 1.0 | 1.0 | 1.0 | 10% | healing_touch, moonfire, wrath, rejuvenation |
| `bear` | 坦克 | 1.3 | 0.9 | 1.3 | 0.8 | 10% | mangle, swipe, growl, frenzied_regeneration |
| `cat` | 近战输出 | 0.9 | 1.2 | 0.9 | 1.3 | 10% | shred, rake, ferocious_bite, prowl |
| `moonkin` | 远程法术 | 1.1 | 1.15 | 1.1 | 0.9 | 10% | starfall, starsurge, moonfire_boosted, sunfire |

### 形态属性修正详情（statModifiers）

| 形态 | str | dex | con | int | wis | cha |
|------|-----|-----|-----|-----|-----|-----|
| `humanoid` | - | - | - | - | - | - |
| `bear` | +5 | -3 | +8 | -5 | -3 | - |
| `cat` | +3 | +8 | -2 | -5 | -3 | - |
| `moonkin` | -3 | -2 | +3 | +8 | +5 | - |

### 数据层函数（forms/druidForms.ts）

```typescript
export const DRUID_FORMS: Record<DruidFormType, DruidForm>;
export const DEFAULT_FORM: DruidFormType;  // 'humanoid'
export function getFormByType(formType: DruidFormType): DruidForm;
export function getAllForms(): DruidForm[];
export function getSwitchableForms(currentForm: DruidFormType): DruidForm[];
```

### 服务层纯函数（forms/service.ts）

```typescript
export function canSwitchForm(targetForm: DruidFormType, state: FormState): { canSwitch: boolean; reason: string };
export function getFormStatModifiers(formType: DruidFormType): FormStatModifiers;
export function getFormHpMultiplier(formType: DruidFormType): number;
export function getFormDamageMultiplier(formType: DruidFormType): number;
export function getFormDefenseMultiplier(formType: DruidFormType): number;
export function calculateFormSwitchHeal(formType: DruidFormType, maxHp: number): number;
export function getAvailableSkills(formType: DruidFormType): string[];
export function isSkillAvailableInForm(skillId: string, formType: DruidFormType): boolean;
export function filterSkillsByForm(skillIds: string[], formType: DruidFormType): string[];
export function createInitialFormState(): FormState;
export function switchForm(state: FormState, targetForm: DruidFormType): FormState;
export function tickCooldown(state: FormState): FormState;
export function getCurrentForm(state: FormState): DruidForm;
export function calculateFormStatDifference(
  oldForm: DruidFormType,
  newForm: DruidFormType
): {
  statModifiers: Partial<Stats>;
  hpMultiplierDelta: number;
  damageMultiplierDelta: number;
  defenseMultiplierDelta: number;
  speedMultiplierDelta: number;
};
```

### 形态 Store（forms/store.ts）

`useFormStore`（`defineStore('druidForm')`）管理形态状态，通过 `createCombatContext()` 聚合 character/log Store 引用。

| 分类 | 成员 | 类型 | 说明 |
|------|------|------|------|
| 状态 | `formState` | ref\<FormState\> | 形态系统完整状态 |
| 状态 | `currentForm` | computed\<DruidFormType\> | 当前形态 ID |
| 计算 | `currentFormDef` | computed\<DruidForm\> | 当前形态定义 |
| 计算 | `statModifiers` | computed\<FormStatModifiers\> | 当前形态属性修正 |
| 计算 | `switchableForms` | computed\<DruidForm[]\> | 可切换形态列表（不含当前） |
| 计算 | `hpMultiplier` | computed\<number\> | 生命倍率 |
| 计算 | `damageMultiplier` | computed\<number\> | 伤害倍率 |
| 计算 | `defenseMultiplier` | computed\<number\> | 防御倍率 |
| 计算 | `speedMultiplier` | computed\<number\> | 速度倍率 |
| 生命周期 | `initialize(savedState?)` | function | 初始化（进入战斗） |
| 生命周期 | `reset()` | function | 重置（退出战斗） |
| 操作 | `switchTo(targetForm)` | function | 切换形态（含治疗+日志） |
| 操作 | `tickCooldownEnd()` | function | 回合结束减少冷却 |
| 查询 | `canSwitch(targetForm)` | function | 检查可切换性 |
| 查询 | `isSkillAvailable(skillId)` | function | 技能在当前形态是否可用 |
| 查询 | `getSkills()` | function | 获取当前形态可用技能列表 |
| 查询 | `calculateHealAmount(targetForm)` | function | 计算切换治疗量 |

---

## 术士召唤子系统

### 概述

术士召唤子系统（`modules/combat/pets/`，Phase 6.4）管理术士的 5 种恶魔召唤，召唤消耗灵魂碎片，召唤物有独立 AI 和行动逻辑。

### 类型定义（pets/types.ts）

```typescript
/** 术士召唤物类型 */
export type WarlockPetType = 'imp' | 'voidwalker' | 'succubus' | 'felhunter' | 'doomguard';

/** 召唤物 AI 行为类型 */
export type PetAIBehavior = 'aggressive' | 'defensive' | 'caster' | 'controller' | 'support';

/** 召唤物基础属性接口 */
export interface PetBaseAttributes {
  baseStats: Stats;
  baseHp: number;
  baseDamage: number;
  baseDefense: number;
  baseSpeed: number;
}

/** 召唤物技能接口 */
export interface PetSkill {
  id: string;
  name: string;
  description: string;
  category: 'attack' | 'debuff' | 'buff' | 'control' | 'heal';
  damageMultiplier: number;
  cooldown: number;
  priority: number;
}

/** 术士召唤物定义接口 */
export interface WarlockPet {
  id: WarlockPetType;
  name: string;
  icon: string;
  description: string;
  aiBehavior: PetAIBehavior;
  attributes: PetBaseAttributes;
  skills: PetSkill[];
  soulShardCost: number;
  duration: number;
}

/** 召唤物运行时实例接口 */
export interface PetInstance {
  instanceId: string;
  petId: WarlockPetType;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  damage: number;
  defense: number;
  speed: number;
  stats: Stats;
  skills: PetSkill[];
  aiBehavior: PetAIBehavior;
  durationRemaining: number;
  skillCooldowns: Map<string, number>;
}

/** 召唤系统状态接口 */
export interface PetSystemState {
  activePet: PetInstance | null;
  unlockedPets: WarlockPetType[];
}

/** 召唤配置常量 */
export const PET_SUMMON_CONFIG = {
  hpGrowthPerLevel: 0.05,
  damageGrowthPerLevel: 0.03,
  defenseGrowthPerLevel: 0.03,
  statGrowthPerLevel: 1,
  actionPointCost: 1,
  instanceIdPrefix: 'pet_',
} as const;

/** AI 行为对应的目标选择优先级 */
export const PET_AI_TARGET_PRIORITY: Record<PetAIBehavior, string>;
```

### PET_AI_TARGET_PRIORITY 映射

| PetAIBehavior | 目标选择优先级 |
|---------------|---------------|
| `aggressive` | `lowest_hp` |
| `defensive` | `attacking_master` |
| `caster` | `highest_hp` |
| `controller` | `caster_enemy` |
| `support` | `caster_enemy` |

### 召唤物定义（pets/warlockPets.ts）

| 召唤物 | 定位 | AI 行为 | 灵魂碎片消耗 | 持续时间 |
|--------|------|---------|-------------|----------|
| `imp` | 远程法术输出 | caster | 1 | 永久（0） |
| `voidwalker` | 坦克 | defensive | 1 | 永久（0） |
| `succubus` | 近战控制 | controller | 2 | 永久（0） |
| `felhunter` | 反制型 | support | 2 | 永久（0） |
| `doomguard` | 终极输出 | aggressive | 3 | 10 回合 |

### 数据层函数（pets/warlockPets.ts）

```typescript
export const WARLOCK_PETS: Record<WarlockPetType, WarlockPet>;
export const DEFAULT_UNLOCKED_PETS: WarlockPetType[];  // ['imp', 'voidwalker']
export function getPetByType(petType: WarlockPetType): WarlockPet;
export function getAllPets(): WarlockPet[];
export function getSummonablePets(soulShards: number): WarlockPet[];
```

### 服务层纯函数（pets/service.ts）

```typescript
// 召唤物实例创建与属性计算
export function generatePetInstanceId(): string;
export function calculatePetAttributes(petType: WarlockPetType, level: number): {
  maxHp: number;
  damage: number;
  defense: number;
  speed: number;
  stats: Stats;
};
export function createPetInstance(petType: WarlockPetType, level: number): PetInstance;

// 召唤校验
export function canSummonPet(petType: WarlockPetType, state: PetSystemState, soulShards: number): { canSummon: boolean; reason: string };
export function canDismissPet(state: PetSystemState): { canDismiss: boolean; reason: string };

// 召唤与解散（纯函数，返回新状态）
export function summonPet(state: PetSystemState, petType: WarlockPetType, level: number): PetSystemState;
export function dismissPet(state: PetSystemState): PetSystemState;

// 召唤物战斗逻辑
export function calculatePetSkillDamage(pet: PetInstance, skill: PetSkill): number;
export function damagePet(pet: PetInstance, damage: number): PetInstance;
export function healPet(pet: PetInstance, heal: number): PetInstance;
export function isPetDead(pet: PetInstance): boolean;

// 技能冷却管理
export function isSkillReady(pet: PetInstance, skillId: string): boolean;
export function getReadySkills(pet: PetInstance): PetSkill[];
export function setSkillCooldown(pet: PetInstance, skillId: string): PetInstance;
export function tickSkillCooldowns(pet: PetInstance): PetInstance;

// 召唤物 AI 行动逻辑
export function selectPetAction(pet: PetInstance): PetSkill;

// 状态管理
export function createInitialPetState(): PetSystemState;
export function unlockPet(state: PetSystemState, petType: WarlockPetType): PetSystemState;
export function tickPetTurn(state: PetSystemState): PetSystemState;
export function getActivePetDefinition(state: PetSystemState): WarlockPet | null;
export function getActivePetSoulShardCost(state: PetSystemState): number;
```

### 召唤物属性计算公式

- 生命值：`floor(baseHp × (1 + 0.05 × (level - 1)))`
- 伤害值：`floor(baseDamage × (1 + 0.03 × (level - 1)))`
- 防御值：`floor(baseDefense × (1 + 0.03 × (level - 1)))`
- 速度值：不随等级变化（保持 `baseSpeed`）
- 六维属性：`baseStat + 1 × (level - 1)`

### 召唤 Store（pets/store.ts）

`usePetStore`（`defineStore('warlock-pets')`）管理召唤物状态，通过 `logCallback` 接收战斗日志回调。

| 分类 | 成员 | 类型 | 说明 |
|------|------|------|------|
| 状态 | `state` | ref\<PetSystemState\> | 召唤系统完整状态 |
| 状态 | `currentLevel` | ref\<number\> | 当前术士等级 |
| 计算 | `activePet` | computed\<PetInstance\|null\> | 当前激活的召唤物实例 |
| 计算 | `hasActivePet` | computed\<boolean\> | 当前召唤物是否存活 |
| 计算 | `unlockedPets` | computed\<WarlockPet[]\> | 已解锁的召唤物列表 |
| 计算 | `allPets` | computed\<WarlockPet[]\> | 全部召唤物定义 |
| 计算 | `activePetDefinition` | computed\<WarlockPet\|null\> | 当前激活召唤物定义 |
| 计算 | `activePetSoulShardCost` | computed\<number\> | 当前激活召唤物灵魂碎片消耗 |
| Actions | `initialize(level, logFn?)` | function | 初始化召唤系统 |
| Actions | `reset()` | function | 重置（战斗结束） |
| Actions | `setLogCallback(logFn)` | function | 设置战斗日志回调 |
| Actions | `updateLevel(level)` | function | 更新术士等级 |
| Actions | `unlockPet(petType)` | function | 解锁新召唤物 |
| Actions | `canSummon(petType, soulShards)` | function | 检查可召唤性 |
| Actions | `summon(petType, soulShards)` | function | 召唤恶魔（不消耗碎片，由调用方扣除） |
| Actions | `dismiss()` | function | 解散当前召唤物 |
| Actions | `takeDamage(damage)` | function | 召唤物受到伤害 |
| Actions | `petTakeAction()` | function | 召唤物行动（返回选择的技能） |
| Actions | `tickTurn()` | function | 回合结束推进状态 |
| Actions | `getSummonable(soulShards)` | function | 获取可召唤的召唤物列表 |

---

## 被动技能系统（composables/usePassiveSkills.ts）

### 概述

职业被动技能系统（Phase 5.2）从 `src/data/config_class_passives.ts` 加载当前职业的被动技能，按触发时机执行。

### 触发时机

| 触发时机 | 集成点 | 说明 |
|----------|--------|------|
| `on_combat_start` | `combatStore.startCombat` | 战斗开始时触发 |
| `on_turn_start` | `useInitiative.advanceToNextUnit` | 玩家回合开始时触发 |
| `on_attack` | `combatStore.playerAction`（attack/skill） | 玩家攻击/技能命中后触发 |
| `on_damaged` | `useEnemyAction.applyEnemyDamageToPlayer` | 玩家受伤后触发 |
| `on_kill` | `combatStore.endCombat`（victory） | 击杀敌人后触发 |
| `on_low_hp` | `checkLowHpPassives`（回合开始/受伤后检查） | 生命低于 30% 时触发 |

### 被动效果类型

| 效果类型 | 处理方式 |
|----------|----------|
| `resource_gen` | 直接调用 `resourceSystems.generate` 生成资源 |
| `heal` | on_attack 按伤害百分比吸血；其他时机按最大生命百分比治疗 |
| `stat_modifier` | 通过 `getStatModifiers()` 暴露给战斗计算管线 |
| `damage_reduction` | 通过 `getDamageReduction()` 暴露给伤害管线 |
| `buff` | 记录日志，实际效果由效果系统预留扩展点支持 |

### 战斗计算接入方法

```typescript
function getDamageReduction(): number;  // 获取当前减伤比例（0-1，多个减伤取最大值不叠加）
function getStatModifiers(): Array<{ stat: string; value: number }>;  // 获取激活的属性修正列表
function getPassives(): PassiveSkill[];  // 获取当前已加载的被动列表（供 UI/调试）
```

### 条件表达式评估（evaluateCondition）

支持简单格式如 `'hp < 0.3'`，比较角色当前 HP 百分比与阈值：
- stat 字段支持 `hp`（按 hp/maxHp 计算百分比）
- 运算符支持：`<`、`<=`、`>`、`>=`、`==`、`!=`
- 无法解析的条件默认返回 `true`

---

## Boss 机制子系统（composables/useBossMechanics.ts）

### 概述

Boss 机制 Composable 负责 Boss 专属机制的初始化、效果值缩放和机制效果应用。通过 `IBossContext` 接口注入外部依赖（玩家名称、创建小怪、重建先攻），消除对 combat Store 的直接依赖。

### 核心函数

```typescript
function initBossFeatures(enemiesData: EnemyInstance[]): void;
function scaleBossEffectValue(baseValue: number, bossLevel: number): number;
function applyMechanicEffect(e: EnemyInstance, mechType: BossMechanicType, phase: BossPhase): void;
```

### initBossFeatures 流程

1. 清空 `bossPhaseManagers` Map
2. 遍历敌人数据，对有 `isBoss` 且有 `phases` 的敌人创建 `BossPhaseManager`
3. 对有 `isBoss` 且有 `intro` 的敌人收集出场演出数据到 `bossIntros`

### scaleBossEffectValue 公式

`Math.floor(baseValue × (1 + (bossLevel - 1) × 0.08))`

### applyMechanicEffect 机制类型处理

| 机制类型 | 处理逻辑 |
|----------|----------|
| `stun_player` | 创建 `stun` 效果施加到玩家（turns 默认 1），记录日志 |
| `silence_player` | 创建 `silence` 效果施加到玩家（turns 默认 2），记录日志 |
| `debuff_aura` | 创建减益效果施加到玩家（按 Boss 等级缩放 value），记录日志 |
| `aoe_attack` | 仅记录日志（实际标记由 engine 设置，在 enemyAction 中通过 `e.aoeNextAttack` 读取） |
| `summon_minions` | 异步批量创建小怪（dataId='slime'），分配前排位置，推入 enemyIds，重建先攻顺序，记录日志 |
| `healing_zone` | Boss 恢复生命（`hp = min(maxHp, hp + healPerTurn)`，默认 5），记录日志 |
| 其他（enrage/damage_shield/reflect_damage 等） | 已在 boss engine 中处理，此处不重复 |

---

## Composables 子系统详解

### useCombatState（状态层）

战斗模块的单一状态持有者，管理所有响应式状态、计算属性和基础状态操作。

**响应式状态**：state、enemyIds、targetEnemyId、bossIntros、enemyPositions、turn、turnCount、combatId、combatLogs、combatResult、expGained、goldGained、initiativeOrder、currentInitiativeIndex、combatSpeed、playerEffects、enemyEffects、resourceSystems（shallowRef）

**普通变量**：bossPhaseManagers（Map）、effectRegistry（EffectHandlerRegistry 实例）、turnTimerId、bossIntroTimerId

**计算属性**：isInCombat、enemies（从 enemiesStore 实时读取）、aliveEnemies、hasBossEnemy、currentTarget

**函数**：cleanup（清理+删除死亡敌人）、reset（重置不删除敌人）、addEffectToPlayer（战斗作用域约束）、resetState（内部底层逻辑）

### useCombatLog（日志层）

提供战斗日志记录和效果上下文创建函数。

```typescript
function addCombatLog(data: Omit<CombatLog, 'combatId' | 'battleLogId' | 'timestamp' | 'turn'>): void;
async function saveLogs(): Promise<void>;
function createPlayerEffectContext(): EffectContext;
function createEnemyEffectContext(enemy: EnemyInstance): EffectContext;
```

### useInitiative（先攻/调度层）

负责先攻排序、回合推进和敌人回合调度。

```typescript
function assignEnemyPositions(enemiesData: EnemyInstance[]): void;
function buildInitiativeOrder(): void;
function advanceTurn(): { unitId: string; isPlayer: boolean };
function toggleCombatSpeed(): void;
function advanceToNextUnit(): void;
function singleEnemyTurn(enemyId: string): void;
function endPlayerTurn(): void;
```

**buildInitiativeOrder 速度计算**：
- 玩家速度：`effectiveStats.dex + reduceSum('getSpeedMod')`
- 敌人速度：`(stats?.dex ?? 5) + reduceSum('getSpeedMod')`
- 按速度降序排列，找到玩家位置设为 currentInitiativeIndex

**advanceToNextUnit 流程**：
1. 空先攻数组防御（返回空 unitId，防止无限递归）
2. 推进索引，回绕到 0 时 turnCount++ 并执行 `tickAllEffects`
3. 玩家回合：触发 `onTurnStart` 钩子（资源系统+被动技能）+ `COMBAT_PLAYER_TURN` 事件
4. 敌人回合：延迟 `500 / combatSpeed` ms 执行 `singleEnemyTurn`

**singleEnemyTurn 流程**：
1. 检查敌人是否死亡，死亡则从先攻序列移除并修正索引
2. 处理 Boss 阶段转换（applyPhaseStats + 更新 aiStrategy + COMBAT_BOSS_PHASE 事件）
3. 处理 Boss 机制触发（processBossPhaseMechanics + applyMechanicEffect）
4. 推进该敌人技能冷却
5. 执行敌人行动（enemyAction）
6. 检查玩家死亡
7. 推进到下一个行动者

### useEnemyAction（敌人行动层）

负责敌人 AI 策略执行和伤害施加。

```typescript
function applyEnemyDamageToPlayer(
  e: EnemyInstance,
  rawDamage: number,
  skill?: { id: string; name: string },
  damageType?: DamageType
): { actualDamage: number; shieldAbsorbed: number };
function enemyBasicAttack(e: EnemyInstance): CombatActionResult;
function enemyAttackWithSkill(damage: number, skill: { id: string; name: string; type?: string }, e: EnemyInstance): CombatActionResult;
function enemyAction(e: EnemyInstance): CombatActionResult;
function getStrategy(type: AiStrategyType): IAiStrategy;
```

**mapSkillTypeToDamageType**（内部辅助函数）：
- `magic_damage` → `'magical'`
- 其他（含未提供）→ `'physical'`

**applyEnemyDamageToPlayer 流程**：
1. 构建攻击方/防御方效果上下文
2. 调用 `processDamagePipeline` 计算伤害（含护盾吸收、荆棘）
3. 应用被动减伤效果（`passive?.getDamageReduction()`，多个减伤取最大值）
4. 扣血（`ctx.character.takeDamage`）
5. 触发资源系统 `onDamaged` 钩子
6. 触发被动 `onDamaged` 钩子
7. 发射 `COMBAT_DEAL_DAMAGE` 事件
8. 记录战斗日志
9. 荆棘反伤对敌人造成伤害

**enemyAction 流程**：
1. 检查 `aoeNextAttack` 标记（Boss AOE 攻击，倍率 1.3）
2. 获取敌人可用技能，构建 BattleContext
3. 通过 AI 策略决定行动（`strategy.decideAction`）
4. 根据决策类型执行：
   - `skill`：调用 `ctx.enemy.useSkill`，区分 isHeal/isBuff/攻击技能
   - `heal`：恢复生命值
   - `basic_attack`：普通攻击
5. buff/debuff 技能区分自身增益和对玩家减益（通过 `fullSkill.type === 'debuff'` 判断）

### usePlayerAction（玩家行动层）

负责玩家攻击、技能施放、物品使用、逃跑和掉落处理。

```typescript
function playerAttack(): CombatActionResult;
async function playerSkill(skillId: string): Promise<CombatActionResult>;
async function playerUseItem(itemId: string): Promise<CombatActionResult>;
function playerFlee(): CombatActionResult;
function handleLoot(e: EnemyInstance): void;
function applySkillBuffs(skill: { name: string; buffs?: Array<...> }, targetType: string): void;
function applyDebuffToEnemy(e: EnemyInstance, effects: Array<...>, sourceName: string): void;
```

**playerAttack 流程**：
1. 检查目标存在
2. 检查敌人闪避（`dodgeChance / 100`）
3. 构建效果上下文，调用 `processDamagePipeline`（physical）
4. 暴击判定（`critChance / 100`，倍率 1.5）
5. 应用 Boss 防御机制（`applyBossDefenseMechanics`）
6. 造成伤害（`ctx.enemy.takeDamage`）
7. 应用 Boss 反击机制（`applyBossCounterMechanics`）
8. 荆棘反伤（乘以暴击倍率）
9. 发射伤害/暴击事件
10. 记录日志
11. 检查敌人死亡 → 检查 Boss 复活 → endCombat('victory') 或 endPlayerTurn

**playerSkill 流程**：
1. 检查专属资源是否足够（`canCastSkill`）
2. 调用 `ctx.skill.castSkill(skillId, true)`（skipAdventureLog=true）
3. 消耗专属资源（`consumeSkillResource`）
4. 根据技能 targetType 分支：
   - `all_enemies`：AOE 伤害（每目标 70% 基础伤害，独立暴击判定）
   - `self`：伤害技能不可对自身使用
   - `single`（默认）：单目标伤害管线
5. buff/debuff 技能：对玩家自身或敌人施加效果
6. heal 技能：记录治疗日志

**playerUseItem 流程**：
1. 获取物品信息，判断是否为伤害型物品
2. 伤害型物品：对当前目标造成伤害（走伤害管线 + 暴击 + Boss 机制 + 荆棘）
3. 调用 `ctx.inventory.useItem(itemId)` 扣减数量
4. 记录战斗日志
5. 检查敌人死亡

**playerFlee 流程**：
1. 检查是否 Boss 战（`hasBossEnemy`，Boss 战不可逃跑）
2. 计算逃跑成功率（`calculateFleeChance(effectiveStats.dex)`）
3. 成功：`endCombat('fled')`
4. 失败：`endPlayerTurn()`

---

## 战斗状态 Store 导出的公共接口

| 分类 | 名称 | 类型 | 说明 |
|------|------|------|------|
| **状态** | `state` | ref\<CombatState\> | 当前战斗状态 |
| **状态** | `enemies` | computed\<EnemyInstance[]\> | 当前敌人列表（从敌人 Store 实时读取） |
| **状态** | `targetEnemyId` | ref\<string\|null\> | 当前攻击目标 |
| **状态** | `turn` | ref\<'player'\|'enemy'\> | 当前回合 |
| **状态** | `turnCount` | ref\<number\> | 当前回合数 |
| **状态** | `combatLogs` | ref\<CombatLog[]\> | 战斗日志 |
| **状态** | `combatResult` | ref\<CombatResult\|null\> | 战斗结果（供 UI 弹窗） |
| **状态** | `expGained` | ref\<number\> | 获得经验值 |
| **状态** | `goldGained` | ref\<number\> | 获得金币 |
| **状态** | `initiativeOrder` | ref\<string[]\> | 行动顺序（单位 ID 列表） |
| **状态** | `currentInitiativeIndex` | ref\<number\> | 当前行动序号索引 |
| **状态** | `combatSpeed` | ref\<1\|2\> | 战斗速度倍率 |
| **状态** | `playerEffects` | ref\<EffectContainer\> | 玩家当前效果容器 |
| **状态** | `enemyEffects` | ref\<Record\<string,EffectContainer\>\> | 敌人效果容器映射 |
| **状态** | `enemyPositions` | ref\<Record\<string,{row,col}\>\> | 敌人 3×2 网格位置 |
| **状态** | `bossIntros` | ref\<Record\<string,BossIntro\>\> | Boss 出场演出数据 |
| **状态** | `resourceSystems` | shallowRef\<ResourceSystem[]\> | 玩家资源系统列表 |
| **计算** | `isInCombat` | computed\<boolean\> | 是否战斗中 |
| **计算** | `aliveEnemies` | computed\<EnemyInstance[]\> | 存活敌人列表 |
| **计算** | `hasBossEnemy` | computed\<boolean\> | 是否存在 Boss |
| **计算** | `currentTarget` | computed\<EnemyInstance\|null\> | 当前攻击目标 |
| **Action** | `startCombat(enemies)` | function | 开始战斗 |
| **Action** | `playerAction(action)` | async function | 玩家行动 |
| **Action** | `skipTurn()` | function | 跳过回合 |
| **Action** | `endCombat(result)` | function | 结束战斗 |
| **Action** | `reset()` | function | 重置战斗状态 |
| **Action** | `advanceTurn()` | function | 推进到下一个行动者 |
| **Action** | `toggleCombatSpeed()` | function | 切换战斗速度 |
| **Action** | `addEffectToPlayer(effect)` | function | 为玩家添加效果 |
| **Action** | `canCastSkill(skill)` | function | 检查技能资源是否足够 |
| **Action** | `consumeSkillResource(skill)` | function | 消耗技能专属资源 |
| **Action** | `dispose()` | function | 释放 Store 资源（角色切换时调用） |

---

## 与其他模块的交互关系

### 通过 ICombatContext 的直接 Store 调用

| 调用方向 | 方法 | 说明 |
|----------|------|------|
| 战斗 → 角色 | `takeDamage(amount)` | 对玩家造成伤害 |
| 战斗 → 角色 | `gainExp(amount)` | 玩家获得经验 |
| 战斗 → 角色 | `gainGold(amount)` | 玩家获得金币 |
| 战斗 → 角色 | `handleDeath()` | 处理玩家死亡 |
| 战斗 → 角色 | `receiveHeal(amount)` | 获得治疗 |
| 战斗 → 角色 | `changeMp(amount)` | 修改魔法值 |
| 战斗 → 敌人 | `takeDamage(id, amount)` | 对敌人造成伤害 |
| 战斗 → 敌人 | `createEnemy(dataId, level)` | 创建小怪（Boss 召唤） |
| 战斗 → 敌人 | `deleteEnemy(id)` | 清理死亡敌人 |
| 战斗 → 敌人 | `getEnemyById(id)` | 获取敌人数据 |
| 战斗 → 敌人 | `getAvailableSkills(id)` | 获取敌人可用技能 |
| 战斗 → 敌人 | `useSkill(id, skillId)` | 敌人使用技能 |
| 战斗 → 敌人 | `calculateDamage(enemy, defense)` | 计算敌人伤害 |
| 战斗 → 敌人 | `tickCooldowns(enemyId?)` | 推进敌人技能冷却 |
| 战斗 → 技能 | `castSkill(skillId, skipAdventureLog?)` | 施放技能 |
| 战斗 → 技能 | `getSkill(skillId)` | 查询技能数据 |
| 战斗 → 技能 | `tickCooldowns()` | 推进冷却 |
| 战斗 → 技能 | `resetCooldowns()` | 重置冷却（战斗开始时） |
| 战斗 → 背包 | `useItem(itemId)` | 使用物品 |
| 战斗 → 背包 | `addItem(itemId, quantity)` | 添加战利品 |
| 战斗 → 背包 | `getItemInfo(itemId)` | 查询物品信息 |
| 战斗 → 日志 | `addLogEntry(entry)` | 记录冒险日志 |
| 战斗 → 任务 | `onEnemyKilled(enemyId)` | 更新击杀进度 |

### 双日志职责说明

- **ctx.log（useLogStore）**：冒险日志，记录战斗结果的摘要（击败/获得经验/逃跑等），面向玩家回顾
- **log（useCombatLog）**：战斗日志，记录详细的逐回合战斗事件，面向战斗回放与调试

两者独立写入，互不干扰。

### 关键计算公式

| 公式 | 说明 |
|------|------|
| 基础伤害 | `floor(attack × 0.4) + random(0-9)` |
| 防御减免 | `min(baseDamage × 0.3, defense)` |
| 实际伤害 | `max(1, baseDamage - defenseReduction)` |
| 暴击倍率 | 1.5x |
| 逃跑成功率 | `0.5 + dex × 0.01` |
| Boss 效果缩放 | `floor(baseValue × (1 + (level-1) × 0.08))` |
| AOE 每目标伤害 | `面板伤害 × 0.7` |
| 敌人 AOE 倍率 | `rawDamage × 1.3` |
| 易伤系数 | `1.5`（vulnerable 处理器中 `effect.value × 1.5 / 100`） |
| burn 倍率 | `1.5`（onTick 中 `effect.value × 1.5`） |
| Boss 反击伤害 | `actualDamage × 0.5`（counterStance） |
| Boss 复活恢复 | `maxHp × 0.5`（canRevive） |
| 低血量阈值 | `hp / maxHp < 0.3`（on_low_hp 触发） |
| 召唤物生命成长 | `baseHp × (1 + 0.05 × (level-1))` |
| 召唤物伤害成长 | `baseDamage × (1 + 0.03 × (level-1))` |
| 召唤物防御成长 | `baseDefense × (1 + 0.03 × (level-1))` |

---

## 异常处理

| 异常类型 | 触发条件 | 处理策略 |
|----------|----------|----------|
| 不在战斗中 | 非 fighting 状态执行动作 | 忽略操作，返回错误 |
| 非玩家回合 | 玩家回合外执行动作 | 忽略操作，返回错误 |
| 敌人不存在 | 敌人数据为空 | 忽略操作，返回错误 |
| HP 异常 | HP 为负数 | 强制设置为 0 |
| 战斗已结束 | 战斗结束后执行动作 | 忽略操作，返回错误 |
| 物品不存在 | 背包中没有该物品 | 返回错误消息 |
| 技能不存在 | 技能 ID 无效 | 返回错误消息 |
| 魔法值不足 | MP < 技能消耗 | 返回错误消息 |
| 专属资源不足 | 资源系统 hasEnough 返回 false | 返回"资源不足"消息 |
| 存储失败 | IndexedDB 写入异常 | console.error 记录，不中断战斗 |
| 控制效果 | 眩晕/冰冻/沉默 | 跳过回合或禁止技能，返回 `isControlled: true` |
| Boss 战逃跑 | 尝试从 Boss 战逃跑 | 返回错误"无法从Boss战中逃跑" |
| NaN 防御 | 效果系统返回 NaN | 归零处理（attackerMod/defenderMod 归 1，finalDamage 归 0） |
| 空先攻数组 | initiativeOrder 为空 | advanceTurn 返回空 unitId，防止无限递归 |
| 定时器残留 | 上一场战斗定时器未清理 | startCombat 防御性 reset 清理 turnTimerId/bossIntroTimerId |
| 背包已满 | addItem 返回值小于请求量 | useToast 提示玩家"背包已满" |
| 掉落数量异常 | maxAmount < minAmount | span 取 0，防止负数掉落数量 |
| 敌人索引越界 | 移除死亡敌人后索引超界 | 修正 currentInitiativeIndex 到 0 |

---

## 性能与安全考量

### 性能优化

| 策略 | 说明 |
|------|------|
| shallowRef 管理 ResourceSystem | 避免对 ResourceSystem 实例做深度响应式追踪 |
| enemies 计算属性实时读取 | 不维护本地副本，数据源唯一（enemiesStore 缓存） |
| effectRegistry 单例 | 战斗期间只创建一次，注册全部 15 种处理器 |
| 批量日志持久化 | saveLogs 使用 Promise.all 并行写入 |
| 效果 tick 统一执行 | 新一轮开始时统一 tick 所有效果，而非每个敌人回合 tick |
| AOE 伤害独立计算 | 每个敌人独立走伤害管线，避免共享中间状态 |

### 安全考量

| 策略 | 说明 |
|------|------|
| 战斗作用域约束 | addEffectToPlayer 仅在 fighting 状态生效 |
| 防御性重置 | startCombat 开头调用 reset 防止状态残留 |
| 定时器清理 | resetState 清理 turnTimerId 和 bossIntroTimerId |
| 索引修正 | 移除死亡敌人时修正 currentInitiativeIndex 防止跳过回合 |
| 不可变更新 | pets/forms 子系统使用纯函数返回新状态 |
| 接口最小化 | ICombatContext 仅暴露 combat 模块实际使用的方法 |

---

## 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-15 | 初始版本，包含基础战斗功能 | System |
| v1.1 | 2026-05-18 | 重构为回合制系统，添加玩家单动作限制 | System |
| v2.0 | 2026-05-19 | 迁移到 Pinia + IndexedDB 架构 | System |
| v2.1 | 2026-05-19 | 添加战斗日志数据结构 | System |
| v2.2 | 2026-05-20 | 移除buff、debuff及被动技能相关内容，简化技能效果类型 | System |
| v3.0 | 2026-06-16 | 修正文件结构（新增 db/store/service.ts），新增AI子系统、效果子系统文档 | System |
| v4.0 | 2026-06-16 | 全面重写：修正所有类型定义、事件名、数据模型；新增多敌人系统、3×2网格、速度制先攻、Boss阶段、伤害管线、15种效果类型、AI策略详情、Store操作导出表 | System |
| v4.1 | 2026-06-17 | 逐文件比对修正：DefensiveStrategy HP阈值 30%→40%；修正AI策略描述使其与代码行为一致 | System |
| v4.2 | 2026-07-10 | 严格对齐源码：修正 CombatState 枚举；补全 composables/ 与 combatContext.ts；新增 forms/pets/resources 子模块；移除不存在的接口；修正 CombatEventType 与 CombatActionResult；补全效果系统 Handler 接口；补全 A2 读写分离 | System |
| v4.3 | 2026-07-10 | 逐文件比对修正：修正 bossIntros 分类（ref 状态非 computed）；补全 15 种效果处理器实现公式；补全 Boss 机制 applyMechanicEffect 6 种机制处理逻辑；补全 useEnemyAction/usePlayerAction 详细流程；补全 PetBaseAttributes/Combatant/ResourceSystemFactoryMap 类型与 PET_AI_TARGET_PRIORITY 常量；补全 useFormStore/usePetStore 完整导出接口；补全敌人速度 fallback 值与 evaluateCondition 方法；补全 handleLoot 背包满检查 | System |

---

**文档结束**
