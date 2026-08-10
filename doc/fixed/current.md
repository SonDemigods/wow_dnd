# 当前待修复问题

> 最近检查：2026-08-10（第六轮全量代码审查，303 源文件，7 子代理并行）
> tsc / eslint / vitest：全部通过（模块测试 187 文件 5775 项；组件测试 25 文件 51 项预存失败）
> 归档目录：[doc/fixed/](./)

---

## 待办问题

### P2 — 重要（16 项）

### P9-010: Boss 反击伤害对宠物攻击错误施加给玩家
- **文件**: src/modules/combat/composables/usePetAction.ts, src/modules/combat/composables/useBossMechanics.ts
- **行号**: usePetAction.ts L173; useBossMechanics.ts L351-L375
- **问题描述**: 宠物攻击 Boss 后 `applyBossCounterMechanics` 内部通过 `applyDamageToPlayer` 将反击施加给玩家而非宠物。
- **建议修复**: 增加 `attackerType` 参数或 `applyDamageToPet` 方法。

### P9-014: dropItemsByIndices 批量丢弃不记录日志
- **文件**: src/modules/inventory/composables/useInventoryItems.ts L82-98
- **建议修复**: 对每个丢弃物品调用 `logItemDropped` 或汇总记录。

### P9-015: onItemCollected 回调 fire-and-forget，异步错误被静默吞没
- **文件**: src/modules/inventory/composables/useInventoryState.ts L136-138
- **建议修复**: 包装 `.catch(err => errorReporter.report(err))`。

### P9-017: SET_PARTS（195件套装部件）未持久化到 IndexedDB
- **文件**: src/modules/data/initializer.ts, src/data/config_set_parts.ts
- **建议修复**: 导入 SET_PARTS 并 bulkPut 到 DB。

### P9-018: importData 使用 bulkPut 而非 clear+bulkPut，导入后残留旧数据
- **文件**: src/modules/data/importer.ts L140-215
- **建议修复**: 事务内写入前 clear 所有目标表，或提供 replace/merge 模式。

### P9-023: castSkill 未校验沉默状态与资源消耗
- **文件**: src/modules/skill/composables/useSkillCasting.ts L30-36
- **建议修复**: 从 combatStore 获取状态构造完整 `CanCastSkillOptions`。

### P9-029: equipItem 装备双手武器时 weapon2 卸下失败导致回滚不完整
- **文件**: src/modules/equipment/composables/useEquipmentOps.ts L52-68
- **建议修复**: catch 中增加对 previousEquipped 的重新装备。

### P9-030: 套装 bonus diff 的 key 碰撞
- **文件**: src/modules/equipment/composables/useSetBonus.ts L22-48
- **建议修复**: key 中加入档位标识（如 `requiredPieces`）。

### P9-033: 音频效果链 fan-out 导致 SFX 信号多通道叠加、音量倍增
- **文件**: src/modules/audio/effectChains.ts L128-L145
- **建议修复**: `routeSynthTo` 同时切换效果器到通道的连接，或使用独立效果器实例。

### P9-034: movePlayer 穿过 completed 格子时不刷新视线
- **文件**: src/modules/exploration/store.ts L316-L321
- **建议修复**: `revealGrid` 返回 false 时仍调用 `refreshGrid()`。

### P9-035: createEnemy 返回对象与缓存对象不同步
- **文件**: src/modules/enemy/store.ts L76-L78, L88-L90
- **建议修复**: 返回缓存引用。

### P9-036: applyEventChoice 回退搜索标记错误的事件格
- **文件**: src/modules/exploration/store.ts L283-L299
- **建议修复**: 记录目标格坐标，用坐标定位而非全网格搜索。

### P9-039: addEffectToContainer 调用方均未传入 registry，onRemove 回调永远不触发
- **文件**: 多 composables + effects/container.ts
- **建议修复**: 所有调用方传入 registry 参数；`addEffectToPlayer` 补充 onApply 调用。

### P9-040: removeEffectFromContainer 未调用 onRemove 回调
- **文件**: src/modules/combat/effects/container.ts
- **建议修复**: 增加 registry 参数并调用 onRemove。

### P9-041: stat_modifier attackMultiplier 在防御减免之后应用
- **文件**: src/modules/combat/effects/pipeline.ts
- **建议修复**: 将 attackMultiplier 应用到 `rawDamage`（防御减免前）。

### P9-043: handleDeath fire-and-forget 后 cleanup 可能导致角色状态不一致
- **文件**: src/modules/combat/store.ts
- **建议修复**: await handleDeath 或确保 cleanup 不影响角色状态。

---

### P3 — 改进（65 项）

### P9-045: Quest 进度条目 target 不同步定义变更
- **文件**: src/modules/quest/service.ts L55-61

### P9-046: useItem 对多效果消耗品仅处理首个非 stat 效果
- **文件**: src/modules/inventory/composables/useItemEffect.ts L23-36

### P9-047: resetInventory 不 await persistInventory，角色切换竞态
- **文件**: src/modules/inventory/composables/useInventoryState.ts L172-175

