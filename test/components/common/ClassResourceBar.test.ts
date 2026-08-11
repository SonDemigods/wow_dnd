/**
 * @fileoverview ClassResourceBar 职业专属资源条组件单元测试
 *
 * 覆盖 ClassResourceBar.vue 的：
 * 1. resourceConfig 映射：rage→怒气/game-icons:flame、energy→能量、combo_point→连击、
 *    soul_shard→碎片、chi→真气、mana→法力
 * 2. name 渲染在 .resource-label
 * 3. value 渲染 `${Math.floor(currentValue)}/${maxValue}` 在 .resource-value
 * 4. percent：maxValue=0 → 0%；正常 → clamp(0,100, currentValue/max*100)，应用到 .resource-fill style width
 * 5. .resource-fill class 包含 resourceSystem.type
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），可断言 class、内联 style 变量、文本、子组件 props。
 *  - 依赖 BaseIcon，需 mock @iconify/vue 避免真实网络加载。
 */
import { describe, it, expect, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import ClassResourceBar from '@/components/common/ClassResourceBar.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import type { ResourceSystem } from '@/modules/combat/resources/types';

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

/** 构造 mock ResourceSystem */
function makeResourceSystem(o: Partial<ResourceSystem> = {}): ResourceSystem {
  return {
    type: 'rage',
    currentValue: 50,
    maxValue: 100,
    isInteger: false,
    generate: vi.fn(),
    consume: vi.fn().mockReturnValue(true),
    hasEnough: vi.fn().mockReturnValue(true),
    reset: vi.fn(),
    valueRef: { value: 50 } as any,
    maxValueRef: { value: 100 } as any,
    ...o,
  } as unknown as ResourceSystem;
}

describe('ClassResourceBar 职业专属资源条组件', () => {
  describe('resourceConfig 名称映射', () => {
    it.each([
      ['rage', '怒气'],
      ['energy', '能量'],
      ['combo_point', '连击'],
      ['soul_shard', '碎片'],
      ['chi', '真气'],
      ['mana', '法力'],
    ])('type=%s 时 .resource-label 渲染为 %s', (type, name) => {
      const wrapper = mount(ClassResourceBar, {
        props: { resourceSystem: makeResourceSystem({ type: type as ResourceSystem['type'] }) },
      });
      expect(wrapper.find('.resource-label').text()).toBe(name);
    });
  });

  describe('resourceConfig 图标映射', () => {
    it('type=rage 时 BaseIcon 接收到 game-icons:flame 图标', () => {
      const wrapper = mount(ClassResourceBar, {
        props: { resourceSystem: makeResourceSystem({ type: 'rage' }) },
      });
      expect(wrapper.findComponent(BaseIcon).props('name')).toBe('game-icons:flame');
    });

    it('type=energy 时 BaseIcon 接收到 game-icons:lightning-storm 图标', () => {
      const wrapper = mount(ClassResourceBar, {
        props: { resourceSystem: makeResourceSystem({ type: 'energy' }) },
      });
      expect(wrapper.findComponent(BaseIcon).props('name')).toBe('game-icons:lightning-storm');
    });
  });

  describe('value 文本渲染', () => {
    it('value 渲染 `${Math.floor(currentValue)}/${maxValue}` 在 .resource-value', () => {
      const wrapper = mount(ClassResourceBar, {
        props: { resourceSystem: makeResourceSystem({ currentValue: 50, maxValue: 100 }) },
      });
      expect(wrapper.find('.resource-value').text()).toBe('50/100');
    });

    it('currentValue 为小数时向下取整', () => {
      const wrapper = mount(ClassResourceBar, {
        props: { resourceSystem: makeResourceSystem({ currentValue: 50.9, maxValue: 100 }) },
      });
      expect(wrapper.find('.resource-value').text()).toBe('50/100');
    });
  });

  describe('percent 计算', () => {
    it('正常情况下 percent=currentValue/maxValue*100 应用到 style width', () => {
      const wrapper = mount(ClassResourceBar, {
        props: { resourceSystem: makeResourceSystem({ currentValue: 50, maxValue: 100 }) },
      });
      expect(wrapper.find('.resource-fill').attributes('style')).toContain('width: 50%');
    });

    it('maxValue=0 时 percent=0%', () => {
      const wrapper = mount(ClassResourceBar, {
        props: { resourceSystem: makeResourceSystem({ currentValue: 50, maxValue: 0 }) },
      });
      expect(wrapper.find('.resource-fill').attributes('style')).toContain('width: 0%');
    });

    it('currentValue 超过 maxValue 时 clamp 到 100%', () => {
      const wrapper = mount(ClassResourceBar, {
        props: { resourceSystem: makeResourceSystem({ currentValue: 150, maxValue: 100 }) },
      });
      expect(wrapper.find('.resource-fill').attributes('style')).toContain('width: 100%');
    });

    it('currentValue 为负数时 clamp 到 0%', () => {
      const wrapper = mount(ClassResourceBar, {
        props: { resourceSystem: makeResourceSystem({ currentValue: -20, maxValue: 100 }) },
      });
      expect(wrapper.find('.resource-fill').attributes('style')).toContain('width: 0%');
    });
  });

  describe('type 样式类', () => {
    it('.resource-fill class 包含 resourceSystem.type', () => {
      const wrapper = mount(ClassResourceBar, {
        props: { resourceSystem: makeResourceSystem({ type: 'rage' }) },
      });
      expect(wrapper.find('.resource-fill').classes()).toContain('rage');
    });

    it('type=chi 时 .resource-fill class 包含 chi', () => {
      const wrapper = mount(ClassResourceBar, {
        props: { resourceSystem: makeResourceSystem({ type: 'chi' }) },
      });
      expect(wrapper.find('.resource-fill').classes()).toContain('chi');
    });
  });
});
