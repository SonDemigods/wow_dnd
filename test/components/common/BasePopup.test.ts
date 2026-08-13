/**
 * @fileoverview BasePopup 基础弹窗组件单元测试
 *
 * 覆盖 BasePopup.vue 的：
 * 1. visible 控制渲染（v-if + Transition）
 * 2. 标题、默认 / footer / header-extra 插槽渲染
 * 3. showClose / showFooterClose 按钮显隐与 close 事件
 * 4. overlay @click.self 触发 close，内容区点击不触发
 * 5. maxWidth 内联 style、bodyClass class 应用
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），仅断言 class 与内联 style 属性。
 *  - 使用 @vue/test-utils 的 mount 进行真实渲染。
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import BasePopup from '@/components/common/BasePopup.vue';

describe('BasePopup 基础弹窗组件', () => {
  describe('visible 控制渲染', () => {
    it('visible=true 时渲染 .popup-overlay', () => {
      const wrapper = mount(BasePopup, { props: { visible: true } });
      expect(wrapper.find('.popup-overlay').exists()).toBe(true);
    });

    it('visible=false 时不渲染 .popup-overlay', () => {
      const wrapper = mount(BasePopup, { props: { visible: false } });
      expect(wrapper.find('.popup-overlay').exists()).toBe(false);
    });
  });

  describe('标题与插槽', () => {
    it('title 渲染在 .popup-title', () => {
      const wrapper = mount(BasePopup, {
        props: { visible: true, title: '弹窗标题' },
      });
      expect(wrapper.find('.popup-title').text()).toBe('弹窗标题');
    });

    it('默认 slot 内容渲染在 .popup-body', () => {
      const wrapper = mount(BasePopup, {
        props: { visible: true },
        slots: { default: '<p class="body-content">正文内容</p>' },
      });
      expect(wrapper.find('.popup-body .body-content').exists()).toBe(true);
      expect(wrapper.find('.popup-body').text()).toContain('正文内容');
    });

    it('footer slot 内容渲染在 .popup-footer', () => {
      const wrapper = mount(BasePopup, {
        props: { visible: true, showFooterClose: false },
        slots: { footer: '<button class="footer-action">脚部</button>' },
      });
      expect(wrapper.find('.popup-footer .footer-action').exists()).toBe(true);
    });

    it('header-extra slot 渲染在 .popup-header 内', () => {
      const wrapper = mount(BasePopup, {
        props: { visible: true },
        slots: { 'header-extra': '<span class="extra">额外</span>' },
      });
      expect(wrapper.find('.popup-header .extra').exists()).toBe(true);
    });
  });

  describe('关闭按钮显隐', () => {
    it('showClose 默认 true 时渲染 .popup-close-btn，点击触发 close', async () => {
      const wrapper = mount(BasePopup, { props: { visible: true } });
      expect(wrapper.find('.popup-close-btn').exists()).toBe(true);

      await wrapper.find('.popup-close-btn').trigger('click');

      expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('showClose=false 时不渲染关闭按钮', () => {
      const wrapper = mount(BasePopup, {
        props: { visible: true, showClose: false },
      });
      expect(wrapper.find('.popup-close-btn').exists()).toBe(false);
    });
  });

  describe('底部关闭按钮', () => {
    it('showFooterClose 默认 true 时渲染底部"关闭"按钮，点击触发 close', async () => {
      const wrapper = mount(BasePopup, { props: { visible: true } });
      expect(wrapper.find('.popup-footer-btn').exists()).toBe(true);
      expect(wrapper.find('.popup-footer-btn').text()).toBe('关闭');

      await wrapper.find('.popup-footer-btn').trigger('click');

      expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('showFooterClose=false 且无 footer slot 时不渲染 .popup-footer', () => {
      const wrapper = mount(BasePopup, {
        props: { visible: true, showFooterClose: false },
      });
      expect(wrapper.find('.popup-footer').exists()).toBe(false);
    });
  });

  describe('overlay 交互', () => {
    it('点击 .popup-overlay（@click.self）触发 close', async () => {
      const wrapper = mount(BasePopup, { props: { visible: true } });

      await wrapper.find('.popup-overlay').trigger('click');

      expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('点击内容区 .popup-content 不触发 close', async () => {
      const wrapper = mount(BasePopup, {
        props: { visible: true },
        slots: { default: '<p>正文</p>' },
      });

      await wrapper.find('.popup-content').trigger('click');

      expect(wrapper.emitted('close')).toBeUndefined();
    });
  });

  describe('样式属性应用', () => {
    it('maxWidth 应用到 .popup-content 的内联 style', () => {
      const wrapper = mount(BasePopup, {
        props: { visible: true, maxWidth: '480px' },
      });
      expect(wrapper.find('.popup-content').attributes('style')).toContain('max-width: 480px');
    });

    it('bodyClass 应用到 .popup-body 的 class', () => {
      const wrapper = mount(BasePopup, {
        props: { visible: true, bodyClass: 'custom-body' },
      });
      expect(wrapper.find('.popup-body').classes()).toContain('custom-body');
    });
  });
});
