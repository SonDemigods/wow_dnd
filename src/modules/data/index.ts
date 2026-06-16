/**
 * @fileoverview 数据模块统一导出入口
 * @description 导出数据模块的所有公共接口，是整个游戏数据库基础设施的入口。
 * 
 * ## 模块结构
 * - **core.ts**：数据库基础设施层 — GameDatabase（连接/Schema）、DBService（重试封装）、存储类型定义
 * - **types.ts**：类型定义层 — 备份/导入/配置相关接口
 * - **service.ts**：业务服务层 — DataInitializer（游戏数据初始化）、BackupService（备份）、ImportService（导入）
 * 
 * ## 已知设计权衡
 * - `config_locations` 表通过 `type` 字段区分 `'location'`（地点数据）和 `'continent'`（大陆数据），
 *   未来可拆分为独立表以消除字段不匹配问题
 * - `runtime_gameState` 表目前通过不同 `id` 值承载多类数据（gameState/data_initialized/shop_config/game_constants），
 *   已使用事务确保读-改-写的原子性
 * @module data
 */

/** 导出类型定义 */
export * from './types';

/** 导出核心数据库类和实例 */
export * from './core';

/** 导出数据服务类和实例 */
export * from './service';

/** 导出游戏状态辅助模块 */
export * from './gameStateHelper';
