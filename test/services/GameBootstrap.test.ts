/**
 * @fileoverview GameBootstrap 游戏初始化编排服务单元测试
 *
 * 覆盖：
 * 1. initialize：按依赖顺序调用 7 个 Store 的 initialize/init
 * 2. dispose：调用实现了 Disposable 接口的 Store 的 dispose
 *
 * Mock 策略：
 * - 7 个模块 Store 全量 mock，断言 initialize/init/dispose 调用顺序
 * - 使用 createTestPinia 激活 Pinia（mock 的 store 需要在 Pinia 上下文中）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestPinia } from '../utils/setup';

/** mock 7 个模块 Store */
const logInitMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/modules/log/store', () => ({
  useLogStore: () => ({ initialize: logInitMock }),
}));

const inventoryInitMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/modules/inventory/store', () => ({
  useInventoryStore: () => ({ initialize: inventoryInitMock }),
}));

const equipmentInitMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/modules/equipment/store', () => ({
  useEquipmentStore: () => ({ initialize: equipmentInitMock }),
}));

const skillInitMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/modules/skill/store', () => ({
  useSkillStore: () => ({ initialize: skillInitMock }),
}));

const mapInitMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/modules/map/store', () => ({
  useMapStore: () => ({ initialize: mapInitMock }),
}));

const explorationInitMock = vi.fn().mockResolvedValue(undefined);
const explorationDisposeMock = vi.fn();
vi.mock('@/modules/exploration/store', () => ({
  useExplorationStore: () => ({
    init: explorationInitMock,
    dispose: explorationDisposeMock,
  }),
}));

const questInitMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/modules/quest/store', () => ({
  useQuestStore: () => ({ initialize: questInitMock }),
}));

import { gameBootstrap } from '@/services/GameBootstrap';

describe('GameBootstrap 游戏初始化编排服务', () => {
  beforeEach(() => {
    createTestPinia();
    [
      logInitMock,
      inventoryInitMock,
      equipmentInitMock,
      skillInitMock,
      mapInitMock,
      explorationInitMock,
      questInitMock,
      explorationDisposeMock,
    ].forEach(m => m.mockClear());
  });

  describe('initialize：按依赖顺序初始化各模块', () => {
    it('按 log→inventory→equipment→skill→map→exploration→quest 顺序调用', async () => {
      // Arrange
      const callOrder: string[] = [];
      logInitMock.mockImplementation(() => { callOrder.push('log'); return Promise.resolve(); });
      inventoryInitMock.mockImplementation(() => { callOrder.push('inventory'); return Promise.resolve(); });
      equipmentInitMock.mockImplementation(() => { callOrder.push('equipment'); return Promise.resolve(); });
      skillInitMock.mockImplementation(() => { callOrder.push('skill'); return Promise.resolve(); });
      mapInitMock.mockImplementation(() => { callOrder.push('map'); return Promise.resolve(); });
      explorationInitMock.mockImplementation(() => { callOrder.push('exploration'); return Promise.resolve(); });
      questInitMock.mockImplementation(() => { callOrder.push('quest'); return Promise.resolve(); });

      // Act
      await gameBootstrap.initialize('char_1');

      // Assert
      expect(callOrder).toEqual([
        'log', 'inventory', 'equipment', 'skill', 'map', 'exploration', 'quest',
      ]);
    });

    it('将 characterId 透传给各 Store 的 initialize', async () => {
      // Act
      await gameBootstrap.initialize('hero_123');

      // Assert
      expect(logInitMock).toHaveBeenCalledWith('hero_123');
      expect(inventoryInitMock).toHaveBeenCalledWith('hero_123');
      expect(equipmentInitMock).toHaveBeenCalledWith('hero_123');
      expect(skillInitMock).toHaveBeenCalledWith('hero_123');
      expect(mapInitMock).toHaveBeenCalledWith('hero_123');
      expect(explorationInitMock).toHaveBeenCalledWith('hero_123');
      expect(questInitMock).toHaveBeenCalledWith('hero_123');
    });

    it('exploration 调用的是 init 而非 initialize', async () => {
      // Act
      await gameBootstrap.initialize('char_1');

      // Assert
      expect(explorationInitMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('dispose：清理资源', () => {
    it('调用 exploration store 的 dispose', () => {
      // Act
      gameBootstrap.dispose();

      // Assert
      expect(explorationDisposeMock).toHaveBeenCalledTimes(1);
    });
  });
});
