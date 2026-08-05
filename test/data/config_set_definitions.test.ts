/**
 * @fileoverview 套装定义数据单元测试（P3 套装扩展）
 *
 * 验证 39 套套装定义（P3 扩展 39 套）的数据完整性：
 * - 套装总数与分布
 * - setId 唯一性
 * - P3 套装部件清单完整性（5 件护甲）
 * - bonusTiers 结构（2 件套 stat + 4 件套 trigger）
 * - triggerId 已在 setBonusRegistry 注册
 * - parts 中的 itemId 在 SET_PARTS 中存在
 * - classRestriction 与 setId 中的职业一致
 * - getSetDefinitionById / getSetDefinitionsByClassId 查询函数
 */
import { describe, it, expect } from 'vitest';
import { SET_DEFINITIONS, getSetDefinitionById, getSetDefinitionsByClassId } from '@/data/config_set_definitions';
import { SET_PARTS } from '@/data/config_set_parts';
import { isTriggerRegistered } from '@/modules/equipment/setBonusRegistry';

// P3 扩展的 39 套 setId（13 职业 × 3 套）
const P3_CLASS_IDS = [
  'warrior', 'paladin', 'hunter', 'rogue', 'priest', 'shaman',
  'mage', 'warlock', 'monk', 'druid', 'death_knight', 'demon_hunter', 'evoker'
] as const;

const EXPECTED_P3_SET_IDS: string[] = [];
P3_CLASS_IDS.forEach(classId => {
  [1, 2, 3].forEach(tier => {
    EXPECTED_P3_SET_IDS.push(`${classId}_t${tier}`);
  });
});

