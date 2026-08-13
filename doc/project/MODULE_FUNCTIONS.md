# 各模块功能整理

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 各模块功能整理 |
| 版本 | v5.0 |
| 生成日期 | 2026年8月13日 |
| 所属目录 | `doc/project/` |
| 关联文档 | DATA_ARCHITECTURE_OVERVIEW.md、ARCHITECTURE_DIAGRAMS.md、DEPENDENCY_GRAPH.md、各模块设计文档 |
| 更新说明 | admin 模块全面升级：AdminQueryService 从 src/services/ 迁入 modules/admin/queryService.ts（services 目录减至 4 个文件）；admin 模块新增 queryService.ts / referenceGraph.ts / defaultData.ts；CONFIG_TABLES 11→15 张；UI 新增 DashboardPanel / ImportDialog / fields/ 7 子组件 / config-meta/ 3 文件 / composables/ useFormValidation；AdminTable 分页/排序/列显隐/批量选择/行详情/行克隆；AdminForm 表单校验+键盘快捷键；ConfigManager 导出/导入/重置/批量删除。 |

---

## 概述

本文档整理项目 `wow_dnd` 全部 21 个业务模块的功能职责、核心接口、存储表与交互关系，作为后续依赖梳理、架构图、数据流、缺陷分析与升级方案的基线。

模块统一遵循分层架构：`index.ts`（入口）→ `types.ts`（类型）→ `db.ts`（持久层）→ `store.ts`（状态层）→ `service.ts`（纯函数层）。个别模块依据职责裁剪该分层：`game` 模块无 db.ts/service.ts（状态经 data 模块的 gameStateHelper 持久化）；`console` 模块由 `framework.ts`（命令框架）与 `commands/`（命令子模块）构成；`audio` 模块经 QA-6 拆分为 `service.ts`（生命周期协调）+ `effectChains.ts`（节点工厂）+ `synth/`（合成器子目录）。

---

## 一、基础设施层模块

### 1.1 数据核心模块（`modules/data/`）

| 项 | 内容 |
|----|------|
| 定位 | 数据库初始化、全局游戏状态管理、备份导入 |
| 核心职责 | GameDatabase 初始化（继承 Dexie）、DBService 重试封装、DataInitializer 静态数据导入、gameStateHelper 全局状态读写、备份/导入校验 |
| 关键文件 | `core.ts`（GameDatabase + DBService + GameStateStorage）、`initializer.ts`（DataInitializer 数据初始化）、`backup.ts`（BackupService 备份）、`importer.ts`（ImportService 导入）、`service.ts`（re-export 入口，QA-11 拆分）、`gameStateHelper.ts`（getGameState/saveGameState 事务性读改写） |
| 存储表 | 所有表的创建入口；`runtime_gameState`（全局状态，id='gameState'） |
| GameStateStorage | P3-116 修复：新增 `gameSettings` 字段（合并原 audio_settings 键的音频设置）；`settings`、`maxLevel` 字段标记 @deprecated（保留供向后兼容旧存档） |
| 对外接口 | `dbService.withRetry(fn)`、`dataInitializer.initializeData()`、`gameStateHelper.get/set`（getGameState/saveGameState） |
| 依赖模块 | 无（被所有模块依赖） |

### 1.2 事件总线模块（`modules/bus/`）

| 项 | 内容 |
|----|------|
| 定位 | 模块间解耦通信基础设施，**仅用于 UI/音效/通知类事件** |
| 核心职责 | 发布/订阅模式、一次性监听（once）、分组管理（onGroup/clearGroup）、类型安全（GameEventPayloadMap）、错误容错 |
| 关键文件 | `core.ts`（EventBus 类 + eventBus 单例）、`types.ts`（GameEvents 枚举 + PayloadMap） |
| 事件分类 | 角色 6 个、战斗 11 个、探索 8 个、区域 1 个、商店 3 个、任务 4 个、技能 2 个、物品 2 个、UI 5 个、游戏数据 1 个、日志 1 个、存档 2 个（共 46 个） |
| 设计原则 | 数据变更走 Store Action，EventBus 不传递数据变更通知 |
| 依赖模块 | 无（被所有模块依赖） |

### 1.3 基础数据模块（`modules/base/`）

| 项 | 内容 |
|----|------|
| 定位 | 阵营、种族、职业等基础定义数据管理 |
| 核心职责 | 加载 `config_factions`、`config_races`、`config_classes` 配置表，提供查询接口 |
| 依赖模块 | data、bus |
| 被依赖方 | character |

### 1.4 后台管理模块（`modules/admin/`）

| 项 | 内容 |
|----|------|
| 定位 | 配置管理和数据管理后台 |
| 核心职责 | 配置项 CRUD（含分页/排序/搜索）、数据表直管（CONFIG_TABLES 15 张）、批量导入/导出（JSON/CSV）、单表重置默认值、引用完整性检查（referenceGraph）、AdminQueryService 收口控制台跨模块查询 |
| 模块文件 | types.ts / db.ts（getPaged/bulkPut/增强 search）/ service.ts（WRITABLE_TABLES 白名单/getPagedData/resetToDefaults）/ store.ts（分页/排序/导入/重置/ConfigCache 失效）/ queryService.ts / referenceGraph.ts / defaultData.ts |
| UI 组件 | AdminLayout / DashboardPanel / AdminTable（分页/排序/列显隐/批量选择/行详情/行克隆）/ AdminForm（7 个 fields/ 子组件 + useFormValidation 校验）/ ConfigManager / ImportDialog + composables/（useConfigTableMeta / useConfigCrud / useFormValidation）+ config-meta/（columns / formFields / dictionaries） |
| 依赖模块 | data、config |

### 1.5 音频模块（`modules/audio/`）

