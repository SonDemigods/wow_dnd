/**
 * @fileoverview ResourceBar 资源条组件单元测试
 *
 * 覆盖 ResourceBar.vue 的：
 * 1. 文本：name 渲染在 .resource-label；current/max 渲染为 `${current}/${max}` 在 .resource-value
 * 2. 百分比：percent 应用到 .resource-fill 的内联 style width
 * 3. type 样式类：默认 'hp'，应用到 .resource-fill class
 * 4. 图标：icon 传给 BaseIcon；iconName 优先于 icon 传给 BaseIcon
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），可断言 class、内联 style 变量、文本、子组件 props。
 *  - 依赖 BaseIcon，需 mock @iconify/vue 避免真实网络加载。
 */
import { describe, it, expect, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import ResourceBar from '@/components/common/ResourceBar.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';

vi.mock('@iconify/vue', () => ({
  Icon: defineComponent({
    name: 'MockIcon',
    props: ['icon', 'width', 'height', 'color'],
    setup(props) {
      return () => ({ tag: 'span', attrs: { class: 'mock-icon', 'data-icon': props.icon } });
    },
  }),
  loadIcon: vi.fn().mockResolvedValue({ body: '<path d="M0 0h512v512H0z"/>' }),
}));

describe('ResourceBar 资源条组件', () => {
  describe('文本渲染', () => {
    it('name 渲染在 .resource-label', () => {
      const wrapper = mount(ResourceBar, {
        props: { icon: 'heart', name: '生命', current: 80, max: 100, percent: 80 },
      });
      expect(wrapper.find('.resource-label').text()).toBe('生命');
    });

    it('current/max 渲染为 `${current}/${max}` 在 .resource-value', () => {
      const wrapper = mount(ResourceBar, {
        props: { icon: 'heart', name: '生命', current: 80, max: 120, percent: 80 },
      });
      expect(wrapper.find('.resource-value').text()).toBe('80/120');
    });
  });

  describe('percent 内联 style', () => {
    it('percent 应用到 .resource-fill 的 style width', () => {
      const wrapper = mount(ResourceBar, {
        props: { icon: 'heart', name: '生命', current: 80, max: 100, percent: 80 },
      });
      expect(wrapper.find('.resource-fill').attributes('style')).toContain('width: 80%');
    });

    it('percent=0 时 style width 为 0%', () => {
      const wrapper = mount(ResourceBar, {
        props: { icon: 'heart', name: '生命', current: 0, max: 100, percent: 0 },
      });
      expect(wrapper.find('.resource-fill').attributes('style')).toContain('width: 0%');
    });
  });

  describe('type 样式类', () => {
    it('未传 type 时默认 hp 类应用到 .resource-fill', () => {
      const wrapper = mount(ResourceBar, {
        props: { icon: 'heart', name: '生命', current: 80, max: 100, percent: 80 },
      });
      expect(wrapper.find('.resource-fill').classes()).toContain('hp');
    });

    it('type=mp 时应用 mp 类', () => {
      const wrapper = mount(ResourceBar, {
        props: { icon: 'mana', name: '法力', current: 50, max: 100, percent: 50, type: 'mp' },
      });
      expect(wrapper.find('.resource-fill').classes()).toContain('mp');
    });

    it('type=exp 时应用 exp 类', () => {
      const wrapper = mount(ResourceBar, {
        props: { icon: 'star', name: '经验', current: 30, max: 100, percent: 30, type: 'exp' },
      });
      expect(wrapper.find('.resource-fill').classes()).toContain('exp');
    });
  });

  describe('图标传递', () => {
    it('icon 传给 BaseIcon 的 name', () => {
      const wrapper = mount(ResourceBar, {
        props: { icon: 'heart', name: '生命', current: 80, max: 100, percent: 80 },
      });
      expect(wrapper.findComponent(BaseIcon).props('name')).toBe('heart');
    });

    it('iconName 优先于 icon 传给 BaseIcon', () => {
      const wrapper = mount(ResourceBar, {
        props: {
          icon: 'heart', iconName: 'game-icons:heart-plus',
          name: '生命', current: 80, max: 100, percent: 80,
        },
      });
      expect(wrapper.findComponent(BaseIcon).props('name')).toBe('game-icons:heart-plus');
    });

    it('传入 iconGradient 时 BaseIcon 接收到该 gradient', () => {
      const wrapper = mount(ResourceBar, {
        props: {
          icon: 'heart', iconGradient: 'health',
          name: '生命', current: 80, max: 100, percent: 80,
        },
      });
      expect(wrapper.findComponent(BaseIcon).props('gradient')).toBe('health');
    });
  });
});
