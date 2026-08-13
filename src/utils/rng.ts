/**
 * @fileoverview 统一随机数生成器（RNG）模块
 * @description 提供项目内所有随机性的统一入口，支持注入确定性 RNG 实现战斗回放与测试复现。
 *
 * 设计目标：
 *   1. 统一收敛项目中散落的 `Math.random()` 调用（阶段十二架构暂缓 #145）
 *   2. 通过可选 `rng` 参数注入确定性随机源，相同 seed 产生相同序列
 *   3. 默认行为完全兼容 `Math.random`，生产环境调用无需传参
 *
 * 注入模式（参考 enemy/service.ts 的 calculateEnemyDamage 既有 randomFn 模式）：
 *   - 顶层纯函数：`function foo(..., rng: Rng = defaultRng): ...`
 *   - 接口实现类：`constructor(private rng: Rng = defaultRng)`
 *   - 事件处理器：扩展 context 接口加入 `rng: Rng` 字段
 *
 * 算法说明：
 *   - `createSeededRng` 采用 mulberry32 算法（32 位状态，周期 2^32），
 *     速度快、分布均匀，适合游戏确定性回放场景
 *   - `defaultRng` 直接委托 `Math.random`，零开销
 *
 * @module utils/rng
 */

/**
 * 随机数生成器接口
 *
 * 所有方法均基于 `next()` 派生，注入时只需提供 `next()` 实现即可获得全部能力。
 * 通过此接口统一项目中所有随机性调用点，便于测试注入与确定性回放。
 */
export interface Rng {
  /**
   * 返回 [0, 1) 区间的浮点数，等价于 `Math.random()`
   *
   * 这是 RNG 的原语方法，其他方法均基于此派生。
   * 自定义 RNG 实现只需提供此方法。
   */
  next(): number;

  /**
   * 返回 [min, max] 闭区间内的整数
   *
   * @param min - 最小值（含）
   * @param max - 最大值（含）
   * @returns 闭区间内的随机整数；min > max 时交换边界处理
   *
   * @example
   * rng.int(1, 6)  // 模拟六面骰子，返回 1~6
   * rng.int(0, arr.length - 1)  // 随机数组索引
   */
  int(min: number, max: number): number;

  /**
   * 概率判定，返回 `next() < probability` 的结果
   *
   * @param probability - 触发概率，[0, 1] 区间。≤0 恒 false，≥1 恒 true
   * @returns 是否触发
   *
   * @example
   * rng.bool(0.05)  // 5% 暴击判定
   * rng.bool(0.3)   // 30% 技能使用概率
   */
  bool(probability: number): boolean;

  /**
   * 从数组中随机选取一个元素
   *
   * @param arr - 候选数组（不会修改原数组）
   * @returns 随机元素；数组为空时抛出 Error
   *
   * @example
   * rng.pick(['a', 'b', 'c'])  // 随机返回其中一个
   * rng.pick(skills)  // 随机选择技能
   */
  pick<T>(arr: readonly T[]): T;

  /**
   * Fisher-Yates 洗牌算法（返回新数组，不修改原数组）
   *
   * 用于物品池洗牌、网格空位打乱等场景，相比 `sort(() => Math.random() - 0.5)`
   * 分布更均匀（BIZ-8 修复确立的规范）。
   *
   * @param arr - 待洗牌数组（不会修改原数组）
   * @returns 洗牌后的新数组
   *
   * @example
   * const shuffled = rng.shuffle([1, 2, 3, 4, 5])
   */
  shuffle<T>(arr: readonly T[]): T[];
}

/**
 * 从 `() => number` 随机函数创建 Rng 实例
 *
 * 适配现有的 `randomFn: () => number = Math.random` 模式，
 * 便于逐步迁移到统一 Rng 接口。
 *
 * @param randomFn - 返回 [0, 1) 浮点数的随机函数
 * @returns 实现 Rng 接口的对象
 */
export function createRngFromFn(randomFn: () => number): Rng {
  const next = randomFn;
  const int = (min: number, max: number): number => {
    // 处理 min > max 的边界情况，保证健壮性
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    return Math.floor(next() * (hi - lo + 1)) + lo;
  };
  const bool = (probability: number): boolean => next() < probability;
  const pick = <T>(arr: readonly T[]): T => {
    if (arr.length === 0) throw new Error('pick: 数组不能为空');
    return arr[Math.floor(next() * arr.length)];
  };
  const shuffle = <T>(arr: readonly T[]): T[] => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  return { next, int, bool, pick, shuffle };
}

/**
 * 默认 RNG（基于 `Math.random`）
 *
 * 生产环境的统一默认值。所有接受可选 `rng` 参数的函数都以此作为默认值，
 * 调用方无需传参即可保持与原 `Math.random()` 完全一致的行为。
 *
 * 实现说明：所有方法均通过属性访问 `Math.random()` 而非捕获函数引用，
 * 确保 `vi.spyOn(Math, 'random')` 等测试 mock 能正确生效。
 * （`createRngFromFn(Math.random)` 会捕获原始引用，导致 spy 不生效。）
 */
export const defaultRng: Rng = {
  next: () => Math.random(),
  int: (min: number, max: number): number => {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  },
  bool: (probability: number): boolean => Math.random() < probability,
  pick: <T>(arr: readonly T[]): T => {
    if (arr.length === 0) throw new Error('pick: 数组不能为空');
    return arr[Math.floor(Math.random() * arr.length)];
  },
  shuffle: <T>(arr: readonly T[]): T[] => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  },
};

/**
 * 创建确定性 seeded RNG（mulberry32 算法）
 *
 * 相同 seed 产生完全相同的随机数序列，适用于：
 *   - 战斗回放：记录 seed + 行动序列，即可精确复现整场战斗
 *   - 单元测试：注入固定 seed，断言随机性相关的确切结果
 *   - 确定性生成：地图/关卡按 seed 可复现
 *
 * @param seed - 种子值（32 位整数，超出范围会被 `| 0` 截断）
 * @returns 实现 Rng 接口的确定性 RNG
 *
 * @example
 * const rng = createSeededRng(12345)
 * rng.next()  // 始终返回相同值
 * rng.int(1, 100)  // 始终返回相同值
 */
export function createSeededRng(seed: number): Rng {
  // mulberry32 算法：32 位状态 PRNG
  // 参考：https://gist.github.com/tommyettinger/46a874533aa6528a8fcf8f0e2a2d5f0f
  // 周期 2^32，分布均匀，速度快，适合游戏确定性场景
  let state = seed >>> 0;
  const randomFn = (): number => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return createRngFromFn(randomFn);
}
