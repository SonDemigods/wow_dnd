/**
 * @fileoverview critCalc helper 单元测试（QA-12）
 *
 * 覆盖：
 *   - rollPlayerCrit：各暴击几率边界（0/100/小数）+ RNG 注入 + 倍率常量
 *   - computeThornsDamage：基础计算 + 暴击倍率 + 向下取整 + 边界值
 *
 * 测试策略：
 *   rollPlayerCrit 直接依赖 Rng 接口，通过注入确定性 rng mock 控制判定结果，
 *   无需 mock service 模块，断言 rng.bool 调用入参即可验证归一化逻辑。
 */
import { describe, it, expect, vi } from 'vitest';
import { rollPlayerCrit, computeThornsDamage } from '@/modules/combat/composables/helpers/critCalc';
import { CRIT_DAMAGE_MULTIPLIER } from '@/config/combat';
import type { Rng } from '@/utils/rng';
import type { Attributes } from '@/modules/character';

// ==================== 测试数据构造 helper ====================

function makeAttrs(critChance: number): Attributes {
  return {
    strength: 0,
    dex: 0,
    constitution: 0,
    intelligence: 0,
    wisdom: 0,
    charisma: 0,
    physicalAttack: 0,
    physicalDefense: 0,
    magicAttack: 0,
    magicDefense: 0,
    critChance,
    dodgeChance: 0,
  } as unknown as Attributes;
}

/** 构造确定性 Rng mock，控制 bool 返回值 */
function makeRngMock(opts: { boolResult?: boolean } = {}): Rng {
  return {
    bool: vi.fn(() => opts.boolResult ?? false),
    int: vi.fn(),
    float: vi.fn(),
    next: vi.fn(),
    pick: vi.fn(),
    shuffle: vi.fn(),
  } as unknown as Rng;
}

// ==================== 测试用例 ====================

describe('critCalc helper（QA-12）', () => {
  // -------------------- rollPlayerCrit --------------------

  describe('rollPlayerCrit', () => {
    it('返回 { isCrit, multiplier } 结构', () => {
      const result = rollPlayerCrit(makeAttrs(0), makeRngMock());
      expect(result).toHaveProperty('isCrit');
      expect(result).toHaveProperty('multiplier');
      expect(typeof result.isCrit).toBe('boolean');
      expect(typeof result.multiplier).toBe('number');
    });

    it('critChance=0 时归一化为 0 概率并调用 rng.bool(0)', () => {
      const rng = makeRngMock({ boolResult: false });
      const result = rollPlayerCrit(makeAttrs(0), rng);
      // critChance 百分比归一化：0 / 100 = 0
      expect(rng.bool).toHaveBeenCalledWith(0);
      expect(result.isCrit).toBe(false);
      expect(result.multiplier).toBe(1);
    });

    it('critChance=100 时归一化为 1.0 概率', () => {
      const rng = makeRngMock({ boolResult: true });
      const result = rollPlayerCrit(makeAttrs(100), rng);
      // critChance 百分比归一化：100 / 100 = 1.0
      expect(rng.bool).toHaveBeenCalledWith(1.0);
      expect(result.isCrit).toBe(true);
      // 暴击倍率来自 CRIT_DAMAGE_MULTIPLIER 常量
      expect(result.multiplier).toBe(CRIT_DAMAGE_MULTIPLIER);
    });

    it('critChance=5 时归一化为 0.05 概率（百分比 → 小数）', () => {
      const rng = makeRngMock({ boolResult: true });
      rollPlayerCrit(makeAttrs(5), rng);
      expect(rng.bool).toHaveBeenCalledWith(0.05);
    });

    it('critChance=12.5 时归一化为 0.125（小数百分比支持）', () => {
      const rng = makeRngMock({ boolResult: false });
      rollPlayerCrit(makeAttrs(12.5), rng);
      expect(rng.bool).toHaveBeenCalledWith(0.125);
    });

    it('rng.bool 返回 true 时 multiplier 为 CRIT_DAMAGE_MULTIPLIER', () => {
      const rng = makeRngMock({ boolResult: true });
      const result = rollPlayerCrit(makeAttrs(50), rng);
      expect(result.isCrit).toBe(true);
      expect(result.multiplier).toBe(CRIT_DAMAGE_MULTIPLIER);
    });

    it('rng.bool 返回 false 时 multiplier 为 1', () => {
      const rng = makeRngMock({ boolResult: false });
      const result = rollPlayerCrit(makeAttrs(50), rng);
      expect(result.isCrit).toBe(false);
      expect(result.multiplier).toBe(1);
    });

    it('未注入 RNG 时使用 defaultRng（不抛错）', () => {
      // 不传 rng 参数，应使用默认 defaultRng
      expect(() => rollPlayerCrit(makeAttrs(50))).not.toThrow();
    });
  });

  // -------------------- computeThornsDamage --------------------

  describe('computeThornsDamage', () => {
    it('非暴击时 thorns × 1 = thorns 向下取整', () => {
      expect(computeThornsDamage(10, 1)).toBe(10);
    });

    it('暴击时 thorns × CRIT_DAMAGE_MULTIPLIER 向下取整', () => {
      // 10 × 1.5 = 15
      expect(computeThornsDamage(10, CRIT_DAMAGE_MULTIPLIER)).toBe(15);
    });

    it('小数结果向下取整', () => {
      // 7 × 1.5 = 10.5 → 10
      expect(computeThornsDamage(7, CRIT_DAMAGE_MULTIPLIER)).toBe(10);
      // 5 × 1.5 = 7.5 → 7
      expect(computeThornsDamage(5, CRIT_DAMAGE_MULTIPLIER)).toBe(7);
    });

    it('thorns=0 时返回 0', () => {
      expect(computeThornsDamage(0, CRIT_DAMAGE_MULTIPLIER)).toBe(0);
      expect(computeThornsDamage(0, 1)).toBe(0);
    });

    it('multiplier=0 时返回 0（防御性边界）', () => {
      expect(computeThornsDamage(100, 0)).toBe(0);
    });

    it('与 rollPlayerCrit 联动：暴击时荆棘反伤受倍率影响', () => {
      // 模拟 playerAttack 中的实际使用模式：
      //   const { isCrit, multiplier: critMultiplier } = rollPlayerCrit(attrs);
      //   const thornsDamage = computeThornsDamage(pipeResult.thorns, critMultiplier);
      const rngCrit = makeRngMock({ boolResult: true });
      const { multiplier: critMultiplier } = rollPlayerCrit(makeAttrs(50), rngCrit);
      // thorns=6, 暴击倍率 1.5 → 9
      expect(computeThornsDamage(6, critMultiplier)).toBe(9);

      const rngNoCrit = makeRngMock({ boolResult: false });
      const { multiplier: nonCritMultiplier } = rollPlayerCrit(makeAttrs(50), rngNoCrit);
      // thorns=6, 非暴击倍率 1 → 6
      expect(computeThornsDamage(6, nonCritMultiplier)).toBe(6);
    });
  });

  // -------------------- 常量来源验证 --------------------

  describe('CRIT_DAMAGE_MULTIPLIER 常量', () => {
    it('值为 1.5（与原硬编码保持一致，QA-12）', () => {
      expect(CRIT_DAMAGE_MULTIPLIER).toBe(1.5);
    });
  });
});
