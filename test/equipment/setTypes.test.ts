/**
 * @fileoverview equipment/setTypes 类型层单元测试
 *
 * setTypes 为纯类型文件（无运行时逻辑），本测试通过构造满足类型的 fixture
 * 与 expectTypeOf 编译期校验，验证判别联合与部件清单类型的可用性。
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  ItemSet,
  SetBonusEffect,
  SetBonusTier,
  SetCategory,
  SetPartSpec
} from '@/modules/equipment/setTypes';
import type { EquipmentSlot } from '@/modules/item/types';

// ==================== SetBonusEffect 判别联合 ====================

describe('SetBonusEffect 判别联合', () => {
  it('stat 变体含 stat/value/description', () => {
    const e: SetBonusEffect = { kind: 'stat', stat: 'str', value: 5, description: '力量 +5' };
    expect(e.kind).toBe('stat');
    expectTypeOf(e).toMatchTypeOf<SetBonusEffect>();
  });

  it('percent_stat 变体含 stat/percent/description', () => {
    const e: SetBonusEffect = { kind: 'percent_stat', stat: 'dex', percent: 0.03, description: '暴击 +3%' };
    expect(e.kind).toBe('percent_stat');
  });

  it('resource 变体含 resource/perTurn/description', () => {
    const e: SetBonusEffect = { kind: 'resource', resource: 'energy', perTurn: 2, description: '每回合 +2 能量' };
    expect(e.kind).toBe('resource');
  });

  it('trigger 变体含 triggerId/description', () => {
    const e: SetBonusEffect = { kind: 'trigger', triggerId: 'rage_gen_on_hit_1', description: '攻击 +1 怒气' };
    expect(e.kind).toBe('trigger');
  });

  it('各变体均含 description 字段', () => {
    expectTypeOf<SetBonusEffect>().toMatchTypeOf<{ description: string }>();
  });
});

// ==================== SetPartSpec / SetCategory ====================

describe('SetPartSpec 部件规格', () => {
  it('可仅指定 slot', () => {
    const spec: SetPartSpec = { slot: 'helm' };
    expect(spec.slot).toBe('helm');
  });

  it('可同时指定 slot + subtype + itemId', () => {
    const spec: SetPartSpec = { slot: 'weapon1', subtype: 'sword', itemId: 'iron_sword' };
    expect(spec.subtype).toBe('sword');
    expect(spec.itemId).toBe('iron_sword');
  });

  it('slot 为新 7 槽体系', () => {
    expectTypeOf<SetPartSpec['slot']>().toEqualTypeOf<EquipmentSlot>();
  });
});

describe('SetCategory 套装分类', () => {
  it('覆盖四种组合规则', () => {
    const categories: SetCategory[] = ['weapon_set', 'armor_set', 'mixed_set', 'accessory_set'];
    expect(categories).toHaveLength(4);
  });
});

// ==================== ItemSet 部件清单 + 多档奖励 ====================

describe('ItemSet 新版套装定义', () => {
  it('可构造部件清单 + 多档奖励', () => {
    const set: ItemSet = {
      id: 'warrior_might',
      name: '力量套装',
      category: 'armor_set',
      classRestriction: 'warrior',
      parts: [
        { slot: 'helm', subtype: 'helm' },
        { slot: 'chest', subtype: 'chest' },
        { slot: 'gloves', subtype: 'gloves' },
        { slot: 'legs', subtype: 'legs' },
        { slot: 'boots', subtype: 'boots' },
      ],
      bonusTiers: [
        { requiredPieces: 2, bonuses: [{ kind: 'stat', stat: 'str', value: 5, description: '2件：力量 +5' }] },
        { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'rage_gen_on_hit_1', description: '4件：攻击 +1 怒气' }] },
      ],
    };

    expect(set.id).toBe('warrior_might');
    expect(set.parts).toHaveLength(5);
    expect(set.bonusTiers).toHaveLength(2);
    // pieces 由 parts.length 派生，不再有 pieces 字段
    expect((set as unknown as Record<string, unknown>).pieces).toBeUndefined();
  });

  it('bonusTiers 每档可含多个效果', () => {
    const tier: SetBonusTier = {
      requiredPieces: 4,
      bonuses: [
        { kind: 'stat', stat: 'str', value: 5, description: 'a' },
        { kind: 'percent_stat', stat: 'dex', percent: 0.05, description: 'b' },
      ],
    };
    expect(tier.bonuses).toHaveLength(2);
  });
});
