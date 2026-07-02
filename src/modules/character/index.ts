/**
 * @fileoverview 角色模块统一导出入口
 * @description 导出角色模块的所有类型定义、数据层、纯逻辑函数和状态管理
 * @module character
 */

/** 导出类型定义（FactionType、ClassType、Stats、Character 等） */
export * from './types';

/** 导出数据层（CharacterDbService 类及 characterDbService 实例） */
export * from './db';

/** 导出纯逻辑函数（computeInitialStats、applyHpChange、applyExpGain 等） */
export * from './service';

/** 导出 Pinia 状态管理 Store（useCharacterStore）
 * 注意：Store 使用命名导出而非通配符导出，因为 Pinia store 函数必须按名称导入
 */
export { useCharacterStore } from './store';
