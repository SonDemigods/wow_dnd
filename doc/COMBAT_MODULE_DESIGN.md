# 战斗模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 战斗模块设计文档 |
| 版本 | v2.2 |
| 生成日期 | 2026年5月20日 |
| 所属模块 | `modules/combat` |

---

## 模块概述与定位

### 模块定位

战斗模块是游戏的核心玩法模块，负责管理玩家与敌人之间的回合制战斗流程。它处理战斗状态管理、伤害计算、战斗行动、战利品分配等核心战斗逻辑。

### 核心职责

| 职责 | 描述 |
|------|------|
| 回合制战斗 | 管理玩家回合与敌人回合的切换 |
| 玩家动作限制 | 玩家回合只允许执行一个动作 |
| 伤害计算 | 基于进攻/防御属性计算伤害 |
| 战斗行动 | 支持攻击、使用消耗品、逃跑等动作 |
| 战斗AI | 控制敌人的攻击行为 |
| 战利品分配 | 战斗胜利后分配经验和物品 |
| 战斗日志 | 记录战斗过程，只保留最近一次战斗 |

### 模块边界

**战斗模块**与以下模块交互:
- 角色模块：获取玩家战斗属性，修改生命值和经验值
- 背包模块：使用消耗品，接收战利品
- 技能模块：技能伤害计算和效果触发
- 探索模块：触发玩家死亡事件

---

## 功能需求

### 功能需求列表

| 需求编号 | 需求描述 | 来源 |
|----------|----------|------|
| FR-COMBAT-001 | 回合制战斗系统 | 核心功能 |
| FR-COMBAT-002 | 玩家回合单动作限制 | 回合机制 |
| FR-COMBAT-003 | 玩家攻击动作 | 战斗行动 |
| FR-COMBAT-004 | 使用消耗品动作 | 战斗行动 |
| FR-COMBAT-005 | 逃跑动作 | 战斗行动 |
| FR-COMBAT-006 | 伤害计算(考虑进攻属性) | 伤害系统 |
| FR-COMBAT-007 | 伤害减免(考虑防御属性) | 伤害系统 |
| FR-COMBAT-008 | 暴击判定 | 战斗系统 |
| FR-COMBAT-009 | 闪避判定 | 战斗系统 |
| FR-COMBAT-010 | 战利品掉落 | 战斗奖励 |
| FR-COMBAT-011 | 经验获取 | 成长系统 |
| FR-COMBAT-012 | 战斗日志(最近一次) | 用户体验 |
| FR-COMBAT-013 | 战斗日志详细数据结构 | 战斗记录 |

### 非功能需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| NFR-COMBAT-001 | 战斗响应时间 < 100ms | 高 |
| NFR-COMBAT-002 | 伤害计算精度 | 高 |
| NFR-COMBAT-003 | 战斗日志内存限制 | 中 |
| NFR-COMBAT-004 | 技能效果处理性能优化 | 中 |

---

## 接口定义

### 服务接口 ICombatService

```typescript
export interface ICombatService {
  getState(): CombatState;
  getEnemy(): EnemyInstance | null;
  getTurn(): 'player' | 'enemy';
  startCombat(enemy: EnemyInstance): void;
  playerAction(action: CombatAction): CombatActionResult;
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
}

/** 战斗日志条目 */
export interface CombatLogEntry {
  turn: number;
  actor: 'player' | 'enemy';
  action: CombatActionType;
  result: CombatActionResult;
  timestamp: number;
}

/** 战斗伤害事件 */
export interface CombatDamageEvent {
  target: 'player' | 'enemy';
  amount: number;
  isCrit: boolean;
  isDodge: boolean;
}

/** 战斗开始事件 */
export interface CombatStartEvent {
  enemy: Enemy;
}

/** 战斗结束事件 */
export interface CombatEndEvent {
  result: CombatResult;
  enemy: Enemy;
  expGained: number;
  loot?: any[];
}

/** 战斗日志数据结构 */
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
  isCrit: boolean;
  isDodge: boolean;
  message: string;
}

/** 战斗事件类型 */
export type CombatEventType = 
  | 'combat_start' | 'combat_end' | 'combat_turn_start' | 'combat_turn_end'
  | 'combat_player_action' | 'combat_enemy_action' | 'combat_damage' | 'combat_heal'
  | 'combat_skill_cast' | 'combat_item' | 'combat_flee' | 'combat_miss'
  | 'combat_critical' | 'combat_death';

/** 技能战斗效果 */
export interface SkillCombatEffect {
  skillId: string;
  skillName: string;
  effectType: SkillType;
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

/** 技能类型 */
export type SkillType = 'physical_damage' | 'magic_damage' | 'heal';

/** 技能释放结果 */
export interface SkillCastResult {
  success: boolean;
  skillId: string;
  skillName: string;
  damage?: number;
  heal?: number;
  message: string;
}
```

