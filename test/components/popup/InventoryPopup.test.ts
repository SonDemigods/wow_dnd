/**
 * @fileoverview InventoryPopup 背包弹窗组件单元测试
 *
 * 覆盖 InventoryPopup.vue 的：
 * 1. 渲染骨架：visible=true 时渲染标题"背包"与分类标签
 * 2. onMounted 触发 inventoryStore.initialize 与 equipmentStore.initialize
 * 3. $patch 预设 inventory 后断言物品槽渲染与堆叠数量显示
 * 4. 选中物品后点击"使用"按钮触发 inventoryStore.useItemByIndex
 * 5. 点击"丢弃"按钮弹出确认弹窗，确认后触发 inventoryStore.removeItemByIndex
 * 6. BasePopup 关闭按钮触发 close 事件
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），仅断言 class、文本、emit 与 stub 调用。
 *  - 使用 mount + createStubPinia 真实渲染 BasePopup / ConfirmPopup 子组件。
 *  - mock @iconify/vue 避免真实网络加载。
 *  - eventBus 使用真实实现，通过 eventBus.on 注册 spy 监听断言。
 *  - 通过 store.$patch 预设 inventory 数组，并 mock getItemInfo 返回物品模板以驱动渲染。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import InventoryPopup from '@/components/popup/InventoryPopup.vue';
import { useInventoryStore } from '@/modules/inventory';
import { useGameStore } from '@/modules/game';
import { useEquipmentStore } from '@/modules/equipment';
import { eventBus, GameEvents } from '@/modules/bus';
import { createStubPinia } from '../../utils/setup';
import type { Item } from '@/modules/inventory';

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

describe('InventoryPopup 背包弹窗组件', () => {
  beforeEach(() => {
    eventBus.clearAll();
  });

  it('visible=true 时渲染标题"背包"与分类标签栏', () => {
    const pinia = createStubPinia();
    const wrapper = mount(InventoryPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    expect(wrapper.find('.popup-title').text()).toBe('背包');
    expect(wrapper.find('.category-tabs').exists()).toBe(true);
    // 默认分类包含"全部"按钮
    expect(wrapper.findAll('.tab-btn').length).toBeGreaterThan(0);
  });

  it('onMounted 调用 inventoryStore.initialize 与 equipmentStore.initialize', async () => {
    const pinia = createStubPinia();
    const inventoryStore = useInventoryStore();
    const equipmentStore = useEquipmentStore();
    // P3-116：currentCharacterId 收敛到 GameStore，需通过 GameStore.$patch 修改数据源
    useGameStore().$patch((state) => {
      state.currentCharacterId = 'char_001';
    });

    mount(InventoryPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await flushPromises();

    expect(inventoryStore.initialize).toHaveBeenCalledWith('char_001');
    expect(equipmentStore.initialize).toHaveBeenCalledWith('char_001');
  });

  it('预设 inventory 后渲染对应数量的 .item-slot 并显示堆叠数量', () => {
    const pinia = createStubPinia();
    const inventoryStore = useInventoryStore();
    const itemMap = new Map<string, Item>([
      [
        'potion_01',
        {
          id: 'potion_01',
          name: '治疗药水',
          kind: 'consumable',
          subtype: 'potion',
          rarity: 'common',
          icon: 'potion',
          description: '恢复 50 点生命值',
          value: 10,
          stackable: true,
          consumable: true,
          effects: [{ type: 'health_restore', value: 50 }],
          useMode: 'instant',
        },
      ],
    ]);
    inventoryStore.$patch((state) => {
      state.inventory = [{ itemId: 'potion_01', count: 3 }];
    });
    vi.mocked(inventoryStore.getItemInfo).mockImplementation(
      (id: string) => itemMap.get(id) || null
    );

    const wrapper = mount(InventoryPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });

    expect(wrapper.find('.item-slot').exists()).toBe(true);
    expect(wrapper.find('.item-count').text()).toBe('3');
  });

  it('选中消耗品后点击"使用"按钮触发 inventoryStore.useItemByIndex', async () => {
    const pinia = createStubPinia();
    const inventoryStore = useInventoryStore();
    const itemMap = new Map<string, Item>([
      [
        'potion_01',
        {
          id: 'potion_01',
          name: '治疗药水',
          kind: 'consumable',
          subtype: 'potion',
          rarity: 'common',
          icon: 'potion',
          description: '恢复 50 点生命值',
          value: 10,
          stackable: true,
          consumable: true,
          effects: [{ type: 'health_restore', value: 50 }],
          useMode: 'instant',
        },
      ],
    ]);
    inventoryStore.$patch((state) => {
      state.inventory = [{ itemId: 'potion_01', count: 2 }];
    });
    vi.mocked(inventoryStore.getItemInfo).mockImplementation(
      (id: string) => itemMap.get(id) || null
    );
    vi.mocked(inventoryStore.useItemByIndex).mockResolvedValue(true);

    const uiClickSpy = vi.fn();
    eventBus.on(GameEvents.UI_CLICK, uiClickSpy);

    const wrapper = mount(InventoryPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });

    // 选中物品
    await wrapper.find('.item-slot').trigger('click');
    expect(wrapper.find('.action-btn.use').exists()).toBe(true);

    // 点击使用
    await wrapper.find('.action-btn.use').trigger('click');

    expect(inventoryStore.useItemByIndex).toHaveBeenCalledWith(0);
    expect(uiClickSpy).toHaveBeenCalledWith({ source: 'inventory_use_item' });
  });

  it('点击"丢弃"按钮弹出确认弹窗，确认后触发 inventoryStore.removeItemByIndex', async () => {
    const pinia = createStubPinia();
    const inventoryStore = useInventoryStore();
    const itemMap = new Map<string, Item>([
      [
        'potion_01',
        {
          id: 'potion_01',
          name: '治疗药水',
          kind: 'consumable',
          subtype: 'potion',
          rarity: 'common',
          icon: 'potion',
          description: '恢复 50 点生命值',
          value: 10,
          stackable: true,
          consumable: true,
          effects: [{ type: 'health_restore', value: 50 }],
          useMode: 'instant',
        },
      ],
    ]);
    inventoryStore.$patch((state) => {
      state.inventory = [{ itemId: 'potion_01', count: 1 }];
    });
    vi.mocked(inventoryStore.getItemInfo).mockImplementation(
      (id: string) => itemMap.get(id) || null
    );
    vi.mocked(inventoryStore.removeItemByIndex).mockReturnValue(1);

    const wrapper = mount(InventoryPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });

    // 选中物品
    await wrapper.find('.item-slot').trigger('click');
    // 点击丢弃
    await wrapper.find('.action-btn.drop').trigger('click');

    // ConfirmPopup 渲染"确认"按钮
    const confirmBtn = wrapper.findAll('button').find((b) => b.text() === '确认');
    expect(confirmBtn).toBeTruthy();
    await confirmBtn!.trigger('click');

    expect(inventoryStore.removeItemByIndex).toHaveBeenCalledWith(0);
  });

  it('BasePopup 关闭按钮触发 close 事件', async () => {
    const pinia = createStubPinia();
    const wrapper = mount(InventoryPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await wrapper.find('.popup-close-btn').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
