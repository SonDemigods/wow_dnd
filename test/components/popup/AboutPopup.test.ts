/**
 * @fileoverview AboutPopup 关于弹窗组件单元测试
 *
 * 覆盖 AboutPopup.vue 的：
 * 1. visible 控制 BasePopup 渲染与标题"关于"
 * 2. 项目名/英文名/简介/作者/参与人/版本号渲染
 * 3. 空值容错：authors/contributors/description 为空时显示"暂无"
 * 4. repoUrl 为空时不渲染仓库地址行
 * 5. 点击关闭按钮与遮罩层均触发 close 事件
 *
 * 遵循 code_rule：
 *  - mock CREDITS 为空占位符以测试空值容错回退逻辑。
 *  - 不断言计算后 CSS 样式值。
 */
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import AboutPopup from '@/components/popup/AboutPopup.vue';

// mock CREDITS 为空占位符，测试 AboutPopup 的空值容错回退逻辑
// （实际 CREDITS 已填入数据，但空值容错测试需要空数据验证"暂无"回退）
vi.mock('@/config/credits', () => ({
  CREDITS: {
    authors: [],
    contributors: [],
    description: '',
    repoUrl: '',
  },
}));

describe('AboutPopup 关于弹窗组件', () => {
  describe('渲染', () => {
    it('visible=true 时渲染弹窗标题"关于"', () => {
      const wrapper = mount(AboutPopup, { props: { visible: true } });
      expect(wrapper.find('.popup-title').text()).toBe('关于');
    });

    it('visible=false 时不渲染弹窗内容', () => {
      const wrapper = mount(AboutPopup, { props: { visible: false } });
      expect(wrapper.find('.popup-title').exists()).toBe(false);
    });

    it('渲染项目名"战争艺术：地下城"与英文名"Art of War: Dungeons"', () => {
      const wrapper = mount(AboutPopup, { props: { visible: true } });
      expect(wrapper.find('.about-project-name').text()).toBe('战争艺术：地下城');
      expect(wrapper.find('.about-project-en').text()).toBe('Art of War: Dungeons');
    });
  });

  describe('空值容错（当前 CREDITS 为空占位符）', () => {
    it('authors 为空时作者显示"暂无"', () => {
      const wrapper = mount(AboutPopup, { props: { visible: true } });
      const authorRow = wrapper.findAll('.about-row').find(r =>
        r.find('.about-label').text() === '作者'
      );
      expect(authorRow?.find('.about-value').text()).toBe('暂无');
    });

    it('contributors 为空时参与人显示"暂无"', () => {
      const wrapper = mount(AboutPopup, { props: { visible: true } });
      const contributorRow = wrapper.findAll('.about-row').find(r =>
        r.find('.about-label').text() === '参与人'
      );
      expect(contributorRow?.find('.about-value').text()).toBe('暂无');
    });

    it('description 为空时简介显示"暂无"', () => {
      const wrapper = mount(AboutPopup, { props: { visible: true } });
      expect(wrapper.find('.about-section-text').text()).toBe('暂无');
    });

    it('repoUrl 为空时不渲染仓库地址行', () => {
      const wrapper = mount(AboutPopup, { props: { visible: true } });
      const repoRow = wrapper.findAll('.about-row').find(r =>
        r.find('.about-label').text() === '仓库地址'
      );
      expect(repoRow).toBeUndefined();
    });
  });

  describe('版本号展示', () => {
    it('展示三层版本号（带 v 前缀）', () => {
      const wrapper = mount(AboutPopup, { props: { visible: true } });
      const labels = wrapper.findAll('.about-label').map(el => el.text());
      expect(labels).toContain('应用版本');
      expect(labels).toContain('数据版本');
      expect(labels).toContain('数据库版本');
    });

    it('应用版本值为 v1.0.0（与 APP_VERSION 同步）', () => {
      const wrapper = mount(AboutPopup, { props: { visible: true } });
      const appVersionRow = wrapper.findAll('.about-row').find(r =>
        r.find('.about-label').text() === '应用版本'
      );
      expect(appVersionRow?.find('.about-value').text()).toBe('v1.0.0');
    });

    it('数据版本与数据库版本以 v 前缀展示', () => {
      const wrapper = mount(AboutPopup, { props: { visible: true } });
      const dataVersionRow = wrapper.findAll('.about-row').find(r =>
        r.find('.about-label').text() === '数据版本'
      );
      const dbVersionRow = wrapper.findAll('.about-row').find(r =>
        r.find('.about-label').text() === '数据库版本'
      );
      expect(dataVersionRow?.find('.about-value').text()).toBe('v1');
      expect(dbVersionRow?.find('.about-value').text()).toBe('v1');
    });
  });

  describe('关闭交互', () => {
    it('点击 footer"关闭"按钮触发 close 事件', async () => {
      const wrapper = mount(AboutPopup, { props: { visible: true } });
      await wrapper.find('.popup-footer-btn').trigger('click');
      expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('点击遮罩层透传 close 事件', async () => {
      const wrapper = mount(AboutPopup, { props: { visible: true } });
      await wrapper.find('.popup-overlay').trigger('click');
      expect(wrapper.emitted('close')).toHaveLength(1);
    });
  });
});
