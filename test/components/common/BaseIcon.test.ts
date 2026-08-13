/**
 * @fileoverview BaseIcon 图标组件单元测试
 *
 * 覆盖 BaseIcon.vue 的：
 * 1. finalIcon 计算：空值回退 fallback、无冒号补前缀、含冒号原样
 * 2. size 默认 24，传入时应用到 Icon 的 width
 * 3. gradient 模式：初始渲染 Icon（loadIcon 异步），flushPromises 后渲染 svg；loadIcon 失败回退 Icon
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），仅断言 class、data-* 属性与元素存在性。
 *  - 使用 @vue/test-utils 的 mount 配合 mock @iconify/vue 进行真实渲染。
 *
 * Mock 说明：
 *  - 任务原始 mock 的 render 返回 `{ tag, attrs }` 纯对象，在 Vue3 中并非合法 VNode，
 *    无法渲染出 DOM。这里改用 `h('span', {...})` 生成真实 VNode，class 与 data-*
 *    属性保持一致，断言方式不受影响。
 *  - vi.mock 工厂通过 `await import('vue')` 动态获取 h/defineComponent，避免提升作用域问题。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';

vi.mock('@iconify/vue', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    Icon: defineComponent({
      name: 'MockIcon',
      props: ['icon', 'width', 'height', 'color'],
      setup(props) {
        return () =>
          h('span', {
            class: 'mock-icon',
            'data-icon': props.icon,
            'data-width': props.width,
          });
      },
    }),
    loadIcon: vi.fn().mockResolvedValue({ body: '<path d="M0 0h512v512H0z"/>' }),
  };
});

import BaseIcon from '@/components/common/BaseIcon.vue';
import { loadIcon } from '@iconify/vue';

describe('BaseIcon 图标组件', () => {
  beforeEach(() => {
    vi.mocked(loadIcon).mockReset();
    vi.mocked(loadIcon).mockResolvedValue({ body: '<path d="M0 0h512v512H0z"/>' });
  });

  describe('finalIcon 计算', () => {
    it('name 未传时回退为 fallback 图标（含 uncertainty）', () => {
      const wrapper = mount(BaseIcon);
      expect(wrapper.find('.mock-icon').attributes('data-icon')).toContain('uncertainty');
    });

    it('name 为空字符串时回退为 fallback 图标', () => {
      const wrapper = mount(BaseIcon, { props: { name: '' } });
      expect(wrapper.find('.mock-icon').attributes('data-icon')).toContain('uncertainty');
    });

    it('name 不含冒号时补 game-icons: 前缀', () => {
      const wrapper = mount(BaseIcon, { props: { name: 'sword' } });
      expect(wrapper.find('.mock-icon').attributes('data-icon')).toBe('game-icons:sword');
    });

    it('name 含冒号时原样使用', () => {
      const wrapper = mount(BaseIcon, { props: { name: 'game-icons:sword' } });
      expect(wrapper.find('.mock-icon').attributes('data-icon')).toBe('game-icons:sword');
    });
  });

  describe('size', () => {
    it('size 默认 24 应用到 Icon 的 width', () => {
      const wrapper = mount(BaseIcon, { props: { name: 'sword' } });
      expect(wrapper.find('.mock-icon').attributes('data-width')).toBe('24');
    });

    it('size 传入 32 时应用到 Icon 的 width', () => {
      const wrapper = mount(BaseIcon, { props: { name: 'sword', size: 32 } });
      expect(wrapper.find('.mock-icon').attributes('data-width')).toBe('32');
    });
  });

  describe('gradient 渐变模式', () => {
    it('有 gradient 时初始渲染 Icon，flushPromises 后渲染 svg 且 loadIcon 被调用', async () => {
      const wrapper = mount(BaseIcon, {
        props: { name: 'sword', gradient: 'warrior' },
      });

      // loadIcon 为异步，初始 gradientSvgBody 仍为空，渲染 Icon 回退
      expect(wrapper.find('.mock-icon').exists()).toBe(true);

      await flushPromises();
      await nextTick();

      // loadIcon 成功后 gradientSvgBody 被赋值，渲染 svg
      expect(wrapper.find('svg').exists()).toBe(true);
      expect(loadIcon).toHaveBeenCalled();
      expect(loadIcon).toHaveBeenCalledWith('game-icons:sword');
    });

    it('loadIcon 失败（reject）时回退渲染 Icon，不渲染 svg', async () => {
      vi.mocked(loadIcon).mockRejectedValueOnce(new Error('load failed'));

      const wrapper = mount(BaseIcon, {
        props: { name: 'sword', gradient: 'warrior' },
      });

      await flushPromises();
      await nextTick();

      expect(wrapper.find('svg').exists()).toBe(false);
      expect(wrapper.find('.mock-icon').exists()).toBe(true);
    });
  });
});