### P9-048: dropItemByIndex 重复查询物品模板
- **文件**: src/modules/inventory/composables/useInventoryItems.ts L64, L78

### P9-049: Shop buyItem 未校验商品价格为正数
- **文件**: src/modules/shop/store.ts L196-208

### P9-050: Admin add 方法自动生成主键的类型安全缺失
- **文件**: src/modules/admin/db.ts L68-74

### P9-051: Shop sellItem 未 await removeItem 持久化
- **文件**: src/modules/shop/store.ts L353

### P9-052: 模块级回调变量在测试中可能互相污染
- **文件**: src/modules/quest/store.ts L96-97; src/modules/inventory/composables/useInventoryState.ts L21

### P9-053: organizeInventory 不尊重用户排序偏好
- **文件**: src/modules/inventory/composables/useInventoryItems.ts L100-127

### P9-054: 日志函数同步签名但内部 fire-and-forget 异步
- **文件**: src/modules/inventory/composables/useInventoryState.ts L153-171

### P9-055: Admin update 用 put 覆盖整行，嵌套对象部分更新丢失字段
- **文件**: src/modules/admin/db.ts L81-89

### P9-056: importBackup 重复读取文件两次
- **文件**: src/modules/data/importer.ts L73-100, L103-135

### P9-057: MigrationService.runStartupMigration 未检查 update 返回值
- **文件**: src/modules/data/migrations/service.ts L67-70

### P9-058: initGameConstants 写入已废弃 maxLevel 字段（死代码）
- **文件**: src/modules/data/initializer.ts L223-227

### P9-059: initializeData 与 reinitializeData 重复初始化逻辑
- **文件**: src/modules/data/initializer.ts L57-112, L240-295

### P9-060: adventureLog 备份丢失原始 updatedAt 时间戳
- **文件**: src/modules/data/backup.ts L146-149; src/modules/data/importer.ts L172-178

### P9-061: GameBootstrap.initialize 无部分失败回滚机制
- **文件**: src/services/GameBootstrap.ts L65-145

### P9-062: validateTalentData bannedEffectTypes 缺少 mana_max
- **文件**: src/data/validate.ts L182-186

### P9-063: reinitializeData 事务包含 runtime_mapState 但未使用
- **文件**: src/modules/data/initializer.ts L252-272

### P9-064: types.ts 使用 typeof 引入运行时依赖到纯类型文件
- **文件**: src/modules/data/types.ts L8-18, L198-223

### P9-065: config_class_passives.ts 文件注释与实际数据不符
- **文件**: src/data/config_class_passives.ts L3-4

### P9-066: initSkillTemplates 使用 as unknown as 双重断言
- **文件**: src/modules/data/initializer.ts L185-200

### P9-067: useCombatAutoClose/useCombatSpeed 直接 import useCombatStore
- **文件**: src/modules/combat/composables/useCombatAutoClose.ts, useCombatSpeed.ts

### P9-068: usePetAction 直接 import usePetStore
- **文件**: src/modules/combat/composables/usePetAction.ts L23, L43

### P9-069: AOE 暴击不触发暴击视觉特效
- **文件**: src/modules/combat/composables/useCombatAnimations.ts L296-L303

### P9-070: checkLowHpPassives 魔法数字 0.3
- **文件**: src/modules/combat/composables/usePassiveSkills.ts L128

### P9-071: forms/store.ts switchTo 不应用形态属性修正
- **文件**: src/modules/combat/forms/store.ts L107-L130

### P9-072: BaseResourceSystem.applyGeneration 不防御 NaN
- **文件**: src/modules/combat/resources/BaseResourceSystem.ts L67-L73

### P9-073: useBossIntroOverlay dispose 不清理 setAnimTimer 回调
- **文件**: src/modules/combat/composables/useBossIntroOverlay.ts L92-L107

### P9-074: 副资源 generate 方法中 Math.min 与 maxValue 重复裁剪
- **文件**: ComboPointSystem.ts 等 6 个副资源系统

### P9-075: RuneSystem onKill 未在 useInitiative 中统一调用
- **文件**: src/modules/combat/composables/useInitiative.ts

### P9-076: useCombatLog saveLogs forceAll 竞态可能丢失日志
- **文件**: src/modules/combat/composables/useCombatLog.ts L59-L86

### P9-077: forms/store.ts 直接 import useCharacterStore/useLogStore
- **文件**: src/modules/combat/forms/store.ts L18-L20

### P9-078: mana_restore 设置 heal 字段导致意外回血
- **文件**: src/modules/skill/composables/useSkillCasting.ts L82-85

### P9-079: computeBonusChange 对 applyBonus 使用 clampStat（下界 1），零值加成变为 1
- **文件**: src/modules/character/service.ts L201-214

### P9-080: selectCharacter 在 currentCharacterId 已变更后才 emit CHARACTER_LOGOUT
- **文件**: src/modules/character/store.ts L326-340

### P9-081: character reset 不清除 talentAllocations
- **文件**: src/modules/character/store.ts L536-560

