/**
 * @fileoverview 统一物品模板缓存
 * @description
 *   缓存合并后的物品模板（普通物品 + 装备），提供内存级查询。
 *   首次查询时从 DB 加载并合并，后续查询直接命中内存。
 *
 *   ARCH-1 修复后，本缓存为系统内唯一的物品模板缓存：
 *   - inventory/store、services/CrossModuleQuery 均通过 unifiedItemTemplateCache 访问
 *   - 原 services/ItemTemplateCache 已删除（避免双重缓存数据不一致）
 *
 *   采用懒加载 + Promise 去重策略，避免并发重复 DB 查询。
 *
 * @module item-template
 */
import { itemTemplateDbService } from './db';
import { mergeItemTemplates } from './service';
import type { Item } from './types';

/**
 * 统一物品模板缓存服务
 *
 * 内部维护合并后的模板列表与 ID 索引，对外提供 getAll/getById/invalidate 接口。
 *
 * 错误处理策略（P3-106 修复）：
 * - `load()` 失败时 `loaded` 保持 false、`loadingPromise` 重置为 null，下次调用自动重试
 *   （不缓存错误，避免短暂 DB 故障导致长期不可用）
 * - `getAll()` / `getById()` 在 `load()` 失败时降级返回安全默认值（`[]` / `null`），
 *   并通过 console.error 记录错误，不向上抛出（避免调用方需逐处 try-catch）
 * - 调用方若需感知加载失败，可直接调用 `load()` 捕获异常
 */
class UnifiedItemTemplateCacheService {
  /** 合并后的模板列表缓存（null 表示未加载） */
  private mergedTemplates: Item[] | null = null;

  /** ID → Item 索引（O(1) 查询） */
  private templateMap: Map<string, Item> = new Map();

  /** 是否已加载 */
  private loaded = false;

  /** 加载中的 Promise（防止并发重复加载） */
  private loadingPromise: Promise<Item[]> | null = null;

  /**
   * 从 DB 加载并合并物品模板
   *
   * 采用 Promise 去重（in-flight dedup）策略：并发调用时复用同一个 loadingPromise，
   * 确保只触发一次 DB 查询。加载失败后 loaded 保持 false、loadingPromise 重置为 null，
   * 下次调用将自动重试。
   *
   * 并行加载普通物品与装备模板以减少总加载时间。
   *
   * @returns 合并后的物品模板列表（加载失败时 reject，调用方需处理）
   */
  async load(): Promise<Item[]> {
    // 已加载，直接返回缓存
    if (this.loaded && this.mergedTemplates) {
      return this.mergedTemplates;
    }

    // 正在加载，复用进行中的 Promise（去重）
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    // 发起加载
    this.loadingPromise = this.doLoad();
    return this.loadingPromise;
  }

  /**
   * 实际执行 DB 加载与合并
   *
   * 并行查询普通物品与装备模板，通过 mergeItemTemplates 合并为统一 Map。
   * 无论成功或失败，finally 都会重置 loadingPromise 以允许后续重试。
   */
  private async doLoad(): Promise<Item[]> {
    try {
      const [items, equipment] = await Promise.all([
        itemTemplateDbService.getAllItemTemplates(),
        itemTemplateDbService.getAllEquipmentTemplates()
      ]);
      const map = mergeItemTemplates(items, equipment);
      this.templateMap = map;
      this.mergedTemplates = Array.from(map.values());
      this.loaded = true;
      return this.mergedTemplates;
    } finally {
      this.loadingPromise = null;
    }
  }

  /**
   * 按 ID 查询单个物品模板
   *
   * 未加载时自动触发 load。返回合并视图中的 Item（可能是普通物品或转换后的装备）。
   * load 失败时降级返回 null（P3-106：不向上抛出，调用方按"未找到"处理）。
   *
   * @param itemId - 物品 ID
   * @returns 物品模板，未找到或加载失败时返回 null
   */
  async getById(itemId: string): Promise<Item | null> {
    if (!this.loaded) {
      try {
        await this.load();
      } catch (error) {
        console.error('[UnifiedItemTemplateCache] 加载物品模板失败，getById 降级返回 null:', error);
        return null;
      }
    }
    return this.templateMap.get(itemId) ?? null;
  }

  /**
   * 获取全量合并模板
   *
   * 未加载时自动触发 load。load 失败时降级返回空数组兜底（P3-106：兑现注释承诺）。
   *
   * @returns 合并后的物品模板列表（普通物品 + 转换后的装备；加载失败时返回 []）
   */
  async getAll(): Promise<Item[]> {
    if (!this.loaded) {
      try {
        await this.load();
      } catch (error) {
        console.error('[UnifiedItemTemplateCache] 加载物品模板失败，getAll 降级返回空数组:', error);
        return [];
      }
    }
    return this.mergedTemplates ?? [];
  }

  /**
   * 使缓存失效
   *
   * 当物品模板或装备模板发生变更时调用，下次查询将重新从 DB 加载并合并。
   */
  invalidate(): void {
    this.mergedTemplates = null;
    this.templateMap.clear();
    this.loaded = false;
  }
}

/** 统一物品模板缓存单例 */
export const unifiedItemTemplateCache = new UnifiedItemTemplateCacheService();
