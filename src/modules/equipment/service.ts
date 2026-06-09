/**
 * 装备模块服务层
 * 
 * 提供装备管理的核心业务逻辑
 */
import type { IEquipmentService, EquipmentItem, EquipmentSlot, EquippedItem, RarityConfig } from './types';
import type { Stats } from '../character/types';
import type { ItemRarity } from '../inventory/types';
import { equipmentDbService } from './db';
import { characterService } from '../character/service';
import { eventBus, GameEvents } from '../bus/core';
import { logService } from '../log/service';
import { RARITY_CONFIG } from '../../config/inventory';

/**
 * 槽位类型映射
 */
const SLOT_TYPES: Record<EquipmentSlot, 'weapon' | 'armor'> = {
  weapon1: 'weapon',
  weapon2: 'weapon',
  armor1: 'armor',
  armor2: 'armor',
  armor3: 'armor',
  armor4: 'armor'
};

/**
 * 装备服务实现类
 */
export class EquipmentService implements IEquipmentService {
  /** 当前装备状态 */
  private equipment: Record<EquipmentSlot, EquippedItem | null> = {
    weapon1: null,
    weapon2: null,
    armor1: null,
    armor2: null,
    armor3: null,
    armor4: null
  };
  
  /** 当前角色ID */
  private characterId: string | null = null;
  
  /** 装备模板缓存 */
  private equipmentTemplates: Map<string, EquipmentItem> = new Map();

  /**
   * 初始化装备服务
   * @param characterId - 角色ID
   */
  async initialize(characterId?: string): Promise<void> {
    this.characterId = characterId || characterService.getCurrentCharacterId();
    if (this.characterId) {
      this.equipment = await equipmentDbService.getEquipment(this.characterId);
    }
    await this.loadEquipmentTemplates();
    this.syncStatsToCharacter();
  }

  /**
   * 加载装备模板
   */
  private async loadEquipmentTemplates(): Promise<void> {
    const templates = await equipmentDbService.getAllEquipmentTemplates();
    templates.forEach(item => {
      this.equipmentTemplates.set(item.id, item);
    });
  }

  /**
   * 装备物品
   * @param slot - 槽位
   * @param item - 装备物品
   * @returns 是否成功装备
   */
  async equipItem(slot: EquipmentSlot, item: EquipmentItem): Promise<boolean> {
    if (!this.characterId) return false;
    
    // 检查是否可以装备
    if (!this.canEquip(item, slot)) {
      return false;
    }
    
    // 获取当前槽位的装备（如果有）
    const currentEquipped = this.equipment[slot];
    
    // 如果有当前装备，先卸下它的属性加成，并放回背包
    if (currentEquipped) {
      await this.removeItemBonus(currentEquipped.item);
      
      // 将旧装备放回背包
      const oldItemForInventory = {
        id: currentEquipped.item.id,
        itemId: currentEquipped.item.id,
        name: currentEquipped.item.name,
        icon: currentEquipped.item.icon,
        type: currentEquipped.item.type,
        rarity: currentEquipped.item.rarity,
        description: currentEquipped.item.description,
        value: currentEquipped.item.value,
        stackable: currentEquipped.item.stackable,
        count: 1
      } as any;
      
      eventBus.emit(GameEvents.INVENTORY_ADD_ITEM, { itemId: oldItemForInventory.id, quantity: 1 });
    }
    
    // 装备新物品
    this.equipment[slot] = {
      item,
      equippedAt: Date.now()
    };
    
    // 应用新装备的属性加成
    await this.applyItemBonus(item);
    
    // 保存到数据库
    this.save();
    
    // 触发事件
    eventBus.emit(GameEvents.EQUIPMENT_CHANGE, { slot, item: { item, equippedAt: Date.now() } });

    // 记录冒险日志
    logService.addLog({
      id: logService.generateLogId(),
      timestamp: Date.now(),
      type: 'item',
      message: `装备了：${item.name}`,
      icon: '⚔️'
    });
    
    return true;
  }

  /**
   * 卸下装备
   * @param slot - 槽位
   * @returns 卸下的装备
   */
  async unequipItem(slot: EquipmentSlot): Promise<EquippedItem | null> {
    const equippedItem = this.equipment[slot];
    if (!equippedItem) return null;
    
    // 移除属性加成
    await this.removeItemBonus(equippedItem.item);
    
    // 卸下装备
    this.equipment[slot] = null;
    
    // 保存到数据库
    this.save();
    
    // 将卸下的装备放回背包
    const itemForInventory = {
      id: equippedItem.item.id,
      itemId: equippedItem.item.id,
      name: equippedItem.item.name,
      icon: equippedItem.item.icon,
      type: equippedItem.item.type,
      rarity: equippedItem.item.rarity,
      description: equippedItem.item.description,
      value: equippedItem.item.value,
      stackable: equippedItem.item.stackable,
      count: 1
    } as any;
    
    // 确保物品模板存在
    eventBus.emit(GameEvents.INVENTORY_ADD_ITEM, { itemId: itemForInventory.id, quantity: 1 });
    
    // 触发事件
    eventBus.emit(GameEvents.EQUIPMENT_CHANGE, { slot, item: equippedItem });

    // 记录冒险日志
    logService.addLog({
      id: logService.generateLogId(),
      timestamp: Date.now(),
      type: 'item',
      message: `卸下了：${equippedItem.item.name}`,
      icon: '🔽'
    });
    
    return equippedItem;
  }

