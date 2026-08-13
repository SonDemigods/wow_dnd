/**
 * @fileoverview CrossModuleQuery 跨模块查询服务单元测试
 *
 * 覆盖 5 个委托方法：
 * 1. getLocationData：委托 mapDbService
 * 2. getAllItemTemplates：委托 itemTemplateCache
 * 3. getQuestDefinitionsByBoard：委托 questDbService
 * 4. getAllShopConfigs：委托 shopDbService
 * 5. getAllEquipmentTemplates：委托 equipmentDbService
 *
 * Mock 策略：
 * - 全量 mock 5 个依赖服务，断言委托调用与参数透传
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { crossModuleQuery } from '@/services/CrossModuleQuery';

/** mock 5 个依赖服务（使用 vi.hoisted 避免 hoisting 问题） */
const mocks = vi.hoisted(() => ({
  getLocationDataMock: vi.fn(),
  getQuestDefinitionsByBoardMock: vi.fn(),
  getAllShopConfigsMock: vi.fn(),
  getAllEquipmentTemplatesMock: vi.fn(),
  itemCacheGetAllMock: vi.fn(),
}));

vi.mock('@/modules/map/db', () => ({
  mapDbService: { getLocationData: mocks.getLocationDataMock },
}));

vi.mock('@/modules/quest/db', () => ({
  questDbService: { getQuestDefinitionsByBoard: mocks.getQuestDefinitionsByBoardMock },
}));

vi.mock('@/modules/shop/db', () => ({
  shopDbService: { getAllShopConfigs: mocks.getAllShopConfigsMock },
}));

vi.mock('@/modules/equipment/db', () => ({
  equipmentDbService: { getAllEquipmentTemplates: mocks.getAllEquipmentTemplatesMock },
}));

vi.mock('@/modules/item-template', () => ({
  unifiedItemTemplateCache: { getAll: mocks.itemCacheGetAllMock },
}));

const {
  getLocationDataMock,
  getQuestDefinitionsByBoardMock,
  getAllShopConfigsMock,
  getAllEquipmentTemplatesMock,
  itemCacheGetAllMock,
} = mocks;

describe('CrossModuleQuery 跨模块查询服务', () => {
  beforeEach(() => {
    [
      getLocationDataMock,
      getQuestDefinitionsByBoardMock,
      getAllShopConfigsMock,
      getAllEquipmentTemplatesMock,
      itemCacheGetAllMock,
    ].forEach(m => m.mockReset());
  });

  it('getLocationData 委托 mapDbService 并透传 areaId', async () => {
    // Arrange
    const areaId = 'area_1';
    const locationData = { id: areaId, name: '森林' };
    getLocationDataMock.mockResolvedValue(locationData);

    // Act
    const result = await crossModuleQuery.getLocationData(areaId);

    // Assert
    expect(result).toEqual(locationData);
    expect(getLocationDataMock).toHaveBeenCalledWith('area_1');
  });

  it('getLocationData 查询不存在时返回 null', async () => {
    // Arrange
    getLocationDataMock.mockResolvedValue(null);

    // Act
    const result = await crossModuleQuery.getLocationData('unknown');

    // Assert
    expect(result).toBeNull();
  });

  it('getAllItemTemplates 委托 unifiedItemTemplateCache.getAll', async () => {
    // Arrange
    const items = [{ id: 'i1' }, { id: 'i2' }];
    itemCacheGetAllMock.mockResolvedValue(items);

    // Act
    const result = await crossModuleQuery.getAllItemTemplates();

    // Assert
    expect(result).toEqual(items);
    expect(itemCacheGetAllMock).toHaveBeenCalledTimes(1);
  });

  it('getQuestDefinitionsByBoard 委托 questDbService 并透传 areaId', async () => {
    // Arrange
    const quests = [{ id: 'q1', title: '任务1' }];
    getQuestDefinitionsByBoardMock.mockResolvedValue(quests);

    // Act
    const result = await crossModuleQuery.getQuestDefinitionsByBoard('area_1');

    // Assert
    expect(result).toEqual(quests);
    expect(getQuestDefinitionsByBoardMock).toHaveBeenCalledWith('area_1');
  });

  it('getAllShopConfigs 委托 shopDbService.getAllShopConfigs', async () => {
    // Arrange
    const configs = [{ id: 'shop_1', name: '商店1' }];
    getAllShopConfigsMock.mockResolvedValue(configs);

    // Act
    const result = await crossModuleQuery.getAllShopConfigs();

    // Assert
    expect(result).toEqual(configs);
    expect(getAllShopConfigsMock).toHaveBeenCalledTimes(1);
  });

  it('getAllEquipmentTemplates 委托 equipmentDbService.getAllEquipmentTemplates', async () => {
    // Arrange
    const templates = [{ id: 'e1', name: '装备1' }];
    getAllEquipmentTemplatesMock.mockResolvedValue(templates);

    // Act
    const result = await crossModuleQuery.getAllEquipmentTemplates();

    // Assert
    expect(result).toEqual(templates);
    expect(getAllEquipmentTemplatesMock).toHaveBeenCalledTimes(1);
  });
});
