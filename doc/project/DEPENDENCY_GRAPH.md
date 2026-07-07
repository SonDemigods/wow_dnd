# 模块依赖关系梳理

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 模块依赖关系梳理 |
| 版本 | v1.0 |
| 生成日期 | 2026年7月6日 |
| 所属目录 | `doc/project/` |
| 关联文档 | MODULE_FUNCTIONS.md、DATA_ARCHITECTURE_OVERVIEW.md |

---

## 概述

本文档基于源码 `import` 关系与 Store Action 调用链，梳理 18 个模块之间的依赖关系，识别循环依赖、跨层调用、隐式耦合等问题，为架构优化提供依据。

依赖关系分为三类：
- **静态依赖**：通过 `import` 引入的类型、函数、Store（编译期确定）
- **运行时依赖**：通过 Store Action 调用、EventBus 发布订阅（运行期发生）
- **数据层依赖**：通过 DbService 跨模块直接查询（绕过 Store）

---

## 一、模块依赖全景图

```mermaid
graph TD
    %% 基础设施层
    data[data 数据核心]
    bus[bus 事件总线]
    base[base 基础数据]
    admin[admin 后台管理]
    audio[audio 音频]
    animation[animation 动画]

    %% 核心数据层
    character[character 角色]
    inventory[inventory 背包]
    equipment[equipment 装备]
    skill[skill 技能]
    quest[quest 任务]

    %% 玩法核心层
    combat[combat 战斗]
    exploration[exploration 探索]
    map[map 地图]
    shop[shop 商店]

    %% 辅助层
    log[log 冒险日志]
    enemy[enemy 敌人]
    boss[boss Boss]

    %% 服务层
    crossModuleQuery[CrossModuleQuery 跨模块查询]
    gameBootstrap[GameBootstrap 初始化编排]
    itemTemplateCache[ItemTemplateCache 物品模板缓存]
    errorHandler[ErrorHandler 错误处理]
    map_db[map/db]
    quest_db[quest/db]
    shop_db[shop/db]
    inventory_db[inventory/db]

    %% 基础设施依赖
    base --> data
    base --> bus
    admin --> data
    admin --> bus
    audio --> bus
    animation --> bus

    %% 核心数据层依赖
    character --> data
    character --> bus
    character --> base
    character --> calculations[utils/calculations]

    inventory --> data
    inventory --> bus
    inventory --> character
    inventory --> equipment_db[equipment/db]

    equipment --> data
    equipment --> bus
    equipment --> character
    equipment --> inventory

    skill --> data
    skill --> bus
    skill --> character

    quest --> data
    quest --> bus
    quest --> character
    quest --> inventory
    quest --> log

    %% 玩法核心层依赖
    combat --> data
    combat --> bus
    combat --> character
    combat --> enemy
    combat --> skill
    combat --> inventory
    combat --> quest
    combat --> log

    exploration --> data
    exploration --> bus
    exploration --> character
    exploration --> inventory
    exploration --> map
    exploration --> crossModuleQuery
    exploration --> log
    exploration -.->|监听COMBAT_END| combat

    map --> data
    map --> bus
    map --> character

    shop --> data
    shop --> bus
    shop --> character
    shop --> inventory
    shop --> log

    %% 辅助层依赖
    log --> data
    log --> bus

    enemy --> data
    enemy --> skill

    boss --> enemy
    boss --> combat
    boss --> bus

    %% 服务层依赖
    crossModuleQuery --> map_db
    crossModuleQuery --> quest_db
    crossModuleQuery --> shop_db
    crossModuleQuery --> itemTemplateCache
    itemTemplateCache --> inventory_db
    gameBootstrap -.->|编排 initialize| character
    gameBootstrap -.->|编排 initialize| inventory
    gameBootstrap -.->|编排 initialize| equipment
    gameBootstrap -.->|编排 initialize| skill
    gameBootstrap -.->|编排 initialize| map
    gameBootstrap -.->|编排 initialize| exploration
    gameBootstrap -.->|编排 initialize| quest
    errorHandler --> useToast[composables/useToast]

    %% 样式
    classDef infra fill:#e1f5fe,stroke:#0288d1
    classDef core fill:#f3e5f5,stroke:#7b1fa2
    classDef gameplay fill:#fff3e0,stroke:#ef6c00
    classDef aux fill:#e8f5e9,stroke:#388e3c
    classDef service fill:#fce4ec,stroke:#c2185b

    class data,bus,base,admin,audio,animation infra
    class character,inventory,equipment,skill,quest core
    class combat,exploration,map,shop gameplay
    class log,enemy,boss aux
    class crossModuleQuery,gameBootstrap,itemTemplateCache,errorHandler service
```

