# 业务流程梳理

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 业务流程梳理 |
| 版本 | v3.0 |
| 生成日期 | 2026年7月10日 |
| 所属目录 | `doc/project/` |
| 关联文档 | MODULE_FUNCTIONS.md、DEPENDENCY_GRAPH.md、各模块设计文档 |
| 更新说明 | 1. 角色创建流程修正为通过 characterLifecycleService.initializeCharacterSkills 收口技能初始化（CHR-4 修复）；2. 角色删除流程修正为通过 characterLifecycleService.cascadeDeleteCharacter 并行删除 6 个模块数据；3. 战斗流程补充 combatContext.ts 的 ICombatContext 上下文注入说明；4. 探索流程补充 events.ts 注册表模式（effectHandlers + cellEventHandlers）；5. 游戏初始化流程修正为正确顺序（log → inventory → equipment → skill → map → exploration → quest）并补充 inventory 回调注入与 dispose 清理 combat/exploration/audio 三个 Store；6. 天赋点分配流程修正为 3 系 3 层结构（tier2 需 3 点、tier3 需 6 点、单天赋最多 5 点、每 2 级获 1 点） |

---

## 概述

本文档梳理项目 `wow_dnd` 的核心业务流程，覆盖角色生命周期、战斗、探索、任务、商店交易、成长系统、数据备份恢复、游戏初始化、天赋点分配、德鲁伊变形与术士召唤十一大领域。每个流程均以 Mermaid 图表呈现，并附关键实现位置说明，便于开发与缺陷定位。

模块统一遵循分层架构：`service.ts`（纯函数层）→ `store.ts`（编排层，负责状态/持久化/事件）→ `db.ts`（持久层）。下文流程图中出现的"Store Action"均指编排层入口。跨模块的级联操作通过 `src/services/` 聚合层（CharacterLifecycleService / GameBootstrap / CrossModuleQuery 等）收口。

---

## 一、角色生命周期流程

### 1.1 角色创建流程

角色创建由 `characterStore.createCharacter` 编排，依次完成基础数据获取、纯函数计算、技能初始化与多表持久化。技能初始化通过 `characterLifecycleService.initializeCharacterSkills` 收口跨模块持久化（CHR-4 修复），character Store 不再直接依赖 skillDbService。

```mermaid
flowchart TD
    A[用户提交创建表单] --> B[generateCharacterId 生成唯一ID]
    B --> C[从 baseStore 读取种族/职业数据]
    C --> D[createInitialCharacter 纯函数计算]
    D --> D1[基础属性 = 10 + 种族加成 + 职业加成<br/>clamp 到 1, MAX_STAT]
    D1 --> D2[计算 maxHp / maxMana / 初始金币 50]
    D2 --> E[更新 Store 状态]
    E --> F[characterLifecycleService.initializeCharacterSkills<br/>收口技能初始化 CHR-4]
    F --> F1[查询 unlockLevel 小于等于 1 的职业技能]
    F1 --> F2[填充 4 格技能栏]
    F2 --> F3[skillsDbService.saveSkillsData 持久化技能数据]
    F3 --> G[多表持久化]
    G --> G1[saveCharacterListItem 角色列表项]
    G --> G1a[saveCharacterData 角色详情]
    G1a --> H[发射 CHARACTER_CREATED 事件]
    H --> I[loadCharacterList 刷新列表]
    I --> J[创建完成]

    classDef pure fill:#e3f2fd,stroke:#1976d2
    classDef persist fill:#fff3e0,stroke:#f57c00
    classDef svc fill:#f8bbd0,stroke:#ad1457
    class D,D1,D2 pure
    class F,F1,F2,F3 svc
    class G,G1,G1a persist
```

**关键实现**：`src/modules/character/store.ts` 的 `createCharacter`、`src/modules/character/service.ts` 的 `createInitialCharacter` 与 `computeInitialStats`、`src/services/CharacterLifecycleService.ts` 的 `initializeCharacterSkills`。

### 1.2 角色选择流程

```mermaid
flowchart TD
    A[用户在列表选择角色] --> B[getCharacterListItem 读取列表项]
    B --> C[getCharacterData 读取详情]
    C --> D{数据是否完整}
    D -- 否 --> E[返回 false 失败]
    D -- 是 --> F[更新 lastPlayedTime 并持久化]
    F --> G[fromStorageFormat 还原角色对象]
    G --> H[更新 Store 状态与 bonusStats]
    H --> I[还原种族/职业加成缓存]
    I --> J[saveGameState 持久化当前角色ID]
    J --> K{是否需要发事件}
    K -- 是 --> L[发射 CHARACTER_LOGOUT 清理旧角色 UI]
    K -- 否 --> M[静默加载 initialize 调用]
    L --> N[进入游戏]
    M --> N

    classDef io fill:#fff3e0,stroke:#f57c00
    class B,C,F,G,J io
```

**关键实现**：`src/modules/character/store.ts` 的 `selectCharacter`，`emitEvent` 参数控制是否触发 UI 事件（`initialize` 静默调用时传 `false`）。

### 1.3 角色死亡复活流程

死亡复活由 `characterStore.takeDamage` 触发，经 `handleDeath` 完成经验清零与事件通知后，自动调用 `resurrect` 恢复至 50% 生命/法力。

```mermaid
flowchart TD
    A[受到伤害 takeDamage] --> B[applyHpChange 扣减 HP]
    B --> C[持久化角色数据]
    C --> D{isDead HP 小于等于 0}
    D -- 否 --> E[流程结束]
    D -- 是 --> F[handleDeath 处理死亡]
    F --> G[损失本级经验 exp 置 0]
    G --> H[发射 CHARACTER_DEATH 事件]
    H --> I[持久化死亡状态]
    I --> J[自动调用 resurrect]
    J --> K[computeResurrection 计算]
    K --> K1[exp 保持为 0]
    K1 --> K2[HP 恢复至 maxHp 的 50% 向下取整]
    K2 --> K3[MP 恢复至 maxMana 的 50% 向下取整]
    K3 --> L[发射 CHARACTER_RESURRECTED 事件]
    L --> M[持久化复活状态]
    M --> N[复活完成]

    classDef death fill:#ffebee,stroke:#c62828
    classDef revive fill:#e8f5e9,stroke:#2e7d32
    class F,G,H,I death
    class J,K,K1,K2,K3,L,M revive
```

**关键实现**：`src/modules/character/store.ts` 的 `handleDeath` 与 `resurrect`，`src/modules/character/service.ts` 的 `computeResurrection`。

### 1.4 角色删除流程

删除操作通过 `characterLifecycleService.cascadeDeleteCharacter` 并行删除 6 个模块的关联数据，确保所有关联数据一并移除，避免孤儿数据残留（CHR-4 修复）。character Store 不再直接 import 6 个模块的 DbService。

