/**
 * @fileoverview 测试工具 setup.ts 的分支覆盖补全
 *
 * 覆盖 VirtualScrollerStub 的 (props.items || []) 防御性回退分支：
 * 当 items 为 undefined 时走 || [] 回退，渲染空容器不报错。
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { VirtualScrollerStub } from './setup';

describe('test/utils/setup.ts - VirtualScrollerStub 防御性分支', () => {
  it('items 为 undefined 时走 || [] 回退渲染空容器', () => {
    // 直接导入 VirtualScrollerStub 并挂载，不传 items prop
    // 通过 global.stubs: {} 清空全局 stub 注册，避免组件被自身 stub 替换导致 WeakMap key 错误
    const wrapper = mount(VirtualScrollerStub, {
      props: {} as any,
      global: {
        stubs: {},
      },
    });
    expect(wrapper.classes()).toContain('virtual-scroller-stub');
    // 无 items 时渲染空容器，不抛错
    expect(wrapper.findAll('.item-slot')).toHaveLength(0);
  });

  it('items 为空数组时渲染空容器', () => {
    const wrapper = mount(VirtualScrollerStub, {
      props: { items: [] } as any,
      global: {
        stubs: {},
      },
    });
    expect(wrapper.classes()).toContain('virtual-scroller-stub');
    expect(wrapper.findAll('.item-slot')).toHaveLength(0);
  });

  it('items 有数据时通过默认插槽渲染每一项', () => {
    const items = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }];
    const wrapper = mount(VirtualScrollerStub, {
      props: { items } as any,
      slots: {
        default: '<div class="item-slot">item</div>',
      },
      global: {
        stubs: {},
      },
    });
    expect(wrapper.findAll('.item-slot')).toHaveLength(2);
  });
});