> 说明：虚线表示 EventBus 事件监听或运行时编排调用（如 GameBootstrap → 各 Store initialize）；`xxx_db` 表示直接 import 其他模块的 DbService（跨层数据查询）。服务层（粉色节点）收口跨模块查询与初始化编排。

---

## 二、分层依赖关系

### 2.1 分层架构依赖方向

```mermaid
graph TD
    subgraph L4[UI 组件层]
        GameMain
        CombatPopup
        ExplorationView
        MapView
    end

    subgraph L3[玩法核心层]
        combat
        exploration
        map
        shop
    end

    subgraph L2[核心数据层]
        character
        inventory
        equipment
        skill
        quest
    end

    subgraph L1[基础设施层]
        data
        bus
        base
        log
        enemy
        boss
    end

    subgraph L0[工具与配置]
        calculations[utils/calculations]
        config[config/*]
        dataFiles[data/config_*]
    end

    GameMain --> L3
    GameMain --> L2
    CombatPopup --> combat
    ExplorationView --> exploration
    MapView --> map

    L3 --> L2
    L3 --> L1

    L2 --> L1

    L1 --> L0
    L2 --> L0

    classDef layer fill:#fafafa,stroke:#999
    class L4,L3,L2,L1,L0 layer
```

### 2.2 依赖方向规范

| 方向 | 是否允许 | 说明 |
|------|----------|------|
| 上层 → 下层 | 允许 | UI → 玩法层 → 数据层 → 基础层 |
| 同层之间 | 谨慎 | 玩法层之间通过 EventBus 或 Store 调用 |
| 下层 → 上层 | 禁止 | 基础层不应依赖玩法层 |
| 跨层跳级 | 谨慎 | UI 直接调核心数据层 Store 是允许的 |

---

## 三、模块依赖矩阵

### 3.1 静态依赖矩阵（import 关系）

下表行表示"依赖方"，列表示"被依赖方"。`S` 表示 Store 依赖，`D` 表示 DbService 依赖，`T` 表示类型/工具依赖。

| 依赖方 \ 被依赖方 | data | bus | character | inventory | equipment | skill | quest | log | enemy | map | shop | combat |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| character | S | S | - | - | - | - | - | - | - | - | - | - |
| inventory | S | - | S | - | D | - | - | S | - | - | - | - |
| equipment | S | - | S | S | - | - | - | S | - | - | - | - |
| skill | S | S | S | - | - | - | - | S | - | - | - | - |
| quest | S | S | S | S | - | - | - | S | - | - | - | - |
| combat | S | S | S | S | - | S | S | S | S | - | - | - |
| exploration | S | S | S | S | - | - | D | S | - | D | D | - |
| map | S | S | S | - | - | - | - | - | - | - | - | - |
| shop | S | S | S | S | - | - | - | S | - | - | - | - |
| enemy | S | - | - | - | - | S | - | - | - | - | - | - |
| boss | - | S | - | - | - | - | - | - | S | - | - | S |
| log | S | S | - | - | - | - | - | - | - | - | - | - |

### 3.2 运行时调用矩阵（Store Action 调用）

