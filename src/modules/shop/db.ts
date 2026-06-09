/**
 * 商店模块数据层
 * 
 * 封装商店数据的 IndexedDB 操作，提供数据持久化能力
 */
import { db as gameDb, dbService } from '../data/core';
import type { ShopConfig, ShopItem } from './types';

/**
 * 商店配置存储接口（内部使用，与 data/core.ts 的 ShopConfigStorage 对应）
 */
interface ShopConfigStorage {
  id: string;
  name: string;
  type: string;
  icon: string;
  refreshInterval: number;
  priceVariation: { min: number; max: number };
}

/**
 * 商店商品存储接口（内部使用，与 data/core.ts 的 ShopItemsStorage 对应）
 */
interface ShopItemsStorage {
  shopId: string;
  items: ShopItem[];
  lastRefresh: number;
}

/**
 * 商店数据层服务
 */
export class ShopDbService {
  /**
   * 保存商店配置
   * @param config - 商店配置
   */
  async saveShopConfig(config: ShopConfig): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_shops.put({
        id: config.id,
        name: config.name,
        type: config.type,
        icon: config.icon,
        refreshInterval: config.refreshInterval,
        priceVariation: config.priceVariation
      });
    });
  }

  /**
   * 获取商店配置
   * @param shopId - 商店ID
   * @returns 商店配置
   */
  async getShopConfig(shopId: string): Promise<ShopConfig | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.config_shops.get(shopId) as unknown as ShopConfigStorage | undefined;
      if (!result) return null;
      return {
        id: result.id,
        name: result.name,
        type: result.type,
        icon: result.icon,
        refreshInterval: result.refreshInterval,
        priceVariation: result.priceVariation
      };
    });
  }

  /**
   * 获取所有商店配置
   * @returns 商店配置列表
   */
  async getAllShopConfigs(): Promise<ShopConfig[]> {
    return dbService.withRetry(async () => {
      const results = await gameDb.config_shops.toArray() as unknown as ShopConfigStorage[];
      return results.map(result => ({
        id: result.id,
        name: result.name,
        type: result.type,
        icon: result.icon,
        refreshInterval: result.refreshInterval,
        priceVariation: result.priceVariation
      }));
    });
  }

  /**
   * 删除商店配置
   * @param shopId - 商店ID
   */
  async deleteShopConfig(shopId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_shops.delete(shopId);
    });
  }

  /**
   * 清空所有商店配置
   */
  async clearAllShopConfigs(): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_shops.clear();
    });
  }

  /**
   * 保存商店商品
   * @param shopId - 商店ID
   * @param items - 商品列表
   */
  async saveShopItems(shopId: string, items: ShopItem[]): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.runtime_shopItems.put({
        shopId,
        items,
        lastRefresh: Date.now()
      });
    });
  }

  /**
   * 获取商店商品
   * @param shopId - 商店ID
   * @returns 商品列表
   */
  async getShopItems(shopId: string): Promise<ShopItem[] | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.runtime_shopItems.get(shopId) as unknown as ShopItemsStorage | undefined;
      if (!result) return null;
      return result.items;
    });
  }

  /**
   * 删除商店商品
   * @param shopId - 商店ID
   */
  async deleteShopItems(shopId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.runtime_shopItems.delete(shopId);
    });
  }

  /**
   * 清空所有商店商品
   */
  async clearAllShopItems(): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.runtime_shopItems.clear();
    });
  }

  /**
   * 保存当前打开的商店ID到 gameState（持久化，供页面刷新后恢复）
   * 
   * 使用事务确保原子性读-改-写，避免与 character/map 等模块并发写入时丢失数据。
   * @param shopId - 商店ID，null 表示关闭商店
   */
  async saveCurrentShopId(shopId: string | null): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.transaction('rw', gameDb.runtime_gameState, async () => {
        const existing = await gameDb.runtime_gameState.get('gameState');
        await gameDb.runtime_gameState.put({
          ...existing,
          id: 'gameState',
          currentShopId: shopId,
          lastPlayedAt: new Date().toISOString()
        });
      });
    });
  }

  /**
   * 从 gameState 中获取上次保存的商店ID
   * @returns 商店ID，未保存过则返回 null
   */
  async getCurrentShopId(): Promise<string | null> {
    return dbService.withRetry(async () => {
      const state = await gameDb.runtime_gameState.get('gameState');
      if (!state) return null;
      return (state.currentShopId as string) || null;
    });
  }
}

/**
 * 商店数据层实例
 */
export const shopDbService = new ShopDbService();
