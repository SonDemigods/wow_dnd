/**
 * @fileoverview RNG 模块单元测试
 * @description 验证 Rng 接口实现、默认 RNG、seeded RNG 的确定性与分布
 */
import { describe, it, expect } from 'vitest';
import { createRngFromFn, defaultRng, createSeededRng, type Rng } from '@/utils/rng';

describe('RNG 模块', () => {
  describe('createRngFromFn', () => {
    it('应基于传入的随机函数生成 [0,1) 浮点数', () => {
      const rng = createRngFromFn(() => 0.5);
      expect(rng.next()).toBe(0.5);
    });

    it('int 应返回闭区间内的整数', () => {
      const rng = createRngFromFn(() => 0);
      expect(rng.int(1, 10)).toBe(1);
      const rngMax = createRngFromFn(() => 0.9999);
      expect(rngMax.int(1, 10)).toBe(10);
    });

    it('int 应处理 min > max 的边界情况', () => {
      const rng = createRngFromFn(() => 0.5);
      expect(rng.int(10, 1)).toBe(6); // 交换后 [1,10]，0.5 → 6
    });

    it('int 单元素区间应返回该元素', () => {
      const rng = createRngFromFn(() => 0.5);
      expect(rng.int(5, 5)).toBe(5);
    });

    it('bool 应根据概率返回判定结果', () => {
      expect(createRngFromFn(() => 0.4).bool(0.5)).toBe(true);
      expect(createRngFromFn(() => 0.6).bool(0.5)).toBe(false);
    });

    it('bool 概率 ≤0 恒 false，≥1 恒 true', () => {
      const rng = createRngFromFn(() => 0);
      expect(rng.bool(0)).toBe(false);
      expect(rng.bool(-1)).toBe(false);
      expect(rng.bool(1)).toBe(true);
      expect(rng.bool(1.5)).toBe(true);
    });

    it('pick 应从数组中选取对应索引元素', () => {
      const rng = createRngFromFn(() => 0);
      expect(rng.pick(['a', 'b', 'c'])).toBe('a');
      const rngMid = createRngFromFn(() => 0.5);
      expect(rngMid.pick(['a', 'b', 'c'])).toBe('b');
    });

    it('pick 空数组应抛出错误', () => {
      const rng = createRngFromFn(() => 0);
      expect(() => rng.pick([])).toThrow('数组不能为空');
    });

    it('shuffle 应返回洗牌后的新数组且不修改原数组', () => {
      const original = [1, 2, 3, 4, 5];
      const rng = createRngFromFn(() => 0);
      const shuffled = rng.shuffle(original);
      expect(original).toEqual([1, 2, 3, 4, 5]); // 原数组不变
      expect(shuffled).toHaveLength(5);
      expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]); // 元素一致
    });

    it('shuffle 空数组和单元素数组应返回副本', () => {
      const rng = createRngFromFn(() => 0);
      expect(rng.shuffle([])).toEqual([]);
      expect(rng.shuffle([42])).toEqual([42]);
    });
  });

  describe('defaultRng', () => {
    it('next 应返回 [0,1) 区间值', () => {
      const value = defaultRng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });

    it('int 多次采样应在合法范围内', () => {
      for (let i = 0; i < 100; i++) {
        const v = defaultRng.int(1, 100);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(100);
      }
    });

    it('pick 应返回数组中的元素', () => {
      const arr = [1, 2, 3];
      for (let i = 0; i < 20; i++) {
        expect(arr).toContain(defaultRng.pick(arr));
      }
    });
  });

  describe('createSeededRng', () => {
    it('相同 seed 应产生相同的序列', () => {
      const rng1 = createSeededRng(12345);
      const rng2 = createSeededRng(12345);
      const seq1 = Array.from({ length: 10 }, () => rng1.next());
      const seq2 = Array.from({ length: 10 }, () => rng2.next());
      expect(seq1).toEqual(seq2);
    });

    it('不同 seed 应产生不同的序列', () => {
      const rng1 = createSeededRng(1);
      const rng2 = createSeededRng(2);
      const seq1 = Array.from({ length: 5 }, () => rng1.next());
      const seq2 = Array.from({ length: 5 }, () => rng2.next());
      expect(seq1).not.toEqual(seq2);
    });

    it('next 应始终返回 [0,1) 区间值', () => {
      const rng = createSeededRng(99999);
      for (let i = 0; i < 1000; i++) {
        const v = rng.next();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });

    it('int 应始终返回闭区间内的整数', () => {
      const rng = createSeededRng(42);
      for (let i = 0; i < 200; i++) {
        const v = rng.int(1, 6);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(6);
      }
    });

    it('bool(1) 应恒 true，bool(0) 应恒 false', () => {
      const rng = createSeededRng(7);
      for (let i = 0; i < 50; i++) {
        expect(rng.bool(1)).toBe(true);
        expect(rng.bool(0)).toBe(false);
      }
    });

    it('pick 应返回数组中的有效元素', () => {
      const arr = ['x', 'y', 'z'];
      const rng = createSeededRng(100);
      for (let i = 0; i < 30; i++) {
        expect(arr).toContain(rng.pick(arr));
      }
    });

    it('shuffle 应保持元素集合一致', () => {
      const original = [1, 2, 3, 4, 5, 6, 7, 8];
      const rng = createSeededRng(2024);
      const shuffled = rng.shuffle(original);
      expect(shuffled).toHaveLength(original.length);
      expect(shuffled.sort((a, b) => a - b)).toEqual(original);
    });

    it('相同 seed 的 shuffle 结果应确定性复现', () => {
      const original = [1, 2, 3, 4, 5, 6, 7, 8];
      const r1 = createSeededRng(555);
      const r2 = createSeededRng(555);
      expect(r1.shuffle(original)).toEqual(r2.shuffle(original));
    });

    it('seed 负数应被截断为无符号 32 位处理', () => {
      // 负数 >>> 0 转为无符号，不应抛出
      const rng = createSeededRng(-1);
      expect(() => rng.next()).not.toThrow();
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    });

    it('分布均匀性：10000 次采样应在合理偏差内', () => {
      const rng = createSeededRng(31415);
      const buckets = [0, 0, 0, 0]; // [0,0.25), [0.25,0.5), [0.5,0.75), [0.75,1)
      for (let i = 0; i < 10000; i++) {
        const v = rng.next();
        buckets[Math.floor(v * 4)]++;
      }
      // 每个桶应在 2500 ± 200 内（约 8% 偏差容忍）
      for (const count of buckets) {
        expect(count).toBeGreaterThan(2300);
        expect(count).toBeLessThan(2700);
      }
    });
  });

  describe('Rng 接口契约', () => {
    it('自定义实现只需提供 next() 即可获得全部能力', () => {
      const customRng: Rng = createRngFromFn(() => 0.3);
      expect(customRng.next()).toBe(0.3);
      expect(customRng.bool(0.5)).toBe(true);
      expect(customRng.int(0, 9)).toBe(3); // floor(0.3 * 10) = 3，闭区间 [0,9]
      expect(customRng.pick([10, 20, 30])).toBe(10);
    });
  });
});
