/**
 * @fileoverview 基础数据模块统一导出入口
 * @description 提供阵营、种族、职业等基础游戏数据的完整 CRUD 操作，通过统一的数据库接口获取数据
 * @module gameData
 */

export * from './types';
export { gameDataDbService } from './db';
export { gameDataService } from './service';
export { useGameDataStore } from './store';