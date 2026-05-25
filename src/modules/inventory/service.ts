/**
 * 背包模块服务层
 * 
 * 提供背包管理的核心业务逻辑
 */
import type { IInventoryService, Item, InventoryItem, SortField, SortOrder, ItemFilters, ItemType, ItemRarity } from './types';
import { inventoryDbService } from './db';
import { characterService } from '../character/service';
import { eventBus, GameEvents } from '../bus/core';

/**
 * 背包容量
 */
const INVENTORY_SIZE = 50;

/**
 * 最大堆叠数量
 */
const MAX_STACK = 10;

/**
 * 物品类型名称映射
 */
const ITEM_TYPE_NAMES: Record<ItemType, string> = {
  gold: '货币',
  potion: '药水',
  scroll: '卷轴',
  food: '食物',
  material: '材料',
  quest: '任务物品',
  weapon: '武器',
  armor: '护甲',
  misc: '杂项'
};

/**
 * 物品稀有度颜色映射
 */
const ITEM_RARITY_COLORS: Record<ItemRarity, string> = {
  common: '#9d9d9d',
  uncommon: '#1eff00',
  rare: '#0070dd',
  epic: '#a335ee',
  legendary: '#ff8000'
};

/**
 * 背包服务实现类
 */
export class InventoryService implements IInventoryService {
  /** 当前角色背包 */
  private inventory: InventoryItem[] = [];
  
  /** 物品模板缓存 */
  private itemTemplates: Map<string, Item> = new Map();
  
  /** 当前角色ID */
  private characterId: string | null = null;

  /**
   * 初始化背包服务
   * @param characterId - 角色ID
   */
  async initialize(characterId?: string): Promise<void> {
    this.characterId = characterId || characterService.getCurrentCharacterId();
    if (this.characterId) {
      this.inventory = await inventoryDbService.getInventory(this.characterId);
    }
    await this.loadItemTemplates();
  }

  /**
   * 加载物品模板
   */
  private async loadItemTemplates(): Promise<void> {
    const templates = await inventoryDbService.getAllItemTemplates();
    templates.forEach(item => {
      this.itemTemplates.set(item.id, item);
    });
  }

  /**
   * 获取背包内容
   * @returns 背包物品列表
   */
  getInventory(): InventoryItem[] {
    return [...this.inventory];
  }

  /**
   * 获取指定位置的物品
   * @param index - 物品位置索引
   * @returns 物品数据
   */
  getItem(index: number): InventoryItem | null {
    if (index < 0 || index >= this.inventory.length) {
      return null;
    }
    return this.inventory[index] || null;
  }

  /**
   * 获取物品详细信息
   * @param itemId - 物品ID
   * @returns 物品数据或null
   */
  getItemInfo(itemId: string): Item | null {
    return this.itemTemplates.get(itemId) || null;
  }

  /**
   * 添加物品到背包
   * @param item - 物品数据
   * @returns 是否成功添加
   */
  addItem(item: Item): boolean {
    if (!this.characterId) return false;
    
    // 检查背包是否已满
    if (this.isFull()) {
      return false;
    }
    
    // 如果物品可堆叠，尝试堆叠
    if (item.stackable) {
      const existingIndex = this.inventory.findIndex(
        invItem => invItem.itemId === item.id && invItem.count < MAX_STACK
      );
      
      if (existingIndex !== -1) {
        const remaining = MAX_STACK - this.inventory[existingIndex].count;
        this.inventory[existingIndex].count += Math.min(1, remaining);
        this.save();
        eventBus.emit(GameEvents.INVENTORY_CHANGE, { itemId: item.id, count: 1 });
        return true;
      }
    }
    
    // 添加到空槽位
    this.inventory.push({ itemId: item.id, count: 1 });
    this.save();
    eventBus.emit(GameEvents.INVENTORY_CHANGE, { itemId: item.id, count: 1 });
    return true;
  }

  /**
   * 批量添加物品
   * @param item - 物品数据
   * @param count - 数量
   * @returns 实际添加的数量
   */
  addItems(item: Item, count: number): number {
    if (!this.characterId || count <= 0) return 0;
    
    let added = 0;
    
    if (item.stackable) {
      // 先尝试堆叠到已有物品
      for (let i = 0; i < this.inventory.length && added < count; i++) {
        if (this.inventory[i].itemId === item.id && this.inventory[i].count < MAX_STACK) {
          const remaining = MAX_STACK - this.inventory[i].count;
          const addCount = Math.min(remaining, count - added);
          this.inventory[i].count += addCount;
          added += addCount;
        }
      }
    }
    
    // 添加剩余物品到空槽位
    while (added < count && !this.isFull()) {
      this.inventory.push({ itemId: item.id, count: Math.min(count - added, item.stackable ? MAX_STACK : 1) });
      added += Math.min(count - added, item.stackable ? MAX_STACK : 1);
    }
    
    if (added > 0) {
      this.save();
      eventBus.emit(GameEvents.INVENTORY_CHANGE, { itemId: item.id, count: added });
    }
    
    return added;
  }

