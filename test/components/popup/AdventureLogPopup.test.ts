/**
 * @fileoverview AdventureLogPopup 冒险日志弹窗组件单元测试
 *
 * 覆盖 AdventureLogPopup.vue 的：
 * 1. 渲染：标题"冒险日志"、currentArea 头部
 * 2. logs 为空时渲染 EmptyState"暂无冒险记录"
 * 3. $patch 预设 logs 时渲染对应 .log-entry 条目
 * 4. 点击"清空日志"按钮触发 UI_CLICK({source:'log_clear_btn'}) 并弹出确认弹窗
 * 5. 在确认弹窗中点击"确认"触发 logStore.clearLogs
 * 6. BasePopup 关闭按钮触发 close 事件
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），仅断言 class、文本、emit 与 stub 调用。
 *  - 使用 mount + createStubPinia 真实渲染 BasePopup / ConfirmPopup / EmptyState 子组件。
 *  - mock @iconify/vue 避免真实网络加载。
 *  - eventBus 使用真实实现，通过 eventBus.on 注册 spy 监听断言。
 *  - 通过 store.$patch 预设 logs 数组测试渲染分支。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import AdventureLogPopup from '@/components/popup/AdventureLogPopup.vue';
import { useLogStore } from '@/modules/log';
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

describe('AdventureLogPopup 冒险日志弹窗组件', () => {
  beforeEach(() => {
    eventBus.clearAll();
  });

  it('visible=true 时渲染标题"冒险日志"', () => {
    const pinia = createStubPinia();
    const wrapper = mount(AdventureLogPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    expect(wrapper.find('.popup-title').text()).toBe('冒险日志');
  });

  it('传入 currentArea 时渲染区域头部文本', () => {
    const pinia = createStubPinia();
    const wrapper = mount(AdventureLogPopup, {
      props: { visible: true, currentArea: '艾尔文森林' },
      global: { plugins: [pinia] },
    });
    expect(wrapper.find('.log-header').text()).toContain('艾尔文森林');
  });

  it('logs 为空时渲染 EmptyState "暂无冒险记录"', () => {
    const pinia = createStubPinia();
    const logStore = useLogStore();
    logStore.$patch((state) => {
      state.logs = [];
    });
    const wrapper = mount(AdventureLogPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    expect(wrapper.text()).toContain('暂无冒险记录');
  });

  it('预设 logs 时渲染对应数量的 .log-entry 条目且显示 message', () => {
    const pinia = createStubPinia();
    const logStore = useLogStore();
    logStore.$patch((state) => {
      state.logs = [
        { id: 'l1', timestamp: 0, type: 'info', message: '进入新手村' },
        { id: 'l2', timestamp: 0, type: 'combat', message: '击败蜘蛛' },
      ];
    });
    const wrapper = mount(AdventureLogPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    const entries = wrapper.findAll('.log-entry');
    expect(entries).toHaveLength(2);
    expect(wrapper.find('.log-message').text()).toContain('进入新手村');
  });

  it('点击"清空日志"按钮触发 UI_CLICK({source:"log_clear_btn"}) 并显示确认弹窗', async () => {
    const pinia = createStubPinia();
    const uiClickSpy = vi.fn();
    eventBus.on(GameEvents.UI_CLICK, uiClickSpy);

    const wrapper = mount(AdventureLogPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await wrapper.find('.popup-footer-btn.danger').trigger('click');

    expect(uiClickSpy).toHaveBeenCalledWith({ source: 'log_clear_btn' });
    // ConfirmPopup 弹出后会出现"确认"按钮
    const confirmBtn = wrapper.findAll('button').find(b => b.text() === '确认');
    expect(confirmBtn).toBeTruthy();
  });

  it('在确认弹窗中点击"确认"触发 logStore.clearLogs', async () => {
    const pinia = createStubPinia();
    const logStore = useLogStore();

    const wrapper = mount(AdventureLogPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await wrapper.find('.popup-footer-btn.danger').trigger('click');

    const confirmBtn = wrapper.findAll('button').find(b => b.text() === '确认');
    expect(confirmBtn).toBeTruthy();
    await confirmBtn!.trigger('click');

    expect(logStore.clearLogs).toHaveBeenCalled();
  });

  it('BasePopup 关闭按钮触发 close 事件', async () => {
    const pinia = createStubPinia();
    const wrapper = mount(AdventureLogPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await wrapper.find('.popup-close-btn').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
