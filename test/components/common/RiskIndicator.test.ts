/**
 * @fileoverview RiskIndicator 风险等级指示器组件单元测试
 *
 * 覆盖 RiskIndicator.vue 的：
 * 1. 风险等级映射：cellType + areaLevel → riskLevel（safe/low/medium/high/extreme）
 * 2. 风险文本：safe→安全、low→低风险、medium→中风险、high→高风险、extreme→极危
 * 3. 样式类：根元素 class 包含 risk-indicator 与 `risk-${riskLevel}`
 * 4. v-if：有风险等级时渲染 .risk-indicator；未知 cellType 不渲染
 * 5. title 属性等于 riskText
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），仅断言 class、属性、文本、是否存在。
 *  - 依赖 BaseIcon，需 mock @iconify/vue 避免真实网络加载。
 */
import { describe, it, expect, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import RiskIndicator from '@/components/common/RiskIndicator.vue';
import type { CellType } from '@/modules/exploration/types';

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

describe('RiskIndicator 风险等级指示器组件', () => {
  describe('风险等级映射', () => {
    it.each<[CellType, number, string, string]>([
      ['empty', 1, 'safe', '安全'],
      ['start', 1, 'safe', '安全'],
      ['rest', 1, 'safe', '安全'],
      ['shop', 1, 'safe', '安全'],
      ['board', 1, 'safe', '安全'],
      ['treasure', 1, 'low', '低风险'],
      ['event', 1, 'low', '低风险'],
      ['trap', 10, 'high', '高风险'],
      ['trap', 9, 'medium', '中风险'],
      ['monster', 15, 'extreme', '极危'],
      ['monster', 8, 'high', '高风险'],
      ['monster', 7, 'medium', '中风险'],
      ['boss', 1, 'extreme', '极危'],
    ])('cellType=%s areaLevel=%i → %s（%s）', (cellType, areaLevel, level, text) => {
      const wrapper = mount(RiskIndicator, { props: { cellType, areaLevel } });
      const root = wrapper.find('.risk-indicator');
      expect(root.exists()).toBe(true);
      expect(root.classes()).toContain(`risk-${level}`);
      expect(root.attributes('title')).toBe(text);
      expect(wrapper.find('.risk-label').text()).toBe(text);
    });
  });

  describe('trap 风险等级边界', () => {
    it('trap areaLevel=10 为 high（高风险）', () => {
      const wrapper = mount(RiskIndicator, { props: { cellType: 'trap', areaLevel: 10 } });
      expect(wrapper.find('.risk-indicator').classes()).toContain('risk-high');
    });

    it('trap areaLevel=9 为 medium（中风险）', () => {
      const wrapper = mount(RiskIndicator, { props: { cellType: 'trap', areaLevel: 9 } });
      expect(wrapper.find('.risk-indicator').classes()).toContain('risk-medium');
    });
  });

  describe('monster 风险等级边界', () => {
    it('monster areaLevel=15 为 extreme（极危）', () => {
      const wrapper = mount(RiskIndicator, { props: { cellType: 'monster', areaLevel: 15 } });
      expect(wrapper.find('.risk-indicator').classes()).toContain('risk-extreme');
    });

    it('monster areaLevel=8 为 high（高风险）', () => {
      const wrapper = mount(RiskIndicator, { props: { cellType: 'monster', areaLevel: 8 } });
      expect(wrapper.find('.risk-indicator').classes()).toContain('risk-high');
    });

    it('monster areaLevel=7 为 medium（中风险）', () => {
      const wrapper = mount(RiskIndicator, { props: { cellType: 'monster', areaLevel: 7 } });
      expect(wrapper.find('.risk-indicator').classes()).toContain('risk-medium');
    });
  });

  describe('v-if 显隐', () => {
    it('有风险等级时渲染 .risk-indicator', () => {
      const wrapper = mount(RiskIndicator, { props: { cellType: 'monster', areaLevel: 1 } });
      expect(wrapper.find('.risk-indicator').exists()).toBe(true);
    });

    it('未知 cellType 时不渲染 .risk-indicator（riskLevel=null）', () => {
      const wrapper = mount(RiskIndicator, {
        props: { cellType: 'unknown' as CellType, areaLevel: 1 },
      });
      expect(wrapper.find('.risk-indicator').exists()).toBe(false);
    });
  });

  describe('title 属性', () => {
    it('title 等于 riskText', () => {
      const wrapper = mount(RiskIndicator, { props: { cellType: 'boss', areaLevel: 5 } });
      expect(wrapper.find('.risk-indicator').attributes('title')).toBe('极危');
    });
  });
});
