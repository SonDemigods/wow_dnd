/**
 * 装备模块数据层
 * 
 * 封装装备数据的 IndexedDB 操作，提供数据持久化能力。
 * 装备数据以原生对象存储，无需 JSON 序列化/反序列化。
 */
import { db as gameDb, dbService } from '../data/core';
import type { EquipmentDataStorage, EquipmentTemplateStorage, EquipmentItem, EquipmentSlot, EquippedItem } from './types';
import { toRawData } from '../../utils';

/**
 * 装备数据层服务
 */
export class EquipmentDbService {
  /**
   * 保存装备数据到数据库（原生存储，不做 JSON 序列化）
   * @param characterId - 角色ID
   * @param equipment - 装备数据
   */
  async saveEquipment(
    characterId: string,
    equipment: Record<EquipmentSlot, EquippedItem | null>
  ): Promise<void> {
    await dbService.withRetry(async () => {
      // JSON 序列化往返：去除 undefined 值，确保所有数据可被结构化克隆
      const clean = toRawData(equipment);
      await gameDb.char_equipment.put({
        characterId,
        equipment: clean,
        updatedAt: Date.now()
      });
    });
  }

  /**
   * 获取装备数据
   * @param characterId - 角色ID
   * @returns 装备数据
   */
  async getEquipment(
    characterId: string
  ): Promise<Record<EquipmentSlot, EquippedItem | null>> {
    return dbService.withRetry(async () => {
      const data = await gameDb.char_equipment.get(characterId) as unknown as EquipmentDataStorage | undefined;
      if (!data) {
        return this.getDefaultEquipment();
      }

      // 原生对象存储，直接返回
      if (data.equipment && typeof data.equipment === 'object') {
        return data.equipment;
      }

      return this.getDefaultEquipment();
    });
  }

  /**
   * 获取默认装备状态
   */
  private getDefaultEquipment(): Record<EquipmentSlot, EquippedItem | null> {
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
