/**
 * @fileoverview 数据库辅助工具
 * @description 提供 IndexedDB 写入前数据清洗等辅助函数
 * @module utils/db-helpers
 */

import { defaultRng, type Rng } from './rng';
import { errorReporter } from './errorReport';

/**
 * 将对象转为纯数据，去除 Vue/Proxy 响应式包装
 *
 * IndexedDB 使用结构化克隆算法存储数据，无法克隆 Proxy 对象。
 * Vue/Pinia 的 reactive/ref 包裹的数据都是 Proxy，直接写入会触发 DataCloneError。
 *
 * P2-78 修复：优先使用 structuredClone，保留 Date、Map、Set 等特殊类型；
 * 若 structuredClone 不可用或遇到不可克隆对象（如 Vue Proxy 嵌套响应式），
 * 回退到 JSON 序列化（剥离 Proxy 包装，但会丢失特殊类型）。
 * 当前项目 IndexedDB 存储的数据均为可 JSON 序列化的纯数据，回退路径不影响使用。
 *
 * 返回值为纯 JS 对象，可直接传给 Dexie 的 put/add/bulkPut 等方法，
 * 替代原来各模块中重复出现的 JSON.parse(JSON.stringify(...)) 写法。
 *
 * @param data - 需要清洗的数据（可以是 Proxy 包装对象）
 * @returns 纯 JS 对象/数组
 */
export function toRawData<T>(data: T): T {
  // 优先 structuredClone：保留 Date/Map/Set/RegExp 等特殊类型
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(data);
    } catch {
      // P4-010 修复：回退路径打印 warning，提醒 Date/Map/Set 等特殊类型会丢失
      console.warn('[toRawData] structuredClone 失败，回退到 JSON 序列化（Date/Map/Set 等特殊类型将丢失）');
    }
  }
  return JSON.parse(JSON.stringify(data));
}

/**
 * 生成唯一 ID
 *
 * @param prefix - ID 前缀，用于标识所属模块（如 'base'、'character'、'inventory'）
 * @param rng - 随机数生成器，默认 `defaultRng`（基于 Math.random）。
 *   传入 `createSeededRng(seed)` 可生成确定性 ID，用于测试复现与战斗回放。
 * @returns 格式为 `{prefix}_{timestamp}_{random}` 的唯一标识符
 */
export function generateId(prefix: string, rng: Rng = defaultRng): string {
  return `${prefix}_${Date.now()}_${rng.next().toString(36).substring(2, 11)}`;
}

/**
 * 通用数据层基类（CODE-31 修复）
 *
 * 封装各模块 db.ts 中高度重复的 CRUD 模式。
 * 子类只需提供表引用和主键字段名，即可获得标准增删改查能力。
 *
 * P10-041 修复：所有公开方法均包含 try-catch，失败时通过 errorReporter 上报后重新抛出，
 * 符合「Dexie 操作必须 try-catch」规范。
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

  // P3-138 说明：保留默认实现而非改为 abstract，因为测试中的 DefaultTestService 依赖默认实现。
  // 默认实现使用 unknown 断言，适用于 T 和 S 类型相同的场景（如纯 JSON 存储）。
  // 子类如有特殊转换需求，应覆盖这两个方法。
  //
  // P3 TS-11 审计决策（2026-07-31）：
  // - toStorage/toRuntime 的 `as unknown as` 双重断言保留，因 T 与 S 默认相同，无运行时风险
  // - getKey 改用 `Record<string, unknown>` + `String(...)` 显式转换，避免假设主键字段必为 string
  //   （子类可能用 number 主键，虽 Dexie 表声明为 string 主键，但运行时数据可能来自外部）
  /** 运行时对象 → DB 存储格式（默认直接返回，子类可覆盖以做转换/清洗） */
  protected toStorage(data: T): S { return data as unknown as S; }

  /** DB 存储格式 → 运行时对象（默认直接返回，子类可覆盖以做转换） */
  protected toRuntime(data: S): T { return data as unknown as T; }

  /** 获取主键值 */
  protected getKey(data: T): string {
    return String((data as Record<string, unknown>)[this.keyField]);
  }

  /** 保存（新增或覆盖）单条记录 */
  async save(data: T): Promise<void> {
    try {
      const cleanData = toRawData(this.toStorage(data));
      await this.table.put(cleanData);
    } catch (e) {
      errorReporter.report(e, 'manual', { context: 'BaseDbService.save 失败', key: this.getKey(data) });
      throw e;
    }
  }

  /** 批量保存 */
  async saveAll(items: T[]): Promise<void> {
    try {
      const cleanData = items.map(item => toRawData(this.toStorage(item)));
      await this.table.bulkPut(cleanData);
    } catch (e) {
      errorReporter.report(e, 'manual', { context: 'BaseDbService.saveAll 失败', count: items.length });
      throw e;
    }
  }

  /** 按主键查询单条记录，不存在返回 null */
  async getById(id: string): Promise<T | null> {
    try {
      const data = await this.table.get(id);
      return data ? this.toRuntime(data) : null;
    } catch (e) {
      errorReporter.report(e, 'manual', { context: 'BaseDbService.getById 失败', id });
      throw e;
    }
  }

  /** 获取全部记录 */
  async getAll(): Promise<T[]> {
    try {
      const items = await this.table.toArray();
      return items.map(data => this.toRuntime(data));
    } catch (e) {
      errorReporter.report(e, 'manual', { context: 'BaseDbService.getAll 失败' });
      throw e;
    }
  }

  /** 按主键删除 */
  async deleteById(id: string): Promise<void> {
    try {
      await this.table.delete(id);
    } catch (e) {
      errorReporter.report(e, 'manual', { context: 'BaseDbService.deleteById 失败', id });
      throw e;
    }
  }
}