/**
 * @fileoverview CharacterSelectPopup 角色选择弹窗组件单元测试
 *
 * 覆盖 CharacterSelectPopup.vue 的：
 * 1. visible 控制 BasePopup 渲染与标题"开始游戏"
 * 2. characterStore.characterList 驱动角色卡片渲染
 * 3. 列表加载后自动选中第一个角色
 * 4. 选择角色 + 进入游戏：点击卡片选中、点击"进入游戏"触发 selectCharacter 与 emit select
 * 5. 删除角色：点击删除 → 确认弹窗 → deleteCharacter
 * 6. 创建角色按钮 emit create
 * 7. 角色数量达上限(10)时不渲染"创建角色"按钮
 * 8. versionMismatch 时"进入游戏"按钮始终禁用
 *
 * 遵循 code_rule：
 *  - 使用 mount + stub BaseIcon/Tag，让 BasePopup 真实渲染以验证弹窗内容。
 *  - 注册空 v-motion 指令避免指令解析告警；eventBus 真实 + clearAll。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import CharacterSelectPopup from '@/components/popup/CharacterSelectPopup.vue';
import { useCharacterStore } from '@/modules/character';
import { eventBus } from '@/modules/bus';
import { createStubPinia } from '../../utils/setup';
import type { CharacterListItem } from '@/modules/character/types';

// ==================== 测试数据 ====================
const characterList: CharacterListItem[] = [
  {
    id: 'c1',
    name: '英雄甲',
    raceId: 'human',
    classId: 'warrior',
    factionId: 'alliance',
    level: 5,
    createdTime: 1000,
    lastPlayedTime: 2000
  },
  {
    id: 'c2',
    name: '英雄乙',
    raceId: 'orc',
    classId: 'warrior',
    factionId: 'horde',
    level: 8,
    createdTime: 3000,
    lastPlayedTime: 4000
  }
];

// 空实现 v-motion 指令，避免模板中 v-motion 解析失败告警
const motionDirective = {
  mounted: () => {},
  updated: () => {}
};

describe('CharacterSelectPopup 角色选择弹窗组件', () => {
  let pinia: ReturnType<typeof createStubPinia>;

  beforeEach(() => {
    pinia = createStubPinia();
    eventBus.clearAll();
  });

  const mountComp = (props: Record<string, unknown> = {}) =>
    mount(CharacterSelectPopup, {
      props,
      global: {
        plugins: [pinia],
        directives: { motion: motionDirective },
        // stub BaseIcon（避免 iconify 异步加载）与 Tag（无需验证其内部）
        stubs: {
          BaseIcon: true,
          Tag: true,
        }
      }
    });

  describe('渲染', () => {
    it('visible=true 时渲染弹窗标题"角色选择"', () => {
      const wrapper = mountComp({ visible: true });
      expect(wrapper.find('.popup-title').text()).toBe('角色选择');
    });

    it('visible=false 时不渲染弹窗内容', () => {
      const wrapper = mountComp({ visible: false });
      expect(wrapper.find('.popup-title').exists()).toBe(false);
    });

    it('空角色列表时渲染"创建角色"按钮且无角色卡片', () => {
      const wrapper = mountComp({ visible: true });
      expect(wrapper.findAll('.character-card')).toHaveLength(0);
      expect(wrapper.find('.add-character').exists()).toBe(true);
      expect(wrapper.find('.add-text').text()).toBe('创建角色');
    });

    it('"进入游戏"按钮默认禁用（未选中角色）', () => {
      const wrapper = mountComp({ visible: true });
      expect(wrapper.find('.action-btn-primary').attributes('disabled')).toBeDefined();
    });
  });

  describe('角色列表驱动渲染', () => {
    it('预设 characterList 后渲染对应数量的角色卡片', async () => {
      const characterStore = useCharacterStore(pinia);
      characterStore.characterList = characterList;
      const wrapper = mountComp({ visible: true });
      await wrapper.vm.$nextTick();

      const cards = wrapper.findAll('.character-card');
      expect(cards).toHaveLength(2);
      expect(cards[0].find('.char-name').text()).toBe('英雄甲');
      expect(cards[0].find('.char-level').text()).toBe('Lv.5');
    });

    it('列表加载后自动选中第一个角色', async () => {
      const characterStore = useCharacterStore(pinia);
      characterStore.characterList = characterList;
      const wrapper = mountComp({ visible: true });
      await wrapper.vm.$nextTick();

      const firstCard = wrapper.findAll('.character-card')[0];
      expect(firstCard.classes()).toContain('selected');
    });

    it('角色数量达到上限(10)时不渲染"创建角色"按钮', async () => {
      const characterStore = useCharacterStore(pinia);
      characterStore.characterList = Array.from({ length: 10 }, (_, i) => ({
        ...characterList[0],
        id: `c${i}`,
        name: `英雄${i}`
      }));
      const wrapper = mountComp({ visible: true });
      await wrapper.vm.$nextTick();

      expect(wrapper.findAll('.character-card')).toHaveLength(10);
      expect(wrapper.find('.add-character').exists()).toBe(false);
    });
  });

  describe('选择角色与进入游戏', () => {
    it('点击角色卡片为其添加 selected class', async () => {
      const characterStore = useCharacterStore(pinia);
      characterStore.characterList = characterList;
      const wrapper = mountComp({ visible: true });
      await wrapper.vm.$nextTick();

      const secondCard = wrapper.findAll('.character-card')[1];
      await secondCard.trigger('click');

      expect(secondCard.classes()).toContain('selected');
    });

    it('选中角色后点击"进入游戏"触发 selectCharacter 与 emit select', async () => {
      const characterStore = useCharacterStore(pinia);
      characterStore.characterList = characterList;
      const wrapper = mountComp({ visible: true });
      await wrapper.vm.$nextTick();

      // 自动选中第一个（c1）
      await wrapper.find('.action-btn-primary').trigger('click');
      await flushPromises();

      expect(characterStore.selectCharacter).toHaveBeenCalledWith('c1');
      expect(wrapper.emitted('select')).toEqual([['c1']]);
    });
  });

  describe('删除角色', () => {
    it('点击删除按钮弹出确认弹窗', async () => {
      const characterStore = useCharacterStore(pinia);
      characterStore.characterList = characterList;
      const wrapper = mountComp({ visible: true });
      await wrapper.vm.$nextTick();

      expect(wrapper.find('.confirm-modal-overlay').exists()).toBe(false);
      await wrapper.find('.char-delete').trigger('click');

      expect(wrapper.find('.confirm-modal-overlay').exists()).toBe(true);
      expect(wrapper.find('.confirm-modal h3').text()).toBe('确认删除');
    });

    it('确认删除后调用 characterStore.deleteCharacter', async () => {
      const characterStore = useCharacterStore(pinia);
      characterStore.characterList = characterList;
      const wrapper = mountComp({ visible: true });
      await wrapper.vm.$nextTick();

      await wrapper.find('.char-delete').trigger('click');
      await wrapper.find('.confirm-btn-delete').trigger('click');
      await flushPromises();

      expect(characterStore.deleteCharacter).toHaveBeenCalledWith('c1');
    });
  });

  describe('创建新角色', () => {
    it('点击"创建角色"按钮触发 emit create', async () => {
      const wrapper = mountComp({ visible: true });
      await wrapper.find('.add-character').trigger('click');

      expect(wrapper.emitted('create')).toHaveLength(1);
    });
  });

  describe('版本不匹配拦截（versionMismatch prop）', () => {
    it('versionMismatch=true 时"进入游戏"按钮始终禁用（即使自动选中角色）', async () => {
      const characterStore = useCharacterStore(pinia);
      characterStore.characterList = characterList;
      const wrapper = mountComp({ visible: true, versionMismatch: true });
      await wrapper.vm.$nextTick();

      // 即使自动选中第一个角色，进入游戏按钮仍应禁用
      expect(wrapper.find('.action-btn-primary').attributes('disabled')).toBeDefined();
    });

    it('versionMismatch=false 时选中角色后"进入游戏"按钮可用', async () => {
      const characterStore = useCharacterStore(pinia);
      characterStore.characterList = characterList;
      const wrapper = mountComp({ visible: true, versionMismatch: false });
      await wrapper.vm.$nextTick();

      expect(wrapper.find('.action-btn-primary').attributes('disabled')).toBeUndefined();
    });
  });
});
