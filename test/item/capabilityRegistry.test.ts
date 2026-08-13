/**
 * @fileoverview 能力组合模型查询层单元测试（capabilityRegistry + capabilityTypes）
 *
 * 覆盖范围（plan.md §3.3 / §C1-11）：
 * 1. hasCapability：能力声明查询（纯标签判断，不关心处理器）
 * 2. getCapability：能力处理器查询（声明 + 注册表双重判断）
 * 3. CAPABILITY_REGISTRY 完整性：已注册能力 / 未注册能力 / 纯声明标签
 * 4. 占位处理器行为：describable / usable / equippable / sellable / setMember
 * 5. CapabilityHandler 条件映射类型：各 capability 对应正确 Handler 类型
 *
 * 设计说明（遵循 code_rule 红线）：
 * - 顶部不引入 fake-indexeddb（本测试纯内存，不碰 DB）
 * - make* helper 与 typeRegistry.test.ts 风格一致，capabilities 显式声明
 * - 不 mock CAPABILITY_REGISTRY，测试真实注册表与真实占位处理器
 */
import { describe, it, expect } from 'vitest';
import {
  CAPABILITY_REGISTRY,
  getCapability,
  hasCapability,
} from '@/modules/item/capabilityRegistry';
import type { CapabilityHandler } from '@/modules/item/capabilityTypes';
import type {
  Item,
  ConsumableItem,
  MaterialItem,
  EquipmentItem,
  QuestItem,
  CurrencyItem,
} from '@/modules/item/types';

// ==================== 测试数据 helper ====================

function makeConsumable(o: Partial<ConsumableItem> = {}): ConsumableItem {
  return {
    id: 'p1',
    name: '药水',
    icon: '',
    description: '',
    rarity: 'common',
    value: 10,
    kind: 'consumable',
    subtype: 'potion',
    stackable: true,
    consumable: true,
    effects: [],
    useMode: 'instant',
    capabilities: ['describable', 'usable', 'stackable', 'sellable'],
    ...o,
  };
}

function makeMaterial(o: Partial<MaterialItem> = {}): MaterialItem {
  return {
    id: 'm1',
    name: '材料',
    icon: '',
    description: '',
    rarity: 'common',
    value: 5,
    kind: 'material',
    stackable: true,
    consumable: false,
    effects: [],
    capabilities: ['describable', 'stackable', 'sellable'],
    ...o,
  };
}

function makeEquipment(o: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: 'w1',
    name: '铁剑',
    icon: '',
    description: '',
    rarity: 'common',
    value: 50,
    kind: 'equipment',
    subtype: 'sword',
    grip: 'one_handed',
    stackable: false,
    consumable: false,
    bonus: { str: 5 },
    slots: ['weapon1'],
    occupies: ['weapon1'],
    capabilities: ['describable', 'equippable', 'sellable', 'enchantable'],
    ...o,
  };
}

function makeQuest(o: Partial<QuestItem> = {}): QuestItem {
  return {
    id: 'q1',
    name: '任务物品',
    icon: '',
    description: '',
    rarity: 'rare',
    value: 0,
    kind: 'quest',
    stackable: false,
    consumable: false,
    effects: [],
    capabilities: ['describable'],
    ...o,
  };
}

function makeCurrency(o: Partial<CurrencyItem> = {}): CurrencyItem {
  return {
    id: 'gold',
    name: '金币',
    icon: '',
    description: '',
    rarity: 'common',
    value: 1,
    kind: 'currency',
    subtype: 'gold',
    stackable: false,
    consumable: false,
    capabilities: ['describable', 'tradable'],
    ...o,
  };
}

// ==================== hasCapability ====================

