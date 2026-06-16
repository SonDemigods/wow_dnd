/**
 * @fileoverview 角色模块统一导出入口
 * @description 导出角色模块的所有类型定义、数据层、纯逻辑函数和状态管理
 * @module character
 */

/** 导出类型定义 */
export * from './types';

/** 导出数据层 */
export * from './db';

/** 导出纯逻辑函数（service 层） */
export * from './service';

/** 导出 Pinia 状态管理 Store */
export { useCharacterStore } from './store';