```mermaid
flowchart TD
    A[用户确认删除角色] --> B[getCharacterListItem 校验存在]
    B --> C{列表项是否存在}
    C -- 否 --> D[返回 false]
    C -- 是 --> E[characterLifecycleService.cascadeDeleteCharacter<br/>并行删除 6 个模块数据 CHR-4]
    E --> E1[Promise.all 并行执行]
    E1 --> E1a[deleteSkillsData 技能]
    E1 --> E1b[deleteInventory 背包]
    E1 --> E1c[deleteEquipment 装备]
    E1 --> E1d[deleteExplorationData 探索]
    E1 --> E1e[deleteAdventureLog 冒险日志]
    E1 --> E1f[deleteCharacterQuests 任务]
    E1a --> F[deleteCharacterData 角色详情]
    E1b --> F
    E1c --> F
    E1d --> F
    E1e --> F
    E1f --> F
    F --> G{是否为当前选中角色}
    G -- 是 --> H[清空 Store 状态]
    H --> H1[currentCharacterId 置 null]
    H1 --> H2[character 置 null]
    H2 --> H3[清空 bonusStats / raceBonus / classBonus]
    H3 --> H4[saveGameState null]
    H4 --> I[发射 CHARACTER_DELETED 事件]
    G -- 否 --> I
    I --> J[loadCharacterList 刷新列表]
    J --> K[删除完成]

    classDef cascade fill:#fff3e0,stroke:#f57c00
    classDef svc fill:#f8bbd0,stroke:#ad1457
    class E,E1,E1a,E1b,E1c,E1d,E1e,E1f svc
    class F cascade
```

**关键实现**：`src/modules/character/store.ts` 的 `deleteCharacter`、`src/services/CharacterLifecycleService.ts` 的 `cascadeDeleteCharacter`（使用 `Promise.all` 并行删除 6 个模块数据）。

---

## 二、战斗全流程

战斗流程由 `combatStore` 编排，拆分至 `useInitiative`、`usePlayerAction`、`useEnemyAction`、`useBossMechanics` 等 Composable。战斗上下文（`combatContext.ts`）将 combat 对 character/skill/quest/log/enemy/inventory 六个外部 Store 的依赖收口为 `ICombatContext` 接口（拆分为只读 `ICombatQuery` 与写入 `ICombatCommand`），combat 内部所有 composable 仅依赖此接口，不再直接 import 具体 Store。采用速度制先攻：玩家与所有敌人按速度降序交替行动。战斗关键节点接入资源系统钩子（`onAttack`/`onDamaged`/`onKill`/`onTurnStart`）与被动技能触发，德鲁伊变形与术士召唤作为可选子系统参与战斗。

```mermaid
sequenceDiagram
    autonumber
    participant UI as 战斗 UI
    participant CS as CombatStore
    participant Ctx as createCombatContext
    participant Init as useInitiative
    participant Player as usePlayerAction
    participant Enemy as useEnemyAction
    participant Char as CharacterStore
    participant Quest as QuestStore
    participant RS as resourceSystems
    participant PS as usePassiveSkills

    Note over UI,CS: 阶段一 触发战斗
    UI->>CS: startCombat(enemiesData)
    CS->>Ctx: createCombatContext 聚合 6 个外部 Store
    CS->>CS: 生成 combatId 初始化状态
    CS->>CS: initBossFeatures 装载 Boss 机制（setInitiativeCallback 注入先攻回调）
    CS->>Init: assignEnemyPositions 分配 3x2 阵位
    CS->>Init: buildInitiativeOrder 按速度降序排序
    CS->>RS: ResourceSystemFactory.create(classId) + reset()
    CS->>PS: loadPassives() + onCombatStart()
    CS->>CS: 发射 COMBAT_START 事件
    CS->>UI: COMBAT_PLAYER_TURN 通知玩家回合

    Note over UI,Player: 阶段二 玩家回合循环
    Note over RS,PS: 玩家回合开始时已触发 sys.onTurnStart + passive.onTurnStart（含 on_low_hp 检查）
    loop 玩家回合
        UI->>CS: playerAction(action)
        CS->>CS: 检查控制效果 getDisabledActions
        alt 被眩晕/沉默
            CS->>Init: endPlayerTurn 跳过回合
        else 可行动
            alt 普通攻击
                CS->>Player: playerAttack
                Player->>Player: 闪避判定 rollDodge
                Player->>Player: 伤害管线 processDamagePipeline
                Player->>Player: 暴击判定 rollCritical
                Player->>Ctx: character.takeDamage 荆棘反伤
                Player->>Ctx: enemy.takeDamage 敌人扣血
                Note over CS,RS: 攻击命中（非闪避）后触发钩子
                CS->>RS: sys.onAttack?.()（怒气/连击点生成）
                CS->>PS: passive.onAttack(damage)（吸血/腐蚀等）
            else 使用技能
                CS->>Player: playerSkill
                CS->>CS: canCastSkill 检查专属资源
                Player->>Player: castSkill 校验 MP/冷却
                CS->>CS: consumeSkillResource 消耗专属资源
                Player->>Player: 单体/AOE 伤害管线
                Player->>Player: 施加 buff/debuff 效果
                Note over CS,RS: 技能施放成功后触发钩子
                CS->>RS: sys.onAttack?.()（技能也算攻击行为）
                CS->>PS: passive.onAttack(damage)
            else 使用物品
                CS->>Player: playerUseItem
                Player->>Player: 伤害型物品走管线
                Player->>Player: 恢复型物品应用效果
            else 逃跑
                CS->>Player: playerFlee
                Player->>Player: Boss 战禁止逃跑
                Player->>Player: rollFleeSuccess 判定
            end
            alt 全部敌人死亡
                Note over CS,RS: 击杀钩子（在 endCombat victory 内）
                CS->>RS: sys.onKill?.()（灵魂碎片/怒气获取）
                CS->>PS: passive.onKill()（灵魂虹吸等）
                CS->>CS: endCombat victory
            else 玩家死亡
                CS->>CS: endCombat defeat
            else 逃跑成功
                CS->>CS: endCombat fled
            else 继续战斗
                CS->>Init: endPlayerTurn
            end
        end
    end

    Note over Init,Enemy: 阶段三 敌人回合循环
    loop 敌人回合
        Init->>Init: advanceToNextUnit 推进先攻
        alt 新一轮开始
            Init->>Init: tickAllEffects 统一执行持续效果
            Init->>Ctx: character.takeDamage 持续伤害
            alt 玩家死亡
                Init->>CS: endCombat defeat
            end
        end
        Init->>Enemy: singleEnemyTurn(enemyId)
        Enemy->>Enemy: Boss 阶段转换判定
        Enemy->>Enemy: 敌人技能冷却推进
        Enemy->>Enemy: AI 策略决策 decideAction
        alt 普通攻击
            Enemy->>Enemy: enemyBasicAttack
            Enemy->>Player: 闪避判定 + 伤害管线
            Enemy->>Ctx: character.takeDamage 对玩家造成伤害
            Note over Enemy,RS: 玩家受伤后触发钩子（applyEnemyDamageToPlayer）
            Enemy->>RS: sys.onDamaged?.(amount)（怒气获取）
            Enemy->>PS: passive.onDamaged(amount)（复仇类 + on_low_hp 检查）
        else 技能攻击
            Enemy->>Enemy: enemyAttackWithSkill
            Enemy->>Ctx: character.takeDamage
            Enemy->>RS: sys.onDamaged?.(amount)
            Enemy->>PS: passive.onDamaged(amount)
        else 治疗/增益/减益
            Enemy->>Enemy: useSkill
        end
        alt 玩家死亡
            Enemy->>CS: endCombat defeat
        else 继续战斗
            Enemy->>Init: advanceToNextUnit
        end
    end

    Note over CS,Quest: 阶段四 战斗结算
    alt 胜利
        CS->>Ctx: character.gainExp 累加经验
        CS->>Ctx: character.gainGold 累加金币
        CS->>Player: handleLoot Boss 掉落处理
        CS->>Ctx: quest.onEnemyKilled 更新击杀任务进度
        CS->>CS: 记录冒险日志（adventureLogs 摘要）
    else 失败
        CS->>Ctx: character.handleDeath 触发死亡复活流程
    else 逃跑
        CS->>CS: 仅记录日志
    end
    CS->>CS: 清空效果容器
    CS->>UI: COMBAT_END 通知 UI
    CS->>CS: saveLogs 持久化 combatLogs（详细回合数据）
```