describe('套装定义总数', () => {
  it('套装定义总数为 39 套（P3 扩展 39 套）', () => {
    expect(SET_DEFINITIONS).toHaveLength(39);
  });

  it('所有 setId 唯一', () => {
    const ids = SET_DEFINITIONS.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('P3 扩展的 39 套 setId 全部存在', () => {
    EXPECTED_P3_SET_IDS.forEach(setId => {
      expect(SET_DEFINITIONS.find(s => s.id === setId), `套装 ${setId} 应存在`).toBeDefined();
    });
  });
});

describe('P3 套装部件清单完整性', () => {
  const p3Sets = SET_DEFINITIONS.filter(s => EXPECTED_P3_SET_IDS.includes(s.id));

  it('P3 套装每套 5 个部件', () => {
    p3Sets.forEach(set => {
      expect(set.parts, `套装 ${set.id} 应有 5 个部件`).toHaveLength(5);
    });
  });

  it('P3 套装部件槽位为 helm+chest+gloves+legs+boots', () => {
    const expectedSlots = ['helm', 'chest', 'gloves', 'legs', 'boots'].sort();
    p3Sets.forEach(set => {
      const slots = set.parts.map(p => p.slot).sort();
      expect(slots, `套装 ${set.id} 的部件槽位应覆盖 5 个护甲部位`).toEqual(expectedSlots);
    });
  });

  it('P3 套装部件 itemId 在 SET_PARTS 中存在', () => {
    const setItemIds = new Set(SET_PARTS.map(i => i.id));
    p3Sets.forEach(set => {
      set.parts.forEach(part => {
        expect(part.itemId, `套装 ${set.id} 的部件 itemId 应存在`).toBeDefined();
        expect(setItemIds.has(part.itemId!), `部件 ${part.itemId} 应在 SET_PARTS 中存在`).toBe(true);
      });
    });
  });

  it('P3 套装 category 为 armor_set', () => {
    p3Sets.forEach(set => {
      expect(set.category, `套装 ${set.id} 的 category 应为 armor_set`).toBe('armor_set');
    });
  });
});

describe('P3 套装 classRestriction', () => {
  const p3Sets = SET_DEFINITIONS.filter(s => EXPECTED_P3_SET_IDS.includes(s.id));

  it('P3 套装 classRestriction 与 setId 中的职业一致', () => {
    p3Sets.forEach(set => {
      const match = set.id.match(/^([a-z_]+)_t[123]$/);
      expect(match, `setId ${set.id} 不符合命名规范`).not.toBeNull();
      if (match) {
        expect(set.classRestriction, `套装 ${set.id} 的 classRestriction 应为 ${match[1]}`).toBe(match[1]);
      }
    });
  });

  it('每个职业有 3 套套装', () => {
    P3_CLASS_IDS.forEach(classId => {
      const sets = p3Sets.filter(s => s.classRestriction === classId);
      expect(sets, `职业 ${classId} 应有 3 套套装`).toHaveLength(3);
    });
  });
});

describe('P3 套装 bonusTiers 结构', () => {
  const p3Sets = SET_DEFINITIONS.filter(s => EXPECTED_P3_SET_IDS.includes(s.id));

  it('P3 套装有 2 档 bonusTiers', () => {
    p3Sets.forEach(set => {
      expect(set.bonusTiers, `套装 ${set.id} 应有 2 档 bonusTiers`).toHaveLength(2);
    });
  });

  it('第一档 requiredPieces 为 2', () => {
    p3Sets.forEach(set => {
      expect(set.bonusTiers[0].requiredPieces, `套装 ${set.id} 第一档应为 2 件套`).toBe(2);
    });
  });

  it('第二档 requiredPieces 为 4', () => {
    p3Sets.forEach(set => {
      expect(set.bonusTiers[1].requiredPieces, `套装 ${set.id} 第二档应为 4 件套`).toBe(4);
    });
  });

  it('2 件套奖励为 stat 类型', () => {
    p3Sets.forEach(set => {
      const tier2 = set.bonusTiers[0];
      expect(tier2.bonuses).toHaveLength(1);
      expect(tier2.bonuses[0].kind, `套装 ${set.id} 的 2 件套奖励应为 stat 类型`).toBe('stat');
    });
  });

  it('4 件套奖励为 trigger 类型', () => {
    p3Sets.forEach(set => {
      const tier4 = set.bonusTiers[1];
      expect(tier4.bonuses).toHaveLength(1);
      expect(tier4.bonuses[0].kind, `套装 ${set.id} 的 4 件套奖励应为 trigger 类型`).toBe('trigger');
    });
  });
});

describe('P3 套装 triggerId 注册校验', () => {
  const p3Sets = SET_DEFINITIONS.filter(s => EXPECTED_P3_SET_IDS.includes(s.id));

  it('所有 4 件套 triggerId 已在 setBonusRegistry 注册', () => {
    p3Sets.forEach(set => {
      const triggerBonus = set.bonusTiers[1].bonuses[0];
      if (triggerBonus.kind === 'trigger') {
        expect(
          isTriggerRegistered(triggerBonus.triggerId),
          `套装 ${set.id} 的 triggerId "${triggerBonus.triggerId}" 应在 setBonusRegistry 中注册`
        ).toBe(true);
      }
    });
  });
});

describe('P3 套装 2 件套属性奖励递增', () => {
  const TIER_STAT_VALUE: Record<number, number> = { 1: 5, 2: 8, 3: 12 };

  P3_CLASS_IDS.forEach(classId => {
    [1, 2, 3].forEach(tier => {
      const setId = `${classId}_t${tier}`;
      const set = SET_DEFINITIONS.find(s => s.id === setId);
      it(`套装 ${setId} 的 2 件套 stat 值为 ${TIER_STAT_VALUE[tier]}`, () => {
        expect(set).toBeDefined();
        const statBonus = set!.bonusTiers[0].bonuses[0];
        if (statBonus.kind === 'stat') {
          expect(statBonus.value, `套装 ${setId} 的 2 件套 stat 值应为 ${TIER_STAT_VALUE[tier]}`).toBe(TIER_STAT_VALUE[tier]);
        }
      });
    });
  });
});

describe('查询函数', () => {
  it('getSetDefinitionById 返回正确的套装定义', () => {
    const set = getSetDefinitionById('warrior_t1');
    expect(set).toBeDefined();
    expect(set!.id).toBe('warrior_t1');
    expect(set!.name).toBe('铁壁套装');
  });

  it('getSetDefinitionById 对不存在的 setId 返回 undefined', () => {
    expect(getSetDefinitionById('nonexistent_set')).toBeUndefined();
  });

  it('getSetDefinitionsByClassId 返回该职业的全部套装', () => {
    P3_CLASS_IDS.forEach(classId => {
      const sets = getSetDefinitionsByClassId(classId);
      // P3 扩展的 3 套
      expect(sets.length, `职业 ${classId} 应有 3 套套装`).toBe(3);
    });
  });

  it('getSetDefinitionsByClassId 对 warrior 返回 3 套（P3 扩展）', () => {
    const sets = getSetDefinitionsByClassId('warrior');
    expect(sets).toHaveLength(3);
  });

  it('getSetDefinitionsByClassId 对无套装的职业返回空数组', () => {
    const sets = getSetDefinitionsByClassId('nonexistent_class');
    expect(sets).toHaveLength(0);
  });
});
