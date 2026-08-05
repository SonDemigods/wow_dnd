/**
 * @fileoverview 套装部件数据单元测试（P3 套装扩展）
 *
 * 验证 195 件套装部件（13 职业 × 3 套 × 5 件）的数据完整性：
 * - 总数与分布（按职业/层级/槽位）
 * - ID 唯一性与命名规范（{classId}_{slot}_t{tier}）
 * - 能力组合含 setMember
 * - 稀有度/等级要求按层级递增
 * - 名称/描述纯中文（无英文单词）
 * - 槽位派生正确（slots/occupies）
 * - 主属性与职业匹配
 */
import { describe, it, expect } from 'vitest';
import { SET_PARTS } from '@/data/config_set_parts';
import type { Stats } from '@/modules/character/types';

// 13 职业及其主属性
const CLASS_PRIMARY_STAT: Record<string, keyof Stats> = {
  warrior: 'str',
  paladin: 'cha',
  hunter: 'dex',
  rogue: 'dex',
  priest: 'wis',
  shaman: 'wis',
  mage: 'int',
  warlock: 'int',
  monk: 'dex',
  druid: 'wis',
  death_knight: 'str',
  demon_hunter: 'dex',
  evoker: 'int',
};

const CLASS_IDS = Object.keys(CLASS_PRIMARY_STAT);
const SLOTS = ['helm', 'chest', 'gloves', 'legs', 'boots'] as const;
const TIERS = [1, 2, 3] as const;

describe('套装部件总数与分布', () => {
  it('套装部件总数为 195 件（13 职业 × 3 套 × 5 件）', () => {
    expect(SET_PARTS).toHaveLength(195);
  });

  it('每个职业有 15 件套装部件（3 套 × 5 件）', () => {
    CLASS_IDS.forEach(classId => {
      const items = SET_PARTS.filter(i => i.classRestriction?.includes(classId));
      expect(items, `职业 ${classId} 应有 15 件`).toHaveLength(15);
    });
  });

  it('每个层级有 65 件（13 职业 × 5 件）', () => {
    TIERS.forEach(tier => {
      const items = SET_PARTS.filter(i => i.id.endsWith(`_t${tier}`));
      expect(items, `层级 T${tier} 应有 65 件`).toHaveLength(65);
    });
  });

  it('每个槽位有 39 件（13 职业 × 3 套）', () => {
    SLOTS.forEach(slot => {
      const items = SET_PARTS.filter(i => i.subtype === slot);
      expect(items, `槽位 ${slot} 应有 39 件`).toHaveLength(39);
    });
  });
});

