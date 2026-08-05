/**
 * @fileoverview 物品模块类型定义
 * @description 包含物品基础类型、背包物品、物品效果、排序筛选等相关类型定义。
 *
 * 本文件是物品相关类型定义的唯一来源，配置层（@/config/inventory）从这里导入类型。
 * 存储类型（ItemDataStorage / ItemStorage / InventoryStorage）的职责划分：
 *   - ItemDataStorage：从 IndexedDB 读取物品模板时的原始数据形状（宽松类型，字段名与 DB 列一致）
 *   - ItemStorage：写入 IndexedDB 时的数据类型（用于引用其字段类型进行类型断言）
 *   - InventoryStorage：导入/导出存档时背包数据的序列化格式
 */
import type { ItemKind, ItemRarity } from '../item/types';

// ==================== 共享类型 re-export（P3.3：从 item/types 迁移） ====================
// P3.3 类型覆盖：旧扁平 Item/ItemType 已删除，统一使用 item/types.ts 的判别联合。
// ItemRarity/ItemEffectType/ItemEffect 的定义已迁移到 item/types.ts（消除循环依赖），
// 此处 re-export 保持消费方导入路径不变。
export type {
  Item,
  ItemKind,
  ItemBase,
  ConsumableItem,
  ConsumableSubtype,
  ConsumableUseMode,
  MaterialItem,
  CurrencyItem,
  CurrencySubtype,
  QuestItem,
  EquipmentItem,
  EquipmentSubtype,
  WeaponSubtype,
  ArmorSubtype,
  WeaponGrip,
  EquipmentSlot,
  EquippedItem,
  EquipmentState,
  ItemRarity,
  ItemEffectType,
  ItemEffect,
} from '../item/types';

// ==================== 基础类型定义 ====================

/**
 * 旧版物品大类扁平联合（@deprecated P3.3 过渡类型，P3.3b 删除）
 *
 * 新代码应使用 {@link ItemKind} + `subtype` 表达物品分类。
 * 本类型仅保留供 `config/inventory.ts` 的 `ITEM_TYPES` 配置表与既有测试过渡使用，
 * 不再作为 `Item` 的字段类型（新 `Item` 判别联合无 `type` 字段）。
 */
export type ItemType =
  | 'gold'
  | 'potion'
  | 'scroll'
  | 'food'
  | 'material'
  | 'quest'
  | 'weapon'
  | 'armor'
  | 'misc';

/**
 * 旧版物品类型元数据（@deprecated P3.3 过渡类型，P3.3b 删除）
 *
 * 新代码应使用 `item/typeRegistry.ts` 的 `ItemTypeMeta`（单一来源）。
 * 本接口仅保留供 `ITEM_TYPES` 配置表过渡使用。
 */
export interface ItemTypeData {
  id: string;
  name: string;
  stackable: boolean;
  maxStack: number;
  usable?: boolean;
}

/**
 * 稀有度配置（UI 展示用）
 * @property {string} name - 稀有度显示名称
 * @property {string} color - 稀有度对应颜色（CSS 颜色值）
 */
export interface RarityConfig {
  name: string;
  color: string;
}

/**
 * 背包槽位物品
 *
 * 背包中每个槽位的存储格式。注意这里只存储 itemId 和数量，
 * 物品名称、图标等完整信息通过 itemTemplates（Map<itemId, Item>）查询。
 * 这种设计避免了数据冗余，背包本身只记录"哪个物品、多少数量"。
 *
 * @property {string} itemId - 物品 ID（关联到 Item 模板）
 * @property {number} count - 当前槽位的物品数量
 */
export interface InventoryItem {
  itemId: string;
  count: number;
}

/**
 * 排序字段类型
 * - kind: 按物品大类（判别字段，P3.3 替代旧 type）
 * - rarity: 按稀有度（common=0 → legendary=4）
 * - level: 按物品等级
 * - name: 按物品名称（中文拼音排序）
 */
export type SortField = 'kind' | 'rarity' | 'level' | 'name';

/**
 * 排序顺序类型
 * - asc: 升序（从小到大）
 * - desc: 降序（从大到小）
 */
export type SortOrder = 'asc' | 'desc';

/**
 * 物品筛选条件
 *
 * 所有字段均为可选，未设置的条件不做过滤。
 * 多个条件之间为 AND 关系（同时满足）。
 *
 * P3.3：`types` 改为 `kinds`（按判别字段 ItemKind 筛选，替代旧 ItemType）。
 *
 * @property {ItemKind[]} [kinds] - 要显示的大类列表
 * @property {ItemRarity[]} [rarities] - 要显示的稀有度列表
 * @property {boolean} [stackable] - 是否只显示可/不可堆叠物品
 */
