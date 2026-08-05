/**
 * @fileoverview 能力组合模型类型层（Capability Composition Model）
 * @description
 *   物品系统升级（plan.md §3.2）的能力层类型定义。能力组合模型用"物品能做什么"
 *   替代"物品是什么类型"作为行为归属维度：物品通过 `capabilities: Capability[]`
 *   声明一组能力标签，调用方按能力查询分发（`getCapability`），而非按 `kind` switch。
 *
 *   与判别联合的关系（正交）：
 *   - `kind`/`subtype`（item/types.ts）：数据形状维度，编译期收窄字段访问
 *   - `capabilities`（本文件）：行为归属维度，运行期查询行为处理器
 *   一个物品可挂多个能力（复合物品，如魔法武器 = equippable + usable），
 *   能力处理器内部仍可按 kind 收窄访问专有字段，但分发轴是能力，不泄漏到调用方。
 *
 *   阶段定位：C1（纯新增）。本文件只定义类型，不改任何分发逻辑。
 *   C2 改造 describeItem/usePlayerItem/equipItem 等入口从 kind 判断改为 getCapability 查询。
 *
 *   设计原则（plan.md §3.2）：
 *   - 能力是"行为维度"，与 kind（数据维度）正交
 *   - 一个物品可挂多个能力（复合物品）
 *   - `capabilities` 为必填字段，配置层显式声明，无派生兜底（plan.md 前提）
 *
 * @module item
 */
import type { Stats } from '../character/types';
import type {
  Item,
  MaterialItem,
  EquipmentItem,
  EquipmentSlot,
  EquipmentState,
  ItemEffect,
} from './types';

// ============================================================================
// 能力标签联合
// ============================================================================

/**
 * 能力标签枚举
 *
 * 每个标签对应一组行为处理器（见 CAPABILITY_REGISTRY）。物品通过
 * `capabilities: Capability[]` 声明其能力组合。
 *
 * 标签分两类：
 * 1. **带处理器的能力**：有对应 Handler 接口与注册项，调用方通过 `getCapability` 取处理器执行
 *    - describable / usable / equippable / deconstructable / enchantable / sellable / setMember
 * 2. **纯声明标签**：无处理器，仅作为可查询的属性标志（`hasCapability` 判断）
 *    - stackable / tradable / usable_in_combat
 *
 * 新增能力只需：扩展此联合 + 定义 Handler 接口（若有）+ 在 CAPABILITY_REGISTRY 注册处理器（若有）。
 */
export type Capability =
  | 'describable' // 可描述（所有物品都有，收口 describeItem）
  | 'usable' // 可使用（药水/食物/卷轴/魔法武器主动技能）
  | 'equippable' // 可装备（武器/护甲/饰品）
  | 'stackable' // 可堆叠（材料/消耗品，纯声明标签）
  | 'sellable' // 可出售（多数物品，任务物品不可）
  | 'deconstructable' // 可分解（装备→材料）
  | 'enchantable' // 可附魔（装备镶嵌宝石/附魔）
  | 'setMember' // 套装成员（计入套装进度）
  | 'usable_in_combat' // 可在战斗中使用（与 usable 区分：战斗内/外，纯声明标签）
  | 'tradable'; // 可交易（与 sellable 区分：玩家间/商店，纯声明标签）

// ============================================================================
// 行为校验结果
// ============================================================================

/**
 * 行为校验结果（canUse / canEquip / canSell 等通用返回形状）
 *
 * @property ok - 是否允许执行
 * @property reason - 不允许时的原因（UI 提示用），允许时为空串
 */
export interface CapabilityCheckResult {
  ok: boolean;
  reason: string;
}

// ============================================================================
// 辅助上下文/结果类型（C1 占位，C2 接入真实流程时按需收窄/扩展）
// ============================================================================

/**
 * 使用物品的运行期上下文
 *
 * C1 占位定义：仅声明最小字段供 UsableHandler 类型闭合。
 * C2 改造 usePlayerItem 时，会按真实调用点（战斗内/背包内）收窄或扩展此类型，
 * 届时同步更新本接口与处理器实现。
 *
 * @property characterId - 使用物品的角色 ID
 */
export interface UseContext {
  readonly characterId: string;
}

/**
 * 使用物品的结果
 *
 * C1 占位定义。C2 接入时按真实效果应用流程扩展（如 appliedEffects / consumed 等）。
 *
 * @property ok - 是否成功使用
 * @property reason - 失败原因（成功时为空串）
 * @property appliedEffects - 实际生效的效果列表（成功时填充）
 */
export interface UseResult {
  ok: boolean;
  reason: string;
  appliedEffects: ItemEffect[];
}

/**
 * 装备意图（equippable.equip 返回）
 *
 * 装备的副作用（锁定副手槽、写入 equipmentState）由 store 层应用，
 * 处理器只返回"想装到哪个槽、占哪些槽"的意图，保持处理器无副作用。
 *
 * @property item - 被装备的物品
 * @property slot - 目标槽位
 * @property occupies - 实际占用槽位（双手武器占主+副两槽）
 */
