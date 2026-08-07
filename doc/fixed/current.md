# 当前待修复问题

> 检查时间：2026-08-07
> 最近整理：2026-08-07（P3-150 死亡经验惩罚修复完成并归档）
> tsc 状态：`tsc --noEmit --skipLibCheck` 通过（0 错误）
> 历史归档目录：[doc/fixed/](file:///d:/openSource/wow_dnd/doc/fixed/)
> 7月归档合并：[archive_2026_07.md](file:///d:/openSource/wow_dnd/doc/fixed/archive_2026_07.md)

---

## 待办问题

### P3-149（玩法·P2）：任务类型仅 kill/collect，目标类型枚举封闭
- **状态**：待修复
- **核实结果**（2026-08-07）：[src/modules/quest/types.ts:57](file:///d:/openSource/wow_dnd/src/modules/quest/types.ts#L57) `QuestType = 'kill' | 'collect'` 仍未扩展。
- **影响**：任务玩法单一，全部是"杀 N 只怪"，缺乏 talk/explore/escort/choice 等叙事多样性。
- **修复建议**：扩展 `QuestType` 联合类型，`talk`/`explore` 可低成本接入。
- **风险**：中。先做类型扩展再补数据。
- **关联**：与 P3-136 互补。

---

### P3-136（内容·P3）：补充 collect/talk/explore 任务
- **状态**：待补齐，属内容创作类
- **核实结果**（2026-08-07）：[config_quests.ts](file:///d:/openSource/wow_dnd/src/data/config_quests.ts) 188 处任务目标 `type` 全部为 `'kill'`，collect/talk/explore 为 0。
- **修复建议**：由策划补齐任务模板数据。先做 P3-149 类型扩展再补数据。
- **关联**：与 P3-149 互补。

---

---

## 设计保留项（有意保留，非待办）

| 编号 | 说明 |
|------|------|
| P2-57 | handleDeath 自动复活：死亡惩罚=损失50%本级经验+半血复活，有意设计保留。 |
| P3-102 | equipSkill "装备即学习"为产品意图，有意保留。 |

---

## 统计

| 类别 | 数量 |
|------|------|
| 待办问题（玩法·P2） | 1（P3-149） |
| 待办问题（内容·P3） | 1（P3-136） |
| 设计保留 | 2 |
| **待办合计** | **2** |

### 已修复批次

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
> 早期修复批次见 [archive_2026_07.md](file:///d:/openSource/wow_dnd/doc/fixed/archive_2026_07.md) 及 `doc/fixed/` 目录下各 `fixed_*.md` 文件。
