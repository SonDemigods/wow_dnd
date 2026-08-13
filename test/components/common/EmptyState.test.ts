/**
 * @fileoverview EmptyState 空状态组件单元测试
 *
 * 覆盖 EmptyState.vue 的：
 * 1. 渲染：渲染 BaseIcon 子组件；text 文本输出在 .empty-state-text
 * 2. 默认 props：size 默认 32
 * 3. 自定义 props：传入 size/gradient 时 BaseIcon 接收到正确 props
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），仅断言 class、属性、文本内容、是否存在、子组件 props。
 *  - 依赖 BaseIcon，需 mock @iconify/vue 避免真实网络加载。
 */
import { describe, it, expect, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import EmptyState from '@/components/common/EmptyState.vue';
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

describe('EmptyState 空状态组件', () => {
  describe('渲染', () => {
    it('渲染 BaseIcon 子组件', () => {
      const wrapper = mount(EmptyState, {
        props: { icon: 'backpack', text: '暂无物品' },
      });
      expect(wrapper.findComponent(BaseIcon).exists()).toBe(true);
    });

    it('text 文本输出在 .empty-state-text', () => {
      const wrapper = mount(EmptyState, {
        props: { icon: 'backpack', text: '背包空空如也' },
      });
      expect(wrapper.find('.empty-state-text').text()).toBe('背包空空如也');
    });
  });

  describe('默认 props', () => {
    it('未传 size 时 BaseIcon 接收到默认 size=32', () => {
      const wrapper = mount(EmptyState, {
        props: { icon: 'backpack', text: '空' },
      });
      expect(wrapper.findComponent(BaseIcon).props('size')).toBe(32);
    });

    it('未传 gradient 时 BaseIcon gradient 为 undefined', () => {
      const wrapper = mount(EmptyState, {
        props: { icon: 'backpack', text: '空' },
      });
      expect(wrapper.findComponent(BaseIcon).props('gradient')).toBeUndefined();
    });
  });

  describe('自定义 props', () => {
    it('传入 icon 时 BaseIcon 接收到正确的 name', () => {
      const wrapper = mount(EmptyState, {
        props: { icon: 'chest', text: '空' },
      });
      expect(wrapper.findComponent(BaseIcon).props('name')).toBe('chest');
    });

    it('传入自定义 size 时 BaseIcon 接收到该 size', () => {
      const wrapper = mount(EmptyState, {
        props: { icon: 'backpack', text: '空', size: 64 },
      });
      expect(wrapper.findComponent(BaseIcon).props('size')).toBe(64);
    });

    it('传入 gradient 时 BaseIcon 接收到该 gradient', () => {
      const wrapper = mount(EmptyState, {
        props: { icon: 'backpack', text: '空', gradient: 'metal' },
      });
      expect(wrapper.findComponent(BaseIcon).props('gradient')).toBe('metal');
    });
  });
});
