# 后台管理模块设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 标题 | 后台管理模块设计文档 |
| 版本 | v1.0 |
| 生成日期 | 2026年8月13日 |
| 所属模块 | `modules/admin` + `components/admin` |
| 关联文档 | UI_DESIGN_SPEC_MAIN.md §7、MODULE_FUNCTIONS.md §1.4、DATA_ARCHITECTURE_OVERVIEW.md §4.2、DEPENDENCY_GRAPH.md §6.1.2 |
| 更新说明 | 初始版本：admin 模块全面升级后创建，覆盖 5 阶段全部内容——代码重构（AdminForm 拆 7 子组件 / useConfigTableMeta 拆 config-meta/ / AdminQueryService 迁入）、表格增强（分页/排序/列显隐/批量删除/行详情/行克隆）、表单校验（useFormValidation 5 种规则 + 键盘快捷键）、数据操作（导出 JSON/CSV / 导入预览 / 单表重置 / 引用完整性检查）、仪表盘升级（DashboardPanel 提取 / 数据概览 / 全局备份恢复重置）。 |

---

## 模块概述与定位

### 模块定位

后台管理模块是内嵌于单机游戏中的配置管理后台，提供对全部 15 张配置表（B1 定义型 4 张 + B2 调参型 11 张）的可视化 CRUD 管理能力。采用"视图层 + 数据层"双层架构：视图层（`components/admin/`）负责 UI 渲染与交互，数据层（`modules/admin/`）负责数据访问与业务逻辑。

### 核心职责

| 职责 | 描述 |
|------|------|
| 配置项 CRUD | 对 15 张 config_* 表执行增删改查，支持分页、排序、搜索 |
| 批量操作 | 批量删除选中记录（Promise.allSettled 并发） |
| 数据导入/导出 | 单表导出 JSON/CSV、单表导入（JSON/CSV 解析 + 预览 + 批量写入） |
| 单表重置 | 将指定表重置为源码默认值（DEFAULT_DATA_MAP 映射） |
| 引用完整性检查 | 删除前检查记录是否被其他表引用（referenceGraph） |
| 仪表盘 | 15 张表数据统计概览、Top3/空表/版本信息、全局备份/恢复/重置 |
| 控制台查询收口 | AdminQueryService 收口控制台命令对 4 个模块 DbService 的查询（CHR-5） |

### 设计决策

| 编号 | 决策 | 说明 |
|------|------|------|
| DISC-1 | service 层不做权限校验 | 单机游戏场景，访问控制由 UI 路由层负责；联机场景需补充权限中间件 |
| P4-002 | WRITABLE_TABLES 白名单 | 仅允许对 CONFIG_TABLES 中定义的 config_* 表执行写操作，拒绝 char_*/runtime_* 写入 |
| DISC-2 | AdminQueryService 迁入 modules/admin | 原位于 `src/services/AdminQueryService.ts`，迁入后作为 admin 模块一部分导出，减少 services 目录文件数（5→4） |

### 模块边界

**admin 模块**与以下模块/层交互：

- **data 模块**：AdminDbService 复用 `gameDb`（Dexie 实例）与 `dbService.withRetry`，所有表名受 `keyof GameDatabaseSchema` 约束
- **config 层**：defaultData.ts import 全部 15 个 `config_*.ts` 静态常量，供"重置默认值"使用
- **config/cache**：store.saveRecord/deleteRecord/importRecords/resetTable 在写入后调用 `configCache.invalidate()` 精准失效对应缓存
- **控制台模块**：console/commands/ 通过 `adminQueryService` 查询物品/敌人模板（CHR-5 收口）
- **enemy/boss/inventory/equipment 模块**：AdminQueryService 聚合调用 4 个模块的 DbService 查询方法
- **data/backup + data/import**：DashboardPanel 调用 `backupService.exportBackup()` 和 `importService.importBackup()` 实现全局备份/恢复

---

## 文件结构

### 数据层（modules/admin/）

