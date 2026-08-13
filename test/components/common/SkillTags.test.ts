/**
 * @fileoverview SkillTags 技能标签组件单元测试
 *
 * 覆盖 SkillTags.vue 的：
 * 1. 渲染 EffectTag 子组件（type=skill.type）
 * 2. MP 标签：.skill-tag-cost 文本 `${skill.mpCost} MP`
 * 3. cooldown：>0 时渲染 .skill-tag-cooldown 文本 `冷却 ${cooldown} 回合`；=0 或 undefined 时不渲染
 * 4. targetType：存在时渲染 .skill-tag-target，文本为 getTargetTypeName 转换结果
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），仅断言 class、文本、子组件 props、是否存在。
 *  - SkillTags 依赖 EffectTag 子组件与 useSkillDisplay 纯函数，无需 mock @iconify/vue。
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SkillTags from '@/components/common/SkillTags.vue';
import EffectTag from '@/components/common/EffectTag.vue';
import type { Skill } from '@/modules/skill/types';

/** 构造 mock Skill */
function makeSkill(o: Partial<Skill> = {}): Skill {
  return {
    id: 's1',
    name: '火球术',
    icon: 'ic',
    description: 'd',
    mpCost: 20,
    type: 'magic_damage',
    effect: { type: 'magic_damage', value: 50 },
    unlockLevel: 1,
    cooldown: 3,
    targetType: 'single',
    ...o,
  } as Skill;
}

describe('SkillTags 技能标签组件', () => {
  describe('EffectTag 子组件', () => {
    it('渲染 EffectTag 子组件，type=skill.type', () => {
      const wrapper = mount(SkillTags, { props: { skill: makeSkill({ type: 'magic_damage' }) } });
      const effectTag = wrapper.findComponent(EffectTag);
      expect(effectTag.exists()).toBe(true);
      expect(effectTag.props('type')).toBe('magic_damage');
    });

    it('skill.type=physical_damage 时 EffectTag 接收到该 type', () => {
      const wrapper = mount(SkillTags, { props: { skill: makeSkill({ type: 'physical_damage' }) } });
      expect(wrapper.findComponent(EffectTag).props('type')).toBe('physical_damage');
    });
  });

  describe('MP 消耗标签', () => {
    it('.skill-tag-cost 文本为 `${mpCost} MP`', () => {
      const wrapper = mount(SkillTags, { props: { skill: makeSkill({ mpCost: 20 }) } });
      expect(wrapper.find('.skill-tag-cost').text()).toBe('20 MP');
    });

    it('mpCost=0 时渲染 `0 MP`', () => {
      const wrapper = mount(SkillTags, { props: { skill: makeSkill({ mpCost: 0 }) } });
      expect(wrapper.find('.skill-tag-cost').text()).toBe('0 MP');
    });
  });

  describe('cooldown 冷却标签', () => {
    it('cooldown>0 时渲染 .skill-tag-cooldown 文本 `冷却 ${cooldown} 回合`', () => {
      const wrapper = mount(SkillTags, { props: { skill: makeSkill({ cooldown: 3 }) } });
      const cd = wrapper.find('.skill-tag-cooldown');
      expect(cd.exists()).toBe(true);
      expect(cd.text()).toBe('冷却 3 回合');
    });

    it('cooldown=0 时不渲染 .skill-tag-cooldown', () => {
      const wrapper = mount(SkillTags, { props: { skill: makeSkill({ cooldown: 0 }) } });
      expect(wrapper.find('.skill-tag-cooldown').exists()).toBe(false);
    });

    it('cooldown=undefined 时不渲染 .skill-tag-cooldown', () => {
      const skill = makeSkill();
      delete skill.cooldown;
      const wrapper = mount(SkillTags, { props: { skill } });
      expect(wrapper.find('.skill-tag-cooldown').exists()).toBe(false);
    });
  });

  describe('targetType 目标类型标签', () => {
    it.each([
      ['single', '单体'],
      ['all_enemies', '多目标'],
      ['self', '自身'],
      ['ally', '友方'],
    ])('targetType=%s 时 .skill-tag-target 文本为 %s', (targetType, expected) => {
      const wrapper = mount(SkillTags, {
        props: { skill: makeSkill({ targetType: targetType as Skill['targetType'] }) },
      });
      expect(wrapper.find('.skill-tag-target').text()).toBe(expected);
    });

    it('targetType 为 undefined 时不渲染 .skill-tag-target', () => {
      const skill = makeSkill();
      delete skill.targetType;
      const wrapper = mount(SkillTags, { props: { skill } });
      expect(wrapper.find('.skill-tag-target').exists()).toBe(false);
    });
  });
});