| 项 | 内容 |
|----|------|
| 定位 | 基于 Tone.js 的音频管理 |
| 核心职责 | BGM 播放、音效触发、organVoice 风琴音色；音频设置收敛至 GameStore.gameSettings（P3-116），本模块仅只读代理 |
| 关键文件 | `service.ts`（audioService，懒加载，生命周期协调与公共 API）、`effectChains.ts`（Tone.js 节点工厂 + 效果链连接 + 动态路由）、`synth/sfxSynth.ts`（52 种 SfxType 音效合成）、`synth/bgmSynth.ts`（6 种 BgmScene 管风琴 BGM 合成）、`organVoice.ts`（管风琴音色合成器）、`store.ts`（useAudioStore）、`types.ts`（SfxType/SfxRoute/BgmScene/AudioSettings/IAudioService/SFX_ROUTE_MAP/DEFAULT_AUDIO_SETTINGS） |
| 合成架构 | QA-6 拆分：`service.ts` 仅保留生命周期协调（init/playSfx/setBgmScene/stopBgm/updateSettings/destroy）；`effectChains.ts` 集中创建全部 Tone.js 节点并建立 6 条 SFX 路由效果链（magic/combat/ui/exploration/character/standard）+ BGM 通道 + 主输出；`synth/sfxSynth.ts` 合成 52 种音效；`synth/bgmSynth.ts` 合成 6 种 BGM 场景（main_menu/exploration/combat/shop/victory/defeat），使用管风琴加法合成（中古调式体系 + 教堂混响） |
| 设置收敛 | P3-116 修复：`db.ts` 已删除；音频设置（masterVolume/sfxVolume/bgmVolume/muted/sfxEnabled/bgmEnabled）统一由 `GameStore.gameSettings` 管理并持久化到 `runtime_gameState` 表；`useAudioStore.settings` 为只读 computed 代理，修改经 `updateSettings()` 委托 `gameStore.updateGameSettings`，持久化由 GameStore 负责 |
| 懒加载 | P3-141 修复：`audioService` 不再从模块入口导出（避免静态引用时拉入 Tone.js，gzip 后约 50KB+），仅由 `main.ts` 通过动态 `import('@/modules/audio/service')` 加载；`OrganVoice` 类同理需直接引用 `organVoice.ts` |
| 依赖模块 | game（GameStore 设置读写）、bus（监听音效事件） |
| Disposable | 实现 `Disposable` 接口，P3-116 后去抖定时器已移除、`dispose()` 为空操作，保留接口供 `gameBootstrap.dispose` 调用 |

### 1.6 动画模块（`modules/animation/`）

| 项 | 内容 |
|----|------|
| 定位 | 战斗效果动画引擎 |
| 核心职责 | 基于 anime.js 的战斗特效、伤害数字、暴击/闪避动画 |
| 关键文件 | `service.ts`（15 个动画函数：animateShake/animateCritShake/animateMagicPulse/animateGlow/animateHealGlow/animateManaGlow/animateCritBorderFlash/animateDodgeBlink/animateFloating/animateScreenFlash/animateVsFlash/createParticleBurst/animateBossIntro/animatePhaseTransition/animateResultPopup，其中 animateHealGlow/animateManaGlow 以 const 箭头函数形式导出）、`types.ts` |
| 依赖模块 | bus（监听战斗视觉事件） |

### 1.7 控制台模块（`modules/console/`）

| 项 | 内容 |
|----|------|
| 定位 | 管理后台命令入口，提供角色/背包/战斗/技能/探索/任务等调试命令，挂载到 `window.cmd` |
| 架构 | 拆分为 `framework.ts`（框架核心：CommandResult/CommandDef/CommandCategory 类型、commands 注册表、exec 解析执行、initConsole 挂载、公共辅助 requireCharacter/switchGameState/logTag/rarityColorKey/resolveCategory）+ `commands/` 命令子模块（7 个命令文件，加载即注册） |
| 命令文件 | `character.ts`（stats/gold/exp/hp/mp/heal/level/resurrect/buff/resetChar）、`inventory.ts`（item/bag/clearBag/equips）、`combat.ts`（spawn/win/flee/kill）、`skill.ts`（skills）、`exploration.ts`（resetExplore/goto/revealAll）、`quest.ts`（quests）、`system.ts`（admin/game/help/shops/log） |
| 使用方式 | `initConsole()` 挂载到 `window.cmd`；`exec('help')` 字符串形式调用 |
| 依赖模块 | `admin 模块（queryService）`（收口跨模块查询，CHR-5 修复） |

### 1.8 游戏全局状态模块（`modules/game/`）

| 项 | 内容 |
|----|------|
| 定位 | 全局游戏状态唯一持有者，收敛原散落在 character/db.ts、shop/db.ts、audio/db.ts 中的 GameState 操作（P3-116） |
| 核心职责 | 统一管理 currentCharacterId/currentShopId/gameSettings/lastPlayedAt/initializedAt 五类全局状态，经 gameStateHelper 持久化到 `runtime_gameState` 表（id='gameState'） |
| 关键文件 | `store.ts`（useGameStore）、`types.ts`（GameSettings/GameRuntimeState/DEFAULT_GAME_SETTINGS） |
| 关键接口 | `initialize()`（迁移旧 audio_settings 键→gameSettings 字段后加载状态）、`setCurrentCharacterId(id)`、`setCurrentShopId(id)`、`updateGameSettings(patch)`（部分更新设置并持久化）、`flushPersist()`（供 audioStore 等 dispose 前 flush）、`getCurrentCharacterId/getCurrentShopId/getGameSettings`（同步查询） |
| 数据迁移 | 初始化时检测旧 `audio_settings` 键记录，合并到 `gameSettings` 字段后删除该键，避免重复迁移；迁移失败不阻断启动 |
| 依赖模块 | data（getGameState/saveGameState/db） |
| 被依赖方 | character（currentCharacterId）、shop（currentShopId）、audio（gameSettings）、exploration（currentCharacterId）、App.vue（initialize） |

### 1.9 服务层（`services/`）

服务层是跨模块协调层，位于 `src/services/` 目录，用于解耦模块间的直接依赖。共 4 个服务（`ItemTemplateCache` 已删除 ARCH-1，`AdminQueryService` 已迁入 `modules/admin/queryService.ts`）。

| 服务 | 文件 | 职责 |
|------|------|------|
| 跨模块查询服务 | `CrossModuleQuery.ts` | 聚合探索模块对 map/inventory/quest/shop 的跨模块查询，避免 Store 直接依赖其他模块的 DbService（EXP-4 修复）；物品模板查询经 `unifiedItemTemplateCache` 统一缓存（ARCH-1）；查询失败降级返回安全默认值（P3-125） |
| 游戏初始化编排 | `GameBootstrap.ts` | 按 4 层并行初始化各 Store（P3-128）：Layer 1 log+inventory 并行 → Layer 1.5 注入全部回调（setInventoryCallbacks/setInventoryExternalCallbacks/setQuestExternalCallbacks/setBossCreateFn）→ Layer 2 equipment+skill+map 并行 → Layer 3 exploration → Layer 4 quest；退出时 `dispose()` 按逆序清理实现 `Disposable` 的 Store（combat/exploration/audio）并清除全部回调引用 |
| 统一错误处理 | `ErrorHandler.ts` | 集中处理错误，提供 `tryAsync`（Result 类型）/ `wrapAsync`（toast+日志）/ `report`（手动上报）三层 API |
| 角色生命周期服务 | `CharacterLifecycleService.ts` | 收口角色创建（`initializeCharacterSkills`）与删除（`cascadeDeleteCharacter`）流程中的跨模块持久化，消除 character Store 对 6 个模块 DbService 的直接依赖（CHR-4 修复） |
| 管理后台查询服务 | `modules/admin/queryService.ts` | 收口控制台命令模块对 enemy/boss/inventory/equipment DbService 的查询依赖，统一管理后台的数据查询入口（CHR-5 修复） |