| 文件 | 职责 |
|------|------|
| `index.ts` | 模块入口，导出 useAdminStore / adminService / adminDbService / adminQueryService / CONFIG_TABLES 及所有类型 |
| `types.ts` | 类型定义与 CONFIG_TABLES 常量（AdminView / ConfigTableName / ConfigTableMeta / AdminOperationResult / ReferenceOption / AdminRecord / FormMode / FormConfig） |
| `db.ts` | AdminDbService：对任意 Dexie 表提供泛型 CRUD（getAll / getById / add / update / delete / count / clear / search / bulkPut / getPaged）；复用 gameDb 与 dbService.withRetry；写入前经 toRawData 去除 Proxy 包装；update 在事务内 get+put 避免并发不一致；search 采用"name/id 索引 startsWithIgnoreCase + distinct"优先策略，索引缺失时回退全字段过滤；getPaged 支持排序（索引优先→内存回退）+ 搜索过滤 + 分页切片 |
| `service.ts` | AdminService：CRUD 业务封装（错误经 errorHandler 上报，返回 AdminOperationResult）；WRITABLE_TABLES 白名单（P4-002）；getPagedData 分页查询代理；getDashboardStats（Promise.all 并发统计 15 张表）；resetToDefaults（从 DEFAULT_DATA_MAP 获取源码默认值，清空 + bulkPut） |
| `store.ts` | useAdminStore（Pinia）：视图状态 / 表格数据 / 分页排序 / 表单状态 / 5 组参考数据；方法含 switchView / selectConfigTable / loadTableData / doSearch / toggleSort / changePage / changePageSize / openCreateForm / openEditForm / saveRecord / deleteRecord / importRecords / resetTable / loadReferenceData / invalidateConfigCache |
| `queryService.ts` | AdminQueryService：收口控制台命令模块对 enemy/boss/inventory/equipment DbService 的查询依赖（CHR-5）；提供 queryAllItemTemplates / queryItemTemplate / queryAllEnemyTemplates；查询失败不抛出，记录错误并返回空列表 |
| `referenceGraph.ts` | 配置表间引用关系图（REFERENCE_GRAPH）与关联检查（checkReferences / formatReferenceWarning）；支持 string 和 string[] 字段值匹配 |
| `defaultData.ts` | DEFAULT_DATA_MAP：将 15 个 config_*.ts 源文件静态常量映射到 Dexie 表名；skills 表需从 CLASS_ABILITIES + MONSTER_ABILITIES 展平为 SkillTemplateStorage 格式 |

### 视图层（components/admin/）

| 文件 | 职责 |
|------|------|
| `AdminLayout.vue` | 布局根组件：侧边栏（一级菜单"仪表盘"+"配置管理"，二级菜单 15 张表）+ 主内容区（DashboardPanel / ConfigManager） |
| `DashboardPanel.vue` | 仪表盘：统计卡片网格（15 张表记录数）+ 数据概览（总记录数/Top3/空表/版本信息）+ 快捷操作（全局备份/恢复/重置全部） |
| `ConfigManager.vue` | 配置管理编排器：AdminTable + AdminForm + ImportDialog + 多个确认弹窗；列显隐（localStorage 持久化）、批量删除、行克隆、导出 JSON/CSV、导入、重置默认 |
| `AdminTable.vue` | 通用数据表格：搜索（300ms 防抖）、列头排序、分页（10/20/50 条/页）、批量选择（全选/半选/单选）、行详情展开、行克隆；通过插槽支持自定义单元格/操作列/批量操作/列设置/行详情 |
| `AdminForm.vue` | 通用表单弹窗：通过 fieldComponentMap 将 8 种字段类型渲染委托给 fields/ 子组件；集成 useFormValidation 校验（blur 单字段 + 提交全量校验）；键盘快捷键（Esc 取消 / Ctrl+S 保存） |
| `ImportDialog.vue` | 导入预览弹窗：支持 JSON/CSV 格式，文件选择后解析预览前 5 条，确认后触发导入 |

### 字段子组件（components/admin/fields/）

| 子组件 | 对应类型 | 说明 |
|--------|----------|------|
| `TextField.vue` | text / number | 单行输入，number 类型提交时转 Number |
| `TextareaField.vue` | textarea | 多行文本 |
| `SelectField.vue` | select | 下拉选择 |
| `MultiselectField.vue` | multiselect | 复选网格 |
| `SwitchField.vue` | switch | 开关 |
| `ColorField.vue` | color | 颜色选择器 |
| `JsonField.vue` | json | JSON 文本编辑器，支持 submitError 状态 |
| `types.ts` | — | FormFieldType（8 种联合类型）+ FormField 接口（含校验属性 required/pattern/min/max/minLength/maxLength）+ FormFieldValue 联合类型 |