### 事件定义

| 事件名称 | 触发时机 | 事件数据 |
|----------|----------|----------|
| `COMBAT_START` | 战斗开始时 | `{ enemy: Enemy }` |
| `COMBAT_END` | 战斗结束时 | `{ result, enemy, expGained }` |
| `COMBAT_PLAYER_ACTION` | 玩家行动时 | `{ action, result }` |
| `COMBAT_ENEMY_ACTION` | 敌人行动时 | `{ action, result }` |
| `COMBAT_DAMAGE` | 造成伤害时 | `{ target, amount, isCrit, isDodge }` |
| `COMBAT_HEAL` | 治疗时 | `{ target, amount }` |
| `COMBAT_SKILL_CAST` | 技能释放时 | `{ skillId, skillName, actor, target, damage, heal }` |

---

## 战斗日志数据结构设计

### 数据结构总览

**CombatLog 字段说明：**

| 字段名 | 数据类型 | 必填 | 约束条件 | 说明 |
|--------|----------|------|----------|------|
| combatId | string | 是 | UUID格式 | 战斗唯一标识 |
| battleLogId | string | 是 | UUID格式 | 日志条目唯一标识 |
| timestamp | number | 是 | 毫秒级时间戳 | 日志记录时间 |
| turn | number | 是 | ≥1的整数 | 当前战斗回合数 |
| actorType | string | 是 | player/enemy/system | 行动者类型 |
| actorId | string | 是 | 非空字符串 | 行动者唯一ID |
| actorName | string | 是 | 最大50字符 | 行动者显示名称 |
| eventType | string | 是 | 枚举值 | 战斗事件类型 |
| targetType | string | 否 | player/enemy | 目标类型 |
| targetId | string | 否 | 非空字符串 | 目标ID |
| targetName | string | 否 | 最大50字符 | 目标显示名称 |
| skillId | string | 否 | 非空字符串 | 技能ID |
| skillName | string | 否 | 最大50字符 | 技能名称 |
| damage | number | 否 | ≥0的整数 | 伤害数值 |
| heal | number | 否 | ≥0的整数 | 治疗数值 |
| isCrit | boolean | 是 | true/false | 是否暴击 |
| isDodge | boolean | 是 | true/false | 是否闪避 |
| isBlocked | boolean | 是 | true/false | 是否格挡 |
| message | string | 是 | 最大500字符 | 日志描述消息 |

### 战斗日志存储结构

```typescript
export interface CombatLogStorage {
  id: string;
  combatHistory: CombatLog[];
  maxHistoryCount: number;
  createdAt: number;
  updatedAt: number;
}
```

---

## 业务逻辑流程

### 战斗开始流程

1. 调用 `startCombat(enemy)` 方法开始战斗
2. 设置战斗状态为 'preparing'
3. 初始化敌人数据(设置 currentHp)
4. 设置当前回合为 'player'
5. 清空战斗日志
6. 延迟500ms后设置战斗状态为 'fighting'
7. 触发 `COMBAT_START` 事件

### 玩家回合流程

1. 检查是否为玩家回合
2. 等待玩家选择一个动作（攻击、使用消耗品、逃跑、技能）
3. 执行玩家选择的动作
4. 记录行动到战斗日志
5. 触发 `COMBAT_PLAYER_ACTION` 事件
6. 检查战斗是否结束
7. 如果未结束，切换到敌人回合
8. 延迟800ms后执行敌人行动

### 敌人回合流程

