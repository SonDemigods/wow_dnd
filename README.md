# 战争艺术：地下城（Art of War: Dungeons）

一款基于西方魔幻世界观的单人地下城冒险策略 Web 游戏。扮演冒险者深入地下城，在回合制战斗中运用技能与策略击败敌人，探索未知区域，完成任务，收集装备，书写属于你的冒险传奇。

纯前端应用，所有游戏数据存储在浏览器 IndexedDB 中，无需后端服务器，打开即玩。

---

## 功能特性

### 角色系统
- 创建角色时自由选择种族（人类、精灵、矮人等）、职业（战士、法师、盗贼等）和阵营
- 六维基础属性：力量、敏捷、体质、智力、感知、魅力
- 等级成长系统，包含经验值累积与自动升级机制
- 衍生的战斗属性：物理攻击/防御、魔法攻击/防御、暴击率、闪避率

### 回合制战斗
- 与普通怪物和 Boss 进行策略回合制对战
- 敌人 AI 决策系统：根据自身类型智能选择攻击、防御或使用技能
- 技能栏系统：最多携带 4 个技能进入战斗，可自由搭配技能组合
- Boss 多阶段战斗机制，阶段切换时改变战斗模式与技能
- 战斗日志实时展示每回合的攻防详情

### 地图与探索
- 支持地图总览与区域探索双视图切换
- 多个大陆区域可供探索（卡利姆多、东部王国、诺森德）
- 探索区域以网格形式呈现，逐步揭示未知格子
- 每个格子可能触发战斗、发现宝箱、遭遇 NPC 或触发特殊事件

### 装备系统
- 6 个装备槽位：主手武器、副手武器、头部、肩部、胸甲、腿部
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
- 商店库存独立管理

### 冒险日志
- 完整记录冒险旅程中的关键事件
- 按类型筛选：战斗、任务、物品、升级、信息
- 时间戳记录，支持翻阅历史日志

### 音频系统
- 基于 Tone.js 的 Web Audio 音频引擎
- 战斗、探索、UI 交互均有对应的音效反馈

---

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Vue 3（Composition API + `<script setup>`） | ^3.4.0 |
| 构建工具 | Vite | ^5.0.0 |
| 类型系统 | TypeScript（strict 严格模式） | ^5.3.0 |
| 状态管理 | Pinia | ^2.1.7 |
| CSS 预处理 | Less（全局变量自动注入） | ^4.2.0 |
| 数据持久化 | Dexie（IndexedDB 封装） | ^4.4.2 |
| 动画 | @vueuse/motion + anime.js | ^3.0.3 / ^4.4.1 |
| 音频 | Tone.js（Web Audio 框架） | ^15.1.22 |
| 模块系统 | ES Module（`"type": "module"`） | — |
| 路径别名 | `@/` → `src/` | — |

---

## 快速开始

```bash
# 克隆项目
git clone <仓库地址>
cd wow_dnd

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 类型检查 + 生产构建
npm run build

# 预览构建产物
npm run preview
```

---

## 项目结构

