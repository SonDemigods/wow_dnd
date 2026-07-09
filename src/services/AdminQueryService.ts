/**
 * @fileoverview 管理后台查询服务
 * @description 收口控制台命令模块对 enemy/boss/inventory/equipment DbService 的直接依赖
 *              （CHR-5 修复），统一管理后台的数据查询入口。
 *
 * ## 职责边界
 *
 * - **输入**：物品 ID、敌人 ID 等查询参数
 * - **输出**：模板数据或列表
 * - **内部**：聚合调用 enemy/boss/inventory/equipment 各模块 DbService 的查询方法
 * - **不负责**：数据写入操作（写入仍通过各模块 Store Action，确保业务校验）
 *
 * ## 设计原则
 *
 * - 管理后台不直接访问 DbService，避免绕过 Store 的业务校验
 * - 查询类操作通过本服务聚合，减少 console.ts 的跨模块 import
 * - 服务层无状态，仅聚合查询，不持有缓存（缓存由 ItemTemplateCache 负责）
 *
 * @module services
 */
import { enemyDbService } from '@/modules/enemy';
import { bossDbService } from '@/modules/boss';
import { inventoryDbService } from '@/modules/inventory';
import { equipmentDbService } from '@/modules/equipment';
import type { Item } from '@/modules/inventory/types';
import type { EquipmentItem } from '@/modules/equipment/types';
import type { EnemyData } from '@/modules/enemy/types';
import type { BossTemplate } from '@/modules/boss/types';

/**
 * 管理后台查询服务
 *
 * 将控制台命令对物品/敌人/Boss 模板的查询统一收口，
 * 消除 console.ts 对 4 个模块 DbService 的直接依赖。
 */
export class AdminQueryService {
  // ========================================================================
  // 物品模板查询
  // ========================================================================

  /**
   * 查询所有物品模板（消耗品 + 装备）
   *
   * 用于 `item` 命令无参数时列出所有可用物品。
   *
   * @returns 包含消耗品列表和装备列表的对象
   *
   * @see inventoryDbService.getAllItemTemplates
   * @see equipmentDbService.getAllEquipmentTemplates
   */
  async queryAllItemTemplates(): Promise<{
    items: Item[];
    equipments: EquipmentItem[];
  }> {
    const [items, equipments] = await Promise.all([
      inventoryDbService.getAllItemTemplates(),
      equipmentDbService.getAllEquipmentTemplates(),
    ]);
    return { items, equipments };
  }

  /**
   * 查询单个物品模板（先查消耗品，未命中再查装备）
   *
   * 用于 `item` 命令添加物品时按 ID 查找模板。
   *
   * @param itemId - 物品 ID
   * @returns 物品模板和类型标识，未找到时返回 null
   *
   * @see inventoryDbService.getItemTemplate
   * @see equipmentDbService.getEquipmentTemplate
   */
  async queryItemTemplate(
    itemId: string
  ): Promise<{ type: 'item'; data: Item } | { type: 'equipment'; data: EquipmentItem } | null> {
    // 先查消耗品
    const lootItem = await inventoryDbService.getItemTemplate(itemId);
    if (lootItem) {
      return { type: 'item', data: lootItem };
    }

    // 未命中再查装备
    const equipItem = await equipmentDbService.getEquipmentTemplate(itemId);
    if (equipItem) {
      return { type: 'equipment', data: equipItem };
    }

    return null;
  }

  // ========================================================================
  // 敌人模板查询
  // ========================================================================

  /**
   * 查询所有敌人模板（普通怪物 + Boss）
   *
   * 用于 `spawn` 命令无参数时列出所有可用敌人。
   *
   * @returns 包含普通怪物列表和 Boss 列表的对象
   *
   * @see enemyDbService.getAllEnemyTemplates
   * @see bossDbService.getAllBossTemplates
   */
  async queryAllEnemyTemplates(): Promise<{
    mobs: EnemyData[];
    bosses: BossTemplate[];
  }> {
    const [mobs, bosses] = await Promise.all([
      enemyDbService.getAllEnemyTemplates(),
      bossDbService.getAllBossTemplates(),
    ]);
    return { mobs, bosses };
  }
}

/** 管理后台查询服务单例 */
export const adminQueryService = new AdminQueryService();
