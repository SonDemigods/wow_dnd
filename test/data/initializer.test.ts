/**
 * @fileoverview data/initializer.ts 子模块独立测试
 *
 * QA-11 拆分后，DataInitializer 类移至 ./initializer.ts。
 * 原有完整行为测试见 ./service.test.ts（通过 re-export 入口验证）。
 *
 * 本文件聚焦于子模块独立可导入性与实例化能力，确保 re-export 入口与子模块
 * 行为一致。深度行为测试由 service.test.ts 覆盖（基于 fake-indexeddb 真实执行）。
 */
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { DataInitializer } from '@/modules/data/initializer';
import { DataInitializer as DataInitializerFromService } from '@/modules/data/service';
import { dataInitializer } from '@/modules/data/service';

describe('data/initializer 子模块独立测试', () => {
  describe('模块导出', () => {
    it('DataInitializer 是可实例化的类', () => {
      const initializer = new DataInitializer();
      expect(initializer).toBeInstanceOf(DataInitializer);
    });

    it('从子模块与从 service.ts re-export 导入的是同一个类', () => {
      expect(DataInitializer).toBe(DataInitializerFromService);
    });

    it('service.ts 导出的 dataInitializer 实例是 DataInitializer 类的实例', () => {
      expect(dataInitializer).toBeInstanceOf(DataInitializer);
    });
  });

  describe('实例方法存在', () => {
    it('暴露 isDataInitialized 异步方法', () => {
      const initializer = new DataInitializer();
      expect(typeof initializer.isDataInitialized).toBe('function');
    });

    it('暴露 initializeData 异步方法', () => {
      const initializer = new DataInitializer();
      expect(typeof initializer.initializeData).toBe('function');
    });

    it('暴露 resetData 异步方法', () => {
      const initializer = new DataInitializer();
      expect(typeof initializer.resetData).toBe('function');
    });

    it('暴露 reinitializeData 异步方法', () => {
      const initializer = new DataInitializer();
      expect(typeof initializer.reinitializeData).toBe('function');
    });
  });

  describe('isDataInitialized 行为（轻量验证，深度覆盖见 service.test.ts）', () => {
    it('未初始化时返回 false', async () => {
      const initializer = new DataInitializer();
      const result = await initializer.isDataInitialized();
      expect(result).toBe(false);
    });
  });
});
