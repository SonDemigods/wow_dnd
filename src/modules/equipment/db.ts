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
 * │ equipment: {    │       │ name, type, rarity, ...   │
 * │   weapon1: "sw1"│  ───→ │ subtype, grip, slots, ... │
 * │   weapon2: null │       │ occupies, bonus, value    │
 * │   helm: "ar2"   │       │ effect?, consumable?      │
 * │   ... (7 槽)    │       └──────────────────────────┘
 * │ }               │
 * │ updatedAt       │
 * └─────────────────┘
 * ```
 *
 * char_equipment 仅存装备 ID 映射（7 槽：weapon1/weapon2/helm/chest/gloves/legs/boots），
 * 完整属性从 config_equipmentItems 模板表获取。
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
import type { EquipmentSubtype, WeaponGrip, ArmorSubtype } from '../item/types';
import { createEmptySlotMap } from './service';
import { deriveSlots, deriveGrip, SUBTYPE_OCCUPIES, isWeaponSubtype } from './slotRegistry';

// ============================================================================
// P3.1：旧 DB 数据兜底推导
// ============================================================================

/**
 * 旧版 6 槽护甲槽位 → 新版护甲子类型映射
 *
 * 旧 DB 数据的 slots 字段可能仍为 'armor1'-'armor4'（已废弃的旧槽位），
 * 此映射用于在缺失 subtype 列时反推护甲子类型。
 *
 * 映射关系（与 config_equipmentItems.ts 旧版数据约定一致）：
 * - armor1 → helm（头部）
 * - armor2 → chest（胸部）
 * - armor3 → legs（腿部）
 * - armor4 → boots（鞋子）
 */
const LEGACY_ARMOR_SLOT_TO_SUBTYPE: Record<string, ArmorSubtype> = {
  armor1: 'helm',
  armor2: 'chest',
  armor3: 'legs',
  armor4: 'boots'
};

/**
 * 由旧版 DB 数据（无 subtype 列）反推装备子类型
 *
 * 兜底规则：
 * - weapon + slots 仅含 weapon2 → shield（副手盾牌）
 * - weapon + 其他情况 → sword（默认单手武器）
 * - armor + slots 含 armor1-4 → 对应护甲子类型
 * - armor + 无法识别 → chest（默认胸甲）
 *
 * 此函数仅在 data.subtype 缺失时调用，新数据（含 subtype 列）不会走到这里。
 *
 * @param data - 旧版 DB 存储格式（无 subtype 字段）
 * @returns 推导出的装备子类型
 */
function deriveSubtypeFromLegacy(data: EquipmentTemplateStorage): EquipmentSubtype {
  const legacySlots = (Array.isArray(data.slots) ? data.slots : []) as string[];

  if (data.type === 'weapon') {
    // 副手专用（仅 weapon2）→ 盾牌
    if (legacySlots.includes('weapon2') && !legacySlots.includes('weapon1')) {
      return 'shield';
    }
    // 默认单手武器
    return 'sword';
  }

  // 护甲：按旧 armor1-4 槽位反推部位
  for (const legacySlot of legacySlots) {
    const mapped = LEGACY_ARMOR_SLOT_TO_SUBTYPE[legacySlot];
    if (mapped) return mapped;
  }
  // 兜底：胸部
  return 'chest';
}

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
   * - type/rarity → 通过 as 断言收紧类型
   * - bonus → Record<string, number> 转为 Partial<Stats>
   * - 可选字段 → 提供默认值（levelRequirement=undefined, stackable=false）
   *
   * P3.1 升级：subtype / grip / occupies / classRestriction / setId 字段处理
   * - subtype：优先用 DB 值；缺失时由 `deriveSubtypeFromLegacy` 兜底推导（旧 DB 数据无此列）
   * - grip：优先用 DB 值；缺失时由 subtype 经 `deriveGrip` 派生（护甲返回 undefined）
   * - slots：始终由 subtype 经 `deriveSlots` 派生（忽略 DB 中的旧 armor1-4 格式 slots）
   * - occupies：优先用 DB 值；缺失时查 `SUBTYPE_OCCUPIES`（双手武器占 2 槽），否则同 slots
   * - classRestriction / setId：直传（可选字段，undefined 表示无限制/无套装）
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
    // P3.1：subtype 兜底推导（旧 DB 数据无此列时由 type+slots 反推）
    const subtype: EquipmentSubtype =
      (data.subtype as EquipmentSubtype | undefined) ?? deriveSubtypeFromLegacy(data);
    // grip：优先用 DB 值，否则由 subtype 派生（护甲返回 undefined）
    const grip: WeaponGrip | undefined = data.grip
      ? (data.grip as WeaponGrip)
      : deriveGrip(subtype);
    // slots：始终由 subtype 派生（忽略 data.slots，可能是旧 armor1-4 格式）
    const slots = deriveSlots(subtype);
    // occupies：优先用 DB 值，否则由 subtype 派生（双手武器占 2 槽，其余同 slots）
    const occupies: EquipmentSlot[] = data.occupies
      ? (data.occupies as EquipmentSlot[])
      : (SUBTYPE_OCCUPIES[subtype] ?? slots);

    return {
      id: data.id,
      name: data.name,
      // P3.3：判别联合字面量（装备恒为 kind='equipment'，不可堆叠，非消耗品）
      kind: 'equipment' as const,
      rarity: data.rarity as EquipmentItem['rarity'],
      icon: data.icon,
      description: data.description,
      bonus: (data.bonus ?? {}) as Partial<EquipmentItem['bonus']>,
      value: data.value,
      subtype,
      grip,
      stackable: false as const,
      consumable: false as const,
      slots,
      occupies,
      levelRequirement: data.levelRequirement ?? undefined,
      template: data.template || undefined,
      // P3.1 新增可选字段直传（undefined 表示无限制/无套装）
      classRestriction: data.classRestriction,
      setId: data.setId,
      // plan.md §3.4：能力标签集合透传（配置层显式声明，无派生兜底）
      capabilities: data.capabilities
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
   * P3.1 升级：写入 subtype / grip / occupies / classRestriction / setId 新字段，
   * 确保新数据落库后包含完整派生信息，读取时无需重复推导。
   *
   * @param item - 装备数据（运行时格式）
   */
  async saveEquipmentTemplate(item: EquipmentItem): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_equipmentItems.put({
        id: item.id,
        name: item.name,
        // P3.3：DB 旧 type 列由 subtype 反推（weapon/armor），运行时 EquipmentItem 无 type 字段
        type: isWeaponSubtype(item.subtype) ? 'weapon' : 'armor',
        rarity: item.rarity,
        icon: item.icon,
        description: item.description,
        bonus: item.bonus || {},
        value: item.value,
        // P3.1 新增字段
        subtype: item.subtype,
        grip: item.grip,
        slots: item.slots,
        occupies: item.occupies,
        levelRequirement: item.levelRequirement || null,
        stackable: item.stackable,
        template: item.template || '',
        // P3.1 新增可选字段（undefined 不会写入 IndexedDB，读取时按 undefined 处理）
        classRestriction: item.classRestriction,
        setId: item.setId,
        // plan.md §3.4：能力标签集合落库（必填字段，配置层显式声明）
        capabilities: item.capabilities
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
