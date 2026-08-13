/**
 * @fileoverview ConfirmPopup 确认弹窗组件单元测试
 *
 * 覆盖 ConfirmPopup.vue 的：
 * 1. message 渲染在 .confirm-message；title 默认 '确认'，传入时使用传入值
 * 2. type=normal → 确认按钮 class 'confirm'；type=danger → 'danger'
 * 3. 点击"确认"：emit confirm + eventBus UI_CLICK({source:confirm_ok}) + CONFIRM_CONFIRMED({action})
 * 4. 点击"取消"：emit cancel + eventBus UI_CLICK({source:confirm_cancel}) + CONFIRM_CANCELED({action})
 * 5. action 默认 'unknown'，传入时体现在 eventBus payload
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），仅断言 class、emit 事件与 eventBus spy 调用。
 *  - eventBus 使用真实实现（纯内存无副作用），通过 eventBus.on 注册 spy 监听断言。
 *  - beforeEach 中 eventBus.clearAll() 清理状态，避免用例间污染。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ConfirmPopup from '@/components/common/ConfirmPopup.vue';
import { eventBus, GameEvents } from '@/modules/bus';

describe('ConfirmPopup 确认弹窗组件', () => {
  beforeEach(() => {
    eventBus.clearAll();
  });

  describe('渲染', () => {
    it('message 渲染在 .confirm-message', () => {
      const wrapper = mount(ConfirmPopup, {
        props: { visible: true, message: '确认删除？' },
      });
      expect(wrapper.find('.confirm-message').text()).toBe('确认删除？');
    });

    it('未传 title 时使用默认值"确认"', () => {
      const wrapper = mount(ConfirmPopup, {
        props: { visible: true, message: '消息' },
      });
      expect(wrapper.find('.popup-title').text()).toBe('确认');
    });

    it('传入 title 时使用传入值', () => {
      const wrapper = mount(ConfirmPopup, {
        props: { visible: true, title: '危险操作', message: '消息' },
      });
      expect(wrapper.find('.popup-title').text()).toBe('危险操作');
    });
  });

  describe('type 样式类', () => {
    it('type=normal（默认）时确认按钮 class 为 confirm', () => {
      const wrapper = mount(ConfirmPopup, {
        props: { visible: true, message: '消息' },
      });
      expect(wrapper.find('.popup-footer-btn.confirm').exists()).toBe(true);
      expect(wrapper.find('.popup-footer-btn.danger').exists()).toBe(false);
    });

    it('type=danger 时确认按钮 class 为 danger', () => {
      const wrapper = mount(ConfirmPopup, {
        props: { visible: true, message: '消息', type: 'danger' },
      });
      expect(wrapper.find('.popup-footer-btn.danger').exists()).toBe(true);
      expect(wrapper.find('.popup-footer-btn.confirm').exists()).toBe(false);
    });
  });

  describe('确认按钮交互', () => {
    it('点击"确认"触发 confirm 事件，并 emit UI_CLICK({source:confirm_ok}) 与 CONFIRM_CONFIRMED({action})', async () => {
      const uiClickSpy = vi.fn();
      const confirmedSpy = vi.fn();
      eventBus.on(GameEvents.UI_CLICK, uiClickSpy);
      eventBus.on(GameEvents.CONFIRM_CONFIRMED, confirmedSpy);

      const wrapper = mount(ConfirmPopup, {
        props: { visible: true, message: '消息', action: 'delete' },
      });

      await wrapper.find('.popup-footer-btn.confirm').trigger('click');

      expect(wrapper.emitted('confirm')).toHaveLength(1);
      expect(wrapper.emitted('cancel')).toBeUndefined();
      expect(uiClickSpy).toHaveBeenCalledWith({ source: 'confirm_ok' });
      expect(confirmedSpy).toHaveBeenCalledWith({ action: 'delete' });
    });

    it('action 默认 unknown 体现在 CONFIRM_CONFIRMED payload', async () => {
      const confirmedSpy = vi.fn();
      eventBus.on(GameEvents.CONFIRM_CONFIRMED, confirmedSpy);

      const wrapper = mount(ConfirmPopup, {
        props: { visible: true, message: '消息' },
      });

      await wrapper.find('.popup-footer-btn.confirm').trigger('click');

      expect(confirmedSpy).toHaveBeenCalledWith({ action: 'unknown' });
    });
  });

  describe('取消按钮交互', () => {
    it('点击"取消"触发 cancel 事件，并 emit UI_CLICK({source:confirm_cancel}) 与 CONFIRM_CANCELED({action})', async () => {
      const uiClickSpy = vi.fn();
      const canceledSpy = vi.fn();
      eventBus.on(GameEvents.UI_CLICK, uiClickSpy);
      eventBus.on(GameEvents.CONFIRM_CANCELED, canceledSpy);

      const wrapper = mount(ConfirmPopup, {
        props: { visible: true, message: '消息', action: 'delete' },
      });

      await wrapper.find('.popup-footer-btn.cancel').trigger('click');

      expect(wrapper.emitted('cancel')).toHaveLength(1);
      expect(wrapper.emitted('confirm')).toBeUndefined();
      expect(uiClickSpy).toHaveBeenCalledWith({ source: 'confirm_cancel' });
      expect(canceledSpy).toHaveBeenCalledWith({ action: 'delete' });
    });
  });
});
