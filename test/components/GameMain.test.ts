/**
 * @fileoverview GameMain 游戏主界面组件单元测试
 *
 * 覆盖 GameMain.vue 的：
 * 1. 渲染骨架：.game-main 根元素、header/content/footer 三大区、6 个底部导航按钮、地图/探索标签页
 * 2. onMounted：注册探索 UI 回调、currentCharacterId 存在时调用 gameBootstrap.initialize 与 mapStore.getCurrentTab、CHARACTER_LEVEL_UP 监听
 * 3. onUnmounted：调用 gameBootstrap.dispose 清理
 * 4. $patch 预设 character/currentLocation 后断言玩家信息与区域信息渲染
 * 5. 关键交互：标签页切换、底部按钮打开弹窗、MapView emit enter-zone 切换视图、SystemPopup emit exit 透传
 *
 * 遵循 code_rule：
 *  - shallowMount + createStubPinia 隔离子组件与 store 副作用。
 *  - mock @/services/GameBootstrap 避免真实初始化连锁调用其他 Store。
 *  - mock @iconify/vue 避免 BaseIcon 真实加载图标。
 *  - eventBus 真实实现，beforeEach 中 clearAll；vi.clearAllMocks 重置 mock 调用记录。
 *  - 不断言计算后 CSS 样式值，仅断言 class、文本、props、emit、action 调用。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { shallowMount, flushPromises } from '@vue/test-utils';
import GameMain from '@/components/GameMain.vue';
import MapView from '@/components/MapView.vue';
import ExplorationView from '@/components/ExplorationView.vue';
import CharacterInfoPopup from '@/components/popup/CharacterInfoPopup.vue';
import SystemPopup from '@/components/popup/SystemPopup.vue';
import { useCharacterStore } from '@/modules/character';
import { useMapStore } from '@/modules/map';
import { useExplorationStore } from '@/modules/exploration';
import { eventBus, GameEvents } from '@/modules/bus';
import { gameBootstrap } from '@/services/GameBootstrap';
import { createStubPinia } from '../utils/setup';

vi.mock('@iconify/vue', () => ({
  Icon: defineComponent({
    name: 'MockIcon',
    props: ['icon', 'width', 'height', 'color'],
    setup(p) {
      return () => h('span', { class: 'mock-icon', 'data-icon': p.icon });
    },
  }),
  loadIcon: vi.fn().mockResolvedValue({ body: '<path d="M0 0h512v512H0z"/>' }),
}));

vi.mock('@/services/GameBootstrap', () => ({
  gameBootstrap: {
    initialize: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
  },
}));

// mock Tone.js 依赖的 audio service 模块，避免 jsdom 下 new Tone.Filter() 报错
// （GameMain 间接通过 AudioSettingsPopup → useAudioStore → audioService 引入）
vi.mock('@/modules/audio/service', () => ({
  audioService: {},
}));

/** 构造测试用地点数据 */
function makeLocation(id = 'area1', name = '艾尔文森林') {
  return {
    id,
    name,
    icon: 'treasure-map',
    description: '',
    continent: 'c1',
    enemies: [],
    bosses: [],
    quests: [],
    levelRange: [1, 5] as [number, number],
    color: '#fff',
    mapX: 0,
    mapY: 0,
    type: 'location' as const,
  };
}