describe('hasCapability 能力声明查询', () => {
  it('消耗品声明了 describable/usable/stackable/sellable', () => {
    const item = makeConsumable();
    expect(hasCapability(item, 'describable')).toBe(true);
    expect(hasCapability(item, 'usable')).toBe(true);
    expect(hasCapability(item, 'stackable')).toBe(true);
    expect(hasCapability(item, 'sellable')).toBe(true);
  });

  it('消耗品未声明 equippable/enchantable/setMember', () => {
    const item = makeConsumable();
    expect(hasCapability(item, 'equippable')).toBe(false);
    expect(hasCapability(item, 'enchantable')).toBe(false);
    expect(hasCapability(item, 'setMember')).toBe(false);
    expect(hasCapability(item, 'deconstructable')).toBe(false);
    expect(hasCapability(item, 'tradable')).toBe(false);
  });

  it('装备声明了 describable/equippable/sellable/enchantable', () => {
    const item = makeEquipment();
    expect(hasCapability(item, 'describable')).toBe(true);
    expect(hasCapability(item, 'equippable')).toBe(true);
    expect(hasCapability(item, 'sellable')).toBe(true);
    expect(hasCapability(item, 'enchantable')).toBe(true);
  });

  it('装备未声明 usable/stackable', () => {
    const item = makeEquipment();
    expect(hasCapability(item, 'usable')).toBe(false);
    expect(hasCapability(item, 'stackable')).toBe(false);
  });

  it('任务物品仅声明 describable', () => {
    const item = makeQuest();
    expect(hasCapability(item, 'describable')).toBe(true);
    expect(hasCapability(item, 'usable')).toBe(false);
    expect(hasCapability(item, 'sellable')).toBe(false);
    expect(hasCapability(item, 'stackable')).toBe(false);
    expect(hasCapability(item, 'equippable')).toBe(false);
  });

  it('材料声明了 describable/stackable/sellable 但未声明 usable', () => {
    const item = makeMaterial();
    expect(hasCapability(item, 'describable')).toBe(true);
    expect(hasCapability(item, 'stackable')).toBe(true);
    expect(hasCapability(item, 'sellable')).toBe(true);
    expect(hasCapability(item, 'usable')).toBe(false);
  });

  it('货币声明了 describable/tradable', () => {
    const item = makeCurrency();
    expect(hasCapability(item, 'describable')).toBe(true);
    expect(hasCapability(item, 'tradable')).toBe(true);
    expect(hasCapability(item, 'sellable')).toBe(false);
  });

  it('复合物品：装备同时声明 equippable + usable（魔法武器）', () => {
    const magicWeapon = makeEquipment({
      capabilities: ['describable', 'equippable', 'usable', 'sellable', 'enchantable'],
      effects: [{ type: 'magic_damage', value: 50 }],
    });
    expect(hasCapability(magicWeapon, 'equippable')).toBe(true);
    expect(hasCapability(magicWeapon, 'usable')).toBe(true);
    expect(hasCapability(magicWeapon, 'enchantable')).toBe(true);
  });

  it('套装部件声明了 setMember', () => {
    const setItem = makeEquipment({
      setId: 'thunder_set',
      capabilities: ['describable', 'equippable', 'setMember', 'sellable', 'enchantable'],
    });
    expect(hasCapability(setItem, 'setMember')).toBe(true);
    expect(hasCapability(setItem, 'equippable')).toBe(true);
  });
});

// ==================== getCapability ====================

describe('getCapability 能力处理器查询', () => {
  it('声明了且有处理器的能力 → 返回处理器实例', () => {
    const item = makeConsumable();
    const h = getCapability(item, 'usable');
    expect(h).toBeDefined();
    expect(typeof h?.canUse).toBe('function');
    expect(typeof h?.use).toBe('function');
  });

  it('声明了且有处理器的 equippable → 返回装备处理器', () => {
    const item = makeEquipment();
    const h = getCapability(item, 'equippable');
    expect(h).toBeDefined();
    expect(typeof h?.canEquip).toBe('function');
    expect(typeof h?.equip).toBe('function');
    expect(typeof h?.unequip).toBe('function');
  });

  it('声明了且有处理器的 sellable → 返回出售处理器', () => {
    const item = makeConsumable();
    const h = getCapability(item, 'sellable');
    expect(h).toBeDefined();
    expect(typeof h?.canSell).toBe('function');
    expect(typeof h?.getSellPrice).toBe('function');
  });

  it('声明了且有处理器的 setMember → 返回套装成员处理器', () => {
    const setItem = makeEquipment({
      setId: 'thunder_set',
      capabilities: ['describable', 'equippable', 'setMember', 'sellable', 'enchantable'],
    });
    const h = getCapability(setItem, 'setMember');
    expect(h).toBeDefined();
    expect(typeof h?.getSetId).toBe('function');
  });

  it('声明了 describable → 返回描述处理器', () => {
    const item = makeMaterial();
    const h = getCapability(item, 'describable');
    expect(h).toBeDefined();
    expect(typeof h?.describe).toBe('function');
  });

  it('未声明该能力 → 返回 undefined', () => {
    const item = makeConsumable();
    expect(getCapability(item, 'equippable')).toBeUndefined();
    expect(getCapability(item, 'enchantable')).toBeUndefined();
    expect(getCapability(item, 'setMember')).toBeUndefined();
  });

  it('声明了但无处理器的纯声明标签 → 返回 undefined', () => {
    // stackable 是纯声明标签，CAPABILITY_REGISTRY 无对应处理器
    const item = makeConsumable();
    expect(hasCapability(item, 'stackable')).toBe(true);
    expect(getCapability(item, 'stackable')).toBeUndefined();
  });

  it('tradable 纯声明标签 → getCapability 返回 undefined', () => {
    const item = makeCurrency();
    expect(hasCapability(item, 'tradable')).toBe(true);
    expect(getCapability(item, 'tradable')).toBeUndefined();
  });

  it('enchantable 声明了但未注册处理器 → 返回 undefined', () => {
    const item = makeEquipment();
    expect(hasCapability(item, 'enchantable')).toBe(true);
    // C1 阶段 enchantable 处理器未注册（plan.md §3.3：未来按需注册）
    expect(getCapability(item, 'enchantable')).toBeUndefined();
  });

  it('deconstructable 声明了但未注册处理器 → 返回 undefined', () => {
    const item = makeEquipment({
      capabilities: ['describable', 'equippable', 'deconstructable', 'sellable'],
    });
    expect(hasCapability(item, 'deconstructable')).toBe(true);
    expect(getCapability(item, 'deconstructable')).toBeUndefined();
  });
});

