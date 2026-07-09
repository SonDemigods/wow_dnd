/**
 * @fileoverview item-template 模块数据层测试
 *
 * 覆盖 ItemTemplateDbService：
 * 1. getAllItemTemplates：委托 inventoryDbService.getAllItemTemplates
 * 2. getAllEquipmentTemplates：委托 equipmentDbService.getAllEquipmentTemplates
 *
 * Mock 策略：
 * - inventoryDbService + equipmentDbService 全量 mock，断言委托调用与参数透传
 * - 不触碰真实 IndexedDB
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { itemTemplateDbService } from '@/modules/item-template/db';
import type { Item } from '@/modules/item-template/types';
import type { EquipmentItem } from '@/modules/equipment/types';

/** mock inventoryDbService + equipmentDbService */
const { inventoryDbMock, equipmentDbMock } = vi.hoisted(() => ({
  inventoryDbMock: {
    getAllItemTemplates: vi.fn(),
  },
  equipmentDbMock: {
    getAllEquipmentTemplates: vi.fn(),
  },
}));

vi.mock('@/modules/inventory/db', () => ({
  inventoryDbService: inventoryDbMock,
}));

vi.mock('@/modules/equipment/db', () => ({
  equipmentDbService: equipmentDbMock,
}));

/** 构造测试普通物品 */
function makeItem(id: string): Item {
  return {
    id,
    name: id,
    description: '',
    type: 'potion',
    rarity: 'common',
    icon: '',
    value: 10,
    stackable: true,
  } as Item;
}

/** 构造测试装备 */
function makeEquipment(id: string): EquipmentItem {
  return {
    id,
    name: id,
    description: '',
    type: 'weapon',
    rarity: 'common',
    icon: '',
    value: 100,
    stackable: false,
    slots: ['weapon1'],
    bonus: { str: 5 },
  } as EquipmentItem;
}

describe('ItemTemplateDbService 统一物品模板数据层', () => {
  beforeEach(() => {
    inventoryDbMock.getAllItemTemplates.mockReset();
    equipmentDbMock.getAllEquipmentTemplates.mockReset();
  });

  // ==================== getAllItemTemplates ====================

  describe('getAllItemTemplates：委托 inventoryDbService', () => {
    it('成功委托并返回普通物品模板列表', async () => {
      // Arrange
      const items = [makeItem('p1'), makeItem('p2')];
      inventoryDbMock.getAllItemTemplates.mockResolvedValue(items);

      // Act
      const result = await itemTemplateDbService.getAllItemTemplates();

      // Assert
      expect(result).toEqual(items);
      expect(inventoryDbMock.getAllItemTemplates).toHaveBeenCalledTimes(1);
    });

    it('空表时返回空数组', async () => {
      // Arrange
      inventoryDbMock.getAllItemTemplates.mockResolvedValue([]);

      // Act
      const result = await itemTemplateDbService.getAllItemTemplates();

      // Assert
      expect(result).toEqual([]);
    });

    it('底层 DB 失败时错误向上传播', async () => {
      // Arrange
      inventoryDbMock.getAllItemTemplates.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(itemTemplateDbService.getAllItemTemplates()).rejects.toThrow('DB error');
    });
  });

  // ==================== getAllEquipmentTemplates ====================

  describe('getAllEquipmentTemplates：委托 equipmentDbService', () => {
    it('成功委托并返回装备模板列表（原始 EquipmentItem 格式）', async () => {
      // Arrange
      const equipment = [makeEquipment('w1'), makeEquipment('a1')];
      equipmentDbMock.getAllEquipmentTemplates.mockResolvedValue(equipment);

      // Act
      const result = await itemTemplateDbService.getAllEquipmentTemplates();

      // Assert：返回原始 EquipmentItem 格式（未转换为 Item）
      expect(result).toEqual(equipment);
      expect(result[0]).toHaveProperty('slots');
      expect(equipmentDbMock.getAllEquipmentTemplates).toHaveBeenCalledTimes(1);
    });

    it('空表时返回空数组', async () => {
      // Arrange
      equipmentDbMock.getAllEquipmentTemplates.mockResolvedValue([]);

      // Act
      const result = await itemTemplateDbService.getAllEquipmentTemplates();

      // Assert
      expect(result).toEqual([]);
    });

    it('底层 DB 失败时错误向上传播', async () => {
      // Arrange
      equipmentDbMock.getAllEquipmentTemplates.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(itemTemplateDbService.getAllEquipmentTemplates()).rejects.toThrow('DB error');
    });
  });
});
