# 战争艺术：地下城（Art of War: Dungeons）

一款基于西方魔幻世界观的单人地下城冒险策略 Web 游戏。扮演冒险者深入地下城，在回合制战斗中运用技能与策略击败敌人，探索未知区域，完成任务，收集装备，书写属于你的冒险传奇。

纯前端应用，所有游戏数据存储在浏览器 IndexedDB 中，无需后端服务器，打开即玩。

---

## 功能特性

### 角色系统
- 创建角色时自由选择种族（人类、矮人、暮精灵等 20+ 种族）、职业（战士、法师、潜行者等 13 个职业）和阵营（光辉盟约、铁血盟约、中立）
- 六维基础属性：力量、敏捷、体质、智力、感知、魅力
- 等级成长系统（最高 20 级），包含经验值累积与自动升级机制
- 衍生的战斗属性：物理攻击/防御、魔法攻击/防御、暴击率、闪避率

### 回合制战斗
- 与普通怪物和 Boss 进行策略回合制对战
- 敌人 AI 决策系统：根据自身类型智能选择攻击、防御或使用技能
- 技能栏系统：固定 4 个技能槽位，可自由搭配技能组合
- Boss 多阶段战斗机制，阶段切换时改变战斗模式与技能
- 战斗日志实时展示每回合的攻防详情

### 地图与探索
- 支持地图总览与区域探索双视图切换
- 三大大陆可供探索：暮光大陆、辉石大陆、寒霜废土
- 探索区域以网格形式呈现，逐步揭示未知格子
- 每个格子可能触发战斗、发现宝箱、遭遇 NPC 或触发特殊事件

### 装备系统
- 6 个装备槽位：主手、副手、头部、胸部、腿部、鞋子
- 装备品质分级：普通、优秀、稀有、史诗、传说
- 装备提供基础属性加成与战斗属性提升
- 支持装备/卸下/替换操作

### 物品与背包
- 消耗品：药水、卷轴等可使用的即时道具
- 物品堆叠机制，同类物品自动合并
- 背包容量管理，支持物品丢弃操作

### 任务系统
- NPC 发布的主线与支线任务
- 任务目标类型：击杀怪物、收集物品、探索区域等
- 任务状态流转：可接取 → 进行中 → 已完成（待提交）→ 已提交
- 提交任务后可获取经验值、金币、装备奖励

### 商店交易
- 不同类型商店（武器店、防具店、杂货店等）
- 支持物品买卖，价格根据稀有度浮动
- 商店库存独立管理，支持卖出物品回购

### 冒险日志
- 完整记录冒险旅程中的关键事件
- 按类型筛选：战斗、任务、物品、升级、信息等
- 时间戳记录，支持翻阅历史日志

### 音频系统
- 基于 Tone.js 的 Web Audio 音频引擎（懒加载，首屏不加载）
- 战斗、探索、UI 交互均有对应的音效反馈

---

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Vue 3（Composition API + `<script setup>`） | ^3.4.0 |
| 构建工具 | Vite | ^6.0.0 |
| 类型系统 | TypeScript（strict 严格模式） | ^5.3.0 |
| 状态管理 | Pinia | ^2.1.7 |
| CSS 预处理 | Less（全局变量自动注入） | ^4.2.0 |
| 数据持久化 | Dexie（IndexedDB 封装） | ^4.4.2 |
| 动画 | @vueuse/motion + anime.js | ^3.0.3 / ^4.4.1 |
| 音频 | Tone.js（Web Audio 框架） | ^15.1.22 |
| 图标 | @iconify/vue | ^5.0.1 |
| 列表渲染 | vue-virtual-scroller（虚拟滚动） | ^2.0.0-beta.8 |
| 单元测试 | Vitest + @vue/test-utils + fake-indexeddb | ^4.1.10 |
| E2E 测试 | Playwright | ^1.61.1 |
| 包管理器 | pnpm | 11.x |
| 模块系统 | ES Module（`"type": "module"`） | — |
| 路径别名 | `@/` → `src/` | — |

---

## 快速开始

```bash
# 克隆项目
git clone <仓库地址>
cd wow_dnd

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 类型检查 + 生产构建
pnpm build

# 预览构建产物
pnpm preview

# 单元测试（Vitest）
pnpm test

# 代码检查（ESLint）
pnpm lint
```

---

## 项目结构