**资源系统与被动技能触发点汇总**：

| 触发时机 | 资源系统钩子 | 被动技能触发 | 实现位置 |
|----------|-------------|-------------|----------|
| `startCombat` | `ResourceSystemFactory.create` + `reset` | `loadPassives` + `onCombatStart` | `combat/store.ts` |
| 玩家回合开始 | `sys.onTurnStart` | `passive.onTurnStart`（含 `on_low_hp`） | `useInitiative.advanceToNextUnit` |
| 玩家攻击/技能命中 | `sys.onAttack` | `passive.onAttack(damage)` | `combat/store.ts` playerAction |
| 玩家受伤 | `sys.onDamaged(amount)` | `passive.onDamaged(amount)`（含 `on_low_hp`） | `useEnemyAction.applyEnemyDamageToPlayer` |
| 战斗胜利 | `sys.onKill` | `passive.onKill` | `combat/store.ts` endCombat |

**关键实现**：
- 上下文工厂：`src/modules/combat/combatContext.ts` 的 `createCombatContext`（聚合 6 个外部 Store 为 `ICombatContext`，拆分 `ICombatQuery` 只读 + `ICombatCommand` 写入）
- 编排入口：`src/modules/combat/store.ts` 的 `startCombat`、`playerAction`、`endCombat`
- 先攻调度：`src/modules/combat/composables/useInitiative.ts`（`buildInitiativeOrder` 按速度降序，`advanceToNextUnit` 推进并触发 `onTurnStart` 钩子，`tickAllEffects` 在新一轮开始时统一结算）
- 玩家行动：`src/modules/combat/composables/usePlayerAction.ts`（攻击/技能/物品/逃跑四类分支）
- 敌人 AI：`src/modules/combat/composables/useEnemyAction.ts`（策略模式 `AggressiveStrategy` / `DefensiveStrategy` / `BalancedStrategy` / `BossPhaseStrategy`，受伤时触发 `onDamaged` 钩子）
- 资源系统：`src/modules/combat/resources/`（`ResourceSystemFactory` 工厂 + 各职业资源系统实现，钩子接口定义于 `types.ts`）
- 被动技能：`src/modules/combat/composables/usePassiveSkills.ts`（数据源 `src/data/config_class_passives.ts`，按 `trigger` 过滤执行）
- Boss 机制：`src/modules/combat/composables/useBossMechanics.ts`（`IBossContext` 接口注入：`getPlayerName`/`createMinion`/`rebuildInitiativeOrder`，`setInitiativeCallback` 注入先攻回调）

---

## 三、探索全流程

探索流程由 `explorationStore` 编排，区域进入时生成 10×10 网格并放置固定事件，玩家翻格子触发对应分支处理。区域进入阶段对地点/物品/任务/商店的查询统一经 `crossModuleQuery` 收口，物品模板命中 `itemTemplateCache` 内存缓存。格子事件处理通过 `events.ts` 注册表模式分发（ARCH-11 修复），将事件类型与处理函数的映射关系从 store.ts 中解耦。

```mermaid
flowchart TD
    A[用户选择地点] --> B[enterArea 进入区域]
    B --> C[loadAreaConfig 加载区域配置]
    C --> C1[crossModuleQuery.getLocationData<br/>读取 config_locations 地点数据]
    C1 --> C2[computeEventProbability 按等级生成概率]
    C2 --> C3[buildItemPool 筛选物品池<br/>crossModuleQuery.getAllItemTemplates 命中 ItemTemplateCache]
    C3 --> C4[读取怪物池与 Boss 池]
    C4 --> D[pickRandomShop 随机选商店<br/>crossModuleQuery.getAllShopConfigs]
    D --> E[getQuestRequiredMonsters 获取任务怪物<br/>crossModuleQuery.getQuestDefinitionsByBoard]
    E --> F[过滤掉 Boss 怪物]
    F --> G[generateGrid 生成 10x10 网格]
    G --> G1[placeFixedEvents 放置固定事件]
    G1 --> G1a[起点 随机边缘]
    G1a --> G1b[商店 + 任务板 两个角落]
    G1b --> G1c[营地 非相邻位置]
    G1c --> G1d[Boss 中心区域]
    G1d --> G2[优先放置任务怪物]
    G2 --> G3[剩余空格按概率随机填充]
    G3 --> H[findStartPosition 找到起点]
    H --> I[updateAccessibleCells 更新可访问状态]
    I --> J[persistState 持久化]
    J --> K[发射 EXPLORATION_START 与 ZONE_ENTERED]
    K --> L[记录冒险日志]
    L --> M[探索进行中]

    M --> N[用户点击格子 revealGrid]
    N --> O{格子类型判断}
    O -- 怪物/Boss --> P1[triggerBattle 触发战斗<br/>store.ts 专用路径]
    P1 --> P1a[记录 pendingBattleCell]
    P1a --> P1b[等待 COMBAT_END 事件]
    P1b --> P1c{战斗结果}
    P1c -- 胜利 --> P1d[标记格子 completed]
    P1c -- 胜利且为 Boss --> P1e[bossDefeated 置 true]
    P1c -- 失败/逃跑 --> P1f[保留 monsterId 可再挑战]
    P1d --> P1g[updateAccessibleCells]
    P1e --> P1g
    P1f --> P1g
    P1g --> P1h[checkCompletion 完成检查]

    O -- 商店/任务板 --> P2[标记 visited<br/>store.ts 专用路径]
    P2 --> P2a[发射 EXPLORATION_CELL_EXPLORED]
    P2a --> P2b[UI 回调打开对应面板]
    P2b --> P1h

    O -- 宝箱/陷阱/事件/营地 --> P3[dispatchCellEvent 注册表分发<br/>events.ts ARCH-11]
    P3 --> P3a{cellEventHandlers 查找处理器}
    P3a -- treasure --> P3b[generateItemForCell 随机物品<br/>addItem 加入背包<br/>兜底 物品不存在或背包满转金币经验]
    P3a -- trap --> P3c[generateTrapDamage 计算伤害<br/>takeDamage 扣减 HP]
    P3a -- event --> P3d[generateMultiOptionEvent 或 generateRandomEvent<br/>applyEventEffect 分发到 effectHandlers]
    P3a -- rest --> P3e[generateCampHeal 完全恢复<br/>receiveHeal + changeMp<br/>campUsed 置 true]
    P3b --> P3f[标记 completed]
    P3c --> P3f
    P3d --> P3f
    P3e --> P3f
    P3f --> P1h

    P1h --> Q{探索是否完成}
    Q -- 击败 Boss 或 全部格子已访问 --> R[explorationComplete 置 true]
    Q -- 否 --> M
    R --> S[探索完成]

    classDef battle fill:#ffebee,stroke:#c62828
    classDef shop fill:#e3f2fd,stroke:#1976d2
    classDef instant fill:#fff3e0,stroke:#f57c00
    classDef evt fill:#f8bbd0,stroke:#ad1457
    class P1,P1a,P1b,P1c,P1d,P1e,P1f,P1g,P1h battle
    class P2,P2a,P2b shop
    class P3,P3a,P3b,P3c,P3d,P3e,P3f evt
```

