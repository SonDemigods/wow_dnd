# 战斗模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 战斗模块设计文档 |
| 版本 | v4.1 |
| 生成日期 | 2026年6月17日 |
| 所属模块 | `modules/combat` |
| 更新说明 | 逐文件比对修正：DefensiveStrategy HP阈值从30%修正为40%；移除AI策略描述中不存在的"护盾/buff技能优先"逻辑 |

---

## 模块概述与定位

### 模块定位

战斗模块是游戏的核心玩法模块，负责管理玩家与敌人之间的回合制战斗流程。它处理战斗状态管理、伤害计算、战斗行动、AI 策略、效果系统、Boss 机制和战利品分配等核心战斗逻辑。

### 核心职责

| 职责 | 描述 |
|------|------|
| 回合制战斗 | 基于速度制先攻排序管理单位行动顺序 |
| 多敌人战斗 | 支持同时与多个敌人（最多6个）战斗，3×2 网格布局 |
| 玩家动作限制 | 玩家回合只允许执行一个动作 |
| 伤害管线 | 基于效果管线计算伤害（攻击修正→防御修正→护盾吸收→荆棘反伤） |
| 战斗行动 | 支持攻击、使用技能、使用物品、逃跑、跳过回合 |
| 战斗AI | 4种策略模式（强攻、防守、均衡、Boss阶段）控制敌人行为 |
| 效果系统 | 15种效果类型，可扩展的处理器架构（管线+容器+Handler） |
| Boss 系统 | 多阶段 Boss 战斗、阶段转换、专属机制（眩晕/沉默/召唤/范围攻击等） |
| 战利品分配 | 战斗胜利后分配经验、金币和 Boss 掉落物品 |
| 战斗日志 | 记录完整战斗过程，持久化到 IndexedDB |

### 模块边界

**战斗模块**直接调用以下模块的 Store Action（不通过 EventBus）：

- **角色模块**：`takeDamage`、`gainExp`、`gainGold`、`handleDeath`、`receiveHeal`
- **敌人模块**：`createEnemy`、`getEnemyById`、`calculateDamage`、`takeDamage`、`deleteEnemy` 等
- **技能模块**：`castSkill`、`getSkill`、`tickCooldowns`
- **背包模块**：`useItem`、`addItem`、`getItemInfo`
- **任务模块**：`onEnemyKilled`
- **日志模块**：`addLogEntry`

EventBus 仅保留 UI/音效事件：`COMBAT_START`、`COMBAT_END`、`COMBAT_PLAYER_TURN`、`COMBAT_ENEMY_TURN`、`COMBAT_DEAL_DAMAGE`、`COMBAT_CAST_HEAL`、`COMBAT_CRITICAL_HIT`、`COMBAT_DODGE`、`COMBAT_SKIP_TURN`、`COMBAT_BOSS_INTRO`、`COMBAT_BOSS_PHASE`

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
| FR-COMBAT-006 | 伤害计算管线（进攻→防御→护盾→荆棘） | 伤害系统 |
| FR-COMBAT-007 | 伤害减免（物理/魔法防御） | 伤害系统 |
| FR-COMBAT-008 | 暴击判定 | 战斗系统 |
| FR-COMBAT-009 | 闪避判定 | 战斗系统 |
| FR-COMBAT-010 | 战利品掉落（仅 Boss） | 战斗奖励 |
| FR-COMBAT-011 | 经验获取 | 成长系统 |
| FR-COMBAT-012 | 完整战斗日志持久化 | 用户体验 |
| FR-COMBAT-013 | 多敌人战斗（3×2网格） | 战斗系统 |
| FR-COMBAT-014 | 15种效果类型处理 | 效果系统 |
| FR-COMBAT-015 | AI 策略模式 | 敌人行为 |
| FR-COMBAT-016 | Boss 多阶段机制 | Boss 系统 |
| FR-COMBAT-017 | 技能冷却系统 | 技能系统 |
| FR-COMBAT-018 | 战斗速度 1x/2x 切换 | 用户体验 |

---

## 模块文件结构

