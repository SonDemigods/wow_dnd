/**
 * @fileoverview EffectTag 效果类型标签组件单元测试
 *
 * 覆盖 EffectTag.vue 的：
 * 1. 样式类：根元素 class 包含 'effect-tag' 与 `effect-tag-${type}`
 * 2. 文本：typeName 通过 useSkillDisplay.getSkillDisplayName 转换
 * 3. 边界：未知 type 返回原 type 字符串
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），仅断言 class 与文本内容。
 *  - EffectTag 依赖 useSkillDisplay 纯函数，无需 mock。
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import EffectTag from '@/components/common/EffectTag.vue';

describe('EffectTag 效果类型标签组件', () => {
  describe('根元素样式类', () => {
    it('根元素 class 包含 effect-tag 与 effect-tag-${type}', () => {
      const wrapper = mount(EffectTag, {
        props: { type: 'physical_damage' },
      });
      expect(wrapper.classes()).toContain('effect-tag');
      expect(wrapper.classes()).toContain('effect-tag-physical_damage');
    });

    it('type=magic_damage 时应用 effect-tag-magic_damage 类', () => {
      const wrapper = mount(EffectTag, { props: { type: 'magic_damage' } });
      expect(wrapper.classes()).toContain('effect-tag-magic_damage');
    });

    it('type=buff 时应用 effect-tag-buff 类', () => {
      const wrapper = mount(EffectTag, { props: { type: 'buff' } });
      expect(wrapper.classes()).toContain('effect-tag-buff');
    });
  });

  describe('typeName 文本转换', () => {
    it.each([
      ['physical_damage', '物理伤害'],
      ['magic_damage', '魔法伤害'],
      ['health_restore', '生命恢复'],
      ['mana_restore', '法力恢复'],
      ['buff', '增益'],
      ['debuff', '减益'],
    ])('type=%s 转换为文本 %s', (type, expected) => {
      const wrapper = mount(EffectTag, { props: { type } });
      expect(wrapper.text()).toBe(expected);
    });
  });

  describe('边界', () => {
    it('未知 type 返回原 type 字符串', () => {
      const wrapper = mount(EffectTag, { props: { type: 'unknown_type' } });
      expect(wrapper.text()).toBe('unknown_type');
      expect(wrapper.classes()).toContain('effect-tag-unknown_type');
    });
  });
});
