/**
 * @fileoverview ArchiveManagerPopup 存档管理弹窗组件单元测试
 *
 * 覆盖 ArchiveManagerPopup.vue 的：
 * 1. visible 控制 BasePopup 渲染与标题"存档管理"
 * 2. 渲染导出/导入/修复按钮（常驻），迁移按钮仅 versionMismatch 时显示
 * 3. 导出：点击导出 → characterStore.exportBackup
 * 4. 修复：点击修复 → 确认弹窗 → confirmRepair → characterStore.repairBaseData
 * 5. 迁移：点击迁移 → 确认弹窗 → confirmMigration → migrationService.runStartupMigration + emit migrated
 *
 * 遵循 code_rule：
 *  - 使用 mount + stub BaseIcon，让 BasePopup 真实渲染。
 *  - migrationService 通过 vi.mock 替换；createStubPinia stub Store actions。
 *  - 注册空 v-motion 指令；eventBus 真实 + clearAll。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ArchiveManagerPopup from '@/components/popup/ArchiveManagerPopup.vue';
import { useCharacterStore } from '@/modules/character';
import { eventBus, GameEvents } from '@/modules/bus';
import { migrationService } from '@/modules/data';
import { createStubPinia } from '../../utils/setup';

// mock migrationService，避免触发真实 DB 迁移
vi.mock('@/modules/data', () => ({
  migrationService: {
    runStartupMigration: vi.fn(),
  },
}));

// 空实现 v-motion 指令，避免模板中 v-motion 解析失败告警
const motionDirective = {
  mounted: () => {},
  updated: () => {}
};

describe('ArchiveManagerPopup 存档管理弹窗组件', () => {
  let pinia: ReturnType<typeof createStubPinia>;

  beforeEach(() => {
    pinia = createStubPinia();
    eventBus.clearAll();
    vi.mocked(migrationService.runStartupMigration).mockReset();
  });

  const mountComp = (props: Record<string, unknown> = {}) =>
    mount(ArchiveManagerPopup, {
      props,
      global: {
        plugins: [pinia],
        directives: { motion: motionDirective },
        stubs: {
          BaseIcon: true,
        }
      }
    });

  describe('渲染', () => {
    it('visible=true 时渲染弹窗标题"存档管理"', () => {
      const wrapper = mountComp({ visible: true });
      expect(wrapper.find('.popup-title').text()).toBe('存档管理');
    });

    it('visible=false 时不渲染弹窗内容', () => {
      const wrapper = mountComp({ visible: false });
      expect(wrapper.find('.popup-title').exists()).toBe(false);
    });

    it('渲染导出/导入/修复三个按钮', () => {
      const wrapper = mountComp({ visible: true });
      const texts = wrapper.findAll('.action-btn').map(b => b.text());
      expect(texts.some(t => t.includes('导出存档'))).toBe(true);
      expect(texts.some(t => t.includes('导入存档'))).toBe(true);
      expect(texts.some(t => t.includes('修复基础数据'))).toBe(true);
    });

    it('versionMismatch 未传时不渲染迁移按钮', () => {
      const wrapper = mountComp({ visible: true });
      expect(wrapper.find('.action-btn-migrate').exists()).toBe(false);
    });

    it('versionMismatch=true 时渲染迁移按钮', () => {
      const wrapper = mountComp({ visible: true, versionMismatch: true });
      expect(wrapper.find('.action-btn-migrate').exists()).toBe(true);
      expect(wrapper.find('.action-btn-migrate').text()).toContain('数据迁移');
    });
  });

  describe('导出存档', () => {
    it('点击导出按钮调用 characterStore.exportBackup', async () => {
      const characterStore = useCharacterStore(pinia);
      const wrapper = mountComp({ visible: true });
      await wrapper.find('.action-btn-export').trigger('click');
      await flushPromises();

      expect(characterStore.exportBackup).toHaveBeenCalledTimes(1);
    });

    it('导出成功后 emit eventBus DATA_EXPORTED', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.DATA_EXPORTED, spy);
      const wrapper = mountComp({ visible: true });
      await wrapper.find('.action-btn-export').trigger('click');
      await flushPromises();

      expect(spy).toHaveBeenCalledWith(null);
    });
  });

  describe('修复基础数据', () => {
    it('点击修复按钮弹出确认弹窗', async () => {
      const wrapper = mountComp({ visible: true });
      expect(wrapper.find('.confirm-modal-overlay').exists()).toBe(false);

      await wrapper.find('.action-btn-repair').trigger('click');

      expect(wrapper.find('.confirm-modal-overlay').exists()).toBe(true);
      expect(wrapper.find('.confirm-modal h3').text()).toBe('确认修复基础数据');
    });

    it('确认修复后调用 characterStore.repairBaseData', async () => {
      const characterStore = useCharacterStore(pinia);
      const wrapper = mountComp({ visible: true });

      await wrapper.find('.action-btn-repair').trigger('click');
      await wrapper.find('.confirm-btn-delete').trigger('click');
      await flushPromises();

      expect(characterStore.repairBaseData).toHaveBeenCalledTimes(1);
    });

    it('修复成功后显示修复结果弹窗', async () => {
      const wrapper = mountComp({ visible: true });

      await wrapper.find('.action-btn-repair').trigger('click');
      await wrapper.find('.confirm-btn-delete').trigger('click');
      await flushPromises();

      const titles = wrapper.findAll('.confirm-modal h3');
      const successTitle = titles.filter(h => h.text().includes('修复成功'));
      expect(successTitle.length).toBe(1);
    });
  });

  describe('数据迁移', () => {
    it('点击迁移按钮弹出确认弹窗', async () => {
      const wrapper = mountComp({ visible: true, versionMismatch: true });
      expect(wrapper.find('.confirm-modal-overlay').exists()).toBe(false);

      await wrapper.find('.action-btn-migrate').trigger('click');

      expect(wrapper.find('.confirm-modal-overlay').exists()).toBe(true);
      expect(wrapper.find('.confirm-modal h3').text()).toBe('确认数据迁移');
    });

    it('确认迁移成功后调用 migrationService.runStartupMigration 并 emit migrated', async () => {
      vi.mocked(migrationService.runStartupMigration).mockResolvedValue({
        success: true,
        fromVersion: 0,
        toVersion: 1,
      });
      const wrapper = mountComp({ visible: true, versionMismatch: true });

      await wrapper.find('.action-btn-migrate').trigger('click');
      await wrapper.find('.confirm-btn-delete').trigger('click');
      await flushPromises();

      expect(migrationService.runStartupMigration).toHaveBeenCalledTimes(1);
      expect(wrapper.emitted('migrated')).toHaveLength(1);
    });

    it('迁移成功后显示迁移结果弹窗', async () => {
      vi.mocked(migrationService.runStartupMigration).mockResolvedValue({
        success: true,
        fromVersion: 0,
        toVersion: 1,
      });
      const wrapper = mountComp({ visible: true, versionMismatch: true });

      await wrapper.find('.action-btn-migrate').trigger('click');
      await wrapper.find('.confirm-btn-delete').trigger('click');
      await flushPromises();

      const titles = wrapper.findAll('.confirm-modal h3');
      const successTitle = titles.filter(h => h.text().includes('迁移成功'));
      expect(successTitle.length).toBe(1);
    });

    it('迁移失败时不 emit migrated，显示失败结果弹窗', async () => {
      vi.mocked(migrationService.runStartupMigration).mockResolvedValue({
        success: false,
        fromVersion: 0,
        toVersion: 1,
        error: '测试迁移失败',
      });
      const wrapper = mountComp({ visible: true, versionMismatch: true });

      await wrapper.find('.action-btn-migrate').trigger('click');
      await wrapper.find('.confirm-btn-delete').trigger('click');
      await flushPromises();

      expect(wrapper.emitted('migrated')).toBeUndefined();
      const titles = wrapper.findAll('.confirm-modal h3');
      const failTitle = titles.filter(h => h.text().includes('迁移失败'));
      expect(failTitle.length).toBe(1);
    });
  });

  describe('关闭交互', () => {
    it('点击遮罩层透传 close 事件', async () => {
      const wrapper = mountComp({ visible: true });
      await wrapper.find('.popup-overlay').trigger('click');
      expect(wrapper.emitted('close')).toHaveLength(1);
    });
  });
});
