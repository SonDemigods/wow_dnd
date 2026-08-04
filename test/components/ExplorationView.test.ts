/**
 * @fileoverview ExplorationView 探索视图组件单元测试
 *
 * 覆盖 ExplorationView.vue 的：
 * 1. 渲染骨架：.exploration-view 根元素、未选区域提示、网格容器、底部进度
 * 2. onMounted：currentCharacterId 存在时调用 explorationStore.init；有 currentLocation 且区域不匹配时调用 enterArea
 * 3. $patch 预设 grid 数据后断言单元格渲染（revealed/accessible/hidden class、探索进度百分比）
 * 4. 单元格点击（mousedown + mouseup 未拖动）触发 explorationStore.revealGrid
 * 5. 已 completed 单元格不触发 revealGrid；拖动超过阈值后释放不触发 revealGrid
 *
 * 遵循 code_rule：
 *  - shallowMount + createStubPinia 隔离子组件与 store 副作用。
 *  - 不断言计算后 CSS 样式值，仅断言 class、文本、dataset、action 调用。
 *  - mock @iconify/vue 避免 BaseIcon 真实加载图标。
 *  - eventBus 真实实现，beforeEach 中 clearAll。
 *  - ExplorationView 无 defineEmits/defineProps/onUnmounted，跳过相关用例。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { shallowMount, flushPromises } from '@vue/test-utils';
import ExplorationView from '@/components/ExplorationView.vue';
import { useExplorationStore } from '@/modules/exploration';
import { useGameStore } from '@/modules/game';
import { useMapStore } from '@/modules/map';
import { eventBus } from '@/modules/bus';
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

/** 构造测试用地点数据（满足 LocationData 结构） */
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

/** 构造测试用探索单元格 */
function makeCell(overrides: Partial<{
  x: number; y: number; type: any; explored: boolean; accessible: boolean; visited: boolean; completed?: boolean; monsterId?: string;
}>) {
  return {
    x: 0,
    y: 0,
    type: 'empty',
    explored: false,
    accessible: false,
    visited: false,
    ...overrides,
  };
}