**关键实现**：
- 编排入口：`src/modules/exploration/store.ts` 的 `enterArea`、`revealGrid`、`onBattleResult`
- 网格生成：`src/modules/exploration/service.ts` 的 `generateGrid`（固定事件放置策略：起点边缘、商店/任务板角落、营地非相邻、Boss 中心区域）
- 事件注册表：`src/modules/exploration/events.ts`（两层注册表：`effectHandlers` 处理 6 种效果类型 heal/mana/exp/damage/mpLoss/gold，`cellEventHandlers` 处理 4 种格子类型 treasure/trap/event/rest；`dispatchCellEvent` 与 `applyEventEffect` 分发函数）
- 战斗结果回写：通过 `eventBus.on(COMBAT_END)` 监听，调用 `onBattleResult` 处理格子状态

---

## 四、任务全流程

任务流程由 `questStore` 编排，奖励在完成时自动发放，`claimReward` 仅做状态转换。

```mermaid
flowchart TD
    A[用户在任务板选择任务] --> B[acceptQuest 接受任务]
    B --> C[canAcceptQuest 校验]
    C --> C1{等级是否满足}
    C1 -- 否 --> X1[返回 false]
    C1 -- 是 --> C2{是否存在活跃实例}
    C2 -- 是且非 abandoned --> X1
    C2 -- 否或已放弃 --> D[generateQuestInstance 生成实例]
    D --> D1[status = in_progress]
    D1 --> D2[所有 progress.current 初始化为 0]
    D2 --> E[更新 Store Map 状态]
    E --> F[_persistInstance 持久化到 char_quests]
    F --> G[发射 QUEST_ACCEPTED 事件]
    G --> H[记录冒险日志]
    H --> I[接受完成]

    I --> J{等待外部事件触发}
    J -- 战斗击杀敌人 --> K1[onEnemyKilled]
    J -- 收集物品 --> K2[onItemCollected]
    K1 --> L[_processQuestProgress 公共处理]
    K2 --> L
    L --> M[checkQuestProgress 纯函数计算]
    M --> M1{是否有匹配目标}
    M1 -- 否 --> J
    M1 -- 是 --> M2[累加进度 clamp 到 target]
    M2 --> M3{所有目标是否完成}
    M3 -- 否 --> M4[仅更新进度并持久化]
    M4 --> J
    M3 -- 是 --> N[_handleQuestCompletion 完成处理]
    N --> N1[status = completed 记录 completedAt]
    N1 --> N2[_grantQuestRewards 发放奖励]
    N2 --> N2a[gainExp 经验]
    N2a --> N2b[gainGold 金币]
    N2b --> N2c[addItem 物品奖励]
    N2c --> N3[_updateAndPersistInstance 持久化]
    N3 --> N4[发射 QUEST_COMPLETED 事件]
    N4 --> N5[记录冒险日志]
    N5 --> O[完成态等待提交]

    O --> P[用户点击领取奖励 claimReward]
    P --> Q{status 是否为 completed}
    Q -- 否 --> X2[返回 false]
    Q -- 是 --> R[status = turned_in 终态]
    R --> S[_updateAndPersistInstance 持久化]
    S --> T[发射 QUEST_REWARDED 事件]
    T --> U[记录奖励详情日志]
    U --> V[提交完成]

    classDef accept fill:#e3f2fd,stroke:#1976d2
    classDef progress fill:#fff3e0,stroke:#f57c00
    classDef complete fill:#e8f5e9,stroke:#2e7d32
    classDef claim fill:#f3e5f5,stroke:#7b1fa2
    class B,C,C1,C2,D,D1,D2,E,F,G,H accept
    class K1,K2,L,M,M1,M2,M3,M4 progress
    class N,N1,N2,N2a,N2b,N2c,N3,N4,N5 complete
    class P,Q,R,S,T,U,V claim
```

**关键实现**：
- 编排入口：`src/modules/quest/store.ts` 的 `acceptQuest`、`onEnemyKilled`、`onItemCollected`、`completeQuest`、`claimReward`
- 进度计算：`src/modules/quest/service.ts` 的 `checkQuestProgress`（按 `enemyId` 或 `itemId` 匹配目标，累加并 `Math.min` 限幅）
- UI 文本工具：`src/modules/quest/objective_utils.ts`（任务目标 UI 文本生成）
- 设计要点：奖励在 `_handleQuestCompletion` 中通过 `_grantQuestRewards` 自动发放，`claimReward` 仅做 `completed → turned_in` 状态转换，避免重复发奖

---

## 五、商店交易流程

商店流程由 `shopStore` 编排，支持商品按需生成、定期刷新、买卖差价（出售价为购买价 50%）与回购追踪。

```mermaid
flowchart TD
    A[用户点击商店格子] --> B[openShop 打开商店]
    B --> C{shops 配置是否已加载}
    C -- 否 --> C1[loadShopConfigs 加载配置]
    C1 --> C2{DB 是否有数据}
    C2 -- 否 --> C3[使用 SHOPS 种子数据并回写]
    C2 -- 是 --> D
    C -- 是 --> D[查找商店配置]
    D --> E[loadOrGenerateItems 加载商品]
    E --> E1{DB 是否有已保存商品}
    E1 -- 是 --> E2[返回已保存商品]
    E1 -- 否 --> E3[regenerateItems 重新生成]
    E3 --> E3a[generateShopItems 按类型筛选 6-12 件]
    E3a --> E3b[calculatePrice 计算购买价]
    E3b --> E3c[随机 1-5 库存]
    E3c --> E3d[saveShopItems 持久化]
    E3d --> E2
    E2 --> F{是否需要刷新}
    F -- 超过 refreshInterval --> E3
    F -- 否 --> G[saveCurrentShopId 持久化当前商店]
    G --> H[mergeItems 合并商品列表]
    H --> H1[回购物品排在最前]
    H1 --> H2[排除回购列表中已有的生成商品]
    H2 --> H3[过滤库存为 0 的商品]
    H3 --> I[发射 SHOP_OPENED 事件]
    I --> J[商店界面就绪]

    J --> K{用户操作}
    K -- 购买 --> L[buyItem]
    L --> L1[查找商品 currentItems]
    L1 --> L2[校验库存是否足够]
    L2 --> L3[canAffordItem 校验金币]
    L3 --> L4[spendGold 扣除金币]
    L4 --> L5[addItem 加入背包]
    L5 --> L6{背包是否添加成功}
    L6 -- 否 --> L7[gainGold 返还金币]
    L7 --> L8[返回 false]
    L6 -- 是 --> L8a{物品来源}
    L8a -- 回购列表 --> L8b[扣减回购数量]
    L8a -- 生成商品 --> L8c[扣减 DB 商品库存]
    L8b --> L9[mergeItems 刷新列表]
    L8c --> L9
    L9 --> L10[发射 SHOP_TRANSACTION 事件]
    L10 --> L11[记录购买日志]
    L11 --> J

    K -- 出售 --> M[sellItem]
    M --> M1[getItemInfo 获取物品模板]
    M1 --> M2[computeSellPrice 计算售价 标准价 x 0.5]
    M2 --> M3[removeItem 从背包移除]
    M3 --> M4{移除是否成功}
    M4 -- 否 --> M5[返回 false]
    M4 -- 是 --> M6[gainGold 增加金币]
    M6 --> M7[加入回购列表 soldItems]
    M7 --> M7a{回购列表已有该物品}
    M7a -- 是 --> M7b[合并数量]
    M7a -- 否 --> M7c[新建条目]
    M7b --> M8[mergeItems 刷新列表]
    M7c --> M8
    M8 --> M9[发射 SHOP_TRANSACTION 事件]
    M9 --> M10[记录出售日志]
    M10 --> J

    K -- 关闭 --> N[closeShop]
    N --> N1[saveCurrentShopId null]
    N1 --> N2[清空内存状态]
    N2 --> N3[发射 SHOP_CLOSED 事件]

    classDef open fill:#e3f2fd,stroke:#1976d2
    classDef buy fill:#fff3e0,stroke:#f57c00
    classDef sell fill:#e8f5e9,stroke:#2e7d32
    class B,C,C1,C2,C3,D,E,E1,E2,E3,E3a,E3b,E3c,E3d,F,G,H,H1,H2,H3,I open
    class L,L1,L2,L3,L4,L5,L6,L7,L8,L8a,L8b,L8c,L9,L10,L11 buy
    class M,M1,M2,M3,M4,M5,M6,M7,M7a,M7b,M7c,M8,M9,M10 sell
```

