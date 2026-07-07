# 项目架构图

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 项目架构图 |
| 版本 | v1.0 |
| 生成日期 | 2026年7月6日 |
| 所属目录 | `doc/project/` |
| 关联文档 | MODULE_FUNCTIONS.md、DEPENDENCY_GRAPH.md、DATA_ARCHITECTURE_OVERVIEW.md |

---

## 概述

本文档通过 Mermaid 图表系统化呈现「战争艺术：地下城」项目的整体架构、模块内部分层、关键子系统设计与数据持久化方案，为开发与维护提供可视化参考。

---

## 一、系统整体架构图

下图展示项目自上而下的七层架构，每层标注其代表性成员，箭头表示调用方向（上层 → 下层）。

```mermaid
graph TD
    %% ===== 第一层：UI 组件层（Vue Components）=====
    subgraph L1[UI 组件层 Vue Components]
        direction LR
        L1A[GameMain 游戏主界面]
        L1B[CharacterCreate 角色创建]
        L1C[CharacterSelect 角色选择]
        L1D[ExplorationView 探索视图]
        L1E[MapView 地图视图]
        L1F[popup 弹窗组件群<br/>CombatPopup/InventoryPopup/SkillsPopup/<br/>ShopPopup/QuestPopup/QuestBoardPopup/<br/>AdventureLogPopup/AudioSettingsPopup/<br/>CharacterInfoPopup/SystemPopup]
        L1G[common 通用组件群<br/>AlertPopup/BasePopup/ConfirmPopup/<br/>EffectTag/EmptyState/ItemIcon/<br/>ResourceBar/SkillTags/Tag/Toast]
        L1H[admin 后台组件群<br/>AdminForm/AdminLayout/<br/>AdminTable/ConfigManager]
    end

    %% ===== 第二层：Composables 层 =====
    subgraph L2[Composables 层]
        direction LR
        L2A[useSkillDisplay 技能展示]
        L2B[useToast 全局提示]
    end

    %% ===== 第 2.5 层：服务层=====
    subgraph L2S[服务层 Services]
        direction LR
        L2S1[CrossModuleQuery<br/>跨模块查询]
        L2S2[GameBootstrap<br/>初始化编排]
        L2S3[ItemTemplateCache<br/>物品模板缓存]
        L2S4[ErrorHandler<br/>统一错误处理]
    end

    %% ===== 第三层：玩法核心层 =====
    subgraph L3[玩法核心层]
        direction LR
        L3A[combat 战斗]
        L3B[exploration 探索]
        L3C[map 地图]
        L3D[shop 商店]
    end

    %% ===== 第四层：核心数据层 =====
    subgraph L4[核心数据层]
        direction LR
        L4A[character 角色]
        L4B[inventory 背包]
        L4C[equipment 装备]
        L4D[skill 技能]
        L4E[quest 任务]
    end

    %% ===== 第五层：辅助模块层 =====
    subgraph L5[辅助模块层]
        direction LR
        L5A[log 冒险日志]
        L5B[enemy 敌人]
        L5C[boss Boss]
    end

    %% ===== 第六层：基础设施层 =====
    subgraph L6[基础设施层]
        direction LR
        L6A[data 数据核心]
        L6B[bus 事件总线]
        L6C[base 基础数据]
        L6D[admin 后台管理]
        L6E[audio 音频]
        L6F[animation 动画]
    end

    %% ===== 第七层：工具与配置层 =====
    subgraph L7[工具与配置层]
        direction LR
        L7A[utils/calculations 计算工具]
        L7B[config/* 配置<br/>character/combat-colors/<br/>database/inventory]
        L7C[data/config_* 静态数据<br/>config_bosses/config_classes/<br/>config_equipmentItems/config_factions/<br/>config_items/config_locations/<br/>config_mobs/config_quests/<br/>config_races/config_shops/<br/>config_skills]
    end

    %% ===== 层间调用关系 =====
    L1 --> L2
    L1 --> L2S
    L1 --> L3
    L1 --> L4
    L2 --> L4
    L2S --> L3
    L2S --> L4
    L3 --> L2S
    L3 --> L4
    L3 --> L5
    L4 --> L5
    L5 --> L6
    L4 --> L6
    L3 --> L6
    L6 --> L7
    L4 --> L7

    %% ===== 样式定义 =====
    classDef uiLayer fill:#ffe0b2,stroke:#e65100,color:#000
    classDef compLayer fill:#fff9c4,stroke:#f57f17,color:#000
    classDef svcLayer fill:#f8bbd0,stroke:#ad1457,color:#000
    classDef playLayer fill:#c5e1a5,stroke:#33691e,color:#000
    classDef dataLayer fill:#b3e5fc,stroke:#01579b,color:#000
    classDef auxLayer fill:#d1c4e9,stroke:#311b92,color:#000
    classDef infraLayer fill:#ffccbc,stroke:#bf360c,color:#000
    classDef toolLayer fill:#cfd8dc,stroke:#37474f,color:#000

    class L1A,L1B,L1C,L1D,L1E,L1F,L1G,L1H uiLayer
    class L2A,L2B compLayer
    class L2S1,L2S2,L2S3,L2S4 svcLayer
    class L3A,L3B,L3C,L3D playLayer
    class L4A,L4B,L4C,L4D,L4E dataLayer
    class L5A,L5B,L5C auxLayer
    class L6A,L6B,L6C,L6D,L6E,L6F infraLayer
    class L7A,L7B,L7C toolLayer
```

