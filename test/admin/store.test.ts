/**
 * @fileoverview 后台管理模块 Pinia Store 单元测试
 *
 * 覆盖 useAdminStore 的：
 * 1. State 初始值（视图/选中表/表格数据/加载态/仪表盘统计/表单配置/编辑记录/搜索词/参考数据）
 * 2. Getter：currentTableMeta（命中 / 未命中）
 * 3. Actions：
 *    - switchView（切换视图 + 进入 dashboard 触发 loadDashboardStats）
 *    - selectConfigTable（切换表 + 重置搜索词 + 加载数据）
 *    - loadDashboardStats（成功 / 失败 / isLoading 过程）
 *    - loadTableData（成功填充 / 失败 / 带搜索词走 searchTable）
 *    - openCreateForm / openEditForm / closeForm（表单状态切换）
 *    - saveRecord（创建成功 / 编辑成功 / 失败）
 *    - deleteRecord（成功 / 失败）
 *    - doSearch（设置关键词并重新加载）
 *    - loadReferenceData（4 表并行加载 + 大陆筛选）
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - adminService 全量 mock，断言调用与参数，不触碰真实 IndexedDB。
 *  - 经源码确认：admin store 仅依赖 adminService，不使用 eventBus / character store。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAdminStore } from '@/modules/admin/store';
import { createTestPinia } from '../utils/setup';
import { CONFIG_TABLES } from '@/modules/admin/types';

/** mock 后台管理服务层，避免触碰真实 IndexedDB */
vi.mock('@/modules/admin/service', () => ({
  adminService: {
    getAll: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    add: vi.fn().mockResolvedValue({ success: true, data: 'new-id' }),
    update: vi.fn().mockResolvedValue({ success: true }),
    delete: vi.fn().mockResolvedValue({ success: true }),
    clear: vi.fn().mockResolvedValue({ success: true }),
    count: vi.fn().mockResolvedValue(0),
    searchTable: vi.fn().mockResolvedValue([]),
    getDashboardStats: vi.fn().mockResolvedValue({ tableCounts: {} }),
    getPagedData: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    resetToDefaults: vi.fn().mockResolvedValue({ success: true }),
  },
}));

/** 从 mock 中取出 spy 引用，便于断言 */
import { adminService } from '@/modules/admin/service';