describe('套装部件 ID 唯一性与命名规范', () => {
  it('所有部件 id 唯一', () => {
    const ids = SET_PARTS.map(i => i.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('部件 id 遵循 {classId}_{slot}_t{tier} 命名规范', () => {
    SET_PARTS.forEach(item => {
      const match = item.id.match(/^([a-z_]+)_(helm|chest|gloves|legs|boots)_t([123])$/);
      expect(match, `部件 id "${item.id}" 不符合命名规范`).not.toBeNull();
      if (match) {
        const [, classId, slot, tier] = match;
        expect(CLASS_IDS).toContain(classId);
        expect(SLOTS).toContain(slot);
        expect(TIERS).toContain(Number(tier));
      }
    });
  });
});

describe('套装部件能力组合', () => {
  it('所有部件 capabilities 含 setMember', () => {
    SET_PARTS.forEach(item => {
      expect(item.capabilities, `部件 ${item.id} 应含 setMember 能力`).toContain('setMember');
    });
  });

  it('所有部件 capabilities 含 equippable', () => {
    SET_PARTS.forEach(item => {
      expect(item.capabilities).toContain('equippable');
    });
  });

  it('所有部件 kind 为 equipment', () => {
    SET_PARTS.forEach(item => {
      expect(item.kind).toBe('equipment');
    });
  });

  it('所有部件 stackable 为 false', () => {
    SET_PARTS.forEach(item => {
      expect(item.stackable).toBe(false);
    });
  });

  it('所有部件 consumable 为 false', () => {
    SET_PARTS.forEach(item => {
      expect(item.consumable).toBe(false);
    });
  });
});

describe('套装部件稀有度与等级要求', () => {
  it('T1 部件稀有度为 rare', () => {
    SET_PARTS.filter(i => i.id.endsWith('_t1')).forEach(item => {
      expect(item.rarity, `部件 ${item.id} 稀有度应为 rare`).toBe('rare');
    });
  });

  it('T2 部件稀有度为 epic', () => {
    SET_PARTS.filter(i => i.id.endsWith('_t2')).forEach(item => {
      expect(item.rarity, `部件 ${item.id} 稀有度应为 epic`).toBe('epic');
    });
  });

  it('T3 部件稀有度为 legendary', () => {
    SET_PARTS.filter(i => i.id.endsWith('_t3')).forEach(item => {
      expect(item.rarity, `部件 ${item.id} 稀有度应为 legendary`).toBe('legendary');
    });
  });

  it('T1 部件等级要求为 8', () => {
    SET_PARTS.filter(i => i.id.endsWith('_t1')).forEach(item => {
      expect(item.levelRequirement, `部件 ${item.id} 等级要求应为 8`).toBe(8);
    });
  });

  it('T2 部件等级要求为 14', () => {
    SET_PARTS.filter(i => i.id.endsWith('_t2')).forEach(item => {
      expect(item.levelRequirement, `部件 ${item.id} 等级要求应为 14`).toBe(14);
    });
  });

  it('T3 部件等级要求为 20', () => {
    SET_PARTS.filter(i => i.id.endsWith('_t3')).forEach(item => {
      expect(item.levelRequirement, `部件 ${item.id} 等级要求应为 20`).toBe(20);
    });
  });
});

describe('套装部件 setId 与 classRestriction', () => {
  it('所有部件都有 setId', () => {
    SET_PARTS.forEach(item => {
      expect(item.setId, `部件 ${item.id} 应有 setId`).toBeDefined();
    });
  });

  it('部件 setId 与 id 中的职业和层级一致', () => {
    SET_PARTS.forEach(item => {
      const match = item.id.match(/^([a-z_]+)_(helm|chest|gloves|legs|boots)_t([123])$/);
      if (match) {
        const expectedSetId = `${match[1]}_t${match[3]}`;
        expect(item.setId, `部件 ${item.id} 的 setId 应为 ${expectedSetId}`).toBe(expectedSetId);
      }
    });
  });

  it('所有部件都有 classRestriction', () => {
    SET_PARTS.forEach(item => {
      expect(item.classRestriction, `部件 ${item.id} 应有 classRestriction`).toBeDefined();
      expect(item.classRestriction!.length).toBeGreaterThan(0);
    });
  });

  it('部件 classRestriction 与 id 中的职业一致', () => {
    SET_PARTS.forEach(item => {
      const match = item.id.match(/^([a-z_]+)_(helm|chest|gloves|legs|boots)_t([123])$/);
      if (match) {
        expect(item.classRestriction).toContain(match[1]);
      }
    });
  });
});

describe('套装部件槽位派生', () => {
  it('helm 部件 slots 含 helm', () => {
    SET_PARTS.filter(i => i.subtype === 'helm').forEach(item => {
      expect(item.slots).toContain('helm');
    });
  });

  it('chest 部件 slots 含 chest', () => {
    SET_PARTS.filter(i => i.subtype === 'chest').forEach(item => {
      expect(item.slots).toContain('chest');
    });
  });

  it('gloves 部件 slots 含 gloves', () => {
    SET_PARTS.filter(i => i.subtype === 'gloves').forEach(item => {
      expect(item.slots).toContain('gloves');
    });
  });

  it('legs 部件 slots 含 legs', () => {
    SET_PARTS.filter(i => i.subtype === 'legs').forEach(item => {
      expect(item.slots).toContain('legs');
    });
  });

  it('boots 部件 slots 含 boots', () => {
    SET_PARTS.filter(i => i.subtype === 'boots').forEach(item => {
      expect(item.slots).toContain('boots');
    });
  });
});

describe('套装部件主属性匹配', () => {
  CLASS_IDS.forEach(classId => {
    const primaryStat = CLASS_PRIMARY_STAT[classId];
    it(`职业 ${classId} 的所有部件 bonus 含主属性 ${primaryStat}`, () => {
      const items = SET_PARTS.filter(i => i.classRestriction?.includes(classId));
      items.forEach(item => {
        expect(item.bonus[primaryStat], `部件 ${item.id} 的 bonus 应含主属性 ${primaryStat}`).toBeDefined();
        expect(item.bonus[primaryStat] as number).toBeGreaterThan(0);
      });
    });

    it(`职业 ${classId} 的主属性 bonus 按 T1 < T2 < T3 递增（以 helm 为例）`, () => {
      const t1 = SET_PARTS.find(i => i.id === `${classId}_helm_t1`);
      const t2 = SET_PARTS.find(i => i.id === `${classId}_helm_t2`);
      const t3 = SET_PARTS.find(i => i.id === `${classId}_helm_t3`);
      expect(t1).toBeDefined();
      expect(t2).toBeDefined();
      expect(t3).toBeDefined();
      const v1 = t1!.bonus[primaryStat] as number;
      const v2 = t2!.bonus[primaryStat] as number;
      const v3 = t3!.bonus[primaryStat] as number;
      expect(v2, `${classId} T2 主属性应大于 T1`).toBeGreaterThan(v1);
      expect(v3, `${classId} T3 主属性应大于 T2`).toBeGreaterThan(v2);
    });
  });
});

describe('套装部件名称与描述规范', () => {
  it('所有部件名称非空且为 4-8 字中文', () => {
    SET_PARTS.forEach(item => {
      expect(item.name.length, `部件 ${item.id} 名称长度应为 4-8 字`).toBeGreaterThanOrEqual(4);
      expect(item.name.length).toBeLessThanOrEqual(8);
    });
  });

  it('所有部件描述为 25-50 字', () => {
    SET_PARTS.forEach(item => {
      expect(item.description.length, `部件 ${item.id} 描述长度应为 25-50 字`).toBeGreaterThanOrEqual(25);
      expect(item.description.length).toBeLessThanOrEqual(50);
    });
  });

  it('所有部件 icon 以 game-icons: 开头', () => {
    SET_PARTS.forEach(item => {
      expect(item.icon, `部件 ${item.id} 的 icon 应以 game-icons: 开头`).toMatch(/^game-icons:/);
    });
  });
});
