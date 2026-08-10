# 当前待修复问题

> 最近检查：2026-08-10（第七轮全量代码审查修复，P2×16 + P3×65 = 81 项全部修复）
> tsc / eslint / vitest：全部通过（模块测试 187 文件 5779 项；组件测试 25 文件 51 项预存失败）
> 归档目录：[doc/fixed/](./)

---

## 待办问题

无。

---

## 验证后排除项（非问题，勿重复报告）

| 编号 | 说明 |
|------|------|
| P6-002 | `enemies` 是从 `enemyIds` 派生的 computed，push 后自动反映。 |
| P6-008 | 空敌人分支不 emit COMBAT_END，测试明确断言，设计如此。 |
| P6-103 | 兜底发放金币/经验替代物品，不 emit count=0 事件。 |
| P6-104 | `CAMP_HEAL_HP = Number.MAX_SAFE_INTEGER`，receiveHeal 限幅实现完全恢复。 |
| P6-156 | BaseIcon 已有完善 SVG 净化。 |
| P6-157 | 所有 querySelector 调用已有 `instanceof HTMLElement` 守卫。 |
| P7-EX-01 | Quest 模块无 daily/elite/chain——Vue3 项目从未设计此功能。 |
| P7-EX-02 | computeEventProbability 舍入偏差——P6-102 已修复。 |
| P8-004 | AI 策略 isHeal/isBuff 互斥正确。 |
| P8-018 | collectAllData adventureLog 按 characterId 覆盖正确。 |
| P8-019 | withRetry 末尾 throw 不可达但满足 TS 返回类型推断。 |
| P9-020 | `runtime_combatLogs` 表无 `characterId` 索引，战斗日志属于战斗会话而非角色，无法高效按角色删除。 |
| P9-090 | organVoice 为 BGM 合成器，通过独立 bgmDelay→bgmReverb→bgmChannel 路由，routeSynthTo 仅切换 SFX 合成器，设计如此。 |

---

## 设计保留项（有意保留，非待办）

| 编号 | 说明 |
|------|------|
| P2-57 | handleDeath 自动复活：损失50%本级经验+半血复活。 |
| P3-102 | equipSkill "装备即学习"为产品意图。 |
| P4-D1 | applyExpGain 满级后经验直接丢弃。 |
| P5-005 | 无 attribute_potion 的 stat 消耗品走 applyBonus 路径，既有设计。 |
| P5-008 | mana_restore 先扣 MP 再恢复，设计意图。 |
| P5-028 | useResponsiveGrid itemSize 含 gap，RecycleScroller 正确行为。 |
| P6-056 | capabilityRegistry 占位处理器为类型闭合+扩展点。 |
| P6-150 | popupMounted 与 showXxx 状态冗余：P5-029 已修 shop 路径。 |
| P6-151 | init 有 try-catch+disposed 标记。 |
| P6-158 | CharacterInfoPopup 超 50 行需较大重构，保持现状。 |
| P6-159 | refreshData await 已有 try-catch 外层保护。 |
| P6-160 | configCache.loadAll 有 finally+catch 兜底。 |
| P6-161 | INVENTORY_FULL 内联文案简单直接。 |
| P6-203 | errorReport dispose flush 低风险观察项。 |

---

## 已修复批次

| 轮次 | 归档 | 项数 |
|------|------|------|
| 第七轮 P2+P3 | [fixed_20260810152700.md](./fixed_20260810152700.md) | 81 |
| 第六轮 | [fixed_20260810134000.md](./fixed_20260810134000.md) | 27 |
| 第五轮 | [fixed_20260810122430.md](./fixed_20260810122430.md) | 59 |
| 第四轮 | [fixed_20260810113526.md](./fixed_20260810113526.md) | 33 |
| 第三轮 P3 | [fixed_20260810101500.md](./fixed_20260810101500.md) | 12 |
| 第三轮 P1+P2 | [fixed_20260810100500.md](./fixed_20260810100500.md) | 18 |
| 第二轮 | [fixed_20260810092323.md](./fixed_20260810092323.md) | 31 |
| 第一轮 | [fixed_20260810083448.md](./fixed_20260810083448.md) | 25 |
| 7月及更早 | [archive_2026_07.md](./archive_2026_07.md) 及 `fixed_*.md` | — |
