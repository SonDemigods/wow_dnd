/**
 * @fileoverview CharacterInfoPopup 角色信息弹窗组件单元测试
 *
 * 覆盖 CharacterInfoPopup.vue 的：
 * 1. 渲染骨架：visible=true 时渲染标题"角色信息"
 * 2. onMounted 触发 baseStore.loadAllData
 * 3. $patch 预设 character 数据后断言 .char-name / .char-level 渲染
 * 4. $patch 预设 equipment 后断言 .equip-slot.equipped 存在
 * 5. 点击 .equip-slot 选中后点击 .action-btn.unequip 触发 equipmentStore.unequipItem
 * 6. BasePopup 关闭按钮触发 close 事件
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），仅断言 class、文本、emit 与 stub 调用。
 *  - 使用 mount + createStubPinia 真实渲染 BasePopup 子组件。
 *  - mock @iconify/vue 避免真实网络加载。
 *  - eventBus 使用真实实现，通过 eventBus.on 注册 spy 监听断言。
 *  - 通过 store.$patch 预设 character / equipment 测试渲染分支。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import CharacterInfoPopup from '@/components/popup/CharacterInfoPopup.vue';
import { useCharacterStore } from '@/modules/character';
import { useEquipmentStore } from '@/modules/equipment';
import { useBaseStore } from '@/modules/base';
import { eventBus, GameEvents } from '@/modules/bus';
import { createStubPinia } from '../../utils/setup';
import type { Character } from '@/modules/character/types';
import type { EquipmentItem } from '@/modules/equipment/types';

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

describe('CharacterInfoPopup 角色信息弹窗组件', () => {
  beforeEach(() => {
    eventBus.clearAll();
  });

  /** 构造完整 Character 对象，用于 $patch characterStore.character */
  function buildCharacter(): Character {
    return {
      name: '测试勇者',
      factionId: 'alliance',
      raceId: 'human',
      classId: 'warrior',
      level: 5,
      exp: 50,
      expToNextLevel: 100,
      hp: 80,
      maxHp: 100,
      mana: 30,
      maxMana: 50,
      stats: { str: 15, dex: 12, con: 14, int: 8, wis: 10, cha: 10 },
      gold: 500,
    };
  }

  /** 构造测试用武器装备 */
  function buildWeapon(): EquipmentItem {
    return {
      id: 'sword_01',
      name: '铁剑',
      type: 'weapon',
      rarity: 'common',
      icon: 'broadsword',
      description: '一把普通的铁剑',
      value: 50,
      stackable: false,
      slots: ['weapon1'],
      bonus: { str: 3 },
      levelRequirement: 1,
    };
  }

  it('visible=true 时渲染标题"角色信息"', () => {
    const pinia = createStubPinia();
    const wrapper = mount(CharacterInfoPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    expect(wrapper.find('.popup-title').text()).toBe('角色信息');
  });

  it('onMounted 调用 baseStore.loadAllData', async () => {
    const pinia = createStubPinia();
    const baseStore = useBaseStore();
    mount(CharacterInfoPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await flushPromises();
    expect(baseStore.loadAllData).toHaveBeenCalled();
  });

  it('预设 character 数据后渲染 .char-name 与 .char-level', () => {
    const pinia = createStubPinia();
    const characterStore = useCharacterStore();
    characterStore.$patch((state) => {
      state.character = buildCharacter();
    });
    const wrapper = mount(CharacterInfoPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    expect(wrapper.find('.char-name').text()).toBe('测试勇者');
    expect(wrapper.find('.char-level').text()).toBe('Lv.5');
  });

  it('预设 equipment 后渲染 .equip-slot.equipped', () => {
    const pinia = createStubPinia();
    const characterStore = useCharacterStore();
    const equipmentStore = useEquipmentStore();
    characterStore.$patch((state) => {
      state.character = buildCharacter();
    });
    equipmentStore.$patch((state) => {
      state.equipment.weapon1 = { item: buildWeapon(), equippedAt: Date.now() };
    });
    const wrapper = mount(CharacterInfoPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    expect(wrapper.find('.equip-slot.equipped').exists()).toBe(true);
  });

  it('点击 .equip-slot 选中后点击 .action-btn.unequip 触发 equipmentStore.unequipItem', async () => {
    const pinia = createStubPinia();
    const characterStore = useCharacterStore();
    const equipmentStore = useEquipmentStore();
    characterStore.$patch((state) => {
      state.character = buildCharacter();
    });
    const weapon = buildWeapon();
    equipmentStore.$patch((state) => {
      state.equipment.weapon1 = { item: weapon, equippedAt: Date.now() };
    });
    // stub 默认返回 undefined（falsy），mock 为返回 truthy 以走卸下成功分支
    vi.mocked(equipmentStore.unequipItem).mockResolvedValue({
      item: weapon,
      equippedAt: Date.now(),
    });

    const uiClickSpy = vi.fn();
    eventBus.on(GameEvents.UI_CLICK, uiClickSpy);

    const wrapper = mount(CharacterInfoPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });

    // 选中 weapon1 槽位
    const slot = wrapper.find('[data-equip-slot="weapon1"]');
    await slot.trigger('click');
    expect(uiClickSpy).toHaveBeenCalledWith({ source: 'equip_slot' });
    expect(wrapper.find('.action-btn.unequip').exists()).toBe(true);

    // 点击卸下
    await wrapper.find('.action-btn.unequip').trigger('click');
    expect(equipmentStore.unequipItem).toHaveBeenCalledWith('weapon1');
    expect(uiClickSpy).toHaveBeenCalledWith({ source: 'unequip_btn' });
  });

  it('BasePopup 关闭按钮触发 close 事件', async () => {
    const pinia = createStubPinia();
    const wrapper = mount(CharacterInfoPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await wrapper.find('.popup-close-btn').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