| 项 | 内容 |
|----|------|
| 定位 | 跨模块协调与服务复用层 |
| 核心职责 | 解耦模块间直接依赖、统一初始化编排、聚合查询、集中错误处理、角色生命周期收口、管理后台查询收口 |
| 设计原则 | 服务层是"无状态"的协调者，不持有业务数据，仅聚合查询和编排调用 |
| Disposable 接口 | `GameBootstrap.ts` 定义 `Disposable` 接口（`dispose(): void`），TypeScript 编译期校验 dispose 签名（ARCH-8 修复） |
| 依赖模块 | 各业务模块的 DbService（仅服务层可直接访问） |
| 被依赖方 | exploration、character、console、GameMain.vue 等业务模块和 UI 组件 |

---

## 二、核心数据模块

### 2.1 角色模块（`modules/character/`）

| 项 | 内容 |
|----|------|
| 定位 | 玩家角色数据核心，管理属性、状态、成长 |
| 核心职责 | 多角色管理（创建/选择/删除/登出）、六大核心属性（str/dex/con/int/wis/cha）、次级属性计算（11 项衍生）、等级成长（MAX_LEVEL=20）、HP/MP 管理、金币管理、装备加成（applyBonus/removeBonus）、死亡复活（损失本级经验，恢复 50% HP/MP） |
| 关键接口 | `createCharacter`、`selectCharacter`、`deleteCharacter`、`gainExp`、`takeDamage`、`receiveHeal`、`changeMp`、`applyBonus`、`removeBonus`、`gainGold`、`spendGold`、`handleDeath`、`resurrect` |
| 存储表 | `char_data`（characterId）；当前角色 ID 经 `gameStore.currentCharacterId` 收敛管理（P3-116），不再由本模块直接读写 `runtime_gameState` |
| 属性计算优先级 | 基础(10) < 种族调整 < 职业调整 < 装备加成 |
| 发布事件 | CHARACTER_CREATED/DELETED/LOGOUT/LEVEL_UP/DEATH/RESURRECTED |
| 依赖模块 | bus、base、data、game（currentCharacterId 经 gameStore 收口，P3-116）、calculations 工具、`CharacterLifecycleService`（角色创建/删除的跨模块持久化，CHR-4 修复） |
| 被依赖方 | combat、skill、inventory、equipment、quest、shop、exploration、map |

| 角色创建流程 | 说明 |
|----------|------|
| 本模块数据 | `characterDbService.saveCharacterData` 保存 char_data |
| 跨模块数据 | `characterLifecycleService.initializeCharacterSkills(id, classId)` 初始化技能（查询模板 + 填充技能栏 + 持久化 char_skills） |

| 角色删除流程 | 说明 |
|----------|------|
| 本模块数据 | `characterDbService.deleteCharacterData` 删除 char_data |
| 跨模块数据 | `characterLifecycleService.cascadeDeleteCharacter(id)` 并行删除 6 个模块数据（Promise.all：skill/inventory/equipment/exploration/log/quest） |

#### 2.1.1 天赋树子模块（`modules/character/talents/`）

职业技能分化系统，每个职业有 3 系天赋，支持天赋点数分配。

| 项 | 内容 |
|----|------|
| 定位 | 职业差异化核心子系统 |
| 核心职责 | 天赋点数管理、天赋节点解锁、天赋效果应用 |
| 关键文件 | `service.ts`（天赋逻辑纯函数）、`store.ts`（天赋状态）、`types.ts`（类型定义）、`index.ts`（入口） |
| 数据来源 | `src/data/config_class_talents.ts`（`CLASS_TALENT_TREES` 常量，13 个职业的天赋树配置） |
| 天赋结构 | 每职业 3 系，每系 3 层（`tier: 1 | 2 | 3`），`Talent.maxRank` 通常为 3-5 |
| 点数规则 | `TALENT_POINT_RULES`：`pointsPerLevel: 2`（每 2 级 1 点）、`basePoints: 0`、`maxPointsPerTalent: 5`（单天赋最多 5 点）、`tier2Requirement: 3`（解锁第 2 层需该系投入 3 点）、`tier3Requirement: 6`（解锁第 3 层需该系投入 6 点） |
| 生命周期 | `initialize(classId, level, savedAllocations)` 加载、`reset()` 清空、`updateLevel(level)` 升级同步 |
| 效果回灌 | `effectSummary` 计算属性输出 statBonuses/damageMultiplier/damageReduction/critBonus/resourceBonuses/specialEffects/skillEnhancements，供 characterStore 与 combatStore 消费 |
| 依赖模块 | character（等级和职业）、combat（天赋效果应用） |

### 2.2 背包模块（`modules/inventory/`）

| 项 | 内容 |
|----|------|
| 定位 | 物品存储与使用基础模块 |
| 核心职责 | 物品增删改查、物品使用（直接调 characterStore）、堆叠管理（MAX_STACK=10）、容量管理（INVENTORY_SIZE=50）、丢弃（单次/批量）、排序（5 维度）、一键整理、搜索、筛选 |
| 关键接口 | `addItem(itemId, quantity)`、`removeItem`、`useItem`、`getItemInfo`、`sortItems`、`organizeInventory`、`searchItems`、`filterItems` |
| 存储表 | `char_inventory`（characterId）、`config_items`（物品模板） |
| 物品类型 | 9 种（gold/potion/scroll/food/material/quest/weapon/armor/misc） |
| 稀有度 | 5 级（common/uncommon/rare/epic/legendary） |
| 依赖模块 | character（使用物品时调 receiveHeal/changeMp/applyBonus）、`item-template`（通过 `unifiedItemTemplateCache` 获取合并后的物品模板，A1/G1 修复）、quest（经 `setInventoryExternalCallbacks` 注入 onItemCollected 回调，ARCH-2） |
| 被依赖方 | combat、shop、quest（通过回调注入）、equipment（通过回调注入）、exploration |

### 2.3 装备模块（`modules/equipment/`）

