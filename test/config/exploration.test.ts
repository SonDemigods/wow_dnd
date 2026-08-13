/**
 * @fileoverview 探索模块配置常量单元测试
 * @description 验证 @/config/exploration 中关键不变量：
 * - 网格尺寸为正整数
 * - 事件概率上限/下限与基础值的关系正确
 * - 随机事件概率阈值严格单调递增（累进区间分布），末项 < 1 留出兜底
 * - 多选项事件概率在 [0, 1]
 * - 稀有度等级映射严格单调递增
 * - 隐藏房间数量下限 <= 上限
 *
 * 概率阈值若非单调递增会导致随机事件分支逻辑错乱。
 */
import { describe, it, expect } from 'vitest';
import {
  GRID_SIZE,
  MONSTER_PROBABILITY_BASE,
  MONSTER_PROBABILITY_MAX,
  ITEM_PROBABILITY_BASE,
  ITEM_PROBABILITY_MIN,
  TRAP_PROBABILITY_BASE,
  TRAP_PROBABILITY_MAX,
  EMPTY_PROBABILITY_BASE,
  EMPTY_PROBABILITY_MIN,
  EVENT_PROBABILITY,
  PROBABILITY_NORMALIZATION_BASE,
  CAMP_HEAL_HP,
  CAMP_HEAL_MANA,
  TRAP_DAMAGE_BASE,
  TRAP_DAMAGE_VARIANCE,
  TRAP_DAMAGE_MIN,
  RANDOM_EVENT_HEAL_THRESHOLD,
  RANDOM_EVENT_MANA_THRESHOLD,
  RANDOM_EVENT_EXP_THRESHOLD,
  RANDOM_EVENT_DAMAGE_THRESHOLD,
  RANDOM_EVENT_MP_LOSS_THRESHOLD,
  MULTI_OPTION_EVENT_PROBABILITY,
  RARITY_LEVEL_MAP,
  HIDDEN_ROOM_MIN_COUNT,
  HIDDEN_ROOM_MAX_COUNT,
} from '@/config/exploration';

describe('探索配置 - 网格', () => {
  it('GRID_SIZE 为正整数', () => {
    expect(Number.isInteger(GRID_SIZE)).toBe(true);
    expect(GRID_SIZE).toBeGreaterThan(0);
  });
});

describe('探索配置 - 事件概率分布', () => {
  it('概率上限不小于基础值', () => {
    expect(MONSTER_PROBABILITY_MAX).toBeGreaterThanOrEqual(MONSTER_PROBABILITY_BASE);
    expect(TRAP_PROBABILITY_MAX).toBeGreaterThanOrEqual(TRAP_PROBABILITY_BASE);
  });

  it('概率下限不大于基础值', () => {
    expect(ITEM_PROBABILITY_MIN).toBeLessThanOrEqual(ITEM_PROBABILITY_BASE);
    expect(EMPTY_PROBABILITY_MIN).toBeLessThanOrEqual(EMPTY_PROBABILITY_BASE);
  });

  it('所有概率百分比为非负', () => {
    const probs = [
      MONSTER_PROBABILITY_BASE, MONSTER_PROBABILITY_MAX,
      ITEM_PROBABILITY_BASE, ITEM_PROBABILITY_MIN,
      TRAP_PROBABILITY_BASE, TRAP_PROBABILITY_MAX,
      EVENT_PROBABILITY,
      EMPTY_PROBABILITY_BASE, EMPTY_PROBABILITY_MIN,
    ];
    for (const p of probs) {
      expect(p).toBeGreaterThanOrEqual(0);
    }
  });

  it('PROBABILITY_NORMALIZATION_BASE 为正整数', () => {
    expect(Number.isInteger(PROBABILITY_NORMALIZATION_BASE)).toBe(true);
    expect(PROBABILITY_NORMALIZATION_BASE).toBeGreaterThan(0);
  });
});

describe('探索配置 - 随机事件概率阈值（单调递增）', () => {
  const thresholds = [
    RANDOM_EVENT_HEAL_THRESHOLD,
    RANDOM_EVENT_MANA_THRESHOLD,
    RANDOM_EVENT_EXP_THRESHOLD,
    RANDOM_EVENT_DAMAGE_THRESHOLD,
    RANDOM_EVENT_MP_LOSS_THRESHOLD,
  ];

  it('所有阈值在 [0, 1] 区间', () => {
    for (const t of thresholds) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
    }
  });

  it('阈值严格单调递增（累进区间分布）', () => {
    for (let i = 1; i < thresholds.length; i++) {
      expect(thresholds[i]).toBeGreaterThan(thresholds[i - 1]);
    }
  });

  it('最后一个阈值 < 1（留出兜底金币事件区间）', () => {
    expect(RANDOM_EVENT_MP_LOSS_THRESHOLD).toBeLessThan(1);
  });
});

describe('探索配置 - 多选项事件概率', () => {
  it('MULTI_OPTION_EVENT_PROBABILITY 在 [0, 1] 区间', () => {
    expect(MULTI_OPTION_EVENT_PROBABILITY).toBeGreaterThanOrEqual(0);
    expect(MULTI_OPTION_EVENT_PROBABILITY).toBeLessThanOrEqual(1);
  });
});

describe('探索配置 - 营地恢复', () => {
  it('CAMP_HEAL_HP / CAMP_HEAL_MANA 为正数', () => {
    expect(CAMP_HEAL_HP).toBeGreaterThan(0);
    expect(CAMP_HEAL_MANA).toBeGreaterThan(0);
  });
});

describe('探索配置 - 陷阱伤害', () => {
  it('TRAP_DAMAGE_BASE / VARIANCE / MIN 为非负', () => {
    expect(TRAP_DAMAGE_BASE).toBeGreaterThanOrEqual(0);
    expect(TRAP_DAMAGE_VARIANCE).toBeGreaterThanOrEqual(0);
    expect(TRAP_DAMAGE_MIN).toBeGreaterThanOrEqual(0);
  });
});

describe('探索配置 - 稀有度等级映射', () => {
  const EXPECTED = ['common', 'uncommon', 'rare', 'epic'] as const;

  it('包含 common/uncommon/rare/epic 四档', () => {
    for (const k of EXPECTED) {
      expect(RARITY_LEVEL_MAP).toHaveProperty(k);
    }
  });

  it('等级值严格单调递增', () => {
    expect(RARITY_LEVEL_MAP.common).toBeLessThan(RARITY_LEVEL_MAP.uncommon);
    expect(RARITY_LEVEL_MAP.uncommon).toBeLessThan(RARITY_LEVEL_MAP.rare);
    expect(RARITY_LEVEL_MAP.rare).toBeLessThan(RARITY_LEVEL_MAP.epic);
  });

  it('所有等级值为正整数', () => {
    for (const k of EXPECTED) {
      expect(Number.isInteger(RARITY_LEVEL_MAP[k])).toBe(true);
      expect(RARITY_LEVEL_MAP[k]).toBeGreaterThan(0);
    }
  });
});

describe('探索配置 - 隐藏房间数量', () => {
  it('下限 <= 上限', () => {
    expect(HIDDEN_ROOM_MIN_COUNT).toBeLessThanOrEqual(HIDDEN_ROOM_MAX_COUNT);
  });

  it('下限为正整数', () => {
    expect(Number.isInteger(HIDDEN_ROOM_MIN_COUNT)).toBe(true);
    expect(HIDDEN_ROOM_MIN_COUNT).toBeGreaterThan(0);
  });
});
