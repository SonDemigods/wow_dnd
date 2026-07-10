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
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { reactive, readonly, ref } from 'vue';
import { toRawData, generateId, BaseDbService } from '@/utils/db-helpers';

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

// ============================================================================
// BaseDbService 通用数据层基类
// ============================================================================

/** 测试用业务对象类型 */
interface TestItem {
  id: string;
  name: string;
  value: number;
}

/** 测试用 DB 存储格式（含额外时间戳） */
interface TestItemStorage {
  id: string;
  name: string;
  value: number;
  _ts: number;
}

/** 创建 mock table，符合 BaseDbService 构造函数参数的接口 */
function createMockTable() {
  return {
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
    toArray: vi.fn().mockResolvedValue([]),
    bulkPut: vi.fn().mockResolvedValue(undefined),
  };
}

/** 默认子类：不覆盖 toStorage/toRuntime（直接返回原对象） */
class DefaultTestService extends BaseDbService<TestItem> {
  constructor(table: ReturnType<typeof createMockTable>) {
    super(table, 'id');
  }
}

/** 自定义子类：覆盖 toStorage/toRuntime 测试转换逻辑 */
class CustomTestService extends BaseDbService<TestItem, TestItemStorage> {
  constructor(table: ReturnType<typeof createMockTable>) {
    super(table, 'id');
  }
  protected toStorage(data: TestItem): TestItemStorage {
    return { ...data, _ts: 100 };
  }
  protected toRuntime(data: TestItemStorage): TestItem {
    const { _ts: _omit, ...rest } = data;
    return rest;
  }
}