**回购机制说明**：
- `soldItems` 采用二级 Map 结构：`shopId → itemId → SoldItemEntry`，每个商店独立维护回购列表
- 出售时同物品多次出售会合并数量，购买时从回购列表优先扣减
- `mergeItems` 合并时回购物品排在列表最前，且生成商品中排除已在回购列表的物品，避免重复展示
- 回购物品以出售价（标准价 × 0.5）上架，玩家可原价买回

**关键实现**：
- 编排入口：`src/modules/shop/store.ts` 的 `openShop`、`buyItem`、`sellItem`、`closeShop`、`refreshShop`
- 价格计算：`src/modules/shop/service.ts` 的 `calculatePrice`（稀有度倍率：普通 1× / 优秀 2× / 稀有 5× / 史诗 10× / 传说 20×，出售价为购买价 50%）

---

## 六、成长系统流程

成长系统涵盖经验升级与属性加成两条主线，由 `characterStore` 编排，核心计算委托给 `service.ts` 纯函数。

### 6.1 经验值与升级流程

```mermaid
flowchart TD
    A[外部调用 gainExp] --> B[applyExpGain 纯函数计算]
    B --> C[累加经验值 newExp = exp + amount]
    C --> D{newExp 是否达到升级阈值<br/>且等级小于 MAX_LEVEL=20}
    D -- 否 --> E[更新 exp 字段]
    D -- 是 --> F[进入逐级升级循环]
    F --> F1[扣除本级所需经验]
    F1 --> F2[newLevel + 1]
    F2 --> F3[applyLevelUp 单级升级]
    F3 --> F3a[六大属性各 +1 clamp 到 MAX_STAT]
    F3a --> F3b[重算 maxHp / maxMana]
    F3b --> F3c[hp / mana 回满至上限]
    F3c --> F3d[更新 expToNextLevel 为下一级]
    F3d --> F4{是否仍可继续升级}
    F4 -- 是 --> F1
    F4 -- 否 --> G{是否达到 MAX_LEVEL}
    G -- 是 --> H[exp 清零不再累积]
    G -- 否 --> E
    H --> E
    E --> I[更新 Store 状态]
    I --> J[persistCharacter 持久化]
    J --> K{是否发生升级}
    K -- 是 --> L[发射 CHARACTER_LEVEL_UP 事件]
    K -- 否 --> M[流程结束]
    L --> M

    classDef loop fill:#fff3e0,stroke:#f57c00
    class F,F1,F2,F3,F3a,F3b,F3c,F3d,F4 loop
```

### 6.2 属性加成与衍生属性计算

```mermaid
flowchart TD
    A[角色基础属性 baseStats] --> B[基础值固定为 10]
    B --> C[叠加种族加成 raceBonus]
    C --> D[叠加职业加成 classBonus]
    D --> E[clampStat 限制到 1, MAX_STAT=999]
    E --> F[得到 baseStats]

    F --> G[外部加成 bonusStats]
    G --> G1[装备 buff 等]
    G1 --> G2[applyBonus 累加 isAdd=true]
    G2 --> G3[removeBonus 扣减 isAdd=false]
    G3 --> G4[computeBonusChange 计算]
    G4 --> H[得到 bonusStats]

    F --> I[computeEffectiveStats]
    G --> I
    I --> I1[baseStats + bonusStats]
    I1 --> I2[clampStat 限制到 1, MAX_STAT]
    I2 --> J[得到 effectiveStats 有效属性]

    J --> K[computeAttributes 衍生属性计算]
    K --> K1[calculateMaxHp 基于体质]
    K --> K1a[calculateMaxMana 基于智力]
    K1a --> K2[calculatePhysicalAttack 基于力量]
    K2 --> K3[calculatePhysicalDefense 基于体质/敏捷]
    K3 --> K4[calculateMagicAttack 基于智力]
    K4 --> K5[calculateMagicDefense 基于感知/智力]
    K5 --> K6[calculateCritChance 基于敏捷]
    K6 --> K7[calculateDodgeChance 基于敏捷]
    K7 --> K8[calculateHpBonus / MpBonus / HealBonus]
    K8 --> L[得到 Attributes 衍生属性]

    L --> M{是否影响 HP/MP 上限}
    M -- 体质/智力/感知/魅力变化 --> N[recalculateHpMp 重算上限]
    N --> N1[hp = min 当前 hp, 新 maxHp]
    N1 --> N2[mana = min 当前 mana, 新 maxMana]
    N2 --> O[persistCharacter 持久化]
    M -- 力量/敏捷变化 --> O

    classDef base fill:#e3f2fd,stroke:#1976d2
    classDef bonus fill:#fff3e0,stroke:#f57c00
    classDef derived fill:#e8f5e9,stroke:#2e7d32
    class A,B,C,D,E,F base
    class G,G1,G2,G3,G4,H bonus
    class I,I1,I2,J,K,K1,K1a,K2,K3,K4,K5,K6,K7,K8,L derived
```

**关键实现**：
- 升级循环：`src/modules/character/service.ts` 的 `applyExpGain`（逐级消耗经验，连升多级时全属性叠加）、`applyLevelUp`（每级六大属性各 +1，HP/MP 重算回满）
- 属性加成：`computeEffectiveStats`（base + bonus）、`computeAttributes`（衍生属性）、`recalculateHpMp`（上限变化时修正当前值）
- 上限常量：`MAX_LEVEL = 20`、`MAX_STAT = 999`（见 `src/config/character.ts`）

---

## 七、数据备份恢复流程

数据备份恢复由 `data` 模块的 `BackupService` 与 `ImportService` 提供，`characterStore` 仅作薄委托。手动备份导出 JSON 文件，自动备份存入 localStorage（保留 5 份），导入时执行多重校验。

