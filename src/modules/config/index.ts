/**
 * @fileoverview 配置缓存层入口
 * @description
 *   统一配置缓存，从 IndexedDB 加载配置数据并提供同步查询接口。
 *   消除各模块直接 import @/data 静态常量的双源歧义问题。
 *
 *   使用方式：
 *   ```typescript
 *   import { configCache } from '@/modules/config';
 *   // 在 Store initialize 中预加载
 *   await configCache.loadAll();
 *   // 在同步上下文中查询
 *   const trees = configCache.getTalentTreesByClassId(classId);
 *   ```
 *
 * @module config
 */
export { configCache } from './cache';