export interface EquipIntent {
  item: EquipmentItem;
  slot: EquipmentSlot;
  occupies: EquipmentSlot[];
}

/**
 * 卸装意图（equippable.unequip 返回）
 *
 * @property slot - 被卸下的槽位
 */
export interface UnequipIntent {
  slot: EquipmentSlot;
}

/**
 * 附魔规格（enchantable.enchant 入参）
 *
 * C1 占位定义。C3 实现附魔卷轴镶嵌时按真实附魔数据结构扩展。
 *
 * @property type - 附魔类型标识
 * @property value - 附魔数值（数值类型为 number，属性加成为 Partial<Stats>）
 */
export interface EnchantSpec {
  type: string;
  value: number | Partial<Stats>;
}

// ============================================================================
// 能力处理器接口
// ============================================================================

/**
 * 可描述能力处理器（所有物品默认具备）
 *
 * C1 占位：describe 在 C2 由 describeItem 改造时填充真实逻辑（按能力查询分发）。
 */
export interface DescribableHandler {
  /** 描述物品为多行文本 */
  describe(item: Item): string[];
}

/**
 * 可使用能力处理器
 *
 * C1 占位：use/canUse 在 C2 改造 usePlayerItem 时接入真实逻辑。
 */
export interface UsableHandler {
  /** 执行使用 */
  use(item: Item, ctx: UseContext): UseResult;
  /** 是否可使用（运行期校验，如等级/冷却/战斗状态） */
  canUse(item: Item, ctx: UseContext): CapabilityCheckResult;
}

/**
 * 可装备能力处理器
 *
 * C1 占位：canEquip/equip/unequip 在 C2 改造 equipItem 时接入真实逻辑。
 * 处理器内部复用 slotRegistry 的 SUBTYPE_SLOTS/canEquip 约束。
 */
export interface EquippableHandler {
  /** 是否可装备到目标槽位（校验 subtype 槽位约束 / 职业限制 / 等级） */
  canEquip(
    item: Item,
    equipment: EquipmentState,
    targetSlot: EquipmentSlot
  ): CapabilityCheckResult;
  /**
   * 装备意图（不直接改状态，由 store 层应用）
   * 装备时触发的副作用（如锁定副手槽）由 store 层处理，此处只返回意图
   */
  equip(item: Item, targetSlot: EquipmentSlot): EquipIntent;
  /** 卸装意图 */
  unequip(slot: EquipmentSlot): UnequipIntent;
}

/**
 * 可分解能力处理器
 *
 * C1 占位：未来按需注册（plan.md §3.3）。
 */
export interface DeconstructableHandler {
  canDeconstruct(item: Item): CapabilityCheckResult;
  deconstruct(item: Item): MaterialItem[];
}

/**
 * 可附魔能力处理器
 *
 * C1 占位：C3 实现附魔卷轴镶嵌时注册。
 */
export interface EnchantableHandler {
  canEnchant(item: Item, enchant: EnchantSpec): CapabilityCheckResult;
  /** 返回附魔后的新物品（不改原物品） */
  enchant(item: Item, enchant: EnchantSpec): Item;
}

/**
 * 可出售能力处理器
 *
 * C1 占位：canSell/getSellPrice 在 C2 改造 sellItem 时接入真实逻辑。
 */
export interface SellableHandler {
  canSell(item: Item): CapabilityCheckResult;
  /** 按 stackCount 计算出售总价 */
  getSellPrice(item: Item, stackCount: number): number;
}

/**
 * 套装成员能力处理器
 *
 * C1 占位：getSetId 在 C2 改造套装进度计算时接入。
 */
export interface SetMemberHandler {
  /** 返回所属套装 ID，非套装成员返回 null */
  getSetId(item: Item): string | null;
}

// ============================================================================
// Capability → Handler 映射类型
// ============================================================================

/**
 * Capability → Handler 接口的条件映射类型
 *
 * 供 `getCapability<K>` 的返回类型推导使用：
 * - 带处理器的能力 → 对应 Handler 接口
 * - 纯声明标签（stackable / tradable / usable_in_combat）→ `undefined`
 *   （这些标签无处理器，`getCapability` 对其恒返回 undefined，调用方用 `hasCapability` 判断）
 */
export type CapabilityHandler<K extends Capability> =
  K extends 'describable'
    ? DescribableHandler
    : K extends 'usable'
      ? UsableHandler
      : K extends 'equippable'
        ? EquippableHandler
        : K extends 'deconstructable'
          ? DeconstructableHandler
          : K extends 'enchantable'
            ? EnchantableHandler
            : K extends 'sellable'
              ? SellableHandler
              : K extends 'setMember'
                ? SetMemberHandler
                : undefined;
