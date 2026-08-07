# 当前待修复问题

> 检查时间：2026-08-07
> 最近整理：2026-08-07（P3-162 AI 决策类型扩展完成并归档，清理已完成条目）
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
| P2-57 | handleDeath 自动复活：死亡惩罚=经验清零+半血复活，有意设计保留。P3-150 建议重新评估。 |
| P3-102 | equipSkill "装备即学习"为产品意图，有意保留。 |

---

## 统计

| 类别 | 数量 |
|------|------|
| 待办问题（玩法·P1） | 1（P3-150） |
| 待办问题（玩法·P2） | 1（P3-149） |
| 待办问题（内容·P3） | 1（P3-136） |
| 设计保留 | 2 |
| **待办合计** | **3** |

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
>
> 早期修复批次见 [archive_2026_07.md](file:///d:/openSource/wow_dnd/doc/fixed/archive_2026_07.md) 及 `doc/fixed/` 目录下各 `fixed_*.md` 文件。
