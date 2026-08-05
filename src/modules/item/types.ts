/**
 * @fileoverview 统一物品类型层（判别联合）
 * @description
 *   物品系统升级（plan.md §3.2）的全新类型层。采用判别联合（Discriminated Union）
 *   替代旧版扁平接口继承，以 `kind` 作为判别字段，每个物品类别独立定义专有字段。
 *
 *   阶段定位：P1（纯新增）。本文件不替换 inventory/types.ts 的旧 `Item` 类型，
 *   旧代码继续使用旧类型；P3 阶段才会用本文件的 `Item` 直接覆盖旧 `Item`。
 *   因此 P1 期间存在两套类型并行：旧 `Item`（inventory/types.ts）与新 `Item`（本文件），
 *   新增的 typeRegistry / descriptors / slotRegistry / setTypes / setService 仅依赖本文件。
 *
 *   设计目标（plan.md §3.1）：
 *   1. 开闭原则：新增物品类型/子类型/效果类型，只新增文件、不改现有 switch/if。
 *   2. 单一数据源：任意物品一次查询即得全部展示信息（含装备专有字段）。
 *   3. 类型安全：判别联合让 TS 编译期收窄，消除运行期误用。
 *
 *   依赖说明：
 *   - `Stats` 复用 character 模块（稳定共享类型）。
 *   - `ItemRarity` / `ItemEffect` / `ItemEffectType` 复用 inventory/types（稳定共享类型），
 *     避免重复定义。P3 迁移时若出现 item ↔ inventory 循环依赖，再将这些共享类型
 *     上提到中性位置（或本文件），届时同步更新导入。
 *
 * @module item
 */
import type { Stats } from '../character/types';
import type { SkillType } from '../skill/types';

// ============================================================================
// 共享基础类型（P3.3 从 inventory/types.ts 迁移至此，消除循环依赖）
// ============================================================================

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
 * 物品效果类型枚举
 *
 * 组合了技能效果类型（SkillType）与物品特有效果（stat），使物品既可造成技能伤害，
 * 也可提供属性加成。
 */
export type ItemEffectType = SkillType | 'stat';

/**
 * 物品效果接口
 *
 * 描述使用物品时触发的效果。
 *
 * @property type - 效果类型，决定 value 的语义
 * @property value - 效果值：数值类型时为 number，属性加成时为 Partial<Stats>
 */
export interface ItemEffect {
  type: ItemEffectType;
  value: number | Partial<Stats>;
}

// ============================================================================
// 物品大类判别字段
// ============================================================================

/**
 * 物品大类判别字段
 *
 * 替代旧版扁平 `ItemType`（gold/potion/scroll/food/material/quest/weapon/armor/misc）。
 * 新版按"行为语义"聚类为 6 个大类，每个大类下再用 `subtype` 表达细分类型：
 * - `consumable`：消耗品（药水/食物/卷轴），可使用，有即时/持续效果
 * - `material`：材料，可堆叠，无使用效果
 * - `equipment`：装备（武器/护甲/饰品），可装备，提供属性加成
 * - `quest`：任务物品，不可堆叠、不可丢弃
 * - `currency`：货币（金币）
 * - `misc`：杂项兜底
 *
 * 新增大类只需扩展此联合 + 在 typeRegistry 注册元数据，无需改动现有 switch/if。
 */
export type ItemKind = 'consumable' | 'material' | 'equipment' | 'quest' | 'currency' | 'misc';

// ============================================================================
// 所有物品共享的基础字段
// ============================================================================

/**
 * 所有物品共享的基础字段
 *
 * 与旧 `Item` 的差异：
 * - 用 `kind`（判别字段）+ `subtype`（细分）替代扁平 `type: ItemType`
 * - 移除 `effect?: ItemEffect`（单效果），改由各子类型用 `effects: ItemEffect[]` 表达多效果
 * - `stackable` / `consumable` 下沉为各子类型的字面量字段，编译期即可约束
 *   （如装备恒为 `stackable: false`，消耗品恒为 `consumable: true`）
 *
 * @property id - 物品唯一标识
 * @property name - 物品显示名称
 * @property icon - 物品图标（Iconify 图标 ID）
 * @property description - 物品描述文本
 * @property rarity - 物品稀有度
 * @property value - 物品售价/价值
 * @property level - 物品自身等级（影响基础数值），可选
 * @property levelRequirement - 使用/装备所需角色等级，可选
 * @property template - 来源模板 ID（动态生成物品时追溯），可选
 */
export interface ItemBase {
  id: string;
  name: string;
  icon: string;
  description: string;
  rarity: ItemRarity;
  value: number;
  level?: number;
  levelRequirement?: number;
  template?: string;
}

// ============================================================================
// 消耗品
// ============================================================================

/**
 * 消耗品子类型
 * - `potion`：药水（含恢复药剂与属性药剂，属性药剂用 effects 的 stat 类型表达）
 * - `food`：食物（通常持续恢复）
 * - `scroll`：卷轴（魔法效果）
 */
