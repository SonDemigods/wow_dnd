

## Codely Structured Memories

### User

### Feedback
- [2026-08-07 07:31:59] combat composable 不应直接 import useTalentStore()/useCharacterStore() 等 Pinia store。应通过 ICombatContext 接口访问（ctx.talent.xxx / ctx.character.xxx），测试 mock 时在 ctx 中提供占位值即可。直接 import store 会导致测试中 Pinia 未初始化报 "Cannot read properties of undefined (reading '_s')"。createCombatContext 是 combat 模块唯一 import 外部 Store 的位置。
- [2026-08-07 08:43:37] vi.hoisted 回调在模块 import 之前执行，不能在 vi.hoisted 内部使用 `ref()` 等 Vue API（报 ReferenceError: Cannot access before initialization）。**Why:** vi.hoisted 设计目的是在 mock 工厂中引用 stub 对象，保证 hoisting 顺序。**How to apply:** gameStore mock 的 currentCharacterId 用普通对象属性即可（exploration 测试模式）；仅在需要在测试执行中途改变 currentCharacterId 且 computed 需要响应式追踪时（如 equipment 的并发竞态测试），用 getter/setter 模式替代 ref。

### Project
- [2026-08-06 11:52:49] wow_dnd 是 Vue3+TS+Vite+Dexie(IndexedDB) 的Web单机游戏「战争艺术：地下城」，非 Unity。数据分层：src/data/config_*.ts 静态常量(启动时 bulkPut 导入 IndexedDB)→27张表(config_*/char_*/runtime_*)→各模块 db.ts→Pinia Store。A层设计不入DB：config_mounts(程序化生成)与config_area_events(含函数不可序列化)。
- [2026-08-06 11:52:55] 2026-08-06 清除配置数据双源歧义：新建 src/modules/config/cache.ts (ConfigCache, 懒加载+Promise去重) 统一从DB读天赋树/被动/套装定义；ATTRIBUTE_POTION_IDS白名单改为 capabilityTypes 的 attribute_potion 标签；quest/objective_utils 敌名IIFE 改 initEnemyNameMap() 从DB加载；GameBootstrap 新增 Layer0 预加载。破坏性更新，不兼容旧存档。
- [2026-08-06 17:26:53] 2026-08-06 战斗公式统一重构完成：(1) 移除荆棘反伤机制（thorn handler/pipeline Stage 4/computeThornsDamage/6个composable荆棘代码块/数据配置thorn buff全部清除）。(2) pipeline防御拆分：calcBaseDamage→calcAttackDamage+applyDefenseReduction，防御始终生效（含技能），减伤公式改 max(floor(伤害×系数), 防御) 防御全额生效。(3) 新增配置常量 PHYSICAL_DEFENSE_REDUCTION_COEFFICIENT/MAGICAL_DEFENSE_REDUCTION_COEFFICIENT/HEAL_BONUS_DIVISOR，删除 DEFENSE_REDUCTION_COEFFICIENT。(4) UI显示修正：getSkillEffectText/getSkillEffectBrief 接受Stats参数展示含主属性加成预估值。(5) 治疗接入healBonus+暴击：castSkill不再直接receiveHeal，由usePlayerSkill统一应用 floor(治疗×(1+healBonus/100)×暴击倍率)。(6) 删除hpBonus死代码（HP_BONUS_CON_COEFFICIENT/calculateHpBonus/Attributes.hpBonus）。
- [2026-08-07 07:31:56] 2026-08-06 天赋系统「三系六层」网状改造全部完成（plan.md 四阶段）。阶段一：TALENT_POINT_RULES 重写（10级起每级2点，20级22点，rowUnlockRequirements=[0,3,6,9,12,15]，maxPointsPerTalent=2）；Talent 新增 col 字段；暴击率改由职业主属性推导（calculateCritChance 加 primaryStat 参数），evoker int→cha；效果消耗全部接入（stat_bonus/damage_multiplier/damage_reduction/resource_bonus/skill_enhance）；天赋分配持久化到 Character.talentAllocations；pet 新增 lockPet 回退。阶段二：isTierUnlocked 改全树累计。阶段三：13职业×18节点完整重写（3树合并为1棵6×3网状树，crit_bonus→stat_bonus，hp_multiplier→stat_bonus(con)，mana_max→stat_bonus(int)，质量修复）。阶段四：TalentPopup.vue 网状UI + console 命令 + validate。关键架构：ICombatContext 新增 talent 域（getter 代理 useTalentStore），combat composable 不直接 import useTalentStore，保持测试隔离。tsc/eslint 零错误，630 项天赋+战斗测试全通过。


### Reference
- [2026-08-07 08:43:34] 项目规则文件位于 `.trae/rules/`：fix_rule.md（bug修复流程）、code_rule.md（编码与测试规范）、git-commit-message.md（全中文提交信息）、design_rule.md（文档编写规则）。用户说"按照规则"时指这些文件。fix_rule.md 要求：修复后移出 current.md 对应条目 → 创建 fixed_yyyyMMddHHmmss.md 归档 → 运行 tsc+eslint+vitest 验证。
