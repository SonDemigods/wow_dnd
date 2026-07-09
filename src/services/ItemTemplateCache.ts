/**
 * @fileoverview 物品模板缓存服务
 * @description 在内存中缓存全量物品模板，避免探索模块每次 buildAreaConfig 都全表扫描 IndexedDB。
 *              首次查询时从 DB 加载并构建 Map 索引，后续查询直接命中内存（PERF-1 修复）。
 * @module services
 */
import { inventoryDbService } from '@/modules/inventory';
import type { Item } from '@/modules/inventory/types';

/**
 * 物品模板缓存
 *
 * 采用懒加载策略：首次调用 load() 时从 IndexedDB 全量读取并构建索引。
 * 通过 getById/getAll 提供内存级查询，避免重复 DB I/O。
 * 当物品模板发生变更（新增/修改/删除）时，调用 invalidate() 标记缓存失效，
 * 下次查询将自动重新加载。
 */
class ItemTemplateCacheService {
  /** 模板列表缓存（null 表示未加载） */
  private templates: Item[] | null = null;

  /** ID → Item 索引（O(1) 查询） */
  private templateMap: Map<string, Item> = new Map();

  /** 是否已加载 */
  private loaded = false;

  /** 加载中的 Promise（防止并发重复加载） */
  private loadingPromise: Promise<Item[]> | null = null;

  /**
   * 从数据库加载全量物品模板并构建索引
   *
   * 采用 Promise 去重（in-flight dedup）策略：并发调用时复用同一个 loadingPromise，
   * 确保只触发一次 DB 查询。加载失败时 Promise 会 reject，调用方需自行 try/catch；
   * 失败后 loaded 保持 false、loadingPromise 重置为 null，下次调用将自动重试。
   *
   * @returns 物品模板列表（加载失败时 reject，调用方需处理）
   */
  async load(): Promise<Item[]> {
    // 已加载，直接返回缓存
    if (this.loaded && this.templates) {
      return this.templates;
    }

    // 正在加载，复用进行中的 Promise（去重：避免并发重复 DB 查询）
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    // 发起加载，保存 Promise 供并发调用复用
    this.loadingPromise = this.doLoad();
    return this.loadingPromise;
  }

  /**
   * 实际执行 DB 加载与索引构建
   *
   * 从 load() 拆出，使 load() 专注去重逻辑、本方法专注数据加载。
   * 无论成功或失败，finally 都会重置 loadingPromise 以允许后续重试。
   */
  private async doLoad(): Promise<Item[]> {
    try {
      const items = await inventoryDbService.getAllItemTemplates();
      this.templates = items;
      this.templateMap.clear();
      for (const item of items) {
        this.templateMap.set(item.id, item);
      }
      this.loaded = true;
      return items;
    } finally {
      // 无论成功或失败，都重置 loadingPromise 允许后续重试
      this.loadingPromise = null;
    }
  }

  /**
   * 按 ID 查询单个物品模板
   *
   * @param itemId - 物品 ID
   * @returns 物品模板，未找到时返回 null
   */
  async getById(itemId: string): Promise<Item | null> {
    if (!this.loaded) {
      await this.load();
    }
    return this.templateMap.get(itemId) ?? null;
  }

  /**
   * 获取全量物品模板
   *
   * @returns 物品模板列表
   */
  async getAll(): Promise<Item[]> {
    if (!this.loaded) {
      await this.load();
    }
    // load 失败时 templates 仍为 null，返回空数组兜底（CODE-15 修复）
    return this.templates ?? [];
  }

  /**
   * 使缓存失效
   *
   * 当物品模板发生变更时调用，下次查询将重新从 DB 加载。
   */
  invalidate(): void {
    this.templates = null;
    this.templateMap.clear();
    this.loaded = false;
  }
}

/** 物品模板缓存单例 */
export const itemTemplateCache = new ItemTemplateCacheService();