| 项 | 内容 |
|----|------|
| 定位 | 装备穿戴与属性加成计算 |
| 核心职责 | 6 槽位管理（weapon1/weapon2/armor1-4）、装备穿戴/卸下、类型校验、等级要求、属性加成同步（直接调 characterStore.applyBonus/removeBonus）、稀有度颜色显示 |
| 关键接口 | `equipItem(slot, item)`、`unequipItem(slot)`、`getEquipment`、`getTotalStats`、`canEquip` |
| 存储表 | `char_equipment`（characterId）、`config_equipmentItems`（装备模板） |
| 回调注入 | 导出 `setInventoryCallbacks` / `clearInventoryCallbacks`：装备卸下时放回背包通过注入的 `addItem` 回调完成，不再直接 import `inventory/store`（A1/G1 修复）。由 `gameBootstrap.initialize` 在 inventory 初始化后注入，`dispose` 时清除 |
| 依赖模块 | character（applyBonus/removeBonus）、inventory（通过 `setInventoryCallbacks` 回调注入，非静态依赖） |
| 被依赖方 | 无（消费方为 UI） |

### 2.4 技能模块（`modules/skill/`）

| 项 | 内容 |
|----|------|
| 定位 | 技能学习、技能栏配置、技能使用 |
| 核心职责 | 技能学习（等级解锁）、4 槽位技能栏（装备/卸下/交换）、技能施放（消耗 MP）、6 种技能类型、冷却管理、职业技能模板加载、怪物技能支持 |
| 关键接口 | `castSkill`、`equipSkill`、`unequipSkill`、`swapSkills`、`tickCooldowns`、`resetCooldowns`、`checkLevelUnlocks` |
| 存储表 | `char_skills`（characterId）、`config_skills`（技能模板） |
| 技能类型 | 6 种（physical_damage/magic_damage/health_restore/mana_restore/buff/debuff） |
| 目标类型 | single/all_enemies/self/ally |
| 发布事件 | SKILL_CAST、SKILL_LEARNED |
| 依赖模块 | character（changeMp/receiveHeal）、combat（castSkill 返回伤害） |
| 被依赖方 | combat（经 ICombatContext.skill 代理）、character（初始化技能）、enemy（敌人技能） |

### 2.5 任务模块（`modules/quest/`）

| 项 | 内容 |
|----|------|
| 定位 | 任务发布、接受、进度追踪、奖励发放 |
| 核心职责 | 任务定义管理（config_quests）、任务实例管理（char_quests）、进度追踪（击杀/收集）、自动奖励发放、任务看板交互、任务放弃 |
| 关键接口 | `acceptQuest`、`onEnemyKilled`、`onItemCollected`、`claimReward`、`abandonQuest`、`getQuestsFromBoard`、`turnInQuestToBoard` |
| 存储表 | `config_quests`（questId）、`char_quests`（[characterId+questId] 复合键） |
| 任务状态 | 6 种（not_available/available/in_progress/completed/turned_in/abandoned） |
| 任务类型 | 2 种（kill/collect） |
| 发布事件 | QUEST_ACCEPTED/COMPLETED/REWARDED、QUEST_BOARD_OPENED |
| 依赖模块 | character（gainExp/gainGold）、inventory（经 `setQuestExternalCallbacks` 注入 getInventoryItemCount/addItemToInventory 回调，ARCH-2）、log |
| 被依赖方 | combat（onEnemyKilled）、inventory（onItemCollected）、exploration（任务板） |

### 2.6 统一物品模板层（`modules/item-template/`）

| 项 | 内容 |
|----|------|
| 定位 | 聚合 `config_items`（普通物品）与 `config_equipmentItems`（装备）的统一查询层，消除 inventory ↔ equipment 双向依赖（A1/G1 修复） |
| 核心职责 | 物品模板聚合查询、装备转物品格式（`convertEquipmentToItem`）、模板合并（`mergeItemTemplates`）、统一缓存（`unifiedItemTemplateCache`） |
| 关键文件 | `db.ts`（`ItemTemplateDbService` 聚合查询）、`service.ts`（`convertEquipmentToItem` / `mergeItemTemplates` 纯函数）、`cache.ts`（`UnifiedItemTemplateCacheService` 懒加载缓存）、`types.ts`、`index.ts` |
| 存储表 | 无（只读聚合层，委托 `inventoryDbService` 与 `equipmentDbService` 查询） |
| 对外接口 | `unifiedItemTemplateCache.getAll()` / `getById(id)` / `invalidate()`、`convertEquipmentToItem`、`mergeItemTemplates`、`itemTemplateDbService` |
| 依赖方向 | `item-template → inventory/db + equipment/db`（单向，无循环） |
| 被依赖方 | inventory（通过 `unifiedItemTemplateCache` 获取合并模板）、CrossModuleQuery（ARCH-1 修复后统一走此缓存） |
| 与 services 层缓存的区别 | `services/ItemTemplateCache.ts` 已删除（ARCH-1），物品模板缓存职责统一收归本模块的 `unifiedItemTemplateCache`（合并普通物品 + 装备），不再存在 services 层双重缓存 |

---

## 三、玩法核心模块

### 3.1 战斗模块（`modules/combat/`）

| 项 | 内容 |
|----|------|
| 定位 | 回合制战斗核心玩法，处理战斗全流程 |
| 核心职责 | 速度制先攻回合、多敌人战斗（3×2 网格，最多 6 个）、玩家单动作、伤害管线（基础伤害→攻击方修正→防御方修正→护盾/反伤，阶段 1 接入 stat_modifier 类被动，P3-146）、13 种资源类型（12 个资源系统实现）、15 种效果处理器（8 个 handler 文件）、4 种 AI 策略 + 3 种目标选择器、德鲁伊变形、术士宠物、Boss 多阶段、战利品分配、战斗日志持久化、1x/2x 速度切换 |
| 架构特色 | 14 个 composables 拆分（useCombatState/useCombatLog/useBossMechanics/useEnemyAction/useInitiative/usePlayerAction/usePassiveSkills/usePlayerSkill/usePlayerItem/useLootHandler/useCombatSpeed/useCombatAutoClose/useBossIntroOverlay/useCombatAnimations）、`combatContext.ts`（ICombatContext 上下文工厂，S2 修复）、effects 子系统（pipeline+container+handler）、ai 子系统（strategies+targetSelection）、resources 子系统（职业资源）、forms 子系统（德鲁伊变形）、pets 子系统（术士召唤） |
| ICombatContext | `createCombatContext()` 是 combat 模块内唯一引用 6 个外部 Store（character/skill/enemy/quest/log/inventory）的位置。拆分为 `ICombatQuery`（只读）与 `ICombatCommand`（写入），composable 可按需声明读/写意图（S2 修复） |
| IBossContext | combat/store.ts 实现 `IBossContext` 接口（`getPlayerName`/`createMinion`/`rebuildInitiativeOrder`）并注入到 `useBossMechanics`，boss 不再直接 import combat Store（S3 修复） |
| 关键接口 | `startCombat(enemies)`、`playerAction(action)`、`enemyTurn()`、`endCombat(result)`、`skipTurn()`、`toggleCombatSpeed()`、`canCastSkill`、`consumeSkillResource` |
| 存储表 | `runtime_combatLogs`（combatId） |
| AI 策略 | aggressive（50% 技能）、defensive（HP<40% 治疗，20% 技能）、balanced（HP<50% 60% 治疗，30% 技能）、boss_phase（HP<20% 狂暴必定技能；半血以下激进模式 60% 技能） |
| 伤害公式 | `floor(attack × 0.4) + random(0-9)`，防御减免 `min(baseDamage × 0.3, defense)`，暴击 1.5x，逃跑 `0.5 + dex × 0.01`；AOE 每目标伤害 = 面板伤害 × 玩家 0.7 / 敌方 0.8（P3-147，常量抽离至 `@/config/combat`） |
| Disposable | 实现 `Disposable` 接口，`dispose()` 清理战斗定时器（turnTimerId / bossIntroTimerId），由 `gameBootstrap.dispose` 调用 |
| 发布事件 | COMBAT_START/END/PLAYER_TURN/ENEMY_TURN/DEAL_DAMAGE/CAST_HEAL/CRITICAL_HIT/DODGE/SKIP_TURN/BOSS_INTRO/BOSS_PHASE |
| 依赖模块 | character、enemy、skill、inventory、quest、log、bus（经 `ICombatContext` 代理，非直接 import） |
| 被依赖方 | exploration（触发战斗） |

