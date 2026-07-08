/**
 * @fileoverview QuestBoardPopup 任务看板弹窗组件单元测试
 *
 * 覆盖 QuestBoardPopup.vue 的：
 * 1. onMounted（visible=true）调用 questStore.init
 * 2. 渲染两个 tab 按钮（可接取任务 / 可交付任务）
 * 3. mock getQuestsFromBoard 返回任务列表 + isQuestAvailable=true 时渲染 .quest-card.available
 * 4. 切换 tab 至 'turnin' 时 .tab-btn.active 变化且触发 UI_CLICK({source:'quest_board_tab'})
 * 5. 点击 .accept-btn 触发 questStore.acceptQuestFromBoard 与 UI_CLICK({source:'quest_board_accept'})
 * 6. BasePopup 关闭按钮触发 close 事件
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），仅断言 class、文本、emit 与 stub 调用。
 *  - 使用 mount + createStubPinia 真实渲染 BasePopup / EmptyState 子组件。
 *  - mock @iconify/vue 避免真实网络加载。
 *  - 由于 createStubPinia 会 stub 所有 actions（包括 getQuestsFromBoard / isQuestAvailable），
 *    使用 vi.mocked(...).mockReturnValue 预设返回值以驱动 computed 渲染。
 *  - eventBus 使用真实实现，通过 eventBus.on 注册 spy 监听断言。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import QuestBoardPopup from '@/components/popup/QuestBoardPopup.vue';
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

describe('QuestBoardPopup 任务看板弹窗组件', () => {
  beforeEach(() => {
    eventBus.clearAll();
  });

  it('visible=true 时 onMounted 调用 questStore.init', async () => {
    const pinia = createStubPinia();
    const questStore = useQuestStore();
    // 避免渲染时 availableQuests computed 访问 undefined.filter
    vi.mocked(questStore.getQuestsFromBoard).mockReturnValue([]);
    vi.mocked(questStore.isQuestAvailable).mockReturnValue(true);
    mount(QuestBoardPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await flushPromises();
    expect(questStore.init).toHaveBeenCalled();
  });

  it('渲染两个 tab 按钮，默认"可接取任务"为 active', () => {
    const pinia = createStubPinia();
    const questStore = useQuestStore();
    vi.mocked(questStore.getQuestsFromBoard).mockReturnValue([]);
    vi.mocked(questStore.isQuestAvailable).mockReturnValue(true);
    vi.mocked(questStore.getQuestsToTurnIn).mockReturnValue([]);

    const wrapper = mount(QuestBoardPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    const tabs = wrapper.findAll('.tab-btn');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].text()).toContain('可接取任务');
    expect(tabs[1].text()).toContain('可交付任务');
    expect(tabs[0].classes()).toContain('active');
  });

  it('mock getQuestsFromBoard 返回任务且 isQuestAvailable=true 时渲染 .quest-card.available', () => {
    const pinia = createStubPinia();
    const questStore = useQuestStore();
    const mockQuest = {
      id: 'q1',
      title: '森林清除',
      description: '清除森林威胁',
      type: 'kill' as const,
      objectives: [{ key: 'k', type: 'kill' as const, target: 3, enemyId: 'spider' }],
      levelRequirement: 1,
      xpReward: 50,
      goldReward: 10,
      boardId: 'village',
    };
    vi.mocked(questStore.getQuestsFromBoard).mockReturnValue([mockQuest]);
    vi.mocked(questStore.isQuestAvailable).mockReturnValue(true);

    const wrapper = mount(QuestBoardPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    expect(wrapper.find('.quest-card.available').exists()).toBe(true);
    expect(wrapper.find('.quest-content h3').text()).toBe('森林清除');
    expect(wrapper.find('.accept-btn').exists()).toBe(true);
  });

  it('切换到"可交付任务" tab 时 active class 变化且触发 UI_CLICK({source:"quest_board_tab"})', async () => {
    const pinia = createStubPinia();
    const questStore = useQuestStore();
    vi.mocked(questStore.getQuestsFromBoard).mockReturnValue([]);
    vi.mocked(questStore.isQuestAvailable).mockReturnValue(true);
    vi.mocked(questStore.getQuestsToTurnIn).mockReturnValue([]);
    const uiClickSpy = vi.fn();
    eventBus.on(GameEvents.UI_CLICK, uiClickSpy);

    const wrapper = mount(QuestBoardPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    const turninTab = wrapper.findAll('.tab-btn')[1];
    await turninTab.trigger('click');

    expect(turninTab.classes()).toContain('active');
    expect(wrapper.findAll('.tab-btn')[0].classes()).not.toContain('active');
    expect(uiClickSpy).toHaveBeenCalledWith({ source: 'quest_board_tab' });
  });

  it('点击 .accept-btn 触发 questStore.acceptQuestFromBoard 与 UI_CLICK({source:"quest_board_accept"})', async () => {
    const pinia = createStubPinia();
    const questStore = useQuestStore();
    const mockQuest = {
      id: 'q1',
      title: '森林清除',
      description: '清除森林威胁',
      type: 'kill' as const,
      objectives: [{ key: 'k', type: 'kill' as const, target: 3, enemyId: 'spider' }],
      levelRequirement: 1,
      xpReward: 50,
      goldReward: 10,
      boardId: 'village',
    };
    vi.mocked(questStore.getQuestsFromBoard).mockReturnValue([mockQuest]);
    vi.mocked(questStore.isQuestAvailable).mockReturnValue(true);
    vi.mocked(questStore.acceptQuestFromBoard).mockResolvedValue(true);
    const uiClickSpy = vi.fn();
    eventBus.on(GameEvents.UI_CLICK, uiClickSpy);

    const wrapper = mount(QuestBoardPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await wrapper.find('.accept-btn').trigger('click');

    expect(uiClickSpy).toHaveBeenCalledWith({ source: 'quest_board_accept' });
    expect(questStore.acceptQuestFromBoard).toHaveBeenCalledWith('village', 'q1');
  });

  it('BasePopup 关闭按钮触发 close 事件', async () => {
    const pinia = createStubPinia();
    const questStore = useQuestStore();
    vi.mocked(questStore.getQuestsFromBoard).mockReturnValue([]);
    vi.mocked(questStore.isQuestAvailable).mockReturnValue(true);

    const wrapper = mount(QuestBoardPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await wrapper.find('.popup-close-btn').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