### P9-082: removeEquipmentTemplate DB 删除失败时不回滚内存状态
- **文件**: src/modules/equipment/composables/useEquipmentState.ts L160-166

### P9-083: hp_multiplier 天赋效果类型为死代码
- **文件**: src/modules/character/talents/types.ts L47; service.ts L164-165

### P9-084: useSkillState.reset() 持久化空技能数据可能覆盖有效存档
- **文件**: src/modules/skill/composables/useSkillState.ts L192-199

### P9-085: AudioService.destroy 不清理 DOM 事件监听器
- **文件**: src/modules/audio/service.ts L73-89, L230

### P9-086: MapStore.saveMapState 可能写入 undefined 值
- **文件**: src/modules/map/db.ts L16-28

### P9-087: map/store.ts getState 的 Object.freeze 仅冻结顶层
- **文件**: src/modules/map/store.ts L103-L109

### P9-088: enemy/store.ts useSkill 治疗量基于物理攻击力
- **文件**: src/modules/enemy/store.ts L155-L157

### P9-089: BossPhaseManager.findPhaseIndex 全 0 阈值时静默回退
- **文件**: src/modules/boss/phaseManager.ts L66-L79

### P9-090: organVoice 不参与 routeSynthTo 动态路由
- **文件**: src/modules/audio/effectChains.ts L155-L200

### P9-091: enterArea 与 enterZone 重复发射 ZONE_ENTERED 事件
- **文件**: src/modules/exploration/store.ts L241; src/modules/map/store.ts L133

### P9-092: onBattleResult 失败路径未触发 checkCompletion
- **文件**: src/modules/exploration/store.ts L355-L365

### P9-093: BgmSynth dispose 冗余调用
- **文件**: src/modules/audio/synth/bgmSynth.ts L228-L240

### P9-094: main.ts 音频延迟初始化失败后事件监听器累积
- **文件**: src/main.ts L80-87

### P9-095: ExplorationView handleCellClick 缺少 try/catch
- **文件**: src/components/ExplorationView.vue L220-229

### P9-096: MapView onMapTouchMove 未检查 e.cancelable
- **文件**: src/components/MapView.vue L165

### P9-097: AdventureLogPopup 新增日志时不自动滚动
- **文件**: src/components/popup/AdventureLogPopup.vue L86-92

### P9-098: CharacterInfoPopup 属性分配/重置缺少 try/catch
- **文件**: src/components/popup/CharacterInfoPopup.vue L209-219

### P9-099: CharacterInfoPopup useToast() 未在 setup 层缓存
- **文件**: src/components/popup/CharacterInfoPopup.vue L254, L321, L338, L351

### P9-100: QuestPopup 放弃任务/加载任务缺少 try/catch
- **文件**: src/components/popup/QuestPopup.vue L109-116

### P9-101: SkillsPopup 技能记忆/遗忘缺少 try/catch
- **文件**: src/components/popup/SkillsPopup.vue L100-122

### P9-102: ArchiveManagerPopup 导出存档成功无用户反馈
- **文件**: src/components/popup/ArchiveManagerPopup.vue L174-181

### P9-103: AdminForm JSON 解析失败仍提交表单
- **文件**: src/components/admin/AdminForm.vue L207-213

### P9-104: GameMain onMounted 中 init() 未捕获异常
- **文件**: src/components/GameMain.vue L286

### P9-105: CombatPopup onMounted 中 skillsStore.initialize 未 await
- **文件**: src/components/popup/CombatPopup.vue L489-492

### P9-106: AdminLayout/ConfigManager onMounted store 调用未处理异常
- **文件**: src/components/admin/AdminLayout.vue L42-44; ConfigManager.vue L32-34

### P9-107: AI 策略注册表未注入确定性 RNG
- **文件**: src/modules/combat/composables/useEnemyAction.ts

### P9-108: 非宠物职业默认初始化为 'warlock' 宠物系统
- **文件**: src/modules/combat/store.ts

### P9-109: 护盾耗尽后未从容器移除
- **文件**: src/modules/combat/effects/handlers/shield.ts

### P9-042: handleEnemyHeal 的 heal 字段可能为负值
- **文件**: src/modules/combat/composables/useEnemyAction.ts

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
| 第六轮 | [fixed_20260810134000.md](./fixed_20260810134000.md) | 27 |
| 第五轮 | [fixed_20260810122430.md](./fixed_20260810122430.md) | 59 |
| 第四轮 | [fixed_20260810113526.md](./fixed_20260810113526.md) | 33 |
| 第三轮 P3 | [fixed_20260810101500.md](./fixed_20260810101500.md) | 12 |
| 第三轮 P1+P2 | [fixed_20260810100500.md](./fixed_20260810100500.md) | 18 |
| 第二轮 | [fixed_20260810092323.md](./fixed_20260810092323.md) | 31 |
| 第一轮 | [fixed_20260810083448.md](./fixed_20260810083448.md) | 25 |
| 7月及更早 | [archive_2026_07.md](./archive_2026_07.md) 及 `fixed_*.md` | — |
