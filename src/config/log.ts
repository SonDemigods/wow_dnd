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

/**
 * 冒险日志容量上限（BIZ-12）
 *
 * 内存中保留的最大日志条数。超过此值时，新增日志会裁剪尾部最旧的条目，
 * 避免长期游戏后内存与 IndexedDB 持久化记录无限膨胀。
 *
 * 选值依据：50 条/页 × 20 页 = 1000 条，覆盖玩家常规回看需求。
 */
export const MAX_LOG_ENTRIES = 1000;
