/**
 * @fileoverview equipment/setService 单元测试
 *
 * 覆盖：
 * 1. getSetProgress：部件清单匹配（slot/subtype/itemId 约束）、件数统计、激活档位、下一档
 * 2. getSetProgressById：找到/未找到
 * 3. getAllSetProgresses：扫描装备去重、跳过未知 setId
 * 4. getActiveBonusEffects / getActiveTriggers / hasActiveBonus
 */
import { describe, it, expect } from 'vitest';
import {
  getSetProgress,
  getSetProgressById,
  getAllSetProgresses,
  getActiveBonusEffects,
  getActiveTriggers,
  hasActiveBonus,
  type SetProgress
} from '@/modules/equipment/setService';
import type { ItemSet } from '@/modules/equipment/setTypes';
import { createEmptySlotMap } from '@/modules/equipment/slotRegistry';
import type { EquipmentSubtype, EquippedItem, EquipmentState } from '@/modules/item/types';

// ==================== 测试数据 helper ====================

/** 构造一个 5 件护甲套（2/4 件多档奖励） */
function makeArmorSet(o: Partial<ItemSet> = {}): ItemSet {
  return {
    id: 'test_armor_set',
    name: '测试护甲套',
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
      { requiredPieces: 4, bonuses: [{ kind: 'trigger', triggerId: 'rage_gen_on_hit_1', description: '4件：攻击时 +1 怒气' }] },
    ],
    ...o,
  };
}

function makeEquippedItem(
  subtype: EquipmentSubtype,
  o: { id?: string; setId?: string } = {}
): EquippedItem {
  return {
    item: {
      id: o.id ?? `item_${subtype}`,
      name: `${subtype}装备`,
      icon: 'game-icons:sword',
      description: '',
      rarity: 'common',
      value: 10,
      kind: 'equipment',
      subtype,
      stackable: false,
      consumable: false,
      bonus: {},
      slots: [],
      occupies: [],
      setId: o.setId,
    },
    equippedAt: 1000,
  };
}

function emptyEquipment(): EquipmentState {
  return createEmptySlotMap<EquippedItem | null>(null);
}

// ==================== getSetProgress ====================