| 调用方 \ 被调用方 | character | inventory | equipment | skill | quest | log | enemy | combat |
|---|---|---|---|---|---|---|---|---|
| combat | takeDamage/gainExp/gainGold/handleDeath/receiveHeal | useItem/addItem | - | castSkill/tickCooldowns | onEnemyKilled | addLogEntry | createEnemy/takeDamage/deleteEnemy/useSkill | - |
| exploration | takeDamage/receiveHeal/changeMp/gainGold/gainExp | addItem/getItemInfo | - | - | - | addLogEntry | - | - |
| inventory | receiveHeal/changeMp/applyBonus | - | - | - | - | addLogEntry | - | - |
| equipment | applyBonus/removeBonus | addItem | - | - | - | addLogEntry | - | - |
| skill | changeMp/receiveHeal | - | - | - | - | addLogEntry | - | - |
| quest | gainExp/gainGold | addItem | - | - | - | addLogEntry | - | - |
| shop | spendGold/gainGold | addItem/removeItem/getItemInfo | - | - | - | addLogEntry | - | - |

---

## 四、关键依赖链分析

### 4.1 战斗模块依赖链

```mermaid
graph LR
    combat --> character
    combat --> enemy
    combat --> skill
    combat --> inventory
    combat --> quest
    combat --> log
    combat --> boss
    boss --> enemy
    boss --> combat
    enemy --> skill

    character -.->|eventBus| UI
    combat -.->|eventBus| UI
    combat -.->|eventBus| audio
    combat -.->|eventBus| animation
```

**分析**：
- 战斗模块是最复杂的依赖中心，直接依赖 7 个模块
- `boss` 与 `combat` 存在双向依赖（combat 调用 boss 的 initBossFeatures，boss 调用 combat 的 Store）
- 战斗模块通过 composables 拆分缓解了复杂度，但依赖广度不变

#### 4.1.1 战斗子模块依赖

战斗模块拆分为 `resources / forms / pets / effects / ai / composables` 六大子目录，子模块依赖关系如下：

```mermaid
graph LR
    %% ===== 战斗 Store 与子模块 =====
    combatStore[combat/store.ts]
    resources[resources/<br/>ResourceSystemFactory]
    passive[composables/usePassiveSkills]
    forms[forms/<br/>useFormStore 德鲁伊变形]
    pets[pets/<br/>usePetStore 术士召唤]
    ai[ai/<br/>strategies + targetSelection]
    effects[effects/<br/>pipeline/container/handlers]

    %% ===== 跨模块依赖 =====
    character[character]
    skill[skill]

    %% ===== store 对子模块的静态依赖 =====
    combatStore -->|import| resources
    combatStore -->|import| passive
    combatStore -->|组合| effects
    combatStore -->|组合| ai

    %% ===== 被动技能注入关系 =====
    passive -.->|注入| useEnemyAction[useEnemyAction]
    passive -.->|注入| useInitiative[useInitiative]

    %% ===== AI 子系统内部 =====
    ai --> targetSelection[ai/targetSelection<br/>ITargetSelector]
    ai --> strategies[ai/strategies<br/>4 种策略]

    %% ===== 职业差异化子模块对外依赖 =====
    resources -->|按职业创建| character
    forms -->|形态影响属性| character
    forms -->|形态限制技能| skill
    pets -->|召唤物属性| character
    pets -.->|召唤物参战| combatStore

    %% ===== 样式 =====
    classDef storeLayer fill:#fff9c4,stroke:#f57f17,color:#000
    classDef subLayer fill:#c5e1a5,stroke:#33691e,color:#000
    classDef ext fill:#eceff1,stroke:#607d8b,color:#000

    class combatStore storeLayer
    class resources,passive,forms,pets,ai,effects,targetSelection,strategies,useEnemyAction,useInitiative subLayer
    class character,skill ext
```

**子模块职责与依赖说明**：

