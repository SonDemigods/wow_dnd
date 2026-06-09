/**
 * 背包模块数据层
 * 
 * 封装背包数据的 IndexedDB 操作，提供数据持久化能力。
 * 背包数据以原生数组存储，无需 JSON 序列化/反序列化。
 */
import { db as gameDb, dbService } from '../data/core';
import type { Item, InventoryItem, ItemEffect } from './types';
import type { ItemStorage } from '../data/core';

/**
 * 背包数据存储接口（存储到 char_inventory 表的结构）
 */
export interface InventoryDataStorage {
  characterId: string;
  /** 背包物品列表（原生数组，非 JSON 字符串） */
  items: InventoryItem[];
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
   * 保存背包数据到数据库（原生存储，不做 JSON 序列化）
   * @param characterId - 角色ID
   * @param items - 背包物品列表
   */
  async saveInventory(characterId: string, items: InventoryItem[]): Promise<void> {
    await dbService.withRetry(async () => {
      // JSON 序列化往返：去除 undefined 值，确保所有数据可被结构化克隆
      const clean = JSON.parse(JSON.stringify(items));
      await gameDb.char_inventory.put({
        characterId,
        items: clean,
        updatedAt: Date.now()
      });
    });
  }

  /**
   * 获取背包数据（原生读取，不做 JSON 反序列化）
   * @param characterId - 角色ID
   * @returns 背包物品列表
   */
  async getInventory(characterId: string): Promise<InventoryItem[]> {
    return dbService.withRetry(async () => {
      const data = await gameDb.char_inventory.get(characterId) as unknown as InventoryDataStorage | undefined;
      if (!data) return [];

      // 兼容旧数据：如果 items 是 JSON 字符串（旧格式），尝试解析
      if (typeof data.items === 'string') {
        try {
          return JSON.parse(data.items);
        } catch {
          return [];
        }
      }

      // 新格式：原生数组，直接返回
      if (Array.isArray(data.items)) {
        return data.items;
      }

      return [];
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
        effect: item.effect as unknown as ItemStorage['effect'] || null,
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