### Composables（components/admin/composables/）

| 文件 | 职责 |
|------|------|
| `useConfigTableMeta.ts` | 按 store.selectedConfigTable 动态分发当前表的列定义（注入字典翻译 format）和表单字段（注入下拉 options）；列定义和表单字段定义拆分到 config-meta/ 目录 |
| `useConfigCrud.ts` | 封装 CRUD 交互逻辑：handleCreate / handleEdit / handleDelete（含 checkReferences 关联检查）/ confirmDelete / handleFormSubmit |
| `useFormValidation.ts` | 表单校验引擎：5 种规则（required / pattern / min-max / minLength-maxLength / json）；提供 errors / validate / validateField / clearErrors |

### 配置元信息（components/admin/config-meta/）

| 文件 | 职责 |
|------|------|
| `columns.ts` | 15 张表的列定义（TableColumn[]），每张表定义 key/label/width/format/hidden |
| `formFields.ts` | 15 张表的表单字段定义（FormField[]），每张表定义字段的 key/label/type/options/required/校验属性 |
| `dictionaries.ts` | 字典翻译映射（阵营/属性/稀有度/物品类型/装备类型/地点类型/任务类型/技能类型/商店类型）+ 翻译辅助函数 t() |

---

## 配置表清单（CONFIG_TABLES）

共 15 张配置表（B1 定义型 4 张 + B2 调参型 11 张，其中 DATA-4 职业扩展系统 4 张于 2026-08-06 补入）：

| key | 中文名 | Dexie 表名 | 分层 |
|-----|--------|------------|------|
| factions | 阵营 | config_factions | B1 定义型 |
| races | 种族 | config_races | B1 定义型 |
| classes | 职业 | config_classes | B1 定义型 |
| locations | 地点 | config_locations | B1 定义型 |
| items | 物品 | config_items | B2 调参型 |
| equipmentItems | 装备 | config_equipment_items | B2 调参型 |
| mobs | 普通怪物 | config_mobs | B2 调参型 |
| bosses | Boss | config_bosses | B2 调参型 |
| quests | 任务 | config_quests | B2 调参型 |
| skills | 技能 | config_skills | B2 调参型 |
| shops | 商店 | config_shops | B2 调参型 |
| classEquipment | 职业装备 | config_class_equipment | DATA-4 |
| classPassives | 职业被动 | config_class_passives | DATA-4 |
| classTalents | 职业天赋 | config_class_talents | DATA-4 |
| setDefinitions | 职业套装 | config_set_definitions | DATA-4 |

---

## 数据流设计

### CRUD 数据流

```
用户操作 → ConfigManager → useConfigCrud → store.saveRecord/deleteRecord
    → adminService.add/update/delete（assertWritable 白名单校验）
    → adminDbService.add/update/delete（dbService.withRetry 重试）
    → Dexie 表（IndexedDB）
    → configCache.invalidate()（精准失效 talent/passive/sets 缓存）
    → store.loadTableData()（刷新当前页数据）
```

### 分页查询数据流

```
AdminTable 搜索/排序/翻页 → store.doSearch/toggleSort/changePage/changePageSize
    → store.loadTableData()
    → adminService.getPagedData(dbTable, page, pageSize, { sortBy, sortOrder, keyword })
    → adminDbService.getPaged(dbTable, page, pageSize, options)
        → keyword 有值: 先 search() 过滤
        → keyword 为空: table.toArray() 全量
        → sortBy 有值: 内存排序（数字/字符串，null 排末尾）
        → slice(offset, offset + pageSize) 分页切片
    → store.tableData + store.totalCount
```

### 导入数据流

```
ImportDialog 文件选择 → readFileAsText → parseJSON/parseCSV（类型推断）
    → 预览前 5 条 → 确认导入
    → store.importRecords(dbTable, records)
        → 逐条 adminService.add（含可选 ID）
        → invalidateConfigCache(dbTable)
        → store.loadTableData() 刷新
```