1. 检查是否为敌人回合
2. 敌人AI选择攻击动作
3. 执行敌人攻击
4. 记录行动到战斗日志
5. 触发 `COMBAT_ENEMY_ACTION` 事件
6. 检查战斗是否结束
7. 如果未结束，切换到玩家回合

### 伤害计算流程（进攻/防御）

**玩家造成伤害计算：**
1. 获取玩家进攻类属性（physicalAttack、magicAttack、暴击率）
2. 计算基础伤害 = 进攻属性 + 随机值(0-10)
3. 暴击判定：如果随机数 < 暴击率，伤害 x1.5
4. 返回最终伤害

**玩家受到伤害计算：**
1. 获取敌人进攻属性
2. 获取玩家防御类属性（physicalDefense、magicDefense、闪避率）
3. 计算基础伤害 = 敌人进攻属性 + 随机值(0-10)
4. 闪避判定：如果随机数 < 闪避率，伤害 = 0
5. 计算防御减免 = min(伤害 x 0.3, 防御属性)
6. 最终伤害 = max(1, 基础伤害 - 防御减免)
7. 返回最终伤害

### 战斗结束流程

1. 根据结果处理战利品和经验
2. 如果是胜利：分配经验和战利品
3. 如果是失败：触发探索模块的死亡事件
4. 如果是逃跑：不做额外处理
5. 设置战斗状态为 'ended'
6. 触发 `COMBAT_END` 事件
7. 战斗日志保留到下次战斗开始

---

## 数据模型与存储设计

### IndexedDB 存储结构

| 数据库 Store | Key | 数据结构 | 说明 |
|--------------|-----|----------|------|
| combat | `characterId` | CombatData | 战斗历史数据（按角色隔离） |

### CombatData 存储内容

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `characterId` | string | - | 角色唯一标识 |
| `combatHistory` | CombatLogEntry[] | [] | 战斗历史记录（最近10次） |
| `updatedAt` | number | Date.now() | 最后更新时间 |

### 多角色支持说明

战斗数据通过 `characterId` 字段实现角色隔离，每个角色拥有独立的战斗历史记录。切换角色时，系统自动加载对应角色的战斗数据。删除角色时，级联删除该角色的战斗数据。

### 战斗状态

| 状态 | 说明 |
|------|------|
| `idle` | 未在战斗中 |
| `preparing` | 战斗准备中 |
| `fighting` | 战斗中 |
| `ended` | 战斗已结束 |

### 战斗属性计算

#### 进攻类属性（影响伤害输出）

| 属性 | 来源 | 说明 |
|------|------|------|
| physicalAttack | 角色属性 + 装备 | 物理攻击基础值 |
| magicAttack | 角色属性 + 装备 | 魔法攻击基础值 |
| critChance | 角色属性 + 装备 | 暴击概率 (%) |

#### 防御类属性（影响受到的伤害）

| 属性 | 来源 | 说明 |
|------|------|------|
| physicalDefense | 角色属性 + 装备 | 物理防御基础值 |
| magicDefense | 角色属性 + 装备 | 魔法防御基础值 |
| dodgeChance | 角色属性 + 装备 | 闪避概率 (%) |

#### 伤害计算公式

| 阶段 | 公式 | 说明 |
|------|------|------|
| 基础伤害 | 进攻属性 + random(0-10) | 进攻属性决定伤害下限 |
| 暴击 | if(random < critChance) damage x 1.5 | 暴击时伤害提高50% |
| 闪避 | if(random < dodgeChance) damage = 0 | 闪避时完全躲避 |
| 防御减免 | damage - min(damage x 30%, defense) | 防御减免30%伤害 |
| 最终伤害 | max(1, 基础伤害 - 防御减免) | 最少造成1点伤害 |

### 同步机制

| 同步类型 | 触发条件 | 延迟 |
|----------|----------|------|
| 自动同步 | 战斗结束 | 500ms 防抖 |
| 立即同步 | 关键操作 | 即时 |
| 页面卸载 | beforeunload | 即时 |

---

## 与其他模块的交互关系

### 依赖关系

