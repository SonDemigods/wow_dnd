/**
 * 商店模块服务层
 * 
 * 提供商店管理的核心业务逻辑
 */
import type { 
  IShopService, 
  ShopConfig, 
  ShopItem 
} from './types';
import type { ItemRarity, ItemType } from '../inventory/types';
import { shopDbService } from './db';
import { characterService } from '../character/service';
import { inventoryService } from '../inventory/service';
import { eventBus, GameEvents } from '../bus/core';
import { logService } from '../log/service';
import { RARITY_SELL_DISCOUNT, RARITY_PRICE_MULTIPLIER } from '@/config/inventory';
import { SHOPS } from '@/data/shop.data';

/**
 * 商店服务实现类
 */
/** 出售物品的内部跟踪条目 */
interface SoldItemEntry {
  itemId: string;
  price: number;
  count: number;
}

export class ShopService implements IShopService {
  /** 商店配置缓存 */
  private shopConfigs: Map<string, ShopConfig> = new Map();
  
  /** 商店商品缓存 */
  private shopItems: Map<string, ShopItem[]> = new Map();
  
  /** 玩家卖给商店的商品缓存（按 itemId 去重，跟踪数量，可按原价买回） */
  private soldItems: Map<string, Map<string, SoldItemEntry>> = new Map();
  
  /** 上次刷新时间 */
  private lastRefresh: Map<string, number> = new Map();

  /** 是否已完成初始化（避免重复从 DB 加载配置） */
  private initialized = false;
  
  /**
   * 初始化服务：从数据库加载商店配置并刷新初始商品
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      await this.loadShopConfigs();
      // 为所有已加载的商店生成初始商品
      for (const shopId of this.shopConfigs.keys()) {
        await this.refreshShopItems(shopId);
      }
      this.initialized = true;
    } catch (err) {
      console.error('[ShopService] 初始化失败:', err);
    }
  }

  /** 强制重新初始化（用于重置场景） */
  async reinit(): Promise<void> {
    this.initialized = false;
    this.shopConfigs.clear();
    this.shopItems.clear();
    this.soldItems.clear();
    this.lastRefresh.clear();
    await this.init();
  }
  
  /**
   * 加载商店配置（DB 为空时回退到硬编码种子数据，确保首次加载或数据损坏后也能正常工作）
   */
  private async loadShopConfigs(): Promise<void> {
    const configs = await shopDbService.getAllShopConfigs();
    if (configs.length > 0) {
      configs.forEach(config => {
        this.shopConfigs.set(config.id, config);
      });
    } else {
      // DB 中无商店配置（数据损坏或首次运行前），回退到硬编码数据
      console.warn('[ShopService] 数据库中无商店配置，使用硬编码种子数据');
      SHOPS.forEach(shop => {
        this.shopConfigs.set(shop.id, shop);
        // 同时回写到 DB，修复数据
        shopDbService.saveShopConfig(shop);
      });
    }
  }

  /**
   * 获取商店配置
   * @param shopId - 商店ID
   * @returns 商店配置
   */
  getShopConfig(shopId: string): ShopConfig | null {
    return this.shopConfigs.get(shopId) || null;
  }
  
  /**
   * 获取商店商品列表（合并生成物品 + 玩家出售的物品，纯缓存读取）
   * @param shopId - 商店ID
   * @returns 商品列表
   */
  getShopItems(shopId: string): ShopItem[] {
    const items = this.shopItems.get(shopId) || [];
    
    // 合并玩家卖给商店的物品（排在前面，方便买回，按 itemId 去重后每个仅一条）
    const soldMap = this.soldItems.get(shopId);
    const sold = soldMap
      ? Array.from(soldMap.values()).map(e => ({ itemId: e.itemId, price: e.price, quantity: e.count }))
      : [];
    // 去重：生成商品中排除已存在于回购列表的 itemId，同时过滤掉库存为 0 的商品
    const soldIds = new Set(sold.map(s => s.itemId));
    const filteredItems = items.filter(i => !soldIds.has(i.itemId) && i.quantity > 0);
    return [...sold, ...filteredItems];
  }

  /**
   * 获取指定物品在该商店的剩余回购数量
   * @param shopId - 商店ID
   * @param itemId - 物品ID
   * @returns 可回购数量（不是回购物品则返回 0）
   */
  getSoldItemCount(shopId: string, itemId: string): number {
    const soldMap = this.soldItems.get(shopId);
    if (!soldMap) return 0;
    const entry = soldMap.get(itemId);
    return entry ? entry.count : 0;
  }
  
  /**
   * 刷新商店商品
   * @param shopId - 商店ID
   */
  async refreshShopItems(shopId: string): Promise<void> {
    const config = this.getShopConfig(shopId);
    if (!config) {
      return;
    }
    
    const items = await this.generateShopItems(config);
    
    this.shopItems.set(shopId, items);
    this.lastRefresh.set(shopId, Date.now());
    await shopDbService.saveShopItems(shopId, items);
    
    // 触发商店刷新事件
    eventBus.emit(GameEvents.SHOP_REFRESHED, { shopId });
  }
  