export type ConsumableSubtype = 'potion' | 'food' | 'scroll';

/**
 * 消耗品使用模式（扩展点）
 * - `instant`：即时生效（如药水立即恢复）
 * - `over_time`：持续生效（如食物按回合恢复）
 */
export type ConsumableUseMode = 'instant' | 'over_time';

/**
 * 消耗品：药水/食物/卷轴
 *
 * 替代旧版 `effect?: ItemEffect`（单效果），改用 `effects: ItemEffect[]` 支持多效果
 * （如"使用后既回血又回蓝"）。属性药剂不再依赖 `ATTRIBUTE_POTION_IDS` 白名单，
 * 改用 `effects` 中的 `stat` 类型效果表达（plan.md T5/T6 解决）。
 *
 * @property kind - 判别字段，恒为 'consumable'
 * @property subtype - 消耗品子类型
 * @property stackable - 恒为 true（消耗品可堆叠）
 * @property consumable - 恒为 true（使用后消失）
 * @property effects - 使用效果列表（支持多效果）
 * @property useMode - 使用模式（即时/持续）
 * @property maxStack - 最大堆叠数（可选，未指定时由 typeRegistry 默认值决定）
 */
export interface ConsumableItem extends ItemBase {
  kind: 'consumable';
  subtype: ConsumableSubtype;
  stackable: true;
  consumable: true;
  effects: ItemEffect[];
  useMode: ConsumableUseMode;
  maxStack?: number;
}

// ============================================================================
// 材料
// ============================================================================

/**
 * 材料：可堆叠，无使用效果
 *
 * @property kind - 判别字段，恒为 'material'
 * @property stackable - 恒为 true
 * @property consumable - 恒为 false
 * @property effects - 恒为空数组（材料无使用效果）
 * @property maxStack - 最大堆叠数（可选，默认由 typeRegistry 决定，通常 99）
 */
export interface MaterialItem extends ItemBase {
  kind: 'material';
  stackable: true;
  consumable: false;
  effects: [];
  maxStack?: number;
}

// ============================================================================
// 货币
// ============================================================================

/**
 * 货币子类型
 * - `gold`：金币
 */
export type CurrencySubtype = 'gold';

/**
 * 货币：不可堆叠（直接累加到角色金币），不可使用
 *
 * @property kind - 判别字段，恒为 'currency'
 * @property subtype - 货币子类型
 * @property stackable - 恒为 false（货币按数量累加，不占用堆叠槽）
 * @property consumable - 恒为 false
 */
export interface CurrencyItem extends ItemBase {
  kind: 'currency';
  subtype: CurrencySubtype;
  stackable: false;
  consumable: false;
}

// ============================================================================
// 任务物品
// ============================================================================

/**
 * 任务物品：不可堆叠、不可丢弃
 *
 * @property kind - 判别字段，恒为 'quest'
 * @property stackable - 恒为 false
 * @property consumable - 恒为 false
 * @property effects - 恒为空数组
 */
export interface QuestItem extends ItemBase {
  kind: 'quest';
  stackable: false;
  consumable: false;
  effects: [];
}

// ============================================================================
// 装备：槽位、握持方式、子类型
// ============================================================================

/**
 * 装备槽位（7 槽：武器 2 + 护甲 5 部位）
 *
 * 替代旧版 6 槽（weapon1/weapon2/armor1-4）。护甲由 4 个通用槽升级为 5 个部位槽，
 * 一部位一子类型，强约束（手套装头部等 bug 从类型层消除）。
 *
 * - `weapon1`：主手武器槽
 * - `weapon2`：副手武器槽（盾牌/副手武器/被双手武器占用）
 * - `helm`：头盔
 * - `chest`：护甲（胸甲）
 * - `gloves`：手套
 * - `legs`：裤子
 * - `boots`：鞋子
 *
 * 阶段定位：P1 期间与旧 `EquipmentSlot`（equipment/types.ts，6 槽）并行存在，
 * 新增的 slotRegistry/setTypes/setService 仅依赖本类型；P3 用本类型覆盖旧 `EquipmentSlot`。
 */
export type EquipmentSlot =
  | 'weapon1'
  | 'weapon2'
  | 'helm'
  | 'chest'
  | 'gloves'
  | 'legs'
  | 'boots';

/**
 * 武器握持方式：决定槽位占用规则
 * - `one_handed`：单手，可装主手或副手
 * - `off_hand`：副手，只能装副手（盾牌/副手匕首）
 * - `two_handed`：双手，装主手但占用主+副两槽
 */
export type WeaponGrip = 'one_handed' | 'off_hand' | 'two_handed';

/**
 * 武器子类型
 *
 * 按握持方式分组，与 `WeaponGrip` 一一对应：
 * - 单手武器（grip: 'one_handed'）：剑/斧/锤/匕首/法杖
 * - 副手武器（grip: 'off_hand'）：盾牌/副手匕首
 * - 双手武器（grip: 'two_handed'）：双手剑/双手斧/长弓/双手法杖
 */
