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
import type { Stats } from '../character/types';
import type { SkillType } from '../skill/types';

// ==================== 基础类型定义 ====================

/**
 * 物品类型枚举
 * - gold: 货币（不可堆叠，直接累加到角色金币）
 * - potion: 药水（消耗品，提供即时效果）
 * - scroll: 卷轴（消耗品，提供魔法效果）
 * - food: 食物（消耗品，提供持续效果）
 * - material: 材料（可堆叠，用于合成/任务）
 * - quest: 任务物品（不可堆叠、不可丢弃）
 * - weapon: 武器（可装备，提供攻击加成）
 * - armor: 护甲（可装备，提供防御加成）
 * - misc: 杂项（兜底类型，不可分类物品）
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
 * 物品稀有度枚举
 * - common: 普通（灰色品质）
 * - uncommon: 优秀（绿色品质）
 * - rare: 稀有（蓝色品质）
 * - epic: 史诗（紫色品质）
 * - legendary: 传说（橙色品质）
 */
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/**
 * 物品类型元数据（用于配置表，描述每种 ItemType 的行为特征）
 * @property {ItemType} id - 物品类型标识
 * @property {string} name - 显示名称
 * @property {boolean} stackable - 此类型物品默认是否可堆叠
 * @property {number} maxStack - 此类型物品的最大堆叠数
 * @property {boolean} [usable] - 此类型物品是否可被角色使用
 */
export interface ItemTypeData {
  id: ItemType;
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
 * 物品效果类型枚举
 *
 * 组合了技能效果类型（SkillType）与物品特有效果（stat），使物品既可造成技能伤害，
 * 也可提供属性加成。当前支持的效果类型包括：
 * - physical_damage: 物理伤害
 * - magic_damage: 法术伤害
 * - health_restore: 生命恢复
 * - mana_restore: 法力恢复
 * - stat: 属性加成（通过 bonus 字段生效）
 */
export type ItemEffectType = SkillType | 'stat';

/**
 * 物品效果接口
 *
 * 描述使用物品时触发的效果。effect 与 bonus 是独立字段：
 * - effect 描述"使用物品时发生什么"（恢复/伤害等即时效果）
 * - bonus 描述"物品提供的属性加成"（可独立存在，允许纯属性加成物品如属性药水）
 *
 * @property {ItemEffectType} type - 效果类型，决定 value 的语义
 * @property {number | Partial<Stats>} value - 效果值：
 *   - 当 type 为 health_restore / mana_restore / physical_damage / magic_damage 时，value 为数值
 *   - 当 type 为 stat 时，value 为属性加成对象
 */
export interface ItemEffect {
  type: ItemEffectType;
  value: number | Partial<Stats>;
}

/**
 * 物品基础类型接口
 *
 * 每个物品实例的完整数据模型。注意以下字段的语义区别：
 * - level：物品本身的等级（影响基础属性数值），如"等级 5 的回复药水"
 * - levelRequirement：使用/装备此物品所需的角色等级，如"需要角色等级 10"
 * - template：模板 ID（用于动态生成物品时追溯其来源模板）
 *
 * @property {string} id - 物品唯一标识
 * @property {string} name - 物品名称
 * @property {ItemType} type - 物品类型
 * @property {ItemRarity} rarity - 物品稀有度
 * @property {string} icon - 物品图标（Iconify 图标 ID）
 * @property {string} description - 物品描述文本
 * @property {Partial<Stats>} [bonus] - 属性加成（装备/使用后生效）
 * @property {ItemEffect} [effect] - 使用效果（消耗品才需要）
 * @property {number} value - 物品售价/价值
 * @property {boolean} stackable - 是否可堆叠（同一 itemId 的物品可放入同一槽位）
 * @property {boolean} [consumable] - 是否为消耗品（使用后消失）
 * @property {string} [template] - 来源模板 ID（动态生成物品时使用）
 * @property {number} [levelRequirement] - 使用/装备所需的角色等级
 * @property {number} [level] - 物品自身等级
 */
export interface Item {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  icon: string;
  description: string;
  bonus?: Partial<Stats>;
  effect?: ItemEffect;
  value: number;
  stackable: boolean;
  consumable?: boolean;
  template?: string;
  levelRequirement?: number;
  level?: number;
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
 * - type: 按物品类型（中文名称拼音排序）
 * - rarity: 按稀有度（common=0 → legendary=4）
 * - level: 按物品等级
 * - name: 按物品名称（中文拼音排序）
 */
export type SortField = 'type' | 'rarity' | 'level' | 'name';

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
 * @property {ItemType[]} [types] - 要显示的类型列表
 * @property {ItemRarity[]} [rarities] - 要显示的稀有度列表
 * @property {boolean} [stackable] - 是否只显示可/不可堆叠物品
 */
export interface ItemFilters {
  types?: ItemType[];
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