#### 3.1.1 资源系统子模块（`modules/combat/resources/`）

职业专属资源系统，替代统一的 MP 消耗模式，实现职业差异化。

| 项 | 内容 |
|----|------|
| 定位 | 职业专属战斗资源管理（13 种资源类型） |
| 核心职责 | 资源生成/消耗/查询、战斗事件钩子（onAttack/onDamaged/onKill/onTurnStart/onTurnEnd） |
| 关键文件 | `BaseResourceSystem.ts`（抽象基类）、`ResourceSystemFactory.ts`（工厂）、`types.ts`（ResourceType/ResourceSource/ResourceSystem/ResourceSystemFactoryMap）、12 个具体实现类 |
| 资源类型 | 13 种：rage（战士怒气）、energy（潜行者能量）、combo_point（连击点）、soul_shard（术士灵魂碎片）、chi（武僧真气）、focus（猎人集中值）、holy_power（圣骑士神圣）、runic_power（亡灵骑士符能）、rune（符文）、fury（影刃猎手怒火）、soul（灵魂）、essence（龙脉术士精华）、mana（法师/牧师/萨满/德鲁伊默认回退资源） |
| 职业映射 | warrior→rage；rogue→energy+combo_point；warlock→soul_shard（主资源 MP）；monk→energy+chi；hunter→focus；paladin→holy_power（+MP 治疗辅助，P3-148）；death_knight→runic_power+rune；demon_hunter→fury+soul；evoker→essence（+MP 应急治疗，P3-148）；mage/priest/shaman/druid→回退 MP |
| MP 替代 | `MANA_REPLACING_TYPES`（rage/energy/focus/runic_power/fury）完全替代 MP，UI 隐藏 MP 条；holy_power/soul_shard/essence 为双资源设计（专属资源用于核心输出，MP 用于治疗/应急），保留 MP 条 |
| 资源接口 | `generate(amount, source)`、`consume(amount)`、`hasEnough(amount)`、`reset()`，暴露 `valueRef`/`maxValueRef` 响应式引用供 UI 绑定资源条 |
| 集成位置 | 战斗 Store 的 `startCombat` 初始化、`endCombat` 调用 `onKill`、`playerAction` 检查和消耗资源 |

#### 3.1.2 被动技能子模块（`modules/combat/composables/usePassiveSkills.ts`）

职业被动技能系统，在战斗中自动触发职业特色效果。

| 项 | 内容 |
|----|------|
| 定位 | 职业专属被动技能触发 |
| 核心职责 | 监听战斗事件、触发被动效果（资源生成/减伤/治疗/属性修改/增益） |
| 数据来源 | `src/data/config_class_passives.ts`（`CLASS_PASSIVES` 常量，13 个职业各 3 个被动技能，共 39 个） |
| 触发时机 | on_combat_start、on_turn_start、on_attack、on_damaged、on_low_hp、on_kill、passive（持续） |
| 效果类型 | stat_modifier（属性修改，P3-146 已通过 `getStatModifiers()` 接入伤害管线与暴击判定，如法师奥术精通、猎手精准）、resource_gen（资源生成，直接调 resourceSystems.generate）、damage_reduction（减伤，经 `getDamageReduction()` 供 applyEnemyDamageToPlayer）、heal（治疗，on_attack 按伤害百分比吸血/按最大生命百分比治疗）、buff（增益，P3-146 已通过 `applyBuff()` 写入 EffectContainer，如术士腐蚀术 DOT） |
| 集成点 | combatStore.startCombat 调 onCombatStart；playerAction 调 onAttack；useEnemyAction.applyEnemyDamageToPlayer 调 onDamaged；useInitiative.advanceToNextUnit 调 onTurnStart；endCombat 胜利调 onKill |

#### 3.1.3 德鲁伊变形子模块（`modules/combat/forms/`）

德鲁伊形态切换系统，不同形态有不同的属性和技能。

| 项 | 内容 |
|----|------|
| 定位 | 德鲁伊职业机制实现 |
| 核心职责 | 形态切换、属性修改、技能解锁/锁定 |
| 关键文件 | `druidForms.ts`（DRUID_FORMS 形态配置 + DEFAULT_FORM）、`service.ts`（切换逻辑 13 个纯函数）、`store.ts`（useFormStore 形态状态）、`types.ts`（FORM_SWITCH_CONFIG 切换配置） |
| 形态类型 | 人形（humanoid）、熊（bear，高生命高防御）、猎豹（cat，高敏捷高暴击）、枭兽（moonkin，智力加成） |
| 切换机制 | 变形消耗 1 回合（FORM_SWITCH_CONFIG），变形时恢复 10% 生命（calculateFormSwitchHeal） |

#### 3.1.4 术士召唤子模块（`modules/combat/pets/`）

术士召唤物系统，消耗灵魂碎片召唤恶魔协助战斗。