export type WeaponSubtype =
  | 'sword'
  | 'axe'
  | 'hammer'
  | 'dagger'
  | 'staff'
  | 'shield'
  | 'off_dagger'
  | 'greatsword'
  | 'greataxe'
  | 'greatbow'
  | 'greatstaff';

/**
 * 护甲子类型：与 5 个护甲槽位一一对应
 */
export type ArmorSubtype = 'helm' | 'chest' | 'gloves' | 'legs' | 'boots';

/**
 * 装备子类型 = 武器子类型 ∪ 护甲子类型
 *
 * 饰品（戒指等）后续追加时扩展此联合，并扩充 SUBTYPE_SLOTS 映射。
 */
export type EquipmentSubtype = WeaponSubtype | ArmorSubtype;

/**
 * 装备：按子类型声明槽位约束与专有字段
 *
 * 替代旧版 `EquipmentItem extends Item`（字段叠加，非多态）。判别联合使
 * `if (item.kind === 'equipment')` 后 TS 自动收窄，可安全访问 `slots`/`bonus`/`grip` 等，
 * 消除旧版"统一 Map 视图中装备退化为普通 Item"的双源数据问题（plan.md T3）。
 *
 * `slots` / `occupies` 不再手填，由 `subtype` + `grip` 经 slotRegistry 的
 * `SUBTYPE_SLOTS` / `SUBTYPE_OCCUPIES` 派生（plan.md §3.8）。
 *
 * @property kind - 判别字段，恒为 'equipment'
 * @property subtype - 装备子类型（武器/护甲细分）
 * @property grip - 武器握持方式（仅武器需要，护甲无此字段）
 * @property stackable - 恒为 false（装备不可堆叠）
 * @property consumable - 恒为 false
 * @property bonus - 属性加成
 * @property slots - 可装备的目标槽位候选（由 subtype 派生）
 * @property occupies - 实际占用槽位（双手武器占 2 个，单手装哪占哪）
 * @property classRestriction - 可装备的职业 ID 列表（可选）
 * @property setId - 所属套装 ID（可选）
 * @property effects - 装备触发的被动/使用效果（扩展点，可选）
 */
export interface EquipmentItem extends ItemBase {
  kind: 'equipment';
  subtype: EquipmentSubtype;
  grip?: WeaponGrip;
  stackable: false;
  consumable: false;
  bonus: Partial<Stats>;
  slots: EquipmentSlot[];
  occupies: EquipmentSlot[];
  classRestriction?: string[];
  setId?: string;
  effects?: ItemEffect[];
}

// ============================================================================
// 统一物品类型 = 判别联合
// ============================================================================

/**
 * 统一物品类型（判别联合）
 *
 * 以 `kind` 为判别字段。消费方通过 `item.kind === 'equipment'` 等窄化分支，
 * 即可安全访问对应子类型的专有字段，编译期捕获误用。
 *
 * 新增物品大类：扩展此联合 + 新增对应接口 + 在 typeRegistry 注册元数据。
 */
export type Item =
  | ConsumableItem
  | MaterialItem
  | CurrencyItem
  | QuestItem
  | EquipmentItem;

// ============================================================================
// 已装备物品（运行时）
// ============================================================================

/**
 * 已装备物品接口（新槽位体系）
 *
 * 将装备模板与装备时间戳绑定，记录"哪个槽位装着哪件装备、何时装备的"。
 *
 * 阶段定位：P1 期间与旧 `EquippedItem`（equipment/types.ts，引用旧 EquipmentItem）并行。
 * 新增的 slotRegistry/setService 仅依赖本类型；P3 用本类型覆盖旧 `EquippedItem`。
 *
 * @property item - 被装备的物品模板（新 EquipmentItem）
 * @property equippedAt - 装备时的 Unix 时间戳（毫秒）
 */
export interface EquippedItem {
  item: EquipmentItem;
  equippedAt: number;
}

/**
 * 装备状态：槽位 → 已装备物品（或空槽）
 *
 * `Record<EquipmentSlot, EquippedItem | null>` 的语义别名，供 slotRegistry/setService 使用。
 */
export type EquipmentState = Record<EquipmentSlot, EquippedItem | null>;

// ============================================================================
// 类型守卫
// ============================================================================

/**
 * 判断物品是否为装备
 *
 * 替代旧版 `isEquipment(type)` 硬编码 `type === 'weapon' || type === 'armor'`。
 * 新版基于判别字段 `kind`，无需维护类型字符串列表（plan.md U2/2.2 第 4 步）。
 */
export function isEquipment(item: Item): item is EquipmentItem {
  return item.kind === 'equipment';
}

/**
 * 判断物品是否为消耗品
 */
export function isConsumable(item: Item): item is ConsumableItem {
  return item.kind === 'consumable';
}

/**
 * 判断装备是否为双手武器（占用主+副两槽）
 */
export function isTwoHanded(item: EquipmentItem): boolean {
  return item.grip === 'two_handed';
}
