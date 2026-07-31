/**
 * @fileoverview AudioSettingsPopup 音量设置弹窗组件单元测试
 *
 * 覆盖 AudioSettingsPopup.vue 的：
 * 1. 渲染：标题"音量设置"、3 个音量滑块、静音按钮
 * 2. masterVolume 渲染为百分比文本与滑块 value
 * 3. 主音量滑块 input 触发 store.setMasterVolume
 * 4. 音效开关点击触发 store.updateSettings 与 eventBus UI_CLICK
 * 5. 静音按钮点击触发 store.toggleMute 与 UI_CLICK({source:'audio_mute'})
 * 6. 点击"确定"触发 close 事件与 UI_CLICK({source:'audio_settings_close'})
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），仅断言 class、属性、emit 与 stub 调用。
 *  - 使用 mount + createStubPinia 真实渲染 BasePopup 与 BaseIcon 子组件。
 *  - mock @iconify/vue 避免真实网络加载。
 *  - eventBus 使用真实实现，通过 eventBus.on 注册 spy 监听断言。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import AudioSettingsPopup from '@/components/popup/AudioSettingsPopup.vue';
import { useAudioStore } from '@/modules/audio';
import { useGameStore } from '@/modules/game';
import { eventBus, GameEvents } from '@/modules/bus';
import { createStubPinia } from '../../utils/setup';

// mock Tone.js 依赖的 audio service 模块，避免 jsdom 下 new Tone.Filter() 报错
vi.mock('@/modules/audio/service', () => ({
  audioService: {},
}));

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
            'data-width': props.width,
          });
      },
    }),
    loadIcon: vi.fn().mockResolvedValue({ body: '<path d="M0 0h512v512H0z"/>' }),
  };
});

describe('AudioSettingsPopup 音量设置弹窗组件', () => {
  beforeEach(() => {
    eventBus.clearAll();
  });

  /**
   * 创建 stub Pinia 并预设 audio store 的 async 方法返回 resolved Promise。
   *
   * P3-116 后 audioStore 的 setMasterVolume/updateSettings/toggleMute 等方法
   * 改为 async（委托 GameStore 持久化），组件以 fire-and-forget 方式调用 `.catch()`。
   * createStubPinia 默认 stub 的 vi.fn() 返回 undefined，会导致 `.catch()` 报错，
   * 因此需在此统一 mockResolvedValue(undefined)。
   */
  function setupPiniaWithAudioStore() {
    const pinia = createStubPinia();
    const store = useAudioStore();
    vi.mocked(store.setMasterVolume).mockResolvedValue(undefined);
    vi.mocked(store.setSfxVolume).mockResolvedValue(undefined);
    vi.mocked(store.setBgmVolume).mockResolvedValue(undefined);
    vi.mocked(store.updateSettings).mockResolvedValue(undefined);
    vi.mocked(store.toggleMute).mockResolvedValue(undefined);
    vi.mocked(store.flushSave).mockResolvedValue(undefined);
    return { pinia, store };
  }

  it('visible=true 时渲染标题"音量设置"与 3 个音量滑块', () => {
    const { pinia } = setupPiniaWithAudioStore();
    const wrapper = mount(AudioSettingsPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    expect(wrapper.find('.popup-title').text()).toBe('音量设置');
    expect(wrapper.findAll('.audio-slider')).toHaveLength(3);
  });

  it('masterVolume=0.5 时主音量滑块 value=50 且显示"50%"', () => {
    const { pinia } = setupPiniaWithAudioStore();
    // P3-116：settings 收敛到 GameStore.gameSettings，需通过 GameStore.$patch 修改数据源
    useGameStore().$patch((state) => {
      state.gameSettings.masterVolume = 0.5;
    });
    const wrapper = mount(AudioSettingsPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    const masterSlider = wrapper.findAll('.audio-slider')[0];
    expect(masterSlider.attributes('value')).toBe('50');
    expect(wrapper.find('.slider-value').text()).toBe('50%');
  });

  it('主音量滑块 input 触发 store.setMasterVolume(0.8)', async () => {
    const { pinia, store } = setupPiniaWithAudioStore();
    const wrapper = mount(AudioSettingsPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    const masterSlider = wrapper.findAll('.audio-slider')[0];
    await masterSlider.setValue(80);
    expect(store.setMasterVolume).toHaveBeenCalledWith(0.8);
  });

  it('点击音效开关触发 store.updateSettings({ sfxEnabled: false }) 与 UI_CLICK', async () => {
    const { pinia, store } = setupPiniaWithAudioStore();
    // P3-116：settings 收敛到 GameStore.gameSettings，需通过 GameStore.$patch 修改数据源
    useGameStore().$patch((state) => {
      state.gameSettings.sfxEnabled = true;
    });
    const uiClickSpy = vi.fn();
    eventBus.on(GameEvents.UI_CLICK, uiClickSpy);

    const wrapper = mount(AudioSettingsPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await wrapper.find('.toggle-btn').trigger('click');

    expect(store.updateSettings).toHaveBeenCalledWith({ sfxEnabled: false });
    expect(uiClickSpy).toHaveBeenCalledWith({ source: 'audio_toggle_sfx' });
  });

  it('点击静音按钮触发 store.toggleMute 与 UI_CLICK({source:"audio_mute"})', async () => {
    const { pinia, store } = setupPiniaWithAudioStore();
    const uiClickSpy = vi.fn();
    eventBus.on(GameEvents.UI_CLICK, uiClickSpy);

    const wrapper = mount(AudioSettingsPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await wrapper.find('.mute-btn').trigger('click');

    expect(store.toggleMute).toHaveBeenCalled();
    expect(uiClickSpy).toHaveBeenCalledWith({ source: 'audio_mute' });
  });

  it('点击"确定"按钮触发 close 事件与 UI_CLICK({source:"audio_settings_close"})', async () => {
    const { pinia } = setupPiniaWithAudioStore();
    const uiClickSpy = vi.fn();
    eventBus.on(GameEvents.UI_CLICK, uiClickSpy);

    const wrapper = mount(AudioSettingsPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await wrapper.find('.popup-footer-btn.confirm').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
    expect(uiClickSpy).toHaveBeenCalledWith({ source: 'audio_settings_close' });
  });
});
