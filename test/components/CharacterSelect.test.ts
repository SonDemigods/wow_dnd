/**
 * @fileoverview CharacterSelect 角色选择组件单元测试
 *
 * 覆盖 CharacterSelect.vue 的：
 * 1. 渲染骨架：.character-select 根元素、.character-list、.action-bar
 * 2. onMounted 调用 baseStore.loadAllData 与 characterStore.loadCharacterList
 * 3. characterStore.characterList 驱动角色条目渲染
 * 4. 选择角色 + 进入游戏：点击卡片选中、点击"进入游戏"触发 characterStore.selectCharacter 与 emit('select')
 * 5. 删除角色：点击删除按钮 → 确认弹窗 → characterStore.deleteCharacter
 * 6. 创建新角色按钮 emit('create')
 *
 * 遵循 code_rule：
 *  - 使用 shallowMount + createStubPinia 隔离子组件与 store 副作用。
 *  - 不断言计算后 CSS 样式值，仅断言 class、文本、emit、action 调用。
 *  - 注册空 v-motion 指令避免指令解析告警；eventBus 真实 + clearAll。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import CharacterSelect from '@/components/CharacterSelect.vue';
import { useCharacterStore } from '@/modules/character';
import { useBaseStore } from '@/modules/base';
import { eventBus } from '@/modules/bus';
import { createStubPinia } from '../utils/setup';
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

describe('CharacterSelect 角色选择组件', () => {
  let pinia: ReturnType<typeof createStubPinia>;

  beforeEach(() => {
    pinia = createStubPinia();
    eventBus.clearAll();
  });

  const mountComp = () =>
    shallowMount(CharacterSelect, {
      global: { plugins: [pinia], directives: { motion: motionDirective } }
    });

  describe('渲染骨架', () => {
    it('渲染 .character-select 根元素、.character-list 与 .action-bar', () => {
      const wrapper = mountComp();
      expect(wrapper.find('.character-select').exists()).toBe(true);
      expect(wrapper.find('.character-list').exists()).toBe(true);
      expect(wrapper.find('.action-bar').exists()).toBe(true);
    });

    it('空角色列表时渲染"创建角色"按钮且无角色卡片', () => {
      const wrapper = mountComp();
      expect(wrapper.findAll('.character-card')).toHaveLength(0);
      expect(wrapper.find('.add-character').exists()).toBe(true);
      expect(wrapper.find('.add-text').text()).toBe('创建角色');
    });

    it('"进入游戏"按钮默认禁用（未选中角色）', () => {
      const wrapper = mountComp();
      expect(
        wrapper.find('.action-btn-primary').attributes('disabled')
      ).toBeDefined();
    });
  });

  describe('onMounted 加载数据', () => {
    it('挂载后调用 baseStore.loadAllData 与 characterStore.loadCharacterList', async () => {
      const baseStore = useBaseStore(pinia);
      const characterStore = useCharacterStore(pinia);
      mountComp();
      // onMounted 为 async 且内部 await 链顺序调用两个 action，需刷新 microtask
      await flushPromises();
      expect(baseStore.loadAllData).toHaveBeenCalledTimes(1);
      expect(characterStore.loadCharacterList).toHaveBeenCalledTimes(1);
    });
  });

  describe('角色列表驱动渲染', () => {
    it('预设 characterList 后渲染对应数量的角色卡片', async () => {
      const characterStore = useCharacterStore(pinia);
      characterStore.characterList = characterList;
      const wrapper = mountComp();
      await wrapper.vm.$nextTick();

      const cards = wrapper.findAll('.character-card');
      expect(cards).toHaveLength(2);
      expect(cards[0].find('.char-name').text()).toBe('英雄甲');
      expect(cards[0].find('.char-level').text()).toBe('Lv.5');
    });

    it('角色数量达到上限(10)时不渲染"创建角色"按钮', async () => {
      const characterStore = useCharacterStore(pinia);
      characterStore.characterList = Array.from({ length: 10 }, (_, i) => ({
        ...characterList[0],
        id: `c${i}`,
        name: `英雄${i}`
      }));
      const wrapper = mountComp();
      await wrapper.vm.$nextTick();

      expect(wrapper.findAll('.character-card')).toHaveLength(10);
      expect(wrapper.find('.add-character').exists()).toBe(false);
    });
  });

  describe('选择角色与进入游戏', () => {
    it('点击角色卡片为其添加 selected class', async () => {
      const characterStore = useCharacterStore(pinia);
      characterStore.characterList = characterList;
      const wrapper = mountComp();
      await wrapper.vm.$nextTick();

      const firstCard = wrapper.findAll('.character-card')[0];
      await firstCard.trigger('click');

      expect(firstCard.classes()).toContain('selected');
    });

    it('选中角色后点击"进入游戏"触发 characterStore.selectCharacter 与 emit select', async () => {
      const characterStore = useCharacterStore(pinia);
      characterStore.characterList = characterList;
      const wrapper = mountComp();
      await wrapper.vm.$nextTick();

      await wrapper.findAll('.character-card')[0].trigger('click');
      // "进入游戏"按钮启用
      expect(
        wrapper.find('.action-btn-primary').attributes('disabled')
      ).toBeUndefined();

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
      const wrapper = mountComp();
      await wrapper.vm.$nextTick();

      expect(wrapper.find('.confirm-modal-overlay').exists()).toBe(false);
      await wrapper.find('.char-delete').trigger('click');

      expect(wrapper.find('.confirm-modal-overlay').exists()).toBe(true);
      expect(wrapper.find('.confirm-modal h3').text()).toBe('确认删除');
    });

    it('确认删除后调用 characterStore.deleteCharacter', async () => {
      const characterStore = useCharacterStore(pinia);
      characterStore.characterList = characterList;
      const wrapper = mountComp();
      await wrapper.vm.$nextTick();

      // 触发删除弹窗
      await wrapper.find('.char-delete').trigger('click');
      // 点击"删除"确认按钮
      await wrapper.find('.confirm-btn-delete').trigger('click');
      await flushPromises();

      expect(characterStore.deleteCharacter).toHaveBeenCalledWith('c1');
    });
  });

  describe('创建新角色', () => {
    it('点击"创建角色"按钮触发 emit create', async () => {
      const wrapper = mountComp();
      await wrapper.find('.add-character').trigger('click');

      expect(wrapper.emitted('create')).toHaveLength(1);
    });
  });
});