describe('getSetProgress 套装进度计算', () => {
  it('未穿戴任何部件时 equippedPieces=0，无激活档位，nextTier 为首档', () => {
    const progress = getSetProgress(makeArmorSet(), emptyEquipment());
    expect(progress.setId).toBe('test_armor_set');
    expect(progress.setName).toBe('测试护甲套');
    expect(progress.category).toBe('armor_set');
    expect(progress.totalPieces).toBe(5);
    expect(progress.equippedPieces).toBe(0);
    expect(progress.activeTiers).toEqual([]);
    expect(progress.nextTier?.requiredPieces).toBe(2);
  });

  it('partsStatus 全部未穿戴', () => {
    const progress = getSetProgress(makeArmorSet(), emptyEquipment());
    expect(progress.partsStatus).toHaveLength(5);
    expect(progress.partsStatus.every(p => p.equipped === false)).toBe(true);
    expect(progress.partsStatus.every(p => p.itemId === null)).toBe(true);
  });

  it('穿戴 2 件激活 2 件档，nextTier 为 4 件档', () => {
    const equipment = emptyEquipment();
    equipment.helm = makeEquippedItem('helm', { setId: 'test_armor_set' });
    equipment.chest = makeEquippedItem('chest', { setId: 'test_armor_set' });
    const progress = getSetProgress(makeArmorSet(), equipment);

    expect(progress.equippedPieces).toBe(2);
    expect(progress.activeTiers).toHaveLength(1);
    expect(progress.activeTiers[0].requiredPieces).toBe(2);
    expect(progress.nextTier?.requiredPieces).toBe(4);
  });

  it('穿戴 4 件激活 2/4 件两档', () => {
    const equipment = emptyEquipment();
    equipment.helm = makeEquippedItem('helm', { setId: 'test_armor_set' });
    equipment.chest = makeEquippedItem('chest', { setId: 'test_armor_set' });
    equipment.gloves = makeEquippedItem('gloves', { setId: 'test_armor_set' });
    equipment.legs = makeEquippedItem('legs', { setId: 'test_armor_set' });
    const progress = getSetProgress(makeArmorSet(), equipment);

    expect(progress.equippedPieces).toBe(4);
    expect(progress.activeTiers).toHaveLength(2);
    expect(progress.nextTier).toBeNull();
  });

  it('穿戴 5 件全部激活，nextTier 为 null', () => {
    const equipment = emptyEquipment();
    equipment.helm = makeEquippedItem('helm', { setId: 'test_armor_set' });
    equipment.chest = makeEquippedItem('chest', { setId: 'test_armor_set' });
    equipment.gloves = makeEquippedItem('gloves', { setId: 'test_armor_set' });
    equipment.legs = makeEquippedItem('legs', { setId: 'test_armor_set' });
    equipment.boots = makeEquippedItem('boots', { setId: 'test_armor_set' });
    const progress = getSetProgress(makeArmorSet(), equipment);

    expect(progress.equippedPieces).toBe(5);
    expect(progress.activeTiers).toHaveLength(2);
    expect(progress.nextTier).toBeNull();
  });

  it('subtype 不匹配时部件不计为已穿戴', () => {
    const equipment = emptyEquipment();
    // 头部槽装的是胸甲子类型，不匹配 helm 部件约束
    equipment.helm = makeEquippedItem('chest', { setId: 'test_armor_set' });
    const progress = getSetProgress(makeArmorSet(), equipment);

    expect(progress.equippedPieces).toBe(0);
    expect(progress.partsStatus.find(p => p.spec.slot === 'helm')?.equipped).toBe(false);
  });

  it('itemId 约束：仅指定 ID 的装备计为已穿戴', () => {
    const set = makeArmorSet({
      parts: [{ slot: 'helm', subtype: 'helm', itemId: 'specific_helm' }],
      bonusTiers: [{ requiredPieces: 1, bonuses: [] }],
    });
    const equipment = emptyEquipment();
    // 装备 ID 不匹配
    equipment.helm = makeEquippedItem('helm', { id: 'other_helm', setId: 'test_armor_set' });
    let progress = getSetProgress(set, equipment);
    expect(progress.equippedPieces).toBe(0);

    // 装备 ID 匹配
    equipment.helm = makeEquippedItem('helm', { id: 'specific_helm', setId: 'test_armor_set' });
    progress = getSetProgress(set, equipment);
    expect(progress.equippedPieces).toBe(1);
  });

  it('partsStatus 记录实际穿戴装备 ID', () => {
    const equipment = emptyEquipment();
    equipment.helm = makeEquippedItem('helm', { id: 'my_helm', setId: 'test_armor_set' });
    const progress = getSetProgress(makeArmorSet(), equipment);
    const helmStatus = progress.partsStatus.find(p => p.spec.slot === 'helm');
    expect(helmStatus?.equipped).toBe(true);
    expect(helmStatus?.itemId).toBe('my_helm');
  });

  it('bonusTiers 未排序时仍按 requiredPieces 升序计算 nextTier', () => {
    const set = makeArmorSet({
      bonusTiers: [
        { requiredPieces: 4, bonuses: [] },
        { requiredPieces: 2, bonuses: [] },
      ],
    });
    const equipment = emptyEquipment();
    equipment.helm = makeEquippedItem('helm', { setId: 'test_armor_set' });
    equipment.chest = makeEquippedItem('chest', { setId: 'test_armor_set' });
    const progress = getSetProgress(set, equipment);

    // 穿 2 件，激活 requiredPieces<=2 的档位（仅 2 件档）
    expect(progress.activeTiers).toHaveLength(1);
    expect(progress.activeTiers[0].requiredPieces).toBe(2);
    expect(progress.nextTier?.requiredPieces).toBe(4);
  });
});

