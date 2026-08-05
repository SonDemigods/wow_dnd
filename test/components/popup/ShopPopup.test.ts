/**
 * @fileoverview ShopPopup 商店弹窗组件单元测试
 *
 * 覆盖 ShopPopup.vue 的：
 * 1. 渲染骨架：visible=true 时渲染标题"商店"与购买/出售标签
 * 2. onMounted 触发 shopStore.init
 * 3. $patch 预设 currentItems 后断言商品卡片渲染与名称显示
 * 4. 选中商品后点击"购买"按钮触发 shopStore.buyItem
 * 5. 切换到出售标签并选中背包物品后点击"出售"按钮触发 shopStore.sellItem
 * 6. BasePopup 关闭按钮触发 close 事件
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），仅断言 class、文本、emit 与 stub 调用。
 *  - 使用 mount + createStubPinia 真实渲染 BasePopup / EmptyState 子组件。
 *  - mock @iconify/vue 避免真实网络加载。
 *  - eventBus 使用真实实现，通过 eventBus.on 注册 spy 监听断言。
 *  - 通过 store.$patch 预设 currentItems / inventory，并 mock getItemInfo 返回物品模板以驱动渲染。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ShopPopup from '@/components/popup/ShopPopup.vue';
import { useShopStore } from '@/modules/shop';
import { useCharacterStore } from '@/modules/character';
import { useInventoryStore } from '@/modules/inventory';
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

describe('ShopPopup 商店弹窗组件', () => {
  beforeEach(() => {
    eventBus.clearAll();
  });

  it('visible=true 时渲染标题"商店"与购买/出售标签栏', () => {
    const pinia = createStubPinia();
    const wrapper = mount(ShopPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    expect(wrapper.find('.popup-title').text()).toBe('商店');
    // 购买/出售两个标签按钮
    const tabs = wrapper.findAll('.shop-tabs .tab-btn');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].text()).toBe('购买');
    expect(tabs[1].text()).toBe('出售');
  });

  it('onMounted 调用 shopStore.init', async () => {
    const pinia = createStubPinia();
    const shopStore = useShopStore();
    mount(ShopPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await flushPromises();
    expect(shopStore.init).toHaveBeenCalled();
  });

  it('预设 currentItems 后渲染 .item-card 且显示商品名称', () => {
    const pinia = createStubPinia();
    const shopStore = useShopStore();
    const inventoryStore = useInventoryStore();
    const itemMap = new Map<string, Item>([
      [
        'sword_01',
        {
          id: 'sword_01',
          name: '铁剑',
          kind: 'equipment',
          capabilities: ['describable', 'equippable', 'sellable', 'enchantable'],
          subtype: 'sword',
          grip: 'one_handed',
          rarity: 'common',
          icon: 'broadsword',
          description: '一把普通的铁剑',
          value: 50,
          stackable: false,
          consumable: false,
          slots: ['weapon1', 'weapon2'],
          occupies: ['weapon1'],
          bonus: {},
        },
      ],
    ]);
    shopStore.$patch((state) => {
      state.currentItems = [{ itemId: 'sword_01', price: 50, quantity: 5 }];
    });
    vi.mocked(inventoryStore.getItemInfo).mockImplementation(
      (id: string) => itemMap.get(id) || null
    );

    const wrapper = mount(ShopPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });

    expect(wrapper.find('.item-card').exists()).toBe(true);
    expect(wrapper.find('.card-name').text()).toBe('铁剑');
    expect(wrapper.find('.card-price').text()).toContain('50');
  });

  it('选中商品后点击"购买"按钮触发 shopStore.buyItem', async () => {
    const pinia = createStubPinia();
    const shopStore = useShopStore();
    const inventoryStore = useInventoryStore();
    const characterStore = useCharacterStore();
    const itemMap = new Map<string, Item>([
      [
        'sword_01',
        {
          id: 'sword_01',
          name: '铁剑',
          kind: 'equipment',
          capabilities: ['describable', 'equippable', 'sellable', 'enchantable'],
          subtype: 'sword',
          grip: 'one_handed',
          rarity: 'common',
          icon: 'broadsword',
          description: '一把普通的铁剑',
          value: 50,
          stackable: false,
          consumable: false,
          slots: ['weapon1', 'weapon2'],
          occupies: ['weapon1'],
          bonus: {},
        },
      ],
    ]);
    shopStore.$patch((state) => {
      state.currentItems = [{ itemId: 'sword_01', price: 50, quantity: 5 }];
    });
    // 预设角色金币充足，使 canAffordBuy 返回 true（按钮可点击）
    characterStore.$patch((state) => {
      state.character = {
        name: '测试角色',
        factionId: 'alliance',
        raceId: 'human',
        classId: 'warrior',
        level: 1,
        exp: 0,
        expToNextLevel: 100,
        hp: 100,
        maxHp: 100,
        mana: 50,
        maxMana: 50,
        stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        gold: 1000,
      };
    });
    vi.mocked(inventoryStore.getItemInfo).mockImplementation(
      (id: string) => itemMap.get(id) || null
    );
    vi.mocked(shopStore.buyItem).mockResolvedValue(true);

    const uiClickSpy = vi.fn();
    eventBus.on(GameEvents.UI_CLICK, uiClickSpy);

    const wrapper = mount(ShopPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });

    // 选中商品（默认购买标签）
    await wrapper.find('.item-card').trigger('click');
    expect(wrapper.find('.action-btn.buy').exists()).toBe(true);

    // 点击购买
    await wrapper.find('.action-btn.buy').trigger('click');

    expect(shopStore.buyItem).toHaveBeenCalledWith('sword_01', 1);
    expect(uiClickSpy).toHaveBeenCalledWith({ source: 'shop_buy' });
  });

  it('切换到出售标签并选中背包物品后点击"出售"按钮触发 shopStore.sellItem', async () => {
    const pinia = createStubPinia();
    const shopStore = useShopStore();
    const inventoryStore = useInventoryStore();
    const itemMap = new Map<string, Item>([
      [
        'potion_01',
        {
          id: 'potion_01',
          name: '治疗药水',
          kind: 'consumable',
          capabilities: ['describable', 'usable', 'stackable', 'sellable'],
          subtype: 'potion',
          rarity: 'common',
          icon: 'potion',
          description: '恢复 50 点生命值',
          value: 10,
          stackable: true,
          consumable: true,
          effects: [],
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
    vi.mocked(shopStore.calculateSellPrice).mockReturnValue(5);
    vi.mocked(shopStore.sellItem).mockResolvedValue(true);

    const wrapper = mount(ShopPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });

    // 切换到出售标签
    const sellTab = wrapper.findAll('.shop-tabs .tab-btn')[1];
    await sellTab.trigger('click');

    // 选中背包物品
    await wrapper.find('.item-card').trigger('click');
    expect(wrapper.find('.action-btn.sell').exists()).toBe(true);

    // 点击出售
    await wrapper.find('.action-btn.sell').trigger('click');

    expect(shopStore.sellItem).toHaveBeenCalledWith('potion_01', 1);
  });

  it('BasePopup 关闭按钮触发 close 事件', async () => {
    const pinia = createStubPinia();
    const wrapper = mount(ShopPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    await wrapper.find('.popup-close-btn').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