```mermaid
flowchart TD
    subgraph 手动备份
        A1[用户点击导出存档] --> B1[exportBackup]
        B1 --> C1[createBackup 构建备份对象]
        C1 --> C1a[collectAllData 收集全量数据]
        C1a --> C1a1[角色表 char_data/inventory/quests 等]
        C1a1 --> C1a2[运行时表 combatLogs/adventureLogs/gameState]
        C1a2 --> C1a3[配置表 factions/races/classes/items 等]
        C1a3 --> C1b[calculateChecksum 计算校验和]
        C1b --> C1c[组装 BackupFile 含 version/timestamp/checksum]
        C1c --> D1[序列化为 JSON Blob]
        D1 --> D1a[创建下载链接 a.download]
        D1a --> E1[触发浏览器下载]
        E1 --> F1[文件保存完成]
    end

    subgraph 自动备份
        A2[触发自动备份 createAutoBackup] --> B2[createBackup 构建备份对象]
        B2 --> C2[getAutoBackups 读取现有列表]
        C2 --> C2a[从 localStorage 读取 wow_dnd_auto_backups]
        C2a --> D2[新备份 unshift 插入列表头部]
        D2 --> E2{数量是否超过 5}
        E2 -- 是 --> F2[pop 移除最旧备份]
        E2 -- 否 --> G2[JSON.stringify 序列化]
        F2 --> G2
        G2 --> H2[localStorage.setItem 写回]
        H2 --> I2[自动备份完成]
    end

    subgraph 导入恢复
        A3[用户选择备份文件] --> B3[importBackup]
        B3 --> C3[validateBackup 校验]
        C3 --> C3a[FileReader 读取文件]
        C3a --> C3b[JSON.parse 解析]
        C3b --> C3c{格式校验<br/>是否包含 version 字段}
        C3c -- 否 --> X3[返回 备份文件格式错误]
        C3c -- 是 --> C3d[calculateChecksum 重算校验和]
        C3d --> C3e{checksum 校验<br/>是否与文件中一致}
        C3e -- 否 --> X3a[返回 备份文件已损坏]
        C3e -- 是 --> C3f[checkVersionCompatibility 版本校验]
        C3f --> C3g{版本是否在 supportedVersions 中}
        C3g -- 否 --> X3b[返回 版本过旧请更新游戏]
        C3g -- 是 --> C3h[校验通过返回成功]
        C3h --> D3[importData 导入数据]
        D3 --> D3a[开启 db.transaction 事务]
        D3a --> D3b[逐表 bulkPut 写入]
        D3b --> D3b1[char_data 角色详情]
        D3b1 --> D3b2[char_inventory 背包]
        D3b2 --> D3b3[char_quests 任务进度]
        D3b3 --> D3b4[char_equipment 装备]
        D3b4 --> D3b5[char_skills 技能]
        D3b5 --> D3b6[char_exploration 探索]
        D3b6 --> D3b7[runtime_combatLogs 战斗日志]
        D3b7 --> D3b8[runtime_adventureLogs 冒险日志]
        D3b8 --> D3b9[config_locations 地点配置]
        D3b9 --> D3b10[config_shops 商店配置]
        D3b10 --> D3b11[config_factions/races/classes 等]
        D3b11 --> D3b12[runtime_gameState/mapState/shopItems]
        D3b12 --> E3a[记录 importedStores 成功列表]
        D3b12 --> E3b[记录 skippedStores 跳过列表 空数据]
        E3a --> F3[返回 ImportResult]
        E3b --> F3
        F3 --> G3[导入完成]
    end

    classDef validate fill:#fff3e0,stroke:#f57c00
    classDef persist fill:#e3f2fd,stroke:#1976d2
    class C3,C3a,C3b,C3c,C3d,C3e,C3f,C3g,C3h validate
    class D3,D3a,D3b,D3b1,D3b2,D3b3,D3b4,D3b5,D3b6,D3b7,D3b8,D3b9,D3b10,D3b11,D3b12 persist
```

**关键实现**：
- 备份服务：`src/modules/data/service.ts` 的 `BackupService`（`createBackup` 收集全量数据 + `calculateChecksum` 计算校验和，`exportBackup` 通过 Blob + `a.download` 触发下载）
- 自动备份：`createAutoBackup` 使用 localStorage 存储，`MAX_AUTO_BACKUPS = 5`，超过时 `pop` 移除最旧
- 导入校验：`ImportService.validateBackup` 执行格式校验 → checksum 校验 → 版本兼容性校验（`supportedVersions: ['v1.0']`）
- 数据导入：`importData` 在单个 `db.transaction` 中逐表 `bulkPut`，记录 `importedStores` 与 `skippedStores`（数据为空的表跳过）
- 配置常量：`src/config/database.ts` 的 `BACKUP_CONFIG`（`autoBackupKey: 'wow_dnd_auto_backups'`、`maxAutoBackups: 5`、`backupVersion: 'v1.0'`）

---

## 八、游戏初始化流程

角色进入或切换时各业务 Store 的初始化由 `gameBootstrap.initialize(characterId)` 统一编排，各 Store 的 `init` 仅负责加载自身状态，假设依赖已由本服务预先初始化。初始化顺序为 log → inventory → equipment → skill → map → exploration → quest，其中 inventory 初始化完成后会向 equipment 模块注入背包回调（A1/G1 修复），dispose 时按逆序清理 combat/exploration/audio 三个实现了 Disposable 接口的 Store。

```mermaid
sequenceDiagram
    autonumber
    participant App as App.vue / GameMain.vue
    participant GBS as gameBootstrap
    participant Log as logStore
    participant Inv as inventoryStore
    participant Eq as equipmentStore
    participant Skill as skillStore
    participant Map as mapStore
    participant Exp as explorationStore
    participant Quest as questStore

    App->>GBS: initialize(characterId)
    Note over GBS: 按依赖顺序初始化（前者被后者依赖）

    GBS->>Log: initialize(characterId)
    Note over Log: 1. 日志模块（基础数据，被探索/战斗依赖）
    Log-->>GBS: 就绪

    GBS->>Inv: initialize(characterId)
    Note over Inv: 2. 背包模块（被探索/装备依赖）
    Inv-->>GBS: 就绪

    Note over GBS: 2.5 注入背包回调到装备模块（A1/G1 修复）
    GBS->>Eq: setInventoryCallbacks(invStore.addItem, invStore.removeItem)

    GBS->>Eq: initialize(characterId)
    Note over Eq: 3. 装备模块（依赖背包回调，卸下装备时通过回调放回背包）
    Eq-->>GBS: 就绪

    GBS->>Skill: initialize(characterId)
    Note over Skill: 4. 技能模块（依赖角色）
    Skill-->>GBS: 就绪

    GBS->>Map: initialize(characterId)
    Note over Map: 5. 地图模块（被探索依赖）
    Map-->>GBS: 就绪

    GBS->>Exp: init(characterId)
    Note over Exp: 6. 探索模块（依赖上述所有，仅加载自身状态，不再隐式初始化其他 Store）
    Exp-->>GBS: 就绪

    GBS->>Quest: initialize(characterId)
    Note over Quest: 7. 任务模块（依赖角色、探索）
    Quest-->>GBS: 就绪

    GBS-->>App: 全部 Store 初始化完成
    Note over App: loading = false → 渲染游戏主界面
```

**逆序清理流程**：

```mermaid
flowchart LR
    Exit[角色切换 / 退出] --> Dispose[gameBootstrap.dispose]
    Dispose --> Combat[combatStore.dispose<br/>清理战斗定时器]
    Dispose --> Exp[explorationStore.dispose<br/>清理 EventBus 监听器与 UI 回调]
    Dispose --> Audio[audioStore.dispose<br/>清理 saveTimer 去抖定时器]
    Dispose --> ClearCb[clearInventoryCallbacks<br/>清除装备模块的背包回调引用]
```