| 子模块 | 职责 | 对外依赖 |
|--------|------|----------|
| `resources/` | 职业资源系统（怒气/能量/连击点/灵魂碎片/真气），由 `ResourceSystemFactory` 按职业创建 | character（职业判定） |
| `composables/usePassiveSkills` | 被动技能触发逻辑，作为组合式函数注入到敌人行动与先攻调度 | 被注入到 useEnemyAction、useInitiative |
| `forms/` | 德鲁伊变形系统，独立 `useFormStore`，管理形态切换与属性修正 | character、skill |
| `pets/` | 术士召唤系统，独立 `usePetStore`，管理召唤物生成与行动 | character、combatStore |
| `ai/targetSelection` | AI 目标选择策略，抽象为 `ITargetSelector` 接口 | 无外部模块依赖 |
| `effects/` | Buff/Debuff 效果系统（管线-容器-处理器三层结构） | 无外部模块依赖 |

### 4.2 探索模块依赖链

```mermaid
graph LR
    exploration --> character
    exploration --> inventory
    exploration --> log
    exploration --> crossModuleQuery[CrossModuleQuery 服务]
    crossModuleQuery --> map[map/db]
    crossModuleQuery --> quest[quest/db]
    crossModuleQuery --> shop[shop/db]
    crossModuleQuery --> itemCache[ItemTemplateCache]
    itemCache --> inv[inventory/db]
    exploration -.->|COMBAT_END via onGroup| combat
    combat -.->|EXPLORATION_BATTLE_TRIGGERED| exploration
```

**分析**：
- 探索模块通过 EventBus 与战斗模块双向通信（探索触发战斗，战斗结束通知探索）
- 跨层调用已抽取到 `CrossModuleQuery` 服务，探索 Store 仅依赖该服务单例；物品模板查询进一步经 `ItemTemplateCache` 命中内存缓存
- 事件监听使用 `eventBus.onGroup('exploration', ...)` 分组订阅，`dispose` 时 `clearGroup('exploration')` 统一清理

### 4.3 角色模块依赖链

```mermaid
graph LR
    character --> data
    character --> bus
    character --> base
    character --> calculations

    combat --> character
    skill --> character
    inventory --> character
    equipment --> character
    quest --> character
    shop --> character
    exploration --> character
    map --> character
```

**分析**：
- 角色模块是**被依赖最多的模块**（8 个模块依赖它）
- 角色模块本身只依赖基础设施层，依赖方向正确
- 高扇入意味着角色模块的任何改动都会影响全局，需要特别谨慎

---

## 五、循环依赖与耦合问题识别

### 5.1 已识别的循环/双向依赖

| 编号 | 涉及模块 | 依赖类型 | 严重程度 | 描述 |
|------|----------|----------|----------|------|
| C1 | combat ↔ boss | 静态双向 | 中 | combat 调用 boss 的 initBossFeatures，boss 调用 combat 的 Store。通过 `setInitiativeCallback` 注入回调，但双向引用本身仍在 |
| C2 | exploration ↔ combat | 事件双向 | 低 | 通过 EventBus 双向通信（EXPLORATION_BATTLE_TRIGGERED + COMBAT_END）。使用 `onGroup('exploration')` 分组订阅 |
| C3 | inventory ↔ equipment | 静态双向 | 中 | equipment 调 inventory.addItem；inventory 加载装备模板时调 equipmentDbService |
| C4 | combat ↔ skill | 静态双向 | 低 | combat 调 skill.castSkill；skill 的 castSkill 返回伤害供 combat 使用 |

### 5.2 循环依赖详解

#### C1: combat ↔ boss 双向依赖

```mermaid
graph LR
    combat[combat/store.ts] -->|import + 调用| boss[useBossMechanics]
    boss -->|import + 调用| combat[useCombatStore]
    boss -->|import| enemy[enemy/store]
```

**问题**：
- `combat/store.ts` 通过 composables 引入 `useBossMechanics`
- `boss` 模块的 composables 内部又调用 `useCombatStore()` 获取状态
- 这形成了一个紧耦合的循环，boss 模块无法独立测试和复用

