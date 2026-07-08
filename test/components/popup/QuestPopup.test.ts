/**
 * @fileoverview QuestPopup 任务日志弹窗组件单元测试
 *
 * 覆盖 QuestPopup.vue 的：
 * 1. onMounted（visible=true）调用 questStore.init
 * 2. questInstances 为空时渲染 EmptyState "暂无进行中的任务"
 * 3. $patch 预设 in_progress 任务时渲染 .quest-card 含 title
 * 4. $patch 预设 completed 任务时不渲染 .abandon-btn
 * 5. 点击 .abandon-btn 触发 UI_CLICK({source:'quest_abandon_btn'}) 并弹出确认弹窗
 * 6. 在确认弹窗中点击"确认"触发 questStore.abandonQuest
 * 7. BasePopup 关闭按钮触发 close 事件
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），仅断言 class、文本、emit 与 stub 调用。
 *  - 使用 mount + createStubPinia 真实渲染 BasePopup / ConfirmPopup / EmptyState 子组件。
 *  - mock @iconify/vue 避免真实网络加载。
 *  - eventBus 使用真实实现，通过 eventBus.on 注册 spy 监听断言。
 *  - 通过 store.$patch 预设 questInstances / questDefinitions 测试分类渲染。
 *    由于 createStubPinia 会 stub 所有 actions（含 getQuestDefinition / getQuestInstance），
 *    使用 vi.mocked(...).mockImplementation 让它们从预设 Map 中读取，配合 getters 完成渲染。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import QuestPopup from '@/components/popup/QuestPopup.vue';
import { useQuestStore } from '@/modules/quest';
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

describe('QuestPopup 任务日志弹窗组件', () => {
  beforeEach(() => {
    eventBus.clearAll();
  });

  it('visible=true 时 onMounted 调用 questStore.init', async () => {
    const pinia = createStubPinia();
    const questStore = useQuestStore();
    mount(QuestPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await flushPromises();
    expect(questStore.init).toHaveBeenCalled();
  });

  it('questInstances 为空时渲染 EmptyState "暂无进行中的任务"', () => {
    const pinia = createStubPinia();
    const wrapper = mount(QuestPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    expect(wrapper.text()).toContain('暂无进行中的任务');
  });

  it('预设 in_progress 任务时渲染 .quest-card 且显示任务标题', () => {
    const pinia = createStubPinia();
    const questStore = useQuestStore();
    const defMap = new Map([
      ['q1', {
        id: 'q1',
        title: '击杀森林蜘蛛',
        description: '清除森林中的蜘蛛威胁',
        type: 'kill',
        objectives: [{ key: 'kill_spider', type: 'kill', target: 3, enemyId: 'spider' }],
        levelRequirement: 1,
        xpReward: 50,
        goldReward: 10,
        boardId: 'village',
      }],
    ]);
    const instMap = new Map([
      ['q1', {
        questId: 'q1',
        status: 'in_progress',
        progress: [{ objectiveKey: 'kill_spider', current: 0, target: 3 }],
        acceptedAt: 0,
      }],
    ]);
    questStore.$patch((state) => {
      state.questDefinitions = defMap;
      state.questInstances = instMap;
    });
    vi.mocked(questStore.getQuestDefinition).mockImplementation((id) => defMap.get(id) || null);
    vi.mocked(questStore.getQuestInstance).mockImplementation((id) => instMap.get(id) || null);

    const wrapper = mount(QuestPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    expect(wrapper.find('.quest-card').exists()).toBe(true);
    expect(wrapper.find('.quest-content h3').text()).toBe('击杀森林蜘蛛');
    expect(wrapper.find('.quest-status.in_progress').exists()).toBe(true);
  });

  it('预设 completed 任务时不渲染 .abandon-btn', () => {
    const pinia = createStubPinia();
    const questStore = useQuestStore();
    const defMap = new Map([
      ['q2', {
        id: 'q2',
        title: '收集草药',
        description: '收集 5 株草药',
        type: 'collect',
        objectives: [{ key: 'collect_herb', type: 'collect', target: 5, itemId: 'herb' }],
        levelRequirement: 1,
        xpReward: 30,
        goldReward: 5,
        boardId: 'village',
      }],
    ]);
    const instMap = new Map([
      ['q2', {
        questId: 'q2',
        status: 'completed',
        progress: [{ objectiveKey: 'collect_herb', current: 5, target: 5 }],
        acceptedAt: 0,
      }],
    ]);
    questStore.$patch((state) => {
      state.questDefinitions = defMap;
      state.questInstances = instMap;
    });
    vi.mocked(questStore.getQuestDefinition).mockImplementation((id) => defMap.get(id) || null);
    vi.mocked(questStore.getQuestInstance).mockImplementation((id) => instMap.get(id) || null);

    const wrapper = mount(QuestPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    expect(wrapper.find('.quest-card').exists()).toBe(true);
    expect(wrapper.find('.quest-status.completed').exists()).toBe(true);
    expect(wrapper.find('.abandon-btn').exists()).toBe(false);
  });

  it('点击 .abandon-btn 触发 UI_CLICK({source:"quest_abandon_btn"}) 并弹出确认弹窗', async () => {
    const pinia = createStubPinia();
    const questStore = useQuestStore();
    const defMap = new Map([
      ['q1', {
        id: 'q1', title: '击杀蜘蛛', description: '...',
        type: 'kill',
        objectives: [{ key: 'k', type: 'kill', target: 3, enemyId: 'spider' }],
        levelRequirement: 1, xpReward: 50, goldReward: 10, boardId: 'village',
      }],
    ]);
    const instMap = new Map([
      ['q1', {
        questId: 'q1', status: 'in_progress',
        progress: [{ objectiveKey: 'k', current: 0, target: 3 }],
        acceptedAt: 0,
      }],
    ]);
    questStore.$patch((state) => {
      state.questDefinitions = defMap;
      state.questInstances = instMap;
    });
    vi.mocked(questStore.getQuestDefinition).mockImplementation((id) => defMap.get(id) || null);
    vi.mocked(questStore.getQuestInstance).mockImplementation((id) => instMap.get(id) || null);

    const uiClickSpy = vi.fn();
    eventBus.on(GameEvents.UI_CLICK, uiClickSpy);

    const wrapper = mount(QuestPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await wrapper.find('.abandon-btn').trigger('click');

    expect(uiClickSpy).toHaveBeenCalledWith({ source: 'quest_abandon_btn' });
    const confirmBtn = wrapper.findAll('button').find(b => b.text() === '确认');
    expect(confirmBtn).toBeTruthy();
  });

  it('在确认弹窗中点击"确认"触发 questStore.abandonQuest', async () => {
    const pinia = createStubPinia();
    const questStore = useQuestStore();
    const defMap = new Map([
      ['q1', {
        id: 'q1', title: '击杀蜘蛛', description: '...',
        type: 'kill',
        objectives: [{ key: 'k', type: 'kill', target: 3, enemyId: 'spider' }],
        levelRequirement: 1, xpReward: 50, goldReward: 10, boardId: 'village',
      }],
    ]);
    const instMap = new Map([
      ['q1', {
        questId: 'q1', status: 'in_progress',
        progress: [{ objectiveKey: 'k', current: 0, target: 3 }],
        acceptedAt: 0,
      }],
    ]);
    questStore.$patch((state) => {
      state.questDefinitions = defMap;
      state.questInstances = instMap;
    });
    vi.mocked(questStore.getQuestDefinition).mockImplementation((id) => defMap.get(id) || null);
    vi.mocked(questStore.getQuestInstance).mockImplementation((id) => instMap.get(id) || null);
    vi.mocked(questStore.abandonQuest).mockResolvedValue(true);

    const wrapper = mount(QuestPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await wrapper.find('.abandon-btn').trigger('click');

    const confirmBtn = wrapper.findAll('button').find(b => b.text() === '确认');
    expect(confirmBtn).toBeTruthy();
    await confirmBtn!.trigger('click');

    expect(questStore.abandonQuest).toHaveBeenCalledWith('q1');
  });

  it('BasePopup 关闭按钮触发 close 事件', async () => {
    const pinia = createStubPinia();
    const wrapper = mount(QuestPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await wrapper.find('.popup-close-btn').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