```
wow_dnd/
├── index.html                    # HTML 入口，定义全局样式与字体
├── package.json                  # 项目依赖与脚本
├── pnpm-lock.yaml                # pnpm 依赖锁定文件
├── tsconfig.json                 # TypeScript 编译配置（ES2020 / strict）
├── tsconfig.node.json            # Node 端 TypeScript 配置
├── vite.config.ts                # Vite 构建配置（Vue 插件 + Less 变量注入 + 路径别名）
├── vitest.config.ts              # Vitest 单元测试配置
├── vitest.bench.config.ts        # 性能基准测试配置
├── playwright.config.ts          # Playwright E2E 测试配置
├── eslint.config.js              # ESLint 扁平化配置
├── doc/                          # 设计文档
│   ├── module/                   # 模块设计文档（12 个）
│   ├── UI/                       # UI 设计规格（3 个）
│   ├── project/                  # 项目信息文档（5 个）
│   └── fixed/                    # 修复记录
├── test/                         # 测试代码（单元测试 + e2e，按模块镜像 src 结构）
└── src/
    ├── main.ts                   # 应用入口：初始化 DB → 导入数据 → 创建 Vue 应用 → 挂载控制台命令
    ├── App.vue                   # 根组件：管理三大视图切换（角色选择 / 游戏 / 管理后台）
    ├── env.d.ts                  # Vite 环境类型声明（含 Window.__gameState 扩展）
    ├── composables/              # Vue 组合式函数
    │   ├── useToast.ts           # Toast 提示
    │   ├── useSkillDisplay.ts    # 技能展示
    │   └── useResponsiveGrid.ts  # 响应式网格
    ├── config/                   # 全局配置常量（8 个文件）
    │   ├── character.ts          # 角色等级/属性/经验值配置
    │   ├── combat.ts             # 战斗配置
    │   ├── combat-colors.ts      # 战斗颜色配置
    │   ├── console-style.ts      # 控制台样式配置
    │   ├── database.ts           # 数据库配置
    │   ├── exploration.ts        # 探索配置
    │   ├── inventory.ts          # 背包配置
    │   └── log.ts                # 日志配置
    ├── data/                     # 游戏静态数据（15 个 config_* + index.ts + validate.ts）
    │   ├── config_classes.ts     # 职业数据
    │   ├── config_races.ts       # 种族数据
    │   ├── config_factions.ts    # 阵营数据
    │   ├── config_skills.ts      # 技能模板数据
    │   ├── config_items.ts       # 物品模板数据
    │   ├── config_equipmentItems.ts # 装备模板数据
    │   ├── config_item_sets.ts   # 套装数据
    │   ├── config_mobs.ts        # 怪物模板数据
    │   ├── config_bosses.ts      # Boss 模板数据
    │   ├── config_locations.ts   # 区域/地点数据
    │   ├── config_quests.ts      # 任务定义数据
    │   ├── config_shops.ts       # 商店数据
    │   ├── config_class_items.ts # 职业专属装备数据
    │   ├── config_class_passives.ts # 职业被动数据
    │   ├── config_class_talents.ts  # 职业天赋树数据
    │   ├── index.ts              # 静态数据统一导出
    │   └── validate.ts           # 静态数据校验
    ├── images/                   # 静态图片资源
    ├── styles/                   # 全局样式
    │   ├── variables.less        # Less 全局变量（颜色/字体/间距）
    │   ├── animations.less       # 全局动画定义
    │   ├── mixins.less           # 全局混合宏
    │   ├── popup.less            # 弹窗通用样式
    │   └── icon-gradients.less   # 图标渐变样式
    ├── utils/                    # 工具函数
    │   ├── calculations.ts       # 数值计算（经验曲线、伤害公式、属性推导等）
    │   ├── db-helpers.ts         # IndexedDB 操作辅助函数
    │   ├── errorReport.ts        # 全局错误上报（errorReporter）
    │   ├── fileDownload.ts       # 文件下载辅助
    │   ├── rng.ts                # 随机数工具
    │   └── index.ts              # 工具函数统一导出
    ├── services/                 # 跨模块服务层（5 个服务）
    │   ├── GameBootstrap.ts      # 游戏初始化编排（按依赖分层初始化各模块 Store）
    │   ├── CharacterLifecycleService.ts # 角色生命周期服务（创建/选择/登出）
    │   ├── AdminQueryService.ts  # 后台管理查询服务
    │   ├── CrossModuleQuery.ts   # 跨模块查询服务
    │   └── ErrorHandler.ts       # 统一错误处理服务
    ├── components/               # Vue 组件
    │   ├── GameMain.vue          # 游戏主界面（顶栏状态 + 地图/探索 + 底栏功能菜单）
    │   ├── CharacterSelect.vue   # 角色选择界面（已有角色列表）
    │   ├── CharacterCreate.vue   # 角色创建弹窗（种族/职业/阵营选择）
    │   ├── MapView.vue           # 地图视图组件
    │   ├── ExplorationView.vue   # 探索视图组件（网格探索）
    │   ├── common/               # 通用组件（13 个）
    │   │   ├── BasePopup.vue       # 通用弹窗基座
    │   │   ├── ConfirmPopup.vue    # 确认弹窗
    │   │   ├── AlertPopup.vue      # 提示弹窗
    │   │   ├── Toast.vue           # Toast 提示组件
    │   │   ├── ResourceBar.vue     # 资源条展示（HP/MP/EXP）
    │   │   ├── ClassResourceBar.vue # 职业专属资源条
    │   │   ├── ItemIcon.vue        # 物品图标组件
    │   │   ├── BaseIcon.vue        # 基础图标组件
    │   │   ├── Tag.vue / SkillTags.vue / EffectTag.vue # 标签类组件
    │   │   ├── EmptyState.vue      # 空状态占位
    │   │   └── RiskIndicator.vue   # 风险指示器
    │   ├── popup/                # 弹窗组件（10 个，各功能模块的 UI 交互入口）
    │   │   ├── CharacterInfoPopup.vue # 角色详情弹窗
    │   │   ├── InventoryPopup.vue     # 背包弹窗
    │   │   ├── SkillsPopup.vue        # 技能管理弹窗
    │   │   ├── QuestPopup.vue / QuestBoardPopup.vue # 任务弹窗/任务板弹窗
    │   │   ├── CombatPopup.vue        # 战斗界面弹窗
    │   │   ├── ShopPopup.vue          # 商店交易弹窗
    │   │   ├── AdventureLogPopup.vue  # 冒险日志弹窗
    │   │   ├── SystemPopup.vue        # 系统设置弹窗
    │   │   └── AudioSettingsPopup.vue # 音频设置弹窗
    │   └── admin/                # 后台管理组件
    │       ├── AdminLayout.vue     # 管理后台布局
    │       ├── AdminTable.vue      # 配置数据表格
    │       ├── AdminForm.vue       # 配置编辑表单
    │       ├── ConfigManager.vue   # 配置表管理
    │       └── composables/        # 后台管理组合式函数
    └── modules/                  # 核心业务模块（21 个模块，每个模块独立封装）
        ├── index.ts              # 模块统一导出（显式命名导出）
        ├── admin/                # 后台管理模块（配置表 CRUD）
        ├── animation/            # 动画特效模块
        ├── audio/                # 音频模块（Tone.js 封装，service 懒加载，无独立 db）
        ├── base/                 # 基础数据模块（阵营、种族、职业定义）
        ├── boss/                 # Boss 模块（多阶段 Boss 战）
        ├── bus/                  # 事件总线模块（发布/订阅模式，46 个游戏事件）
        ├── character/            # 角色模块（创建/选择/属性/等级成长）
        ├── combat/               # 战斗模块（回合制 + AI 策略 + 效果系统）
        ├── console/              # 开发控制台模块（framework + commands/ 命令子模块）
        ├── data/                 # 数据核心模块（DB 初始化、数据导入/导出、全局状态）
        ├── enemy/                # 敌人模块（普通怪物管理）
        ├── equipment/            # 装备模块
        ├── exploration/          # 探索模块（网格探索/事件触发）
        ├── game/                 # 全局游戏状态模块（GameStore，无 db/service）
        ├── inventory/            # 背包/物品模块
        ├── item-template/        # 物品模板模块（模板缓存与查询）
        ├── log/                  # 冒险日志模块
        ├── map/                  # 地图/区域模块
        ├── quest/                # 任务模块
        ├── shop/                 # 商店模块
        └── skill/                # 技能模块（技能解锁/装备/使用）
```