| 项 | 内容 |
|----|------|
| 定位 | 术士职业机制实现 |
| 核心职责 | 召唤物管理、召唤物 AI、召唤物行动 |
| 关键文件 | `warlockPets.ts`（WARLOCK_PETS 召唤物配置）、`service.ts`（召唤逻辑 21 个纯函数）、`store.ts`（usePetStore 召唤物状态）、`types.ts`（PET_SUMMON_CONFIG/PET_AI_TARGET_PRIORITY） |
| 召唤物类型 | 小鬼（imp，远程火系）、虚空行者（voidwalker，坦克）、魅魔（succubus，控制）、地狱犬（felhunter，反法师）、末日守卫（doomguard，终极召唤） |
| 消耗机制 | 召唤消耗灵魂碎片（soulShardCost：imp/voidwalker 1、succubus/felhunter 2、doomguard 3）与 1 回合行动点（actionPointCost） |
| AI 策略 | 召唤物有独立 AI（aggressive/defensive/caster/controller），按 PET_AI_TARGET_PRIORITY 选择目标（aggressive→lowest_hp 等） |

#### 3.1.5 AI 子系统（`modules/combat/ai/`）

AI 目标选择系统，替代简单的"攻击玩家"逻辑。

| 项 | 内容 |
|----|------|
| 定位 | 战斗 AI 策略与目标选择 |
| 核心职责 | 4 种 AI 策略（strategies.ts）+ 3 种目标选择器（targetSelection.ts） |
| 策略 | AggressiveStrategy（激进）、DefensiveStrategy（防御）、BalancedStrategy（均衡）、BossPhaseStrategy（Boss 狂暴） |
| 选择器 | ThreatBasedTargetSelector（基于威胁）、RandomTargetSelector（随机，构造函数注入 Rng 支持确定性回放）、LowestHpTargetSelector（最低血量） |
| 注册机制 | `selectorRegistry` Map 注册，`getTargetSelector(name)` 获取（未知名称回退 threat_based） |
| 接口 | `ITargetSelector`（selectTarget 方法）、`IAiStrategy`、`BattleContext`、`AiDecision` |

### 3.2 探索模块（`modules/exploration/`）

| 项 | 内容 |
|----|------|
| 定位 | 10×10 网格探索玩法，连接战斗/商店/任务 |
| 核心职责 | 网格生成（固定 5 格 + 概率分配）、格子翻开、事件触发（怪物/Boss/宝物/陷阱/事件/营地）、商店/任务板入口、战斗结果处理、UI 回调机制 |
| 关键接口 | `init`、`enterArea`、`revealGrid(x,y)`、`onBattleResult`、`triggerBattle`、`useCamp`、`registerUICallbacks` |
| 存储表 | `char_exploration`（characterId）；当前角色 ID 经 `gameStore.currentCharacterId` 读取（P3-116） |
| 格子类型 | 10 种（start/shop/board/rest/boss/monster/treasure/trap/event/empty） |
| 事件概率 | 动态计算（monster 20-30、item 15-25、trap 12-22、event 15、empty 15-30，按等级归一化） |
| 完成条件 | 击败 Boss 或探索全部 100 格 |
| events.ts 注册表 | 即时结算路径通过 `events.ts` 注册表分发：`cellEventHandlers`（treasure/trap/event/rest 四种）按 `CellType` 查找；`effectHandlers`（heal/mana/exp/damage/mpLoss/gold 六种）按 `RandomEventEffectType` 查找。新增事件类型只需在 `events.ts` 注册处理器，无需修改 store.ts（ARCH-11 修复） |
| UI 回调 | onCellExplored/onBattleTriggered/onItemFound/onTrapTriggered/onRandomEvent/onMultiOptionEvent（替代 EventBus 数据事件） |
| Disposable | 实现 `Disposable` 接口，`dispose()` 清理 EventBus 监听器（`clearGroup('exploration')`）与 UI 回调，由 `gameBootstrap.dispose` 调用 |
| 发布事件 | EXPLORATION_START/END/CELL_EXPLORED/BATTLE_TRIGGERED/CAMP_USED/ITEM_FOUND/TRAP_TRIGGERED/RANDOM_EVENT |
| 依赖模块 | map、character、inventory、quest、shop、log、bus、game（currentCharacterId）、`crossModuleQuery`（跨模块查询收口）、combat（监听 COMBAT_END） |
| 被依赖方 | map（进入区域触发） |

### 3.3 地图模块（`modules/map/`）

| 项 | 内容 |
|----|------|
| 定位 | 世界地图视图、区域解锁、探索入口 |
| 核心职责 | 地图缩放（1-5 级）平移、地点数据管理、区域状态判定（locked/unlocked/completed）、进入区域触发、标签页持久化 |
| 关键接口 | `initialize`、`enterZone`、`getZones`、`isLocationUnlocked`、`zoomTo`、`panTo`、`saveCurrentTab` |
| 存储表 | `config_locations`（locationId）、`runtime_mapState`（map_${characterId}） |
| 依赖模块 | bus、character（等级判断） |
| 被依赖方 | exploration（ZONE_ENTERED 事件触发 enterArea） |

### 3.4 商店模块（`modules/shop/`）

| 项 | 内容 |
|----|------|
| 定位 | 商品随机刷新、购买出售、回购机制 |
| 核心职责 | 商店配置管理、商品随机生成（按类型过滤物品池）、购买（金币校验+背包校验）、出售（回收价计算）、定时刷新、回购追踪 |
| 关键接口 | `openShop`、`buyItem`、`sellItem`、`closeShop`、`refreshShop`、`calculateSellPrice` |
| 存储表 | `config_shops`（shopId）、`runtime_shopItems`（shopId）、`runtime_shopSoldItems`（回购记录）；当前商店 ID 经 `gameStore.currentShopId` 收敛管理（P3-116） |
| 商店类型 | 5 种（general/potion/scroll/food/material） |
| 价格体系 | 买入价 = `value × RARITY_PRICE_MULTIPLIER`；卖出价 = `买入价 × RARITY_SELL_DISCOUNT` |
| 发布事件 | SHOP_OPENED/CLOSED/TRANSACTION |
| 依赖模块 | character（spendGold/gainGold）、inventory（addItem/removeItem）、log、game（currentShopId） |
| 被依赖方 | exploration（探索中商店） |

---

## 四、辅助模块

### 4.1 冒险日志模块（`modules/log/`）

| 项 | 内容 |
|----|------|
| 定位 | 游戏事件记录与查询，被所有模块调用 |
| 核心职责 | 11 种日志类型、头部插入（时间倒序）、按类型筛选、清除、watch/subscribe 通知 |
| 关键接口 | `initialize`、`addLogEntry`、`addLogByType`、`getLogs`、`getLogsByType`、`clearLogs`、`subscribe` |
| 存储表 | `runtime_adventureLogs`（characterId） |
| 日志类型 | info/combat/quest/item/level/death/resurrect/shop/skill/exploration/zone |
| 发布事件 | LOG_ENTRY_ADDED |
| 依赖模块 | bus、data |
| 被依赖方 | 几乎所有模块（combat/quest/character/inventory/shop/exploration/skill/map） |

