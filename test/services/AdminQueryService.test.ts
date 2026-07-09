/**
 * @fileoverview AdminQueryService 管理后台查询服务单元测试
 *
 * 覆盖 3 个核心方法：
 * 1. queryAllItemTemplates：查询所有物品模板（消耗品 + 装备）
 * 2. queryItemTemplate：查询单个物品模板（先查消耗品，未命中再查装备）
 * 3. queryAllEnemyTemplates：查询所有敌人模板（普通怪物 + Boss）
 *
 * Mock 策略：
 * - 全量 mock 4 个依赖的 DbService，断言委托调用与参数透传
 * - 验证查询优先级（消耗品优先于装备）
 *
 * CHR-5 修复验证：console.ts 不再直接依赖这些 DbService
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { adminQueryService } from '@/services/AdminQueryService';

/** mock 4 个依赖的 DbService */
const mocks = vi.hoisted(() => ({
  // inventory DbService
  getAllItemTemplatesMock: vi.fn(),
  getItemTemplateMock: vi.fn(),
  // equipment DbService
  getAllEquipmentTemplatesMock: vi.fn(),
  getEquipmentTemplateMock: vi.fn(),
  // enemy DbService
  getAllEnemyTemplatesMock: vi.fn(),
  // boss DbService
  getAllBossTemplatesMock: vi.fn(),
}));

vi.mock('@/modules/inventory', () => ({
  inventoryDbService: {
    getAllItemTemplates: mocks.getAllItemTemplatesMock,
    getItemTemplate: mocks.getItemTemplateMock,
  },
}));

vi.mock('@/modules/equipment', () => ({
  equipmentDbService: {
    getAllEquipmentTemplates: mocks.getAllEquipmentTemplatesMock,
    getEquipmentTemplate: mocks.getEquipmentTemplateMock,
  },
}));

vi.mock('@/modules/enemy', () => ({
  enemyDbService: {
    getAllEnemyTemplates: mocks.getAllEnemyTemplatesMock,
  },
}));

vi.mock('@/modules/boss', () => ({
  bossDbService: {
    getAllBossTemplates: mocks.getAllBossTemplatesMock,
  },
}));

const {
  getAllItemTemplatesMock,
  getItemTemplateMock,
  getAllEquipmentTemplatesMock,
  getEquipmentTemplateMock,
  getAllEnemyTemplatesMock,
  getAllBossTemplatesMock,
} = mocks;

