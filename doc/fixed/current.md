# 当前待修复问题

> 检查时间：2026-08-10
> 最近整理：2026-08-10（第二轮全量代码审查 31 项全部修复并归档）
> tsc 状态：`tsc --noEmit --skipLibCheck` 通过（0 错误）
> eslint 状态：通过（0 错误，0 warnings）
> vitest 状态：97 文件 3531 项全通过
> 历史归档目录：[doc/fixed/](file:///d:/openSource/wow_dnd/doc/fixed/)
> 7月归档合并：[archive_2026_07.md](file:///d:/openSource/wow_dnd/doc/fixed/archive_2026_07.md)

---

## 待办问题

（暂无待办问题）

---

## 设计保留项（有意保留，非待办）

| 编号 | 说明 |
|------|------|
| P2-57 | handleDeath 自动复活：死亡惩罚=损失50%本级经验+半血复活，有意设计保留。 |
| P3-102 | equipSkill "装备即学习"为产品意图，有意保留。 |
| P4-D1 | applyExpGain 满级后经验直接丢弃（`newExp = 0`）：与多数 RPG 设计一致。 |
| P5-005 | 无 attribute_potion 能力的 stat 消耗品走 applyBonus 路径（bonusStats 层）为既有设计，dragon_breath_chili 等物品依赖此行为。DEV 环境保留 warn 提示。 |
| P5-008 | mana_restore 技能先扣 MP 再恢复（changeMp 两次）为设计意图（花 MP 换更多 MP）。 |
| P5-028 | useResponsiveGrid 的 itemSize 包含 gap 是 RecycleScroller gridItems 模式的正确行为。 |

---

## 统计

| 类别 | 数量 |
|------|------|
| 待办问题 | 0 |
| 设计保留 | 6 |
| **待办合计** | **0** |

### 已修复批次

> 第二轮全量代码审查修复（P5-001~031）共 31 项于 2026-08-10 全部修复：
>
> | 批次 | 归档 | 项数 |
> |------|------|------|
> | P1 严重 | [fixed_20260810092323.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260810092323.md) | 5（P5-001~005，其中 005/008 回退为设计保留）|
> | P2 中等 | 同上 | 13（P5-006~018，其中 008 回退为设计保留）|
> | P3 轻微 | 同上 | 13（P5-019~031，其中 028 回退为设计保留）|
>
> 第一轮全量代码审查修复（P4-001~025）共 25 项于 2026-08-10 全部修复：
>
> | 批次 | 归档 | 项数 |
> |------|------|------|
> | P1 严重 | [fixed_20260810083448.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260810083448.md) | 4（P4-001/002/003/004）|
> | P2 中等 | 同上 | 14（P4-005~018）|
> | P3 轻微 | 同上 | 7（P4-019~025）|
>
> 战斗系统专项（P3-168~187）共 20 项于 2026-08-07 全部修复，分 5 批归档：
>
> | 批次 | 归档 | 项数 |
> |------|------|------|
> | P0 严重修复 | [fixed_20260807104011.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807104011.md) | 4（P3-168/169/170/171）|
> | P1 高优修复 | [fixed_20260807104831.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807104831.md) | 4（P3-172/173/174/175）|
> | P2 中优修复 | [fixed_20260807111130.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807111130.md) | 7（P3-176/177/178/179/180/181/182）|
> | P3 低优修复 | [fixed_20260807112730.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807112730.md) | 4（P3-183/184/185/186）|
> | 测试补齐 | [fixed_20260807114900.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807114900.md) | 1（P3-187，+85 用例）|
>
> 玩法扩展批次（2026-08-07）：
>
> | 批次 | 归档 | 项数 |
> |------|------|------|
> | 怪物/Boss 扩展 | [fixed_20260807132900.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807132900.md) | 1（P3-167）|
> | AI 决策扩展 | [fixed_20260807161000.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807161000.md) | 1（P3-162）|
> | 死亡经验惩罚 | [fixed_20260807162643.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807162643.md) | 1（P3-150）|
>
> 任务类型扩展批次（2026-08-07）：
>
> | 批次 | 归档 | 项数 |
> |------|------|------|
> | 任务类型扩展+内容补齐 | [fixed_20260807175000.md](file:///d:/openSource/wow_dnd/doc/fixed/fixed_20260807175000.md) | 2（P3-149/136）|
>
> 早期修复批次见 [archive_2026_07.md](file:///d:/openSource/wow_dnd/doc/fixed/archive_2026_07.md) 及 `doc/fixed/` 目录下各 `fixed_*.md` 文件。