  /**
   * 移除指定位置的物品
   * @param index - 物品位置索引
   * @returns 是否成功移除
   */
  removeItem(index: number): boolean {
    if (index < 0 || index >= this.inventory.length) {
      return false;
    }
    
    const item = this.inventory[index];
    this.inventory.splice(index, 1);
    this.save();
    eventBus.emit(GameEvents.INVENTORY_CHANGE, { itemId: item.itemId, count: item.count });
    return true;
  }

  /**
   * 使用指定位置的物品
   * @param index - 物品位置索引
   * @returns 是否成功使用
   */
  useItem(index: number): boolean {
    const inventoryItem = this.getItem(index);
    if (!inventoryItem) return false;
    
    const item = this.getItemInfo(inventoryItem.itemId);
    if (!item || !item.consumable) return false;
    
    // 应用物品效果
    if (item.hpRestore && item.hpRestore > 0) {
      characterService.addHp(item.hpRestore);
    }
    
    if (item.mpRestore && item.mpRestore > 0) {
      characterService.addMp(item.mpRestore);
    }
    
    // 如果有属性加成，应用属性加成
    if (item.bonus) {
      characterService.applyBonus(item.bonus);
    }
    
    // 减少物品数量或移除
    if (inventoryItem.count > 1) {
      this.inventory[index].count--;
    } else {
      this.inventory.splice(index, 1);
    }
    
    this.save();
    eventBus.emit(GameEvents.INVENTORY_CHANGE, { itemId: item.id });
    return true;
  }

  /**
   * 获取空槽位数量
   * @returns 空槽位数量
   */
  getEmptySlots(): number {
    return INVENTORY_SIZE - this.inventory.length;
  }

  /**
   * 检查背包是否已满
   * @returns 是否已满
   */
  isFull(): boolean {
    return this.inventory.length >= INVENTORY_SIZE;
  }

  /**
   * 检查物品是否可以堆叠
   * @param item - 物品数据
   * @returns 是否可以堆叠
   */
  canStack(item: InventoryItem): boolean {
    const itemInfo = this.getItemInfo(item.itemId);
    return itemInfo?.stackable || false;
  }

  /**
   * 获取物品可堆叠数量
   * @param item - 物品数据
   * @returns 可堆叠数量
   */
  getStackableCount(item: InventoryItem): number {
    const itemInfo = this.getItemInfo(item.itemId);
    if (!itemInfo?.stackable) return 0;
    
    const existing = this.inventory.find(i => i.itemId === item.itemId);
    if (!existing) return MAX_STACK;
    
    return MAX_STACK - existing.count;
  }

  /**
   * 丢弃指定位置的物品
   * @param index - 物品位置索引
   * @param count - 丢弃数量
   * @returns 是否成功丢弃
   */
  dropItem(index: number, count?: number): boolean {
    if (index < 0 || index >= this.inventory.length) {
      return false;
    }
    
    const item = this.inventory[index];
    const dropCount = count || item.count;
    
    if (dropCount >= item.count) {
      this.inventory.splice(index, 1);
    } else {
      this.inventory[index].count -= dropCount;
    }
    
    this.save();
    eventBus.emit(GameEvents.INVENTORY_CHANGE, { itemId: item.itemId, count: dropCount });
    return true;
  }

  /**
   * 批量丢弃物品
   * @param indices - 物品位置索引列表
   * @returns 是否成功丢弃
   */
  dropItems(indices: number[]): boolean {
    if (indices.length === 0) return false;
    
    // 按索引从大到小排序，避免删除时索引偏移
    const sortedIndices = [...indices].sort((a, b) => b - a);
    
    sortedIndices.forEach(index => {
      if (index >= 0 && index < this.inventory.length) {
        const item = this.inventory[index];
        this.inventory.splice(index, 1);
        eventBus.emit(GameEvents.INVENTORY_CHANGE, { itemId: item.itemId, count: item.count });
      }
    });
    
    this.save();
    return true;
  }

  /**
   * 排序物品
   * @param sortBy - 排序字段
   * @param order - 排序顺序
   */
  sortItems(sortBy: SortField, order: SortOrder): void {
    const sortMultiplier = order === 'asc' ? 1 : -1;
    
    this.inventory.sort((a, b) => {
      const itemA = this.getItemInfo(a.itemId);
      const itemB = this.getItemInfo(b.itemId);
      
      let comparison = 0;
      
      switch (sortBy) {
        case 'type':
          comparison = (ITEM_TYPE_NAMES[itemA?.type || 'misc'] || '').localeCompare(
            ITEM_TYPE_NAMES[itemB?.type || 'misc'] || ''
          );
          break;
        case 'rarity':
          const rarityOrder: Record<ItemRarity, number> = {
            common: 0,
            uncommon: 1,
            rare: 2,
            epic: 3,
            legendary: 4
          };
          comparison = (rarityOrder[itemA?.rarity || 'common'] || 0) - 
                       (rarityOrder[itemB?.rarity || 'common'] || 0);
          break;
        case 'name':
          comparison = (itemA?.name || '').localeCompare(itemB?.name || '');
          break;
        case 'acquiredAt':
          comparison = 0;
          break;
        case 'level':
          comparison = (itemA?.bonus?.str || 0) - (itemB?.bonus?.str || 0);
          break;
      }
      
      return comparison * sortMultiplier;
    });
    
    this.save();
  }