describe('AdminQueryService 管理后台查询服务', () => {
  beforeEach(() => {
    [
      getAllItemTemplatesMock,
      getItemTemplateMock,
      getAllEquipmentTemplatesMock,
      getEquipmentTemplateMock,
      getAllEnemyTemplatesMock,
      getAllBossTemplatesMock,
    ].forEach(m => m.mockReset());
  });

  // ========================================================================
  // queryAllItemTemplates
  // ========================================================================

  describe('queryAllItemTemplates 查询所有物品模板', () => {
    it('应并行查询消耗品和装备模板', async () => {
      // Arrange
      const mockItems = [{ id: 'potion', name: '药水' }];
      const mockEquips = [{ id: 'sword', name: '长剑', rarity: 'common', type: 'weapon' }];
      getAllItemTemplatesMock.mockResolvedValue(mockItems);
      getAllEquipmentTemplatesMock.mockResolvedValue(mockEquips);

      // Act
      const result = await adminQueryService.queryAllItemTemplates();

      // Assert
      expect(result.items).toEqual(mockItems);
      expect(result.equipments).toEqual(mockEquips);
      expect(getAllItemTemplatesMock).toHaveBeenCalledOnce();
      expect(getAllEquipmentTemplatesMock).toHaveBeenCalledOnce();
    });

    it('两个数据源均为空时应返回空数组', async () => {
      // Arrange
      getAllItemTemplatesMock.mockResolvedValue([]);
      getAllEquipmentTemplatesMock.mockResolvedValue([]);

      // Act
      const result = await adminQueryService.queryAllItemTemplates();

      // Assert
      expect(result.items).toEqual([]);
      expect(result.equipments).toEqual([]);
    });
  });

  // ========================================================================
  // queryItemTemplate
  // ========================================================================

  describe('queryItemTemplate 查询单个物品模板', () => {
    it('消耗品命中时应返回 item 类型', async () => {
      // Arrange
      const mockItem = { id: 'potion_01', name: '治疗药水' };
      getItemTemplateMock.mockResolvedValue(mockItem);

      // Act
      const result = await adminQueryService.queryItemTemplate('potion_01');

      // Assert: 消耗品命中后不再查询装备
      expect(result).toEqual({ type: 'item', data: mockItem });
      expect(getItemTemplateMock).toHaveBeenCalledWith('potion_01');
      expect(getEquipmentTemplateMock).not.toHaveBeenCalled();
    });

    it('消耗品未命中时应回退查询装备', async () => {
      // Arrange
      const mockEquip = { id: 'sword_01', name: '铁剑', rarity: 'common' };
      getItemTemplateMock.mockResolvedValue(null);
      getEquipmentTemplateMock.mockResolvedValue(mockEquip);

      // Act
      const result = await adminQueryService.queryItemTemplate('sword_01');

      // Assert
      expect(result).toEqual({ type: 'equipment', data: mockEquip });
      expect(getItemTemplateMock).toHaveBeenCalledWith('sword_01');
      expect(getEquipmentTemplateMock).toHaveBeenCalledWith('sword_01');
    });

    it('消耗品和装备均未命中时应返回 null', async () => {
      // Arrange
      getItemTemplateMock.mockResolvedValue(null);
      getEquipmentTemplateMock.mockResolvedValue(null);

      // Act
      const result = await adminQueryService.queryItemTemplate('not_exist');

      // Assert
      expect(result).toBeNull();
      expect(getItemTemplateMock).toHaveBeenCalledWith('not_exist');
      expect(getEquipmentTemplateMock).toHaveBeenCalledWith('not_exist');
    });

    it('空字符串 ID 应正常透传查询', async () => {
      // Arrange
      getItemTemplateMock.mockResolvedValue(null);
      getEquipmentTemplateMock.mockResolvedValue(null);

      // Act
      const result = await adminQueryService.queryItemTemplate('');

      // Assert: 服务层不做参数校验，原样透传
      expect(result).toBeNull();
      expect(getItemTemplateMock).toHaveBeenCalledWith('');
      expect(getEquipmentTemplateMock).toHaveBeenCalledWith('');
    });
  });

  // ========================================================================
  // queryAllEnemyTemplates
  // ========================================================================

  describe('queryAllEnemyTemplates 查询所有敌人模板', () => {
    it('应并行查询普通怪物和 Boss', async () => {
      // Arrange
      const mockMobs = [
        { id: 'goblin', name: '哥布林', maxHp: 50 },
        { id: 'orc', name: '兽人', maxHp: 100 },
      ];
      const mockBosses = [
        { id: 'dragon', name: '巨龙', maxHp: 1000 },
      ];
      getAllEnemyTemplatesMock.mockResolvedValue(mockMobs);
      getAllBossTemplatesMock.mockResolvedValue(mockBosses);

      // Act
      const result = await adminQueryService.queryAllEnemyTemplates();

      // Assert
      expect(result.mobs).toEqual(mockMobs);
      expect(result.bosses).toEqual(mockBosses);
      expect(getAllEnemyTemplatesMock).toHaveBeenCalledOnce();
      expect(getAllBossTemplatesMock).toHaveBeenCalledOnce();
    });

    it('两个数据源均为空时应返回空数组', async () => {
      // Arrange
      getAllEnemyTemplatesMock.mockResolvedValue([]);
      getAllBossTemplatesMock.mockResolvedValue([]);

      // Act
      const result = await adminQueryService.queryAllEnemyTemplates();

      // Assert
      expect(result.mobs).toEqual([]);
      expect(result.bosses).toEqual([]);
    });
  });
});
