/**
 * @fileoverview 基础数据模块统一导出入口
 * @description 提供阵营、种族、职业等基础游戏数据的完整 CRUD 操作，通过统一的数据库接口获取数据
 * @module base
 */

export * from './types';
export { baseDbService } from './db';
export { generateBaseId, factionsArrayToRecord, racesArrayToRecord, classesArrayToRecord } from './service';
export { useBaseStore } from './store';
