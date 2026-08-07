# 当前待修复问题

> 检查时间：2026-08-07
> 最近整理：2026-08-07（战斗系统专项全部修复：P3-168~187 共 20 项含测试补齐，仅剩 P3-150/149/162/136/167 玩法内容项）
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

## 战斗系统专项检查问题（2026-08-07）

> 检查范围：`src/modules/combat/` 全模块（store/service/db/composables/effects/ai/resources/pets/forms）+ 跨模块依赖
> 检查方式：4 个子代理并行从架构、业务逻辑、代码质量、测试覆盖四个维度审查
> 问题统计：严重 4 / 高 4 / 中 7 / 低 3 / 测试 2 = 20 项

### P3-168（战斗·P0）：~~控制效果对敌人完全无效~~
- **状态**：已修复（2026-08-07，归档 [fixed_20260807104011.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807104011.md)）

### P3-169（战斗·P0）：~~敌人伤害计算双重减防 + damageType 不匹配~~
- **状态**：已修复（2026-08-07，归档 [fixed_20260807104011.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807104011.md)）

### P3-170（战斗·P0）：~~tickAllEffects 触发 endCombat 后 advanceToNextUnit 继续执行~~
- **状态**：已修复（2026-08-07，归档 [fixed_20260807104011.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807104011.md)）

### P3-171（战斗·P0）：~~usePassiveSkills 直接调用 Math.random() 违反 RNG 统一约束~~
- **状态**：已修复（2026-08-07，归档 [fixed_20260807104011.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807104011.md)）

---

### P3-172（架构·P1）：~~combat ↔ character/talents 循环依赖~~
- **状态**：已修复（2026-08-07，归档 [fixed_20260807104831.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807104831.md)）

### P3-173（战斗·P1）：~~useBossMechanics 召唤小怪 IIFE 缺战斗状态守卫~~
- **状态**：已修复（2026-08-07，归档 [fixed_20260807104831.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807104831.md)）

### P3-174（性能·P1）：~~saveLogs 每次全量重保存，长战斗性能劣化~~
- **状态**：已修复（2026-08-07，归档 [fixed_20260807104831.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807104831.md)）

### P3-175（架构·P1）：~~ResourceSystem as 穿透 + EnemyInstance 直接修改~~
- **状态**：已修复（2026-08-07，归档 [fixed_20260807104831.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807104831.md)）

---

### P3-176（战斗·P2）：~~startCombat 中 loadPassives 无异常处理~~
- **状态**：已修复（2026-08-07，归档 [fixed_20260807111130.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807111130.md)）

### P3-177（架构·P2）：~~COMBAT_END 事件载荷过度膨胀~~
- **状态**：已修复（2026-08-07，归档 [fixed_20260807111130.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807111130.md)）

### P3-178（战斗·P2）：~~伤害日志/事件 amount 与实际扣血不一致~~
- **状态**：已修复（2026-08-07，归档 [fixed_20260807111130.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807111130.md)）

### P3-179（战斗·P2）：~~specialAction 失败时不结束回合但已消耗资源~~
- **状态**：已修复（2026-08-07，归档 [fixed_20260807111130.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807111130.md)）

### P3-180（战斗·P2）：~~效果 additive/independent 叠加无层数上限~~
- **状态**：已修复（2026-08-07，归档 [fixed_20260807111130.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807111130.md)）

### P3-181（战斗·P2）：~~资源系统无差别 generate(1, 'skill') 导致双资源职业过快~~
- **状态**：已修复（2026-08-07，归档 [fixed_20260807111130.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807111130.md)）

### P3-182（战斗·P2）：~~宠物攻击绕过 Boss 防御/反击机制~~
- **状态**：已修复（2026-08-07，归档 [fixed_20260807111130.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807111130.md)）

---

### P3-183（代码质量·P3）：~~dispose 完整性 + useCombatAnimations 公开导出~~
- **状态**：已修复（2026-08-07，归档 [fixed_20260807112730.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807112730.md)）

### P3-184（战斗·P3）：~~伤害回血/事件/Buff 等代码异味（合并项）~~
- **状态**：已修复（2026-08-07，归档 [fixed_20260807112730.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807112730.md)）

### P3-185（代码质量·P3）：~~命名规范与操作符一致性~~
- **状态**：已修复（2026-08-07，归档 [fixed_20260807112730.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807112730.md)）

### P3-186（战斗·P3）：~~buildInitiativeOrder 先手语义 + 空数组防御~~
- **状态**：已修复（2026-08-07，归档 [fixed_20260807112730.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807112730.md)）

---

### P3-187（测试·P2）：~~战斗系统测试覆盖盲区~~
- **状态**：已修复（2026-08-07，归档 [fixed_20260807114900.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807114900.md)）
- **修复内容**：forms/store.ts（23 用例）、pets/store.ts（51 用例）、maxStacks 边界（6 用例）、target_hp 边界（5 用例）、替换 9 文件随机 ID 生成。e2e/职业平衡性测试暂不包含。

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
| 待办问题（玩法·P2） | 2（P3-149 / P3-162） |
| 待办问题（内容·P3） | 2（P3-136 / P3-167） |
| 战斗系统·P0 严重 | 0（P3-168/169/170/171 已修复） |
| 战斗系统·P1 高 | 0（P3-172/173/174/175 已修复） |
| 战斗系统·P2 中 | 0（P3-176/177/178/179/180/181/182 已修复） |
| 战斗系统·P3 低 | 0（P3-183/184/185/186 已修复） |
| 战斗系统·测试 | 0（P3-187 已修复） |
| 设计保留 | 2 |
| **待办合计** | **5** |

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
| 循环依赖修复 | 2026-08-07 | [fixed_20260807081906.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807081906.md) | 1（P3-164，3组全部消除）|
| currentCharacterId 代理统一 | 2026-08-07 | [fixed_20260807084223.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807084223.md) | 1（P3-153 扩展，6 个 Store）|
| Store 拆分 composable | 2026-08-07 | [fixed_20260807091727.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807091727.md) | 1（P3-155，3 个 Store）|
| 组件拆分 composable | 2026-08-07 | [fixed_20260807095516.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807095516.md) | 1（P3-163，3 个组件）|
| 战斗系统 P0 严重修复 | 2026-08-07 | [fixed_20260807104011.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807104011.md) | 4（P3-168/169/170/171）|
| 战斗系统 P1 高优修复 | 2026-08-07 | [fixed_20260807104831.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807104831.md) | 4（P3-172/173/174/175）|
| 战斗系统 P2 中优修复 | 2026-08-07 | [fixed_20260807111130.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807111130.md) | 7（P3-176/177/178/179/180/181/182）|
| 战斗系统 P3 低优修复 | 2026-08-07 | [fixed_20260807112730.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807112730.md) | 4（P3-183/184/185/186）|
| 战斗系统测试补齐 | 2026-08-07 | [fixed_20260807114900.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807114900.md) | 1（P3-187，+85 用例）|

### 待办优先级清单（建议下一批次处理）

| 编号 | 维度 | 标题 | 优先级 |
|------|------|------|--------|
| P3-150 | 玩法 | 死亡惩罚过严，无保险机制（需重新评估 P2-57） | P1 |
| P3-162 | 玩法 | AI 决策类型仅 3 种，缺乏 buff/summon/defend | P2 |
| P3-149 | 玩法 | 任务类型仅 kill/collect，目标类型枚举封闭 | P2 |
| P3-136 | 内容 | 任务类型全为 kill | P3 |
| P3-167 | 内容 | 怪物/Boss 数量偏少 | P3 |