### 4.2 敌人模块（`modules/enemy/`）

| 项 | 内容 |
|----|------|
| 定位 | 敌人实例管理，为战斗模块提供敌人数据 |
| 核心职责 | 敌人创建（template+level）、伤害计算、状态管理、敌人 CRUD |
| 关键接口 | `createEnemy`、`getEnemyById`、`calculateDamage`、`takeDamage`、`deleteEnemy`、`getAvailableSkills`、`useSkill` |
| 存储表 | 内存管理（不持久化） |
| Boss 创建回调 | 导出 `setBossCreateFn(fn)`：Boss 实例创建经回调注入由 boss 模块提供，切断 enemy → boss 静态反向依赖（TS-2 修复），由 `gameBootstrap.initialize` 注入、`dispose` 时置空 |
| 依赖模块 | data（模板）、skill（敌人技能） |
| 被依赖方 | combat（经 ICombatContext.enemy 代理）、boss |

### 4.3 Boss 模块（`modules/boss/`）

| 项 | 内容 |
|----|------|
| 定位 | Boss 战斗引擎、入场演出、阶段管理 |
| 核心职责 | Boss 出场演出、多阶段转换、专属机制（眩晕/沉默/召唤/范围攻击）、intro 台词 |
| 关键文件 | `engine.ts`（executeBossMechanic/processBossPhaseMechanics/applyPhaseStats）、`phaseManager.ts`（BossPhaseManager）、`service.ts`（createBossInstance/wrapAsBossInstance）、`db.ts`（BossDbService） |
| IBossContext 解耦 | `useBossMechanics` 通过 `IBossContext` 接口注入外部依赖（`getPlayerName`/`createMinion`/`rebuildInitiativeOrder`），不再直接 import `useCharacterStore` 和 `useEnemyStore`（S3 修复）。`rebuildInitiativeOrder` 替代了原 `setInitiativeCallback` hack |
| 依赖模块 | enemy、bus |
| 被依赖方 | combat（Boss 战时调用，经 IBossContext 接口注入） |

---

## 五、模块功能矩阵速查

### 5.1 模块层级分类

| 层级 | 模块 | 数量 |
|------|------|------|
| 基础设施层 | data、bus、base、admin、audio、animation、console、game | 8 |
| 核心数据层 | character、inventory、equipment、skill、quest、item-template | 6 |
| 玩法核心层 | combat、exploration、map、shop | 4 |
| 辅助层 | log、enemy、boss | 3 |
| 服务层 | CrossModuleQuery、GameBootstrap、ErrorHandler、CharacterLifecycleService（AdminQueryService 已迁入 modules/admin/queryService.ts） | 4 + 1 |
| **合计** | — | **26**（21 个业务模块 + 4 个 src/services/ 服务 + 1 个 admin 模块内服务） |

> 说明：业务模块总数 21 个（含 `game`、`item-template`、`console`）；服务层 4 个独立于业务模块之外（`AdminQueryService` 已迁入 `modules/admin/`）。

### 5.2 数据库表分类

| 表类型 | 前缀 | 表数量 | 说明 |
|--------|------|--------|------|
| 配置表 | `config_` | 15 | 全局共享，游戏定义数据（含 DATA-4 新增 config_class_equipment/config_class_passives/config_class_talents/config_set_definitions 4 张职业专属数据表） |
| 角色表 | `char_` | 6 | 按 characterId 隔离，角色专属 |
| 运行时表 | `runtime_` | 6 | 全局状态或日志（含 runtime_shopSoldItems 回购记录） |

### 5.3 EventBus 事件统计

| 模块 | 事件数量 | 主要用途 |
|------|----------|----------|
| 战斗 | 11 | UI 动画/音效/伤害数字 |
| 探索 | 8 | UI 回调/音效 |
| 角色 | 6 | 升级/死亡/复活通知 |
| 任务 | 4 | 任务状态通知 |
| 商店 | 3 | 交易通知 |
| 技能 | 2 | 施放/学习通知 |
| 物品 | 2 | 掉落/背包已满通知 |
| UI | 5 | 面板开关/点击/确认框 |
| 区域 | 1 | 进入区域通知 |
| 游戏数据 | 1 | 数据更新通知 |
| 日志 | 1 | 日志条目通知 |
| 存档 | 2 | 导出/导入通知 |
| **合计** | **46** | — |

### 5.4 服务层速查

| 服务 | 修复编号 | 消费方 | 核心方法 |
|------|----------|--------|----------|
| `CrossModuleQuery` | EXP-4 / ARCH-1 | explorationStore | `getLocationData`、`getAllItemTemplates`（经 unifiedItemTemplateCache）、`getAllShopConfigs`、`getQuestDefinitionsByBoard` |
| `GameBootstrap` | EXP-5 / P3-128 | GameMain.vue | `initialize(characterId)`、`dispose()` |
| `ErrorHandler` | — | 全模块 Store | `tryAsync`、`wrapAsync`、`report` |
| `CharacterLifecycleService` | CHR-4 | characterStore | `initializeCharacterSkills`、`cascadeDeleteCharacter` |
| `AdminQueryService` | CHR-5 | console | `queryAllItemTemplates`、`queryItemTemplate`、`queryAllEnemyTemplates`（位于 `modules/admin/queryService.ts`） |

### 5.5 Disposable 接口实现

| Store | dispose 清理内容 | 调用方 |
|-------|------------------|--------|
| `useCombatStore` | 清理战斗定时器（turnTimerId / bossIntroTimerId） | `gameBootstrap.dispose()` |
| `useExplorationStore` | 清理 EventBus 监听器（`clearGroup('exploration')`）与 UI 回调 | `gameBootstrap.dispose()` |
| `useAudioStore` | P3-116 后无资源需清理（原 saveTimer 去抖定时器已移除），空操作保留接口 | `gameBootstrap.dispose()` |

> 新增可释放 Store 时将其加入 `gameBootstrap.dispose()` 的 disposables 列表，TypeScript 在编译期校验 dispose 方法签名（ARCH-8 修复）。

---

## 六、模块功能边界与职责确认

### 6.1 跨模块通信机制统一原则