---

## 架构设计

### 数据持久化

采用 **Pinia（内存状态）+ IndexedDB（持久化）** 双存储方式。各模块 Store 在状态变更时通过自身 `db.ts` 的 Dexie 表操作显式持久化到对应数据表；全局游戏状态（当前角色 ID、当前商店 ID、游戏设置等）由 `useGameStore` 统一收敛，经 `data` 模块的 `gameStateHelper`（`getGameState` / `saveGameState`，事务性读改写保证原子性）持久化到 `runtime_gameState` 表（`id='gameState'`）。页面刷新或重新打开后，游戏进度不丢失。

数据库表按三类组织：

| 分类 | 表 | 说明 |
|------|----|------|
| 配置表（config_*） | config_factions / config_races / config_classes / config_items / config_equipmentItems / config_mobs / config_bosses / config_quests / config_skills / config_locations / config_shops / config_class_items / config_class_passives / config_class_talents / config_item_sets | 游戏定义数据，所有角色共享 |
| 角色表（char_*） | char_data / char_inventory / char_equipment / char_skills / char_quests / char_exploration | 绑定角色 ID，每个角色独立 |
| 运行时表（runtime_*） | runtime_gameState / runtime_combatLogs / runtime_adventureLogs / runtime_mapState / runtime_shopItems / runtime_shopSoldItems | 日志与全局状态 |