```
src/modules/combat/
  ├── index.ts          # 模块统一导出入口
  ├── types.ts          # TypeScript 类型定义和接口
  ├── db.ts             # IndexedDB CRUD 操作（战斗日志持久化）
  ├── store.ts          # Pinia Store 状态管理（核心战斗逻辑）
  ├── service.ts        # 纯函数计算（伤害、暴击、闪避、逃跑）
  ├── effects.ts        # 战斗效果系统入口
  ├── ai/               # 战斗 AI 子系统
  │   ├── index.ts      # AI 子模块导出
  │   ├── strategies.ts # AI 策略实现（Aggressive/Defensive/Balanced/BossPhase）
  │   └── types.ts      # AI 类型定义（BattleContext、IAiStrategy、AiDecision）
  └── effects/          # 战斗效果子系统
      ├── index.ts      # 效果子模块导出
      ├── container.ts  # EffectContainer 效果容器
      ├── handler.ts    # EffectHandler 处理器基类与 EffectHandlerRegistry 注册表
      ├── pipeline.ts   # 伤害计算管线（processDamagePipeline）
      ├── types.ts      # 效果类型定义（EffectType 15种、Effect、EffectContext 等）
      └── handlers/     # 15个具体效果处理器
          ├── index.ts      # 处理器统一导出
          ├── attackMod.ts  # 攻击力修正（attackUp/attackDown）
          ├── control.ts    # 控制效果（stun/freeze/silence/vulnerable）
          ├── defenseMod.ts # 防御力修正（defenseUp/defenseDown）
          ├── dot.ts        # 持续伤害（poison/burn）
          ├── regen.ts      # 持续恢复
          ├── shield.ts     # 护盾效果
          ├── speedMod.ts   # 速度修正（speedUp/speedDown）
          └── thorn.ts      # 荆棘反伤
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | 模块统一导出入口 |
| `types.ts` | 所有接口、类型定义（CombatState、CombatAction、CombatLog等） |
| `db.ts` | 战斗日志持久化 CRUD（saveCombatLog 等） |
| `store.ts` | Pinia Store，战斗状态唯一持有者，所有状态管理和副作用 |
| `service.ts` | 纯函数集合（calculatePlayerDamage、rollCritical、rollDodge、calculateFleeChance、generateCombatId 等） |
| `effects.ts` | 效果系统入口，提供公共 API（tickEffects、applyShield、getStatModifiers 等） |
| `ai/types.ts` | AI 类型定义 |
| `ai/strategies.ts` | 4种 AI 策略实现 |
| `effects/pipeline.ts` | 伤害计算管线 |
| `effects/container.ts` | 效果容器创建与效果添加 |
| `effects/handler.ts` | 处理器基类和注册表 |
| `effects/handlers/*.ts` | 15种效果的具体处理逻辑 |

---

## 接口定义

### 服务接口 ICombatService

```typescript
export interface ICombatService {
  getState(): CombatState;
  getEnemy(): EnemyInstance | null;
  getTurn(): 'player' | 'enemy';
  startCombat(enemies: EnemyInstance[]): void;  // 支持多个敌人
  playerAction(action: CombatAction): Promise<CombatActionResult>;  // 异步
  enemyTurn(): void;
  endCombat(result: CombatResult): void;
  isInCombat(): boolean;
  getCombatLog(): CombatLog[];
  castSkill(skillId: string, targetType: 'self' | 'enemy'): SkillCastResult;
}
```

### 数据类型定义

```typescript
/** 战斗状态 */
export type CombatState = 'idle' | 'preparing' | 'fighting' | 'ended';

/** 战斗结果 */
export type CombatResult = 'victory' | 'defeat' | 'fled';

/** 战斗行动类型 */
export type CombatActionType = 'attack' | 'item' | 'flee' | 'skill';

/** 战斗行动 */
export interface CombatAction {
  type: CombatActionType;
  itemId?: string;
  skillId?: string;
  target?: 'player' | 'enemy';
}

/** 战斗行动结果 */
export interface CombatActionResult {
  success: boolean;
  type: CombatActionType;
  damage?: number;
  heal?: number;
  isCrit?: boolean;
  isDodge?: boolean;
  message: string;
  /** 多目标技能命中列表（仅技能为 all_enemies 时返回） */
  aoeHits?: AoeHitInfo[];
}

/** 多目标技能命中信息 */
export interface AoeHitInfo {
  enemyId: string;
  enemyName: string;
  damage: number;
  isCrit?: boolean;
  isDodge?: boolean;
}

/** 战斗伤害事件 */
export interface CombatDamageEvent {
  action: CombatActionType;
  target: 'player' | 'enemy';
  amount: number;
  isCrit: boolean;
  isDodge: boolean;
}

/** 战斗开始事件 */
export interface CombatStartEvent {
  enemy: EnemyInstance;
}

/** 战斗结束事件 */
export interface CombatEndEvent {
  result: CombatResult;
  enemy: EnemyInstance;
  expGained: number;
  loot?: InventoryItem[];
}