// ==================== CAPABILITY_REGISTRY 完整性 ====================

describe('CAPABILITY_REGISTRY 注册表完整性', () => {
  it('describable 为必填处理器（所有物品默认具备）', () => {
    expect(CAPABILITY_REGISTRY.describable).toBeDefined();
    expect(typeof CAPABILITY_REGISTRY.describable.describe).toBe('function');
  });

  it('usable 处理器已注册', () => {
    expect(CAPABILITY_REGISTRY.usable).toBeDefined();
    expect(typeof CAPABILITY_REGISTRY.usable?.canUse).toBe('function');
    expect(typeof CAPABILITY_REGISTRY.usable?.use).toBe('function');
  });

  it('equippable 处理器已注册', () => {
    expect(CAPABILITY_REGISTRY.equippable).toBeDefined();
    expect(typeof CAPABILITY_REGISTRY.equippable?.canEquip).toBe('function');
    expect(typeof CAPABILITY_REGISTRY.equippable?.equip).toBe('function');
    expect(typeof CAPABILITY_REGISTRY.equippable?.unequip).toBe('function');
  });

  it('sellable 处理器已注册', () => {
    expect(CAPABILITY_REGISTRY.sellable).toBeDefined();
    expect(typeof CAPABILITY_REGISTRY.sellable?.canSell).toBe('function');
    expect(typeof CAPABILITY_REGISTRY.sellable?.getSellPrice).toBe('function');
  });

  it('setMember 处理器已注册', () => {
    expect(CAPABILITY_REGISTRY.setMember).toBeDefined();
    expect(typeof CAPABILITY_REGISTRY.setMember?.getSetId).toBe('function');
  });

  it('deconstructable 处理器未注册（C1 占位，未来按需注册）', () => {
    expect(CAPABILITY_REGISTRY.deconstructable).toBeUndefined();
  });

  it('enchantable 处理器未注册（C1 占位，C3 实现附魔时注册）', () => {
    expect(CAPABILITY_REGISTRY.enchantable).toBeUndefined();
  });
});

// ==================== 占位处理器行为 ====================

