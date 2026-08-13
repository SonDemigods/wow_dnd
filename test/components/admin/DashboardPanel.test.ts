/**
 * @fileoverview DashboardPanel 仪表盘面板组件单元测试
 *
 * 覆盖：
 * 1. 渲染：统计卡片网格、数据概览、快捷操作按钮
 * 2. 统计卡片：显示 count + label
 * 3. 数据概览：总记录数、Top3、空表列表、游戏版本、数据库版本
 * 4. navigate 事件：点击卡片触发
 *
 * 使用 createStubPinia 隔离 store，mock backupService/importService。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import DashboardPanel from '@/components/admin/DashboardPanel.vue';
import { useAdminStore, CONFIG_TABLES } from '@/modules/admin';
import { createStubPinia } from '../../utils/setup';

// Mock backupService / importService（从 @/modules/data 统一导出）
vi.mock('@/modules/data', () => ({
  backupService: {
    exportBackup: vi.fn().mockResolvedValue(undefined),
  },
  importService: {
    importBackup: vi.fn().mockResolvedValue({ success: true, error: '', importedStores: [], skippedStores: [] }),
  },
}));

// Mock APP_VERSION
vi.mock('@/config/version', () => ({
  APP_VERSION: '1.0.0',
}));

// Mock BACKUP_CONFIG（保留 DATABASE_CONFIG 等其他导出）
vi.mock('@/config/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/database')>();
  return {
    ...actual,
    BACKUP_CONFIG: {
      backupVersion: 'v1.0',
      supportedVersions: ['v1.0'],
    },
  };
});

// Mock useToast
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    show: vi.fn(),
  }),
}));

describe('DashboardPanel 仪表盘面板组件', () => {
  beforeEach(() => {
    createStubPinia();
  });

  describe('渲染', () => {
    it('渲染 .dashboard-panel 和 page-title', () => {
      const wrapper = shallowMount(DashboardPanel, { global: { plugins: [createStubPinia()] } });
      expect(wrapper.find('.dashboard-panel').exists()).toBe(true);
      expect(wrapper.find('.page-title').text()).toBe('仪表盘');
    });

    it('渲染统计卡片网格', () => {
      const pinia = createStubPinia();
      const wrapper = shallowMount(DashboardPanel, { global: { plugins: [pinia] } });
      // 15 张配置表 = 15 张统计卡片
      expect(wrapper.findAll('.stat-card')).toHaveLength(15);
    });

    it('渲染数据概览区域', () => {
      const pinia = createStubPinia();
      const wrapper = shallowMount(DashboardPanel, { global: { plugins: [pinia] } });
      expect(wrapper.find('.overview-section').exists()).toBe(true);
      // 总记录数 + Top3 + 空表 + 版本(游戏+数据库合并) = 4 卡片
      expect(wrapper.findAll('.overview-card').length).toBeGreaterThanOrEqual(4);
    });

    it('渲染快捷操作按钮', () => {
      const pinia = createStubPinia();
      const wrapper = shallowMount(DashboardPanel, { global: { plugins: [pinia] } });
      expect(wrapper.find('.quick-actions').exists()).toBe(true);
      expect(wrapper.findAll('.btn-action').length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('统计卡片内容', () => {
    it('卡片显示 count 和 label', () => {
      const pinia = createStubPinia();
      const store = useAdminStore(pinia);
      store.dashboardStats = { tableCounts: { config_mobs: 42 } };
      const wrapper = shallowMount(DashboardPanel, { global: { plugins: [pinia] } });
      const cards = wrapper.findAll('.stat-card');
      const mobsCard = cards.find(c => c.find('.stat-label').text() === '怪物');
      expect(mobsCard).toBeDefined();
      expect(mobsCard!.find('.stat-value').text()).toBe('42');
    });

    it('count 为 0 时显示 0', () => {
      const pinia = createStubPinia();
      const wrapper = shallowMount(DashboardPanel, { global: { plugins: [pinia] } });
      const cards = wrapper.findAll('.stat-card');
      const firstCard = cards[0];
      expect(firstCard.find('.stat-value').text()).toBe('0');
    });
  });

  describe('数据概览', () => {
    it('显示总记录数', () => {
      const pinia = createStubPinia();
      const store = useAdminStore(pinia);
      store.dashboardStats = {
        tableCounts: {
          config_mobs: 10,
          config_bosses: 5,
        },
      };
      const wrapper = shallowMount(DashboardPanel, { global: { plugins: [pinia] } });
      expect(wrapper.find('.overview-value').text()).toBe('15');
    });

    it('空表列表显示空表名称', () => {
      const pinia = createStubPinia();
      const wrapper = shallowMount(DashboardPanel, { global: { plugins: [pinia] } });
      const emptyCard = wrapper.findAll('.overview-card').find(c => c.find('.overview-label').text() === '空表');
      expect(emptyCard).toBeDefined();
      expect(emptyCard!.findAll('.empty-table-item').length).toBeGreaterThan(0);
    });

    it('无空表时显示"无空表"', () => {
      const pinia = createStubPinia();
      const store = useAdminStore(pinia);
      const counts: Record<string, number> = {};
      for (const t of CONFIG_TABLES) {
        counts[t.dbTable] = 1;
      }
      store.dashboardStats = { tableCounts: counts };

      const wrapper = shallowMount(DashboardPanel, { global: { plugins: [pinia] } });
      const emptyCard = wrapper.findAll('.overview-card').find(c => c.find('.overview-label').text() === '空表');
      expect(emptyCard!.find('.empty-text').exists()).toBe(true);
    });

    it('显示游戏版本和数据库版本在同一卡片中', () => {
      const pinia = createStubPinia();
      const wrapper = shallowMount(DashboardPanel, { global: { plugins: [pinia] } });
      const versionCard = wrapper.find('.version-card');
      expect(versionCard.exists()).toBe(true);
      const rows = versionCard.findAll('.version-row');
      expect(rows).toHaveLength(2);
      expect(rows[0].find('.overview-label').text()).toBe('游戏版本');
      expect(rows[0].find('.version-value').text()).toBe('1.0.0');
      expect(rows[1].find('.overview-label').text()).toBe('数据库版本');
      expect(rows[1].find('.version-value').text()).toBe('v1.0');
    });
  });

  describe('navigate 事件', () => {
    it('点击统计卡片触发 navigate', async () => {
      const pinia = createStubPinia();
      const wrapper = shallowMount(DashboardPanel, { global: { plugins: [pinia] } });
      const firstCard = wrapper.findAll('.stat-card')[0];
      await firstCard.trigger('click');
      expect(firstCard.exists()).toBe(true);
    });
  });

  describe('重置全部确认弹窗', () => {
    it('默认不显示确认弹窗', () => {
      const pinia = createStubPinia();
      const wrapper = shallowMount(DashboardPanel, { global: { plugins: [pinia] } });
      expect(wrapper.find('.confirm-overlay').exists()).toBe(false);
    });

    it('点击"重置全部配置"按钮显示确认弹窗', async () => {
      const pinia = createStubPinia();
      const wrapper = shallowMount(DashboardPanel, { global: { plugins: [pinia] } });
      const resetBtn = wrapper.findAll('.btn-action').find(b => b.text().includes('重置全部'));
      await resetBtn!.trigger('click');
      expect(wrapper.find('.confirm-overlay').exists()).toBe(true);
    });
  });
});
