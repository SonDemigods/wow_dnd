/**
 * @fileoverview 能力处理器注册表与查询入口（Capability Composition Model）
 * @description
 *   物品系统升级（plan.md §3.3）的能力处理器注册表。按 capability 聚合处理器实例，
 *   调用方通过 `getCapability(item, cap)` 取处理器执行，替代 `if (item.kind === ...)` 硬编码。
 *
 *   C2 完成后的架构模式：
 *   - **分发轴**：调用方用 `hasCapability(item, cap)` 做能力查询分发（describeItem /
 *     usePlayerItem / equipItem 等入口已改为能力查询 + kind 收窄）。
 *   - **业务逻辑**：实际校验与执行仍在 service 层（descriptors.ts / inventory/service.ts /
 *     equipment/service.ts），处理器不承担业务逻辑。
 *   - **处理器角色**：注册的占位处理器仅用于类型闭合（`getCapability` 返回非 undefined）
 *     与未来扩展点。当需要"按能力动态分派执行"时，可将 service 层逻辑迁入处理器。
 *
 *   enchantable / deconstructable 的设计意图：
 *   - 配置层声明能力（标记"这件装备设计上可附魔/分解"），`hasCapability` 返回 true
 *   - 处理器未注册（功能未实现），`getCapability` 返回 undefined
 *   - 这是预期行为（测试明确验证），类似于纯声明标签（stackable / tradable / usable_in_combat）
 *   - 未来实现附魔/分解功能时注册处理器，`getCapability` 自动返回实例
 *
 *   新增能力的步骤（plan.md §3.3）：
 *   1. 扩展 `Capability` 联合（capabilityTypes.ts）
 *   2. 定义 Handler 接口（capabilityTypes.ts）
 *   3. 在此注册处理器实例
 *
 * @module item
 */
import type { Item } from './types';
import type {
  Capability,
  CapabilityHandler,
  CapabilityCheckResult,
  DescribableHandler,
  UsableHandler,
  EquippableHandler,
  SellableHandler,
  SetMemberHandler,
} from './capabilityTypes';

// ============================================================================
// 占位处理器（类型闭合 + 未来扩展点，业务逻辑走 service 层）
// ============================================================================

/**
 * 默认 describable 处理器（类型闭合用）
 *
 * describe 返回空数组。调用方走 `descriptors.ts` 的 `describeItem`，
 * 该函数已按能力查询（hasCapability）分发描述逻辑。
 * 处理器保留供未来"按能力动态分派描述"场景使用。
 */
const defaultDescribableHandler: DescribableHandler = {
  describe(_item: Item): string[] {
    return [];
  },
};

/**
 * 默认 usable 处理器（类型闭合用）
 *
 * canUse 返回 ok:true 占位。调用方走 `inventory/service.ts` 的 `computeUseEffect`
 * 与 `inventory/store.ts` 的 `useItem`，这些函数已按能力查询分发。
 * 处理器保留供未来"按能力动态分派使用校验"场景使用。
 */
const defaultUsableHandler: UsableHandler = {
  canUse(_item: Item, _ctx): CapabilityCheckResult {
    return { ok: true, reason: '' };
  },
  use(_item: Item, _ctx) {
    return { ok: true, reason: '', appliedEffects: [] };
  },
};

/**
 * 默认 equippable 处理器（类型闭合用）
 *
 * canEquip 返回 ok:true 占位。调用方走 `equipment/service.ts` 的 `canEquipItem`
 * （复用 slotRegistry 校验槽位/职业/等级），equip/unequip 返回意图供 store 层应用。
 * 处理器保留供未来"按能力动态分派装备校验"场景使用。
 */
const defaultEquippableHandler: EquippableHandler = {
  canEquip(_item: Item, _equipment, _targetSlot): CapabilityCheckResult {
    return { ok: true, reason: '' };
  },
  equip(item, targetSlot) {
    if (item.kind !== 'equipment') {
      throw new Error("equippable.equip: 非 equipment 物品调用装备能力");
    }
    return { item, slot: targetSlot, occupies: item.occupies };
  },
  unequip(slot) {
    return { slot };
  },
};

/**
 * 默认 sellable 处理器
 *
 * getSellPrice 已实现合理默认（单价 × 数量），被 shop 模块使用。
 * canSell 返回 ok:true 占位，调用方走 `shop/store.ts` 的出售流程。
 */
