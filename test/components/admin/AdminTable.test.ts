/**
 * @fileoverview AdminTable 通用数据表格组件单元测试
 *
 * 覆盖 AdminTable.vue 的：
 * 1. 渲染：列头、行数据、空数据提示、记录总数
 * 2. 插槽：cell-{key} 作用域插槽、actions 插槽分发
 * 3. emit：create / refresh / edit / delete / search
 * 4. 工具栏按钮显隐：hideCreate / hideEdit
 * 5. format 自定义格式化函数
 *
 * 遵循 code_rule：
 *  - 无 Pinia 依赖，使用 mount 真实渲染。
 *  - 不断言计算后 CSS 样式值，仅断言 class、文本、emit、属性。
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AdminTable from '@/components/admin/AdminTable.vue';
import type { TableColumn } from '@/components/admin/AdminTable.vue';

interface Row {
  id: string;
  name: string;
  age: number;
}

const columns: TableColumn<Row>[] = [
  { key: 'id', label: 'ID', width: '120px' },
  { key: 'name', label: '名称' },
  { key: 'age', label: '年龄' },
];

const rows: Row[] = [
  { id: 'r1', name: '战士', age: 20 },
  { id: 'r2', name: '法师', age: 25 },
];

describe('AdminTable 通用数据表格组件', () => {
  describe('渲染', () => {
    it('列头按 columns 顺序渲染（含操作列）', () => {
      const wrapper = mount(AdminTable, {
        props: { columns, data: rows },
      });
      const headers = wrapper.findAll('thead th');
      // 3 列 + 操作列
      expect(headers).toHaveLength(4);
      expect(headers[0].text()).toBe('ID');
      expect(headers[1].text()).toBe('名称');
      expect(headers[2].text()).toBe('年龄');
      expect(headers[3].text()).toContain('操作');
    });

    it('列头应用 width 内联 style', () => {
      const wrapper = mount(AdminTable, {
        props: { columns, data: rows },
      });
      const firstTh = wrapper.findAll('thead th')[0];
      expect(firstTh.attributes('style')).toContain('width: 120px');
    });

    it('行数据按 data 渲染对应单元格', () => {
      const wrapper = mount(AdminTable, {
        props: { columns, data: rows },
      });
      const bodyRows = wrapper.findAll('tbody tr');
      expect(bodyRows).toHaveLength(2);
      expect(bodyRows[0].findAll('td')[1].text()).toBe('战士');
      expect(bodyRows[1].findAll('td')[2].text()).toBe('25');
    });

    it('data 为空时显示"暂无数据"占位行', () => {
      const wrapper = mount(AdminTable, {
        props: { columns, data: [] },
      });
      expect(wrapper.find('.empty-cell').exists()).toBe(true);
      expect(wrapper.find('.empty-cell').text()).toBe('暂无数据');
      expect(wrapper.find('.empty-cell').attributes('colspan')).toBe(String(columns.length + 1));
    });

    it('table-footer 显示 totalCount 记录数', () => {
      const wrapper = mount(AdminTable, {
        props: { columns, data: rows, totalCount: 99 },
      });
      expect(wrapper.find('.table-footer').text()).toContain('共 99 条记录');
    });
  });

  describe('format 格式化', () => {
    it('列定义 format 函数覆盖默认渲染', () => {
      const cols: TableColumn<Row>[] = [
        { key: 'age', label: '年龄', format: () => 'AGE' },
      ];
      const wrapper = mount(AdminTable, {
        props: { columns: cols, data: rows },
      });
      expect(wrapper.findAll('tbody tr')[0].findAll('td')[0].text()).toBe('AGE');
    });

    it('null/undefined 值显示"-"', () => {
      const cols: TableColumn[] = [{ key: 'name', label: '名称' }];
      const wrapper = mount(AdminTable, {
        props: { columns: cols, data: [{ name: null }] },
      });
      expect(wrapper.findAll('tbody tr')[0].findAll('td')[0].text()).toBe('-');
    });

    it('boolean 值显示"是/否"', () => {
      const cols: TableColumn[] = [{ key: 'flag', label: '标记' }];
      const wrapper = mount(AdminTable, {
        props: {
          columns: cols,
          data: [{ flag: true }, { flag: false }],
        },
      });
      const tds = wrapper.findAll('tbody tr');
      expect(tds[0].findAll('td')[0].text()).toBe('是');
      expect(tds[1].findAll('td')[0].text()).toBe('否');
    });
  });

  describe('插槽分发', () => {
    it('cell-{key} 作用域插槽接收 row/value 并渲染', () => {
      const wrapper = mount(AdminTable, {
        props: { columns, data: rows },
        slots: {
          'cell-name': '<template #cell-name="{ row, value }"><span class="cell-slot">{{ value }}@{{ row.id }}</span></template>',
        },
      });
      const slot = wrapper.find('.cell-slot');
      expect(slot.exists()).toBe(true);
      expect(slot.text()).toBe('战士@r1');
    });

    it('actions 插槽替换默认操作按钮', () => {
      const wrapper = mount(AdminTable, {
        props: { columns, data: rows },
        slots: {
          actions: '<template #actions="{ row }"><button class="custom-action">{{ row.id }}</button></template>',
        },
      });
      expect(wrapper.find('.custom-action').exists()).toBe(true);
      // 默认编辑/删除按钮不应出现
      expect(wrapper.find('.btn-edit').exists()).toBe(false);
      expect(wrapper.find('.btn-delete').exists()).toBe(false);
    });
  });

  describe('工具栏按钮显隐', () => {
    it('默认渲染"新增"与"刷新"按钮', () => {
      const wrapper = mount(AdminTable, {
        props: { columns, data: rows },
      });
      expect(wrapper.find('.btn-primary').text()).toContain('新增');
      expect(wrapper.find('.btn-secondary').text()).toContain('刷新');
    });

    it('hideCreate=true 时不渲染"新增"按钮', () => {
      const wrapper = mount(AdminTable, {
        props: { columns, data: rows, hideCreate: true },
      });
      expect(wrapper.find('.btn-primary').exists()).toBe(false);
    });

    it('hideEdit=true 时行内不渲染"编辑"按钮，保留"删除"', () => {
      const wrapper = mount(AdminTable, {
        props: { columns, data: rows, hideEdit: true },
      });
      expect(wrapper.find('.btn-edit').exists()).toBe(false);
      expect(wrapper.find('.btn-delete').exists()).toBe(true);
    });
  });

  describe('emit 事件', () => {
    it('点击"新增"触发 create', async () => {
      const wrapper = mount(AdminTable, {
        props: { columns, data: rows },
      });
      await wrapper.find('.btn-primary').trigger('click');
      expect(wrapper.emitted('create')).toHaveLength(1);
    });

    it('点击"刷新"触发 refresh', async () => {
      const wrapper = mount(AdminTable, {
        props: { columns, data: rows },
      });
      await wrapper.find('.toolbar-right .btn-secondary').trigger('click');
      expect(wrapper.emitted('refresh')).toHaveLength(1);
    });

    it('点击行内"编辑"触发 edit 并携带该行数据', async () => {
      const wrapper = mount(AdminTable, {
        props: { columns, data: rows },
      });
      await wrapper.findAll('.btn-edit')[0].trigger('click');
      expect(wrapper.emitted('edit')).toHaveLength(1);
      expect(wrapper.emitted('edit')![0][0]).toEqual(rows[0]);
    });

    it('点击行内"删除"触发 delete 并携带该行数据', async () => {
      const wrapper = mount(AdminTable, {
        props: { columns, data: rows },
      });
      await wrapper.findAll('.btn-delete')[1].trigger('click');
      expect(wrapper.emitted('delete')).toHaveLength(1);
      expect(wrapper.emitted('delete')![0][0]).toEqual(rows[1]);
    });

    it('搜索框 input 触发 search 并携带关键词', async () => {
      const wrapper = mount(AdminTable, {
        props: { columns, data: rows },
      });
      await wrapper.find('.search-input').setValue('战士');
      expect(wrapper.emitted('search')).toBeTruthy();
      expect(wrapper.emitted('search')![0][0]).toBe('战士');
    });
  });

  describe('行 key', () => {
    it('无 id/characterId 时使用 row-{index} 作为 key', () => {
      const cols: TableColumn[] = [{ key: 'name', label: '名称' }];
      const wrapper = mount(AdminTable, {
        props: { columns: cols, data: [{ name: 'A' }, { name: 'B' }] },
      });
      const trs = wrapper.findAll('tbody tr');
      expect(trs).toHaveLength(2);
      // 仅验证行正常渲染（key 不暴露为属性，验证无报错且行数正确）
      expect(trs[0].findAll('td')[0].text()).toBe('A');
    });
  });
});