**分层说明**：

| 层级 | 职责 | 主要成员 |
|------|------|----------|
| UI 组件层 | 用户交互与视图渲染 | GameMain、CharacterCreate/Select、ExplorationView、MapView、popup/、common/、admin/ |
| Composables 层 | 跨组件复用的组合式逻辑 | useSkillDisplay、useToast |
| 服务层 | 跨模块查询、初始化编排、缓存与错误处理 | CrossModuleQuery、GameBootstrap、ItemTemplateCache、ErrorHandler |
| 玩法核心层 | 游戏核心玩法编排 | combat、exploration、map、shop |
| 核心数据层 | 角色相关业务数据管理 | character、inventory、equipment、skill、quest |
| 辅助模块层 | 为玩法层提供辅助能力 | log、enemy、boss |
| 基础设施层 | 数据/事件/音频等基础能力 | data、bus、base、admin、audio、animation |
| 工具与配置层 | 纯函数工具与静态配置 | utils/calculations、config/*、data/config_* |

---

## 二、模块内部分层架构

每个业务模块遵循统一的 5 层结构，自顶向下依次为入口、类型、持久化、状态、服务。下图展示标准调用关系。

```mermaid
graph TD
    %% ===== 模块五层结构 =====
    index[index.ts 统一导出入口]
    types[types.ts 类型定义层]
    db[db.ts 持久化层 DbService]
    store[store.ts 状态管理层 Store]
    service[service.ts 纯函数服务层]

    %% ===== 外部消费者 =====
    consumer[外部模块/UI 组件]

    %% ===== 底层依赖 =====
    gameDB[(GameDatabase<br/>Dexie 实例)]
    eventBus{{EventBus<br/>事件总线}}
    otherMod[其他模块 Store]

    %% ===== 调用关系 =====
    consumer -->|导入| index
    index -->|re-export| types
    index -->|re-export| db
    index -->|re-export| service
    index -->|re-export| store

    store -->|调用| service
    store -->|读写| db
    store -->|发布/订阅| eventBus
    store -->|Action 调用| otherMod
    db -->|操作表| gameDB

    %% ===== 样式 =====
    classDef entry fill:#fff9c4,stroke:#f57f17,color:#000
    classDef typeLayer fill:#cfd8dc,stroke:#37474f,color:#000
    classDef persist fill:#ffccbc,stroke:#bf360c,color:#000
    classDef state fill:#c5e1a5,stroke:#33691e,color:#000
    classDef svc fill:#b3e5fc,stroke:#01579b,color:#000
    classDef ext fill:#eceff1,stroke:#607d8b,color:#000

    class index entry
    class types typeLayer
    class db persist
    class store state
    class service svc
    class consumer,gameDB,eventBus,otherMod ext
```

**各层职责说明**：

| 文件 | 职责 | 约束 |
|------|------|------|
| `index.ts` | 统一导出入口，聚合对外暴露的 API | 不含业务逻辑 |
| `types.ts` | 类型定义、枚举、接口 | 不含运行时逻辑 |
| `db.ts` | DbService 持久化层，封装表读写 | 不持有响应式状态 |
| `store.ts` | Pinia Store，响应式状态与 Action 编排 | 唯一数据源 |
| `service.ts` | 纯函数服务层，无副作用计算 | 不调用 DB、不 emit 事件 |

---

## 三、战斗模块架构详解

战斗模块通过 composables 拆分降低复杂度，并包含 effects 与 ai 两个子系统。

### 3.1 Composables 组合架构

```mermaid
graph TD
    %% ===== 组合入口 =====
    entry[useCombatStore<br/>战斗 Store 组合入口]

    %% ===== 六大子 composable =====
    state[useCombatState<br/>状态层<br/>ref/computed/生命周期]
    log[useCombatLog<br/>日志层<br/>addCombatLog/saveLogs]
    boss[useBossMechanics<br/>Boss 机制层<br/>阶段切换/特殊技能]
    enemy[useEnemyAction<br/>敌人行动层<br/>AI 决策/技能施放]
    initiative[useInitiative<br/>先攻调度层<br/>行动顺序排序]
    player[usePlayerAction<br/>玩家行动层<br/>攻击/防御/技能]

    %% ===== 跨模块依赖 =====
    charStore[characterStore]
    enemyStore[enemyStore]
    skillStore[skillStore]
    invStore[inventoryStore]
    questStore[questStore]
    logStore[logStore]

    %% ===== 事件总线 =====
    bus{{EventBus<br/>COMBAT_START/END<br/>PLAYER_TURN/ENEMY_TURN<br/>DEAL_DAMAGE/CAST_HEAL}}

    %% ===== 组合关系 =====
    entry -->|组合| state
    entry -->|组合| log
    entry -->|组合| boss
    entry -->|组合| enemy
    entry -->|组合| initiative
    entry -->|组合| player

    %% ===== 依赖注入关系 =====
    log -->|依赖| state
    boss -->|依赖| state
    boss -->|依赖| log
    boss -.->|延迟绑定 orderBuilder| initiative
    enemy -->|依赖| state
    enemy -->|依赖| log

    %% ===== 跨模块调用 =====
    entry -->|Action| charStore
    entry -->|Action| enemyStore
    entry -->|Action| skillStore
    entry -->|Action| invStore
    entry -->|Action| questStore
    entry -->|Action| logStore

    %% ===== 事件发布 =====
    entry -->|发布 UI/音效事件| bus

    %% ===== 样式 =====
    classDef entryLayer fill:#fff9c4,stroke:#f57f17,color:#000
    classDef subLayer fill:#c5e1a5,stroke:#33691e,color:#000
    classDef ext fill:#eceff1,stroke:#607d8b,color:#000
    classDef busLayer fill:#ffe0b2,stroke:#e65100,color:#000

    class entry entryLayer
    class state,log,boss,enemy,initiative,player subLayer
    class charStore,enemyStore,skillStore,invStore,questStore,logStore ext
    class bus busLayer
```

### 3.2 Effects 子系统（Buff/Debuff 效果系统）

采用「管线 → 容器 → 处理器」的三层结构，支持 15 种内置效果。

```mermaid
graph LR
    %% ===== 入口 =====
    caller[战斗 Store/敌人行动层]

    %% ===== 管线层 =====
    pipeline[pipeline.ts<br/>processDamagePipeline<br/>applyEffect]

    %% ===== 容器层 =====
    container[container.ts<br/>addEffectToContainer<br/>removeEffectFromContainer<br/>createEmptyContainer]

    %% ===== 处理器注册表 =====
    handler[handler.ts<br/>EffectHandlerRegistry<br/>register/registerAll]

    %% ===== 15 个处理器 =====
    subgraph handlers[handlers/ 15 个内置处理器]
        direction TB
        h1[attackMod<br/>attackUp/attackDown]
        h2[defenseMod<br/>defenseUp/defenseDown/vulnerable]
        h3[speedMod<br/>speedUp/speedDown]
        h4[dot<br/>poison/burn]
        h5[control<br/>stun/freeze/silence]
        h6[shield<br/>shield]
        h7[regen<br/>regen]
        h8[thorn<br/>thorn]
    end

    %% ===== 调用链 =====
    caller -->|触发伤害/治疗效果| pipeline
    pipeline -->|操作效果集合| container
    pipeline -->|分发到具体处理器| handler
    handler -->|注册| h1
    handler -->|注册| h2
    handler -->|注册| h3
    handler -->|注册| h4
    handler -->|注册| h5
    handler -->|注册| h6
    handler -->|注册| h7
    handler -->|注册| h8

    %% ===== 样式 =====
    classDef callerLayer fill:#eceff1,stroke:#607d8b,color:#000
    classDef pipeLayer fill:#b3e5fc,stroke:#01579b,color:#000
    classDef contLayer fill:#c5e1a5,stroke:#33691e,color:#000
    classDef regLayer fill:#fff9c4,stroke:#f57f17,color:#000
    classDef hLayer fill:#ffe0b2,stroke:#e65100,color:#000

    class caller callerLayer
    class pipeline pipeLayer
    class container contLayer
    class handler regLayer
    class h1,h2,h3,h4,h5,h6,h7,h8 hLayer
```

### 3.3 AI 子系统（策略模式）

采用策略模式实现敌人 AI，支持四种行为策略。

```mermaid
graph TD
    %% ===== 策略接口 =====
    interface[IAiStrategy 接口<br/>decideAction: AiDecision]

    %% ===== 策略上下文 =====
    context[BattleContext<br/>战斗上下文<br/>enemyHp/availableSkills/...]

    %% ===== 四种策略实现 =====
    aggressive[AggressiveStrategy<br/>激进型<br/>优先技能攻击<br/>HP低于30%不恢复]
    defensive[DefensiveStrategy<br/>防御型<br/>HP低于40%优先治疗<br/>少用技能]
    balanced[BalancedStrategy<br/>平衡型<br/>根据状态动态决策]
    bossPhase[BossPhaseStrategy<br/>Boss 阶段型<br/>按 Boss 阶段切换策略]

    %% ===== 决策结果 =====
    decision[AiDecision<br/>type: basic_attack/skill/heal<br/>skillId?]

    %% ===== 关系 =====
    interface -->|实现| aggressive
    interface -->|实现| defensive
    interface -->|实现| balanced
    interface -->|实现| bossPhase

    aggressive -->|输入| context
    defensive -->|输入| context
    balanced -->|输入| context
    bossPhase -->|输入| context

    aggressive -->|输出| decision
    defensive -->|输出| decision
    balanced -->|输出| decision
    bossPhase -->|输出| decision

    %% ===== 样式 =====
    classDef iface fill:#fff9c4,stroke:#f57f17,color:#000
    classDef ctx fill:#cfd8dc,stroke:#37474f,color:#000
    classDef strat fill:#c5e1a5,stroke:#33691e,color:#000
    classDef out fill:#b3e5fc,stroke:#01579b,color:#000

    class interface iface
    class context ctx
    class aggressive,defensive,balanced,bossPhase strat
    class decision out
```

### 3.4 战斗子模块架构图

战斗模块内部包含 `resources / forms / pets` 三大子目录，配合既有的 `composables / effects / ai`，形成完整的职业差异化与战斗扩展能力。下图展示各子模块之间的协作关系。

```mermaid
graph TD
    %% ===== 编排中心 =====
    combat[useCombatStore<br/>战斗编排中心]

    %% ===== 战斗内部子模块 =====
    resources[resources/<br/>ResourceSystemFactory<br/>Rage/Energy/ComboPoint/<br/>SoulShard/Chi]
    passive[composables/usePassiveSkills<br/>被动技能触发]
    effects[effects/<br/>Buff/Debuff 系统]
    forms[forms/useFormStore<br/>德鲁伊变形]
    pets[pets/usePetStore<br/>术士召唤]
    targetSel[ai/targetSelection<br/>ITargetSelector 接口]
    strategies[ai/strategies<br/>4 种策略]

    %% ===== composable 调用方 =====
    useEnemyAction[useEnemyAction<br/>敌人行动层]
    useInitiative[useInitiative<br/>先攻调度层]

    %% ===== 外部数据源 =====
    character[character<br/>职业/属性/天赋]
    skill[skill<br/>技能模板]

    %% ===== combat Store 组合关系 =====
    combat -->|按职业创建资源| resources
    combat -->|组合注入| passive
    combat -->|组合| effects
    combat -->|组合| strategies
    combat -->|组合| useEnemyAction
    combat -->|组合| useInitiative

    %% ===== 被动技能注入 =====
    passive -.->|注入| useEnemyAction
    passive -.->|注入| useInitiative

    %% ===== AI 目标选择 =====
    strategies -->|选择目标| targetSel
    useEnemyAction -->|驱动| strategies

    %% ===== 职业差异化子模块对外 =====
    resources -->|读取职业| character
    forms -->|形态修正属性| character
    forms -->|形态限制技能| skill
    forms -.->|形态切换通知| combat
    pets -->|召唤物属性| character
    pets -.->|召唤物参战| combat
    pets -->|消耗灵魂碎片| resources

    %% ===== 样式 =====
    classDef center fill:#fff9c4,stroke:#f57f17,color:#000
    classDef sub fill:#c5e1a5,stroke:#33691e,color:#000
    classDef ext fill:#eceff1,stroke:#607d8b,color:#000
    classDef aiLayer fill:#b3e5fc,stroke:#01579b,color:#000

    class combat center
    class resources,passive,effects,forms,pets,useEnemyAction,useInitiative sub
    class targetSel,strategies aiLayer
    class character,skill ext
```

**子模块协作说明**：

| 子模块 | 类型 | 协作方式 |
|--------|------|----------|
| `resources/` | 资源系统 | `ResourceSystemFactory` 按角色职业创建对应资源系统（怒气/能量/连击点/灵魂碎片/真气），由 combat Store 持有并在回合内消耗/回复 |
| `composables/usePassiveSkills` | 被动技能 | 作为组合式函数被 combat Store 创建，再注入到 `useEnemyAction` 与 `useInitiative`，在敌人行动与先攻调度时触发被动效果 |
| `forms/` | 德鲁伊变形 | 独立 `useFormStore`，形态切换时修正角色属性、限制可用技能，并通知 combat Store 重建先攻 |
| `pets/` | 术士召唤 | 独立 `usePetStore`，召唤物属性基于角色计算，消耗灵魂碎片资源，参战行动由 combat Store 驱动 |
| `ai/targetSelection` | 目标选择 | 实现 `ITargetSelector` 接口，被 4 种 AI 策略调用以选择攻击目标，为多角色队伍预留扩展点 |
| `effects/` | 效果系统 | 既有三层结构（管线-容器-处理器），由 combat Store 与敌人行动层驱动 |

---

## 四、探索模块架构详解

探索模块采用「Store 编排 + Service 纯函数」模式，通过 UI 回调与 EventBus 与外部交互。

```mermaid
graph TD
    %% ===== Store 层 =====
    store[useExplorationStore<br/>状态编排层<br/>currentAreaId/grid/playerPosition]

    %% ===== Service 纯函数层 =====
    subgraph service[service.ts 纯函数集]
        direction TB
        s1[generateGrid 生成网格]
        s2[findStartPosition 寻找起点]
        s3[updateAccessibleCells 更新可达格]
        s4[generateTrapDamage 陷阱伤害]
        s5[generateRandomEvent 随机事件]
        s6[generateCampHeal 营地治疗]
        s7[generateItemForCell 格子物品]
        s8[computeEventProbability 事件概率]
        s9[buildItemPool 物品池]
    end

    %% ===== UI 回调机制 =====
    uiCb[registerUICallbacks<br/>UI 回调注册]
    uiComp[GameMain/ExplorationView<br/>UI 组件]

    %% ===== EventBus 监听 =====
    bus{{EventBus}}
    combatEnd[COMBAT_END 事件]
    onBattleResult[onBattleResult 处理函数]

    %% ===== 跨模块交互 =====
    triggerBattle[triggerBattle 触发战斗]
    combatPopup[CombatPopup 战斗弹窗]
    charStore[characterStore]
    invStore[inventoryStore]
    logStore[logStore]

    %% ===== 持久化 =====
    db[(explorationDbService)]

    %% ===== 调用关系 =====
    store -->|调用纯函数| s1
    store -->|调用纯函数| s2
    store -->|调用纯函数| s3
    store -->|调用纯函数| s4
    store -->|调用纯函数| s5
    store -->|调用纯函数| s6
    store -->|调用纯函数| s7
    store -->|调用纯函数| s8
    store -->|调用纯函数| s9

    store -->|读写| db

    %% ===== UI 回调链 =====
    uiComp -->|注册回调| uiCb
    uiCb -->|持有| store
    store -->|触发回调| uiComp

    %% ===== EventBus 监听链 =====
    store -->|订阅| bus
    bus -->|派发| combatEnd
    combatEnd -->|触发| onBattleResult
    onBattleResult -->|更新| store

    %% ===== 跨模块战斗交互 =====
    store -->|triggerBattle| triggerBattle
    triggerBattle -->|打开| combatPopup
    combatPopup -->|战斗结束发布| combatEnd

    %% ===== 跨模块 Store 调用 =====
    store -->|takeDamage/receiveHeal/gainGold| charStore
    store -->|addItem| invStore
    store -->|addLogEntry| logStore

    %% ===== 样式 =====
    classDef storeLayer fill:#c5e1a5,stroke:#33691e,color:#000
    classDef svcLayer fill:#b3e5fc,stroke:#01579b,color:#000
    classDef uiLayer fill:#ffe0b2,stroke:#e65100,color:#000
    classDef busLayer fill:#fff9c4,stroke:#f57f17,color:#000
    classDef ext fill:#eceff1,stroke:#607d8b,color:#000
    classDef dbLayer fill:#ffccbc,stroke:#bf360c,color:#000

    class store storeLayer
    class s1,s2,s3,s4,s5,s6,s7,s8,s9 svcLayer
    class uiCb,uiComp,combatPopup uiLayer
    class bus,combatEnd,onBattleResult busLayer
    class triggerBattle,charStore,invStore,logStore ext
    class db dbLayer
```

**关键机制说明**：

| 机制 | 说明 |
|------|------|
| Store → Service | Store 调用 Service 纯函数完成网格生成、概率计算等无副作用运算 |
| UI 回调（registerUICallbacks） | 替代部分 EventBus 数据事件，由 GameMain/ExplorationView 注册回调，Store 触发后由 UI 响应 |
| EventBus 监听 | Store 订阅 `COMBAT_END` 事件，由 `onBattleResult` 处理战斗结果回调 |
| 跨模块战斗闭环 | `triggerBattle` → `CombatPopup` → 战斗结束发布 `COMBAT_END` → `onBattleResult` 更新探索状态 |

---

## 五、数据持久化架构

采用「Dexie → DBService → 模块 DbService → IndexedDB」四层结构，共 22 张表。

```mermaid
graph TD
    %% ===== 消费层 =====
    subgraph consumers[各模块 Store]
        direction LR
        cChar[characterStore]
        cInv[inventoryStore]
        cEquip[equipmentStore]
        cSkill[skillStore]
        cQuest[questStore]
        cCombat[combatStore]
        cExp[explorationStore]
        cLog[logStore]
        cMap[mapStore]
        cShop[shopStore]
        cEnemy[enemyStore]
        cBoss[bossStore]
    end

    %% ===== 模块 DbService 层 =====
    subgraph dbServices[各模块 DbService]
        direction LR
        dChar[character/db]
        dInv[inventory/db]
        dEquip[equipment/db]
        dSkill[skill/db]
        dQuest[quest/db]
        dCombat[combat/db]
        dExp[exploration/db]
        dLog[log/db]
        dMap[map/db]
        dShop[shop/db]
        dEnemy[enemy/db]
        dBoss[boss/db]
    end

    %% ===== 数据核心层 =====
    dbService[DBService<br/>withRetry 重试机制<br/>指数退避]
    gameDB[GameDatabase<br/>Dexie 实例<br/>单例模式]

    %% ===== 底层存储 =====
    indexedDB[(IndexedDB<br/>浏览器数据库)]

    %% ===== 22 张表 =====
    subgraph tables[22 张数据表]
        direction TB
        subgraph config[配置表 config_* 11张]
            direction LR
            t1[config_factions 阵营]
            t2[config_races 种族]
            t3[config_classes 职业]
            t4[config_items 物品]
            t5[config_equipmentItems 装备模板]
            t6[config_mobs 怪物]
            t7[config_bosses Boss]
            t8[config_quests 任务定义]
            t9[config_skills 技能模板]
            t10[config_locations 地点]
            t11[config_shops 商店配置]
        end
        subgraph char[角色表 char_* 6张]
            direction LR
            t12[char_data 角色数据]
            t13[char_inventory 背包]
            t14[char_equipment 装备]
            t15[char_skills 技能]
            t16[char_quests 任务进度]
            t17[char_exploration 探索状态]
        end
        subgraph runtime[运行时表 runtime_* 5张]
            direction LR
            t18[runtime_gameState 游戏状态]
            t19[runtime_combatLogs 战斗日志]
            t20[runtime_adventureLogs 冒险日志]
            t21[runtime_mapState 地图状态]
            t22[runtime_shopItems 商店物品]
        end
    end

    %% ===== 调用链 =====
    cChar --> dChar
    cInv --> dInv
    cEquip --> dEquip
    cSkill --> dSkill
    cQuest --> dQuest
    cCombat --> dCombat
    cExp --> dExp
    cLog --> dLog
    cMap --> dMap
    cShop --> dShop
    cEnemy --> dEnemy
    cBoss --> dBoss

    dChar --> dbService
    dInv --> dbService
    dEquip --> dbService
    dSkill --> dbService
    dQuest --> dbService
    dCombat --> dbService
    dExp --> dbService
    dLog --> dbService
    dMap --> dbService
    dShop --> dbService
    dEnemy --> dbService
    dBoss --> dbService

    dbService --> gameDB
    gameDB --> indexedDB

    gameDB --> t1
    gameDB --> t2
    gameDB --> t3
    gameDB --> t4
    gameDB --> t5
    gameDB --> t6
    gameDB --> t7
    gameDB --> t8
    gameDB --> t9
    gameDB --> t10
    gameDB --> t11
    gameDB --> t12
    gameDB --> t13
    gameDB --> t14
    gameDB --> t15
    gameDB --> t16
    gameDB --> t17
    gameDB --> t18
    gameDB --> t19
    gameDB --> t20
    gameDB --> t21
    gameDB --> t22

    %% ===== 样式 =====
    classDef consumerLayer fill:#c5e1a5,stroke:#33691e,color:#000
    classDef dbSvcLayer fill:#b3e5fc,stroke:#01579b,color:#000
    classDef coreLayer fill:#fff9c4,stroke:#f57f17,color:#000
    classDef storageLayer fill:#ffccbc,stroke:#bf360c,color:#000
    classDef configTable fill:#ffe0b2,stroke:#e65100,color:#000
    classDef charTable fill:#d1c4e9,stroke:#311b92,color:#000
    classDef runtimeTable fill:#cfd8dc,stroke:#37474f,color:#000

    class cChar,cInv,cEquip,cSkill,cQuest,cCombat,cExp,cLog,cMap,cShop,cEnemy,cBoss consumerLayer
    class dChar,dInv,dEquip,dSkill,dQuest,dCombat,dExp,dLog,dMap,dShop,dEnemy,dBoss dbSvcLayer
    class dbService,gameDB coreLayer
    class indexedDB storageLayer
    class t1,t2,t3,t4,t5,t6,t7,t8,t9,t10,t11 configTable
    class t12,t13,t14,t15,t16,t17 charTable
    class t18,t19,t20,t21,t22 runtimeTable
```

**表分类说明**：

| 类别 | 前缀 | 数量 | 共享范围 | 用途 |
|------|------|------|----------|------|
| 配置表 | `config_*` | 11 | 所有角色共享 | 游戏静态定义数据（阵营/种族/职业/物品/装备/怪物/Boss/任务/技能/地点/商店） |
| 角色表 | `char_*` | 6 | 绑定 characterId | 每个角色独立的数据（角色/背包/装备/技能/任务/探索） |
| 运行时表 | `runtime_*` | 5 | 全局或会话级 | 日志与临时状态（游戏状态/战斗日志/冒险日志/地图状态/商店物品） |

---

## 六、Vue 组件树

下图展示从 App.vue 根组件到各视图与弹窗组件的完整层级关系。

```mermaid
graph TD
    %% ===== 根组件 =====
    app[App.vue<br/>应用根组件<br/>管理界面状态切换]

    %% ===== 顶层视图 =====
    charSelect[CharacterSelect<br/>角色选择]
    charCreate[CharacterCreate<br/>角色创建弹窗]
    gameMain[GameMain<br/>游戏主界面]
    adminLayout[AdminLayout<br/>后台管理布局]

    %% ===== GameMain 子视图 =====
    mapView[MapView<br/>地图视图]
    explorationView[ExplorationView<br/>探索视图]

    %% ===== GameMain 弹窗组件 =====
    combatPopup[CombatPopup<br/>战斗弹窗]
    inventoryPopup[InventoryPopup<br/>背包弹窗]
    skillsPopup[SkillsPopup<br/>技能弹窗]
    shopPopup[ShopPopup<br/>商店弹窗]
    questPopup[QuestPopup<br/>任务弹窗]
    questBoardPopup[QuestBoardPopup<br/>任务面板弹窗]
    adventureLogPopup[AdventureLogPopup<br/>冒险日志弹窗]
    audioSettingsPopup[AudioSettingsPopup<br/>音频设置弹窗]
    characterInfoPopup[CharacterInfoPopup<br/>角色信息弹窗]
    systemPopup[SystemPopup<br/>系统弹窗]

    %% ===== 通用组件 =====
    resourceBar[ResourceBar<br/>资源条]
    confirmPopup[ConfirmPopup<br/>确认弹窗]
    toast[Toast 全局提示]

    %% ===== Admin 子组件 =====
    configManager[ConfigManager<br/>配置管理]
    adminForm[AdminForm<br/>后台表单]
    adminTable[AdminTable<br/>后台表格]

    %% ===== 组件树关系 =====
    app -->|v-if 角色选择| charSelect
    app -->|v-if 角色创建| charCreate
    app -->|v-if 游戏中| gameMain
    app -->|v-if 后台管理| adminLayout
    app -->|全局| confirmPopup
    app -->|全局| toast

    gameMain -->|tab=map| mapView
    gameMain -->|tab=explore| explorationView
    gameMain -->|底部导航| combatPopup
    gameMain -->|底部导航| inventoryPopup
    gameMain -->|底部导航| skillsPopup
    gameMain -->|底部导航| shopPopup
    gameMain -->|底部导航| questPopup
    gameMain -->|底部导航| questBoardPopup
    gameMain -->|底部导航| adventureLogPopup
    gameMain -->|底部导航| audioSettingsPopup
    gameMain -->|底部导航| characterInfoPopup
    gameMain -->|底部导航| systemPopup
    gameMain -->|头部| resourceBar

    adminLayout -->|包含| configManager
    adminLayout -->|包含| adminForm
    adminLayout -->|包含| adminTable

    %% ===== 样式 =====
    classDef root fill:#fff9c4,stroke:#f57f17,color:#000
    classDef view fill:#c5e1a5,stroke:#33691e,color:#000
    classDef popup fill:#ffe0b2,stroke:#e65100,color:#000
    classDef common fill:#b3e5fc,stroke:#01579b,color:#000
    classDef admin fill:#d1c4e9,stroke:#311b92,color:#000

    class app root
    class charSelect,charCreate,gameMain,adminLayout,mapView,explorationView view
    class combatPopup,inventoryPopup,skillsPopup,shopPopup,questPopup,questBoardPopup,adventureLogPopup,audioSettingsPopup,characterInfoPopup,systemPopup popup
    class resourceBar,confirmPopup,toast common
    class configManager,adminForm,adminTable admin
```

---

## 七、事件总线架构

EventBus 采用类型安全的发布/订阅模式，支持分组管理与生命周期控制。

```mermaid
graph TD
    %% ===== 公共 API 层 =====
    subgraph api["EventBus 公共 API"]
        direction LR
        on["on 注册监听"]
        off["off 取消监听"]
        emit["emit 触发事件"]
        once["once 一次性监听"]
        onGroup["onGroup 分组注册"]
        clearGroup["clearGroup 清除分组"]
        clearAll["clearAll 清除全部"]
        removeEvent["removeEvent 移除事件"]
    end

    %% ===== 类型安全机制 =====
    typeSafe["GameEventPayloadMap<br/>事件载荷映射接口<br/>K extends keyof GameEventPayloadMap"]
    events["GameEvents 枚举<br/>按模块分组的事件常量"]

    %% ===== 内部存储 =====
    listeners[("listeners 监听器映射表<br/>event -> callback 列表")]
    groups[("groups 分组记录<br/>groupName -> entries 列表")]

    %% ===== 事件分组 =====
    subgraph eventGroups["事件分组（按模块）"]
        direction TB
        g1["角色事件 CHARACTER 系列<br/>CREATED / DELETED / LOGOUT<br/>LEVEL_UP / DEATH / RESURRECTED"]
        g2["战斗事件 COMBAT 系列<br/>START / END / PLAYER_TURN / ENEMY_TURN<br/>DEAL_DAMAGE / CAST_HEAL / CRITICAL_HIT / DODGE<br/>SKIP_TURN / BOSS_INTRO / BOSS_PHASE"]
        g3["探索事件 EXPLORATION 系列<br/>START / END / CELL_EXPLORED<br/>BATTLE_TRIGGERED / CAMP_USED<br/>ITEM_FOUND / TRAP_TRIGGERED / RANDOM_EVENT"]
        g4["商店事件 SHOP 系列<br/>OPENED / TRANSACTION / CLOSED"]
        g5["任务事件 QUEST 系列<br/>BOARD_OPENED / ACCEPTED / COMPLETED / REWARDED"]
        g6["技能事件 SKILL 系列<br/>LEARNED / CAST"]
        g7["UI 事件 UI 系列<br/>PANEL_OPENED / PANEL_CLOSED / CLICK<br/>CONFIRM_CONFIRMED / CONFIRM_CANCELED"]
        g8["其他事件<br/>ZONE_ENTERED / GAME_DATA_UPDATED<br/>LOG_ENTRY_ADDED / ITEM_DROPPED<br/>DATA_EXPORTED / DATA_IMPORTED"]
    end

    %% ===== 发布方与订阅方 =====
    publishers["发布方<br/>各业务模块 Store"]
    subscribers["订阅方<br/>UI 组件 / audio / animation<br/>跨模块 Store"]

    %% ===== 关系 =====
    publishers -->|emit| api
    subscribers -->|on / onGroup| api

    api -->|泛型约束| typeSafe
    typeSafe -->|索引| events
    api -->|存储| listeners
    api -->|分组存储| groups

    events -->|包含| g1
    events -->|包含| g2
    events -->|包含| g3
    events -->|包含| g4
    events -->|包含| g5
    events -->|包含| g6
    events -->|包含| g7
    events -->|包含| g8

    %% ===== 样式 =====
    classDef apiLayer fill:#c5e1a5,stroke:#33691e,color:#000
    classDef typeLayer fill:#fff9c4,stroke:#f57f17,color:#000
    classDef storeLayer fill:#ffccbc,stroke:#bf360c,color:#000
    classDef groupLayer fill:#b3e5fc,stroke:#01579b,color:#000
    classDef ext fill:#eceff1,stroke:#607d8b,color:#000

    class on,off,emit,once,onGroup,clearGroup,clearAll,removeEvent apiLayer
    class typeSafe,events typeLayer
    class listeners,groups storeLayer
    class g1,g2,g3,g4,g5,g6,g7,g8 groupLayer
    class publishers,subscribers ext
```

**类型安全设计要点**：

| 设计点 | 说明 |
|--------|------|
| `GameEvents` 枚举 | 按模块分组的事件名常量，避免字符串硬编码 |
| `GameEventPayloadMap` 接口 | 为每个事件定义对应的载荷类型，emit/on 双方通过泛型 `K extends keyof GameEventPayloadMap` 在编译期严格匹配 |
| 无载荷事件 | 使用 `null` 类型（如 `COMBAT_PLAYER_TURN`） |
| 复杂载荷 | 使用具体接口（如 `EnemyInstance`、`LocationData`） |
| 分组管理 | `onGroup` 注册、`clearGroup` 批量清理，便于模块级生命周期管理 |
| 单例模式 | `eventBus` 全局唯一实例，所有模块共享 |

---

## 八、职业差异化系统架构图

项目围绕「职业」建立了一套完整的差异化能力体系，涵盖资源系统、被动技能、天赋树、专属装备、变形与召唤六大子系统。下图展示各子系统如何由职业标识驱动，并与数据文件、角色模块及战斗模块联动。

```mermaid
graph TD
    %% ===== 数据源 =====
    configClasses[config_classes.ts<br/>职业定义]
    classPassives[class_passives.ts<br/>职业被动数据]
    classItems[class_items.ts<br/>职业专属装备]
    classTalents[class_talents.ts<br/>职业天赋数据]
    itemSets[item_sets.ts<br/>套装数据]

    %% ===== 职业核心 =====
    character[character 模块<br/>职业/属性]
    classId[职业标识 classId]

    %% ===== 六大差异化子系统 =====
    resources[资源系统 resources/<br/>Rage/Energy/ComboPoint/<br/>SoulShard/Chi]
    passive[被动技能 usePassiveSkills<br/>+ class_passives]
    talents[天赋树 character/talents/<br/>+ class_talents]
    equip[专属装备 + 套装<br/>equipment + class_items + item_sets]
    forms[变形系统 forms/<br/>德鲁伊专属]
    pets[召唤系统 pets/<br/>术士专属]

    %% ===== 消费方 =====
    combat[combat 战斗模块<br/>消费差异化能力]

    %% ===== 数据加载 =====
    configClasses -->|定义职业| character
    classPassives -->|提供被动| passive
    classItems -->|提供装备模板| equip
    classTalents -->|提供天赋| talents
    itemSets -->|提供套装| equip

    %% ===== 职业驱动差异化 =====
    character -->|classId 驱动| classId
    classId -->|按职业创建| resources
    classId -->|按职业加载| passive
    classId -->|按职业加载| talents
    classId -->|按职业限定| equip
    classId -.->|德鲁伊专属| forms
    classId -.->|术士专属| pets

    %% ===== 子系统间联动 =====
    pets -->|消耗灵魂碎片| resources
    forms -->|形态影响技能| combat
    talents -->|天赋修正属性| character
    equip -->|装备加成| character
    passive -->|触发被动效果| combat

    %% ===== 战斗模块消费 =====
    resources -->|回合消耗/回复| combat
    forms -.->|形态切换| combat
    pets -.->|召唤物参战| combat

    %% ===== 样式 =====
    classDef data fill:#cfd8dc,stroke:#37474f,color:#000
    classDef core fill:#fff9c4,stroke:#f57f17,color:#000
    classDef sub fill:#c5e1a5,stroke:#33691e,color:#000
    classDef consumer fill:#ffe0b2,stroke:#e65100,color:#000

    class configClasses,classPassives,classItems,classTalents,itemSets data
    class character,classId core
    class resources,passive,talents,equip,forms,pets sub
    class combat consumer
```

**子系统与数据源对照**：

| 子系统 | 实现位置 | 数据来源 | 适用职业 |
|--------|----------|----------|----------|
| 资源系统 | `combat/resources/` | `config_classes.ts`（职业资源类型） | 战士-怒气、盗贼-能量/连击点、术士-灵魂碎片、武僧-真气 |
| 被动技能 | `combat/composables/usePassiveSkills.ts` | `class_passives.ts` | 全职业（按职业配置不同被动） |
| 天赋树 | `character/talents/` | `class_talents.ts` | 全职业（按职业配置不同天赋树） |
| 专属装备 | `equipment` + 数据层 | `class_items.ts`、`item_sets.ts` | 全职业（按职业限定装备与套装） |
| 变形 | `combat/forms/` | `forms/druid_forms.ts` | 德鲁伊专属 |
| 召唤 | `combat/pets/` | `pets/warlock_pets.ts` | 术士专属 |

**联动关系说明**：

| 联动 | 说明 |
|------|------|
| 职业 → 子系统 | `classId` 作为驱动因子，决定资源系统类型、可加载的被动/天赋/装备，以及是否启用变形或召唤 |
| 召唤 → 资源 | 术士召唤宠物消耗灵魂碎片，`pets` 与 `resources/SoulShardSystem` 联动 |
| 天赋/装备 → 角色 | 天赋修正角色属性、装备提供加成，最终汇入 `character` 模块作为战斗计算基准 |
| 变形/召唤 → 战斗 | 形态切换通知战斗模块重建先攻；召唤物参战行动由战斗模块驱动 |
| 被动技能 → 战斗 | `usePassiveSkills` 在敌人行动与先攻调度时触发被动效果 |

---

**文档结束**