**缓解措施**：
- 通过 `boss.setInitiativeCallback(initiative.buildInitiativeOrder)` 显式注入先攻顺序重建回调，boss 不延迟读取全局变量
- 根本上 boss 模块应作为 combat 的子模块，或通过接口解耦（双向引用本身仍在，待后续优化）

#### C3: inventory ↔ equipment 双向依赖

```mermaid
graph LR
    equipment -->|addItem| inventory
    inventory -->|equipmentDbService| equipment_db[equipment/db.ts]
```

**问题**：
- equipment Store 调用 inventory Store 的 addItem（装备卸下时放回背包）
- inventory Store 加载物品模板时，从 equipmentDbService 获取装备模板
- 数据流向不清晰：装备模板既属于 equipment 又被 inventory 引用

---

## 六、跨层调用问题

### 6.1 玩法层直接访问持久层

探索模块的跨层调用已通过 `src/services/CrossModuleQuery.ts` 单例服务收口，探索 Store 仅依赖该服务，不再直接 import 其他模块的 DbService。物品模板查询进一步经 `ItemTemplateCache` 命中内存缓存。

跨模块查询收口情况：

| 调用位置 | 当前被调用方 | 用途 |
|----------|----------|------|
| `buildAreaConfig` | `crossModuleQuery.getAllItemTemplates()` | 构建物品池（经 ItemTemplateCache 缓存） |
| `loadAreaConfig` | `crossModuleQuery.getLocationData()` | 加载地点数据 |
| `getQuestRequiredMonsters` | `crossModuleQuery.getQuestDefinitionsByBoard()` | 获取任务怪物 |
| `pickRandomShop` | `crossModuleQuery.getAllShopConfigs()` | 随机选商店 |

### 6.1.1 CHR-4 character 直接依赖多模块 DbService

`src/modules/character/store.ts` 在角色创建/删除流程中直接 import 了 6 个其他模块的 DbService：

```typescript
// character/store.ts 中的跨层调用（CHR-4，未修复）
import { skillsDbService } from '../skill/db';
import { inventoryDbService } from '../inventory/db';
import { equipmentDbService } from '../equipment/db';
import { explorationDbService } from '../exploration/db';
import { adventureLogDbService } from '../log/db';
import { questDbService } from '../quest/db';
```

**违规点**：
| 调用位置 | 被调用方 | 用途 |
|----------|----------|------|
| `createCharacter` | `skillsDbService.saveSkillsData()` | 初始化角色技能 |
| `createCharacter` | `skillsDbService.getSkillTemplatesByClass()` | 按职业获取技能模板 |
| `deleteCharacter` | `skillsDbService.deleteSkillsData()` | 删除角色技能 |
| `deleteCharacter` | `inventoryDbService.deleteInventory()` | 删除角色背包 |
| `deleteCharacter` | `equipmentDbService.deleteEquipment()` | 删除角色装备 |
| `deleteCharacter` | `explorationDbService.deleteExplorationData()` | 删除探索数据 |
| `deleteCharacter` | `adventureLogDbService.deleteAdventureLog()` | 删除冒险日志 |
| `deleteCharacter` | `questDbService.deleteCharacterQuests()` | 删除任务进度 |

**建议**：将角色级联删除/初始化逻辑抽取到 `CharacterLifecycleService` 之类的服务层，character Store 仅依赖该服务。

### 6.1.2 CHR-5 console 直接依赖多模块 DbService

`src/modules/console.ts`（管理后台入口）直接 import 了 4 个模块的 DbService：

```typescript
// modules/console.ts 中的跨层调用（CHR-5，未修复）
import { enemyDbService } from './enemy';
import { bossDbService } from './boss';
import { inventoryDbService } from './inventory';
import { equipmentDbService } from './equipment';
```

**建议**：管理后台应通过各模块 Store 或统一的 AdminQueryService 访问数据，避免直接穿透到持久层。

### 6.2 Store 初始化顺序耦合

