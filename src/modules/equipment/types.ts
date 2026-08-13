/**
 * @fileoverview 装备模块类型定义
 * @description 包含装备槽位、装备类型、已装备物品、运行时接口、存储接口等类型定义。
 *              本文件是 equipment 模块的类型基石，所有接口和类型别名均在此集中定义。
 *
 *              P3.3 升级：核心类型（EquipmentItem/EquippedItem/EquipmentState/EquipmentSlot 等）
 *              已迁移至 `item/types.ts` 的判别联合体系，本文件 re-export 保持消费方导入路径不变。
 * @module equipment
 */

// ============================================================================
// 核心类型 re-export（P3.3：从 item/types 迁移至判别联合体系）
// ============================================================================
//
// P3.3 类型覆盖：旧 `EquipmentItem extends Item`（字段叠加）已删除，
// 统一使用 `item/types.ts` 的判别联合成员 `EquipmentItem`（kind='equipment'）。
// 消费方通过 `item.kind === 'equipment'` 窄化即可安全访问 slots/bonus/grip 等专有字段。
// 此处 re-export 保持 `@/modules/equipment/types` 导入路径不变。
export type {
  EquipmentSlot,
  EquipmentSubtype,
  WeaponSubtype,
  ArmorSubtype,
  WeaponGrip,
  EquipmentItem,
  EquippedItem,
  EquipmentState
} from '../item/types';

import type { Capability } from '../item/capabilityTypes';

// ============================================================================
// 配置草稿类型
// ============================================================================

/**
 * 装备配置草稿类型（P3.3 升级）
 *
 * 配置层（config_equipment_items.ts）的装备条目使用此类型，
 * 条目只需声明业务字段（不含判别字面量与派生字段），
 * 在导出时通过 map 补全 `kind/subtype/grip/stackable/consumable/capabilities` 并派生 `slots/occupies`。
 *
 * Omit 的字段说明：
 * - `kind`/`stackable`/`consumable`：恒定字面量（'equipment'/false/false），由 map 补全
 * - `subtype`/`grip`：由配置层的分组 map 注入（按 SWORDS→sword 等约定）
 * - `slots`/`occupies`：由 subtype 经 slotRegistry 的 `deriveSlots`/`SUBTYPE_OCCUPIES` 派生
 * - `capabilities`：能力组合（plan.md §3.4），由配置层 map 注入静态常量（非运行期派生）
 *
 * 这样配置层无需逐条手填字面量与派生字段，由 slotRegistry 统一派生。
 */
export type EquipmentItemDraft = Omit<
  import('../item/types').EquipmentItem,
  'kind' | 'subtype' | 'grip' | 'occupies' | 'slots' | 'stackable' | 'consumable' | 'capabilities'
>;

// ============================================================================
// 套装系统类型（Phase 5.3 新增）
// ============================================================================
//
// P3.3b 升级：套装类型层已迁移至 setTypes.ts（基于判别联合的新版模型）。
// 旧版 ItemSet / SetBonus / SetBonusEffect（松散接口）已删除。
// 新版提供：ItemSet（parts + bonusTiers + category）/ SetBonusTier / SetBonusEffect（判别联合）/
// SetPartSpec / SetCategory / SetId。配套 setService 提供进度查询，setBonusRegistry 提供触发执行器。

// ============================================================================
// 存储/持久化接口
// ============================================================================

/**
 * 装备数据行存储接口（char_equipment 表）
 *
 * 以角色 ID 为主键，equipment 字段仅存装备 ID 映射（而非完整数据），
 * 完整装备属性通过 `config_equipment_items` 模板表按 ID 查询获得。
 *
 * 设计原则（数据规范化）：
 * - 避免数据冗余：同一装备的配置信息仅在 `config_equipment_items` 表中存储一份
 * - 兼容性：模板更新后，所有角色的装备属性自动同步
 * - 存储效率：char_equipment 表仅存 7 个字符串键值对
 *
 * @property {string} characterId - 角色 ID（主键）
 * @property {Record<EquipmentSlot, string | null>} equipment - 装备槽位 → 装备 ID 映射，null 表示空槽位
 * @property {number} updatedAt - 最后更新时间戳（毫秒）
 *
 * @see equipmentDbService.saveEquipment 写入数据库
 * @see equipmentDbService.getEquipment 从数据库读取装备 ID 映射
 */
export interface EquipmentDataStorage {
  characterId: string;
  equipment: Record<import('../item/types').EquipmentSlot, string | null>;
  updatedAt: number;
}

