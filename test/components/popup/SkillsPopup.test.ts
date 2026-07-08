/**
 * @fileoverview SkillsPopup 技能面板弹窗组件单元测试
 *
 * 覆盖 SkillsPopup.vue 的：
 * 1. onMounted（characterStore.currentCharacterId 有值）调用 skillsStore.initialize
 * 2. 渲染技能栏 4 个槽位 .bar-slot
 * 3. mock getSkillTemplatesByClass 返回技能数组时渲染对应数量 .skill-slot
 * 4. $patch skillBar.slots 让某技能已装备时渲染 .skill-slot.equipped
 * 5. 点击 .skill-slot 触发 UI_CLICK({source:'skill_select'})
 * 6. 点击"记忆"按钮触发 skillsStore.equipSkill 与 UI_CLICK({source:'skill_memorize'})
 * 7. 点击"遗忘"按钮触发 skillsStore.unequipSkill 与 UI_CLICK({source:'skill_forget'})
 * 8. BasePopup 关闭按钮触发 close 事件
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），仅断言 class、文本、emit 与 stub 调用。
 *  - 使用 mount + createStubPinia 真实渲染 BasePopup / SkillTags 子组件。
 *  - mock @iconify/vue 避免真实网络加载。
 *  - 由于 createStubPinia 会 stub 所有 actions（含 getSkillTemplatesByClass），
 *    使用 vi.mocked(...).mockResolvedValue 预设返回值以驱动 loadClassSkills 渲染。
 *  - eventBus 使用真实实现，通过 eventBus.on 注册 spy 监听断言。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import SkillsPopup from '@/components/popup/SkillsPopup.vue';
import { useSkillStore } from '@/modules/skill';
import { useCharacterStore } from '@/modules/character';
import { eventBus, GameEvents } from '@/modules/bus';
import { createStubPinia } from '../../utils/setup';

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
          });
      },
    }),
    loadIcon: vi.fn().mockResolvedValue({ body: '<path d="M0 0h512v512H0z"/>' }),
  };
});

describe('SkillsPopup 技能面板弹窗组件', () => {
  beforeEach(() => {
    eventBus.clearAll();
  });

  it('characterStore.currentCharacterId 有值时 onMounted 调用 skillsStore.initialize', async () => {
    const pinia = createStubPinia();
    const characterStore = useCharacterStore();
    const skillsStore = useSkillStore();
    characterStore.$patch((state) => {
      state.currentCharacterId = 'char1';
    });
    vi.mocked(skillsStore.getSkillTemplatesByClass).mockResolvedValue([]);

    mount(SkillsPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await flushPromises();

    expect(skillsStore.initialize).toHaveBeenCalledWith('char1');
  });

  it('渲染技能栏 4 个 .bar-slot 槽位', () => {
    const pinia = createStubPinia();
    const wrapper = mount(SkillsPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    expect(wrapper.findAll('.bar-slot')).toHaveLength(4);
  });

  it('mock getSkillTemplatesByClass 返回 2 个技能时渲染 2 个 .skill-slot', async () => {
    const pinia = createStubPinia();
    const characterStore = useCharacterStore();
    const skillsStore = useSkillStore();
    characterStore.$patch((state) => {
      state.currentCharacterId = 'char1';
    });
    vi.mocked(skillsStore.getSkillTemplatesByClass).mockResolvedValue([
      {
        id: 's1', name: '火球术', icon: 'fire', description: '发射火球',
        mpCost: 5, type: 'magic_damage',
        effect: { type: 'magic_damage', value: 10 }, unlockLevel: 1,
      },
      {
        id: 's2', name: '治疗术', icon: 'heal', description: '恢复生命',
        mpCost: 3, type: 'health_restore',
        effect: { type: 'health_restore', value: 5 }, unlockLevel: 2,
      },
    ]);

    const wrapper = mount(SkillsPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await flushPromises();

    expect(wrapper.findAll('.skill-slot')).toHaveLength(2);
  });

  it('$patch skillBar.slots 让技能已装备时渲染 .skill-slot.equipped', async () => {
    const pinia = createStubPinia();
    const characterStore = useCharacterStore();
    const skillsStore = useSkillStore();
    characterStore.$patch((state) => {
      state.currentCharacterId = 'char1';
    });
    vi.mocked(skillsStore.getSkillTemplatesByClass).mockResolvedValue([
      {
        id: 's1', name: '火球术', icon: 'fire', description: '发射火球',
        mpCost: 5, type: 'magic_damage',
        effect: { type: 'magic_damage', value: 10 }, unlockLevel: 1,
      },
    ]);
    skillsStore.$patch((state) => {
      state.skillBar = { slots: ['s1', null, null, null] };
    });

    const wrapper = mount(SkillsPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await flushPromises();

    expect(wrapper.find('.skill-slot.equipped').exists()).toBe(true);
  });

  it('点击 .skill-slot 触发 UI_CLICK({source:"skill_select"})', async () => {
    const pinia = createStubPinia();
    const characterStore = useCharacterStore();
    const skillsStore = useSkillStore();
    characterStore.$patch((state) => {
      state.currentCharacterId = 'char1';
    });
    vi.mocked(skillsStore.getSkillTemplatesByClass).mockResolvedValue([
      {
        id: 's1', name: '火球术', icon: 'fire', description: '发射火球',
        mpCost: 5, type: 'magic_damage',
        effect: { type: 'magic_damage', value: 10 }, unlockLevel: 1,
      },
    ]);
    const uiClickSpy = vi.fn();
    eventBus.on(GameEvents.UI_CLICK, uiClickSpy);

    const wrapper = mount(SkillsPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await flushPromises();
    await wrapper.find('.skill-slot').trigger('click');

    expect(uiClickSpy).toHaveBeenCalledWith({ source: 'skill_select' });
  });

  it('选中未装备技能后点击"记忆"触发 skillsStore.equipSkill 与 UI_CLICK({source:"skill_memorize"})', async () => {
    const pinia = createStubPinia();
    const characterStore = useCharacterStore();
    const skillsStore = useSkillStore();
    characterStore.$patch((state) => {
      state.currentCharacterId = 'char1';
    });
    vi.mocked(skillsStore.getSkillTemplatesByClass).mockResolvedValue([
      {
        id: 's1', name: '火球术', icon: 'fire', description: '发射火球',
        mpCost: 5, type: 'magic_damage',
        effect: { type: 'magic_damage', value: 10 }, unlockLevel: 1,
      },
    ]);
    const uiClickSpy = vi.fn();
    eventBus.on(GameEvents.UI_CLICK, uiClickSpy);

    const wrapper = mount(SkillsPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await flushPromises();
    await wrapper.find('.skill-slot').trigger('click');
    await wrapper.find('.action-btn.memorize').trigger('click');

    expect(uiClickSpy).toHaveBeenCalledWith({ source: 'skill_memorize' });
    expect(skillsStore.equipSkill).toHaveBeenCalled();
  });

  it('选中已装备技能后点击"遗忘"触发 skillsStore.unequipSkill 与 UI_CLICK({source:"skill_forget"})', async () => {
    const pinia = createStubPinia();
    const characterStore = useCharacterStore();
    const skillsStore = useSkillStore();
    characterStore.$patch((state) => {
      state.currentCharacterId = 'char1';
    });
    vi.mocked(skillsStore.getSkillTemplatesByClass).mockResolvedValue([
      {
        id: 's1', name: '火球术', icon: 'fire', description: '发射火球',
        mpCost: 5, type: 'magic_damage',
        effect: { type: 'magic_damage', value: 10 }, unlockLevel: 1,
      },
    ]);
    skillsStore.$patch((state) => {
      state.skillBar = { slots: ['s1', null, null, null] };
    });
    const uiClickSpy = vi.fn();
    eventBus.on(GameEvents.UI_CLICK, uiClickSpy);

    const wrapper = mount(SkillsPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await flushPromises();
    await wrapper.find('.skill-slot.equipped').trigger('click');
    await wrapper.find('.action-btn.forget').trigger('click');

    expect(uiClickSpy).toHaveBeenCalledWith({ source: 'skill_forget' });
    expect(skillsStore.unequipSkill).toHaveBeenCalledWith('s1');
  });

  it('BasePopup 关闭按钮触发 close 事件', async () => {
    const pinia = createStubPinia();
    const wrapper = mount(SkillsPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await wrapper.find('.popup-close-btn').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