describe('占位处理器行为（C1 最小实现）', () => {
  describe('describable.describe', () => {
    it('C1 占位返回空数组', () => {
      const item = makeConsumable();
      const h = getCapability(item, 'describable');
      expect(h?.describe(item)).toEqual([]);
    });
  });

  describe('usable.canUse / use', () => {
    it('canUse 占位返回 ok=true', () => {
      const item = makeConsumable();
      const h = getCapability(item, 'usable');
      const result = h?.canUse(item, { characterId: 'char-1' });
      expect(result).toEqual({ ok: true, reason: '' });
    });

    it('use 占位返回 ok=true + 空效果列表', () => {
      const item = makeConsumable();
      const h = getCapability(item, 'usable');
      const result = h?.use(item, { characterId: 'char-1' });
      expect(result).toEqual({ ok: true, reason: '', appliedEffects: [] });
    });
  });

  describe('equippable.canEquip / equip / unequip', () => {
    it('canEquip 占位返回 ok=true', () => {
      const item = makeEquipment();
      const h = getCapability(item, 'equippable');
      const result = h?.canEquip(item, {} as never, 'weapon1');
      expect(result).toEqual({ ok: true, reason: '' });
    });

    it('equip 返回 EquipIntent（含 item + slot + occupies）', () => {
      const item = makeEquipment();
      const h = getCapability(item, 'equippable');
      const intent = h?.equip(item, 'weapon1');
      expect(intent).toEqual({
        item,
        slot: 'weapon1',
        occupies: ['weapon1'],
      });
    });

    it('unequip 返回 UnequipIntent（含 slot）', () => {
      const item = makeEquipment();
      const h = getCapability(item, 'equippable');
      const intent = h?.unequip('weapon1');
      expect(intent).toEqual({ slot: 'weapon1' });
    });

    it('equip 对非 equipment 物品抛错（类型安全守卫）', () => {
      // 构造一个声明了 equippable 但 kind 不是 equipment 的异常物品
      const wrongItem = makeConsumable({
        capabilities: ['describable', 'equippable', 'usable', 'stackable', 'sellable'],
      }) as unknown as EquipmentItem;
      const h = getCapability(wrongItem, 'equippable');
      expect(() => h?.equip(wrongItem, 'weapon1')).toThrow('非 equipment 物品');
    });
  });

  describe('sellable.canSell / getSellPrice', () => {
    it('canSell 占位返回 ok=true', () => {
      const item = makeConsumable();
      const h = getCapability(item, 'sellable');
      expect(h?.canSell(item)).toEqual({ ok: true, reason: '' });
    });

    it('getSellPrice = 单价 × 数量', () => {
      const item = makeConsumable({ value: 10 });
      const h = getCapability(item, 'sellable');
      expect(h?.getSellPrice(item, 1)).toBe(10);
      expect(h?.getSellPrice(item, 5)).toBe(50);
      expect(h?.getSellPrice(item, 0)).toBe(0);
    });

    it('getSellPrice 对 value=0 的物品返回 0', () => {
      const item = makeQuest({ value: 0, capabilities: ['describable', 'sellable'] });
      const h = getCapability(item, 'sellable');
      expect(h?.getSellPrice(item, 10)).toBe(0);
    });
  });

  describe('setMember.getSetId', () => {
    it('装备有 setId → 返回套装 ID', () => {
      const item = makeEquipment({
        setId: 'thunder_set',
        capabilities: ['describable', 'equippable', 'setMember', 'sellable', 'enchantable'],
      });
      const h = getCapability(item, 'setMember');
      expect(h?.getSetId(item)).toBe('thunder_set');
    });

    it('装备无 setId → 返回 null', () => {
      const item = makeEquipment({
        capabilities: ['describable', 'equippable', 'setMember', 'sellable', 'enchantable'],
      });
      const h = getCapability(item, 'setMember');
      expect(h?.getSetId(item)).toBeNull();
    });

    it('非 equipment 物品调用 getSetId → 返回 null', () => {
      // 消耗品异常声明了 setMember（配置层不应这么做，但处理器需防御）
      const item = makeConsumable({
        capabilities: ['describable', 'usable', 'stackable', 'sellable', 'setMember'],
      }) as unknown as EquipmentItem;
      const h = getCapability(item, 'setMember');
      expect(h?.getSetId(item)).toBeNull();
    });
  });
});

// ==================== CapabilityHandler 条件映射类型 ====================

