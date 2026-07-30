/**
 * 背包模块数据层
 *
 * 封装背包数据的 IndexedDB 操作，提供数据持久化能力。
 *
 * ## 双表设计
 * - char_inventory：角色背包数据（以角色 ID 为键，存储物品槽位列表）
 * - config_items：物品模板数据（以物品 ID 为键，存储物品定义）
 *
 * ## 数据格式
 * 背包数据以原生数组存储于 IndexedDB，无需 JSON 序列化/反序列化。
 * Dexie 的类型推断有限，因此从 DB 读取时需要用 as unknown as 进行类型断言，
 * 再通过 mapToItem() 将宽松的存储类型转换为精确的 Item 类型。
 */
import { db as gameDb, dbService } from '@/modules/data';
import type { Item, InventoryItem, ItemEffect, InventoryDataStorage, ItemDataStorage } from './types';
import { toRawData } from '../../utils';

/**
 * 背包数据层服务
 *
 * 所有公开方法都通过 dbService.withRetry() 包裹，确保 IndexedDB
 * 事务冲突时自动重试。私有方法 mapToItem() 负责 DB 格式到业务类型的转换。
 */
export class InventoryDbService {
  /**
   * 保存背包数据到数据库（原生存储，不做 JSON 序列化）
   *
   * 写入前通过 toRawData() 去除 undefined 值，确保所有数据可被
   * IndexedDB 的结构化克隆算法正确处理。
   *
   * @param characterId - 角色 ID
   * @param items - 背包物品列表
   */
  async saveInventory(characterId: string, items: InventoryItem[]): Promise<void> {
    await dbService.withRetry(async () => {
      const clean = toRawData(items);
      await gameDb.char_inventory.put({
        characterId,
        items: clean,
        updatedAt: Date.now()
      });
    });
  }

  /**
   * 获取背包数据
   *
   * 从 char_inventory 表读取指定角色的背包。
   * 数据以原生数组存储，直接返回即可。
   *
   * @param characterId - 角色 ID
   * @returns 背包物品列表，角色无背包数据时返回空数组
   */
  async getInventory(characterId: string): Promise<InventoryItem[]> {
    return dbService.withRetry(async () => {
      const data = await gameDb.char_inventory.get(characterId) as unknown as InventoryDataStorage | undefined;
      if (!data) return [];
      return Array.isArray(data.items) ? data.items : [];
    });
  }

  /**
   * 删除背包数据
   *
   * 删除指定角色的全部背包记录（通常用于角色删除或重置场景）。
   *
   * @param characterId - 角色 ID
   */
  async deleteInventory(characterId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_inventory.delete(characterId);
    });
  }

  /**
   * 保存物品模板到数据库
   *
   * 将 Item 类型转换为 ItemStorage 格式写入 config_items 表。
   * 字段默认值策略：
   * - bonus / effect：undefined → {} / null（避免 DB 存储 undefined）
   * - consumable：undefined → false（DB 要求布尔值）
   * - template / levelRequirement：undefined → null（DB 用 null 表示"无"）
   *
   * @param item - 物品数据
   */
  async saveItemTemplate(item: Item): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_items.put({
        id: item.id,
        name: item.name,
        type: item.type,
        rarity: item.rarity,
        level: item.level,
        icon: item.icon,
        description: item.description,
        bonus: item.bonus || {},
        // P2-59 修复：显式构造 effect 存储对象，避免 as unknown as 双重断言
        effect: item.effect
          ? { type: item.effect.type, value: item.effect.value }
          : null,
        value: item.value,
        stackable: item.stackable,
        consumable: item.consumable || false,
        template: item.template || null,
        // 用 ?? 而非 ||，0 是合法的等级要求（mapToItem 读取端亦用 ??）
        levelRequirement: item.levelRequirement ?? null
      });
    });
  }

  /**
   * 将 ItemDataStorage 转换为 Item 类型
   *
   * DB 读取的数据（ItemDataStorage）字段类型较宽松（string/null/普通对象），
   * 需要显式转换为 Item 接口的精确类型（ItemType/ItemRarity/ItemEffect 等）。
   *
   * 转换要点：
   * - type/rarity：通过 as 断言从 string 转换为联合类型
   * - bonus：空对象 {} 作为默认值，通过 as 收窄为 Partial<Stats>
   * - effect：通过 as unknown as 双重断言（Dexie 存储格式 → ItemEffect）
   * - consumable：false → undefined（Item 接口中 consumable 为可选，false 与 undefined 语义相同）
   * - levelRequirement：用 ?? 替代 ||，因为 0 是合法的等级要求（角色等级 0 可用）
   *
   * @param data - DB 读取的原始数据
   * @returns 转换后的 Item 实例
   */
  private mapToItem(data: ItemDataStorage): Item {
    return {
      id: data.id,
      name: data.name,
      type: data.type as Item['type'],
      rarity: data.rarity as Item['rarity'],
      level: data.level,
      icon: data.icon,
      description: data.description,
      bonus: (data.bonus ?? {}) as Partial<Item['bonus']>,
      effect: data.effect as unknown as ItemEffect | undefined,
      value: data.value,
      stackable: data.stackable,
      // P3-109 说明：consumable/template 使用 || 将 false/空字符串归一化为 undefined，保持语义一致
      consumable: data.consumable || undefined,
      template: data.template || undefined,
      levelRequirement: data.levelRequirement ?? undefined
    };
  }

  /**
   * 获取单个物品模板
   *
   * 通过物品 ID 查询物品定义，用于 UI 显示、效果计算等场景。
   *
   * @param itemId - 物品 ID
   * @returns 物品数据，不存在时返回 null
   */
  async getItemTemplate(itemId: string): Promise<Item | null> {
    return dbService.withRetry(async () => {
      const data = await gameDb.config_items.get(itemId) as unknown as ItemDataStorage | undefined;
      if (!data) return null;
      return this.mapToItem(data);
    });
  }

  /**
   * 获取所有物品模板
   *
   * 全量加载 config_items 表中的所有物品定义，
   * 用于模块初始化时构建 itemTemplates Map。
   *
   * @returns 物品模板列表（按 DB 顺序）
   */
  async getAllItemTemplates(): Promise<Item[]> {
    return dbService.withRetry(async () => {
      const items = await gameDb.config_items.toArray() as unknown as ItemDataStorage[];
      return items.map(data => this.mapToItem(data));
    });
  }

  /**
   * 删除物品模板
   *
   * 从 config_items 表中删除指定物品的模板定义。
   *
   * @param itemId - 物品 ID
   */
  async deleteItemTemplate(itemId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_items.delete(itemId);
    });
  }
}

/**
 * 背包数据层单例实例
 *
 * 全局唯一实例，模块内所有 DB 操作通过此实例完成。
 */
export const inventoryDbService = new InventoryDbService();
