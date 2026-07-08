/**
 * @fileoverview CombatPopup 战斗弹窗组件单元测试
 *
 * 覆盖 CombatPopup.vue 的：
 * 1. 渲染骨架：.combat-overlay 与 .combat-title（遭遇战斗！）
 * 2. $patch combatStore.state='fighting', turnCount=1 后渲染 .combat-turn "第 1 回合"
 * 3. 点击 .attack-btn 触发 combatStore.playerAction({type:"attack"})
 * 4. 点击 .skip-btn 触发 combatStore.skipTurn
 * 5. 点击 .speed-toggle 触发 combatStore.toggleCombatSpeed
 * 6. combatResult="victory" 时点击 .result-close-btn 触发 close 事件并携带结果
 *
 * 遵循 code_rule：
 *  - 不断言计算后 CSS 样式值（红线），仅断言 class、文本、emit 与 stub 调用。
 *  - 使用 mount + createStubPinia 真实渲染。
 *  - mock @iconify/vue 与 @/modules/animation 避免真实网络/DOM 动画。
 *  - mock @/composables/useSkillDisplay 避免依赖扩散。
 *  - eventBus 使用真实实现，通过 eventBus.on 注册 spy 监听断言。
 *  - 通过 store.$patch 预设 state / character 测试渲染与交互分支。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import CombatPopup from '@/components/popup/CombatPopup.vue';
import { useCombatStore } from '@/modules/combat/store';
import { useCharacterStore } from '@/modules/character';
import { eventBus, GameEvents } from '@/modules/bus';
import { createStubPinia } from '../../utils/setup';
import type { Character } from '@/modules/character/types';

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

// mock 动画模块：anime.js 依赖真实 DOM API，在 jsdom 中可能报错，全部空操作
vi.mock('@/modules/animation', () => ({
  animateShake: vi.fn(),
  animateCritShake: vi.fn(),
  animateDodgeBlink: vi.fn(),
  animateFloating: vi.fn(),
  animateScreenFlash: vi.fn(),
  animateVsFlash: vi.fn(),
  animateBossIntro: vi.fn(),
  animatePhaseTransition: vi.fn(),
  animateResultPopup: vi.fn(),
  animateMagicPulse: vi.fn(),
  animateHealGlow: vi.fn(),
  animateManaGlow: vi.fn(),
  animateCritBorderFlash: vi.fn(),
  createParticleBurst: vi.fn(),
}));

// mock 技能展示 composable，避免依赖扩散
vi.mock('@/composables/useSkillDisplay', () => ({
  useSkillDisplay: () => ({
    getSkillEffectBrief: () => '伤害',
    getTargetTypeName: () => '单体',
  }),
}));

describe('CombatPopup 战斗弹窗组件', () => {
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

  /** 预设 character + combatStore 为玩家可行动状态 */
  function setupFightState() {
    const characterStore = useCharacterStore();
    const combatStore = useCombatStore();
    characterStore.$patch((state) => {
      state.character = buildCharacter();
    });
    combatStore.$patch((state) => {
      state.state = 'fighting';
      state.turn = 'player';
      state.turnCount = 1;
      state.combatResult = null;
    });
    return { characterStore, combatStore };
  }

  it('渲染 .combat-overlay 与 .combat-title（遭遇战斗！）', () => {
    const pinia = createStubPinia();
    const characterStore = useCharacterStore();
    characterStore.$patch((state) => {
      state.character = buildCharacter();
    });
    const wrapper = mount(CombatPopup, {
      global: { plugins: [pinia] },
    });
    expect(wrapper.find('.combat-overlay').exists()).toBe(true);
    expect(wrapper.find('.combat-title').text()).toBe('遭遇战斗！');
  });

  it('$patch combatStore 后渲染 .combat-turn "第 1 回合"', () => {
    const pinia = createStubPinia();
    setupFightState();
    const wrapper = mount(CombatPopup, {
      global: { plugins: [pinia] },
    });
    expect(wrapper.find('.combat-turn').text()).toContain('第 1 回合');
  });

  it('点击 .attack-btn 触发 combatStore.playerAction({type:"attack"})', async () => {
    const pinia = createStubPinia();
    const { combatStore } = setupFightState();
    // stub 默认返回 undefined，mock 为成功结果避免 result.success 抛 TypeError
    vi.mocked(combatStore.playerAction).mockResolvedValue({
      success: true,
      type: 'attack',
      message: '攻击命中',
    });

    const uiClickSpy = vi.fn();
    eventBus.on(GameEvents.UI_CLICK, uiClickSpy);

    const wrapper = mount(CombatPopup, {
      global: { plugins: [pinia] },
    });

    await wrapper.find('.attack-btn').trigger('click');
    await flushPromises();

    expect(combatStore.playerAction).toHaveBeenCalledWith({ type: 'attack' });
    expect(uiClickSpy).toHaveBeenCalledWith({ source: 'combat_attack' });
  });

  it('点击 .skip-btn 触发 combatStore.skipTurn', async () => {
    const pinia = createStubPinia();
    const { combatStore } = setupFightState();

    const uiClickSpy = vi.fn();
    eventBus.on(GameEvents.UI_CLICK, uiClickSpy);

    const wrapper = mount(CombatPopup, {
      global: { plugins: [pinia] },
    });

    await wrapper.find('.skip-btn').trigger('click');

    expect(combatStore.skipTurn).toHaveBeenCalled();
    expect(uiClickSpy).toHaveBeenCalledWith({ source: 'combat_skip' });
  });

  it('点击 .speed-toggle 触发 combatStore.toggleCombatSpeed', async () => {
    const pinia = createStubPinia();
    const { combatStore } = setupFightState();

    const uiClickSpy = vi.fn();
    eventBus.on(GameEvents.UI_CLICK, uiClickSpy);

    const wrapper = mount(CombatPopup, {
      global: { plugins: [pinia] },
    });

    await wrapper.find('.speed-toggle').trigger('click');

    expect(combatStore.toggleCombatSpeed).toHaveBeenCalled();
    expect(uiClickSpy).toHaveBeenCalledWith({ source: 'combat_speed_toggle' });
  });

  it('combatResult="victory" 时点击 .result-close-btn 触发 close 事件并携带结果', async () => {
    const pinia = createStubPinia();
    const characterStore = useCharacterStore();
    const combatStore = useCombatStore();
    characterStore.$patch((state) => {
      state.character = buildCharacter();
    });
    // mount 前 $patch，避免 watch 触发 scheduleAutoClose 设置定时器
    combatStore.$patch((state) => {
      state.state = 'ended';
      state.combatResult = 'victory';
    });

    const wrapper = mount(CombatPopup, {
      global: { plugins: [pinia] },
    });

    expect(wrapper.find('.result-overlay').exists()).toBe(true);
    await wrapper.find('.result-close-btn').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
    expect(wrapper.emitted('close')![0]).toEqual(['victory']);
  });
});
