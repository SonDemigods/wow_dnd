/**
 * @fileoverview 日志模块配置
 * @description 集中管理冒险日志模块的可调参数，便于统一维护与调优
 * @module config
 */

/**
 * 日志分页每页条数
 *
 * 用于日志列表分页渲染，避免大量日志一次性渲染导致性能下降（PERF-3）。
 */
export const PAGE_SIZE = 50;