  /**
   * 整理背包
   */
  organizeInventory(): void {
    // 将同类物品堆叠在一起
    const itemsMap = new Map<string, number>();
    
    this.inventory.forEach(item => {
      const current = itemsMap.get(item.itemId) || 0;
      itemsMap.set(item.itemId, current + item.count);
    });
    
    // 重新生成背包
    this.inventory = [];
    itemsMap.forEach((totalCount, itemId) => {
      const itemInfo = this.getItemInfo(itemId);
      if (!itemInfo?.stackable) {
        for (let i = 0; i < totalCount; i++) {
          this.inventory.push({ itemId, count: 1 });
        }
      } else {
        while (totalCount > 0) {
          const stackSize = Math.min(totalCount, MAX_STACK);
          this.inventory.push({ itemId, count: stackSize });
          totalCount -= stackSize;
        }
      }
    });
    
    // 按类型排序
    this.sortItems('type', 'asc');
  }

  /**
   * 搜索物品
   * @param keyword - 搜索关键词
   * @returns 匹配的物品列表
   */
  searchItems(keyword: string): InventoryItem[] {
    if (!keyword.trim()) return [...this.inventory];
    
    const lowerKeyword = keyword.toLowerCase();
    
    return this.inventory.filter(invItem => {
      const item = this.getItemInfo(invItem.itemId);
      return item && (
        item.name.toLowerCase().includes(lowerKeyword) ||
        item.description.toLowerCase().includes(lowerKeyword)
      );
    });
  }

  /**
   * 筛选物品
   * @param filters - 筛选条件
   * @returns 匹配的物品列表
   */
  filterItems(filters: ItemFilters): InventoryItem[] {
    return this.inventory.filter(invItem => {
      const item = this.getItemInfo(invItem.itemId);
      if (!item) return false;
      
      // 类型筛选
      if (filters.types && filters.types.length > 0) {
        if (!filters.types.includes(item.type)) {
          return false;
        }
      }
      
      // 稀有度筛选
      if (filters.rarities && filters.rarities.length > 0) {
        if (!filters.rarities.includes(item.rarity)) {
          return false;
        }
      }
      
      // 可堆叠筛选
      if (filters.stackable !== undefined) {
        if (item.stackable !== filters.stackable) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * 获取物品总价值
   * @returns 总价值
   */
  getTotalValue(): number {
    let total = 0;
    this.inventory.forEach(invItem => {
      const item = this.getItemInfo(invItem.itemId);
      if (item) {
        total += item.value * invItem.count;
      }
    });
    return total;
  }

  /**
   * 获取物品数量统计
   * @returns 统计对象
   */
  getItemCountByType(): Record<ItemType, number> {
    const counts: Record<ItemType, number> = {
      gold: 0,
      potion: 0,
      scroll: 0,
      food: 0,
      material: 0,
      quest: 0,
      weapon: 0,
      armor: 0,
      misc: 0
    };
    
    this.inventory.forEach(invItem => {
      const item = this.getItemInfo(invItem.itemId);
      if (item) {
        counts[item.type] += invItem.count;
      }
    });
    
    return counts;
  }

  /**
   * 添加物品模板
   * @param item - 物品数据
   */
  addItemTemplate(item: Item): void {
    this.itemTemplates.set(item.id, item);
    inventoryDbService.saveItemTemplate(item);
  }

  /**
   * 删除物品模板
   * @param itemId - 物品ID
   */
  removeItemTemplate(itemId: string): void {
    this.itemTemplates.delete(itemId);
    inventoryDbService.deleteItemTemplate(itemId);
  }

  /**
   * 重置背包数据
   */
  reset(): void {
    this.inventory = [];
    this.save();
  }

  /**
   * 保存背包数据
   */
  private save(): void {
    if (this.characterId) {
      inventoryDbService.saveInventory(this.characterId, this.inventory);
    }
  }

  /**
   * 设置当前角色
   * @param characterId - 角色ID
   */
  setCharacter(characterId: string): void {
    this.characterId = characterId;
    this.inventory = [];
    this.initialize(characterId);
  }
}

/**
 * 背包服务实例
 */
export const inventoryService = new InventoryService();