/**
 * @fileoverview 坐骑方向配置数据单元测试
 *
 * 验证 36 个方向定义（plan.md §7）的数据完整性：
 * - 方向总数 36（前 3 档 × 6 单属性 + 后 2 档 × 9 双属性）
 * - ID 唯一性与命名规范（`${tier}_${direction}`）
 * - bonus 与档位 bonusTotal 一致性
 * - 5 档点数包总和 = 40（plan.md §1.2 约束）
 * - 双属性方向约束（3 主攻 × 3 次属性 = 9 组合，主攻间不组合）
 * - 查询函数 getMountOptionById / getMountOptionsByTier / getMountTierByIndex
 * - validateMountOptions 校验通过
 */
import { describe, it, expect } from 'vitest';
import {
  MOUNT_OPTIONS,
  MOUNT_TIERS,
  SINGLE_DIRECTIONS,
  DUAL_DIRECTIONS,
  getMountOptionById,
  getMountOptionsByTier,
  getMountTierByIndex,
  validateMountOptions,
} from '@/data/config_mounts';
import type { MountTier, MountDirection } from '@/data/config_mounts';

// ==================== 方向总数与分布 ====================

describe('坐骑方向总数与分布', () => {
  it('方向总数为 36（3 档 × 6 单属性 + 2 档 × 9 双属性）', () => {
    expect(MOUNT_OPTIONS).toHaveLength(36);
  });

  it('单属性方向 6 个（str/dex/int/con/wis/cha）', () => {
    expect(SINGLE_DIRECTIONS).toHaveLength(6);
    expect([...SINGLE_DIRECTIONS].sort()).toEqual(['cha', 'con', 'dex', 'int', 'str', 'wis']);
  });

  it('双属性方向 9 个（3 主攻 × 3 次属性）', () => {
    expect(DUAL_DIRECTIONS).toHaveLength(9);
    // 主攻属性间不可组合：不应出现 str_dex / str_int / dex_int 等
    const forbidden = ['str_dex', 'str_int', 'dex_int', 'dex_str', 'int_str', 'int_dex'];
    forbidden.forEach(d => {
      expect(DUAL_DIRECTIONS, `双属性方向不应包含主攻组合 ${d}`).not.toContain(d as MountDirection);
    });
  });

  it('前 3 档为单属性方向，每档 6 个', () => {
    const singleTiers: MountTier[] = ['common', 'uncommon', 'rare'];
    singleTiers.forEach(tier => {
      const opts = getMountOptionsByTier(tier);
      expect(opts, `档位 ${tier} 应有 6 个方向`).toHaveLength(6);
      opts.forEach(opt => {
        expect(SINGLE_DIRECTIONS, `${opt.id} 应为单属性方向`).toContain(opt.direction);
      });
    });
  });

  it('后 2 档为双属性方向，每档 9 个', () => {
    const dualTiers: MountTier[] = ['epic', 'legendary'];
    dualTiers.forEach(tier => {
      const opts = getMountOptionsByTier(tier);
      expect(opts, `档位 ${tier} 应有 9 个方向`).toHaveLength(9);
      opts.forEach(opt => {
        expect(DUAL_DIRECTIONS, `${opt.id} 应为双属性方向`).toContain(opt.direction);
      });
    });
  });
});

// ==================== ID 唯一性与命名规范 ====================