### 导出数据流

```
ConfigManager 导出按钮 → adminService.getAll(dbTable)（全量不分页）
    → exportJSON(data, tableName) / exportCSV(data, columns, tableName)
    → downloadBlob → 文件下载
```

### 重置默认值数据流

```
ConfigManager 重置确认 → store.resetTable()
    → adminService.resetToDefaults(dbTable)
        → assertWritable 白名单校验
        → DEFAULT_DATA_MAP[dbTable]() 获取源码默认值
        → adminDbService.clear(dbTable) 清空
        → adminDbService.bulkPut(dbTable, defaultData) 写入
    → invalidateConfigCache(dbTable)
    → store.loadTableData() 刷新
```

### 引用完整性检查流

```
useConfigCrud.handleDelete(row)
    → checkReferences(dbTable, recordId)
        → REFERENCE_GRAPH[dbTable] 获取引用方列表
        → 逐表 adminDbService.getAll → filter 匹配 recordId（支持 string/string[]）
    → formatReferenceWarning → 显示在删除确认弹窗中
```

### AdminQueryService 查询流（CHR-5）

```
console/commands/inventory.ts → adminQueryService.queryItemTemplate(itemId)
    → Promise.all([inventoryDbService.getItemTemplate, equipmentDbService.getEquipmentTemplate])
    → 消耗品优先返回
console/commands/combat.ts → adminQueryService.queryAllEnemyTemplates()
    → Promise.all([enemyDbService.getAllEnemyTemplates, bossDbService.getAllBossTemplates])
```

---

## 引用关系图（REFERENCE_GRAPH）

| 被引用表 | 引用方 | 引用字段 |
|----------|--------|----------|
| config_factions | config_races | factionId |
| config_factions | config_classes | factionsIds |
| config_races | config_classes | raceIds |
| config_classes | config_skills | classRestriction |
| config_classes | config_class_equipment | classRestriction |
| config_classes | config_class_passives | classId |
| config_classes | config_class_talents | classId |
| config_classes | config_set_definitions | classRestriction |
| config_locations | config_quests | boardId |
| config_set_definitions | config_class_equipment | setId |

---

## 工具函数

admin 模块依赖两个独立的工具文件（位于 `src/utils/`）：

| 文件 | 函数 | 说明 |
|------|------|------|
| `utils/exportData.ts` | exportJSON / exportCSV | JSON 下载 / CSV 下载（BOM + 列定义 + csvEscape 转义） |
| `utils/importData.ts` | parseJSON / parseCSV / readFileAsText | JSON 数组解析 / CSV 解析（引号内换行/逗号转义/BOM 移除/值类型推断） |

---

## 安全设计

| 机制 | 说明 |
|------|------|
| WRITABLE_TABLES 白名单（P4-002） | service 层 add/update/delete/clear/resetToDefaults 执行前调用 assertWritable，仅允许 CONFIG_TABLES 中定义的 config_* 表 |
| toRawData 序列化 | db.ts 所有写入操作前经 toRawData JSON 序列化去除 Vue/Proxy 包装，避免 IndexedDB DataCloneError |
| 事务保护 | db.ts update 在 gameDb.transaction('rw', table, ...) 内执行 get+put，避免并发写入导致数据不一致 |
| 运行时主键校验 | store.saveRecord 编辑模式校验 id 非空非空字符串；db.ts add 校验自动生成主键类型为 string |
| ConfigCache 精准失效 | store 写入 config_class_talents / config_class_passives / config_set_definitions 后精准失效对应缓存（P11-501） |

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-08-13 | 初始版本：admin 模块全面升级 5 阶段完成——代码重构（AdminForm 拆 7 子组件 / useConfigTableMeta 拆 config-meta/ / AdminQueryService 从 src/services/ 迁入 modules/admin/）、表格增强（分页/排序/列显隐/批量删除/行详情/行克隆）、表单校验（useFormValidation + 键盘快捷键）、数据操作（导出/导入/重置/引用检查）、仪表盘升级（DashboardPanel 提取 / 数据概览 / 全局备份恢复重置）。CONFIG_TABLES 11→15 张。 |

---

**文档结束**