const defaultSellableHandler: SellableHandler = {
  canSell(item: Item): CapabilityCheckResult {
    // 占位：声明了 sellable 能力的物品默认可出售
    // 调用方走 shop/store.ts 出售流程时补充任务绑定/不可出售状态等运行期校验
    void item;
    return { ok: true, reason: '' };
  },
  getSellPrice(item: Item, stackCount: number): number {
    return item.value * stackCount;
  },
};

/**
 * 默认 setMember 处理器
 *
 * getSetId 已实现：装备有 setId 则返回，否则 null。
 * 套装进度计算走 `equipment/setService.ts` 的 `getAllSetProgresses`，
 * 该函数直接访问 `equipped.item.setId` 字段（EquipmentState 中的物品天然为 equipment kind，
 * 无需运行期 hasCapability 查询）。UI 描述层（descriptors.ts）展示套装名时
 * 使用 `hasCapability('setMember')` 做能力查询分发。
 */
const defaultSetMemberHandler: SetMemberHandler = {
  getSetId(item: Item): string | null {
    return item.kind === 'equipment' ? (item.setId ?? null) : null;
  },
};

// ============================================================================
// 能力处理器注册表
// ============================================================================

/**
 * 能力处理器注册表接口
 *
 * - `describable` 必填：所有物品都具备可描述能力
 * - 其余处理器可选：未注册的能力，`getCapability` 返回 undefined
 * - 纯声明标签（stackable / tradable / usable_in_combat）无处理器条目
 * - enchantable / deconstructable：配置层声明能力但处理器未注册，
 *   `hasCapability` 返回 true、`getCapability` 返回 undefined（设计意图，功能待实现）
 *
 * 新增带处理器的能力：在此接口追加可选字段 + 在 CAPABILITY_REGISTRY 注册实例。
 */
export interface CapabilityRegistry {
  describable: DescribableHandler;
  usable?: UsableHandler;
  equippable?: EquippableHandler;
  deconstructable?: import('./capabilityTypes').DeconstructableHandler;
  enchantable?: import('./capabilityTypes').EnchantableHandler;
  sellable?: SellableHandler;
  setMember?: SetMemberHandler;
}

/**
 * 能力处理器注册表实例
 *
 * 已注册：describable / usable / equippable / sellable / setMember 五个占位处理器。
 * 未注册：deconstructable / enchantable（功能未实现，配置层声明能力标记"未来可分解/附魔"，
 * `getCapability` 返回 undefined 是预期行为，测试明确验证）。
 * 未来实现附魔/分解功能时在此注册处理器实例。
 */
export const CAPABILITY_REGISTRY: CapabilityRegistry = {
  describable: defaultDescribableHandler,
  usable: defaultUsableHandler,
  equippable: defaultEquippableHandler,
  sellable: defaultSellableHandler,
  setMember: defaultSetMemberHandler,
  // deconstructable / enchantable：功能未实现，暂不注册处理器
  // hasCapability 返回 true（配置层已声明），getCapability 返回 undefined（处理器未注册）
};

// ============================================================================
// 能力查询入口
// ============================================================================

/**
 * 获取物品的指定能力处理器
 *
 * 替代调用方的 `if (item.kind === 'equipment')` 硬编码。
 * 调用方改为：`const h = getCapability(item, 'equippable'); if (h) h.canEquip(...)`。
 *
 * 语义：
 * 1. 物品未声明该能力（`item.capabilities` 不含 `cap`）→ 返回 undefined
 * 2. 物品声明了但该能力无处理器（纯声明标签或未注册）→ 返回 undefined
 * 3. 物品声明且处理器已注册 → 返回处理器实例
 *
 * @param item - 物品实例
 * @param cap - 能力标签
 * @returns 处理器实例，无该能力或未注册时返回 undefined
 */
export function getCapability<K extends Capability>(
  item: Item,
  cap: K
): CapabilityHandler<K> | undefined {
  if (!item.capabilities.includes(cap)) return undefined;
  return (CAPABILITY_REGISTRY as Partial<Record<Capability, unknown>>)[cap] as
    | CapabilityHandler<K>
    | undefined;
}

/**
 * 便捷判断物品是否声明了某能力
 *
 * 与 `getCapability` 的区别：本函数只查声明（`item.capabilities`），
 * 不关心处理器是否注册。适用于纯声明标签（stackable / tradable / usable_in_combat）
 * 以及"只需判断能否、不需执行处理器"的场景。
 *
 * @param item - 物品实例
 * @param cap - 能力标签
 * @returns 物品是否声明了该能力
 */
export function hasCapability(item: Item, cap: Capability): boolean {
  return item.capabilities.includes(cap);
}