### 事件总线

基于发布/订阅模式，定义了 46 个游戏事件枚举（`GameEvents`），涵盖角色、战斗、探索、商店、任务、技能、UI、物品、Boss、存档等各模块的交互事件，支持类型安全的 payload 传递，实现模块间松耦合通信。

### 模块化架构

每个业务模块遵循统一的分层结构：

```
modules/<模块名>/
├── index.ts    # 统一导出（聚合 Store、Service、DB 的公开 API）
├── types.ts    # 类型定义（接口、枚举、类型别名）
├── db.ts       # IndexedDB 操作封装（Dexie 表操作）
├── store.ts    # Pinia Store（响应式状态管理 + 显式持久化）
└── service.ts  # 业务逻辑服务层（纯函数/类，不依赖 UI）
```

个别模块依据职责裁剪该分层：

- `game` 模块：无 db.ts/service.ts，全局状态经 `data` 模块的 `gameStateHelper` 持久化
- `audio` 模块：音频设置收敛至 GameStore 的 gameSettings（原 audio_settings 键迁移合并），无独立 db.ts；`audioService` 采用懒加载，首次用户交互时才动态 import Tone.js
- `console` 模块：由 `framework.ts`（命令框架）+ `commands/`（命令子模块）构成

### 视图切换

不使用 Vue Router 路由库。通过 `gameState` 响应式变量在三个顶层视图间切换：

| gameState 值 | 对应视图 |
|-------------|---------|
| `character-select` | 角色选择 / 创建界面 |
| `game` | 游戏主界面（地图 + 探索 + 战斗等） |
| `admin` | 后台管理系统 |

切换时配合 Vue `<Transition>` 组件实现进出场动画效果。开发环境下 `gameState` 会暴露到 `window.__gameState`，供控制台命令切换视图。

### 启动流程

```
应用启动
  ├── 打开 IndexedDB 数据库（db.open）
  ├── 初始化游戏数据（dataInitializer.initializeData，mount 前完成）
  ├── 创建 Vue 应用实例
  │    ├── 注册 Pinia（状态管理）
  │    ├── 注册 MotionPlugin（动画）
  │    ├── 注册 VueVirtualScroller（虚拟滚动）
  │    └── 注册全局错误捕获（errorReporter 三层兜底：Vue 错误/未处理拒绝/全局错误）
  ├── App 挂载后按序初始化全局 Store
  │    ├── gameStore.initialize()（迁移旧 audio_settings 键 → gameSettings，恢复全局状态）
  │    ├── baseStore.initialize()（阵营/种族/职业基础数据）
  │    └── characterStore.initialize()（存在当前角色则直接进入游戏界面）
  ├── 挂载开发控制台命令到 window.cmd（initConsole）
  ├── 音频懒加载初始化（setupLazyAudioInit：监听首次 pointerdown/keydown 动态 import audioService）
  └── 选中角色进入游戏时
       └── GameBootstrapService.initialize(characterId) 按依赖分层并行初始化各模块 Store
            （Layer1: log+inventory → 注入回调 → Layer2: equipment+skill+map → Layer3: exploration → Layer4: quest）
```

---

## 开发控制台

在浏览器 DevTools 中可直接调用 `window.cmd` 对象下的调试命令（共 28 个），辅助开发与测试：