1. **数据变更**：通过直接调用 Store Action（如 `characterStore.takeDamage()`）
2. **UI/音效通知**：通过 EventBus 发布事件（如 `COMBAT_DEAL_DAMAGE`）
3. **跨模块数据查询**：通过服务层聚合（如 `crossModuleQuery` / `adminQueryService`）
4. **UI 组件回调**：通过 registerUICallbacks 注册（仅探索模块使用）
5. **上下文注入**：combat 模块通过 `ICombatContext` 聚合外部 Store（S2），boss 模块通过 `IBossContext` 接口注入（S3）
6. **回调注入**：equipment 模块通过 `setInventoryCallbacks` 接收 inventory 的 addItem/removeItem 回调（A1/G1）；inventory ↔ quest 通过 `setInventoryExternalCallbacks` / `setQuestExternalCallbacks` 双向回调切断循环依赖（ARCH-2）
7. **角色生命周期**：角色创建/删除的跨模块持久化通过 `CharacterLifecycleService` 收口（CHR-4）
8. **注册表分发**：探索事件处理器集中在 `events.ts` 注册表（ARCH-11）
9. **全局状态收敛**：currentCharacterId/currentShopId/gameSettings 等全局状态统一由 `GameStore` 管理并经 gameStateHelper 持久化，各模块只读 computed 代理（P3-116）
10. **懒加载解耦**：audioService 经动态 import 懒加载，避免静态引用拉入 Tone.js（P3-141）

### 6.2 已识别的职责边界问题（全部已修复）

| 问题 | 涉及模块 | 修复方案 | 修复编号 | 状态 |
|------|----------|----------|----------|------|
| Store 初始化顺序耦合 | exploration → log/inventory | `GameBootstrap` 统一编排初始化（4 层并行：log+inventory → equipment+skill+map → exploration → quest），各 Store init 仅加载自身状态 | EXP-5 / P3-128 | ✅ 已修复 |
| DbService 跨模块直接调用（探索） | exploration → map/inventory/quest/shop | `CrossModuleQuery` 收口跨模块查询 | EXP-4 | ✅ 已修复 |
| combatListenerRegistered 全局标志 | exploration | `Disposable` 接口 + `clearGroup('exploration')` 统一清理 | ARCH-8 | ✅ 已修复 |
| Boss 模块与 combat 耦合 | boss ↔ combat | `IBossContext` 接口注入解耦 | S3 | ✅ 已修复 |
| character 直接依赖 6 个模块 DbService | character → skill/inventory/equipment/exploration/log/quest | `CharacterLifecycleService` 收口级联删除/初始化 | CHR-4 | ✅ 已修复 |
| console 直接依赖 4 个模块 DbService | console → enemy/boss/inventory/equipment | `AdminQueryService`（`modules/admin/queryService.ts`）收口查询 | CHR-5 | ✅ 已修复 |
| inventory ↔ equipment 双向依赖 | inventory ↔ equipment | `item-template` 模块（`unifiedItemTemplateCache`）+ `setInventoryCallbacks` 回调注入 | A1/G1 | ✅ 已修复 |
| inventory ↔ quest 循环依赖 | inventory ↔ quest | `setInventoryExternalCallbacks` / `setQuestExternalCallbacks` 双向回调注入 | ARCH-2 | ✅ 已修复 |
| combat 直接 import 6 个外部 Store | combat → character/skill/enemy/quest/log/inventory | `ICombatContext`（`ICombatQuery` + `ICombatCommand` 读写分离）收口 | S2 | ✅ 已修复 |
| 探索事件处理器分散在 switch 语句 | exploration/store.ts | `events.ts` 注册表模式分发（`cellEventHandlers` + `effectHandlers`） | ARCH-11 | ✅ 已修复 |
| dispose 使用 `as unknown as` 断言 | GameBootstrap | `Disposable` 接口，TypeScript 编译期校验 dispose 签名 | ARCH-8 | ✅ 已修复 |
| 音频设置分散持久化（audio/db.ts 的 audio_settings 键） | audio | GameStore 收敛 gameSettings 字段，删除 audio/db.ts，初始化时迁移旧键（P3-116） | P3-116 | ✅ 已修复 |
| services 层与 item-template 双重物品模板缓存 | services / item-template | 删除 `services/ItemTemplateCache.ts`，统一由 `unifiedItemTemplateCache` 提供（含普通物品 + 装备合并模板） | ARCH-1 | ✅ 已修复 |

---

## 版本历史

| 版本 | 日期 | 作者 | 变更摘要 |
|------|------|------|----------|
| v2.0 | 2026-07-10 | — | 模块数量从 18 个更新为 19 个（新增 item-template 统一物品模板层）；服务层补全为 6 个服务（新增 CharacterLifecycleService、AdminQueryService）；天赋树/被动技能数据来源修正为 config 层；战斗补充 combatContext.ts 与 IBossContext 接口注入说明 |
| v3.0 | 2026-08-03 | System | 模块数量从 19 个更新为 21 个（新增 game 全局游戏状态模块，P3-116）；服务层 6 个减为 5 个（删除 ItemTemplateCache，ARCH-1）；音频 db.ts 删除、设置收敛 GameStore、audioService 懒加载（P3-141）；战斗资源系统扩至 13 种资源类型（P3-148）、效果管线 8 handler 文件（P3-146）、AOE 常量 0.7/0.8（P3-147）；控制台拆分为 console/commands/ 7 个命令文件；GameBootstrap 4 层并行初始化（P3-128）；数据库表修正为 config_ 15 / char_ 6 / runtime_ 6；EventBus 事件修正为 46 个 |
| v4.0 | 2026-08-03 | System | 音频模块补充 QA-6 拆分架构（service.ts 生命周期协调 + effectChains.ts 节点工厂/效果链 + synth/sfxSynth.ts 52 种音效 + synth/bgmSynth.ts 6 种 BGM 场景，SfxType 52 种、SfxRoute 6 条）；动画函数数量修正为 15 个（animateHealGlow/animateManaGlow 为 const 导出，原 14 个为笔误）；数据模块关键文件修正（QA-11 拆分 initializer/backup/importer，service.ts 为 re-export 入口）；探索模块移除过时的「步数限制（初始 20 步）」描述；game/console/item-template/admin 模块、services 5 个服务、数据库表 15/6/6、EventBus 事件 46 个经源码核实与 v3.0 一致 |
| v5.0 | 2026-08-13 | System | admin 模块全面升级：AdminQueryService 从 src/services/ 迁入 modules/admin/queryService.ts（services 目录减至 4 个文件）；admin 模块新增 queryService.ts / referenceGraph.ts / defaultData.ts 三文件；CONFIG_TABLES 从 11 张扩展到 15 张（补入 DATA-4 职业扩展 4 张）；UI 组件新增 DashboardPanel / ImportDialog + fields/ 7 个字段子组件 + config-meta/ 3 个元信息文件 + composables/ 新增 useFormValidation；AdminTable 增加分页/排序/列显隐/批量选择/行详情/行克隆；AdminForm 增加表单校验与键盘快捷键；ConfigManager 增加导出/导入/重置/批量删除 |

---

**文档结束**
