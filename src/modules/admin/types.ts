/**
 * 后台管理模块类型定义
 *
 * 定义管理后台通用的类型、接口和枚举
 */

import type { OperationResult, PaginatedResult } from '../data/types';

// 重新导出共享类型，保持向后兼容
export type { OperationResult as AdminOperationResult, PaginatedResult } from '../data/types';

/** 管理后台视图状态 */
export type AdminView = 'dashboard' | 'config';

/** 配置表名称枚举（对应所有 config_* 表） */
export type ConfigTableName =
  | 'factions'
  | 'races'
  | 'classes'
  | 'items'
  | 'equipmentItems'
  | 'enemies'
  | 'quests'
  | 'skills'
  | 'locations'
  | 'shops';

/** 配置表元信息 */
export interface ConfigTableMeta {
  /** 表标识 */
  key: ConfigTableName;
  /** 中文显示名称 */
  label: string;
  /** 表说明 */
  description: string;
  /** Dexie 表名 */
  dbTable: string;
}

/** 所有配置表元信息列表 */
export const CONFIG_TABLES: ConfigTableMeta[] = [
  { key: 'factions', label: '阵营', description: '联盟/部落/中立阵营', dbTable: 'config_factions' },
  { key: 'races', label: '种族', description: '26个可选种族', dbTable: 'config_races' },
  { key: 'classes', label: '职业', description: '13个职业定义', dbTable: 'config_classes' },
  { key: 'items', label: '物品', description: '消耗品/材料模板', dbTable: 'config_items' },
  { key: 'equipmentItems', label: '装备', description: '武器装备模板', dbTable: 'config_equipmentItems' },
  { key: 'enemies', label: '敌人', description: '怪物/Boss模板', dbTable: 'config_enemies' },
  { key: 'quests', label: '任务', description: '任务定义', dbTable: 'config_quests' },
  { key: 'skills', label: '技能', description: '职业技能模板', dbTable: 'config_skills' },
  { key: 'locations', label: '地点', description: '大陆/地点数据', dbTable: 'config_locations' },
  { key: 'shops', label: '商店', description: '商店配置', dbTable: 'config_shops' },
];

/** 分页参数 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  searchKeyword?: string;
}

/** 表单模式 */
export type FormMode = 'create' | 'edit';

/** 表单配置 */
export interface FormConfig {
  mode: FormMode;
  visible: boolean;
  title: string;
}