describe('CapabilityHandler 类型映射（编译期类型安全）', () => {
  it('describable → DescribableHandler', () => {
    const item = makeMaterial();
    const h = getCapability(item, 'describable');
    // 类型断言验证：h 是 DescribableHandler | undefined
    const _typeCheck: CapabilityHandler<'describable'> | undefined = h;
    expect(_typeCheck).toBeDefined();
    expect(typeof _typeCheck?.describe).toBe('function');
  });

  it('usable → UsableHandler', () => {
    const item = makeConsumable();
    const h = getCapability(item, 'usable');
    const _typeCheck: CapabilityHandler<'usable'> | undefined = h;
    expect(_typeCheck).toBeDefined();
  });

  it('equippable → EquippableHandler', () => {
    const item = makeEquipment();
    const h = getCapability(item, 'equippable');
    const _typeCheck: CapabilityHandler<'equippable'> | undefined = h;
    expect(_typeCheck).toBeDefined();
  });

  it('sellable → SellableHandler', () => {
    const item = makeConsumable();
    const h = getCapability(item, 'sellable');
    const _typeCheck: CapabilityHandler<'sellable'> | undefined = h;
    expect(_typeCheck).toBeDefined();
  });

  it('setMember → SetMemberHandler', () => {
    const item = makeEquipment({
      setId: 's1',
      capabilities: ['describable', 'equippable', 'setMember', 'sellable'],
    });
    const h = getCapability(item, 'setMember');
    const _typeCheck: CapabilityHandler<'setMember'> | undefined = h;
    expect(_typeCheck).toBeDefined();
  });

  it('stackable → undefined（纯声明标签无处理器）', () => {
    const item = makeConsumable();
    const h = getCapability(item, 'stackable');
    // CapabilityHandler<'stackable'> 恒为 undefined
    const _typeCheck: undefined = h;
    expect(_typeCheck).toBeUndefined();
  });

  it('tradable → undefined（纯声明标签无处理器）', () => {
    const item = makeCurrency();
    const h = getCapability(item, 'tradable');
    const _typeCheck: undefined = h;
    expect(_typeCheck).toBeUndefined();
  });

  it('enchantable → undefined（C1 未注册处理器）', () => {
    const item = makeEquipment();
    const h = getCapability(item, 'enchantable');
    // CapabilityHandler<'enchantable'> 类型存在，但 C1 未注册实例 → 运行期为 undefined
    const _typeCheck: CapabilityHandler<'enchantable'> | undefined = h;
    expect(_typeCheck).toBeUndefined();
  });
});

// ==================== 能力声明正确性（配置层约定） ====================

describe('能力声明正确性（配置层约定验证）', () => {
  it('所有物品至少声明 describable（能力模型最小约束）', () => {
    const items: Item[] = [
      makeConsumable(),
      makeMaterial(),
      makeEquipment(),
      makeQuest(),
      makeCurrency(),
    ];
    for (const item of items) {
      expect(hasCapability(item, 'describable')).toBe(true);
    }
  });

  it('usable 与 stackable 不冲突（消耗品同时具备）', () => {
    const item = makeConsumable();
    expect(hasCapability(item, 'usable')).toBe(true);
    expect(hasCapability(item, 'stackable')).toBe(true);
  });

  it('equippable 与 stackable 互斥（装备不可堆叠）', () => {
    const item = makeEquipment();
    expect(hasCapability(item, 'equippable')).toBe(true);
    expect(hasCapability(item, 'stackable')).toBe(false);
  });

  it('任务物品不可使用/出售/堆叠/装备', () => {
    const item = makeQuest();
    expect(hasCapability(item, 'usable')).toBe(false);
    expect(hasCapability(item, 'sellable')).toBe(false);
    expect(hasCapability(item, 'stackable')).toBe(false);
    expect(hasCapability(item, 'equippable')).toBe(false);
  });

  it('setMember 能力与 setId 字段一致（声明 setMember 的装备应有 setId）', () => {
    const setItem = makeEquipment({
      setId: 'thunder_set',
      capabilities: ['describable', 'equippable', 'setMember', 'sellable', 'enchantable'],
    });
    expect(hasCapability(setItem, 'setMember')).toBe(true);
    expect(setItem.kind === 'equipment' && setItem.setId).toBe('thunder_set');

    const normalItem = makeEquipment();
    expect(hasCapability(normalItem, 'setMember')).toBe(false);
  });

  it('复合物品能力组合：魔法武器 = equippable + usable + enchantable', () => {
    const magicWeapon = makeEquipment({
      effects: [{ type: 'magic_damage', value: 50 }],
      capabilities: ['describable', 'equippable', 'usable', 'sellable', 'enchantable'],
    });
    // 装备 + 使用 + 附魔 三重能力共存（plan.md §2.2 核心场景）
    expect(hasCapability(magicWeapon, 'equippable')).toBe(true);
    expect(hasCapability(magicWeapon, 'usable')).toBe(true);
    expect(hasCapability(magicWeapon, 'enchantable')).toBe(true);
    // 同时获取多个处理器
    const eqHandler = getCapability(magicWeapon, 'equippable');
    const useHandler = getCapability(magicWeapon, 'usable');
    expect(eqHandler).toBeDefined();
    expect(useHandler).toBeDefined();
  });
});