**关键实现**：
- 编排入口：`src/services/GameBootstrap.ts` 的 `initialize`（顺序：log → inventory → equipment → skill → map → exploration → quest）与 `dispose`（逆序清理）
- 回调注入：`initialize` 在 inventory 初始化完成后、equipment 初始化前调用 `setInventoryCallbacks(invStore.addItem, invStore.removeItem)`（A1/G1 修复：消除 equipment → inventory 静态依赖）
- Disposable 接口：`dispose` 仅清理显式实现了 `Disposable` 接口的 Store（ARCH-8 修复：类型安全的 dispose 签名校验），当前包括 combatStore（战斗定时器）、explorationStore（EventBus 监听器与 UI 回调）、audioStore（saveTimer 去抖定时器）
- 回调清除：`dispose` 最后调用 `clearInventoryCallbacks()` 清除装备模块的背包回调引用（避免角色切换后回调指向旧 Store 实例）
- 设计要点：各模块 `init` 仅加载自身状态，依赖关系由 `GameBootstrap` 的调用顺序保证

---

## 九、天赋点分配流程

天赋系统由 `character/talents` 模块的 `useTalentStore` 管理。每个职业拥有 3 系天赋树，每系 3 层（tier 1/2/3），角色每升 2 级获得 1 点天赋点。玩家选择天赋节点分配点数，效果通过计算属性回灌角色属性与战斗计算。

```mermaid
sequenceDiagram
    autonumber
    participant U as 玩家
    participant UI as 天赋面板 UI
    participant TS as talentStore
    participant CharS as characterStore
    participant CS as combatStore
    participant DB as IndexedDB

    Note over CharS,TS: 阶段一 升级获点
    CharS->>CharS: gainExp → applyLevelUp 升级
    CharS->>TS: updateLevel(newLevel)
    TS->>TS: totalPoints = floor(level / 2)
    TS->>TS: availablePoints = totalPoints - spentPoints 重算

    Note over U,TS: 阶段二 选择与分配
    U->>UI: 选择天赋节点点击学习
    UI->>TS: learn(talentId)
    TS->>TS: canLearnTalent 校验
    Note over TS: 校验项：职业匹配 / tier 前置（tier2 需该系 3 点，tier3 需 6 点）/ availablePoints 大于 0 / 单天赋不超过 maxPointsPerTalent=5
    alt 校验失败
        TS-->>UI: 返回 false（职业不符/tier 前置未满/点数不足/超过单天赋上限）
        UI-->>U: 提示失败原因
    else 校验通过
        TS->>TS: learnTalent 纯函数<br/>allocations[talentId] += 1
        TS->>TS: spentPoints 重算 / availablePoints 递减
        TS-->>UI: 返回 true
    end

    Note over TS,CS: 阶段三 效果应用（响应式自动传播）
    TS->>TS: effectSummary 重算<br/>calculateTalentEffects(classId, allocations)
    TS->>TS: statBonuses 重算<br/>getTalentStatBonuses
    TS->>CharS: statBonuses 应用到角色属性（响应式）
    TS->>CS: effectSummary 供战斗计算消费<br/>damageMultiplier / damageReduction / critBonus
    Note over CharS,CS: 下游消费者通过 computed 自动更新

    Note over CharS,DB: 阶段四 持久化
    CharS->>DB: 统一保存 allocations（由 characterStore 存档）
    Note over TS: talentStore 不直接持久化，由调用方统一存档
```

**天赋树规则**：

| 规则项 | 值 | 常量名 |
|--------|-----|--------|
| 天赋树结构 | 每职业 3 系 | — |
| 层级数量 | 3 层（tier 1/2/3） | — |
| tier 2 解锁条件 | 该系投入 3 点 | `tier2Requirement` |
| tier 3 解锁条件 | 该系投入 6 点 | `tier3Requirement` |
| 单天赋最大点数 | 5 点 | `maxPointsPerTalent` |
| 点数获取频率 | 每 2 级获得 1 点 | `pointsPerLevel` |
| 总天赋点计算 | `floor(level / 2)` | `calculateTotalTalentPoints` |

**关键实现**：
- 编排入口：`src/modules/character/talents/store.ts` 的 `learn`、`updateLevel`、`initialize`、`reset`
- 纯函数层：`src/modules/character/talents/service.ts` 的 `canLearnTalent`（校验）、`learnTalent`（更新分配）、`calculateTalentEffects`（效果聚合）、`getTalentStatBonuses`（属性加成）、`calculateSpentPoints`（已用点数）
- 类型定义：`src/modules/character/talents/types.ts` 的 `TALENT_POINT_RULES`（点数规则常量）、`Talent`/`TalentTree`/`TalentEffect` 接口
- 数据来源：`src/data/config_class_talents.ts` 的 `getTalentTreesByClassId`（按职业返回天赋树）
- 设计要点：天赋点 = `floor(level / 2)`；`learn` 仅替换 `allocations` 引用不直接持久化，由 `characterStore` 统一存档；效果通过 `effectSummary`/`statBonuses` 计算属性响应式回灌属性与战斗计算

---

## 十、德鲁伊变形流程

德鲁伊形态系统由 `combat/forms` 模块的 `useFormStore` 管理。战斗中切换形态消耗 1 回合，修改属性倍率、解锁/锁定技能，并恢复 10% 最大生命。

```mermaid
sequenceDiagram
    autonumber
    participant U as 玩家
    participant UI as 战斗 UI
    participant CS as combatStore
    participant FS as formStore
    participant CharS as characterStore
    participant LS as logStore

    Note over CS,FS: 战斗开始时初始化
    CS->>FS: initialize()（默认人形形态，冷却清零）

    Note over U,FS: 战斗中选择变形
    U->>UI: 选择目标形态
    UI->>CS: playerAction({type:'transform', form})
    CS->>FS: switchTo(targetForm)

    FS->>FS: canSwitchForm 校验
    Note over FS: 校验项：目标形态有效 / 非当前形态 / 冷却已结束
    alt 校验失败
        FS-->>CS: 返回 false
        CS-->>UI: 提示无法切换
    else 校验通过
        FS->>FS: calculateFormSwitchHeal(targetForm, maxHp)
        Note over FS: 治疗量 = maxHp × 10%
        FS->>CharS: receiveHeal(healAmount)（恢复 10% 生命）
        FS->>FS: switchForm 纯函数更新形态状态
        Note over FS: currentForm = targetForm<br/>属性倍率变更：hpMultiplier / damageMultiplier / defenseMultiplier / speedMultiplier
        Note over FS: 技能解锁/锁定：getAvailableSkills / isSkillAvailableInForm
        FS->>LS: addLogEntry（记录变形与治疗日志）
        FS-->>CS: 返回 true
    end

    CS->>CS: 消耗 1 回合（endPlayerTurn）
    Note over CharS: 属性倍率生效 → effectiveStats 重算 → 战斗计算更新
    CS-->>UI: UI 重渲染（形态外观、属性面板、技能栏）
```

**形态效果应用链**：

```mermaid
flowchart LR
    Switch[switchTo 更新 currentForm] --> Mod[statModifiers 计算属性<br/>getFormStatModifiers]
    Mod --> HP[hpMultiplier 影响最大生命]
    Mod --> Dmg[damageMultiplier 影响伤害]
    Mod --> Def[defenseMultiplier 影响防御]
    Mod --> Spd[speedMultiplier 影响速度]
    Switch --> Skills[技能解锁/锁定<br/>getAvailableSkills / isSkillAvailableInForm]
    Skills --> SkillBar[UI 技能栏更新]
    Heal[calculateFormSwitchHeal] --> CharS[characterStore.receiveHeal<br/>恢复 10% maxHp]
```

