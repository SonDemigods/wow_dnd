/**
 * @fileoverview SystemPopup 系统弹窗组件单元测试
 *
 * 覆盖 SystemPopup.vue 的：
 * 1. visible 控制 BasePopup 渲染
 * 2. 渲染"音量设置"与"退出游戏"按钮
 * 3. 点击音量设置：emit close + open-audio，并 emit eventBus UI_CLICK({source:system_audio})
 * 4. 点击退出游戏：emit exit，并 emit eventBus UI_CLICK({source:system_exit})
 * 5. 点击关闭按钮：emit close，并 emit eventBus UI_CLICK({source:system_close})
 * 6. BasePopup close 事件透传为组件 close
 *
 * 遵循 code_rule：
 *  - eventBus 使用真实实现（纯内存无副作用），通过 eventBus.on 注册 spy 监听断言。
 *  - beforeEach 中 eventBus.clearAll() 清理状态，避免用例间污染。
 *  - 不断言计算后 CSS 样式值。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import SystemPopup from '@/components/popup/SystemPopup.vue';
import { eventBus, GameEvents } from '@/modules/bus';

vi.mock('@iconify/vue', () => ({
  Icon: defineComponent({
    name: 'MockIcon',
    props: ['icon', 'width', 'height', 'color'],
    setup(p) {
      return () => h('span', { class: 'mock-icon', 'data-icon': p.icon, 'data-width': p.width });
    },
  }),
  loadIcon: vi.fn().mockResolvedValue({ body: '<path d="M0 0h512v512H0z"/>' }),
}));

describe('SystemPopup 系统弹窗组件', () => {
  beforeEach(() => {
    eventBus.clearAll();
  });

  describe('渲染', () => {
    it('visible=true 时渲染弹窗标题"系统"', () => {
      const wrapper = mount(SystemPopup, { props: { visible: true } });
      expect(wrapper.find('.popup-title').text()).toBe('系统');
    });

    it('渲染"音量设置"与"退出游戏"两个按钮', () => {
      const wrapper = mount(SystemPopup, { props: { visible: true } });
      const labels = wrapper.findAll('.system-btn-label').map(el => el.text());
      expect(labels).toContain('音量设置');
      expect(labels).toContain('退出游戏');
    });

    it('音量按钮含 audio-btn 类，退出按钮含 exit-btn 类', () => {
      const wrapper = mount(SystemPopup, { props: { visible: true } });
      expect(wrapper.find('.system-btn.audio-btn').exists()).toBe(true);
      expect(wrapper.find('.system-btn.exit-btn').exists()).toBe(true);
    });

    it('footer 插槽渲染"关闭"按钮', () => {
      const wrapper = mount(SystemPopup, { props: { visible: true } });
      const footerBtn = wrapper.find('.popup-footer-btn');
      expect(footerBtn.exists()).toBe(true);
      expect(footerBtn.text()).toBe('关闭');
    });
  });

  describe('关于区块（版本号展示）', () => {
    it('渲染 .about-section 区块与"关于"标题', () => {
      const wrapper = mount(SystemPopup, { props: { visible: true } });
      expect(wrapper.find('.about-section').exists()).toBe(true);
      expect(wrapper.find('.about-title').text()).toBe('关于');
    });

    it('展示三层版本号：应用版本、数据版本、数据库版本', () => {
      const wrapper = mount(SystemPopup, { props: { visible: true } });
      const labels = wrapper.findAll('.info-label').map(el => el.text());
      expect(labels).toContain('应用版本');
      expect(labels).toContain('数据版本');
      expect(labels).toContain('数据库版本');
    });

    it('应用版本值为 1.0.0（与 APP_VERSION 同步）', () => {
      const wrapper = mount(SystemPopup, { props: { visible: true } });
      const rows = wrapper.findAll('.info-row');
      const appVersionRow = rows.find(r => r.find('.info-label').text() === '应用版本');
      expect(appVersionRow?.find('.info-value').text()).toBe('1.0.0');
    });

    it('数据版本与数据库版本以 v 前缀展示', () => {
      const wrapper = mount(SystemPopup, { props: { visible: true } });
      const rows = wrapper.findAll('.info-row');
      const dataVersionRow = rows.find(r => r.find('.info-label').text() === '数据版本');
      const dbVersionRow = rows.find(r => r.find('.info-label').text() === '数据库版本');
      expect(dataVersionRow?.find('.info-value').text()).toBe('v1');
      expect(dbVersionRow?.find('.info-value').text()).toBe('v1');
    });
  });

  describe('音量设置交互', () => {
    it('点击"音量设置"触发 close 与 open-audio 事件', async () => {
      const wrapper = mount(SystemPopup, { props: { visible: true } });
      await wrapper.find('.audio-btn').trigger('click');
      expect(wrapper.emitted('close')).toHaveLength(1);
      expect(wrapper.emitted('open-audio')).toHaveLength(1);
    });

    it('点击"音量设置"emit eventBus UI_CLICK({source:system_audio})', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.UI_CLICK, spy);
      const wrapper = mount(SystemPopup, { props: { visible: true } });
      await wrapper.find('.audio-btn').trigger('click');
      expect(spy).toHaveBeenCalledWith({ source: 'system_audio' });
    });
  });

  describe('退出游戏交互', () => {
    it('点击"退出游戏"触发 exit 事件，不触发 close/open-audio', async () => {
      const wrapper = mount(SystemPopup, { props: { visible: true } });
      await wrapper.find('.exit-btn').trigger('click');
      expect(wrapper.emitted('exit')).toHaveLength(1);
      expect(wrapper.emitted('close')).toBeUndefined();
      expect(wrapper.emitted('open-audio')).toBeUndefined();
    });

    it('点击"退出游戏"emit eventBus UI_CLICK({source:system_exit})', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.UI_CLICK, spy);
      const wrapper = mount(SystemPopup, { props: { visible: true } });
      await wrapper.find('.exit-btn').trigger('click');
      expect(spy).toHaveBeenCalledWith({ source: 'system_exit' });
    });
  });

  describe('关闭按钮交互', () => {
    it('点击 footer"关闭"按钮触发 close 事件', async () => {
      const wrapper = mount(SystemPopup, { props: { visible: true } });
      await wrapper.find('.popup-footer-btn').trigger('click');
      expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('点击 footer"关闭"emit eventBus UI_CLICK({source:system_close})', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.UI_CLICK, spy);
      const wrapper = mount(SystemPopup, { props: { visible: true } });
      await wrapper.find('.popup-footer-btn').trigger('click');
      expect(spy).toHaveBeenCalledWith({ source: 'system_close' });
    });
  });

  describe('BasePopup close 透传', () => {
    it('BasePopup emit close 时组件透传 close 事件', async () => {
      const wrapper = mount(SystemPopup, { props: { visible: true } });
      // 点击遮罩层（BasePopup overlay @click.self 触发 close）
      await wrapper.find('.popup-overlay').trigger('click');
      expect(wrapper.emitted('close')).toHaveLength(1);
    });
  });
});
