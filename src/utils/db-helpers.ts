/**
 * @fileoverview 数据库辅助工具
 * @description 提供 IndexedDB 写入前数据清洗等辅助函数
 * @module utils/db-helpers
 */

/**
 * 将对象转为纯数据，去除 Vue/Proxy 响应式包装
 * 
 * IndexedDB 使用结构化克隆算法存储数据，无法克隆 Proxy 对象。
 * Vue/Pinia 的 reactive/ref 包裹的数据都是 Proxy，直接写入会触发 DataCloneError。
 * 通过 JSON 序列化往返可剥离所有 Proxy 包装，生成纯 JS 对象。
 * 
 * 返回值为纯 JS 对象，可直接传给 Dexie 的 put/add/bulkPut 等方法，
 * 替代原来各模块中重复出现的 JSON.parse(JSON.stringify(...)) 写法。
 * 
 * @param data - 需要清洗的数据（可以是 Proxy 包装对象）
 * @returns 纯 JS 对象/数组
 */
export function toRawData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

/**
 * 生成唯一 ID
 * 
 * @param prefix - ID 前缀，用于标识所属模块（如 'base'、'character'、'inventory'）
 * @returns 格式为 `{prefix}_{timestamp}_{random}` 的唯一标识符
 */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}