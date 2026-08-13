/**
 * @fileoverview AlertPopup 提示弹窗组件单元测试
 *
 * 覆盖 AlertPopup.vue 的：
 * 1. message 渲染在 .alert-message
 * 2. title 默认 '提示'，传入时使用传入值
 * 3. 底部"确定"按钮点击触发 close 事件
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），仅断言 class、文本与 emit 事件。
 *  - 使用 @vue/test-utils 的 mount 真实渲染（含 BasePopup 子组件）。
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AlertPopup from '@/components/common/AlertPopup.vue';

describe('AlertPopup 提示弹窗组件', () => {
  describe('渲染', () => {
    it('message 渲染在 .alert-message', () => {
      const wrapper = mount(AlertPopup, {
        props: { visible: true, message: '操作成功' },
      });
      expect(wrapper.find('.alert-message').text()).toBe('操作成功');
    });

    it('未传 title 时使用默认值"提示"', () => {
      const wrapper = mount(AlertPopup, {
        props: { visible: true, message: '消息' },
      });
      expect(wrapper.find('.popup-title').text()).toBe('提示');
    });

    it('传入 title 时使用传入值', () => {
      const wrapper = mount(AlertPopup, {
        props: { visible: true, title: '警告', message: '消息' },
      });
      expect(wrapper.find('.popup-title').text()).toBe('警告');
    });
  });

  describe('交互', () => {
    it('点击"确定"按钮触发 close 事件（长度为 1）', async () => {
      const wrapper = mount(AlertPopup, {
        props: { visible: true, message: '消息' },
      });
      const confirmBtn = wrapper.find('.popup-footer-btn.confirm');
      expect(confirmBtn.exists()).toBe(true);

      await confirmBtn.trigger('click');

      expect(wrapper.emitted('close')).toHaveLength(1);
    });
  });
});
