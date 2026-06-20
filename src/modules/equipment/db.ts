/**
 * 装备模块数据层
 * 
 * 封装装备数据的 IndexedDB 操作，提供数据持久化能力。
 * equipment 字段仅存储装备 ID 映射，完整装备数据从 config_equipmentItems 模板表获取。
 */
import { db as gameDb, dbService } from '../data/core';
import type { EquipmentDataStorage, EquipmentTemplateStorage, EquipmentItem, EquipmentSlot } from './types';

/**
 * 装备数据层服务
 */
export class EquipmentDbService {
  /**
   * 保存装备数据到数据库（仅存装备 ID）
   * @param characterId - 角色ID
   * @param equipment - 装备 ID 映射
   */
  async saveEquipment(
    characterId: string,
    equipment: Record<EquipmentSlot, string | null>
  ): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_equipment.put({
        characterId,
        equipment,
        updatedAt: Date.now()
      });
    });
  }

  /**
   * 获取装备数据（返回装备 ID 映射）
   * @param characterId - 角色ID
   * @returns 装备 ID 映射
   */
  async getEquipment(
    characterId: string
  ): Promise<Record<EquipmentSlot, string | null>> {
    return dbService.withRetry(async () => {
      const data = await gameDb.char_equipment.get(characterId) as unknown as EquipmentDataStorage | undefined;
      if (!data) {
        return this.getDefaultEquipment();
      }

      if (data.equipment && typeof data.equipment === 'object') {
        return data.equipment;
      }

      return this.getDefaultEquipment();
    });
  }

  /**
   * 获取默认装备状态（全部为空）
   */
  private getDefaultEquipment(): Record<EquipmentSlot, string | null> {
    return {
      weapon1: null,
      weapon2: null,
      armor1: null,
      armor2: null,
      armor3: null,
      armor4: null
    };
  }

  /**
   * 删除装备数据
   * @param characterId - 角色ID
   */
  async deleteEquipment(characterId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_equipment.delete(characterId);
    });
  }

  /**
   * 保存装备模板到数据库
   * @param item - 装备数据
   */
  async saveEquipmentTemplate(item: EquipmentItem): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_equipmentItems.put({
        id: item.id,
        name: item.name,
        type: item.type,
        rarity: item.rarity,
        icon: item.icon,
        description: item.description,
        bonus: item.bonus || {},
        value: item.value,
        slots: item.slots,
        levelRequirement: item.levelRequirement || null,
        stackable: item.stackable || false,
        template: item.template || ''
      });
    });
  }

  /**
   * 获取装备模板
   * @param itemId - 装备ID
   * @returns 装备数据或null
   */
  async getEquipmentTemplate(itemId: string): Promise<EquipmentItem | null> {
    return dbService.withRetry(async () => {
      const data = await gameDb.config_equipmentItems.get(itemId) as unknown as EquipmentTemplateStorage | undefined;
      if (!data) return null;
      
      return {
        id: data.id,
        name: data.name,
        type: data.type as EquipmentItem['type'],
        rarity: data.rarity as EquipmentItem['rarity'],
        icon: data.icon,
        description: data.description,
        bonus: (data.bonus || {}) as Partial<EquipmentItem['bonus']>,
        value: data.value,
        slots: (Array.isArray(data.slots) ? data.slots : []) as EquipmentSlot[],
        levelRequirement: data.levelRequirement || undefined,
        stackable: data.stackable || false,
        template: data.template || undefined
      };
    });
  }

  /**
   * 获取所有装备模板
   * @returns 装备模板列表
   */
  async getAllEquipmentTemplates(): Promise<EquipmentItem[]> {
    return dbService.withRetry(async () => {
      const items = await gameDb.config_equipmentItems.toArray() as unknown as EquipmentTemplateStorage[];
      return items.map(data => ({
        id: data.id,
        name: data.name,
        type: data.type as EquipmentItem['type'],
        rarity: data.rarity as EquipmentItem['rarity'],
        icon: data.icon,
        description: data.description,
        bonus: (data.bonus || {}) as Partial<EquipmentItem['bonus']>,
        value: data.value,
        slots: (Array.isArray(data.slots) ? data.slots : []) as EquipmentSlot[],
        levelRequirement: data.levelRequirement || undefined,
        stackable: data.stackable || false,
        template: data.template || undefined
      }));
    });
  }

  /**
   * 删除装备模板
   * @param itemId - 装备ID
   */
  async deleteEquipmentTemplate(itemId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_equipmentItems.delete(itemId);
    });
  }
}

/**
 * 装备数据层实例
 */
export const equipmentDbService = new EquipmentDbService();