describe('ExplorationView 探索视图组件', () => {
  let pinia: ReturnType<typeof createStubPinia>;

  beforeEach(() => {
    pinia = createStubPinia();
    eventBus.clearAll();
  });

  describe('渲染骨架', () => {
    it('渲染 .exploration-view 根元素', () => {
      const wrapper = shallowMount(ExplorationView, { global: { plugins: [pinia] } });
      expect(wrapper.find('.exploration-view').exists()).toBe(true);
    });

    it('未选择区域时渲染 .no-location-hint 与提示文本', () => {
      const wrapper = shallowMount(ExplorationView, { global: { plugins: [pinia] } });
      expect(wrapper.find('.no-location-hint').exists()).toBe(true);
      expect(wrapper.find('.hint-text').text()).toBe('请先在地图上选择一个区域');
    });

    it('未选择区域时不渲染 .exploration-grid-container', () => {
      const wrapper = shallowMount(ExplorationView, { global: { plugins: [pinia] } });
      expect(wrapper.find('.exploration-grid-container').exists()).toBe(false);
    });

    it('预设 currentLocation 后渲染 .exploration-grid-container 并隐藏提示', async () => {
      const mapStore = useMapStore(pinia);
      mapStore.$patch((state) => {
        state.currentLocation = makeLocation() as any;
      });
      const wrapper = shallowMount(ExplorationView, { global: { plugins: [pinia] } });
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.exploration-grid-container').exists()).toBe(true);
      expect(wrapper.find('.no-location-hint').exists()).toBe(false);
    });

    it('预设 currentLocation 后渲染 .exploration-footer 与进度文本', async () => {
      const mapStore = useMapStore(pinia);
      mapStore.$patch((state) => {
        state.currentLocation = makeLocation() as any;
      });
      const wrapper = shallowMount(ExplorationView, { global: { plugins: [pinia] } });
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.exploration-footer').exists()).toBe(true);
      expect(wrapper.find('.exploration-progress').text()).toContain('探索进度');
    });
  });

  describe('onMounted 初始化', () => {
    it('currentCharacterId 存在时调用 explorationStore.init(characterId)', async () => {
      // P3-116：currentCharacterId 收敛到 GameStore，需通过 GameStore.$patch 修改数据源
      useGameStore(pinia).$patch((state) => {
        state.currentCharacterId = 'char-1';
      });
      const explorationStore = useExplorationStore(pinia);
      shallowMount(ExplorationView, { global: { plugins: [pinia] } });
      await flushPromises();
      expect(explorationStore.init).toHaveBeenCalledWith('char-1');
    });

    it('无 currentCharacterId 时不调用 explorationStore.init', async () => {
      const explorationStore = useExplorationStore(pinia);
      shallowMount(ExplorationView, { global: { plugins: [pinia] } });
      await flushPromises();
      expect(explorationStore.init).not.toHaveBeenCalled();
    });

    it('有 currentLocation 且 currentAreaId 不匹配时调用 enterArea(areaId)', async () => {
      const mapStore = useMapStore(pinia);
      mapStore.$patch((state) => {
        state.currentLocation = makeLocation('zone-7', '北郡') as any;
      });
      const explorationStore = useExplorationStore(pinia);
      shallowMount(ExplorationView, { global: { plugins: [pinia] } });
      await flushPromises();
      expect(explorationStore.enterArea).toHaveBeenCalledWith('zone-7');
    });

    it('currentAreaId 与目标区域一致时不调用 enterArea', async () => {
      const mapStore = useMapStore(pinia);
      mapStore.$patch((state) => {
        state.currentLocation = makeLocation('zone-7') as any;
      });
      const explorationStore = useExplorationStore(pinia);
      explorationStore.$patch((state) => {
        state.currentAreaId = 'zone-7';
      });
      shallowMount(ExplorationView, { global: { plugins: [pinia] } });
      await flushPromises();
      expect(explorationStore.enterArea).not.toHaveBeenCalled();
    });

    it('无 currentLocation 时不调用 enterArea', async () => {
      const explorationStore = useExplorationStore(pinia);
      shallowMount(ExplorationView, { global: { plugins: [pinia] } });
      await flushPromises();
      expect(explorationStore.enterArea).not.toHaveBeenCalled();
    });
  });

  describe('网格单元格渲染', () => {
    /** 预设 1×4 网格：empty已探索 / monster已探索未完成 / accessible未探索 / hidden未探索 */
    function setupGrid() {
      const mapStore = useMapStore(pinia);
      mapStore.$patch((state) => {
        state.currentLocation = makeLocation() as any;
      });
      const explorationStore = useExplorationStore(pinia);
      explorationStore.$patch((state) => {
        state.grid = [
          [
            makeCell({ x: 0, y: 0, type: 'empty', explored: true, accessible: false, visited: true }),
            makeCell({ x: 1, y: 0, type: 'monster', explored: true, accessible: false, visited: true, monsterId: 'goblin' }),
            makeCell({ x: 2, y: 0, type: 'empty', explored: false, accessible: true, visited: false }),
            makeCell({ x: 3, y: 0, type: 'empty', explored: false, accessible: false, visited: false }),
          ],
        ];
      });
      return explorationStore;
    }

    it('预设 grid 后渲染对应数量的 .cell', async () => {
      setupGrid();
      const wrapper = shallowMount(ExplorationView, { global: { plugins: [pinia] } });
      await wrapper.vm.$nextTick();
      expect(wrapper.findAll('.cell')).toHaveLength(4);
    });

    it('已探索的 empty 格子含 revealed class、不含 empty type class', async () => {
      setupGrid();
      const wrapper = shallowMount(ExplorationView, { global: { plugins: [pinia] } });
      await wrapper.vm.$nextTick();
      const cell = wrapper.find('[data-x="0"][data-y="0"]');
      expect(cell.classes()).toContain('revealed');
      expect(cell.classes()).not.toContain('empty');
    });

    it('已探索未完成的非 empty 格子含 revealed 与 type class', async () => {
      setupGrid();
      const wrapper = shallowMount(ExplorationView, { global: { plugins: [pinia] } });
      await wrapper.vm.$nextTick();
      const cell = wrapper.find('[data-x="1"][data-y="0"]');
      expect(cell.classes()).toContain('revealed');
      expect(cell.classes()).toContain('monster');
    });

    it('未探索可访问格子含 accessible class', async () => {
      setupGrid();
      const wrapper = shallowMount(ExplorationView, { global: { plugins: [pinia] } });
      await wrapper.vm.$nextTick();
      const cell = wrapper.find('[data-x="2"][data-y="0"]');
      expect(cell.classes()).toContain('accessible');
    });

    it('未探索不可访问格子含 hidden class', async () => {
      setupGrid();
      const wrapper = shallowMount(ExplorationView, { global: { plugins: [pinia] } });
      await wrapper.vm.$nextTick();
      const cell = wrapper.find('[data-x="3"][data-y="0"]');
      expect(cell.classes()).toContain('hidden');
    });

    it('explorationProgress 显示已探索百分比', async () => {
      const mapStore = useMapStore(pinia);
      mapStore.$patch((state) => {
        state.currentLocation = makeLocation() as any;
      });
      const explorationStore = useExplorationStore(pinia);
      explorationStore.$patch((state) => {
        state.grid = [
          [
            makeCell({ x: 0, y: 0, explored: true }),
            makeCell({ x: 1, y: 0, explored: true }),
          ],
          [
            makeCell({ x: 0, y: 1, explored: false, accessible: true }),
            makeCell({ x: 1, y: 1, explored: false }),
          ],
        ];
      });
      const wrapper = shallowMount(ExplorationView, { global: { plugins: [pinia] } });
      await wrapper.vm.$nextTick();
      // 2/4 = 50%
      expect(wrapper.find('.exploration-progress').text()).toContain('50');
    });
  });

  describe('单元格点击交互', () => {
    it('点击 accessible 单元格触发 explorationStore.movePlayer(x, y)', async () => {
      const mapStore = useMapStore(pinia);
      mapStore.$patch((state) => {
        state.currentLocation = makeLocation() as any;
      });
      const explorationStore = useExplorationStore(pinia);
      explorationStore.$patch((state) => {
        state.grid = [
          [
            makeCell({ x: 0, y: 0, type: 'empty', explored: true, accessible: false, visited: true }),
            makeCell({ x: 1, y: 0, type: 'monster', explored: false, accessible: true, visited: false, monsterId: 'goblin' }),
          ],
        ];
      });
      const wrapper = shallowMount(ExplorationView, { global: { plugins: [pinia] } });
      await wrapper.vm.$nextTick();

      const cell = wrapper.find('[data-x="1"][data-y="0"]');
      await cell.trigger('mousedown', { clientX: 100, clientY: 100 });
      await cell.trigger('mouseup');

      // 阶段二：handleCellClick 改调 movePlayer（移动式交互），不再直接调 revealGrid
      expect(explorationStore.movePlayer).toHaveBeenCalledWith(1, 0);
    });

    it('点击已 completed 单元格经 movePlayer 处理（不直接调 revealGrid）', async () => {
      const mapStore = useMapStore(pinia);
      mapStore.$patch((state) => {
        state.currentLocation = makeLocation() as any;
      });
      const explorationStore = useExplorationStore(pinia);
      explorationStore.$patch((state) => {
        state.grid = [
          [
            makeCell({
              x: 0, y: 0, type: 'monster',
              explored: true, accessible: false, visited: true,
              completed: true, monsterId: 'goblin',
            }),
          ],
        ];
      });
      const wrapper = shallowMount(ExplorationView, { global: { plugins: [pinia] } });
      await wrapper.vm.$nextTick();

      const cell = wrapper.find('[data-x="0"][data-y="0"]');
      await cell.trigger('mousedown', { clientX: 100, clientY: 100 });
      await cell.trigger('mouseup');

      // 阶段二：点击统一走 movePlayer 入口；completed 拒绝逻辑由 movePlayer 内部处理
      expect(explorationStore.movePlayer).toHaveBeenCalledWith(0, 0);
      expect(explorationStore.revealGrid).not.toHaveBeenCalled();
    });

    it('拖动超过阈值后释放不触发 movePlayer', async () => {
      vi.useFakeTimers();
      const mapStore = useMapStore(pinia);
      mapStore.$patch((state) => {
        state.currentLocation = makeLocation() as any;
      });
      const explorationStore = useExplorationStore(pinia);
      explorationStore.$patch((state) => {
        state.grid = [
          [
            makeCell({ x: 0, y: 0, type: 'monster', explored: false, accessible: true, visited: false, monsterId: 'goblin' }),
          ],
        ];
      });
      const wrapper = shallowMount(ExplorationView, { global: { plugins: [pinia] } });
      await wrapper.vm.$nextTick();

      const cell = wrapper.find('[data-x="0"][data-y="0"]');
      const container = wrapper.find('.exploration-grid-container');
      await cell.trigger('mousedown', { clientX: 100, clientY: 100 });
      // 移动 30px 超过 DRAG_THRESHOLD(5)，标记为拖动
      await container.trigger('mousemove', { clientX: 130, clientY: 100 });
      // 刷新 rAF 回调，使 hasDragged 被正确设置
      vi.runAllTimers();
      await container.trigger('mouseup');

      // 阶段二：拖动不触发 movePlayer（移动入口）
      expect(explorationStore.movePlayer).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});
