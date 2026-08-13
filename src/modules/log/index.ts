/**
 * @fileoverview 冒险日志模块统一导出入口
 * @description 导出冒险日志模块的所有类型定义、数据层、服务层和状态管理
 * @module log
 */
export type {
  LogType,
  LogEntry,
  AdventureLogData
} from './types';

export { AdventureLogDbService, adventureLogDbService } from './db';

export { generateLogId, LOG_TYPE_ICONS } from './service';
export { useLogStore } from './store';
