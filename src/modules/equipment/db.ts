/**
 * 装备模块数据层
 *
 * ## 设计说明
 *
 * 封装装备数据的 IndexedDB 操作，提供数据持久化能力。
 * 采用 ID 引用 + 模板分离的存储策略：
 *
 * ```
 * char_equipment 表          config_equipmentItems 表
 * ┌─────────────────┐       ┌──────────────────────────┐
 * │ characterId (PK)│       │ id (PK)                   │
 * │ equipment: {    │  ───→ │ name, type, rarity, ...   │
 * │   weapon1: "sw1"│  ID引用│ bonus, slots, value, ...  │
 * │   weapon2: null │       │ effect?, consumable?      │
 * │   armor1: "ar2" │       └──────────────────────────┘
 * │   ...           │
 * │ }               │
 * │ updatedAt       │
 * └─────────────────┘
 * ```
 *
 * char_equipment 仅存装备 ID 映射，完整属性从 config_equipmentItems 模板表获取。
 * 好处：装备属性变更只需更新模板表，无需遍历所有角色数据。
 *
 * ## 方法分类
 *
 * | 分类 | 方法 | 操作的表 |
 * |------|------|---------|
 * | 装备状态读写 | `saveEquipment`, `getEquipment`, `deleteEquipment` | char_equipment |
 * | 装备模板管理 | `saveEquipmentTemplate`, `getEquipmentTemplate`, `getAllEquipmentTemplates`, `deleteEquipmentTemplate` | config_equipmentItems |
 * | 内部工具 | `mapTemplateToEquipmentItem`, `getDefaultEquipment` | - |
 */
import { db as gameDb, dbService } from '@/modules/data';
import type { EquipmentTemplateStorage, EquipmentItem, EquipmentSlot } from './types';
import { createEmptySlotMap } from './service';

/**
 * 装备数据层服务
 *
 * 所有 DB 操作均包裹 `dbService.withRetry`，确保并发写入时的健壮性。
 */
export class EquipmentDbService {
  /**
   * 将数据库存储格式的装备模板转换为运行时 EquipmentItem 格式
   *
   * 桥接了两种类型体系：
   * - DB 层：EquipmentTemplateStorage（字段类型更宽，适配 IndexedDB）
   * - 运行时：EquipmentItem（字段类型精确，供业务逻辑使用）
   *
   * 转换过程中处理：
   * - type/rarity/slots → 通过 as 断言收紧类型
   * - bonus → Record<string, number> 转为 Partial<Stats>
   * - 可选字段 → 提供默认值（levelRequirement=undefined, stackable=false）
   *
   * P3 TS-10 审计决策（2026-07-31）：
   * - type/rarity/bonus 的 `as` 断言保留，属于"边界层信任 DB 数据"策略
   * - 数据合法性由数据写入路径保证（admin 后台表单校验 + 初始化器使用静态常量）
   * - 旧存档迁移问题应由迁移脚本统一处理，而非在每个读取点做运行时校验
   * - 双重断言 `as unknown as` 已消除（见 getEquipment/getEquipmentTemplate/getAllEquipmentTemplates）
   *
   * @param data - 数据库原始存储格式
   * @returns 运行时 EquipmentItem 格式
   */
  private mapTemplateToEquipmentItem(data: EquipmentTemplateStorage): EquipmentItem {
    return {
      id: data.id,
      name: data.name,
      type: data.type as EquipmentItem['type'],
      rarity: data.rarity as EquipmentItem['rarity'],
      icon: data.icon,
      description: data.description,
      bonus: (data.bonus ?? {}) as Partial<EquipmentItem['bonus']>,
      value: data.value,
      slots: (Array.isArray(data.slots) ? data.slots : []) as EquipmentSlot[],
      levelRequirement: data.levelRequirement ?? undefined,
      // P3-109 说明：stackable 使用 || 归一化（false 和 undefined 语义一致，均为不可堆叠）
      stackable: data.stackable || false,
      template: data.template || undefined
    };
  }