  /**
   * 生成商店商品（从物品数据库按商店类型动态获取商品池）
   * @param config - 商店配置
   * @returns 商品列表
   */
  private async generateShopItems(config: ShopConfig): Promise<ShopItem[]> {
    const items: ShopItem[] = [];
    
    // 根据商店类型从物品数据库动态获取商品池
    const itemPool = await this.getItemPool(config.type);
    if (itemPool.length === 0) {
      console.warn(`[ShopService] 商店类型 "${config.type}" 无匹配物品`);
      return items;
    }
    
    // 固定随机选 10 种物品（不足 10 种则全选）
    const targetCount = 10;
    const itemCount = Math.min(targetCount, itemPool.length);
    
    // 随机选择商品
    const shuffled = [...itemPool].sort(() => Math.random() - 0.5);
    const selectedItems = shuffled.slice(0, itemCount);
    
    selectedItems.forEach(item => {
      // 商店商品按原价（基础价值 × 稀有度倍率），不浮动
      // 随机库存 1-10 件
      const stock = Math.floor(Math.random() * 10) + 1;
      items.push({
        itemId: item.id,
        price: this.calculateBuyPrice(item.id, item.rarity),
        quantity: stock
      });
    });
    
    return items;
  }
  
  /** 商店类型到物品类型的映射 */
  private static readonly SHOP_TYPE_ITEM_TYPE_MAP: Record<string, ItemType[]> = {
    general: ['potion', 'scroll', 'food', 'material'],
    potion: ['potion'],
    scroll: ['scroll'],
    food: ['food'],
    material: ['material']
  };

  /**
   * 从物品数据库动态获取商品池（按商店类型过滤）
   * @param type - 商店类型
   * @returns 物品信息列表
   */
  private async getItemPool(type: string): Promise<{ id: string; rarity: ItemRarity }[]> {
    // 确保物品模板已加载
    await inventoryService.initialize();
    const allItems = inventoryService.getAllItems();
    if (allItems.length === 0) {
      console.warn('[ShopService] 物品模板为空，无法生成商品池');
      return [];
    }

    const allowedTypes = ShopService.SHOP_TYPE_ITEM_TYPE_MAP[type] || ShopService.SHOP_TYPE_ITEM_TYPE_MAP.general;
    
    return allItems
      .filter(item => allowedTypes.includes(item.type as ItemType))
      .map(item => ({ id: item.id, rarity: item.rarity }));
  }
  
  /**
   * 购买物品
   * @param shopId - 商店ID
   * @param itemId - 物品ID
   * @param quantity - 购买数量，默认为1
   * @returns 是否购买成功
   */
  buyItem(shopId: string, itemId: string, quantity: number = 1): boolean {
    // 获取商店商品
    const items = this.getShopItems(shopId);
    
    // 查找商品
    const shopItem = items.find(item => item.itemId === itemId);
    if (!shopItem) {
      return false;
    }
    
    // 计算总价
    const totalPrice = shopItem.price * quantity;
    
    // 检查金币
    if (characterService.getGold() < totalPrice) {
      return false;
    }
    
    // 扣除金币
    characterService.addGold(-totalPrice);
    
    // 添加物品到背包
    const itemTemplate = inventoryService.getItemInfo(itemId);
    if (!itemTemplate) {
      characterService.addGold(totalPrice);
      return false;
    }

    let success = true;
    for (let i = 0; i < quantity; i++) {
      if (!inventoryService.addItem(itemTemplate)) {
        success = false;
        break;
      }
    }
    if (!success) {
      // 如果背包空间不足，返还金币
      characterService.addGold(totalPrice);
      return false;
    }
    
    // 如果购买的是回购物品，从 soldItems 中扣减数量
    const soldMap = this.soldItems.get(shopId);
    if (soldMap) {
      const soldEntry = soldMap.get(itemId);
      if (soldEntry) {
        soldEntry.count -= quantity;
        if (soldEntry.count <= 0) {
          soldMap.delete(itemId);
        }
        if (soldMap.size === 0) {
          this.soldItems.delete(shopId);
        }
      }
    }
    
    // 扣减商店商品库存（非回购物品）
    if (!soldMap?.has(itemId)) {
      const shopItems = this.shopItems.get(shopId);
      if (shopItems) {
        const idx = shopItems.findIndex(i => i.itemId === itemId);
        if (idx !== -1) {
          shopItems[idx].quantity -= quantity;
          if (shopItems[idx].quantity <= 0) {
            shopItems.splice(idx, 1);
          }
        }
      }
    }
    
    // 触发购买事件
    eventBus.emit(GameEvents.SHOP_TRANSACTION, { shopId, itemId, quantity, totalPrice });

    // 记录冒险日志
    const buyItemInfo = inventoryService.getItemInfo(itemId);
    if (buyItemInfo) {
      const qtyText = quantity > 1 ? ` x${quantity}` : '';
      logService.addLog({
        id: logService.generateLogId(),
        timestamp: Date.now(),
        type: 'shop',
        message: `购买了：${buyItemInfo.name}${qtyText}，花费 ${totalPrice} 金币`,
        icon: '🛒'
      });
    }
    
    return true;
  }
  