/**
 * 装备模板存储接口（config_equipment_items 表）
 *
 * 装备的完整属性定义，以装备 ID 为主键。
 * 与 char_equipment 表配合使用：char_equipment 存 ID 引用，此处存完整定义。
 *
 * 与 `EquipmentItem` 接口的区别：
 * - `EquipmentTemplateStorage`：数据库存储层，`bonus` 为 `Record<string, number>` 便于 IndexedDB 序列化
 * - `EquipmentItem`：运行时对象（判别联合成员），`bonus` 为 `Partial<Stats>`，提供字段智能提示
 *
 * P3.3 说明：`type` 字段（'weapon'|'armor'）保留用于旧 DB 数据兼容，
 * 运行时由 `subtype` 经 `isWeaponSubtype` 反推。`subtype`/`grip`/`occupies` 为可空字段，
 * 旧 DB 数据可能无这些列，`mapTemplateToEquipmentItem` 会按 type+slots 兜底推导。
 *
 * 通过 `mapTemplateToEquipmentItem()` 方法将存储格式转换为运行时 `EquipmentItem` 对象。
 *
 * @property {string} id - 装备唯一标识
 * @property {string} name - 装备名称
 * @property {string} type - 装备类型（"weapon" | "armor"，旧 DB 列，P3.3 由 subtype 反推）
 * @property {string} rarity - 稀有度（"common" | "uncommon" | "rare" | "epic" | "legendary"）
 * @property {string} icon - 装备图标（Iconify 格式，如 `game-icons:broadsword`）
 * @property {string} description - 装备描述文本
 * @property {Record<string, number>} bonus - 属性加成（存储为通用 Record，运行时映射为 Partial<Stats>）
 * @property {number} value - 装备价值（金币）
 * @property {import('../item/types').EquipmentSlot[]} slots - 可装备的槽位列表（旧 DB 可能含 armor1-4，运行时由 subtype 重新派生）
 * @property {number | null} levelRequirement - 最低装备等级（null = 无限制）
 * @property {boolean} stackable - 是否可堆叠（装备恒为 false）
 * @property {string} template - 模板标识
 * @property {object} [effect] - 装备使用效果（仅部分装备包含）
 * @property {boolean} [consumable] - 是否为消耗品（装备恒为 false）
 * @property {string} [subtype] - 装备子类型（可空，旧数据无此列，P3.1 新增）
 * @property {string} [grip] - 武器握持方式（可空，旧数据无此列，P3.1 新增）
 * @property {string[]} [occupies] - 实际占用槽位（可空，旧数据无此列，P3.1 新增）
 * @property {string[]} [classRestriction] - 可装备的职业 ID 列表（可空，P3.1 新增）
 * @property {string} [setId] - 所属套装 ID（可空，P3.1 新增）
 *
 * @see mapTemplateToEquipmentItem 存储类型 → 运行时类型的转换逻辑
 */
export interface EquipmentTemplateStorage {
  id: string;
  name: string;
  type: string;
  rarity: string;
  icon: string;
  description: string;
  bonus: Record<string, number>;
  value: number;
  slots: import('../item/types').EquipmentSlot[];
  levelRequirement: number | null;
  stackable: boolean;
  template: string;
  effect?: { type: string; value: number | Partial<Record<string, number>> } | null;
  consumable?: boolean;
  /** 装备子类型（可空，旧数据无此列，P3.1 新增） */
  subtype?: string;
  /** 武器握持方式（可空，旧数据无此列，P3.1 新增） */
  grip?: string;
  /** 实际占用槽位（可空，旧数据无此列，P3.1 新增） */
  occupies?: string[];
  /** 可装备的职业 ID 列表（可空，P3.1 新增） */
  classRestriction?: string[];
  /** 所属套装 ID（可空，P3.1 新增） */
  setId?: string;
  /** 能力标签集合（plan.md §3.4，配置层显式声明，mapTemplateToEquipmentItem 透传） */
  capabilities: Capability[];
}

// ============================================================================
// 导入/导出接口
// ============================================================================

/**
 * 装备数据导出/导入格式
 *
 * 用于跨角色或跨存档的装备数据迁移，为 JSON 序列化友好格式。
 * 与 `EquipmentDataStorage` 的区别：`updatedAt` 为可选字段，更灵活的 JSON 兼容性。
 *
 * equipment 字段仅存装备 ID，导入时需配合 `config_equipment_items` 模板表解析为完整装备对象。
 *
 * @property {string} characterId - 角色 ID
 * @property {Record<import('../item/types').EquipmentSlot, string | null>} equipment - 装备 ID 映射。导入时若缺少某些槽位的键，Store 层会使用 getDefaultEquipment() 补齐
 * @property {number} [updatedAt] - 更新时间戳（可选，导入时不强制要求）
 *
 * @see data/service.ts 导入/导出功能使用此接口进行 JSON 序列化
 */
export interface EquipmentStorage {
  characterId: string;
  equipment: Record<import('../item/types').EquipmentSlot, string | null>;
  updatedAt?: number;
}
