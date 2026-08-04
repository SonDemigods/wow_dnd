/**
 * @fileoverview CharacterSelect 主菜单组件单元测试（4 按钮重构后）
 *
 * 覆盖 CharacterSelect.vue 的：
 * 1. 渲染骨架：4 个一级按钮（开始游戏/存档管理/系统设置/关于），无旧的 .character-list / .action-bar
 * 2. onMounted 调用 baseStore.loadAllData 与 characterStore.loadCharacterList
 * 3. 点击各一级按钮打开对应二级弹窗（通过 stub 子组件的 visible prop 验证）
 * 4. 事件转发：CharacterSelectPopup @select/@create → emit select/create；ArchiveManagerPopup @migrated → emit migrated
 * 5. SystemPopup @open-audio → 懒挂载 AudioSettingsPopup 并打开
 * 6. versionMismatch 控制警告横幅显隐
 * 7. SystemPopup 复用时 showExitButton=false
 * 8. refreshData 暴露给父组件
 *
 * 遵循 code_rule：
 *  - 使用 shallowMount + createStubPinia 隔离子组件与 store 副作用。
 *  - 通过 findComponent 访问 stubbed 子组件，验证 props 与 emit 转发。
 *  - eventBus 真实 + clearAll。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import CharacterSelect from '@/components/CharacterSelect.vue';
import CharacterSelectPopup from '@/components/popup/CharacterSelectPopup.vue';
import ArchiveManagerPopup from '@/components/popup/ArchiveManagerPopup.vue';
import SystemPopup from '@/components/popup/SystemPopup.vue';
import AboutPopup from '@/components/popup/AboutPopup.vue';
import AudioSettingsPopup from '@/components/popup/AudioSettingsPopup.vue';
import { useCharacterStore } from '@/modules/character';
import { useBaseStore } from '@/modules/base';
import { eventBus } from '@/modules/bus';
import { createStubPinia } from '../utils/setup';

describe('CharacterSelect 主菜单组件（4 按钮重构后）', () => {
  let pinia: ReturnType<typeof createStubPinia>;

  beforeEach(() => {
    pinia = createStubPinia();
    eventBus.clearAll();
  });

  const mountComp = (props: Record<string, unknown> = {}) =>
    shallowMount(CharacterSelect, {
      props,
      global: { plugins: [pinia] },
    });

  describe('渲染骨架', () => {
    it('渲染 4 个一级按钮', () => {
      const wrapper = mountComp();
      expect(wrapper.find('.menu-btn-start').exists()).toBe(true);
      expect(wrapper.find('.menu-btn-archive').exists()).toBe(true);
      expect(wrapper.find('.menu-btn-system').exists()).toBe(true);
      expect(wrapper.find('.menu-btn-about').exists()).toBe(true);
    });

    it('一级按钮文案正确', () => {
      const wrapper = mountComp();
      expect(wrapper.find('.menu-btn-start').text()).toContain('开始游戏');
      expect(wrapper.find('.menu-btn-archive').text()).toContain('存档管理');
      expect(wrapper.find('.menu-btn-system').text()).toContain('系统设置');
      expect(wrapper.find('.menu-btn-about').text()).toContain('关于');
    });

    it('不再渲染旧的 .character-list 与 .action-bar', () => {
      const wrapper = mountComp();
      expect(wrapper.find('.character-list').exists()).toBe(false);
      expect(wrapper.find('.action-bar').exists()).toBe(false);
    });
  });

  describe('onMounted 加载数据', () => {
    it('挂载后调用 baseStore.loadAllData 与 characterStore.loadCharacterList', async () => {
      const baseStore = useBaseStore(pinia);
      const characterStore = useCharacterStore(pinia);
      mountComp();
      await flushPromises();
      expect(baseStore.loadAllData).toHaveBeenCalledTimes(1);
      expect(characterStore.loadCharacterList).toHaveBeenCalledTimes(1);
    });
  });

  describe('点击一级按钮打开对应弹窗', () => {
    it('点击"开始游戏"打开 CharacterSelectPopup', async () => {
      const wrapper = mountComp();
      expect(wrapper.findComponent(CharacterSelectPopup).props('visible')).toBe(false);
      await wrapper.find('.menu-btn-start').trigger('click');
      expect(wrapper.findComponent(CharacterSelectPopup).props('visible')).toBe(true);
    });

    it('点击"存档管理"打开 ArchiveManagerPopup', async () => {
      const wrapper = mountComp();
      expect(wrapper.findComponent(ArchiveManagerPopup).props('visible')).toBe(false);
      await wrapper.find('.menu-btn-archive').trigger('click');
      expect(wrapper.findComponent(ArchiveManagerPopup).props('visible')).toBe(true);
    });

    it('点击"系统设置"打开 SystemPopup', async () => {
      const wrapper = mountComp();
      expect(wrapper.findComponent(SystemPopup).props('visible')).toBe(false);
      await wrapper.find('.menu-btn-system').trigger('click');
      expect(wrapper.findComponent(SystemPopup).props('visible')).toBe(true);
    });

    it('点击"关于"打开 AboutPopup', async () => {
      const wrapper = mountComp();
      expect(wrapper.findComponent(AboutPopup).props('visible')).toBe(false);
      await wrapper.find('.menu-btn-about').trigger('click');
      expect(wrapper.findComponent(AboutPopup).props('visible')).toBe(true);
    });
  });

  describe('事件转发', () => {
    it('CharacterSelectPopup emit select 时转发给父组件', () => {
      const wrapper = mountComp();
      wrapper.findComponent(CharacterSelectPopup).vm.$emit('select', 'c1');
      expect(wrapper.emitted('select')).toEqual([['c1']]);
    });

    it('CharacterSelectPopup emit create 时转发给父组件', () => {
      const wrapper = mountComp();
      wrapper.findComponent(CharacterSelectPopup).vm.$emit('create');
      expect(wrapper.emitted('create')).toHaveLength(1);
    });

    it('ArchiveManagerPopup emit migrated 时转发给父组件', () => {
      const wrapper = mountComp();
      wrapper.findComponent(ArchiveManagerPopup).vm.$emit('migrated');
      expect(wrapper.emitted('migrated')).toHaveLength(1);
    });
  });

  describe('音量设置懒挂载', () => {
    it('初始时 AudioSettingsPopup 未挂载', () => {
      const wrapper = mountComp();
      expect(wrapper.findComponent(AudioSettingsPopup).exists()).toBe(false);
    });

    it('SystemPopup emit open-audio 时懒挂载并打开 AudioSettingsPopup', async () => {
      const wrapper = mountComp();
      // 先打开系统弹窗
      await wrapper.find('.menu-btn-system').trigger('click');
      expect(wrapper.findComponent(SystemPopup).props('visible')).toBe(true);

      // 模拟 SystemPopup 发出 open-audio
      wrapper.findComponent(SystemPopup).vm.$emit('open-audio');
      await wrapper.vm.$nextTick();

      // 系统弹窗关闭
      expect(wrapper.findComponent(SystemPopup).props('visible')).toBe(false);
      // AudioSettingsPopup 懒挂载并打开
      const audioPopup = wrapper.findComponent(AudioSettingsPopup);
      expect(audioPopup.exists()).toBe(true);
      expect(audioPopup.props('visible')).toBe(true);
    });
  });

  describe('SystemPopup 复用配置', () => {
    it('SystemPopup 传入 showExitButton=false（隐藏退出游戏按钮）', () => {
      const wrapper = mountComp();
      expect(wrapper.findComponent(SystemPopup).props('showExitButton')).toBe(false);
    });

    it('SystemPopup 传入 version-mismatch 与父级一致', () => {
      const wrapper = mountComp({ versionMismatch: true });
      expect(wrapper.findComponent(SystemPopup).props('visible')).toBe(false);
    });
  });

  describe('版本不匹配警告横幅', () => {
    it('默认（versionMismatch 未传）不渲染警告横幅', () => {
      const wrapper = mountComp();
      expect(wrapper.find('.version-mismatch-banner').exists()).toBe(false);
    });

    it('versionMismatch=true 时渲染警告横幅', () => {
      const wrapper = mountComp({ versionMismatch: true });
      expect(wrapper.find('.version-mismatch-banner').exists()).toBe(true);
    });
  });

  describe('refreshData 暴露', () => {
    it('暴露 refreshData 方法供父组件调用', async () => {
      const baseStore = useBaseStore(pinia);
      const characterStore = useCharacterStore(pinia);
      const wrapper = mountComp();
      await flushPromises();

      // 重置 mock 调用计数（onMounted 已调用一次）
      vi.mocked(baseStore.loadAllData).mockClear();
      vi.mocked(characterStore.loadCharacterList).mockClear();

      await wrapper.vm.refreshData();
      expect(baseStore.loadAllData).toHaveBeenCalledTimes(1);
      expect(characterStore.loadCharacterList).toHaveBeenCalledTimes(1);
    });
  });
});
