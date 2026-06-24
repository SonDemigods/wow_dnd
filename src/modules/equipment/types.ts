/**
 * @fileoverview 装备模块类型定义
 * @description 包含装备槽位、装备类型、已装备物品、运行时接口、存储接口等类型定义。
 *              本文件是 equipment 模块的类型基石，所有接口和类型别名均在此集中定义。
 * @module equipment
 */

import type { Item } from '../inventory/types';
import type { Stats } from '../character/types';

// ============================================================================
// 枚举类型
// ============================================================================

/**
 * 装备槽位联合类型
 *
 * 共 6 个槽位，分为武器组（2 个）和护甲组（4 个）。
 * 武器可装备到 weapon1 或 weapon2，护甲可装备到 armor1-4。
 *
 * - `weapon1`：主手武器槽
 * - `weapon2`：副手武器槽（盾牌等副手装备也可放入）
 * - `armor1`：护甲槽1（头部）
 * - `armor2`：护甲槽2（胸部）
 * - `armor3`：护甲槽3（腿部）
 * - `armor4`：护甲槽4（鞋子）
 *
 * @see ALL_EQUIPMENT_SLOTS 按其定义顺序作为 UI 展示顺序
 * @see getSlotType 根据命名前缀 `weapon*` / `armor*` 推导槽位类型
 */
export type EquipmentSlot =
  | 'weapon1'
  | 'weapon2'
  | 'armor1'
  | 'armor2'
  | 'armor3'
  | 'armor4';

/**
 * 装备类型枚举
 *
 * 决定装备可以放入哪些槽位：
 * - `weapon`：武器类装备，可适配 weapon1 / weapon2 槽位
 * - `armor`：护甲类装备，可适配 armor1-4 槽位
 *
 * @see validateSlot 使用此类型校验装备与槽位的匹配关系
 */
export type EquipmentType = 'weapon' | 'armor';

// ============================================================================
// 核心数据接口
// ============================================================================

/**
 * 装备物品接口
 *
 * 继承自 inventory 模块的 `Item`（包含 id、name、icon、description、value、rarity、stackable、template 等基础字段），
 * 在此基础上扩展装备专有字段。
 *
 * 数据来源流程：
 * 1. 装备模板（`EquipmentTemplateStorage`）存储在 `config_equipmentItems` 表中
 * 2. `mapTemplateToEquipmentItem()` 将模板转换为 `EquipmentItem` 对象
 * 3. 装备到槽位后，包裹为 `EquippedItem`（含装备时间戳）写入 Store
 * 4. 持久化时仅存装备 ID 映射到 `char_equipment` 表
 *
 * @property {EquipmentType} type - 装备类型（weapon 或 armor，决定可放入的槽位组）
 * @property {EquipmentSlot[]} slots - 可装备的槽位列表。如仅限主手的武器填 `['weapon1']`，双持武器填 `['weapon1', 'weapon2']`
 * @property {Partial<Stats>} [bonus] - 属性加成，键为 Stats 的字段名（str/dex/con/int/wis/cha）。如 `{ str: 5, con: 3 }` 表示 +5 力量、+3 体质
 * @property {number} [levelRequirement] - 最低装备等级。不填或 undefined 表示无等级限制
 *
 * @see EquipmentTemplateStorage 数据库模板对应的存储类型
 * @see mapTemplateToEquipmentItem 模板 → 运行时对象的转换逻辑
 */
export interface EquipmentItem extends Item {
  type: EquipmentType;
  slots: EquipmentSlot[];
  bonus?: Partial<Stats>;
  levelRequirement?: number;
}

/**
 * 已装备物品接口
 *
 * 将装备模板（`EquipmentItem`）与装备时间戳绑定，
 * 用于 Store 的装备状态中记录"哪个槽位装着哪件装备、何时装备的"。
 *
 * `equippedAt` 时间戳目前用于：
 * - 装备面板中展示"装备于 XX 时间"
 * - 将来可扩展装备升级/耐久度等时间相关功能
 *
 * @property {EquipmentItem} item - 被装备的物品模板（指向 equipmentTemplates Map 中的条目）
 * @property {number} equippedAt - 装备时的 Unix 时间戳（毫秒）
 *
 * @see useEquipmentStore.equipment 记录每个槽位的 EquippedItem | null
 */
export interface EquippedItem {
  item: EquipmentItem;
  equippedAt: number;
}