```
wow_dnd/
├── index.html                    # HTML 入口，定义全局样式与字体
├── package.json                  # 项目依赖与脚本
├── tsconfig.json                 # TypeScript 编译配置（ES2020 / strict）
├── tsconfig.node.json            # Node 端 TypeScript 配置
├── vite.config.ts                # Vite 构建配置（Vue 插件 + Less 变量注入 + 路径别名）
├── doc/                          # 设计文档（14 个模块设计文档 + 3 个 UI 规格文档）
│   ├── UI/                       # UI 设计规格
│   │   ├── UI_DESIGN_SPEC_COMMON.md
│   │   ├── UI_DESIGN_SPEC_MAIN.md
│   │   └── UI_DESIGN_SPEC_POPUPS.md
│   ├── DATA_ARCHITECTURE_OVERVIEW.md   # 数据架构总览
│   ├── CHARACTER_MODULE_DESIGN.md      # 角色模块设计
│   ├── COMBAT_MODULE_DESIGN.md         # 战斗模块设计
│   ├── INVENTORY_MODULE_DESIGN.md      # 背包模块设计
│   ├── QUEST_MODULE_DESIGN.md          # 任务模块设计
│   ├── SKILLS_MODULE_DESIGN.md         # 技能模块设计
│   ├── MAP_MODULE_DESIGN.md            # 地图模块设计
│   ├── EXPLORATION_MODULE_DESIGN.md    # 探索模块设计
│   ├── SHOP_MODULE_DESIGN.md           # 商店模块设计
│   ├── EQUIPMENT_MODULE_DESIGN.md      # 装备模块设计
│   ├── EVENT_BUS_DESIGN.md             # 事件总线设计
│   └── ADVENTURE_LOG_MODULE_DESIGN.md  # 冒险日志模块设计
└── src/
    ├── main.ts                   # 应用入口：初始化 DB → 加载数据 → 创建 Vue 应用 → 挂载控制台命令
    ├── App.vue                   # 根组件：管理三大视图切换（角色选择 / 游戏 / 管理后台）
    ├── env.d.ts                  # Vite 环境类型声明
    ├── composables/              # Vue 组合式函数
    │   ├── useToast.ts           # Toast 提示
    │   └── useSkillDisplay.ts    # 技能展示
    ├── config/                   # 全局配置常量
    │   ├── character.ts          # 角色等级/属性/经验值配置
    │   ├── database.ts           # 数据库表结构定义
    │   └── items.ts              # 物品相关配置
    ├── data/                     # 游戏静态数据定义
    │   ├── classes.ts            # 职业数据
    │   ├── races.ts              # 种族数据
    │   ├── factions.ts           # 阵营数据
    │   ├── skills.ts             # 技能模板数据
    │   ├── items.ts              # 物品模板数据
    │   ├── enemies.ts            # 怪物模板数据
    │   ├── bosses.ts             # Boss 模板数据
    │   └── zones.ts              # 区域/地点数据
    ├── images/                   # 静态图片资源
    ├── styles/                   # 全局样式
    │   ├── variables.less        # Less 全局变量（颜色/字体/间距）
    │   ├── animations.less       # 全局动画定义
    │   └── popup.less            # 弹窗通用样式
    ├── utils/                    # 工具函数
    │   ├── calculations.ts       # 数值计算（经验曲线、伤害公式、属性推导等）
    │   └── db-helpers.ts         # IndexedDB 操作辅助函数
    ├── components/               # Vue 组件
    │   ├── GameMain.vue          # 游戏主界面（顶栏状态 + 地图/探索 + 底栏功能菜单）
    │   ├── CharacterSelect.vue   # 角色选择界面（已有角色列表）
    │   ├── CharacterCreate.vue   # 角色创建弹窗（种族/职业/阵营选择）
    │   ├── MapView.vue           # 地图视图组件
    │   ├── ExplorationView.vue   # 探索视图组件（网格探索）
    │   ├── common/               # 通用组件
    │   │   ├── ModalContainer.vue  # 通用弹窗容器
    │   │   ├── ResourceBar.vue     # 资源条展示（HP/MP/EXP）
    │   │   ├── Toast.vue           # Toast 提示组件
    │   │   ├── ItemIcon.vue        # 物品图标组件
    │   │   └── Tags.vue            # 标签组件
    │   ├── popup/                # 弹窗组件（各功能模块的 UI 交互入口）
    │   │   ├── CharacterPopup.vue    # 角色详情弹窗
    │   │   ├── InventoryPopup.vue    # 背包弹窗
    │   │   ├── SkillPopup.vue        # 技能管理弹窗
    │   │   ├── QuestPopup.vue        # 任务弹窗
    │   │   ├── CombatPopup.vue       # 战斗界面弹窗
    │   │   ├── ShopPopup.vue         # 商店交易弹窗
    │   │   ├── LogPopup.vue          # 冒险日志弹窗
    │   │   ├── SystemPopup.vue       # 系统设置弹窗
    │   │   └── AudioPopup.vue        # 音频设置弹窗
    │   └── admin/                # 后台管理组件
    │       └── AdminLayout.vue   # 管理后台布局
    └── modules/                  # 核心业务模块（16 个模块，每个模块独立封装）
        ├── index.ts              # 模块统一导出
        ├── console.ts            # 开发控制台命令（20+ 调试命令）
        ├── bus/                  # 事件总线模块（发布/订阅模式，40+ 游戏事件）
        ├── data/                 # 数据核心模块（DB 初始化、数据导入/导出、全局状态）
        ├── base/                 # 基础数据模块（阵营、种族、职业定义）
        ├── character/            # 角色模块（创建/选择/属性/等级成长）
        ├── combat/               # 战斗模块（回合制 + AI 策略 + 效果系统）
        ├── enemy/                # 敌人模块（普通怪物管理）
        ├── boss/                 # Boss 模块（多阶段 Boss 战）
        ├── equipment/            # 装备模块
        ├── inventory/            # 背包/物品模块
        ├── skill/                # 技能模块（技能解锁/装备/使用）
        ├── quest/                # 任务模块
        ├── exploration/          # 探索模块（网格探索/事件触发）
        ├── map/                  # 地图/区域模块
        ├── shop/                 # 商店模块
        ├── log/                  # 冒险日志模块
        ├── audio/                # 音频模块（Tone.js 封装）
        ├── animation/            # 动画特效模块
        └── admin/                # 后台管理模块
```

---

## 架构设计

### 数据持久化

采用 **Pinia（内存状态）+ IndexedDB（持久化）** 双存储方式。Pinia Store 变更时通过 SyncEngine 自动同步到 IndexedDB（防抖 500ms），确保内存状态与持久化数据的一致性。页面刷新或重新打开后，游戏进度不丢失。

### 事件总线

基于发布/订阅模式，定义了 40+ 游戏事件枚举（`GameEvents`），涵盖角色、战斗、探索、商店、任务、技能、UI、物品、Boss、存档等各模块的交互事件，支持类型安全的 payload 传递，实现模块间松耦合通信。

### 模块化架构

每个业务模块遵循统一的分层结构：