describe('GameMain 游戏主界面组件', () => {
  let pinia: ReturnType<typeof createStubPinia>;

  beforeEach(() => {
    pinia = createStubPinia();
    eventBus.clearAll();
    vi.clearAllMocks();
  });

  describe('渲染骨架', () => {
    it('渲染 .game-main 根元素及 header/content/footer 三大区域', async () => {
      const wrapper = shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      expect(wrapper.find('.game-main').exists()).toBe(true);
      expect(wrapper.find('.game-header').exists()).toBe(true);
      expect(wrapper.find('.game-content').exists()).toBe(true);
      expect(wrapper.find('.game-footer').exists()).toBe(true);
    });

    it('底部渲染 6 个 .footer-btn 导航按钮', async () => {
      const wrapper = shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      expect(wrapper.findAll('.footer-btn')).toHaveLength(6);
    });

    it('底部按钮文本含角色/背包/技能/任务/日志/系统', async () => {
      const wrapper = shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      const texts = wrapper.findAll('.footer-btn').map(b => b.text());
      expect(texts.some(t => t.includes('角色'))).toBe(true);
      expect(texts.some(t => t.includes('背包'))).toBe(true);
      expect(texts.some(t => t.includes('技能'))).toBe(true);
      expect(texts.some(t => t.includes('任务'))).toBe(true);
      expect(texts.some(t => t.includes('日志'))).toBe(true);
      expect(texts.some(t => t.includes('系统'))).toBe(true);
    });

    it('渲染 .content-tabs 含"地图"与"探索"两个标签', async () => {
      const wrapper = shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      const tabs = wrapper.findAll('.content-tab');
      expect(tabs).toHaveLength(2);
      expect(tabs[0].text()).toContain('地图');
      expect(tabs[1].text()).toContain('探索');
    });

    it('默认渲染 MapView 而非 ExplorationView', async () => {
      const wrapper = shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      expect(wrapper.findComponent(MapView).exists()).toBe(true);
      expect(wrapper.findComponent(ExplorationView).exists()).toBe(false);
    });
  });

  describe('onMounted 初始化', () => {
    it('挂载后调用 explorationStore.registerUICallbacks', async () => {
      const explorationStore = useExplorationStore(pinia);
      shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      expect(explorationStore.registerUICallbacks).toHaveBeenCalledTimes(1);
    });

    it('currentCharacterId 存在时调用 gameBootstrap.initialize(cid)', async () => {
      const characterStore = useCharacterStore(pinia);
      characterStore.$patch((state) => {
        state.currentCharacterId = 'char-1';
      });
      shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      expect(gameBootstrap.initialize).toHaveBeenCalledWith('char-1');
    });

    it('无 currentCharacterId 时不调用 gameBootstrap.initialize', async () => {
      shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      expect(gameBootstrap.initialize).not.toHaveBeenCalled();
    });

    it('currentCharacterId 存在时调用 mapStore.getCurrentTab', async () => {
      const characterStore = useCharacterStore(pinia);
      characterStore.$patch((state) => {
        state.currentCharacterId = 'char-1';
      });
      const mapStore = useMapStore(pinia);
      shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      expect(mapStore.getCurrentTab).toHaveBeenCalled();
    });

    it('CHARACTER_LEVEL_UP 事件触发后 .player-level 含 level-up class', async () => {
      const wrapper = shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      eventBus.emit(GameEvents.CHARACTER_LEVEL_UP, { oldLevel: 1, newLevel: 2 });
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.player-level').classes()).toContain('level-up');
    });
  });

  describe('onUnmounted 清理', () => {
    it('卸载后调用 gameBootstrap.dispose', async () => {
      const wrapper = shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      wrapper.unmount();
      expect(gameBootstrap.dispose).toHaveBeenCalledTimes(1);
    });
  });

  describe('$patch 预设状态后断言渲染', () => {
    it('预设 character 后 .player-name 显示角色名', async () => {
      const characterStore = useCharacterStore(pinia);
      characterStore.$patch((state) => {
        state.character = {
          name: '亚瑟', level: 5, hp: 100, maxHp: 100,
          mana: 50, maxMana: 50, exp: 0, expToNextLevel: 100, gold: 200,
        } as any;
      });
      const wrapper = shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      expect(wrapper.find('.player-name').text()).toBe('亚瑟');
    });

    it('预设 character 后 .player-level 显示 Lv.级别', async () => {
      const characterStore = useCharacterStore(pinia);
      characterStore.$patch((state) => {
        state.character = {
          name: '亚瑟', level: 5, hp: 100, maxHp: 100,
          mana: 50, maxMana: 50, exp: 0, expToNextLevel: 100, gold: 200,
        } as any;
      });
      const wrapper = shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      expect(wrapper.find('.player-level').text()).toContain('Lv.5');
    });

    it('预设 currentLocation 后 .area-info 显示区域名', async () => {
      const mapStore = useMapStore(pinia);
      mapStore.$patch((state) => {
        state.currentLocation = makeLocation('area1', '艾尔文森林') as any;
      });
      const wrapper = shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      expect(wrapper.find('.area-info').text()).toContain('艾尔文森林');
    });

    it('未预设 currentLocation 时 .area-info 显示"未知区域"', async () => {
      const wrapper = shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      expect(wrapper.find('.area-info').text()).toContain('未知区域');
    });
  });

  describe('标签页与导航交互', () => {
    it('点击"地图"标签调用 mapStore.saveCurrentTab("map")', async () => {
      const mapStore = useMapStore(pinia);
      const wrapper = shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      const mapTab = wrapper.findAll('.content-tab').find(t => t.text().includes('地图'));
      await mapTab!.trigger('click');
      expect(mapStore.saveCurrentTab).toHaveBeenCalledWith('map');
    });

    it('点击"地图"标签 emit UI_CLICK({source:"tab_map"})', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.UI_CLICK, spy);
      const wrapper = shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      const mapTab = wrapper.findAll('.content-tab').find(t => t.text().includes('地图'));
      await mapTab!.trigger('click');
      expect(spy).toHaveBeenCalledWith({ source: 'tab_map' });
    });

    it('无 currentLocation 时点击"探索"标签不调用 saveCurrentTab', async () => {
      const mapStore = useMapStore(pinia);
      const wrapper = shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      const exploreTab = wrapper.findAll('.content-tab').find(t => t.text().includes('探索'));
      await exploreTab!.trigger('click');
      expect(mapStore.saveCurrentTab).not.toHaveBeenCalled();
    });

    it('有 currentLocation 时点击"探索"标签调用 saveCurrentTab("explore")', async () => {
      const mapStore = useMapStore(pinia);
      mapStore.$patch((state) => {
        state.currentLocation = makeLocation() as any;
      });
      const wrapper = shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      const exploreTab = wrapper.findAll('.content-tab').find(t => t.text().includes('探索'));
      await exploreTab!.trigger('click');
      expect(mapStore.saveCurrentTab).toHaveBeenCalledWith('explore');
    });

    it('点击"角色"底部按钮后 CharacterInfoPopup visible 变为 true', async () => {
      const wrapper = shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      const charBtn = wrapper.findAll('.footer-btn').find(b => b.text().includes('角色'));
      await charBtn!.trigger('click');
      expect(wrapper.findComponent(CharacterInfoPopup).props('visible')).toBe(true);
    });

    it('点击"角色"按钮 emit UI_CLICK({source:"nav_character_info"})', async () => {
      const spy = vi.fn();
      eventBus.on(GameEvents.UI_CLICK, spy);
      const wrapper = shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      const charBtn = wrapper.findAll('.footer-btn').find(b => b.text().includes('角色'));
      await charBtn!.trigger('click');
      expect(spy).toHaveBeenCalledWith({ source: 'nav_character_info' });
    });
  });

  describe('子组件 emit 透传', () => {
    it('MapView emit enter-zone 后切换到 ExplorationView', async () => {
      const wrapper = shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      const mapView = wrapper.findComponent(MapView);
      expect(mapView.exists()).toBe(true);
      mapView.vm.$emit('enter-zone');
      await wrapper.vm.$nextTick();
      expect(wrapper.findComponent(ExplorationView).exists()).toBe(true);
      expect(wrapper.findComponent(MapView).exists()).toBe(false);
    });

    it('SystemPopup emit exit 时组件透传 exit 事件', async () => {
      const wrapper = shallowMount(GameMain, { global: { plugins: [pinia] } });
      await flushPromises();
      const systemPopup = wrapper.findComponent(SystemPopup);
      systemPopup.vm.$emit('exit');
      await wrapper.vm.$nextTick();
      expect(wrapper.emitted('exit')).toHaveLength(1);
    });
  });
});
