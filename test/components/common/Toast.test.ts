/**
 * @fileoverview Toast 提示组件单元测试
 *
 * 覆盖 Toast.vue 的：
 * 1. 渲染：visible 控制 v-if 显隐；message 文本输出
 * 2. 样式类：type 默认 'info'，应用 info/success/warning/danger 类
 * 3. 图标：icon 渲染在 .toast-icon
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），仅断言 class、属性、文本内容、是否存在。
 *  - 使用 @vue/test-utils 的 mount 进行真实渲染。
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Toast from '@/components/common/Toast.vue';

describe('Toast 提示组件', () => {
  describe('v-if 显隐', () => {
    it('visible=true 时渲染 .toast 元素', () => {
      const wrapper = mount(Toast, {
        props: { visible: true, message: '提示内容' },
      });
      expect(wrapper.find('.toast').exists()).toBe(true);
    });

    it('visible=false 时不渲染 .toast 元素', () => {
      const wrapper = mount(Toast, {
        props: { visible: false, message: '提示内容' },
      });
      expect(wrapper.find('.toast').exists()).toBe(false);
    });
  });

  describe('message 文本', () => {
    it('message 渲染在 .toast-message', () => {
      const wrapper = mount(Toast, {
        props: { visible: true, message: '操作成功' },
      });
      expect(wrapper.find('.toast-message').text()).toBe('操作成功');
    });

    it('渲染空字符串 message', () => {
      const wrapper = mount(Toast, {
        props: { visible: true, message: '' },
      });
      expect(wrapper.find('.toast-message').text()).toBe('');
    });
  });

  describe('type 样式类', () => {
    it('未传 type 时默认 info 类，根元素 class 包含 toast 与 info', () => {
      const wrapper = mount(Toast, {
        props: { visible: true, message: 'msg' },
      });
      const root = wrapper.find('.toast');
      expect(root.classes()).toContain('toast');
      expect(root.classes()).toContain('info');
    });

    it('type=success 时应用 success 类', () => {
      const wrapper = mount(Toast, {
        props: { visible: true, message: 'msg', type: 'success' },
      });
      expect(wrapper.find('.toast').classes()).toContain('success');
    });

    it('type=warning 时应用 warning 类', () => {
      const wrapper = mount(Toast, {
        props: { visible: true, message: 'msg', type: 'warning' },
      });
      expect(wrapper.find('.toast').classes()).toContain('warning');
    });

    it('type=danger 时应用 danger 类', () => {
      const wrapper = mount(Toast, {
        props: { visible: true, message: 'msg', type: 'danger' },
      });
      expect(wrapper.find('.toast').classes()).toContain('danger');
    });
  });

  describe('icon 图标', () => {
    it('传入 icon 时渲染在 .toast-icon', () => {
      const wrapper = mount(Toast, {
        props: { visible: true, message: 'msg', icon: '⚠' },
      });
      expect(wrapper.find('.toast-icon').text()).toBe('⚠');
    });

    it('未传 icon 时 .toast-icon 渲染为空字符串', () => {
      const wrapper = mount(Toast, {
        props: { visible: true, message: 'msg' },
      });
      expect(wrapper.find('.toast-icon').text()).toBe('');
    });
  });
});
