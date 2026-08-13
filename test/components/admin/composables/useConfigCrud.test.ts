/**
 * @fileoverview useConfigCrud composable 单元测试
 *
 * 覆盖：
 * 1. handleCreate：调用 store.openCreateForm，标题含 currentTableMeta.label
 * 2. handleEdit：调用 store.openEditForm，携带行数据与标题
 * 3. handleDelete：设置 showDeleteConfirm=true 并暂存记录
 * 4. confirmDelete：调用 store.deleteRecord 并清理状态、关闭弹窗
 * 5. handleFormSubmit：调用 store.saveRecord，传入 currentDbTable 与数据
 *
 * 使用 createStubPinia 隔离 store 副作用，断言 stub action 被调用。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computed } from 'vue';
import { createStubPinia } from '../../../utils/setup';
import { useAdminStore } from '@/modules/admin';
import { useConfigCrud } from '@/components/admin/composables/useConfigCrud';

// Mock checkReferences 避免 DB 查询
vi.mock('@/modules/admin/referenceGraph', () => ({
  checkReferences: vi.fn().mockResolvedValue({ hasReferences: false, details: [] }),
  formatReferenceWarning: vi.fn().mockReturnValue(''),
}));

describe('useConfigCrud 配置表 CRUD composable', () => {
  beforeEach(() => {
    createStubPinia();
  });

  describe('handleCreate', () => {
    it('调用 store.openCreateForm，标题包含当前表 label', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'races';
      // currentTableMeta 由 store 内部 computed 计算，races 对应"种族"
      const { handleCreate } = useConfigCrud({ currentDbTable: computed(() => 'config_races') });

      handleCreate();

      expect(store.openCreateForm).toHaveBeenCalledTimes(1);
      expect(store.openCreateForm).toHaveBeenCalledWith(expect.stringContaining('种族'));
    });

    it('currentTableMeta 为 undefined 时回退为"记录"', () => {
      const store = useAdminStore();
      // 选用一个合法的表名，但通过 mock 让 currentTableMeta 返回 undefined
      // 这里直接验证 label 不存在时的回退路径
      store.selectedConfigTable = 'factions';
      // 通过 stub 让 currentTableMeta 返回 undefined
      vi.spyOn(store, 'currentTableMeta', 'get').mockReturnValue(undefined);
      const { handleCreate } = useConfigCrud({ currentDbTable: computed(() => 'config_factions') });

      handleCreate();

      expect(store.openCreateForm).toHaveBeenCalledWith(expect.stringContaining('记录'));
    });
  });

  describe('handleEdit', () => {
    it('调用 store.openEditForm，携带行数据与标题', () => {
      const store = useAdminStore();
      store.selectedConfigTable = 'factions';
      const { handleEdit } = useConfigCrud({ currentDbTable: computed(() => 'config_factions') });
      const row = { id: 'alliance', name: '光辉盟约' };

      handleEdit(row);

      expect(store.openEditForm).toHaveBeenCalledTimes(1);
      expect(store.openEditForm).toHaveBeenCalledWith(row, expect.stringContaining('阵营'));
    });
  });

  describe('handleDelete', () => {
    it('设置 showDeleteConfirm 为 true', async () => {
      const { showDeleteConfirm, handleDelete } = useConfigCrud({
        currentDbTable: computed(() => 'config_factions'),
      });
      expect(showDeleteConfirm.value).toBe(false);

      await handleDelete({ id: 'del1' });

      expect(showDeleteConfirm.value).toBe(true);
    });
  });

  describe('confirmDelete', () => {
    it('调用 store.deleteRecord，传入 currentDbTable 与 id 字符串', async () => {
      const store = useAdminStore();
      const { handleDelete, confirmDelete } = useConfigCrud({
        currentDbTable: computed(() => 'config_factions'),
      });
      await handleDelete({ id: 'del1' });

      await confirmDelete();

      expect(store.deleteRecord).toHaveBeenCalledTimes(1);
      expect(store.deleteRecord).toHaveBeenCalledWith('config_factions', 'del1');
    });

    it('pendingDeleteRecord 为空时直接返回不调用 deleteRecord', async () => {
      const store = useAdminStore();
      const { confirmDelete, showDeleteConfirm } = useConfigCrud({
        currentDbTable: computed(() => 'config_factions'),
      });
      // 不调用 handleDelete，pendingDeleteRecord 为 null
      expect(showDeleteConfirm.value).toBe(false);

      await confirmDelete();

      expect(store.deleteRecord).not.toHaveBeenCalled();
    });

    it('删除成功后关闭弹窗', async () => {
      const { handleDelete, confirmDelete, showDeleteConfirm } = useConfigCrud({
        currentDbTable: computed(() => 'config_factions'),
      });
      await handleDelete({ id: 'del1' });
      expect(showDeleteConfirm.value).toBe(true);

      await confirmDelete();

      expect(showDeleteConfirm.value).toBe(false);
    });

    it('优先使用 characterId 字段（id 缺失时）', async () => {
      const store = useAdminStore();
      const { handleDelete, confirmDelete } = useConfigCrud({
        currentDbTable: computed(() => 'char_data'),
      });
      await handleDelete({ characterId: 'char_99' });

      await confirmDelete();

      expect(store.deleteRecord).toHaveBeenCalledWith('char_data', 'char_99');
    });
  });

  describe('handleFormSubmit', () => {
    it('调用 store.saveRecord，传入 currentDbTable 与数据', async () => {
      const store = useAdminStore();
      const { handleFormSubmit } = useConfigCrud({ currentDbTable: computed(() => 'config_skills') });
      const payload = { id: 'sk1', name: '火球术' };

      await handleFormSubmit(payload);

      expect(store.saveRecord).toHaveBeenCalledTimes(1);
      expect(store.saveRecord).toHaveBeenCalledWith('config_skills', payload);
    });

    it('currentDbTable 变化时使用最新值', async () => {
      const store = useAdminStore();
      const dynamicDbTable = computed(() => `config_${store.selectedConfigTable}`);
      const { handleFormSubmit } = useConfigCrud({ currentDbTable: dynamicDbTable });

      store.selectedConfigTable = 'shops';
      await handleFormSubmit({ id: 'shop_1' });
      expect(store.saveRecord).toHaveBeenCalledWith('config_shops', { id: 'shop_1' });

      store.selectedConfigTable = 'quests';
      await handleFormSubmit({ id: 'quest_1' });
      expect(store.saveRecord).toHaveBeenCalledWith('config_quests', { id: 'quest_1' });
    });
  });
});