// ============================================================================
// 运行时状态接口
// ============================================================================

/**
 * 装备状态接口（存档用）
 *
 * 记录角色当前所有槽位的装备情况，作为角色状态快照的一部分存入存档系统。
 * 注意：此接口存储的是 `EquippedItem` 对象（含完整装备数据 + 时间戳），
 * 而 `EquipmentDataStorage` 仅存装备 ID 映射（更轻量，用于日常数据库操作）。
 *
 * @property {Record<EquipmentSlot, EquippedItem | null>} equipment - 装备记录。键为槽位名，值为已装备物品或 null（空槽）
 *
 * @see EquipmentDataStorage char_equipment 表的轻量存储格式（仅存 ID）
 * @see EquipmentState 存档系统中的角色快照使用此接口
 */
export interface EquipmentState {
  equipment: Record<EquipmentSlot, EquippedItem | null>;
}

// ============================================================================
// 存储/持久化接口
// ============================================================================

/**
 * 装备数据行存储接口（char_equipment 表）
 *
 * 以角色 ID 为主键，equipment 字段仅存装备 ID 映射（而非完整数据），
 * 完整装备属性通过 `config_equipmentItems` 模板表按 ID 查询获得。
 *
 * 设计原则（数据规范化）：
 * - 避免数据冗余：同一装备的配置信息仅在 `config_equipmentItems` 表中存储一份
 * - 兼容性：模板更新后，所有角色的装备属性自动同步
 * - 存储效率：char_equipment 表仅存 6 个字符串键值对，而非 6 个完整对象
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
  equipment: Record<EquipmentSlot, string | null>;
  updatedAt: number;
}

/**
 * 装备模板存储接口（config_equipmentItems 表）
 *
 * 装备的完整属性定义，以装备 ID 为主键。
 * 与 char_equipment 表配合使用：char_equipment 存 ID 引用，此处存完整定义。
 *
 * 与 `EquipmentItem` 接口的区别：
 * - `EquipmentTemplateStorage`：数据库存储层，`bonus` 为 `Record<string, number>` 便于 IndexedDB 序列化
 * - `EquipmentItem`：运行时对象，`bonus` 为 `Partial<Stats>`，提供更好的字段智能提示和类型安全
 *
 * 通过 `mapTemplateToEquipmentItem()` 方法将存储格式转换为运行时 `EquipmentItem` 对象。
 *
 * @property {string} id - 装备唯一标识
 * @property {string} name - 装备名称
 * @property {string} type - 装备类型（"weapon" | "armor"，存储为 string）
 * @property {string} rarity - 稀有度（"common" | "uncommon" | "rare" | "epic" | "legendary"，继承自 Item）
 * @property {string} icon - 装备图标（Iconify 格式，如 `game-icons:broadsword`）
 * @property {string} description - 装备描述文本
 * @property {Record<string, number>} bonus - 属性加成（存储为通用 Record，运行时映射为 Partial<Stats>）
 * @property {number} value - 装备价值（金币）
 * @property {EquipmentSlot[]} slots - 可装备的槽位列表
 * @property {number | null} levelRequirement - 最低装备等级（null = 无限制）
 * @property {boolean} stackable - 是否可堆叠
 * @property {string} template - 模板标识
 * @property {object} [effect] - 装备使用效果（仅部分装备包含，如药水、卷轴等消耗品）
 * @property {boolean} [consumable] - 是否为消耗品（仅部分装备包含）
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
  slots: EquipmentSlot[];
  levelRequirement: number | null;
  stackable: boolean;
  template: string;
  effect?: { type: string; value: number | Partial<Record<string, number>> } | null;
  consumable?: boolean;
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
 * equipment 字段仅存装备 ID，导入时需配合 `config_equipmentItems` 模板表解析为完整装备对象。
 *
 * @property {string} characterId - 角色 ID
 * @property {Record<EquipmentSlot, string | null>} equipment - 装备 ID 映射。导入时若缺少某些槽位的键，Store 层会使用 getDefaultEquipment() 补齐
 * @property {number} [updatedAt] - 更新时间戳（可选，导入时不强制要求）
 *
 * @see data/service.ts 导入/导出功能使用此接口进行 JSON 序列化
 */
export interface EquipmentStorage {
  characterId: string;
  equipment: Record<EquipmentSlot, string | null>;
  updatedAt?: number;
}