  /**
   * 获取所有装备
   * @returns 装备记录
   */
  getEquipment(): Record<EquipmentSlot, EquippedItem | null> {
    return { ...this.equipment };
  }

  /**
   * 获取指定槽位的装备
   * @param slot - 槽位
   * @returns 装备
   */
  getEquippedItem(slot: EquipmentSlot): EquippedItem | null {
    return this.equipment[slot] || null;
  }

  /**
   * 获取总属性
   * @returns 属性
   */
  getTotalStats(): Stats {
    const stats: Stats = {
      str: 0,
      dex: 0,
      con: 0,
      int: 0,
      wis: 0,
      cha: 0
    };
    
    Object.values(this.equipment).forEach(equippedItem => {
      if (equippedItem && equippedItem.item.bonus) {
        Object.keys(equippedItem.item.bonus).forEach(key => {
          const statKey = key as keyof Stats;
          stats[statKey] += equippedItem.item.bonus![statKey] || 0;
        });
      }
    });
    
    return stats;
  }

  /**
   * 检查是否可以装备
   * @param item - 装备物品
   * @param slot - 槽位（可选）
   * @returns 是否可以装备
   */
  canEquip(item: EquipmentItem, slot?: EquipmentSlot): boolean {
    // 检查等级要求
    if (item.levelRequirement) {
      const characterLevel = characterService.getLevel();
      if (characterLevel < item.levelRequirement) {
        return false;
      }
    }
    
    // 如果指定了槽位，检查槽位是否匹配
    if (slot) {
      // 检查槽位类型是否匹配
      if (this.getSlotType(slot) !== item.type) {
        return false;
      }
      
      // 检查装备是否适配该槽位
      if (!item.slots.includes(slot)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 获取槽位类型
   * @param slot - 槽位
   * @returns 槽位类型
   */
  getSlotType(slot: EquipmentSlot): 'weapon' | 'armor' {
    return SLOT_TYPES[slot];
  }

  /**
   * 同步属性到角色
   */
  syncStatsToCharacter(): void {
    // 先移除所有装备属性加成
    this.removeAllBonuses();
    
    // 重新应用所有装备属性加成
    this.applyAllBonuses();
  }

  /**
   * 重置装备数据
   */
  reset(): void {
    // 移除所有属性加成
    this.removeAllBonuses();
    
    // 清空装备
    this.equipment = {
      weapon1: null,
      weapon2: null,
      armor1: null,
      armor2: null,
      armor3: null,
      armor4: null
    };
    
    // 保存
    this.save();
  }

  /**
   * 获取稀有度配置
   * @param rarity - 稀有度
   * @returns 稀有度配置
   */
  getRarityConfig(rarity: ItemRarity): RarityConfig {
    return RARITY_CONFIG[rarity];
  }

  /**
   * 获取稀有度颜色
   * @param rarity - 稀有度
   * @returns 颜色
   */
  getRarityColor(rarity: ItemRarity): string {
    return RARITY_CONFIG[rarity].color;
  }

  /**
   * 获取装备模板
   * @param itemId - 装备ID
   * @returns 装备数据或null
   */
  getEquipmentTemplate(itemId: string): EquipmentItem | null {
    return this.equipmentTemplates.get(itemId) || null;
  }

  /**
   * 添加装备模板
   * @param item - 装备数据
   */
  addEquipmentTemplate(item: EquipmentItem): void {
    this.equipmentTemplates.set(item.id, item);
    equipmentDbService.saveEquipmentTemplate(item);
  }

  /**
   * 删除装备模板
   * @param itemId - 装备ID
   */
  removeEquipmentTemplate(itemId: string): void {
    this.equipmentTemplates.delete(itemId);
    equipmentDbService.deleteEquipmentTemplate(itemId);
  }

  /**
   * 设置当前角色
   * @param characterId - 角色ID
   */
  async setCharacter(characterId: string): Promise<void> {
    this.characterId = characterId;
    this.equipment = {
      weapon1: null,
      weapon2: null,
      armor1: null,
      armor2: null,
      armor3: null,
      armor4: null
    };
    await this.initialize(characterId);
  }

  /**
   * 应用装备属性加成
   * @param item - 装备物品
   */
  private async applyItemBonus(item: EquipmentItem): Promise<void> {
    if (item.bonus) {
      eventBus.emit(GameEvents.CHARACTER_APPLY_BONUS, { bonus: { ...item.bonus } });
    }
  }

  /**
   * 移除装备属性加成
   * @param item - 装备物品
   */
  private async removeItemBonus(item: EquipmentItem): Promise<void> {
    if (item.bonus) {
      eventBus.emit(GameEvents.CHARACTER_REMOVE_BONUS, { bonus: { ...item.bonus } });
    }
  }

  /**
   * 应用所有装备属性加成
   */
  private applyAllBonuses(): void {
    Object.values(this.equipment).forEach(equippedItem => {
      if (equippedItem) {
        this.applyItemBonus(equippedItem.item);
      }
    });
  }

  /**
   * 移除所有装备属性加成
   */
  private removeAllBonuses(): void {
    Object.values(this.equipment).forEach(equippedItem => {
      if (equippedItem) {
        this.removeItemBonus(equippedItem.item);
      }
    });
  }

  /**
   * 保存装备数据
   */
  private save(): void {
    if (this.characterId) {
      equipmentDbService.saveEquipment(this.characterId, this.equipment);
    }
  }
}

/**
 * 装备服务实例
 */
export const equipmentService = new EquipmentService();