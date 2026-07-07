/**
 * @fileoverview 物品模板缓存服务
 * @description 在内存中缓存全量物品模板，避免探索模块每次 buildAreaConfig 都全表扫描 IndexedDB。
 *              首次查询时从 DB 加载并构建 Map 索引，后续查询直接命中内存（PERF-1 修复）。
 * @module services
 */
import { inventoryDbService } from '@/modules/inventory/db';
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
   * 使用 Promise 去重，确保并发调用时只触发一次 DB 查询。
   *
   * @returns 物品模板列表
   */
  async load(): Promise<Item[]> {
    // 已加载，直接返回缓存
    if (this.loaded && this.templates) {
      return this.templates;
    }

    // 正在加载，复用进行中的 Promise
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    // 发起加载
    this.loadingPromise = inventoryDbService.getAllItemTemplates().then(items => {
      this.templates = items;
      this.templateMap.clear();
      for (const item of items) {
        this.templateMap.set(item.id, item);
      }
      this.loaded = true;
      this.loadingPromise = null;
      return items;
    }).catch(err => {
      // 加载失败，重置状态允许重试
      this.loadingPromise = null;
      throw err;
    });

    return this.loadingPromise;
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
    return this.templates!;
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