  /**
   * 出售物品
   * @param shopId - 商店ID（出售到的商店）
   * @param itemId - 物品ID
   * @param quantity - 出售数量，默认为1
   * @returns 是否出售成功
   */
  sellItem(itemId: string, quantity: number = 1, shopId?: string): boolean {
    // 获取物品信息
    const itemInfo = inventoryService.getItemInfo(itemId);
    if (!itemInfo) {
      return false;
    }
    
    // 检查背包中是否有足够数量
    const inventory = inventoryService.getInventory();
    const index = inventory.findIndex(item => item.itemId === itemId);
    if (index === -1) return false;
    
    const invItem = inventory[index];
    const actualQuantity = Math.min(quantity, invItem.count);
    if (actualQuantity <= 0) return false;
    
    // 计算实际售价
    const unitPrice = this.calculateSellPrice(itemId, itemInfo.rarity);
    const sellPrice = unitPrice * actualQuantity;
    
    // 使用 dropItem 处理堆叠物品的部分出售
    inventoryService.dropItem(index, actualQuantity);
    
    // 添加金币
    characterService.addGold(sellPrice);
    
    // 将出售的物品加入该商店的可购回列表（按 itemId 去重，累加数量）
    if (shopId) {
      const soldMap = this.soldItems.get(shopId) || new Map();
      const existing = soldMap.get(itemId);
      if (existing) {
        existing.count += actualQuantity;
      } else {
        soldMap.set(itemId, { itemId, price: unitPrice, count: actualQuantity });
      }
      this.soldItems.set(shopId, soldMap);
    }
    
    // 触发出售事件
    eventBus.emit(GameEvents.SHOP_TRANSACTION, { shopId, itemId, quantity: actualQuantity, sellPrice });

    // 记录冒险日志
    const qtyText2 = actualQuantity > 1 ? ` x${actualQuantity}` : '';
    logService.addLog({
      id: logService.generateLogId(),
      timestamp: Date.now(),
      type: 'shop',
      message: `出售了：${itemInfo.name}${qtyText2}，获得 ${sellPrice} 金币`,
      icon: '💰'
    });
    
    return true;
  }
  
  /**
   * 计算物品售价（基于物品固有价值 × 稀有度倍率 × 商店价格浮动）
   * @param itemId - 物品ID
   * @param rarity - 物品稀有度
   * @param priceMultiplier - 价格倍数，默认为1
   * @returns 售价
   */
  calculateBuyPrice(itemId: string, rarity: ItemRarity, priceMultiplier: number = 1): number {
    // 从物品模板获取基础价值
    const item = inventoryService.getItemInfo(itemId);
    const baseValue = item?.value || 10;
    const rarityMultiplier = RARITY_PRICE_MULTIPLIER[rarity] || 1;
    
    return Math.floor(baseValue * rarityMultiplier * priceMultiplier);
  }
  
  /**
   * 计算物品回收价（基于物品售价 × 稀有度折扣率）
   * @param itemId - 物品ID
   * @param rarity - 物品稀有度
   * @returns 回收价
   */
  calculateSellPrice(itemId: string, rarity: ItemRarity): number {
    // 回收价 = 标准售价 × 稀有度折扣
    const buyPrice = this.calculateBuyPrice(itemId, rarity);
    const discount = RARITY_SELL_DISCOUNT[rarity] || 0.5;
    return Math.floor(buyPrice * discount);
  }
  
  /**
   * 获取所有商店列表
   * @returns 商店配置列表
   */
  getAllShops(): ShopConfig[] {
    return Array.from(this.shopConfigs.values());
  }

  /**
   * 持久化当前商店ID到 gameState（供刷新后恢复）
   * @param shopId - 商店ID，null 表示清空
   */
  async saveCurrentShopId(shopId: string | null): Promise<void> {
    await shopDbService.saveCurrentShopId(shopId);
  }

  /**
   * 从 gameState 读取上次保存的商店ID
   * @returns 商店ID，未保存过返回 null
   */
  async getCurrentShopId(): Promise<string | null> {
    return shopDbService.getCurrentShopId();
  }
  
  /**
   * 检查商店是否需要刷新
   * @param shopId - 商店ID
   * @returns 是否需要刷新
   */
  needsRefresh(shopId: string): boolean {
    const config = this.getShopConfig(shopId);
    const lastRefreshTime = this.lastRefresh.get(shopId);
    
    if (!config || !lastRefreshTime) {
      return true;
    }
    
    const now = Date.now();
    return now - lastRefreshTime >= config.refreshInterval;
  }
  
  /**
   * 重置所有商店数据
   */
  async reset(): Promise<void> {
    await shopDbService.clearAllShopItems();
    await this.reinit();
  }
}

/**
 * 商店服务实例
 */
export const shopService = new ShopService();