  // ==================== char_equipment 表操作 ====================

  /**
   * 保存装备数据到数据库（仅存装备 ID 映射）
   *
   * @param characterId - 角色 ID
   * @param equipment - 装备 ID 映射（Record<槽位, 装备ID | null>）
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
   *
   * 若角色无装备记录或数据损坏，返回默认全空映射。
   *
   * P3 TS-10 修复：Dexie 表已用 `Table<EquipmentStorage, string>` 泛型化，
   * `get()` 返回 `Promise<EquipmentStorage | undefined>`，无需双重断言。
   * 字段访问使用 `typeof` 守卫确保 equipment 为对象类型。
   *
   * @param characterId - 角色 ID
   * @returns 装备 ID 映射（全 null 表示无装备）
   */
  async getEquipment(
    characterId: string
  ): Promise<Record<EquipmentSlot, string | null>> {
    return dbService.withRetry(async () => {
      const data = await gameDb.char_equipment.get(characterId);
      if (!data) {
        return this.getDefaultEquipment();
      }

      // 类型守卫：确保 equipment 字段存在且为对象
      if (data.equipment && typeof data.equipment === 'object') {
        return data.equipment;
      }

      return this.getDefaultEquipment();
    });
  }

  /**
   * 获取默认装备状态（全部槽位为 null）
   *
   * 复用 service 层的 createEmptySlotMap，与 Store 层保持一致。
   */
  private getDefaultEquipment(): Record<EquipmentSlot, string | null> {
    return createEmptySlotMap<string | null>(null);
  }

  /**
   * 删除角色的装备数据
   *
   * @param characterId - 角色 ID
   */
  async deleteEquipment(characterId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_equipment.delete(characterId);
    });
  }

  // ==================== config_equipmentItems 表操作 ====================

  /**
   * 保存装备模板到数据库
   *
   * 将运行时 EquipmentItem 格式转为 DB 层 EquipmentTemplateStorage 格式后存储。
   * 可选字段提供默认值（bonus={}, levelRequirement=null, stackable=false, template=''）。
   *
   * @param item - 装备数据（运行时格式）
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
   * 获取单个装备模板
   *
   * P3 TS-10 修复：Dexie 表已用 `Table<EquipmentTemplateStorage, string>` 泛型化，
   * `get()` 返回 `Promise<EquipmentTemplateStorage | undefined>`，无需双重断言。
   *
   * @param itemId - 装备 ID
   * @returns 装备数据（运行时格式），不存在则返回 null
   */
  async getEquipmentTemplate(itemId: string): Promise<EquipmentItem | null> {
    return dbService.withRetry(async () => {
      const data = await gameDb.config_equipmentItems.get(itemId);
      if (!data) return null;
      return this.mapTemplateToEquipmentItem(data);
    });
  }

  /**
   * 获取所有装备模板
   *
   * 通常在 initialize 时调用，一次性加载全部模板到内存。
   *
   * P3 TS-10 修复：Dexie 表已泛型化，`toArray()` 返回 `Promise<EquipmentTemplateStorage[]>`，无需断言。
   *
   * @returns 全部装备模板列表（运行时格式）
   */
  async getAllEquipmentTemplates(): Promise<EquipmentItem[]> {
    return dbService.withRetry(async () => {
      const items = await gameDb.config_equipmentItems.toArray();
      return items.map(data => this.mapTemplateToEquipmentItem(data));
    });
  }

  /**
   * 删除装备模板
   *
   * @param itemId - 装备 ID
   */
  async deleteEquipmentTemplate(itemId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_equipmentItems.delete(itemId);
    });
  }
}

/**
 * 装备数据层单例
 *
 * 全局唯一实例，所有模块通过此常量访问装备 DB 操作。
 */
export const equipmentDbService = new EquipmentDbService();
