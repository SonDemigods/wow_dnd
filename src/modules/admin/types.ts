/**
 * @fileoverview 后台管理模块类型定义
 * @description 定义管理后台通用的类型、接口和常量，包括配置表元信息、表单状态、
 *              视图切换和下拉选项等核心数据结构。本文件是 admin 模块的类型基石，
 *              所有类型和常量均在此集中定义，通过 index.ts 的 export * 对外暴露。
 * @module admin
 */

// ============================================================================
// 共享类型导入
// ============================================================================

/**
 * 管理后台操作结果类型
 *
 * 从 data 模块重导出通用的 `OperationResult` 接口并赋以更具语义化的别名，
 * 供 admin 模块的 service 层统一使用。
 *
 * @see OperationResult data 模块的通用操作结果接口
 */
export type { OperationResult as AdminOperationResult } from '@/modules/data/types';

// ============================================================================
// 通用接口
// ============================================================================

/**
 * 参考数据下拉选项接口
 *
 * 统一管理后台配置页面中所有下拉选择器的选项数据格式。
 * 阵营、种族、职业、地点、大陆等参考数据均使用此接口规范。
 *
 * @property {string} value - 选项值（通常为配置数据的 ID）
 * @property {string} label - 选项显示文本（通常为配置数据的 name 字段）
 *
 * @see useAdminStore.loadReferenceData 加载参考数据并转换为 ReferenceOption[]
 */
export interface ReferenceOption {
  value: string;
  label: string;
}

/**
 * 管理后台通用记录类型
 *
 * 后台管理模块操作任意配置表，记录结构动态变化（字段名/类型因表而异）。
 * 使用 `unknown` 而非 `any` 保留类型安全，访问具体字段时通过 `typeof` 收窄。
 *
 * @see ConfigManager.vue handleEdit/handleDelete/handleFormSubmit 使用此类型
 * @see AdminForm.vue initialData/submit/formData 使用此类型
 */
export type AdminRecord = Record<string, unknown>;

// ============================================================================
// 视图与表单类型
// ============================================================================

/**
 * 管理后台视图状态
 *
 * 定义后台管理界面的两种视图模式。
 * - `dashboard`：仪表盘视图，展示各表数据统计概览
 * - `config`：配置管理视图，允许对选中表进行 CRUD 操作
 *
 * @see AdminLayout.vue 根据此状态切换显示的组件
 */
export type AdminView = 'dashboard' | 'config';

/**
 * 配置表名称联合类型
 *
 * 定义后台管理可操作的全部 11 张配置表的后缀标识。
 * 注意：此为短名称（key），对应完整的 Dexie 表名需拼接 `config_` 前缀
 * （如 `factions` → `config_factions`）。
 *
 * @see CONFIG_TABLES key 字段使用此类型，dbTable 字段存储完整表名
 */
export type ConfigTableName =
  | 'factions'
  | 'races'
  | 'classes'
  | 'items'
  | 'equipmentItems'
  | 'mobs'
  | 'bosses'
  | 'quests'
  | 'skills'
  | 'locations'
  | 'shops';

/**
 * 配置表元信息接口
 *
 * 描述一张配置表的完整元数据，将短名称（key）与完整 Dexie 表名（dbTable）
 * 关联起来，并提供面向用户的显示标签和说明文本。
 *
 * @property {ConfigTableName} key - 表标识（短名称，用于内部引用和路由）
 * @property {string} label - 中文显示名称（用于 UI 侧边栏和面包屑）
 * @property {string} description - 表说明（用于提示和帮助文本）
 * @property {string} dbTable - 对应的 Dexie 表全名（如 `config_factions`），
 *   传递给 AdminDbService 进行数据库操作
 *
 * @see CONFIG_TABLES 所有表的元信息列表
 * @see AdminDbService 使用 dbTable 字段作为 tableName 参数访问 Dexie 表
 */
export interface ConfigTableMeta {
  key: ConfigTableName;
  label: string;
  description: string;
  dbTable: string;
}

// ============================================================================
// 表单状态类型
// ============================================================================

/**
 * 表单模式
 *
 * 区分管理后台的数据编辑表单是新建记录还是编辑已有记录。
 * 影响表单标题、初始值填充和保存逻辑（add vs update）。
 *
 * @see FormConfig.mode 表单配置中使用此类型
 * @see useAdminStore.saveRecord 根据 mode 决定调用 add 或 update
 */
export type FormMode = 'create' | 'edit';

/**
 * 表单配置接口
 *
 * 管理后台编辑表单的完整状态描述，由 Pinia store 管理，
 * 控制表单的显示/隐藏、标题和操作模式。
 *
 * @property {FormMode} mode - 表单操作模式（新建 / 编辑）
 * @property {boolean} visible - 表单弹窗是否可见
 * @property {string} title - 表单标题（如"新建阵营"、"编辑种族"）
 *
 * @see useAdminStore.formConfig 表单状态的 Pinia 存储
 * @see useAdminStore.openCreateForm 创建模式下的表单打开逻辑
 * @see useAdminStore.openEditForm 编辑模式下的表单打开逻辑
 */
export interface FormConfig {
  mode: FormMode;
  visible: boolean;
  title: string;
}

// ============================================================================
// 配置表常量
// ============================================================================

/**
 * 所有配置表元信息列表
 *
 * 模块内配置表的唯一事实来源。包含全部 11 张配置表的元数据，
 * 用于动态生成侧边栏导航、仪表盘统计和表名映射。
 *
 * 使用场景：
 * 1. `AdminLayout.vue` 使用此列表渲染侧边栏表选择器
 * 2. `ConfigManager.vue` 通过 `key` 获取当前选中表的元信息
 * 3. `AdminService.getDashboardStats` 通过 `CONFIG_TABLES.map(t => t.dbTable)` 动态获取所有表名
 *
 * @see AdminService.getDashboardStats 使用此常量派生表名列表
 * @see useAdminStore.currentTableMeta 通过 key 从中查找当前选中表的元信息
 */
export const CONFIG_TABLES: ConfigTableMeta[] = [
  { key: 'factions', label: '阵营', description: '光辉盟约/铁血盟约/中立阵营', dbTable: 'config_factions' },
  { key: 'races', label: '种族', description: '26个可选种族', dbTable: 'config_races' },
  { key: 'classes', label: '职业', description: '13个职业定义', dbTable: 'config_classes' },
  { key: 'items', label: '物品', description: '消耗品/材料模板', dbTable: 'config_items' },
  { key: 'equipmentItems', label: '装备', description: '武器装备模板', dbTable: 'config_equipmentItems' },
  { key: 'mobs', label: '普通怪物', description: '普通怪物模板', dbTable: 'config_mobs' },
  { key: 'bosses', label: 'Boss', description: 'Boss 模板', dbTable: 'config_bosses' },
  { key: 'quests', label: '任务', description: '任务定义', dbTable: 'config_quests' },
  { key: 'skills', label: '技能', description: '职业技能模板', dbTable: 'config_skills' },
  { key: 'locations', label: '地点', description: '大陆/地点数据', dbTable: 'config_locations' },
  { key: 'shops', label: '商店', description: '商店配置', dbTable: 'config_shops' },
];
