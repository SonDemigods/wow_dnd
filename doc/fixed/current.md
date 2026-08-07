# 当前待修复问题

> 检查时间：2026-08-07
> 最近整理：2026-08-07（战斗系统 P0 修复：P3-168/169/170/171 全部修复并归档）
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

### P3-172（架构·P1）：combat ↔ character/talents 循环依赖
- **状态**：待修复（高）
- **核实结果**（2026-08-07）：
  - [store.ts:38](file:///d:/openSource/wow_dnd/src/modules/combat/store.ts#L38) 直接 `import { useTalentStore }`，仅用于读取 `effectSummary.unlockedPets`（[store.ts:339-342](file:///d:/openSource/wow_dnd/src/modules/combat/store.ts#L339-L342)）。
  - [character/talents/store.ts:24](file:///d:/openSource/wow_dnd/src/modules/character/talents/store.ts#L24) 反向 `import usePetStore from combat/pets`。
  - combatContext.ts:22 注释自称"combat 模块内唯一引用外部 Store 的位置"，但 store.ts:38 绕过此契约。
- **问题表现**：违反 combatContext.ts 作为唯一外部 Store 引用点的架构契约，形成循环依赖。
- **修复建议**：将 `unlockedPets` 加入 `ICombatQuery.talent` 接口，通过 `ctx.talent.unlockedPets` 访问；character/talents → combat/pets 的反向依赖改为 GameBootstrap 回调注入（参照 inventory↔quest 模式）。
- **风险**：中。需修改接口定义与调用点。

---

### P3-173（战斗·P1）：useBossMechanics 召唤小怪 IIFE 缺战斗状态守卫
- **状态**：待修复（高）
- **核实结果**（2026-08-07）：[useBossMechanics.ts:195-255](file:///d:/openSource/wow_dnd/src/modules/combat/composables/useBossMechanics.ts#L195-L255) `summon_minions` 分支的异步 IIFE `(async () => { ... })()` 内每个 `await bossCtx.createMinion()` 之后无 `state.state.value !== 'fighting'` 守卫。
- **问题表现**：若战斗在 `createMinion` 期间结束（玩家逃跑/死亡），IIFE 仍会 push enemyId/enemyPositions 到已清理的状态，导致下场战斗出现幽灵敌人。
- **修复建议**：在 IIFE 内部每个 `await` 后增加 `if (state.state.value !== 'fighting') return;` 守卫，或使用 AbortController 模式。
- **风险**：低。

---

### P3-174（性能·P1）：saveLogs 每次全量重保存，长战斗性能劣化
- **状态**：待修复（高）
- **核实结果**（2026-08-07）：[useCombatLog.ts:58-59](file:///d:/openSource/wow_dnd/src/modules/combat/composables/useCombatLog.ts#L58-L59) `const logsToSave = [...state.combatLogs.value]; await Promise.all(logsToSave.map(...))` 每次保存全量日志。
- **问题表现**：50 回合 × 5 条/回合 = 250 条，每回合 3-5 次 saveLogs → 每次 250 次 put，战斗末期每回合产生 750-1250 次冗余 put 操作，性能 O(n) 增长。
- **修复建议**：维护 `lastSavedIndex` 指针，每次只保存 `combatLogs.value.slice(lastSavedIndex)` 增量日志。
- **风险**：低。需注意 endCombat 时保存全部剩余日志。

---

### P3-175（架构·P1）：ResourceSystem 私有字段 as 穿透 + EnemyInstance 直接修改
- **状态**：待修复（高）
- **核实结果**（2026-08-07）：
  - [store.ts:309](file:///d:/openSource/wow_dnd/src/modules/combat/store.ts#L309) `(sys as unknown as { _maxValue: { value: number } })._maxValue.value += bonus` 使用 `as unknown as` 破坏封装访问 protected 字段 `_maxValue`。
  - [useInitiative.ts:393](file:///d:/openSource/wow_dnd/src/modules/combat/composables/useInitiative.ts#L393) `e.aiStrategy = currentPhase.aiStrategy` 直接修改 EnemyInstance 对象，未经 enemy store action。
- **问题表现**：类型系统无法捕获重命名/重构，违反"状态修改应通过 store action"原则。
- **修复建议**：在 `BaseResourceSystem` 新增 `addMaxBonus(bonus: number)` 公共方法；在 `ctx.enemy` 接口暴露 `setAiStrategy(enemyId, strategy)` 方法。
- **风险**：低。

---

### P3-176（战斗·P2）：startCombat 中 loadPassives 无异常处理
- **状态**：待修复（中）
- **核实结果**（2026-08-07）：[store.ts:316](file:///d:/openSource/wow_dnd/src/modules/combat/store.ts#L316) `await passive.loadPassives()` 无 try/catch，若 `configCache.loadPassives()` reject，state 已设为 'fighting' 但 passives 未加载，状态不一致。
- **修复建议**：包裹 try/catch，失败时降级为空 passives 列表 + console.error + 日志上报，而非留下 'fighting' 状态无 passives。
- **风险**：低。

---

### P3-177（架构·P2）：COMBAT_END 事件载荷过度膨胀
- **状态**：待修复（中）
- **核实结果**（2026-08-07）：[store.ts:235-242](file:///d:/openSource/wow_dnd/src/modules/combat/store.ts#L235-L242) 载荷含 enemy/enemyCount/enemyNames/expGained/goldGained，但实际业务消费者（exploration/store.ts:796-799、audio/service.ts:308）仅读 `data.result`。违反 code_rule.md"跨模块业务通知仅含最小信号"规则。
- **修复建议**：精简为 `{ result }`，其余字段删除或由监听方自行查询。
- **风险**：低。需确认无其他消费方。

---

### P3-178（战斗·P2）：伤害日志/事件 amount 与实际扣血不一致
- **状态**：待修复（中）
- **核实结果**（2026-08-07）：
  - AOE 事件/日志：[usePlayerSkill.ts:274-276](file:///d:/openSource/wow_dnd/src/modules/combat/composables/usePlayerSkill.ts#L274-L276)（amount=aoeDamage 防御前）、[usePlayerSkill.ts:301](file:///d:/openSource/wow_dnd/src/modules/combat/composables/usePlayerSkill.ts#L301)（damage=aoeDamage），但实际扣血是 `actualAoeDamage`（防御后）。
  - 单体技能日志：[usePlayerSkill.ts:410](file:///d:/openSource/wow_dnd/src/modules/combat/composables/usePlayerSkill.ts#L410) 记录 `skillDamage` 而非 `actualSkillDamage`。
  - 物品伤害：[usePlayerItem.ts:111](file:///d:/openSource/wow_dnd/src/modules/combat/composables/usePlayerItem.ts#L111) `damageResult.damage = finalDamage` 而非 `actualItemDamage`。
  - 敌人伤害事件：[useEnemyAction.ts:117](file:///d:/openSource/wow_dnd/src/modules/combat/composables/useEnemyAction.ts#L117) `amount: rawDamage` 而非 `finalDamage`。
- **问题表现**：UI 显示的伤害数字与实际扣血不符，玩家感知"伤害虚高"或"伤害不足"。
- **修复建议**：统一所有伤害调用点的日志/事件 `damage` 和 `amount` 字段为防御后的实际伤害值（参考 P3-94 已修复的 `playerAttack` 模式）。
- **风险**：低。

---

### P3-179（战斗·P2）：specialAction 失败时不结束回合但已消耗资源
- **状态**：待修复（中）
- **核实结果**（2026-08-07）：[usePlayerSkill.ts:175-177](file:///d:/openSource/wow_dnd/src/modules/combat/composables/usePlayerSkill.ts#L175-L177)（summonable.length === 0）、[usePlayerSkill.ts:181-183](file:///d:/openSource/wow_dnd/src/modules/combat/composables/usePlayerSkill.ts#L181-L183)（summonResult 失败）、[usePlayerSkill.ts:199-201](file:///d:/openSource/wow_dnd/src/modules/combat/composables/usePlayerSkill.ts#L199-L201)（dismiss 失败）、[usePlayerSkill.ts:528-530](file:///d:/openSource/wow_dnd/src/modules/combat/composables/usePlayerSkill.ts#L528-L530)（单目标 debuff 无目标）。
- **问题表现**：`castSkill`（消耗 MP）和资源消耗在 specialAction 检查之前执行，失败时返回 `{ success: false }` 但未调用 `endPlayerTurn`，玩家可再次行动但 MP 已被消耗。
- **修复建议**：在失败分支中要么退还已消耗资源，要么仍调用 `endPlayerTurn`（消耗回合作为惩罚）。
- **风险**：低。

---

### P3-180（战斗·P2）：效果 additive/independent 叠加无层数上限
- **状态**：待修复（中）
- **核实结果**（2026-08-07）：[container.ts:45-52](file:///d:/openSource/wow_dnd/src/modules/combat/effects/container.ts#L45-L52) `additive` 和 `independent` 策略直接 push 新效果，无上限。
- **问题表现**：反复施加同一效果（如多次 poison）会无限叠加，DOT 伤害线性增长（10 次 = 每回合扣 10 倍 value），`reduceSum`/`reduceMultiplier` 遍历开销线性增长，存在内存泄漏风险。
- **修复建议**：为 `additive` 增加最大层数参数（如 `maxStacks: 5`），超过时不再 push 或转为 `max` 策略。
- **风险**：中。需调整 EffectContainer 接口与所有调用点。

---

### P3-181（战斗·P2）：资源系统无差别 generate(1, 'skill') 导致双资源职业过快
- **状态**：待修复（中）
- **核实结果**（2026-08-07）：[store.ts:424-428](file:///d:/openSource/wow_dnd/src/modules/combat/store.ts#L424-L428) `playerAction 'skill'` 对所有资源系统调用 `sys.generate(1, 'skill')`。
- **问题表现**：双资源职业（rogue: energy+combo_point、monk: energy+chi、demon_hunter: fury+soul、death_knight: runic_power+rune）的主资源（energy/focus/runic_power）会与 `onTurnStart` 自然回复叠加，资源获取过快；rune（亡灵骑士符文）+1 不符合"符文独立冷却回复"设计；此外 `generatesResource` 技能已在 [usePlayerSkill.ts:161-166](file:///d:/openSource/wow_dnd/src/modules/combat/composables/usePlayerSkill.ts#L161-L166) 处理副资源生成，此处再 +1 导致生成器技能双倍生成。
- **修复建议**：仅对副资源（非 MP 替代型资源）调用 `generate(1, 'skill')`，或通过 `ResourceSystem` 接口增加 `isSecondary` 标志区分。
- **风险**：中。需调整资源系统接口与数值平衡。

---

### P3-182（战斗·P2）：宠物攻击绕过 Boss 防御/反击机制
- **状态**：待修复（中）
- **核实结果**（2026-08-07）：[usePetAction.ts:168-200](file:///d:/openSource/wow_dnd/src/modules/combat/composables/usePetAction.ts#L168-L200) `petTakeTurn` 中宠物伤害直接 `ctx.enemy.takeDamage(target.id, finalDamage)`，未调用 `boss.applyBossDefenseMechanics` 和 `boss.applyBossCounterMechanics`。
- **问题表现**：对无敌/护盾 Boss，宠物仍造成全额伤害；Boss 不会对宠物发动反击/反弹。宠物攻击也不触发暴击判定、`passive.onAttack`、`resourceSystems.onAttack`（后两项可能是设计意图）。
- **修复建议**：若宠物应受 Boss 机制影响，在 `petTakeTurn` 中接入 `boss.applyBossDefenseMechanics` / `boss.applyBossCounterMechanics`；若有意设计，需在注释中明确说明。
- **风险**：低。需确认设计意图。

---

### P3-183（代码质量·P3）：dispose 完整性 + useCombatAnimations 公开导出
- **状态**：待修复（低）
- **核实结果**（2026-08-07）：
  - [store.ts:547-549](file:///d:/openSource/wow_dnd/src/modules/combat/store.ts#L547-L549) `dispose()` 仅调用 `state.cleanup()`，未重置 `pet.petStore`（endCombat 的 finally 块会调用 `pet.petStore.reset()`，但 dispose 不会）。角色切换发生在战斗中时，petStore 状态残留到下一角色。
  - [index.ts:38](file:///d:/openSource/wow_dnd/src/modules/combat/index.ts#L38) 公开导出 `useCombatAnimations`，该 composable 大量使用 `document.querySelector`（[useCombatAnimations.ts:143,152,164,171](file:///d:/openSource/wow_dnd/src/modules/combat/composables/useCombatAnimations.ts#L143) 等 13 处），外部模块可导入并误用。
- **修复建议**：dispose() 追加 `pet.petStore.reset()`；useCombatAnimations 在 JSDoc 标注"仅供 CombatPopup.vue 使用"或降级为组件内部文件。
- **风险**：低。

---

### P3-184（战斗·P3）：伤害回血/事件/Buff 等代码异味（合并项）
- **状态**：待修复（低）
- **核实结果**（2026-08-07）：
  - 敌人 HOT 通过负伤害实现回血：[useInitiative.ts:243-245](file:///d:/openSource/wow_dnd/src/modules/combat/composables/useInitiative.ts#L243-L245) `ctx.enemy.takeDamage(eId, -tickRes.regenAmount)`，若未来 takeDamage 增加"受伤时触发"逻辑会错误触发。建议为 enemy store 增加 `receiveHeal` 方法。
  - heal 技能 buffs 字段未应用：[usePlayerSkill.ts:543-582](file:///d:/openSource/wow_dnd/src/modules/combat/composables/usePlayerSkill.ts#L543-L582) heal 分支未检查 `skill?.buffs`，配置了"治疗+增益"的技能 buff 部分被静默忽略。建议在 `initiative.endPlayerTurn()` 前增加 `applySkillBuffs` 调用。
  - applySkillBuffs isSelfBuff 硬编码：[usePlayerAction.ts:106-108](file:///d:/openSource/wow_dnd/src/modules/combat/composables/usePlayerAction.ts#L106-L108) `['attack_up','defense_up','speed_up','regen','shield'].includes(b.type)` 硬编码判断自身增益。建议在 `SkillBuffEffect` 类型增加 `target?: 'self' | 'enemy'` 字段。
  - AI heal 分支与 useSkill 不一致：[useEnemyAction.ts:457-489](file:///d:/openSource/wow_dnd/src/modules/combat/composables/useEnemyAction.ts#L457-L489) 若 skill 配置 type 非 `health_restore`/`mana_restore`，case 'heal' 仍按治疗处理但实际为攻击，日志与效果不一致。建议增加 `if (!result.isHeal)` 回退到 `enemyBasicAttack`。
  - applyPassive stat_modifier 日志误导：[usePassiveSkills.ts:174-183](file:///d:/openSource/wow_dnd/src/modules/combat/composables/usePassiveSkills.ts#L174-L183) stat_modifier/damage_reduction 实时暴露给管线，但 applyPassive 在多个触发时机记录日志，可能误导玩家。建议仅在战斗开始时记录一次。
  - applyBuff DOT 回合数硬编码：[usePassiveSkills.ts:334](file:///d:/openSource/wow_dnd/src/modules/combat/composables/usePassiveSkills.ts#L334) `remainingTurns: 3` 硬编码，建议从 `PassiveEffect.turns` 字段读取。
- **修复建议**：按上述 6 项分别修复，可分批进行。
- **风险**：低。

---

### P3-185（代码质量·P3）：命名规范与操作符一致性
- **状态**：待修复（低）
- **核实结果**（2026-08-07）：
  - `_` 前缀误用：[usePlayerSkill.ts:257-260](file:///d:/openSource/wow_dnd/src/modules/combat/composables/usePlayerSkill.ts#L257-L260)、[usePlayerSkill.ts:365-368](file:///d:/openSource/wow_dnd/src/modules/combat/composables/usePlayerSkill.ts#L365-L368)、[usePlayerItem.ts:97-101](file:///d:/openSource/wow_dnd/src/modules/combat/composables/usePlayerItem.ts#L97-L101)、[usePetAction.ts:181-182](file:///d:/openSource/wow_dnd/src/modules/combat/composables/usePetAction.ts#L181-L182) `_talentDmgMult` / `_preCritDmg` 实际被使用，下划线前缀误导（lint 约定表示未使用）。
  - `||` 应为 `??`：[useCombatLog.ts:83](file:///d:/openSource/wow_dnd/src/modules/combat/composables/useCombatLog.ts#L83) `speed: ctx.character.effectiveStats.dex || 0`，项目已确立 `??` 优先规范。
  - 非空断言替代局部变量：[usePlayerSkill.ts:162](file:///d:/openSource/wow_dnd/src/modules/combat/composables/usePlayerSkill.ts#L162) `skill.generatesResource!.type`，应提取局部变量维持窄化：`const gen = skill.generatesResource; if (gen) { ... gen.type ... }`。
- **修复建议**：移除 `_` 前缀；`||` 改 `??`；提取局部变量消除断言。
- **风险**：低。

---

### P3-186（战斗·P3）：buildInitiativeOrder 先手语义 + 空数组防御
- **状态**：待确认设计意图
- **核实结果**（2026-08-07）：
  - [useInitiative.ts:111-112](file:///d:/openSource/wow_dnd/src/modules/combat/composables/useInitiative.ts#L111-L112) `currentInitiativeIndex` 初始化为玩家位置，先攻序列中速度高于玩家的敌人在第一回合被跳过。若意图是"玩家发起战斗则先手"则合理，但与"按速度排序"的先攻语义矛盾。
  - [useInitiative.ts:119-130](file:///d:/openSource/wow_dnd/src/modules/combat/composables/useInitiative.ts#L119-L130) `advanceTurn` 对空数组返回 `{ unitId: '', isPlayer: false }`，`advanceToNextUnit` 会进入 else 分支调度 `singleEnemyTurn('')`，找不到敌人后再次调用 `advanceToNextUnit`，形成无限递归。正常流程不会触发，但防御性不足。
- **修复建议**：确认先手语义是否为设计意图；在 `advanceToNextUnit` 中增加 `if (!next.unitId) return;` 守卫。
- **风险**：低。

---

### P3-187（测试·P2）：战斗系统测试覆盖盲区
- **状态**：待修复（测试）
- **核实结果**（2026-08-07）：战斗系统测试整体覆盖率高（48 文件 / 1459 用例 / 0 skipped），但存在以下盲区：
  - **文件级盲区**：
    - [forms/store.ts](file:///d:/openSource/wow_dnd/src/modules/combat/forms/store.ts) 无任何测试
    - [pets/store.ts](file:///d:/openSource/wow_dnd/src/modules/combat/pets/store.ts) 无任何测试
    - [effects/effect-type.ts](file:///d:/openSource/wow_dnd/src/modules/combat/effects/effect-type.ts) 无测试
    - [service.ts](file:///d:/openSource/wow_dnd/src/modules/combat/service.ts) 仅 18 用例，仅覆盖概率公式（暴击/闪避/逃跑），其余业务函数未测
  - **边界场景盲区**：
    - 效果叠加层数上限（maxStacks）完全未测（当前 4 种叠加策略仅测 replace/max/additive/independent，无层数上限测试）
    - `target_hp` 条件仅测 0.2 阈值，未测 0% / 100% / = 阈值精确边界
    - 多敌人战斗流程无集成测试（仅 usePlayerSkill 测了 AOE 击杀多敌人）
    - 多宠物协同未覆盖
  - **集成测试缺失**：
    - 现有 e2e（[test/e2e/explore-battle.spec.ts](file:///d:/openSource/wow_dnd/test/e2e/explore-battle.spec.ts)）用 `cmd.kill()` 跳过战斗过程，无真实回合制 e2e
    - 无战斗失败/逃跑/Boss 战/多敌人 e2e
    - 职业平衡性测试完全缺失
  - **测试质量**：9 处 effect 测试用 `Math.random().toString(36).slice(2,6)` 生成 id（[handler.test.ts:46](file:///d:/openSource/wow_dnd/test/combat/effects/handler.test.ts#L46) 等），脆弱模式，建议改用自增计数器。
- **修复建议**：
  1. 高优先级：补 forms/store.ts、pets/store.ts、effect-type.ts 单元测试；扩展 service.ts 业务函数测试
  2. 中优先级：补效果层数上限测试、target_hp 完整边界、多敌人战斗流程集成测试
  3. 低优先级：真实回合制 e2e、Boss 战 e2e、职业平衡性基准测试；替换 effect id 生成方式
- **风险**：低。

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
| 战斗系统·P1 高 | 4（P3-172 / 173 / 174 / 175） |
| 战斗系统·P2 中 | 7（P3-176 / 177 / 178 / 179 / 180 / 181 / 182） |
| 战斗系统·P3 低 | 4（P3-183 / 184 / 185 / 186） |
| 战斗系统·测试 | 1（P3-187） |
| 设计保留 | 2 |
| **待办合计** | **22** |

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

### 待办优先级清单（建议下一批次处理）

| 编号 | 维度 | 标题 | 优先级 |
|------|------|------|--------|
| P3-172 | 架构 | combat ↔ character/talents 循环依赖 | P1 |
| P3-173 | 战斗 | useBossMechanics 召唤小怪 IIFE 缺状态守卫 | P1 |
| P3-174 | 性能 | saveLogs 每次全量重保存，长战斗性能劣化 | P1 |
| P3-175 | 架构 | ResourceSystem as 穿透 + EnemyInstance 直接修改 | P1 |
| P3-150 | 玩法 | 死亡惩罚过严，无保险机制（需重新评估 P2-57） | P1 |
| P3-176 | 战斗 | startCombat loadPassives 无异常处理 | P2 |
| P3-177 | 架构 | COMBAT_END 事件载荷过度膨胀 | P2 |
| P3-178 | 战斗 | 伤害日志/事件 amount 与实际扣血不一致 | P2 |
| P3-179 | 战斗 | specialAction 失败不结束回合但已消耗资源 | P2 |
| P3-180 | 战斗 | 效果 additive/independent 叠加无层数上限 | P2 |
| P3-181 | 战斗 | 资源系统无差别 generate 导致双资源职业过快 | P2 |
| P3-182 | 战斗 | 宠物攻击绕过 Boss 防御/反击机制 | P2 |
| P3-162 | 玩法 | AI 决策类型仅 3 种，缺乏 buff/summon/defend | P2 |
| P3-149 | 玩法 | 任务类型仅 kill/collect，目标类型枚举封闭 | P2 |
| P3-187 | 测试 | 战斗系统测试覆盖盲区 | P2 |
| P3-183 | 代码质量 | dispose 完整性 + useCombatAnimations 公开导出 | P3 |
| P3-184 | 战斗 | 伤害回血/事件/Buff 等代码异味（合并项） | P3 |
| P3-185 | 代码质量 | 命名规范与操作符一致性 | P3 |
| P3-186 | 战斗 | buildInitiativeOrder 先手语义 + 空数组防御 | P3 |
| P3-136 | 内容 | 任务类型全为 kill | P3 |
| P3-167 | 内容 | 怪物/Boss 数量偏少 | P3 |
