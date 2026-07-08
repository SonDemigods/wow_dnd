/**
 * @fileoverview Tag 标签组件单元测试
 *
 * 覆盖 Tag.vue 的：
 * 1. 渲染：text 内容输出
 * 2. 样式类：根据 type 应用 tag-race / tag-class / tag-faction
 * 3. CSS 变量：color prop 设置 --tag-color 内联变量
 * 4. 边界：未传 color 时回退为 inherit
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），仅断言 class 与内联 style 变量。
 *  - 使用 @vue/test-utils 的 mount 进行真实渲染。
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Tag from '@/components/common/Tag.vue';

describe('Tag 标签组件', () => {
  describe('渲染', () => {
    it('渲染 text 内容', () => {
      const wrapper = mount(Tag, {
        props: { text: '人类', type: 'race' },
      });
      expect(wrapper.text()).toBe('人类');
    });

    it('渲染空字符串 text', () => {
      const wrapper = mount(Tag, {
        props: { text: '', type: 'race' },
      });
      expect(wrapper.text()).toBe('');
    });

    it('渲染特殊字符 text', () => {
      const wrapper = mount(Tag, {
        props: { text: '战士<>&"', type: 'class' },
      });
      expect(wrapper.text()).toBe('战士<>&"');
    });
  });

  describe('type 样式类', () => {
    it('type=race 时应用 tag-race 类', () => {
      const wrapper = mount(Tag, {
        props: { text: '人类', type: 'race' },
      });
      expect(wrapper.classes()).toContain('tag');
      expect(wrapper.classes()).toContain('tag-race');
    });

    it('type=class 时应用 tag-class 类', () => {
      const wrapper = mount(Tag, {
        props: { text: '战士', type: 'class' },
      });
      expect(wrapper.classes()).toContain('tag-class');
    });

    it('type=faction 时应用 tag-faction 类', () => {
      const wrapper = mount(Tag, {
        props: { text: '联盟', type: 'faction' },
      });
      expect(wrapper.classes()).toContain('tag-faction');
    });
  });

  describe('color CSS 变量', () => {
    it('传入 color 时设置 --tag-color 内联变量', () => {
      const wrapper = mount(Tag, {
        props: { text: '战士', type: 'class', color: '#C79C6E' },
      });
      expect(wrapper.attributes('style')).toContain('--tag-color: #C79C6E');
    });

    it('未传 color 时 --tag-color 为 inherit', () => {
      const wrapper = mount(Tag, {
        props: { text: '人类', type: 'race' },
      });
      expect(wrapper.attributes('style')).toContain('--tag-color: inherit');
    });

    it('color 为空字符串时回退为 inherit', () => {
      const wrapper = mount(Tag, {
        props: { text: '人类', type: 'race', color: '' },
      });
      expect(wrapper.attributes('style')).toContain('--tag-color: inherit');
    });
  });

  describe('根元素', () => {
    it('根元素为 span', () => {
      const wrapper = mount(Tag, {
        props: { text: '人类', type: 'race' },
      });
      expect(wrapper.element.tagName).toBe('SPAN');
    });
  });
});
