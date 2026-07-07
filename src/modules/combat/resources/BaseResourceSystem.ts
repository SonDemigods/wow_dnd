/**
 * @fileoverview 资源系统抽象基类
 * @description 提供 ResourceSystem 接口的通用实现，子类只需关注资源生成规则和事件钩子。
 *              避免每个资源系统重复编写 consume/hasEnough/valueRef 等通用逻辑。
 * @module combat/resources
 */
import { ref, type Ref } from 'vue';
import type { ResourceSystem, ResourceSource } from './types';

/**
 * 资源系统抽象基类
 *
 * 封装通用的资源值管理逻辑：
 * - 维护响应式 `value` 和 `maxValue`
 * - `consume` / `hasEnough` 通用实现
 * - `reset` 重置为初始值
 *
 * 子类需实现：
 * - `generate(amount, source)`：按来源差异化生成资源
 * - 可选重写事件钩子（onTurnStart / onAttack / onDamaged 等）
 */
export abstract class BaseResourceSystem implements ResourceSystem {
  abstract readonly type: ResourceSystem['type'];
  /** 是否为整数型资源，子类可在构造时通过 `isInteger` 参数指定 */
  readonly isInteger: boolean;

  protected _value: Ref<number>;
  protected _maxValue: Ref<number>;
  /** 战斗开始时的初始值 */
  protected readonly initialValue: number;

  constructor(options: {
    maxValue: number;
    initialValue?: number;
    isInteger?: boolean;
  }) {
    this._maxValue = ref(options.maxValue);
    this.initialValue = options.initialValue ?? 0;
    this._value = ref(this.initialValue);
    this.isInteger = options.isInteger ?? false;
  }

  get currentValue(): number {
    return this._value.value;
  }

  get maxValue(): number {
    return this._maxValue.value;
  }

  get valueRef(): Ref<number> {
    return this._value;
  }

  get maxValueRef(): Readonly<Ref<number>> {
    return this._maxValue;
  }

  /**
   * 生成资源的通用入口，子类实现具体规则。
   * 已内置边界裁剪（不超过上限，不为负），子类无需重复处理。
   */
  abstract generate(amount: number, source: ResourceSource): void;

  /**
   * 内部生成资源的辅助方法，应用整数化和边界约束。
   * 子类的 `generate` 实现应通过此方法实际增加值。
   */
  protected applyGeneration(amount: number): void {
    if (amount <= 0) return;
    let next = this._value.value + amount;
    if (this.isInteger) next = Math.floor(next);
    this._value.value = Math.min(this._maxValue.value, next);
  }

  consume(amount: number): boolean {
    if (!this.hasEnough(amount)) return false;
    let next = this._value.value - amount;
    if (this.isInteger) next = Math.floor(next);
    this._value.value = Math.max(0, next);
    return true;
  }

  hasEnough(amount: number): boolean {
    return this._value.value >= amount;
  }

  reset(): void {
    this._value.value = this.initialValue;
  }
}