export interface ItemFilters {
  kinds?: ItemKind[];
  rarities?: ItemRarity[];
  stackable?: boolean;
}

// ==================== 存储格式定义 ====================

/**
 * 背包数据存储结构（IndexedDB char_inventory 表）
 *
 * 以角色 ID 为 key，items 以原生数组存储（非 JSON 字符串），
 * 避免每次读写都需要 JSON 序列化/反序列化。
 *
 * @property {string} characterId - 角色 ID（主键）
 * @property {InventoryItem[]} items - 背包物品列表（原生数组）
 * @property {number} updatedAt - 最后更新时间戳
 */
export interface InventoryDataStorage {
  characterId: string;
  /** 背包物品列表（原生数组，非 JSON 字符串） */
  items: InventoryItem[];
  updatedAt: number;
}

/**
 * 物品模板 DB 读取格式（IndexedDB config_items 表读取时的形状）
 *
 * 与 ItemStorage 的区别：此接口字段类型更宽松（string 而非具体联合类型），
 * 因为 Dexie 从 IndexedDB 读取时不保证类型精确性，需要在 mapToItem() 中显式转换。
 *
 * @property {string} id - 物品 ID
 * @property {string} name - 物品名称
 * @property {string} type - 物品类型（DB 存为字符串）
 * @property {string} rarity - 稀有度（DB 存为字符串）
 * @property {number} [level] - 物品等级
 * @property {string} icon - 图标 ID
 * @property {string} description - 描述
 * @property {Record<string, number>} bonus - 属性加成（DB 存为普通对象）
 * @property {Record<string, unknown> | null} effect - 物品效果（DB 存为普通对象）
 * @property {number} value - 价值
 * @property {boolean} stackable - 是否可堆叠
 * @property {boolean} consumable - 是否为消耗品
 * @property {string | null} template - 模板 ID
 * @property {number | null} [levelRequirement] - 等级要求
 */
export interface ItemDataStorage {
  id: string;
  name: string;
  type: string;
  rarity: string;
  level?: number;
  icon: string;
  description: string;
  bonus: Record<string, number>;
  effect: Record<string, unknown> | null;
  value: number;
  stackable: boolean;
  consumable: boolean;
  template: string | null;
  levelRequirement?: number | null;
}

/**
 * 物品模板 DB 写入格式（IndexedDB config_items 表写入时的契约）
 *
 * 与 ItemDataStorage 同为存储类型但职责不同：
 * - ItemDataStorage：读取形状（宽松，字段类型为 string/null）
 * - ItemStorage：写入契约（精确，字段类型与 put() 调用对齐）
 *
 * saveItemTemplate 按此接口构造 put 对象，确保写入 DB 的数据满足 Dexie 类型约束。
 *
 * @property {string} id - 物品唯一标识
 * @property {string} name - 物品名称
 * @property {string} type - 物品类型（ItemType 的字符串形式）
 * @property {string} rarity - 稀有度（ItemRarity 的字符串形式）
 * @property {string} icon - 物品图标 ID
 * @property {string} description - 物品描述文本
 * @property {Partial<Record<string, number>>} [bonus] - 属性加成（键值对，空对象表示无加成）
 * @property {{ type: string; value: number | Partial<Record<string, number>> } | null} [effect] - 物品效果，无效果时为 null
 * @property {number} value - 物品售价/价值
 * @property {boolean} stackable - 是否可堆叠
 * @property {boolean} [consumable] - 是否为消耗品
 * @property {string | null} [template] - 来源模板 ID，非模板物品为 null
 * @property {number | null} [levelRequirement] - 使用/装备所需的角色等级，无要求时为 null
 * @property {number} [level] - 物品自身等级
 */
export interface ItemStorage {
  id: string;
  name: string;
  type: string;
  rarity: string;
  icon: string;
  description: string;
  bonus?: Partial<Record<string, number>>;
  effect?: { type: string; value: number | Partial<Record<string, number>> } | null;
  value: number;
  stackable: boolean;
  consumable?: boolean;
  template?: string | null;
  levelRequirement?: number | null;
  level?: number;
}

/**
 * 背包存档导入/导出格式
 *
 * 用于 data/service.ts 的存档导入导出流程。
 * 字段与 InventoryDataStorage 对齐，但通过此独立类型解耦存档格式与 DB 存储格式。
 *
 * @property {string} characterId - 角色 ID
 * @property {Array<{ itemId: string; count: number }>} items - 物品列表
 * @property {number} [updatedAt] - 时间戳（导入时可选）
 */
export interface InventoryStorage {
  characterId: string;
  items: Array<{ itemId: string; count: number }>;
  updatedAt?: number;
}
