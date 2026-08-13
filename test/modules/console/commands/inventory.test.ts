/**
 * @fileoverview 物品类控制台命令单元测试（QA-1）
 *
 * 覆盖 inventory 命令子模块的 4 个命令：
 *   item / bag / clearBag / equips
 *
 * Mock 策略：
 *  - mock useInventoryStore（addItem/inventory/getItemInfo/resetInventory）
 *  - mock useEquipmentStore（equipment）
 *  - mock adminQueryService（queryAllItemTemplates / queryItemTemplate）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== Mock ====================
// vi.hoisted 保证 mock 变量在 vi.mock 工厂提升到文件顶部时已初始化，
// 避免 TDZ（Temporal Dead Zone）错误。adminQueryService 是直接导出的对象（非工厂函数），
// 工厂被调用时立即访问 adminQueryMock，必须用 vi.hoisted。

const { inventoryMock, equipmentMock, adminQueryMock } = vi.hoisted(() => ({
  inventoryMock: {
    inventory: [] as Array<{ itemId: string; count: number }>,
    addItem: vi.fn(),
    getItemInfo: vi.fn(),
    resetInventory: vi.fn(),
  },
  equipmentMock: {
    equipment: {} as Record<string, unknown>,
  },
  adminQueryMock: {
    queryAllItemTemplates: vi.fn(),
    queryItemTemplate: vi.fn(),
  },
}));

vi.mock('@/modules/inventory/store', () => ({
  useInventoryStore: () => inventoryMock,
}));

vi.mock('@/modules/equipment/store', () => ({
  useEquipmentStore: () => equipmentMock,
}));

vi.mock('@/modules/admin', () => ({
  adminQueryService: adminQueryMock,
}));

// 触发 inventory 命令注册
import '@/modules/console/commands/inventory';
import { exec, getCommands } from '@/modules/console/framework';

// ==================== 测试用例 ====================

describe('console/commands/inventory - 物品类命令', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inventoryMock.inventory = [];
    equipmentMock.equipment = {};
  });

  // -------------------- item --------------------
  describe('item - 添加物品', () => {
    it('无参数时列出所有物品模板', async () => {
      adminQueryMock.queryAllItemTemplates.mockResolvedValue({
        items: [
          { id: 'potion_hp', name: '生命药水' },
          { id: 'potion_mp', name: '法力药水' },
        ],
        equipments: [
          { id: 'sword_01', name: '铁剑', rarity: 'common', type: 'weapon' },
        ],
      });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('item');
      expect(result.success).toBe(true);
      expect(result.message).toContain('消耗品');
      expect(adminQueryMock.queryAllItemTemplates).toHaveBeenCalled();
      expect(logSpy.mock.calls.length).toBeGreaterThan(2);
      logSpy.mockRestore();
    });

    it('消耗品：有效 ID + 数量时调用 addItem', async () => {
      adminQueryMock.queryItemTemplate.mockResolvedValue({
        type: 'item',
        data: { id: 'potion_hp', name: '生命药水' },
      });
      inventoryMock.addItem.mockReturnValue(3);
      const result = await exec('item potion_hp 3');
      expect(result).toEqual({ success: true, message: '已添加 生命药水 x3' });
      expect(inventoryMock.addItem).toHaveBeenCalledWith('potion_hp', 3);
    });

    it('消耗品：未指定数量时默认 1', async () => {
      adminQueryMock.queryItemTemplate.mockResolvedValue({
        type: 'item',
        data: { id: 'potion_hp', name: '生命药水' },
      });
      inventoryMock.addItem.mockReturnValue(1);
      const result = await exec('item potion_hp');
      expect(result.success).toBe(true);
      expect(inventoryMock.addItem).toHaveBeenCalledWith('potion_hp', 1);
    });

    it('消耗品：数量为 0 返回失败', async () => {
      adminQueryMock.queryItemTemplate.mockResolvedValue({
        type: 'item',
        data: { id: 'potion_hp', name: '生命药水' },
      });
      const result = await exec('item potion_hp 0');
      expect(result).toEqual({ success: false, message: '数量必须为正整数' });
    });

    it('消耗品：数量为负数返回失败', async () => {
      adminQueryMock.queryItemTemplate.mockResolvedValue({
        type: 'item',
        data: { id: 'potion_hp', name: '生命药水' },
      });
      const result = await exec('item potion_hp -5');
      expect(result.success).toBe(false);
    });

    it('消耗品：addItem 返回 0 表示背包已满', async () => {
      adminQueryMock.queryItemTemplate.mockResolvedValue({
        type: 'item',
        data: { id: 'potion_hp', name: '生命药水' },
      });
      inventoryMock.addItem.mockReturnValue(0);
      const result = await exec('item potion_hp 1');
      expect(result).toEqual({ success: false, message: '背包已满，无法添加物品' });
    });

    it('装备：固定添加 1 件', async () => {
      adminQueryMock.queryItemTemplate.mockResolvedValue({
        type: 'equipment',
        data: { id: 'sword_01', name: '铁剑' },
      });
      inventoryMock.addItem.mockReturnValue(1);
      const result = await exec('item sword_01');
      expect(result.success).toBe(true);
      expect(result.message).toBe('已添加 铁剑 到背包');
      expect(inventoryMock.addItem).toHaveBeenCalledWith('sword_01', 1);
    });

    it('装备：背包已满时返回失败', async () => {
      adminQueryMock.queryItemTemplate.mockResolvedValue({
        type: 'equipment',
        data: { id: 'sword_01', name: '铁剑' },
      });
      inventoryMock.addItem.mockReturnValue(0);
      const result = await exec('item sword_01');
      expect(result).toEqual({ success: false, message: '背包已满，无法添加物品' });
    });

    it('物品 ID 不存在时返回失败', async () => {
      adminQueryMock.queryItemTemplate.mockResolvedValue(null);
      const result = await exec('item unknown');
      expect(result.success).toBe(false);
      expect(result.message).toContain('未找到物品: unknown');
    });
  });

  // -------------------- bag --------------------
  describe('bag - 显示背包', () => {
    it('空背包返回提示', async () => {
      inventoryMock.inventory = [];
      const result = await exec('bag');
      expect(result).toEqual({ success: true, message: '背包是空的' });
    });

    it('非空背包列出物品', async () => {
      inventoryMock.inventory = [
        { itemId: 'potion_hp', count: 3 },
        { itemId: 'sword_01', count: 1 },
      ];
      inventoryMock.getItemInfo.mockImplementation((id: string) => {
        if (id === 'potion_hp') return { name: '生命药水' };
        if (id === 'sword_01') return { name: '铁剑' };
        return null;
      });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('bag');
      expect(result.success).toBe(true);
      expect(result.message).toBe('共 2 个格子');
      expect(logSpy.mock.calls.length).toBeGreaterThan(2);
      logSpy.mockRestore();
    });

    it('getItemInfo 返回 null 时使用 itemId 作为名称', async () => {
      inventoryMock.inventory = [{ itemId: 'unknown_item', count: 1 }];
      inventoryMock.getItemInfo.mockReturnValue(null);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('bag');
      expect(result.success).toBe(true);
      // 验证日志中包含 itemId
      const loggedText = logSpy.mock.calls.map(c => c.join(' ')).join(' ');
      expect(loggedText).toContain('unknown_item');
      logSpy.mockRestore();
    });
  });

  // -------------------- clearBag --------------------
  describe('clearBag - 清空背包', () => {
    it('调用 resetInventory 并返回成功', async () => {
      const result = await exec('clearBag');
      expect(result).toEqual({ success: true, message: '背包已清空' });
      expect(inventoryMock.resetInventory).toHaveBeenCalled();
    });
  });

  // -------------------- equips --------------------
  describe('equips - 查看装备', () => {
    it('无装备时返回提示', async () => {
      equipmentMock.equipment = {
        weapon1: null, weapon2: null,
        helm: null, chest: null, gloves: null, legs: null, boots: null,
      };
      const result = await exec('equips');
      expect(result).toEqual({ success: true, message: '当前没有装备任何物品' });
    });

    it('有装备时显示装备信息', async () => {
      equipmentMock.equipment = {
        weapon1: { item: { name: '铁剑', rarity: 'common', level: 5 } },
        chest: { item: { name: '皮甲', rarity: 'uncommon', level: 3 } },
      };
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('equips');
      expect(result.success).toBe(true);
      expect(result.message).toBe('共装备 2 件物品');
      expect(logSpy.mock.calls.length).toBeGreaterThan(2);
      logSpy.mockRestore();
    });

    it('装备 rarity 为 undefined 时使用 common 默认值', async () => {
      equipmentMock.equipment = {
        weapon1: { item: { name: '测试武器', rarity: undefined, level: 1 } },
      };
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await exec('equips');
      expect(result.success).toBe(true);
      logSpy.mockRestore();
    });
  });

  // -------------------- 注册验证 --------------------
  describe('命令注册验证', () => {
    it('item 类命令全部已注册', () => {
      const expected = ['item', 'bag', 'clearbag', 'equips'];
      for (const name of expected) {
        expect(getCommands().has(name)).toBe(true);
      }
    });
  });
});
