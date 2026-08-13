# 2026年7月修复归档合并

> 合并时间：2026-08-07
> 合并来源：19 个 `fixed_202607*.md` 文件（2026-07-08 ~ 2026-07-31）
> 原始文件已由 git history 永久保留，可通过 `git log --all -- 'doc/fixed/fixed_202607*.md'` 溯源。

---

## 归档索引

| 日期 | 原始文件 | 修复数量 | 概要 |
|------|----------|----------|------|
| 07-08 | fixed_20260708100839.md | 19 | P0 缺陷修复：业务逻辑（暴击/伤害类型/BOSS机制/资源系统/套装效果等）、架构（data→boss 反向依赖/inventory→equipment 硬耦合）、代码质量（main.ts 初始化/类型断言）、性能（N+1 写入） |
| 07-08 | fixed_20260708102330.md | 13 | P1 缺陷修复：canCastSkill 多维校验、前置任务检查、天赋树 typo、Vue 响应式、类型断言、console 清理、日志去抖、原子事务 |
| 07-08 | fixed_20260708114833.md | 49+4 | P2 缺陷修复：回购列表持久化、商店刷新/限购、阵营兼容性、类型安全 17 项、代码质量 12 项、硬编码提取 4 项、性能/初始化、资源管理、数据规范 |
| 07-09 | fixed_20260709083912.md | 9 | P1+P2：db 层 fake-indexeddb 测试补全、services/composables 测试补全、any 消除、空 catch 修复、定时器清理、XSS 防护、handler 测试 |
| 07-09 | fixed_20260709085006.md | 5 | P3：GameMain/ShopPopup 定时器清理、除零防御、config 测试覆盖、随机性可测性 |
| 07-09 | fixed_20260709092500.md | 18 | 第二轮交叉验证：伤害型物品 BOSS 复活、商店商品映射、敌人先攻减速、暴击荆棘一致性、NaN 防御、FileReader onerror、AudioService dispose、EventBus 快照 |
| 07-09 | fixed_20260709100300.md | 6+1 | 第三轮深度检查：collect 任务失效修复、购买原子性、背包满静默丢失、技能冷却跨战斗残留、startCombat 防御性 reset、audio 重建 |
| 07-09 | fixed_20260709111000.md | 5 | 架构优化：CrossModuleQuery import 路径修正、ESLint 模块边界规则、vitest coverage 阈值 |
| 07-09 | fixed_20260709123446.md | 1 | S2/S3 战斗模块解耦：ICombatContext 收口 6 个外部 Store 依赖、IBossContext 解耦 combat↔boss、延迟绑定模式 |
| 07-10 | fixed_20260710113649.md | 9 | 业务合理性：playerSkill 荆棘反伤、playerUseItem Boss 防御/反击、技能暴击判定、damageType 动态化、资源系统注释、skillName 查询、Fisher-Yates 洗牌 |
| 07-10 | fixed_20260710120446.md | 4 | 第二轮业务合理性：宝箱 addItem 返回值检查、handleLoot 物品名称、config/log PAGE_SIZE 提取、log/store persist 去抖 |
| 07-15 | fixed_20260715170000.md | 22 | 敌人 HP 响应式更新、任务奖励事务性、DB 初始化错误上报、gainGold 负值、荆棘音效、装备丢失防御、levelRequirement 吞 0 等 |
| 07-15 | fixed_20260715173000.md | 5 | test/db 目录镜像重构、map/shop service.ts 纯函数层提取、探索网格开销评估、背包整理评估 |
| 07-29 | fixed_20260729120000.md | 4+1 | P0：卸下装备背包满丢失、levelRequirement || null 吞 0、importBackup 缺少 type 字段、equipment saveEquipmentTemplate ||
| 07-29 | fixed_20260729130000.md | 26 | P1：Boss 召唤小怪 fire-and-forget、变量遮蔽、EffectContext speed 硬编码、evaluateCondition 条件扩展、combat/db 批量删除等 |
| 07-29 | fixed_20260729150000.md | 48+2 | P2：useBossMechanics catch 降级、双重断言移除、BossRuntime 字段声明、initiativeRef 容器化、endCombat TDZ 修复等 |
| 07-29 | fixed_20260729170000.md | 43+16 | P3：passive 参数保留、解构简化、register force 参数、策略实例共享、generatePetInstanceId 统一等 |
| 07-30 | fixed_20260730110000.md | 4 | P1+架构：ItemTemplateCache 双重缓存消除、inventory↔quest 回调注入切断、usePlayerAction ctx 参数、useBossMechanics ctx 参数 |
| 07-30 | fixed_20260730150000.md | 19 | P2：resetState combatSpeed、InventoryPopup/CharacterInfoPopup 动画清理、NPC 坐标越界、日志时间戳、scrollTo 失败、伤害文本闪烁等 |
| 07-30 | fixed_20260730180000.md | 6 | P1 QA：测试覆盖补强（character/equipment/skill/store）、超长文件拆分（usePlayerAction→useLootHandler 等） |
| 07-30 | fixed_20260730220000.md | 1 | P2 TS-2：Boss 数据流类型断层，BossEnemyInstance 接口声明 phases/intro 运行时附加属性 |
| 07-31 | fixed_20260731130000.md | 4 | P2 架构：跨模块 import 路径统一收敛到 @/modules/xxx 公共入口（ARCH-3/4/5/7） |
| 07-31 | fixed_20260731150900.md | 1 | P3：console.ts 根目录 re-export 入口移除（ARCH-8 收尾） |
| 07-31 | fixed_20260731170000.md | 3 | P2 DB：跨表事务保护，equipItem/unequipItem/buyItem 引入 flushPersist 等待机制 |
| 07-31 | fixed_20260731180000.md | 6 | P2 QA：超长文件拆分审计收尾（QA-9~13 + ARCH-6 接口审计） |
| 07-31 | fixed_20260731190000.md | 34 | P3 批次：类型安全 12 项、业务逻辑、DB、架构、QA 审计 |
| 07-31 | fixed_20260731200000.md | 5 | P3 历史延后：TalentEffect 类型拆分 + hp_max 配置 bug 等 |
| 07-31 | fixed_20260731210000.md | 1 | P3-102：equipSkill "装备即学习"设计保留确认 |
| 07-31 | fixed_20260731220000.md | 4 | P3 历史延后：敌人魔法普攻支持、NPC 重叠修复等 |
| 07-31 | fixed_20260731230000.md | — | （见 git history） |

---

## 修复统计汇总

| 维度 | 修复项数 |
|------|----------|
| 业务逻辑（BIZ） | ~60 |
| 架构（ARCH） | ~15 |
| 类型安全（TS/CODE） | ~35 |
| 数据库（DB） | ~12 |
| 测试覆盖（QA） | ~25 |
| 性能（PERF） | ~5 |
| 资源管理（MEM） | ~8 |
| 其他（P3/INIT/DBG） | ~50 |

---

> **注意**：本文件为 2026 年 7 月归档的合并摘要。各修复的完整技术细节请通过 `git log` 查看原始归档文件内容。
