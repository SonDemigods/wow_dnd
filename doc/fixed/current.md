# 当前待修复问题

> 检查时间：2026-08-07
> 最近整理：2026-08-07（P3-154 已修复：7月归档合并为 archive_2026_07.md；移除已修复项 P3-135/157/159/165/166；P3-164 更新为部分修复）
> tsc 状态：`tsc --noEmit --skipLibCheck` 通过（0 错误）
> 历史归档目录：[doc/fixed/](file:///d:/openSource/wow_dnd/doc/fixed/)
> 7月归档合并：[archive_2026_07.md](file:///d:/openSource/wow_dnd/doc/fixed/archive_2026_07.md)

---

## 待办问题

### P3-150（玩法·P1）：死亡惩罚过严，无保险机制
- **状态**：建议重新评估（与 P2-57 设计保留决策冲突）
- **核实结果**（2026-08-07）：[src/modules/character/service.ts:455](file:///d:/openSource/wow_dnd/src/modules/character/service.ts#L455) `computeResurrection` 仍为 `exp: 0` + 半血半蓝，未改动。
- **问题背景**：`exp: 0`（当前等级经验清零）+ `hp/mp: max(1, floor(maxXxx * 0.5))`（半血半蓝）。无灵魂医者/保险/复活币机制。19 级 999 经验时死亡损失接近一整级刷怪成果。
- **影响**：单机游戏"劝退级"惩罚，探索中死亡可能复活即死形成死亡螺旋。
- **修复建议**：经验惩罚改为"损失本级经验 50%"或"损失固定 100 经验"；增加"回城满血复活"（额外扣金币）；探索中死亡时清除死亡格子周围 1 格怪物。
- **风险**：低。改 `computeResurrection` 公式 + 增加复活方式选项。
- **关联**：P2-57 标注"有意设计保留"，若采纳则同步更新 P2-57。

---

### P3-153 扩展（代码·P1）：其他 6 个 Store currentCharacterId 代理统一
- **状态**：待修复
- **核实结果**（2026-08-07）：skill/log/map/quest/equipment/inventory 6 个 Store 仍有本地 `currentCharacterId = ref`，未收敛到 gameStore 只读 computed 代理。
- **影响**：全局状态存在多个数据源，角色切换时可能出现状态不一致。
- **修复建议**：参照 P3-153 修复模式，将 `currentCharacterId` 从 ref 改为 `computed(() => gameStore.currentCharacterId)`。
- **风险**：低。模式已验证，逐个 Store 迁移即可。

---

### P3-160（业务·P2）：setRace/setClass 重置 stats 丢失升级属性
- **状态**：待修复
- **核实结果**（2026-08-07）：[src/modules/character/store.ts:602-633](file:///d:/openSource/wow_dnd/src/modules/character/store.ts#L602) setRace/setClass 使用 `computeInitialStats(raceBonus, classBonus)` 整体重置 stats，未累加 `level - 1` 点升级属性。20 级角色切换种族/职业会丢失 19 点升级属性。
- **影响**：当前 API 暂未被调用，一旦未来调用会导致高级角色属性大幅缩水。
- **修复建议**：改为差值更新（旧种族加成→新种族加成的 diff），或重置后显式累加 `level - 1`。
- **风险**：低。

---

### P3-149（玩法·P2）：任务类型仅 kill/collect，目标类型枚举封闭
- **状态**：待修复
- **核实结果**（2026-08-07）：[src/modules/quest/types.ts:57](file:///d:/openSource/wow_dnd/src/modules/quest/types.ts#L57) `QuestType = 'kill' | 'collect'` 仍未扩展。
- **影响**：任务玩法单一，全部是"杀 N 只怪"，缺乏 talk/explore/escort/choice 等叙事多样性。
- **修复建议**：扩展 `QuestType` 联合类型，`talk`/`explore` 可低成本接入。
- **风险**：中。先做类型扩展再补数据。
- **关联**：与 P3-136 互补。

---

### P3-162（玩法·P2）：AI 决策类型仅 3 种，缺乏 buff/summon/defend
- **状态**：待修复
- **核实结果**（2026-08-07）：[src/modules/combat/ai/types.ts:26](file:///d:/openSource/wow_dnd/src/modules/combat/ai/types.ts#L26) `AiDecision = basic_attack | skill | heal`，仍 3 种。
- **影响**：敌人不会主动施放 buff/debuff，4 种 AI 策略实际只在 3 种决策间调概率，差异感不强。
- **修复建议**：扩展 AiDecision 联合类型，增加 `{ type: 'buff'; skillId }`、`{ type: 'defend' }` 等。
- **风险**：中。需同步修改 4 种策略实现。

---

### P3-163（代码·P2）：大组件未抽离业务 Composable
- **状态**：部分修复（ShopPopup 已完成；CombatPopup/CharacterCreate/GameMain 仍待修复）
- **核实结果**（2026-08-07）：CombatPopup script 1509 行、CharacterCreate 1095 行、GameMain 778 行。
- **修复建议**：
  - CombatPopup：抽离 `useCombatUiHelpers` + `useCombatResultPopup`
  - CharacterCreate：抽离 `useCharacterCreation`
  - GameMain：抽离 `useGameActions`
- **风险**：低。纯重构，参考 combat 模块 composable 拆分模式。

---

### P3-164（架构·P2）：模块间类型循环依赖
- **状态**：部分修复（3 组中 2 组已消除，1 组仍存在）
- **核实结果**（2026-08-07）：
  - ~~exploration ↔ enemy~~ ✅ 已消除
  - ~~character ↔ data~~ ✅ 已消除
  - skill ↔ combat ❌ 仍存在：`skill/types.ts` 导入 `EffectType` from `combat/effects`，`combat/combatContext.ts` 导入 `Skill/SkillUseResult` from `skill`
- **修复建议**：将 `EffectType` 提取到独立类型文件。
- **风险**：低。纯类型重构，无运行时影响。

---

### P3-155（代码·P2）：大型 Store 未拆分 composable
- **状态**：待修复
- **核实结果**（2026-08-07）：skill/store.ts 843 行、inventory/store.ts 833 行、equipment/store.ts 830 行。
- **修复建议**：
  - skill：拆 `useSkillLearning` + `useSkillCasting` + `useSkillBar`
  - inventory：拆 `useInventoryItems` + `useInventoryFilter` + `useItemEffect`
  - equipment：拆 `useEquipmentOps` + `useSetBonus` + `useEquipmentPersist`
- **风险**：中。参考 combat 模块的延迟绑定模式。

---

### P3-136（内容·P3）：补充 collect/talk/explore 任务
- **状态**：待补齐，属内容创作类
- **核实结果**（2026-08-07）：[config_quests.ts](file:///d:/openSource/wow_dnd/src/data/config_quests.ts) 188 处任务目标 `type` 全部为 `'kill'`，collect/talk/explore 为 0。
- **修复建议**：由策划补齐任务模板数据。先做 P3-149 类型扩展再补数据。
- **关联**：与 P3-149 互补。

---

### P3-167（内容·P3）：怪物/Boss 数量偏少
- **状态**：待补齐，属内容创作类
- **核实结果**（2026-08-07）：[config_mobs.ts](file:///d:/openSource/wow_dnd/src/data/config_mobs.ts) 28 个怪物、[config_bosses.ts](file:///d:/openSource/wow_dnd/src/data/config_bosses.ts) 6 个 Boss。
- **修复建议**：按区域/等级梯度分布补充（1-5/6-10/11-15/16-20 四区间各 8-12 种）。

---

## 设计保留项（有意保留，非待办）

| 编号 | 说明 |
|------|------|
| P2-57 | handleDeath 自动复活：死亡惩罚=经验清零+半血复活，有意设计保留。P3-150 建议重新评估。 |
| P3-102 | equipSkill "装备即学习"为产品意图，有意保留。 |

---

## 统计

| 类别 | 数量 |
|------|------|
| 待办问题（玩法·P1） | 1（P3-150） |
| 待办问题（代码·P1） | 1（P3-153 扩展） |
| 待办问题（业务·P2） | 1（P3-160） |
| 待办问题（玩法·P2） | 2（P3-149 / P3-162） |
| 待办问题（代码·P2） | 2（P3-155 / P3-163 部分） |
| 待办问题（架构·P2） | 1（P3-164 部分） |
| 待办问题（内容·P3） | 2（P3-136 / P3-167） |
| 设计保留 | 2 |
| **待办合计** | **10** |

### 已修复批次

| 批次 | 时间 | 归档 | 项数 |
|------|------|------|------|
| 7月全部修复 | 2026-07 | [archive_2026_07.md](file:///d:/openSource/wow_dnd/doc/fixed/archive_2026_07.md) | ~210（19个归档合并）|
| P0 优先级清单 | 2026-07-31 | [fixed_20260731165000.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260731165000.md) | 7（P3-141/142/143/146/147/151/152）|
| P1 优先级清单 | 2026-07-31 | [fixed_20260801010000.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260801010000.md) | 3（P3-144/145/153）|
| P3-148 单项修复 | 2026-07-31 | [fixed_20260731173228.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260731173228.md) | 1 |
| P3-156 宝宝系统升级 | 2026-08-04 | [fixed_20260804152806.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260804152806.md) | 1 |
| 商店系统升级 | 2026-08-04 | [fixed_20260804162342.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260804162342.md) | 3（P3-158/161 + P3-163 商店部分）|
| 简单问题修复 | 2026-08-07 | — | 3（P3-157/159/165）|
| 内容/数据修复 | 2026-08-07 | — | 2（P3-135/166，天赋系统重构时修复）|
| 归档膨胀修复 | 2026-08-07 | — | 1（P3-154，7月归档合并）|

### 待办优先级清单（建议下一批次处理）

| 编号 | 维度 | 标题 | 优先级 |
|------|------|------|--------|
| P3-150 | 玩法 | 死亡惩罚过严，无保险机制（需重新评估 P2-57） | P1 |
| P3-153 扩展 | 代码 | 其他 6 个 Store currentCharacterId 代理统一 | P1 |
| P3-160 | 业务 | setRace/setClass 重置 stats 丢失升级属性 | P2 |
| P3-162 | 玩法 | AI 决策类型仅 3 种，缺乏 buff/summon/defend | P2 |
| P3-149 | 玩法 | 任务类型仅 kill/collect，目标类型枚举封闭 | P2 |
| P3-163 | 代码 | 大组件未抽离业务 Composable | P2 |
| P3-164 | 架构 | 模块间类型循环依赖（仅剩 skill↔combat） | P2 |
| P3-155 | 代码 | 大型 Store 未拆分 composable | P2 |
| P3-136 | 内容 | 任务类型全为 kill | P3 |
| P3-167 | 内容 | 怪物/Boss 数量偏少 | P3 |
