/**
 * @fileoverview useResponsiveGrid Composable 单元测试
 *
 * 覆盖 useResponsiveGrid 的：
 * 1. update 计算逻辑（clientWidth / padding / cols / itemSize）
 * 2. update 分支（el 不存在 / width<=0 / 正常计算）
 * 3. onMounted 生命周期（update 初始调用 + ResizeObserver 创建与 observe）
 * 4. onUnmounted 生命周期（observer.disconnect + 置空）
 * 5. ResizeObserver 回调触发 update 重新计算
 * 6. ResizeObserver 不可用时的降级（仅 update 一次，不创建 observer）
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - jsdom 无 ResizeObserver，通过 vi.stubGlobal 注入 MockResizeObserver
 *  - jsdom 中 clientWidth 始终为 0，通过 Object.defineProperty 覆写
 *  - window.getComputedStyle 通过 vi.spyOn 返回受控 padding 值
 *  - 通过 mount/unmount 触发 onMounted/onUnmounted 生命周期
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h, ref, type Ref } from 'vue';
import { useResponsiveGrid } from '@/composables/useResponsiveGrid';

// ==================== Mock ResizeObserver ====================

type MockResizeObserverCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;

interface MockObserver {
  callback: MockResizeObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
}

const observerInstances: MockObserver[] = [];

class MockResizeObserver {
  callback: MockResizeObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;

  constructor(callback: MockResizeObserverCallback) {
    this.callback = callback;
    this.observe = vi.fn();
    this.disconnect = vi.fn();
    this.unobserve = vi.fn();
    observerInstances.push(this);
  }
}

// ==================== 宿主组件工厂 ====================

interface MountResult {
  wrapper: ReturnType<typeof mount>;
  containerRef: Ref<HTMLElement | null>;
  gridItems: Ref<number>;
  itemSize: Ref<number>;
}

function mountHost(minItemSize: number, gap: number, el?: HTMLElement): MountResult {
  const containerRef = ref<HTMLElement | null>(el ?? null);
  let gridItems!: Ref<number>;
  let itemSize!: Ref<number>;

  const host = defineComponent({
    name: 'TestHost',
    setup() {
      const result = useResponsiveGrid(containerRef, minItemSize, gap);
      gridItems = result.gridItems;
      itemSize = result.itemSize;
      return () => h('div');
    },
  });

  const wrapper = mount(host);
  return { wrapper, containerRef, gridItems, itemSize };
}

// ==================== DOM 尺寸 mock 辅助 ====================

function setElementSize(
  el: HTMLElement,
  clientWidth: number,
  paddingLeft: string = '0px',
  paddingRight: string = '0px'
): void {
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth });
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    paddingLeft,
    paddingRight,
  } as CSSStyleDeclaration);
}

describe('useResponsiveGrid - 响应式网格列数计算', () => {
  beforeEach(() => {
    observerInstances.length = 0;
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // -------------------- 初始值 --------------------
  describe('初始值', () => {
    it('gridItems 默认 6，itemSize 默认 minItemSize + gap（containerRef 未绑定时保留初始值）', () => {
      // Arrange & Act：containerRef.value = null，update 提前 return，保留初始值
      const { wrapper, gridItems, itemSize } = mountHost(50, 10);

      // Assert
      expect(gridItems.value).toBe(6);
      expect(itemSize.value).toBe(60); // 50 + 10
      wrapper.unmount();
    });
  });

  // -------------------- update 计算逻辑 --------------------
  describe('update 计算逻辑', () => {
    it('根据容器宽度计算列数和单元格尺寸', () => {
      // Arrange：width=320, totalSlot=60, cols=floor(330/60)=5, itemSize=floor(330/5)=66
      const el = document.createElement('div');
      setElementSize(el, 320, '0px', '0px');

      // Act
      const { wrapper, gridItems, itemSize } = mountHost(50, 10, el);

      // Assert
      expect(gridItems.value).toBe(5);
      expect(itemSize.value).toBe(66);
      wrapper.unmount();
    });

    it('减去 padding 后计算内容区宽度', () => {
      // Arrange：clientWidth=340, padding=20, width=320
      const el = document.createElement('div');
      setElementSize(el, 340, '10px', '10px');

      // Act
      const { wrapper, gridItems, itemSize } = mountHost(50, 10, el);

      // Assert：与 width=320 一致
      expect(gridItems.value).toBe(5);
      expect(itemSize.value).toBe(66);
      wrapper.unmount();
    });

    it('容器宽度仅够 1 列时 cols=1（Math.max 保证下限）', () => {
      // Arrange：width=55, totalSlot=60, cols=max(1, floor(65/60))=1, itemSize=floor(65/1)=65
      const el = document.createElement('div');
      setElementSize(el, 55, '0px', '0px');

      // Act
      const { wrapper, gridItems, itemSize } = mountHost(50, 10, el);

      // Assert
      expect(gridItems.value).toBe(1);
      expect(itemSize.value).toBe(65);
      wrapper.unmount();
    });

    it('容器内容宽度 <= 0 时保留初始值', () => {
      // Arrange：clientWidth=10, padding=20, width=-10 <= 0
      const el = document.createElement('div');
      setElementSize(el, 10, '10px', '10px');

      // Act
      const { wrapper, gridItems, itemSize } = mountHost(50, 10, el);

      // Assert：update 提前 return，保留初始值
      expect(gridItems.value).toBe(6);
      expect(itemSize.value).toBe(60);
      wrapper.unmount();
    });
  });

  // -------------------- onMounted / ResizeObserver --------------------
  describe('onMounted 与 ResizeObserver', () => {
    it('onMounted 创建 ResizeObserver 并观察容器元素', () => {
      // Arrange
      const el = document.createElement('div');
      setElementSize(el, 320, '0px', '0px');

      // Act
      const { wrapper } = mountHost(50, 10, el);

      // Assert
      expect(observerInstances).toHaveLength(1);
      expect(observerInstances[0].observe).toHaveBeenCalledWith(el);
      wrapper.unmount();
    });

    it('ResizeObserver 回调触发 update 重新计算列数', () => {
      // Arrange：初始宽度 320
      const el = document.createElement('div');
      setElementSize(el, 320, '0px', '0px');
      const { wrapper, gridItems, itemSize } = mountHost(50, 10, el);
      expect(gridItems.value).toBe(5);

      // Act：模拟容器尺寸变化为 650
      setElementSize(el, 650, '0px', '0px');
      observerInstances[0].callback([], observerInstances[0] as unknown as ResizeObserver);

      // Assert：width=650, cols=floor(660/60)=11, itemSize=floor(660/11)=60
      expect(gridItems.value).toBe(11);
      expect(itemSize.value).toBe(60);
      wrapper.unmount();
    });

    it('ResizeObserver 不可用时仍执行 update 但不创建 observer', () => {
      // Arrange：移除 ResizeObserver 模拟环境不支持
      vi.unstubAllGlobals();
      const el = document.createElement('div');
      setElementSize(el, 320, '0px', '0px');

      // Act
      const { wrapper, gridItems } = mountHost(50, 10, el);

      // Assert：update 仍正常计算，但不创建 observer
      expect(gridItems.value).toBe(5);
      expect(observerInstances).toHaveLength(0);
      wrapper.unmount();
    });
  });

  // -------------------- onUnmounted --------------------
  describe('onUnmounted', () => {
    it('卸载时调用 observer.disconnect', () => {
      // Arrange
      const el = document.createElement('div');
      setElementSize(el, 320, '0px', '0px');
      const { wrapper } = mountHost(50, 10, el);
      const observer = observerInstances[0];
      expect(observer.disconnect).not.toHaveBeenCalled();

      // Act
      wrapper.unmount();

      // Assert
      expect(observer.disconnect).toHaveBeenCalledTimes(1);
    });
  });
});
