/**
 * @fileoverview 版本号统一源
 * @description
 *   三层版本号体系：
 *   - APP_VERSION：语义化版本，与 package.json 同步，UI 展示与备份文件头使用
 *   - DATA_VERSION：数据格式版本，整数递增，管数据字段演进
 *   - CURRENT_DATA_VERSION：当前代码期望的数据版本（= DATA_VERSION）
 *   - DB_SCHEMA_VERSION：Dexie schema 版本（Dexie version(N) 的最大值），仅管表结构演进
 *
 *   APP_VERSION 与 DATA_VERSION 解耦——发版可能不改数据格式，
 *   也可能一个版本内多次数据格式变更。
 *
 */
/** 应用版本号（语义化版本，与 package.json 同步） */
export const APP_VERSION = '1.0.0';
/** 数据格式版本（整数递增，管数据字段演进） */
export const DATA_VERSION = 1;
/** 当前代码期望的数据版本（供迁移服务比较存档版本戳） */
export const CURRENT_DATA_VERSION = DATA_VERSION;
/**
 * 数据库 Schema 版本（Dexie version(N) 的最大值）
 *
 * 仅管表结构演进（加表、加索引、改索引）。新增表或修改索引时升此版本，
 * 不影响 DATA_VERSION（DATA_VERSION 管数据字段演进，与表结构无关）。
 *
 * 当前值需与 core.ts 中 GameDatabase 构造函数的 version(N) 最大值保持一致。
 */
export const DB_SCHEMA_VERSION = 1;
