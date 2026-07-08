/**
 * @fileoverview 数据库辅助工具单元测试
 *
 * 覆盖范围：
 * 1. toRawData —— 去除 Vue/Proxy 响应式包装，返回纯数据
 *    - 普通对象深拷贝
 *    - Vue reactive 对象去 Proxy 化
 *    - 数组处理
 *    - 嵌套对象处理
 *    - 修改结果不影响原对象
 * 2. generateId —— 唯一 ID 生成
 *    - 前缀正确
 *    - 格式校验
 *    - 唯一性
 */
import { describe, it, expect } from 'vitest';
import { reactive, readonly, ref } from 'vue';
import { toRawData, generateId } from '@/utils/db-helpers';

describe('toRawData 数据清洗', () => {
  it('普通对象返回深拷贝', () => {
    const obj = { a: 1, b: 'hello', c: true };
    const raw = toRawData(obj);
    expect(raw).toEqual(obj);
    expect(raw).not.toBe(obj); // 不同引用
  });

  it('修改返回值不影响原对象（深拷贝）', () => {
    const obj = { a: 1, nested: { x: 10 } };
    const raw = toRawData(obj);
    raw.a = 999;
    raw.nested.x = 999;
    expect(obj.a).toBe(1);
    expect(obj.nested.x).toBe(10);
  });

  it('去除 Vue reactive 的 Proxy 包装', () => {
    const reactiveObj = reactive({ a: 1, b: { c: 2 } });
    const raw = toRawData(reactiveObj);
    // 结果应为普通对象，修改不影响 reactive 源
    expect(raw).toEqual({ a: 1, b: { c: 2 } });
    raw.a = 999;
    raw.b.c = 999;
    expect(reactiveObj.a).toBe(1);
    expect(reactiveObj.b.c).toBe(2);
  });

  it('处理数组（去除 reactive 数组的 Proxy）', () => {
    const reactiveArr = reactive([1, 2, 3]);
    const raw = toRawData(reactiveArr);
    expect(Array.isArray(raw)).toBe(true);
    expect(raw).toEqual([1, 2, 3]);
    // 修改结果不影响源
    raw.push(4);
    expect(reactiveArr).toHaveLength(3);
  });

  it('处理 readonly 对象', () => {
    const readonlyObj = readonly({ a: 1 });
    const raw = toRawData(readonlyObj);
    expect(raw).toEqual({ a: 1 });
    // raw 应为可变普通对象
    raw.a = 2;
    expect(raw.a).toBe(2);
  });

  it('处理 ref.value（解包后的 ref 值为 reactive 对象，需先 .value 再清洗）', () => {
    const r = ref({ count: 5 });
    // toRawData 通过 JSON 序列化剥离 Proxy，但 ref 本身的 toJSON 在当前环境不会被
    // JSON.stringify 调用，会保留 __v_isRef/_value 等内部属性。
    // 正确用法：先通过 .value 解包，再交给 toRawData 清洗 reactive 代理。
    const raw = toRawData(r.value);
    expect(raw).toEqual({ count: 5 });
    expect(raw).not.toBe(r.value); // 不同引用（深拷贝）
  });

  it('对 ref 对象本身不做解包（保留内部属性，需调用方先 .value）', () => {
    const r = ref({ count: 5 });
    const raw = toRawData(r) as unknown as { __v_isRef: boolean; _value: { count: number } };
    // 不解包直接传入会保留 ref 内部属性，这是已知的 JSON 序列化限制
    expect(raw.__v_isRef).toBe(true);
    expect(raw._value).toEqual({ count: 5 });
  });

  it('处理嵌套结构', () => {
    const obj = {
      list: [1, 2, { inner: true }],
      map: { a: { b: { c: 1 } } },
    };
    const raw = toRawData(obj);
    expect(raw).toEqual(obj);
    expect(raw.list).not.toBe(obj.list);
    expect(raw.map.a).not.toBe(obj.map.a);
  });

  it('处理 null 返回 null', () => {
    expect(toRawData(null)).toBeNull();
  });

  it('处理 undefined 会抛错（JSON.stringify(undefined) 返回 undefined 导致 JSON.parse 失败）', () => {
    expect(() => toRawData(undefined)).toThrow();
  });

  it('处理基本类型', () => {
    expect(toRawData(42)).toBe(42);
    expect(toRawData('hello')).toBe('hello');
    expect(toRawData(true)).toBe(true);
  });
});

describe('generateId 唯一 ID 生成', () => {
  it('使用指定前缀', () => {
    const id = generateId('character');
    expect(id.startsWith('character_')).toBe(true);
  });

  it('不同前缀生成不同 ID', () => {
    const a = generateId('a');
    const b = generateId('b');
    expect(a.startsWith('a_')).toBe(true);
    expect(b.startsWith('b_')).toBe(true);
  });

  it('格式为 prefix_timestamp_random', () => {
    const id = generateId('test');
    const parts = id.split('_');
    // test + timestamp + random
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe('test');
    // 第二段为数字时间戳
    expect(Number(parts[1])).toBeGreaterThan(0);
    // 第三段为随机串
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it('多次生成返回不同 ID（唯一性）', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId('uniq'));
    }
    expect(ids.size).toBe(100);
  });
});