describe('useAdminStore - 后台管理 Store', () => {
  beforeEach(() => {
    createTestPinia();
    vi.clearAllMocks();
  });

  // -------------------- State 初始值 --------------------
  describe('State 初始值', () => {
    it('currentView 初始为 dashboard', () => {
      const store = useAdminStore();
      expect(store.currentView).toBe('dashboard');
    });

    it('selectedConfigTable 初始为 mobs', () => {
      const store = useAdminStore();
      expect(store.selectedConfigTable).toBe('mobs');
    });

    it('tableData 初始为空数组', () => {
      const store = useAdminStore();
      expect(store.tableData).toEqual([]);
    });

    it('isLoading 初始为 false', () => {
      const store = useAdminStore();
      expect(store.isLoading).toBe(false);
    });

    it('dashboardStats 初始为空 tableCounts', () => {
      const store = useAdminStore();
      expect(store.dashboardStats).toEqual({ tableCounts: {} });
    });

    it('formConfig 初始为 create/隐藏/空标题', () => {
      const store = useAdminStore();
      expect(store.formConfig).toEqual({ mode: 'create', visible: false, title: '' });
    });

    it('editingRecord 初始为 null', () => {
      const store = useAdminStore();
      expect(store.editingRecord).toBeNull();
    });

    it('searchKeyword 初始为空字符串', () => {
      const store = useAdminStore();
      expect(store.searchKeyword).toBe('');
    });

    it('参考数据初始均为空数组', () => {
      const store = useAdminStore();
      expect(store.referenceFactions).toEqual([]);
      expect(store.referenceRaces).toEqual([]);
      expect(store.referenceClasses).toEqual([]);
      expect(store.referenceLocations).toEqual([]);
      expect(store.referenceContinents).toEqual([]);
    });
  });

  // -------------------- Getter: currentTableMeta --------------------
  describe('Getter: currentTableMeta', () => {
    it('默认选中 mobs 时返回 mobs 元信息', () => {
      const store = useAdminStore();
      const mobsMeta = CONFIG_TABLES.find(t => t.key === 'mobs');
      expect(store.currentTableMeta).toEqual(mobsMeta);
    });

    it('切换 selectedConfigTable 后返回对应表元信息', () => {
      const store = useAdminStore();
      store.$patch({ selectedConfigTable: 'quests' });
      const questsMeta = CONFIG_TABLES.find(t => t.key === 'quests');
      expect(store.currentTableMeta).toEqual(questsMeta);
    });
  });

  // -------------------- Actions: switchView / selectConfigTable --------------------
  describe('Actions: switchView / selectConfigTable', () => {
    it('switchView 切换到 config 不触发 loadDashboardStats', () => {
      const store = useAdminStore();
      store.switchView('config');
      expect(store.currentView).toBe('config');
      expect(adminService.getDashboardStats).not.toHaveBeenCalled();
    });

    it('switchView 切换到 dashboard 触发 loadDashboardStats', async () => {
      const store = useAdminStore();
      const stats = { tableCounts: { config_mobs: 5 } };
      vi.mocked(adminService.getDashboardStats).mockResolvedValueOnce(stats);
      store.switchView('dashboard');
      // loadDashboardStats 是异步的，等待微任务完成
      await Promise.resolve();
      await Promise.resolve();
      expect(store.currentView).toBe('dashboard');
      expect(adminService.getDashboardStats).toHaveBeenCalledTimes(1);
      expect(store.dashboardStats).toEqual(stats);
    });

    it('selectConfigTable 切换表、重置搜索词并加载数据', async () => {
      const data = [{ id: 'q1', name: '任务1' }];
      vi.mocked(adminService.getPagedData).mockResolvedValueOnce({ data, total: 1 });
      const store = useAdminStore();
      store.$patch({ searchKeyword: '旧词' });

      store.selectConfigTable('quests');

      expect(store.selectedConfigTable).toBe('quests');
      expect(store.searchKeyword).toBe('');
      // loadTableData 异步执行
      await Promise.resolve();
      await Promise.resolve();
      expect(adminService.getPagedData).toHaveBeenCalledWith(
        'config_quests', 1, 20,
        expect.objectContaining({ keyword: '' }),
      );
      expect(store.tableData).toEqual(data);
    });
  });

  // -------------------- Actions: loadDashboardStats --------------------
  describe('Actions: loadDashboardStats', () => {
    it('成功加载并填充 dashboardStats，isLoading 最终为 false', async () => {
      const stats = { tableCounts: { config_mobs: 3, config_quests: 7 } };
      vi.mocked(adminService.getDashboardStats).mockResolvedValueOnce(stats);

      const store = useAdminStore();
      await store.loadDashboardStats();

      expect(store.dashboardStats).toEqual(stats);
      expect(store.isLoading).toBe(false);
      expect(adminService.getDashboardStats).toHaveBeenCalledTimes(1);
    });

    it('加载过程中 isLoading 为 true，完成后为 false', async () => {
      let resolveStats!: (v: { tableCounts: Record<string, number> }) => void;
      vi.mocked(adminService.getDashboardStats).mockReturnValueOnce(
        new Promise(resolve => {
          resolveStats = resolve;
        })
      );

      const store = useAdminStore();
      const p = store.loadDashboardStats();
      expect(store.isLoading).toBe(true);
      resolveStats({ tableCounts: {} });
      await p;
      expect(store.isLoading).toBe(false);
    });

    it('失败时 isLoading 仍回落为 false（finally 保证）', async () => {
      vi.mocked(adminService.getDashboardStats).mockRejectedValueOnce(new Error('db error'));

      const store = useAdminStore();
      await expect(store.loadDashboardStats()).rejects.toThrow('db error');
      expect(store.isLoading).toBe(false);
    });
  });

  // -------------------- Actions: loadTableData --------------------
  describe('Actions: loadTableData', () => {
    it('无搜索词时走 getPagedData 并填充 tableData', async () => {
      const data = [{ id: 'm1', name: '哥布林' }];
      vi.mocked(adminService.getPagedData).mockResolvedValueOnce({ data, total: 1 });

      const store = useAdminStore();
      await store.loadTableData();

      expect(adminService.getPagedData).toHaveBeenCalledWith(
        'config_mobs', 1, 20,
        expect.objectContaining({ keyword: '' }),
      );
      expect(store.tableData).toEqual(data);
      expect(store.totalCount).toBe(1);
      expect(store.isLoading).toBe(false);
    });

    it('有搜索词时走 getPagedData 带 keyword', async () => {
      const result = [{ id: 'm1', name: '哥布林' }];
      vi.mocked(adminService.getPagedData).mockResolvedValueOnce({ data: result, total: 1 });

      const store = useAdminStore();
      store.$patch({ searchKeyword: '哥布林' });
      await store.loadTableData();

      expect(adminService.getPagedData).toHaveBeenCalledWith(
        'config_mobs', 1, 20,
        expect.objectContaining({ keyword: '哥布林' }),
      );
      expect(store.tableData).toEqual(result);
    });

    it('失败时 isLoading 回落 false 且不填充数据', async () => {
      vi.mocked(adminService.getPagedData).mockRejectedValueOnce(new Error('db error'));
      const store = useAdminStore();
      store.$patch({ tableData: [{ id: 'old' }] });

      await expect(store.loadTableData()).rejects.toThrow('db error');
      expect(store.isLoading).toBe(false);
      // 旧数据未被覆盖（异常抛出前未赋值）
      expect(store.tableData).toEqual([{ id: 'old' }]);
    });

    it('currentTableMeta 为空时直接返回不加载（防御性早退）', async () => {
      const store = useAdminStore();
      store.$patch({ selectedConfigTable: 'non_existent_table' as any });

      await store.loadTableData();

      expect(adminService.getPagedData).not.toHaveBeenCalled();
      expect(store.isLoading).toBe(false);
    });
  });

  // -------------------- Actions: openCreateForm / openEditForm / closeForm --------------------
  describe('Actions: 表单状态', () => {
    it('openCreateForm 设置 create 模式、显示、标题并清空 editingRecord', () => {
      const store = useAdminStore();
      store.$patch({ editingRecord: { id: 'old' } });

      store.openCreateForm('新建阵营');

      expect(store.formConfig).toEqual({ mode: 'create', visible: true, title: '新建阵营' });
      expect(store.editingRecord).toBeNull();
    });

    it('openEditForm 设置 edit 模式、显示、标题并拷贝 editingRecord', () => {
      const store = useAdminStore();
      const record = { id: 'r1', name: '旧记录' };

      store.openEditForm(record, '编辑阵营');

      expect(store.formConfig).toEqual({ mode: 'edit', visible: true, title: '编辑阵营' });
      expect(store.editingRecord).toEqual(record);
      // 应为副本，修改不影响原对象
      expect(store.editingRecord).not.toBe(record);
    });

    it('closeForm 隐藏表单并清空 editingRecord', () => {
      const store = useAdminStore();
      store.$patch({
        formConfig: { mode: 'edit', visible: true, title: '编辑' },
        editingRecord: { id: 'r1' },
      });

      store.closeForm();

      expect(store.formConfig.visible).toBe(false);
      expect(store.editingRecord).toBeNull();
    });
  });

  // -------------------- Actions: saveRecord --------------------
  describe('Actions: saveRecord', () => {
    it('create 模式成功：调用 add、关闭表单、重新加载、返回 true', async () => {
      vi.mocked(adminService.add).mockResolvedValueOnce({ success: true, data: 'new-id' });
      vi.mocked(adminService.getPagedData).mockResolvedValueOnce({ data: [{ id: 'new-id' }], total: 1 });

      const store = useAdminStore();
      store.openCreateForm('新建');

      const result = await store.saveRecord('config_mobs', { name: '哥布林' });

      expect(result).toBe(true);
      expect(adminService.add).toHaveBeenCalledWith('config_mobs', { name: '哥布林' });
      expect(store.formConfig.visible).toBe(false);
      expect(adminService.getPagedData).toHaveBeenCalled();
    });

    it('edit 模式成功：调用 update（携带 editingRecord.id）、关闭表单、返回 true', async () => {
      vi.mocked(adminService.update).mockResolvedValueOnce({ success: true });
      vi.mocked(adminService.getPagedData).mockResolvedValueOnce({ data: [], total: 0 });

      const store = useAdminStore();
      store.openEditForm({ id: 'r1', name: '旧' }, '编辑');

      const result = await store.saveRecord('config_mobs', { name: '新' });

      expect(result).toBe(true);
      expect(adminService.update).toHaveBeenCalledWith('config_mobs', 'r1', { name: '新' });
      expect(store.formConfig.visible).toBe(false);
    });

    it('create 模式失败：返回 false 且不关闭表单', async () => {
      vi.mocked(adminService.add).mockResolvedValueOnce({ success: false, error: '重复' });

      const store = useAdminStore();
      store.openCreateForm('新建');

      const result = await store.saveRecord('config_mobs', { name: 'x' });

      expect(result).toBe(false);
      expect(store.formConfig.visible).toBe(true);
    });

    it('edit 模式失败：返回 false 且不关闭表单', async () => {
      vi.mocked(adminService.update).mockResolvedValueOnce({ success: false, error: '不存在' });

      const store = useAdminStore();
      store.openEditForm({ id: 'r1' }, '编辑');

      const result = await store.saveRecord('config_mobs', { name: 'x' });

      expect(result).toBe(false);
      expect(store.formConfig.visible).toBe(true);
    });
  });

  // -------------------- Actions: deleteRecord --------------------
  describe('Actions: deleteRecord', () => {
    it('成功：调用 delete、重新加载、返回 true', async () => {
      vi.mocked(adminService.delete).mockResolvedValueOnce({ success: true });
      vi.mocked(adminService.getPagedData).mockResolvedValueOnce({ data: [], total: 0 });

      const store = useAdminStore();
      const result = await store.deleteRecord('config_mobs', 'm1');

      expect(result).toBe(true);
      expect(adminService.delete).toHaveBeenCalledWith('config_mobs', 'm1');
      expect(adminService.getPagedData).toHaveBeenCalled();
    });

    it('失败：返回 false', async () => {
      vi.mocked(adminService.delete).mockResolvedValueOnce({ success: false, error: '不存在' });

      const store = useAdminStore();
      const result = await store.deleteRecord('config_mobs', 'm1');

      expect(result).toBe(false);
    });
  });

  // -------------------- Actions: doSearch --------------------
  describe('Actions: doSearch', () => {
    it('设置 searchKeyword 并触发 getPagedData 加载', async () => {
      const result = [{ id: 'm1', name: '哥布林' }];
      vi.mocked(adminService.getPagedData).mockResolvedValueOnce({ data: result, total: 1 });

      const store = useAdminStore();
      await store.doSearch('哥布林');

      expect(store.searchKeyword).toBe('哥布林');
      expect(adminService.getPagedData).toHaveBeenCalledWith(
        'config_mobs', 1, 20,
        expect.objectContaining({ keyword: '哥布林' }),
      );
      expect(store.tableData).toEqual(result);
    });
  });

  // -------------------- Actions: loadReferenceData --------------------
  describe('Actions: loadReferenceData', () => {
    it('并行加载 4 张参考表并转换为下拉选项，大陆按 type 过滤', async () => {
      vi.mocked(adminService.getAll).mockImplementation(async () => {
        // 默认实现返回 []，这里用 mockResolvedValueOnce 逐表覆盖
        return [];
      });
      const factions = [{ id: 'alliance', name: '联盟' }];
      const races = [{ id: 'human', name: '人类' }];
      const classes = [{ id: 'warrior', name: '战士' }];
      const locations = [
        { id: 'east', name: '东部大陆', type: 'continent' },
        { id: 'stormwind', name: '暴风城', type: 'city' },
        { id: 'west', name: '西部大陆', type: 'continent' },
      ];
      vi.mocked(adminService.getAll)
        .mockResolvedValueOnce(factions)
        .mockResolvedValueOnce(races)
        .mockResolvedValueOnce(classes)
        .mockResolvedValueOnce(locations);

      const store = useAdminStore();
      await store.loadReferenceData();

      expect(store.referenceFactions).toEqual([{ value: 'alliance', label: '联盟' }]);
      expect(store.referenceRaces).toEqual([{ value: 'human', label: '人类' }]);
      expect(store.referenceClasses).toEqual([{ value: 'warrior', label: '战士' }]);
      expect(store.referenceLocations).toEqual([
        { value: 'east', label: '东部大陆' },
        { value: 'stormwind', label: '暴风城' },
        { value: 'west', label: '西部大陆' },
      ]);
      // referenceContinents 仅包含 type==='continent' 的项
      expect(store.referenceContinents).toEqual([
        { value: 'east', label: '东部大陆' },
        { value: 'west', label: '西部大陆' },
      ]);
    });
  });
});