// ==================== getSetProgressById ====================

describe('getSetProgressById', () => {
  it('套装存在时返回进度', () => {
    const sets = [makeArmorSet()];
    const progress = getSetProgressById('test_armor_set', emptyEquipment(), sets);
    expect(progress).not.toBeNull();
    expect(progress?.setId).toBe('test_armor_set');
  });

  it('套装不存在时返回 null', () => {
    const progress = getSetProgressById('not_exist', emptyEquipment(), [makeArmorSet()]);
    expect(progress).toBeNull();
  });
});

// ==================== getAllSetProgresses ====================

describe('getAllSetProgresses', () => {
  it('无套装装备时返回空数组', () => {
    expect(getAllSetProgresses(emptyEquipment(), [makeArmorSet()])).toEqual([]);
  });

  it('扫描装备中的 setId 去重返回进度', () => {
    const sets = [makeArmorSet(), makeArmorSet({ id: 'another_set', name: '另一套装' })];
    const equipment = emptyEquipment();
    equipment.helm = makeEquippedItem('helm', { setId: 'test_armor_set' });
    equipment.chest = makeEquippedItem('chest', { setId: 'test_armor_set' });
    equipment.gloves = makeEquippedItem('gloves', { setId: 'another_set' });

    const progresses = getAllSetProgresses(equipment, sets);
    expect(progresses).toHaveLength(2);
    const ids = progresses.map(p => p.setId).sort();
    expect(ids).toEqual(['another_set', 'test_armor_set']);
  });

  it('未在 sets 中定义的 setId 被跳过', () => {
    const equipment = emptyEquipment();
    equipment.helm = makeEquippedItem('helm', { setId: 'unknown_set' });
    equipment.chest = makeEquippedItem('chest', { setId: 'unknown_set' });
    const progresses = getAllSetProgresses(equipment, [makeArmorSet()]);
    expect(progresses).toEqual([]);
  });
});

// ==================== 激活效果查询 ====================

describe('getActiveBonusEffects / getActiveTriggers / hasActiveBonus', () => {
  it('穿 2 件激活 stat 效果', () => {
    const equipment = emptyEquipment();
    equipment.helm = makeEquippedItem('helm', { setId: 'test_armor_set' });
    equipment.chest = makeEquippedItem('chest', { setId: 'test_armor_set' });
    const progress = getSetProgress(makeArmorSet(), equipment) as SetProgress;

    const effects = getActiveBonusEffects(progress);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toEqual({ kind: 'stat', stat: 'str', value: 5, description: '2件：力量 +5' });
    expect(hasActiveBonus(progress)).toBe(true);
  });

  it('穿 4 件激活 stat + trigger 两效果，getActiveTriggers 返回 triggerId', () => {
    const equipment = emptyEquipment();
    equipment.helm = makeEquippedItem('helm', { setId: 'test_armor_set' });
    equipment.chest = makeEquippedItem('chest', { setId: 'test_armor_set' });
    equipment.gloves = makeEquippedItem('gloves', { setId: 'test_armor_set' });
    equipment.legs = makeEquippedItem('legs', { setId: 'test_armor_set' });
    const progress = getSetProgress(makeArmorSet(), equipment) as SetProgress;

    expect(getActiveBonusEffects(progress)).toHaveLength(2);
    expect(getActiveTriggers(progress)).toEqual(['rage_gen_on_hit_1']);
  });

  it('未激活时 hasActiveBonus 为 false，triggers 为空', () => {
    const progress = getSetProgress(makeArmorSet(), emptyEquipment()) as SetProgress;
    expect(hasActiveBonus(progress)).toBe(false);
    expect(getActiveTriggers(progress)).toEqual([]);
    expect(getActiveBonusEffects(progress)).toEqual([]);
  });
});
