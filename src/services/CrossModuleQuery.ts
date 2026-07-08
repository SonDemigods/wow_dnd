/**
 * @fileoverview 跨模块查询服务
 * @description 集中管理探索模块对其他模块数据的查询需求，避免 Store 直接依赖各模块的 DbService。
 *              通过聚合层隔离跨层调用，使探索模块仅依赖本服务而非具体数据层实现（EXP-4 修复）。
 * @module services
 */
import { mapDbService } from '@/modules/map/db';
import { questDbService } from '@/modules/quest/db';
import { shopDbService } from '@/modules/shop/db';
import { equipmentDbService } from '@/modules/equipment/db';
import { itemTemplateCache } from '@/services/ItemTemplateCache';
import type { LocationData } from '@/modules/map/types';
import type { Item } from '@/modules/inventory/types';
import type { QuestDefinition } from '@/modules/quest/types';
import type { ShopConfig } from '@/modules/shop/types';
import type { EquipmentItem } from '@/modules/equipment/types';

/**
 * 跨模块查询服务
 *
 * 将探索模块对地图、背包、任务、商店数据的查询统一收口，
 * 消除探索 Store 直接 import 其他模块 DbService 的跨层依赖。
 * 后续可在此层叠加缓存、批处理等增强能力（见 ItemTemplateCache）。
 */
export class CrossModuleQueryService {
  /** 获取地点数据 */
  async getLocationData(areaId: string): Promise<LocationData | null> {
    return await mapDbService.getLocationData(areaId);
  }

  /** 获取所有物品模板（命中内存缓存，避免重复 DB I/O，PERF-1 修复） */
  async getAllItemTemplates(): Promise<Item[]> {
    return await itemTemplateCache.getAll();
  }

  /** 获取区域相关的任务定义 */
  async getQuestDefinitionsByBoard(areaId: string): Promise<QuestDefinition[]> {
    return await questDbService.getQuestDefinitionsByBoard(areaId);
  }

  /** 获取所有商店配置 */
  async getAllShopConfigs(): Promise<ShopConfig[]> {
    return await shopDbService.getAllShopConfigs();
  }

  /** 获取所有装备模板（ARCH-2 修复：通过聚合层隔离 inventory 对 equipment DbService 的直接依赖） */
  async getAllEquipmentTemplates(): Promise<EquipmentItem[]> {
    return await equipmentDbService.getAllEquipmentTemplates();
  }
}

/** 跨模块查询服务单例 */
export const crossModuleQuery = new CrossModuleQueryService();