describe('ID 唯一性与命名规范', () => {
  it('所有方向 ID 唯一', () => {
    const ids = MOUNT_OPTIONS.map(o => o.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('ID 格式为 `${tier}_${direction}`', () => {
    MOUNT_OPTIONS.forEach(opt => {
      expect(opt.id, `${opt.id} 应为 ${opt.tier}_${opt.direction}`).toBe(`${opt.tier}_${opt.direction}`);
    });
  });

  it('每档方向 ID 前缀与 tier 一致', () => {
    MOUNT_OPTIONS.forEach(opt => {
      expect(opt.id.startsWith(opt.tier + '_'), `${opt.id} 应以 ${opt.tier}_ 开头`).toBe(true);
    });
  });
});

// ==================== bonus 一致性 ====================

describe('bonus 与档位 bonusTotal 一致性', () => {
  it('单属性方向：bonus 总和 = 档位 bonusTotal', () => {
    const singleTiers: MountTier[] = ['common', 'uncommon', 'rare'];
    singleTiers.forEach(tier => {
      const tierMeta = MOUNT_TIERS.find(t => t.tier === tier)!;
      getMountOptionsByTier(tier).forEach(opt => {
        const sum = Object.values(opt.bonus).reduce((a, b) => a + b, 0);
        expect(sum, `${opt.id} bonus 总和应为 ${tierMeta.bonusTotal}`).toBe(tierMeta.bonusTotal);
      });
    });
  });

  it('双属性方向：两属性值相等且总和 = 档位 bonusTotal', () => {
    const dualTiers: MountTier[] = ['epic', 'legendary'];
    dualTiers.forEach(tier => {
      const tierMeta = MOUNT_TIERS.find(t => t.tier === tier)!;
      getMountOptionsByTier(tier).forEach(opt => {
        const values = Object.values(opt.bonus);
        expect(values, `${opt.id} 应有 2 个属性键`).toHaveLength(2);
        expect(values[0], `${opt.id} 双属性值应相等`).toBe(values[1]);
        const sum = values.reduce((a, b) => a + b, 0);
        expect(sum, `${opt.id} bonus 总和应为 ${tierMeta.bonusTotal}`).toBe(tierMeta.bonusTotal);
      });
    });
  });

  it('各档点数包数值符合 plan §2.3（2/4/6/12/16）', () => {
    const expected: Record<MountTier, number> = {
      common: 2, uncommon: 4, rare: 6, epic: 12, legendary: 16,
    };
    MOUNT_TIERS.forEach(t => {
      expect(t.bonusTotal, `${t.tier} 档 bonusTotal 应为 ${expected[t.tier]}`).toBe(expected[t.tier]);
    });
  });

  it('5 档点数包总和 = 40（plan §1.2 约束）', () => {
    const total = MOUNT_TIERS.reduce((sum, t) => sum + t.bonusTotal, 0);
    expect(total).toBe(40);
  });
});

// ==================== 双属性方向约束 ====================

describe('双属性方向约束', () => {
  it('双属性方向均为「主攻 + 次属性」组合（主攻：str/dex/int，次属性：con/wis/cha）', () => {
    const primaryStats = ['str', 'dex', 'int'];
    const secondaryStats = ['con', 'wis', 'cha'];
    DUAL_DIRECTIONS.forEach(direction => {
      const [a, b] = direction.split('_');
      // 一个是主攻，一个是次属性
      const aIsPrimary = primaryStats.includes(a);
      const bIsPrimary = primaryStats.includes(b);
      const aIsSecondary = secondaryStats.includes(a);
      const bIsSecondary = secondaryStats.includes(b);
      expect(
        (aIsPrimary && bIsSecondary) || (aIsSecondary && bIsPrimary),
        `${direction} 应为「主攻 + 次属性」组合`
      ).toBe(true);
    });
  });

  it('9 个双属性方向覆盖 3 主攻 × 3 次属性 全组合', () => {
    const expected: string[] = [];
    ['str', 'dex', 'int'].forEach(p => {
      ['con', 'wis', 'cha'].forEach(s => {
        expected.push(`${p}_${s}`);
      });
    });
    expect([...DUAL_DIRECTIONS].sort()).toEqual([...expected].sort());
  });
});

// ==================== 满级配装上限 ====================

describe('满级配装上限（plan §2.3）', () => {
  it('单属性方向满级最高 +12（前 3 档同属性叠加 2+4+6）', () => {
    // 选 str 方向：common_str + uncommon_str + rare_str
    const choices = ['common_str', 'uncommon_str', 'rare_str', null, null];
    const bonus = choices
      .map(id => (id ? getMountOptionById(id) : undefined))
      .reduce<Record<string, number>>((acc, opt) => {
        if (!opt) return acc;
        Object.entries(opt.bonus).forEach(([k, v]) => {
          acc[k] = (acc[k] ?? 0) + (v as number);
        });
        return acc;
      }, {});
    expect(bonus.str).toBe(12);
  });

  it('双属性方向满级单属性最高 +14（epic+legendary 同方向叠加 6+8）', () => {
    // 选 str_con 方向：epic_str_con + legendary_str_con
    const choices = [null, null, null, 'epic_str_con', 'legendary_str_con'];
    const bonus = choices
      .map(id => (id ? getMountOptionById(id) : undefined))
      .reduce<Record<string, number>>((acc, opt) => {
        if (!opt) return acc;
        Object.entries(opt.bonus).forEach(([k, v]) => {
          acc[k] = (acc[k] ?? 0) + (v as number);
        });
        return acc;
      }, {});
    expect(bonus.str).toBe(14);
    expect(bonus.con).toBe(14);
  });

  it('极端力量流满级 str 最高 +26（前3档 12 + 后2档 14）', () => {
    const choices = ['common_str', 'uncommon_str', 'rare_str', 'epic_str_con', 'legendary_str_con'];
    const bonus = choices
      .map(id => (id ? getMountOptionById(id) : undefined))
      .reduce<Record<string, number>>((acc, opt) => {
        if (!opt) return acc;
        Object.entries(opt.bonus).forEach(([k, v]) => {
          acc[k] = (acc[k] ?? 0) + (v as number);
        });
        return acc;
      }, {});
    expect(bonus.str).toBe(26);
    expect(bonus.con).toBe(14);
  });
});

// ==================== 查询函数 ====================

describe('查询函数', () => {
  it('getMountOptionById：有效 ID 返回对应方向', () => {
    const opt = getMountOptionById('common_str');
    expect(opt).toBeDefined();
    expect(opt!.tier).toBe('common');
    expect(opt!.direction).toBe('str');
    expect(opt!.bonus).toEqual({ str: 2 });
  });

  it('getMountOptionById：双属性 ID 返回正确 bonus', () => {
    const opt = getMountOptionById('epic_str_con');
    expect(opt).toBeDefined();
    expect(opt!.bonus).toEqual({ str: 6, con: 6 });
  });

  it('getMountOptionById：无效 ID 返回 undefined', () => {
    expect(getMountOptionById('nonexistent')).toBeUndefined();
    expect(getMountOptionById('')).toBeUndefined();
  });

  it('getMountOptionsByTier：返回该档全部方向', () => {
    expect(getMountOptionsByTier('common')).toHaveLength(6);
    expect(getMountOptionsByTier('legendary')).toHaveLength(9);
  });

  it('getMountTierByIndex：有效索引返回元数据', () => {
    expect(getMountTierByIndex(0)?.tier).toBe('common');
    expect(getMountTierByIndex(4)?.tier).toBe('legendary');
    expect(getMountTierByIndex(0)?.unlockLevel).toBe(1);
    expect(getMountTierByIndex(4)?.unlockLevel).toBe(20);
  });

  it('getMountTierByIndex：越界索引返回 undefined', () => {
    expect(getMountTierByIndex(-1)).toBeUndefined();
    expect(getMountTierByIndex(5)).toBeUndefined();
  });
});

// ==================== 解锁规则 ====================

describe('档位解锁规则（plan §2.1）', () => {
  it('MOUNT_TIERS 解锁等级为 1/5/10/15/20', () => {
    const expectedLevels = [1, 5, 10, 15, 20];
    MOUNT_TIERS.forEach((t, i) => {
      expect(t.unlockLevel, `档位 ${t.tier} 解锁等级应为 ${expectedLevels[i]}`).toBe(expectedLevels[i]);
    });
  });

  it('MOUNT_TIERS 索引为 0-4 连续', () => {
    MOUNT_TIERS.forEach((t, i) => {
      expect(t.index, `档位 ${t.tier} 索引应为 ${i}`).toBe(i);
    });
  });

  it('前 3 档 directionType 为 single，后 2 档为 dual', () => {
    expect(MOUNT_TIERS[0].directionType).toBe('single');
    expect(MOUNT_TIERS[1].directionType).toBe('single');
    expect(MOUNT_TIERS[2].directionType).toBe('single');
    expect(MOUNT_TIERS[3].directionType).toBe('dual');
    expect(MOUNT_TIERS[4].directionType).toBe('dual');
  });
});

// ==================== 校验函数 ====================

describe('validateMountOptions 校验函数', () => {
  it('返回 36（全部通过）', () => {
    expect(validateMountOptions()).toBe(36);
  });
});