- **角色模块**：获取玩家战斗属性，修改生命值和经验值
- **背包模块**：使用消耗品，添加战利品
- **探索模块**：玩家死亡时触发死亡事件
- **事件总线**：发布战斗事件

### 交互模块

| 模块 | 交互方式 | 说明 |
|------|----------|------|
| 角色模块 | 调用 | 获取 `getAttributes()`, 修改 `addHp()`, `addExp()` |
| 背包模块 | 调用 | 调用 `useItem()` 使用消耗品，`addItem()` 添加战利品 |
| 探索模块 | 调用 | 触发 `EXPLORATION_PLAYER_DIED` 事件处理死亡 |
| 技能模块 | 事件订阅 | 技能效果影响战斗 |

### 事件发布

| 事件 | 订阅模块 | 处理动作 |
|------|----------|----------|
| `COMBAT_START` | UI组件 | 显示战斗界面 |
| `COMBAT_END` | UI组件 | 显示战斗结果 |
| `COMBAT_DAMAGE` | UI组件 | 显示伤害数字 |
| `COMBAT_HEAL` | UI组件 | 显示治疗数字 |
| `EXPLORATION_PLAYER_DIED` | 角色模块 | 处理死亡惩罚 |

---

## 异常处理机制

### 异常类型与处理策略

| 异常类型 | 触发条件 | 处理策略 |
|----------|----------|----------|
| 不在战斗中 | 未进入战斗状态时执行动作 | 忽略操作，返回错误 |
| 非玩家回合 | 玩家回合外执行动作 | 忽略操作，返回错误 |
| 敌人不存在 | 敌人数据为空 | 忽略操作，返回错误 |
| HP异常 | HP为负数 | 强制设置为0 |
| 战斗已结束 | 战斗结束后执行动作 | 忽略操作，返回错误 |
| 消耗品不存在 | 背包中没有该物品 | 返回错误消息 |
| 存储读取失败 | IndexedDB 解析错误 | 使用默认值初始化 |
| 存储写入失败 | IndexedDB 写入异常 | 进入重试队列，指数退避重试 3 次 |
| 技能不存在 | 技能ID无效 | 返回错误消息 |
| 魔法值不足 | MP < 技能消耗 | 返回错误消息 |

---

## 性能与安全考量

### 性能优化

| 优化点 | 实现方式 | 预期效果 |
|--------|----------|----------|
| 延迟执行 | 使用 setTimeout | 动画效果 |
| 战斗日志限制 | 只保留一次战斗日志 | 内存管理 |
| 防抖同步 | 500ms 延迟合并写入 | 减少 IO 操作 |
| 批量写入 | SyncEngine 批量处理 | 提升性能 |
| 异步加载 | Store 初始化时异步从 IndexedDB 读取 | 不阻塞主线程 |
| 技能效果缓存 | LRU缓存策略 | 减少重复计算 |

### 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 输入验证 | 检查敌人数据、物品是否存在 |
| 状态检查 | 操作前检查战斗状态和回合 |
| 异常捕获 | 防止程序崩溃 |
| 边界检查 | HP/MP不能超出范围 |
| 重试机制 | 失败时自动重试 3 次 |
| 数据校验 | 写入前验证数据结构 |

---

## 模块文件结构

```
src/modules/combat/
  - index.ts          # 核心实现（Store + Service）
  - types.ts          # 类型定义
  - combatLog.ts      # 战斗日志管理
```

### 文件职责说明

| 文件 | 职责 |
|------|------|
| `index.ts` | Pinia Store 实现、服务接口实现、战斗逻辑 |
| `types.ts` | TypeScript 类型定义、接口定义 |
| `combatLog.ts` | 战斗日志记录、存储、查询 |

---

## 版本历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-15 | 初始版本，包含基础战斗功能 | System |
| v1.1 | 2026-05-18 | 重构为回合制系统，添加玩家单动作限制 | System |
| v2.0 | 2026-05-19 | 迁移到 Pinia + IndexedDB 架构 | System |
| v2.1 | 2026-05-19 | 添加战斗日志数据结构 | System |
| v2.2 | 2026-05-20 | 移除buff、debuff及被动技能相关内容，简化技能效果类型 | System |

---

**文档结束**