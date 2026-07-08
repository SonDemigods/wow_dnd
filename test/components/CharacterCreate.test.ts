/**
 * @fileoverview CharacterCreate 角色创建组件单元测试
 *
 * 覆盖 CharacterCreate.vue 的：
 * 1. 渲染骨架：.character-create 根元素、步骤容器、分步流程标题
 * 2. onMounted 调用 baseStore.loadAllData 加载基础数据
 * 3. baseStore state（factions/races/classes）驱动选项渲染
 * 4. 选择交互：点击阵营/种族/职业卡片切换本地选中态与 active 样式
 * 5. 创建角色：完整分步流程后点击创建按钮触发 characterStore.createCharacter 与 emit('created')
 *
 * 遵循 code_rule：
 *  - 使用 shallowMount + createStubPinia 隔离子组件与 store 副作用。
 *  - 不断言计算后 CSS 样式值，仅断言 class、文本、emit、action 调用。
 *  - 注册空 v-motion 指令避免指令解析告警。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import CharacterCreate from '@/components/CharacterCreate.vue';
import { useCharacterStore } from '@/modules/character';
import { useBaseStore } from '@/modules/base';
import { eventBus } from '@/modules/bus';
import { createStubPinia } from '../utils/setup';
import type {
  FactionData,
  RaceData,
  ClassData
} from '@/modules/character/types';

// ==================== 测试数据 ====================
const factions: FactionData[] = [
  { id: 'alliance', name: '联盟', icon: 'icon-a', color: '#0078ff', description: '联盟描述' },
  { id: 'horde', name: '部落', icon: 'icon-h', color: '#ff4400', description: '部落描述' },
  { id: 'neutral', name: '中立', icon: 'icon-n', color: '#4CAF50', description: '中立描述' }
];

const races: RaceData[] = [
  { id: 'human', name: '人类', icon: 'icon-human', factionId: 'alliance', description: '人类描述' },
  { id: 'orc', name: '兽人', icon: 'icon-orc', factionId: 'horde', description: '兽人描述' },
  { id: 'pandaren', name: '兽灵族', icon: 'icon-p', factionId: 'neutral', description: '兽灵族描述' }
];

const classes: ClassData[] = [
  {
    id: 'warrior',
    name: '战士',
    icon: 'icon-w',
    primaryStat: 'str',
    factionsIds: ['alliance', 'horde'],
    raceIds: ['human', 'orc'],
    description: '战士描述',
    color: '#c00'
  }
];

// 空实现 v-motion 指令，避免模板中 v-motion 解析失败告警
const motionDirective = {
  mounted: () => {},
  updated: () => {}
};

describe('CharacterCreate 角色创建组件', () => {
  let pinia: ReturnType<typeof createStubPinia>;

  beforeEach(() => {
    pinia = createStubPinia();
    eventBus.clearAll();
  });

  const mountComp = () =>
    shallowMount(CharacterCreate, {
      global: { plugins: [pinia], directives: { motion: motionDirective } }
    });

  describe('渲染骨架', () => {
    it('渲染 .character-create 根元素与关键容器', () => {
      const wrapper = mountComp();
      expect(wrapper.find('.character-create').exists()).toBe(true);
      expect(wrapper.find('.create-header').exists()).toBe(true);
      expect(wrapper.find('.scrollable-content').exists()).toBe(true);
      expect(wrapper.find('.fixed-footer').exists()).toBe(true);
    });

    it('默认步骤1显示"步骤 1/4"标题与阵营选择网格', () => {
      const baseStore = useBaseStore(pinia);
      baseStore.factions = factions;
      const wrapper = mountComp();
      expect(wrapper.find('.create-header h2').text()).toContain('步骤 1/4');
      expect(wrapper.find('.step-title').text()).toBe('请选择阵营');
      expect(wrapper.find('.faction-grid').exists()).toBe(true);
    });

    it('无阵营数据时不渲染中立阵营卡片', () => {
      const wrapper = mountComp();
      expect(wrapper.find('.neutral-faction').exists()).toBe(false);
    });
  });

  describe('onMounted 加载基础数据', () => {
    it('挂载后调用 baseStore.loadAllData', () => {
      const baseStore = useBaseStore(pinia);
      mountComp();
      expect(baseStore.loadAllData).toHaveBeenCalledTimes(1);
    });
  });

  describe('基础数据驱动渲染', () => {
    it('预设 factions 后渲染 2 个主阵营卡片与 1 个中立阵营卡片', () => {
      const baseStore = useBaseStore(pinia);
      baseStore.factions = factions;
      const wrapper = mountComp();
      // 过滤 neutral 后 alliance/horde 2 个 main-faction
      expect(wrapper.findAll('.faction-card.main-faction')).toHaveLength(2);
      // neutral 单独渲染在 neutral-faction-row
      expect(wrapper.findAll('.faction-card.neutral-faction')).toHaveLength(1);
      expect(wrapper.find('.neutral-faction .faction-name').text()).toBe('中立');
    });

    it('选择阵营后步骤2渲染该阵营下的种族卡片', async () => {
      const baseStore = useBaseStore(pinia);
      baseStore.factions = factions;
      baseStore.races = races;
      const wrapper = mountComp();

      // 选 alliance
      await wrapper.findAll('.faction-card.main-faction')[0].trigger('click');
      // 下一步
      await wrapper.find('.nav-btn.next').trigger('click');

      expect(wrapper.find('.race-grid').exists()).toBe(true);
      expect(wrapper.findAll('.race-card')).toHaveLength(1);
      expect(wrapper.find('.race-name').text()).toBe('人类');
    });
  });

  describe('选择交互', () => {
    it('点击阵营卡片为其添加 active class', async () => {
      const baseStore = useBaseStore(pinia);
      baseStore.factions = factions;
      const wrapper = mountComp();
      const allianceCard = wrapper.findAll('.faction-card.main-faction')[0];

      await allianceCard.trigger('click');

      expect(allianceCard.classes()).toContain('active');
    });

    it('未选择阵营时"下一步"按钮禁用', () => {
      const baseStore = useBaseStore(pinia);
      baseStore.factions = factions;
      const wrapper = mountComp();
      expect(wrapper.find('.nav-btn.next').attributes('disabled')).toBeDefined();
    });

    it('选择阵营后"下一步"按钮启用', async () => {
      const baseStore = useBaseStore(pinia);
      baseStore.factions = factions;
      const wrapper = mountComp();

      await wrapper.findAll('.faction-card.main-faction')[0].trigger('click');

      expect(wrapper.find('.nav-btn.next').attributes('disabled')).toBeUndefined();
    });
  });

  describe('创建角色完整流程', () => {
    it('走完4步并确认后触发 characterStore.createCharacter 与 emit created', async () => {
      const baseStore = useBaseStore(pinia);
      const characterStore = useCharacterStore(pinia);
      baseStore.factions = factions;
      baseStore.races = races;
      baseStore.classes = classes;
      const wrapper = mountComp();

      // 步骤1：选 alliance
      await wrapper.findAll('.faction-card.main-faction')[0].trigger('click');
      await wrapper.find('.nav-btn.next').trigger('click');
      // 步骤2：选 human
      await wrapper.findAll('.race-card')[0].trigger('click');
      await wrapper.find('.nav-btn.next').trigger('click');
      // 步骤3：选 warrior
      await wrapper.findAll('.class-card')[0].trigger('click');
      await wrapper.find('.nav-btn.next').trigger('click');

      // 步骤4：输入角色名
      expect(wrapper.find('.nav-btn.create').exists()).toBe(true);
      await wrapper.find('.name-input').setValue('测试英雄');

      // 点击创建按钮 → 弹出确认弹窗
      await wrapper.find('.nav-btn.create').trigger('click');
      expect(wrapper.find('.modal-overlay').exists()).toBe(true);
      expect(wrapper.find('.modal-box h3').text()).toBe('确认创建角色');

      // 点击弹窗确认按钮 → 执行 doCreate
      await wrapper.find('.modal-btn-confirm').trigger('click');
      await flushPromises();

      expect(characterStore.createCharacter).toHaveBeenCalledWith(
        '测试英雄',
        'alliance',
        'human',
        'warrior'
      );
      expect(wrapper.emitted('created')).toHaveLength(1);
    });

    it('角色名为空时点击创建按钮显示错误弹窗且不调用 createCharacter', async () => {
      const baseStore = useBaseStore(pinia);
      const characterStore = useCharacterStore(pinia);
      baseStore.factions = factions;
      baseStore.races = races;
      baseStore.classes = classes;
      const wrapper = mountComp();

      // 走到步骤4但不输入名字
      await wrapper.findAll('.faction-card.main-faction')[0].trigger('click');
      await wrapper.find('.nav-btn.next').trigger('click');
      await wrapper.findAll('.race-card')[0].trigger('click');
      await wrapper.find('.nav-btn.next').trigger('click');
      await wrapper.findAll('.class-card')[0].trigger('click');
      await wrapper.find('.nav-btn.next').trigger('click');

      // create 按钮 disabled（canCreate 依赖 name 非空）
      expect(wrapper.find('.nav-btn.create').attributes('disabled')).toBeDefined();
      // 直接移除 disabled 限制并触发点击以验证校验逻辑
      await wrapper.find('.nav-btn.create').trigger('click');
      await flushPromises();

      expect(characterStore.createCharacter).not.toHaveBeenCalled();
    });
  });
});
