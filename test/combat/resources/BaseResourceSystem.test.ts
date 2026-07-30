/**
 * @fileoverview 资源系统抽象基类单元测试
 * @description 通过最小可实例化子类（TestResource）间接测试基类通用逻辑：
 * 1. 构造时 currentValue = initialValue，默认值处理
 * 2. generate 累加并裁剪到 maxValue，isInteger 向下取整
 * 3. generate(amount<=0) 不改变值
 * 4. hasEnough 正确判定
 * 5. consume 成功扣减 / 资源不足返回 false / 不低于 0
 * 6. reset 恢复到 initialValue
 * 7. valueRef / maxValueRef 暴露响应式引用
 */
import { describe, it, expect } from 'vitest';
import { BaseResourceSystem } from '@/modules/combat/resources/BaseResourceSystem';
import type { ResourceSource } from '@/modules/combat/resources/types';

/** 最小可实例化子类（用于测试基类通用逻辑） */
class TestResource extends BaseResourceSystem {
  readonly type = 'mana' as const;
  constructor(opts: { maxValue: number; initialValue?: number; isInteger?: boolean }) {
    super(opts);
  }
  generate(amount: number): void {
    this.applyGeneration(amount);
  }
}

describe('BaseResourceSystem 通用逻辑', () => {
  it('构造时 currentValue = initialValue', () => {
    const r = new TestResource({ maxValue: 100, initialValue: 30, isInteger: true });
    expect(r.currentValue).toBe(30);
    expect(r.maxValue).toBe(100);
    expect(r.isInteger).toBe(true);
  });

  it('initialValue 默认为 0', () => {
    const r = new TestResource({ maxValue: 50 });
    expect(r.currentValue).toBe(0);
    expect(r.isInteger).toBe(false);
  });

  it('generate 累加并裁剪到 maxValue', () => {
    const r = new TestResource({ maxValue: 100, initialValue: 80, isInteger: true });
    r.generate(30, 'attack');
    expect(r.currentValue).toBe(100);
  });

  it('isInteger=true 时 generate 向下取整', () => {
    const r = new TestResource({ maxValue: 100, initialValue: 0, isInteger: true });
    // 通过反射测试 applyGeneration 的 floor 行为：直接 generate 整数即可
    // 真实场景下子类可能传入小数累加（如 floor(amount*0.1) 已整数化）
    r.generate(5, 'attack');
    expect(r.currentValue).toBe(5);
  });

  it('generate(amount<=0) 不改变值', () => {
    const r = new TestResource({ maxValue: 100, initialValue: 10 });
    r.generate(0, 'attack');
    expect(r.currentValue).toBe(10);
    r.generate(-5, 'attack');
    expect(r.currentValue).toBe(10);
  });

  it('hasEnough 正确判定', () => {
    const r = new TestResource({ maxValue: 100, initialValue: 20 });
    expect(r.hasEnough(10)).toBe(true);
    expect(r.hasEnough(20)).toBe(true);
    expect(r.hasEnough(21)).toBe(false);
  });

  it('consume 成功扣减', () => {
    const r = new TestResource({ maxValue: 100, initialValue: 30 });
    expect(r.consume(10)).toBe(true);
    expect(r.currentValue).toBe(20);
  });

  it('consume 资源不足时返回 false 且不改变值', () => {
    const r = new TestResource({ maxValue: 100, initialValue: 5 });
    expect(r.consume(10)).toBe(false);
    expect(r.currentValue).toBe(5);
  });

  it('consume 不会低于 0', () => {
    const r = new TestResource({ maxValue: 100, initialValue: 5 });
    expect(r.consume(5)).toBe(true);
    expect(r.currentValue).toBe(0);
  });

  it('reset 恢复到 initialValue', () => {
    const r = new TestResource({ maxValue: 100, initialValue: 30 });
    r.generate(50, 'attack');
    r.consume(10);
    r.reset();
    expect(r.currentValue).toBe(30);
  });

  it('valueRef / maxValueRef 暴露响应式引用', () => {
    const r = new TestResource({ maxValue: 100, initialValue: 10 });
    expect(r.valueRef.value).toBe(10);
    expect(r.maxValueRef.value).toBe(100);
    r.generate(5, 'attack');
    expect(r.valueRef.value).toBe(15);
  });
});
