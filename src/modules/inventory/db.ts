/**
 * 背包模块数据层
 * 
 * 封装背包数据的 IndexedDB 操作，提供数据持久化能力
 */
import { db as gameDb, dbService } from '../data/core';
import type { Item, InventoryItem, ItemEffect } from './types';

/**
 * 背包数据存储接口
 */
export interface InventoryDataStorage {
  characterId: string;
  items: string;
  updatedAt: number;
}

/**
 * 物品数据存储接口
 */
export interface ItemDataStorage {
  id: string;
  name: string;
  type: string;
  rarity: string;
  icon: string;
  description: string;
  bonus: Record<string, number>;
  effect: Record<string, unknown> | null;
  value: number;
  stackable: boolean;
  consumable: boolean;
  template: string | null;
}

/**
 * 背包数据层服务
 */
export class InventoryDbService {
  /**
   * 保存背包数据到数据库
   * @param characterId - 角色ID
   * @param items - 背包物品列表
   */
  async saveInventory(characterId: string, items: InventoryItem[]): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_inventory.put({
        characterId,
        items: JSON.stringify(items),
        updatedAt: Date.now()
      });
    });
  }

  /**
   * 获取背包数据
   * @param characterId - 角色ID
   * @returns 背包物品列表
   */
  async getInventory(characterId: string): Promise<InventoryItem[]> {
    return dbService.withRetry(async () => {
      const data = await gameDb.char_inventory.get(characterId) as unknown as InventoryDataStorage | undefined;
      if (!data) return [];
      try {
        return JSON.parse(data.items);
      } catch {
        return [];
      }
    });
  }

  /**
   * 删除背包数据
   * @param characterId - 角色ID
   */
  async deleteInventory(characterId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_inventory.delete(characterId);
    });
  }

  /**
   * 保存物品模板到数据库
   * @param item - 物品数据
   */
  async saveItemTemplate(item: Item): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_items.put({
        id: item.id,
        name: item.name,
        type: item.type,
        rarity: item.rarity,
        icon: item.icon,
        description: item.description,
        bonus: item.bonus || {},
        effect: (item.effect as Record<string, unknown> | undefined) || null,
        value: item.value,
        stackable: item.stackable,
        consumable: item.consumable || false,
        template: item.template || null
      });
    });
  }

  /**
   * 获取物品模板
   * @param itemId - 物品ID
   * @returns 物品数据或null
   */
  async getItemTemplate(itemId: string): Promise<Item | null> {
    return dbService.withRetry(async () => {
      const data = await gameDb.config_items.get(itemId) as unknown as ItemDataStorage | undefined;
      if (!data) return null;
      
      return {
        id: data.id,
        name: data.name,
        type: data.type as Item['type'],
        rarity: data.rarity as Item['rarity'],
        icon: data.icon,
        description: data.description,
        bonus: (data.bonus || {}) as Partial<Item['bonus']>,
        effect: data.effect as unknown as ItemEffect | undefined,
        value: data.value,
        stackable: data.stackable,
        consumable: data.consumable || undefined,
        template: data.template || undefined
      };
    });
  }

  /**
   * 获取所有物品模板
   * @returns 物品模板列表
   */
  async getAllItemTemplates(): Promise<Item[]> {
    return dbService.withRetry(async () => {
      const items = await gameDb.config_items.toArray() as unknown as ItemDataStorage[];
      return items.map(data => ({
        id: data.id,
        name: data.name,
        type: data.type as Item['type'],
        rarity: data.rarity as Item['rarity'],
        icon: data.icon,
        description: data.description,
        bonus: (data.bonus || {}) as Partial<Item['bonus']>,
        effect: data.effect as unknown as ItemEffect | undefined,
        value: data.value,
        stackable: data.stackable,
        consumable: data.consumable || undefined,
        template: data.template || undefined
      }));
    });
  }

  /**
   * 删除物品模板
   * @param itemId - 物品ID
   */
  async deleteItemTemplate(itemId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_items.delete(itemId);
    });
  }
}

/**
 * 背包数据层实例
 */
export const inventoryDbService = new InventoryDbService();