初始化顺序由 `src/services/GameBootstrap.ts` 统一编排，各 Store 的 `init` 仅负责加载自身状态，不再隐式初始化其他 Store。`GameBootstrap.initialize(characterId)` 按依赖顺序初始化（character→log→inventory→equipment→skill→map→exploration→quest），退出角色时 `dispose()` 按逆序清理（含 `eventBus.clearGroup`）。

---

## 七、EventBus 事件依赖图

### 7.1 事件发布订阅关系

```mermaid
graph LR
    %% 发布方
    character_p[角色模块]
    combat_p[战斗模块]
    exploration_p[探索模块]
    quest_p[任务模块]
    shop_p[商店模块]
    skill_p[技能模块]
    log_p[日志模块]
    map_p[地图模块]

    %% 订阅方
    UI[UI 组件]
    audio[音频模块]
    animation[动画模块]
    combat_s[战斗模块]
    exploration_s[探索模块]

    %% 战斗事件
    combat_p -->|COMBAT_START/END/DEAL_DAMAGE...| UI
    combat_p -->|音效事件| audio
    combat_p -->|视觉事件| animation
    combat_p -->|COMBAT_END| exploration_s

    %% 探索事件
    exploration_p -->|EXPLORATION_*| UI
    exploration_p -->|EXPLORATION_BATTLE_TRIGGERED| combat_s

    %% 角色事件
    character_p -->|CHARACTER_LEVEL_UP/DEATH...| UI

    %% 其他
    quest_p -->|QUEST_*| UI
    shop_p -->|SHOP_*| UI
    skill_p -->|SKILL_*| UI
    log_p -->|LOG_ENTRY_ADDED| UI
    map_p -->|ZONE_ENTERED| exploration_s
```

### 7.2 事件依赖统计

| 事件类型 | 发布方 | 订阅方 | 数量 |
|----------|--------|--------|------|
| 战斗事件 | combat | UI、audio、animation、exploration | 11 |
| 探索事件 | exploration | UI、combat | 7 |
| 角色事件 | character | UI | 6 |
| 通用事件 | 多个 | UI | 11 |
| 任务事件 | quest | UI | 4 |
| 商店事件 | shop | UI | 3 |
| 技能事件 | skill | UI | 2 |

---

## 八、依赖关系优化建议

### 8.1 短期优化（低风险）

| 编号 | 问题 | 建议 | 优先级 | 状态 |
|------|------|------|--------|------|
| O9 | character/store.ts 直接依赖 6 个模块 DbService | 抽取 CharacterLifecycleService 收口级联删除/初始化 | 高 | ⏳ 待修复（CHR-4） |
| O10 | modules/console.ts 直接依赖 4 个模块 DbService | 通过各模块 Store 或 AdminQueryService 访问 | 中 | ⏳ 待修复（CHR-5） |

### 8.2 中期优化（中等风险）

| 编号 | 问题 | 建议 | 优先级 |
|------|------|------|--------|
| O4 | boss 与 combat 双向耦合 | 将 boss 作为 combat 的子目录（`combat/boss/`），或定义 IBossContext 接口反向解耦。当前通过 `setInitiativeCallback` 注入回调，但双向引用本身仍在 | 中 |
| O5 | inventory ↔ equipment 双向依赖 | 抽取物品模板统一管理层，equipment 和 inventory 都从该层获取模板 | 中 |
| O6 | combat 模块依赖广度大 | 引入 CombatContext 聚合角色/敌人/技能/背包的查询接口，减少直接依赖 | 低 |

### 8.3 长期优化（高风险）

| 编号 | 问题 | 建议 | 优先级 |
|------|------|------|--------|
| O7 | 模块间直接 Store 调用导致强耦合 | 引入依赖注入容器或服务定位器模式 | 低 |
| O8 | 缺少模块边界强制约束 | 引入 ESLint 规则禁止跨层 import（如 `no-restricted-imports`） | 中 |

详见 [ISSUES.md](./ISSUES.md)。

---

**文档结束**
