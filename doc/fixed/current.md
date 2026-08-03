# 当前待修复问题

> 检查时间：2026-08-03
> 最近整理：2026-08-03（经核实 7 项待办均未修复，无新增归档）
> 上次测试状态：178 文件 / 4502 测试通过
> tsc 状态：通过（0 错误）
> 历史归档目录：[doc/fixed/](file:///d:/openSource/wow_dnd/doc/fixed/)
> P0 批次归档：[fixed_20260731165000.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260731165000.md)
> P1 批次归档：[fixed_20260801010000.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260801010000.md)
> P3-148 归档：[fixed_20260731173228.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260731173228.md)

---

## 待办问题

### P3-135（内容创作）：补充 7 个职业专属装备
- **状态**：待补齐，属内容创作类，非代码修复
- **核实结果**（2026-08-03）：[config_class_items.ts](file:///d:/openSource/wow_dnd/src/data/config_class_items.ts) 仅覆盖 6 个职业（战士/法师/圣骑士/猎人/潜行者/术士）共 18 件专属装备；游戏共 13 个职业，缺 7 个（牧师/萨满/德鲁伊/死亡骑士/武僧/恶魔猎手/唤魔师），仍待补齐。
- **问题背景**：职业专属装备配置不完整，影响职业差异化体验。
- **修复建议**：由策划/内容创作同学补齐 7 个职业的专属装备配置数据。

---

### P3-136（内容创作）：补充 collect/talk/explore 任务
- **状态**：待补齐，属内容创作类，非代码修复
- **核实结果**（2026-08-03）：[config_quests.ts](file:///d:/openSource/wow_dnd/src/data/config_quests.ts) 中 188 处任务/目标 `type` 全部为 `'kill'`，collect 任务模板为 0，talk/explore 亦为 0，仍待补齐。
- **问题背景**：collect/talk/explore 三类任务模板数量不足，影响任务系统丰富度。
- **修复建议**：由策划/内容创作同学补齐任务模板数据。
- **关联**：与 P3-149（QuestType 类型扩展）互补，先做 P3-149 类型扩展再补数据更顺畅。

---

## 性能优化（P3-141 ~ P3-145）

### P3-141（性能·P0）：Tone.js 静态导入阻塞首屏
- **状态**：已修复（2026-07-31）
- **归档**：[fixed_20260731165000.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260731165000.md)
- **修复要点**：`src/modules/audio/index.ts` 移除 `audioService` 静态导出断开静态引用链；`src/main.ts` 新增 `setupLazyAudioInit()` 监听 `pointerdown`/`keydown`（once）动态 `import('@/modules/audio/service')` 后 `init()`；失败时 `errorReporter.report` 静默降级。

---

### P3-142（性能·P0）：Vite 缺少 manualChunks 分包
- **状态**：已修复（2026-07-31）
- **归档**：[fixed_20260731165000.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260731165000.md)
- **修复要点**：新增 `rollupOptions.output.manualChunks`，按依赖类型拆分 6 个 vendor chunk（`vendor-vue`/`vendor-db`/`vendor-anime`/`vendor-scroller`/`vendor-iconify`/`vendor-tone`）。
- **遗留**：大型弹窗组件按路由懒加载、`@iconify/vue` 按需加载验证未纳入本批次。

---

### P3-143（性能·P0）：技能模板初始化 N+1 写入
- **状态**：已修复（2026-07-31）
- **归档**：[fixed_20260731165000.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260731165000.md)
- **修复要点**：`initSkillTemplates()` 由嵌套循环逐条 `put` 改为收集到数组后一次性 `bulkPut`，与 `initTable`/`initBosses` 模式一致。

---

### P3-144（性能·P1）：模板 Map 错用 ref 导致深度追踪
- **状态**：已修复（2026-07-31）
- **归档**：[fixed_20260801010000.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260801010000.md)
- **修复要点**：6 个 Map ref 改为 shallowRef；inventory/quest 无原地 mutate 直接替换；equipment/skill 的 set/delete 后调用 triggerRef，clear 改为整体替换 new Map()；loadTemplatesTo 移除多余 clear。

---

### P3-145（性能·P1）：CombatPopup v-for 用 index 作 key
- **状态**：已修复（2026-07-31）
- **归档**：[fixed_20260801010000.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260801010000.md)
- **修复要点**：bossIntroLines 用 `line + '-' + i` 组合键；logsReversed 用 `log.timestamp + '-' + i`（CombatLog 无 id 字段，timestamp + i 兜底）；InventoryPopup/QuestBoardPopup/CharacterInfoPopup 检查后均用稳定 key，无需修改。

---

## 玩法与平衡（P3-146 ~ P3-150）

### P3-146（玩法·P0）：stat_modifier 类被动技能完全失效
- **状态**：已修复（2026-07-31）
- **归档**：[fixed_20260731165000.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260731165000.md)
- **修复要点**：
  1. 伤害管线接入 stat_modifier（`pipeline.ts` 新增 `attackerStatModifiers` 参数，合并 `physical_attack_multiplier`/`magic_attack_multiplier`/`bonus_*_damage_percent`）
  2. 暴击判定接入 crit 加成（`critCalc.ts:rollPlayerCrit` 新增 `statModifiers` 参数，叠加 `crit_chance`/`crit_damage_multiplier`）
  3. buff 类被动写入 EffectContainer（`applyBuff` 对 `target='enemy'` + `corruption_dot` 施加 `poison` DOT 3 回合）
  4. 4 处 `processDamagePipeline` 与 4 处 `rollPlayerCrit` 调用方传 `passive.getStatModifiers()`
  5. `onAttack(damage, targetEnemyId?)` 签名扩展，`store.ts` 传入 `state.currentTarget.value?.id`
- **遗留**：`defense_multiplier`/`dodge_chance`/`max_mana_multiplier`/`heal_bonus_multiplier`/`mana_regen_percent` 留作 P1 后续。
- **风险**：修复后法师/猎人/牧师强度显著上升，需重测全职业 DPS 曲线（不在本批次范围）。

---

### P3-147（玩法·P0）：敌方 AOE 1.3x 反向加强（设计 bug 嫌疑）
- **状态**：已修复（2026-07-31）
- **归档**：[fixed_20260731165000.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260731165000.md)
- **修复要点**：敌方 AOE 倍率从硬编码 `1.3` 改为常量 `ENEMY_AOE_DAMAGE_MULTIPLIER = 0.8`（在 [config/combat.ts](file:///d:/openSource/wow_dnd/src/config/combat.ts) 定义），与玩家 `PLAYER_AOE_DAMAGE_PENALTY = 0.7` 对齐（略高保留 Boss 威胁感）。

---

### P3-148（玩法·P1）：8 职业仍用统一 MP，已实现资源系统未启用
- **状态**：已修复（2026-07-31）
- **归档**：[fixed_20260731173228.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260731173228.md)
- **修复要点**：复核发现 P3-148 描述已部分过时——hunter/death_knight/demon_hunter 在历史提交中已完整接入专属资源。本次实际修复 paladin 与 evoker 两个部分接入的职业：
  1. 圣骑士 4 个伤害技能从 `mpCost` 切换到 `holy_power`（divine_judgment/avengers_shield/consecration/divine_shock），3 个治疗技能保留 MP（圣光术/圣光闪现/神圣之光），形成 3 MP + 7 holy_power 双资源结构
  2. 龙脉术士 6 个 mpCost 技能切换到 `essence`（dragon_breath/disintegrate/essence_burst/shifting_embers/azure_strike/spiritbloom），1 个 Lv1 应急治疗（emerald_blossom）保留 MP，形成 1 MP + 9 essence 双资源结构
  3. `ResourceSystemFactory.ts` 中 paladin/evoker 的 case 注释与 `replacesMana` 文档注释同步更新，反映"专属资源为主输出 + MP 为辅助/应急"的实际设计
- **遗留**：法师/牧师/萨满/德鲁伊仍走 MP（P3-148 修复建议第 3 条留作中期）；圣骑士/龙脉术士 DPS 平衡实测未做。

---

### P3-149（玩法·P2）：任务类型仅 kill/collect，目标类型枚举封闭
- **状态**：待修复
- **核实结果**（2026-08-03）：[src/modules/quest/types.ts:57](file:///d:/openSource/wow_dnd/src/modules/quest/types.ts#L57) `QuestType = 'kill' | 'collect'` 仍未扩展，待修复状态不变。
- **问题位置**：[src/modules/quest/types.ts:57](file:///d:/openSource/wow_dnd/src/modules/quest/types.ts#L57) `QuestType = 'kill' | 'collect'`
- **问题背景**：[src/data/config_quests.ts](file:///d:/openSource/wow_dnd/src/data/config_quests.ts)（1706 行）所有任务目标都是 kill/collect 变体（实测全部为 kill），任务状态机有 6 种但目标类型只有 2 种。`quest/store.ts` 进度推进只有 `onEnemyKilled`/`onItemCollected` 两个入口。
- **影响**：任务玩法单一，全部是"杀 N 只怪 / 捡 N 个东西"，缺乏 escort/puzzle/talk/explore/choice 等叙事多样性。与魔兽风格期待严重不符。
- **修复建议**：
  1. 扩展 `QuestType` 联合类型：`'kill' | 'collect' | 'talk' | 'explore' | 'escort' | 'choice'`
  2. `talk`/`explore` 可低成本接入（复用探索模块 shop/board 入口与 `visitedCells` 计数）
  3. `escort`/`choice` 需新机制（复用战斗多敌人框架与 `MultiOptionEvent`）
- **风险**：中。建议先做 P3-149 类型扩展，再做 P3-136 任务模板数据补充。
- **关联**：与 P3-136（任务模板数据补充）互补。

---

### P3-150（玩法·P1）：死亡惩罚过严，无保险机制（对 P2-57 设计保留项的重新评估）
- **状态**：建议重新评估（与 P2-57 设计保留决策冲突）
- **核实结果**（2026-08-03）：[src/modules/character/service.ts:296](file:///d:/openSource/wow_dnd/src/modules/character/service.ts#L296) `computeResurrection` 仍为 `exp: 0`（当前等级经验清零）+ `hp/mp: max(1, floor(maxXxx * 0.5))`（半血半蓝复活），未改动。
- **问题位置**：[src/modules/character/service.ts:296](file:///d:/openSource/wow_dnd/src/modules/character/service.ts#L296) `computeResurrection`
- **问题背景**：当前实现：`exp: 0`（当前等级经验清零）+ `hp/mp: max(1, floor(maxXxx * 0.5))`（半血半蓝）。无灵魂医者/保险/复活币/队友救机制。19→20 单级需 1000 经验，玩家在 19 级 999 经验时死亡损失接近一整级刷怪成果。
- **影响**：单机游戏里属"劝退级"惩罚——没有存档回滚、没有保险，纯粹用经验惩罚制造挫败。探索中死亡时周围怪物还在，可能复活即死形成死亡螺旋。
- **修复建议**：
  1. 经验惩罚改为"损失本级经验的 50%"或"损失固定 100 经验"，而非清零
  2. 增加"灵魂医者"机制：死亡后可选"原地半血复活"（保留惩罚）或"回城满血复活"（额外扣金币）
  3. 探索中死亡时清除死亡格子周围 1 格的怪物，避免复活即死
  4. 增加"幸运护符"类消耗品，使用后下次死亡免惩罚
- **风险**：低。改 `computeResurrection` 一行公式 + 增加复活方式选项。
- **关联**：P2-57 标注"有意设计保留"，本项建议重新评估该保留决策——若维持保留则关闭本项，若采纳则同步更新 P2-57。

---

## 代码质量与架构（P3-151 ~ P3-155）

### P3-151（代码·P0）：错误处理三条路径不一致
- **状态**：已修复（2026-07-31）
- **归档**：[fixed_20260731165000.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260731165000.md)
- **修复要点**：为 exploration/skill/quest/log 四个 Store 的 `persistXxx` 函数补齐 try-catch + `errorReporter.report`，参考 inventory/store.ts 的最佳实践（含 context/characterId/数据量等上下文字段）。
- **约定**：用户操作触发的失败用 `errorHandler.report` 弹 toast；后台 persist 失败用 `errorReporter.report` 仅记录；`wrapAsync` 标记 `@deprecated`，新代码改用 `tryAsync` 的 Result 模式。

---

### P3-152（代码·P0）：ESLint 边界规则仍为 warn
- **状态**：已修复（2026-07-31）
- **归档**：[fixed_20260731165000.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260731165000.md)
- **修复要点**：
  1. `sharedRules` 与 `strictModuleBoundaryRules` 的 `no-restricted-imports` 从 `warn` 升级为 `error`
  2. `@typescript-eslint/no-explicit-any` 从 `warn` 升级为 `error`
  3. 测试文件豁免：`test/**` 中 `no-restricted-imports: 'off'`、`@typescript-eslint/no-explicit-any: 'warn'`
  4. `env.d.ts` 加入 `ignores`；关闭 TS 文件的 `no-undef`（TS 类型由 tsParser 识别，vitest 全局由 `vitest/globals` 提供）

---

### P3-153（代码·P1）：exploration `currentCharacterId` 未对齐 gameStore 代理模式
- **状态**：已修复（2026-07-31）
- **归档**：[fixed_20260801010000.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260801010000.md)
- **修复要点**：引入 useGameStore，currentCharacterId 从 ref 改为 `computed(() => gameStore.currentCharacterId)`；init 移除 currentCharacterId.value 赋值（只读 computed 不可赋值），保留 characterId 参数用于 DB 加载；与 character/store.ts（P3-116）代理模式对齐。
- **遗留**：其他 6 个 Store（skill/log/map/quest/equipment/inventory）仍有本地 `currentCharacterId = ref`，经 2026-08-03 核实仍未代理，列为 P3-153 扩展待办。

---

### P3-154（代码·P1）：doc/fixed 历史归档膨胀
- **状态**：待修复
- **核实结果**（2026-08-03）：[doc/fixed/](file:///d:/openSource/wow_dnd/doc/fixed/) 目录已增至 34 个 `fixed_*.md` 归档（2026-07-08 ~ 2026-08-01）+ 1 个 current.md，较上次记载的 31 个继续增长，待修复状态不变。
- **问题位置**：[doc/fixed/](file:///d:/openSource/wow_dnd/doc/fixed/) 目录
- **问题背景**：34 个 `fixed_*.md` 归档（2026-07-08 ~ 2026-08-01）+ 1 个 current.md。7 月 31 日单日产生 11 个归档。每个归档 50-200 行，总量超过 3000 行历史文档。早期归档（如 `fixed_20260708100839.md` 的 P0 修复）已被后续 module 设计文档吸收。
- **影响**：文档查找成本高（34 个文件全部需要扫描才能定位历史决策），干扰新成员定位有效信息。
- **修复建议**：
  1. 按月合并：将 `fixed_202607*.md` 合并为 `doc/fixed/archive_2026_07.md`（保留摘要 + 链接到原始归档的 git 历史）
  2. 仅保留最近 3 个月的明细归档，更早的进入归档
  3. `current.md` 保持现状
- **风险**：极低。归档是历史记录，git history 已永久保留，合并不影响溯源。

---

### P3-155（代码·P2）：大型 Store 未拆分 composable
- **状态**：待修复
- **核实结果**（2026-08-03）：三个 Store 行数（含注释）为 [src/modules/skill/store.ts](file:///d:/openSource/wow_dnd/src/modules/skill/store.ts) 944 行 / [src/modules/inventory/store.ts](file:///d:/openSource/wow_dnd/src/modules/inventory/store.ts) 896 行 / [src/modules/equipment/store.ts](file:///d:/openSource/wow_dnd/src/modules/equipment/store.ts) 882 行，较上次记载均有增长，待修复状态不变。
- **问题位置**：
  - [src/modules/skill/store.ts](file:///d:/openSource/wow_dnd/src/modules/skill/store.ts)（919 行 → 944 行）
  - [src/modules/inventory/store.ts](file:///d:/openSource/wow_dnd/src/modules/inventory/store.ts)（891 行 → 896 行）
  - [src/modules/equipment/store.ts](file:///d:/openSource/wow_dnd/src/modules/equipment/store.ts)（871 行 → 882 行）
- **问题背景**：combat 模块已采用拆分模式：`store.ts` 仅约 170 行，逻辑拆分到 14 个 composables（`useCombatState`/`useCombatLog`/`useBossMechanics`/`useEnemyAction`/`usePlayerAction` 等）。但 skill/inventory/equipment 三个 Store 仍是单文件 800+ 行，新功能继续累加会进一步膨胀。
- **影响**：单 Store 文件大，可读性与可测试性下降。
- **修复建议**：
  - skill：拆 `useSkillLearning`（learnSkill/canLearn）+ `useSkillCasting`（castSkill/cooldown）+ `useSkillBar`（equipSkill/swapSkills）
  - inventory：拆 `useInventoryItems`（add/remove/stack）+ `useInventoryFilter`（sort/filter）+ `useItemEffect`（useItem/effect 计算）
  - equipment：拆 `useEquipmentOps`（equip/unequip）+ `useSetBonus`（套装计算）+ `useEquipmentPersist`（持久化 + 回滚）
- **风险**：中。Store 拆分需谨慎处理 composable 间的依赖关系，参考 combat 的 `initiativeHolder`/`playerHolder` 延迟绑定模式。

---

## 设计保留项（有意保留，非待办修复）

### P2-57：handleDeath 自动复活设计保留
- **状态**：有意设计保留（P3-150 建议重新评估）
- **设计说明**：死亡惩罚=经验清零+半血复活，注释已文档化。BIZ-13（endCombat 未 await handleDeath）已在 fixed_20260730150000 修复。
- **关联**：P3-150 提出对该设计保留项的重新评估建议，若采纳则本项转为待办。

### P3-102：equipSkill 未学习技能的处理
- **状态**：有意设计保留
- **设计说明**："装备即学习"为产品意图，详见 [fixed_20260731200000.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260731200000.md)。

---

## 统计

| 类别 | 数量 | 说明 |
|------|------|------|
| 待办问题（内容创作） | 2 | P3-135 / P3-136 |
| 待办问题（玩法·P1） | 1 | P3-150 |
| 待办问题（玩法·P2） | 1 | P3-149 |
| 待办问题（代码·P1） | 2 | P3-153 扩展 / P3-154 |
| 待办问题（代码·P2） | 1 | P3-155 |
| 设计保留 | 2 | P2-57（P3-150 建议重新评估）/ P3-102 |
| **待办合计** | **7** | 内容创作 2 + 玩法 2 + 代码 3（均经 2026-08-03 核实仍待办） |

### 已修复批次

| 批次 | 时间 | 归档 | 项数 |
|------|------|------|------|
| P0 优先级清单 | 2026-07-31 | [fixed_20260731165000.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260731165000.md) | 7（P3-141/142/143/146/147/151/152）|
| P1 优先级清单 | 2026-07-31 | [fixed_20260801010000.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260801010000.md) | 3（P3-144/145/153）|
| P3-148 单项修复 | 2026-07-31 | [fixed_20260731173228.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260731173228.md) | 1（P3-148）|

### 待办优先级清单（建议下一批次处理）

| 编号 | 维度 | 标题 | 优先级 |
|------|------|------|--------|
| P3-150 | 玩法 | 死亡惩罚过严，无保险机制（需重新评估 P2-57） | P1 |
| P3-154 | 代码 | doc/fixed 历史归档膨胀 | P1 |
| P3-153 扩展 | 代码 | 其他 6 个 Store currentCharacterId 代理统一 | P1 |
| P3-149 | 玩法 | 任务类型仅 kill/collect，目标类型枚举封闭 | P2 |
| P3-155 | 代码 | 大型 Store 未拆分 composable | P2 |
