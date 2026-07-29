/**
 * @fileoverview 跨模块查询服务
 * @description 集中管理探索模块对其他模块数据的查询需求，避免 Store 直接依赖各模块的 DbService。
 *              通过聚合层隔离跨层调用，使探索模块仅依赖本服务而非具体数据层实现（EXP-4 修复）。
 * @module services
 */
import { mapDbService } from '@/modules/map';
import { questDbService } from '@/modules/quest';
import { shopDbService } from '@/modules/shop';
import { equipmentDbService } from '@/modules/equipment';
import { itemTemplateCache } from '@/services/ItemTemplateCache';
// P3-125 修复：引入 errorReporter 用于查询失败时记录错误并降级返回安全默认值
import { errorReporter } from '@/utils/errorReport';
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
 *
 * P3-125 修复：每个查询方法均添加 try-catch，失败时通过 errorReporter 记录错误
 * 并返回安全默认值（null 或空数组），避免单点查询异常导致探索流程整体崩溃。
 */
export class CrossModuleQueryService {
  /** 获取地点数据（失败时返回 null） */
  async getLocationData(areaId: string): Promise<LocationData | null> {
    try {
      return await mapDbService.getLocationData(areaId);
    } catch (err) {
      // P3-125 修复：记录错误并降级返回 null，调用方按"无地点数据"处理
      errorReporter.report(err, 'manual', { context: `CrossModuleQuery.getLocationData(${areaId}) 失败` });
      return null;
    }
  }

  /** 获取所有物品模板（命中内存缓存，避免重复 DB I/O，PERF-1 修复；失败时返回空数组） */
  async getAllItemTemplates(): Promise<Item[]> {
    try {
      return await itemTemplateCache.getAll();
    } catch (err) {
      // P3-125 修复：缓存加载失败时降级返回空数组，避免阻塞探索物品池构建
      errorReporter.report(err, 'manual', { context: 'CrossModuleQuery.getAllItemTemplates 失败' });
      return [];
    }
  }

  /** 获取区域相关的任务定义（失败时返回空数组） */
  async getQuestDefinitionsByBoard(areaId: string): Promise<QuestDefinition[]> {
    try {
      return await questDbService.getQuestDefinitionsByBoard(areaId);
    } catch (err) {
      // P3-125 修复：任务查询失败时降级返回空数组，该区域不生成任务
      errorReporter.report(err, 'manual', { context: `CrossModuleQuery.getQuestDefinitionsByBoard(${areaId}) 失败` });
      return [];
    }
  }

  /** 获取所有商店配置（失败时返回空数组） */
  async getAllShopConfigs(): Promise<ShopConfig[]> {
    try {
      return await shopDbService.getAllShopConfigs();
    } catch (err) {
      // P3-125 修复：商店配置查询失败时降级返回空数组，不渲染商店
      errorReporter.report(err, 'manual', { context: 'CrossModuleQuery.getAllShopConfigs 失败' });
      return [];
    }
  }

  /** 获取所有装备模板（ARCH-2 修复：通过聚合层隔离 inventory 对 equipment DbService 的直接依赖；失败时返回空数组） */
  async getAllEquipmentTemplates(): Promise<EquipmentItem[]> {
    try {
      return await equipmentDbService.getAllEquipmentTemplates();
    } catch (err) {
      // P3-125 修复：装备模板查询失败时降级返回空数组
      errorReporter.report(err, 'manual', { context: 'CrossModuleQuery.getAllEquipmentTemplates 失败' });
      return [];
    }
  }
}

/** 跨模块查询服务单例 */
export const crossModuleQuery = new CrossModuleQueryService();
