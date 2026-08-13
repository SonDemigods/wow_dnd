/**
 * @fileoverview AdminLayout 后台管理布局组件单元测试
 *
 * 覆盖 AdminLayout.vue 的：
 * 1. 渲染：.admin-layout 布局、侧边栏导航、仪表盘视图
 * 2. onMounted 调用 store.loadDashboardStats
 * 3. 导航交互：点击配置表项调用 store.switchView('config') + store.selectConfigTable(key)
 * 4. 退出按钮 emit('exit')
 * 5. dashboardStats 驱动 stat-card 渲染
 *
 * 遵循 code_rule：
 *  - 使用 createStubPinia() 隔离 store 副作用，断言 stub action 被调用。
 *  - 不断言计算后 CSS 样式值，仅断言 class、文本、emit、action 调用。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import AdminLayout from '@/components/admin/AdminLayout.vue';
import DashboardPanel from '@/components/admin/DashboardPanel.vue';
import { useAdminStore } from '@/modules/admin';
import { CONFIG_TABLES } from '@/modules/admin/types';
import { createStubPinia } from '../../utils/setup';

describe('AdminLayout 后台管理布局组件', () => {
  let pinia: ReturnType<typeof createStubPinia>;

  beforeEach(() => {
    pinia = createStubPinia();
  });

  describe('渲染', () => {
    it('渲染 .admin-layout 与侧边栏 .admin-sidebar', () => {
      const wrapper = mount(AdminLayout, { global: { plugins: [pinia] } });
      expect(wrapper.find('.admin-layout').exists()).toBe(true);
      expect(wrapper.find('.admin-sidebar').exists()).toBe(true);
    });

    it('侧边栏默认视图(dashboard)时二级菜单 .nav-sub-item 不可见', () => {
      const wrapper = mount(AdminLayout, { global: { plugins: [pinia] } });
      // v-show 控制隐藏，元素存在但不显示
      const subItems = wrapper.findAll('.nav-sub-item');
      expect(subItems).toHaveLength(CONFIG_TABLES.length);
      // dashboard 视图下二级菜单 v-show=false
      subItems.forEach(item => {
        expect(item.isVisible()).toBe(false);
      });
    });

    it('侧边栏标题为"后台管理"', () => {
      const wrapper = mount(AdminLayout, { global: { plugins: [pinia] } });
      expect(wrapper.find('.sidebar-header h2').text()).toBe('后台管理');
    });

    it('默认 currentView=dashboard 时渲染仪表盘视图而非配置视图', () => {
      const wrapper = mount(AdminLayout, { global: { plugins: [pinia] } });
      // Phase 5：仪表盘内容提取到 DashboardPanel.vue
      expect(wrapper.findComponent(DashboardPanel).exists()).toBe(true);
      expect(wrapper.find('.config-view').exists()).toBe(false);
    });

    it('currentView=config 时渲染配置视图（ConfigManager）', async () => {
      const store = useAdminStore(pinia);
      const wrapper = mount(AdminLayout, { global: { plugins: [pinia] } });
      store.currentView = 'config';
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.config-view').exists()).toBe(true);
      expect(wrapper.find('.dashboard-view').exists()).toBe(false);
    });
  });

  describe('onMounted 加载统计', () => {
    it('挂载后调用 store.loadDashboardStats', () => {
      const store = useAdminStore(pinia);
      mount(AdminLayout, { global: { plugins: [pinia] } });
      expect(store.loadDashboardStats).toHaveBeenCalledTimes(1);
    });
  });

  describe('导航交互', () => {
    it('点击配置表导航项调用 switchView("config") 与 selectConfigTable(key)', async () => {
      const store = useAdminStore(pinia);
      const wrapper = mount(AdminLayout, { global: { plugins: [pinia] } });
      const firstSub = wrapper.findAll('.nav-sub-item')[0];
      await firstSub.trigger('click');
      expect(store.switchView).toHaveBeenCalledWith('config');
      expect(store.selectConfigTable).toHaveBeenCalledWith(CONFIG_TABLES[0].key);
    });

    it('点击仪表盘 stat-card 调用 switchView("config") 与 selectConfigTable', async () => {
      const store = useAdminStore(pinia);
      const wrapper = mount(AdminLayout, { global: { plugins: [pinia] } });
      const firstCard = wrapper.findAll('.stat-card')[0];
      await firstCard.trigger('click');
      expect(store.switchView).toHaveBeenCalledWith('config');
      expect(store.selectConfigTable).toHaveBeenCalledWith(CONFIG_TABLES[0].key);
    });
  });

  describe('退出按钮', () => {
    it('点击"返回游戏"按钮触发 exit 事件', async () => {
      const wrapper = mount(AdminLayout, { global: { plugins: [pinia] } });
      await wrapper.find('.exit-btn').trigger('click');
      expect(wrapper.emitted('exit')).toHaveLength(1);
    });
  });

  describe('仪表盘统计渲染', () => {
    it('dashboardStats.tableCounts 驱动 stat-card 数值显示', async () => {
      const store = useAdminStore(pinia);
      const wrapper = mount(AdminLayout, { global: { plugins: [pinia] } });
      store.dashboardStats = { tableCounts: { config_factions: 7 } };
      await wrapper.vm.$nextTick();
      const firstCard = wrapper.findAll('.stat-card')[0];
      // CONFIG_TABLES[0] = factions → dbTable = config_factions
      expect(firstCard.find('.stat-value').text()).toBe('7');
      expect(firstCard.find('.stat-label').text()).toBe(CONFIG_TABLES[0].label);
    });

    it('tableCounts 无对应表时 stat-value 显示 0', async () => {
      const store = useAdminStore(pinia);
      const wrapper = mount(AdminLayout, { global: { plugins: [pinia] } });
      store.dashboardStats = { tableCounts: {} };
      await wrapper.vm.$nextTick();
      const firstCard = wrapper.findAll('.stat-card')[0];
      expect(firstCard.find('.stat-value').text()).toBe('0');
    });
  });
});
