/**
 * 基础数据管理模块
 * 
 * 提供阵营、种族、职业等基础数据的完整CRUD操作
 * 通过统一的数据库接口获取数据，确保数据一致性和安全性
 */

export * from './types';
export { gameDataDbService } from './db';
export { gameDataService } from './service';
export { useGameDataStore } from './store';