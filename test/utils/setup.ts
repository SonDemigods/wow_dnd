/**
 * @fileoverview 测试基础设施：Pinia 与通用 Mock 工具
 * @description
 *  - `createTestPinia()`：为 Store 单元测试创建真实的 Pinia 实例（setActivePinia），
 *    用于验证 State / Getter / Action 的真实行为。
 *  - `createStubPinia()`：基于 @pinia/testing 创建自动 stub Action 的 Pinia 实例，
 *    用于 Vue 组件测试中隔离 Store 副作用。
 *
 * 设计原则（遵循 code_rule）：
 *  - Store 自身测试使用真实 Pinia，以覆盖 Action 真实逻辑与 Getter 计算结果。
 *  - 组件测试使用 createTestingPinia，避免 Action 触发真实 DB 调用。
 *  - 严禁测试用例之间共享 Pinia 状态，每个 it 前必须重新 setActivePinia。
 */
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createTestingPinia, type TestingPiniaOptions } from '@pinia/testing';
import { config } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

/**
 * RecycleScroller / DynamicScroller 测试 stub
 *
 * jsdom 环境无 ResizeObserver 且元素尺寸为 0，真实的虚拟滚动组件无法计算可见区域，
 * 不会渲染任何条目。此 stub 将 items 数组通过 v-for 全量渲染，使测试可以直接
 * 通过 CSS 选择器查询到 .item-slot / .skill-slot / .quest-card 等元素。
 */
const VirtualScrollerStub = defineComponent({
  name: 'VirtualScrollerStub',
  props: ['items', 'itemSize', 'gridItems', 'itemSecondarySize', 'keyField', 'minItemSize', 'buffer', 'pageMode', 'prerender'],
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        { class: 'virtual-scroller-stub' },
        (props.items || []).map((item: any, index: number) =>
          slots.default?.({ item, index, active: true })
        )
      );
  },
});

const DynamicScrollerItemStub = defineComponent({
  name: 'DynamicScrollerItemStub',
  props: ['item', 'active', 'dataIndex', 'size'],
  setup(_, { slots }) {
    return () => slots.default?.();
  },
});

config.global.stubs = {
  ...config.global.stubs,
  RecycleScroller: VirtualScrollerStub,
  DynamicScroller: VirtualScrollerStub,
  DynamicScrollerItem: DynamicScrollerItemStub,
};

/**
 * 创建并激活一个真实的 Pinia 实例，供 Store 单元测试使用。
 * 每次调用返回全新实例，确保测试间状态隔离。
 *
 * @returns 已通过 setActivePinia 激活的新 Pinia 实例
 */
export function createTestPinia(): Pinia {
  const pinia = createPinia();
  setActivePinia(pinia);
  return pinia;
}

/**
 * 创建一个自动 stub 所有 Store Action 的 Pinia 实例（基于 @pinia/testing）。
 * 用于 Vue 组件测试，避免组件挂载时触发真实的 DB / 事件总线副作用。
 *
 * @param options - @pinia/testing 的配置（如 stubActions、initialState）
 * @returns 可传给 mount({ global: { plugins: [pinia] } }) 的 Pinia 实例
 */
export function createStubPinia(options?: TestingPiniaOptions): Pinia {
  return createTestingPinia({
    stubActions: true,
    ...options,
  });
}