/** 战斗事件类型（战斗日志用） */
export type CombatEventType =
  | 'combat_start'
  | 'combat_end'
  | 'combat_turn_start'
  | 'combat_turn_end'
  | 'combat_player_action'
  | 'combat_enemy_action'
  | 'combat_damage'
  | 'combat_heal'
  | 'combat_skill_cast'
  | 'combat_item'
  | 'combat_flee'
  | 'combat_miss'
  | 'combat_critical'
  | 'combat_death'
  | 'combat_event';  // 通用事件（Boss 机制、阶段转换等）

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

/** 技能战斗效果 */
export interface SkillCombatEffect {
  skillId: string;
  skillName: string;
  effectType: SkillType;  // 引用 skill 模块的 SkillType
  targetType: 'self' | 'enemy';
  damage?: {
    base: number;
    minMultiplier: number;
    maxMultiplier: number;
    type: 'physical' | 'magic' | 'true';
  };
  heal?: {
    base: number;
    multiplier: number;
  };
  manaCost: number;
}

/** 技能施放结果 */
export interface SkillCastResult {
  success: boolean;
  skillId: string;
  skillName: string;
  damage?: number;
  heal?: number;
  message: string;
}
```

### 技能类型（引用 skill 模块）

```typescript
// 技能类型来自 skill 模块，共 6 种
export type SkillType =
  | 'physical_damage'  // 物理伤害
  | 'magic_damage'     // 魔法伤害
  | 'health_restore'   // 生命恢复
  | 'mana_restore'     // 法力恢复
  | 'buff'             // 增益
  | 'debuff';          // 减益
```

---

## 通过 EventBus 发布的事件

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `COMBAT_START` | 战斗开始时 | `{ enemy: Enemy }` |
| `COMBAT_END` | 战斗结束时 | `{ result, enemy, expGained, goldGained? }` |
| `COMBAT_PLAYER_TURN` | 玩家回合开始时 | `null` |
| `COMBAT_ENEMY_TURN` | 敌人回合开始时 | `null` |
| `COMBAT_DEAL_DAMAGE` | 造成伤害时 | `{ amount, damageType, targetName, actorType }` |
| `COMBAT_CAST_HEAL` | 治疗时 | `{ amount, healType, targetName }` |
| `COMBAT_CRITICAL_HIT` | 暴击时 | `{ amount, damageType, targetName, actorType }` |
| `COMBAT_DODGE` | 闪避时 | `{ attackerName, dodgerName, dodgerType }` |
| `COMBAT_SKIP_TURN` | 跳过回合时 | `null` |
| `COMBAT_BOSS_INTRO` | Boss 出场演出时 | `{ enemyId, enemyName, icon, effect, lines, duration }` |
| `COMBAT_BOSS_PHASE` | Boss 阶段转换时 | `{ enemyId, enemyName, phaseName, effect }` |

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
| actorId | string | 是 | 行动者唯一ID |
| actorName | string | 是 | 行动者显示名称 |
| eventType | CombatEventType | 是 | 战斗事件类型 |
| targetType | 'player' \| 'enemy' | 否 | 目标类型 |
| targetId | string | 否 | 目标ID |
| targetName | string | 否 | 目标显示名称 |
| skillId | string | 否 | 技能ID |
| skillName | string | 否 | 技能名称 |
| damage | number | 否 | 伤害数值 |
| heal | number | 否 | 治疗数值 |
| isCrit | boolean | 否 | 是否暴击 |
| isDodge | boolean | 否 | 是否闪避 |
| message | string | 是 | 日志描述消息 |

---

## 业务逻辑流程

### 战斗开始流程

1. 调用 `startCombat(enemiesData: Enemy[])` 开始战斗
2. 生成战斗 ID，状态设为 `fighting`
3. 初始化 Boss 功能（阶段管理器 + 出场演出）
4. 分配敌人位置到 3×2 网格（Boss 后排中间优先，普通敌人前排优先）
5. 计算速度制先攻顺序（玩家 + 所有敌人按速度降序排列）
6. 触发 `COMBAT_START` 事件
7. 如有 Boss，延迟 300ms 触发 `COMBAT_BOSS_INTRO` 事件
8. 触发 `COMBAT_PLAYER_TURN` 事件
9. 记录战斗开始到冒险日志

### 玩家回合流程

1. 检查战斗状态和当前回合
2. 检查控制效果（眩晕/冰冻跳过回合，沉默禁止技能）
3. 等待玩家选择动作（攻击/技能/物品/逃跑/跳过）
4. 执行玩家动作
5. 记录行动到战斗日志
6. 检查战斗是否结束
7. 如果未结束，通过 `endPlayerTurn()` 推进到下一个行动者（速度制先攻）

### 敌人回合（速度制先攻调度）

1. 推进玩家效果（DoT、HoT tick）
2. 检查玩家是否因持续伤害死亡
3. 推进所有敌方效果 tick
4. 处理 Boss 阶段转换和机制触发
5. 推进敌人技能冷却
6. 通过 AI 策略决定行动
7. 执行敌人行动（普通攻击/技能/治疗）
8. 检查玩家是否死亡
9. 推进到下一个行动者（可能仍是敌人，链式调用）

### 伤害计算管线

```
攻击方原始伤害 → effectRegistry.getAttackMod（攻击修正）
              → 防御方 effectRegistry.getDefenseMod（防御修正）
              → applyShield（护盾吸收）
              → getThornDamage（荆棘反伤）
              → 最终伤害