**4 种德鲁伊形态**：

| 形态 | 定位 | 属性特点 |
|------|------|----------|
| 人形（humanoid） | 默认形态 | 平衡属性，可施法 |
| 熊（bear） | 坦克 | 高生命高防御 |
| 猎豹（cat） | 近战输出 | 高敏捷高暴击 |
| 枭兽（moonkin） | 法术输出 | 智力加成 |

**关键实现**：
- 编排入口：`src/modules/combat/forms/store.ts` 的 `switchTo`、`initialize`、`reset`、`tickCooldownEnd`
- 纯函数层：`src/modules/combat/forms/service.ts` 的 `canSwitchForm`（校验）、`switchForm`（状态更新）、`calculateFormSwitchHeal`（治疗计算）、`getFormStatModifiers`（属性倍率）、`getAvailableSkills`/`isSkillAvailableInForm`（技能解锁/锁定）
- 数据来源：`src/modules/combat/forms/druid_forms.ts` 的 `getSwitchableForms`
- 设计要点：变形消耗 1 回合；切换形态恢复 10% 最大生命；属性倍率通过计算属性响应式传播到战斗计算；技能按形态解锁/锁定

---

## 十一、术士召唤流程

术士召唤系统由 `combat/pets` 模块的 `usePetStore` 管理。战斗中消耗灵魂碎片召唤恶魔，召唤物拥有独立 AI 与行动。共 5 种召唤物（小鬼/虚空行者/魅魔/地狱犬/末日守卫）。

```mermaid
sequenceDiagram
    autonumber
    participant U as 玩家
    participant UI as 战斗 UI
    participant CS as combatStore
    participant PS as petStore
    participant RS as SoulShardSystem
    participant LS as logStore

    Note over CS,PS: 战斗开始时初始化
    CS->>PS: initialize(level, logCallback)
    Note over PS: 重置状态 / 设置日志回调

    Note over U,PS: 战斗中选择召唤
    U->>UI: 选择召唤物
    UI->>CS: playerAction({type:'summon', petType})
    CS->>PS: canSummon(petType, soulShards)

    PS->>PS: canSummonPet 校验
    Note over PS: 校验项：召唤物已解锁 / 当前无激活召唤物 / 灵魂碎片充足
    alt 校验失败
        PS-->>CS: 返回 false（碎片不足/已有召唤物/未解锁）
        CS-->>UI: 提示失败原因
    else 校验通过
        CS->>RS: soulShardSystem.consume(cost)（消耗灵魂碎片）
        RS-->>CS: 返回 true
        CS->>PS: summon(petType, soulShards)
        PS->>PS: summonPet 创建召唤物实例<br/>按 level 缩放属性
        PS->>LS: log(`召唤了 X！消耗 N 个灵魂碎片`)
        PS-->>CS: 返回 true
    end

    Note over PS,CS: 召唤物独立行动（每回合）
    loop 召唤物回合
        CS->>PS: petTakeAction()
        PS->>PS: selectPetAction AI 决策<br/>按策略选择技能
        alt 非默认攻击
            PS->>PS: setSkillCooldown 设置技能冷却
        end
        PS-->>CS: 返回选择的技能
        CS->>CS: 应用技能效果（造成伤害/施加减益等）
    end

    Note over PS,CS: 召唤物受伤与死亡
    CS->>PS: takeDamage(damage)（敌人攻击召唤物时）
    PS->>PS: damagePet 扣减 HP
    alt HP 小于等于 0
        PS->>LS: log(`召唤物死亡！`)
        PS->>PS: 清除 activePet
    end

    Note over PS,CS: 回合结束推进
    CS->>PS: tickTurn()
    PS->>PS: 减少技能冷却 / 减少持续时间
    alt 持续时间到期
        PS->>LS: log(`召唤时间结束，返回扭曲虚空`)
        PS->>PS: 清除 activePet
    end

    Note over CS,PS: 战斗结束
    CS->>PS: reset()（清空召唤系统状态）
```

**5 种召唤物**：

| 召唤物 | 定位 | 灵魂碎片消耗 | 来源 |
|--------|------|-------------|------|
| 小鬼（imp） | 远程法术输出 | 较低 | `warlock_pets.ts` |
| 虚空行者（voidwalker） | 坦克（高 HP） | 中 | `warlock_pets.ts` |
| 魅魔（succubus） | 控制（减益） | 中 | `warlock_pets.ts` |
| 地狱犬（felhunter） | 近战输出 | 中高 | `warlock_pets.ts` |
| 末日守卫（doomguard） | 强力输出 | 高 | `warlock_pets.ts` |

**关键实现**：
- 编排入口：`src/modules/combat/pets/store.ts` 的 `summon`、`dismiss`、`petTakeAction`、`takeDamage`、`tickTurn`、`initialize`、`reset`
- 纯函数层：`src/modules/combat/pets/service.ts` 的 `canSummonPet`（校验）、`summonPet`（创建实例）、`selectPetAction`（AI 决策）、`damagePet`（受伤）、`tickPetTurn`（回合推进）、`dismissPet`（解散）
- 数据来源：`src/modules/combat/pets/warlock_pets.ts` 的 `WARLOCK_PETS`（5 种召唤物定义）、`getPetByType`、`getSummonablePets`
- 资源联动：召唤消耗由调用方（combatStore）通过 `SoulShardSystem.consume(cost)` 扣除灵魂碎片，`petStore.summon` 仅校验与创建实例，不直接消耗资源
- 设计要点：召唤物独立 AI（`selectPetAction` 按策略选择技能）；召唤物有独立 HP 与持续时间，受伤死亡或时间到期自动清除；战斗日志通过注入的 `logCallback` 回写 combatStore

---

## 附录：跨模块通信约定

| 通信方式 | 适用场景 | 示例 |
|----------|----------|------|
| 直接 Store Action 调用 | 数据变更类跨模块操作 | `combatStore` 经 `ICombatContext` 调用 `characterStore.gainExp`、`questStore.onEnemyKilled` |
| EventBus 事件 | UI 刷新 / 音效触发 / 通知类 | `CHARACTER_LEVEL_UP`、`COMBAT_START`、`QUEST_COMPLETED` |
| UI 回调注册 | 探索模块跨模块数据事件 | `explorationStore.registerUICallbacks` 替代 EventBus 传递数据 |
| services 聚合层调用 | 跨模块查询 / 初始化编排 / 缓存 / 错误处理 / 角色生命周期 / 管理后台查询 | `explorationStore` 经 `crossModuleQuery` 查询地图/物品/任务/商店；`GameBootstrap` 编排 Store 初始化；`CharacterLifecycleService` 收口角色创建/删除跨模块持久化 |
| 回调注入 | 装备模块卸下装备放回背包 | `GameBootstrap.initialize` 中 `setInventoryCallbacks(invStore.addItem, invStore.removeItem)` 注入到 equipment 模块（A1/G1 修复） |
| DB 层直接调用 | 仅限自身模块持久化 | `explorationStore` 调用 `explorationDbService.persistState`（跨模块查询已收口至 `crossModuleQuery`） |

**设计原则**：数据变更走 Store Action，EventBus 不传递数据变更通知，仅用于 UI/音效类事件。

---

**文档结束**
