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
      // 四层属性模型（plan.md §3.2）：1 级后角色可能已分配点数与喝过药剂
      potionStats: { str: 1, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      allocatedStats: { str: 2, dex: 1, con: 0, int: 0, wis: 0, cha: 0 },
      unallocatedPoints: 3,
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

  // ==================== 四层属性：升级点数分配 UI ====================
  it('unallocatedPoints > 0 时显示剩余点数条与可用的 + 按钮', () => {
    const pinia = createStubPinia();
    const characterStore = useCharacterStore();
    characterStore.$patch((state) => {
      state.character = buildCharacter();
    });
    const wrapper = mount(CharacterInfoPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    // 剩余点数显示
    const pointsBar = wrapper.find('.alloc-points');
    expect(pointsBar.exists()).toBe(true);
    expect(pointsBar.classes()).toContain('active');
    expect(pointsBar.text()).toContain('3');
    // + 按钮可点（未禁用）
    const allocBtns = wrapper.findAll('.alloc-btn');
    expect(allocBtns.length).toBeGreaterThan(0);
    expect((allocBtns[0].element as HTMLButtonElement).disabled).toBe(false);
    // 已分配点数显示（str 已分配 2）
    const strBonus = wrapper.find('.alloc-bonus');
    expect(strBonus.exists()).toBe(true);
    expect(strBonus.text()).toBe('+2');
  });

  it('点击 + 按钮触发 characterStore.allocateStat 与 UI_CLICK 事件', async () => {
    const pinia = createStubPinia();
    const characterStore = useCharacterStore();
    characterStore.$patch((state) => {
      state.character = buildCharacter();
    });
    const uiClickSpy = vi.fn();
    eventBus.on(GameEvents.UI_CLICK, uiClickSpy);

    const wrapper = mount(CharacterInfoPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    // 点击第一个属性（str）的 + 按钮
    const allocBtns = wrapper.findAll('.alloc-btn');
    await allocBtns[0].trigger('click');
    expect(characterStore.allocateStat).toHaveBeenCalledWith('str');
    expect(uiClickSpy).toHaveBeenCalledWith({ source: 'allocate_stat' });
  });

  it('点击重置按钮触发 characterStore.resetAllocatedStats', async () => {
    const pinia = createStubPinia();
    const characterStore = useCharacterStore();
    characterStore.$patch((state) => {
      state.character = buildCharacter();
    });
    const wrapper = mount(CharacterInfoPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    const resetBtn = wrapper.find('.reset-alloc-btn');
    expect(resetBtn.exists()).toBe(true);
    await resetBtn.trigger('click');
    expect(characterStore.resetAllocatedStats).toHaveBeenCalled();
  });

  // ==================== 阶段四：属性来源明细 tooltip ====================
  it('默认无 hover 时不显示属性来源 tooltip', () => {
    const pinia = createStubPinia();
    const characterStore = useCharacterStore();
    characterStore.$patch((state) => {
      state.character = buildCharacter();
    });
    const wrapper = mount(CharacterInfoPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });
    expect(wrapper.find('.attr-breakdown').exists()).toBe(false);
  });

  it('hover 属性项时显示来源明细 tooltip，包含 6 层来源', async () => {
    const pinia = createStubPinia();
    const characterStore = useCharacterStore();
    characterStore.$patch((state) => {
      state.character = buildCharacter();
      // 注入种族/职业加成，使明细非全 0
      state.raceBonus = { str: 2, con: 2 };
      state.classBonus = { str: 3, dex: 2, con: 2, int: -2 };
    });
    const wrapper = mount(CharacterInfoPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });

    // hover 第一个属性项（str）
    const attrItems = wrapper.findAll('.core-attr-item');
    expect(attrItems.length).toBeGreaterThan(0);
    await attrItems[0].trigger('mouseenter');

    // tooltip 显示
    const tooltip = wrapper.find('.attr-breakdown');
    expect(tooltip.exists()).toBe(true);
    // 包含 6 行来源明细
    const rows = tooltip.findAll('.breakdown-row');
    expect(rows).toHaveLength(6);
    // 标题包含属性名与总值
    expect(tooltip.find('.breakdown-title').text()).toContain('力量');
    // 各层标签正确
    const labels = rows.map(r => r.find('.breakdown-label').text());
    expect(labels).toEqual(['基础', '种族', '职业', '药剂', '升级', '装备/天赋']);
  });

  it('mouseleave 后 tooltip 消失', async () => {
    const pinia = createStubPinia();
    const characterStore = useCharacterStore();
    characterStore.$patch((state) => {
      state.character = buildCharacter();
    });
    const wrapper = mount(CharacterInfoPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });

    const attrItem = wrapper.find('.core-attr-item');
    await attrItem.trigger('mouseenter');
    expect(wrapper.find('.attr-breakdown').exists()).toBe(true);

    await attrItem.trigger('mouseleave');
    expect(wrapper.find('.attr-breakdown').exists()).toBe(false);
  });

  it('tooltip 显示已分配点数与药剂层贡献（buildCharacter 注入的 potionStats/allocatedStats）', async () => {
    const pinia = createStubPinia();
    const characterStore = useCharacterStore();
    characterStore.$patch((state) => {
      state.character = buildCharacter();
      // buildCharacter 中 potionStats.str=1, allocatedStats.str=2
    });
    const wrapper = mount(CharacterInfoPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });

    // hover str 属性项
    const attrItems = wrapper.findAll('.core-attr-item');
    await attrItems[0].trigger('mouseenter');

    const rows = wrapper.findAll('.breakdown-row');
    // 药剂层（str=1）
    const potionRow = rows.find(r => r.classes().includes('layer-potion'));
    expect(potionRow).toBeDefined();
    expect(potionRow!.find('.breakdown-value').text()).toBe('+1');
    // 升级层（str=2）
    const allocatedRow = rows.find(r => r.classes().includes('layer-allocated'));
    expect(allocatedRow).toBeDefined();
    expect(allocatedRow!.find('.breakdown-value').text()).toBe('+2');
    // 基础层（=10）
    const baseRow = rows.find(r => r.classes().includes('layer-base'));
    expect(baseRow).toBeDefined();
    expect(baseRow!.find('.breakdown-value').text()).toBe('+10');
  });

  it('零值层显示 — 占位符，便于区分空贡献', async () => {
    const pinia = createStubPinia();
    const characterStore = useCharacterStore();
    characterStore.$patch((state) => {
      state.character = buildCharacter();
      // 不设置 raceBonus/classBonus，种族/职业层为 0
    });
    const wrapper = mount(CharacterInfoPopup, {
      props: { visible: true },
      global: { plugins: [pinia] },
    });

    const attrItem = wrapper.find('.core-attr-item');
    await attrItem.trigger('mouseenter');

    const raceRow = wrapper.findAll('.breakdown-row').find(r => r.classes().includes('layer-race'));
    expect(raceRow).toBeDefined();
    // raceBonus 未设置，值为 0，显示 —
    expect(raceRow!.find('.breakdown-value').text()).toBe('—');
    // 零值层有 .zero class 标识
    expect(raceRow!.classes()).toContain('zero');
  });
});
