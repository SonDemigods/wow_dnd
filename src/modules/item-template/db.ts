/**
 * @fileoverview 统一物品模板层数据聚合
 * @description
 *   聚合 config_items（普通物品）与 config_equipmentItems（装备）两表的查询，
 *   消除 inventory 模块对 equipment DbService 的直接依赖（A1/G1 修复）。
 *
 *   依赖方向：item-template → inventory.db + equipment.db（单向，无循环）
 *   本模块是 inventory 与 equipment 之间的只读聚合层，不持有任何写入逻辑。
 *
 * @module item-template
 */
import { inventoryDbService } from '../inventory/db';
import { equipmentDbService } from '../equipment/db';
import type { Item } from './types';
import type { EquipmentItem } from '../equipment/types';

/**
 * 统一物品模板数据层服务
 *
 * 聚合普通物品模板（config_items）与装备模板（config_equipmentItems）的查询。
 * 本类仅提供原始数据查询，类型转换与合并逻辑由 service.ts 提供，
 * 保持数据层与服务层的职责分离。
 */
export class ItemTemplateDbService {
  /**
   * 获取全部普通物品模板（config_items 表）
   *
   * 委托 inventoryDbService，保持单一数据来源。
   * 返回的 Item 列表包含 effect/consumable/template 等消耗品字段。
   */
  async getAllItemTemplates(): Promise<Item[]> {
    return await inventoryDbService.getAllItemTemplates();
  }

  /**
   * 获取全部装备模板（config_equipmentItems 表，原始 EquipmentItem 格式）
   *
   * 委托 equipmentDbService 查询装备模板。
   * 保留原始 EquipmentItem 格式，供需要装备专有字段（slots/classRestriction/setId）
   * 的调用方使用，以及供 service.ts 的 convertEquipmentToItem 转换。
   */
  async getAllEquipmentTemplates(): Promise<EquipmentItem[]> {
    return await equipmentDbService.getAllEquipmentTemplates();
  }
}

/** 统一物品模板数据层单例 */
export const itemTemplateDbService = new ItemTemplateDbService();
