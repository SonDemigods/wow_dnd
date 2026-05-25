/**
 * 背包模块数据层
 * 
 * 封装背包数据的 IndexedDB 操作，提供数据持久化能力
 */
import { db as gameDb, dbService } from '../data/core';
import type { Item, InventoryItem } from './types';

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
  bonus: string;
  value: number;
  stackable: boolean;
  hpRestore: number | null;
  mpRestore: number | null;
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
      await gameDb.inventory.put({
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
      const data = await gameDb.inventory.get(characterId);
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
      await gameDb.inventory.delete(characterId);
    });
  }

  /**
   * 保存物品模板到数据库
   * @param item - 物品数据
   */
  async saveItemTemplate(item: Item): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.items.put({
        id: item.id,
        name: item.name,
        type: item.type,
        rarity: item.rarity,
        icon: item.icon,
        description: item.description,
        bonus: JSON.stringify(item.bonus || {}),
        value: item.value,
        stackable: item.stackable,
        hpRestore: item.hpRestore || null,
        mpRestore: item.mpRestore || null,
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
      const data = await gameDb.items.get(itemId);
      if (!data) return null;
      
      let bonus: Partial<Item['bonus']> = {};
      try {
        bonus = JSON.parse(data.bonus);
      } catch {
        bonus = {};
      }
      
      return {
        id: data.id,
        name: data.name,
        type: data.type as Item['type'],
        rarity: data.rarity as Item['rarity'],
        icon: data.icon,
        description: data.description,
        bonus: bonus as Partial<Item['bonus']>,
        value: data.value,
        stackable: data.stackable,
        hpRestore: data.hpRestore || undefined,
        mpRestore: data.mpRestore || undefined,
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
      const items = await gameDb.items.toArray();
      return items.map(data => {
        let bonus: Partial<Item['bonus']> = {};
        try {
          bonus = JSON.parse(data.bonus);
        } catch {
          bonus = {};
        }
        
        return {
          id: data.id,
          name: data.name,
          type: data.type as Item['type'],
          rarity: data.rarity as Item['rarity'],
          icon: data.icon,
          description: data.description,
          bonus: bonus as Partial<Item['bonus']>,
          value: data.value,
          stackable: data.stackable,
          hpRestore: data.hpRestore || undefined,
          mpRestore: data.mpRestore || undefined,
          consumable: data.consumable || undefined,
          template: data.template || undefined
        };
      });
    });
  }

  /**
   * 删除物品模板
   * @param itemId - 物品ID
   */
  async deleteItemTemplate(itemId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.items.delete(itemId);
    });
  }
}

/**
 * 背包数据层实例
 */
export const inventoryDbService = new InventoryDbService();