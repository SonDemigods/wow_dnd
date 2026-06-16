/**
 * 后台管理模块
 *
 * 提供游戏数据后台管理功能，支持对所有数据表进行增删改查
 */
export { useAdminStore } from './store';
export { adminService } from './service';
export { adminDbService } from './db';
export { CONFIG_TABLES } from './types';
export type {
  AdminView,
  ConfigTableName,
  ConfigTableMeta,
  AdminOperationResult,
  PaginationParams,
  PaginatedResult,
  FormMode,
  FormConfig,
} from './types';
