/**
 * @fileoverview MapView 地图视图组件单元测试
 *
 * 覆盖 MapView.vue 的：
 * 1. 渲染骨架：.map-view 根元素、.map-container、.zoom-controls、.zone-info-panel
 * 2. onMounted 注册 ResizeObserver 监听容器尺寸（源码实际行为，未调用 store action）
 * 3. onUnmounted 调用 resizeObserver.disconnect 清理监听
 * 4. mapStore.initialized + getZones 返回值驱动区域标记渲染
 * 5. 区域点击 selectZone 显示区域信息面板
 * 6. 进入探索流程：选 zone → 点击进入探索 → ConfirmPopup confirm → mapStore.enterZone + emit('enter-zone')
 * 7. 缩放按钮改变本地 zoomLevel 并更新 .zoom-level 文本
 *
 * 遵循 code_rule：
 *  - 使用 shallowMount + createStubPinia 隔离子组件与 store 副作用。
 *  - 不断言计算后 CSS 样式值，仅断言 class、文本、emit、action 调用。
 *  - mock 图片导入与 ResizeObserver（jsdom 缺失）；eventBus 真实 + clearAll。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import MapView from '@/components/MapView.vue';
import ConfirmPopup from '@/components/common/ConfirmPopup.vue';
import { useMapStore } from '@/modules/map';
import { useCharacterStore } from '@/modules/character';
import { eventBus } from '@/modules/bus';
import { createStubPinia } from '../utils/setup';
import type { MapZone } from '@/modules/map';

// mock 图片导入（vitest 不处理静态资产）
vi.mock('@/images/worldBg.jpg', () => ({ default: 'mocked-world-bg' }));

// ==================== 测试数据 ====================
const testZones: MapZone[] = [
  {
    id: 'z1',
    name: '艾尔文森林',
    icon: 'tree',
    description: '一片宁静的森林',
    coordinates: { x: 50, y: 50 },
    requiredLevel: 1,
    status: 'unlocked'
  },
  {
    id: 'z2',
    name: '熔火之心',
    icon: 'fire',
    description: '炽热的熔岩地带',
    coordinates: { x: 70, y: 30 },
    requiredLevel: 10,
    status: 'locked'
  }
];

describe('MapView 地图视图组件', () => {
  let pinia: ReturnType<typeof createStubPinia>;
  let observeMock: ReturnType<typeof vi.fn>;
  let disconnectMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    pinia = createStubPinia();
    eventBus.clearAll();

    observeMock = vi.fn();
    disconnectMock = vi.fn();
    class MockResizeObserver {
      observe = observeMock;
      disconnect = disconnectMock;
      unobserve = vi.fn();
    }
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  });

  const mountComp = () =>
    shallowMount(MapView, { global: { plugins: [pinia] } });

  describe('渲染骨架', () => {
    it('渲染 .map-view 根元素与 .map-container 容器', () => {
      const wrapper = mountComp();
      expect(wrapper.find('.map-view').exists()).toBe(true);
      expect(wrapper.find('.map-container').exists()).toBe(true);
      expect(wrapper.find('.world-map').exists()).toBe(true);
    });

    it('渲染缩放控制 .zoom-controls 与初始 1.0x 缩放文本', () => {
      const wrapper = mountComp();
      expect(wrapper.find('.zoom-controls').exists()).toBe(true);
      expect(wrapper.findAll('.zoom-btn')).toHaveLength(2);
      expect(wrapper.find('.zoom-level').text()).toBe('1.0x');
    });

    it('未选中区域时信息面板显示空提示', () => {
      const wrapper = mountComp();
      expect(wrapper.find('.zone-info-panel').exists()).toBe(true);
      expect(wrapper.find('.panel-name').text()).toBe('区域信息');
      expect(wrapper.find('.panel-empty').exists()).toBe(true);
    });
  });

  describe('onMounted 生命周期', () => {
    it('挂载后通过 ResizeObserver.observe 监听地图容器', () => {
      mountComp();
      expect(observeMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('onUnmounted 清理', () => {
    it('卸载后调用 resizeObserver.disconnect', () => {
      const wrapper = mountComp();
      expect(disconnectMock).not.toHaveBeenCalled();
      wrapper.unmount();
      expect(disconnectMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('区域数据驱动渲染', () => {
    it('mapStore 未初始化时不渲染区域标记', () => {
      const mapStore = useMapStore(pinia);
      mapStore.initialized = false;
      const wrapper = mountComp();
      expect(wrapper.findAll('.zone-marker')).toHaveLength(0);
    });

    it('initialized=true 且 getZones 返回数据后渲染对应数量的区域标记', async () => {
      const mapStore = useMapStore(pinia);
      mapStore.initialized = true;
      mapStore.getZones.mockReturnValue(testZones);
      const wrapper = mountComp();
      await wrapper.vm.$nextTick();

      const markers = wrapper.findAll('.zone-marker');
      expect(markers).toHaveLength(2);
      // 第二个区域 requiredLevel=10 标记为 high-risk
      expect(markers[1].classes()).toContain('high-risk');
    });
  });

  describe('区域选择交互', () => {
    it('点击区域标记后信息面板显示该区域名称', async () => {
      const mapStore = useMapStore(pinia);
      mapStore.initialized = true;
      mapStore.getZones.mockReturnValue(testZones);
      const wrapper = mountComp();
      await wrapper.vm.$nextTick();

      await wrapper.findAll('.zone-marker')[0].trigger('click');

      expect(wrapper.find('.panel-name').text()).toBe('艾尔文森林');
      expect(wrapper.find('.panel-empty').exists()).toBe(false);
    });

    it('已解锁区域显示"进入探索"按钮，锁定区域显示"未解锁"按钮', async () => {
      const mapStore = useMapStore(pinia);
      mapStore.initialized = true;
      mapStore.getZones.mockReturnValue(testZones);
      const wrapper = mountComp();
      await wrapper.vm.$nextTick();

      // 选中已解锁区域 z1
      await wrapper.findAll('.zone-marker')[0].trigger('click');
      expect(wrapper.find('.panel-btn.enter').exists()).toBe(true);

      // 选中锁定区域 z2
      await wrapper.findAll('.zone-marker')[1].trigger('click');
      expect(wrapper.find('.panel-btn.locked').exists()).toBe(true);
      expect(wrapper.find('.panel-btn.locked').attributes('disabled')).toBeDefined();
    });
  });

  describe('进入探索流程', () => {
    it('选 zone → 进入探索 → 确认后调用 mapStore.enterZone 与 emit enter-zone', async () => {
      const mapStore = useMapStore(pinia);
      mapStore.initialized = true;
      mapStore.getZones.mockReturnValue(testZones);
      mapStore.enterZone.mockReturnValue(true);
      const wrapper = mountComp();
      await wrapper.vm.$nextTick();

      // 选中已解锁区域
      await wrapper.findAll('.zone-marker')[0].trigger('click');
      // 点击"进入探索"按钮 → 弹出 ConfirmPopup
      await wrapper.find('.panel-btn.enter').trigger('click');
      expect(wrapper.findComponent(ConfirmPopup).exists()).toBe(true);

      // 触发 ConfirmPopup 的 confirm 事件 → onConfirmEnter
      await wrapper.findComponent(ConfirmPopup).vm.$emit('confirm');
      await flushPromises();

      expect(mapStore.enterZone).toHaveBeenCalledWith('z1');
      expect(wrapper.emitted('enter-zone')).toHaveLength(1);
    });

    it('enterZone 返回失败时不 emit enter-zone', async () => {
      const mapStore = useMapStore(pinia);
      mapStore.initialized = true;
      mapStore.getZones.mockReturnValue(testZones);
      mapStore.enterZone.mockReturnValue(false);
      const wrapper = mountComp();
      await wrapper.vm.$nextTick();

      await wrapper.findAll('.zone-marker')[0].trigger('click');
      await wrapper.find('.panel-btn.enter').trigger('click');
      await wrapper.findComponent(ConfirmPopup).vm.$emit('confirm');
      await flushPromises();

      expect(mapStore.enterZone).toHaveBeenCalledWith('z1');
      expect(wrapper.emitted('enter-zone')).toBeUndefined();
    });
  });

  describe('缩放控制', () => {
    it('点击放大按钮提高 zoomLevel 文本至 1.2x', async () => {
      const mapStore = useMapStore(pinia);
      mapStore.initialized = true;
      mapStore.getZones.mockReturnValue([]);
      const wrapper = mountComp();

      // 第一个 zoom-btn 是放大(+)
      await wrapper.findAll('.zoom-btn')[0].trigger('click');
      expect(wrapper.find('.zoom-level').text()).toBe('1.2x');
    });

    it('点击缩小按钮降低 zoomLevel 文本至 0.8x', async () => {
      const mapStore = useMapStore(pinia);
      mapStore.initialized = true;
      mapStore.getZones.mockReturnValue([]);
      const wrapper = mountComp();

      // 第二个 zoom-btn 是缩小(-)
      await wrapper.findAll('.zoom-btn')[1].trigger('click');
      expect(wrapper.find('.zoom-level').text()).toBe('0.8x');
    });
  });
});
