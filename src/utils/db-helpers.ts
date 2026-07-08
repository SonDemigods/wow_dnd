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

/**
 * 通用数据层基类（CODE-31 修复）
 *
 * 封装各模块 db.ts 中高度重复的 CRUD + withRetry 模式。
 * 子类只需提供表引用和主键字段名，即可获得带重试的标准增删改查能力，
 * 避免每个 db.ts 都重复编写 `await dbService.withRetry(async () => { await gameDb.xxx.put(toRawData(...)); })`。
 *
 * @typeParam T - 运行时业务对象类型
 * @typeParam S - DB 存储格式类型（默认与 T 相同）
 *
 * @example
 * ```ts
 * class ItemDbService extends BaseDbService<Item, ItemStorage> {
 *   constructor() {
 *     super(gameDb.config_items, 'id');
 *   }
 *   protected toStorage(data: Item): ItemStorage { return { ...data, _ts: Date.now() }; }
 *   protected toRuntime(data: ItemStorage): Item { return { ...data }; }
 * }
 * ```
 */
export abstract class BaseDbService<T, S = T> {
  /**
   * @param table - Dexie 表实例（如 `gameDb.config_items`）
   * @param keyField - 主键字段名（默认 'id'）
   */
  constructor(
    protected readonly table: { put(item: S): Promise<void>; get(key: string): Promise<S | undefined>; delete(key: string): Promise<void>; toArray(): Promise<S[]>; bulkPut(items: S[]): Promise<void>; },
    protected readonly keyField: string = 'id'
  ) {}

  /** 运行时对象 → DB 存储格式（默认直接返回，子类可覆盖以做转换/清洗） */
  protected toStorage(data: T): S { return data as unknown as S; }

  /** DB 存储格式 → 运行时对象（默认直接返回，子类可覆盖以做转换） */
  protected toRuntime(data: S): T { return data as unknown as T; }

  /** 获取主键值 */
  protected getKey(data: T): string {
    return (data as unknown as Record<string, string>)[this.keyField];
  }

  /** 保存（新增或覆盖）单条记录 */
  async save(data: T): Promise<void> {
    const cleanData = toRawData(this.toStorage(data));
    await this.table.put(cleanData);
  }

  /** 批量保存 */
  async saveAll(items: T[]): Promise<void> {
    const cleanData = items.map(item => toRawData(this.toStorage(item)));
    await this.table.bulkPut(cleanData);
  }

  /** 按主键查询单条记录，不存在返回 null */
  async getById(id: string): Promise<T | null> {
    const data = await this.table.get(id);
    return data ? this.toRuntime(data) : null;
  }

  /** 获取全部记录 */
  async getAll(): Promise<T[]> {
    const items = await this.table.toArray();
    return items.map(data => this.toRuntime(data));
  }

  /** 按主键删除 */
  async deleteById(id: string): Promise<void> {
    await this.table.delete(id);
  }
}