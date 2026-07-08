/**
 * @fileoverview ItemIcon 物品图标组件单元测试
 *
 * 覆盖 ItemIcon.vue 的：
 * 1. 渲染：.item-icon-wrap 根元素 + BaseIcon 子组件挂载
 * 2. displayIcon 计算：icon 有值用 icon，否则用 fallback（默认 uncertainty）
 * 3. gameIconSize 计算：size 预设映射(sm=20/md=24/lg=28/xl=32)，px 优先
 * 4. iconGradient 计算：gradient 优先，其次 rarity，默认 common
 * 5. wrapperClasses：尺寸类 + 稀有度类
 * 6. wrapperPxStyle：px 时设置 fontSize 内联变量
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），仅断言 class、内联 style 变量、子组件 props。
 *  - 通过 mock @iconify/vue 隔离 BaseIcon 的网络加载，使用 mount 真实渲染。
 */
import { describe, it, expect, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import ItemIcon from '@/components/common/ItemIcon.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';

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

describe('ItemIcon 物品图标组件', () => {
  describe('渲染', () => {
    it('渲染 .item-icon-wrap 根元素并挂载 BaseIcon', () => {
      const wrapper = mount(ItemIcon, { props: { icon: 'sword-clash' } });
      expect(wrapper.find('.item-icon-wrap').exists()).toBe(true);
      expect(wrapper.findComponent(BaseIcon).exists()).toBe(true);
    });

    it('根元素为 span', () => {
      const wrapper = mount(ItemIcon, { props: { icon: 'sword' } });
      expect(wrapper.element.tagName).toBe('SPAN');
    });
  });

  describe('displayIcon 计算', () => {
    it('icon 有值时 BaseIcon 接收 icon 作为 name', () => {
      const wrapper = mount(ItemIcon, { props: { icon: 'sword-clash' } });
      expect(wrapper.findComponent(BaseIcon).props('name')).toBe('sword-clash');
    });

    it('icon 为空时回退为默认 fallback "uncertainty"', () => {
      const wrapper = mount(ItemIcon, { props: {} });
      expect(wrapper.findComponent(BaseIcon).props('name')).toBe('uncertainty');
    });

    it('传入自定义 fallback 时使用传入值', () => {
      const wrapper = mount(ItemIcon, {
        props: { icon: '', fallback: 'question-mark' },
      });
      expect(wrapper.findComponent(BaseIcon).props('name')).toBe('question-mark');
    });

    it('icon 与 fallback 同时存在时优先 icon', () => {
      const wrapper = mount(ItemIcon, {
        props: { icon: 'shield', fallback: 'uncertainty' },
      });
      expect(wrapper.findComponent(BaseIcon).props('name')).toBe('shield');
    });
  });

  describe('gameIconSize 计算', () => {
    it('size=sm 时 BaseIcon size=20', () => {
      const wrapper = mount(ItemIcon, { props: { size: 'sm' } });
      expect(wrapper.findComponent(BaseIcon).props('size')).toBe(20);
    });

    it('size=md（默认）时 BaseIcon size=24', () => {
      const wrapper = mount(ItemIcon, { props: {} });
      expect(wrapper.findComponent(BaseIcon).props('size')).toBe(24);
    });

    it('size=lg 时 BaseIcon size=28，size=xl 时 size=32', () => {
      const lg = mount(ItemIcon, { props: { size: 'lg' } });
      const xl = mount(ItemIcon, { props: { size: 'xl' } });
      expect(lg.findComponent(BaseIcon).props('size')).toBe(28);
      expect(xl.findComponent(BaseIcon).props('size')).toBe(32);
    });

    it('传入 px 时优先于 size 预设', () => {
      const wrapper = mount(ItemIcon, {
        props: { size: 'md', px: 48 },
      });
      expect(wrapper.findComponent(BaseIcon).props('size')).toBe(48);
    });
  });

  describe('iconGradient 计算', () => {
    it('传入 gradient 时 BaseIcon gradient 使用传入值', () => {
      const wrapper = mount(ItemIcon, {
        props: { gradient: 'warrior', rarity: 'epic' },
      });
      expect(wrapper.findComponent(BaseIcon).props('gradient')).toBe('warrior');
    });

    it('无 gradient 但有 rarity 时 BaseIcon gradient 等于 rarity', () => {
      const wrapper = mount(ItemIcon, { props: { rarity: 'legendary' } });
      expect(wrapper.findComponent(BaseIcon).props('gradient')).toBe('legendary');
    });

    it('既无 gradient 也无 rarity 时 BaseIcon gradient 为 common', () => {
      const wrapper = mount(ItemIcon, { props: {} });
      expect(wrapper.findComponent(BaseIcon).props('gradient')).toBe('common');
    });
  });

  describe('wrapperClasses 与 wrapperPxStyle', () => {
    it('wrapperClasses 包含 item-icon-wrap 与 item-icon--{size}', () => {
      const wrapper = mount(ItemIcon, { props: { size: 'lg' } });
      expect(wrapper.classes()).toContain('item-icon-wrap');
      expect(wrapper.classes()).toContain('item-icon--lg');
    });

    it('传入 rarity 时 wrapperClasses 包含 item-icon--{rarity}', () => {
      const wrapper = mount(ItemIcon, { props: { rarity: 'epic' } });
      expect(wrapper.classes()).toContain('item-icon--epic');
    });

    it('未传 rarity 时不附加稀有度类', () => {
      const wrapper = mount(ItemIcon, { props: {} });
      expect(wrapper.classes().some(c => c.startsWith('item-icon--') && c !== 'item-icon--md')).toBe(false);
    });

    it('传入 px 时根元素内联 style 包含 fontSize 变量', () => {
      const wrapper = mount(ItemIcon, { props: { px: 40 } });
      expect(wrapper.attributes('style')).toContain('font-size: 40px');
    });

    it('未传 px 时根元素无 fontSize 内联变量', () => {
      const wrapper = mount(ItemIcon, { props: { size: 'md' } });
      // 无 px 时 wrapperPxStyle 返回空对象，根元素不挂载 style 属性（attributes 返回 undefined）
      expect(wrapper.attributes('style') ?? '').not.toContain('font-size');
    });
  });
});
