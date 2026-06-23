/**
 * @fileoverview 商店模块数据持久化层
 * @description 封装商店相关数据的 IndexedDB 操作，提供带重试机制的异步读写能力。
 *              所有方法通过 {@link dbService.withRetry} 包裹，确保并发写入安全。
 *
 * **存储表说明**：
 * - `config_shops`        — 商店配置（静态数据，种子 → DB 单向同步）
 * - `runtime_shopItems`   — 商店当前商品（动态数据，每次刷新/交易后更新）
 * - `gameState`           — 当前打开的商店ID（页面刷新后恢复）
 *
 * **数据流向**：
 * ```
 * 种子 SHOPS → saveShopConfig() → config_shops 表
 *                              → getAllShopConfigs() → Store.shops
 *
 * generateShopItems() → saveShopItems() → runtime_shopItems 表
 *                                       → getShopItems() → Store.currentItems
 * ```
 */

import { db as gameDb, dbService } from '../data/core';
import type { ShopConfig, ShopItem, ShopItemsStorage } from './types';
import { getGameState, saveGameState } from '../data/gameStateHelper';
import { toRawData } from '../../utils';

/**
 * 浅拷贝商店配置
 *
 * 每次写入 IndexedDB 前创建副本，避免源对象被 Vue 响应式 Proxy 包装后
 * 导致 IndexedDB DataCloneError，也防止多处引用同一对象产生的意外联动修改。
 * 使用展开运算符确保未来新增字段不会被遗漏。
 *
 * @param config - 商店配置
 * @returns 浅拷贝副本
 */
function cloneShopConfig(config: ShopConfig): ShopConfig {
  return { ...config };
}

/**
 * 商店数据层服务
 *
 * 所有异步方法均通过 {@link dbService.withRetry} 包裹，IndexedDB 事务
 * 冲突时自动重试（最多 3 次），避免并发操作导致的写入失败。
 */
export class ShopDbService {

  /**
   * 保存（新增或覆盖）单个商店配置
   *
   * @param config - 商店配置对象
   */
  async saveShopConfig(config: ShopConfig): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_shops.put(cloneShopConfig(config));
    });
  }

  /**
   * 根据 ID 获取单个商店配置
   *
   * @param shopId - 商店ID
   * @returns 商店配置，不存在时返回 null
   */
  async getShopConfig(shopId: string): Promise<ShopConfig | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.config_shops.get(shopId) as ShopConfig | undefined;
      if (!result) return null;
      return cloneShopConfig(result);
    });
  }

  /**
   * 获取全部商店配置
   *
   * @returns 商店配置列表（可能为空数组）
   */
  async getAllShopConfigs(): Promise<ShopConfig[]> {
    return dbService.withRetry(async () => {
      const results = await gameDb.config_shops.toArray() as ShopConfig[];
      return results.map(result => cloneShopConfig(result));
    });
  }

  /**
   * 删除指定商店配置
   *
   * @param shopId - 商店ID
   */
  async deleteShopConfig(shopId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_shops.delete(shopId);
    });
  }

  /**
   * 清空全部商店配置
   */
  async clearAllShopConfigs(): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_shops.clear();
    });
  }

  /**
   * 保存商店当前商品列表
   *
   * 内部通过 {@link toRawData} 对数据做 JSON 序列化/反序列化，
   * 彻底剥离 Vue 响应式 Proxy 包装，避免 IndexedDB 写入失败。
   *
   * @param shopId - 商店ID
   * @param items  - 商品列表
   */
  async saveShopItems(shopId: string, items: ShopItem[]): Promise<void> {
    await dbService.withRetry(async () => {
      // JSON 序列化去除 Vue/Proxy 包装，避免 IndexedDB DataCloneError
      const cleanData = toRawData({
        shopId,
        items,
        lastRefresh: Date.now()
      });
      await gameDb.runtime_shopItems.put(cleanData);
    });
  }

  /**
   * 获取商店当前商品列表
   *
   * @param shopId - 商店ID
   * @returns 商品列表，不存在时返回 null
   */
  async getShopItems(shopId: string): Promise<ShopItem[] | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.runtime_shopItems.get(shopId) as ShopItemsStorage | undefined;
      if (!result) return null;
      return result.items;
    });
  }

  /**
   * 删除指定商店的商品数据
   *
   * @param shopId - 商店ID
   */
  async deleteShopItems(shopId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.runtime_shopItems.delete(shopId);
    });
  }

  /**
   * 清空全部商店商品数据
   */
  async clearAllShopItems(): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.runtime_shopItems.clear();
    });
  }

  /**
   * 持久化当前打开的商店ID
   *
   * 页面刷新后，{@link init} 会通过 {@link getCurrentShopId} 恢复此值。
   *
   * @param shopId - 商店ID，传入 null 表示关闭商店
   */
  async saveCurrentShopId(shopId: string | null): Promise<void> {
    await saveGameState({ currentShopId: shopId, lastPlayedAt: new Date().toISOString() });
  }

  /**
   * 获取上次保存的商店ID（页面恢复用）
   *
   * @returns 商店ID，未保存过则返回 null
   */
  async getCurrentShopId(): Promise<string | null> {
    const state = await getGameState();
    if (!state) return null;
    return state.currentShopId ?? null;
  }
}

/**
 * 商店数据层单例
 *
 * 全局唯一实例，由 Store 统一引用。
 */
export const shopDbService = new ShopDbService();
