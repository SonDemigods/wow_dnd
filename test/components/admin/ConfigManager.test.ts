/**
 * @fileoverview ConfigManager 配置表管理组件单元测试
 *
 * 覆盖 ConfigManager.vue 的：
 * 1. 渲染：page-title、AdminTable / AdminForm 子组件挂载
 * 2. onMounted 调用 store.loadReferenceData
 * 3. 表格事件联动 store：create → openCreateForm，edit → openEditForm
 * 4. 删除流程：delete → 弹出确认 → confirmDelete → store.deleteRecord
 * 5. 表单事件联动 store：submit → saveRecord，cancel → closeForm
 *
 * 遵循 code_rule：
 *  - 使用 shallowMount 隔离 AdminTable/AdminForm 子组件，聚焦本组件逻辑。
 *  - 使用 createStubPinia() 隔离 store 副作用，断言 stub action 被调用。
 *  - 不断言计算后 CSS 样式值。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import ConfigManager from '@/components/admin/ConfigManager.vue';
import AdminTable from '@/components/admin/AdminTable.vue';
import AdminForm from '@/components/admin/AdminForm.vue';
import { useAdminStore } from '@/modules/admin';
import { createStubPinia } from '../../utils/setup';

describe('ConfigManager 配置表管理组件', () => {
  let pinia: ReturnType<typeof createStubPinia>;

  beforeEach(() => {
    pinia = createStubPinia();
  });

  describe('渲染', () => {
    it('渲染 .config-manager 与 page-title', () => {
      const wrapper = shallowMount(ConfigManager, { global: { plugins: [pinia] } });
      expect(wrapper.find('.config-manager').exists()).toBe(true);
      expect(wrapper.find('.page-title').exists()).toBe(true);
    });

    it('page-title 默认显示当前选中表的 label', () => {
      const store = useAdminStore(pinia);
      store.selectedConfigTable = 'factions';
      const wrapper = shallowMount(ConfigManager, { global: { plugins: [pinia] } });
      expect(wrapper.find('.page-title').text()).toBe('阵营');
    });

    it('挂载 AdminTable 与 AdminForm 子组件', () => {
      const wrapper = shallowMount(ConfigManager, { global: { plugins: [pinia] } });
      expect(wrapper.findComponent(AdminTable).exists()).toBe(true);
      expect(wrapper.findComponent(AdminForm).exists()).toBe(true);
    });

    it('AdminTable 接收 store.tableData 作为 data', () => {
      const store = useAdminStore(pinia);
      store.tableData = [{ id: 'x', name: 'y' }];
      const wrapper = shallowMount(ConfigManager, { global: { plugins: [pinia] } });
      expect(wrapper.findComponent(AdminTable).props('data')).toEqual([{ id: 'x', name: 'y' }]);
    });

    it('AdminForm 的 visible 跟随 store.formConfig.visible', () => {
      const store = useAdminStore(pinia);
      store.formConfig = { mode: 'create', visible: true, title: '新增' };
      const wrapper = shallowMount(ConfigManager, { global: { plugins: [pinia] } });
      expect(wrapper.findComponent(AdminForm).props('visible')).toBe(true);
    });
  });

  describe('onMounted 加载参考数据', () => {
    it('挂载后调用 store.loadReferenceData', () => {
      const store = useAdminStore(pinia);
      shallowMount(ConfigManager, { global: { plugins: [pinia] } });
      expect(store.loadReferenceData).toHaveBeenCalledTimes(1);
    });
  });

  describe('表格事件联动 store', () => {
    it('AdminTable emit create → store.openCreateForm 被调用', async () => {
      const store = useAdminStore(pinia);
      store.selectedConfigTable = 'races';
      const wrapper = shallowMount(ConfigManager, { global: { plugins: [pinia] } });
      await wrapper.findComponent(AdminTable).vm.$emit('create');
      expect(store.openCreateForm).toHaveBeenCalledTimes(1);
      expect(store.openCreateForm).toHaveBeenCalledWith(expect.stringContaining('种族'));
    });

    it('AdminTable emit edit → store.openEditForm 携带行数据与标题', async () => {
      const store = useAdminStore(pinia);
      store.selectedConfigTable = 'factions';
      const row = { id: 'alliance', name: '光辉盟约' };
      const wrapper = shallowMount(ConfigManager, { global: { plugins: [pinia] } });
      await wrapper.findComponent(AdminTable).vm.$emit('edit', row);
      expect(store.openEditForm).toHaveBeenCalledWith(row, expect.stringContaining('阵营'));
    });

    it('AdminTable emit refresh → store.loadTableData 被调用', async () => {
      const store = useAdminStore(pinia);
      const wrapper = shallowMount(ConfigManager, { global: { plugins: [pinia] } });
      await wrapper.findComponent(AdminTable).vm.$emit('refresh');
      expect(store.loadTableData).toHaveBeenCalledTimes(1);
    });

    it('AdminTable emit search → store.doSearch 携带关键词', async () => {
      const store = useAdminStore(pinia);
      const wrapper = shallowMount(ConfigManager, { global: { plugins: [pinia] } });
      await wrapper.findComponent(AdminTable).vm.$emit('search', '关键字');
      expect(store.doSearch).toHaveBeenCalledWith('关键字');
    });
  });

  describe('删除流程', () => {
    it('AdminTable emit delete → 显示 .confirm-overlay 确认弹窗', async () => {
      const wrapper = shallowMount(ConfigManager, { global: { plugins: [pinia] } });
      expect(wrapper.find('.confirm-overlay').exists()).toBe(false);
      await wrapper.findComponent(AdminTable).vm.$emit('delete', { id: 'del1' });
      expect(wrapper.find('.confirm-overlay').exists()).toBe(true);
    });

    it('点击"确认删除"调用 store.deleteRecord 并关闭弹窗', async () => {
      const store = useAdminStore(pinia);
      store.selectedConfigTable = 'factions';
      const wrapper = shallowMount(ConfigManager, { global: { plugins: [pinia] } });
      await wrapper.findComponent(AdminTable).vm.$emit('delete', { id: 'del1' });
      await wrapper.find('.btn-danger').trigger('click');
      expect(store.deleteRecord).toHaveBeenCalledTimes(1);
      // deleteRecord 第一个参数为当前表 dbTable（config_factions），第二个为 id 字符串
      expect(store.deleteRecord).toHaveBeenCalledWith('config_factions', 'del1');
      expect(wrapper.find('.confirm-overlay').exists()).toBe(false);
    });

    it('点击"取消"关闭确认弹窗且不调用 deleteRecord', async () => {
      const store = useAdminStore(pinia);
      const wrapper = shallowMount(ConfigManager, { global: { plugins: [pinia] } });
      await wrapper.findComponent(AdminTable).vm.$emit('delete', { id: 'del1' });
      await wrapper.find('.confirm-footer .btn-secondary').trigger('click');
      expect(store.deleteRecord).not.toHaveBeenCalled();
      expect(wrapper.find('.confirm-overlay').exists()).toBe(false);
    });
  });

  describe('表单事件联动 store', () => {
    it('AdminForm emit submit → store.saveRecord 携带 dbTable 与数据', async () => {
      const store = useAdminStore(pinia);
      store.selectedConfigTable = 'skills';
      const wrapper = shallowMount(ConfigManager, { global: { plugins: [pinia] } });
      const payload = { id: 'sk1', name: '火球术' };
      await wrapper.findComponent(AdminForm).vm.$emit('submit', payload);
      expect(store.saveRecord).toHaveBeenCalledWith('config_skills', payload);
    });

    it('AdminForm emit cancel → store.closeForm 被调用', async () => {
      const store = useAdminStore(pinia);
      const wrapper = shallowMount(ConfigManager, { global: { plugins: [pinia] } });
      await wrapper.findComponent(AdminForm).vm.$emit('cancel');
      expect(store.closeForm).toHaveBeenCalledTimes(1);
    });
  });
});