describe('BaseDbService 通用数据层基类', () => {
  describe('save：保存单条记录', () => {
    it('调用 toStorage + toRawData + table.put', async () => {
      // Arrange
      const table = createMockTable();
      const service = new DefaultTestService(table);
      const item: TestItem = { id: 'a', name: 'A', value: 1 };

      // Act
      await service.save(item);

      // Assert
      expect(table.put).toHaveBeenCalledTimes(1);
      const saved = table.put.mock.calls[0][0];
      expect(saved.id).toBe('a');
      expect(saved.name).toBe('A');
      // toRawData 深拷贝后应为不同引用
      expect(saved).not.toBe(item);
    });

    it('自定义 toStorage 子类：转换后写入（含 _ts 字段）', async () => {
      // Arrange
      const table = createMockTable();
      const service = new CustomTestService(table);
      const item: TestItem = { id: 'b', name: 'B', value: 2 };

      // Act
      await service.save(item);

      // Assert
      const saved = table.put.mock.calls[0][0] as TestItemStorage;
      expect(saved._ts).toBe(100);
      expect(saved.name).toBe('B');
    });
  });

  describe('saveAll：批量保存', () => {
    it('调用 table.bulkPut 一次，传入数组', async () => {
      // Arrange
      const table = createMockTable();
      const service = new DefaultTestService(table);
      const items: TestItem[] = [
        { id: 'a', name: 'A', value: 1 },
        { id: 'b', name: 'B', value: 2 },
      ];

      // Act
      await service.saveAll(items);

      // Assert
      expect(table.bulkPut).toHaveBeenCalledTimes(1);
      const saved = table.bulkPut.mock.calls[0][0] as TestItem[];
      expect(saved).toHaveLength(2);
      expect(saved[0].id).toBe('a');
      expect(saved[1].id).toBe('b');
      // 每项都经过 toRawData 深拷贝
      expect(saved[0]).not.toBe(items[0]);
    });

    it('空数组也正常调用 bulkPut', async () => {
      // Arrange
      const table = createMockTable();
      const service = new DefaultTestService(table);

      // Act
      await service.saveAll([]);

      // Assert
      expect(table.bulkPut).toHaveBeenCalledWith([]);
    });
  });

  describe('getById：按主键查询', () => {
    it('存在时返回 toRuntime 转换后的对象', async () => {
      // Arrange
      const table = createMockTable();
      table.get.mockResolvedValue({ id: 'a', name: 'A', value: 1, _ts: 100 });
      const service = new CustomTestService(table);

      // Act
      const result = await service.getById('a');

      // Assert
      expect(table.get).toHaveBeenCalledWith('a');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('a');
      // toRuntime 应移除 _ts 字段
      expect(result).not.toHaveProperty('_ts');
    });

    it('不存在时返回 null', async () => {
      // Arrange
      const table = createMockTable();
      table.get.mockResolvedValue(undefined);
      const service = new DefaultTestService(table);

      // Act
      const result = await service.getById('non-existent');

      // Assert
      expect(result).toBeNull();
    });

    it('默认 toRuntime（DefaultTestService 不覆盖）直接返回原对象', async () => {
      // Arrange：DefaultTestService 不覆盖 toStorage/toRuntime，使用基类默认实现
      const table = createMockTable();
      table.get.mockResolvedValue({ id: 'a', name: 'A', value: 1 });
      const service = new DefaultTestService(table);

      // Act
      const result = await service.getById('a');

      // Assert：默认 toRuntime 直接返回（data as unknown as T）
      expect(result).not.toBeNull();
      expect(result!.id).toBe('a');
      expect(result!.name).toBe('A');
      expect(result!.value).toBe(1);
    });
  });

  describe('getAll：获取全部记录', () => {
    it('调用 toArray 并 map toRuntime', async () => {
      // Arrange
      const table = createMockTable();
      table.toArray.mockResolvedValue([
        { id: 'a', name: 'A', value: 1, _ts: 100 },
        { id: 'b', name: 'B', value: 2, _ts: 200 },
      ]);
      const service = new CustomTestService(table);

      // Act
      const result = await service.getAll();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('a');
      expect(result[1].id).toBe('b');
      // toRuntime 移除 _ts
      expect(result[0]).not.toHaveProperty('_ts');
    });

    it('空表返回空数组', async () => {
      // Arrange
      const table = createMockTable();
      table.toArray.mockResolvedValue([]);
      const service = new DefaultTestService(table);

      // Act
      const result = await service.getAll();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('deleteById：按主键删除', () => {
    it('调用 table.delete 传入主键', async () => {
      // Arrange
      const table = createMockTable();
      const service = new DefaultTestService(table);

      // Act
      await service.deleteById('target-id');

      // Assert
      expect(table.delete).toHaveBeenCalledWith('target-id');
    });
  });

  describe('getKey：获取主键值', () => {
    it('默认 keyField="id" 时返回 id 字段', () => {
      // Arrange
      const table = createMockTable();
      const service = new DefaultTestService(table);
      const item: TestItem = { id: 'my-id', name: 'N', value: 0 };

      // Act：调用 protected getKey（通过类型断言访问）
      const key = (service as unknown as { getKey(data: TestItem): string }).getKey(item);

      // Assert
      expect(key).toBe('my-id');
    });

    it('自定义 keyField 时返回对应字段值', () => {
      // Arrange：使用 name 作为主键
      const table = createMockTable();
      class NameKeyService extends BaseDbService<TestItem> {
        constructor(t: ReturnType<typeof createMockTable>) {
          super(t, 'name');
        }
      }
      const service = new NameKeyService(table);
      const item: TestItem = { id: 'x', name: 'key-by-name', value: 0 };

      // Act
      const key = (service as unknown as { getKey(data: TestItem): string }).getKey(item);

      // Assert
      expect(key).toBe('key-by-name');
    });
  });

  describe('自定义 keyField', () => {
    it('支持非 id 的主键字段名', async () => {
      // Arrange
      const table = createMockTable();
      // 使用 name 作为主键
      class NameKeyService extends BaseDbService<TestItem> {
        constructor(t: ReturnType<typeof createMockTable>) {
          super(t, 'name');
        }
      }
      const service = new NameKeyService(table);
      const item: TestItem = { id: 'x', name: 'custom-key', value: 0 };

      // Act
      await service.save(item);

      // Assert：keyField 配置为 'name'
      expect((service as unknown as { keyField: string }).keyField).toBe('name');
      expect(table.put).toHaveBeenCalledTimes(1);
    });
  });
});