```

### 战斗结束流程

1. 胜利：计算总经验/金币 → 调用 `gainExp`/`gainGold` → 处理 Boss 掉落 → 更新任务击杀进度 → 记录冒险日志
2. 失败：调用 `handleDeath` → 记录冒险日志
3. 逃跑：仅 Boss 战不可逃跑，非 Boss 战斗逃跑成功率为 `0.5 + dex × 0.01`
4. 触发 `COMBAT_END` 事件（探索等模块监听）
5. 清理战斗状态（敌人、效果、定时器）

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库表 | Key | 数据结构 | 说明 |
|----------|-----|----------|------|
| `runtime_combatLogs` | `combatId` | CombatLog[] | 战斗日志（按战斗ID隔离） |

### 日志存储接口

```typescript
export interface CombatLogStorage {
  combatId: string;
  battleLogId: string;
  timestamp: number;
  turn: number;
  actorType: string;
  actorId: string;
  actorName: string;
  eventType: string;
  targetType?: string;
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
```

---

## 战斗 AI 子系统

### 概述

战斗 AI 子系统（`modules/combat/ai/`）基于策略模式实现，负责控制敌人的战斗行为决策。

### 类型定义

```typescript
/** 战斗上下文 */
export interface BattleContext {
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  availableSkills: { id: string; name: string; isHeal?: boolean; damageMultiplier?: number }[];
  turnCount: number;
}

/** AI 策略接口 */
export interface IAiStrategy {
  readonly name: string;
  decideAction(enemy: Enemy, context: BattleContext): AiDecision;
}

/** AI 决策 */
export type AiDecision =
  | { type: 'basic_attack' }
  | { type: 'skill'; skillId: string }
  | { type: 'heal'; skillId: string };
```

### 策略类型

| 策略名 | 类名 | 行为描述 |
|--------|------|----------|
| `aggressive` | AggressiveStrategy | 强攻型：50%概率使用攻击技能，HP 低时不治疗 |
| `defensive` | DefensiveStrategy | 防守型：HP 低于 40% 时优先治疗，少用攻击技能（20%概率） |
| `balanced` | BalancedStrategy | 均衡型：HP 低于 50% 时 60%概率治疗，30%概率使用攻击技能 |
| `boss_phase` | BossPhaseStrategy | Boss 阶段型：HP 低于 20%狂暴（必定用技能），HP 低于 50%高概率用技能 |

---

## 战斗效果子系统

### 概述

战斗效果子系统（`modules/combat/effects/`）采用 **管线 + 容器 + Handler 处理器** 架构，支持 15 种效果类型的可扩展处理。

### 核心架构

```
效果触发 → Pipeline（管线） → EffectContainer（容器）
                                  ↓
                            Handler（处理器）
                                  ↓
                            应用/移除效果
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
| `vulnerable` | 控制 | 受到的伤害增加 |

### 核心类型

```typescript
/** 效果实例 */
export interface Effect {
  id: string;
  type: EffectType;
  remainingTurns: number;
  value: number;
  source: 'skill' | 'item' | 'enemy' | 'passive';
  sourceName: string;
  stackStrategy?: 'replace' | 'max' | 'additive' | 'independent';
}

/** 效果容器 */
export interface EffectContainer {
  effects: Effect[];
}

/** 效果上下文 */
export interface EffectContext {
  ownerId: string;
  ownerType: 'player' | 'enemy';
  baseStats: { physicalAttack; physicalDefense; magicAttack; magicDefense; speed };
  currentHp: number;
  maxHp: number;
}

/** 伤害管线输出 */
export interface DamagePipelineResult {
  expectedDamage: number;
  actualDamage: number;
  absorbed: number;
  finalDamage: number;
  thorns: number;
}
```

---

## 战斗状态 Store 导出的公共接口

| 分类 | 名称 | 类型 | 说明 |
|------|------|------|------|
| **状态** | `state` | ref\<CombatState\> | 当前战斗状态 |
| **状态** | `enemies` | computed\<Enemy[]\> | 当前敌人列表（从敌人Store实时读取） |
| **状态** | `targetEnemyId` | ref\<string|null\> | 当前攻击目标 |
| **状态** | `turn` | ref\<'player'\|'enemy'\> | 当前回合 |
| **状态** | `turnCount` | ref\<number\> | 当前回合数 |
| **状态** | `combatLogs` | ref\<CombatLog[]\> | 战斗日志 |
| **状态** | `combatResult` | ref\<CombatResult|null\> | 战斗结果（供UI弹窗） |
| **状态** | `expGained` | ref\<number\> | 获得经验值 |
| **状态** | `goldGained` | ref\<number\> | 获得金币 |
| **状态** | `combatSpeed` | ref\<1\|2\> | 战斗速度倍率 |
| **状态** | `playerEffects` | ref\<EffectContainer\> | 玩家当前效果容器 |
| **状态** | `enemyEffects` | ref\<Map\<string,EffectContainer\>\> | 敌人效果容器映射 |
| **状态** | `enemyPositions` | ref | 敌人 3×2 网格位置 |
| **计算** | `isInCombat` | computed\<boolean\> | 是否战斗中 |
| **计算** | `aliveEnemies` | computed\<Enemy[]\> | 存活敌人列表 |
| **计算** | `hasBossEnemy` | computed\<boolean\> | 是否存在 Boss |
| **计算** | `bossIntros` | ref | Boss 出场演出数据 |
| **计算** | `currentTarget` | computed\<Enemy\|null\> | 当前攻击目标 |
| **Action** | `startCombat(enemies)` | function | 开始战斗 |
| **Action** | `playerAction(action)` | async function | 玩家行动 |
| **Action** | `enemyTurn()` | function | 敌人回合 |
| **Action** | `skipTurn()` | function | 跳过回合 |
| **Action** | `endCombat(result)` | function | 结束战斗 |
| **Action** | `reset()` | function | 重置战斗状态 |
| **Action** | `toggleCombatSpeed()` | function | 切换战斗速度 |

---

## 与其他模块的交互关系

### 直接 Store 调用

| 调用方向 | 方法 | 说明 |
|----------|------|------|
| 战斗 → 角色 | `takeDamage(amount)` | 对玩家造成伤害 |
| 战斗 → 角色 | `gainExp(amount)` | 玩家获得经验 |
| 战斗 → 角色 | `gainGold(amount)` | 玩家获得金币 |
| 战斗 → 角色 | `handleDeath()` | 处理玩家死亡 |
| 战斗 → 角色 | `receiveHeal(amount)` | 获得治疗 |
| 战斗 → 敌人 | `takeDamage(id, amount)` | 对敌人造成伤害 |
| 战斗 → 敌人 | `createEnemy(template, level)` | 创建小怪（Boss 召唤） |
| 战斗 → 敌人 | `deleteEnemy(id)` | 清理死亡敌人 |
| 战斗 → 敌人 | `getAvailableSkills(id)` | 获取敌人可用技能 |
| 战斗 → 敌人 | `useSkill(id, skillId)` | 敌人使用技能 |
| 战斗 → 技能 | `castSkill(id, isCombat)` | 施放技能 |
| 战斗 → 技能 | `tickCooldowns()` | 推进冷却 |
| 战斗 → 背包 | `useItem(id)` | 使用物品 |
| 战斗 → 背包 | `addItem(id, count)` | 添加战利品 |
| 战斗 → 日志 | `addLogEntry(entry)` | 记录冒险日志 |
| 战斗 → 任务 | `onEnemyKilled(dataId)` | 更新击杀进度 |

### 关键计算公式

| 公式 | 说明 |
|------|------|
| 玩家基础伤害 | `floor(physicalAttack × 0.4) + random(0-9)` |
| 防御减免 | `min(baseDamage × 0.3, defense)` |
| 实际伤害 | `max(1, baseDamage - defenseReduction)` |
| 暴击倍率 | 1.5x |
| 逃跑成功率 | `0.5 + dex × 0.01` |
| Boss 效果缩放 | `baseValue × (1 + (level-1) × 0.08)` |

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
| 技能不存在 | 技能ID无效 | 返回错误消息 |
| 魔法值不足 | MP < 技能消耗 | 返回错误消息 |
| 存储失败 | IndexedDB 写入异常 | console.error 记录，不中断战斗 |
| 控制效果 | 眩晕/冰冻/沉默 | 跳过回合或禁止技能 |
| Boss 战逃跑 | 尝试从 Boss 战逃跑 | 返回错误"无法从Boss战中逃跑" |

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

---

**文档结束**