| 命令 | 类别 | 用途 |
|------|------|------|
| `cmd.help()` | 系统 | 显示所有可用命令（可按类别或命令名筛选） |
| `cmd.admin()` | 系统 | 进入游戏后台管理系统 |
| `cmd.game()` | 系统 | 从后台返回游戏界面 |
| `cmd.shops()` | 系统 | 查看可用商店列表 |
| `cmd.log(数量, 类型)` | 系统 | 查看最近冒险日志 |
| `cmd.stats()` | 角色 | 显示当前角色完整属性 |
| `cmd.gold(数量)` | 角色 | 添加金币 |
| `cmd.exp(数量)` | 角色 | 添加经验值（自动处理升级） |
| `cmd.hp(数值)` | 角色 | 设置当前生命值 |
| `cmd.mp(数值)` | 角色 | 设置当前法力值 |
| `cmd.heal()` | 角色 | 恢复满生命值和法力值 |
| `cmd.level(等级)` | 角色 | 设置角色等级（1-20） |
| `cmd.resurrect()` | 角色 | 复活当前角色（恢复 50% 生命法力） |
| `cmd.buff(属性, 数值)` | 角色 | 应用临时属性加成（str/dex/con/int/wis/cha） |
| `cmd.resetChar()` | 角色 | 重置角色到初始状态（危险操作） |
| `cmd.spawn(敌人ID)` | 战斗 | 生成敌人并进入战斗 |
| `cmd.win()` | 战斗 | 强制结束当前战斗（胜利） |
| `cmd.flee()` | 战斗 | 强制结束当前战斗（逃跑） |
| `cmd.kill()` | 战斗 | 使当前敌人立即死亡 |
| `cmd.item(物品ID, 数量)` | 物品 | 添加物品到背包 |
| `cmd.bag()` | 物品 | 显示背包物品 |
| `cmd.clearBag()` | 物品 | 清空背包 |
| `cmd.equips()` | 物品 | 查看当前装备状态 |
| `cmd.skills(技能ID, 槽位)` | 技能 | 查看技能列表或装备技能 |
| `cmd.quests()` | 任务 | 查看任务状态或操作任务 |
| `cmd.goto(地点ID)` | 探索 | 传送到指定地点 |
| `cmd.revealAll()` | 探索 | 揭示当前探索区域的所有格子 |
| `cmd.resetExplore()` | 探索 | 重置当前区域的探索状态 |

---

## 设计文档

项目的模块设计、UI 规格和项目信息文档位于 `doc/` 目录：

### 模块设计文档（doc/module/）
- [数据架构总览](doc/module/DATA_ARCHITECTURE_OVERVIEW.md)
- [角色模块设计](doc/module/CHARACTER_MODULE_DESIGN.md)
- [战斗模块设计](doc/module/COMBAT_MODULE_DESIGN.md)
- [背包模块设计](doc/module/INVENTORY_MODULE_DESIGN.md)
- [装备模块设计](doc/module/EQUIPMENT_MODULE_DESIGN.md)
- [技能模块设计](doc/module/SKILLS_MODULE_DESIGN.md)
- [任务模块设计](doc/module/QUEST_MODULE_DESIGN.md)
- [地图模块设计](doc/module/MAP_MODULE_DESIGN.md)
- [探索模块设计](doc/module/EXPLORATION_MODULE_DESIGN.md)
- [商店模块设计](doc/module/SHOP_MODULE_DESIGN.md)
- [事件总线设计](doc/module/EVENT_BUS_DESIGN.md)
- [冒险日志模块设计](doc/module/ADVENTURE_LOG_MODULE_DESIGN.md)

### UI 设计规格（doc/UI/）
- [通用组件 UI 规格](doc/UI/UI_DESIGN_SPEC_COMMON.md)
- [主界面 UI 规格](doc/UI/UI_DESIGN_SPEC_MAIN.md)
- [弹窗 UI 规格](doc/UI/UI_DESIGN_SPEC_POPUPS.md)

### 项目信息文档（doc/project/）
- [各模块功能整理](doc/project/MODULE_FUNCTIONS.md)
- [架构图](doc/project/ARCHITECTURE_DIAGRAMS.md)
- [业务流程](doc/project/BUSINESS_PROCESSES.md)
- [数据流](doc/project/DATA_FLOW.md)
- [依赖关系图](doc/project/DEPENDENCY_GRAPH.md)