```
modules/<模块名>/
├── index.ts    # 统一导出（聚合 Store、Service、DB 的公开 API）
├── types.ts    # 类型定义（接口、枚举、类型别名）
├── store.ts    # Pinia Store（响应式状态管理 + SyncEngine 自动持久化）
├── service.ts  # 业务逻辑服务层（纯函数/类，不依赖 UI）
└── db.ts       # IndexedDB 操作封装（Dexie 表操作）
```

### 视图切换

不使用 Vue Router 路由库。通过 `gameState` 响应式变量在三个顶层视图间切换：

| gameState 值 | 对应视图 |
|-------------|---------|
| `character-select` | 角色选择 / 创建界面 |
| `game` | 游戏主界面（地图 + 探索 + 战斗等） |
| `admin` | 后台管理系统 |

切换时配合 Vue `<Transition>` 组件实现进出场动画效果。

### 启动流程

```
应用启动
  ├── 打开 IndexedDB 数据库
  ├── 初始化游戏数据（检查 → 导入默认数据）
  ├── 创建 Vue 应用实例
  │    ├── 注册 Pinia（状态管理）
  │    ├── 注册 MotionPlugin（动画）
  │    └── 挂载到 #app
  ├── 挂载开发控制台命令到 window.cmd
  └── 初始化音频服务（Tone.js，等待用户首次交互后启动 AudioContext）
```

---

## 开发控制台

在浏览器 DevTools 中可直接调用 `window.cmd` 对象下的调试命令，辅助开发与测试：

| 命令 | 类别 | 用途 |
|------|------|------|
| `cmd.help()` | 系统 | 查看所有可用命令（支持按类别筛选） |
| `cmd.admin()` | 系统 | 进入后台管理界面 |
| `cmd.game()` | 系统 | 返回游戏界面 |
| `cmd.stats()` | 角色 | 查看当前角色完整属性 |
| `cmd.gold(数量)` | 角色 | 添加金币 |
| `cmd.exp(数量)` | 角色 | 添加经验值（自动升级） |
| `cmd.hp(数值)` | 角色 | 设置当前生命值 |
| `cmd.mp(数值)` | 角色 | 设置当前法力值 |
| `cmd.heal()` | 角色 | 恢复满 HP/MP |
| `cmd.level(等级)` | 角色 | 设置角色等级 |
| `cmd.resurrect()` | 角色 | 复活角色（恢复 50% HP/MP） |
| `cmd.buff(属性, 数值)` | 角色 | 应用临时属性加成 |
| `cmd.resetChar()` | 角色 | 重置角色到初始状态 |
| `cmd.spawn(敌人ID)` | 战斗 | 生成敌人并进入战斗 |
| `cmd.win()` | 战斗 | 强制当前战斗胜利 |
| `cmd.flee()` | 战斗 | 强制从战斗中逃跑 |
| `cmd.kill()` | 战斗 | 使当前敌人立即死亡 |
| `cmd.item(物品ID, 数量)` | 物品 | 添加物品到背包 |
| `cmd.bag()` | 物品 | 查看背包内容 |
| `cmd.clearBag()` | 物品 | 清空背包 |
| `cmd.equips()` | 物品 | 查看当前装备 |
| `cmd.skills(技能ID, 槽位)` | 技能 | 查看或装备技能 |
| `cmd.quests()` | 任务 | 查看任务状态 |
| `cmd.shops()` | 商店 | 查看可用商店列表 |
| `cmd.log(数量, 类型)` | 日志 | 查看冒险日志 |
| `cmd.goto(地点ID)` | 探索 | 传送到指定地点 |
| `cmd.revealAll()` | 探索 | 揭示当前探索区域所有格子 |
| `cmd.resetExplore()` | 探索 | 重置当前探索状态 |

---

## 设计文档

项目的模块设计和 UI 规格文档位于 `doc/` 目录：

### 模块设计文档
- [数据架构总览](doc/DATA_ARCHITECTURE_OVERVIEW.md)
- [角色模块设计](doc/CHARACTER_MODULE_DESIGN.md)
- [战斗模块设计](doc/COMBAT_MODULE_DESIGN.md)
- [背包模块设计](doc/INVENTORY_MODULE_DESIGN.md)
- [装备模块设计](doc/EQUIPMENT_MODULE_DESIGN.md)
- [技能模块设计](doc/SKILLS_MODULE_DESIGN.md)
- [任务模块设计](doc/QUEST_MODULE_DESIGN.md)
- [地图模块设计](doc/MAP_MODULE_DESIGN.md)
- [探索模块设计](doc/EXPLORATION_MODULE_DESIGN.md)
- [商店模块设计](doc/SHOP_MODULE_DESIGN.md)
- [事件总线设计](doc/EVENT_BUS_DESIGN.md)
- [冒险日志模块设计](doc/ADVENTURE_LOG_MODULE_DESIGN.md)

### UI 设计规格
- [通用组件 UI 规格](doc/UI/UI_DESIGN_SPEC_COMMON.md)
- [主界面 UI 规格](doc/UI/UI_DESIGN_SPEC_MAIN.md)
- [弹窗 UI 规格](doc/UI/UI_DESIGN_SPEC_POPUPS.md)
