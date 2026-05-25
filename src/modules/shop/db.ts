/**
 * 商店模块数据层
 * 
 * 封装商店数据的 IndexedDB 操作，提供数据持久化能力
 */
import { db as gameDb, dbService } from '../data/core';
import type { ShopConfig, ShopInventory, ShopItem } from './types';

/**
 * 商店配置存储接口
 */
export interface ShopConfigStorage {
  id: string;
  name: string;
  type: string;
  icon: string;
  locationId: string;
  refreshInterval: number;
  minItems: number;
  maxItems: number;
  priceVariation: { min: number; max: number };
  stockVariation: { min: number; max: number };
}

/**
 * 商店库存存储接口
 */
export interface ShopInventoryStorage {
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
      await gameDb.shop.put({
        id: config.id,
        name: config.name,
        type: config.type,
        icon: config.icon,
        locationId: config.locationId,
        refreshInterval: config.refreshInterval,
        minItems: config.minItems,
        maxItems: config.maxItems,
        priceVariation: config.priceVariation,
        stockVariation: config.stockVariation
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
      const result = await gameDb.shop.get(shopId);
      if (!result) return null;
      return {
        id: result.id,
        name: result.name,
        type: result.type,
        icon: result.icon,
        locationId: result.locationId,
        refreshInterval: result.refreshInterval,
        minItems: result.minItems,
        maxItems: result.maxItems,
        priceVariation: result.priceVariation,
        stockVariation: result.stockVariation
      };
    });
  }

  /**
   * 获取所有商店配置
   * @returns 商店配置列表
   */
  async getAllShopConfigs(): Promise<ShopConfig[]> {
    return dbService.withRetry(async () => {
      const results = await gameDb.shop.toArray();
      return results.map(result => ({
        id: result.id,
        name: result.name,
        type: result.type,
        icon: result.icon,
        locationId: result.locationId,
        refreshInterval: result.refreshInterval,
        minItems: result.minItems,
        maxItems: result.maxItems,
        priceVariation: result.priceVariation,
        stockVariation: result.stockVariation
      }));
    });
  }

  /**
   * 获取指定地点的商店配置
   * @param locationId - 地点ID
   * @returns 商店配置列表
   */
  async getShopConfigsByLocation(locationId: string): Promise<ShopConfig[]> {
    return dbService.withRetry(async () => {
      const results = await gameDb.shop.where('locationId').equals(locationId).toArray();
      return results.map(result => ({
        id: result.id,
        name: result.name,
        type: result.type,
        icon: result.icon,
        locationId: result.locationId,
        refreshInterval: result.refreshInterval,
        minItems: result.minItems,
        maxItems: result.maxItems,
        priceVariation: result.priceVariation,
        stockVariation: result.stockVariation
      }));
    });
  }

  /**
   * 删除商店配置
   * @param shopId - 商店ID
   */
  async deleteShopConfig(shopId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.shop.delete(shopId);
    });
  }

  /**
   * 清空所有商店配置
   */
  async clearAllShopConfigs(): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.shop.clear();
    });
  }

  /**
   * 保存商店库存
   * @param inventory - 商店库存
   */
  async saveShopInventory(inventory: ShopInventory): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.shop.put({
        shopId: inventory.shopId,
        items: inventory.items,
        lastRefresh: inventory.lastRefresh
      });
    });
  }

  /**
   * 获取商店库存
   * @param shopId - 商店ID
   * @returns 商店库存
   */
  async getShopInventory(shopId: string): Promise<ShopInventory | null> {
    return dbService.withRetry(async () => {
      const result = await gameDb.shop.get(shopId);
      if (!result) return null;
      return {
        shopId: result.shopId,
        items: result.items,
        lastRefresh: result.lastRefresh
      };
    });
  }

  /**
   * 获取所有商店库存
   * @returns 商店库存列表
   */
  async getAllShopInventories(): Promise<ShopInventory[]> {
    return dbService.withRetry(async () => {
      const results = await gameDb.shop.toArray();
      return results.map(result => ({
        shopId: result.shopId,
        items: result.items,
        lastRefresh: result.lastRefresh
      }));
    });
  }

  /**
   * 删除商店库存
   * @param shopId - 商店ID
   */
  async deleteShopInventory(shopId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.shop.delete(shopId);
    });
  }

  /**
   * 清空所有商店库存
   */
  async clearAllShopInventories(): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.shop.clear();
    });
  }
}

/**
 * 商店数据层实例
 */
export const shopDbService = new ShopDbService();